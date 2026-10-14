// SPDX-License-Identifier: GPL-3.0-only
import {useEffect, useMemo, useRef, useState} from 'react';
import {message, RequestError} from '../../components/api';
import {createWorkspaceService} from '../workbench/service';
import type {Draft, Me, SubmissionRow} from '../workbench/contracts';

export function useAccountCenter(origin: string) {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [draftState, setDraftState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submissionState, setSubmissionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draftError, setDraftError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const lifetime = useRef<AbortController | null>(null);
  const identity = useRef<string | null>(null);
  const listVersion = useRef(0);
  const acting = useRef(false);
  const service = useMemo(() => createWorkspaceService(origin, me?.csrf_token, () => lifetime.current?.signal), [origin, me?.csrf_token]);

  function clearCollections() {
    listVersion.current++;
    setDrafts([]); setSubmissions([]); setDraftError(''); setSubmissionError(''); setDraftState('loading'); setSubmissionState('loading');
  }
  function acceptIdentity(value: Me | null) {
    if (identity.current !== (value?.user.uid ?? null)) clearCollections();
    identity.current = value?.user.uid ?? null;
    setMe(value);
    if(value)setSessionError('');
  }
  async function refresh() {
    const scope = lifetime.current;
    const value = await service.me();
    if (scope === lifetime.current && !scope?.signal.aborted) acceptIdentity(value);
  }
  async function action(operation: () => Promise<void>) {
    if (acting.current) return;
    const scope = lifetime.current;
    acting.current = true; setBusy(true); setNotice('');
    try { await operation(); }
    catch (error) {
      if (scope === lifetime.current && !scope?.signal.aborted) {
        if (error instanceof RequestError && error.code === 'UNAUTHORIZED') {acceptIdentity(null);setSessionError('');}
        setNotice(message(error));
      }
    } finally {
      if (scope === lifetime.current && !scope?.signal.aborted) { acting.current = false; setBusy(false); }
    }
  }
  async function loadCollections() {
    const scope = lifetime.current, uid = identity.current, version = ++listVersion.current;
    if (!uid) return;
    const current = () => scope === lifetime.current && !scope?.signal.aborted && identity.current === uid && listVersion.current === version;
    setDraftState('loading'); setSubmissionState('loading'); setDraftError(''); setSubmissionError('');
    function failed(error:unknown,kind:'draft'|'submission'){
      if (current()) {
        if(error instanceof RequestError&&error.code==='ACCOUNT_CHANGED') {acceptIdentity(null);setSessionError(message(error));}
        else if (error instanceof RequestError && error.code === 'UNAUTHORIZED') {acceptIdentity(null);setSessionError('');}
        else if(kind==='draft'){setDraftState('error');setDraftError(message(error));}
        else {setSubmissionState('error');setSubmissionError(message(error));}
      }
    }
    await Promise.allSettled([
      service.drafts(uid).then(saved=>{if(current()){setDrafts(saved.drafts);setDraftState('ready');}}).catch(error=>failed(error,'draft')),
      service.mine(uid).then(posted=>{if(current()){setSubmissions(posted.submissions);setSubmissionState('ready');}}).catch(error=>failed(error,'submission')),
    ]);
  }
  async function recheck(){
    const scope=lifetime.current;
    setBooting(true);setSessionError('');
    try{await refresh();}
    catch(error){if(scope===lifetime.current&&!scope?.signal.aborted)setSessionError(message(error));throw error;}
    finally{if(scope===lifetime.current&&!scope?.signal.aborted)setBooting(false);}
  }
  async function login(identifier: string, password: string) {
    await service.login({identifier, password});
    await recheck();
  }
  async function logout() {
    await service.logout();
    acceptIdentity(null); setSessionError(''); setNotice('已退出登录。');
  }
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller; acting.current = false;
    identity.current = null; setMe(null); clearCollections(); setBooting(true); setBusy(false); setNotice(''); setSessionError('');
    createWorkspaceService(origin, undefined, controller.signal).me()
      .then(value => { if (!controller.signal.aborted) acceptIdentity(value); })
      .catch(error => { if (!controller.signal.aborted && !(error instanceof RequestError && error.code === 'UNAUTHORIZED')) {setNotice(message(error));setSessionError(message(error));} })
      .finally(() => { if (!controller.signal.aborted) setBooting(false); });
    return () => controller.abort();
  }, [origin]);
  useEffect(() => { if (me) void loadCollections(); }, [origin, me?.user.uid]);
  const collectionError=[draftError,submissionError].filter(Boolean).join(' ');
  const collectionState=draftState==='error'||submissionState==='error'?'error':draftState==='ready'&&submissionState==='ready'?'ready':'loading';
  return {me, booting, busy, notice, sessionError, recheck, setNotice, drafts, submissions, draftState, submissionState, collectionState, collectionError, service, refresh, action, login, logout, loadCollections};
}
