import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
const file=process.argv[2];if(!file||!process.env.API_ORIGIN||!process.env.DEPLOY_WEBHOOK_SECRET)throw Error('Usage: API_ORIGIN / DEPLOY_WEBHOOK_SECRET from secure environment, node scripts/replay-receipt.mjs <version.json>');
const body=JSON.stringify(JSON.parse(await readFile(file,'utf8'))),time=String(Math.floor(Date.now()/1000));
const r=await fetch(`${process.env.API_ORIGIN}/webhooks/deploy`,{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Timestamp':time,'X-Signature':'sha256='+createHmac('sha256',process.env.DEPLOY_WEBHOOK_SECRET).update(`${time}.${body}`).digest('hex')},body,signal:AbortSignal.timeout(15000)});
if(!r.ok)throw Error(`Receipt rejected (${r.status})`);console.log('Receipt accepted; reconcile will verify the current public release.');
