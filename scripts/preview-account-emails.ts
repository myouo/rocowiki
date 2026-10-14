// SPDX-License-Identifier: GPL-3.0-only
import {createServer} from 'node:http';
import {buildAccountEmail, type AccountEmailPurpose} from '../packages/auth/src/account-email';

const port = 3012;
const issuedAt = Math.floor(Date.now() / 1000);
const samples = {
  verify: sample('verify_email', 86400),
  reset: sample('reset_password', 1800),
};

function sample(purpose: AccountEmailPurpose, lifetime: number) {
  const actionUrl = new URL('/workbench/', 'https://wiki.rocoai.app');
  actionUrl.hash = `${purpose === 'verify_email' ? 'verify' : 'reset'}=${'0'.repeat(64)}`;
  return buildAccountEmail({purpose, actionUrl, expiresAt: issuedAt + lifetime});
}

const review = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RocoWiki 邮件设计审阅</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f4f0;color:#303e54;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}header{background:#fff;border-bottom:1px solid #e3e5ec;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}h1{margin:0;font-size:20px;font-weight:600}header p{margin:3px 0 0;color:#68758a;font-size:12px}.status{padding:6px 12px;border:1px solid #e2d5bd;border-radius:20px;background:#fbf6ed;color:#756246;font-size:12px}.controls{max-width:1000px;margin:24px auto 16px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.group{display:flex;gap:4px;padding:4px;border:1px solid #e3e5ec;background:#fff;border-radius:12px}button{font:inherit;border:0;border-radius:8px;padding:8px 14px;background:transparent;color:#68758a;cursor:pointer}button[aria-pressed=true]{color:#365789;background:#edf2fb;font-weight:600}button:focus-visible,a:focus-visible{outline:2px solid #4969a2;outline-offset:3px}.links{display:flex;gap:18px}.links a{font-size:12px;color:#4969a2;text-underline-offset:3px}.stage{display:flex;justify-content:center;padding:0 16px 32px}.frame{width:min(100%,760px);border:1px solid #e3e5ec;border-radius:16px;overflow:hidden;background:#f6f4f0;box-shadow:0 12px 38px #47516e0b;transition:width .2s}.frame.mobile{width:375px;max-width:100%}iframe{display:block;border:0;width:100%;height:820px;background:#f6f4f0}.caption{max-width:1000px;margin:0 auto 16px;padding:0 24px;color:#68758a;font-size:12px}.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);padding:14px 18px;background:#303e54;color:white;border-radius:12px;font-size:13px;box-shadow:0 8px 24px #303e5420}.toast[hidden]{display:none}@media(max-width:640px){header{padding:16px 20px}.controls{padding:0 16px}.caption{padding:0 16px}.stage{padding:0 8px 24px}button{padding:8px 10px;font-size:13px}.links{gap:12px}}
</style></head><body>
<header><div><h1>邮件设计审阅</h1><p>RocoWiki · 账户邮件</p></div><span class="status">本地草稿 · 待你确认</span></header>
<div class="controls"><div class="group" aria-label="邮件类型"><button type="button" data-kind="verify" aria-pressed="true">邮箱验证</button><button type="button" data-kind="reset" aria-pressed="false">密码重置</button></div><div class="group" aria-label="预览宽度"><button type="button" data-size="desktop" aria-pressed="true">桌面</button><button type="button" data-size="mobile" aria-pressed="false">手机</button></div><div class="links"><a id="plain" href="/email/verify.txt" target="_blank">纯文本版本</a><a id="download" href="/email/verify.html?download=1">下载 HTML</a></div></div>
<p class="caption">预览使用示例链接。点击验证按钮仅展示预览提示，不会执行账号操作。</p>
<main class="stage"><div class="frame" id="frame"><iframe id="email" title="邮箱验证邮件预览" src="/email/verify.html"></iframe></div></main>
<div class="toast" role="status" id="toast" hidden></div>
<script>
let kind='verify';
const frame=document.getElementById('frame'),email=document.getElementById('email'),toast=document.getElementById('toast');
let contentObserver;
document.querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',()=>{
  kind=button.dataset.kind;
  document.querySelectorAll('[data-kind]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  email.src='/email/'+kind+'.html';email.title=kind==='verify'?'邮箱验证邮件预览':'密码重置邮件预览';
  document.getElementById('plain').href='/email/'+kind+'.txt';document.getElementById('download').href='/email/'+kind+'.html?download=1';toast.hidden=true;
}));
document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-size]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  frame.classList.toggle('mobile',button.dataset.size==='mobile');
}));
email.addEventListener('load',()=>{
  contentObserver?.disconnect();
  const content=email.contentDocument;
  if(!content?.body)return;
  const fit=()=>{email.style.height=(Math.ceil(content.body.getBoundingClientRect().height)+2)+'px';};
  contentObserver=new ResizeObserver(fit);contentObserver.observe(content.body);fit();
  content.querySelectorAll('a').forEach(link=>link.addEventListener('click',event=>{
    event.preventDefault();toast.textContent=link.hash?'预览按钮已点击。正式邮件会打开账号确认页面。':'这是预览中的站点链接。';toast.hidden=false;
  }));
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')toast.hidden=true;});
window.addEventListener('beforeunload',()=>contentObserver?.disconnect());
</script></body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.writeHead(405, {'Allow': 'GET'}).end();
    return;
  }
  if (url.pathname === '/') {
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}).end(review);
    return;
  }
  const match = /^\/email\/(verify|reset)\.(html|txt)$/.exec(url.pathname);
  if (!match) {
    response.writeHead(404).end('Not found');
    return;
  }
  const message = samples[match[1] as keyof typeof samples];
  const html = match[2] === 'html';
  if (url.searchParams.get('download') === '1') response.setHeader('Content-Disposition', `attachment; filename="rocowiki-${match[1]}.html"`);
  response.writeHead(200, {'Content-Type': html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'}).end(html ? message.html : message.text);
});
server.listen(port, '127.0.0.1', () => console.log(`Email review: http://localhost:${port}/ (synthetic links; no external email sent)`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close());
