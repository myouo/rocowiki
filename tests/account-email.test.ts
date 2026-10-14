// SPDX-License-Identifier: GPL-3.0-only
import {expect, it} from 'vitest';
import {buildAccountEmail} from '../packages/auth/src/account-email';

const expiresAt = Date.UTC(2026, 9, 15, 10, 30) / 1000;
const actionUrl = new URL(`https://wiki.rocowiki.test/workbench/#verify=${'0'.repeat(64)}`);

it('keeps the confirmation link intact in HTML and plain text and states the real expiry and password requirement', () => {
  const message = buildAccountEmail({purpose: 'verify_email', actionUrl, expiresAt});
  expect(message.subject).toBe('验证你的 RocoWiki 邮箱');
  expect(message.text).toContain(actionUrl.href);
  expect(message.html).toContain(`href="${actionUrl.href}"`);
  for (const content of [message.text, message.html]) {
    expect(content).toContain('注册时设置的密码');
    expect(content).toContain('2026年10月15日 18:30（北京时间）');
    expect(content).not.toContain('验证码');
  }
  expect(message.html).not.toMatch(/<script|<img|<link[^>]+stylesheet|@font-face/i);
});

it('uses recovery instructions for reset links without requesting the forgotten password', () => {
  const url = new URL(actionUrl); url.hash = `reset=${'1'.repeat(64)}`;
  const message = buildAccountEmail({purpose: 'reset_password', actionUrl: url, expiresAt});
  expect(message.subject).toBe('重置你的 RocoWiki 密码');
  for (const content of [message.text, message.html]) {
    expect(content).toContain('设置新密码');
    expect(content).toContain('原有登录会话将失效');
    expect(content).not.toContain('注册时设置的密码');
  }
  expect(message.text).toContain(url.href);
});

it('escapes the same destination for both button and fallback without changing the copied URL', () => {
  const url = new URL('https://wiki.rocowiki.test/workbench/?a=1&b=2#verify=synthetic');
  const message = buildAccountEmail({purpose: 'verify_email', actionUrl: url, expiresAt});
  expect(message.html.match(/href="https:\/\/wiki\.rocowiki\.test\/workbench\/\?a=1&amp;b=2#verify=synthetic"/g)).toHaveLength(2);
  expect(message.text).toContain(url.href);
  expect(message.html).not.toContain('href="' + url.href + '"');
});
