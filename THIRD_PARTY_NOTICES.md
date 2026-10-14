# 许可与第三方权利
[English](THIRD_PARTY_NOTICES.en.md) · [LICENSE](LICENSE)
<!-- rocowiki-policy: rights; version: 3; lang: zh-CN -->

<a id="scope"></a>
## 项目许可范围

本项目有权许可的原创代码和仓库规范文档采用 **GPL-3.0-only**，完整条款以未经修改的 LICENSE 为准，不自动授予未来 GPL 版本。许可文本来源、哈希及已记录的依赖/素材状态见 [许可台账](docs/license-inventory.json)。

已有第三方文件的版权与许可声明继续有效。游戏图像、商标、从第三方网站取得的资料及字体不因放入仓库而改成 GPL 或 CC。有权按项目政策授权的原创 Wiki 正文使用 **CC BY-SA 4.0**，版权由作者保留；已有内容和导入资料须逐项确认授权，不追溯强加新许可。代码或正文许可不等于对所有现有素材拥有再分发权。作者归属、转载与权利问题处理遵循 [版权声明](COPYRIGHT.md)；站点的 /copyright/ 与 /copyright/en/ 提供中英文使用说明。

<a id="inventory"></a>
## 依赖与素材记录

直接依赖的名称、版本和安装包声明的许可在台账登记，可取得的原始许可文本保存在 licenses/third-party/。该记录不代表已完成全部传递依赖或每个发布制品的法律审查；缺失版权/许可正文的项标为 metadata-only，发行前取得必要声明。

本地 Noto Serif SC / Noto Sans SC 子集保留 OFL-1.1 与 FONT-SOURCE 证据，继续使用 OFL，不改成 GPL。游戏图片来源见 apps/web/content/asset-sources.json 与 pet-sources.json；来源 URL 只证明出处，不能替代授权。其再分发权尚未在本项目核验，公开发行前由有权限的维护者确认、替换或移除。

V7.3.1 界面来自用户提供的 RocoWiki_Docusaurus_V7_3_1 项目；保留现有作者与来源记录，不把第三方归属改写为本项目原创。

技能解析中的能力与状态图标保留官方 H5 `combatIcon` 的原始 PNG 字节，路径、尺寸与 SHA-256 见 `apps/web/static/img/combat/sources.json`。当前展示使用能力 202–206 系列与异常 101–109 的 `_bak` 透明底原图，按同一公开配置中的资源名称及图形核对；此前保留的原图与来源记录不删除，展示词表不再使用有底色的版本。未找到已核对透明对应图的术语保留文字链接；未复制客户端代码。这些既有游戏素材不纳入项目 GPL 或 CC 授权，再分发许可尚未核验。

官方宠物基础资料来自公开 `https://res.17roco.qq.com/conf/Angel.config`；`apps/web/content/official-pets.json` 记录采集时间、版本与原包 SHA-256，图标直接引用官方资源。该游戏资料不纳入本项目的 GPL 或 CC 授权，原权利仍归原权利人，再分发许可尚未核验。新增 XML 解析依赖 saxes 6.0.0 声明使用 ISC，但安装包未附完整许可文本，台账标记为 metadata-only；格式调查参考 open-roco-conn，未复制其 C++ 实现或反编译代码。

天梯费用和配置禁赛来自公开 `https://res.17roco.qq.com/plugins/LadderMatch/LadderMatchConfig.xml`，出处、采集时间和原 XML SHA-256 保留于 `apps/web/content/official-ladder.json`。未列明编号默认 1 费的规则参考官方客户端的费用合计与说明逻辑，调查入口为 open-roco-conn 的 LadderMatch 反编译资料；未复制其代码。该游戏配置同样不纳入项目 GPL 或 CC 授权，再分发许可仍待核验。

技能基础资料同样来自 Angel.config 的 `spiritSkill_conf`，保留版本、原包 SHA-256、原始描述和重复编号覆盖记录于 `apps/web/content/official-skills.json`。解析参考官方客户端 SpiritSkillDesProxy 的字段与源表顺序语义，以 TypeScript 独立实现，不复制反编译代码；游戏资料授权范围仍待核验。

宠物技能关联快照 `apps/web/content/pet-skill-relations.json` 来自公开 [roco-desc](https://gitcode.com/rocoai-dev/roco-desc) 的 `pet/` 记录，仅提取身份核对后的技能名称、学习方式和明确学习等级，并匹配官方技能编号；保留来源提交及原始数据摘要。没有复制社区解析正文、署名账号字段或 HTML。该来源是公开资料整理，不能冒充游戏服务器的账号技能池，也不纳入本项目 GPL 或 CC 授权；来源自身许可及再分发授权尚未核验。

游戏实采关联保存在 `apps/web/content/game-skill-relations.json`，仅保留游戏响应确认的宠物编号、技能编号、遗传标记、采集时实例等级及响应体摘要，不保存账号、实例身份、凭据、协议头或原始流量。空快照不代表已经实采；记录是指定背包实例当时的可选技能，不声明覆盖该物种全部学习途径。该游戏资料不纳入本项目 GPL 或 CC 授权，再分发许可仍待核验。采集器根据 RocoAI 的公开 headless 接口和游戏协议独立实现，未复制其源码。

技能解析样板 `skill-analysis-notes.json` 以 roco-desc 的详细描述为依据重述数值、公式及条件事实，生成 `skill-analyses.json` 时保留固定来源提交、原文摘要、来源公开署名与记录日期。不复制原 HTML 或账号字段，不将其作为本站独立游戏实测。此资料的来源权利仍归原权利人，不因事实整理自动取得原作者作品的 GPL 或 CC 授权；来源自身许可及再分发授权尚未核验。

<a id="changes"></a>
## 更新与发行

新增依赖、复制代码、字体或图像时登记来源、版本/哈希、原许可、保留声明位置和权限确认状态。未知情况标明待核验，不填虚构授权。变更直接依赖后运行 npm run licenses:refresh 并复核台账及双语说明。

分发项目 GPL 代码时一并保留 LICENSE 与相关声明，并依 LICENSE 提供对应源码和修改记录。发布者须按实际打包范围核对传递依赖和素材，不把这份直接依赖台账当作完整合规保证。
