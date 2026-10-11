import {z} from 'zod';
import {editorKinds, states, type SubmissionState} from '../../../../../packages/wiki-schema/src/protocol';

export const source = z.object({title:z.string(),url:z.string(),level:z.enum(['official','tested','inferred','unverified'])});
export type Source = z.infer<typeof source>;
export const freshSource=():Source=>({title:'',url:'',level:'unverified'});
export const me = z.object({
  user:z.object({uid:z.string().min(1),username:z.string().min(1),display_name:z.string(),role:z.enum(['viewer','contributor','reviewer','admin'])}),
  account:z.object({email:z.string().email(),email_verified:z.boolean()}).nullable().optional(),
  csrf_token:z.string().min(1),consent_version:z.string(),
  github:z.object({login:z.string(),coauthor_email:z.string().nullable(),enabled:z.number()}).nullable(),
});
export type Me = z.infer<typeof me>;
export const authStatus=z.object({registration:z.string(),registration_enabled:z.boolean(),email_verification_required:z.boolean(),password_reset_available:z.boolean()});
export type AuthStatus=z.infer<typeof authStatus>;
export const base = z.object({page:z.object({id:z.string(),kind:z.enum(editorKinds),title:z.string()}),commit_sha:z.string().regex(/^[a-f0-9]{40}$/),blob_sha:z.string().regex(/^[a-f0-9]{40}$/),content:z.string(),base_data_revision:z.number().nullable()});
export type Base = z.infer<typeof base>;
export const submissionRow = z.object({revision_id:z.string(),page_id:z.string(),status:z.enum(states),edit_summary:z.string()});
export type SubmissionRow = z.infer<typeof submissionRow>;
export const submission = submissionRow.extend({
  version:z.number(),uid:z.string(),content:z.string(),base_content:z.string(),required_reviews:z.number(),
  pr_number:z.number().nullable().optional(),last_error:z.string().nullable().optional(),sources_json:z.string().refine(value=>{try{return z.array(source).safeParse(JSON.parse(value)).success;}catch{return false;}}),
  reviews:z.array(z.object({reviewer_uid:z.string(),verdict:z.enum(['approve','changes_requested','reject']),comment:z.string()})),
  publication_events:z.array(z.object({action:z.string(),release_id:z.string()})).optional(),
});
export type Submission = z.infer<typeof submission>;
export const draft = z.object({draft_id:z.string(),page_id:z.string(),body_json:z.string()});
export type Draft = z.infer<typeof draft>;
export const draftBody = z.object({base,body:z.string(),entity:z.record(z.unknown()),summary:z.string(),sources:z.array(source),optIn:z.boolean(),supersedes:z.string().optional()});
export type DraftBody = z.infer<typeof draftBody>;
export const job = z.object({job_id:z.string(),revision_id:z.string(),stage:z.string(),status:z.enum(states),last_error:z.string().nullable(),retries:z.number()});
export type Job = z.infer<typeof job>;
export const publicProfile = z.object({
  user:z.object({uid:z.string(),display_name:z.string()}),github:z.object({login:z.string()}).nullable(),
  contributions:z.array(z.object({revision_id:z.string(),page_id:z.string(),edit_summary:z.string(),content_commit_sha:z.string().regex(/^[a-f0-9]{40}$/)})),
});
export type PublicProfile = z.infer<typeof publicProfile>;
export const statuses:Record<SubmissionState,string> = {
  pending_review:'待审核',changes_requested:'需补充',rejected:'未采纳',approved:'已批准',
  git_pending:'准备内容提交',git_pr_open:'等待 PR 检查与合并',git_merged:'已合并',deploying:'等待上线核验',
  published:'已发布',conflict:'冲突复核',retryable_error:'任务待重试',cancelled:'已撤销',
};
