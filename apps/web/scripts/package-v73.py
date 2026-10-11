#!/usr/bin/env python3
"""Package the verified V7.3 source, native output and self-contained previews."""
from pathlib import Path
import hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'deliverables'
OUT.mkdir(exist_ok=True)
summary=json.loads((ROOT/'validation/v73-delivery-summary.json').read_text())
if summary['failed'] or summary['staleSources']:
    raise SystemExit('Delivery verification is not current.')
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
preview=ROOT/'RocoWiki_UI_V7_3.html'
if sha(preview)!=summary['previewSha256']:
    raise SystemExit('Preview changed after integration checks.')
folders=['src','docs','content','static','plugins','scripts','preview','validation','build','dist']
files=[]
for folder in folders:
    for p in (ROOT/folder).rglob('*'):
        if p.is_file() and not any(part in {'node_modules','__pycache__','.cache'} for part in p.relative_to(ROOT).parts):
            files.append(p)
for name in ['README.md','package.json','package-lock.json','docusaurus.config.js','sidebars.js','RocoWiki_UI_V7_3.html','RocoWiki_Design_V7_3.html']:
    p=ROOT/name
    if not p.exists(): raise SystemExit('Missing '+name)
    files.append(p)
files=sorted(set(files))
manifest={'version':'7.3','previewSha256':summary['previewSha256'],'nativeRoutes':summary['routes'],'assertions':summary['assertions'],'scope':'Docusaurus source and static output, self-contained prototype, design report and reproducible validation; no remote services or deployments.','files':[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files]}
archive=OUT/'RocoWiki_Docusaurus_V7_3.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for p in files:z.write(p,'roco-wiki/'+str(p.relative_to(ROOT)))
    z.writestr('roco-wiki/delivery-manifest-v73.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
with zipfile.ZipFile(archive) as z:
    bad=z.testzip()
    if bad:raise SystemExit('Archive checksum failed: '+bad)
    native=[p for p in z.namelist() if p.startswith('roco-wiki/build/') and p.endswith('.html')]
    if len(native)!=summary['routes']+1:raise SystemExit('Wrong native HTML count: '+str(len(native)))
for name in ['RocoWiki_UI_V7_3.html','RocoWiki_Design_V7_3.html']:
    shutil.copyfile(ROOT/name,OUT/name)
result={'version':'7.3','archiveFiles':len(files)+1,'nativeHtml':len(native),'files':[{'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)} for p in [OUT/'RocoWiki_UI_V7_3.html',archive,OUT/'RocoWiki_Design_V7_3.html']]}
(ROOT.parent/'delivery-v73-files.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
