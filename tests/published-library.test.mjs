import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { fetchPublishedTemplates, parsePublishedTemplates } from '../src/library/publishedLibrary.ts';

const publication = {
  publicationId: 'version-1', templateId: 'draft-1', version: 1,
  name: '横梁', code: 'BEAM-001', createdAt: '2026-10-05T00:00:00Z',
  sha256: 'a'.repeat(64), size: 1024,
  downloadUrl: '/api/public/v1/templates/version-1/download',
};

test('保留不同发布版本并按发布时间排序', () => {
  const items = parsePublishedTemplates({ items: [publication, {
    ...publication, publicationId: 'version-2', version: 2, createdAt: '2026-10-06T00:00:00Z',
  }], count: 2 });
  assert.deepEqual(items.map(item => [item.publicationId, item.version]), [['version-2', 2], ['version-1', 1]]);
  assert.deepEqual(parsePublishedTemplates({ items: [], count: 0 }), []);
});

test('拒绝缺失、重复或无效的发布元数据', () => {
  for (const response of [
    {}, { items: [null], count: 1 }, { items: [publication], count: 0 },
    { items: [publication, publication], count: 2 },
    ...[{ publicationId: '' }, { templateId: null }, { name: 42 }, { version: 0 },
      { createdAt: 'invalid' }, { size: -1 }, { sha256: 'invalid' }].map(override => ({
        items: [{ ...publication, ...override }], count: 1,
      })),
  ]) assert.throws(() => parsePublishedTemplates(response), /发布库返回的数据格式不正确/);
});

async function serve(t, handler) {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('客户端读取真实响应，拒绝异常数据并显示明确的服务错误', async t => {
  let payload = { items: [publication], count: 1 };
  let status = 200;
  const endpoint = await serve(t, (_req, res) => {
    res.statusCode = status;
    res.end(JSON.stringify(payload));
  });
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (url, options) => nativeFetch(new URL(url, endpoint), options));
  const signal = new AbortController().signal;
  assert.equal((await fetchPublishedTemplates(signal))[0].publicationId, 'version-1');
  payload = { items: [], count: 0 };
  assert.deepEqual(await fetchPublishedTemplates(signal), []);
  payload = { items: [{ ...publication, sha256: 'bad' }], count: 1 };
  await assert.rejects(fetchPublishedTemplates(signal), /数据格式不正确/);
  status = 401;
  payload = { error: { code: 'PUBLIC_API_KEY_INVALID', detail: 'secret-debug-details' } };
  await assert.rejects(fetchPublishedTemplates(signal), /密钥不正确/);
  status = 503;
  payload = { error: { code: 'REMOTE_STORAGE_NOT_CONFIGURED' } };
  await assert.rejects(fetchPublishedTemplates(signal), /尚未配置共享发布库/);
  await assert.rejects(fetchPublishedTemplates(AbortSignal.abort()), { name: 'AbortError' });
});
