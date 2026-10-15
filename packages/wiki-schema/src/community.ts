// SPDX-License-Identifier: GPL-3.0-only
import {z} from 'zod';
import {avatarSchema, biographySchema} from './account';
import {catalogStorageKey} from './catalog-routes';

export const CURRENCY_NAME = '洛克印记';
export const CHECKIN_REWARD_MIN = 3;
export const CHECKIN_REWARD_MAX = 7;
export const STREAK_REWARD = 5;
export const HONOR_ITEMS = [
  {id:'badge-first',kind:'badge',title:'初见王国',description:'把第一次到访留在个人名片上。',price:5,icon:'sprout',tone:'mint'},
  {id:'badge-cloud',kind:'badge',title:'云间旅人',description:'一枚轻盈的云朵纪念章。',price:25,icon:'cloud',tone:'sky'},
  {id:'badge-star',kind:'badge',title:'星光书签',description:'给爱读百科的自己留一颗星。',price:50,icon:'star',tone:'lilac'},
  {id:'frame-sun',kind:'frame',title:'暖阳头像框',description:'在个人头像外点亮一圈暖金色。',price:10,icon:'sun',tone:'sun'},
  {id:'frame-night',kind:'frame',title:'星夜头像框',description:'蓝紫色的夜空，衬托你的宠物头像。',price:30,icon:'moon',tone:'lilac'},
] as const;
export const ACHIEVEMENTS = [
  {id:'achievement-first',kind:'achievement',title:'第一笔修订',description:'发布一份有效修订。',icon:'quill',tone:'sky'},
  {id:'achievement-week',kind:'achievement',title:'七日之约',description:'完成一次连续七天签到。',icon:'calendar',tone:'sun'},
  {id:'achievement-three',kind:'achievement',title:'资料拾光者',description:'累计发布三份有效修订。',icon:'book',tone:'mint'},
] as const;
export type HonorItem = typeof HONOR_ITEMS[number] | typeof ACHIEVEMENTS[number];
export const rankMetrics = ['checkins','streak','guideLikes','contributions'] as const;
export const periods = ['day','week','month','all'] as const;
export const activityViews = ['guideLikes','commentLikes','comments','contributions'] as const;
export type CommunityPeriod = typeof periods[number];
export type RankMetric = typeof rankMetrics[number];
export type ActivityView = typeof activityViews[number];

export function communityDay(seconds:number):string {return new Date((seconds+8*3600)*1000).toISOString().slice(0,10);}
export function addCommunityDays(day:string,count:number):string {return new Date(Date.parse(`${day}T00:00:00Z`)+count*86400000).toISOString().slice(0,10);}
export const calendarDaySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const time=Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time)&&value>='1970-01-01'&&value<='9998-12-31'&&new Date(time).toISOString().slice(0,10)===value;
});
export function communityBounds(period:CommunityPeriod,seconds:number) {
  const today=communityDay(seconds);
  if(period==='all')return {start:'1970-01-01',end:addCommunityDays(today,1)};
  if(period==='day')return {start:today,end:addCommunityDays(today,1)};
  if(period==='week') {const weekday=(new Date(`${today}T00:00:00Z`).getUTCDay()+6)%7;const start=addCommunityDays(today,-weekday);return {start,end:addCommunityDays(start,7)};}
  const start=`${today.slice(0,7)}-01`,date=new Date(`${start}T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+1);
  return {start,end:date.toISOString().slice(0,10)};
}

const uid=z.string().min(1).max(120),timestamp=z.number().int().nonnegative();
export const communityProfileSchema=z.object({avatar:avatarSchema,bio:biographySchema,badge:z.string().max(60),frame:z.string().max(60)});
export type CommunityProfile=z.infer<typeof communityProfileSchema>;
export const checkinRecordSchema=z.object({day:calendarDaySchema,daily_reward:z.number().int().min(3).max(7),streak_bonus:z.union([z.literal(0),z.literal(5)]),streak:z.number().int().positive(),created_at:timestamp});
export type CheckinRecord=z.infer<typeof checkinRecordSchema>;
export const communitySnapshotSchema=z.object({
  owner_uid:uid,server_time:timestamp,profile:communityProfileSchema,
  stats:z.object({checkins:z.number().int().nonnegative(),current_streak:z.number().int().nonnegative(),longest_streak:z.number().int().nonnegative(),checked_today:z.boolean(),balance:z.number().int().nonnegative(),guide_likes:z.number().int().nonnegative(),comment_likes:z.number().int().nonnegative(),comments:z.number().int().nonnegative(),contributions:z.number().int().nonnegative()}),
  recent_checkins:z.array(checkinRecordSchema).max(7),
  ledger:z.array(z.object({entry_id:z.string(),kind:z.enum(['checkin','redeem']),amount:z.number().int(),label:z.string(),created_at:timestamp})).max(100),
  purchases:z.array(z.string()).max(50),achievements:z.array(z.string()).max(50),
});
export type CommunitySnapshot=z.infer<typeof communitySnapshotSchema>;
export const calendarResponseSchema=z.object({owner_uid:uid,server_time:timestamp,start:calendarDaySchema,end:calendarDaySchema,checkins:z.array(checkinRecordSchema).max(42)});
export const calendarQuerySchema=z.object({start:calendarDaySchema,end:calendarDaySchema}).strict().refine(v=>v.start<v.end&&Date.parse(v.end)-Date.parse(v.start)<=42*86400000);
export const checkinResponseSchema=z.object({owner_uid:uid,created:z.boolean(),record:checkinRecordSchema});
export const redemptionSchema=z.object({item_id:z.string().min(1).max(60)}).strict();
export const equipSchema=z.object({slot:z.enum(['badge','frame']),item_id:z.string().max(60)}).strict();
export const rankQuerySchema=z.object({metric:z.enum(rankMetrics).default('checkins'),period:z.enum(periods).default('week')}).strict();
const rankRow=z.object({uid,display_name:z.string(),avatar:avatarSchema,value:z.number().int().positive(),rank:z.number().int().positive()});
export const rankingResponseSchema=z.object({owner_uid:uid.nullable(),server_time:timestamp,metric:z.enum(rankMetrics),period:z.enum(periods),rows:z.array(rankRow).max(50),mine:rankRow.nullable()});
export type RankingResponse=z.infer<typeof rankingResponseSchema>;

/** Discussion targets are canonical internal routes; account and action routes are excluded. */
export function canonicalCommunityPage(value:string):string {
  if(!/^\/(?!\/)/.test(value)||/[\s<>\\\u0000-\u001f\u007f]/u.test(value))throw new Error('INVALID_COMMUNITY_PAGE');
  const url=new URL(value,'https://wiki.invalid'),path=url.pathname.replace(/\/+$/u,'')+'/';
  if(path!=='/'&&!/^\/(wiki|pets|skills|bloodlines|mechanics|events|adventure|guides|help|items|tasks|places|npcs|pve|challenges|battle|tools|community)(?:\/[a-z0-9_-]+)*\/$/iu.test(path))throw new Error('INVALID_COMMUNITY_PAGE');
  const entry=url.searchParams.get('entry');
  if(entry&&!/^[a-z0-9][a-z0-9_-]{0,119}$/iu.test(entry))throw new Error('INVALID_COMMUNITY_PAGE');
  return catalogStorageKey(path+(entry&&/^\/(pets|skills|bloodlines|pve|npcs)\/$/u.test(path)?'?entry='+encodeURIComponent(entry):''));
}
export const communityPageSchema=z.string().min(1).max(1000).transform((value,ctx)=>{
  try{return canonicalCommunityPage(value);}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:'Invalid community page'});return z.NEVER;}
});
export const commentInputSchema=z.object({page:communityPageSchema,title:z.string().trim().min(1).max(150),body:z.string().trim().min(2).max(2000)}).strict();
export const likeInputSchema=z.object({target_type:z.enum(['comment','guide']),target_id:z.string().min(1).max(180),active:z.boolean()}).strict();
export const commentRowSchema=z.object({comment_id:z.string(),author_uid:uid,display_name:z.string(),avatar:avatarSchema,body:z.string(),created_at:timestamp,likes:z.number().int().nonnegative(),liked:z.boolean()});
export const discussionResponseSchema=z.object({owner_uid:uid.nullable(),page:communityPageSchema,comments:z.array(commentRowSchema).max(100),total:z.number().int().nonnegative()});
export type DiscussionResponse=z.infer<typeof discussionResponseSchema>;
export const guideLikeResponseSchema=z.object({owner_uid:uid.nullable(),target_id:z.string(),author_uid:uid.nullable(),likes:z.number().int().nonnegative(),liked:z.boolean()});
export const activityQuerySchema=z.object({view:z.enum(activityViews).default('comments'),period:z.enum(periods).default('all'),cursor:z.string().max(500).optional()}).strict();
export const activityRowSchema=z.object({event_id:z.string(),actor_uid:uid,display_name:z.string(),avatar:avatarSchema,title:z.string(),body:z.string(),href:z.string(),created_at:timestamp,received_count:z.number().int().nonnegative()});
export const activityResponseSchema=z.object({owner_uid:uid,view:z.enum(activityViews),period:z.enum(periods),rows:z.array(activityRowSchema).max(20),next_cursor:z.string().nullable()});
export type ActivityResponse=z.infer<typeof activityResponseSchema>;
