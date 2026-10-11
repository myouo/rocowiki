# Repository instructions
[English](AGENTS.en.md) · [完整规范](docs/standards.md)
<!-- rocowiki-policy: repository-instructions; version: 1; lang: zh-CN -->

<a id="scope"></a>
## 范围与授权

本文件适用于整个仓库，与 CONTRIBUTING.md、SECURITY.md、docs/standards.md 一起使用。用户对任务的有效授权和更高优先级指令优先。规范中的独立审核/生产审批适用于合并和生产操作，不应阻止已授权的本地调查、实现和验证。不要编造已部署状态、维护账号或联系方式。

<a id="git"></a>
## Git

- 分支名任何位置不得包含 agent（不区分大小写）。
- 使用描述性名称，推荐 feat/、fix/、docs/、chore/、refactor/、test/；wiki/rev_UUID 为发布器保留。
- 保留用户未提交修改，未经授权不执行 destructive reset、历史重写或强推。

<a id="implementation"></a>
## 实现

- 先查看当前模块、协议和相关文档；文本/文件搜索先用 rg。
- 保持 apps/web、apps/api、packages 的责任边界及现有柔和 UI。
- 身份、角色与近期认证以服务端为准；不把本机演示数据同步成真实身份/余额。
- 请求和 DOM 资源按生命周期清理，所有写入/重试保持事务、幂等和租约边界。
- 新业务代码有类型，遗留 JS 逐模块补覆盖；不得绕过检查或手改生成物解决源头问题。
- 不放入 Secret、私钥、数据库、真实 Cookie/令牌/用户草稿；示例使用合成值。
- 原创代码及仓库规范文档采用 GPL-3.0-only；保留第三方声明，不自动改许可。

<a id="verification"></a>
## 验证与文档

按 CONTRIBUTING.md 选择相应检查，修复导致失败的实际问题。规范改动同时更新中英文版本和章节。说明修改、原因、验证和真实限制；尚未配置的外部服务、投诉渠道与 CODEOWNERS 不能报告成已准备好。安全发现按 SECURITY.md 处理，公开输出脱敏。
