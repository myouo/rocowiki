#!/usr/bin/env python3
"""Create a self-hosted Noto Sans SC variable subset for this release (OFL-1.1).

Requires fonttools[woff] and brotli. Supply the official TTF with --source,
or allow the pinned, hash-checked upstream download. Future glyph additions
fall back to local CJK fonts until this script is rerun.
"""
import argparse, hashlib, json, shutil, tempfile, urllib.request
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
ROOT=Path(__file__).resolve().parents[1]
SOURCE_URL='https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf'
SOURCE_SHA='a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da'
LICENSE_URL='https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt'
FAMILY='Roco Wiki Sans'
FALLBACK_ONLY={0x2153}  # Fraction one third uses the UI fallback font; all Chinese stays in the subset.
OUT=ROOT/'static/fonts/roco-wiki-sans-v7.woff2'

def inventory():
    text=''.join(chr(i) for i in range(32,127))+'，。、；：？！“”‘’（）【】《》…—·～％＋－×÷＝≥≤→←↑↓↔'
    for folder in ['src','docs','content']:
        for file in sorted((ROOT/folder).rglob('*')):
            if file.suffix in {'.jsx','.js','.md','.mdx','.json'} and not file.name.startswith('design-v') and not file.name.startswith('published-'):
                text+=file.read_text(encoding='utf-8')
    return {ord(char) for char in text if char.isprintable()}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source');parser.add_argument('--license');parser.add_argument('--check',action='store_true');args=parser.parse_args()
    points=inventory()
    if not args.check:
        with tempfile.TemporaryDirectory(prefix='roco-sans-') as tmp:
            src=Path(args.source) if args.source else Path(tmp)/'source.ttf'
            if not src.exists():
                with urllib.request.urlopen(SOURCE_URL,timeout=60) as response:src.write_bytes(response.read())
            if hashlib.sha256(src.read_bytes()).hexdigest()!=SOURCE_SHA:raise SystemExit('Upstream font hash changed; verify a new revision explicitly.')
            font=TTFont(src,recalcTimestamp=False)
            missing=points-set(font.getBestCmap())
            # Source files also contain code-only symbols; still record any uncovered characters.
            if missing-FALLBACK_ONLY:raise SystemExit('Upstream glyphs missing: '+''.join(chr(c) for c in sorted(missing-FALLBACK_ONLY)))
            instantiateVariableFont(font,{'wght':(400,400,700)},inplace=True)
            options=subset.Options();options.hinting=False;options.layout_features=['kern','locl','liga','clig','ccmp','mark','mkmk'];options.name_IDs=['*'];options.name_languages=['*'];options.name_legacy=True
            sub=subset.Subsetter(options=options);sub.populate(unicodes=points);sub.subset(font)
            for nameid,value in {1:FAMILY,3:'RocoWikiSans-V7',4:FAMILY,6:'RocoWikiSans-V7',16:FAMILY}.items():
                font['name'].names=[n for n in font['name'].names if n.nameID!=nameid]
                font['name'].setName(value,nameid,3,1,0x409)
            font.flavor='woff2';OUT.parent.mkdir(parents=True,exist_ok=True);font.save(OUT)
            license_path=Path(args.license) if args.license else Path(tmp)/'OFL.txt'
            if not license_path.exists():
                with urllib.request.urlopen(LICENSE_URL,timeout=30) as response:license_path.write_bytes(response.read())
            if 'SIL OPEN FONT LICENSE' not in license_path.read_text():raise SystemExit('OFL license missing')
            shutil.copyfile(license_path,OUT.parent/'OFL-Noto-Sans-SC.txt')
        (ROOT/'src/css/font-sans-v7.css').write_text("/* Noto Sans SC-derived UI subset; original license and source digest in static/fonts. */\n@font-face { font-family: 'Roco Wiki Sans'; font-style: normal; font-weight: 400 700; font-display: swap; src: url('../../static/fonts/roco-wiki-sans-v7.woff2') format('woff2'); }\n")
    final=TTFont(OUT);missing=points-set(final.getBestCmap())
    result={'status':'passed' if not (missing-FALLBACK_ONLY) else 'failed','family':FAMILY,'weights':[400,700],'file':str(OUT.relative_to(ROOT)),'bytes':OUT.stat().st_size,'requestedCharacters':len(points),'coveredCharacters':len(points-missing),'missingCharacters':''.join(chr(c) for c in sorted(missing-FALLBACK_ONLY)),'intentionalFallbackCharacters':''.join(chr(c) for c in sorted(missing&FALLBACK_ONLY)),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'source':SOURCE_URL,'sourceSha256':SOURCE_SHA,'license':'OFL-1.1','fallback':'PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system sans-serif'}
    if not args.check:(OUT.parent/'FONT-SOURCE-V7.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))
    if missing-FALLBACK_ONLY:raise SystemExit(1)
if __name__=='__main__':main()
