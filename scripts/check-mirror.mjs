import {execFileSync} from 'node:child_process';
import {createHmac} from 'node:crypto';
const {GITHUB_REPOSITORY,GITCODE_REMOTE_URL,API_ORIGIN,DEPLOY_WEBHOOK_SECRET}=process.env;
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(GITHUB_REPOSITORY||''))throw Error('GITHUB_REPOSITORY is required');
if(!GITCODE_REMOTE_URL?.startsWith('https://')||new URL(GITCODE_REMOTE_URL).username||new URL(GITCODE_REMOTE_URL).password)throw Error('Public HTTPS GitCode mirror URL required');
function head(url){return execFileSync('git',['ls-remote','--exit-code',url,'refs/heads/main'],{encoding:'utf8',timeout:20000,stdio:['ignore','pipe','ignore']}).split(/\s/)[0];}
const source=head(`https://github.com/${GITHUB_REPOSITORY}.git`);let mirror=null,status='failed';
try{mirror=head(GITCODE_REMOTE_URL);status=mirror===source?'synced':'lagging';}catch{}
const observation={source_sha:source,mirror_sha:mirror,status,checked_at:Math.floor(Date.now()/1000)};
console.log(JSON.stringify(observation));
if(API_ORIGIN&&DEPLOY_WEBHOOK_SECRET){const body=JSON.stringify(observation),time=String(Math.floor(Date.now()/1000));const r=await fetch(`${API_ORIGIN}/webhooks/mirror`,{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Timestamp':time,'X-Signature':'sha256='+createHmac('sha256',DEPLOY_WEBHOOK_SECRET).update(`${time}.${body}`).digest('hex')},body,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Mirror report failed');}
if(status!=='synced')process.exitCode=1;
