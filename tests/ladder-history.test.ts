// SPDX-License-Identifier: GPL-3.0-only
import {describe,expect,it,vi} from 'vitest';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {ladderHistorySchema,archiveDateSchema,type LadderHistory} from '../packages/wiki-schema/src/ladder-history';
import {appendLadderObservation,ladderHistoryObservation,saveLadderRefresh} from '../scripts/updates/ladder-history';
import {withLadderRefreshLock,ladderRefreshLockPath} from '../scripts/updates/ladder-refresh-lock';
import {ladderArchive,findBanNotice,archiveBanRows,historyDate,historyHref,configDifference,observationDate,seasonRewardReferences,rewardMatches,resolveBattleArchive} from '../apps/web/src/wiki/ladderHistoryModel';

const empty: LadderHistory={schemaVersion:1,game:'roco-web',sources:[],seasons:[],notices:[],changes:[],observations:[]};
const xml=(cost=3,bans='<id>137</id>',extra='')=>Buffer.from(`<LadderMatchConfig><SpiritCost><spirit id="137" cost="${cost}"/></SpiritCost><LimitSpirit>${bans}</LimitSpirit>${extra}</LadderMatchConfig>`);
const capture=(day:number,cost=3,bans='<id>137</id>',extra='')=>ladderHistoryObservation(xml(cost,bans,extra),`2026-01-${String(day).padStart(2,'0')}T00:00:00Z`);
const rewards='<SeasonRewards><SeasonReward name="样例奖励"/></SeasonRewards><SeasonRewardIds><Level><Reward id="100" num="2"/></Level></SeasonRewardIds><DSeasonRewardIds><Level><Reward id="200" num="1"/></Level></DSeasonRewardIds><SeasonRewardRule><![CDATA[样例投递说明]]></SeasonRewardRule>';

describe('sourced ladder archive',()=>{
  it('validates committed references and preserves the complete initial official-notice corpus',()=>{
    const data=ladderHistorySchema.parse(JSON.parse(readFileSync('apps/web/content/ladder-history.json','utf8')));
    const notices=data.notices.filter(row=>row.mode==='ladder');
    expect(notices.length).toBeGreaterThanOrEqual(53);
    expect(notices.find(row=>row.date==='2025-10-24')).toBeDefined();
    expect(notices.find(row=>row.date==='2026-10-23')).toBeDefined();
    expect(data.seasons.find(row=>row.number===40)).toMatchObject({settlementDate:'2026-03-13',startDate:null});
    expect(data.seasons.find(row=>row.number===42)?.petRewards).toContainEqual(expect.objectContaining({petId:3432,name:'姝绒'}));
    expect(data.sources.every(source=>source.kind==='official-notice'||source.kind==='official-config')).toBe(true);
  });
  it('keeps an explicit no-ban notice different from an unrecorded or invalid day',()=>{
    expect(findBanNotice('2026-02-13','ladder')?.bannedPetNames).toEqual([]);
    expect(findBanNotice('2026-02-20','peak')?.bannedPetNames).toEqual([]);
    expect(findBanNotice('2026-02-14','ladder')).toBeUndefined();
    expect(findBanNotice('2026-02-30','ladder')).toBeUndefined();
    expect(historyDate('2026-02-30')).toBeNull();
    expect(archiveDateSchema.safeParse('2024-02-29').success).toBe(true);
  });
  it('separates tournament modes while sharing only the ladder/peak ban record',()=>{
    const ladder=findBanNotice('2025-11-28','ladder')!,type=findBanNotice('2025-11-28','type')!;
    expect(findBanNotice('2025-11-28','peak')).toBe(ladder);
    expect(type.allowedTypes).toEqual(['火','草','冰']);
    expect(ladder.bannedPetNames).toContain('美狄亚');
    expect(type.bannedPetNames).not.toContain('美狄亚');
    expect(findBanNotice('2025-12-02','ladder')).toBeUndefined();
    expect(findBanNotice('2025-12-02','type')?.allowedTypes).toEqual(['幽灵','毒','虫']);
  });
  it('labels observations in Shanghai time without extending them to adjacent dates',()=>{
    expect(observationDate('2026-10-11T23:39:11Z')).toBe('2026-10-12');
    const rows=archiveBanRows();
    expect(rows.some(row=>row.basis==='observation'&&row.date==='2026-10-12')).toBe(true);
    expect(findBanNotice('2026-10-12','ladder')).toBeUndefined();
  });
  it('rejects broken provenance, mode ambiguity, impossible dates and reused identifiers',()=>{
    for(const change of [
      {...ladderArchive,sources:[]},
      {...ladderArchive,notices:[...ladderArchive.notices,ladderArchive.notices[0]]},
      {...ladderArchive,notices:[{...ladderArchive.notices[0],date:'2026-02-30'}]},
      {...ladderArchive,seasons:[{...ladderArchive.seasons[0],settlementDate:'2025-12-12',settlementSourceId:null}]},
      {...ladderArchive,observations:[...ladderArchive.observations].reverse()},
    ])expect(()=>ladderHistorySchema.parse(change)).toThrow();
  });
  it('keeps stable bookmark context and exact official reward identities',()=>{
    const link=historyHref({view:'bans',record:'ladder-2026-02-13'},new URLSearchParams('mode=peak&date=2026-02-13&outside=bad'));
    const url=new URL(link,'https://wiki.test');
    expect(url.pathname).toBe('/battle/history/');expect(url.searchParams.get('mode')).toBe('peak');
    expect(url.searchParams.has('outside')).toBe(false);
    expect(seasonRewardReferences(3432)).toEqual([{number:42,href:'/battle/history/?view=seasons&season=42'}]);
    expect(seasonRewardReferences(999999)).toEqual([]);
  });
  it('matches a season or pet number exactly instead of finding it inside another identifier',()=>{
    expect(rewardMatches(12,[{petId:2421,name:'样例'}],'42')).toBe(false);
    expect(rewardMatches(42,[{petId:3432,name:'姝绒'}],'42')).toBe(true);
    expect(rewardMatches(42,[{petId:3432,name:'姝绒'}],'3432')).toBe(true);
    expect(rewardMatches(12,[{petId:2421,name:'样例'}],'第 42 届')).toBe(false);
  });
  it('resolves explicit observation and notice records before any weekly fallback',()=>{
    const row=archiveBanRows().find(row=>row.basis==='observation'&&row.date==='2026-10-12')!;
    expect(resolveBattleArchive(row.date,'ladder',row.id).records).toEqual([row]);
    expect(resolveBattleArchive('2026-10-09','ladder').records[0].notice?.sourceId).toBe('notice-2026-10-09');
    expect(resolveBattleArchive('2026-10-09','ladder','unknown')).toMatchObject({records:[],events:[]});
    expect(resolveBattleArchive('2026-10-22','ladder',row.id).records).toEqual([]);
  });
  it('retains peak-specific preview and settlement context on legacy peak URLs',()=>{
    const preview=resolveBattleArchive('2025-11-28','peak'),settled=resolveBattleArchive('2025-12-12','peak');
    expect(preview.events).toContainEqual(expect.objectContaining({kind:'preview',season:39,sourceId:'notice-2025-11-28'}));
    expect(settled.events).toContainEqual(expect.objectContaining({kind:'settlement',season:39,sourceId:'notice-2025-12-12'}));
    expect(resolveBattleArchive('2025-12-12','type').events).toEqual([]);
  });
});

describe('retained public-config observations',()=>{
  it('captures reward descriptions and IDs separately from bans and accepts an explicitly empty ban section',()=>{
    const row=capture(1,0,'',rewards);
    expect(row.bannedPetIds).toEqual([]);expect(row.costs['137']).toBe(0);
    expect(row.rewards).toEqual({seasonDescriptions:['样例奖励'],seasonItems:[[{id:100,quantity:2}]],peakItems:[[{id:200,quantity:1}]],deliveryNote:'样例投递说明'});
    for(const extra of [rewards+rewards,rewards.replace('num="2"','num="-2"'),rewards.replace('id="100"','id="unknown"')]){
      const partial=capture(1,3,'',extra);expect(partial.rewardExtractionError).toBe('UNSUPPORTED_REWARD_FORMAT');expect(partial.costs['137']).toBe(3);expect(partial.bannedPetIds).toEqual([]);expect(partial.rewards).toBeUndefined();
    }
  });
  it('deduplicates consecutive captures, preserves A→B→A and never mutates its input',()=>{
    const first=capture(1),second=capture(2,4),third=capture(3);
    const original=JSON.stringify(empty),a=appendLadderObservation(empty,first);
    expect(appendLadderObservation(a,capture(2)).observations).toHaveLength(1);
    const b=appendLadderObservation(a,second),c=appendLadderObservation(b,third);
    expect(c.observations).toHaveLength(3);expect(c.observations[0].source.sha256).toBe(c.observations[2].source.sha256);
    expect(JSON.stringify(empty)).toBe(original);expect(a.observations).toHaveLength(1);
  });
  it('adds extraction details only when the same raw hash proves they belong to that capture',()=>{
    const full=capture(1,3,'<id>137</id>',rewards),{rewards:_fields,...partial}=full;
    const base=appendLadderObservation(empty,partial);
    const enriched=appendLadderObservation(base,{...full,source:{...full.source,retrievedAt:'2026-01-02T00:00:00Z'}});
    expect(enriched.observations).toHaveLength(1);
    expect(enriched.observations[0].source.retrievedAt).toBe(full.source.retrievedAt);
    expect(enriched.observations[0].rewards).toEqual(full.rewards);
    expect(()=>appendLadderObservation(enriched,{...full,rewards:{...full.rewards!,deliveryNote:'不同解析'}})).toThrow('Conflicting');
  });
  it('allows replay of a retained predecessor but rejects an unknown backdated change',()=>{
    const first=capture(1),second=capture(3,4),history=appendLadderObservation(appendLadderObservation(empty,first),second);
    expect(appendLadderObservation(history,first)).toEqual(history);
    expect(()=>appendLadderObservation(history,capture(2,5))).toThrow('out-of-order');
  });
  it('compares fees independently from bans, including explicit zero and a return to the default fee',()=>{
    const before=capture(1,0),after=capture(2,4,'<id>138</id>');
    after.costs={};after.source.costEntryCount=0;
    const original=JSON.stringify([before,after]);
    expect(configDifference(before,after)).toEqual({added:[138],removed:[137],costs:[{petId:137,before:0,after:1}]});
    expect(JSON.stringify([before,after])).toBe(original);
  });
  it('validates before writing, keeps both old and new snapshots, and is safe to retry after a partial refresh',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'ladder-archive-')),current=path.join(dir,'current.json'),archive=path.join(dir,'history.json');
    const old=capture(1),next=capture(2,4);
    try{
      await writeFile(current,JSON.stringify(old));await writeFile(archive,'{}');
      await expect(saveLadderRefresh(current,archive,next)).rejects.toThrow();
      expect(JSON.parse(await readFile(current,'utf8'))).toEqual(old);
      await writeFile(archive,JSON.stringify(empty));
      const result=await saveLadderRefresh(current,archive,next);
      expect(result).toMatchObject({changed:true,archived:true});
      expect(JSON.parse(await readFile(archive,'utf8')).observations).toHaveLength(2);
      await writeFile(current,JSON.stringify(old));
      await saveLadderRefresh(current,archive,next);
      expect(JSON.parse(await readFile(archive,'utf8')).observations).toHaveLength(2);
      expect(JSON.parse(await readFile(current,'utf8'))).toEqual(next);
      await expect(saveLadderRefresh(current,archive,old)).rejects.toThrow('older archived capture');
      expect(JSON.parse(await readFile(current,'utf8'))).toEqual(next);
      expect(JSON.parse(await readFile(archive,'utf8')).observations).toHaveLength(2);
      expect(await saveLadderRefresh(current,archive,{...next,source:{...next.source,retrievedAt:'2026-01-03T00:00:00Z'}})).toMatchObject({changed:false,archived:false});
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('completes a partial retry when a forced current capture has a later time than its equivalent archived predecessor',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'ladder-forced-')),current=path.join(dir,'current.json'),archive=path.join(dir,'history.json');
    try{
      const first=capture(1),forced=capture(3),next=capture(5,4);
      await writeFile(current,JSON.stringify(first));await writeFile(archive,JSON.stringify(appendLadderObservation(empty,first)));
      await saveLadderRefresh(current,archive,forced,true);
      const retained=JSON.parse(await readFile(archive,'utf8'));
      expect(retained.observations).toHaveLength(1);expect(JSON.parse(await readFile(current,'utf8')).source.retrievedAt).toBe(forced.source.retrievedAt);
      await writeFile(archive,JSON.stringify(appendLadderObservation(retained,next)));
      await saveLadderRefresh(current,archive,next);
      expect(JSON.parse(await readFile(current,'utf8'))).toEqual(next);expect(JSON.parse(await readFile(archive,'utf8')).observations).toHaveLength(2);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('refreshes valid costs and bans on an unsupported reward format and keeps earlier rewards intact',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'ladder-reward-')),current=path.join(dir,'current.json'),archive=path.join(dir,'history.json');
    try{
      const first=capture(1,3,'<id>137</id>',rewards),{rewards:_old,...base}=first;
      await writeFile(current,JSON.stringify(base));await writeFile(archive,JSON.stringify(appendLadderObservation(empty,first)));
      const failed=capture(2,4,'<id>138</id>',rewards.replace('id="100"','id="unknown"'));
      expect(await saveLadderRefresh(current,archive,failed)).toMatchObject({changed:true,rewardExtractionError:'UNSUPPORTED_REWARD_FORMAT'});
      const updated=JSON.parse(await readFile(current,'utf8')),history=JSON.parse(await readFile(archive,'utf8'));
      expect(updated).toMatchObject({costs:{'137':4},bannedPetIds:[138]});expect(updated.rewardExtractionError).toBeUndefined();
      expect(history.observations[0].rewards).toEqual(first.rewards);expect(history.observations[1].rewardExtractionError).toBe('UNSUPPORTED_REWARD_FORMAT');
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('reports a conflicting reward extraction without blocking the valid base refresh or overwriting old reward facts',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'ladder-conflict-')),current=path.join(dir,'current.json'),archive=path.join(dir,'history.json');
    try{
      const first=capture(1,3,'<id>137</id>',rewards),{rewards:_old,...base}=first;
      await writeFile(current,JSON.stringify(base));await writeFile(archive,JSON.stringify(appendLadderObservation(empty,first)));
      const changed={...first,source:{...first.source,retrievedAt:'2026-01-02T00:00:00Z'},rewards:{...first.rewards!,deliveryNote:'不同解析'}};
      expect(await saveLadderRefresh(current,archive,changed,true)).toMatchObject({changed:true,rewardExtractionError:'REWARD_HISTORY_CONFLICT'});
      expect(JSON.parse(await readFile(archive,'utf8')).observations[0].rewards).toEqual(first.rewards);
      expect(JSON.parse(await readFile(current,'utf8')).source.retrievedAt).toBe(changed.source.retrievedAt);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});

describe('process-safe ladder refresh lock',()=>{
  it('retains both concurrent refreshes and leaves the current snapshot at the newest capture',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'ladder-concurrent-')),current=path.join(dir,'current.json'),archive=path.join(dir,'history.json');
    try{
      const first=capture(1),second=capture(2,4),third=capture(3,5);
      await writeFile(current,JSON.stringify(first));await writeFile(archive,JSON.stringify(empty));
      await Promise.all([saveLadderRefresh(current,archive,second),saveLadderRefresh(current,archive,third)]);
      expect(ladderHistorySchema.parse(JSON.parse(await readFile(archive,'utf8'))).observations.map(row=>row.source.sha256)).toEqual([first,second,third].map(row=>row.source.sha256));
      expect(JSON.parse(await readFile(current,'utf8'))).toEqual(third);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('serializes complete async operations without blocking the event loop',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'ladder-lock-')),archive=path.join(dir,'history.json'),entered:string[]=[];
    let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
    const first=withLadderRefreshLock(archive,async()=>{entered.push('first');await gate;});
    try{
      await vi.waitFor(()=>expect(entered).toEqual(['first']));
      const second=withLadderRefreshLock(archive,async()=>{entered.push('second');});
      await pause(50);expect(entered).toEqual(['first']);release();await Promise.all([first,second]);expect(entered).toEqual(['first','second']);
    }finally{release();await first;await rm(dir,{recursive:true,force:true});}
  });
  it('releases the process lock after an owner process is killed',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'ladder-crash-')),archive=path.join(dir,'history.json');
    const child=spawn(process.execPath,['--input-type=module','-e','import {DatabaseSync} from "node:sqlite";const db=new DatabaseSync(process.argv[1]);db.exec("BEGIN IMMEDIATE");process.stdout.write("held");setInterval(()=>{},1000);',ladderRefreshLockPath(archive)],{stdio:['ignore','pipe','pipe']});
    const exited=once(child,'exit');let pending:Promise<void>|undefined,entered=false;
    try{
      await once(child.stdout!,'data');pending=withLadderRefreshLock(archive,async()=>{entered=true;});
      await pause(50);expect(entered).toBe(false);child.kill('SIGKILL');await exited;await pending;expect(entered).toBe(true);
    }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await exited;await pending;await rm(dir,{recursive:true,force:true});}
  });
});
