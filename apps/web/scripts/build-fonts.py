#!/usr/bin/env python3
"""Build the site's single, self-hosted 600-weight Chinese serif subset.

Requires Python 3.10+, fonttools and brotli. No npm dependency is added to the site.
By default, npm pack downloads the pinned official Fontsource package to a temporary
directory. Pass --archive PATH to reuse an already downloaded archive.

Examples:
    python -m pip install 'fonttools[woff]' brotli
    python scripts/build-fonts.py
    python scripts/build-fonts.py --archive /path/to/fontsource-noto-serif-sc-5.3.0.tgz
    python scripts/build-fonts.py --check

The original OFL license and upstream attribution are retained. This derived font
has a distinct internal family name. Supplemental glyphs come exclusively from
the same archive and weight; this covers rare pet-name characters that the basic
Fontsource Chinese subset omits. Characters introduced after this build use the
CSS fallback fonts until the subset is regenerated.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import subprocess
import tarfile
import tempfile
from io import BytesIO
from pathlib import Path

from fontTools import __version__ as fonttools_version
from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "fonts"
FONT_PATH = OUT / "roco-wiki-serif-600.woff2"
CSS_PATH = ROOT / "src" / "css" / "font-face.css"
PACKAGE = "@fontsource/noto-serif-sc@5.3.0"
ARCHIVE_NAME = "fontsource-noto-serif-sc-5.3.0.tgz"
ARCHIVE_SHA256 = "e46d02fdaba2e816c8cdbc38188c80830b5f6af75fff207d0204e25d23d48fd4"
UPSTREAM_MEMBER = "package/files/noto-serif-sc-chinese-simplified-600-normal.woff2"
FAMILY = "Roco Wiki Serif"
LIMIT_BYTES = 350_000
COMMON_PUNCTUATION = "，。、；：？！“”‘’（）【】《》〈〉「」『』〔〕…—·～￥％＋－×÷＝＜＞≥≤→←↑↓↔"
EXCLUDED_TEXT_FILES = {"content/design-v5.json", "content/design-v6.json"}  # Standalone delivery reports, not part of the application.


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def text_inventory() -> tuple[set[int], list[str]]:
    """Read authored UI/data/docs only, avoiding build output and dependencies."""
    paths: set[Path] = set()
    for directory, patterns in (
        ("src/wiki", ("*.jsx", "*.js", "*.json")),
        ("docs", ("*.md", "*.mdx")),
        ("content", ("*.json",)),
    ):
        for pattern in patterns:
            paths.update((ROOT / directory).rglob(pattern))
    paths = {path for path in paths if str(path.relative_to(ROOT)) not in EXCLUDED_TEXT_FILES}
    chars = {chr(code) for code in range(0x20, 0x7F)}
    chars.update(chr(code) for code in range(0xA0, 0x100))
    chars.update(COMMON_PUNCTUATION)
    for path in sorted(paths):
        chars.update(char for char in path.read_text(encoding="utf-8") if char.isprintable())
    return {ord(char) for char in chars}, [str(path.relative_to(ROOT)) for path in sorted(paths)]


def unicode_points(ranges: str) -> set[int]:
    result: set[int] = set()
    for item in ranges.split(","):
        bounds = item.strip().removeprefix("U+").split("-")
        result.update(range(int(bounds[0], 16), int(bounds[-1], 16) + 1))
    return result


def unicode_ranges(points: set[int]) -> str:
    ranges = []
    ordered = sorted(points)
    if not ordered:
        return ""
    start = last = ordered[0]
    for point in ordered[1:] + [None]:
        if point is not None and point == last + 1:
            last = point
            continue
        ranges.append(f"U+{start:X}" if start == last else f"U+{start:X}-{last:X}")
        start = last = point
    return ",".join(ranges)


def glyph_signature(font: TTFont, codepoint: int):
    """Confirm merge/subsetting did not change contours or horizontal metrics."""
    glyph_name = font.getBestCmap()[codepoint]
    coordinates, endpoints, flags = font["glyf"][glyph_name].getCoordinates(font["glyf"])
    return tuple(coordinates), tuple(endpoints), tuple(flags), font["hmtx"][glyph_name]


def rename_derived_font(font: TTFont, license_text: str) -> None:
    replacement = {
        1: FAMILY,
        2: "Semibold",
        3: "RocoWikiSerifSubset-Fontsource5.3.0-600",
        4: FAMILY + " Semibold",
        6: "RocoWikiSerif-Semibold",
        13: license_text,
        14: "https://openfontlicense.org/",
        16: FAMILY,
        17: "Semibold",
    }
    font["name"].names = [record for record in font["name"].names if record.nameID not in replacement]
    for name_id, value in replacement.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)
        font["name"].setName(value, name_id, 1, 0, 0)


def check_font(points: set[int]) -> dict:
    font = TTFont(FONT_PATH)
    missing = points - set(font.getBestCmap())
    result = {
        "status": "passed" if not missing and FONT_PATH.stat().st_size <= LIMIT_BYTES else "failed",
        "file": str(FONT_PATH.relative_to(ROOT)),
        "bytes": FONT_PATH.stat().st_size,
        "requestedCharacters": len(points),
        "coveredCharacters": len(points - missing),
        "glyphCount": len(font.getGlyphOrder()),
        "missingCharacters": "".join(map(chr, sorted(missing))),
        "weight": font["OS/2"].usWeightClass,
    }
    if result["status"] != "passed":
        raise SystemExit(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def build_font(archive_path: Path, points: set[int], files: list[str]) -> dict:
    archive_bytes = archive_path.read_bytes()
    if sha256(archive_bytes) != ARCHIVE_SHA256:
        raise SystemExit("Archive digest does not match the pinned official Fontsource package.")

    with tarfile.open(archive_path) as archive:
        license_bytes = archive.extractfile("package/LICENSE").read()
        license_text = license_bytes.decode("utf-8")
        if "SIL OPEN FONT LICENSE Version 1.1" not in license_text:
            raise SystemExit("Expected OFL 1.1 license was not found in the font package.")
        source_bytes = archive.extractfile(UPSTREAM_MEMBER).read()
        primary = TTFont(BytesIO(source_bytes), recalcTimestamp=False)
        covered = points & set(primary.getBestCmap())
        missing = points - covered
        selections = [("chinese-simplified", primary, covered, sha256(source_bytes))]
        inventory = json.loads(archive.extractfile("package/unicode.json").read())
        for key, ranges in inventory.items():
            wanted = missing & unicode_points(ranges)
            if not wanted:
                continue
            member = f"package/files/noto-serif-sc-{key.strip('[]')}-600-normal.woff2"
            data = archive.extractfile(member).read()
            font = TTFont(BytesIO(data), recalcTimestamp=False)
            wanted &= set(font.getBestCmap())
            if wanted:
                selections.append((key, font, wanted, sha256(data)))
                missing -= wanted
            if not missing:
                break
        if missing:
            raise SystemExit("Official font does not cover: " + "".join(map(chr, sorted(missing))))

        original_signatures = {
            point: glyph_signature(font, point)
            for _, font, selected, _ in selections
            for point in selected
        }
        with tempfile.TemporaryDirectory(prefix="roco-font-subsets-") as temporary:
            sources = []
            for index, (_, font, selected, _) in enumerate(selections):
                if font["OS/2"].usWeightClass != 600:
                    raise SystemExit("Every font source must be static weight 600.")
                options = subset.Options()
                options.hinting = False
                options.layout_features = ["kern", "locl", "liga", "clig", "ccmp", "mark", "mkmk"]
                options.name_IDs = ["*"]
                options.name_languages = ["*"]
                options.name_legacy = True
                subsetter = subset.Subsetter(options=options)
                subsetter.populate(unicodes=selected)
                subsetter.subset(font)
                for table in ("STAT", "BASE", "DSIG"):
                    if table in font:
                        del font[table]
                # Keep the primary font's horizontal shaping. Supplemental glyphs
                # have disjoint Unicode coverage; they need their original outlines.
                if index:
                    for table in ("GSUB", "GPOS", "GDEF"):
                        if table in font:
                            del font[table]
                font.flavor = None
                path = Path(temporary) / f"part-{index}.ttf"
                font.save(path)
                sources.append(str(path))
            # Some sources include differently named, unencoded math alternates.
            # The final direct cmap contours/metrics are verified below for every
            # requested codepoint, rather than trusting duplicate-glyph warnings.
            logging.getLogger("fontTools.merge").setLevel(logging.ERROR)
            merged = Merger().merge(sources)
            merged.recalcTimestamp = False
            rename_derived_font(merged, license_text)
            merged.flavor = "woff2"
            OUT.mkdir(parents=True, exist_ok=True)
            merged.save(FONT_PATH)

        final = TTFont(FONT_PATH, recalcTimestamp=False)
        if not points.issubset(final.getBestCmap()):
            raise SystemExit("Subset validation failed: characters were lost during merging.")
        for point in sorted(points):
            if glyph_signature(final, point) != original_signatures[point]:
                raise SystemExit(f"Subset validation failed: glyph U+{point:04X} changed during merging.")
        if "fvar" in final or final["OS/2"].usWeightClass != 600:
            raise SystemExit("Expected one static 600-weight font.")

        (OUT / "OFL-Noto-Serif-SC.txt").write_bytes(license_bytes)
        metadata = {
            "font": FAMILY,
            "upstreamFamily": "Noto Serif SC",
            "weight": 600,
            "format": "WOFF2",
            "license": "OFL-1.1",
            "copyright": "(c) 2017-2024 Adobe; Copyright 2012 Google Inc. See the original OFL notice.",
            "sourcePackage": PACKAGE,
            "sourceArchive": "https://registry.npmjs.org/@fontsource/noto-serif-sc/-/" + ARCHIVE_NAME,
            "sourceArchiveSha256": ARCHIVE_SHA256,
            "officialSources": [
                "https://fontsource.org/fonts/noto-serif-sc/about",
                "https://github.com/google/fonts/blob/main/ofl/notoserifsc/METADATA.pb",
                "https://github.com/google/fonts/blob/main/ofl/notoserifsc/OFL.txt",
            ],
            "sourceSubsets": [
                {"name": key, "characters": len(selected), "sha256": digest}
                for key, _, selected, digest in selections
            ],
            "outputSha256": sha256(FONT_PATH.read_bytes()),
            "outputBytes": FONT_PATH.stat().st_size,
            "coveredCharacters": len(points),
            "glyphCount": len(final.getGlyphOrder()),
            "coverageTextSha256": sha256("".join(map(chr, sorted(points))).encode("utf-8")),
            "coverageFiles": files,
            "excludedTextFiles": sorted(EXCLUDED_TEXT_FILES),
            "fonttoolsVersion": fonttools_version,
            "modifications": [
                "Single static weight 600; no hinting; horizontal Latin/CJK shaping retained.",
                "Subsets merged for all authored text, Latin-1 and common Chinese punctuation.",
                "Family renamed to Roco Wiki Serif; original copyright and full OFL embedded in font metadata.",
            ],
            "verification": "Every requested Unicode character retains its source outline and horizontal metrics.",
            "fallback": "Characters introduced by future user content fall back to installed Noto Serif SC, Songti SC or SimSun. Rebuild after adding site text.",
        }
        (OUT / "FONT-SOURCE.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        CSS_PATH.write_text(
            "/* Generated by scripts/build-fonts.py. Noto Serif SC-derived subset, OFL-1.1.\n"
            "   Original license: static/fonts/OFL-Noto-Serif-SC.txt. Source: static/fonts/FONT-SOURCE.json. */\n"
            "@font-face {\n"
            "  font-family: 'Roco Wiki Serif';\n"
            "  font-style: normal;\n"
            "  font-weight: 600;\n"
            "  font-display: swap;\n"
            "  src: url('../../static/fonts/roco-wiki-serif-600.woff2') format('woff2');\n"
            f"  unicode-range: {unicode_ranges(points)};\n"
            "}\n\n"
            ":root {\n"
            "  --rw-font-serif: 'Roco Wiki Serif', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif;\n"
            "  --rw-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'Noto Sans CJK SC', sans-serif;\n"
            "}\n",
            encoding="utf-8",
        )
    return check_font(points)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="An existing, unmodified pinned Fontsource npm tarball.")
    parser.add_argument("--check", action="store_true", help="Verify current authored text is covered without rebuilding.")
    args = parser.parse_args()
    points, files = text_inventory()
    if args.check:
        result = check_font(points)
    elif args.archive:
        result = build_font(args.archive, points, files)
    else:
        with tempfile.TemporaryDirectory(prefix="roco-fontsource-") as temporary:
            completed = subprocess.run(
                ["npm", "pack", PACKAGE, "--pack-destination", temporary, "--json"],
                check=True, capture_output=True, text=True,
            )
            packed = json.loads(completed.stdout)
            if len(packed) != 1 or packed[0].get("filename") != ARCHIVE_NAME:
                raise SystemExit("Unexpected npm pack result.")
            result = build_font(Path(temporary) / ARCHIVE_NAME, points, files)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
