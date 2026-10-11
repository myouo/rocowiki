# Security policy
[中文](SECURITY.md) · [Contributing](CONTRIBUTING.en.md)
<!-- rocowiki-policy: security; version: 3; lang: en -->

<a id="reporting"></a>
## Private reporting

Use [GitHub private vulnerability reporting](https://github.com/myouo/rocowiki/security/advisories/new) in this repository. Private vulnerability reporting is enabled. [GitHub instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately)

If the entry is unavailable, open a public issue only to request a private security contact. Do not publish vulnerability details, exploits, real user information or attachments. Conduct reports use the separate channel described in the [code of conduct](CODE_OF_CONDUCT.en.md); the security form is not a general complaints mailbox.

<a id="versions"></a>
## Supported scope

The static reading site is deployed. Account, submission and publishing services have not completed production acceptance, and there is no formal release yet. Maintainers target the currently maintained main development version; older prototypes, offline demos and historical builds have no separate security support commitment. Future releases must document their support periods here. OIDC, GitHub App, D1 and mirror services have not completed production security acceptance.

<a id="report"></a>
## Report contents

Include the affected version/commit, component, prerequisites, minimal reproduction, expected and actual behavior, impact and suggested remediation. Prefer local test accounts and synthetic data. Do not attach live cookies, OAuth codes, tokens, private keys, unredacted databases or third-party user information. Do not test against production systems without authorization.

<a id="response"></a>
## Handling and disclosure

Maintainers confirm scope and impact, reproduce privately, fix the issue, add necessary regression coverage, publish the fix and upgrade instructions, then coordinate disclosure. Explain affected versions, the fixing commit, migrations and credential rotation requirements. Confirm attribution with the reporter. No fixed response time, bounty or availability SLA is promised.

For credential exposure, restrict affected writes and revoke or rotate credentials before investigating access and publication records. Deleting a Git file does not revoke a credential. Before restoring service, verify affected data and publication records, and record remediation, rotation and recovery actions.

<a id="boundaries"></a>
## Required security boundaries

- The server determines identity, permissions and UID; localStorage, demo points and nicknames are not authentication.
- Mutations validate session, Origin, CSRF and role; recent authentication uses validated OIDC auth_time.
- Submitted content is immutable, self-review is forbidden, critical pages require distinct reviewers, and stale baselines require conflict review.
- Public users cannot choose repository paths, execute MDX/HTML, bypass image policy, or edit workflows and build code.
- Binding OAuth, publisher App and deployment credentials stay separate; the publisher never bypasses protection or merges main directly.
- Published requires a trusted receipt, actual online version and Git ancestry; mirror observations are separate.
- PR verification never uses production secrets; unknown upstream outcomes are not success. Security changes update both policy languages and relevant verification.
