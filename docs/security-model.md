# 安全边界与威胁模型
[English](security-model.en.md) · [报告政策](../SECURITY.md)
<!-- rocowiki-policy: security-model; version: 2; lang: zh-CN -->

<a id="assets"></a>
## 保护对象

保护账号身份/角色、会话和近期认证、私有草稿、不可变投稿与审核、发布任务/租约、受审 Git 字节、公开来源/署名以及可信制品和版本证据。OIDC secret、GitHub App 私钥、OAuth secret、Webhook HMAC 和部署 token 各有用途；不进入客户端、Git 或常规日志。

<a id="boundaries"></a>
## 信任边界

| 边界 | 规则 |
| --- | --- |
| 浏览器 → API | 浏览器状态不可信；验证 Session、Origin、CSRF、角色与 schema |
| OIDC/GitHub 身份 → Wiki | OIDC issuer/subject 对应独立 UID；近期性校验 auth_time；绑定不自动授权公开邮箱 |
| D1 → Git | 快照和审核不可变；服务器控制路径、文件类型、幂等、租约和署名授权 |
| PR → CI | 使用受保护 base 的内容边界检查；不在不可信 PR 暴露生产 Secrets |
| 制品 → 线上 | SHA/digest、签名回执、正式 URL 版本及祖先关系共同确认 |
| 主站 → 镜像 | 只观察单向镜像；镜像失败不替代或改写主站状态 |

<a id="threats"></a>
## 典型威胁与现有控制

- 旧 SSO、state/nonce 重放、身份切换：服务端一次性绑定 state、PKCE、nonce、校验最大认证年龄，并保留提供商认证时间。
- 多标签页、跨域伪造、私有草稿越权：稳定会话 CSRF、精确 Origin/CORS、服务端 UID 和所有权检查。
- HTML/MDX、SVG 和重复引用定义：AST 白名单、统一引用解析、图片路径/扩展/域名限制及安全渲染。
- 审核后改字节、自审、并发重复批准：不可变内容、不同审核员、版本 CAS 和事务 Outbox。
- 网络响应丢失、main 更新、租约被接管：持久幂等目标、原始贡献 SHA、祖先/内容核验和 fencing。
- 旧 CDN、伪造回执、文章删除和巡检异常：可信线上版本、固定提交 Git 树确认、持久游标、单条错误重试与原子进度。
- 本机数据冒充社区：正式模式不把本机发布、积分或角色当作公共权威。

<a id="limits"></a>
## 已知范围与限制

这些规则不能代替真实部署验收、完整滥用防护、供应链审核、隐私/内容许可确认或独立安全审计。直接依赖台账不是完整传递依赖结论；已忽略文件和全部 Git 历史不在轻量源码扫描范围内。仓库 private reporting、CODEOWNERS 和投诉渠道有待后台配置/确认。代码中的测试替身不能当作真实 OIDC/GitHub/D1/Workers 静态托管 验收。

<a id="validation"></a>
## 变更验证

认证变更检查真实 SDK 解析、异常/过期 claim、旧会话升级及敏感接口；发布变更检查 SQL、重放、并发、事务失败和上游权限/删除分类；界面变更检查真实组件与浏览器生命周期。记录实际范围，升级前应用待执行迁移，参照运维手册进行生产配置与恢复验证。
