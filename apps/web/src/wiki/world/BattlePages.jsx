import React from "react";
import { ArrowRight, BookOpen, Search, Shield, Swords } from "lucide-react";
import { Link, PageHeader, Section, Badge, Notice, EmptyState, Contribution, TextLink, DocGrid, DataPair, BookmarkButton, TypeBadge } from "../core";
import { weekly, officialLadderData, officialPetData } from "../content/bundled.js";
import { LadderBanList, LadderBanSource } from "./LadderBans";
import { PetNameChips, SourceLine, Tabs, hrefWith, useWorldQuery } from "./components.jsx";
import { WeeklyEdition, WeeklySources, dateLabel, useWeeklyDate } from "./weekly.jsx";
import {findBanNotice,historyHref,archiveSource} from '../ladderHistoryModel';
import {ArchiveSource,NoticeBanNames} from './LadderHistory';

const PVP_MODE_NAMES = {
  type: "系别排位赛",
  ladder: "天梯赛",
  peak: "天梯巅峰赛",
};

function normalizePvpMode(raw) {
  if (raw === "type-tournament") return "type";
  if (raw === "ladder-peak") return "peak";
  return ["type", "ladder", "peak"].includes(raw) ? raw : "ladder";
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function WeeklyPeriod({ period, selected, today, stale, query }) {
  return (
    <article className={"wa-v5-period" + (selected ? " is-selected" : "")}>
      <div className="wa-ban-heading">
        <div>
          <span className="wa-kicker">
            {period.startDate > today
              ? "公告预告"
              : stale
                ? "历史规则"
                : "系别规则"}
          </span>
          <h3>{dateLabel(period.startDate)} 起</h3>
        </div>
        <Link
          to={hrefWith("/battle/", query, {
            mode: "type",
            date: period.startDate,
          })}
          className="wa-v5-period-select"
          aria-current={selected ? "date" : undefined}
        >
          {selected ? "所选日期对应规则" : "查看这一组"}
        </Link>
      </div>
      <div className="wa-v5-eligible-types">
        <span>允许主属性</span>
        {period.types.map((type) => (
          <TypeBadge key={type} type={type} />
        ))}
      </div>
      <div className="wa-v5-ban-label">
        <strong>禁用宠物</strong>
        <span>{period.bannedPets.length} 只</span>
      </div>
      <PetNameChips names={period.bannedPets} />
      {period.nextChangeDate && (
        <p className="wa-small">
          公告列出下一组于 {dateLabel(period.nextChangeDate)}{" "}
          更新，精确切换时刻以游戏内为准。
        </p>
      )}
    </article>
  );
}

function BattlePage({ query }) {
  const update = useWorldQuery(query);
  const { today, stale } = useWeeklyDate();
  const mode = normalizePvpMode(query.get("mode"));
  const historicalDate = validDate(query.get("date")) ? query.get("date") : null;
  const showConfig = mode !== "type" && !historicalDate;
  const fallbackDate = stale ? weekly.edition.startDate : today;
  const date = historicalDate || fallbackDate;
  const historicalNotice=historicalDate?findBanNotice(historicalDate,mode):null;
  const inEdition =
    date >= weekly.edition.startDate && date < weekly.edition.reviewDueDate;
  const activePeriod = [...weekly.pvp.typeTournament.periods]
    .reverse()
    .find((period) => period.startDate <= date);
  return (
    <div className="wa-page wa-v5-battle">
      <PageHeader
        title="对战与禁赛"
        eyebrow="PVP 资料"
        description="先看主属性与禁用宠物，再核对完整阵容；系别赛与天梯名单分别查阅。"
        crumbs={[{ label: "首页", to: "/" }, { label: "对战与禁赛" }]}
        actions={
          <><TextLink to={`/battle/rules/?mode=${mode}`}>参赛规则</TextLink><TextLink to={historyHref({mode})}>历届赛季与奖励</TextLink></>
        }
      />
      {!showConfig && inEdition && <WeeklyEdition stale={stale} />}
      <Tabs
        path="/battle/"
        query={query}
        name="mode"
        current={mode}
        items={[
          ["ladder", "天梯赛"],
          ["peak", "天梯巅峰赛"],
          ["type", "系别排位赛"],
        ]}
        label="对战模式"
      />
      <div className="wa-battle-toolbar">
        <div>
          <strong>{PVP_MODE_NAMES[mode]}</strong>
          <p>
            {mode === "type"
              ? "每周二、周五各更新一组主属性与禁用名单。"
              : mode === "peak"
                ? "与天梯共享禁用名单，参赛条件单独确认。"
                : "每周五更新禁用名单。"}
          </p>
        </div>
        <label>
          查询历史日期
          <input
            type="date"
            value={showConfig ? "" : date}
            aria-label="查询规则日期"
            onChange={(event) =>
              update({ date: event.target.value || null })
            }
          />
        </label>
      </div>
      {mode !== "type" && !showConfig && <TextLink to={hrefWith("/battle/", query, { date: null })}>查看 XML 配置禁赛</TextLink>}
      {showConfig ? (
        <Section title={mode === "peak" ? "巅峰赛共享配置禁赛名单" : "天梯配置禁赛名单"} id="weekly-bans">
          <div className="wa-ban-heading"><Shield size={21} /><strong>官方天梯配置</strong><Badge>{officialLadderData.bannedPetIds.length} 只</Badge></div>
          <p>天梯与巅峰赛共享禁赛名单；费用与完整阵容条件分别核对。</p>
          <LadderBanList snapshot={officialLadderData} catalog={officialPetData.pets} />
          <LadderBanSource snapshot={officialLadderData} />
        </Section>
      ) : inEdition ? (
        <>
          <div className="wa-list-meta">
            <span>
              {dateLabel(date)} · {stale ? "公告快照" : "所选日期"}
            </span>
            <span>核对于 {dateLabel(weekly.verification.checkedAt)}</span>
          </div>
          {mode === "type" ? (
            <>
              <div className="wa-v5-period-list">
                {weekly.pvp.typeTournament.periods.map((period) => (
                  <WeeklyPeriod
                    key={period.id}
                    period={period}
                    selected={period.id === activePeriod?.id}
                    today={today}
                    stale={stale}
                    query={query}
                  />
                ))}
              </div>
              <p className="wa-small">
                属性条件只看主属性。同主属性最多 3
                只；双属性宠物不能只凭副属性满足参赛条件。
              </p>
            </>
          ) : (
            <Section
              title={
                mode === "peak" ? "本期共享天梯禁用名单" : "本期天梯禁用名单"
              }
              id="weekly-bans"
            >
              <div className="wa-ban-heading">
                <Shield size={21} />
                <div>
                  <strong>{dateLabel(weekly.edition.startDate)} 周更新</strong>
                  <p>
                    {mode === "peak"
                      ? "巅峰赛与天梯共享此名单。"
                      : "仅适用于天梯赛及共享名单的巅峰赛。"}
                  </p>
                </div>
                <Badge>{weekly.pvp.ladder.bannedPets.length} 只</Badge>
              </div>
              <PetNameChips names={weekly.pvp.ladder.bannedPets} />
              {mode === "peak" && (
                <p className="wa-small">
                  巅峰赛需本届天梯胜点达到 3300 后解锁；阵容不受天梯 16
                  点魔力值上限限制。
                </p>
              )}
            </Section>
          )}
          <WeeklySources detailed />
        </>
      ) : historicalNotice ? (
        <Section title={`${date} 公告禁赛记录`} id="historical-bans">
          <p>这份公告记录对应所选批次，未自动推断相邻日期的完整适用区间。{mode==='peak'?'巅峰赛共享天梯名单，其他参赛条件分别核对。':''}</p>
          {historicalNotice.allowedTypes&&<p>该场参赛主属性：<strong>{historicalNotice.allowedTypes.join(' / ')}</strong></p>}
          {historicalNotice.bannedPetNames.length?<NoticeBanNames names={historicalNotice.bannedPetNames}/>:<p className="lh-zero">原公告明确记载：本期无禁赛宠物。</p>}
          <ArchiveSource source={archiveSource(historicalNotice.sourceId)}/>
          <TextLink to={historyHref({view:'bans',mode,record:historicalNotice.id})}>查看这一期的完整档案</TextLink>
        </Section>
      ) : (
        <EmptyState
          title={`${dateLabel(date)} 的规则尚未收录`}
          action={
            <Link
              className="rw-button"
              to={`/battle/?mode=${mode}&date=${weekly.edition.startDate}`}
            >
              查看已收录规则快照
            </Link>
          }
        >
          本站只对已收录批次列出名单，缺少公告时不会沿用上一期禁赛作为当前规则。
          <TextLink to={historyHref({view:'bans',mode,date})}>查询该日已收录档案</TextLink>
        </EmptyState>
      )}
      <Section title="继续查阅" id="battle-reading">
        <div className="wa-v5-related-links">
          <Link to={`/battle/rules/?mode=${mode}`}>
            <BookOpen size={18} />
            <div>
              <strong>{PVP_MODE_NAMES[mode]}参赛规则</strong>
              <span>等级、阵容、主属性与模式限制</span>
            </div>
            <ArrowRight size={16} />
          </Link>
          <Link to="/mechanics/overview/">
            <Swords size={18} />
            <div>
              <strong>战斗机制手册</strong>
              <span>结算顺序、状态覆盖与技能交互</span>
            </div>
            <ArrowRight size={16} />
          </Link>
          <Link to="/pets/">
            <Search size={18} />
            <div>
              <strong>宠物图鉴</strong>
              <span>查阅已收录宠物及技能资料</span>
            </div>
            <ArrowRight size={16} />
          </Link>
        </div>
      </Section>
      <div className="wa-v5-archive-link">
        <TextLink to={historyHref({mode})}>历届赛季、历史禁赛与奖励档案</TextLink>
        <TextLink to="/events/">同期活动</TextLink>
      </div>
      <Contribution
        entity={`${PVP_MODE_NAMES[mode]} · ${showConfig ? "配置禁赛" : date}`}
        source={showConfig ? officialLadderData.source.url : inEdition ? weekly.sources[0].url : historicalNotice ? archiveSource(historicalNotice.sourceId).url : undefined}
      />
    </div>
  );
}

const PVP_RULES = {
  type: [
    ["阵容", "携带 6 只不同的满级宠物。"],
    ["主属性", "只能使用本期指定的三种主属性，同一种主属性最多 3 只。"],
    ["参赛前状态", "宠物不能阵亡，也不能残血。"],
    ["本期限制", "按所选日期核对系别禁赛名单；其他互斥组合还需看游戏内规则。"],
    ["对战中", "不可使用药剂。"],
  ],
  ladder: [
    ["阵容", "携带 6 只不同的满级宠物。"],
    ["魔力值", "整队宠物的魔力值总和不超过 16 点。"],
    ["参赛前状态", "宠物不能阵亡，可以残血。"],
    ["本期限制", "核对天梯禁赛名单；每周五更新。"],
    ["对战中", "不可使用药剂，前 6 回合不能逃跑。"],
  ],
  peak: [
    ["解锁", "本届天梯赛胜点达到 3300 后解锁。"],
    ["禁赛名单", "与天梯赛共享禁赛宠物。"],
    ["魔力值", "阵容没有天梯赛的魔力值总和限制。"],
    [
      "其他参赛条件",
      "请同时核对游戏内巅峰赛说明；本页不将未明确的条件自动补齐。",
    ],
  ],
};

function BattleRules({ query }) {
  const mode = normalizePvpMode(query.get("mode"));
  const { stale } = useWeeklyDate();
  const source = weekly.sources.find(
    (item) => item.id === "pvp-guide-official-forum",
  );
  return (
    <div className="wa-page wa-v5-battle-rules">
      <PageHeader
        title={`${PVP_MODE_NAMES[mode]}参赛规则`}
        eyebrow="赛事规则"
        description="参赛条件与周更名单一起核对。主属性、同系数量和禁用名单是不同层面的要求。"
        back={`/battle/?mode=${mode}`}
        crumbs={[
          { label: "对战与禁赛", to: "/battle/" },
          { label: "参赛规则" },
        ]}
        actions={
          <BookmarkButton
            id={`rules-${mode}`}
            title={`${PVP_MODE_NAMES[mode]}参赛规则`}
            href={`/battle/rules/?mode=${mode}`}
            kind="对战"
          />
        }
      />
      <Tabs
        path="/battle/rules/"
        query={query}
        name="mode"
        current={mode}
        items={[
          ["ladder", "天梯赛"],
          ["peak", "天梯巅峰赛"],
          ["type", "系别排位赛"],
        ]}
        label="查阅其他赛制"
      />
      <DocGrid
        toc={[
          ["rules-entry", "参赛条件"],
          ["rules-weekly", "周更名单"],
          ["rules-check", "怎样核对阵容"],
          ["rules-source", "规则依据"],
        ]}
      >
        <Section title="参赛条件" id="rules-entry">
          <dl className="wa-facts wa-v5-rule-facts">
            {PVP_RULES[mode].map(([label, value]) => (
              <DataPair key={label} label={label} value={value} />
            ))}
          </dl>
          {mode === "type" && (
            <Notice title="主属性不等于任意一个属性">
              双属性宠物仍按主属性判断。同系数量限制也按主属性计算，不能把副属性符合要求的宠物直接视为可参赛。
            </Notice>
          )}
        </Section>
        <Section title="周更名单" id="rules-weekly">
          {mode === "type" && <WeeklyEdition stale={stale} />}
          {mode === "type" ? (
            <div className="wa-v5-rules-periods">
              {weekly.pvp.typeTournament.periods.map((period) => (
                <Link
                  key={period.id}
                  to={`/battle/?mode=type&date=${period.startDate}`}
                >
                  <span>{dateLabel(period.startDate)} 起</span>
                  <strong>{period.types.join(" / ")}</strong>
                  <span>{period.bannedPets.length} 只禁用宠物</span>
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
          ) : (
            <>
              <p>官方 XML 配置共列出 {officialLadderData.bannedPetIds.length} 只天梯禁用宠物，巅峰赛共享名单。</p>
              <LadderBanList snapshot={officialLadderData} catalog={officialPetData.pets} />
              <LadderBanSource snapshot={officialLadderData} />
            </>
          )}
          <TextLink
            to={mode === "type" ? `/battle/?mode=${mode}&date=${weekly.edition.startDate}` : `/battle/?mode=${mode}`}
          >
            {mode === "type" ? "查看完整禁用名单与公告" : "查看配置禁赛名单"}
          </TextLink>
        </Section>
        <Section title="怎样核对阵容" id="rules-check">
          <ol className="wa-numbered-steps">
            <li>
              <span>01</span>
              <div>
                <h3>确认模式与日期</h3>
                <p>天梯与系别赛分别查；系别赛还要区分周二和周五的规则组。</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>
                  {mode === "type"
                    ? "核对主属性与每系数量"
                    : "核对该模式的队伍条件"}
                </h3>
                <p>
                  {mode === "type"
                    ? "用主属性判断范围，再检查同一主属性是否超过 3 只。"
                    : "检查等级、重复宠物和模式特有要求；天梯与巅峰的魔力值条件不同。"}
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>逐只核对禁用名单</h3>
                <p>
                  名单中的名称与形态需准确对应；没有被禁用并不表示整队已通过全部条件。
                </p>
              </div>
            </li>
          </ol>
          <p className="wa-small">
            本页提供核对资料，尚未实现完整阵容校验器，也未收录全部互斥组合。
          </p>
        </Section>
        <Section title="规则依据" id="rules-source">
          <SourceLine
            source={{
              url: source.url,
              label: source.title,
              date: source.sectionUpdatedAt,
            }}
            note="官方论坛版主团原创攻略 · PVP赛制段"
          />
          <p className="wa-small">
            以上通用参赛条件按该段记录整理；遇到之后的调整，应保留新公告日期并更新本页。
          </p>
          <TextLink to={historyHref({view:'changes',mode})}>查看历史费用与兑换变动</TextLink>
          <TextLink to={historyHref({view:'bans',mode})}>查看各期禁赛档案</TextLink>
        </Section>
        <Contribution
          entity={`${PVP_MODE_NAMES[mode]} · 参赛规则`}
          source={source.url}
        />
      </DocGrid>
    </div>
  );
}

export { BattlePage, BattleRules };
