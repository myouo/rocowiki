// SPDX-License-Identifier: GPL-3.0-only
import {DatabaseSync} from 'node:sqlite';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';

export function ladderRefreshLockPath(historyPath:string|URL){
  return join(dirname(resolve(historyPath instanceof URL?fileURLToPath(historyPath):historyPath)),'.ladder-refresh.lock.sqlite');
}

/** OS-backed process mutex only; no application data is stored in this ignored file.
 * BEGIN IMMEDIATE is exclusive across writers and releases on process exit.
 * A zero SQLite busy timeout plus async polling also lets concurrent callers
 * in this Node process finish their filesystem operations without deadlocking.
 */
export async function withLadderRefreshLock<T>(historyPath:string|URL,operation:()=>Promise<T>):Promise<T>{
  const db=new DatabaseSync(ladderRefreshLockPath(historyPath));
  let acquired=false;
  const started=performance.now();
  try{
    db.exec('PRAGMA busy_timeout=0');
    while(!acquired){
      try{db.exec('BEGIN IMMEDIATE');acquired=true;}
      catch(error){
        const code=(error as {errcode?:number}).errcode;
        if(typeof code!=='number'||![5,6].includes(code&255))throw error;
        if(performance.now()-started>=30_000)throw new Error('Timed out waiting for the ladder refresh transaction');
        await pause(20);
      }
    }
    return await operation();
  }finally{
    try{if(acquired)db.exec('ROLLBACK');}finally{db.close();}
  }
}
