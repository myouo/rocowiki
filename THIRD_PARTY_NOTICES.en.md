# Licensing and third-party rights
[中文](THIRD_PARTY_NOTICES.md) · [LICENSE](LICENSE)
<!-- rocowiki-policy: rights; version: 2; lang: en -->

<a id="scope"></a>
## Project license scope

Original code and repository policy documents the project has authority to license use **GPL-3.0-only**. The unmodified LICENSE contains the terms; future GPL versions are not automatically granted. [The inventory](docs/license-inventory.json) records license-text provenance/hash and dependency/asset status.

Existing third-party copyright and license notices remain effective. Game images, trademarks, information obtained from third-party sites and fonts do not become GPL or CC by entering this repository. Original Wiki prose that can be licensed under project policy uses **CC BY-SA 4.0**, with authors retaining copyright. Verify permission individually for existing and imported material without imposing a new license retroactively. Neither code nor prose licensing establishes redistribution rights for all existing assets. [The copyright statement](COPYRIGHT.en.md) governs ownership, reuse and rights concerns; the site provides Chinese and English use summaries at /copyright/ and /copyright/en/.

<a id="inventory"></a>
## Dependencies and assets

The inventory records direct dependencies, versions and package-declared licenses. Available original license files are retained under licenses/third-party/. This is not a complete legal review of transitive dependencies or every release artifact. Entries missing copyright/license text are marked metadata-only and require necessary notices before distribution.

Local Noto Serif SC/Noto Sans SC subsets retain OFL-1.1 and FONT-SOURCE evidence and remain OFL rather than GPL. Game-image provenance is recorded in apps/web/content/asset-sources.json and pet-sources.json. A source URL proves origin rather than permission; redistribution rights have not been verified here. An authorized maintainer must confirm, replace or remove such assets before public distribution.

The V7.3.1 interface/import history is documented in docs/web-v731-integration.md. Preserve existing author and provenance records without presenting third-party work as project-original.

<a id="changes"></a>
## Updates and distribution

For dependencies, copied code, fonts and images, record source, version/hash, original license, retained notices and permission status. Mark unknowns as pending verification rather than inventing permission. After direct-dependency changes, run npm run licenses:refresh and review the inventory and bilingual notices.

Distribute LICENSE and relevant notices with project GPL code, and provide corresponding source and modification records under its terms. Publishers must review transitive dependencies and assets for the actual artifact; the direct-dependency inventory is not a complete compliance guarantee.
