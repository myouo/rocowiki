import { z } from 'zod';
import registry from '../../../content/catalog.json';
import {editorKinds} from './protocol';
export {states, type SubmissionState} from './protocol';

export const idSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const shaSchema = z.string().regex(/^[0-9a-f]{40}$/);
const text = z.string().trim().min(1).max(200).refine(v => !/[\u0000-\u001f\u007f]/u.test(v));
export const sourceSchema = z.object({
  title: text, url: z.string().url().max(2048).refine(v => {try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!/[\u0000-\u0020\u007f\\]/u.test(v);}catch{return false;}}),
  level: z.enum(['official', 'tested', 'inferred', 'unverified'])
}).strict();
export const catalogEntrySchema = z.object({
  id: idSchema, kind: z.enum(editorKinds), section: z.enum(['mechanics', 'guides', 'pets', 'skills']),
  title: text, slug: z.string().regex(/^[a-z][a-z0-9/-]+$/), critical: z.boolean()
}).strict().refine(e => e.kind === 'article' ? ['mechanics','guides'].includes(e.section) : e.section === `${e.kind}s`);
export type CatalogEntry = z.infer<typeof catalogEntrySchema>;
export const catalog = z.array(catalogEntrySchema).parse(registry);
if (new Set(catalog.map(e => e.id)).size !== catalog.length || new Set(catalog.map(e => e.slug)).size !== catalog.length) throw new Error('Duplicate catalog identity');
export function pageFor(id: string): CatalogEntry {
  idSchema.parse(id);
  const page = catalog.find(p => p.id === id);
  if (!page) throw new Error('UNKNOWN_PAGE');
  return page;
}
export function contentPath(page: CatalogEntry): string {
  catalogEntrySchema.parse(page);
  return page.kind === 'article' ? `content/${page.section}/${page.id}.md` : `content/data/${page.kind}s/${page.id}.json`;
}
export function metadataPath(page:CatalogEntry):string {catalogEntrySchema.parse(page);return `content/metadata/${page.id}.json`;}
export const skillSchema = z.object({
  id: idSchema, revision: z.number().int().positive(), name: text, aliases: z.array(text).max(20),
  type: text, category: z.enum(['physical','magical','status']), power: z.number().int().min(0).max(9999).nullable(),
  pp: z.number().int().min(0).max(999), description: z.string().min(1).max(4000), sources: z.array(sourceSchema).min(1).max(20)
}).strict();
export const petSchema = z.object({
  id: idSchema, revision: z.number().int().positive(), name: text, aliases: z.array(text).max(20),
  types: z.array(text).min(1).max(2), skills: z.array(idSchema).max(100),
  stats: z.object({hp:z.number().int().min(1).max(9999),attack:z.number().int().min(1).max(9999),defense:z.number().int().min(1).max(9999),magicAttack:z.number().int().min(1).max(9999),magicDefense:z.number().int().min(1).max(9999),speed:z.number().int().min(1).max(9999)}).strict(),
  description: z.string().min(1).max(4000), sources: z.array(sourceSchema).min(1).max(20)
}).strict();
export const skillPatchSchema = skillSchema.omit({id:true,revision:true}).partial().strict();
export const petPatchSchema = petSchema.omit({id:true,revision:true}).partial().strict();
const common = {
  page_id:idSchema, base_commit_sha:shaSchema, base_blob_sha:shaSchema,
  edit_summary:z.string().trim().min(5).max(500), source_references:z.array(sourceSchema).min(1).max(20),
  coauthor_opt_in:z.boolean().default(false), supersedes:z.string().regex(/^rev_[0-9a-f-]{36}$/).optional()
};
export const submissionSchema = z.discriminatedUnion('kind',[
  z.object({...common,kind:z.literal('article'),content_markdown:z.string().min(1).max(65536)}).strict(),
  z.object({...common,kind:z.literal('pet'),base_data_revision:z.number().int().positive(),patch:petPatchSchema}).strict(),
  z.object({...common,kind:z.literal('skill'),base_data_revision:z.number().int().positive(),patch:skillPatchSchema}).strict()
]);
export type SubmissionInput = z.infer<typeof submissionSchema>;
