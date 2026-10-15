// SPDX-License-Identifier: GPL-3.0-only
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {z} from 'zod';
import {TestDatabase} from './d1';
import {app} from '../apps/api/src/index';
import {createSession,now} from '../packages/auth/src/index';
import {communitySnapshotSchema,discussionResponseSchema,rankingResponseSchema,activityResponseSchema,checkinResponseSchema,calendarResponseSchema} from '../packages/wiki-schema/src/community';
import type {ApiEnv} from '../apps/api/src/types';

let db:TestDatabase,env:ApiEnv;
type Session={token:string;csrf:string};
const alice='usr_community_alice',bob='usr_community_bob';
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-14T08:00:00Z'));db=new TestDatabase();env=db.env({EMAIL_VERIFICATION_REQUIRED:'false'});for(const [uid,name] of [[alice,'测试甲'],[bob,'测试乙']])db.sql.prepare('INSERT INTO users(uid,username,display_name,role,created_at) VALUES(?,?,?,\'contributor\',?)').run(uid,uid,name,now());});
afterEach(()=>{db.close();vi.useRealTimers();vi.restoreAllMocks();});
async function session(uid=alice){return createSession(env,uid,now());}
function request(path:string,body?:unknown,s?:Session,method=body===undefined?'GET':'POST',key?:string){return app.request('http://localhost:8787'+path,{method,headers:{Origin:env.WEB_ORIGIN,'X-Roco-Request':'1','Content-Type':'application/json',...(s?{Cookie:`roco_session=${s.token}`,'X-CSRF-Token':s.csrf}:{}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})},env);}
const balance=(uid=alice)=>Number(db.sql.prepare('SELECT coalesce(sum(amount),0) AS amount FROM community_ledger WHERE uid=?').get(uid)!.amount);

it('starts real accounts with zero balance, scopes private records and enforces authentication and CSRF',async()=>{
  const s=await session();
  expect((await request('/community/me')).status).toBe(401);
  expect((await request('/community/checkin',{})).status).toBe(401);
  expect((await request('/community/checkin',{}, {...s,csrf:'forged'})).status).toBe(403);
  const snapshot=communitySnapshotSchema.parse(await (await request('/community/me',undefined,s)).json());
  expect(snapshot).toMatchObject({owner_uid:alice,stats:{balance:0,checkins:0,checked_today:false},purchases:[],achievements:[]});
  expect((await request('/community/checkin',{uid:bob,day:'2030-01-01',reward:999},s)).status).toBe(400);
  expect(balance()).toBe(0);
});
it('persists exactly one fixed reward across retries and concurrent same-day requests',async()=>{
  const s=await session(),responses=await Promise.all(Array.from({length:5},()=>request('/community/checkin',{},s)));
  expect(responses.every(response=>response.status===200)).toBe(true);
  const receipts=await Promise.all(responses.map(async response=>checkinResponseSchema.parse(await response.json())));
  expect(receipts.filter(row=>row.created)).toHaveLength(1);
  expect(new Set(receipts.map(row=>row.record.daily_reward)).size).toBe(1);
  expect(db.sql.prepare('SELECT count(*) AS n FROM community_checkins').get()!.n).toBe(1);
  expect(db.sql.prepare('SELECT count(*) AS n FROM community_ledger').get()!.n).toBe(1);
  expect(balance()).toBe(receipts[0].record.daily_reward);
  const other=communitySnapshotSchema.parse(await (await request('/community/me',undefined,await session(bob))).json());
  expect(other.stats.balance).toBe(0);expect(other.recent_checkins).toEqual([]);
});
it('uses Beijing midnight, preserves streaks across months and awards a single seventh-day bonus',async()=>{
  vi.setSystemTime(new Date('2026-10-29T15:59:00Z'));
  for(let day=0;day<7;day++){
    vi.setSystemTime(new Date(Date.parse('2026-10-29T15:59:00Z')+day*86400000));
    const receipt=checkinResponseSchema.parse(await (await request('/community/checkin',{},await session())).json());
    expect(receipt.record.streak).toBe(day+1);expect(receipt.record.streak_bonus).toBe(day===6?5:0);
  }
  const previous=balance();vi.setSystemTime(new Date('2026-11-04T16:00:00Z'));
  const next=checkinResponseSchema.parse(await (await request('/community/checkin',{},await session())).json());
  expect(next.record.day).toBe('2026-11-05');expect(next.record.streak).toBe(8);expect(next.record.streak_bonus).toBe(0);
  expect(balance()).toBe(previous+next.record.daily_reward);
  vi.setSystemTime(new Date('2026-11-07T08:00:00Z'));
  const missed=checkinResponseSchema.parse(await (await request('/community/checkin',{},await session())).json());expect(missed.record.streak).toBe(1);
  const snapshot=communitySnapshotSchema.parse(await (await request('/community/me',undefined,await session())).json());
  expect(snapshot.stats).toMatchObject({checkins:9,current_streak:1,longest_streak:8});expect(snapshot.achievements).toContain('achievement-week');
});
it('rolls a check-in back when its ledger insertion fails',async()=>{
  db.sql.exec("CREATE TRIGGER fail_test_credit BEFORE INSERT ON community_ledger BEGIN SELECT RAISE(ABORT,'test credit failure'); END");
  expect((await request('/community/checkin',{},await session())).status).toBe(500);
  expect(db.sql.prepare('SELECT count(*) AS n FROM community_checkins').get()!.n).toBe(0);expect(balance()).toBe(0);
});
it('makes redemption idempotent, prevents negative balances and verifies equipment ownership and slots',async()=>{
  const s=await session();expect((await request('/community/redeem',{item_id:'badge-first'},s)).status).toBe(409);
  for(let day=0;day<5;day++){vi.setSystemTime(new Date(Date.parse('2026-10-14T08:00:00Z')+day*86400000));expect((await request('/community/checkin',{},await session())).status).toBe(200);}
  const fresh=await session(),before=balance();
  for(let n=0;n<2;n++)expect((await request('/community/redeem',{item_id:'badge-first'},fresh)).status).toBe(200);
  expect(balance()).toBe(before-5);
  expect((await request('/community/equip',{slot:'frame',item_id:'badge-first'},fresh)).status).toBe(400);
  expect((await request('/community/equip',{slot:'badge',item_id:'achievement-first'},fresh)).status).toBe(403);
  expect((await request('/community/equip',{slot:'badge',item_id:'badge-first'},fresh)).status).toBe(200);
  expect((await request('/community/redeem',{item_id:'frame-sun'},fresh)).status).toBe(200);
  expect((await request('/community/equip',{slot:'frame',item_id:'frame-sun'},fresh)).status).toBe(200);
  expect(db.sql.prepare('SELECT badge,frame FROM community_profiles WHERE uid=?').get(alice)).toEqual({badge:'badge-first',frame:'frame-sun'});
  expect(balance()).toBe(before-15);
});
it('updates avatar and biography while keeping username, UID and unrelated community equipment intact',async()=>{
  const s=await session();
  expect((await request('/me',{display_name:'新昵称',avatar:'haifu',bio:'这是我的简介。'},s,'PATCH')).status).toBe(200);
  expect(await (await request('/me',undefined,s)).json()).toMatchObject({user:{uid:alice,username:alice,display_name:'新昵称'},profile:{avatar:'haifu',bio:'这是我的简介。'}});
  expect((await request('/me',{display_name:'新昵称',avatar:'https://attacker.test/image',balance:1000},s,'PATCH')).status).toBe(400);
  expect((await request('/me',{display_name:'再次改名'},s,'PATCH')).status).toBe(200);
  expect(db.sql.prepare('SELECT avatar,bio FROM community_profiles WHERE uid=?').get(alice)).toEqual({avatar:'haifu',bio:'这是我的简介。'});
});
it('serializes competing redemption costs without spending the same balance twice',async()=>{
  for(let day=0;day<9;day++){vi.setSystemTime(new Date(Date.parse('2026-10-14T08:00:00Z')+day*86400000));expect((await request('/community/checkin',{},await session())).status).toBe(200);}
  const s=await session(),before=balance();
  const results=await Promise.all([request('/community/redeem',{item_id:'badge-star'},s),request('/community/redeem',{item_id:'frame-night'},s)]);
  expect(results.filter(response=>response.status===200)).toHaveLength(1);
  expect(results.filter(response=>response.status===409)).toHaveLength(1);
  const spent=Number(db.sql.prepare('SELECT sum(price) AS total FROM community_purchases WHERE uid=?').get(alice)!.total);
  expect(balance()).toBe(before-spent);expect(balance()).toBeGreaterThanOrEqual(0);
});
it('serves bounded personal calendar ranges and real tied rankings without exposing account credentials',async()=>{
  const a=await session(),b=await session(bob);await request('/community/checkin',{},a);await request('/community/checkin',{},b);
  expect((await request('/community/checkins?start=2026-10-01&end=2027-01-01',undefined,a)).status).toBe(400);
  const calendar=calendarResponseSchema.parse(await (await request('/community/checkins?start=2026-10-01&end=2026-11-01',undefined,a)).json());expect(calendar.owner_uid).toBe(alice);expect(calendar.checkins).toHaveLength(1);
  const ranks=rankingResponseSchema.parse(await (await request('/community/rankings?metric=checkins&period=week',undefined,a)).json());
  expect(ranks.rows.map(row=>row.rank)).toEqual([1,1]);expect(ranks.mine!.uid).toBe(alice);
  expect(JSON.stringify(ranks)).not.toMatch(/password|csrf|email|username|fixture/);
});
it('uses authenticated comment authors, preserves idempotency and derives likes and activity from real records',async()=>{
  const a=await session(),b=await session(bob),body={page:'/skills/?entry=official-skill-3806&unused=1',title:'阴阳众莫',body:'这条分支需要更多实测依据。'},key='synthetic_comment_key_0001';
  const first=await request('/community/comments',body,a,'POST',key);expect(first.status).toBe(201);const id=z.object({comment_id:z.string()}).parse(await first.json()).comment_id;
  expect((await request('/community/comments',body,a,'POST',key)).status).toBe(201);expect(db.sql.prepare('SELECT count(*) AS n FROM community_comments').get()!.n).toBe(1);
  expect((await request('/community/comments',{...body,body:'不同正文'},a,'POST',key)).status).toBe(409);
  expect((await request('/community/comments',{...body,author_uid:bob},a,'POST','another_synthetic_key')).status).toBe(400);
  expect((await request('/community/likes',{target_type:'comment',target_id:id,active:true},a)).status).toBe(403);
  expect((await request('/community/likes',{target_type:'comment',target_id:id,active:true},b)).status).toBe(200);
  const discussion=discussionResponseSchema.parse(await (await request('/community/discussion?page='+encodeURIComponent('/skills/?entry=official-skill-3806'))).json());
  expect(discussion).toMatchObject({owner_uid:null,total:1,comments:[{author_uid:alice,likes:1,liked:false}]});
  const numbered=discussionResponseSchema.parse(await (await request('/community/discussion?page='+encodeURIComponent('/skills/3806/'))).json());
  expect(numbered).toEqual(discussion);
  expect((await request('/community/comments',{...body,page:'/skills/3806/'},a,'POST',key)).status).toBe(201);
  expect(db.sql.prepare('SELECT count(*) AS n FROM community_comments').get()!.n).toBe(1);
  const firstAt=db.sql.prepare('SELECT first_at FROM community_likes').get()!.first_at;
  await request('/community/likes',{target_type:'comment',target_id:id,active:false},b);vi.setSystemTime(new Date('2026-10-14T09:00:00Z'));await request('/community/likes',{target_type:'comment',target_id:id,active:true},b);
  expect(db.sql.prepare('SELECT first_at FROM community_likes').get()!.first_at).toBe(firstAt);
  const activity=activityResponseSchema.parse(await (await request('/community/activity?view=commentLikes&period=all',undefined,a)).json());expect(activity.rows[0]).toMatchObject({actor_uid:bob,href:'/skills/3806/#comment-'+id});
  expect((await request('/community/comments/'+id,undefined,b,'DELETE')).status).toBe(403);
  expect((await request('/community/comments/'+id,undefined,a,'DELETE')).status).toBe(200);
  expect((await request('/community/comments/'+id,undefined,a,'DELETE')).status).toBe(200);
  expect(db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE action='community_comment_removed'").get()!.n).toBe(1);
  expect((await request('/community/comments',body,a,'POST',key)).status).toBe(409);
  expect(communitySnapshotSchema.parse(await (await request('/community/me',undefined,a)).json()).stats.comment_likes).toBe(0);
  for(const page of ['/account/','/%61ccount/','//attacker.test/','/api/','/img/test.png'])expect((await request('/community/discussion?page='+encodeURIComponent(page))).status).toBe(400);
});
it('does not display a contribution achievement after its publication evidence is withdrawn',async()=>{
  db.sql.prepare("INSERT INTO community_profiles(uid,badge,updated_at) VALUES(?,'achievement-first',?)").run(alice,now());
  const me=await (await request('/me',undefined,await session())).json();
  expect(me).toMatchObject({profile:{badge:''}});
  expect(await (await request('/users/'+alice)).json()).toMatchObject({profile:{badge:''}});
});
