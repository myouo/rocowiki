// SPDX-License-Identifier: GPL-3.0-only
import {z} from 'zod';
import {canonicalCommunityPage} from './community';

/** Bloodlines use their Chinese names as stable entry keys; keep that identity. */
export function canonicalHistoryPage(value:string):string {
  if(!/^\/(?!\/)/.test(value)||value.length>1000||/[\s<>\\\u0000-\u001f\u007f]/u.test(value))throw new Error('INVALID_HISTORY_PAGE');
  const url=new URL(value,'https://wiki.invalid'),path=canonicalCommunityPage(url.pathname);
  const entry=url.searchParams.get('entry');
  if(path==='/bloodlines/'&&entry){
    if(entry!==entry.trim()||entry.length>120||/[<>\\\u0000-\u001f\u007f]/u.test(entry))throw new Error('INVALID_HISTORY_PAGE');
    return path+'?entry='+encodeURIComponent(entry);
  }
  return canonicalCommunityPage(value);
}
export const historyPageSchema=z.string().min(1).max(1000).transform((value,ctx)=>{
  try{return canonicalHistoryPage(value);}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:'Invalid history page'});return z.NEVER;}
});

export const historySha=z.string().regex(/^[a-f0-9]{40}$/);
export const historySourceSchema=z.object({id:z.string(),label:z.string(),path:z.string(),shared:z.boolean()});
export const historyQuerySchema=z.object({
  page:historyPageSchema,source:z.string().max(80).optional(),
  cursor:z.coerce.number().int().min(1).max(1000).default(1),ref:historySha.optional(),
}).strict();
export const historyWikiAuthorSchema=z.object({uid:z.string(),display_name:z.string()});
export const historyAuthorSchema=z.object({name:z.string(),github:z.object({id:z.number().int().positive(),login:z.string().regex(/^[a-zA-Z0-9-]{1,39}(?:\[bot\])?$/)}).nullable(),wiki:historyWikiAuthorSchema.nullable()});
export const historyCommitSchema=z.object({
  sha:historySha,summary:z.string(),date:z.string().datetime({offset:true}),author:historyAuthorSchema,
  contributors:z.array(historyWikiAuthorSchema),
});
export const historyResponseSchema=z.object({
  page:historyPageSchema,repository:z.string().url(),ref:historySha,source:historySourceSchema,
  sources:z.array(historySourceSchema),commits:z.array(historyCommitSchema).max(20),next_cursor:z.number().int().positive().nullable(),
});
export const historyDiffSchema=z.object({sha:historySha,source:z.string(),status:z.string(),additions:z.number().int().nonnegative().nullable(),deletions:z.number().int().nonnegative().nullable(),patch:z.string().nullable()});
export type HistoryResponse=z.infer<typeof historyResponseSchema>;
export type HistoryAuthor=z.infer<typeof historyAuthorSchema>;
export type HistorySource=z.infer<typeof historySourceSchema>;
export type HistoryDiff=z.infer<typeof historyDiffSchema>;
