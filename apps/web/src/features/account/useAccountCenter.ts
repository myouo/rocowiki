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
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [collectionState, setCollectionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [collectionError, setCollectionError] = useState('');
  const lifetime = useRef<AbortController | null>(null);
  const identity = useRef<string | null>(null);
  const listVersion = useRef(0);
  const acting = useRef(false);
  const service = useMemo(() => createWorkspaceService(origin, me?.csrf_token, () => lifetime.current?.signal), [origin, me?.csrf_token]);

  function clearCollections() {
    listVersion.current++;
    setDrafts([]); setSubmissions([]); setCollectionError(''); setCollectionState('loading');
  }
  function acceptIdentity(value: Me | null) {
    if (identity.current !== (value?.user.uid ?? null)) clearCollections();
    identity.current = value?.user.uid ?? null;
    setMe(value);
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
        if (error instanceof RequestError && error.code === 'UNAUTHORIZED') acceptIdentity(null);
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
    setCollectionState('loading'); setCollectionError('');
    try {
      const [saved, posted] = await Promise.all([service.drafts(), service.mine()]);
      if (current()) { setDrafts(saved.drafts); setSubmissions(posted.submissions); setCollectionState('ready'); }
    } catch (error) {
      if (current()) {
        if (error instanceof RequestError && error.code === 'UNAUTHORIZED') acceptIdentity(null);
        else { setCollectionState('error'); setCollectionError(message(error)); }
      }
    }
  }
  async function login(identifier: string, password: string) {
    await service.login({identifier, password});
    await refresh();
  }
  async function logout() {
    await service.logout();
    acceptIdentity(null); setNotice('已退出登录。');
  }
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller; acting.current = false;
    identity.current = null; setMe(null); clearCollections(); setBooting(true); setBusy(false); setNotice('');
    createWorkspaceService(origin, undefined, controller.signal).me()
      .then(value => { if (!controller.signal.aborted) acceptIdentity(value); })
      .catch(error => { if (!controller.signal.aborted && !(error instanceof RequestError && error.code === 'UNAUTHORIZED')) setNotice(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setBooting(false); });
    return () => controller.abort();
  }, [origin]);
  useEffect(() => { if (me) void loadCollections(); }, [origin, me?.user.uid]);
  return {me, booting, busy, notice, setNotice, drafts, submissions, collectionState, collectionError, service, refresh, action, login, logout, loadCollections};
}
