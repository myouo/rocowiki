# 许可与第三方权利
[English](THIRD_PARTY_NOTICES.en.md) · [LICENSE](LICENSE)
<!-- rocowiki-policy: rights; version: 2; lang: zh-CN -->

<a id="scope"></a>
## 项目许可范围

本项目有权许可的原创代码和仓库规范文档采用 **GPL-3.0-only**，完整条款以未经修改的 LICENSE 为准，不自动授予未来 GPL 版本。许可文本来源、哈希及已记录的依赖/素材状态见 [许可台账](docs/license-inventory.json)。

已有第三方文件的版权与许可声明继续有效。游戏图像、商标、从第三方网站取得的资料及字体不因放入仓库而改成 GPL 或 CC。有权按项目政策授权的原创 Wiki 正文使用 **CC BY-SA 4.0**，版权由作者保留；已有内容和导入资料须逐项确认授权，不追溯强加新许可。代码或正文许可不等于对所有现有素材拥有再分发权。作者归属、转载与权利问题处理遵循 [版权声明](COPYRIGHT.md)；站点的 /copyright/ 与 /copyright/en/ 提供中英文使用说明。

<a id="inventory"></a>
## 依赖与素材记录

直接依赖的名称、版本和安装包声明的许可在台账登记，可取得的原始许可文本保存在 licenses/third-party/。该记录不代表已完成全部传递依赖或每个发布制品的法律审查；缺失版权/许可正文的项标为 metadata-only，发行前取得必要声明。

本地 Noto Serif SC / Noto Sans SC 子集保留 OFL-1.1 与 FONT-SOURCE 证据，继续使用 OFL，不改成 GPL。游戏图片来源见 apps/web/content/asset-sources.json 与 pet-sources.json；来源 URL 只证明出处，不能替代授权。其再分发权尚未在本项目核验，公开发行前由有权限的维护者确认、替换或移除。

导入的 V7.3.1 界面与历史文件的迁移来源见 docs/web-v731-integration.md；保留现有作者与来源记录，不把第三方归属改写为本项目原创。

<a id="changes"></a>
## 更新与发行

新增依赖、复制代码、字体或图像时登记来源、版本/哈希、原许可、保留声明位置和权限确认状态。未知情况标明待核验，不填虚构授权。变更直接依赖后运行 npm run licenses:refresh 并复核台账及双语说明。

分发项目 GPL 代码时一并保留 LICENSE 与相关声明，并依 LICENSE 提供对应源码和修改记录。发布者须按实际打包范围核对传递依赖和素材，不把这份直接依赖台账当作完整合规保证。
