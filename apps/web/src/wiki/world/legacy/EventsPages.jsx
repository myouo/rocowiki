import React from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { Link, PageHeader, Section, Badge, Notice, EmptyState, Contribution, TextLink, DocGrid, DataPair, BookmarkButton } from "../../core";
import { historicalEvent } from "../../data";
import { weekly } from "../../content/bundled.js";
import { DirectorySearch } from "../../DirectoryPanel";
import { RewardName, WeeklyEdition, WeeklySources, dateLabel, eventStatus, useWeeklyDate } from "../weekly.jsx";
import { EventRow, MissingInline, SOURCES, SourceLine, Tabs, Trail, useWorldQuery } from "../components.jsx";

function WeeklyEventRow({ event, today, stale }) {
  const typeLabel = {
    new: stale ? "当期新增" : "本期新增",
    new_permanent: stale ? "当期新增常驻" : "新增常驻",
    continuing: stale ? "当期延续" : "继续开放",
    ending: stale ? "当期到期" : "本周到期",
  }[event.category];
  return (
    <article
      className={
        "wa-event-row wa-v5-event-row" +
        (event.category === "ending" && !stale ? " wa-v6-event-ending" : "")
      }
    >
      <div className="wa-event-date" aria-label={`开放于 ${event.startDate}`}>
        <strong>{event.startDate.slice(8)}</strong>
        <span>{event.startDate.slice(0, 7).replace("-", " · ")}</span>
      </div>
      <div className="wa-event-copy">
        <div>
          <Badge tone={stale ? "amber" : "blue"}>
            {eventStatus(event, today, stale)}
          </Badge>
          <span className="wa-small">{typeLabel}</span>
        </div>
        <h2>
          <Link to={`/events/${event.slug}/`}>{event.name}</Link>
        </h2>
        <p className="wa-v5-event-reward">
          {event.rewardSummary ||
            event.rewards.map((reward, index) => (
              <React.Fragment key={reward.name}>
                {index > 0 && "、"}
                {reward.name}
                {reward.kind === "evolution_qualification" ? "进化资格" : ""}
              </React.Fragment>
            ))}
        </p>
        <small>
          <MapPin size={12} /> {event.map}
          <span>
            {" "}
            ·{" "}
            {event.endDate
              ? `${dateLabel(event.startDate)}—${dateLabel(event.endDate)}`
              : `${dateLabel(event.startDate)} 起 · 长期`}
          </span>
        </small>
      </div>
      <Link
        className="wa-v5-row-link"
        to={`/events/${event.slug}/`}
        aria-label={`查看${event.name}活动详情`}
      >
        查看详情 <ArrowRight size={15} />
      </Link>
    </article>
  );
}

function EventsIndex({ query }) {
  const update = useWorldQuery(query);
  const { today, stale } = useWeeklyDate();
  const raw = query.get("view") || "current";
  const view = ["current", "new", "continuing", "ending", "archive"].includes(
    raw,
  )
    ? raw
    : "current";
  const q = (query.get("q") || "").trim().toLowerCase();
  const matchesEvent = (event) =>
    !q ||
    [
      event.name,
      event.map,
      event.startDate,
      event.endDate,
      ...event.rewards.map((reward) => reward.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  const endingDate = new Date(`${today}T12:00:00Z`);
  endingDate.setUTCDate(endingDate.getUTCDate() + 7);
  const endingLimit = endingDate.toISOString().slice(0, 10);
  const rows = weekly.events.filter((event) => {
    if (!matchesEvent(event)) return false;
    if (view === "new")
      return event.category === "new" || event.category === "new_permanent";
    if (view === "continuing") return event.category === "continuing";
    if (view === "ending")
      return (
        !stale &&
        event.endDate &&
        event.endDate >= today &&
        event.endDate <= endingLimit
      );
    if (view === "archive")
      return stale || (event.endDate && event.endDate < today);
    return true;
  });
  const historicMatches =
    !q ||
    [historicalEvent.title, "趣味对弈", "华魇萌少", "宠物园", "2025", "2026"]
      .join(" ")
      .includes(q);
  const count = rows.length + (view === "archive" && historicMatches ? 1 : 0);
  return (
    <div className="wa-page wa-v5-events">
      <PageHeader
        title="活动与获取"
        eyebrow="王国周报"
        description="看本期开放内容、活动地点与奖励；收下宠物，也别错过进化资格。"
        crumbs={[{ label: "首页", to: "/" }, { label: "活动与获取" }]}
        actions={<TextLink to="/battle/">同期对战与禁赛</TextLink>}
      />
      <WeeklyEdition stale={stale} />
      <Tabs
        path="/events/"
        query={query}
        name="view"
        current={view}
        items={[
          ["current", stale ? "10月9日期" : "本期全部"],
          ["new", stale ? "当期新增" : "本期新增"],
          ["continuing", stale ? "当期延续" : "继续开放"],
          ["ending", "即将结束"],
          ["archive", "活动档案"],
        ]}
        label="活动分组"
      />
      <DirectorySearch
        query={query}
        onSubmit={(value) => update({ q: value })}
        placeholder="查活动、奖励宠物或活动地点"
        label="搜索活动"
      />
      <div className="wa-list-meta">
        <span>
          {view === "ending"
            ? "未来七天 · 已核对活动"
            : view === "archive"
              ? "按开放批次保留档案"
              : "10月9日期 · 活动清单"}
        </span>
        <span>{count} 条结果</span>
      </div>
      <div className="wa-v5-event-list">
        {rows.map((event) => (
          <WeeklyEventRow
            key={event.slug}
            event={event}
            today={today}
            stale={stale}
          />
        ))}
        {view === "archive" && historicMatches && <EventRow />}
      </div>
      {count === 0 && (
        <EmptyState
          title={
            view === "ending"
              ? stale
                ? "本期活动信息待更新"
                : "已收录活动中没有七日内截止项"
              : "没有匹配的活动"
          }
          action={
            <Link className="rw-button" to="/events/">
              查看本期清单
            </Link>
          }
        >
          {view === "ending"
            ? stale
              ? "10月9日快照已超过复核周期，当前截止提醒需重新核对。"
              : "这只覆盖本站已核对的活动，不代表游戏中没有其他临期活动。"
            : "可按活动名、奖励宠物或地图名称查找。"}
        </EmptyState>
      )}
      <WeeklySources
        sourceIds={[
          ...new Set(weekly.events.flatMap((event) => event.sourceIds)),
        ]}
      />
      <Section title="查活动时顺手确认" id="event-reading">
        <div className="wa-event-help">
          <div>
            <h3>奖励类型</h3>
            <p>进化资格需要对应前阶，和直接领取宠物分别记录。</p>
          </div>
          <div>
            <h3>领取时限</h3>
            <p>本页列公告参与日期；若领奖或兑换另有截止时间，会在详情单列。</p>
          </div>
          <div>
            <h3>同名复刻</h3>
            <p>每次开放独立归档，旧活动条件不自动套用到新的批次。</p>
          </div>
        </div>
      </Section>
      {view !== "archive" && (
        <TextLink to="/events/?view=archive">查阅往期活动档案</TextLink>
      )}
      <Contribution
        entity="活动与获取 · 2026-10-09"
        source={weekly.sources[0].url}
      />
    </div>
  );
}

const EVENT_ACTIVITY_NOTES = {
  "harvest-fruit-line-20261009": {
    preparation:
      "根据活动面板种植指定水果；公告说明活动期间任务所需水果的种植时间减半。",
    steps: [
      "在西域果林打开活动。",
      "完成水果种植任务，取得连线游戏的水果获取次数。",
      "参加水果连线，累计足够积分后兑换皇冠菠萝狮。",
    ],
  },
  "ifrit-challenge-20261009": {
    preparation: "公告要求携带迪莫完成挑战。挑战队伍和各阶段通关记录尚待收录。",
    steps: [
      "携带迪莫前往镇魂修道院。",
      "完成伊芙利特设置的恶魔系挑战。",
      "按活动阶段领取小夜，并解锁后续进化资格。",
    ],
  },
  "soul-helmets-20261009": {
    preparation: "在上古幻壁查看英魂灵气的收集要求。",
    steps: [
      "前往上古幻壁的活动入口。",
      "帮助修罗紫阎收回英魂灵气。",
      "完成活动任务后领取修罗紫阎。",
    ],
  },
  "energy-array-20261009": {
    preparation: "奖励属于进化资格，前阶与进化消耗需结合活动面板确认。",
    steps: [
      "在秘密隧道打开活动。",
      "把四圣兵移动到同一行，使方阵形成能量循环。",
      "完成活动后取得四圣兵·修罗的进化资格。",
    ],
  },
  "measurement-expert-20260904": {
    preparation:
      "本次开放期为9月4日至10月15日；答题数量和具体完成门槛需查看活动面板。",
    steps: [
      "前往西域果林，打开测量专家活动。",
      "完成量角桃懒准备的测量考题。",
      "达成活动要求后领取量角桃懒，并核对领取状态。",
    ],
  },
  "honey-homecoming-20260904": {
    preparation:
      "公告说明可以兑换宠物和进化资格。领取前需分别核对奖励形式、对应前阶与消耗。",
    steps: [
      "在艾美特山岭找到采蜜归巢活动。",
      "帮助采蜜，取得活动谢礼。",
      "查看可爱蜂、晨兴蜜蜂的对应奖励条件，使用谢礼兑换。",
    ],
  },
  "rice-shop-20260904": {
    preparation: "需要按活动订单收集食材；粮票是兑换资源，不代表已领取宠物。",
    steps: [
      "在真梦之园打开米粒小铺。",
      "收集所需食材并提交订单，取得粮票。",
      "使用粮票兑换米粒蔡或小苞谷，核对每项领取记录。",
    ],
  },
};

function WeeklyEventDetail({ event }) {
  const { today, stale } = useWeeklyDate();
  const guide = EVENT_ACTIVITY_NOTES[event.slug];
  return (
    <div className="wa-page wa-v5-event-detail">
      <PageHeader
        title={event.name}
        eyebrow={`活动档案 · ${event.startDate.slice(0, 4)}年${Number(event.startDate.slice(5, 7))}月`}
        description={event.summary}
        back="/events/"
        crumbs={[
          { label: "活动与获取", to: "/events/" },
          { label: event.name },
        ]}
        actions={
          <>
            <Badge tone={stale ? "amber" : "blue"}>
              {eventStatus(event, today, stale)}
            </Badge>
            <BookmarkButton
              id={`event-${event.slug}`}
              title={event.name}
              href={`/events/${event.slug}/`}
              kind="活动"
            />
          </>
        }
      />
      <DocGrid
        toc={[
          ["event-facts", "活动信息"],
          ["event-rewards", "奖励与资格"],
          ["event-steps", "参与说明"],
          ["event-sources", "公告与补充"],
        ]}
      >
        <WeeklyEdition stale={stale} />
        {event.category === "ending" && (
          <p className="wa-v6-edition-context">
            本活动于 {dateLabel(event.startDate)} 开放，因{" "}
            {dateLabel(event.endDate)} 到期纳入 10 月 9 日周的提醒。
          </p>
        )}
        <Section title="活动信息" id="event-facts">
          <dl className="wa-facts wa-facts-four">
            <DataPair label="开放日期" value={dateLabel(event.startDate)} />
            <DataPair
              label="结束日期"
              value={event.endDate ? dateLabel(event.endDate) : "长期活动"}
            />
            <DataPair
              label="活动地图"
              value={
                event.map === "魔法学院" ? (
                  <Link to="/places/academy/">{event.map}</Link>
                ) : (
                  event.map
                )
              }
            />
            <DataPair
              label="开放批次"
              value={dateLabel(event.announcementEdition || event.startDate)}
            />
          </dl>
          <p className="wa-small">
            {event.deadlineNote ||
              "公告精确到日期。单独的兑换截止、每日次数与消耗数量，尚需游戏内活动资料补全。"}
          </p>
        </Section>
        <Section title="奖励与资格" id="event-rewards">
          {event.rewardNote && (
            <p className="wa-v6-reward-note">{event.rewardNote}</p>
          )}
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr>
                  <th>奖励</th>
                  <th>获得形式</th>
                  <th>需要确认</th>
                </tr>
              </thead>
              <tbody>
                {event.rewards.map((reward) => (
                  <tr key={reward.name}>
                    <td>
                      <strong>
                        <RewardName reward={reward} />
                      </strong>
                    </td>
                    <td>
                      <Badge>
                        {reward.kindLabel ||
                          (reward.kind === "evolution_qualification"
                            ? "进化资格"
                            : "宠物")}
                      </Badge>
                    </td>
                    <td>
                      {reward.kind === "pet_or_evolution_qualification"
                        ? "先确认本项是直接获取还是进化，再核对前阶与消耗"
                        : reward.kind === "evolution_qualification"
                          ? "对应前阶、进化条件与消耗"
                          : "完成条件与领取次数"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="参与说明" id="event-steps">
          {guide ? (
            <>
              <p>{guide.preparation}</p>
              {event.slug === "ifrit-challenge-20261009" && (
                <TextLink to="/pets/137/">查看前置宠物：迪莫</TextLink>
              )}
              <ol className="wa-numbered-steps">
                {guide.steps.map((step, index) => (
                  <li key={step}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p>{step}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="wa-small">
                以上为公告流程概要；具体操作、每日限制及实测通关配置尚待补充。
              </p>
            </>
          ) : (
            <>
              <p>
                本期公告确认活动在{event.map}
                继续开放，并列出了上述奖励。完整任务步骤与参与限制尚未收录。
              </p>
              <TextLink
                to={`/edit/?entity=${encodeURIComponent(event.name + " · 活动步骤")}`}
              >
                补充参与步骤
              </TextLink>
            </>
          )}
        </Section>
        <Section title="公告与补充" id="event-sources">
          <WeeklySources detailed sourceIds={event.sourceIds} />
          <p className="wa-small">
            补充资料请注明开放批次，并提供活动界面、奖励条件或兑换说明，便于核对同名复刻。
          </p>
        </Section>
        <Contribution
          entity={`${event.name} · ${event.startDate}`}
          source={
            weekly.sources.find((source) => event.sourceIds.includes(source.id))
              ?.url
          }
        />
      </DocGrid>
    </div>
  );
}

function EventDetail() {
  return (
    <div className="wa-page">
      <PageHeader
        title="趣味对弈"
        eyebrow="历史活动 · 宠物获取"
        description="完成当次活动可开启华魇萌少的进化资格。"
        back="/events/?view=archive"
        crumbs={[
          { label: "活动与获取", to: "/events/" },
          { label: "历史活动", to: "/events/?view=archive" },
          { label: "趣味对弈" },
        ]}
        actions={
          <>
            <Badge>已结束</Badge>
            <BookmarkButton
              id="event-fun-chess"
              title="趣味对弈"
              href="/events/fun-chess-20251128/"
              kind="活动"
            />
          </>
        }
      />
      <DocGrid
        toc={[
          ["event-facts", "活动信息"],
          ["event-prepare", "前阶准备"],
          ["event-rewards", "奖励与资格"],
          ["event-steps", "参与记录"],
        ]}
      >
        <Notice title="这是2025年11月28日开放的活动档案">
          本次活动已于2026年1月8日结束。该记录不能用于判断华魇萌少当前是否仍可获得。
        </Notice>
        <Section title="活动信息" id="event-facts">
          <dl className="wa-facts wa-facts-four">
            <DataPair label="开放时间" value="2025.11.28 — 2026.01.08" />
            <DataPair label="活动地图" value="宠物园" />
            <DataPair label="主要结果" value="华魇萌少进化资格" />
            <DataPair label="公告发布时间" value="2025.11.26" />
          </dl>
          <SourceLine source={SOURCES.event} note="活动起止日期已核对" />
        </Section>
        <Section title="前阶准备" id="event-prepare">
          <div className="wa-prerequisite">
            <span className="wa-prerequisite-label">前置宠物</span>
            <div>
              <h3>先准备华魇萌少的前阶</h3>
              <p>
                官方公告提醒，前阶可在圣湖捕捉，并建议提前准备性格。前阶的精确名称与当次进化所需条件，仍需游戏内活动记录补全。
              </p>
            </div>
          </div>
          <Trail items={["前往圣湖", "准备前阶宠物", "参与宠物园活动"]} />
        </Section>
        <Section title="奖励与资格" id="event-rewards">
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr>
                  <th>获得内容</th>
                  <th>奖励类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>华魇萌少进化资格</strong>
                  </td>
                  <td>
                    <Badge tone="green">进化资格</Badge>
                  </td>
                  <td>需要结合前阶完成进化；此项并非直接领取宠物本体。</td>
                </tr>
                <tr>
                  <td>
                    <strong>礼遇契约</strong>
                  </td>
                  <td>道具</td>
                  <td>官方列入活动获得内容；本页未核实数量与具体领取节点。</td>
                </tr>
              </tbody>
            </table>
          </div>
          <TextLink to="/search/?q=华魇萌少">查找华魇萌少资料</TextLink>
        </Section>
        <Section title="参与记录" id="event-steps">
          <ol className="wa-numbered-steps">
            <li>
              <span>01</span>
              <div>
                <h3>准备前阶</h3>
                <p>确认前阶宠物与培养准备，保留活动要求的相关记录。</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>在宠物园参与活动</h3>
                <p>当次活动入口为宠物园。具体对弈步骤与每日次数尚未收录。</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>完成活动，开启进化资格</h3>
                <p>进化所需的完整条件、道具消耗及次数上限待补充。</p>
              </div>
            </li>
          </ol>
          <MissingInline
            title="需要补充当次活动的操作细节"
            entity="趣味对弈 · 2025-11-28活动步骤"
          >
            可以提交活动界面截图、前阶名称、每日限制和进化条件。
          </MissingInline>
        </Section>
        <Contribution
          entity="趣味对弈 · 2025-11-28"
          source={historicalEvent.source}
        />
      </DocGrid>
    </div>
  );
}
