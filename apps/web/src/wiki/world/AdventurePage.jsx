import React from "react";
import { ArrowRight, ChevronRight, Compass, FlaskConical, Flag, Map, MapPin, Users } from "lucide-react";
import { Link, PageHeader, Section, TextLink } from "../core";
import { places } from "../data";
import { ColorIcon } from "../visuals";
import { AdventureNav } from "./components.jsx";
import { PLACE_DETAILS, PLACE_VISUALS } from "./placeData.js";

function AdventureHome() {
  const entries = [
    {
      to: "/places/",
      title: "地图与地区",
      text: "入口、子场景与人物位置",
      Icon: Map,
      tone: "blue",
      trail: "王国城堡 / 魔法学院 / 玄玉岛",
    },
    {
      to: "/npcs/",
      title: "人物与服务",
      text: "从名字找到地点和关联任务",
      Icon: Users,
      tone: "amber",
      trail: "格里芬院长 / 兰斯洛",
    },
    {
      to: "/tasks/",
      title: "任务与剧情",
      text: "前置条件、任务步骤与徽章",
      Icon: Flag,
      tone: "coral",
      trail: "主线剧情 / 徽章任务",
    },
    {
      to: "/items/",
      title: "道具与物品",
      text: "查用途，再找购买或兑换地点",
      Icon: FlaskConical,
      tone: "violet",
      trail: "恢复道具 / 培养 / 装备 / 兑换",
    },
  ];
  return (
    <div className="wa-page wa-v71-adventure" data-no-editor>
      <PageHeader
        title="冒险资料"
        eyebrow="王国手册"
        description="找地方、找人物，也把一段冒险的前因后果查清楚。"
        crumbs={[{ label: "首页", to: "/" }, { label: "冒险资料" }]}
        edit={false}
      />
      <AdventureNav current="/adventure/" />
      <div className="wa-adventure-grid">
        <div className="wa-directory">
          {entries.map(({ to, title, text, Icon, trail, tone }) => (
            <Link className={`wa-directory-row wa71-entry rw-tone-${tone}`} to={to} key={to}>
              <div className="wa71-entry-top"><ColorIcon Icon={Icon} tone={tone} size={26} /><ArrowRight size={18} /></div>
                <h2>{title}</h2>
                <p>{text}</p>
                <small>{trail}</small>
              <span className="wa71-entry-action">进入{title}<ChevronRight size={14} /></span>
            </Link>
          ))}
        </div>
        <aside className="wa-reading">
          <ColorIcon Icon={Compass} tone="teal" size={22} />
          <span className="wa-kicker">从一个目标开始</span>
          <h2>顺着线索，找到下一步</h2>
          <ol className="wa-reading-list">
            <li>
              <strong>记得一个地名</strong>
              <p>在地区索引中找入口与子场景。</p>
              <TextLink to="/places/">打开地区索引</TextLink>
            </li>
            <li>
              <strong>想获取一只宠物</strong>
              <p>先确认活动日期、前阶要求与奖励类型。</p>
              <TextLink to="/events/">查活动与获取</TextLink>
            </li>
            <li>
              <strong>卡在一场挑战</strong>
              <p>按层数与Boss查规则，再核对自己的配置。</p>
              <TextLink to="/pve/">查 PVE 副本与挑战</TextLink>
            </li>
          </ol>
        </aside>
      </div>
      <Section
        title="常用地区"
        aside={<TextLink to="/places/">全部地区</TextLink>}
        edit={false}
      >
        <div className="wa-compact-places">
          {places.map((place) => {
            const visual = PLACE_VISUALS[place.slug] || {Icon: MapPin, tone: "teal"};
            return <Link key={place.slug} className={`rw-tone-${visual.tone}`} to={"/places/" + place.slug + "/"}>
              <ColorIcon Icon={visual.Icon} tone={visual.tone} size={21} />
              <span>
                <strong>{place.name}</strong>
                <small>{PLACE_DETAILS[place.slug]?.focus || place.role}</small>
              </span>
              <ChevronRight size={15} />
            </Link>;
          })}
        </div>
      </Section>
    </div>
  );
}

export { AdventureHome };
