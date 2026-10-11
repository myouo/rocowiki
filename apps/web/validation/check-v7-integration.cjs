/** Final shipped-preview and native-static integration checks. JSDOM is not browser layout QA. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const checks = [];
const pageResults = [];
const runtimeErrors = [];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const check = (name, pass, details) => {
  checks.push({name, pass: Boolean(pass), ...(pass || details === undefined ? {} : {details})});
};
const clean = value => String(value || '').replace(/[\u200b\ufeff]/g,'').replace(/\s+/g,' ').trim();
const routes = json('content/routes.json');
const docs = json('content/published-docs-v7.json').documents;
const inventory = [...routes, ...docs.map(doc=>doc.path)];
const nativePath = route => 'build/'+route.replace(/^\//,'')+'index.html';
const styleSource = read('src/css/v7.css');
let dom;

async function main() {
  const brokenRoutes = [];
  const badDocumentEditors = [];
  const imageFailures = [];
  let editHeadingCount = 0;
  for(const route of inventory) {
    const file = nativePath(route);
    if(!fs.existsSync(path.join(root,file))) {pageResults.push({route,exists:false}); continue;}
    const markup = read(file);
    const local = new JSDOM(markup);
    const d = local.window.document;
    const result = {
      route, exists:true,
      h1: clean(d.querySelector('h1')?.textContent),
      header:Boolean(d.querySelector('.rw-site-header')),
      feedback:Boolean(d.querySelector('.rw-feedback-trigger')),
      hasMain:Boolean(d.querySelector('main')),
      nativeSelectCount:d.querySelectorAll('select').length,
    };
    const doc = docs.find(doc=>doc.path===route);
    if(doc) {
      const heads = [...d.querySelectorAll('.theme-doc-markdown h2,.theme-doc-markdown h3,.theme-doc-markdown h4')];
      for(const heading of heads) {
        const link=heading.querySelector('.rw-edit-entry');
        const request=new URL(link?.getAttribute('href')||'/', 'https://wiki.test').searchParams;
        const returnTo=request.get('returnTo')||'';
        const anchor=returnTo.split('#')[1]||'';
        const ok=link&&request.get('mode')==='article'&&request.get('entity')===doc.title&&d.getElementById(decodeURIComponent(anchor))===heading;
        if(!ok)badDocumentEditors.push({route,title:clean(heading.textContent),returnTo});
        editHeadingCount++;
      }
      const fallback=d.querySelector('.theme-edit-this-page');
      const params=new URL(fallback?.getAttribute('href')||'/', 'https://wiki.test').searchParams;
      result.footerEditor=params.get('entity')===doc.title&&params.get('mode')==='article'&&params.get('returnTo')===route;
      result.docSheet=Boolean(d.querySelector('.rw-doc-sheet .theme-doc-markdown'));
    }
    for(const link of d.querySelectorAll('a[href^="/"]')) {
      const to=new URL(link.getAttribute('href'),'https://wiki.test');
      if(to.origin!=='https://wiki.test')continue;
      const candidate=path.join(root,'build',decodeURIComponent(to.pathname));
      if(!fs.existsSync(candidate)&&!fs.existsSync(path.join(candidate,'index.html')))brokenRoutes.push({from:route,to:to.pathname});
    }
    for(const img of d.querySelectorAll('img[src^="/"]')) {
      const target=path.join(root,'build',img.getAttribute('src').split('?')[0]);
      if(!fs.existsSync(target))imageFailures.push({route,src:img.getAttribute('src')});
    }
    pageResults.push(result);
    local.window.close();
  }
  check('All 121 registered article/directory routes are emitted as readable native HTML',inventory.length===121&&pageResults.every(page=>page.exists&&page.h1),pageResults.filter(page=>!page.exists||!page.h1));
  check('Every registered route retains the common header, main landmark and floating feedback entry',pageResults.every(page=>page.header&&page.feedback&&page.hasMain));
  check('No native select elements return in the full static site',pageResults.every(page=>page.nativeSelectCount===0));
  check('All native internal navigation links resolve to an emitted page or static asset',brokenRoutes.length===0,brokenRoutes.slice(0,15));
  check('All locally served pet and type images exist',imageFailures.length===0,imageFailures);
  check('All 105 native documentation subheadings have a correct contextual editor and return anchor',editHeadingCount===105&&badDocumentEditors.length===0,badDocumentEditors);
  check('Native Docusaurus footer editors use the same real article identity as page editors',pageResults.filter(page=>page.docSheet).length===25&&pageResults.filter(page=>page.docSheet).every(page=>page.footerEditor));
  check('Guide pages use an article sheet with internally scrollable data tables',pageResults.filter(page=>page.route.startsWith('/guides/')&&page.docSheet).length===3&&/\.theme-doc-markdown table[\s\S]*?overflow-x:\s*auto/.test(styleSource));
  const sourceFont=fs.readFileSync(path.join(root,'static/fonts/roco-wiki-sans-v7.woff2'));
  const emittedFont=fs.readFileSync(path.join(root,'build/fonts/roco-wiki-sans-v7.woff2'));
  const bundledFonts=fs.readdirSync(path.join(root,'build/assets/fonts')).filter(file=>file.startsWith('roco-wiki-sans-v7'));
  check('Native font copies and hashed font assets match the final subset exactly',sha(sourceFont)===sha(emittedFont)&&bundledFonts.length===1&&sha(fs.readFileSync(path.join(root,'build/assets/fonts',bundledFonts[0])))===sha(sourceFont));
  check('Only the retained wordmark uses its original Georgia face; the serif body font is no longer imported',!read('src/css/custom.css').includes('font-face.css')&&/\.rw-wordmark b\s*\{\s*font-family:\s*Georgia/.test(styleSource)&&styleSource.includes('--rw-font-serif: var(--rw-font-sans)'));
  check('Guide grid areas are explicit and collapse to a single minmax(0,1fr) article column',styleSource.includes('grid-template-areas: "sidebar article outline"')&&styleSource.includes('grid-template-areas: "mobile" "article"')&&styleSource.includes('minmax(0, 1fr)'));
  check('Custom dropdown panels are not clipped by a containing community paper',styleSource.includes('.cm-root .cm-paper:has(.rw-select)')&&/\.cm-root \.cm-compare-selectors\s*\{\s*overflow:\s*visible/.test(styleSource));
  check('Reduced-motion disables the decorative motion and all animation durations are short',styleSource.includes('@media (prefers-reduced-motion: reduce)')&&!/animation:[^;]*infinite/.test(styleSource));
  check('The decorative academy background is compact and bundled locally',fs.statSync(path.join(root,'static/img/decor/academy-v7.webp')).size<150000&&read('content/decor-assets-v7.json').includes('academy-v7.webp'));

  const html=read('RocoWiki_UI_V7.html');
  const vc=new VirtualConsole();
  vc.on('jsdomError',error=>runtimeErrors.push(String(error.message)));
  vc.on('error',(...args)=>runtimeErrors.push(args.map(String).join(' ')));
  dom=new JSDOM(html,{url:'https://preview.wiki.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
    w.scrollTo=()=>{};
    w.HTMLElement.prototype.scrollIntoView=function(){w.__lastScrolledId=this.id;};
  }});
  const w=dom.window,d=w.document;
  async function until(fn, label){for(let i=0;i<100;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Timed out: '+label);}
  async function navigate(route, expected){const actualTitle=pageResults.find(page=>page.route===route.split('?')[0])?.h1||expected;w.location.hash=route;await until(()=>clean(d.querySelector('h1')?.textContent)===actualTitle,route);await new Promise(resolve=>setTimeout(resolve,30));}
  const editorParams=el=>new URL((el?.getAttribute('href')||'').replace(/^#/,'')||'/','https://wiki.test').searchParams;
  await until(()=>d.querySelector('.rw-v7-welcome'),'home mount');
  check('Shipped single-file preview starts without a server and mounts the new illustrated homepage',Boolean(d.querySelector('.rw-v7-welcome img'))&&d.querySelectorAll('.rw-v6-portal-index .rw-color-icon').length===6);
  check('Homepage preserves simultaneous ladder-left and type-tournament-right tables',JSON.stringify([...d.querySelectorAll('.rw-v6-competition h3')].map(el=>el.textContent))===JSON.stringify(['天梯赛','系别排位赛']));
  check('Homepage shows three activity columns including expiring activities',d.querySelectorAll('.rw-v6-event-columns > section').length===3&&d.querySelector('.rw-v6-event-columns')?.textContent.includes('即将过期'));
  await navigate('/pets/haifu/','海芙约忒');
  check('Pet header has one dedicated edit action and the Counter contains no PVE content',d.querySelectorAll('.rw-pagehead .rw-edit-entry').length===1&&!d.querySelector('#matchups')?.textContent.includes('PVE'));
  check('Each acquisition and Counter record retains a dedicated typed editor', [...d.querySelectorAll('.rw-acquisition-entry-v6')].every(el=>el.querySelectorAll('.rw-edit-entry').length===1)&&[...d.querySelectorAll('.rw-matchup-card-v7')].every(el=>el.querySelectorAll('.rw-edit-entry').length===1));
  await navigate('/skills/','技能查询');
  check('Skills overview ends in 技能描述 and retains effect filtering',[...d.querySelectorAll('thead th')].at(-1)?.textContent==='技能描述'&&d.body.textContent.includes('效果'));
  await navigate('/skills/xiazi/?pet=haifu','霞姿月韵');
  const effectEdit=d.querySelector('#effects .rw-section-actions .rw-edit-entry');
  check('Skill paragraph editor preserves its originating pet context',editorParams(effectEdit).get('returnTo')==='/skills/xiazi/?pet=haifu#effects');
  await navigate('/npcs/','人物与NPC');
  check('NPC directory offers one clearly labeled add-entry action', [...d.querySelectorAll('.rw-edit-entry')].filter(el=>el.textContent.includes('新增人物条目')).length===1);
  await navigate('/adventure/','冒险资料');
  check('Adventure secondary navigation no longer jumps to the PVE primary route',![...d.querySelectorAll('.wa-section-nav a')].some(el=>el.getAttribute('href')==='#/pve/'));
  await navigate('/events/fun-chess/','趣味对弈');
  check('One recurring activity page displays both independent opening periods',d.body.textContent.includes('2025.05.02')&&d.body.textContent.includes('2025.11.28'));
  await navigate('/tools/damage/','威力伤害计算器');
  check('Power damage calculator has one rule editor and visibly emphasizes upper damage',d.querySelectorAll('#calculation-rules .rw-section-actions .rw-edit-entry').length===1&&d.body.textContent.includes('伤害上限'));
  await navigate('/account/','个人中心');
  check('Personal center has five clear primary categories rather than mixed profile/binding entries',JSON.stringify([...d.querySelectorAll('.ev7-account-nav button')].map(el=>clean(el.textContent)))===JSON.stringify(['我的首页','我的投稿','我的收藏','个人资料','账号与安全']));
  await navigate('/guides/returning/','回归先查什么');
  check('Return guide mounts the explicit article/sidebar layout with four subsection editors',d.querySelectorAll('.rw-preview-doc-body .theme-doc-markdown h2 .rw-edit-entry').length===4&&Boolean(d.querySelector('.rw-preview-doc-layout > .rw-preview-doc-body')));
  const doc=docs.find(doc=>doc.path==='/guides/returning/');
  const request={entity:doc.title,section:doc.sections[0].title,mode:'article',returnTo:doc.path+'#section-1',intent:'edit'};
  const marker='本机修订验收：先按编号整理已有宠物。';
  const newMarkdown=marker+'\n\n| 项目 | 说明 |\n| --- | --- |\n| 编号 | 同形态核对 |\n\n[培养资料](./training.md)';
  const workspace=JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')||'{"version":1,"profile":{},"drafts":[],"submissions":[]}');
  workspace.submissions=[...(workspace.submissions||[]),{id:'v7-integration-doc',status:'published',editorVersion:7,editorMode:'article',editorRequest:request,target:doc.title,section:request.section,typedData:{markdown:newMarkdown},updatedAt:'2026-10-10T12:00:00Z',before:doc.sections[0].markdown,after:newMarkdown,snapshotKey:[doc.title,request.section,'article','all','existing'].join('::')}];
  w.localStorage.setItem('roco-wiki-v4:community',JSON.stringify(workspace));
  w.dispatchEvent(new w.Event('roco:community-updated'));
  await until(()=>d.body.textContent.includes(marker),'published document readback');
  check('Published subsection content actually replaces the old body in the delivered preview',d.body.textContent.includes(marker)&&!d.body.textContent.includes('记录需要补充的技能、培养材料和前置条件；已有宠物是否适合当前目标'));
  check('Other guide sections remain after a subsection publication',d.body.textContent.includes('第二步：看当前还能获得什么')&&d.body.textContent.includes('使用攻略时保留适用条件'));
  check('Published prose renders tables and sibling Markdown links correctly',d.querySelectorAll('.rw-reading-markdown table').length===3&&[...d.querySelectorAll('.rw-reading-markdown a')].some(el=>el.getAttribute('href')==='#/guides/training/'));
  const newEdit=d.querySelector('.rw-reading-markdown h2 .rw-edit-entry');
  const newAnchor=editorParams(newEdit).get('returnTo').split('#')[1];
  check('Published document retains both preview anchors and native Docusaurus TOC aliases',Boolean(d.getElementById(newAnchor))&&Boolean(d.getElementById('第一步整理已有宠物')));
  newEdit.click();
  await until(()=>d.querySelector('.ev7-root'),'published subsection reopen');
  await new Promise(resolve=>setTimeout(resolve,120));
  const editText=[...d.querySelectorAll('textarea')].map(el=>el.value).join('\n');
  check('Opening the revised subsection again preloads its latest published Markdown',editText.includes(marker),{hash:w.location.hash,textareaValues:editText,editorText:d.querySelector('.ev7-root')?.textContent.slice(0,2000),stored:JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')||'{}').submissions?.at(-1)});
  check('Delivered preview has no React or uncaught JavaScript errors',runtimeErrors.filter(error=>!error.includes('Could not parse CSS stylesheet')).length===0,runtimeErrors.slice(0,8));
  dom.window.close();dom=null;
}

main().catch(error=>{check('Integration runner completed',false,String(error.stack||error));}).finally(()=>{
  if(dom)dom.window.close();
  const report={version:7,scope:'Native static HTML + delivered single-file HTML executed in JSDOM. Not a browser screenshot, layout, frame-rate, real-service or game-client test.',checkedAt:new Date().toISOString(),passed:checks.filter(check=>check.pass).length,failed:checks.filter(check=>!check.pass).length,routeCount:inventory.length,documentCount:docs.length,checks,pageResults,runtimeErrors,previewSha256:sha(read('RocoWiki_UI_V7.html')),sourceSha256:Object.fromEntries(['src/css/v7.css','src/wiki/core.jsx','src/wiki/InlineSectionEdits.jsx','src/wiki/editing/ReadingMarkdown.jsx','src/wiki/editing/PublishedDocument.jsx','src/wiki/editing/documentComposition.js','src/wiki/editing/registry.js','docusaurus.config.js'].map(file=>[file,sha(read(file))]))};
  fs.writeFileSync(path.join(__dirname,'v7-integration-check-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,failed:report.failed,routes:inventory.length,failures:checks.filter(check=>!check.pass)}));
  process.exitCode=report.failed?1:0;
});
