# RocoWiki

[中文](README.md) · [Contributing](CONTRIBUTING.en.md) · [Security](SECURITY.en.md)
<!-- rocowiki-policy: overview; version: 3; lang: en -->

<a id="status"></a>
## Status and architecture

An initial community Wiki for the original web version of Roco Kingdom. The frontend is the user-supplied Docusaurus V7.3.1 project; [migration history](docs/web-v731-integration.md) and [V1 requirements](RocoWiki_V1.md) describe its origins. The repository contains a static site, Workers API, D1 migrations, publishing state machine and CI configuration. **No real production deployment has been performed.** Production contribution and publishing flags default to false until external acceptance.

The web retains the imported catalogs, calculators, images and local fonts. Browser check-ins, comments, points, likes and simulated publication remain demo features, not authoritative D1/Git records. Formal accounts, drafts and review use /workbench/; registered shared articles use /wiki/. Only two articles are currently registered. Bundled examples are not automatically converted into formal editable entities. Public repository content automatically generates title/body search records; private drafts and account data are excluded.

See the [architecture](docs/architecture.md), [implementation review](docs/implementation-review.md) and [local validation](docs/validation.md) for exact scope and limits. These technical records are currently Chinese; normative community documents below have complete English counterparts.

<a id="setup"></a>
## Local development

Use Node.js 24.15.0+ and npm, with local development ports available.

```bash
npm ci
npm run db:migrate
npm run dev:api
```

In another terminal:

```bash
npm run dev:web
```

Use http://localhost:3000 for the site and http://localhost:8787 for the API. Do not mix localhost and 127.0.0.1, which changes Origin/cookie behavior. Without an identity provider, public reading remains available and login reports that the service is unconfigured. There is no local production-authentication bypass.

Copy apps/api/.dev.vars.example to the ignored .dev.vars file. Configure public development values in the top-level wrangler.jsonc variables:

- OIDC requires Code/PKCE S256/nonce, verified email, max_age and auth_time. Set issuer/client ID and the client secret, and register the localhost callback /auth/callback. Issuer plus subject maps to an independent Wiki UID; emails do not merge identities. Sessions retain hashes and validated authentication times, not provider access tokens or registration emails. Old SSO token issuance does not refresh the recent-authentication window.
- The publisher GitHub App uses one repository, Contents write and Pull requests write. Configure owner/repository, App/installation IDs and its private key. It does not merge PRs or bypass protection.
- Optional GitHub binding uses a separate OAuth application with read:user and user:email, callback /auth/github/callback, and separate client credentials. Verified commit-email disclosure requires explicit consent and per-submission opt-in.
- Keep GitHub webhook and deployment receipt secrets separate. Put production secrets through interactive Wrangler prompts rather than source files or command arguments.

An authorized operator grants roles using the actual UID and scripts/set-role.mjs; clients cannot assign roles. Production session cookies are host-only HttpOnly/Secure/SameSite=Lax. Read-only users and guests cannot mount editor forms. Development defaults to demo workspace mode; native production builds default to server mode, and offline HTML remains a demo.

<a id="verify"></a>
## Verification

```bash
API_ORIGIN=https://api.rocowiki.test SITE_URL=https://wiki.rocowiki.test npm run check
npm run types -w @rocowiki/api
npm run api:dry-run
```

check covers repository policies, content, architecture, TypeScript and selected legacy JS, real API/SQLite behavior, lifecycle/formal-workbench interactions, static builds, public search indexes and the version manifest. .test origins verify artifacts only. Mocks and local SQL do not replace real Workers/D1/OIDC/GitHub/Workers static hosting/mirror acceptance. Native production builds require explicit valid HTTPS API_ORIGIN and SITE_URL rather than empty APIs or example-site fallbacks.

Generated outputs are rebuilt from sources. Historical V5–V7.3 designs are under [the archive](apps/web/archive/design/README.md); they do not drive current runtime behavior. Add real entities through the controlled root catalog/schema with independent review. Public images use approved /media/ raster paths or explicitly registered HTTPS hosts.

<a id="workflow"></a>
## Publishing

1. A user submits an immutable revision. Critical pages need two distinct reviewers; self-review is forbidden.
2. Final approval and the publishing outbox job commit atomically.
3. A leased coordinator validates content, baseline and consent, then idempotently creates one controlled content/metadata commit, branch and PR.
4. Independent maintainers review and merge with a merge commit under required checks. Stale baselines become conflicts and need a new reviewed candidate; reviewed content is not automatically merged.
5. Trusted main CI builds a versioned artifact and a separate job deploys it to Cloudflare Workers Static Assets. Public version verification produces a signed receipt.
6. Published is confirmed only after receipt, actual online version and ancestry checks. Reconciliation records later withdrawal separately, keeps a durable cursor, and retries individual failures without blocking healthy records.
7. GitCode is a platform-side one-way pull mirror. Its observations do not change primary publication status.

Maintainers may merge main into a Wiki PR only while retaining the original contribution commit, approved bytes and metadata. Do not rebase/squash these branches. Replay a lost receipt from the corresponding immutable artifact instead of deploying again. Administrators can retry failed jobs; repeated failures are blocked for explicit recovery, not treated as publication.

Apply pending migrations before deploying dependent API code. Migrations 0004/0005 clear legacy recent-authentication claims while preserving login/drafts, and add durable per-record reconciliation errors. See [operations](docs/operations.md) for protection, environment variables, backup/recovery and external acceptance.

<a id="community"></a>
## Community and standards

Follow [contributing](CONTRIBUTING.en.md), [the code of conduct](CODE_OF_CONDUCT.en.md), [governance](GOVERNANCE.en.md), [engineering standards](docs/standards.en.md) and [repository instructions](AGENTS.en.md). [Support](SUPPORT.en.md) explains ordinary questions; vulnerabilities follow [security](SECURITY.en.md). Normative Chinese/English pairs share revisions and require joint review. GitHub private reporting needs backend activation, the conduct channel is pending, and the CODEOWNERS example is inactive.

<a id="license"></a>
## License

Original code and repository policy documents the project can license use **GPL-3.0-only**; see [LICENSE](LICENSE). Original Wiki prose that can be licensed under project policy uses **CC BY-SA 4.0**, with authors retaining copyright. Attributed redistribution, adaptation and commercial use are allowed; sharing adaptations requires ShareAlike compliance. Third-party dependencies, fonts, game images and reproduced material retain their original licenses and rights, without automatic retroactive relicensing. [The copyright statement](COPYRIGHT.en.md) defines scope, reuse and rights concerns; the footer links to /copyright/ and /copyright/en/. [Third-party notices](THIRD_PARTY_NOTICES.en.md) record unresolved rights. Neither code nor prose licensing grants game-asset redistribution rights. Submission-license consent records and a copyright contact channel remain prerequisites for opening contributions.
