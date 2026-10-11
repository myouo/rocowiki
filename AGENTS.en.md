# Repository instructions
[中文](AGENTS.md) · [Full standards](docs/standards.en.md)
<!-- rocowiki-policy: repository-instructions; version: 1; lang: en -->

<a id="scope"></a>
## Scope and authorization

Applies across the repository alongside CONTRIBUTING.en.md, SECURITY.en.md and docs/standards.en.md. Valid task authorization from the user and higher-priority instructions take precedence. Independent review/production approval rules govern merging and production operations; they do not block authorized local investigation, implementation or verification. Never invent deployment status, maintainer accounts or contacts.

<a id="git"></a>
## Git

- Branch names never contain agent anywhere, case-insensitively.
- Use descriptive names, preferably feat/, fix/, docs/, chore/, refactor/ or test/; wiki/rev_UUID is reserved for the publisher.
- Preserve users' uncommitted changes. Do not perform destructive resets, history rewrites or force pushes without authorization.

<a id="implementation"></a>
## Implementation

- Inspect current modules, contracts and related documentation first; use rg for text/file search.
- Preserve apps/web, apps/api and packages boundaries and the established soft UI.
- The server determines identity, roles and recent authentication; demo data is not a real identity or balance.
- Dispose of request/DOM resources with their lifetime and preserve transaction, idempotency and lease boundaries.
- Type new business code and expand legacy JS coverage incrementally; do not disable gates or patch generated output to hide source defects.
- Never introduce secrets, private keys, databases, real cookies/tokens or user drafts. Use synthetic examples.
- Original code and repository policy documents use GPL-3.0-only. Preserve third-party notices without automatic relicensing.

<a id="verification"></a>
## Verification and documentation

Run checks appropriate to CONTRIBUTING.en.md and repair genuine failures. Update both languages and their revisions/sections for policy changes. Explain changes, reasons, validation and actual limits. Unconfigured external services, conduct channels or CODEOWNERS are not ready merely because documented. Follow SECURITY.en.md for vulnerabilities and redact public outputs.
