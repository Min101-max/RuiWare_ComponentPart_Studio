# 组件模板平台代码架构

## 目录与依赖

```text
src/main.tsx                      应用挂载
src/app/App.tsx                   工作台组合、各阶段数据与回调连接
src/app/WorkspaceLayout.tsx       顶栏、七阶段导航、三列布局、状态栏
src/app/stages.ts                 稳定的阶段标识及中文名称
src/app/useComponentWorkspace.ts  草稿 reducer、界面选择、导出副作用
src/stages/                      七个实际编辑面板
src/domain/component.ts          工程数据模型与新草稿默认值
src/domain/componentReducer.ts   无副作用的编辑操作及关联清理
src/domain/validation.ts         基础检查与待接入检查
src/domain/serialization.ts      导出格式，不依赖页面状态
src/library/                     已发布零部件列表、请求和数据校验
src/viewport/ComponentViewport.tsx 三维场景和预览选择展示
src/styles/workspace.css         工作台样式
backend/app/config.py             后端环境配置，密钥仅留在 Python
backend/app/library.py            发布库响应模型、只读调用和 API 路由
backend/app/main.py               FastAPI 入口、生命周期、健康检查、静态页面
backend/tests/test_api.py         后端接口及配置测试
scripts/start-dev.ps1             一键安装、后台启动及就绪检查
tests/                           Node 原生领域和前端列表测试
```

前端依赖方向：`app → stages / library / viewport / domain`，`stages → domain（类型）`，`viewport → domain / library（类型）`。`domain` 不导入 React、DOM、网络、服务端配置或 Three.js。后端 Python 模块不进入浏览器构建。

运行链路：`浏览器 → Vite :5180 /api 转发 → FastAPI :8020 → 零部件平台 :8010`。FastAPI 通过 httpx 异步调用固定发布列表路径，10 秒超时、拒绝重定向，使用 Pydantic 校验响应并移除契约之外的字段。FastAPI 生命周期创建并关闭 HTTP 客户端；业务异常保留原错误码和安全提示，不返回上游内部详情。配置来自根目录 `.env`、`.env.local` 和系统环境变量，系统环境变量优先。

FastAPI 提供 `/api/health`、`/api/published-templates`、`/docs` 和 `/openapi.json`；健康检查不联系零部件平台。开发与预览由 Vite 转发 `/api`，不开放跨域。构建完成后也可由 FastAPI 直接提供 `dist`，详情见 README。

## 七阶段

| 标识 | 面板 | 当前职责 |
| --- | --- | --- |
| definition | DefinitionStage | 编辑名称、编码、类型、设计说明 |
| assembly | AssemblyStage | 记录接口连接和继承接口；显示实际能力边界 |
| interfaces | InterfacesStage | 显示对外接口来源和槽位占用 |
| parameters | ParametersStage | 编辑数值，显示范围与绑定数据 |
| rules | RulesStage | 编辑规则说明 |
| validation | ValidationStage | 显示当前草稿修订对应的基础检查及待接入检查 |
| publish | PublishStage | 汇总检查结果并导出草稿 |

阶段只是编辑视角。切换阶段不修改工程数据，也不表示该阶段已完成。

## 三类状态

1. 工程文档：定义、成员、连接、接口、槽位、参数、绑定、规则。由 `componentReducer` 修改；有效编辑增加修订号，新建返回独立的新文档。
2. 页面交互：当前阶段、所选成员、预览模板、状态消息在工作台 hook 中；搜索、列表加载和详情展开在 library 中。收起详情不会清除工作台预览选择，新建会清除工作台选择并收起发布详情，保留列表与搜索。
3. 运行时三维资源：归 viewport 管理，本轮仅包含相机、网格和轨道控制；没有把虚构几何作为真实模型展示，也没有把渲染对象放入文档。

## 引用与数据操作

- 发布模板由 `publicationId + templateId + version + sha256` 固定引用。多个成员可引用同一版本，但拥有独立成员标识、位置、姿态和参数覆盖值。
- 连接和接口在内存中使用 `{ memberId, interfaceId }`。标识含点号也不会被错误拆分。
- 删除成员清理关联连接、对外接口和参数绑定；保留槽位定义，将其占用清空。必填空槽位会在验证中失败。
- 位置使用毫米、旋转使用弧度，工程坐标为右手 Z 向上。正式模型加载时，在 viewport 边界明确处理文件单位与坐标，不能修改工程定义来适配显示。
- reducer 支持新增/编辑/删除成员、新增连接和对外接口，以及删除成员时的关联清理；包解析尚未接入，因此当前页面不会创建示例成员来代替真实零部件。

## 验证与导出

`validateComponent(document)` 每次对当前文档计算 `pass / fail / pending`。基础数据检查不能证明几何可装配或规则满足，装配求解和规则执行目前固定为 pending。

`serializeComponent(document)` 保留 `component-1.0` 的 `name`、`stages.definition`、`stages.assembly`、`stages.ports`、参数值、规则及验证主体结构。增加修订、完整版本引用、结构化引用、参数定义、槽位和绑定。旧连接字符串仍导出，新增读取方应使用 `fromRef/toRef` 以避免含点号标识的歧义。旧接口的 `sourceMemberId/sourceInterfaceId` 字段保留。

序列化入口只接收工程文档，显式生成输出，不导出页面选中状态、预览记录、密钥、相机或模型缓存。pending 检查的旧式 `passed` 字段为 false。导出不创建发布版本，不把草稿标为已发布。

## 下一步扩展位置

模板包下载/校验/解析的服务端能力加入 `backend/app`，API 使用固定受控路径；前端 `library` 接收解析结果。加载器向工作台提供已解析零部件数据及模型资源引用；点击预览不修改工程文档，明确“加入装配”才发出 `member.add`。

真实模型展示接入 `viewport`，相机对焦和 Three.js 资源释放留在视图侧。成员变换、接口求解、参数求值属于工程能力，应通过工作台协调和领域操作写回数据。正式发布另接发布服务，不用本地 JSON 下载代替发布。
