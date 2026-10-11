# Engineering standards
[中文](standards.md) · [Contributing](../CONTRIBUTING.en.md)
<!-- rocowiki-policy: standards; version: 1; lang: en -->

<a id="structure"></a>
## Structure and data authority

apps/web owns presentation and apps/api owns identity and writes. packages separates protocol, authentication, content validation, Git and publishing responsibilities. Add shared capabilities at these boundaries; do not duplicate database, credential or server business logic in the frontend. Frontend data enters through wiki/content/bundled.js; formal editing uses the root catalog rather than guessed similar names. Reviewed Git content and D1 identity/workflow state have distinct authority; browser demos never become server records.

<a id="code"></a>
## Code and lifecycle

Use TypeScript with explicit data types for new business modules. Add JSDoc/checkJs or migrate legacy JavaScript module by module. Do not hide defects with broad any, double assertions, ts-nocheck or disabled checks. Validate external data before business use. Models do not depend on React or Docusaurus; keep responsibilities focused and respect dependency and file-size gates.

Dispose of requests, timers, observers, listeners and portals with their document/component lifetime. Do not read unmounted or null DOM, or let older requests overwrite newer pages. Responsive verification covers narrow/desktop views, long content, keyboard use and empty/error states. Reuse soft backgrounds, rounded panels and shared content widths rather than creating independent detail-page styles.

<a id="security"></a>
## Security and failures

Follow SECURITY.md. Validate public input with schema/content rules and enforce byte limits for bodies, metadata and requests. Retries retain idempotency keys/resource IDs. Distinguish confirmed success, confirmed deletion, transient failures and permission errors. Transactions protect state, events and progress; leases protect concurrency. Do not silently discard failures. Error codes need safe, understandable messages; logs never contain tokens, cookies, private keys or user body text.

<a id="changes"></a>
## Contracts, dependencies and migrations

Update server responses, frontend contracts and necessary integration tests together. Append numbered migrations without editing already-applied ones and explain effects on old sessions, drafts and historical events. Migrate before deploying compatible code when required. Dependency changes update the lockfile and document purpose and licensing; avoid duplicate libraries. Test bypasses do not enter production paths.

<a id="tests"></a>
## Verification

Match checks to risk. Authentication, authorization, immutable snapshots, review, publishing and recovery require real contracts, SQL or upstream-boundary regressions; interface defects need actual component/browser evidence. Small reversible wording/style edits do not require ceremonial tests. Type gates cover only included files; mocks do not establish live platform integration. Commands are in CONTRIBUTING.en.md; reports identify coverage limits.

<a id="docs"></a>
## Bilingual policies and generated output

Register policy pairs in docs/policies.json and update revisions, sections and requirements together. Structural checks do not replace semantic review. ADRs document context, decisions and consequences with Chinese/English summaries. Examples use .test/example origins, synthetic accounts and empty secrets. Regenerate outputs from controlled inputs, retaining sources, lockfiles, provenance, hashes and licenses. Archived designs are not current runtime inputs.

Run npm run check:repository for policy revisions/sections, language links, relative file links, project/lockfile licensing, inventory versions/notice hashes, Git candidate files and the prohibited branch token. It runs in check and production artifact verification. It recognizes limited credential patterns, does not read ignored local secrets, and does not scan complete Git history or verify translation semantics/asset permission. After direct-dependency changes, run npm run licenses:refresh and review its output; updating hashes is not a substitute for reviewing actual policy or license changes.

<a id="release"></a>
## Releases

Keep independent review, main protection and publisher file allowlists. Do not overwrite reviewed content or merge it automatically. Before release, verify production configuration, migrations, reconciliation errors, content rights and source availability. When distributing GPL code, retain LICENSE and original copyright/third-party notices and provide corresponding source. The license text and existing file notices govern rights. Actual protection settings, reporting contacts, backups and platform acceptance must be configured; documents alone do not activate them.
