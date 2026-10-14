// SPDX-License-Identifier: GPL-3.0-only
import {it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {TestDatabase} from './d1';
import {app} from '../apps/api/src/index';
import {publicProfile as publicProfileSchema} from '../apps/web/src/features/workbench/contracts';

it('backfills legacy accounts by creation time and deterministic ties without changing identity or permissions',()=>{
  const db=new TestDatabase(':memory:',false);
  try {
    for(const file of readdirSync('database/migrations').filter(file=>file.endsWith('.sql')&&!file.startsWith('0009_')).sort())db.sql.exec(readFileSync(`database/migrations/${file}`,'utf8'));
    const users=[['usr_late','late','老洛克','reviewer',30],['usr_early_b','early_b','新洛克','contributor',10],['usr_early_a','early_a','另一位洛克','viewer',10]];
    const insert=db.sql.prepare('INSERT INTO users(uid,username,display_name,role,created_at) VALUES(?,?,?,?,?)');
    for(const values of users)insert.run(...values);
    const before=db.sql.prepare('SELECT * FROM users ORDER BY uid').all();
    db.sql.exec(readFileSync('database/migrations/0009_registration_numbers.sql','utf8'));
    expect(db.sql.prepare('SELECT * FROM users ORDER BY uid').all()).toEqual(before);
    expect(db.sql.prepare('SELECT * FROM user_registration_numbers ORDER BY registration_number').all()).toEqual([
      {registration_number:1,uid:'usr_early_a'}, {registration_number:2,uid:'usr_early_b'}, {registration_number:3,uid:'usr_late'},
    ]);
    insert.run('usr_next','next','下一位洛克','contributor',40);
    expect(db.sql.prepare('SELECT registration_number FROM user_registration_numbers WHERE uid=?').get('usr_next')!.registration_number).toBe(4);
  } finally {db.close();}
});

it('allocates in the account transaction and rejects renumbering, deletion and replacement',async()=>{
  const db=new TestDatabase();
  try {
    const insert=db.binding.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)');
    await insert.bind('usr_first','first','第一位',1).run();
    await expect(db.binding.batch([insert.bind('usr_failed','failed','失败登记',2),insert.bind('usr_conflict','first','重复用户名',2)])).rejects.toThrow();
    expect(db.sql.prepare('SELECT count(*) AS n FROM users').get()!.n).toBe(1);
    expect(db.sql.prepare('SELECT count(*) AS n FROM user_registration_numbers').get()!.n).toBe(1);
    await insert.bind('usr_second','second','第二位',3).run();
    expect(db.sql.prepare('SELECT registration_number FROM user_registration_numbers WHERE uid=?').get('usr_second')!.registration_number).toBe(2);
    for(const sql of [
      "UPDATE user_registration_numbers SET registration_number=9 WHERE uid='usr_first'",
      "UPDATE user_registration_numbers SET uid='usr_second' WHERE uid='usr_first'",
      "DELETE FROM user_registration_numbers WHERE uid='usr_first'",
      "INSERT OR REPLACE INTO user_registration_numbers(registration_number,uid) VALUES(9,'usr_first')",
      "INSERT OR REPLACE INTO user_registration_numbers(registration_number,uid) VALUES(1,'usr_second')",
    ])expect(()=>db.sql.exec(sql)).toThrow('immutable registration number');
    expect(db.sql.prepare('SELECT registration_number FROM user_registration_numbers WHERE uid=?').get('usr_first')!.registration_number).toBe(1);
  } finally {db.close();}
});

it('exposes the server number in public profiles without private credentials or earned contribution honors',async()=>{
  const db=new TestDatabase();
  try {
    db.sql.prepare('INSERT INTO users(uid,username,display_name,created_at) VALUES(?,?,?,?)').run('usr_member','member','社区新成员',1);
    const response=await app.request('https://api.wiki.test/users/usr_member',{},db.env());
    expect(response.status).toBe(200);
    const raw=await response.json(),profile=publicProfileSchema.parse(raw);
    expect(profile.user).toMatchObject({uid:'usr_member',registration_number:1});
    expect(profile.contributions).toEqual([]);
    expect(profile.profile?.badge).toBe('');
    expect(raw).not.toHaveProperty('account');
    expect(raw).not.toHaveProperty('csrf_token');
  } finally {db.close();}
});
