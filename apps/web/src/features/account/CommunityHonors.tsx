// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import {useHistory} from '@docusaurus/router';
import {ArrowRight,Award,CalendarDays,Check,Coins,Medal,Trophy,Wallet} from 'lucide-react';
import Select from '../../wiki/Select';
import HonorSymbol from '../../wiki/HonorSymbols';
import {ProfileAvatar} from '../../wiki/AccountIdentity';
import CommunityCheckinCalendar from '../../wiki/CommunityCheckinCalendar';
import {HONOR_ITEMS,ACHIEVEMENTS,communityDay,calendarDaySchema,rankMetrics,periods,type RankMetric,type CommunityPeriod} from '../../../../../packages/wiki-schema/src/community';
import type {Me} from '../workbench/contracts';
import type {CommunityAccountState} from './useCommunityAccount';
import {useCommunityQuery} from './useCommunityQuery';
import {CheckinCard,CommunityStatus,calendarState} from './CommunityOverview';

const displayTime=(seconds:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(seconds*1000));
const metrics=[{value:'checkins',label:'签到天数',unit:'天'},{value:'streak',label:'连签纪录',unit:'天'},{value:'guideLikes',label:'攻略获赞',unit:'赞'},{value:'contributions',label:'发布贡献',unit:'次'}] as const;
const periodLabels={day:'日榜',week:'周榜',month:'月榜',all:'总榜'};
type PanelProps={origin:string;me:Me;query:URLSearchParams;state:CommunityAccountState;onIdentityError:(error:unknown)=>void};
function QueryStatus({error,onRetry}:{error:string;onRetry:()=>void}) {return <div className="rw-social-empty-v72" role="status"><p>{error||'正在读取社区记录…'}</p>{error&&<button className="cm-button" onClick={onRetry}>重新加载</button>}</div>;}
function CheckinCalendar({origin,me,query,state,onIdentityError}:PanelProps) {
  const time=state.data?.server_time??0,today=communityDay(time),requested=query.get('date'),day=calendarDaySchema.safeParse(requested).success?requested!:today;
  const first=query.get('calendar')==='week'?day:`${day.slice(0,7)}-01`,offset=(new Date(`${first}T00:00:00Z`).getUTCDay()+6)%7;
  const start=new Date(Date.parse(`${first}T00:00:00Z`)-offset*86400000).toISOString().slice(0,10);
  const nextMonth=new Date(`${day.slice(0,7)}-01T00:00:00Z`);nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);
  const monthDays=Math.round((nextMonth.getTime()-Date.parse(`${day.slice(0,7)}-01T00:00:00Z`))/86400000);
  const length=query.get('calendar')==='week'?7:Math.ceil((offset+monthDays)/7)*7,end=new Date(Date.parse(`${start}T00:00:00Z`)+length*86400000).toISOString().slice(0,10);
  const result=useCommunityQuery(origin,me,`${start}:${end}:${state.version}`,service=>service.checkins(me.user.uid,start,end),onIdentityError);
  return result.data?<CommunityCheckinCalendar state={calendarState(result.data.checkins,me.user.uid)} actorId={me.user.uid} now={new Date(result.data.server_time*1000)} query={query}/>:<QueryStatus error={result.error} onRetry={result.retry}/>;
}
function RankingBoard({origin,me,query,state,onIdentityError}:PanelProps) {
  const history=useHistory(),requestedMetric=query.get('metric'),requestedPeriod=query.get('period');
  const metric=rankMetrics.includes(requestedMetric as RankMetric)?requestedMetric as RankMetric:'checkins';
  const period=periods.includes(requestedPeriod as CommunityPeriod)?requestedPeriod as CommunityPeriod:'week';
  const result=useCommunityQuery(origin,me,`${metric}:${period}:${state.version}`,service=>service.rankings(metric,period,me.user.uid),onIdentityError);
  const navigate=(nextMetric:RankMetric,nextPeriod:CommunityPeriod)=>history.push('/account/?'+new URLSearchParams({tab:'honors',view:'rankings',metric:nextMetric,period:nextPeriod}));
  const selected=metrics.find(item=>item.value===metric)!;
  return <section className="rw-honor-paper-v72 rw-ranking-v72"><div className="rw-social-section-heading-v72"><div><h3><Trophy size={19}/>社区排行榜</h3><p>只统计真实签到、有效点赞和已发布修订；相同成绩共享名次。</p></div></div><div className="rw-ranking-controls-v72"><label>榜单指标<Select ariaLabel="排行榜指标" value={metric} options={[...metrics]} onChange={value=>navigate(value as RankMetric,period)}/></label><div className="rw-ranking-periods-v72">{periods.map(value=><button key={value} aria-pressed={period===value} className={period===value?'is-active':''} onClick={()=>navigate(metric,value)}>{periodLabels[value]}</button>)}</div></div>
    {!result.data?<QueryStatus error={result.error} onRetry={result.retry}/>:<>
      <div className="rw-ranking-period-note-v72"><span>北京时间 · {periodLabels[period]}</span><span>前 50 位</span></div>
      {result.data.rows.length?<div className="rw-social-table-wrap-v72"><table className="rw-ranking-table-v72"><thead><tr><th>名次</th><th>参与者</th><th>{selected.label}</th></tr></thead><tbody>{result.data.rows.map(row=><tr key={row.uid} className={row.uid===me.user.uid?'is-me':''}><td><span className={`rw-rank-number-v72 rank-${row.rank}`}>{row.rank<=3&&<Medal size={18}/>} {row.rank}</span></td><td><ProfileAvatar avatar={row.avatar} size={37}/><span>{row.display_name}{row.uid===me.user.uid&&<small>我</small>}</span></td><td><strong>{row.value}</strong> {selected.unit}</td></tr>)}</tbody></table></div>:<div className="rw-social-empty-v72"><Trophy size={28}/><strong>本期还没有相关记录</strong><p>完成签到，或者发布一份有依据的贡献后，成绩会出现在对应榜单。</p></div>}
      <div className="rw-rank-my-note-v72"><span>我的本期名次</span><strong>{result.data.mine?`第 ${result.data.mine.rank} 名 · ${result.data.mine.value} ${selected.unit}`:'暂无本期成绩'}</strong></div>
    </>}
  </section>;
}
function BadgeCabinet({state}:{state:CommunityAccountState}) {
  const data=state.data;
  if(!data)return <QueryStatus error={state.error} onRetry={()=>void state.run(async()=> '社区记录已更新。')}/>;
  const equip=(slot:'badge'|'frame',id:string)=>void state.run(async service=>{await service.equip(state.uid,slot,id);return id?'佩戴已保存，可以在个人名片查看。':'已取消佩戴。';});
  return <div className="rw-honor-stack-v72"><section className="rw-honor-paper-v72"><div className="rw-social-section-heading-v72"><div><h3><Award size={19}/>纪念柜</h3><p>用签到积攒的印记，给自己的名片添一点颜色。</p></div><span className="rw-social-balance-chip-v72"><Coins size={15}/>{data.stats.balance} 枚</span></div><div className="rw-honor-shop-grid-v72">{HONOR_ITEMS.map(item=>{const owned=data.purchases.includes(item.id),equipped=data.profile[item.kind]===item.id;return <article key={item.id} className={`rw-honor-item-v72 ${item.tone}`}><div className="rw-honor-item-art-v72">{item.kind==='frame'?<ProfileAvatar avatar={data.profile.avatar} frame={item.id} size={68}/>:<HonorSymbol item={item}/>}<span>{item.kind==='frame'?'头像框':'纪念徽章'}</span></div><h4>{item.title}</h4><p>{item.description}</p><div className="rw-honor-item-action-v72"><span>{owned?<><Check size={14}/>已拥有</>:<><Coins size={14}/>{item.price} 枚</>}</span>{owned?<button className={`cm-button${equipped?' is-equipped':''}`} disabled={state.busy} onClick={()=>equip(item.kind,equipped?'':item.id)}>{equipped?'取消佩戴':'佩戴'}</button>:<button className="cm-button" disabled={state.busy||data.stats.balance<item.price} onClick={()=>void state.run(async service=>{await service.redeem(state.uid,item.id);return `已兑换「${item.title}」，可以佩戴到个人名片。`;})}>{data.stats.balance<item.price?`还差 ${item.price-data.stats.balance} 枚`:'兑换'}</button>}</div></article>;})}</div></section>
    <section className="rw-honor-paper-v72"><h3>贡献与签到成就</h3><div className="rw-achievement-grid-v72">{ACHIEVEMENTS.map(item=>{const earned=data.achievements.includes(item.id),equipped=data.profile.badge===item.id;return <article key={item.id} className={earned?'':'is-locked'}><HonorSymbol item={item}/><div><h4>{item.title}</h4><p>{item.description}</p></div><button className="cm-button" disabled={!earned||state.busy} onClick={()=>equip('badge',equipped?'':item.id)}>{!earned?'尚未获得':equipped?'取消佩戴':'佩戴'}</button></article>;})}</div></section>
  </div>;
}
export default function CommunityHonors(props:PanelProps) {
  const history=useHistory(),view=['checkin','badges','rankings'].includes(props.query.get('view')??'')?props.query.get('view')!:'checkin';
  const {state}=props;
  return <div className="rw-community-honors-v72"><div className="rw-honors-heading-v72"><div><span>把参与变成自己的纪念</span><h2>社区荣誉</h2><p>签到记录、洛克印记、成就与装扮。</p></div><div><Wallet size={24}/><strong>{state.data?.stats.balance??'—'}</strong><span>洛克印记</span></div></div>
    <nav className="rw-honors-tabs-v72" aria-label="社区荣誉分区">{[{id:'checkin',label:'签到与账本',Icon:CalendarDays},{id:'badges',label:'纪念柜',Icon:Award},{id:'rankings',label:'排行榜',Icon:Trophy}].map(({id,label,Icon})=><button key={id} aria-pressed={view===id} className={view===id?'is-active':''} onClick={()=>history.push('/account/?'+new URLSearchParams({tab:'honors',view:id}))}><Icon size={16}/>{label}</button>)}</nav><CommunityStatus state={state}/>
    {view==='checkin'&&<div className="rw-honor-stack-v72"><CheckinCard state={state}/>{state.data&&<CheckinCalendar {...props}/>}<section className="rw-honor-paper-v72"><h3><Wallet size={18}/>印记账本</h3>{state.data?.ledger.length?<div className="rw-social-table-wrap-v72"><table className="rw-ledger-table-v72"><thead><tr><th>来源</th><th>时间</th><th>变动</th></tr></thead><tbody>{state.data.ledger.map(row=><tr key={row.entry_id}><td>{row.label}</td><td>{displayTime(row.created_at)}</td><td className={row.amount>0?'is-credit':'is-debit'}>{row.amount>0?'+':''}{row.amount} 枚</td></tr>)}</tbody></table></div>:<p>{state.data?'还没有印记记录，完成今天的签到后会出现在这里。':'正在读取账本…'}</p>}<small>最近 100 条，签到与兑换的奖励记录固定保存。</small></section></div>}
    {view==='badges'&&<BadgeCabinet state={state}/>} {view==='rankings'&&<RankingBoard {...props}/>}
    <p className="rw-social-footnote-v72">印记只用于社区外观，不影响资料可信度、审核权限或排行榜分数。</p>
  </div>;
}
