# Contributing
[中文](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.en.md) · [Security](SECURITY.en.md)
<!-- rocowiki-policy: contributing; version: 3; lang: en -->

<a id="entry"></a>
## Choose an entry point

Use issue templates for ordinary bugs, features and content corrections; report vulnerabilities privately. Describe the problem and impact without unredacted logs or account information. Code PRs, Wiki submissions and security reports have separate entry points; a code PR is not required for every concern.

<a id="wiki"></a>
## Wiki contributions

Use /workbench/ with a verified-email OIDC account and contribution permission. GitHub binding is optional. Edit a registered page from its real baseline, explain the change and provide verifiable sources. Distinguish official evidence, tests, inference and unverified information. Samples, demo publication and local points are not public records.

Submissions lock their snapshots; self-review is forbidden and critical pages require two distinct reviewers. Changed baselines require a new reviewed candidate. GitHub email attribution requires binding, explicit consent and opt-in for that submission; this is separate from code or content licensing.

Submit only original material you can provide or material with appropriate permission, with sources for quotations. New original Wiki prose uses **CC BY-SA 4.0** under project policy, with authors retaining copyright. Attributed redistribution, adaptation and commercial use are allowed; sharing adaptations requires ShareAlike compliance. Follow [the copyright statement](COPYRIGHT.en.md), distinguishing quotations from original contributions and preserving authors and licensing evidence. Do not relicense game assets or material you cannot license as CC. Submission does not transfer copyright. Explicit license confirmation and server-side consent records must be implemented before opening formal contributions; these are not implemented yet. GitHub email attribution consent cannot replace content permission. A new license must not retroactively cover existing works without authority.

<a id="setup"></a>
## Local development

Use Node.js 24.15.0+, npm ci for locked dependencies, and npm run db:migrate for the local database. Run npm run dev:api and npm run dev:web separately. Use localhost:3000 and localhost:8787 consistently, without mixing 127.0.0.1. Configure public development values and the untracked apps/api/.dev.vars. Configure public API values in apps/api/wrangler.jsonc and use apps/api/.dev.vars.example for private settings. OIDC requires verified email, PKCE and auth_time; the development callback is http://localhost:8787/auth/callback. GitHub binding uses a separate OAuth app with callback http://localhost:8787/auth/github/callback. Install the publisher App only on the Wiki repository with Contents write and Pull requests write permissions. Set production secrets through interactive Wrangler prompts, never source files or command arguments.

Offline/browser demos provide neither authentication bypass nor production publishing. Regenerate outputs from their sources; do not patch build, dist, docs-generated, or src/generated to fix current behavior.

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
