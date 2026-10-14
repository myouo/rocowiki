<!-- SPDX-License-Identifier: GPL-3.0-only -->
# Resend 邮箱注册发信配置

[English](resend-setup.en.md) · [贡献指南](../CONTRIBUTING.md)

本站通过 Resend HTTP API 发送注册验证和密码重置邮件。生产发件地址为 `RocoWiki <noreply@wiki.rocoai.app>`；网站的邮箱密码、确认链接与会话由 Wiki 后端维护。域名认证、Key 保存、部署和实际投递验收仍需完成。本地开发默认关闭真实发信。

## 1. 注册并认证域名

在 [Resend 注册](https://resend.com/signup)，进入 Domains → Add Domain，添加 `wiki.rocoai.app`。依照 Resend 返回的记录在 Cloudflare 的 `rocoai.app` 区域配置 DNS，点击校验，直到发送域名显示 Verified。

记录的类型、名称、值及 MX 优先级均以后台实际返回为准。保留现有网站记录、主域收信 MX 和已有 SPF/DMARC；同一名称的 SPF/DMARC 需要合并，不能重复创建。Resend 发信验证使用的 MX 通常属于单独的 Return-Path 子域，并不要求把主域收件邮箱迁移到 Resend。发送专用的记录与网站访问记录分别管理，CNAME 验证记录使用 DNS only。

认证后可从该域名下的 `noreply` 地址发信，无需先建立 noreply 收件箱。保持验证及密码重置邮件的 Open Tracking、Click Tracking 关闭，并核对实际链接保留完整的 `#verify=`／`#reset=`。

参考：[域名验证](https://resend.com/docs/dashboard/domains/introduction)、[Cloudflare DNS 配置](https://resend.com/docs/guides/dns/cloudflare)。

## 2. 创建发信 API Key

进入 API Keys → Create API Key，名称可用 `rocowiki-production`。选择 Sending access，并将允许发信的域名限制到 `wiki.rocoai.app`。Key 只显示一次，直接保存到下一步的服务端 Secret。

参考：[创建 API Key](https://resend.com/docs/create-an-api-key)。

## 3. 配置 GitHub production 环境

打开仓库 [Environments](https://github.com/myouo/rocowiki/settings/environments)，选择 `production`，填写：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Environment variable | `MAIL_PROVIDER` | `resend` |
| Environment variable | `MAIL_FROM` | `noreply@wiki.rocoai.app` |
| Environment secret | `RESEND_API_KEY` | 完整 API Key |

Key 不放入源码、聊天、截图、命令参数或 Environment variables。工作流将它上传为 Cloudflare Worker Secret。不要关闭邮箱验证要求。

本地源码已有上述提供商和地址默认值；GitHub 环境变量会覆盖所选提交的默认值。部署读取 main 的对应提交，本地未提交改动不会自动上线。缺少发信 Key 时，注册和密码找回保持不可用。

## 4. 部署和实际验收

域名与 Key 准备好后，在 [Deploy Wiki API](https://github.com/myouo/rocowiki/actions/workflows/deploy-api.yml) 选择 main 运行，遵循仓库已有的审核和环境部署流程。工作流迁移 D1、上传 Secret 并验证 API 版本及 Workers 密码运行，投稿与发布仍关闭。

在 [健康状态](https://api.wiki.rocoai.app/health) 核对 `registration_enabled: true`、`password_reset_available: true`、`email_verification_required: true`，并保持 `submissions: false`、`publishing: false`。这些字段表示配置已加载，不代表进入收件箱。

在 [工作台](https://wiki.rocoai.app/workbench/) 用自己控制的 QQ、163、Gmail、Outlook 邮箱测试注册、重发验证、确认邮箱、登录、找回密码及旧会话失效。确认邮箱需要注册密码。记录收件位置、延迟和原始邮件的认证结果；API 成功或 Delivered 事件不能替代实际收件验收。

Resend 免费套餐的日邮件额度按邮件封数计算，重发和找回密码也占用额度。额度及套餐以[当前官方定价](https://resend.com/pricing)为准。

完成后告知域名认证、Secret 保存及部署结果即可，无需提供 API Key、密码、验证链接或 Cookie。
