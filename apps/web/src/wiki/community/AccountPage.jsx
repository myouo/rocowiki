import React, { useEffect, useState } from "react";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import AccountIdentity, { AvatarPicker, normalizeAvatar, GithubMark, RegistrationUid } from "../AccountIdentity";
import { useCommunitySocial } from "../communitySocialStore";
import { CommunityOverview, CommunityHonors, ProfileSerial } from "../CommunityHonors";
import CommunityActivity from "../CommunityActivity";
import { ACTIVITY_VIEWS } from "../communityActivityModel";
import BoundedTextarea from "../BoundedTextarea";
import { ArrowRight, Bookmark, ChevronDown, ChevronRight, CircleAlert, FileClock, FilePenLine, History, Save, UserRound, LockKeyhole, House, Award, X } from "lucide-react";
import { editorHref as sectionEditHref } from "../editing/registry";
import { editHref, formatTime, queryValue } from "./navigation.js";
import { EmptyState, PageHeading, SectionHeading, TextButton } from "./components.jsx";
import { useBookmarks } from "./useBookmarks.js";
import AccountSessionPanel from "../auth/AccountSessionPanel";
import { SubmissionRows } from "./SubmissionList.jsx";

function Account({ workspace, update, query, storageError }) {
  const history = useHistory();
  const allowedTabs = [
    "overview",
    "bookmarks",
    "drafts",
    "submissions",
    "profile",
    "security",
    "honors",
    "activity",
  ];
  const requestedTab = queryValue(query, "tab", "overview");
  const [tab, setTabState] = useState(
    allowedTabs.includes(requestedTab) ? requestedTab : "overview",
  );
  const setTab = (next, view = "") => {
    if (!allowedTabs.includes(next) || (next === tab && !view)) return;
    setTabState(next);
    const validView = next === "honors" ? ["checkin", "badges", "rankings"].includes(view) : next === "activity" && ACTIVITY_VIEWS.some(item => item.id === view);
    history.push("/account/" + (next === "overview" ? "" : "?tab=" + next + (validView ? "&view=" + view : "")));
  };
  const [nickname, setNickname] = useState(workspace.profile.nickname);
  const [bio, setBio] = useState(workspace.profile.bio);
  const [avatar, setAvatar] = useState(normalizeAvatar(workspace.profile.avatar));
  const [profileMessage, setProfileMessage] = useState("");
  const [githubOpen, setGithubOpen] = useState(false);
  const { bookmarks, remove, error: bookmarkError } = useBookmarks();
  const social = useCommunitySocial();
  useEffect(() => {
    setNickname(workspace.profile.nickname);
    setBio(workspace.profile.bio);
    setAvatar(normalizeAvatar(workspace.profile.avatar));
  }, [workspace.profile.nickname, workspace.profile.bio, workspace.profile.avatar]);
  useEffect(() => {
    setTabState(allowedTabs.includes(requestedTab) ? requestedTab : "overview");
  }, [requestedTab]);
  const mySubmissions = workspace.submissions.filter((s) => !s.isExample && (!s.authorId || s.authorId === workspace.profile.uuid));
  const attention = mySubmissions.filter((s) =>
    ["changes_requested", "conflict", "build_failed"].includes(s.status),
  );
  const saveProfile = (event) => {
    event.preventDefault();
    if (nickname.trim().length < 2) {
      setProfileMessage("昵称至少填写 2 个字符。");
      return;
    }
    update((old) => ({
      ...old,
      profile: {
        ...old.profile,
        nickname: nickname.trim().slice(0, 24),
        bio: bio.trim().slice(0, 160),
        avatar: normalizeAvatar(avatar),
      },
    }));
    setProfileMessage("资料已保存在当前浏览器，尚未创建线上账号。");
  };
  const renderDrafts = (compact) =>
    !workspace.drafts.length ? (
      <EmptyState
        icon={FilePenLine}
        title="草稿会保存在这里"
        text="编辑时会自动保存本地草稿。完成前可以离开页面，再回来继续。"
      >
        <Link className="cm-button" to="/community/">
          找一项可以完善的内容
          <ArrowRight size={14} />
        </Link>
      </EmptyState>
    ) : (
      <div className="cm-work-list">
        {workspace.drafts.slice(0, compact ? 3 : 80).map((draft) => (
          <article className="cm-work-row" key={draft.key}>
            <FilePenLine size={19} className="cm-muted-icon" />
            <div className="cm-work-main">
              <Link
                to={
                  draft.editorVersion === 7
                    ? sectionEditHref({
                        ...draft.editorRequest,
                        submission: draft.revisesSubmissionId,
                      })
                    : editHref(
                        draft.target,
                        draft.section,
                        draft.revisesSubmissionId,
                        true,
                      )
                }
              >
                {draft.target}
                <span> / {draft.section}</span>
              </Link>
              <p>{draft.summary || "尚未填写修改摘要"}</p>
              <small>
                {draft.type === "structured" ? "结构化资料" : "受限 Markdown"} ·{" "}
                {formatTime(draft.updatedAt)} 保存于本机
              </small>
            </div>
            <div className="cm-work-status">
              <Link
                to={
                  draft.editorVersion === 7
                    ? sectionEditHref({
                        ...draft.editorRequest,
                        submission: draft.revisesSubmissionId,
                      })
                    : editHref(
                        draft.target,
                        draft.section,
                        draft.revisesSubmissionId,
                        true,
                      )
                }
              >
                继续编辑
                <ChevronRight size={14} />
              </Link>
              <TextButton
                className="cm-subtle-danger"
                onClick={() =>
                  update((old) => ({
                    ...old,
                    drafts: old.drafts.filter((d) => d.key !== draft.key),
                  }))
                }
              >
                删除草稿
              </TextButton>
            </div>
          </article>
        ))}
      </div>
    );
  const renderBookmarks = (compact) =>
    !bookmarks.length ? (
      <EmptyState
        icon={Bookmark}
        title="把常查的资料留在手边"
        text="在词条内点击收藏，即可从这里快速打开。收藏目前保存在这台浏览器中。"
      >
        <Link className="cm-button" to="/pets/">
          浏览宠物图鉴
          <ArrowRight size={14} />
        </Link>
      </EmptyState>
    ) : (
      <div className="cm-bookmark-list">
        {bookmarks.slice(0, compact ? 5 : 100).map((item) => (
          <div key={item.id}>
            <Bookmark size={16} />
            <Link to={item.href}>{item.title}</Link>
            <span>{item.kind}</span>
            <button
              type="button"
              aria-label={`取消收藏${item.title}`}
              onClick={() => remove(item.id)}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    );
  return (
    <>
      <PageHeading
        eyebrow="阅读与贡献"
        title="个人中心"
        description="从上次停下的地方继续，管理收藏、投稿与个人资料。"
        actions={
          <Link className="cm-button" to="/feedback/">
            我的反馈
            <ArrowRight size={15} />
          </Link>
        }
      />
      <AccountSessionPanel />
      <AccountIdentity profile={workspace.profile} social={social.state} submissions={workspace.submissions} onProfile={() => setTab("profile")} onSecurity={() => setTab("security")} onHonors={() => setTab("honors", "badges")} />
      <div className="ev7-account-shell">
        <nav className="ev7-account-nav" aria-label="个人中心分区">
          {[
            ["overview", "我的首页", House],
            ["submissions", "我的投稿", FilePenLine],
            ["bookmarks", "我的收藏", Bookmark],
            ["activity", "社区足迹", History],
            ["honors", "社区荣誉", Award],
            ["profile", "个人资料", UserRound],
            ["security", "账号与安全", LockKeyhole],
          ].map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              className={
                tab === id || (id === "submissions" && tab === "drafts")
                  ? "is-active"
                  : ""
              }
              aria-pressed={
                tab === id || (id === "submissions" && tab === "drafts")
              }
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "drafts" && workspace.drafts.length > 0 && (
                <span>{workspace.drafts.length}</span>
              )}
              {id === "submissions" && attention.length > 0 && <i />}
            </button>
          ))}
        </nav>
        <div className="ev7-account-main">
          {["drafts", "submissions"].includes(tab) && (
            <div className="ev7-account-work-tabs">
              <h2>我的投稿</h2>
              <div className="cm-segmented">
                <button
                  type="button"
                  className={tab === "drafts" ? "is-active" : ""}
                  onClick={() => setTab("drafts")}
                >
                  草稿 <span>{workspace.drafts.length}</span>
                </button>
                <button
                  type="button"
                  className={tab === "submissions" ? "is-active" : ""}
                  onClick={() => setTab("submissions")}
                >
                  已提交 <span>{mySubmissions.length}</span>
                </button>
              </div>
            </div>
          )}
          {tab === "overview" && (
            <>
              <CommunityOverview social={social} profile={workspace.profile} submissions={workspace.submissions} onHonors={() => setTab("honors")} onActivity={(view) => setTab("activity", view)} />
              <div className="cm-account-stats">
                {[
                  [Bookmark, bookmarks.length, "阅读收藏", "bookmarks"],
                  [FilePenLine, workspace.drafts.length, "本地草稿", "drafts"],
                  [
                    FileClock,
                    mySubmissions.length,
                    "我的本地投稿",
                    "submissions",
                  ],
                ].map(([Icon, count, label, key]) => (
                  <button type="button" key={key} onClick={() => setTab(key)}>
                    <Icon size={20} />
                    <span>
                      <strong>{count}</strong>
                      <small>{label}</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
              {attention.length > 0 && (
                <div className="cm-action-note">
                  <CircleAlert size={18} />
                  <span>有 {attention.length} 份本地投稿需要处理。</span>
                  <button type="button" onClick={() => setTab("submissions")}>
                    查看投稿
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
              <div className="cm-account-overview-grid">
                <section className="cm-paper">
                  <SectionHeading icon={FilePenLine} title="继续编辑">
                    <TextButton onClick={() => setTab("drafts")}>
                      全部草稿
                      <ArrowRight size={14} />
                    </TextButton>
                  </SectionHeading>
                  {renderDrafts(true)}
                </section>
                <section className="cm-paper">
                  <SectionHeading icon={Bookmark} title="常用资料">
                    <TextButton onClick={() => setTab("bookmarks")}>
                      全部收藏
                      <ArrowRight size={14} />
                    </TextButton>
                  </SectionHeading>
                  {renderBookmarks(true)}
                </section>
              </div>
              <section className="cm-paper cm-account-recent">
                <SectionHeading icon={FileClock} title="最近投稿">
                  <TextButton onClick={() => setTab("submissions")}>
                    查看全部
                    <ArrowRight size={14} />
                  </TextButton>
                </SectionHeading>
                <SubmissionRows submissions={mySubmissions} compact />
              </section>
            </>
          )}
          {tab === "honors" && <CommunityHonors social={social} profile={workspace.profile} submissions={workspace.submissions} query={query} />}
          {tab === "activity" && <CommunityActivity social={social} profile={workspace.profile} submissions={workspace.submissions} query={query} />}
          {tab === "bookmarks" && (
            <section className="cm-paper">
              <SectionHeading icon={Bookmark} title="我的收藏">
                <span className="cm-count-label">
                  {bookmarks.length} 条 · 本地记录
                </span>
              </SectionHeading>
              {bookmarkError && (
                <p className="cm-inline-error" role="alert">
                  {bookmarkError}
                </p>
              )}
              {renderBookmarks(false)}
            </section>
          )}
          {tab === "drafts" && (
            <section className="cm-paper">
              <SectionHeading icon={FilePenLine} title="待完成的草稿">
                <span className="cm-count-label">
                  {workspace.drafts.length} 份 · 尚未投稿
                </span>
              </SectionHeading>
              {renderDrafts(false)}
            </section>
          )}
          {tab === "submissions" && (
            <section className="cm-paper">
              <SectionHeading icon={FileClock} title="已提交的修订">
                <Link className="cm-inline-link" to="/review/">
                  体验审核示例
                  <ArrowRight size={14} />
                </Link>
              </SectionHeading>
              <p className="cm-section-note">
                审核通过后依次合并、构建与上线；任一阶段失败都保留原始投稿。
              </p>
              <SubmissionRows submissions={mySubmissions} />
            </section>
          )}
          {["profile", "security"].includes(tab) && (
            <div className="cm-profile-grid ev7-settings-grid">
              {tab === "profile" && (
                <form
                  className="cm-paper cm-profile-form"
                  onSubmit={saveProfile}
                >
                  <SectionHeading icon={UserRound} title="个人资料" />
                  <p className="cm-section-note">
                    昵称用于展示贡献署名，简介可以让其他编辑了解你常整理的内容。
                  </p>
                  <section className="rw-registration-profile-v73" aria-label="注册序号说明">
                    <RegistrationUid uid={workspace.profile.uid} />
                    <p>正式注册后，由服务器按注册顺序分配。序号不能修改，改昵称也不会变化。当前本机体验中的待注册状态，会在正式注册后由服务器资料替换。</p>
                    {!workspace.profile.uid && <details><summary>查看注册后的展示样式</summary><RegistrationUid uid="128" example /><p>示例只说明展示方式，不是你的实际注册序号。</p></details>}
                  </section>
                  <ProfileSerial uuid={workspace.profile.uuid} storageError={storageError || social.error} />
                  <AvatarPicker value={avatar} onChange={(value) => { setAvatar(value); setProfileMessage(""); }} />
                  <label className="cm-field">
                    <span>
                      显示昵称 <em>必填</em>
                    </span>
                    <input
                      value={nickname}
                      onChange={(event) => {
                        setNickname(event.target.value);
                        setProfileMessage("");
                      }}
                      maxLength={24}
                      placeholder="2–24 个字符，用于显示贡献署名"
                      autoComplete="off"
                    />
                  </label>
                  <label className="cm-field">
                    <span>个人简介</span>
                    <BoundedTextarea
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                      maxLength={160}
                      rows={3}
                      placeholder="例如：常整理技能机制与历史资料"
                    />
                    <small>{bio.length} / 160</small>
                  </label>
                  <div className="cm-form-actions">
                    <button
                      type="submit"
                      className="cm-button cm-button-primary"
                    >
                      <Save size={15} />
                      保存本地资料
                    </button>
                  </div>
                  {profileMessage && (
                    <p
                      className={
                        nickname.trim().length < 2 || storageError
                          ? "cm-inline-error"
                          : "cm-inline-success"
                      }
                      role="status"
                    >
                      {nickname.trim().length >= 2 && storageError ? "资料仅暂存在本次会话中，未保存到浏览器；刷新后可能丢失。" : profileMessage}
                    </p>
                  )}
                </form>
              )}
              {tab === "security" && (
                <>
                  <section className="cm-paper ev7-account-security">
                    <SectionHeading icon={LockKeyhole} title="账号与安全" />
                    <div className="ev7-security-row">
                      <div>
                        <strong>Wiki 账号</strong>
                        <p>独立注册与登录。当前原型尚未接入账号服务。</p>
                      </div>
                      <span className="cm-soft-label">尚未接入</span>
                    </div>
                    <div className="ev7-security-row">
                      <div>
                        <strong>登录与恢复</strong>
                        <p>正式接入后在这里管理邮箱、密码和登录设备。</p>
                      </div>
                      <span className="cm-soft-label">由账号服务提供</span>
                    </div>
                    <p className="cm-section-note">
                      当前显示昵称只用于本地体验，不代表已创建或登录线上账号。
                    </p>
                  </section>
                  <section className="cm-paper cm-github-panel">
                    <SectionHeading icon={GithubMark} title="关联 GitHub" />
                    <span className="cm-status cm-status-neutral">
                      <span />
                      尚未接入
                    </span>
                    <p>
                      Wiki 账号独立使用。接入后可以自愿绑定
                      GitHub，把经你授权的投稿关联到相应署名。
                    </p>
                    <button
                      type="button"
                      className="cm-button"
                      onClick={() => setGithubOpen((open) => !open)}
                      aria-expanded={githubOpen}
                    >
                      署名与绑定说明
                      <ChevronDown size={15} />
                    </button>
                    {githubOpen && (
                      <div className="cm-github-detail">
                        <h3>接入后的授权方式</h3>
                        <p>
                          通过 GitHub 官方 OAuth 页面授权；无需在 Wiki
                          中提供密码或访问令牌。
                        </p>
                        <p>
                          内容由 GitHub App
                          提交。只有本人同意时才加入关联署名；未绑定用户仍可通过
                          Wiki 账号追溯贡献。
                        </p>
                        <p>
                          <strong>此原型不能发起绑定或创建真实账号。</strong>
                        </p>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export { Account };
