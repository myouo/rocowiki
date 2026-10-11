import React, { useEffect, useState } from "react";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import { ArrowRight, BookOpen, FileCheck2, Heart, History, MessageCircle, UserRound } from "lucide-react";
import { ProfileAvatar } from "./AccountIdentity";
import { StorageNotice, useCommunityClock } from "./CommunityHonors";
import { influenceStats, periodBounds } from "./communitySocialModel";
import { ACTIVITY_VIEWS, ACTIVITY_PERIODS, communityActivityRecords } from "./communityActivityModel";
import CustomSelect from "./Select";
import ReadingMarkdown from "./editing/ReadingMarkdown";

const icons = { guideLikes: Heart, commentLikes: MessageCircle, comments: BookOpen, contributions: FileCheck2 };
const displayAt = value => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));

export default function CommunityActivity({ social, profile, submissions, query }) {
  const history = useHistory(), now = useCommunityClock(), actorId = profile.uuid || social.identity.uuid;
  const view = ACTIVITY_VIEWS.some(item => item.id === query?.get?.("view")) ? query.get("view") : "guideLikes";
  const period = ACTIVITY_PERIODS.some(item => item.value === query?.get?.("period")) ? query.get("period") : "all";
  const selected = ACTIVITY_VIEWS.find(item => item.id === view), Icon = icons[view];
  const stats = influenceStats(social.state, actorId, submissions, now);
  const rows = communityActivityRecords({ state: social.state, actorId, submissions, view, period, now });
  const [limit, setLimit] = useState(20);
  useEffect(() => setLimit(20), [view, period]);
  const navigate = (nextView, nextPeriod = period) => history.push(`/account/?tab=activity&view=${nextView}${nextPeriod === "all" ? "" : `&period=${nextPeriod}`}`);
  return <section className="rw-community-activity-v73" data-activity-view={view} data-no-editor>
    <div className="rw-activity-heading-v73"><span><History size={21} /></span><div><h2>社区足迹</h2><p>从收到的每一份赞同，回到你参与过的资料和讨论。</p></div><Link to="/account/">返回我的首页<ArrowRight size={14} /></Link></div>
    <StorageNotice social={social} />
    <nav className="rw-activity-tabs-v73" aria-label="社区足迹分类">{ACTIVITY_VIEWS.map(item => { const ItemIcon = icons[item.id]; return <button type="button" key={item.id} aria-pressed={view === item.id} className={view === item.id ? "is-active" : ""} onClick={() => navigate(item.id)}><ItemIcon size={16} /><span>{item.label}</span><strong>{stats[item.id]}</strong></button>; })}</nav>
    <div className="rw-activity-records-heading-v73"><div><h3>{selected.label}</h3><p>{rows.length} 条{period === "all" ? "有效记录" : ` · ${periodBounds(period, now).label}`}<span>北京时间 · 最新在前</span></p></div><label><span>记录时间</span><CustomSelect value={period} onChange={value => navigate(view, value)} options={ACTIVITY_PERIODS} ariaLabel="社区足迹时间范围" /></label></div>
    {rows.length ? <ol className="rw-activity-records-v73">{rows.slice(0, limit).map(row => <li key={row.id} data-activity-record={row.id}>
      <div className="rw-activity-avatar-v73">{row.actorAvatar ? <ProfileAvatar avatar={row.actorAvatar} size={38} /> : <span aria-label="未记录头像"><UserRound size={22} /></span>}</div>
      <article><header><div><strong title={`UUID ${row.actorId}`}>{row.actorName}</strong><span>{selected.event}</span></div><time dateTime={row.at}>{displayAt(row.at)}</time></header>
        <h4>{row.href ? <Link to={row.href}>{row.title}<ArrowRight size={13} /></Link> : row.title}</h4>
        {row.body && <div className="rw-activity-excerpt-v73">{view === "contributions" ? <p>{row.body}</p> : <ReadingMarkdown markdown={row.body} context={{ entity: row.title, returnTo: row.href || "/account/?tab=activity" }} editHeadings={false} />}</div>}
        <footer>{row.href ? <Link to={row.href}>{view === "commentLikes" || view === "comments" ? "回到这条讨论" : "查看条目"}<ArrowRight size={13} /></Link> : <span>原条目入口尚未补全</span>}{row.reviewHref && <Link to={row.reviewHref}>查看这次修订<ArrowRight size={13} /></Link>}{view === "comments" && <span><Heart size={13} />收到 {row.receivedCount} 个赞</span>}</footer>
      </article>
    </li>)}</ol> : <div className="rw-social-empty-v72 rw-activity-empty-v73"><Icon size={28} /><strong>{period === "all" ? selected.empty : "这个时间范围还没有记录"}</strong><p>{period === "all" ? selected.note : "可以切换为全部时间，查看之前的参与记录。"}</p>{period === "all" ? <Link className="cm-button" to={selected.href}>{selected.action}<ArrowRight size={14} /></Link> : <button type="button" className="cm-button" onClick={() => navigate(view, "all")}>查看全部时间<ArrowRight size={14} /></button>}</div>}
    {rows.length > limit && <button type="button" className="cm-button rw-activity-more-v73" onClick={() => setLimit(count => count + 20)}>再显示 {Math.min(20, rows.length - limit)} 条记录</button>}
    <p className="rw-social-footnote-v72">{view === "guideLikes" || view === "commentLikes" ? "获赞记录保留最初点赞时间；取消点赞后会从这里移除，重新点赞不会生成重复记录。" : view === "contributions" ? "这里记录已经发布的有效修订。草稿、待审核修订、未署名历史稿和示例不计入。" : "这里汇集自己发表的有效评论，已移除的评论不会继续展示。"} 当前展示此浏览器保存的记录。</p>
  </section>;
}
