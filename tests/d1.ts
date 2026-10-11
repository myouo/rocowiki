import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import type {ApiEnv} from '../apps/api/src/types';
const config=JSON.parse(readFileSync('apps/api/wrangler.jsonc','utf8'));

export class TestDatabase {
  readonly sql:DatabaseSync;
  readonly binding:D1Database;
  constructor(file=':memory:',migrate=true) {
    this.sql=new DatabaseSync(file);
    if(migrate)for(const file of readdirSync('database/migrations').filter(file=>file.endsWith('.sql')).sort())this.sql.exec(readFileSync(`database/migrations/${file}`,'utf8'));
    this.binding={
      prepare:(query:string)=>this.prepare(query),
      batch:async<T>(statements:D1PreparedStatement[])=>{
        this.sql.exec('BEGIN IMMEDIATE');
        try {const result: D1Result<T>[]=[];for(const s of statements)result.push(await s.all<T>());this.sql.exec('COMMIT');return result;}
        catch(error){this.sql.exec('ROLLBACK');throw error;}
      },
      exec:async(query:string)=>{this.sql.exec(query);return {count:1,duration:0};}
    } as D1Database;
  }
  private prepare(query:string,values:(string|number|null)[]=[]):D1PreparedStatement {
    const result=<T>():D1Result<T>=>{
      const statement=this.sql.prepare(query),rows=statement.columns().length?statement.all(...values):[];
      if(!statement.columns().length)statement.run(...values);
      const changes=this.sql.prepare('SELECT changes() AS n').get()!.n;
      return {success:true,results:rows as T[],meta:{changes:Number(changes),duration:0,last_row_id:0,changed_db:Number(changes)>0,size_after:0,rows_read:rows.length,rows_written:Number(changes)}};
    };
    return {
      bind:(...args:unknown[])=>this.prepare(query,args as (string|number|null)[]),
      first:async<T>(column?:string)=>{const r=result<Record<string,unknown>>().results[0];return (r?(column?r[column]:r):null) as T|null;},
      all:async<T>()=>result<T>(),run:async<T>()=>result<T>(),
      raw:async<T>()=>result<Record<string,unknown>>().results.map(r=>Object.values(r)) as T[]
    } as D1PreparedStatement;
  }
  env(overrides:Partial<ApiEnv>={}):ApiEnv {return {...config.vars,DB:this.binding,...overrides};}
  close(){this.sql.close();}
}
