# 发布包模型预览契约

组件平台只读消费已发布 `.rwpart`（ZIP），不修改源模板、不重新编译旧版本。当前预览不会加入装配或改变草稿修订。

## 发布包要求

```text
manifest.json
parameters.json
interfaces.json
outputs.json
geometry/preview.stl
```

`manifest.json` 使用 `schemaVersion: "3.0"`、`unitSystem: "mm-kg-s"`、`coordinateSystem: "right-handed-z-up"`，`id/code` 与发布记录的 `templateId/code` 一致。接口文件需声明相同坐标系。参数读取 `parameters.json.definitions`，接口读取 `interfaces.json.interfaces`，原始声明保留，不推测物理装配坐标。

`outputs.json.success` 必须为 true，`artifacts` 恰有一条 STL 输出：

```json
{
  "kind": "stl",
  "url": "/artifacts/0123456789abcdef/preview.stl",
  "packagePath": "geometry/preview.stl",
  "size": 123456,
  "sha256": "STL 文件实际的 64 位十六进制 SHA-256"
}
```

新格式读取 `packagePath`，不依赖 `url`。包内路径目前只支持 `geometry/preview.stl`。整包实际字节数、SHA-256 必须与发布元数据一致，STL 字节数、SHA-256 必须与 artifact 一致。新格式损坏时直接报错，不转用旧地址。

旧包无 `packagePath` 时，仅允许固定配置上游的 `/artifacts/<16至64位十六进制>/preview.stl`，不接受任意 URL、不跟随重定向，同样校验 STL 哈希。不存在则返回 `MODEL_MISSING`，需要在零部件平台发布包含 STL 的新版本；组件平台不修补或覆盖历史发布对象。

## API

`GET /api/published-templates/{publicationId}/preview?sha256={整包哈希}` 返回：

- `publication`：固定发布记录。
- `unitSystem/coordinateSystem`：单位与工程坐标。
- `parameters/interfaces`：原始定义数组。
- `model`：`format: stl`、`source: package|legacy`、同源 `url`、模型 `size/sha256`。

`GET /api/published-templates/{publicationId}/preview/model?sha256={整包哈希}` 返回 `model/stl`，附加 `X-RuiWare-SHA256`、`X-Content-Type-Options: nosniff`。模型 URL 的哈希代表包版本，响应头哈希代表 STL 文件。前端对描述中的发布版本及模型下载再次校验。

上游元数据始终重新核对。若发布哈希变化返回 409 `PUBLICATION_CHANGED`。包和模型损坏返回 502 `PACKAGE_INTEGRITY_ERROR/MODEL_INTEGRITY_ERROR/PACKAGE_INVALID`；无模型或不支持格式返回 422 `MODEL_MISSING/PACKAGE_UNSUPPORTED`。错误不返回上游调试信息。

## 资源限制与生命周期

单包/模型最多 64 MiB，ZIP 总声明展开最多 128 MiB、256 条目、单 JSON 2 MiB，仅接受 STORE/DEFLATE，不写入磁盘。不接受重复路径、穿越、反斜杠、符号链接和加密条目。包读取链路总超时 30 秒（含等待），每次 HTTP 读取空闲超时 10 秒；最多两个并行加载。成功结果缓存按发布 ID/包哈希索引，模型及序列化描述计入 128 MiB 上限，后端重启清空。失败不缓存。

前端保留原点、毫米、右手 Z 向上，加载后根据网格边界适配相机和网格尺寸。STL 解析拒绝空网格、非有限坐标和全退化三角形。切换取消旧请求，迟到结果不覆盖新选择；新建/切换/卸载释放几何，材质随场景卸载释放。预览结果不进入组件导出。

本轮验证：后端契约测试、前端解析测试，以及独立测试服务中的真实 CAD STL 经 ZIP → FastAPI → 浏览器显示。独立服务不向真实共享库写入测试发布。真实旧包若模型不存在，页面准确显示需发布新版本。
