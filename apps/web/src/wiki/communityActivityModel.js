import { contributionEntries, receivedLikes, chinaDay, periodBounds } from "./communitySocialModel";
import { commentAnchor, submissionPageKey } from "./pageCommunityModel";

export const ACTIVITY_VIEWS = [
  { id: "guideLikes", label: "攻略被点赞", event: "赞了你的攻略", empty: "攻略还没有收到点赞", note: "其他读者赞同你的攻略时，点赞者、时间和攻略入口会留在这里。", href: "/pve/", action: "看看 PVE 攻略" },
  { id: "commentLikes", label: "评论被点赞", event: "赞了你的评论", empty: "评论还没有收到点赞", note: "在条目底部参与讨论；评论得到其他读者的赞同后，可以从这里回到原讨论。", href: "/mechanics/", action: "浏览战斗机制" },
  { id: "comments", label: "参与讨论", event: "发表了评论", empty: "还没有参与讨论", note: "每篇资料底部都有本页讨论。分享实测、提出疑问，或补充你知道的资料。", href: "/pets/", action: "找一个熟悉的宠物" },
  { id: "contributions", label: "已发布贡献", event: "发布了一份修订", empty: "还没有已发布贡献", note: "已提交的修订通过审核并上线后，会出现在这里。草稿和待审核投稿仍在我的投稿中。", href: "/account/?tab=submissions", action: "查看我的投稿" },
];
export const ACTIVITY_PERIODS = [{ value: "all", label: "全部时间" }, { value: "month", label: "本月" }, { value: "week", label: "本周" }, { value: "day", label: "今天" }];
const safeHref = value => typeof value === "string" && /^\/(?!\/)/.test(value) && !/[\x00-\x1f\\]/.test(value) ? value : "";
const timeAllowed = (at, now) => Number.isFinite(Date.parse(at)) && Date.parse(at) <= new Date(now).getTime();

export function commentEntryHref(comment) {
  const href = safeHref(comment?.href) || safeHref(comment?.targetId);
  return href ? `${href.split("#")[0]}#${commentAnchor(comment.id)}` : "";
}

export function communityActivityRecords({ state, actorId, submissions = [], view = "guideLikes", period = "all", now = new Date() }) {
  submissions = Array.isArray(submissions) ? submissions.filter(row => row && typeof row === "object" && !Array.isArray(row)) : [];
  let rows = [];
  const comments = new Map(state.comments.map(row => [row.id, row]));
  const effectiveLikes = receivedLikes(state, actorId, now);
  const commentLikeCounts = new Map();
  effectiveLikes.forEach(row => { if (row.targetType === "comment") commentLikeCounts.set(row.targetId, (commentLikeCounts.get(row.targetId) || 0) + 1); });
  if (view === "guideLikes" || view === "commentLikes") {
    const type = view === "guideLikes" ? "guide" : "comment";
    rows = effectiveLikes.filter(row => row.targetType === type).map(row => {
      const comment = comments.get(row.targetId);
      return { id: row.id, at: row.at, actorId: row.actorId, actorName: row.actorName || "未记录昵称的读者", actorAvatar: row.actorAvatar || "", title: comment?.targetTitle || row.targetTitle || (comment ? "条目讨论" : "未命名攻略"), body: comment?.body || "", href: comment ? commentEntryHref(comment) : safeHref(row.href), targetId: row.targetId, kind: view };
    });
  } else if (view === "comments") {
    rows = state.comments.filter(row => row.authorId === actorId && timeAllowed(row.at, now)).map(row => ({ id: row.id, at: row.at, actorId, actorName: row.author || "未设置昵称", actorAvatar: row.avatar, title: row.targetTitle || "条目讨论", body: row.body, href: commentEntryHref(row), targetId: row.targetId, kind: view, receivedCount: commentLikeCounts.get(row.id) || 0 }));
  } else if (view === "contributions") {
    const originals = new Map(submissions.map(row => [row.id, row]));
    rows = contributionEntries(submissions).filter(row => row.actorId === actorId && timeAllowed(row.at, now)).map(row => {
      const original = originals.get(row.id);
      const href = original ? submissionPageKey(original) : "";
      const requestedHref = safeHref(original?.editorRequest?.returnTo || original?.sourcePath || original?.returnTo);
      return { id: row.id, at: row.at, actorId, actorName: original?.author || "未设置昵称", actorAvatar: original?.authorAvatar || "", title: original?.target || "未命名条目", body: original?.summary || original?.section || "已发布修订", href: requestedHref && requestedHref.split("#")[0] === href ? requestedHref : href, reviewHref: `/review/?submission=${encodeURIComponent(row.id)}`, section: original?.section || "", targetId: row.id, kind: view };
    });
  }
  const bounds = periodBounds(period, now);
  return rows.filter(row => { const day = chinaDay(row.at); return day >= bounds.start && day < bounds.end; }).sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}
