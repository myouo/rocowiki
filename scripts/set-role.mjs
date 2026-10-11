import {spawnSync} from 'node:child_process';
const [uid,role,mode]=process.argv.slice(2);
if(!/^usr_[a-f0-9-]{36}$/.test(uid||'')||!['viewer','contributor','reviewer','admin'].includes(role)||!['--local','--remote'].includes(mode))throw Error('Usage: node scripts/set-role.mjs <usr_UUID> <role> <--local|--remote>');
// These inputs are tightly validated; callers need local filesystem / Cloudflare operator credentials.
const command=`UPDATE users SET role='${role}' WHERE uid='${uid}' AND disabled_at IS NULL; INSERT INTO audit_events(event_id,action,target_id,ts,metadata) SELECT '${crypto.randomUUID()}','operator_role_change','${uid}',unixepoch(),'${JSON.stringify({role})}' WHERE changes()>0;`;
const args=['d1','execute',mode==='--local'?'rocowiki':'rocowiki-production',mode,...(mode==='--remote'?['--env','production']:[]),'--command',command];
const child=spawnSync('../../node_modules/.bin/wrangler',args,{cwd:'apps/api',stdio:'inherit'});if(child.error)throw child.error;process.exitCode=child.status??1;
