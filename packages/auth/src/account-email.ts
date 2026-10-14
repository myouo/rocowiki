// SPDX-License-Identifier: GPL-3.0-only
export type AccountEmailPurpose = 'verify_email' | 'reset_password';

interface AccountEmailInput {
  purpose: AccountEmailPurpose;
  actionUrl: URL;
  expiresAt: number;
}

export interface AccountEmailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

export function buildAccountEmail({purpose, actionUrl, expiresAt}: AccountEmailInput): AccountEmailContent {
  const verifying = purpose === 'verify_email';
  const subject = verifying ? '验证你的 RocoWiki 邮箱' : '重置你的 RocoWiki 密码';
  const title = verifying ? '确认你的邮箱' : '重置你的密码';
  const introduction = verifying
    ? '欢迎来到 RocoWiki。确认邮箱后，即可登录你的账号。'
    : '我们收到了一条重置 RocoWiki 账号密码的请求。请通过下方按钮设置新密码。';
  const action = verifying ? '验证邮箱并继续' : '设置新密码';
  const nextStep = verifying
    ? '打开页面后，还需要输入你注册时设置的密码。'
    : '密码重置完成后，原有登录会话将失效。';
  const ignore = verifying
    ? '如果这不是你发起的注册，请忽略这封邮件。'
    : '如果你没有申请重置密码，请忽略这封邮件。你的密码不会因此改变。';
  const expiry = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(expiresAt * 1000)) + '（北京时间）';
  const href = escapeHtml(actionUrl.href);
  const site = escapeHtml(actionUrl.origin);
  const siteName = escapeHtml(actionUrl.host);
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif";

  return {
    subject,
    text: `${subject}\n\n${introduction}\n\n${action}：\n${actionUrl.href}\n\n${nextStep}\n链接有效至：${expiry}\n\n${ignore}\n\nRocoWiki · 洛克王国页游 · 玩家共建百科`,
    html: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    @media screen and (max-width: 600px) {
      .email-shell { padding: 20px 12px !important; }
      .email-content { padding: 28px 24px !important; }
      .email-title { font-size: 26px !important; }
      .email-button { width: 100% !important; }
      .email-action { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f6f4f0;font-family:${font};color:#4b5768;">
  <div aria-hidden="true" style="display:none;font-size:1px;line-height:1px;color:#f6f4f0;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${introduction}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f4f0" style="width:100%;border-collapse:collapse;">
    <tr><td class="email-shell" align="center" style="padding:40px 20px;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;table-layout:fixed;border:1px solid #e3e5ec;border-radius:18px;border-collapse:separate;overflow:hidden;">
        <tr><td class="email-content" style="padding:36px 40px;">
          <p style="margin:0 0 4px;color:#303e54;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;font-weight:700;">RocoWiki</p>
          <p style="margin:0;color:#68758a;font-size:12px;line-height:20px;">洛克王国页游 · 玩家共建百科</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td style="height:26px;border-bottom:1px solid #e3e5ec;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
          <h1 class="email-title" style="margin:28px 0 12px;color:#303e54;font-size:30px;line-height:1.4;font-weight:600;">${title}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:27px;">${introduction}</p>
          <table class="email-button" role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;"><tr><td align="center" bgcolor="#4969a2" style="border-radius:10px;mso-padding-alt:15px 28px;">
            <a class="email-action" href="${href}" target="_blank" style="display:inline-block;padding:15px 28px;border:1px solid #4969a2;border-radius:10px;color:#ffffff;background-color:#4969a2;text-decoration:none;font-size:16px;line-height:22px;font-weight:600;">${action}</a>
          </td></tr></table>
          <p style="margin:13px 0 24px;color:#68758a;font-size:13px;line-height:23px;">${nextStep}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f5fa" style="width:100%;border:1px solid #e3e5ec;border-radius:12px;border-collapse:separate;"><tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;color:#68758a;font-size:12px;line-height:20px;">链接有效至</p>
            <p style="margin:0;color:#303e54;font-size:14px;line-height:24px;">${escapeHtml(expiry)}</p>
          </td></tr></table>
          <p style="margin:24px 0 6px;color:#4b5768;font-size:13px;line-height:22px;font-weight:600;">按钮无法打开？</p>
          <p style="margin:0 0 8px;color:#68758a;font-size:12px;line-height:21px;">复制以下链接，在浏览器中打开：</p>
          <p style="margin:0;font-size:12px;line-height:21px;word-break:break-all;overflow-wrap:anywhere;word-wrap:break-word;">
            <a href="${href}" target="_blank" style="color:#4969a2;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;word-wrap:break-word;">${href}</a>
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td style="height:24px;border-bottom:1px solid #e3e5ec;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
          <p style="margin:18px 0 0;color:#68758a;font-size:12px;line-height:22px;">${ignore}</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:18px 0 0;color:#68758a;font-size:12px;line-height:20px;">这是一封自动发送的邮件，请勿直接回复。</p>
      <p style="margin:3px 0 0;font-size:12px;line-height:20px;"><a href="${site}" style="color:#68758a;text-decoration:none;">${siteName}</a></p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
