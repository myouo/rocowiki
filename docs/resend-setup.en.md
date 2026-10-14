<!-- SPDX-License-Identifier: GPL-3.0-only -->
# Resend delivery for email registration

[简体中文](resend-setup.md) · [Contribution guide](../CONTRIBUTING.en.md)

The Wiki uses Resend's HTTP API for registration verification and password-reset emails. Production sends as `RocoWiki <noreply@wiki.rocoai.app>`. Wiki credentials, confirmation links and sessions remain on the backend. Domain verification, the Key, deployment and actual delivery acceptance still need completion. Local development disables real delivery by default.

## 1. Register and verify the domain

[Sign up](https://resend.com/signup). Under Domains → Add Domain, add `wiki.rocoai.app`. Copy the supplied records into the `rocoai.app` Cloudflare zone and verify until sending shows Verified.

Use the actual record types, names, values and MX priorities. Preserve website records, existing inbound MX and SPF/DMARC. Merge SPF/DMARC at the same name rather than creating duplicates. Sending verification normally uses a separate Return-Path subdomain's MX; it does not require migrating root-domain inboxes. Keep sending and website records separate; verification CNAME records use DNS only.

A verified domain can send from its noreply address without provisioning an inbox. Leave Open Tracking and Click Tracking off for account messages and verify the complete `#verify=`/`#reset=` links.

References: [Verified domains](https://resend.com/docs/dashboard/domains/introduction), [Cloudflare DNS](https://resend.com/docs/guides/dns/cloudflare).

## 2. Create a sending API key

Under API Keys → Create API Key, use a name such as `rocowiki-production`. Choose Sending access and restrict the sending domain to `wiki.rocoai.app`. The Key appears once; store it directly in the server Secret below.

Reference: [Create an API key](https://resend.com/docs/create-an-api-key).

## 3. Configure GitHub production

Open the repository's [Environments](https://github.com/myouo/rocowiki/settings/environments), select `production`, and set:

| Type | Name | Value |
| --- | --- | --- |
| Environment variable | `MAIL_PROVIDER` | `resend` |
| Environment variable | `MAIL_FROM` | `noreply@wiki.rocoai.app` |
| Environment secret | `RESEND_API_KEY` | Complete API key |

Keep the Key out of source, chat, screenshots, command arguments and Environment variables. The workflow uploads it as a Worker Secret. Keep email verification required.

These provider and sender values are local source defaults. GitHub variables override the selected commit's defaults. Deployment reads a main commit, not uncommitted local changes. Without a sending Key, registration and recovery remain unavailable.

## 4. Deploy and accept

Once the domain and Key are ready, run [Deploy Wiki API](https://github.com/myouo/rocowiki/actions/workflows/deploy-api.yml) on main under the repository's existing review and environment deployment process. It migrates D1, uploads Secrets and verifies the API version and Worker password runtime while keeping contributions closed.

Check [health](https://api.wiki.rocoai.app/health) for `registration_enabled: true`, `password_reset_available: true` and `email_verification_required: true`, with `submissions: false` and `publishing: false`. These indicate loaded configuration, not inbox placement.

Use QQ, 163, Gmail and Outlook mailboxes you control in the [workbench](https://wiki.rocoai.app/workbench/) to test registration, verification resending, confirmation, login, recovery and old-session invalidation. Confirmation requires the registration password. Record placement, latency and original authentication results. API success or Delivered events do not replace actual reception checks.

The free daily allowance counts messages, including resends and recovery. Check [current pricing](https://resend.com/pricing) for allowances and plans.

Report domain, Secret and deployment status without sharing keys, passwords, confirmation links or Cookies.

## Upgrade and recovery

Apply `0007_pending_registration_tokens.sql` to the local test database first. Production deployment also applies migrations before uploading code. This migration only adds a table for hashes of resent verification tokens; it does not change existing users or credentials. Confirmation, registration replacement and expiry cleanup remove the related tokens. Resending preserves earlier links for the same registration; one confirmation invalidates every link. Provider timeouts or malformed acknowledgments retain pending state so the user can resend. Only explicit rejection removes the token for that send.

Deployment removes retired mail credentials and a Resend key omitted from the production Secret, while preserving credentials for other services. Retain the new table when rolling back code. Older code recognizes only the original registration link; links resent during the upgrade require a new verification email. Do not delete the database or replace real accounts with demonstration data.
