// SPDX-License-Identifier: GPL-3.0-only
import React from "react";
import useBrokenLinks from "@docusaurus/useBrokenLinks";

type Translation = { zh: string; en: string };
type Credit = { name: Translation; description: Translation; href?: string };
type CreditGroup = { title: Translation; entries: Credit[] };

const groups: CreditGroup[] = [
  {
    title: { zh: "游戏资料与图片", en: "Game data and images" },
    entries: [
      { name: { zh: "洛克王国官方公开配置", en: "Official Roco Kingdom configuration" }, href: "https://res.17roco.qq.com/conf/Angel.config", description: { zh: "宠物、技能基础参数与官方图标地址；天梯费用和禁用名单另据官方天梯配置核对。", en: "Pet and skill base parameters and official icon URLs. Ladder costs and bans are checked against the separate official ladder configuration." } },
      { name: { zh: "洛克小册子", en: "Roco Booklet" }, href: "https://roco.dvg.cn/", description: { zh: "部分宠物样本资料与角色原图的整理来源。", en: "A reference for selected pet samples and original character images." } },
      { name: { zh: "roco-desc", en: "roco-desc" }, href: "https://gitcode.com/rocoai-dev/roco-desc", description: { zh: "历史技能关联快照与技能解析样板的事实参考，具体记录保留来源提交与署名。", en: "A reference for historical skill-relation snapshots and facts in sample skill analyses. Records retain source commits and attribution." } },
      { name: { zh: "4399 洛克王国", en: "4399 Roco Kingdom" }, href: "https://news.4399.com/luoke/", description: { zh: "活动公告转载、历史攻略与部分游戏规则的交叉核对来源。", en: "Reprinted event announcements, historical guides and corroborating game-rule references." } },
      { name: { zh: "17173 与 3DM 的公告转载", en: "Announcement reprints on 17173 and 3DM" }, href: "https://ol.3dmgame.com/gl/355096.html", description: { zh: "与同期公告对照，用于核对周更活动和开放日期；原始链接保留在各期来源中。", en: "Contemporaneous reprints used to cross-check weekly events and opening dates. Each edition retains its original links." } },
    ],
  },
  {
    title: { zh: "玩家研究与公式", en: "Player research and formulas" },
    entries: [
      { name: { zh: "巴甫洛夫的猫与官方论坛版主团", en: "巴甫洛夫的猫 and the official forum moderation team" }, href: "https://17roco.gamebbs.qq.com/forum.php?mod=viewthread&tid=162202", description: { zh: "《宠物能力培养指南》中的培养公式、取整顺序及守护兽映射参考。", en: "Training formulas, rounding order and guardian mappings from the pet training guide." } },
      { name: { zh: "巴甫洛夫的猫、原味酸甜", en: "巴甫洛夫的猫 and 原味酸甜" }, href: "https://17roco.gamebbs.qq.com/forum.php?mod=viewthread&tid=162103", description: { zh: "《威力伤害计算器》的公开公式与计算口径，分别保留发布者和修订者署名。", en: "Published formulas and calculation conventions from the power damage calculator, with author and reviser attribution retained." } },
      { name: { zh: "超级楚的無頭", en: "超级楚的無頭" }, href: "https://www.bilibili.com/video/BV1dY4y1W7om/", description: { zh: "历史伤害浮动实测视频，作为伤害档位的研究参考。", en: "Historical damage-variation experiments used as a reference for damage tiers." } },
    ],
  },
  {
    title: { zh: "项目、字体与工具", en: "Projects, fonts and tools" },
    entries: [
      { name: { zh: "Docusaurus 与 React", en: "Docusaurus and React" }, href: "https://github.com/facebook/docusaurus", description: { zh: "站点框架与交互界面。", en: "The site framework and interactive interface." } },
      { name: { zh: "Lucide", en: "Lucide" }, href: "https://lucide.dev/", description: { zh: "界面图标。", en: "Interface icons." } },
      { name: { zh: "Pagefind", en: "Pagefind" }, href: "https://github.com/Pagefind/pagefind", description: { zh: "静态站点全文搜索。", en: "Full-text search for the static site." } },
      { name: { zh: "Noto 字体", en: "Noto fonts" }, href: "https://github.com/google/fonts", description: { zh: "本地中文字体子集，保留 OFL-1.1 许可与来源记录。", en: "Local Chinese font subsets, with OFL-1.1 notices and provenance retained." } },
      { name: { zh: "Moe Counter", en: "Moe Counter" }, href: "https://github.com/journey-ad/Moe-Counter", description: { zh: "首页与 README 的 Miku 主题访问计数图片。", en: "Miku theme visit-counter images on the homepage and README." } },
      { name: { zh: "open-roco-conn", en: "open-roco-conn" }, description: { zh: "公开配置格式与部分客户端规则的调查参考；本站解析与逻辑独立实现。", en: "A research reference for public configuration formats and selected client rules. Site parsers and logic are implemented independently." } },
      { name: { zh: "RocoAI", en: "RocoAI" }, description: { zh: "游戏资料采集器的公开 headless 接口参考；采集器独立实现。", en: "A public headless-interface reference for the independently implemented game-data collector." } },
    ],
  },
];

export default function Acknowledgements({ english = false }: { english?: boolean }) {
  useBrokenLinks().collectAnchor("credits");
  const language = english ? "en" : "zh";
  return (
    <section aria-labelledby="credits">
      <h2 id="credits">{english ? "Sources and acknowledgements" : "数据来源与致谢"}</h2>
      <p>{english ? "Thank you to the people who document the game, share their research and maintain these projects. This list summarizes sources already recorded by RocoWiki; individual entries retain more specific links, dates and attribution." : "感谢记录游戏资料、分享研究成果和维护开源项目的每一位贡献者。以下汇总本站已有的来源记录，具体条目仍保留对应出处、日期与作者署名。"}</p>
      <div className="rw-credits-groups">
        {groups.map(group => (
          <div className="rw-credits-group" key={group.title.en}>
            <h3>{group.title[language]}</h3>
            <dl>
              {group.entries.map(entry => (
                <div key={entry.name.en}>
                  <dt>{entry.href ? <a href={entry.href} target="_blank" rel="noreferrer">{entry.name[language]}</a> : entry.name[language]}</dt>
                  <dd>{entry.description[language]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="rw-credits-note">{english ? "Acknowledgement does not imply sponsorship, endorsement or a change of license. Game assets and third-party materials retain their own rights; attribution does not replace permission." : "致谢不表示合作、赞助、官方认可或许可变更。游戏素材与第三方资料保留各自权利，来源署名不能代替使用授权。"}</p>
    </section>
  );
}
