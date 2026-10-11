import type {ApiEnv} from '../../../apps/api/src/types';

export function mailConfigured(env:ApiEnv){return Boolean(env.MAIL_FROM&&(env.MAIL_PROVIDER==='resend'&&env.RESEND_API_KEY||env.MAIL_PROVIDER==='brevo'&&env.BREVO_API_KEY));}
export async function sendAccountMessage(env:ApiEnv,message:{email:string;subject:string;text:string;html:string;idempotencyKey:string}){
  const brevo=env.MAIL_PROVIDER==='brevo';
  const response=await fetch(brevo?'https://api.brevo.com/v3/smtp/email':'https://api.resend.com/emails',{
    method:'POST',headers:brevo?{'api-key':env.BREVO_API_KEY!,'Content-Type':'application/json'}:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':message.idempotencyKey},
    body:JSON.stringify(brevo?{sender:{email:env.MAIL_FROM,name:'RocoWiki'},to:[{email:message.email}],subject:message.subject,textContent:message.text,htmlContent:message.html}:{from:env.MAIL_FROM,to:[message.email],subject:message.subject,text:message.text,html:message.html}),
    redirect:'error',signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw new Error('MAIL_DELIVERY_FAILED');
  const result=await response.json() as {id?:unknown;messageId?:unknown};
  if(typeof (brevo?result.messageId:result.id)!=='string'||!(brevo?result.messageId:result.id))throw new Error('MAIL_DELIVERY_FAILED');
}
