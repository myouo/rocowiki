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

### Official pets, skills and learning relations

`npm run pets:import` downloads the public `https://res.17roco.qq.com/conf/Angel.config`, validates its header, inflates zlib and decodes AMF3 XML to rebuild `apps/web/content/official-pets.json`. For offline reproduction, use `npm run pets:import -- --input /path/to/Angel.config --retrieved-at 2026-10-11T15:35:45.354Z`, supplying the actual retrieval time. The snapshot retains the package SHA-256, configuration version, duplicate IDs and excluded count. Only `spirit_conf` entries with `isInBook="0"` are imported; identical rows with the same ID are deduplicated, while conflicting rows stop the import. Stat values follow the client's truncating `int()` conversion; missing values remain unknown.

The format was checked against [QueueConfs in open-roco-conn](https://github.com/fangtiancheng/open-roco-conn/blob/main/reference/main.swf/scripts/com/QQ/angel/install/config/QueueConfs.as) and `SpiritDesProxy.as`; the importer is independently implemented in TypeScript. Official base data and existing guides, bloodlines and activity sources retain separate provenance. Acquisition text in the configuration does not establish that an activity is open. Normal checks and builds use the committed snapshot without accessing official services. New entries use `/pets/?entry=official-ID`; existing article URLs are preserved.

Update modules live in `scripts/updates/`, with `npm run data:update` as their shared entry point and `.github/workflows/update.yml` (`Update source snapshots`) as their CI workflow. The existing pet, ladder and skill modules check every three hours (minute 23 of each three-hour UTC interval). Unchanged configuration and parsed data retain the original retrieval time without empty commits; `npm run pets:import -- --force` still explicitly captures a fresh retrieval time. Changed data is validated, section baselines are regenerated, and a `chore/data-update-*` PR is created using the data digest and main baseline. Retries with the same baseline and data reuse the candidate without force pushes or automatic merges. The existing deployment workflow handles merged updates.

Scheduling becomes active after the workflow reaches `main`. Repository Actions settings must permit PR creation; the built-in `GITHUB_TOKEN` is used without additional private configuration. Since its push events do not trigger normal CI, the updater explicitly dispatches `Validate` on the candidate branch for full read-only checks. A successful or unfinished dispatch for the same candidate commit suppresses duplicates; failed or cancelled validation can be retried. Remote permissions, scheduling and actual publication still require GitHub acceptance. `isInBook="0"` indicates client catalogue membership rather than proof of release or acquisition availability.

The directory defaults to descending catalogue numbers and continuous batches of 60. Long lists render equal-height cards near the viewport, with keyboard access to adjacent entries and a manual button when automatic loading is unavailable. Alphabetic placeholder names accompanied by unfinished descriptions enter the pending-data category; source IDs ≥ 10000 enter the special-ID category. Both remain accessible through their categories or all data; these conventions do not infer release status for named pets. Filters and loaded depth remain in the URL, detail return links retain the directory address, and scroll position stays in the current tab's sessionStorage (at most eight filter scopes). Data-version changes or blocked storage retain the query entry point and fall back to an available position.

Pet previews default to the official H5 URL `https://res.17roco.qq.com/h5/cdn/sprite-full-avatar/{ID}/{ID}-big.png`, verified as a 720×720 full-body image without zero padding. Load failures try `-720.png` (verified as 200×200), the existing image, then the official configuration icon before showing a placeholder. Cards load lazily and detail heroes eagerly; changing pets resets the sequence. Other recorded appearances retain their independent images until skin IDs are verified, rather than using the original species image. The URL follows [the official H5 getSpiritFullAvatar function](https://res.17roco.qq.com/h5/assets/main/index.js); no new local assets are downloaded.

The image-index decision is deferred. `WikiPet.previewSources` reserves an ordered URL interface: omitted values retain ID-based URLs, an empty array skips automatic URLs, and existing images and icon fallbacks remain available. Separate appearances do not use the species candidates. No image-index snapshot or scheduled image task exists yet. A future module can register in `scripts/updates/tasks.ts` and reuse the three-hour cadence and update PR flow; existing pet-data updates continue every three hours.

`npm run ladder:import` reads online `plugins/LadderMatch/LadderMatchConfig.xml`, validates it and rebuilds `apps/web/content/official-ladder.json`. Reproduce offline with `--input /path/to/LadderMatchConfig.xml --retrieved-at ACTUAL_RETRIEVAL_TIME`. Fees match IDs in `SpiritCost/spirit`; unlisted IDs default to one point under the official client's summation logic. Bans are read independently from `LimitSpirit/id` and never turn a fee into zero. Readers retain the XML URL, capture time and SHA-256 without inventing an effective date. Temporary server bans, acquisition availability and full-team conditions require separate verification. Official fees take precedence over historical samples or local modifications, with the same source used for fee sorting and filtering.

`npm run skills:import` decodes `spiritSkill_conf` from the same Angel.config into `official-skills.json`. Elements come from `spirit_conf`, categories from `damageType`, and records without `attackType` remain effects, statuses or capture balls. Duplicate IDs use the last source definition like the official client, with overridden fields recorded. The `speed` code is displayed and sorted directly as initiative, such as 8 for ordinary skills and 15 for 霞姿月韵; historical URLs and independently sourced structured interpretations remain available. When a unified run selects both pets and skills, it downloads the package once and shares its capture time; temporary inputs are cleaned up afterward.

Collect skill pools only from game configuration or official game-server data. Cards produced by the official forum moderator team linked from the game's website may corroborate results; other sites are supporting evidence only. The historical `pet-skill-relations.json` came from roco-desc and remains an auxiliary snapshot, without game verification. Its `skill_id` is a database key and `rank` is that reference table's learning level, not a game-protocol field. Third-party relation collection is disabled: `npm run skill-relations:import` explicitly refuses to run and no longer fetches or clones this source.

The historical relation module retains its `disabledReason`; the new `game-skill-relations` module runs daily at 09:41 China time. Scheduled runs and `all` skip disabled modules or modules without configured inputs; explicit selection reports the reason. The game collector, sanitized import and pet/skill lookup in both directions are integrated, but the game snapshot is currently empty and no continuously online collection channel is configured, so daily collection is not ready. Historical relations remain labeled as corroboration; the skill directory displays batches of 60.

Live investigation confirmed that RocoAI's `lineup_query_skill_pool` uses game command `0x0b000d`. Independently read actual bag species, position, level and instance identity before and after collection: the server can echo a requested species ID while returning another pet's bag-slot pool. `scripts/updates/game-skill-pool.ts` bounds response-body decoding and rejects identity, level or instance changes; its published result excludes account IDs, caught timestamps, credentials and packet headers. The response provides skill IDs, PP and inheritance flags, without learning levels or stone flags. Current pet level is not a learning level. Game-confirmed links are labeled as game collection and other links as corroboration; unknown game learning levels cannot be overwritten by historical or community data. Each record describes available skills for the captured bag instance at that time; absence does not establish that the species cannot learn a skill. Live collection for 圣萌王者·金冕 remains unfinished. Stop live collection when the server rejects login during closure, preserving pending verification.

Against an already-online local headless runtime or explicit loopback tunnel, run `npm run game-skill-relations:import -- --runtime tcp://127.0.0.1:PORT --pets 3402`, replacing PORT with the actual listening port. Supply an IPC token through `ROCO_GAME_RUNTIME_TOKEN`; never place game login keys in the repository or workflow. The collector reads existing bag pets, pools and session state, and manages and cleans up local traffic subscriptions. It does not log in, move pets, switch skills or consume items. The requested species must actually be in the bag; use `--positions 1` to select one actual position when several instances share a species. Alternatively, `--input /path/to/sanitized-game-captures.json` imports `{ schemaVersion: 1, captures: [...] }` from a trusted game collector. Fields must follow `GameSkillObservation`; account and unknown fields are rejected, and schema validation does not authenticate provenance. Imports match current official pet/skill IDs and reject older observations replacing newer results; unchanged content retains its previous capture version.

The unified entry reads `ROCO_GAME_RUNTIME` or `ROCO_GAME_SKILL_CAPTURE_FILE`, with optional `ROCO_GAME_SKILL_PETS` / `ROCO_GAME_SKILL_POSITIONS`. The workflow reserves matching repository variables; the IPC Secret is passed only to collection, not PR validation. The current GitHub-hosted runner has no local game runtime or sanitized input file. Automatic collection requires separately provisioning a managed online runtime, runner/tunnel or trusted file delivery; variables alone do not provide those external services. Checks and builds read committed snapshots without connecting to the game.

The updater selects modules by their `schedules` in `tasks.ts`, using GitHub's original trigger cron so queue delays do not change task selection. To add a daily or weekly module, register its unique ID, schedules, script, output files, checks and description, then add its cron to `update.yml`. Different cadences share the workflow, while each output file has one owner. Activity data and other sources have no automatic importer yet, and their cadences are not prescribed. Manual workflow runs accept `target=ladder`, comma-separated module IDs, or `all` to run enabled modules with configured inputs. Locally, use `npm run data:update -- --only ladder`, `--schedule '23 */3 * * *'`, or `--plan` to inspect selection; standalone module import commands remain available for offline reproduction.

Selected modules run in sequence and any import failure stops publication. Each module may still fetch its entire source, without running modules on other schedules. Any registered data change can create an update PR; the candidate digest includes registered snapshots, timestamp-only checks create no empty commit, and only registered outputs plus regenerated section baselines may change. Ladder data versions still invalidate browsing-position restoration so fee sorting changes cannot restore the wrong anchor.

### Email/password and delivery setup

The active flow uses site email/password credentials; production OIDC callbacks are disabled. Email and username both work for login. Usernames are stored in lowercase, contain 3–24 letters, digits, underscores or hyphens, start with a letter and cannot change after registration. Display names can change separately. Passwords contain 15–128 characters and are independently salted with scrypt. Email addresses are private; delivery providers never receive passwords.

1. Production uses Resend with noreply@wiki.rocoai.app as the default sender; authenticate wiki.rocoai.app in Resend first. Use the provider's actual DNS records; never invent DKIM/SPF values or overwrite root-domain mail records. Follow the [Resend setup guide](docs/resend-setup.en.md).
2. In repository Settings → Environments → production, set MAIL_PROVIDER=resend and MAIL_FROM=noreply@wiki.rocoai.app, with the Key in the RESEND_API_KEY Secret. Keep EMAIL_VERIFICATION_REQUIRED=true. Do not disclose credentials.
3. Run Deploy Wiki API. It migrates D1, securely uploads Secrets and verifies actual Worker password execution using an anonymous incorrect-password request without creating test users. Workers Free has a small CPU allowance; investigate resource limits if this check fails. Do not weaken hashing or bypass checks to launch.
4. Use QQ, 163, Gmail and Outlook mailboxes you control to test registration, resending, recovery and password changes. Record inbox/spam placement, latency and original authentication results; check whether click tracking rewrites or breaks verification links. API acceptance, Delivered metrics and historical benchmarks do not verify this site.

Email verification also requires the registration password. Permanent accounts are created only after verification; pending registrations expire after 24 hours and do not reserve permanent usernames. Password changes/resets revoke old sessions; recent authentication rechecks the same account password. Registration is closed without configured delivery. Complete real delivery, registration and recovery acceptance before formal enablement. Submissions and publishing have independent switches and acceptance procedures. Store production Secrets in the repository production environment for workflow deployment.

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
