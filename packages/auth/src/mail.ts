import type {ApiEnv} from '../../../apps/api/src/types';

export function mailConfigured(env:ApiEnv){return Boolean(env.MAIL_PROVIDER==='resend'&&env.MAIL_FROM?.trim()&&env.RESEND_API_KEY?.trim());}
export async function sendAccountMessage(env:ApiEnv,message:{email:string;subject:string;text:string;html:string;idempotencyKey:string}){
  if(!mailConfigured(env))throw new Error('MAIL_NOT_CONFIGURED');
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY!.trim()}`,'Content-Type':'application/json','Idempotency-Key':message.idempotencyKey},
    body:JSON.stringify({from:`RocoWiki <${env.MAIL_FROM.trim()}>`,to:[message.email],subject:message.subject,text:message.text,html:message.html}),
    // Workers supports manual/follow; rejecting non-2xx prevents forwarding credentials.
    redirect:'manual',signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw new Error('MAIL_DELIVERY_FAILED');
  const result=await response.json().catch(()=>null) as {id?:unknown}|null;
  if(!result||typeof result.id!=='string'||!result.id.trim())throw new Error('MAIL_DELIVERY_FAILED');
}
