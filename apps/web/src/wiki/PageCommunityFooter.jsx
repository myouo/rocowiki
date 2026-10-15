import React, { useEffect, useRef, useState } from "react";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { UsersRound, Heart, MessageCircle, Send, CircleHelp, NotebookPen, ArrowRight } from "lucide-react";
import { useCommunitySocial } from "./communitySocialStore";
import { COMMUNITY_STORAGE_KEY } from "./communitySocialModel";
import { ProfileAvatar } from "./AccountIdentity";
import ReadingMarkdown from "./editing/ReadingMarkdown";
import EntityTextarea from "./EntityTextarea";
import { getSearchRecords } from "./data";
import { canonicalPageKey, commentAnchor, pageMaintainers } from "./pageCommunityModel";
import {useWikiRuntime} from "./runtime/useWikiRuntime";
import {useDemoSubmissions} from "./community/useDemoSubmissions";
import ServerPageCommunity from '../features/community/ServerPageCommunity';
import ServerGuideLike from '../features/community/ServerGuideLike';

let pageTitles;
function publicPageTitle(page) {
  pageTitles ||= new Map(getSearchRecords().map(row => [canonicalPageKey(row.to), row.title]));
  return pageTitles.get(page) || '本页';
}

function DemoGuideLikeButton({ targetId, title, href, authorId = "", author }) {
  const { state, identity, ready, act } = useCommunitySocial();
  const [notice, setNotice] = useState("");
  const likes = state.likes.filter(row => row.targetType === "guide" && row.targetId === targetId);
  const liked = likes.some(row => row.actorId === identity.uuid), own = !!authorId && authorId === identity.uuid;
  return <div className="rw-guide-appreciation-v72"><button type="button" disabled={!ready || own} aria-pressed={liked} title={own ? "这是你提交的方案，不能给自己点赞" : "这份攻略对我有帮助"} onClick={() => {const result = act({type:"toggle-like",targetType:"guide",targetId,targetTitle:title,href,authorId}); setNotice(result.ok ? "" : result.message);}}><Heart size={15} fill={liked ? "currentColor" : "none"} />有帮助 <strong>{likes.length}</strong></button>{author && <span>由 {author} 提交</span>}{!authorId && <small>来源整理记录 · 不计入个人获赞</small>}{notice && <small role="status">{notice}</small>}</div>;
}

function DemoPageCommunityFooter() {
  const location = useLocation(), base = useBaseUrl("/");
  const rawPath = base !== "/" && location.pathname.startsWith(base) ? "/" + location.pathname.slice(base.length) : location.pathname;
  const page = canonicalPageKey(rawPath + location.search);
  const submissions = useDemoSubmissions();
  const [draft,setDraft] = useState(""), [message,setMessage] = useState("");
  const { state, identity, ready, error, act } = useCommunitySocial();
  const discussion = useRef(null);
  const title = publicPageTitle(page);
  useEffect(() => {setDraft(""); setMessage("");}, [page]);
  const { people, unattributed } = pageMaintainers(submissions,page);
  const showDiscussion = !/^\/(account|edit|review|history|feedback|search|not-found)\//.test(page);
  const comments = state.comments.filter(row => row.targetId === page).slice().sort((a,b) => b.at.localeCompare(a.at));
  useEffect(() => {
    let fragment = location.hash?.slice(1) || "";
    try { fragment = decodeURIComponent(fragment); } catch {}
    if (!showDiscussion || !(fragment === "discussion" || fragment.startsWith("comment-"))) return;
    const host = discussion.current, doc = host?.ownerDocument, win = doc?.defaultView;
    if (!host || !win) return;
    host.open = true;
    const frame = win.requestAnimationFrame(() => {
      const target = doc.getElementById(fragment) || host;
      target.scrollIntoView?.({ block: "start", behavior: "auto" });
    });
    return () => win.cancelAnimationFrame(frame);
  }, [page, location.hash, showDiscussion, ready, comments.length]);
  function addComment(event) {
    event.preventDefault();
    const result = act({type:"add-comment",targetId:page,targetTitle:title,href:page,body:draft});
    setMessage(result.message || (result.ok ? "评论已保存在本机。" : "评论未保存。"));
    if (result.ok) setDraft("");
  }
  return <section className="rw-page-community-v72" aria-label="本页共建与讨论" data-no-editor>
    <div className="rw-maintainers-v72">
      <div className="rw-maintainers-heading-v72"><div><UsersRound size={20} /><h2>本页维护人员</h2><span>按有效贡献行排序</span></div><Link to="/help/contributing/"><NotebookPen size={14} />参与维护<ArrowRight size={13} /></Link></div>
      {people.length ? <ol className="rw-maintainers-list-v72">{people.map((person,index) => <li key={person.uuid}><span className="rw-maintainer-rank-v72">{index + 1}</span><ProfileAvatar avatar={person.avatar} size={40} /><div><strong title={person.uuid}>{person.nickname}</strong><span>{person.lines} 行 · {person.revisions.length} 次修订</span></div><details><summary>修订记录</summary><ul>{person.revisions.map(row => <li key={row.id}><Link to={`/review/?submission=${encodeURIComponent(row.id)}`}>{row.title}</Link><span> {row.lines} 行</span></li>)}</ul></details></li>)}</ol> : <p className="rw-maintainers-empty-v72">本页暂未记录有明确署名的已发布贡献。完成一次资料修订后，你的署名会出现在这里。</p>}
      <details className="rw-maintainers-method-v72"><summary><CircleHelp size={13} />怎样计算贡献行？</summary><p>只统计已发布修订，按投稿编号去重；去除空行、仅有排版符号的行和纯空白调整，每次修订取新增行与删除行中的较大值。这里展示累计有效修改量，不代表当前正文的逐行所有权，也不用于兑换积分。{unattributed > 0 ? `另有 ${unattributed} 次历史修订尚未关联作者身份，未分配给任何账号。` : ""}</p></details>
    </div>
    {showDiscussion && <details ref={discussion} className="rw-page-discussion-v72" id="discussion"><summary><MessageCircle size={17} /><strong>本页讨论</strong><span>{comments.length} 条评论</span><span className="rw-local-label-v72">本机体验</span></summary><div className="rw-discussion-body-v72">
      <p>补充使用心得、提出疑问，或交流资料依据。输入 / 可关联宠物、技能等条目。</p>
      <form onSubmit={addComment}><EntityTextarea value={draft} onChange={setDraft} ariaLabel="本页评论" rows={3} maxLength={2000} placeholder="说说你的发现，例如这个条件还需要什么证据？" /><div><span>{identity.nickname || "未设置昵称"} · 评论保存在此浏览器</span><button className="rw-button" type="submit" disabled={!ready || !draft.trim() || !!error}><Send size={14} />发表评论</button></div></form>
      {(message || error) && <p role="status">{message || error}</p>}
      <ol className="rw-comments-v72">{comments.map(comment => {const likes = state.likes.filter(row => row.targetType === "comment" && row.targetId === comment.id), liked = likes.some(row => row.actorId === identity.uuid), own = comment.authorId === identity.uuid; return <li key={comment.id} id={commentAnchor(comment.id)}><ProfileAvatar avatar={comment.avatar} size={36} /><div><header><strong>{comment.author || "未设置昵称"}</strong><time dateTime={comment.at}>{new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(comment.at))}</time></header><ReadingMarkdown editHeadings={false} markdown={comment.body} context={{entity:title,returnTo:page}} /><button type="button" disabled={own} aria-pressed={liked} title={own ? "自己的评论不能点赞" : "赞同这条评论"} onClick={() => {const result=act({type:"toggle-like",targetType:"comment",targetId:comment.id});setMessage(result.ok ? "" : result.message);}}><Heart size={13} fill={liked ? "currentColor" : "none"} />{likes.length}{own && <span>我的评论</span>}</button></div></li>;})}</ol>
    </div></details>}
  </section>;
}
export function GuideLikeButton(props) {
  const {demo} = useWikiRuntime();
  return demo ? <DemoGuideLikeButton {...props} /> : <ServerGuideLike targetId={props.targetId} author={props.author}/>;
}
export default function PageCommunityFooter() {
  const {demo} = useWikiRuntime();
  const location = useLocation();
  if (/(?:^|\/)copyright(?:\/en)?\/?$/.test(location.pathname)) return null;
  const page=canonicalPageKey(location.pathname+location.search),title=publicPageTitle(page);
  return demo ? <DemoPageCommunityFooter /> : <ServerPageCommunity title={title} />;
}
