// SPDX-License-Identifier: GPL-3.0-only
import {ladderHistorySchema,archiveDateSchema,type LadderHistory,type LadderObservation,type LadderBanNotice,type LadderArchiveSource} from '../../../../packages/wiki-schema/src/ladder-history';
import {ladderHistoryData} from './content/bundled.js';

export const ladderArchive=ladderHistorySchema.parse(ladderHistoryData);
export type HistoryView='seasons'|'bans'|'rewards'|'changes';
export type HistoryMode='ladder'|'peak'|'type';
export function historyView(value:string|null):HistoryView{return ['seasons','bans','rewards','changes'].includes(value||'')?value as HistoryView:'seasons';}
export function historyMode(value:string|null):HistoryMode{return value==='type'||value==='type-tournament'?'type':value==='peak'||value==='ladder-peak'?'peak':'ladder';}
export function historyDate(value:string|null):string|null{return archiveDateSchema.safeParse(value).success?value:null;}
export function observationDate(value:string):string{
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
export function historyHref(changes:Record<string,string|null|undefined>={},query?:URLSearchParams):string{
  const next=new URLSearchParams();
  for(const key of ['view','mode','date','record','season','q','year']){const value=changes[key]===undefined?query?.get(key):changes[key];if(value)next.set(key,value);}
  return '/battle/history/'+(next.size?'?'+next.toString():'');
}
export function findBanNotice(date:string,mode:HistoryMode,archive:LadderHistory=ladderArchive):LadderBanNotice|undefined{
  if(!archiveDateSchema.safeParse(date).success)return;
  return archive.notices.find(row=>row.date===date&&row.mode===(mode==='type'?'type':'ladder'));
}
export function archiveSource(id:string,archive:LadderHistory=ladderArchive):LadderArchiveSource{
  const source=archive.sources.find(row=>row.id===id);if(!source)throw new Error('Missing archive source '+id);return source;
}
export function observationId(snapshot:LadderObservation):string{return 'xml-'+snapshot.source.sha256.slice(0,16)+'-'+snapshot.source.retrievedAt.replace(/\D/g,'');}
export function configDifference(before:LadderObservation,after:LadderObservation){
  const oldBans=new Set(before.bannedPetIds),newBans=new Set(after.bannedPetIds);
  const costs=[...new Set([...Object.keys(before.costs),...Object.keys(after.costs)])].map(id=>({
    petId:Number(id),before:before.costs[id]??before.defaultCost,after:after.costs[id]??after.defaultCost,
  })).filter(row=>row.before!==row.after).sort((a,b)=>a.petId-b.petId);
  return {added:after.bannedPetIds.filter(id=>!oldBans.has(id)),removed:before.bannedPetIds.filter(id=>!newBans.has(id)),costs};
}
export type ArchiveBanRow={id:string;mode:'ladder'|'type';date:string;basis:'notice'|'observation';names:string[];allowedTypes:string[];notice?:LadderBanNotice;observation?:LadderObservation};
export function archiveBanRows(archive:LadderHistory=ladderArchive):ArchiveBanRow[]{
  const notices:ArchiveBanRow[]=archive.notices.map(row=>({id:row.id,mode:row.mode,date:row.date,basis:'notice',names:row.bannedPetNames,allowedTypes:row.allowedTypes||[],notice:row}));
  const observations:ArchiveBanRow[]=archive.observations.map(row=>({id:observationId(row),mode:'ladder',date:observationDate(row.source.retrievedAt),basis:'observation',names:[],allowedTypes:[],observation:row}));
  return [...notices,...observations].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
export function seasonRewardReferences(petId:number,archive:LadderHistory=ladderArchive){
  return archive.seasons.filter(season=>season.petRewards.some(reward=>reward.petId===petId)).map(season=>({number:season.number,href:historyHref({view:'seasons',season:String(season.number)})}));
}
export function rewardMatches(season:number,rewards:readonly {petId:number;name:string;sourceText?:string}[],query:string):boolean{
  const text=query.trim();if(!text)return true;
  const numbered=text.match(/^(?:第\s*)?(\d+)(?:\s*届)?$/);
  if(numbered){const number=Number(numbered[1]);return season===number||(!/[第届]/.test(text)&&rewards.some(row=>row.petId===number));}
  const normalized=text.toLocaleLowerCase();return rewards.some(row=>(row.name+' '+(row.sourceText||'')).toLocaleLowerCase().includes(normalized));
}
export type SeasonHistoryEvent={id:string;kind:'settlement'|'preview';season:number;date:string;title:string;summary:string;sourceId:string};
export function seasonHistoryEvents(date:string,mode:HistoryMode,archive:LadderHistory=ladderArchive):SeasonHistoryEvent[]{
  if(mode==='type'||!historyDate(date))return [];
  const settlements:SeasonHistoryEvent[]=archive.seasons.filter(row=>row.settlementDate===date&&(mode==='ladder'||row.settlementModes?.includes('peak'))).map(row=>({
    id:'settlement-'+row.number,kind:'settlement',season:row.number,date,title:`第 ${row.number} 届${mode==='peak'?'巅峰赛':'天梯赛'}结算`,
    summary:'结算日期按当期公告记录。天梯赛与巅峰赛的奖励分别核对领取依据。',sourceId:row.settlementSourceId!,
  }));
  const previews:SeasonHistoryEvent[]=archive.changes.filter(row=>row.kind==='schedule'&&row.date===date&&row.seasonNumber&&row.modes?.includes(mode)).map(row=>({
    id:row.id,kind:'preview',season:row.seasonNumber!,date,title:row.title,summary:row.summary,sourceId:row.sourceId,
  }));
  return [...settlements,...previews];
}
export function resolveBattleArchive(date:string|null,mode:HistoryMode,record:string|null=null,archive:LadderHistory=ladderArchive){
  const rows=archiveBanRows(archive).filter(row=>row.mode===(mode==='type'?'type':'ladder'));
  if(record!==null){
    const selected=rows.find(row=>row.id===record&&(!date||row.date===date));
    return {date:selected?.date||date,records:selected?[selected]:[],events:selected?seasonHistoryEvents(selected.date,mode,archive):[]};
  }
  return {date,records:date?rows.filter(row=>row.date===date):[],events:date?seasonHistoryEvents(date,mode,archive):[]};
}
