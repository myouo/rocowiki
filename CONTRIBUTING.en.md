# Contributing
[中文](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.en.md) · [Security](SECURITY.en.md)
<!-- rocowiki-policy: contributing; version: 15; lang: en -->

<a id="entry"></a>
## Choose an entry point

Use the repository's [issue templates](.github/ISSUE_TEMPLATE) for ordinary bugs, feature requests and content corrections. Describe the problem, impact and necessary reproduction steps without exposing unredacted logs or account information. Report vulnerabilities privately under [the security policy](SECURITY.en.md).

<a id="wiki"></a>
## Wiki contributions

You can report content corrections through an issue. Once formal submissions are available, use `/workbench/` with a verified-email site account and contribution permission. GitHub binding is optional.

Start from the page's existing content, explain the change and provide verifiable sources. Distinguish official information, tests, inference and unverified claims. Do not present samples or demo data as public records.

Submissions require independent review. Self-review is forbidden, and critical pages require two distinct reviewers. When the baseline changes, update the candidate and submit it for review again.

Submit only original material you have the right to provide or material with appropriate permission. Cite quotations and retain authorship and licensing evidence. New original Wiki prose uses **CC BY-SA 4.0**, with authors retaining copyright. Attributed redistribution, adaptation and commercial use are allowed; sharing adaptations requires ShareAlike compliance. Submission does not transfer copyright or relicense game assets or material you cannot license as CC. Do not apply a new license retroactively without authority. See [the copyright statement](COPYRIGHT.en.md).

Formal submissions require explicit content-license confirmation. GitHub email attribution requires binding, explicit authorization and a separate opt-in for that submission; attribution consent cannot replace content permission.

<a id="setup"></a>
## Local development

Use Node.js 24.15.0+. Install dependencies and prepare the local database:

```bash
npm ci
npm run db:migrate
```

Start the API and website in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Use `http://localhost:3000` for the website and `http://localhost:8787` for the API without mixing in `127.0.0.1`. Refer to [the example configuration](apps/api/.dev.vars.example) and keep private settings in untracked local files.

<a id="change"></a>
## Code and documentation

Read the relevant modules and follow [repository instructions](AGENTS.en.md) and [the security policy](SECURITY.en.md). Keep changes focused and follow the project's existing structure and conventions. Edit source files and regenerate outputs rather than patching generated files.

Provide necessary validation for behavior changes. Update Chinese and English policy documents together, with matching revisions and sections. This guide covers participation and collaboration, not feature internals, operational configuration or development progress.

Original code and repository policy-document contributions use **GPL-3.0-only**. No CLA, copyright assignment or DCO sign-off is required. Preserve third-party licenses and provenance when using code, fonts or assets, and update [third-party notices](THIRD_PARTY_NOTICES.en.md).

<a id="git"></a>
## Branches, commits and PRs

Use descriptive branches, preferably `feat/`, `fix/`, `docs/`, `chore/`, `refactor/` or `test/`. Branch names must not contain `agent` anywhere, case-insensitively. `wiki/rev_UUID` is reserved for the publisher App. Describe the actual change in commits; `type(scope): summary` is recommended.

Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) to describe the problem, outcome, verification and migration or compatibility impact. Preserve original contributions, content and source metadata. Do not rebase or squash Wiki submission PRs.

<a id="verify"></a>
## Verification

Run checks appropriate to the change and report actual results and outstanding validation in the PR. CI considers every changed path. Changes spanning API and web content, unrecognized paths or an unavailable comparison base require full validation.

| Change scope | Validation before submission |
| --- | --- |
| Only repository documentation, policies or Issue/PR templates | `npm run check:docs` |
| Only the API or database migrations | `npm run check:quick` and `npm run api:dry-run` |
| Content JSON, registered community prose and its metadata | `npm run check:quick`, web content checks, regenerated reader baselines and affected-page validation, as below |
| Shared code, web components, native MD/MDX documents, routes, dependencies, workflows or other changes | Full validation, as below |

After the quick checks, validate content changes with:

```bash
npm run check:content -w @rocowiki/web
npm run build:baselines -w @rocowiki/web
npm run check:content-render -- --base <comparison-base-commit>
```

Content validation covers the full route registry, existing data checks, affected entries, old and new related pages, and representative templates. It does not produce a deployable artifact. Omitting the comparison base renders all catalogue entries. Native MD/MDX can embed components, so it still requires a full build.

Full validation:

```bash
API_ORIGIN=https://api.rocowiki.test SITE_URL=https://wiki.rocowiki.test npm run check
npm run api:dry-run
```

The `.test` origins are for local verification. Add necessary failure reproduction or browser checks for the change. Do not claim external acceptance that has not happened. CI retains the fixed `validate` aggregate check and community submission boundary check. A selected task that fails, is cancelled or does not run cannot pass the aggregate check. Publication still requires a full build and validation of all artifacts; deployment uses that same verified artifact.

<a id="review"></a>
## Review and merge

Respond to review, resolve CI failures and explain trade-offs. Code and Wiki content follow their respective independent reviews. Authentication and authorization, publishing, database migrations, dependencies, workflows and policy changes require independent review by an appropriately skilled reviewer.

Do not bypass main-branch protection, required checks or production approval. Follow [project governance](GOVERNANCE.en.md) for merging and publishing, and explicitly identify deployment or external acceptance that remains incomplete.
