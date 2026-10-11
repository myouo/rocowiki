# 生产部署记录

目标仓库：[myouo/rocowiki](https://github.com/myouo/rocowiki)。站点域名：`wiki.rocoai.app`。按用户指定采用 Cloudflare Workers Static Assets；原 EdgeOne 方案被此部署决定替代。

## 本轮范围

先发布公开资料阅读站。生产 API 预留 `api.rocoai.app`，尚未部署；OIDC、GitHub App、D1 和投稿许可同意记录仍需独立配置与验收。`DEPLOY_RECEIPTS_ENABLED=false` 仅允许静态站版本核验，不触发投稿发布确认。完整后台就绪后启用回执并保持既有发布协议。

## 配置

GitHub `production` 环境仅允许 main。`SITE_URL=https://wiki.rocoai.app`，`API_ORIGIN=https://api.rocoai.app`。Cloudflare Token 以加密 Secret 保存，不进入仓库、源码、命令参数或测试报告。部署账号由活动 `rocoai.app` zone 校验；若 Token 无必要权限，CI 明确失败，不记为完成。

`apps/web/wrangler.jsonc` 定义 `rocowiki-web`，从经过校验的 `apps/web/build` 上传静态资源，绑定正式域名。路径按 Docusaurus 的尾斜杠规则处理，未知路径返回 404；版本文件 no-store，哈希资源长期缓存。上传前核验 digest 和当前 Git SHA，上传后核验正式 URL 的 release、SHA 和 digest。

## 优选与国内测速

指定优选目标：`rocowiki.cf.090227.xyz`。先建立可工作的 Worker 服务，再以 `https://wiki.rocoai.app/` 和 `/version.json` 为相同测试目标，分别使用默认解析和指定优选解析。保留 `wiki.rocoai.app` 的 Host/SNI，验证证书、200 响应及版本内容；不因优选别名自己的 HTTPS 失败而断言目标站点失败。

实际 DNS 切换前确认该优选方式与 Workers 自定义域/路由兼容。优选目标的解析地址可能变化，不硬编码未经测试的第三方 IP。测试应覆盖大陆电信、联通、移动，记录地区、时间、成功率、连接和首字节耗时，并至少重复取样；测速平台示例、境外 runner 或仅 TCP 数字不能称为本站国内 HTTPS 延迟。

## 当前状态

源代码与部署流程已准备，实际推送、CI 部署、域名证书和优选测速结果将在验证后补充。ITDOG 的本次测速要求人工验证码，尚无本次有效国内测量结果。

用户后续提供了一份无结果链接的汇总，已保存为 [初始样本](network-sample-2026-10-11.json)：全部节点平均 706ms，电信 267ms、联通 1169ms、移动 705ms，最大 9067ms。缺少协议、状态码、成功率、原始节点记录和指标定义，未独立核验；此为优选入口初始样本，不标为本站 HTTPS/首字节实测，也不能据此确定相对官方入口的改善幅度。
