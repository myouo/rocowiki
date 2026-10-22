# 贡献指南
[English](CONTRIBUTING.en.md) · [行为准则](CODE_OF_CONDUCT.md) · [安全政策](SECURITY.md)
<!-- rocowiki-policy: contributing; version: 14; lang: zh-CN -->

<a id="entry"></a>
## 选择入口

普通缺陷、功能建议与资料纠错使用仓库的 [Issue 模板](.github/ISSUE_TEMPLATE)。说明问题、影响和必要的复现步骤；不要公开未经脱敏的日志或账号资料。安全漏洞按 [安全政策](SECURITY.md) 私密报告。

<a id="wiki"></a>
## Wiki 资料贡献

资料纠错可先通过 Issue 提供。正式投稿在站点开放相应功能后从 `/workbench/` 进入，需要已验证邮箱的站内账号及投稿权限，GitHub 绑定可选。

以页面的现有内容为基线，说明修改理由，提供可核验来源，区分官方资料、实测、推断和待验证信息。不要把样本或演示数据当作正式记录。

投稿须经过独立审核，禁止自审；关键页需要两位不同审核员。基线变化后重新整理候选并接受复核。

只提交你有权提供的原创或已获授权资料，引用注明来源，保留作者及许可依据。新原创 Wiki 正文采用 **CC BY-SA 4.0**，作者保留版权；允许公众署名转载、改编和商业使用，分享改编内容须遵守相同方式共享要求。投稿不构成版权转让，也不把游戏素材或无权许可的内容一并改为 CC；新许可不得无授权追溯覆盖已有作品。具体要求见 [版权声明](COPYRIGHT.md)。

正式投稿须具备明确的内容许可确认。GitHub 邮箱署名需要绑定、明确授权并为当次投稿单独勾选；署名同意不能替代内容授权。

<a id="setup"></a>
## 本地开发

需要 Node.js 24.15.0+。安装依赖并准备本地数据库：

```bash
npm ci
npm run db:migrate
```

在两个终端分别启动 API 和网页：

```bash
npm run dev:api
npm run dev:web
```

网页和 API 分别使用 `http://localhost:3000` 与 `http://localhost:8787`，避免与 `127.0.0.1` 混用。开发配置参考 [示例文件](apps/api/.dev.vars.example)，私密配置保存在未提交的本地文件中。

<a id="change"></a>
## 代码与文档

修改前阅读相关模块，遵守 [仓库协作规范](AGENTS.md) 与 [安全政策](SECURITY.md)。保持改动聚焦，沿用项目现有结构和约定；修改源文件并重新生成产物，不直接修补生成文件。

行为变更补充必要的验证。规范文档同时更新中英文，保持政策版本和章节一致。贡献指南只介绍参与方式和协作要求，不记录功能实现、运维配置或开发进度。

原创代码与仓库规范文档贡献采用 **GPL-3.0-only**，未要求 CLA、版权转让或 DCO sign-off。引用第三方代码、字体或素材时保留许可与来源，并更新 [第三方说明](THIRD_PARTY_NOTICES.md)。

<a id="git"></a>
## 分支、提交与 PR

分支使用描述性名称，推荐 `feat/`、`fix/`、`docs/`、`chore/`、`refactor/`、`test/`；名称任何位置不得出现 `agent`，不区分大小写。`wiki/rev_UUID` 保留给发布 App。提交说明实际变化，推荐 `type(scope): summary`。

按 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 说明问题、结果、验证和迁移或兼容性影响。保留原始贡献、正文和来源元数据；Wiki 投稿 PR 不得 rebase 或 squash。

<a id="verify"></a>
## 验证

提交前执行与改动相关的检查，并在 PR 中说明实际结果和未完成的验证。纯规范文档改动至少运行 `npm run check:repository`；涉及代码或运行配置时运行完整检查：

```bash
API_ORIGIN=https://api.rocowiki.test SITE_URL=https://wiki.rocowiki.test npm run check
npm run api:dry-run
```

`.test` 地址用于本地验证。根据改动补充必要的故障复现或浏览器检查；未执行的外部验收不能报告成通过。CI 的必需检查仍须全部通过。

<a id="review"></a>
## 审核与合并

响应复核意见，修复 CI 失败并说明取舍。代码与 Wiki 资料分别经过对应的独立审核；认证与权限、发布、数据库迁移、依赖、工作流及规范变更须由具备相应能力的人独立复核。

不要绕过主分支保护、必需检查或生产环境审批。合并和发布遵守 [项目治理](GOVERNANCE.md)，尚未完成的部署或外部验收须如实说明。
