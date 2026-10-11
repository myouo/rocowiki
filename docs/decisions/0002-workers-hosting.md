# 0002 — Workers static hosting / Workers 静态托管

日期 / Date: 2026-10-11 · 状态 / Status: accepted / 已采纳

## 背景与决定 / Context and decision

用户指定推送到 myouo/rocowiki，站点使用 wiki.rocoai.app，并最终选择 Workers 及优选域名 rocowiki.cf.090227.xyz。本决定替代 V1 的 EdgeOne 静态托管约束；API 的 Workers/D1、独立账号和审核发布协议继续有效。

The user selected myouo/rocowiki, wiki.rocoai.app, Workers hosting and the preferred endpoint rocowiki.cf.090227.xyz. This supersedes V1's EdgeOne hosting constraint. The separate Workers/D1 API, independent identities and reviewed-publication protocol remain applicable.

## 后果 / Consequences

采用 Workers Static Assets 与可信 GitHub Actions 制品上传，保留 SHA/digest 校验、正式 URL 核验及可重放的签名回执。首次资料阅读站显式关闭回执，后台发布开关未开启；不能将静态站成功当作后台功能上线。

Use Workers Static Assets and trusted GitHub Actions artifacts, retaining SHA/digest validation, public-version verification and replayable signed receipts. The initial reader site explicitly disables receipts while backend publishing remains closed. Static hosting success does not establish backend readiness.

优选部署须验证 TLS、Host/SNI、Worker 路由和实际版本。国内延迟必须来自真实大陆节点，区分 TCP 与 HTTPS，不承诺未经测量的“全球最快”。

Preferred routing must verify TLS, Host/SNI, Worker routing and the actual release. Mainland latency requires real mainland probes, distinguishing TCP from HTTPS; no unmeasured global-speed ranking is promised.

## 验证 / Verification

配置、实际部署与测速证据在 [部署记录](../deployment.md) 和 [本地验证记录](../validation.md) 更新；外部结果未取得前标记待验证。

Update configuration, deployment and measurement evidence in the linked records. External results remain pending until observed.
