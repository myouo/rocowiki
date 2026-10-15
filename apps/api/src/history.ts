// SPDX-License-Identifier: GPL-3.0-only
import type {Hono} from 'hono';
import {historyQuerySchema,historySha,type HistoryAuthor} from '../../../packages/wiki-schema/src/history';
import {PublicGitHistory} from '../../../packages/git-wrapper/src/history';
import {GitError} from '../../../packages/git-wrapper/src/index';
import type {Bindings} from './types';
import {historySources} from './history-sources';
import {reserveHistoryRead} from './history-budget';

export function registerHistoryRoutes(app:Hono<Bindings>) {
  app.get('/history',async c=>{
    const input=historyQuerySchema.parse(c.req.query());
    let sources;try{sources=historySources(input.page);}catch{throw new GitError('HISTORY_PAGE_NOT_FOUND',404);}
    const source=input.source?sources.find(row=>row.id===input.source):sources[0];
    if(!source)throw new GitError('HISTORY_SOURCE_NOT_FOUND',404);
    const git=new PublicGitHistory(c.env,fetch,typeof caches==='undefined'?undefined:await caches.open('rocowiki-public-history-v1'),()=>reserveHistoryRead(c.env)),ref=await git.reference(input.ref);
    const rows=await git.list(source,ref,input.cursor);
    const ids=[...new Set(rows.flatMap(row=>row.author?[row.author.id]:[]))];
    const authors=ids.length?(await c.env.DB.prepare(`SELECT g.github_numeric_id,u.uid,u.display_name FROM github_identities g JOIN users u ON u.uid=g.uid WHERE g.github_numeric_id IN (${ids.map(()=>'?').join(',')}) AND u.disabled_at IS NULL`).bind(...ids).all<{github_numeric_id:number;uid:string;display_name:string}>()).results:[];
    const contributions=rows.length?(await c.env.DB.prepare(`SELECT DISTINCT g.content_commit_sha,u.uid,u.display_name FROM submissions s JOIN submission_content content USING(revision_id) JOIN git_links g USING(revision_id) JOIN users u ON u.uid=s.uid JOIN publication_events e USING(revision_id) JOIN deployments d ON d.release_id=e.release_id AND d.status='verified' WHERE g.content_commit_sha IN (${rows.map(()=>'?').join(',')}) AND s.status='published' AND e.action='published' AND u.disabled_at IS NULL AND trim(content.content)!=trim(content.base_content)`).bind(...rows.map(row=>row.sha)).all<{content_commit_sha:string;uid:string;display_name:string}>()).results:[];
    const commits=rows.map(row=>{
      const linked=authors.find(author=>author.github_numeric_id===row.author?.id);
      const author:HistoryAuthor={name:row.commit.author.name,github:row.author,wiki:linked?{uid:linked.uid,display_name:linked.display_name}:null};
      // Site submissions use server-verified publication records, never text trailers.
      const contributors=contributions.filter(person=>person.content_commit_sha===row.sha).map(({uid,display_name})=>({uid,display_name}));
      return {sha:row.sha,summary:row.commit.message.split(/\r?\n/u)[0].slice(0,500),date:row.commit.author.date,author,contributors};
    });
    return c.json({page:input.page,repository:git.repository,ref,source,sources,commits,next_cursor:rows.length===20&&input.cursor<1000?input.cursor+1:null});
  });
  app.get('/history/diff',async c=>{
    const input=historyQuerySchema.omit({cursor:true,ref:true}).extend({sha:historySha}).parse(c.req.query());
    let sources;try{sources=historySources(input.page);}catch{throw new GitError('HISTORY_PAGE_NOT_FOUND',404);}
    const source=sources.find(row=>row.id===input.source);if(!source)throw new GitError('HISTORY_SOURCE_NOT_FOUND',404);
    const git=new PublicGitHistory(c.env,fetch,typeof caches==='undefined'?undefined:await caches.open('rocowiki-public-history-v1'),()=>reserveHistoryRead(c.env));
    return c.json(await git.diff(source,input.sha));
  });
}
