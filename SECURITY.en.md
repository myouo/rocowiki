# Security policy
[中文](SECURITY.md) · [Project standards](docs/standards.en.md)
<!-- rocowiki-policy: security; version: 1; lang: en -->

<a id="reporting"></a>
## Private reporting

Use **Security and quality → Report a vulnerability** in this GitHub repository. A maintainer must enable private vulnerability reporting in repository settings. Local documentation does not prove that it is enabled; its remote status is currently unverified. This feature is available for public repositories that support it. [GitHub instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately)

If the entry is unavailable, open a public issue only to request a private security contact. Do not publish vulnerability details, exploits, real user information or attachments. Conduct reports use the separate channel described in the [code of conduct](CODE_OF_CONDUCT.en.md); the security form is not a general complaints mailbox.

<a id="versions"></a>
## Supported scope

There is no formal release or accepted production deployment yet. Maintainers target the currently maintained main development version; older prototypes, offline demos and historical builds have no separate security support commitment. Future releases must document their support periods here. Unconfigured OIDC, GitHub App, D1, CDN and mirror services have not passed security acceptance.

<a id="report"></a>
## Report contents

Include the affected version/commit, component, prerequisites, minimal reproduction, expected and actual behavior, impact and suggested remediation. Prefer local test accounts and synthetic data. Do not attach live cookies, OAuth codes, tokens, private keys, unredacted databases or third-party user information. Do not test against production systems without authorization.

<a id="response"></a>
## Handling and disclosure

Maintainers confirm scope and impact, reproduce privately, fix the issue, add necessary regression coverage, publish the fix and upgrade instructions, then coordinate disclosure. Explain affected versions, the fixing commit, migrations and credential rotation requirements. Confirm attribution with the reporter. No fixed response time, bounty or availability SLA is promised.

For credential exposure, restrict affected writes and revoke or rotate credentials before investigating access and publication records. Deleting a Git file does not revoke a credential. See [operations](docs/operations.md) for backups, recovery, publishing controls and reconciliation errors.

<a id="boundaries"></a>
## Required security boundaries

See the [security model](docs/security-model.en.md) for system boundaries, threats and verification scope.

- The server determines identity, permissions and UID; localStorage, demo points and nicknames are not authentication.
- Mutations validate session, Origin, CSRF and role; recent authentication uses validated OIDC auth_time.
- Submitted content is immutable, self-review is forbidden, critical pages require distinct reviewers, and stale baselines require conflict review.
- Public users cannot choose repository paths, execute MDX/HTML, bypass image policy, or edit workflows and build code.
- Binding OAuth, publisher App and deployment credentials stay separate; the publisher never bypasses protection or merges main directly.
- Published requires a trusted receipt, actual online version and Git ancestry; mirror observations are separate.
- PR verification never uses production secrets; unknown upstream outcomes are not success. Security changes update both policy languages and relevant verification.
