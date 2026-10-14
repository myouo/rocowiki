// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useRef,useState} from 'react';
import {message,RequestError} from '../../components/api';
import {createWorkspaceService,type WorkspaceService} from '../workbench/service';
import type {Me} from '../workbench/contracts';

/** Each panel owns its request, including changes of account, filters and cursor. */
export function useCommunityQuery<T>(origin:string,me:Me,key:string,load:(service:WorkspaceService)=>Promise<T>,onIdentityError:(error:unknown)=>void) {
  const context=origin+'|'+me.user.uid+'|'+key;
  const [resolved,setResolved]=useState<{context:string;data:T}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),loader=useRef(load),invalid=useRef(onIdentityError);
  loader.current=load;invalid.current=onIdentityError;
  useEffect(()=>{
    const controller=new AbortController();setResolved(null);setError('');
    const service=createWorkspaceService(origin,me.csrf_token,controller.signal);
    void loader.current(service).then(value=>{if(!controller.signal.aborted)setResolved({context,data:value});}).catch(reason=>{
      if(!controller.signal.aborted){setError(message(reason));if(reason instanceof RequestError&&['UNAUTHORIZED','ACCOUNT_CHANGED'].includes(reason.code))invalid.current(reason);}
    });
    return ()=>controller.abort();
  },[origin,me.user.uid,me.csrf_token,key,retry]);
  return {data:resolved?.context===context?resolved.data:null,error,retry:()=>setRetry(n=>n+1)};
}
