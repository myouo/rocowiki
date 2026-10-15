// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import {ArrowRight,BookOpen,CalendarCheck2,Check,ChevronRight,Coins,FileCheck2,Flame,Heart,MessageCircle} from 'lucide-react';
import {CheckinWeekStrip,type CalendarState} from '../../wiki/CommunityCheckinCalendar';
import {communityDay,type CheckinRecord} from '../../../../../packages/wiki-schema/src/community';
import type {CommunityAccountState} from './useCommunityAccount';
import '../../wiki/CommunityHonors.css';

export function calendarState(records:CheckinRecord[],uid:string):CalendarState {
  return {checkins:records.map(row=>({actorId:uid,day:row.day,at:new Date(row.created_at*1000).toISOString(),amount:row.daily_reward+row.streak_bonus,dailyReward:row.daily_reward,streakBonus:row.streak_bonus})),ledger:[]};
}
export function CommunityStatus({state}:{state:CommunityAccountState}) {
  return <>{state.error&&<div className="cm-paper" role="status"><p>{state.error}</p><button className="cm-button" disabled={state.busy} onClick={()=>void state.run(async()=> '社区记录已更新。')}>重新读取社区记录</button></div>}{state.notice&&<p className="rw-social-message-v72" role="status">{state.notice}</p>}</>;
}
export function CheckinCard({state,onCalendar}:{state:CommunityAccountState;onCalendar?:()=>void}) {
  const data=state.data,stats=data?.stats;
  return <section className="rw-checkin-card-v72 is-compact" aria-label="每日签到"><div className="rw-checkin-heading-v72"><span className="rw-social-section-icon-v72 sun"><CalendarCheck2 size={23}/></span><div><h3>{stats?.checked_today?'今天也来王国看看':'每天留下一枚足迹'}</h3><p>{data?communityDay(data.server_time):'正在校时'} · 北京时间</p></div><span className="rw-social-local-tag">账号签到</span></div>
    <div className="rw-checkin-body-v72"><div className="rw-checkin-numbers-v72">{[[stats?.current_streak,'当前连签'],[stats?.checkins,'累计签到'],[stats?.longest_streak,'最长连签']].map(([value,label],index)=><div key={String(label)}><strong>{value??'—'}<small>天</small></strong><span>{index===0&&<Flame size={14}/ >}{label}</span></div>)}</div>
      <button type="button" className="cm-button rw-checkin-button-v72" disabled={!data||state.busy||stats?.checked_today} onClick={()=>void state.run(async service=>{const receipt=await service.checkIn(state.uid),amount=receipt.record.daily_reward+receipt.record.streak_bonus;return receipt.created?`签到成功，获得 ${amount} 枚洛克印记${receipt.record.streak_bonus?'（含连签奖励 5 枚）':''}。`:`今天已经签到，${amount} 枚奖励已入账。`;})}>{stats?.checked_today?<Check size={15}/>:<CalendarCheck2 size={15}/>} {state.busy?'正在保存…':stats?.checked_today?'今日已签到':'签到领印记'}</button>
    </div>{data&&<CheckinWeekStrip state={calendarState(data.recent_checkins,state.uid)} actorId={state.uid} now={new Date(data.server_time*1000)}/>}
    <p className="rw-checkin-note-v72">每日随机获得 3–7 枚，各数量机会相同；每连续 7 天额外 +5 枚。连签跨周、跨月累计。</p>{onCalendar&&<button className="rw-social-text-link-v72" type="button" onClick={onCalendar}>打开签到日历<ArrowRight size={13}/></button>}
  </section>;
}
export default function CommunityOverview({state,onHonors,onActivity}:{state:CommunityAccountState;onHonors:(view:string)=>void;onActivity:(view:string)=>void}) {
  const stats=state.data?.stats;
  const metrics=[{Icon:FileCheck2,value:stats?.contributions,label:'已发布贡献',view:'contributions',tone:'sky'},{Icon:Heart,value:stats?.guide_likes,label:'攻略被点赞',view:'guideLikes',tone:'rose'},{Icon:MessageCircle,value:stats?.comment_likes,label:'评论被点赞',view:'commentLikes',tone:'lilac'},{Icon:BookOpen,value:stats?.comments,label:'参与讨论',view:'comments',tone:'mint'}];
  return <div className="rw-community-overview-v72"><CommunityStatus state={state}/>
    <section className="rw-influence-v72" aria-label="我的社区影响力"><div className="rw-social-section-heading-v72"><div><h2>我的社区足迹</h2><p>每一次认真整理和讨论，都有自己的记录。</p></div><span className="rw-social-local-tag">账号记录</span></div><div className="rw-influence-grid-v72">
      {metrics.map(({Icon,value,label,view,tone})=><button key={view} type="button" className={tone} onClick={()=>onActivity(view)}><Icon size={21}/><strong>{value??'—'}</strong><span>{label}</span><ChevronRight size={14}/></button>)}
    </div><p className="rw-social-footnote-v72">攻略点赞、评论点赞与已发布贡献分别统计。只统计真实账号的有效记录。</p></section>
    <div className="rw-community-home-grid-v72"><CheckinCard state={state} onCalendar={()=>onHonors('checkin')}/><section className="rw-wallet-teaser-v72"><span className="rw-social-section-icon-v72 lilac"><Coins size={24}/></span><p>我的洛克印记</p><strong>{stats?.balance??'—'}<small>枚</small></strong><span>兑换纪念徽章和头像框，让名片多一点自己的颜色。</span><button type="button" className="cm-button" onClick={()=>onHonors('badges')}>打开社区荣誉<ArrowRight size={15}/></button></section></div>
  </div>;
}
