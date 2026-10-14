// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useMemo,useRef,useState} from 'react';
import {message,RequestError} from '../../components/api';
import {createWorkspaceService,type WorkspaceService} from '../workbench/service';
import type {Me} from '../workbench/contracts';
import type {CommunitySnapshot} from '../../../../../packages/wiki-schema/src/community';

export function useCommunityAccount(origin:string,me:Me|null,onIdentityError:(error:unknown)=>void) {
  const [data,setData]=useState<CommunitySnapshot|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
  const lifetime=useRef<AbortController|null>(null),generation=useRef(0),acting=useRef(false),callbacks=useRef(onIdentityError);
  callbacks.current=onIdentityError;
  const uid=me?.user.uid??'',csrf=me?.csrf_token;
  const service=useMemo(()=>createWorkspaceService(origin,csrf,()=>lifetime.current?.signal),[origin,csrf]);
  function failed(reason:unknown) {
    setError(message(reason));
    if(reason instanceof RequestError&&['UNAUTHORIZED','ACCOUNT_CHANGED'].includes(reason.code)){setData(null);callbacks.current(reason);}
  }
  async function reload() {
    if(!uid)throw new RequestError('UNAUTHORIZED');
    const scope=lifetime.current,request=++generation.current;
    const snapshot=await service.community(uid);
    if(scope===lifetime.current&&!scope?.signal.aborted&&request===generation.current){setData(snapshot);setError('');setVersion(n=>n+1);}
    return snapshot;
  }
  async function run(operation:(service:WorkspaceService)=>Promise<string>) {
    const scope=lifetime.current;
    if(!uid||!scope||scope.signal.aborted||acting.current)return;
    acting.current=true;setBusy(true);setNotice('');
    try {
      const result=await operation(service);
      await reload();
      if(scope===lifetime.current&&!scope.signal.aborted)setNotice(result);
    }catch(reason){
      if(scope===lifetime.current&&!scope.signal.aborted){
        failed(reason);setNotice(message(reason));
        // A lost response may have committed. Re-read rather than inventing a rollback.
        if(!(reason instanceof RequestError&&['UNAUTHORIZED','ACCOUNT_CHANGED'].includes(reason.code)))try{await reload();}catch(next){if(scope===lifetime.current&&!scope.signal.aborted&&next instanceof RequestError&&['UNAUTHORIZED','ACCOUNT_CHANGED'].includes(next.code))failed(next);}
      }
    }finally{if(scope===lifetime.current&&!scope.signal.aborted){acting.current=false;setBusy(false);}}
  }
  useEffect(()=>{
    const controller=new AbortController();lifetime.current=controller;generation.current++;acting.current=false;
    setData(null);setError('');setNotice('');setBusy(false);
    if(uid)void reload().catch(reason=>{if(!controller.signal.aborted)failed(reason);});
    const refresh=()=>{if(uid&&document.visibilityState==='visible')void reload().catch(reason=>{if(!controller.signal.aborted)failed(reason);});};
    const timer=window.setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
    return ()=>{controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[origin,uid,csrf,me?.profile?.avatar,me?.profile?.bio]);
  return {data:data?.owner_uid===uid?data:null,error,notice,busy,version,service,reload,run,uid};
}
export type CommunityAccountState=ReturnType<typeof useCommunityAccount>;
