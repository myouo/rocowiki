# Governance
[中文](GOVERNANCE.md) · [Security](SECURITY.en.md)
<!-- rocowiki-policy: governance; version: 2; lang: en -->

<a id="roles"></a>
## Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| Content contributor | Provide original/permitted information, evidence and revision descriptions |
| Wiki reviewer | Verify immutable candidates and evidence without self-review or conflicts |
| Code maintainer/reviewer | Review implementation, contracts, security and documentation; maintain merge rules |
| Operator | Configure real services, roles, production environments, migrations, backups and recovery |

Wiki reviewer/admin status is independent of GitHub maintenance or merge permission. These roles are not a published maintainer roster. The project owner must configure actual people and teams; do not invent CODEOWNERS.

<a id="decisions"></a>
## Decisions

Module maintainers resolve routine implementation choices. Changes to authentication, publishing, data authority, public contracts or licensing first explain the need, constraints, impact and trade-offs, then provide a reviewable implementation. Record important decisions, reasoning and impact in the corresponding issue or PR; explain policy changes in Chinese and English. Record evidence and unresolved questions; silence is not approval.

<a id="review"></a>
## Review ownership

Code requires independent review and required checks. Content uses Wiki review and the protected content boundary; site administrator status does not override two-reviewer critical pages or the self-review prohibition. Dependency and licensing changes identify provenance and update the lockfile and inventory. Enable real CODEOWNERS only with actual accounts/teams; the example file is inactive.

<a id="release"></a>
## Release and recovery

Protect main and publish verified artifacts without publisher bypass or automatic merging. Release PRs describe migration order, compatibility, verification and recovery. Confirm publication only after checking the actual online version and trusted receipt. Record outstanding platform acceptance separately; mocks prove neither deployment nor third-party asset permission. Emergency fixes still require auditable records and subsequent independent review.

<a id="policy"></a>
## Policy maintenance

Version Chinese and English policies together with equivalent requirements. Automated gates check structure, revisions and links, not translation semantics. Maintainers clarify and resolve conflicts. Repository policies do not override valid user authorization for a specific task, and do not substitute for real branch protection or production permissions.
