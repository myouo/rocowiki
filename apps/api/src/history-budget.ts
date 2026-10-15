// SPDX-License-Identifier: GPL-3.0-only
import {hash,now} from '../../../packages/auth/src/index';
import {GitError} from '../../../packages/git-wrapper/src/index';
import type {ApiEnv} from './types';

/** A rolling, cross-IP budget for cache misses. Include the edge minute so
 * adjacent wall-clock buckets cannot double-spend one upstream hour. */
export async function reserveHistoryRead(env:ApiEnv,limit=3500,seconds=now()):Promise<void> {
  const minute=Math.floor(seconds/60);
  const keys=await Promise.all(Array.from({length:61},(_,offset)=>hash(`github-public-history:${minute-offset}`)));
  const row=await env.DB.prepare(`INSERT INTO rate_limits(key_hash,count,expires_at) SELECT ?,1,? WHERE (SELECT coalesce(sum(count),0) FROM rate_limits WHERE key_hash IN (${keys.map(()=>'?').join(',')}))<? ON CONFLICT(key_hash) DO UPDATE SET count=count+1 RETURNING count`).bind(keys[0],(minute+62)*60,...keys,limit).first<{count:number}>();
  if(!row)throw new GitError('HISTORY_RATE_LIMITED',503);
}
