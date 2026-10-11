/** Validate the exact delivered HTML and native Docusaurus output. No browser geometry assertions. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const checks = [], pageResults = [], runtimeErrors = [];
const check = (name, pass, details) => checks.push({name, pass: Boolean(pass), ...(!pass && details !== undefined ? {details} : {})});
const clean = value => String(value || '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
const routes = json('content/routes.json');
const docs = json('content/published-docs-v7.json').documents;
const inventory = [...routes, ...docs.map(doc => doc.path)];
const nativePath = route => 'build/' + route.replace(/^\//, '') + 'index.html';
let dom;

async function main() {
  const brokenRoutes = [], imageFailures = [], badDocumentEditors = [], pveLinks = [];
  const anchors = new Map();
  let headingCount = 0, nativeEntityChips = 0;
  for (const route of inventory) {
    const file = nativePath(route);
    if (!fs.existsSync(path.join(root, file))) {pageResults.push({route, exists: false}); continue;}
    const local = new JSDOM(read(file)), d = local.window.document;
    anchors.set(route, new Set([...d.querySelectorAll('[id]')].map(el => el.id)));
    const row = {route, exists: true, h1: clean(d.querySelector('h1')?.textContent), header: d.querySelectorAll('.rw-site-header').length,
      main: Boolean(d.querySelector('main')), feedback: d.querySelectorAll('.rw-feedback-trigger').length,
      footer: d.querySelectorAll('.rw-footer-v72').length, maintainers: d.querySelectorAll('.rw-maintainers-v72').length,
      nativeSelects: d.querySelectorAll('select').length};
    const doc = docs.find(item => item.path === route);
    if (doc) {
      nativeEntityChips += d.querySelectorAll('.theme-doc-markdown .rw-entity-reference').length;
      row.docSheet = Boolean(d.querySelector('.rw-doc-sheet .theme-doc-markdown'));
      for (const heading of d.querySelectorAll('.theme-doc-markdown h2,.theme-doc-markdown h3,.theme-doc-markdown h4')) {
        const link = heading.querySelector('.rw-edit-entry');
        const query = new URL(link?.getAttribute('href') || '/', 'https://wiki.test').searchParams;
        const anchor = (query.get('returnTo') || '').split('#')[1] || '';
        if (!(link && query.get('mode') === 'article' && query.get('entity') === doc.title && d.getElementById(decodeURIComponent(anchor)) === heading)) badDocumentEditors.push({route, heading: clean(heading.textContent)});
        headingCount++;
      }
      const bottom = d.querySelector('.theme-edit-this-page');
      const query = new URL(bottom?.getAttribute('href') || '/', 'https://wiki.test').searchParams;
      row.bottomEditor = query.get('entity') === doc.title && query.get('mode') === 'article' && query.get('returnTo') === route;
    }
    for (const link of d.querySelectorAll('a[href^="/"]')) {
      const to = new URL(link.getAttribute('href'), 'https://wiki.test');
      if (to.origin !== 'https://wiki.test') continue;
      const candidate = path.join(root, 'build', decodeURIComponent(to.pathname));
      if (!fs.existsSync(candidate) && !fs.existsSync(path.join(candidate, 'index.html'))) brokenRoutes.push({from: route, to: to.pathname});
      if (to.pathname.startsWith('/pve/') && to.hash) pveLinks.push({from: route, path: to.pathname, id: decodeURIComponent(to.hash.slice(1))});
    }
    for (const img of d.querySelectorAll('img[src^="/"]')) {
      if (!fs.existsSync(path.join(root, 'build', img.getAttribute('src').split('?')[0]))) imageFailures.push({route, src: img.getAttribute('src')});
    }
    pageResults.push(row); local.window.close();
  }
  check('All 121 content routes are emitted as readable native HTML, with a separate 404 page', inventory.length === 121 && pageResults.every(p => p.exists && p.h1) && fs.existsSync(path.join(root, 'build/404.html')), pageResults.filter(p => !p.exists || !p.h1));
  check('Every content page has one shared header, main, footer, feedback entry and maintenance block', pageResults.every(p => p.header === 1 && p.main && p.footer === 1 && p.feedback === 1 && p.maintainers === 1), pageResults.filter(p => p.header !== 1 || !p.main || p.footer !== 1 || p.feedback !== 1 || p.maintainers !== 1));
  check('Native routes contain no browser-native select menus', pageResults.every(p => p.nativeSelects === 0));
  check('Every internal native route and locally referenced image resolves', brokenRoutes.length === 0 && imageFailures.length === 0, {brokenRoutes: brokenRoutes.slice(0, 15), imageFailures});
  check('PVE contextual anchors resolve to actual destination sections', pveLinks.length > 0 && pveLinks.every(link => anchors.get(link.path)?.has(link.id)), pveLinks.filter(link => !anchors.get(link.path)?.has(link.id)));
  check('All 105 native documentation subheadings retain their specific editor and return anchor', headingCount === 105 && badDocumentEditors.length === 0, {headingCount, badDocumentEditors});
  check('All 25 Docusaurus documents retain the article sheet and contextual whole-article editor', pageResults.filter(p => p.docSheet).length === 25 && pageResults.filter(p => p.docSheet).every(p => p.bottomEditor));
  check('Native MDX documents render typed internal entity links', nativeEntityChips > 0, {nativeEntityChips});
  const font = fs.readFileSync(path.join(root, 'static/fonts/roco-wiki-sans-v7.woff2'));
  const fonts = fs.readdirSync(path.join(root, 'build/assets/fonts')).filter(name => name.startsWith('roco-wiki-sans-v7'));
  check('The native static font and hashed bundled font match the final subset bytes', fonts.length === 1 && sha(font) === sha(fs.readFileSync(path.join(root, 'build/fonts/roco-wiki-sans-v7.woff2'))) && sha(font) === sha(fs.readFileSync(path.join(root, 'build/assets/fonts', fonts[0]))));
  const official = json('content/decor-assets-v71.json').assets[0];
  check('Illustrated headers use the unchanged official web-game asset with provenance', official.sourceAsset === 'https://res.17roco.qq.com/images/bg.png' && sha(fs.readFileSync(path.join(root, 'static' + official.path))) === official.sha256);
  const s7 = read('src/css/v7.css'), s71 = read('src/css/v71.css'), s72 = read('src/css/v72.css');
  check('All headers use one background variable with a transparent left mask', s7.includes('var(--rw-official-scene)') && s72.includes('mask-image: linear-gradient(90deg, transparent') && (s72.match(/official-roco-login-bg\.png/g) || []).length === 1);
  check('Header and footer wordmarks retain Georgia while body uses the sans-serif system', /\.rw-wordmark b\s*\{\s*font-family:\s*Georgia/.test(s7) && /\.rw-footer-v72 \.rw-footer-brand strong[^}]*Georgia/.test(s72) && s7.includes('--rw-font-serif: var(--rw-font-sans)'));
  check('All six home shortcuts share fixed grid slots and explicit 6/3/2-column breakpoints', s72.includes('.rw-v6-portal-index > a:nth-child(n)') && ['repeat(6,minmax(0,1fr))', 'repeat(3,minmax(0,1fr))', 'repeat(2,minmax(0,1fr))', 'grid-template-columns: 40px minmax(0,1fr)'].every(text => s72.includes(text)));
  check('Tools use rounded surfaces; page maintenance and footer share the 996/600 gutter contract', /\.rw-tools-index > a[^}]*border-radius: 24px/.test(s72) && ['width: calc(100% - 68px)', 'width: calc(100% - 46px)', 'width: calc(100% - 32px)'].every(text => s72.includes(text) && s71.includes(text)));
  check('Selected navigation remains a single pill, and reduced-motion is supported', s71.includes('content: none') && s71.includes('a:focus-visible') && s7.includes('@media (prefers-reduced-motion: reduce)') && s72.includes('@media (prefers-reduced-motion: reduce)'));

  const html = read('RocoWiki_UI_V7_2.html'), vc = new VirtualConsole();
  vc.on('jsdomError', error => runtimeErrors.push(String(error.message)));
  vc.on('error', (...args) => runtimeErrors.push(args.map(String).join(' ')));
  dom = new JSDOM(html, {url: 'https://preview.wiki.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
    w.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = function() {w.__scrolled = this.id;};
    w.HTMLDialogElement.prototype.showModal = function() {this.open = true;};
    w.HTMLDialogElement.prototype.close = function() {this.open = false;};
    Object.defineProperty(w.navigator, 'clipboard', {value: {async writeText(value) {w.__clipboard = value;}}});
  }});
  const w = dom.window, d = w.document, pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(fn, label) {for (let i = 0; i < 120; i++) {if (fn()) return; await pause(25);} throw new Error('Timed out: ' + label);}
  async function navigate(route, heading) {
    const expected = heading || pageResults.find(row => row.route === route.split('?')[0])?.h1;
    w.location.hash = route;
    await until(() => clean(d.querySelector('h1')?.textContent) === expected, route);
    await pause(75);
  }
  function button(selector, label) {const el = [...d.querySelectorAll(selector)].find(el => clean(el.textContent) === label); if (!el) throw new Error('Missing control: ' + label); return el;}
  function input(el, value) {if (!el) throw new Error('Missing text input'); const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new w.Event('input', {bubbles: true}));}
  const params = el => new URL((el?.getAttribute('href') || '/').replace(/^#/, ''), 'https://wiki.test').searchParams;
  await until(() => d.querySelector('.rw-v7-welcome'), 'home mount');
  const css = [...d.querySelectorAll('head style')].map(el => el.textContent).join('\n');
  check('The self-contained preview mounts without a server and includes all new feature styles', Boolean(d.querySelector('.rw-v7-welcome')) && ['.rw-community-overview-v72', '.rw-honor-shop-grid-v72', '.rw-pet-overview-v72', '.rw-flow-paths-paired', '.pv72-seven-detail', '.rw-page-community-v72'].every(name => css.includes(name)));
  check('Homepage retains simultaneous ladder-left/type-right tables and three activity columns', JSON.stringify([...d.querySelectorAll('.rw-v6-competition h3')].map(el => el.textContent)) === JSON.stringify(['天梯赛', '系别排位赛']) && d.querySelectorAll('.rw-v6-event-columns > section').length === 3 && d.querySelector('.rw-v6-event-columns')?.textContent.includes('即将过期'));
  check('Homepage has six consistently structured shortcuts and original background credit', d.querySelectorAll('.rw-v6-portal-index .rw-color-icon').length === 6 && d.querySelector('.rw-welcome-source-v71')?.getAttribute('href') === 'https://17roco.qq.com/');
  const illustrated = [];
  for (const route of ['/pets/', '/skills/', '/mechanics/', '/events/', '/battle/', '/pve/', '/adventure/', '/tools/']) {
    await navigate(route);
    illustrated.push({route, kind: d.querySelector('.rw-pagehead-illustrated-v72')?.dataset.headerKind});
  }
  check('All eight primary landing pages mount the shared illustrated header', illustrated.every(row => row.kind === row.route.split('/')[1]), illustrated);
  await navigate('/battle/');
  const pvpNav = [...d.querySelectorAll('.wa-tabs[aria-label="对战模式"] a')].map(el => clean(el.textContent));
  check('Default PVP route starts with ladder and places competition ahead of type ranking', JSON.stringify(pvpNav) === JSON.stringify(['天梯赛','天梯巅峰赛','系别排位赛']) && d.querySelector('.wa-battle-toolbar strong')?.textContent === '天梯赛', {pvpNav});
  await navigate('/pets/');
  check('Pet directory exposes only add-pet as an editorial action', d.querySelectorAll('.rw-edit-entry').length === 1 && d.querySelector('.rw-edit-entry')?.textContent.includes('新增宠物') && !d.body.textContent.includes('编辑目录'));
  await navigate('/pets/haifu/');
  const facts = d.querySelector('.rw-pet-facts'), originalFacts = facts.textContent;
  check('Pet facts consolidate series, bloodlines, size, colour and capture information', ['所属系列', '可选血脉', '身高', '体重', '颜色', '捕捉分类'].every(label => originalFacts.includes(label)) && !d.querySelector('.rw-pet-metadata-v6'));
  check('Ladder cost is attached to the portrait and no longer a facts row', d.querySelector('.rw-pet-hero-magic-v72')?.textContent === '5' && ![...facts.querySelectorAll('dt')].some(el => el.textContent === '天梯魔力值'));
  const appearanceImages = [d.querySelector('.rw-pet-gallery-image-v72 img')?.src];
  for (const label of ['闲情', '玉蟾']) {button('.rw-pet-appearance-options-v72 button', label).click(); await pause(35); appearanceImages.push(d.querySelector('.rw-pet-gallery-image-v72 img')?.src);}
  check('All three appearance selections use distinct embedded images and leave facts unchanged', appearanceImages.every(src => src?.startsWith('data:image/')) && new Set(appearanceImages).size === 3 && facts.textContent === originalFacts);
  check('The miniature ability calculator starts with six real computed results', d.querySelectorAll('.rw-pet-mini-result > div').length === 6 && d.querySelector('.rw-pet-mini-result .stat-hp strong')?.textContent === '465');
  input(d.querySelector('input[aria-label="简易能力 · 等级"]'), '50'); await pause(50);
  check('Changing pet level recalculates and transfers cultivation to the complete tool', d.querySelector('.rw-pet-mini-result .stat-hp strong')?.textContent === '237' && JSON.parse(params(d.querySelector('.rw-pet-mini-heading > a')).get('calc')).level === '50');
  check('Counter remains PVP-only with both bloodline contexts visible', !d.querySelector('#matchups')?.textContent.includes('PVE') && d.querySelector('.rw-counter-bloodlines-v71')?.textContent.includes('我方血脉') && d.querySelector('.rw-counter-bloodlines-v71')?.textContent.includes('对手血脉'));
  await navigate('/skills/');
  check('Skill lookup includes custom sorting and keeps description as its last column', Boolean(d.querySelector('.rw-skill-sort-v72 [role="combobox"]')) && [...d.querySelectorAll('thead th')].at(-1)?.textContent === '技能描述' && d.querySelectorAll('tbody .rw-edit-entry').length === 0);
  await navigate('/bloodlines/');
  check('Bloodline catalogue is organized around four bloodline entries with owner associations', d.querySelectorAll('.rw-bloodline-card-v72').length === 4 && d.querySelectorAll('.rw-bloodline-owners-v72').length === 4);
  await navigate('/skills/xiazi/?pet=haifu');
  check('Skill detail renders description plus component flow with focused effect editors', Boolean(d.querySelector('[data-skill-flow="components"]')) && Boolean(d.querySelector('.rw-flow-base')) && [...d.querySelectorAll('#effects .rw-edit-entry')].some(el => params(el).get('returnTo') === '/skills/xiazi/?pet=haifu#effects'));
  d.querySelector('.rw-flow-copy-button').click(); await until(() => w.__clipboard, 'Mermaid copy');
  check('Mermaid copy exports an actual graph rather than a static display label', /^flowchart\s+TD/.test(w.__clipboard) && w.__clipboard.includes('-->') && !w.__clipboard.includes('undefined'));
  await navigate('/pve/');
  const addPve = [...d.querySelectorAll('.rw-edit-entry')].find(el => clean(el.textContent) === '新增玩法');
  check('PVE directory has a dedicated new-gameplay editor distinct from new team plans', params(addPve).get('mode') === 'pve-guide' && params(addPve).get('intent') === 'add');
  await navigate('/pve/shanhai/');
  check('Shanhai summon is exposed under rewards rather than a challenge section', Boolean(d.querySelector('#shanhai-summon[data-pve-reward-activity]')) && ![...d.querySelectorAll('.pv71-nav a,.pv71-section-nav a')].some(el => el.textContent.includes('山海召唤')));
  await navigate('/pve/seven-sanctuaries/');
  check('Seven Sanctuaries exposes all seven zones, difficulty selection and an honest source status', d.querySelectorAll('.pv72-seven-days button').length === 7 && Boolean(d.querySelector('[aria-label="七曜挑战难度"]')) && d.querySelectorAll('.pv72-seven-table tbody tr').length === 7 && d.querySelector('.pv72-seven-table')?.textContent.includes('待核对'));
  await navigate('/account/');
  check('Account overview shows separate guide likes, comment likes, contributions and discussion', d.querySelectorAll('.rw-influence-grid-v72 button').length === 4 && ['攻略被点赞', '评论被点赞', '已发布贡献', '参与讨论'].every(text => d.querySelector('.rw-influence-grid-v72').textContent.includes(text)));
  check('Account navigation exposes community honors at the same level as profile and security', [...d.querySelectorAll('.ev7-account-nav button')].some(el => clean(el.textContent) === '社区荣誉'));
  await navigate('/account/?tab=profile');
  await until(() => d.querySelector('#rw-profile-uuid')?.value.match(/^[a-f0-9-]{36}$/i), 'profile UUID');
  const uuid = d.querySelector('#rw-profile-uuid').value;
  check('The profile displays a persisted UUID with a copy control', JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')).profile.uuid === uuid && Boolean(d.querySelector('.rw-profile-serial-v72 button')));
  await navigate('/account/?tab=honors&view=checkin');
  await until(() => d.querySelector('.rw-checkin-button-v72:not(:disabled)'), 'checkin available');
  d.querySelector('.rw-checkin-button-v72').click(); await pause(80);
  check('A real local check-in updates the disabled state and the +5 ledger entry', d.querySelector('.rw-checkin-button-v72')?.disabled && d.querySelector('.rw-checkin-button-v72')?.textContent.includes('今日已签到') && d.querySelector('.rw-ledger-table-v72')?.textContent.includes('+5'));
  await navigate('/account/?tab=honors&view=badges');
  await until(() => d.querySelector('.rw-honor-shop-grid-v72'), 'badge cabinet');
  button('.rw-honor-item-v72 button:not(:disabled)', '兑换').click(); await pause(65);
  button('.rw-honor-item-v72 button:not(:disabled)', '佩戴').click(); await pause(65);
  check('Earned check-in currency buys and equips a visible badge in the final preview', Boolean(d.querySelector('.rw-honor-item-v72 button.is-equipped')) && d.querySelector('.rw-honor-item-v72 button.is-equipped').textContent === '取消佩戴');
  await navigate('/account/?tab=honors&view=rankings');
  await until(() => d.querySelector('.rw-ranking-v72'), 'rankings');
  check('Leaderboard presents day, week, month and all-time periods with local scope explicit', JSON.stringify([...d.querySelectorAll('.rw-ranking-periods-v72 button')].map(el => clean(el.textContent))) === JSON.stringify(['日榜', '周榜', '月榜', '总榜']) && !d.querySelector('.rw-ranking-v72.is-sample') && d.querySelector('.rw-ranking-v72')?.textContent.includes('尚未连接公共榜单'));
  await navigate('/guides/returning/');
  const discussion = d.querySelector('.rw-page-discussion-v72'); discussion.open = true;
  input(d.querySelector('textarea[aria-label="本页评论"]'), '[海芙约忒](/pets/haifu/) 的相关条目可以在这里继续核对。'); await pause(40);
  d.querySelector('.rw-discussion-body-v72 form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
  await until(() => d.querySelector('.rw-comments-v72 > li'), 'comment saved');
  check('Published local discussion renders a circular pet reference and an outgoing arrow', Boolean(d.querySelector('.rw-comments-v72 .rw-entity-reference[data-entity-kind="宠物"] img')) && Boolean(d.querySelector('.rw-comments-v72 .rw-entity-reference-arrow')) && d.querySelector('.rw-comments-v72 .rw-entity-reference')?.getAttribute('href') === '#/pets/haifu/');
  check('A contributor cannot like their own comment and the page has only one maintainer block', d.querySelector('.rw-comments-v72 button')?.disabled && d.querySelectorAll('.rw-maintainers-v72').length === 1);
  const doc = docs.find(item => item.path === '/guides/returning/');
  const request = {entity: doc.title, section: doc.sections[0].title, mode: 'article', returnTo: doc.path + '#section-1', intent: 'edit'};
  const marker = 'V7.2 交付读回：先核对宠物条目的血脉列表。';
  const markdown = marker + '\n\n[海芙约忒](/pets/haifu/)\n\n[培养资料](./training.md)';
  const workspace = JSON.parse(w.localStorage.getItem('roco-wiki-v4:community'));
  workspace.submissions = [...(workspace.submissions || []), {id: 'v72-integration-document', status: 'published', editorVersion: 7, editorMode: 'article', editorRequest: request, target: doc.title, section: request.section, authorId: uuid, author: '资料维护验收员', avatar: 'dimo', typedData: {markdown}, before: doc.sections[0].markdown, after: markdown, updatedAt: '2026-10-10T17:00:00Z', snapshotKey: [doc.title, request.section, 'article', 'all', 'existing'].join('::')}];
  w.localStorage.setItem('roco-wiki-v4:community', JSON.stringify(workspace)); w.dispatchEvent(new w.Event('roco:community-updated'));
  await until(() => d.body.textContent.includes(marker) && d.querySelector('.rw-maintainers-list-v72'), 'published section and maintainer');
  check('Publication updates the guide section and immediately credits its identified maintainer', d.body.textContent.includes('第二步：看当前还能获得什么') && d.querySelector('.rw-maintainers-list-v72')?.textContent.includes('资料维护验收员') && d.querySelector('.rw-maintainers-list-v72')?.textContent.includes('1 次修订'));
  const sectionEdit = d.querySelector('.rw-reading-markdown h2 .rw-edit-entry'); sectionEdit.click();
  await until(() => d.querySelector('.ev7-root'), 'reopen edited section'); await pause(160);
  check('Reopening the article edit loads the latest published text', [...d.querySelectorAll('textarea')].some(el => el.value.includes(marker)));
  const draftMarker = '这段尚未提交，返回时应保存在草稿。';
  input([...d.querySelectorAll('textarea')].find(el => el.value.includes(marker)), markdown + '\n\n' + draftMarker); await pause(65);
  button('.ev7-toolbar button', '预览效果').click();
  await until(() => d.querySelector('.ev71-preview-iframe')?.contentDocument?.querySelector('[data-readonly-preview="true"]'), 'rendered preview');
  const frame = d.querySelector('.ev71-preview-iframe'), inside = frame.contentDocument;
  check('Reading preview renders unsaved content and actual typed entity chips without edit controls', inside.body.textContent.includes(draftMarker) && Boolean(inside.querySelector('.rw-entity-reference[data-entity-kind="宠物"]')) && !inside.querySelector('.rw-edit-entry') && frame.getAttribute('sandbox') === 'allow-same-origin');
  const routeBefore = w.location.hash; inside.querySelector('.rw-entity-reference').click(); await pause(50);
  check('Following an entity in preview reports its destination and preserves the editor', w.location.hash === routeBefore && Boolean(d.querySelector('.ev71-preview-navigation')));
  const returnControl = [...d.querySelectorAll('.ev7-root button')].filter(el => clean(el.textContent).includes('返回原页')).at(-1);
  check('The editor provides a bottom return control in addition to its top navigation', Boolean(returnControl));
  returnControl?.click(); await until(() => w.location.hash.startsWith('#/guides/returning/') && d.querySelector('h1')?.textContent === doc.title, 'bottom editor return');
  check('Bottom return preserves unsaved edits in a recoverable draft without publishing them', (JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')).drafts || []).some(row => row.typedData?.markdown?.includes(draftMarker)) && !d.body.textContent.includes(draftMarker));
  check('The delivered preview produces no React or uncaught JavaScript errors in this route journey', runtimeErrors.filter(error => !error.includes('Could not parse CSS stylesheet')).length === 0, runtimeErrors.slice(0, 10));
  dom.window.close(); dom = null;
}

main().catch(error => check('Integration runner completed', false, String(error.stack || error))).finally(() => {
  if (dom) dom.window.close();
  const tracked = ['src/css/custom.css', 'src/css/v7.css', 'src/css/v71.css', 'src/css/v72.css', 'src/wiki/core.jsx', 'src/wiki/PageCommunityFooter.jsx', 'src/wiki/pageCommunityModel.js', 'src/wiki/HomePage.jsx', 'src/wiki/WorldPages.jsx', 'src/wiki/PvePages.jsx', 'src/wiki/SevenSanctuaries.jsx', 'src/wiki/PveGuideEditor.jsx', 'src/wiki/pvePublished.js', 'src/wiki/PveV72.css', 'src/wiki/CommunityPages.jsx', 'src/wiki/CommunityHonors.jsx', 'src/wiki/CommunityHonors.css', 'src/wiki/CatalogPages.jsx', 'src/wiki/SkillBranchView.jsx', 'src/theme/MDXComponents/A/index.jsx', 'preview/main.jsx', 'scripts/build-preview.mjs', 'docusaurus.config.js', 'validation/check-v72-integration.cjs'];
  const report = {version: '7.2', scope: 'Native Docusaurus HTML, source/CSS contracts, and the exact self-contained preview executed in JSDOM. No real browser geometry, screenshot, device, frame-rate, Mermaid runtime or remote-service test.', checkedAt: new Date().toISOString(), passed: checks.filter(item => item.pass).length, failed: checks.filter(item => !item.pass).length, routeCount: inventory.length, documentCount: docs.length, checks, pageResults, runtimeErrors, previewSha256: fs.existsSync(path.join(root, 'RocoWiki_UI_V7_2.html')) ? sha(read('RocoWiki_UI_V7_2.html')) : null, sourceHashes: Object.fromEntries(tracked.map(file => [file, sha(read(file))]))};
  fs.writeFileSync(path.join(__dirname, 'v72-integration-check-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({passed: report.passed, failed: report.failed, routes: inventory.length, failures: checks.filter(item => !item.pass)}));
  process.exitCode = report.failed ? 1 : 0;
});
