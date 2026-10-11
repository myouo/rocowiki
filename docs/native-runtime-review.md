# 原生 Docusaurus 页面崩溃复核

日期：2026-10-11。复现环境：`http://localhost:3000/` 的原生 Docusaurus 开发站。

## 已修复的问题

首页「我也来编辑」实际跳到 `/help/contributing/`。该页挂载原生 `TOCItems` 后，Docusaurus 3.10.2 的 `useTOCHighlight` 调用 `document.querySelector('.navbar').clientHeight`。导入项目的自定义 Navbar 只渲染 `.rw-site-header`，导致选择器返回 null，文档进入「页面已崩溃」错误页。浏览器已复现与用户一致的错误及组件栈。

这项框架约定影响带原生目录的文档页，包含贡献帮助、回归/培养/PVE 指南、战斗机制等，不能只在首页入口规避。

修复在原生 Navbar 向共用页头传入 `navbar` 类名，使目录组件读到实际页头高度。`.rw-site-header.navbar` 明确使用两行布局的 `display: block; height: auto; padding: 0`，并取消旧 `.navbar` 规则的 backdrop-filter，避免新增标记引入默认导航布局。自包含预览的页头继续使用原来的布局类。

## 回归覆盖

新增测试直接执行当前安装版本的 Docusaurus `useTOCHighlight`，仅替换站点上下文；实际 Navbar 与目录钩子参与同一次 React StrictMode 挂载。补丁前该测试复现同一个 `clientHeight` 错误。补丁后检查实际节点、高亮、完整页头高度偏移及 scroll/resize 订阅清理。

浏览器通过原生路由进行切换，覆盖：

- 首页入口点击，以及全部 25 篇原生 Markdown 文档的挂载、滚动与 resize。
- 96 个自定义路由及工作台、贡献页、两篇 Git 内容页，共 125 个不同页面路径；有下拉框的页面抽查前两个控件的展开、滚动和 Escape 关闭。
- 个人中心 overview、profile、security、honors、activity、drafts、submissions、bookmarks 共 8 个标签页。
- 11 类编辑器的代表性新增/修订入口：article、pet、skill、event、index、npc、matchup、acquisition、pve-guide、pve、relationship。检查预览 iframe 唯一 host、正文显示、手机/桌面切换、差异对照与返回填写；未在这些检查中提交或发布投稿。
- 390 × 844 手机模拟视口下，从首页展开导航后点击编辑帮助入口，页面正常且导航收起；桌面检查视口为 2048 × 1112。

上述浏览器检查未再发现页面崩溃或未处理运行时异常。采集到的编辑链接为 461 条，预览检查按 11 种模式选代表入口，不等于逐个验证全部链接。浏览器为独立的无界面 Chrome；本记录不替代桌面 NVIDIA/Wayland 图形加速问题的对照测试。

浏览器记录：[native-browser-results.json](../apps/web/validation/native-browser-results.json)。其中记录了当次时间、环境、路径、模式与结果。它是调查快照，后续代码变更不会自动刷新。

## 检查结果

- `npm run test:runtime -w @rocowiki/web`：141 项通过，包含真实框架目录钩子及既有 96 路由生命周期检查。
- `npm run typecheck`：通过。
- `npm run check:v73 -w @rocowiki/web`：社区 111、计算器 58、学习关系 44、界面 42、流程图 79、图鉴 29 项全部通过。
- `npm run build`：通过，生成 126 个完整 HTML 页面及 115 页公开搜索索引。
- `npm run build:preview -w @rocowiki/web`：通过，更新自包含预览。

之前的生命周期测试把 Layout 替换为轻量组件、只遍历自定义页面，因此漏掉了原生 TOC 对页头的依赖。本次补上真实框架钩子回归，并用原生 localhost 站点复核。该范围以外的复杂输入组合、远端身份服务及正式发布仍需相应联调，不能据这些结果宣布全站没有其他缺陷。
