import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import { ArrowRight, Award, BookOpen, CalendarCheck2, Check, CheckCircle2, ChevronRight, CircleHelp, Coins, Copy, FileCheck2, Flame, Gift, Heart, History, Info, Medal, MessageCircle, RefreshCw, Sparkles, Trophy, Wallet } from "lucide-react";
import { ProfileAvatar } from "./AccountIdentity";
import HonorSymbol from "./HonorSymbols";
import CustomSelect from "./Select";
import CommunityCheckinCalendar, { CheckinWeekStrip } from "./CommunityCheckinCalendar";
import {
  ACHIEVEMENTS, HONOR_ITEMS, CURRENCY_NAME, RANK_METRICS, RANK_PERIODS,
  chinaDay, addDays, periodBounds, checkinSummary, influenceStats, walletBalance,
  earnedAchievements, rankCommunity, makeRankingExample, getSubmissionAuthorIdentity,
} from "./communitySocialModel";
import "./CommunityHonors.css";

export function useCommunityClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return now;
}
const formatAt = value => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const identityId = (profile, social) => profile.uuid || social.identity.uuid;
function FeedbackMessage({ message }) {
  return message?.text ? <p className={`rw-social-message-v72 ${message.ok ? "is-success" : "is-error"}`} role="status">{message.ok ? <CheckCircle2 size={15} /> : <Info size={15} />}{message.text}</p> : null;
}
export function StorageNotice({ social }) {
  return social.error ? <div className="rw-social-storage-v72" role="alert"><Info size={18} /><p>{social.error}</p><button type="button" className="cm-button" onClick={social.refresh}><RefreshCw size={14} />重试读取</button></div> : null;
}

export function ProfileSerial({ uuid, storageError = "" }) {
  const [message, setMessage] = useState("");
  const input = useRef(null);
  const copy = async () => {
    if (!uuid || storageError) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(uuid);
      else {
        input.current?.focus(); input.current?.select();
        if (!document.execCommand?.("copy")) throw new Error("copy unavailable");
      }
      setMessage("UUID 已复制。");
    } catch { input.current?.focus(); input.current?.select(); setMessage("请复制已选中的 UUID。"); }
  };
  return <div className="rw-profile-serial-v72">
    <label htmlFor="rw-profile-uuid">身份标识 <span>UUID</span></label>
    <div><input id="rw-profile-uuid" ref={input} value={uuid || "正在生成身份标识…"} readOnly aria-describedby="rw-profile-uuid-note" /><button type="button" className="cm-button" disabled={!uuid || Boolean(storageError)} onClick={copy}><Copy size={14} />复制</button></div>
    <p id="rw-profile-uuid-note">用于稳定关联投稿、评论与记录，不表示注册先后。修改昵称或头像不会改变 UUID；当前标识保存在本机。</p>
    {storageError && <small className="cm-inline-error">UUID 尚未确认保存，请先重试。</small>}
    <span className="rw-profile-serial-message-v72" role="status">{message}</span>
  </div>;
}

function CheckinCard({ social, profile, now, compact = false, onHonors, query }) {
  const actorId = identityId(profile, social);
  const summary = checkinSummary(social.state, actorId, now);
  const [message, setMessage] = useState(null);
  const currentDay = chinaDay(now);
  useEffect(() => setMessage(null), [currentDay]);
  const nextStreak = summary.checkedToday ? summary.current : summary.lastDay === addDays(summary.today, -1) ? summary.current + 1 : 1;
  const todayReward = social.state.ledger.find(row => row.actorId === actorId && row.kind === "checkin" && row.ref === summary.today)?.amount;
  const remaining = summary.checkedToday ? 7 - (summary.current % 7) : 7 - ((nextStreak - 1) % 7);
  const submit = () => { const result = social.act({ type: "check-in" }); setMessage({ ok: result.ok, text: result.message }); };
  return <section className={`rw-checkin-card-v72 ${compact ? "is-compact" : ""}`} aria-label="每日签到" data-no-editor>
    <div className="rw-checkin-heading-v72"><span className="rw-social-section-icon-v72 sun"><CalendarCheck2 size={23} /></span><div><h3>{summary.checkedToday ? "今天也来王国看看" : "每天留下一枚足迹"}</h3><p>{summary.today} · 北京时间</p></div><span className="rw-social-local-tag">本机签到</span></div>
    <div className="rw-checkin-body-v72"><div className="rw-checkin-numbers-v72"><div><strong>{summary.current}<small>天</small></strong><span><Flame size={14} />当前连签</span></div><div><strong>{summary.total}<small>天</small></strong><span>累计签到</span></div><div><strong>{summary.longest}<small>天</small></strong><span>最长连签</span></div></div><button type="button" className="cm-button rw-checkin-button-v72" disabled={!social.ready || !social.identity.persisted || Boolean(social.error) || summary.checkedToday} onClick={submit}>{summary.checkedToday ? <CheckCircle2 size={18} /> : <CalendarCheck2 size={18} />}{summary.checkedToday ? "今日已签到" : "签到 · 3–7 印记"}</button></div>
    {summary.checkedToday && Number.isInteger(todayReward) && <p className="rw-checkin-reward-v73"><Coins size={14} />今天已获得 <strong>{todayReward}</strong> 枚印记，已存入账本。</p>}
    {compact ? <CheckinWeekStrip state={social.state} actorId={actorId} now={now} /> : <CommunityCheckinCalendar state={social.state} actorId={actorId} now={now} query={query} />}
    <p className="rw-checkin-note-v72">每日随机获得 3–7 枚，各数量机会相同；每连续 7 天额外 +5 枚。{!summary.checkedToday && nextStreak % 7 === 0 ? "今天签到即可领取额外奖励。" : summary.checkedToday && summary.current % 7 === 0 ? "本次连签奖励已入账。" : `距离下一次连签奖励还需 ${remaining} 天。`}</p>
    <FeedbackMessage message={message} />
    {onHonors && <button type="button" className="rw-social-text-link-v72" onClick={onHonors}>查看签到、印记与徽章<ArrowRight size={14} /></button>}
  </section>;
}

export function CommunityOverview({ social, profile, submissions, onHonors, onActivity }) {
  const now = useCommunityClock(), actorId = identityId(profile, social);
  const stats = influenceStats(social.state, actorId, submissions, now);
  const metrics = [
    { id: "contributions", icon: FileCheck2, label: "已发布贡献", tone: "sky", action: () => onActivity("contributions") },
    { id: "guideLikes", icon: Heart, label: "攻略被点赞", tone: "rose", action: () => onActivity("guideLikes") },
    { id: "commentLikes", icon: MessageCircle, label: "评论被点赞", tone: "lilac", action: () => onActivity("commentLikes") },
    { id: "comments", icon: BookOpen, label: "参与讨论", tone: "mint", action: () => onActivity("comments") },
  ];
  return <div className="rw-community-overview-v72" data-no-editor>
    <StorageNotice social={social} />
    <section className="rw-influence-v72" aria-label="我的社区影响力"><div className="rw-social-section-heading-v72"><div><h2>我的社区足迹</h2><p>每一次认真整理和讨论，都有自己的记录。</p></div><span className="rw-social-local-tag">本机记录</span></div><div className="rw-influence-grid-v72">{metrics.map(({ id, icon: Icon, label, tone, action }) => <button type="button" key={id} onClick={action} className={tone}><Icon size={21} /><strong>{stats[id]}</strong><span>{label}</span><ChevronRight size={14} /></button>)}</div><p className="rw-social-footnote-v72">攻略点赞、评论点赞与 Counter 赞成票分别统计。示例记录、未署名旧稿和未发布修订不计入影响力。</p></section>
    <div className="rw-community-home-grid-v72"><CheckinCard social={social} profile={profile} now={now} compact onHonors={onHonors} /><section className="rw-wallet-teaser-v72"><span className="rw-social-section-icon-v72 lilac"><Coins size={24} /></span><p>我的{CURRENCY_NAME}</p><strong>{walletBalance(social.state, actorId)}<small>枚</small></strong><span>兑换纪念徽章和头像框，让名片多一点自己的颜色。</span><button type="button" className="cm-button" onClick={onHonors}>打开社区荣誉<ArrowRight size={15} /></button></section></div>
  </div>;
}

function WalletLedger({ state, actorId }) {
  const [showAll, setShowAll] = useState(false);
  const rows = state.ledger.filter(row => row.actorId === actorId).slice().reverse();
  let rolling = walletBalance(state, actorId);
  const withBalance = rows.map(row => { const balance = rolling; rolling -= row.amount; return { ...row, balance }; });
  return <section className="rw-honor-paper-v72" aria-label="印记收支明细"><div className="rw-social-section-heading-v72"><div><h3><History size={18} />印记收支</h3><p>签到与兑换各记一笔，余额变化可以逐项核对。</p></div><span className="rw-social-local-tag">{rows.length} 笔</span></div>{rows.length ? <><div className="rw-social-table-wrap-v72"><table className="rw-ledger-table-v72"><thead><tr><th>事项</th><th>印记变化</th><th>余额</th><th>时间 · 北京</th></tr></thead><tbody>{withBalance.slice(0, showAll ? undefined : 8).map(row => <tr key={row.id}><td><span className="rw-ledger-icon-v72">{row.kind === "checkin" ? <CalendarCheck2 size={16} /> : <Gift size={16} />}</span>{row.label}</td><td className={row.amount > 0 ? "is-credit" : "is-debit"}>{row.amount > 0 ? "+" : ""}{row.amount}</td><td>{row.balance}</td><td>{formatAt(row.at)}</td></tr>)}</tbody></table></div>{rows.length > 8 && <button type="button" className="rw-social-text-link-v72" onClick={() => setShowAll(value => !value)}>{showAll ? "收起明细" : `查看全部 ${rows.length} 笔`}</button>}</> : <div className="rw-social-empty-v72"><Wallet size={26} /><strong>还没有收支记录</strong><p>完成今天的签到，就能收到第一笔洛克印记。</p></div>}</section>;
}

function BadgeCabinet({ social, profile, submissions, now }) {
  const actorId = identityId(profile, social), balance = walletBalance(social.state, actorId);
  const earned = earnedAchievements(social.state, actorId, submissions, now);
  const owned = new Set(social.state.purchases.filter(row => row.actorId === actorId).map(row => row.itemId));
  const equipped = social.state.equipped[actorId] || {};
  const [message, setMessage] = useState(null);
  const perform = action => { const result = social.act(action); setMessage({ ok: result.ok, text: result.message }); };
  return <div className="rw-honor-stack-v72">
    <section className="rw-honor-paper-v72"><div className="rw-social-section-heading-v72"><div><h3><Gift size={19} />王国纪念柜</h3><p>喜欢的纪念物只需兑换一次，佩戴可以随时切换。</p></div><span className="rw-social-balance-chip-v72"><Coins size={16} />{balance} 枚可用</span></div><FeedbackMessage message={message} /><div className="rw-honor-shop-grid-v72">{HONOR_ITEMS.map(item => {
      const isOwned = owned.has(item.id), slot = item.kind === "frame" ? "frame" : "badge", wearing = equipped[slot] === item.id;
      return <article key={item.id} className={`rw-honor-item-v72 ${item.tone}`}><div className="rw-honor-item-art-v72">{item.kind === "frame" ? <ProfileAvatar avatar={profile.avatar} size={64} frame={item.id} /> : <HonorSymbol item={item} size={31} />}<span>{item.kind === "frame" ? "头像框" : "展示徽章"}</span></div><h4>{item.title}</h4><p>{item.description}</p><div className="rw-honor-item-action-v72">{isOwned ? <><span className="rw-honor-owned-v72"><Check size={13} />已拥有</span><button type="button" className={`cm-button ${wearing ? "is-equipped" : ""}`} disabled={Boolean(social.error)} onClick={() => perform({ type: "equip", slot, itemId: wearing ? "" : item.id })}>{wearing ? "取消佩戴" : "佩戴"}</button></> : <><span><Coins size={15} />{item.price} 枚</span><button type="button" className="cm-button" disabled={!social.ready || Boolean(social.error) || balance < item.price} onClick={() => perform({ type: "redeem", itemId: item.id })}>{balance < item.price ? `还差 ${item.price - balance} 枚` : "兑换"}</button></>}</div></article>;
    })}</div><p className="rw-social-footnote-v72">兑换只改变外观。洛克印记不能购买点赞、排名权重、内容可信度或编辑权限，消费也不会减少历史贡献。</p></section>
    <section className="rw-honor-paper-v72"><div className="rw-social-section-heading-v72"><div><h3><Medal size={19} />成长徽章</h3><p>用真实记录解锁的纪念，不需要消费印记。</p></div></div><div className="rw-achievement-grid-v72">{ACHIEVEMENTS.map(item => {
      const unlocked = earned.some(row => row.id === item.id), wearing = equipped.badge === item.id;
      return <article key={item.id} className={unlocked ? "is-unlocked" : "is-locked"}><HonorSymbol item={item} size={24} /><div><h4>{item.title}</h4><p>{item.description}</p></div><button type="button" className="cm-button" disabled={!unlocked || Boolean(social.error)} onClick={() => perform({ type: "equip", slot: "badge", itemId: wearing ? "" : item.id })}>{!unlocked ? "尚未达成" : wearing ? "取消佩戴" : "佩戴"}</button></article>;
    })}</div></section>
  </div>;
}

function RankingBoard({ social, profile, submissions, now }) {
  const [metric, setMetric] = useState("checkins"), [period, setPeriod] = useState("week"), [sample, setSample] = useState(false);
  const actorId = identityId(profile, social);
  const data = useMemo(() => {
    if (sample) return makeRankingExample(now);
    const people = new Map();
    if (actorId) people.set(actorId, { uuid: actorId, nickname: profile.nickname || "我 · 未设置昵称", avatar: profile.avatar || "dimo" });
    submissions.forEach(row => { const identity = getSubmissionAuthorIdentity(row); if (identity && !people.has(identity.uuid)) people.set(identity.uuid, identity); });
    social.state.comments.forEach(row => { if (!people.has(row.authorId)) people.set(row.authorId, { uuid: row.authorId, nickname: row.author, avatar: row.avatar }); });
    return { state: social.state, participants: [...people.values()], submissions };
  }, [sample, now, actorId, profile.nickname, profile.avatar, submissions, social.state]);
  const selectedMetric = RANK_METRICS.find(row => row.id === metric);
  const ranks = rankCommunity({ ...data, metric, period, now });
  const bounds = periodBounds(period, now);
  const mine = ranks.find(row => row.uuid === actorId);
  const meChecked = checkinSummary(social.state, actorId, now);
  return <section className={`rw-honor-paper-v72 rw-ranking-v72 ${sample ? "is-sample" : ""}`} aria-label="社区排行榜">
    <div className="rw-social-section-heading-v72"><div><h3><Trophy size={20} />社区排行榜</h3><p>{sample ? "以下人物和成绩均为示例，用于查看榜单的排列。" : "根据此浏览器内保存的有效记录计算，尚未连接公共榜单。"}</p></div><span className="rw-social-local-tag">{sample ? "虚构示例 · 不计入账户" : "本机记录"}</span></div>
    <div className="rw-ranking-sources-v72" aria-label="榜单数据范围"><button type="button" aria-pressed={!sample} className={!sample ? "is-active" : ""} onClick={() => setSample(false)}>我的本机记录</button><button type="button" aria-pressed={sample} className={sample ? "is-active" : ""} onClick={() => setSample(true)}>查看示例榜单</button></div>
    <div className="rw-ranking-controls-v72"><label><span>排名领域</span><CustomSelect value={metric} onChange={setMetric} options={RANK_METRICS.map(row => ({ value: row.id, label: row.label }))} ariaLabel="排行榜领域" /></label><div className="rw-ranking-periods-v72" aria-label="榜单周期">{RANK_PERIODS.map(row => <button type="button" key={row.id} className={period === row.id ? "is-active" : ""} aria-pressed={period === row.id} onClick={() => setPeriod(row.id)}>{row.label}</button>)}</div></div>
    <div className="rw-ranking-period-note-v72"><span>{bounds.label}</span><span>北京时间 · 周一开始 · 同分同名次</span></div>
    {ranks.length ? <div className="rw-social-table-wrap-v72"><table className="rw-ranking-table-v72"><thead><tr><th>名次</th><th>贡献者</th><th>{selectedMetric.label}</th></tr></thead><tbody>{ranks.map(row => <tr key={row.uuid} className={row.uuid === actorId && !sample ? "is-me" : ""}><td><span className={`rw-rank-number-v72 rank-${row.rank}`}>{row.rank <= 3 ? <Medal size={18} /> : null}{row.rank}</span></td><td><ProfileAvatar avatar={row.avatar} size={37} /><span>{row.nickname}{row.uuid === actorId && !sample && <small>我</small>}</span></td><td><strong>{row.value}</strong><span>{selectedMetric.unit}</span></td></tr>)}</tbody></table></div> : <div className="rw-social-empty-v72"><Trophy size={28} /><strong>本期还没有相关记录</strong><p>{metric === "checkins" || metric === "streak" ? "完成今天的签到后，这里会出现自己的成绩。" : metric === "guideLikes" ? "有署名的攻略收到其他参与者的点赞后才会入榜。" : "有效投稿发布后，贡献记录会进入对应周期。"}</p></div>}
    {!sample && <div className="rw-rank-my-note-v72"><span>我的本期名次</span><strong>{mine ? `第 ${mine.rank} 名 · ${mine.value} ${selectedMetric.unit}` : "暂无本期成绩"}</strong>{metric === "streak" && <small>当前连签 {meChecked.current} 天 · 历史最长 {meChecked.longest} 天</small>}</div>}
    <p className="rw-social-footnote-v72"><CircleHelp size={15} />{selectedMetric.note}</p>
  </section>;
}

export function CommunityHonors({ social, profile, submissions, query }) {
  const history = useHistory();
  const requestedView = ["checkin", "badges", "rankings"].includes(query?.get?.("view")) ? query.get("view") : "checkin";
  const [view, setViewState] = useState(requestedView);
  useEffect(() => setViewState(requestedView), [requestedView]);
  const setView = next => { setViewState(next); history.push(`/account/?tab=honors&view=${next}`); };
  const now = useCommunityClock(), actorId = identityId(profile, social);
  return <div className="rw-community-honors-v72" data-no-editor>
    <div className="rw-honors-heading-v72"><div><span>王国里的每一份心意</span><h2>社区荣誉</h2><p>签到留下足迹，贡献留下资料，喜欢的徽章留在名片上。</p></div><div><Coins size={23} /><strong>{walletBalance(social.state, actorId)}</strong><span>{CURRENCY_NAME}</span></div></div>
    <StorageNotice social={social} />
    <nav className="rw-honors-tabs-v72" aria-label="社区荣誉分区">{[["checkin", CalendarCheck2, "签到与印记"], ["badges", Award, "徽章与头像框"], ["rankings", Trophy, "社区榜单"]].map(([id, Icon, label]) => <button type="button" key={id} aria-pressed={view === id} className={view === id ? "is-active" : ""} onClick={() => setView(id)}><Icon size={17} />{label}</button>)}</nav>
    {view === "checkin" && <div className="rw-honor-stack-v72"><CheckinCard social={social} profile={profile} now={now} query={query} /><section className="rw-honor-intro-v72"><HonorSymbol item={HONOR_ITEMS[0]} size={32} /><div><h3>把一枚纪念留在名片上</h3><p>攒满 5 枚印记，就能兑换「初见王国」。今天的随机印记会保存在账本里，明天可以继续积攒。</p></div><button type="button" className="cm-button" onClick={() => setView("badges")}>逛逛纪念柜<ArrowRight size={15} /></button></section><WalletLedger state={social.state} actorId={actorId} /><details className="rw-community-rules-v72"><summary><CircleHelp size={16} />签到与印记规则</summary><ul><li>按北京时间每天 00:00 划分，每个身份每天签到一次，不提供补签。</li><li>每天均匀随机获得 3–7 枚洛克印记（平均 5 枚），连续第 7、14、21… 天额外获得 5 枚；签到成功后的奖励固定保存，刷新或再次点击不会重抽。</li><li>连签连续跨周、跨月累计，不在周一或月初清零。周视图方便看近期记录，月视图按照实际月份排列；漏签后重新从 1 天累计，历史总天数与最长纪录保留。</li><li>兑换仅用于徽章和头像框等外观；不按修改行数发币，印记不影响资料可信度、审核权限或榜单分数。</li><li>当前为本机预览，清除浏览器数据会丢失记录。上线后由服务端统一校时、验证身份和记录账本。</li></ul></details></div>}
    {view === "badges" && <BadgeCabinet social={social} profile={profile} submissions={submissions} now={now} />}
    {view === "rankings" && <RankingBoard social={social} profile={profile} submissions={submissions} now={now} />}
    <div className="rw-community-next-v72"><Sparkles size={18} /><div><strong>让第一份贡献有个好起点</strong><p>从熟悉的宠物、历史活动或一条待核验的机制开始。找到一项小任务，整理资料、补上出处，再提交给大家一起完善。</p></div><Link to="/community/">参与共建<ArrowRight size={14} /></Link></div>
  </div>;
}
