# Web V7.3.1 导入与运行时修复

日期：2026-10-11。来源为用户提供的 `/home/myo/Downloads/RocoWiki_Docusaurus_V7_3_1/roco-wiki`。只修改导入副本，原项目保持不变；先前 Web 保存在 `/tmp/rocowiki-web-before-v731-1791650612`，用于本次迁移回溯。

后续 Linux Chrome 滚动黑块/画面错位已通过用户图形加速开关对照定位到 GPU 绘制路径，详见 [滚动绘制调查](./scroll-rendering-investigation.md)。该问题没有作为 React 生命周期缺陷计入下列修复。

首页编辑帮助入口触发的原生 TOC `clientHeight` 崩溃已修复，并补充真实框架钩子测试及 125 个原生页面的浏览器复核，详见 [原生运行时复核](./native-runtime-review.md)。当前生命周期门禁为 141 项；下表 137 项是导入阶段记录。

一级入口的页面宽度已统一到 `src/css/page-layout.css`：容器最大宽度 1432 px，桌面左右各留 34 px，内容最大宽度 1364 px；996 px 以下留 23 px，600 px 以下留 16 px。修正 flex 布局中容器因缺少 `width: 100%` 而按内容收缩的问题，解除社区页面的内层宽度限制；导航、原生文档整体、工作台、预览和页脚使用同一尺寸变量。浏览器在 1920、1280、900、390 px 视口下检查 17 个入口，共 68 次测量，宽度及左右边界均一致，无横向溢出。原生构建与独立 HTML 预览已更新。

## 导入范围与架构连接

- `apps/web` 使用 V7.3.1 的页面、原生路由插件、25 篇文档、图鉴和业务表单、计算器、CSS、11 MiB 图片与字体资源。保持已有界面布局和设计。
- npm workspace 统一锁文件和依赖，Node 要求为 24.15.0+；旧 API、D1 迁移、Git Wrapper 与发布状态机保持。
- 真实 OIDC/D1 共建工作台和公开贡献页保留，分别为 `/workbench/`、`/contributors/`；站点增加工作台入口。根目录 Git 内容经受信生成器输出到 `/wiki/`，独立 docs plugin 避免与原知识文档路径冲突。
- `SITE_URL`、`API_ORIGIN` 和公开 GitHub 地址沿用 CI 配置；静态构建、制品 digest、version manifest 和 EdgeOne 发布仍走原流水线。
- 全站搜索保留原设计的图鉴查询，Pagefind 为公开阅读页面建立索引。编辑、审核、账号、反馈、工作台及社区管理入口不作为公开正文入索引。
- 来源项目的社区功能是本机原型：未接入真实签到、评论、排行或新版结构化编辑 API，不会改变 D1/GitHub 发布状态。`apps/web/content` 继续由开发者维护，公众写入仍受根目录 catalog/schema 约束。

## 主要修复

| 问题或风险 | 处理 | 验证 |
| --- | --- | --- |
| 预览 iframe 初始空白文档和载入时序不确定 | 明确 `srcDoc`，实际 load 后准备唯一 host；替换 iframe 前先在独立 commit 卸载 portal，portal 位于 iframe 之前供正常卸载 | 六轮载入/重复 load/强制测量失败/重新载入；Chrome 12 次开关、手机与桌面切换，正文均可见且草稿未变 |
| 编辑入口 portal 的 DOM host 先于 React 子节点移除 | 过期 host 在 portal 更新提交后删除；按路径/查询重建扫描器，使用所属文档 Observer；中断后的任务不得再次扫描 | 连续改标题、移除页面、StrictMode 重放与 96 个自定义路由切换 |
| 页面身份复用导致旧详情状态留在新实体 | 阅读内容按路径和稳定实体 entry 建立 key；过滤参数不强制重挂整个页，保留输入焦点；内容与扫描器使用不同 key 命名空间 | 96 路由挂载/卸载；所有 ResizeObserver 最后均断开，无 duplicate-key 及未处理生命周期错误 |
| 编辑器卸载保存会更新已卸载父组件 | workspace 加入 mounted 标识，卸载时仍可持久化最新草稿，但不再更新已卸载的 UI state | 路由切换和 pagehide 保存回归 |
| 自动保存写入失败仍清除 dirty、显示已保存 | 写入后核验对应草稿所有字段，失败保留 dirty 和输入、提示失败；存储恢复后仍可 flush | 模拟 quota 异常、等待自动保存、恢复存储后 pagehide，最新正文持久化 |
| 损坏数据能解析为 JSON，却不是期望集合 | contributions、activity、events 使用数组/记录类型约束，过滤 null 行；清空 storage 事件也刷新目录状态 | 错误 events 对象、错误 submissions 集合、null 记录不崩溃 |
| 计算记录校验了清洗副本，却继续返回原对象 | 读取返回经过规范化的 form 与宠物链接，限制字段长度；历史结果保持 | 危险链接被移除，既有计算器回归 |
| 弹窗节点失效、API 缺失或旧 close 事件影响新弹窗 | 检查节点连接状态，缺少原生 dialog 方法时降级；旧 close 事件不关闭已重新打开的窗；查询变化清理反馈上下文 | 不支持 showModal 的 DOM、连续开关与真实 Chrome 导航 |
| 无值 textarea、不可用滚动方法、字体 Promise 失败 | 无值降级空文本，可选调用 scrollIntoView，字体失败使用现有测量值 | 缺失输入数据与编辑/预览运行时回归 |

React 的清理必须对应建立的订阅；portal 的 DOM 容器生命周期也必须与 React 所有权一致。本次按 [React effect 文档](https://react.dev/reference/react/useEffect)、[portal 文档](https://react.dev/reference/react-dom/createPortal) 核对，并通过实际代码和重放场景验证。

## 验证方式与边界

新增 `validation/check-runtime-lifecycle.cjs`：使用当前源代码、React StrictMode、真实 JSDOM DOM 与明确的 Observer 测量替身，执行 137 项断言和 96 个路由转换。覆盖空值、损坏存储、自动保存失败、弹窗、预览重建、portal 卸载及订阅清理；没有把模拟尺寸当作真实设备性能结果。

原 V7.3 的 flow 脚本查找已被 V7.3.1 替换的 DOM 结构，不能作为当前流程图回归。保留其文件供历史追溯，当前门禁使用 `check-v731-flow.cjs`，未通过放宽断言掩盖错误。

旧 `check-v73-integration.cjs` 还依赖未随 V7.3.1 提供的 `RocoWiki_UI_V7_3.html`。它与旧版交付检查同样保留为归档，当前完整集成由原生路由/HTML 检查、新生命周期门禁和本次浏览器记录承担；没有把 V7.3.1 产物改名冒充旧版。

原生构建已验证完整 HTML；Chrome 使用与原生站共用组件的自包含预览验证交互。真实 OIDC 登录、远端 D1、EdgeOne/CDN 和三网连接仍按运维门禁单独联调，不计入本次 Web 修复结果。

当前检查结果：

| 检查 | 结果 |
| --- | --- |
| API、Schema、身份、发布、恢复测试 | 56/56 通过，后端约束保持 |
| 新 Web 生命周期门禁 | 137/137 通过，96 次路由转换，全部 Observer 已释放 |
| 社区模型/签到/排行 | 111/111 通过 |
| 能力计算与计算记录 | 58/58 通过 |
| 技能学习关系 | 44/44 通过 |
| 输入与界面组件 | 42/42 通过 |
| V7.3.1 流程图 | 79/79 通过 |
| V7.3.1 图鉴 | 29/29 通过 |
| 原生 Docusaurus 构建 | 126 个完整 HTML 页面；保留原 121 个内容地址，新增/保留 API 工作台、贡献主页与两份 Git 内容页；另含 404 |
| TypeScript | 通过；旧工作台复用新 BoundedTextarea 并保留类型接口 |
| Chrome 交互 | 主要图鉴、技能、PVE、账号、编辑路径未进入恢复页；12 次预览开关和设备切换均显示正文、草稿不变、未处理错误为 0 |

检查命令：根目录 `npm run check`；对应原版功能 `npm run check:v73 -w @rocowiki/web`。生命周期明细在 `apps/web/validation/runtime-lifecycle-results.json`，每次命令运行重新生成；其余带旧版本号的历史报告不自动作为本次通过依据。
