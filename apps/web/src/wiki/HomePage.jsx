import React, { useEffect, useState } from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import {
  ArrowRight,
  CalendarDays,
  Swords,
  ExternalLink,
  GitCompareArrows,
  Clock3,
  NotebookPen,
  Shield,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Link, TypeBadge, Section, TextLink } from "./core";
import { PetCard } from "./CatalogPages";
import { pets } from "./data";
import { petCatalogHref } from "./catalog/pets/officialModel";
import { weekly } from "./content/bundled.js";
import { ColorIcon } from "./visuals";
import WelcomeBackdrop from "./WelcomeBackdrop";

export function chinaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
const shortDate = (date) => date?.slice(5).replace("-", ".") || "";
function PetName({ name }) {
  const pet = pets.find((p) => p.name === name);
  return pet ? (
    <Link to={petCatalogHref(pet)}>{name}</Link>
  ) : (
    <span>{name}</span>
  );
}
function InlineBans({ bannedPets }) {
  return (
    <div className="rw-v6-inline-bans">
      {bannedPets.map((pet, index) => (
        <React.Fragment key={pet.name}>
          {index > 0 && (
            <span className="rw-v6-ban-separator" aria-hidden="true">
              、
            </span>
          )}
          <PetName name={pet.name} />
        </React.Fragment>
      ))}
    </div>
  );
}

export function WeeklyPvp({ today }) {
  const historical = today >= weekly.edition.reviewDueDate;
  const ladder = weekly.pvp.ladder;
  return (
    <section className="rw-v6-weekly-pvp" aria-labelledby="rw-weekly-pvp-title">
      <div className="rw-section-head rw-v6-heading">
        <h2 id="rw-weekly-pvp-title">
          <Swords size={19} />
          {historical ? "本期竞赛记录" : "本周竞赛"}
        </h2>
        <TextLink to="/battle/">PVP 对战资料</TextLink>
      </div>
      <div className="rw-v6-pvp-tables">
        <section
          className="rw-v6-competition rw-v6-ladder"
          aria-labelledby="rw-ladder-title"
        >
          <div className="rw-v6-table-title">
            <h3 id="rw-ladder-title">天梯赛</h3>
            <span>天梯与巅峰赛共享禁宠</span>
          </div>
          <table className="rw-v6-rules-table">
            <caption className="rw-sr-only">本期天梯赛禁用宠物与规则</caption>
            <tbody>
              <tr>
                <th scope="row">生效日期</th>
                <td>
                  {ladder.startDate.replaceAll("-", ".")} 起{" "}
                  <span className="rw-v6-muted">
                    · 本页按 10.09—10.15 期整理
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">
                  禁用宠物 <small>{ladder.bannedPets.length} 只</small>
                </th>
                <td>
                  <ul className="rw-v6-ladder-bans">
                    {ladder.bannedPets.map((pet) => (
                      <li key={pet.name}>
                        <PetName name={pet.name} />
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
              <tr>
                <th scope="row">组队提示</th>
                <td>
                  天梯阵容还需核对魔力值、重复宠物与参赛条件。
                  <br />
                  <Link to="/battle/rules/?mode=ladder">
                    查看完整参赛要求 <ArrowRight size={12} />
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section
          className="rw-v6-competition rw-v6-type-tournament"
          aria-labelledby="rw-type-title"
        >
          <div className="rw-v6-table-title">
            <h3 id="rw-type-title">系别排位赛</h3>
            <span>周五、周二分期列出</span>
          </div>
          <table className="rw-v6-rules-table">
            <caption className="rw-sr-only">
              系别排位赛参赛主属性和禁用宠物
            </caption>
            <tbody>
              {weekly.pvp.typeTournament.periods.map(
                (period, index, periods) => {
                  const current =
                    !historical &&
                    today >= period.startDate &&
                    (!periods[index + 1] ||
                      today < periods[index + 1].startDate);
                  const upcoming = !historical && today < period.startDate;
                  return (
                    <tr key={period.id} className={current ? "is-current" : ""}>
                      <th scope="row">
                        <strong>{shortDate(period.startDate)} 起</strong>
                        <small>
                          {historical
                            ? "历史记录"
                            : current
                              ? "本期"
                              : upcoming
                                ? "下期预告"
                                : "上期记录"}
                        </small>
                        <div className="rw-v6-period-types">
                          {period.types.map((type) => (
                            <TypeBadge key={type} type={type} />
                          ))}
                        </div>
                        <span className="rw-v6-type-names">
                          {period.types.join(" / ")}
                        </span>
                      </th>
                      <td>
                        <div className="rw-v6-ban-label">
                          禁用宠物 <small>{period.bannedPets.length} 只</small>
                        </div>
                        <InlineBans bannedPets={period.bannedPets} />
                        <Link
                          className="rw-v6-period-link"
                          to={"/pets/?pvp=type&period=" + period.startDate}
                        >
                          筛选本期主属性 <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </section>
      </div>
      <div className="rw-v6-footnote">
        <span>按参赛主属性判断；公告仅给日期，切换当天请核对游戏内规则。</span>
        <a href={weekly.sources[0].url} target="_blank" rel="noreferrer">
          本期更新公告 <ExternalLink size={12} />
        </a>
      </div>
    </section>
  );
}

function WeeklyActivities({ today }) {
  const historical = today >= weekly.edition.reviewDueDate;
  const ending = weekly.events.filter((event) => event.category === "ending");
  const dueToday = ending.filter((event) => event.endDate === today);
  const nextDate = new Date(Date.parse(today + "T00:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  const dueTomorrow = ending.filter((event) => event.endDate === nextDate);
  const reminderEvents = dueToday.length ? dueToday : dueTomorrow;
  const groups = [
    {
      id: "new",
      title: "本期新增",
      hint: "10 月 9 日更新",
      events: weekly.events.filter((event) =>
        ["new", "new_permanent"].includes(event.category),
      ),
    },
    {
      id: "continuing",
      title: historical ? "当期延续" : "继续开放",
      hint: historical ? "当期延续记录" : "仍可参与的活动",
      events: weekly.events.filter((event) => event.category === "continuing"),
    },
    {
      id: "ending",
      title: historical ? "本期已结束" : "即将过期",
      hint: "10 月 15 日 · 周四结束",
      events: ending,
    },
  ];
  return (
    <section
      className="rw-v6-weekly-activities"
      aria-labelledby="rw-weekly-events-title"
    >
      <div className="rw-section-head rw-v6-heading">
        <h2 id="rw-weekly-events-title">
          <CalendarDays size={19} />
          {historical ? "本期活动记录" : "本周活动"}
        </h2>
        <TextLink to="/events/">全部活动与获取</TextLink>
      </div>
      {!historical && reminderEvents.length > 0 && (
        <div className="rw-v6-ending-alert" role="status">
          <Clock3 size={17} />
          <div>
            <strong>
              {dueToday.length
                ? `今天是周四，这 ${dueToday.length} 项活动将在今日结束。`
                : `这 ${dueTomorrow.length} 项活动将在明天（周四）结束。`}
            </strong>
            <span>
              {reminderEvents.map((event) => event.name).join("、")}
              。请先确认奖励是否已领取；公告未公布精确结束时刻。
            </span>
          </div>
          <a
            href="#rw-ending-events"
            onClick={(event) => {
              event.preventDefault();
              document.getElementById("rw-ending-events")?.scrollIntoView({
                behavior: window.matchMedia?.(
                  "(prefers-reduced-motion: reduce)",
                ).matches
                  ? "auto"
                  : "smooth",
                block: "start",
              });
            }}
          >
            查看到期活动 <ArrowRight size={14} />
          </a>
        </div>
      )}
      <div className="rw-v6-event-columns">
        {groups.map((group) => (
          <section
            key={group.id}
            id={group.id === "ending" ? "rw-ending-events" : undefined}
            className={"rw-v6-event-column " + group.id}
            aria-labelledby={"rw-activity-" + group.id}
          >
            <header>
              <h3 id={"rw-activity-" + group.id}>
                {group.title}
                <span>{group.events.length}</span>
              </h3>
              <small>{group.hint}</small>
            </header>
            <ul>
              {group.events.map((event) => (
                <li key={event.slug}>
                  <Link to={"/events/" + event.slug + "/"}>
                    <strong>{event.name}</strong>
                    <span
                      className={
                        "rw-v6-event-date " +
                        (group.id === "ending" ? "ending" : "")
                      }
                    >
                      {event.endDate
                        ? "至 " + shortDate(event.endDate)
                        : "长期"}
                    </span>
                  </Link>
                  <p>
                    {event.rewardSummary ||
                      event.rewards
                        .map(
                          (reward) =>
                            reward.name +
                            (reward.kind === "evolution_qualification"
                              ? "进化资格"
                              : ""),
                        )
                        .join("、")}
                  </p>
                  <small>{event.map}</small>
                </li>
              ))}
            </ul>
            {group.id === "ending" && (
              <p className="rw-v6-column-note">
                历史活动也可在宠物图鉴的“获取历史”中追溯。
              </p>
            )}
          </section>
        ))}
      </div>
      <div className="rw-v6-footnote">
        <span>活动按周五更新分期；“即将过期”由已核对的截止日期整理。</span>
        <a
          href="https://news.4399.com/luoke/xinwengonggao/202609-03-1015096.html"
          target="_blank"
          rel="noreferrer"
        >
          到期活动公告 <ExternalLink size={12} />
        </a>
      </div>
    </section>
  );
}

export default function HomePage() {
  const dimoArt = useBaseUrl(
    pets.find((pet) => pet.slug === "dimo")?.image || "/",
  );
  const [today, setToday] = useState(weekly.asOf);
  useEffect(() => {
    let timer;
    function refresh() {
      setToday(chinaDate());
      clearTimeout(timer);
      const now = Date.now(),
        chinaNow = new Date(now + 8 * 60 * 60 * 1000);
      const nextMidnight =
        Date.UTC(
          chinaNow.getUTCFullYear(),
          chinaNow.getUTCMonth(),
          chinaNow.getUTCDate() + 1,
        ) -
        8 * 60 * 60 * 1000;
      timer = setTimeout(refresh, Math.max(1000, nextMidnight - now + 1000));
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const historical = today >= weekly.edition.reviewDueDate;
  return (
    <div className="rw-home-v6">
      <header className="rw-v6-welcome rw-v7-welcome">
        <WelcomeBackdrop />
        <div className="rw-v7-welcome-copy">
          <span className="rw-v7-welcome-label">
            <Sparkles size={14} /> 玩家共建 · 页游资料
          </span>
          <h1>洛克王国页游百科</h1>
          <p>查阅宠物、技能、活动与对战机制。由玩家共同记录与修订。</p>
          <nav aria-label="新读者与贡献入口">
            <Link to="/guides/returning/">
              <BookOpen size={14} /> 回归指南
            </Link>
            <Link to="/help/contributing/">
              <NotebookPen size={14} /> 我也来编辑
            </Link>
          </nav>
        </div>
        <div className="rw-v7-welcome-art" aria-hidden="true">
          <img src={dimoArt} alt="" width="150" height="150" decoding="async" />
          <span>一起探索，一起记录</span>
        </div>
        <a className="rw-welcome-source-v71" href="https://17roco.qq.com/" target="_blank" rel="noreferrer" title="背景使用洛克王国页游官网原图，未经重绘">
          页游官网原图 <ExternalLink size={10} />
        </a>
      </header>
      <nav className="rw-v6-portal-index" aria-label="百科分类">
        {[
          ["/pets/", "宠物图鉴", "属性 · 组别 · 筛选"],
          ["/skills/", "技能与血脉", "参数 · 条件 · 分支"],
          ["/mechanics/", "战斗机制", "时序 · 伤害 · 效果关系"],
          ["/pve/", "PVE 指南", "副本 · 门槛 · 通关"],
          ["/adventure/", "冒险资料", "地图 · 人物 · 任务"],
          ["/tools/", "计算工具", "伤害 · 能力 · 对比"],
        ].map(([to, title, description]) => (
          <Link key={to} to={to} className={"rw-portal-" + to.split("/")[1]}>
            <ColorIcon kind={to.split("/")[1]} size={25} />
            <div>
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
          </Link>
        ))}
      </nav>
      <div className={"rw-v6-edition " + (historical ? "is-historical" : "")}>
        <span>
          <CalendarDays size={15} />
          <strong>{historical ? "历史周更快照" : "本期周更"}</strong>2026 /{" "}
          {weekly.edition.displayRange}
        </span>
        <span>
          {historical ? "本期已过复核日期，等待更新" : "活动与禁赛已按公告核对"}{" "}
          · 10.10 核对
        </span>
      </div>
      <WeeklyPvp today={today} />
      <WeeklyActivities today={today} />
      <div className="rw-v6-reference-grid">
        <Section
          title="宠物图鉴"
          aside={<TextLink to="/pets/">打开完整筛选</TextLink>}
        >
          <div className="rw-home-petgrid">
            {["haifu", "bishui", "moshen", "zhuque", "sailemu", "dimo"].map(
              (slug) => (
                <PetCard
                  key={slug}
                  pet={pets.find((pet) => pet.slug === slug)}
                />
              ),
            )}
          </div>
          <div className="rw-reference-caption">
            <span>已收录条目选读</span>
            <Link to="/tools/compare/">
              <GitCompareArrows size={14} /> 六维种族值对比
            </Link>
          </div>
        </Section>
        <section className="rw-v6-reader-column">
          <div className="rw-section-head">
            <h2>机制与攻略</h2>
            <TextLink to="/mechanics/">机制目录</TextLink>
          </div>
          <Link className="rw-relations-callout" to="/mechanics/relations/">
            <span>效果关系查询</span>
            <h3>已有的效果，如何与新效果相互作用？</h3>
            <p>从来源、施加顺序和条件开始，查询覆盖、共存与解除的实测记录。</p>
            <strong>
              打开效果对照 <ArrowRight size={15} />
            </strong>
          </Link>
          <ul className="rw-v6-reading-list">
            {[
              ["/mechanics/timing/", "行动与结算时序"],
              ["/mechanics/weather/", "天气、环境与替换"],
              ["/pve/", "PVE 副本与挑战攻略"],
              ["/tools/damage/", "威力伤害计算器"],
              ["/tools/stats/", "能力计算器"],
            ].map(([to, label]) => (
              <li key={to}>
                <Link to={to}>
                  {label}
                  <ArrowRight size={13} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="rw-v6-community">
        <div>
          <NotebookPen size={21} />
          <div>
            <h2>一起完善这份百科</h2>
            <p>补充获取历史、纠正技能条件，或提交一组可以复现的对战记录。</p>
          </div>
        </div>
        <nav>
          <Link to="/help/contributing/">
            <BookOpen size={15} />
            贡献指南
          </Link>
          <Link to="/community/">
            <Shield size={15} />
            待完善任务
          </Link>
          <Link to="/edit/">
            开始编辑 <ArrowRight size={14} />
          </Link>
        </nav>
      </section>
    </div>
  );
}
