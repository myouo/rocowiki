// SPDX-License-Identifier: GPL-3.0-only
import React,{useEffect,useRef,useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {Heart} from 'lucide-react';
import type {z} from 'zod';
import {guideLikeResponseSchema} from '../../../../../packages/wiki-schema/src/community';
import {message,RequestError} from '../../components/api';
import {createWorkspaceService} from '../workbench/service';
import {useHeaderProfile} from '../account/useHeaderProfile';

export default function ServerGuideLike({targetId,author}:{targetId:string;author?:string}) {
  const {siteConfig}=useDocusaurusContext(),origin=String(siteConfig.customFields?.apiOrigin||''),{me,ready,refresh}=useHeaderProfile(origin);
  const [data,setData]=useState<z.infer<typeof guideLikeResponseSchema>|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const lifetime=useRef<AbortController|null>(null),acting=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();lifetime.current=controller;acting.current=false;setData(null);setBusy(false);
    if(!ready||!origin)return ()=>controller.abort();
    const service=createWorkspaceService(origin,me?.csrf_token,controller.signal);
    void service.guideLike(targetId,me?.user.uid).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(reason=>{if(!controller.signal.aborted){setNotice(message(reason));if(reason instanceof RequestError&&['UNAUTHORIZED','ACCOUNT_CHANGED'].includes(reason.code))refresh();}});
    return ()=>controller.abort();
  },[origin,targetId,me?.user.uid,ready,retry]);
  const current=data?.target_id===targetId&&data.owner_uid===(me?.user.uid??null)?data:null;
  return <div className="rw-guide-appreciation-v72"><button type="button" aria-pressed={current?.liked??false} disabled={!me||!current?.author_uid||current.author_uid===me.user.uid||busy} title={!current?.author_uid?'来源整理记录，不计入个人获赞':current.author_uid===me?.user.uid?'自己的方案不计入自我点赞':'这份攻略对我有帮助'} onClick={()=>{
    const controller=lifetime.current;
    if(!me||!current||!controller||controller.signal.aborted||acting.current)return;
    acting.current=true;setBusy(true);setNotice('');
    void createWorkspaceService(origin,me.csrf_token,controller.signal).like(me.user.uid,'guide',targetId,!current.liked).then(()=>{if(controller===lifetime.current&&!controller.signal.aborted)setRetry(n=>n+1);}).catch(reason=>{if(controller===lifetime.current&&!controller.signal.aborted){setNotice(message(reason));if(reason instanceof RequestError&&['UNAUTHORIZED','ACCOUNT_CHANGED'].includes(reason.code))refresh();else setRetry(n=>n+1);}}).finally(()=>{if(controller===lifetime.current&&!controller.signal.aborted){acting.current=false;setBusy(false);}});
  }}><Heart size={15} fill={current?.liked?'currentColor':'none'}/>有帮助 <strong>{current?.likes??'—'}</strong></button>{author&&<span>由 {author} 提交</span>}{current&&!current.author_uid&&<small>来源整理记录 · 不计入个人获赞</small>}{notice&&<small role="status">{notice}</small>}</div>;
}
