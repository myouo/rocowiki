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
const sharedStyles = read('src/css/v71.css');
let dom;

async function main() {
  const brokenRoutes = [];
  const badDocumentEditors = [];
  const imageFailures = [];
  const nativeAnchors = new Map();
  const pveAnchorLinks = [];
  let editHeadingCount = 0;
  for(const route of inventory) {
    const file = nativePath(route);
    if(!fs.existsSync(path.join(root,file))) {pageResults.push({route,exists:false}); continue;}
    const markup = read(file);
    const local = new JSDOM(markup);
    const d = local.window.document;
    nativeAnchors.set(route,new Set([...d.querySelectorAll('[id]')].map(el=>el.id)));
    const result = {
      route, exists:true,
      h1: clean(d.querySelector('h1')?.textContent),
      header:Boolean(d.querySelector('.rw-site-header')),
      feedback:Boolean(d.querySelector('.rw-feedback-trigger')),
      hasMain:Boolean(d.querySelector('main')),
      footerCount:d.querySelectorAll('.rw-footer-v71').length,
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
      if(to.pathname.startsWith('/pve/')&&to.hash)pveAnchorLinks.push({from:route,path:to.pathname,id:decodeURIComponent(to.hash.slice(1))});
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
  check('Every registered route retains the common header, main landmark and floating feedback entry',pageResults.every(page=>page.header&&page.feedback&&page.hasMain&&page.footerCount===1));
  check('No native select elements return in the full static site',pageResults.every(page=>page.nativeSelectCount===0));
  check('All native internal navigation links resolve to an emitted page or static asset',brokenRoutes.length===0,brokenRoutes.slice(0,15));
  check('PVE links retain query context and resolve to real destination anchors',pveAnchorLinks.length>0&&pveAnchorLinks.every(link=>nativeAnchors.get(link.path)?.has(link.id)),pveAnchorLinks.filter(link=>!nativeAnchors.get(link.path)?.has(link.id)));
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
  const asset = json('content/decor-assets-v71.json').assets[0];
  check('Homepage uses the original official web-game background with a checked origin and byte hash',asset.sourcePage==='https://17roco.qq.com/'&&asset.sourceAsset==='https://res.17roco.qq.com/images/bg.png'&&sha(fs.readFileSync(path.join(root,'static'+asset.path)))===asset.sha256&&styleSource.includes('official-roco-login-bg.png')&&!styleSource.includes('academy-v7.webp'));
  check('Primary navigation has one selected pill without a competing underline; keyboard focus is retained',/rw-primary-navigation a::after[\s\S]*?content: none/.test(sharedStyles)&&sharedStyles.includes('text-decoration: none')&&sharedStyles.includes('a:focus-visible')&&sharedStyles.includes('a.active { background: #eaf0fc'));
  check('Footer has an explicit centered width, intrinsic-safe grid and a narrow-screen stacking contract',sharedStyles.includes('width: calc(100% - 68px)')&&sharedStyles.includes('grid-template-areas: "identity links" "legal legal"')&&sharedStyles.includes('grid-template-areas: "identity" "links" "legal"')&&sharedStyles.includes('minmax(0, 1fr)'));


  check('Footer side gutters switch at the same 996px and 600px breakpoints as article content',/@media \(max-width: 996px\)\s*\{\s*\.rw-footer[^}]*width: calc\(100% - 46px\)/.test(sharedStyles)&&/@media \(max-width: 600px\)\s*\{\s*\.rw-footer[^}]*width: calc\(100% - 32px\)/.test(sharedStyles));
  const html=read('RocoWiki_UI_V7_1.html');
  const vc=new VirtualConsole();
  vc.on('jsdomError',error=>runtimeErrors.push(String(error.message)));
  vc.on('error',(...args)=>runtimeErrors.push(args.map(String).join(' ')));
  dom=new JSDOM(html,{url:'https://preview.wiki.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
    w.scrollTo=()=>{};
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;};
    w.HTMLElement.prototype.scrollIntoView=function(){w.__lastScrolledId=this.id;};
  }});
  const w=dom.window,d=w.document;
  async function until(fn, label){for(let i=0;i<100;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Timed out: '+label);}
  async function navigate(route, expected){const actualTitle=pageResults.find(page=>page.route===route.split('?')[0])?.h1||expected;w.location.hash=route;await until(()=>clean(d.querySelector('h1')?.textContent)===actualTitle,route);await new Promise(resolve=>setTimeout(resolve,30));}
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const clickText=(selector,label)=>{const button=[...d.querySelectorAll(selector)].find(el=>clean(el.textContent)===label);if(!button)throw new Error('Missing button: '+label);button.click();return button;};
  const inputValue=(input,value)=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const editorParams=el=>new URL((el?.getAttribute('href')||'').replace(/^#/,'')||'/','https://wiki.test').searchParams;
  await until(()=>d.querySelector('.rw-v7-welcome'),'home mount');
  const bundledStyle=[...d.querySelectorAll('head style')].map(el=>el.textContent).join('\n');
  check('Delivered HTML includes both new PVE and flexible skill branch styles, not only their markup',bundledStyle.includes('.pv71 .pv71-nav')&&bundledStyle.includes('.rw-skill-branch-card')&&bundledStyle.includes('.rw-skill-nested-branches'));
  check('Shipped single-file preview starts without a server and mounts the new illustrated homepage',Boolean(d.querySelector('.rw-v7-welcome img'))&&d.querySelectorAll('.rw-v6-portal-index .rw-color-icon').length===6);
  check('Homepage preserves simultaneous ladder-left and type-tournament-right tables',JSON.stringify([...d.querySelectorAll('.rw-v6-competition h3')].map(el=>el.textContent))===JSON.stringify(['天梯赛','系别排位赛']));
  check('Homepage shows three activity columns including expiring activities',d.querySelectorAll('.rw-v6-event-columns > section').length===3&&d.querySelector('.rw-v6-event-columns')?.textContent.includes('即将过期'));
  check('Homepage credits the original official background without changing the retained wordmark',d.querySelector('.rw-welcome-source-v71')?.getAttribute('href')==='https://17roco.qq.com/'&&Boolean(d.querySelector('.rw-wordmark b')));
  await navigate('/pets/','宠物图鉴');
  const catalogActions=[...d.querySelectorAll('.rw-edit-entry')];
  check('Pet directory exposes add-pet only, without directory or filter editors',catalogActions.length===1&&catalogActions[0].textContent.includes('新增宠物')&&!d.body.textContent.includes('编辑目录'));
  await navigate('/pets/?q=海','宠物图鉴');await pause(60);
  d.querySelector('.rw-nav-toggle').click();await pause(20);
  d.querySelector('.rw-primary-navigation a[href="#/pets/"]').click();
  await until(()=>!d.querySelector('.rw-primary-navigation').classList.contains('is-open'),'query-only navigation closes menu');
  check('Mobile navigation closes when returning from a filtered catalog on the same pathname',!d.querySelector('.rw-primary-navigation').classList.contains('is-open')&&w.location.hash==='#/pets/');
  await navigate('/pets/haifu/','海芙约忒');
  check('Pet header has one dedicated edit action and the Counter contains no PVE content',d.querySelectorAll('.rw-pagehead .rw-edit-entry').length===1&&!d.querySelector('#matchups')?.textContent.includes('PVE'));
  check('Each acquisition and Counter record retains a dedicated typed editor', [...d.querySelectorAll('.rw-acquisition-entry-v6')].every(el=>el.querySelectorAll('.rw-edit-entry').length===1)&&[...d.querySelectorAll('.rw-matchup-card-v7')].every(el=>el.querySelectorAll('.rw-edit-entry').length===1));
  await navigate('/skills/','技能查询');
  check('Skill list rows and overview headings have no inline editors; adding one skill remains available',d.querySelectorAll('tbody .rw-edit-entry').length===0&&[...d.querySelectorAll('.rw-edit-entry')].every(el=>editorParams(el).get('intent')==='add'&&el.textContent.includes('新增技能')));
  check('Skills overview ends in 技能描述 and retains effect filtering',[...d.querySelectorAll('thead th')].at(-1)?.textContent==='技能描述'&&d.body.textContent.includes('效果'));
  await navigate('/skills/xiazi/?pet=haifu','霞姿月韵');
  const effectEdit=[...d.querySelectorAll('#effects .rw-edit-entry')].find(el=>editorParams(el).get('record')==='base');
  check('Skill paragraph editor preserves its originating pet context',editorParams(effectEdit).get('returnTo')==='/skills/xiazi/?pet=haifu#effects');
  await navigate('/npcs/','人物与NPC');
  check('NPC directory offers one clearly labeled add-entry action', [...d.querySelectorAll('.rw-edit-entry')].filter(el=>el.textContent.includes('新增人物条目')).length===1);
  await navigate('/adventure/','冒险资料');
  check('Adventure secondary navigation no longer jumps to the PVE primary route',![...d.querySelectorAll('.wa-section-nav a')].some(el=>el.getAttribute('href')==='#/pve/'));
  check('Adventure child pages keep their primary navigation attribution',Boolean(d.querySelector('.rw-primary-navigation a.active[href="#/adventure/"]')));
  await navigate('/mechanics/','战斗机制');
  const allMechanics=[...d.querySelectorAll('.rw-pagehead a')].find(el=>clean(el.textContent)==='全部机制');
  check('Mechanics overview directly opens the complete Docusaurus reading index',allMechanics?.getAttribute('href')==='#/mechanics/overview/');
  allMechanics?.click();
  await until(()=>d.querySelector('.rw-preview-doc-layout'),'all mechanics layout');
  check('All-mechanisms view presents reading body with left navigation and right outline',Boolean(d.querySelector('.rw-preview-doc-body'))&&Boolean(d.querySelector('.rw-preview-sidebar'))&&Boolean(d.querySelector('.rw-preview-doc-toc')));
  await navigate('/events/fun-chess/','趣味对弈');
  check('One recurring activity page displays both independent opening periods',d.body.textContent.includes('2025.05.02')&&d.body.textContent.includes('2025.11.28'));
  await navigate('/tools/damage/','威力伤害计算器');
  check('Power damage calculator has one rule editor and visibly emphasizes upper damage',d.querySelectorAll('#calculation-rules .rw-section-actions .rw-edit-entry').length===1&&d.body.textContent.includes('伤害上限'));
  const pageFeedback=d.querySelector('.rw-contribution-links button');
  check('Tool footer offers contextual feedback rather than a broad article editor',pageFeedback?.textContent.includes('反馈此页问题')&&!d.querySelector('.rw-contribution-links .rw-edit-entry'));
  pageFeedback?.focus();pageFeedback?.click();
  await until(()=>d.querySelector('.rw-feedback-dialog')?.open,'footer feedback');
  check('Footer feedback opens on the current page and returns keyboard focus to its invoker',d.querySelector('.rw-feedback-context')?.textContent.includes('/tools/damage/'));
  d.querySelector('[aria-label="关闭反馈"]').click();await pause(30);
  check('Closing contextual feedback restores the invoking control',d.activeElement===pageFeedback&&!d.querySelector('.rw-feedback-dialog').open);
  await navigate('/account/','个人中心');
  check('Personal center has five clear primary categories rather than mixed profile/binding entries',JSON.stringify([...d.querySelectorAll('.ev7-account-nav button')].map(el=>clean(el.textContent)))===JSON.stringify(['我的首页','我的投稿','我的收藏','个人资料','账号与安全']));
  check('Account overview displays avatar, name and an honestly unbound GitHub platform chip',Boolean(d.querySelector('.rw-account-identity-v71 img'))&&Boolean(d.querySelector('.rw-account-name-v71 h2'))&&d.querySelector('[aria-label="身份与关联平台"]')?.textContent.includes('GitHub 未绑定')&&Boolean(d.querySelector('[aria-label="查看 GitHub 关联状态"] svg')));
  clickText('.ev7-account-nav button','个人资料');
  await until(()=>d.querySelector('.cm-profile-form'),'profile form');
  check('Account tab selection has a stable, directly addressable URL',w.location.hash==='#/account/?tab=profile');
  const radios=[...d.querySelectorAll('.rw-avatar-picker-v71 [role="radio"]')];
  radios[0].focus();radios[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  await until(()=>radios[1].getAttribute('aria-checked')==='true','avatar keyboard choice');
  check('Avatar picker supports arrow navigation, checked state and roving keyboard focus',d.activeElement===radios[1]&&radios[1].tabIndex===0&&radios[0].tabIndex===-1);
  inputValue(d.querySelector('.cm-profile-form input'),'图鉴整理员');await pause(30);
  d.querySelector('.cm-profile-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')||'{}').profile?.nickname==='图鉴整理员','profile saved');
  const profile=JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')).profile;
  check('Selected avatar and nickname are stored together without fabricating online identity',profile.avatar==='haifu'&&profile.nickname==='图鉴整理员'&&d.body.textContent.includes('尚未创建线上账号'));
  const persistentProfile=w.localStorage.getItem('roco-wiki-v4:community');
  const originalSetItem=w.Storage.prototype.setItem;
  w.Storage.prototype.setItem=function(){throw new w.DOMException('Test storage quota','QuotaExceededError');};
  radios[2].click();inputValue(d.querySelector('.cm-profile-form input'),'临时整理员');await pause(30);
  d.querySelector('.cm-profile-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>d.querySelector('.cm-profile-form .cm-inline-error')?.textContent.includes('仅暂存'),'profile failed save message');
  check('Storage failure never shows a false success and keeps the session avatar consistent',!d.querySelector('.cm-profile-form .cm-inline-success')&&w.localStorage.getItem('roco-wiki-v4:community')===persistentProfile&&d.querySelector('.rw-account-avatar-button img')?.getAttribute('src')===d.querySelector('.rw-account-link img')?.getAttribute('src'));
  w.Storage.prototype.setItem=originalSetItem;
  radios[1].click();inputValue(d.querySelector('.cm-profile-form input'),'图鉴整理员');await pause(30);
  d.querySelector('.cm-profile-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>d.querySelector('.cm-profile-form .cm-inline-success'),'profile retry successful');
  check('Profile save can recover after storage becomes available',JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')).profile?.avatar==='haifu'&&!d.querySelector('.cm-profile-form .cm-inline-error'));
  clickText('.ev7-account-nav button','我的首页');
  await until(()=>d.querySelector('.rw-account-identity-v71'),'account return');
  check('Account identity and persistent header avatar both read back the saved profile',d.querySelector('.rw-account-name-v71 h2')?.textContent==='图鉴整理员'&&d.querySelector('.rw-account-avatar-button img')?.getAttribute('src')===d.querySelector('.rw-account-link img')?.getAttribute('src'));
  d.querySelector('[aria-label="查看 GitHub 关联状态"]').click();
  await until(()=>w.location.hash==='#/account/?tab=security','platform security link');
  check('Platform association status leads directly to Account and Security',d.querySelector('.ev7-account-nav button.is-active')?.textContent.includes('账号与安全'));
  await navigate('/guides/returning/','回归先查什么');
  check('Return guide mounts the explicit article/sidebar layout with four subsection editors',d.querySelectorAll('.rw-preview-doc-body .theme-doc-markdown h2 .rw-edit-entry').length===4&&Boolean(d.querySelector('.rw-preview-doc-layout > .rw-preview-doc-body')));
  const doc=docs.find(doc=>doc.path==='/guides/returning/');
  const request={entity:doc.title,section:doc.sections[0].title,mode:'article',returnTo:doc.path+'#section-1',intent:'edit'};
  const marker='本机修订验收：先按编号整理已有宠物。';
  const newMarkdown=marker+'\n\n| 项目 | 说明 |\n| --- | --- |\n| 编号 | 同形态核对 |\n\n[培养资料](./training.md)';
  const workspace=JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')||'{"version":1,"profile":{},"drafts":[],"submissions":[]}');
  workspace.submissions=[...(workspace.submissions||[]),{id:'v71-integration-doc',status:'published',editorVersion:7,editorMode:'article',editorRequest:request,target:doc.title,section:request.section,typedData:{markdown:newMarkdown},updatedAt:'2026-10-10T12:00:00Z',before:doc.sections[0].markdown,after:newMarkdown,snapshotKey:[doc.title,request.section,'article','all','existing'].join('::')}];
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
  const beforePreview=w.localStorage.getItem('roco-wiki-v4:community');
  clickText('.ev7-toolbar button','预览效果');
  await until(()=>d.querySelector('.ev71-preview-iframe')?.contentDocument?.querySelector('[data-readonly-preview="true"]'),'rendered reading preview');
  const frame=d.querySelector('.ev71-preview-iframe'),inside=frame.contentDocument;
  check('Editor preview renders the revised article body, table and links inside a reading viewport',inside.body.textContent.includes(marker)&&inside.querySelectorAll('table').length===1&&Boolean(inside.querySelector('a')));
  check('Reading preview is separate from the editor and contains no edit or vote controls',inside.querySelectorAll('.rw-edit-entry,.rw-counter-vote-button,textarea,button,input').length===0&&frame.getAttribute('sandbox')==='allow-same-origin');
  clickText('.ev71-preview-device button','手机');
  await until(()=>d.querySelector('.ev71-preview-frame')?.dataset.previewWidth==='mobile','mobile viewport');
  check('Preview changes its actual frame container to the 390px mobile viewport contract',read('src/wiki/EditingV7.css').includes('max-width:390px')||/max-width:\s*390px/.test(read('src/wiki/EditingV7.css')));
  const parentRoute=w.location.hash;inside.querySelector('a').click();
  await until(()=>d.querySelector('.ev71-preview-navigation'),'preview navigation notice');
  check('Following a preview link shows its destination without leaving or mutating the draft',w.location.hash===parentRoute&&w.localStorage.getItem('roco-wiki-v4:community')===beforePreview);
  clickText('.ev7-toolbar button','对照差异');await pause(30);
  check('Diff is a separate mode, rather than the only preview',!d.querySelector('.ev71-preview-iframe')&&Boolean(d.querySelector('.cm-diff')));
  await navigate('/review/?submission=v71-integration-doc','审核与发布');
  await until(()=>d.querySelector('.rw-review-view-tabs-v71'),'review preview controls');
  await until(()=>d.querySelector('.ev71-preview-iframe')?.contentDocument?.body?.textContent.includes(marker),'review content preview');
  check('Review opens the same rendered article preview as editing, including revised content',Boolean(d.querySelector('.rw-review-view-tabs-v71'))&&d.querySelector('.ev71-preview-iframe').contentDocument.body.textContent.includes(marker));
  clickText('.rw-review-view-tabs-v71 button','修改对比');await pause(30);
  check('Review also offers a distinct diff view',!d.querySelector('.ev71-preview-iframe')&&Boolean(d.querySelector('.cm-diff')));
  check('Delivered preview has no React or uncaught JavaScript errors',runtimeErrors.filter(error=>!error.includes('Could not parse CSS stylesheet')).length===0,runtimeErrors.slice(0,8));
  dom.window.close();dom=null;
}

main().catch(error=>{check('Integration runner completed',false,String(error.stack||error));}).finally(()=>{
  if(dom)dom.window.close();
  const report={version:'7.1',scope:'Native static HTML + delivered single-file HTML executed in JSDOM. Not a browser screenshot, layout, frame-rate, real-service or game-client test.',checkedAt:new Date().toISOString(),passed:checks.filter(check=>check.pass).length,failed:checks.filter(check=>!check.pass).length,routeCount:inventory.length,documentCount:docs.length,checks,pageResults,runtimeErrors,previewSha256:sha(read('RocoWiki_UI_V7_1.html')),sourceSha256:Object.fromEntries(['src/css/v7.css','src/css/v71.css','src/wiki/AccountIdentity.jsx','src/wiki/CommunityPages.jsx','src/wiki/Feedback.jsx','src/wiki/HomePage.jsx','src/wiki/editing/PreviewContent.jsx','src/wiki/core.jsx','src/wiki/InlineSectionEdits.jsx','src/wiki/editing/ReadingMarkdown.jsx','src/wiki/editing/PublishedDocument.jsx','src/wiki/editing/documentComposition.js','src/wiki/editing/registry.js','docusaurus.config.js','src/wiki/EditingV7.css','src/wiki/editingContext.js','src/wiki/PvePages.jsx','src/wiki/WorldPages.jsx','preview/main.jsx','scripts/build-preview.mjs','src/css/custom.css','preview/broken-links.js','validation/check-v71-integration.cjs'].map(file=>[file,sha(read(file))]))};
  fs.writeFileSync(path.join(__dirname,'v71-integration-check-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,failed:report.failed,routes:inventory.length,failures:checks.filter(check=>!check.pass)}));
  process.exitCode=report.failed?1:0;
});
