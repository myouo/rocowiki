import {afterEach,describe,expect,it,vi} from 'vitest';
import {createWorkspaceService,parseDraft} from '../apps/web/src/features/workbench/service';
import {api} from '../apps/web/src/components/api';
import {registeredEditTarget,formalWorkspaceHref,workspaceMode} from '../apps/web/src/wiki/runtime/policy';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
const page={id:'research-method',title:'机制研究与来源规范',slug:'mechanics/research-method',kind:'article'};
const base={page,commit_sha:'a'.repeat(40),blob_sha:'b'.repeat(40),content:'# text',base_data_revision:null};

describe('formal workflow boundaries',()=>{
  it('does not fall back to an unrelated same-origin or localhost API in an unconfigured build',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    await expect(createWorkspaceService('').me()).rejects.toMatchObject({code:'AUTH_NOT_CONFIGURED'});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses stable catalog IDs and refuses a similarly named unregistered reader',()=>{
    expect(registeredEditTarget([page],{returnTo:'/wiki/mechanics/research-method/#heading'})).toEqual(page);
    expect(registeredEditTarget([page],{returnTo:'/mechanics/priority/',entity:page.title})).toBeNull();
    expect(registeredEditTarget([{...page,kind:'npc'}],{page_id:page.id})).toBeNull();
    expect(formalWorkspaceHref([page],{page_id:page.id})).toBe('/workbench/?tab=edit&page=research-method');
    expect(workspaceMode('server')).toBe('server');
  });
  it.each([null,{user:null},{user:{uid:'fake',role:'owner'}}])('rejects damaged identity responses before rendering (%j)',async value=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json(value)));
    await expect(createWorkspaceService('https://api.test').me()).rejects.toMatchObject({code:'INVALID_SERVICE_RESPONSE'});
  });
  it('accepts a genuine read-only role without treating it as malformed identity',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:{uid:'usr_one',display_name:'Reader',role:'viewer'},csrf_token:'csrf',consent_version:'one',github:null})));
    expect((await createWorkspaceService('https://api.test').me()).user.role).toBe('viewer');
  });
  it('rejects a well-formed edit baseline belonging to another page',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json(base)));
    await expect(createWorkspaceService('https://api.test').base('another-page')).rejects.toMatchObject({code:'INVALID_SERVICE_RESPONSE'});
  });
  it('does not navigate to an executable URL returned by a broken login service',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({redirect_url:'javascript:alert(1)'})));
    await expect(createWorkspaceService('https://api.test').login()).rejects.toMatchObject({code:'INVALID_SERVICE_RESPONSE'});
  });
  it('rejects malformed public profiles before a contribution page can crash',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:{uid:'usr_one'},github:null,contributions:null})));
    await expect(createWorkspaceService('https://api.test').profile('usr_one')).rejects.toMatchObject({code:'INVALID_SERVICE_RESPONSE'});
  });
  it('keeps malformed and cross-page private draft data intact',()=>{
    for(const body_json of ['{',JSON.stringify({base,body:'text',entity:{},summary:'summary',sources:[],optIn:false})]){
      const draft={draft_id:'draft_one',page_id:'another-page',body_json};
      expect(()=>parseDraft(draft)).toThrowError('INVALID_DRAFT');
      expect(draft.body_json).toBe(body_json);
    }
  });
  it('rejects non-JSON upstream replies with a controlled service error',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html>proxy error</html>',{status:502})));
    await expect(api('https://api.test','/me')).rejects.toMatchObject({code:'INVALID_SERVICE_RESPONSE'});
  });
  it('does not start an HTTP request for an already cancelled page',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const controller=new AbortController();controller.abort();
    await expect(createWorkspaceService('https://api.test',undefined,controller.signal).me()).rejects.toMatchObject({name:'AbortError'});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('discards a late response after route cancellation',async()=>{
    let finish!:(value:Response)=>void;
    vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
    const controller=new AbortController();const request=createWorkspaceService('https://api.test',undefined,controller.signal).base(page.id);
    controller.abort();finish(Response.json(base));
    await expect(request).rejects.toMatchObject({name:'AbortError'});
  });
  it('times out without retrying a write whose server outcome may be unknown',async()=>{
    vi.useFakeTimers();
    const fetcher=vi.fn((_url:string,options:RequestInit)=>new Promise((_resolve,reject)=>options.signal!.addEventListener('abort',()=>reject(options.signal!.reason),{once:true})));
    vi.stubGlobal('fetch',fetcher);
    const request=api('https://api.test','/submissions',{method:'POST',body:{},timeoutMs:10});
    const rejection=expect(request).rejects.toMatchObject({code:'REQUEST_TIMEOUT'});
    await vi.advanceTimersByTimeAsync(10);await rejection;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves authentication and idempotency headers across the service boundary',async()=>{
    const fetcher=vi.fn(async()=>Response.json({revision_id:'rev_one'}));vi.stubGlobal('fetch',fetcher);
    await createWorkspaceService('https://api.test','csrf').submit({page_id:page.id},'request-key');
    expect(fetcher.mock.calls[0]).toMatchObject(['https://api.test/submissions',{method:'POST',credentials:'include',headers:{'X-CSRF-Token':'csrf','Idempotency-Key':'request-key','X-Roco-Request':'1'}}]);
  });
});
