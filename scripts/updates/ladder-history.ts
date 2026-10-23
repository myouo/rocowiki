// SPDX-License-Identifier: GPL-3.0-only
import {ladderHistorySchema,ladderObservationSchema,type LadderHistory,type LadderObservation} from '../../packages/wiki-schema/src/ladder-history';
import {ZodError} from 'zod';
import {sameSnapshot} from './snapshot';
import {saveSnapshot} from './snapshot';
import {readFile} from 'node:fs/promises';
import {SaxesParser} from 'saxes';
import {ladderSnapshot} from './ladder-config';
import {withLadderRefreshLock} from './ladder-refresh-lock';

class RewardExtractionError extends Error{}
class RewardHistoryConflict extends Error{}

export function ladderHistoryObservation(bytes:Buffer,retrievedAt:string):LadderObservation {
  const snapshot=ladderObservationSchema.parse(ladderSnapshot(bytes,retrievedAt));
  try{return extractRewards(bytes,snapshot);}
  catch(error){
    if(!(error instanceof RewardExtractionError)&&!(error instanceof ZodError))throw error;
    return {...snapshot,rewardExtractionError:'UNSUPPORTED_REWARD_FORMAT'};
  }
}

function extractRewards(bytes:Buffer,snapshot:LadderObservation):LadderObservation{
  const path:string[]=[];
  const seasonDescriptions:string[]=[],seasonItems:{id:number;quantity:number}[][]=[],peakItems:{id:number;quantity:number}[][]=[];
  let deliveryNote='',hasRewards=false;
  const sections=new Set<string>();
  const parser=new SaxesParser({xmlns:false});
  parser.on('doctype',()=>{throw new Error('Ladder history XML DOCTYPE is unsupported');});
  parser.on('opentag',tag=>{
    path.push(tag.name);const current=path.join('/');
    if(path.length===2&&['SeasonRewards','SeasonRewardIds','DSeasonRewardIds','SeasonRewardRule'].includes(tag.name)){
      if(sections.has(tag.name))throw new RewardExtractionError('Duplicate ladder reward section');sections.add(tag.name);hasRewards=true;
    }
    if(current==='LadderMatchConfig/SeasonRewards'){hasRewards=true;}
    if(current==='LadderMatchConfig/SeasonRewards/SeasonReward')seasonDescriptions.push(tag.attributes.name||'');
    if(current==='LadderMatchConfig/SeasonRewardIds/Level')seasonItems.push([]);
    if(current==='LadderMatchConfig/DSeasonRewardIds/Level')peakItems.push([]);
    if(['LadderMatchConfig/SeasonRewardIds/Level/Reward','LadderMatchConfig/DSeasonRewardIds/Level/Reward'].includes(current)){
      const rows=path[1]==='SeasonRewardIds'?seasonItems:peakItems;
      if(!/^\d+$/.test(tag.attributes.id||'')||!/^\d+$/.test(tag.attributes.num||''))throw new RewardExtractionError('Invalid ladder reward item');
      rows.at(-1)!.push({id:Number(tag.attributes.id),quantity:Number(tag.attributes.num)});
    }
  });
  const text=(value:string)=>{if(path.join('/')==='LadderMatchConfig/SeasonRewardRule')deliveryNote+=value;};
  parser.on('text',text);parser.on('cdata',text);parser.on('closetag',()=>{path.pop();});
  parser.write(new TextDecoder('utf-8',{fatal:true}).decode(bytes)).close();
  if(hasRewards&&!seasonDescriptions.length&&!seasonItems.length&&!peakItems.length)throw new RewardExtractionError('No supported reward records');
  return ladderObservationSchema.parse({...snapshot,...(hasRewards?{rewards:{seasonDescriptions,seasonItems,peakItems,deliveryNote:deliveryNote.trim()}}:{})});
}

function sameBase(a:LadderObservation,b:LadderObservation){
  const {rewards:_a,rewardExtractionError:_ea,...baseA}=a,{rewards:_b,rewardExtractionError:_eb,...baseB}=b;
  return sameSnapshot(baseA,baseB);
}

/** Retain each change observation. Equal consecutive captures do not churn Git. */
export function appendLadderObservation(input:LadderHistory,candidate:LadderObservation):LadderHistory {
  const history=ladderHistorySchema.parse(input),snapshot=ladderObservationSchema.parse(candidate);
  const previous=history.observations.at(-1);
  if(previous&&sameBase(previous,snapshot)){
    // The identical raw hash proves newly extracted fields belonged to this
    // earlier capture too; never replace an existing reward extraction silently.
    if(!previous.rewards&&snapshot.rewards){const {rewardExtractionError:_old,...retained}=previous;return {...history,observations:[...history.observations.slice(0,-1),{...retained,rewards:snapshot.rewards}]};}
    if(previous.rewards&&snapshot.rewards&&!sameSnapshot(previous.rewards,snapshot.rewards))throw new RewardHistoryConflict('Conflicting reward extraction for one raw ladder hash');
    if(!previous.rewards&&!previous.rewardExtractionError&&snapshot.rewardExtractionError)return {...history,observations:[...history.observations.slice(0,-1),{...previous,rewardExtractionError:snapshot.rewardExtractionError}]};
    return history;
  }
  if(previous&&Date.parse(snapshot.source.retrievedAt)<=Date.parse(previous.source.retrievedAt)){
    if(history.observations.some(row=>sameBase(row,snapshot)))return history;
    throw new Error('Ladder history rejects an out-of-order change observation');
  }
  return ladderHistorySchema.parse({...history,observations:[...history.observations,snapshot]});
}

/** Validate both inputs before writing; archive first so a failed refresh cannot erase its predecessor. */
export async function saveLadderRefresh(currentPath:string|URL,historyPath:string|URL,observation:LadderObservation,force=false){
  return withLadderRefreshLock(historyPath,()=>saveLockedLadderRefresh(currentPath,historyPath,observation,force));
}

async function saveLockedLadderRefresh(currentPath:string|URL,historyPath:string|URL,observation:LadderObservation,force:boolean){
  const candidate=ladderObservationSchema.parse(observation);
  let history=ladderHistorySchema.parse(JSON.parse(await readFile(historyPath,'utf8')));
  let currentTime=-Infinity;
  try {const previous=ladderObservationSchema.parse(JSON.parse(await readFile(currentPath,'utf8')));currentTime=Date.parse(previous.source.retrievedAt);history=appendLadderObservation(history,previous);}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const newest=history.observations.at(-1);
  const newestTime=Math.max(currentTime,newest?Date.parse(newest.source.retrievedAt):-Infinity);
  if(Date.parse(candidate.source.retrievedAt)<newestTime)throw new Error('Refusing to replace the current ladder with an older archived capture');
  let resolved=candidate;
  try{history=appendLadderObservation(history,resolved);}
  catch(error){
    if(!(error instanceof RewardHistoryConflict))throw error;
    const {rewards:_conflict,...base}=candidate;resolved={...base,rewardExtractionError:'REWARD_HISTORY_CONFLICT'};
    history=appendLadderObservation(history,resolved);
  }
  const archived=await saveSnapshot(historyPath,history);
  const {rewards:_rewards,rewardExtractionError:_error,...snapshot}=resolved;
  const changed=await saveSnapshot(currentPath,snapshot,force);
  return {changed,archived,snapshot,rewardExtractionError:resolved.rewardExtractionError};
}
