/* Explicit browser-only API fixture. Loaded by DevTools before navigation;
 * never imported by production pages. The Node interaction gate uses real SQL. */
(() => {
  const nativeFetch=window.fetch.bind(window),nativeTimer=window.setTimeout.bind(window);
  const key='rocowiki-workbench-browser-fixture';
  const state=JSON.parse(sessionStorage.getItem(key)||'{"drafts":{},"submissions":{},"keys":{},"requests":[]}');
  const role=new URLSearchParams(location.search).get('fixture');
  const ids={contributor:'usr_11111111-1111-4111-8111-111111111111',reviewer:'usr_22222222-2222-4222-8222-222222222222',viewer:'usr_33333333-3333-4333-8333-333333333333'};
  const store=()=>sessionStorage.setItem(key,JSON.stringify(state));
  window.__workbenchFixture={state,loseNext:null};
  window.setTimeout=(callback,time,...args)=>nativeTimer(callback,time===30000?150:time,...args);
  window.fetch=async(input,init={})=>{
    const url=new URL(String(input),location.href);
    if(url.origin!=='http://localhost:8787')return nativeFetch(input,init);
    const headers=new Headers(init.headers),body=init.body?JSON.parse(init.body):null,path=url.pathname,method=init.method||'GET';
    state.requests.push({path,method,key:headers.get('Idempotency-Key')});store();
    const ok=(value,status=200)=>Response.json(value,{status});
    if(path==='/auth/login')return ok({ok:true});
    if(path==='/health')return ok({registration:'password',registration_enabled:true,email_verification_required:true,password_reset_available:false});
    if(!ids[role])return ok({error:{code:'UNAUTHORIZED'}},401);
    if(path==='/me')return ok({user:{uid:ids[role],username:role,display_name:`Browser fixture ${role}`,role},csrf_token:'a'.repeat(64),github:null,consent_version:'fixture'});
    if(path==='/pages/contributing/edit-base')return ok({page:{id:'contributing',kind:'article',title:'参与贡献'},commit_sha:'a'.repeat(40),blob_sha:'b'.repeat(40),content:'# Baseline',base_data_revision:null});
    let response;
    if(path==='/drafts'&&method==='GET')return ok({drafts:Object.values(state.drafts)});
    if(path.startsWith('/drafts/')&&method==='PUT'){
      const draft_id=path.split('/').at(-1);state.drafts[draft_id]={draft_id,page_id:body.page_id,body_json:JSON.stringify(body.body)};
      response=ok({draft_id});
    }else if(path==='/submissions'&&method==='POST'){
      const requestKey=headers.get('Idempotency-Key');
      let id=state.keys[requestKey];
      if(!id){id='rev_'+crypto.randomUUID();state.keys[requestKey]=id;state.submissions[id]={revision_id:id,page_id:body.page_id,status:'pending_review',edit_summary:body.edit_summary,uid:ids.contributor,version:0,content:body.content_markdown,base_content:'# Baseline',required_reviews:1,pr_number:null,last_error:null,sources_json:JSON.stringify(body.source_references),reviews:[],publication_events:[]};}
      response=ok({revision_id:id});
    }else if(path==='/submissions')return ok({submissions:Object.values(state.submissions)});
    else if(path==='/reviews')return ok({submissions:Object.values(state.submissions).filter(row=>row.status==='pending_review')});
    else if(path.startsWith('/submissions/'))return ok(state.submissions[path.split('/').at(-1)]);
    else if(path.startsWith('/reviews/')&&method==='POST'){
      const record=state.submissions[path.split('/')[2]];record.status='approved';record.version++;record.reviews.push({reviewer_uid:ids.reviewer,verdict:body.verdict,comment:body.comment});response=ok(record);
    }else return ok({error:{code:'UNEXPECTED_FIXTURE_REQUEST'}},500);
    store();
    const lose=window.__workbenchFixture.loseNext;
    if(lose==='draft'&&path.startsWith('/drafts/')||lose==='submit'&&path==='/submissions'){
      window.__workbenchFixture.loseNext=null;init.signal.throwIfAborted();
      return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
    }
    return response;
  };
})();
