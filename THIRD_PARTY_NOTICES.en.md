# Licensing and third-party rights
[中文](THIRD_PARTY_NOTICES.md) · [LICENSE](LICENSE)
<!-- rocowiki-policy: rights; version: 3; lang: en -->

<a id="scope"></a>
## Project license scope

Original code and repository policy documents the project has authority to license use **GPL-3.0-only**. The unmodified LICENSE contains the terms; future GPL versions are not automatically granted. [The inventory](docs/license-inventory.json) records license-text provenance/hash and dependency/asset status.

Existing third-party copyright and license notices remain effective. Game images, trademarks, information obtained from third-party sites and fonts do not become GPL or CC by entering this repository. Original Wiki prose that can be licensed under project policy uses **CC BY-SA 4.0**, with authors retaining copyright. Verify permission individually for existing and imported material without imposing a new license retroactively. Neither code nor prose licensing establishes redistribution rights for all existing assets. [The copyright statement](COPYRIGHT.en.md) governs ownership, reuse and rights concerns; the site provides Chinese and English use summaries at /copyright/ and /copyright/en/.

<a id="inventory"></a>
## Dependencies and assets

The inventory records direct dependencies, versions and package-declared licenses. Available original license files are retained under licenses/third-party/. This is not a complete legal review of transitive dependencies or every release artifact. Entries missing copyright/license text are marked metadata-only and require necessary notices before distribution.

Local Noto Serif SC/Noto Sans SC subsets retain OFL-1.1 and FONT-SOURCE evidence and remain OFL rather than GPL. Game-image provenance is recorded in apps/web/content/asset-sources.json and pet-sources.json. A source URL proves origin rather than permission; redistribution rights have not been verified here. An authorized maintainer must confirm, replace or remove such assets before public distribution.

The V7.3.1 interface was imported from the user-provided RocoWiki_Docusaurus_V7_3_1 project. Preserve existing author and provenance records without presenting third-party work as project-original.

Ability and status icons in skill analyses retain the original PNG bytes from the official H5 `combatIcon` bundle. Paths, dimensions and SHA-256 hashes are recorded in `apps/web/static/img/combat/sources.json`. The current renderer uses transparent ability assets 202–206 and the matching `_bak` originals for abnormal states 101–109, checked against names and artwork in the same public bundle. Previously retained source images and provenance remain intact; the term dictionary no longer uses the versions with colored backgrounds. Terms lacking a verified transparent equivalent retain text links. No client code was copied. These existing game assets are not licensed under the project's GPL or CC terms, and redistribution permission remains unverified.

Official pet base data comes from the public `https://res.17roco.qq.com/conf/Angel.config`. `apps/web/content/official-pets.json` records retrieval time, version and the package SHA-256; icons reference official resources directly. This game data is outside the project's GPL/CC grant, rights remain with their holders, and redistribution permission is unverified. The new XML parser dependency saxes 6.0.0 declares ISC, but its installed package lacks the full license text and is recorded as metadata-only. Format research used open-roco-conn without copying its C++ implementation or decompiled code.

Ladder fees and configuration bans come from public `https://res.17roco.qq.com/plugins/LadderMatch/LadderMatchConfig.xml`; `apps/web/content/official-ladder.json` retains provenance, retrieval time and the original XML SHA-256. The one-point default for unlisted IDs follows official client summation and explanatory behavior, researched through open-roco-conn's decompiled LadderMatch resources without copying code. This game configuration is also outside the project's GPL/CC grant, and redistribution permission remains unverified.

Skill base data comes from Angel.config's `spiritSkill_conf`; `apps/web/content/official-skills.json` retains version, package SHA-256, original descriptions and duplicate-ID overrides. The independent TypeScript parser follows official SpiritSkillDesProxy field and source-order semantics without copying decompiled code. Permission for this game data remains unverified.

`apps/web/content/pet-skill-relations.json` projects public `pet/` records from [roco-desc](https://gitcode.com/rocoai-dev/roco-desc), retaining identity-checked skill names, learning methods, explicit learning levels, source commit and source-data digest, then matching official skill IDs. Community interpretation prose, author-account fields and HTML are not copied. These public reference relations do not represent an account's server-authorized skill pool and are outside the project's GPL/CC grant; source licensing and redistribution permission remain unverified.

Game observations are stored in `apps/web/content/game-skill-relations.json`, retaining only game-confirmed pet IDs, skill IDs, inheritance flags, instance level at collection and a response-body digest. Account IDs, instance identities, credentials, packet headers and raw traffic are excluded. An empty snapshot does not claim collection; a record describes available skills for that bag instance at that time, without claiming every learning path for its species. This game data is outside the project's GPL/CC grant and redistribution permission remains unverified. The collector independently implements RocoAI's public headless interface and the game protocol without copying its source.

The `skill-analysis-notes.json` sample restates numeric, formula and conditional facts from detailed roco-desc descriptions. Generated `skill-analyses.json` retains a pinned source commit, description digests, public attribution and source-record dates. Raw HTML and account fields are excluded; this is not independent in-game testing here. Source rights remain with their holders; factual reorganization does not grant GPL or CC rights to the authors' works. Source licensing and redistribution permission remain unverified.

<a id="changes"></a>
## Updates and distribution

For dependencies, copied code, fonts and images, record source, version/hash, original license, retained notices and permission status. Mark unknowns as pending verification rather than inventing permission. After direct-dependency changes, run npm run licenses:refresh and review the inventory and bilingual notices.

Distribute LICENSE and relevant notices with project GPL code, and provide corresponding source and modification records under its terms. Publishers must review transitive dependencies and assets for the actual artifact; the direct-dependency inventory is not a complete compliance guarantee.
