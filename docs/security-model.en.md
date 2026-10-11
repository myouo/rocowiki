# Security boundaries and threat model
[中文](security-model.md) · [Reporting policy](../SECURITY.en.md)
<!-- rocowiki-policy: security-model; version: 2; lang: en -->

<a id="assets"></a>
## Protected assets

Protect identity/roles, sessions and authentication freshness, private drafts, immutable submissions/reviews, publishing jobs/leases, approved Git bytes, public sources/attribution and trusted artifacts/version evidence. OIDC secrets, App private keys, OAuth secrets, webhook HMAC and deployment tokens have separate purposes and do not enter clients, Git or routine logs.

<a id="boundaries"></a>
## Trust boundaries

| Boundary | Rule |
| --- | --- |
| Browser → API | Browser state is untrusted; verify session, Origin, CSRF, role and schema |
| OIDC/GitHub identity → Wiki | Issuer/subject maps to an independent UID; freshness checks auth_time; binding does not authorize email disclosure |
| D1 → Git | Immutable snapshots/reviews; server-controlled paths, types, idempotency, leases and attribution consent |
| PR → CI | Protected-base content checks; no production secrets in untrusted PR verification |
| Artifact → online site | SHA/digest, signed receipt, actual public version and ancestry jointly establish publication |
| Primary → mirror | Observe one-way mirroring only; mirror failures do not redefine primary state |

<a id="threats"></a>
## Threats and existing controls

- Old SSO, state/nonce replay and identity switching: one-use browser/session-bound state, PKCE, nonce, maximum authentication age and retained provider authentication time.
- Multiple tabs, cross-origin forgery and draft takeover: stable session CSRF, exact Origin/CORS, server UID and ownership checks.
- HTML/MDX, SVG and duplicate references: AST allowlists, consistent reference parsing, image path/extension/host policy and safe rendering.
- Post-review mutation, self-review and duplicate approval: immutable content, distinct reviewers, version CAS and transactional outbox.
- Lost responses, main changes and replaced leases: persistent idempotent targets, original contribution SHA, ancestry/content checks and fencing.
- Old CDN, forged receipts, deletion and reconciliation errors: trusted online version, immutable-tree deletion confirmation, durable cursor, per-record retry and atomic progress.
- Local data impersonating the community: formal mode does not treat local publication, points or roles as public authority.

<a id="limits"></a>
## Limits

These controls do not establish live deployment acceptance, complete abuse prevention, supply-chain review, privacy/content licensing clearance or independent security audit. The direct-dependency inventory is not a transitive-licensing conclusion. Ignored files and complete Git history are outside lightweight source scanning. Private reporting, CODEOWNERS and conduct contacts require backend configuration/confirmation. Test fixtures are not real OIDC/GitHub/D1/Workers static hosting acceptance.

<a id="validation"></a>
## Change verification

Authentication changes exercise real SDK parsing, invalid/expired claims, legacy-session migration and sensitive endpoints. Publishing changes exercise SQL, replay, concurrency, transaction failure and permission/deletion classification. UI changes exercise actual components and browser lifetimes. Record real coverage, apply pending migrations first, and follow operations for production configuration and recovery.
