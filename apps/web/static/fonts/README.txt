Roco Wiki Serif — local Chinese heading font
==========================================

This is a character subset of Noto Serif SC, static weight 600, obtained from the
official @fontsource/noto-serif-sc 5.3.0 package. It is distributed under OFL-1.1.
See OFL-Noto-Serif-SC.txt for the unmodified license, and FONT-SOURCE.json for
the exact source package, source hashes, output hash and build coverage.

The derived font is renamed Roco Wiki Serif. Its full OFL license is also embedded
in the font's name metadata (name ID 13), so the standalone HTML font retains its
license when the WOFF2 is embedded as a data URL.

Usage
-----
Import src/css/font-face.css from the main stylesheet. Apply var(--rw-font-serif)
to headings at weight 600. Use var(--rw-font-sans) for body text and dense tables.
The font-display: swap rule keeps text visible while the local font loads.

The selected font is supplied as a local asset. The site does not need runtime
connections to Google Fonts, Fontsource, npm or an external font CDN.

Coverage
--------
The subset contains authored text under src/wiki/, docs/ and content/, printable
Latin-1, and common Chinese punctuation. It includes rare characters needed by
the current pet names, using supplemental subsets from the same official package.
The standalone delivery report content/design-v5.json is explicitly excluded,
because it is not part of the application bundle.
All requested glyph contours and horizontal metrics are checked against the
source. Newly added user content outside this character set uses the configured
installed-font fallback until the subset is rebuilt.

Rebuild after adding authored text
---------------------------------
```sh
python -m pip install 'fonttools[woff]' brotli
python scripts/build-fonts.py
python scripts/build-fonts.py --check
```

The build script downloads a pinned npm tarball into a temporary directory and
verifies its SHA-256. An existing tarball may be supplied with --archive PATH.
This operation changes no npm dependencies. A regular site build uses the already
generated WOFF2 and does not need to download the upstream package.

Official references
-------------------
https://fontsource.org/fonts/noto-serif-sc/about
https://github.com/google/fonts/blob/main/ofl/notoserifsc/METADATA.pb
https://github.com/google/fonts/blob/main/ofl/notoserifsc/OFL.txt
