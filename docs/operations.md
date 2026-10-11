# 运维与上线 PoC

## 生产配置

1. 建立独立生产 D1，在 `wrangler.jsonc` 的 production 环境填写实际 database ID。先迁移、生成绑定类型，再部署兼容代码；破坏性迁移前独立备份。
2. 站点与 API 使用同一 `.app` 注册域名下的 HTTPS 子域，例如 `wiki.<domain>.app` / `api.<domain>.app`。Cookie 仅绑定 API host，不设置广域 Domain；CORS 精确允许站点 Origin，前端使用 credentials。
3. 在生产身份服务登记 `https://api.<domain>.app/auth/callback`，启用用户自主注册与邮箱验证；GitHub OAuth 登记 `/auth/github/callback`。
4. 写入 Worker Secrets：OIDC client secret、App PEM、OAuth secret、GitHub webhook secret、deploy receipt secret。保持机器人凭据与 静态站部署凭据隔离。
5. `SUBMISSIONS_ENABLED`、`PUBLISH_ENABLED` 在生产默认 false。先邀请测试，再显式开启。

本次升级需先应用全部待执行迁移，特别是 `0004_verified_authentication_time.sql` 和 `0005_reconciliation_record_errors.sql`，再部署 API。前者将旧会话的近期认证时间清零，保留登录、角色和私有草稿，敏感操作需重新验证；后者增加按记录保存的巡检错误与重试表。若尚未应用 `0003_publication_reconciliation.sql`，也应一并执行。现有生产库继续通过下方 `wrangler d1 migrations apply ... --env production --remote` 操作，不要重跑建库 SQL。

OIDC 提供商必须支持 `max_age` 并返回 ID Token 的 `auth_time`。首次登录请求/回调最大认证年龄为 600 秒，已登录账号重新验证为 0；回调依据服务端 state 决定该限制，忽略用户修改授权 URL 的影响。会话保存实际 `auth_time`，不以新 token 的签发时间或回调到达时间刷新近期认证窗口；拒绝缺失、非整数、过期和超过 30 秒容差的未来时间。很小的未来时钟偏差会钳制到当前时间，不能放大窗口。[OIDC 校验要求](https://openid.net/specs/openid-connect-core-1_0-18.html#IDTokenValidation)

`content/catalog.json` 和图片 policy 属于开发者控制的构建输入。新增实体、改受控路径或 policy 时需同步部署 API，让 Worker 映射与静态工作台一致。

```bash
cd apps/api
npx wrangler d1 migrations apply rocowiki-production --env production --remote
npx wrangler secret put OIDC_CLIENT_SECRET --env production
npx wrangler secret put GITHUB_APP_PRIVATE_KEY --env production
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET --env production
npx wrangler secret put GITHUB_WEBHOOK_SECRET --env production
npx wrangler secret put DEPLOY_WEBHOOK_SECRET --env production
npm run types
npm run deploy
```

真实密钥通过交互输入；不粘贴到命令参数、日志或 Git。

## GitHub 保护

- 默认分支 `main`：禁止 force push、删除及机器人 bypass；要求独立 GitHub PR review，保护管理员也不能直接绕过。
- 必需检查：`validate`、`content-boundary`；启用 Require branches to be up to date，绑定预期 GitHub Actions 来源。
- 仓库设置只允许 Merge Commit，关闭 Squash/Rebase；不要开启 require linear history，它与保留 merge commit 不相容。
- 为 `apps/`、`packages/`、`scripts/`、`.github/`、catalog/policy 配置实际维护者 CODEOWNERS 与独立代码审核。不能将示例用户名当作已生效授权。
- GitHub App installation 只包含该 Wiki 仓库，不赋组织全仓库写权限、工作流写权限或绕过权限。
- `wiki/` 内容 PR 的边界校验从受保护 base checkout 运行，直接检查 Git blob 模式、固定路径、原始内容 commit、基线、快照 hash；不执行 PR 中的脚本。
- 不使用 `pull_request_target` 检出不可信代码；production 环境只允许受保护 main，配置实际审核者。

## Cloudflare Workers Static Assets

公开站点目标为 `https://wiki.rocoai.app`，仓库为 `myouo/rocowiki`。Web 使用 `apps/web/wrangler.jsonc` 直接部署静态制品；API 继续独立运行于 Workers/D1，预留地址 `https://api.rocoai.app`，当前尚未部署后台。配置与实际上线验收见 [部署记录](deployment.md)。

GitHub production environment Secrets：`CLOUDFLARE_API_TOKEN`（Worker/路由操作）、`CLOUDFLARE_ZONE_API_TOKEN`（区域/DNS 操作），API 开启发布回执后另配置 `DEPLOY_WEBHOOK_SECRET`。Variables：`SITE_URL`、`API_ORIGIN`、`CLOUDFLARE_ZONE_ID`、`CLOUDFLARE_ACCOUNT_ID` 和 `DEPLOY_RECEIPTS_ENABLED`；mirror 另配置 `GITCODE_REMOTE_URL`。两组 Token 分别具有所操作资源的必要权限，不将其写入 Git。CI 使用区域 Token 从 `rocoai.app` 的活动 zone 校验账号，并拒绝不匹配的账号 ID。

首次只读资料站上线显式使用 `DEPLOY_RECEIPTS_ENABLED=false`，仅校验公网版本，不把任何投稿记成 published。后台及发布协议验收完成后改为 true，提供签名密钥；true 为脚本默认值，缺少回执配置在上传前失败。API 的投稿/发布开关保持受独立上线条件控制。

采用可信 GitHub Actions 制品上传，关闭平台重复自动构建。`/version.json` 配置 no-store，哈希资源长缓存；未知路径返回真正的 404，正文路径使用尾斜杠。[静态资源说明](https://developers.cloudflare.com/workers/static-assets/get-started/)、[自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

优选目标为 `rocowiki.cf.090227.xyz`，主站使用 DNS-only CNAME 与 `wiki.rocoai.app/*` Workers Route，正常解析对照入口 `wiki-direct.rocoai.app` 使用 Custom Domain 并标记 noindex。先上传并核验对照入口版本，再建立精确主站路由及优选 DNS，最后核验主站 TLS 与版本。Custom Domain 不能在已有 CNAME 的同名主机上直接建立，因此两种入口使用不同主机名。测速比较相同 URL 的官方解析与指定优选解析；分别记录大陆电信/联通/移动的成功率、连接耗时和首字节耗时，不将平台示例或境外测试当作国内实测。

`deploy.yml` 的 build 与 deploy 均引用 `production` 环境，分别在执行步骤中读取该环境的 `vars`。正式构建先检查 `SITE_URL` / `API_ORIGIN`，要求 HTTPS Origin、无凭据/路径/查询/片段；空值或错误值直接失败，不再产出含空 API 地址或回退示例站点地址的制品。两者可带一个根路径尾斜杠，构建时归一化。两项值应分别与 Worker 的 `WEB_ORIGIN` / `API_ORIGIN` 一致。[GitHub 环境变量作用域](https://github.com/github/docs/blob/main/content/actions/reference/workflows-and-actions/deployments-and-environments.md)

production 保护规则可能分别要求批准 build 和 deploy 作业；这是引用该环境的结果。PR `validate` 作业使用显式 `.test` 地址验证构建，不引用 production，也不使用部署 Secrets。环境保护与真实站点参数仍由仓库管理员配置。

`version.json` 的 digest 对按相对路径排序的全部制品文件计算，排除该 manifest 自身，避免循环哈希。上传前再次计算比对，source SHA 必须等于可信 workflow SHA。需要配置 `/version.json` 与 HTML 的短缓存或 no-store、哈希资源长缓存；Worker 使用 cache-busting 和 no-cache 重查正式 URL。

如果上传已成功而回执丢失，从对应 CI artifact 提取 `version.json`，在安全环境执行：

```bash
node scripts/replay-receipt.mjs /secure/path/version.json
```

提供 API_ORIGIN / DEPLOY_WEBHOOK_SECRET 环境变量。API 保留回执；Cron 仍核验正式域名和祖先关系，不因回执到达就报 Published。

## GitCode 镜像

平台后台配置 GitHub main -> GitCode 的只读 Pull 镜像，关闭回推。`scripts/check-mirror.mjs` 只使用 ls-remote 比较默认分支 SHA；定时检查结果经签名写入观察表，`GET /mirror` 返回 synced/lagging/failed。未知或长时间无观察不能当作同步成功。未接入 GitCode 写 API，也未假设 Issue/PR 随 Git 对象复制。[镜像管理说明](https://docs.gitcode.com/docs/help/home/org_project/project_manage/project_settings/repository_mirroring/)

`GITCODE_REMOTE_URL` 仍放在 production environment。mirror 作业不在 job 级条件中读取该变量；进入环境后，配置检查步骤通过实际环境变量写出 enabled，再决定是否运行观察脚本。未配置会明确记录跳过。production 的人工审批/分支保护仍需按运维策略允许该作业执行，不能将等待审批视为镜像成功。[GitHub 变量可用时机](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)

## 备份与恢复

使用独立权限主体管理 age 私钥、备份存储、保留周期；至少一份离线或异地副本。运行：

```bash
bash scripts/backup-d1.sh production age1REPLACE_WITH_PUBLIC_RECIPIENT /independent-storage/rocowiki.age
```

脚本仅接收公开加密 recipient，用私有临时目录导出 SQL，退出时删除明文。独立存储目录需执行者有权限；脚本不自动上传，不承诺已有远端备份。

恢复顺序：

1. 关闭投稿和发布，解密到受控临时文件，在**新测试 D1**中导入，避免覆盖线上库。
2. 检查 users/identities、不可变 submission、reviews、publish_jobs、git_links、audit_events 的数量与关联，运行外键检查并抽样核对 hash。
3. 核对 GitHub 默认分支和各 PR，恢复租约已过期任务，先查询远端对象，不能直接批量创建新 PR。
4. 核对正式 Workers 静态站 manifest/可信回执/Git 包含关系；必要时重新发布已验证的主分支制品。
5. 单独核对 GitCode 镜像；最终完成独立演练记录后再开放写入。

本仓库测试验证 SQLite SQL 导出/恢复后的身份、快照、Outbox 与不可变约束；尚未完成远端 D1 导出、age 解密与生产等价恢复演练。

## 故障操作

管理员从工作台查看失败阶段与错误码。普通上游错误指数退避；8 次后进入 blocked，管理员可从原阶段重试。冲突、PR 被关闭或已审正文改变不能作为上游重试覆盖，应创建新候选。

GitHub webhook 只作唤醒提示；delivery 去重，状态由主动查询推进，丢失/乱序不会直接改写为成功。回滚扫描默认每次最多处理 10 条，按稳定的 `(created_at, revision_id)` 升序推进 D1 游标，每轮固定终点；持续新增发布不会挤掉旧记录。完成一轮后重新扫描全部历史记录，每批核验当时观察到的可信 release；版本变化时保留游标，防止频繁部署使后半部分记录永远得不到检查。游标跨进程/数据库重启保留，租约防止并发任务覆盖进度；撤回事件、单条重试记录与进度在同一事务写入，事务失败时重放同一批。默认每 5 分钟调度一次，无错误时完整巡检耗时约为 `ceil(发布数 / 10) × 5 分钟`；有待重试记录时默认最多分配 2 条重试、至少保留 8 条前进额度，需监控实际进度，不承诺实时检测。`publication_reconciliation` 可读取当前批次的 release、游标、终点和 `completed_passes` 观察是否前进。回滚使用受审查的 revert commit 和新制品；历史出版记录保持，另记撤回事件。

文章读取的 Contents 404 需在同一固定提交中逐层读取 Git 树确认路径不存在，才记为删除/撤回。无法读取提交、权限错误、限流、树被截断或 Contents 与树不一致，不会当作删除；单条失败记入 `publication_reconciliation_errors`，不会阻断其他记录。按记录指数退避（60 秒起、最多一小时），成功核验后清除错误。结合 `error_code` / `attempts` / `next_attempt_at` 排查权限或内容映射问题；这些错误不会悄悄丢弃。读取线上 manifest、验证可信回执失败仍会阻止整个批次启动。[Git 树读取规则](https://docs.github.com/en/rest/git/trees#get-a-tree)

任务已保存 `git_links`、但未推进到 PR 阶段时，恢复使用已保存的 `content_commit_sha`，核验原始提交及当前 PR 分支包含关系、正文与来源；维护者合法合入 main 不会把 merge commit 当成原始投稿。内容/来源被改写或原提交不再是祖先时仍转冲突，不通过重试覆盖。

关闭 SUBMISSIONS_ENABLED / PUBLISH_ENABLED 可让社区写入降级，静态读站继续工作。日志只包含 correlation/revision ID、阶段和安全错误码。外部监控需接入：错误率、待审核时间、任务停留、D1 额度、镜像延迟、实际线上 SHA；未自动配置告警渠道。

## 上线验收记录

以下实际环境测试必须有记录，不能用 mock 测试代替：

- 两位非管理员从同一页面基线投稿，独立审核；先合并一份，后一份冲突复核，重新投稿后保留原提交历史。
- 有/无 GitHub 绑定、有/无公开授权、解绑和重新认证；检查真实 Co-author 与公开元数据中没有注册邮箱或令牌。
- 人为中断 GitHub 响应、丢弃/重放 webhook、构建失败、旧 CDN 版本、回滚与恢复；核对 D1、GitHub、正式内容。
- 尝试投稿工作流/MDX/目录穿越，确认 PR 无生产 Secrets 且无法绕过检查或直接写 main。
- 远端 D1 备份/导入演练、Workers 静态托管/域名/HTTPS、国内移动/联通/电信访问与跨子域 Cookie。
- GitCode 最终追平；镜像故障不会修改主站发布结果。

原创 Wiki 正文许可已确定为 CC BY-SA 4.0，代码使用 GPL-3.0-only，具体范围见 COPYRIGHT.md。投稿许可确认与服务端同意记录仍未接入；已有作者和第三方素材的授权须逐项核对，版权联系渠道尚未配置。运营方完成这些内容权利事项、隐私说明和注销/导出/保留流程并部署后才能开放公共注册及投稿。当前不应宣称完整合规或已通过独立安全审计。
