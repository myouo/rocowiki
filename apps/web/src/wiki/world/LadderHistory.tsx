// SPDX-License-Identifier: GPL-3.0-only
import React,{type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useHistory} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {ArrowRight,CalendarDays,History,Shield,Trophy} from 'lucide-react';
import QueryInput from '../QueryInput';
import {officialPetData} from '../content/bundled.js';
import {ladderArchive,historyView,historyMode,historyDate,historyHref,archiveSource,archiveBanRows,observationDate,observationId,configDifference,rewardMatches,type HistoryView} from '../ladderHistoryModel';
import type {LadderArchiveSource,LadderObservation} from '../../../../../packages/wiki-schema/src/ladder-history';
import {LadderBanList,LadderBanSource} from './LadderBans';
import './LadderHistory.css';

const tabs:[HistoryView,string][]=[['seasons','历届赛季'],['bans','历史禁赛'],['rewards','奖励索引'],['changes','费用与兑换']];
const kindNames={fees:'魔力费用',shop:'兑换商城',rules:'赛制规则',schedule:'赛事日程'};
const petNames=new Map(officialPetData.pets.map(pet=>[pet.id,pet.name]));
const uniqueNames=new Map<string,number|null>();
for(const pet of officialPetData.pets)uniqueNames.set(pet.name,uniqueNames.has(pet.name)?null:pet.id);
const contains=(value:string,query:string)=>value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

export function ArchiveSource({source}:{source:LadderArchiveSource}){
  return <details className="lh-source"><summary>来源与记录范围</summary>
    <a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>
    <p>{source.locator}</p>{source.note&&<p>{source.note}</p>}
    <small>资料采集于 {observationDate(source.recordedAt)}；采集时间不等于规则生效时间。</small>
    {source.sha256&&<p className="lh-hash">内容指纹：<code>{source.sha256}</code></p>}
  </details>;
}
function PetLink({id,name}:{id:number;name?:string}){
  const label=name||petNames.get(id)||`No. ${id}（名称待核）`;
  return petNames.has(id)?<Link className="lh-pet-link" to={`/pets/${id}/`}>{label}</Link>:<span>{label}</span>;
}
export function NoticeBanNames({names}:{names:readonly string[]}){
  return <div className="wa-name-chips wa-v5-ban-list">{names.map(name=>{
    const id=uniqueNames.get(name);return id?<Link key={name} to={`/pets/${id}/`}>{name}</Link>:<span key={name}>{name}</span>;
  })}</div>;
}
function ObservationDetails({snapshot}:{snapshot:LadderObservation}){
  return <details className="lh-observation-details"><summary>同份配置的费用与奖励记录</summary>
    <p>未列出的宠物按该份客户端规则为 {snapshot.defaultCost} 魔力；下面只列明确配置的费用。这些是采集时的配置字段，未提供各项实际生效日期。</p>
    <dl className="lh-cost-grid">{Object.entries(snapshot.costs).map(([id,cost])=><div key={id}><dt><PetLink id={Number(id)}/></dt><dd>{cost} 魔力</dd></div>)}</dl>
    {snapshot.rewards&&<><h3>该份 XML 的赛季奖励说明</h3><ul>{snapshot.rewards.seasonDescriptions.map((text,index)=><li key={index}>{text}</li>)}</ul>
      <p>{snapshot.rewards.deliveryNote}</p><p className="lh-muted">该文件没有给出这些奖励所对应的赛季编号，不能据此补全所有往届奖励或认定已实际发放。</p></>}
  </details>;
}

export default function LadderHistoryPage({query,header}:{query:URLSearchParams;header:ReactNode}){
  const router=useHistory(),base=useBaseUrl('/').replace(/\/$/,'');
  const view=historyView(query.get('view')),mode=historyMode(query.get('mode'));
  const rawQuery=(query.get('q')||'').slice(0,120),search=rawQuery.trim();
  const year=/^\d{4}$/.test(query.get('year')||'')?query.get('year')! : '';
  const seasonNumber=/^[1-9]\d{0,3}$/.test(query.get('season')||'')?Number(query.get('season')):null;
  function update(changes:Record<string,string|null>){router.replace(base+historyHref(changes,query));}
  const seasons=[...ladderArchive.seasons].reverse().filter(row=>(!seasonNumber||row.number===seasonNumber)&&rewardMatches(row.number,row.petRewards,search));
  const allRows=archiveBanRows().filter(row=>row.mode===(mode==='type'?'type':'ladder'));
  const rows=allRows.filter(row=>(!year||row.date.startsWith(year))&&(!search||contains(row.date+' '+row.names.join(' ')+' '+(row.observation?.bannedPetIds.map(id=>`${id} ${petNames.get(id)||''}`).join(' ')||''),search)));
  const requestedId=query.get('record'),date=historyDate(query.get('date'));
  const selected=rows.find(row=>requestedId?row.id===requestedId:date?row.date===date:false)||(!query.has('record')&&!query.has('date')?rows[0]:undefined);
  const changes=[...ladderArchive.changes].reverse().filter(row=>(!year||row.date.startsWith(year))&&(!search||contains(row.title+' '+row.summary,search)));
  const years=[...new Set([...ladderArchive.notices.map(row=>row.date.slice(0,4)),...ladderArchive.observations.map(row=>observationDate(row.source.retrievedAt).slice(0,4))])].sort().reverse();
  const allRewards=[...ladderArchive.seasons].reverse().flatMap(season=>season.petRewards.map(reward=>({season:season.number,...reward})));
  const rewards=allRewards.filter(row=>rewardMatches(row.season,[row],search));
  return <div className="wa-page lh-page" data-no-editor>
    {header}
    <div className="lh-overview" aria-label="档案覆盖范围">
      <span><Trophy size={17}/><strong>{ladderArchive.seasons.length}</strong> 届奖励记载</span>
      <span><Shield size={17}/><strong>{ladderArchive.notices.filter(row=>row.mode==='ladder').length}</strong> 期天梯公告</span>
      <span><History size={17}/><strong>{ladderArchive.observations.length}</strong> 份配置快照</span>
    </div>
    <nav className="wa-tabs lh-tabs" aria-label="历史档案分类">{tabs.map(([key,label])=><Link key={key} to={historyHref({view:key,record:null,date:null,season:null,q:null,year:null},query)} className={view===key?'active':''} aria-current={view===key?'page':undefined}>{label}</Link>)}</nav>
    <div className="lh-toolbar">
      <label className="lh-search">{view==='bans'?'查日期或禁赛宠物':view==='changes'?'查费用或兑换变动':'查届次或奖励宠物'}
        <QueryInput value={rawQuery} onValueChange={value=>update({q:value,season:null,record:null,date:null})} placeholder={view==='bans'?'例如：2026-02、海芙约忒':'例如：42、姝绒'}/>
      </label>
      {(view==='bans'||view==='changes')&&<label>记录年份<select value={year} onChange={event=>update({year:event.target.value,record:null,date:null})}><option value="">全部年份</option>{years.map(value=><option key={value}>{value}</option>)}</select></label>}
    </div>
    {view==='seasons'&&<section className="lh-section">
      <div className="lh-section-heading"><h2>历届天梯赛季</h2>{seasonNumber&&<Link to={historyHref({season:null,q:null},query)}>查看全部届次</Link>}</div>
      <p className="lh-muted">先按官方图鉴中明确的届次归档，结算日另附当期公告。日期空缺不按季度推算，结算预告活动的日期也不当作整个赛季的起止日期。</p>
      <div className="lh-season-grid">{seasons.map(season=><article key={season.number} className={'lh-card'+(seasonNumber===season.number?' is-selected':'')}>
        <div className="lh-card-heading"><Trophy size={20}/><h3><Link to={historyHref({view:'seasons',season:String(season.number),q:null},query)}>第 {season.number} 届天梯赛</Link></h3></div>
        <p className="lh-season-date"><CalendarDays size={15}/>{season.settlementDate?`${season.settlementDate} 结算`:'结算日期尚未收录'}</p>
        <div className="lh-reward-names">{season.petRewards.map(reward=><PetLink key={reward.petId} id={reward.petId} name={reward.name}/>)}</div>
        {seasonNumber===season.number&&<><dl className="lh-season-facts"><div><dt>开赛日期</dt><dd>{season.startDate||'尚未收录'}</dd></div><div><dt>结算日期</dt><dd>{season.settlementDate||'尚未收录'}</dd></div></dl>
          {season.petRewards.map(reward=><div key={reward.petId} className="lh-reward-evidence"><strong>{reward.name}</strong><p>{reward.sourceText}</p><p>领取条件：{reward.requirement||'这条获取描述未明确说明'}</p><ArchiveSource source={archiveSource(reward.sourceId)}/></div>)}
          {season.notes.map(note=><p className="lh-muted" key={note}>{note}</p>)}
          {season.settlementSourceId&&<ArchiveSource source={archiveSource(season.settlementSourceId)}/>}</>}
        {!seasonNumber&&<Link className="lh-detail-link" to={historyHref({season:String(season.number),q:null},query)}>日期、领取条件与来源 <ArrowRight size={14}/></Link>}
      </article>)}</div>
      {!seasons.length&&<p className="lh-empty">没有找到这一届或奖励宠物的记载。未收录不等于当届没有奖励。</p>}
    </section>}
    {view==='rewards'&&<section className="lh-section"><h2>历届奖励宠物索引</h2>
      <p className="lh-muted">这里记录天梯赛获取原文，不将今天的领取门槛套到所有往届。日常战斗掉落、赛季宝箱和兑换商城是不同的获得方式。</p>
      <div className="lh-season-grid">{rewards.map(reward=><article className="lh-card" key={reward.season+'-'+reward.petId}>
        <span className="lh-kicker">第 {reward.season} 届 · 官方图鉴记载</span><h3><PetLink id={reward.petId} name={reward.name}/></h3>
        <p>{reward.requirement||'原文未明确段位门槛'}</p><p className="lh-muted">{reward.sourceText}</p>
        <Link className="lh-detail-link" to={historyHref({view:'seasons',season:String(reward.season),q:null},query)}>查看本届档案 <ArrowRight size={14}/></Link>
      </article>)}</div>{!rewards.length&&<p className="lh-empty">没有找到对应奖励。服装、边框、称号及不同领取形式将按各自来源继续补录。</p>}
    </section>}
    {view==='bans'&&<section className="lh-section"><h2>按记录查询禁赛</h2>
      <nav className="lh-mode-tabs" aria-label="历史禁赛模式">{[['ladder','天梯赛'],['peak','巅峰赛共享名单'],['type','系别排位赛']].map(([key,label])=><Link key={key} to={historyHref({mode:key,record:null,date:null,q:null,year:null},query)} aria-current={mode===key?'page':undefined}>{label}</Link>)}</nav>
      <p className="lh-muted">公告记录与配置采集分别标识。{mode==='peak'?'此处只共享天梯禁赛资料，巅峰赛的参赛条件与奖励仍需分别核对。':'未收录的日期不自动沿用相邻名单。'}</p>
      <label className="lh-record-picker">选择已收录记录（{rows.length} 条）<select value={selected?.id||''} onChange={event=>update({record:event.target.value,date:null})}>
        {!selected&&<option value="">选择记录</option>}{rows.map(row=><option key={row.id} value={row.id}>{row.date} · {row.basis==='notice'?'公告记录':'配置采集'}</option>)}
      </select></label>
      {selected?<article className="lh-card lh-record"><div className="lh-section-heading"><h3>{selected.date} · {selected.basis==='notice'?'公告记录':'配置采集'}</h3><span>{selected.observation?.bannedPetIds.length??selected.names.length} 只禁用宠物</span></div>
        {selected.allowedTypes.length>0&&<p>本场允许的主属性：<strong>{selected.allowedTypes.join(' / ')}</strong></p>}
        {selected.notice&&<>{selected.names.length?<NoticeBanNames names={selected.names}/>:<p className="lh-zero">原公告明确记载：本期无禁赛宠物。</p>}<ArchiveSource source={archiveSource(selected.notice.sourceId)}/></>}
        {selected.observation&&<><LadderBanList snapshot={selected.observation} catalog={officialPetData.pets}/><LadderBanSource snapshot={selected.observation}/><ObservationDetails snapshot={selected.observation}/></>}
        <Link className="lh-detail-link" to={selected.notice?`/battle/?mode=${mode}&date=${selected.date}`:`/battle/?mode=${mode}`}>{selected.notice?'回到对战页核对这期公告':'查看当前配置与参赛资料'} <ArrowRight size={14}/></Link>
      </article>:<p className="lh-empty">没有匹配的记录。名单缺失不等于本期无禁赛，也不表示宠物符合全部参赛条件。</p>}
    </section>}
    {view==='changes'&&<section className="lh-section"><h2>费用与兑换变动</h2><p className="lh-muted">按当期公告查新增费用、商城上新和下架；不把兑换返场记成当届赛季结算奖励。</p>
      <div className="lh-change-list">{changes.map(record=><article className="lh-card" key={record.id}><span className="lh-kicker">{record.date} · {kindNames[record.kind]}</span><h3>{record.title}</h3><p>{record.summary}</p><ArchiveSource source={archiveSource(record.sourceId)}/></article>)}</div>
      {!changes.length&&<p className="lh-empty">当前筛选下没有已收录的变动。</p>}
      <h2>配置观测之间的差异</h2><p className="lh-muted">这里只比较两个采集点，不能确定它们之间哪一刻发生了改变。</p>
      {ladderArchive.observations.slice(1).map((after,index)=>{const before=ladderArchive.observations[index],diff=configDifference(before,after);return <article className="lh-card" key={observationId(after)}>
        <h3>{observationDate(before.source.retrievedAt)} → {observationDate(after.source.retrievedAt)}</h3>
        <p>新增禁用 {diff.added.length} 只，移出禁用 {diff.removed.length} 只，明确费用变化 {diff.costs.length} 项。</p>
        <details><summary>展开两次记录的差异</summary><h4>后一次采集新增禁用</h4><div className="lh-reward-names">{diff.added.map(id=><PetLink key={id} id={id}/>)}</div>
          <h4>后一次采集移出禁用</h4><div className="lh-reward-names">{diff.removed.map(id=><PetLink key={id} id={id}/>)}</div>
          {diff.costs.map(row=><p key={row.petId}><PetLink id={row.petId}/>：{row.before} → {row.after} 魔力</p>)}
          {!diff.costs.length&&<p>这两份配置中没有发现费用差异。</p>}</details>
        <div className="lh-links"><Link to={historyHref({view:'bans',mode:'ladder',record:observationId(before),date:null,q:null,year:null},query)}>前一次记录</Link><Link to={historyHref({view:'bans',mode:'ladder',record:observationId(after),date:null,q:null,year:null},query)}>后一次记录</Link></div>
      </article>})}
    </section>}
    <div className="lh-footnote"><p>档案保留已读来源及其适用范围。奖励、规则与记录仍有缺口；当前参赛资格请继续核对对应模式的完整条件。</p><Link to={`/battle/?mode=${mode}`}>查看现有天梯系统 <ArrowRight size={14}/></Link></div>
  </div>;
}
