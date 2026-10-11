# V1 文档审阅与实现对齐

日期：2026-10-10。原文共 19 节；以下记录实施约束、已确认调整和验证边界。

> 2026-10-11 更新：Web 已按用户要求导入 V7.3.1，完整阅读系统与生命周期修复见 [Web 迁移记录](web-v731-integration.md)。本页的首版 UI/空图鉴说明是原实施快照；API、D1、Git 权威及发布门禁仍保留。

## 已与用户确认

| 决策 | 原文中的问题 | 本次对齐 |
| --- | --- | --- |
| 认证采用成熟 OIDC 服务 | 密码模式涉及 Workers 哈希、邮箱验证及重置；V1 未限定必须密码登录 | 使用 `openid-client` 执行标准流程；要求已验证邮箱；Wiki 独立 UID；GitHub 绑定与登录分离 |
| 旧基线进入冲突复核 | §5.3/§16.1 的自动三方合并可能改变已审查字节，与审核版等于实际写入版冲突 | V1 不执行审核后自动三方合并；新候选必须重新审核，旧快照保留 |

## 关键实施解释

- Docusaurus 默认可能将 `.md` 也按 MDX 编译。普通正文不直接送进该编译器：统一 AST 白名单校验、HTML 消毒，生成开发者控制的模板；用户数据仅作为 JSON 字面量与已消毒 HTML。预览和生成器复用同一渲染器。[官方 Markdown 说明](https://docusaurus.io/docs/markdown-features)
- 单仓库保留原文布局。发布 App 仅授权专用 Wiki 仓库；Wrapper 只生成受控 `content/` 文件。App Contents write 本身不构成目录 ACL，不能宣称硬件级/平台级路径隔离。
- 正文与 `content/metadata/<id>.json` 的公开来源、修订、公共 UID 在一份原子 Commit 中发布；可信 ID/slug 来自开发者维护的 catalog，公众没有 Front Matter 权限。
- App 创建 PR；独立维护者负责合并。分支保护必须启用严格状态检查并禁止 App bypass。合入主分支的新内容若改变本页基线，则重新审查；只更新其他文件时可以用普通 Merge 更新 PR，原始贡献提交仍保留。[严格检查规则](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- 注册/登录/绑定发起改用 POST，要求精确 Origin 与自定义请求头；会话内写操作再要求 CSRF Token。GET 仅用于带一次性 state 的 OAuth 回调。
- 关键机制按 catalog 的 `critical` 字段强制两位独立审核员。撤销通过取消尚未进入外部副作用的候选完成，审核/审计历史不改写；发布后撤回使用新的 revert 修订。
- Outbox 用 SQLite 触发器在批准事务内插入。执行器用条件更新领取租约，数据库写入带租约 fencing，重试先查询远端固定分支/PR。D1 与外部调用仍无共同事务，不承诺 exactly-once 网络调用。
- 上线确认要求线上 manifest、可信 HMAC 回执与 Git 祖先关系一起成立；后代 release 可以确认早先投稿。回滚产生独立 publication event，不删除历史 `published` 记录。
- GitCode 的具体管理页/API 属于外部配置：代码只观察镜像 SHA；平台执行 Pull。镜像失败不影响发布状态。
- 字体、搜索、JS/CSS 在静态制品中；Pagefind 只扫描 `wiki/**/*.html` 的公开正文区域，草稿、工作台和私有 API 不入索引。

## 实现范围

| 模块 | 已实现 | 尚须实际平台验证 |
| --- | --- | --- |
| web | 静态阅读、来源/修订、图鉴入口、搜索、工作台、受限预览、结构化字段、草稿、审核 Diff、公开贡献、任务重试 | 正式域名下的登录与跨子域 Cookie；完整浏览器业务联调 |
| 身份 | OIDC code+PKCE+nonce、一次性绑定 state、会话哈希、近期重认证、GitHub 数字 ID 唯一、独立邮箱 opt-in | 选择并配置实际 OIDC 服务；实际邮箱与 GitHub co-author 关联 |
| D1/API | 版本化 SQL、外键/唯一约束、不可变快照、私有权限、CSRF、IP/UID 限速、审核 CAS、双人审核、Outbox | 远端 D1 迁移、事务/并发与额度实测 |
| Git/发布 | GitHub App JWT/token、受控两文件 Commit、PR 去重恢复、独立合并、租约/退避/阻塞、HMAC、线上版本包含判断、回滚事件 | 真实 App 权限、分支保护、Co-author、GitHub 限流与 webhook 丢包 PoC |
| CI/CD | PR 无密钥校验、受保护基线内容边界检查、可信构建制品、EdgeOne SDK 上传、正式 URL 核验与回执重放 | EdgeOne 项目、海外加速区、域名、证书、缓存配置、部署上传实际行为 |
| 运维 | 加密 D1 导出脚本、恢复流程、降级开关、状态 API、独立镜像 SHA 观察 | 独立备份存储/age key 配置、实际远端导入演练、告警平台和三网测量 |

本地接口与行为测试使用真实 SQLite；Git/OIDC/EdgeOne 网络使用可控替身。生产环境恢复、三网访问、第三方联调不能用这些结果代替。宠物技能库默认空，须以真实且有来源的数据登记。

## 发布前仍需决策与配置

具体 OIDC 服务、真实 `.app` 域名和各平台账号尚未给出。本实现未代选付费服务，也未执行外部部署。内容授权、隐私协议、注销/导出/保留政策需由运营方确定并落地；未将游戏资源自动赋予开源许可。以上保留为真实上线门禁。

原文的云平台选择没有发现必须更换的硬性矛盾；国内网络性能及区域资格按原文实测，不能从品牌、HTTP 200 或 SDK 的 `region: global` 推断符合验收。
