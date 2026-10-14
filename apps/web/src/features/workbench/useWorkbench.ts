import { useState, useEffect, useRef, useMemo } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useLocation} from '@docusaurus/router';
import { message, RequestError } from "../../components/api";
import data from "../../generated/catalog.json";
import { freshSource, type Me, type Source, type Base, type Submission, type SubmissionRow, type Draft, type Job } from "./contracts";
import { createWorkspaceService, parseDraft, type WorkspaceService } from "./service";
export function useWorkbench() {
  const location=useLocation();
  const {
      siteConfig
    } = useDocusaurusContext(),
    origin = String(siteConfig.customFields?.apiOrigin);
  const [me, setMe] = useState<Me | null>(null),
    [accountLink,setAccountLink]=useState(false),
    [booting, setBooting] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [tab, setTab] = useState('edit');
  const [pageId, setPageId] = useState(data.pages[0]?.id || ''),
    [base, setBase] = useState<Base | null>(null),
    [body, setBody] = useState(''),
    [entity, setEntity] = useState<Record<string, unknown>>({});
  const [summary, setSummary] = useState(''),
    [sources, setSources] = useState<Source[]>([freshSource()]),
    [optIn, setOptIn] = useState(false),
    [consent, setConsent] = useState(false),
    [preview, setPreview] = useState(''),
    [draftId, setDraftId] = useState(''),
    [supersedes, setSupersedes] = useState('');
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [queue, setQueue] = useState<SubmissionRow[]>([]),
    [selected, setSelected] = useState<Submission | null>(null),
    [comment, setComment] = useState(''),
    [jobs, setJobs] = useState<Job[]>([]);
  const [submitRequest, setSubmitRequest] = useState<{
    key: string;
    fingerprint: string;
  } | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  const service = useMemo(() => createWorkspaceService(origin, me?.csrf_token, () => lifetime.current?.signal), [origin, me?.csrf_token]);
  async function action(fn: () => Promise<void>) {
    const scope=lifetime.current;
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (e) {
      if (scope===lifetime.current&&!scope?.signal.aborted) setNotice(message(e));
    } finally {
      if (scope===lifetime.current&&!scope?.signal.aborted) setBusy(false);
    }
  }
  async function refreshMe() {
    const result = await service.me();
    setMe(result);
    return result;
  }
  async function openRequestedWorkspace(result:Me,params:URLSearchParams,client:WorkspaceService){
    if(params.get('tab')==='account')setTab('account');
    if(params.get('draft')&&result.user.role!=='viewer'){
      const saved=(await client.drafts(result.user.uid)).drafts.find(row=>row.draft_id===params.get('draft')&&(!params.get('page')||row.page_id===params.get('page')));
      if(!saved)throw new RequestError('INVALID_DRAFT');
      restore(saved);
    }else if(params.get('tab')==='mine'){
      const [mine,saved]=await Promise.all([client.mine(result.user.uid),client.drafts(result.user.uid)]);
      setSubmissions(mine.submissions);setDrafts(saved.drafts);setTab('mine');
      if(params.get('submission'))setSelected(await client.detail(params.get('submission')!));
    }
    if(params.get('tab')==='review'&&['reviewer','admin'].includes(result.user.role)){
      setQueue((await client.reviews()).submissions);setTab('review');
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setBooting(true);setBusy(false);setMe(null);setNotice('');
    const params = new URLSearchParams(window.location.search);
    if(/^#(?:verify|reset)=[a-f0-9]{64}$/.test(window.location.hash))setAccountLink(true);
    if (params.get('tab') === 'account') setTab('account');
    const id = new URLSearchParams(window.location.search).get('page');
    if (id && data.pages.some(p => p.id === id) && id!==pageId) {
      setPageId(id);setBase(null);setPreview('');setEntity({});setDraftId('');setSupersedes('');setSelected(null);
    }
    createWorkspaceService(origin, undefined, controller.signal).me().then(async result => {
      setMe(result);
      await openRequestedWorkspace(result,params,createWorkspaceService(origin,result.csrf_token,controller.signal));
    }).catch(e => {
      if (!controller.signal.aborted && !(e instanceof RequestError && e.code === 'UNAUTHORIZED')) setNotice(message(e));
    }).finally(() => {
      if (!controller.signal.aborted) setBooting(false);
    });
    return () => controller.abort();
  }, [origin,location.search,location.hash]);
  useEffect(() => {
    if (!me?.github?.enabled) setOptIn(false);
  }, [me?.github?.enabled]);
  async function login(identifier:string,password:string) {
    await service.login({identifier,password});
    // A login may replace a different account in this browser. Drop its private UI state.
    setTab('edit');setBase(null);setSelected(null);setBody('');setEntity({});
    setSubmissions([]);setDrafts([]);setQueue([]);setJobs([]);setSummary('');
    setPreview('');setDraftId('');setSupersedes('');setSources([freshSource()]);setOptIn(false);setSubmitRequest(null);
    const result=await refreshMe();
    await openRequestedWorkspace(result,new URLSearchParams(window.location.search),createWorkspaceService(origin,result.csrf_token,()=>lifetime.current?.signal));
    setAccountLink(false);
  }
  async function listMine() {
    if(!me)throw new RequestError('UNAUTHORIZED');
    const [s, d] = await Promise.all([service.mine(me.user.uid), service.drafts(me.user.uid)]);
    setSubmissions(s.submissions);
    setDrafts(d.drafts);
  }
  async function openTab(next: string) {
    setTab(next);
    setSelected(null);
    if (next === 'mine') await listMine();
    if (next === 'review') setQueue((await service.reviews()).submissions);
    if (next === 'jobs') setJobs((await service.jobs()).jobs);
  }
  async function loadBase(id = pageId) {
    const next = await service.base(id);
    setBase(next);
    setBody(next.content);
    setEntity(next.page.kind === 'article' ? {} : JSON.parse(next.content));
    setSummary('');
    setSources([freshSource()]);
    setOptIn(false);
    setPreview('');
    setDraftId('');
    setSupersedes('');
    setSubmitRequest(null);
  }
  function payload() {
    if (!base || base.page.id!==pageId) throw new RequestError('STALE_BASE');
    const common = {
      page_id: pageId,
      base_commit_sha: base.commit_sha,
      base_blob_sha: base.blob_sha,
      edit_summary: summary,
      source_references: sources,
      coauthor_opt_in: optIn,
      ...(supersedes ? {
        supersedes
      } : {})
    };
    if (base.page.kind === 'article') return {
      ...common,
      kind: 'article',
      content_markdown: body
    };
    const {
      id,
      revision,
      ...patch
    } = entity;
    return {
      ...common,
      kind: base.page.kind,
      base_data_revision: base.base_data_revision,
      patch: {
        ...patch,
        sources
      }
    };
  }
  async function save() {
    const id = draftId || `draft_${crypto.randomUUID()}`;
    // Keep the PUT target stable even if the server saved it but the response
    // was lost. An explicit retry updates this draft instead of creating a copy.
    setDraftId(id);
    await service.saveDraft(id, pageId, {
      base: base!,
      body,
      entity,
      summary,
      sources,
      optIn,
      supersedes
    });
    setNotice('草稿已保存，仅你可以查看。');
  }
  function restore(d: Draft) {
    const v = parseDraft(d);
    setPageId(d.page_id);
    setBase(v.base);
    setBody(v.body);
    setEntity(v.entity);
    setSummary(v.summary);
    setSources(v.sources);
    setOptIn(v.optIn);
    setSupersedes(v.supersedes || '');
    setDraftId(d.draft_id);
    setPreview('');
    setSubmitRequest(null);
    setTab('edit');
  }
  async function submit() {
    const input = payload(),
      fingerprint = JSON.stringify(input),
      key = submitRequest?.fingerprint === fingerprint ? submitRequest.key : crypto.randomUUID().replace(/-/g, '');
    setSubmitRequest({
      key,
      fingerprint
    });
    const result = await service.submit(input, key);
    setNotice(`已提交审核：${result.revision_id}`);
    setTab('mine');
    await listMine();
  }
  async function show(id: string) {
    setSelected(await service.detail(id));
    setComment('');
  }
  function updateSource(index: number, field: keyof Source, value: string) {
    setSources(sources.map((s, i) => i === index ? {
      ...s,
      [field]: value
    } : s));
  }
  const canReview = me && ['reviewer', 'admin'].includes(me.user.role);
  const canContribute = me && ['contributor', 'reviewer', 'admin'].includes(me.user.role);
  return {
    me,
    accountLink,
    setMe,
    booting,
    busy,
    notice,
    setNotice,
    tab,
    setTab,
    pageId,
    setPageId,
    base,
    setBase,
    body,
    setBody,
    entity,
    setEntity,
    summary,
    setSummary,
    sources,
    setSources,
    optIn,
    setOptIn,
    consent,
    setConsent,
    preview,
    setPreview,
    setDraftId,
    supersedes,
    setSupersedes,
    submissions,
    drafts,
    queue,
    setQueue,
    selected,
    setSelected,
    comment,
    setComment,
    jobs,
    service,
    action,
    refreshMe,
    login,
    listMine,
    openTab,
    loadBase,
    save,
    restore,
    submit,
    show,
    updateSource,
    canReview,
    canContribute
  };
}
