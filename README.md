# RocoWiki

[English](README.en.md) · [贡献指南](CONTRIBUTING.md) · [安全政策](SECURITY.md)
<!-- rocowiki-policy: overview; version: 3; lang: zh-CN -->

<a id="status"></a>

洛克王国页游社区 Wiki 的 V1 架构实现。Web 已替换为用户提供的 Docusaurus V7.3.1 项目，导入与生命周期修复见 [Web 迁移记录](docs/web-v731-integration.md)。设计基线见 [RocoWiki_V1.md](RocoWiki_V1.md)，约束审阅和实现范围见 [实施审阅](docs/implementation-review.md)。

本仓库包含可构建的静态站、Workers API、数据库迁移、发布状态机及 CI 配置；**没有进行真实线上部署**。生产默认关闭投稿和发布，外部平台验收完成后再开启。

模块分工、运行模式、游客权限、接口边界及当前外部服务状态见 [架构说明](docs/architecture.md)。

<a id="setup"></a>
## 本地启动

需要 Node.js 24.15.0+、npm，以及本机可用的开发端口。

```bash
npm ci
npm run db:migrate
npm run dev:api
```

另开终端启动网页：

```bash
npm run dev:web
```

网页为 `http://localhost:3000`，API 为 `http://localhost:8787`。必须统一使用 `localhost`；不要混用 `127.0.0.1` 导致 Origin/Cookie 不一致。注册登录通过 OIDC；未配置身份服务时，静态内容仍可浏览，登录会明确返回服务未配置。没有本地绕过认证的生产入口。

复制 `apps/api/.dev.vars.example` 为同目录 `.dev.vars`，在 `wrangler.jsonc` 顶层配置开发使用的公开参数：

- `OIDC_ISSUER`、`OIDC_CLIENT_ID`：支持 Authorization Code、PKCE S256、nonce、已验证邮箱和公开注册的 OIDC 身份服务。Secret 中配置 `OIDC_CLIENT_SECRET`；回调登记为 `http://localhost:8787/auth/callback`。开启提供商邮件核验；只接受 `email_verified: true`。
- GitHub App：配置仓库 owner/name、App ID、installation ID，Secret 中配置 PEM 私钥；安装仅选 Wiki 仓库，权限为 Contents write、Pull requests write，保留自动 Metadata read。机器人不调用 merge API。
- GitHub 身份绑定使用独立 OAuth 应用，权限 `read:user user:email`；登记回调 `http://localhost:8787/auth/github/callback`，配置 OAuth client ID/secret。
- webhook Secrets：`GITHUB_WEBHOOK_SECRET` 与 `DEPLOY_WEBHOOK_SECRET` 分开。生产 Secrets 通过 `wrangler secret put <NAME> --env production` 交互设置，不能写入仓库。

OIDC issuer+subject 映射到不可复用的 Wiki UID，不以邮箱合并身份。提供商须支持 `max_age` / `auth_time`；回调校验实际认证时间，会话不会因旧 SSO 换发 token 而重新获得近期认证窗口。提供商邮箱、访问令牌不入库。自有 Session 只存 SHA-256 哈希，生产使用 API 主机独占的 HttpOnly、Secure、SameSite=Lax Cookie。

首次登录后在工作台复制 UID，由可信运维操作员授予角色：

```bash
node scripts/set-role.mjs usr_REPLACE_WITH_REAL_UUID reviewer --local
```

生产使用真实 UID 与 `--remote`，需现有 Cloudflare 运维权限；此动作保留审计记录。普通客户端不能指定或修改角色。

<a id="verify"></a>
## 开发与验证

```bash
API_ORIGIN=https://api.rocowiki.test SITE_URL=https://wiki.rocowiki.test npm run check
npm run types -w @rocowiki/api
npm run api:dry-run
```

`check` 依次执行结构/内容校验、TypeScript（含四个关键 JS/JSX 模块）、API/数据库行为测试、Web 生命周期及正式工作台交互回归、Docusaurus 构建、公开页面搜索索引与版本清单。上述 `.test` 地址仅用于本地制品验证，不会部署或连接真实服务。测试使用真实 SQLite 执行同一套 D1 SQL 迁移、事务和触发器；网络边界使用故障注入测试。它不能替代远端 D1/Workers、实际 OIDC/GitHub/Workers 静态托管 联调。

本次结果见 [本地验证记录](docs/validation.md)。

Web 保留导入项目的 96 个自定义页面、25 篇文档、图鉴、计算器、图片与本地字体。其签到、评论、模拟审核和“本机发布”仍属于浏览器演示，不会修改 GitHub 或 D1 的发布状态；真实账号、私有草稿和审核入口为 `/workbench/`。已有 Git 管理的共建文档继续位于 `/wiki/`。

开发默认 `WIKI_WORKSPACE_MODE=demo`，正式构建默认 `server`；可显式设置。游客和只读用户不能打开编辑表单，演示审核也不能让普通贡献者冒充审核员。个人中心的账号区连接正式 API，钱包和点赞仍明确标为本机记录。正式构建必须显式配置 HTTPS Origin 形式的 `API_ORIGIN` 与 `SITE_URL`；缺少或不合法的配置会中止构建，直接执行 Web 子包的 build 也会校验。

服务端可编辑实体仍由开发者登记根目录 `content/catalog.json`，写入符合 Schema 的 JSON 后，经独立代码审核合并。稳定实体 ID 不复用；公众工作台仅可修改已登记实体字段。导入项目的 `apps/web/content/` 是开发者维护的样本与界面资料，不自动转换成服务端投稿对象。公众图片默认只允许开发者提交的 `/media/` 栅格图片；外部图片域名须在根目录 `content/policy.json` 中逐个登记。

正式内容生成时同步生成公开搜索记录，因此真实文章标题和正文会进入全站搜索，无需手工维护第二份文章名单。私有草稿和账号数据不进入该输入。

V5 至 V7.3 的历史设计 JSON 已归档到 [Web 历史设计资料](apps/web/archive/design/README.md)，相应报告生成脚本读取归档位置。当前 V7.3.1 设计、资料样本、生成的编辑基线和运行配置继续保留。

<a id="workflow"></a>
## 发布流程

1. 用户提交不可变修订。关键页面需要两位不同审核员；所有页面禁止自审。
2. 最后一份批准与 Outbox 任务在同一数据库事务中产生。
3. Cron 或 webhook 唤醒任务；获取租约、校验快照/基线/授权，幂等创建 `wiki/rev_UUID` 分支、一份内容 Commit、一份 PR。正文与公开来源元数据位于同一原子 Commit。
4. 独立维护者在必需检查和 GitHub 审核通过后 **Merge Commit** 合并。机器人不绕过主分支规则。
5. 可信主分支 CI 构建静态制品，生成 SHA、release ID 和 digest；独立作业上传 Cloudflare Workers Static Assets。
6. 验证正式域名 `/version.json` 后发送有时间窗口的 HMAC 回执。Coordinator 再读取线上版本，核对可信回执，并证明其包含 merge 和内容 Commit，才记为 `published`。
7. GitCode 设置平台侧单向 Pull 镜像；旁路工作流只比较 SHA 并报告状态，不向任何仓库推送。

旧页面基线已改变时转 `conflict`，加载新基线后整理修改并重新投稿；不在审核后自动改变正文。主分支仅有其他页面变化时，独立维护者可以 **merge main into the PR** 保持严格检查可合并，原始内容 Commit 和已审查字节必须保留；禁止 rebase/squash，也禁止在该分支修改已审正文。

若 CI 回执丢失，使用对应制品的 `version.json` 重放签名回执，不必再次部署。Admin 工作台可重试超时任务；达到 8 次失败后任务保留原阶段并阻塞，需人工重试。冲突不能通过重试覆盖。

部署、分支保护、备份与 PoC 门槛详见 [运维手册](docs/operations.md)。

<a id="community"></a>
## 项目规范

贡献与审核依 [贡献指南](CONTRIBUTING.md)、[行为准则](CODE_OF_CONDUCT.md)、[项目治理](GOVERNANCE.md) 和 [工程规范](docs/standards.md) 执行；开发协作约束见 [AGENTS.md](AGENTS.md)，求助见 [支持说明](SUPPORT.md)。所有规范提供同版本英文版，修改时同步复核。GitHub 私密安全报告需后台启用，行为投诉渠道仍待配置，示例 CODEOWNERS 不生效。

<a id="license"></a>
## 许可

项目有权许可的原创代码及仓库规范文档采用 **GPL-3.0-only**，条款见 [LICENSE](LICENSE)。有权按项目政策授权的原创 Wiki 正文采用 **CC BY-SA 4.0**，作者保留版权；允许署名转载、改编和商业使用，分享改编内容须遵守相同方式共享要求。第三方依赖、字体、游戏图像与转载资料保持原许可和权利边界，已有内容不自动追溯改许可。范围、转载规则和版权问题处理见 [版权声明](COPYRIGHT.md)；站点页脚提供 /copyright/ 与 /copyright/en/ 入口。[第三方声明](THIRD_PARTY_NOTICES.md) 记录未核验项，不能把代码或正文许可当作游戏素材再分发授权。投稿许可同意记录与版权联系渠道仍须在开放投稿前接入。
