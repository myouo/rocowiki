// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import {Award,BookOpen,PencilLine} from 'lucide-react';
import {GithubMark,ProfileAvatar} from '../../wiki/AccountIdentity';
import HonorSymbol from '../../wiki/HonorSymbols';
import {HONOR_ITEMS,ACHIEVEMENTS,type CommunityProfile} from '../../../../../packages/wiki-schema/src/community';
import type {Me} from '../workbench/contracts';

export const accountRoles={viewer:'只读成员',contributor:'社区成员',reviewer:'审核员',admin:'管理员'};

/** V7.3.1's identity layout, populated only from the authenticated account. */
export default function AccountIdentityCard({me,profile,onProfile,onSecurity,onHonors}:{
  me:Me;profile:CommunityProfile|undefined;onProfile:()=>void;onSecurity:()=>void;onHonors:()=>void;
}) {
  const badge=[...HONOR_ITEMS,...ACHIEVEMENTS].find(item=>item.id===profile?.badge);
  return <section className="account-identity rw-account-identity-v71" aria-label="我的身份" data-account-uid={me.user.uid}>
    <button type="button" className="rw-account-avatar-button" onClick={onProfile} aria-label="设置头像与昵称">
      <ProfileAvatar avatar={me.profile?.avatar??profile?.avatar??'dimo'} frame={profile?.frame} size={86}/><span><PencilLine size={13}/></span>
    </button>
    <div className="rw-account-name-v71">
      <span className="rw-account-eyebrow">我的 RocoWiki</span><h2>{me.user.display_name}</h2>
      <div className="rw-registration-uid-v73 is-compact account-registration" data-registration-state={me.user.registration_number?'assigned':'pending'}><span>注册序号 <small>UID</small></span><strong>{me.user.registration_number??'暂未读取'}</strong></div>
      <button type="button" className={`rw-profile-honor-v72${badge?' is-equipped':''}`} onClick={onHonors}>{badge?<HonorSymbol item={badge} size={15}/>:<Award size={15}/>} {badge?.title??'选择展示徽章'}</button>
      <p>{(me.profile?.bio??profile?.bio)||'设置头像与昵称，让每次贡献都有自己的署名。'}</p>
      <div className="rw-account-platforms-v71 account-tags" aria-label="身份与关联平台"><span><BookOpen size={15}/> Wiki · {accountRoles[me.user.role]}</span><button type="button" onClick={onSecurity} aria-label="查看 GitHub 关联状态"><GithubMark size={15}/> GitHub <small>{me.github?'已绑定':'未绑定'}</small></button></div>
    </div>
    <button type="button" className="cm-button rw-account-profile-action" onClick={onProfile}><PencilLine size={15}/>编辑个人资料</button>
  </section>;
}
