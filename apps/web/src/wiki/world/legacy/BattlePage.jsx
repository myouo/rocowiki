import React from "react";
import { ExternalLink, Shield } from "lucide-react";
import { Link, PageHeader, Section, Badge, Notice, Contribution, DataPair } from "../../core";
import { historicalEvent } from "../../data";
import { CHECK_DATE, MissingInline, PetNameChips, SOURCES, SourceLine, Tabs, hrefWith, useWorldQuery } from "../components.jsx";

const LADDER_BANS_20251128 = [
  "朝曦冰夕",
  "圣灵草王",
  "圣湮伊莱娜",
  "美狄亚",
  "琴澜鸣鹤",
  "螣岚",
  "织魇帅帅",
  "墨菲斯",
];

const TYPE_MATCHES_20251128 = [
  {
    date: "2025-11-28",
    day: "周五",
    types: "火 / 草 / 冰",
    bans: [
      "乾镜双凤",
      "煌明火王",
      "炜煌雷诺",
      "圣灵草王",
      "硕果格兰",
      "驭萝侠兔",
      "伊西希斯",
      "冰溟魔魟",
    ],
  },
  {
    date: "2025-12-02",
    day: "下周二",
    types: "幽灵 / 毒 / 虫",
    bans: [
      "破启幽王",
      "冥铠战士",
      "幻鸩毒王",
      "如意毒王",
      "美狄亚",
      "西圣兽白鄂",
      "元夕白鄂",
      "舞蝶艾艾",
    ],
  },
];

function LegacyBattlePage({ query }) {
  const update = useWorldQuery(query),
    rawMode = query.get("mode") || "ladder",
    mode = ["ladder", "type", "peak"].includes(rawMode) ? rawMode : "ladder";
  const rawDate = query.get("date") || CHECK_DATE;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : CHECK_DATE;
  const isArchive =
    date === "2025-11-28" ||
    (mode === "type" &&
      TYPE_MATCHES_20251128.some((match) => match.date === date)) ||
    (mode === "peak" && date === "2025-12-12");
  const modes = {
    ladder: {
      title: "天梯赛",
      note: "查每周禁赛与对应赛季，配队前确认当前规则。",
    },
    type: {
      title: "系别排位赛",
      note: "每个比赛日的参赛系别和禁赛名单分别查阅。",
    },
    peak: { title: "巅峰赛", note: "独立查阅巅峰赛规则与结算信息。" },
  };
  return (
    <div className="wa-page">
      <PageHeader
        title="赛事与禁赛"
        eyebrow="先选模式，再核对规则"
        description="赛季、每周禁赛与系别开放日分别记录；历史名单保留日期。"
        crumbs={[{ label: "首页", to: "/" }, { label: "赛事与禁赛" }]}
      />
      <Tabs
        path="/battle/"
        query={query}
        name="mode"
        current={mode}
        items={[
          ["ladder", "天梯赛"],
          ["peak", "巅峰赛"],
          ["type", "系别排位赛"],
        ]}
        label="对战模式"
      />
      <div className="wa-battle-toolbar">
        <div>
          <strong>{modes[mode].title}</strong>
          <p>{modes[mode].note}</p>
        </div>
        <label>
          查询日期
          <input
            type="date"
            value={date}
            aria-label="查询规则日期"
            onChange={(event) =>
              update({ date: event.target.value || CHECK_DATE })
            }
          />
        </label>
      </div>
      <div className="wa-rule-meta">
        <div>
          <span>资料状态</span>
          <strong>{isArchive ? "历史公告" : "尚未核验"}</strong>
        </div>
        <div>
          <span>规则来源</span>
          <strong>{isArchive ? "腾讯页游官网" : "等待补充"}</strong>
        </div>
        <div>
          <span>页面整理日期</span>
          <strong>{CHECK_DATE}</strong>
        </div>
        <div>
          <span>当前所选模式</span>
          <strong>{modes[mode].title}</strong>
        </div>
      </div>
      {isArchive ? (
        <>
          <Notice title="正在查看历史规则">
            以下依据2025年11月28日周更公告中的历史记录。比赛日与结算日分别保留，不能用于判断当前参赛资格。
          </Notice>
          {mode === "ladder" ? (
            <Section title="公告中的天梯禁赛">
              <div className="wa-ban-heading">
                <Shield size={21} />
                <div>
                  <strong>2025.11.28 周更公告</strong>
                  <p>该公告列出的本周禁赛宠物</p>
                </div>
                <Badge>{LADDER_BANS_20251128.length} 只</Badge>
              </div>
              <PetNameChips names={LADDER_BANS_20251128} />
              <SourceLine source={SOURCES.event} />
            </Section>
          ) : mode === "type" ? (
            <Section title="系别赛比赛日">
              <div className="wa-match-days">
                {TYPE_MATCHES_20251128.map((match) => (
                  <article key={match.date}>
                    <div className="wa-match-date">
                      <span>{match.day}</span>
                      <strong>{match.date}</strong>
                    </div>
                    <div className="wa-match-content">
                      <p className="wa-match-types">
                        <span>参赛系别</span>
                        <strong>{match.types}</strong>
                      </p>
                      <span className="wa-small">本场禁赛</span>
                      <PetNameChips names={match.bans} />
                    </div>
                  </article>
                ))}
              </div>
              <SourceLine source={SOURCES.event} />
            </Section>
          ) : (
            <Section title="巅峰赛结算记录">
              <dl className="wa-facts">
                <DataPair label="对应公告" value="第39届结算预告" />
                <DataPair label="结算日期" value="2025年12月12日" />
                <DataPair label="活动地图" value="王者之地" />
              </dl>
              <MissingInline
                title="本公告未提供完整巅峰赛参赛规则"
                entity="巅峰赛 · 第39届规则"
              >
                详细参赛条件与禁赛名单应另行核验。
              </MissingInline>
              <SourceLine source={SOURCES.event} />
            </Section>
          )}
        </>
      ) : (
        <div className="wa-current-rule">
          <Shield size={32} />
          <h2>
            {date} 的{modes[mode].title}规则待核验
          </h2>
          <p>
            本页尚未收录该日期经过核验的
            {mode === "type" ? "参赛系别与禁赛名单" : "完整参赛规则"}
            。请以游戏内对应模式的说明为准。
          </p>
          <div>
            <a
              className="rw-button"
              href="https://roco.qq.com/"
              target="_blank"
              rel="noreferrer"
            >
              查看官方公告 <ExternalLink size={14} />
            </a>
            <Link
              className="rw-button"
              to={hrefWith("/battle/", query, { date: "2025-11-28", mode })}
            >
              查看已核实历史公告
            </Link>
          </div>
        </div>
      )}
      <Section title="配队前的三个核对点">
        <div className="wa-rule-checks">
          <div>
            <span>01</span>
            <h3>模式</h3>
            <p>天梯、系别与巅峰赛分别查阅。</p>
          </div>
          <div>
            <span>02</span>
            <h3>有效日期</h3>
            <p>赛季编号不能代替当周或当日规则。</p>
          </div>
          <div>
            <span>03</span>
            <h3>宠物与形态</h3>
            <p>以规则中明确列出的名字核对。</p>
          </div>
        </div>
      </Section>
      <Contribution
        entity={modes[mode].title + " · " + date}
        source={isArchive ? historicalEvent.source : undefined}
      />
    </div>
  );
}

export { LegacyBattlePage };
