// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import {ArrowRight,CalendarCheck2,Check,CircleHelp,Coins,FileCheck2,Flame,Heart,MessageCircle,Wallet} from 'lucide-react';
import {CheckinWeekStrip,type CalendarState} from '../../wiki/CommunityCheckinCalendar';
import type {CheckinRecord} from '../../../../../packages/wiki-schema/src/community';
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
  return <section className="rw-checkin-card-v72" aria-label="每日签到"><div className="rw-checkin-heading-v72"><span className="rw-social-section-icon-v72 sun"><CalendarCheck2 size={24}/></span><div><h3>把今天也留在王国里</h3><p>北京时间每天一次 · 奖励保存到你的账号</p></div></div>
    <div className="rw-checkin-body-v72"><div className="rw-checkin-numbers-v72">{[[stats?.current_streak,'当前连签'],[stats?.checkins,'累计签到'],[stats?.longest_streak,'历史最长']].map(([value,label])=><div key={String(label)}><strong>{value??'—'}<small>天</small></strong><span><Flame size={13}/>{label}</span></div>)}</div>
      <button type="button" className="cm-button rw-checkin-button-v72" disabled={!data||state.busy||stats?.checked_today} onClick={()=>void state.run(async service=>{const receipt=await service.checkIn(state.uid),amount=receipt.record.daily_reward+receipt.record.streak_bonus;return receipt.created?`签到成功，获得 ${amount} 枚洛克印记${receipt.record.streak_bonus?'（含连签奖励 5 枚）':''}。`:`今天已经签到，${amount} 枚奖励已入账。`;})}>{stats?.checked_today?<Check size={15}/>:<CalendarCheck2 size={15}/>} {state.busy?'正在保存…':stats?.checked_today?'今日已签到':'签到领印记'}</button>
    </div>{data&&<CheckinWeekStrip state={calendarState(data.recent_checkins,state.uid)} actorId={state.uid} now={new Date(data.server_time*1000)}/>}
    <p className="rw-checkin-note-v72">每日随机 3–7 枚，连续第 7、14、21… 天额外获得 5 枚。连签跨周、跨月累计，不提供补签。</p>{onCalendar&&<button className="rw-social-text-link-v72" type="button" onClick={onCalendar}>打开签到日历<ArrowRight size={13}/></button>}
  </section>;
}
export default function CommunityOverview({state,onHonors,onActivity}:{state:CommunityAccountState;onHonors:(view:string)=>void;onActivity:(view:string)=>void}) {
  const stats=state.data?.stats;
  const metrics=[{Icon:Heart,value:stats?.guide_likes,label:'攻略被点赞',view:'guideLikes',tone:'rose'},{Icon:MessageCircle,value:stats?.comment_likes,label:'评论被点赞',view:'commentLikes',tone:'lilac'},{Icon:MessageCircle,value:stats?.comments,label:'参与讨论',view:'comments',tone:''},{Icon:FileCheck2,value:stats?.contributions,label:'已发布贡献',view:'contributions',tone:'mint'}];
  return <div className="rw-community-overview-v72"><CommunityStatus state={state}/>
    <section className="rw-influence-v72"><div className="rw-social-section-heading-v72"><div><h3><Heart size={18}/>每一份参与都有回声</h3><p>来自已经发表的讨论、真实获赞和已发布修订。</p></div></div><div className="rw-influence-grid-v72">
      {metrics.map(({Icon,value,label,view,tone})=><button key={view} type="button" className={tone} onClick={()=>onActivity(view)}><Icon size={20}/><strong>{value??'—'}</strong><span>{label}</span><ArrowRight size={14}/></button>)}
    </div></section>
    <div className="rw-community-home-grid-v72"><CheckinCard state={state} onCalendar={()=>onHonors('checkin')}/><section className="rw-wallet-teaser-v72"><span className="rw-social-section-icon-v72 lilac"><Wallet size={22}/></span><p>我的洛克印记</p><strong>{stats?.balance??'—'}<small>枚</small></strong><span>签到积攒，兑换徽章与头像框。</span><button type="button" className="cm-button" onClick={()=>onHonors('badges')}><Coins size={14}/>逛逛纪念柜<ArrowRight size={13}/></button><button type="button" className="rw-social-text-link-v72" onClick={()=>onHonors('rankings')}>查看排行榜<ArrowRight size={13}/></button></section></div>
    <p className="rw-social-footnote-v72"><CircleHelp size={14}/>签到和印记保存在正式账号中，收藏仍保存在当前浏览器。</p>
  </div>;
}
