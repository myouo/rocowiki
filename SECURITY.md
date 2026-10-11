# 安全政策
[English](SECURITY.en.md) · [贡献指南](CONTRIBUTING.md)
<!-- rocowiki-policy: security; version: 3; lang: zh-CN -->

<a id="reporting"></a>
## 私密报告

使用本仓库的 [GitHub 私密漏洞报告](https://github.com/myouo/rocowiki/security/advisories/new)。仓库已启用 private vulnerability reporting。[GitHub 操作说明](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately)

若入口不可用，只在公开 Issue 中请求安排私密安全联系渠道，不公开漏洞细节、利用代码、真实用户信息或附件。行为准则投诉渠道另见 [行为准则](CODE_OF_CONDUCT.md)，不能把安全报告入口当作通用投诉邮箱。

<a id="versions"></a>
## 支持范围

当前静态阅读站已部署，账号、投稿与发布服务尚未完成生产验收，也没有正式发行版本。维护者以当前受维护的 main 开发版本为修复目标；旧原型、离线演示和历史构建没有独立安全维护承诺。后续发行须在此登记支持周期。OIDC、GitHub App、D1 和镜像仍未完成生产安全验收。

<a id="report"></a>
## 报告内容

私密报告应包含受影响版本/commit、组件、触发条件、最小复现、预期与实际结果、影响及建议修复。优先使用本地测试账号与合成数据；不要附真实 Cookie、OAuth code、令牌、私钥、未脱敏数据库或第三方用户资料。不要在未获授权的生产系统中验证漏洞。

<a id="response"></a>
## 处理与披露

维护者确认范围、评估影响，私下复现并修复，添加必要的回归测试，发布修复和升级指引后协调披露。披露应说明影响版本、修复 commit、迁移和凭据轮换要求；是否署名由报告者确认。目前不承诺固定响应时限、奖励或可用性 SLA。

发现凭据泄漏时先限制受影响写入、撤销或轮换凭据，再调查访问与发布记录。仅删除 Git 文件不等于撤销凭据。恢复服务前确认受影响数据与发布记录，并记录修复、轮换和恢复操作。

<a id="boundaries"></a>
## 必须保留的安全边界

- 身份、权限与 UID 由服务端确定；localStorage、演示积分和昵称不构成认证。
- 写操作检查会话、Origin、CSRF 和角色；近期认证来自校验后的 OIDC auth_time。
- 投稿正文不可变，禁止自审；关键页需要不同审核员，基线变化转冲突复核。
- 公众不能指定文件路径、执行 MDX/HTML、绕过图片白名单，或修改工作流与构建代码。
- GitHub 绑定 OAuth、发布 App 和部署凭据分离；发布机器人不绕过保护或直接合并 main。
- Published 需要可信回执、真实线上版本及 Git 包含关系，镜像状态独立记录。
- PR 验证不使用生产 Secrets；未知上游结果不能按成功处理。安全改动须更新双语政策和相关验证。
