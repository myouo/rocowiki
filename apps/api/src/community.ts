// SPDX-License-Identifier: GPL-3.0-only
import type {Hono} from 'hono';
import {z} from 'zod';
import {now,newId,hash} from '../../../packages/auth/src/index';
import {catalog} from '../../../packages/wiki-schema/src/index';
import {
  HONOR_ITEMS,ACHIEVEMENTS,CHECKIN_REWARD_MIN,CHECKIN_REWARD_MAX,STREAK_REWARD,
  communityDay,addCommunityDays,communityBounds,calendarQuerySchema,redemptionSchema,equipSchema,
  rankQuerySchema,communityPageSchema,commentInputSchema,likeInputSchema,activityQuerySchema,
  type CommunitySnapshot,type CommunityProfile,type CheckinRecord,type RankingResponse,type ActivityResponse,type DiscussionResponse,
} from '../../../packages/wiki-schema/src/community';
import type {ApiEnv,Bindings} from './types';

export class CommunityError extends Error {constructor(public code:string,public status=400){super(code);}}
type HttpHelpers={body:(request:Request,limit?:number)=>Promise<unknown>;rate:(env:ApiEnv,key:string,max:number,seconds:number)=>Promise<void>};
const checkinColumns='day,daily_reward,streak_bonus,streak,created_at';
// Publication evidence and changed content are required; drafts never count as contributions.
const publishedSql="SELECT s.uid,s.revision_id,s.page_id,s.edit_summary,min(e.created_at) AS first_at FROM submissions s JOIN submission_content c USING(revision_id) JOIN git_links g USING(revision_id) JOIN publication_events e USING(revision_id) JOIN deployments d ON d.release_id=e.release_id AND d.status='verified' JOIN users u ON u.uid=s.uid WHERE s.status='published' AND e.action='published' AND u.disabled_at IS NULL AND trim(c.content)!=trim(c.base_content) GROUP BY s.revision_id";
const effectiveLikesSql=`SELECT l.uid,l.target_type,l.target_id,l.first_at,coalesce(c.author_uid,p.uid) AS author_uid FROM community_likes l JOIN users liker ON liker.uid=l.uid AND liker.disabled_at IS NULL LEFT JOIN community_comments c ON l.target_type='comment' AND c.comment_id=l.target_id AND c.removed_at IS NULL LEFT JOIN (${publishedSql}) p ON l.target_type='guide' AND p.revision_id=l.target_id JOIN users author ON author.uid=coalesce(c.author_uid,p.uid) AND author.disabled_at IS NULL WHERE l.active=1 AND l.uid!=author.uid`;

function sqlError(error:unknown):never {
  const code=error instanceof Error?['INSUFFICIENT_MARKS','COMMUNITY_DAY_CHANGED','COMMUNITY_STREAK_CHANGED'].find(code=>error.message.includes(code)):undefined;
  if(code)throw new CommunityError(code,409);
  throw error;
}
export async function communityProfile(env:ApiEnv,uid:string):Promise<CommunityProfile> {
  const profile=await env.DB.prepare('SELECT avatar,bio,badge,frame FROM community_profiles WHERE uid=?').bind(uid).first<CommunityProfile>()??{avatar:'dimo',bio:'',badge:'',frame:''};
  if(profile.badge){
    const permitted=await env.DB.prepare(`SELECT EXISTS(SELECT 1 FROM community_purchases WHERE uid=? AND item_id=?) OR (?='achievement-week' AND coalesce((SELECT max(streak) FROM community_checkins WHERE uid=?),0)>=7) OR (? IN ('achievement-first','achievement-three') AND (SELECT count(*) FROM (${publishedSql}) WHERE uid=?)>=CASE WHEN ?='achievement-first' THEN 1 ELSE 3 END) AS permitted`).bind(uid,profile.badge,profile.badge,uid,profile.badge,uid,profile.badge).first<{permitted:number}>();
    if(!permitted?.permitted)profile.badge='';
  }
  return profile;
}
export async function communitySnapshot(env:ApiEnv,uid:string):Promise<CommunitySnapshot> {
  const time=now(),today=communityDay(time);
  const rows=await env.DB.batch([
    env.DB.prepare('SELECT avatar,bio,badge,frame FROM community_profiles WHERE uid=?').bind(uid),
    env.DB.prepare('SELECT count(*) AS total,coalesce(max(streak),0) AS longest FROM community_checkins WHERE uid=? AND day<=?').bind(uid,today),
    env.DB.prepare(`SELECT ${checkinColumns} FROM community_checkins WHERE uid=? AND day<=? ORDER BY day DESC LIMIT 1`).bind(uid,today),
    env.DB.prepare('SELECT coalesce(sum(amount),0) AS balance FROM community_ledger WHERE uid=?').bind(uid),
    env.DB.prepare(`SELECT ${checkinColumns} FROM community_checkins WHERE uid=? AND day>=? AND day<=? ORDER BY day`).bind(uid,addCommunityDays(today,-6),today),
    env.DB.prepare('SELECT entry_id,kind,amount,label,created_at FROM community_ledger WHERE uid=? ORDER BY created_at DESC,entry_id DESC LIMIT 100').bind(uid),
    env.DB.prepare('SELECT item_id FROM community_purchases WHERE uid=? ORDER BY created_at,item_id').bind(uid),
    env.DB.prepare(`SELECT (SELECT count(*) FROM (${publishedSql}) WHERE uid=? AND first_at<=?) AS contributions,(SELECT count(*) FROM community_comments WHERE author_uid=? AND removed_at IS NULL AND created_at<=?) AS comments,(SELECT count(*) FROM (${effectiveLikesSql}) WHERE author_uid=? AND target_type='guide' AND first_at<=?) AS guide_likes,(SELECT count(*) FROM (${effectiveLikesSql}) WHERE author_uid=? AND target_type='comment' AND first_at<=?) AS comment_likes`).bind(uid,time,uid,time,uid,time,uid,time),
  ]);
  const profile=(rows[0].results[0] as CommunityProfile|undefined)??{avatar:'dimo',bio:'',badge:'',frame:''};
  const counts=rows[1].results[0] as {total:number;longest:number},last=rows[2].results[0] as CheckinRecord|undefined;
  const influence=rows[7].results[0] as {contributions:number;comments:number;guide_likes:number;comment_likes:number};
  const achievements=ACHIEVEMENTS.filter(item=>item.id==='achievement-week'?counts.longest>=7:influence.contributions>=(item.id==='achievement-first'?1:3)).map(item=>item.id);
  const purchases=(rows[6].results as {item_id:string}[]).map(row=>row.item_id);
  // Withdrawn contributions cannot keep an achievement equipped solely through client state.
  if(profile.badge&&!purchases.includes(profile.badge)&&!achievements.some(id=>id===profile.badge))profile.badge='';
  if(profile.frame&&!purchases.includes(profile.frame))profile.frame='';
  return {
    owner_uid:uid,server_time:time,profile,
    stats:{checkins:counts.total,longest_streak:counts.longest,current_streak:last&&[today,addCommunityDays(today,-1)].includes(last.day)?last.streak:0,checked_today:last?.day===today,balance:(rows[3].results[0] as {balance:number}).balance,...influence},
    recent_checkins:rows[4].results as CheckinRecord[],ledger:rows[5].results as CommunitySnapshot['ledger'],purchases,achievements,
  };
}
function drawReward():number {
  const range=CHECKIN_REWARD_MAX-CHECKIN_REWARD_MIN+1,limit=Math.floor(0x100000000/range)*range,bytes=new Uint32Array(1);
  do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);
  return CHECKIN_REWARD_MIN+bytes[0]%range;
}
export async function checkIn(env:ApiEnv,uid:string) {
  const time=now(),day=communityDay(time);
  const prior=await env.DB.prepare('SELECT day,streak FROM community_checkins WHERE uid=? AND day<? ORDER BY day DESC LIMIT 1').bind(uid,day).first<{day:string;streak:number}>();
  const streak=prior?.day===addCommunityDays(day,-1)?prior.streak+1:1;
  if(communityDay(now())!==day)throw new CommunityError('COMMUNITY_DAY_CHANGED',409);
  let created=false;
  try {
    const result=await env.DB.prepare('INSERT INTO community_checkins(uid,day,daily_reward,streak_bonus,streak,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(uid,day) DO NOTHING').bind(uid,day,drawReward(),streak%7===0?STREAK_REWARD:0,streak,time).run();
    created=result.meta.changes>0;
  }catch(error){sqlError(error);}
  const record=await env.DB.prepare(`SELECT ${checkinColumns} FROM community_checkins WHERE uid=? AND day=?`).bind(uid,day).first<CheckinRecord>();
  if(!record)throw new CommunityError('COMMUNITY_RECORD_UNCONFIRMED',503);
  return {owner_uid:uid,created,record};
}

type Cursor={at:number;id:string};
const cursorSchema=z.object({at:z.number().int().nonnegative(),id:z.string().min(1).max(240)}).strict();
function readCursor(value?:string):Cursor {if(!value)return {at:Number.MAX_SAFE_INTEGER,id:'~'};try{return cursorSchema.parse(JSON.parse(atob(value)));}catch{throw new CommunityError('INVALID_COMMUNITY_CURSOR');}}
const writeCursor=(value:Cursor)=>btoa(JSON.stringify(value));
const pageHref=(id:string)=>{const page=catalog.find(page=>page.id===id);return page?`/wiki/${page.slug.replace(/^\/+|\/+$/gu,'')}/`:'/community/';};

export function registerCommunityRoutes(app:Hono<Bindings>,http:HttpHelpers) {
  app.get('/community/me',async c=>c.json(await communitySnapshot(c.env,c.get('session').uid)));
  app.post('/community/checkin',async c=>{
    z.object({}).strict().parse(await http.body(c.req.raw,2048));
    await http.rate(c.env,`community-checkin:${c.get('session').uid}`,30,3600);
    return c.json(await checkIn(c.env,c.get('session').uid));
  });
  app.get('/community/checkins',async c=>{
    const {start,end}=calendarQuerySchema.parse(c.req.query()),uid=c.get('session').uid;
    const rows=await c.env.DB.prepare(`SELECT ${checkinColumns} FROM community_checkins WHERE uid=? AND day>=? AND day<? ORDER BY day LIMIT 42`).bind(uid,start,end).all<CheckinRecord>();
    return c.json({owner_uid:uid,server_time:now(),start,end,checkins:rows.results});
  });
  app.post('/community/redeem',async c=>{
    const {item_id}=redemptionSchema.parse(await http.body(c.req.raw,2048)),uid=c.get('session').uid;
    await http.rate(c.env,`community-redeem:${uid}`,60,3600);
    const item=HONOR_ITEMS.find(item=>item.id===item_id);if(!item)throw new CommunityError('UNKNOWN_HONOR_ITEM');
    try{await c.env.DB.prepare('INSERT INTO community_purchases(uid,item_id,price,created_at) VALUES(?,?,?,?) ON CONFLICT(uid,item_id) DO NOTHING').bind(uid,item.id,item.price,now()).run();}catch(error){sqlError(error);}
    return c.json({owner_uid:uid,item_id});
  });
  app.post('/community/equip',async c=>{
    const {slot,item_id}=equipSchema.parse(await http.body(c.req.raw,2048)),uid=c.get('session').uid;
    const item=[...HONOR_ITEMS,...ACHIEVEMENTS].find(item=>item.id===item_id);
    if(item_id&&(!item||(slot==='frame'?!('price' in item)||item.kind!=='frame':item.kind==='frame')))throw new CommunityError('INVALID_HONOR_SLOT');
    const column=slot==='frame'?'frame':'badge';
    const permitted=!item_id?'1':item?.kind==='achievement'?item.id==='achievement-week'
      ? 'coalesce((SELECT max(streak) FROM community_checkins WHERE uid=?),0)>=7'
      : `(SELECT count(*) FROM (${publishedSql}) WHERE uid=?)>=${item.id==='achievement-first'?1:3}`
      : 'EXISTS(SELECT 1 FROM community_purchases WHERE uid=? AND item_id=?)';
    const permissionValues=!item_id?[]:item?.kind==='achievement'?[uid]:[uid,item_id];
    const result=await c.env.DB.prepare(`INSERT INTO community_profiles(uid,${column},updated_at) SELECT ?,?,? WHERE (${permitted}) ON CONFLICT(uid) DO UPDATE SET ${column}=excluded.${column},updated_at=excluded.updated_at`).bind(uid,item_id,now(),...permissionValues).run();
    if(!result.meta.changes)throw new CommunityError('HONOR_NOT_OWNED',403);
    return c.json({owner_uid:uid,slot,item_id});
  });
  app.get('/community/rankings',async c=>{
    const {metric,period}=rankQuerySchema.parse(c.req.query()),time=now(),bounds=communityBounds(period,time),owner=c.get('session')?.uid??null;
    const source=metric==='checkins'||metric==='streak'
      ? `SELECT uid,${metric==='checkins'?'count(*)':'max(streak)'} AS value FROM community_checkins WHERE day>=? AND day<? GROUP BY uid`
      : metric==='contributions'?`SELECT uid,count(*) AS value FROM (${publishedSql}) WHERE first_at>=? AND first_at<? AND first_at<=? GROUP BY uid`
      : `SELECT author_uid AS uid,count(*) AS value FROM (${effectiveLikesSql}) WHERE target_type='guide' AND first_at>=? AND first_at<? AND first_at<=? GROUP BY author_uid`;
    const bindings=metric==='checkins'||metric==='streak'?[bounds.start,bounds.end]:[Date.parse(`${bounds.start}T00:00:00+08:00`)/1000,Date.parse(`${bounds.end}T00:00:00+08:00`)/1000,time];
    const query=`WITH scores AS (${source}),ranked AS (SELECT s.uid,u.display_name,coalesce(p.avatar,'dimo') AS avatar,s.value,rank() OVER(ORDER BY s.value DESC) AS rank FROM scores s JOIN users u ON u.uid=s.uid AND u.disabled_at IS NULL LEFT JOIN community_profiles p ON p.uid=s.uid WHERE s.value>0) `;
    const results=await c.env.DB.batch([
      c.env.DB.prepare(query+'SELECT * FROM ranked ORDER BY value DESC,uid LIMIT 50').bind(...bindings),
      c.env.DB.prepare(query+'SELECT * FROM ranked WHERE uid=?').bind(...bindings,owner),
    ]);
    return c.json({owner_uid:owner,server_time:time,metric,period,rows:results[0].results,mine:results[1].results[0]??null} as RankingResponse);
  });

  app.get('/community/discussion',async c=>{
    const page=communityPageSchema.parse(c.req.query('page')),uid=c.get('session')?.uid??null;
    const [comments,count]=await c.env.DB.batch([
      c.env.DB.prepare(`SELECT c.comment_id,c.author_uid,u.display_name,coalesce(p.avatar,'dimo') AS avatar,c.body,c.created_at,(SELECT count(*) FROM (${effectiveLikesSql}) l WHERE l.target_type='comment' AND l.target_id=c.comment_id) AS likes,EXISTS(SELECT 1 FROM (${effectiveLikesSql}) l WHERE l.uid=? AND l.target_type='comment' AND l.target_id=c.comment_id) AS liked FROM community_comments c JOIN users u ON u.uid=c.author_uid AND u.disabled_at IS NULL LEFT JOIN community_profiles p ON p.uid=c.author_uid WHERE c.page=? AND c.removed_at IS NULL ORDER BY c.created_at DESC,c.comment_id DESC LIMIT 100`).bind(uid,page),
      c.env.DB.prepare('SELECT count(*) AS total FROM community_comments c JOIN users u ON u.uid=c.author_uid AND u.disabled_at IS NULL WHERE c.page=? AND c.removed_at IS NULL').bind(page),
    ]);
    const stored=comments.results as (Omit<DiscussionResponse['comments'][number],'liked'>&{liked:number})[];
    return c.json({owner_uid:uid,page,comments:stored.map(row=>({...row,liked:Boolean(row.liked)})),total:(count.results[0] as {total:number}).total});
  });
  app.get('/community/guide-like',async c=>{
    const id=z.string().min(1).max(180).parse(c.req.query('id')),uid=c.get('session')?.uid??null;
    const author=await c.env.DB.prepare(`SELECT uid FROM (${publishedSql}) WHERE revision_id=?`).bind(id).first<{uid:string}>();
    const counts=await c.env.DB.prepare(`SELECT count(*) AS likes,max(CASE WHEN uid=? THEN 1 ELSE 0 END) AS liked FROM (${effectiveLikesSql}) WHERE target_type='guide' AND target_id=?`).bind(uid,id).first<{likes:number;liked:number|null}>();
    return c.json({owner_uid:uid,target_id:id,author_uid:author?.uid??null,likes:counts?.likes??0,liked:Boolean(counts?.liked)});
  });
  app.post('/community/comments',async c=>{
    const input=commentInputSchema.parse(await http.body(c.req.raw,16000)),uid=c.get('session').uid;
    await http.rate(c.env,`community-comment:${uid}`,20,3600);
    const key=z.string().min(16).max(100).regex(/^[a-z0-9_-]+$/iu).parse(c.req.header('Idempotency-Key')),requestHash=await hash(JSON.stringify(input));
    await c.env.DB.prepare('INSERT INTO community_comments(comment_id,author_uid,page,title,body,created_at,request_key,request_hash) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(author_uid,request_key) DO NOTHING').bind(newId('cmt'),uid,input.page,input.title,input.body,now(),key,requestHash).run();
    const comment=await c.env.DB.prepare('SELECT comment_id,request_hash,removed_at FROM community_comments WHERE author_uid=? AND request_key=?').bind(uid,key).first<{comment_id:string;request_hash:string;removed_at:number|null}>();
    if(!comment)throw new CommunityError('COMMUNITY_RECORD_UNCONFIRMED',503);
    if(comment.request_hash!==requestHash)throw new CommunityError('IDEMPOTENCY_MISMATCH',409);
    if(comment.removed_at!==null)throw new CommunityError('COMMENT_REMOVED',409);
    return c.json({owner_uid:uid,comment_id:comment.comment_id},201);
  });
  app.delete('/community/comments/:id',async c=>{
    const uid=c.get('session').uid,id=c.req.param('id'),role=c.get('session').role;
    const result=await c.env.DB.batch([
      c.env.DB.prepare('UPDATE community_comments SET removed_at=? WHERE comment_id=? AND removed_at IS NULL AND (author_uid=? OR ? IN (\'reviewer\',\'admin\'))').bind(now(),id,uid,role),
      c.env.DB.prepare("INSERT INTO audit_events(event_id,actor_uid,action,target_id,ts) SELECT ?,?,'community_comment_removed',?,? WHERE changes()>0").bind(newId('evt'),uid,id,now()),
    ]);
    if(!result[0].meta.changes){const comment=await c.env.DB.prepare('SELECT author_uid,removed_at FROM community_comments WHERE comment_id=?').bind(id).first<{author_uid:string;removed_at:number|null}>();if(!comment)throw new CommunityError('COMMENT_NOT_FOUND',404);if(comment.author_uid!==uid&&!['reviewer','admin'].includes(role))throw new CommunityError('FORBIDDEN',403);}
    return c.json({owner_uid:uid,ok:true});
  });
  app.post('/community/likes',async c=>{
    const input=likeInputSchema.parse(await http.body(c.req.raw,2048)),uid=c.get('session').uid;
    await http.rate(c.env,`community-like:${uid}`,120,3600);
    const author=input.target_type==='comment'
      ? await c.env.DB.prepare('SELECT c.author_uid AS uid FROM community_comments c JOIN users u ON u.uid=c.author_uid AND u.disabled_at IS NULL WHERE c.comment_id=? AND c.removed_at IS NULL').bind(input.target_id).first<{uid:string}>()
      : await c.env.DB.prepare(`SELECT uid FROM (${publishedSql}) WHERE revision_id=?`).bind(input.target_id).first<{uid:string}>();
    if(!author)throw new CommunityError('LIKE_TARGET_NOT_FOUND',404);
    if(author.uid===uid)throw new CommunityError('SELF_LIKE_FORBIDDEN',403);
    await c.env.DB.prepare('INSERT INTO community_likes(uid,target_type,target_id,first_at,active) VALUES(?,?,?,?,?) ON CONFLICT(uid,target_type,target_id) DO UPDATE SET active=excluded.active').bind(uid,input.target_type,input.target_id,now(),input.active?1:0).run();
    return c.json({owner_uid:uid,active:input.active});
  });
  app.get('/community/activity',async c=>{
    const {view,period,cursor}=activityQuerySchema.parse(c.req.query()),uid=c.get('session').uid,time=now(),bounds=communityBounds(period,time),after=readCursor(cursor);
    const start=Date.parse(`${bounds.start}T00:00:00+08:00`)/1000,end=Date.parse(`${bounds.end}T00:00:00+08:00`)/1000;
    let query:string;
    if(view==='comments')query=`SELECT c.comment_id AS event_id,c.author_uid AS actor_uid,u.display_name,coalesce(p.avatar,'dimo') AS avatar,c.title,c.body,c.page AS href,c.created_at,(SELECT count(*) FROM (${effectiveLikesSql}) l WHERE l.target_type='comment' AND l.target_id=c.comment_id) AS received_count FROM community_comments c JOIN users u ON u.uid=c.author_uid LEFT JOIN community_profiles p ON p.uid=c.author_uid WHERE c.author_uid=? AND c.removed_at IS NULL`;
    else if(view==='contributions')query=`SELECT s.revision_id AS event_id,s.uid AS actor_uid,u.display_name,coalesce(p.avatar,'dimo') AS avatar,s.page_id AS title,s.edit_summary AS body,s.page_id AS href,s.first_at AS created_at,0 AS received_count FROM (${publishedSql}) s JOIN users u ON u.uid=s.uid LEFT JOIN community_profiles p ON p.uid=s.uid WHERE s.uid=?`;
    else query=`SELECT l.uid||':'||l.target_type||':'||l.target_id AS event_id,l.uid AS actor_uid,u.display_name,coalesce(p.avatar,'dimo') AS avatar,coalesce(c.title,s.page_id) AS title,coalesce(c.body,'') AS body,coalesce(c.page,s.page_id) AS href,l.first_at AS created_at,0 AS received_count FROM (${effectiveLikesSql}) l JOIN users u ON u.uid=l.uid LEFT JOIN community_profiles p ON p.uid=l.uid LEFT JOIN community_comments c ON l.target_type='comment' AND c.comment_id=l.target_id LEFT JOIN (${publishedSql}) s ON l.target_type='guide' AND s.revision_id=l.target_id WHERE l.author_uid=? AND l.target_type='${view==='guideLikes'?'guide':'comment'}'`;
    const result=await c.env.DB.prepare(`SELECT * FROM (${query}) WHERE created_at>=? AND created_at<? AND created_at<=? AND (created_at<? OR (created_at=? AND event_id<?)) ORDER BY created_at DESC,event_id DESC LIMIT 21`).bind(uid,start,end,time,after.at,after.at,after.id).all<ActivityResponse['rows'][number]>();
    const rows=result.results.slice(0,20).map(row=>({...row,href:row.href.startsWith('/')?row.href+(view==='contributions'?'':'#comment-'+(view==='comments'?row.event_id:row.event_id.split(':').at(-1))):pageHref(row.href)}));
    const tail=rows.at(-1);
    return c.json({owner_uid:uid,view,period,rows,next_cursor:result.results.length>20&&tail?writeCursor({at:tail.created_at,id:tail.event_id}):null});
  });
}
