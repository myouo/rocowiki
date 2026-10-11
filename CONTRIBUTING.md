# 贡献指南
[English](CONTRIBUTING.en.md) · [行为准则](CODE_OF_CONDUCT.md) · [安全政策](SECURITY.md)
<!-- rocowiki-policy: contributing; version: 5; lang: zh-CN -->

<a id="entry"></a>
## 选择入口

普通缺陷、功能建议与资料纠错使用仓库 Issue 模板；漏洞走私密安全报告。说明问题和影响，不提交未经脱敏的日志或账号资料。代码贡献、Wiki 资料投稿与安全报告有不同入口，不需要把所有问题变成代码 PR。

<a id="wiki"></a>
## Wiki 资料贡献

正式投稿从 /workbench/ 进入，需要已验证邮箱的站内账号及贡献权限，GitHub 绑定可选。以已登记页面的真实基线编辑，写明修改理由和可核验来源，区分官方、实测、推断和待验证信息。不要把样本、演示发布或本机积分冒充公共记录。

投稿锁定快照，禁止自审；关键页需要两位不同审核员。基线变化后重新整理并审核新候选。GitHub 邮箱署名须绑定、明确授权且对该次投稿勾选；它与代码或内容许可不是同一项同意。

只提交你有权提供的原创或已获授权资料，引用标明来源。新原创 Wiki 正文的项目许可为 **CC BY-SA 4.0**，作者保留版权；允许公众署名转载、改编和商业使用，分享改编内容须遵守相同方式共享要求。遵守 [版权声明](COPYRIGHT.md)，区分引用与原创部分，保留作者及许可依据；不能把游戏素材和无权许可的内容一并改为 CC。投稿不构成版权转让。开放正式投稿前须接入明确的许可确认与服务端同意记录，目前尚未实现；GitHub 邮箱署名同意不能替代内容授权。新许可不得无授权追溯覆盖已有作品。

<a id="setup"></a>
## 本地开发

需要 Node.js 24.15.0+。使用 npm ci 安装锁定依赖；npm run db:migrate 迁移本地数据库。分别运行 npm run dev:api 和 npm run dev:web。网页/API 使用 localhost:3000 / localhost:8787，避免混用 127.0.0.1。配置公开开发参数与未入 Git 的 apps/api/.dev.vars；API 的公开参数在 apps/api/wrangler.jsonc 中配置；私密参数参考 apps/api/.dev.vars.example。当前使用站内邮箱密码认证；GitHub 绑定使用独立 OAuth 应用，回调为 http://localhost:8787/auth/github/callback。发布 App 仅安装到 Wiki 仓库，使用 Contents write 与 Pull requests write 权限。生产 Secrets 保存到仓库 production 环境，由 API 工作流部署，不写入仓库或命令参数。

离线/浏览器演示不提供认证绕过或生产发布。生成文件从来源重建，不手工修改 build、dist、docs-generated或 src/generated来修复当前业务。

### 邮箱密码与发信配置

当前采用站内邮箱密码认证，生产 OIDC 回调关闭。邮箱或用户名均可登录。用户名统一小写，3–24 位，以字母开头，允许数字、下划线和连字符，注册后不可改；昵称单独修改。密码为 15–128 个字符，保存独立随机盐的 scrypt 哈希。邮箱不公开，发信服务不接收密码。

1. 在 Brevo 或 Resend 认证自己控制的独立发信子域，例如 mail.wiki.rocoai.app，发件地址例如 accounts@mail.wiki.rocoai.app。按平台实际返回的 DNS 记录配置，不猜测 DKIM/SPF 或覆盖主域邮件记录。
2. 仓库 Settings → Environments → production 添加变量 MAIL_PROVIDER（brevo 或 resend）、MAIL_FROM（纯邮箱地址），对应 Key 存为 BREVO_API_KEY 或 RESEND_API_KEY Secret。保持 EMAIL_VERIFICATION_REQUIRED=true。不要公开凭据。
3. 运行 Deploy Wiki API。工作流迁移数据库、安全上传 Secrets，并用匿名错误密码请求验证真实 Workers 密码运行，不创建测试用户。免费计划 CPU 限制较低，运行检查失败时核对资源限制，不降低哈希强度或绕过检查上线。
4. 用自己控制的 QQ、163、Gmail、Outlook 邮箱验收注册、重发、找回和密码修改，记录收件箱/垃圾箱位置、延迟及原始认证结果；检查点击追踪是否改写或破坏验证链接。API 接受、Delivered 指标和历史公开测试不能替代本站验收。

验证邮件还需输入注册密码；验证通过才建立永久账号，未验证登记 24 小时后失效，不占用正式用户名。修改或重置密码撤销旧会话；近期认证重新校验当前账号密码。发信未配置时注册关闭；当前发信尚未配置和验收，正式注册、投稿及发布继续关闭。生产 Secrets 存到仓库 production 环境，由工作流部署。

### GitHub 接入配置

发布机器人使用独立的 GitHub App。在 GitHub 的 Settings → Developer settings → GitHub Apps 中创建应用，主页填写 https://wiki.rocoai.app，仓库权限设置 Contents 和 Pull requests 为 Read and write，保留自动授予的 Metadata Read。仅安装到 myouo/rocowiki；主分支保护及独立维护者合并仍须单独配置。

Webhook 地址填写 https://api.wiki.rocoai.app/webhooks/github，订阅 Push 与 Pull request。创建随机 Webhook Secret，同时保存到应用设置和仓库 production 环境的 GITHUB_WEBHOOK_SECRET；不要在配置接入前启用 Webhook。生成并下载 App 私钥，将完整 PEM 保存为 production 的 GITHUB_APP_PRIVATE_KEY Secret。把 App ID 和安装页面 URL 中的 Installation ID 分别存为 GITHUB_APP_ID、GITHUB_INSTALLATION_ID 环境变量。

用户绑定 GitHub 使用另一项 OAuth App。在 Developer settings → OAuth Apps 创建应用，主页为 https://wiki.rocoai.app，Authorization callback URL 为 https://api.wiki.rocoai.app/auth/github/callback。将 Client ID 保存为 production 的 GITHUB_OAUTH_CLIENT_ID 环境变量，将 Client Secret 保存为 GITHUB_OAUTH_CLIENT_SECRET Secret。绑定只申请 read:user 与 user:email，不申请仓库写入权限。

更新配置后运行 Deploy Wiki API 工作流；在真实登录、回调和 Webhook 验证完成前，投稿与发布保持关闭。GitHub 绑定不会代替 Wiki 的邮箱密码注册登录。操作参考 [GitHub App 注册说明](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-using-url-parameters) 和 [OAuth App 注册说明](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)。

<a id="change"></a>
## 代码与文档

遵守 [仓库协作规范](AGENTS.md) 与 [安全政策](SECURITY.md)。每个 PR 聚焦一项可审阅改动；新业务代码使用 TypeScript，修改遗留 JS 时逐模块补类型覆盖。服务端契约、身份、正文、事务与生命周期问题须覆盖真实边界，不能只测试两个 mock 相互兼容。

外部数据先校验；组件的请求、定时器、observer、事件与 portal 随生命周期清理。界面复用柔和背景、圆角和统一宽度，并检查窄屏、长内容、键盘及空/错误状态。接口变更同步更新前后端契约，数据库迁移追加编号文件，不修改已应用的迁移；重试保留幂等键和失败记录。

改变规范时同时更新中英文，保持同一政策版本和章节。引用第三方代码、字体或素材时保留许可与来源，登记 [第三方说明](THIRD_PARTY_NOTICES.md)。原创代码与仓库规范文档贡献按 GPL-3.0-only 提交；未要求 CLA、版权转让或 DCO sign-off。

<a id="git"></a>
## 分支、提交与 PR

分支使用描述性名称，推荐 feat/、fix/、docs/、chore/、refactor/、test/；禁止名称任何位置出现 agent，不区分大小写。wiki/rev_UUID 保留给发布 App。提交说明实际变化，推荐 type(scope): summary。

PR 说明问题、结果、验证和迁移/兼容性影响，采用模板。代码和资料通过各自的独立审核；不要绕过 main 保护、必需检查或生产环境审批。维护者合法 merge main into a Wiki PR 时必须保留原始贡献提交、正文和来源元数据；禁止 rebase/squash。

<a id="verify"></a>
## 验证

```bash
API_ORIGIN=https://api.rocowiki.test SITE_URL=https://wiki.rocowiki.test npm run check
npm run api:dry-run
```

check 包括规范、内容、结构、类型、API/SQLite、生命周期、正式工作台与构建检查；.test 地址只用于本地制品，不连接真实服务。按改动补必要的故障复现或浏览器验证，不用空测试、无关快照或反复运行替代证据。尚未进行的外部验收必须明确写出，不能报告成通过。

<a id="review"></a>
## 审核与合并

贡献者修复 CI 失败、解释取舍并响应复核。身份、权限、Git 包装器、发布协调器、迁移、policy、依赖和工作流变更需要具备相应能力的独立代码审核。迁移先应用到测试环境，升级前明确顺序与恢复方式；生产操作使用现有运维授权。维护者合并后更新相关验证和发行记录。
