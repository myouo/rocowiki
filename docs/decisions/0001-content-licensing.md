# 0001 — Code and Wiki content licensing / 代码与 Wiki 内容许可

日期 / Date: 2026-10-11 · 状态 / Status: accepted policy; consent integration pending / 政策已确定，同意记录待接入

## 背景 / Context

Wiki 将原创代码、社区正文和第三方游戏素材一同展示，但它们的许可范围不同。必须保留贡献者归属，明确公众复用规则，避免将代码许可证自动套用到所有内容。

The Wiki displays original code, community prose and third-party game assets with different licensing scopes. Preserve contributor ownership, define public reuse and avoid applying the code license to all material.

## 决定 / Decision

有权许可的原创代码与仓库规范文档使用 GPL-3.0-only；原创 Wiki 正文使用 CC BY-SA 4.0，作者保留版权。正文许可允许商业用途，不附加非商业限制。分享时合理署名、标注修改，分享改编作品遵守相同方式共享要求。条款及例外范围见 [中文版权政策](../../COPYRIGHT.md) 与 [英文版权政策](../../COPYRIGHT.en.md)。

Original code and repository policy documents the project can license use GPL-3.0-only. Original Wiki prose uses CC BY-SA 4.0, with authors retaining copyright. Commercial reuse is allowed without an added noncommercial restriction. Sharing requires reasonable attribution and modification notices; adaptations follow ShareAlike. The linked policies define terms and exclusions.

## 范围 / Scope

已有作者作品不追溯改许可。导入的 V7.3.1 资料、游戏素材、商标、字体和第三方代码保留各自权利与许可；来源记录不能替代授权。两篇本项目正式原创文章明确注明正文许可。

Existing authors' works are not retroactively relicensed. Imported V7.3.1 content, game assets, trademarks, fonts and third-party code retain their respective rights and licenses. Provenance does not replace permission. The two project-original formal articles explicitly state their prose license.

## 后果 / Consequences

正式开放投稿前接入版本化的许可确认及服务端同意记录，保留引用/素材的例外标记，并配置真实版权联系渠道。GitHub Co-author 邮箱授权与内容许可分开；已有效授予的 CC 许可不因关闭账号、撤销署名或停止展示而单方失效。

Before opening formal contributions, implement versioned license confirmation and server-side consent records, preserve exclusions for quotations/assets and configure a real copyright contact. GitHub Co-author email consent is separate from content licensing. Validly granted CC permission is not unilaterally revoked by closing an account, withdrawing attribution consent or stopping display.

## 验证 / Verification

仓库规范、内容、类型、API/数据库与页面生命周期检查及生产构建通过。中英文版权页分别生成静态 HTML，包含许可链接，且不提供资料编辑或本机讨论。详细结果见 [本地验证记录](../validation.md)。这些检查不证明第三方素材已获授权，也不替代尚未接入的用户同意记录。

Repository, content, type, API/database, lifecycle and production-build checks passed. Both languages generate static HTML with license links and no article editor or local discussion. The linked validation record gives details. These checks do not establish permission for third-party assets or replace pending user-consent records.
