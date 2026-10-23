// SPDX-License-Identifier: GPL-3.0-only
import {z} from 'zod';

export const archiveDateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const date=new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
},'Invalid calendar date');
const timestamp=z.string().datetime({offset:true});
const id=z.string().regex(/^[a-z][a-z0-9-]{0,100}$/);
const name=z.string().trim().min(1).max(200);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const url=z.string().url().refine(value=>{try{const parsed=new URL(value);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password;}catch{return false;}});
const petId=z.number().int().positive().max(0xffffffff);
export const ladderObservationSchema=z.object({
  schemaVersion:z.literal(1),
  source:z.object({url,retrievedAt:timestamp,sha256:hash,costEntryCount:z.number().int().nonnegative(),banEntryCount:z.number().int().nonnegative()}).strict(),
  defaultCost:z.literal(1),costs:z.record(z.string().regex(/^[1-9]\d*$/),z.number().int().nonnegative().max(0xffffffff)),
  bannedPetIds:z.array(petId),
  rewards:z.object({
    seasonDescriptions:z.array(z.string().min(1).max(1000)),
    seasonItems:z.array(z.array(z.object({id:petId,quantity:z.number().int().positive().max(0xffffffff)}).strict())),
    peakItems:z.array(z.array(z.object({id:petId,quantity:z.number().int().positive().max(0xffffffff)}).strict())),
    deliveryNote:z.string().max(1000),
  }).strict().optional(),
}).strict().superRefine((value,ctx)=>{
  if(new Set(value.bannedPetIds).size!==value.bannedPetIds.length)ctx.addIssue({code:'custom',message:'Duplicate banned ID'});
  if(value.source.costEntryCount<Object.keys(value.costs).length||value.source.banEntryCount<value.bannedPetIds.length)ctx.addIssue({code:'custom',message:'Source entry count mismatch'});
});

export const ladderArchiveSourceSchema=z.object({
  id,kind:z.enum(['official-notice','official-config','announcement-reprint','community-record']),
  title:name,url,recordedAt:timestamp,publishedAt:archiveDateSchema.nullable(),
  locator:z.string().min(1).max(500),sha256:hash.optional(),note:z.string().max(1000).optional(),
}).strict();
const rewardSchema=z.object({
  petId,name,requirement:z.string().min(1).max(200).nullable(),sourceText:z.string().min(1).max(1000),sourceId:id,
}).strict();
export const ladderSeasonSchema=z.object({
  number:z.number().int().positive().max(9999),
  startDate:archiveDateSchema.nullable(),startSourceId:id.nullable(),
  settlementDate:archiveDateSchema.nullable(),settlementSourceId:id.nullable(),
  petRewards:z.array(rewardSchema),notes:z.array(z.string().min(1).max(1000)).default([]),
}).strict();
export const ladderBanNoticeSchema=z.object({
  id,mode:z.enum(['ladder','type']),date:archiveDateSchema,sourceId:id,
  bannedPetNames:z.array(name),allowedTypes:z.array(name).optional(),
}).strict().superRefine((record,ctx)=>{
  if(new Set(record.bannedPetNames).size!==record.bannedPetNames.length)ctx.addIssue({code:'custom',message:'Duplicate ban name'});
  if(record.mode==='type'&&!record.allowedTypes?.length)ctx.addIssue({code:'custom',message:'Type tournament needs allowed main types'});
  if(record.mode==='ladder'&&record.allowedTypes)ctx.addIssue({code:'custom',message:'Ladder does not use the type tournament filter'});
});
export const ladderHistorySchema=z.object({
  schemaVersion:z.literal(1),game:z.literal('roco-web'),
  sources:z.array(ladderArchiveSourceSchema),seasons:z.array(ladderSeasonSchema),notices:z.array(ladderBanNoticeSchema),
  changes:z.array(z.object({id,date:archiveDateSchema,kind:z.enum(['fees','shop','rules','schedule']),title:name,summary:z.string().min(1).max(1200),sourceId:id}).strict()),
  observations:z.array(ladderObservationSchema),
}).strict().superRefine((data,ctx)=>{
  const unique=(values:readonly (string|number)[],label:string)=>{if(new Set(values).size!==values.length)ctx.addIssue({code:'custom',message:'Duplicate '+label});};
  unique(data.sources.map(row=>row.id),'source');unique(data.seasons.map(row=>row.number),'season');
  unique(data.notices.map(row=>row.id),'notice');unique(data.notices.map(row=>row.mode+':'+row.date),'mode/date');unique(data.changes.map(row=>row.id),'change');
  const sources=new Set(data.sources.map(row=>row.id));
  const requireSource=(value:string|null)=>{if(value!==null&&!sources.has(value))ctx.addIssue({code:'custom',message:'Unknown source '+value});};
  for(const season of data.seasons){
    requireSource(season.startSourceId);requireSource(season.settlementSourceId);
    if(Boolean(season.startDate)!==Boolean(season.startSourceId)||Boolean(season.settlementDate)!==Boolean(season.settlementSourceId))ctx.addIssue({code:'custom',message:'Season date needs its own source'});
    if(season.startDate&&season.settlementDate&&season.startDate>season.settlementDate)ctx.addIssue({code:'custom',message:'Reversed season dates'});
    unique(season.petRewards.map(row=>row.petId),'season reward');for(const reward of season.petRewards)requireSource(reward.sourceId);
  }
  for(const record of [...data.notices,...data.changes])requireSource(record.sourceId);
  let previous=-Infinity;
  for(const snapshot of data.observations){const time=Date.parse(snapshot.source.retrievedAt);if(time<=previous)ctx.addIssue({code:'custom',message:'Observations must be strictly chronological'});previous=time;}
});
export type LadderHistory=z.infer<typeof ladderHistorySchema>;
export type LadderSeason=z.infer<typeof ladderSeasonSchema>;
export type LadderBanNotice=z.infer<typeof ladderBanNoticeSchema>;
export type LadderArchiveSource=z.infer<typeof ladderArchiveSourceSchema>;
export type LadderObservation=z.infer<typeof ladderObservationSchema>;
