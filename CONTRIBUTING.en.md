# Contributing
[中文](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.en.md) · [Security](SECURITY.en.md)
<!-- rocowiki-policy: contributing; version: 5; lang: en -->

<a id="entry"></a>
## Choose an entry point

Use issue templates for ordinary bugs, features and content corrections; report vulnerabilities privately. Describe the problem and impact without unredacted logs or account information. Code PRs, Wiki submissions and security reports have separate entry points; a code PR is not required for every concern.

<a id="wiki"></a>
## Wiki contributions

Use /workbench/ with a verified-email site account and contribution permission. GitHub binding is optional. Edit a registered page from its real baseline, explain the change and provide verifiable sources. Distinguish official evidence, tests, inference and unverified information. Samples, demo publication and local points are not public records.

Submissions lock their snapshots; self-review is forbidden and critical pages require two distinct reviewers. Changed baselines require a new reviewed candidate. GitHub email attribution requires binding, explicit consent and opt-in for that submission; this is separate from code or content licensing.

Submit only original material you can provide or material with appropriate permission, with sources for quotations. New original Wiki prose uses **CC BY-SA 4.0** under project policy, with authors retaining copyright. Attributed redistribution, adaptation and commercial use are allowed; sharing adaptations requires ShareAlike compliance. Follow [the copyright statement](COPYRIGHT.en.md), distinguishing quotations from original contributions and preserving authors and licensing evidence. Do not relicense game assets or material you cannot license as CC. Submission does not transfer copyright. Explicit license confirmation and server-side consent records must be implemented before opening formal contributions; these are not implemented yet. GitHub email attribution consent cannot replace content permission. A new license must not retroactively cover existing works without authority.

<a id="setup"></a>
## Local development

Use Node.js 24.15.0+, npm ci for locked dependencies, and npm run db:migrate for the local database. Run npm run dev:api and npm run dev:web separately. Use localhost:3000 and localhost:8787 consistently, without mixing 127.0.0.1. Configure public development values and the untracked apps/api/.dev.vars. Configure public API values in apps/api/wrangler.jsonc and use apps/api/.dev.vars.example for private settings. Current authentication uses site email/password credentials. GitHub binding uses a separate OAuth app with callback http://localhost:8787/auth/github/callback. Install the publisher App only on the Wiki repository with Contents write and Pull requests write permissions. Store production secrets in the repository production environment for API workflow deployment, never source files or command arguments.

Offline/browser demos provide neither authentication bypass nor production publishing. Regenerate outputs from their sources; do not patch build, dist, docs-generated, or src/generated to fix current behavior.

### Official pet base data

`npm run pets:import` downloads the public `https://res.17roco.qq.com/conf/Angel.config`, validates its header, inflates zlib and decodes AMF3 XML to rebuild `apps/web/content/official-pets.json`. For offline reproduction, use `npm run pets:import -- --input /path/to/Angel.config --retrieved-at 2026-10-11T15:35:45.354Z`, supplying the actual retrieval time. The snapshot retains the package SHA-256, configuration version, duplicate IDs and excluded count. Only `spirit_conf` entries with `isInBook="0"` are imported; identical rows with the same ID are deduplicated, while conflicting rows stop the import. Stat values follow the client's truncating `int()` conversion; missing values remain unknown.

The format was checked against [QueueConfs in open-roco-conn](https://github.com/fangtiancheng/open-roco-conn/blob/main/reference/main.swf/scripts/com/QQ/angel/install/config/QueueConfs.as) and `SpiritDesProxy.as`; the importer is independently implemented in TypeScript. Official base data and existing guides, bloodlines and activity sources retain separate provenance. Acquisition text in the configuration does not establish that an activity is open. Normal checks and builds use the committed snapshot without accessing official services. New entries use `/pets/?entry=official-ID`; existing article URLs are preserved.

The `Update official pet snapshot` workflow checks every three hours (minute 23 of each three-hour UTC interval), with manual dispatch available. Unchanged configuration and parsed data retain the original retrieval time without empty commits; use `npm run pets:import -- --force` to explicitly capture a fresh retrieval time. Changed data is validated, section baselines are regenerated, and a `chore/official-pets-*` PR is created using the data digest and main baseline. Retries with the same baseline and data reuse the candidate without force pushes or automatic merges. The existing deployment workflow handles merged updates.

Scheduling becomes active after the workflow reaches `main`. Repository Actions settings must permit PR creation; the built-in `GITHUB_TOKEN` is used without additional private configuration. Since its push events do not trigger normal CI, the updater explicitly dispatches `Validate` on the candidate branch for full read-only checks. Remote permissions, scheduling and actual publication still require GitHub acceptance. `isInBook="0"` indicates client catalogue membership rather than proof of release or acquisition availability.

The directory defaults to descending catalogue numbers and continuous batches of 60. Long lists render equal-height cards near the viewport, with keyboard access to adjacent entries and a manual button when automatic loading is unavailable. Alphabetic placeholder names accompanied by unfinished descriptions enter the pending-data category; source IDs ≥ 10000 enter the special-ID category. Both remain accessible through their categories or all data; these conventions do not infer release status for named pets. Filters and loaded depth remain in the URL, detail return links retain the directory address, and scroll position stays in the current tab's sessionStorage (at most eight filter scopes). Data-version changes or blocked storage retain the query entry point and fall back to an available position.

`npm run ladder:import` reads online `plugins/LadderMatch/LadderMatchConfig.xml`, validates it and rebuilds `apps/web/content/official-ladder.json`. Reproduce offline with `--input /path/to/LadderMatchConfig.xml --retrieved-at ACTUAL_RETRIEVAL_TIME`. Fees match IDs in `SpiritCost/spirit`; unlisted IDs default to one point under the official client's summation logic. Bans are read independently from `LimitSpirit/id` and never turn a fee into zero. Readers retain the XML URL, capture time and SHA-256 without inventing an effective date. Temporary server bans, acquisition availability and full-team conditions require separate verification. Official fees take precedence over historical samples or local modifications, with the same source used for fee sorting and filtering.

The three-hour workflow refreshes pet and ladder snapshots sequentially and stops publication if either import fails. Ladder-only changes can create an update PR even when Angel.config is unchanged. Candidate digests include both snapshots; time-only changes still produce no empty commits. Only the two datasets and regenerated section baselines may change. The ladder data version also invalidates remembered browsing positions when fee ordering changes.

### Email/password and delivery setup

The active flow uses site email/password credentials; production OIDC callbacks are disabled. Email and username both work for login. Usernames are stored in lowercase, contain 3–24 letters, digits, underscores or hyphens, start with a letter and cannot change after registration. Display names can change separately. Passwords contain 15–128 characters and are independently salted with scrypt. Email addresses are private; delivery providers never receive passwords.

1. Authenticate a dedicated sending subdomain you control in Brevo or Resend, such as mail.wiki.rocoai.app, with a sender such as accounts@mail.wiki.rocoai.app. Use the provider's actual DNS records; never invent DKIM/SPF values or overwrite root-domain mail records.
2. In repository Settings → Environments → production, add MAIL_PROVIDER (brevo or resend) and MAIL_FROM (a plain email address), with the corresponding Key in BREVO_API_KEY or RESEND_API_KEY Secret. Keep EMAIL_VERIFICATION_REQUIRED=true. Do not disclose credentials.
3. Run Deploy Wiki API. It migrates D1, securely uploads Secrets and verifies actual Worker password execution using an anonymous incorrect-password request without creating test users. Workers Free has a small CPU allowance; investigate resource limits if this check fails. Do not weaken hashing or bypass checks to launch.
4. Use QQ, 163, Gmail and Outlook mailboxes you control to test registration, resending, recovery and password changes. Record inbox/spam placement, latency and original authentication results; check whether click tracking rewrites or breaks verification links. API acceptance, Delivered metrics and historical benchmarks do not verify this site.

Email verification also requires the registration password. Permanent accounts are created only after verification; pending registrations expire after 24 hours and do not reserve permanent usernames. Password changes/resets revoke old sessions; recent authentication rechecks the same account password. Registration is closed without configured delivery. Delivery is not configured or accepted yet, so formal registration, submissions and publishing remain closed. Store production Secrets in the repository production environment for workflow deployment.

### GitHub integration setup

Create a dedicated publisher GitHub App under Settings → Developer settings → GitHub Apps. Set the homepage to https://wiki.rocoai.app and grant Contents and Pull requests Read and write, retaining the automatic Metadata Read permission. Install it only on myouo/rocowiki. Configure branch protection and independent maintainer merging separately.

Set the webhook URL to https://api.wiki.rocoai.app/webhooks/github and subscribe to Push and Pull request. Generate a random webhook secret, store it in the App settings and the repository production environment as GITHUB_WEBHOOK_SECRET, and leave the webhook disabled until configuration is deployed. Generate an App private key and store the complete PEM as the GITHUB_APP_PRIVATE_KEY production secret. Store the App ID and the Installation ID from the installation-page URL as GITHUB_APP_ID and GITHUB_INSTALLATION_ID environment variables.

User binding uses a separate OAuth App under Developer settings → OAuth Apps. Set its homepage to https://wiki.rocoai.app and Authorization callback URL to https://api.wiki.rocoai.app/auth/github/callback. Store Client ID as the GITHUB_OAUTH_CLIENT_ID production variable and Client Secret as the GITHUB_OAUTH_CLIENT_SECRET secret. Binding requests read:user and user:email, with no repository-write scope.

Run Deploy Wiki API after configuration changes. Keep submissions and publishing closed until real login, callback and webhook verification completes. GitHub binding does not replace Wiki email/password registration and login. See [GitHub App registration](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-using-url-parameters) and [OAuth App registration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).

<a id="change"></a>
## Code and documentation

Follow [repository instructions](AGENTS.en.md) and [the security policy](SECURITY.en.md). Keep PRs focused and reviewable. Use TypeScript for new business logic and expand type coverage module by module when editing legacy JavaScript. Contract, identity, content, transaction and lifecycle regressions must exercise real boundaries rather than two mutually compatible mocks.

Validate external data before use. Dispose of component requests, timers, observers, events and portals with their lifecycle. Reuse soft backgrounds, rounded corners and consistent widths; check narrow screens, long content, keyboard use and empty/error states. Update frontend and backend contracts together. Append numbered database migrations without changing applied migrations, and preserve idempotency keys and failure records across retries.

Update Chinese and English policy documents together, with matching revision and sections. Preserve third-party licenses and provenance and update [third-party notices](THIRD_PARTY_NOTICES.en.md). Original code and repository policy-document contributions use GPL-3.0-only. No CLA, copyright assignment or DCO sign-off is required.

<a id="git"></a>
## Branches, commits and PRs

Use descriptive branches, preferably feat/, fix/, docs/, chore/, refactor/ or test/. Branch names must not contain agent anywhere, case-insensitively. wiki/rev_UUID is reserved for the publisher App. Describe the actual change in commits; type(scope): summary is recommended.

Use the PR template to describe the problem, outcome, verification and migration/compatibility impact. Code and content use their respective independent reviews. Do not bypass main protection, required checks or production approval. Merging main into a Wiki PR must preserve the original contribution commit, content and source metadata. Rebase/squash is forbidden for these PRs.

<a id="verify"></a>
## Verification

```bash
API_ORIGIN=https://api.rocowiki.test SITE_URL=https://wiki.rocowiki.test npm run check
npm run api:dry-run
```

check covers repository standards, content, architecture, types, API/SQLite, lifecycle, formal workbench and builds. The .test origins only verify local artifacts. Add necessary failure reproduction or browser checks for the change; empty tests, unrelated snapshots and repeated runs are not evidence. Explicitly identify external acceptance that has not occurred.

<a id="review"></a>
## Review and merge

Contributors resolve CI failures, explain trade-offs and respond to review. Identity, authorization, Git wrapper, publishing coordinator, migrations, policy, dependencies and workflows require independent code review by an appropriately skilled reviewer. Test migrations first and specify upgrade order and recovery. Production operations use existing operational authorization. Maintainers update relevant verification and release records after merging.
