// SPDX-License-Identifier: GPL-3.0-only
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
// Use the runtime bundled with the project's pinned Wrangler, including its V4 adapter.
const runtimeRequire = createRequire(require.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = runtimeRequire('miniflare');
const root = path.resolve(__dirname, '../../..');
const temporary = mkdtempSync(path.join(tmpdir(), 'rocowiki-mail-runtime-'));

async function main() {
  let calls = 0, providerStatus = 200;
  const bundle = await esbuild.build({
    stdin: { resolveDir: root, loader: 'ts', contents: `
      import { sendAccountMessage } from './packages/auth/src/mail';
      export default { async fetch(request) {
        const mode = new URL(request.url).searchParams.get('mode');
        const env = { MAIL_PROVIDER: 'resend', MAIL_FROM: 'accounts@example.test', RESEND_API_KEY: mode === 'missing' ? '' : 'synthetic-mail-key' };
        try {
          await sendAccountMessage(env, { email: 'recipient@example.test', subject: '验证邮件', text: '合成内容', html: '<p>合成内容</p>', idempotencyKey: 'synthetic-mail-id' });
          return Response.json({ ok: true });
        } catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
      } };
    ` },
    bundle: true, write: false, platform: 'browser', format: 'esm', logLevel: 'silent',
  });
  const worker = new Miniflare(convertV4MiniflareOptions({
    modules: true, compatibilityDate: '2026-10-10', compatibilityFlags: ['nodejs_compat'],
    script: bundle.outputFiles[0].text, rootPath: temporary,
    outboundService: async request => {
      calls++;
      assert.equal(request.url, 'https://api.resend.com/emails');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.get('authorization'), 'Bearer synthetic-mail-key');
      assert.equal(request.headers.get('idempotency-key'), 'synthetic-mail-id');
      const message = await request.json();
      assert.equal(message.from, 'RocoWiki <accounts@example.test>');
      assert.deepEqual(message.to, ['recipient@example.test']);
      assert.equal(message.subject, '验证邮件');
      assert.equal(message.text, '合成内容');
      return providerStatus === 302 ? new Response(null, { status: 302, headers: { Location: 'https://untrusted.example.test' } })
        : Response.json({ id: 'synthetic-delivery' });
    },
  }));
  try {
    let response = await worker.dispatchFetch('https://mail-runtime.test/');
    assert.equal(response.status, 200, 'the real Workers fetch must accept the adapter options');
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls, 1);
    providerStatus = 302;
    response = await worker.dispatchFetch('https://mail-runtime.test/');
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'MAIL_DELIVERY_FAILED' });
    assert.equal(calls, 2, 'credentials must not follow a redirect');
    response = await worker.dispatchFetch('https://mail-runtime.test/?mode=missing');
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'MAIL_NOT_CONFIGURED' });
    assert.equal(calls, 2, 'missing keys must not contact the provider');
    console.log('Worker mail runtime passed: real fetch, redirect rejection and missing-key guard. No external email sent.');
  } finally { await worker.dispose(); }
}
main().finally(() => rmSync(temporary, { recursive: true, force: true })).catch(error => { console.error(error); process.exitCode = 1; });
