import React from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { Award, BookOpen, PencilLine } from "lucide-react";
import { pets } from "./data";
import { HONOR_ITEMS, emptySocialState, earnedAchievements, normalizeRegistrationUid } from "./communitySocialModel";
import { useCommunitySocial } from "./communitySocialStore";
import HonorSymbol from "./HonorSymbols";
import "./CommunityHonors.css";
import { PROFILE_AVATARS, normalizeAvatar } from "./community/profileModel";
import { useWikiRuntime } from "./runtime/useWikiRuntime";

export { PROFILE_AVATARS, normalizeAvatar };
export function GithubMark({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.8 1.31 3.49 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.82 5.63-5.5 5.93.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg>;
}
export function ProfileAvatar({ avatar = "dimo", size = 80, className = "", labelled = false, frame = "" }) {
  const selected = pets.find(pet => pet.slug === normalizeAvatar(avatar));
  const src = useBaseUrl(selected?.image || "/");
  const frameClass = ["frame-sun", "frame-night"].includes(frame) ? `rw-avatar-${frame}-v72` : "";
  return <span className={`rw-profile-avatar-v71 ${frameClass} ${className}`} style={{ "--avatar-size": `${size}px` }}>
    {frameClass && <span className="rw-avatar-halo-v73" aria-hidden="true"><i /><i /></span>}
    <img src={src} width={size} height={size} alt={labelled ? `${selected?.name || "迪莫"}头像` : ""} decoding="async" />
  </span>;
}
export function RegistrationUid({ uid, compact = false, example = false }) {
  const value = normalizeRegistrationUid(uid);
  return <div className={`rw-registration-uid-v73 ${compact ? "is-compact" : ""} ${example ? "is-example" : ""}`} data-registration-state={value ? example ? "example" : "assigned" : "pending"}>
    <span>注册序号 <small>UID</small></span><strong>{value || "待注册"}</strong>{example && <em>样式示例</em>}
  </div>;
}
export function HeaderProfileAvatar() {
  const {demo} = useWikiRuntime();
  return demo ? <DemoHeaderProfileAvatar /> : <ProfileAvatar avatar="dimo" size={27} />;
}
function DemoHeaderProfileAvatar() {
  const social = useCommunitySocial();
  return <ProfileAvatar avatar={social.identity.avatar} size={27} frame={social.state.equipped[social.identity.uuid]?.frame} />;
}
export default function AccountIdentity({ profile, social = emptySocialState(), submissions = [], onProfile, onSecurity, onHonors }) {
  const equipped = social.equipped[profile.uuid] || {};
  const badge = [...HONOR_ITEMS, ...earnedAchievements(social, profile.uuid, submissions)].find(item => item.id === equipped.badge);
  return <section className="rw-account-identity-v71" aria-label="我的身份" data-no-editor>
    <button type="button" className="rw-account-avatar-button" onClick={onProfile} aria-label="设置头像与昵称">
      <ProfileAvatar avatar={profile.avatar} size={86} frame={equipped.frame} />
      <span><PencilLine size={13} /></span>
    </button>
    <div className="rw-account-name-v71">
      <span className="rw-account-eyebrow">我的 RocoWiki</span>
      <h2>{profile.nickname || "未设置昵称"}</h2>
      <RegistrationUid uid={profile.uid} compact />
      {onHonors && <button type="button" className={`rw-profile-honor-v72 ${badge ? "is-equipped" : ""}`} onClick={onHonors}>{badge ? <HonorSymbol item={badge} size={15} /> : <Award size={15} />}{badge ? badge.title : "选择展示徽章"}</button>}
      <p>{profile.bio || "设置头像与昵称，让每次贡献都有自己的署名。"}</p>
      <div className="rw-account-platforms-v71" aria-label="身份与关联平台">
        <span><BookOpen size={15} /> Wiki · 本机体验</span>
        <button type="button" onClick={onSecurity} aria-label="查看 GitHub 关联状态"><GithubMark size={15} /> GitHub <small>未绑定</small></button>
      </div>
    </div>
    <button type="button" className="cm-button rw-account-profile-action" onClick={onProfile}><PencilLine size={15} />编辑个人资料</button>
  </section>;
}
export function AvatarPicker({ value, onChange }) {
  return <fieldset className="rw-avatar-picker-v71">
    <legend>头像</legend>
    <div role="radiogroup" aria-label="选择宠物头像" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...event.currentTarget.querySelectorAll('[role="radio"]')];
      const current = PROFILE_AVATARS.indexOf(value);
      const next = event.key === "Home" ? 0 : event.key === "End" ? PROFILE_AVATARS.length - 1 : (current + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + PROFILE_AVATARS.length) % PROFILE_AVATARS.length;
      onChange(PROFILE_AVATARS[next]);
      buttons[next]?.focus();
    }}>
      {PROFILE_AVATARS.map(slug => {
        const pet = pets.find(row => row.slug === slug);
        return <button type="button" key={slug} role="radio" tabIndex={value === slug ? 0 : -1} aria-checked={value === slug} aria-label={`使用${pet?.name || slug}头像`} className={value === slug ? "is-selected" : ""} onClick={() => onChange(slug)}><ProfileAvatar avatar={slug} size={54} /><span>{pet?.name || slug}</span></button>;
      })}
    </div>
  </fieldset>;
}
