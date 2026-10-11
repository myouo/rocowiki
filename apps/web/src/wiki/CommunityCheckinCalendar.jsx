import React from "react";
import { useHistory } from "@docusaurus/router";
import { Check, ChevronLeft, ChevronRight, CalendarDays, Flame } from "lucide-react";
import { addDays, chinaDay, checkinCalendar, isCalendarDay, shiftCalendarDay } from "./communitySocialModel";

export function CheckinWeekStrip({ state, actorId, now }) {
  const today = chinaDay(now), records = new Set(state.checkins.filter(row => row.actorId === actorId).map(row => row.day));
  return <div className="rw-checkin-week-v72 rw-checkin-strip-v73" aria-label="最近七天签到记录">{Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)).map(day => <div key={day} className={`${records.has(day) ? "is-checked" : ""} ${day === today ? "is-today" : ""}`} aria-label={`${day} ${records.has(day) ? "已签到" : day === today ? "待签到" : "未签到"}`}>
    <span>{day === today ? "今天" : day.slice(5).replace("-", "/")}</span><i>{records.has(day) ? <Check size={15} /> : <span />}</i><small>{records.has(day) ? "已签到" : day === today ? "待签到" : "未签到"}</small>
  </div>)}</div>;
}

export default function CommunityCheckinCalendar({ state, actorId, now, query }) {
  const history = useHistory();
  const view = query?.get?.("calendar") === "week" ? "week" : "month";
  const requestedDay = query?.get?.("date"), today = chinaDay(now);
  const day = isCalendarDay(requestedDay) ? requestedDay : today;
  const calendar = checkinCalendar(state, actorId, { view, day, now });
  const navigate = (nextView, nextDay) => {
    const search = new URLSearchParams({ tab: "honors", view: "checkin", calendar: nextView });
    if (nextDay !== today) search.set("date", nextDay);
    history.push(`/account/?${search}`);
  };
  const nextDay = shiftCalendarDay(day, view, 1);
  const previousDay = shiftCalendarDay(day, view, -1);
  const nextCalendar = checkinCalendar(state, actorId, { view, day: nextDay, now });
  return <section className={`rw-checkin-calendar-v73 is-${view}`} aria-label="签到日历" data-calendar-view={view}>
    <div className="rw-calendar-heading-v73"><h4><CalendarDays size={16} />签到日历</h4><div className="rw-calendar-views-v73" aria-label="签到日历视图">{[["week", "周视图"], ["month", "月视图"]].map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} className={view === value ? "is-active" : ""} onClick={() => navigate(value, day)}>{label}</button>)}</div></div>
    <div className="rw-calendar-navigation-v73"><button type="button" disabled={!isCalendarDay(previousDay)} aria-label={view === "week" ? "上一周" : "上个月"} onClick={() => navigate(view, previousDay)}><ChevronLeft size={17} /></button><strong aria-live="polite">{calendar.label}</strong><button type="button" disabled={!isCalendarDay(nextDay) || nextCalendar.start > today || (view === "month" && nextDay.slice(0, 7) > today.slice(0, 7))} aria-label={view === "week" ? "下一周" : "下个月"} onClick={() => navigate(view, nextDay)}><ChevronRight size={17} /></button>{!calendar.isCurrent && <button type="button" className="rw-calendar-today-v73" onClick={() => navigate(view, today)}>回到{view === "week" ? "本周" : "本月"}</button>}</div>
    <div className="rw-calendar-weekdays-v73" aria-hidden="true">{["一", "二", "三", "四", "五", "六", "日"].map(label => <span key={label}>{label}</span>)}</div>
    <div className="rw-calendar-days-v73">{calendar.days.map(record => <div key={record.day} data-calendar-day={record.day} data-in-month={record.inMonth} className={`${record.checked ? "is-checked" : ""} ${record.today ? "is-today" : ""} ${record.future ? "is-future" : ""} ${view === "month" && !record.inMonth ? "is-other-month" : ""}`} aria-label={`${record.day}${record.today ? "，今天" : ""}，${record.checked ? `已签到${record.amount !== null ? `，获得 ${record.amount} 枚印记` : ""}` : record.future ? "尚未到来" : record.today ? "待签到" : "未签到"}${record.streakBonus ? `，含 ${record.streakBonus} 枚连签奖励` : ""}`}>
      <span>{record.date}</span><i>{record.checked ? <Check size={17} /> : <span />}</i><small>{record.checked ? record.amount !== null ? `+${record.amount} 枚` : "已签到" : record.today ? "今天" : record.future ? "待到来" : "未签到"}</small>{record.streakBonus > 0 && <b title="包含连续七天额外奖励"><Flame size={11} /></b>}
    </div>)}</div>
    <div className="rw-calendar-summary-v73"><span>{view === "month" ? "本月" : "这周"}签到 <strong>{calendar.checkedCount}</strong> 天 · 入账 <strong>{calendar.totalReward}</strong> 枚</span><small>连签跨周、跨月持续累计</small></div>
  </section>;
}
