// SPDX-License-Identifier: GPL-3.0-only
import {useEffect,useState} from 'react';
import type {Me} from '../workbench/contracts';
import {createWorkspaceService} from '../workbench/service';

/** Events request a server refresh; their payload never supplies an identity. */
export function useHeaderProfile(origin:string) {
  const [me,setMe]=useState<Me|null>(null),[ready,setReady]=useState(false);
  useEffect(()=>{
    let controller:AbortController|undefined,active=true;
    function reload() {
      controller?.abort();controller=new AbortController();const scope=controller;
      setMe(null);setReady(false);
      if(!origin){setReady(true);return;}
      void createWorkspaceService(origin,undefined,scope.signal).me().then(value=>{if(active&&!scope.signal.aborted)setMe(value);}).catch(()=>{/* Guest and unavailable states retain no identity. */}).finally(()=>{if(active&&!scope.signal.aborted)setReady(true);});
    }
    reload();window.addEventListener('roco:account-updated',reload);
    return ()=>{active=false;controller?.abort();window.removeEventListener('roco:account-updated',reload);};
  },[origin]);
  return {me,ready,refresh:()=>window.dispatchEvent(new Event('roco:account-updated'))};
}
