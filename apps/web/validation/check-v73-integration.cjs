/** Verify final delivery bytes, native Docusaurus documents and the exact bundled preview.
 * JSDOM does not measure browser geometry, image rendering or frame rate.
 * Focused iframe lifecycle/fault injection belongs to check-v73-flow/interface.cjs.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const bytes = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const clean = value => String(value || '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
const checks = [], pageResults = [], runtimeErrors = [], previewVisits = [], nativeAssetFailures = [], anchorFailures = [];
const check = (name, pass, details) => checks.push({ name, pass: Boolean(pass), ...(!pass && details !== undefined ? { details } : {}) });
const routes = json('content/routes.json');
const docs = json('content/published-docs-v7.json').documents;
const inventory = [...routes, ...docs.map(doc => doc.path)];
const nativePath = route => 'build/' + route.replace(/^\//, '') + 'index.html';
const routeKey = value => value.endsWith('/') ? value : value + '/';
const previewFile = 'RocoWiki_UI_V7_3.html';
const digestCache = new Map();
let dom;

function filesBelow(relative) {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const next = relative + '/' + entry.name;
    return entry.isDirectory() ? filesBelow(next) : [next];
  });
}
function fileDigest(file) {
  if (!digestCache.has(file)) digestCache.set(file, sha(bytes(file)));
  return digestCache.get(file);
}
function cssUrls(text) {
  return [...text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g)].map(match => (match[1] ?? match[2] ?? match[3]).trim());
}
function cssAsset(file, value) {
  if (/^(?:data:|https?:|\/\/|#)/i.test(value)) return null;
  const pathname = decodeURIComponent(value.split(/[?#]/)[0]);
  return pathname.startsWith('/') ? 'build/' + pathname.slice(1) : path.posix.normalize(path.posix.dirname(file) + '/' + pathname);
}
function cssRules(text) {
  return [...text.matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }));
}
function sceneRules(rules, section) {
  return rules.filter(rule => rule.selector.includes('data-header-kind') && new RegExp('data-header-kind\\s*=\\s*["\']?' + section + '["\']?\\s*\\]').test(rule.selector) && /--rw-section-scene\s*:/.test(rule.body));
}

async function main() {
  const brokenRoutes = [], badDocumentEditors = [], anchorLinks = [], nativeTextareas = [], nativeFeatureChecks = [];
  const anchors = new Map();
  let headingCount = 0, nativeEntityChips = 0, inspectedLinks = 0, nativeAssetCount = 0;
  for (const route of inventory) {
    const file = nativePath(route);
    if (!fs.existsSync(path.join(root, file))) { pageResults.push({ route, exists: false }); continue; }
    const local = new JSDOM(read(file)), d = local.window.document;
    anchors.set(routeKey(route), new Set([...d.querySelectorAll('[id]')].map(el => el.id)));
    const row = { route, exists: true, sha256: fileDigest(file), h1: clean(d.querySelector('h1')?.textContent),
      header: d.querySelectorAll('.rw-site-header').length, main: Boolean(d.querySelector('main')),
      feedback: d.querySelectorAll('.rw-feedback-trigger').length, footer: d.querySelectorAll('.rw-footer-v73').length,
      maintainers: d.querySelectorAll('.rw-maintainers-v72').length, nativeSelects: d.querySelectorAll('select').length };
    const doc = docs.find(item => item.path === route);
    if (doc) {
      nativeEntityChips += d.querySelectorAll('.theme-doc-markdown .rw-entity-reference').length;
      row.docSheet = Boolean(d.querySelector('.rw-doc-sheet .theme-doc-markdown'));
      for (const heading of d.querySelectorAll('.theme-doc-markdown h2,.theme-doc-markdown h3,.theme-doc-markdown h4')) {
        const link = heading.querySelector('.rw-edit-entry');
        const query = new URL(link?.getAttribute('href') || '/', 'https://wiki.test').searchParams;
        const anchor = (query.get('returnTo') || '').split('#')[1] || '';
        if (!(link && query.get('mode') === 'article' && query.get('entity') === doc.title && d.getElementById(decodeURIComponent(anchor)) === heading)) badDocumentEditors.push({ route, heading: clean(heading.textContent) });
        headingCount++;
      }
      const bottomQuery = new URL(d.querySelector('.theme-edit-this-page')?.getAttribute('href') || '/', 'https://wiki.test').searchParams;
      row.bottomEditor = bottomQuery.get('entity') === doc.title && bottomQuery.get('mode') === 'article' && bottomQuery.get('returnTo') === route;
    }
    for (const link of d.querySelectorAll('a[href]')) {
      const raw = link.getAttribute('href');
      if (!raw || /^(?:mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
      const to = new URL(raw, 'https://wiki.test' + route);
      if (to.origin !== 'https://wiki.test') continue;
      inspectedLinks++;
      const candidate = path.join(root, 'build', decodeURIComponent(to.pathname));
      if (!fs.existsSync(candidate) && !fs.existsSync(path.join(candidate, 'index.html'))) brokenRoutes.push({ from: route, to: to.pathname });
      // Query-specific views and locally created comments are checked through the live preview below.
      if (to.hash && !to.search && inventory.includes(routeKey(to.pathname))) anchorLinks.push({ from: route, path: routeKey(to.pathname), id: decodeURIComponent(to.hash.slice(1)) });
    }
    for (const el of d.querySelectorAll('img[src],script[src],link[rel="stylesheet"][href],link[rel="preload"][href]')) {
      const raw = el.getAttribute(el.tagName === 'LINK' ? 'href' : 'src');
      if (!raw || /^(?:data:|https?:|\/\/|blob:)/i.test(raw)) continue;
      const to = new URL(raw, 'https://wiki.test' + route), asset = 'build/' + decodeURIComponent(to.pathname).slice(1);
      nativeAssetCount++;
      if (!fs.existsSync(path.join(root, asset))) nativeAssetFailures.push({ from: route, asset });
    }
    for (const el of d.querySelectorAll('textarea')) if (!el.closest('.rw-bounded-textarea')) nativeTextareas.push({ route, name: el.getAttribute('aria-label') || el.name || el.id });
    if (route === '/account/') {
      const nav = d.querySelector('.ev7-account-nav'), identity = d.querySelector('.rw-registration-uid-v73');
      nativeFeatureChecks.push({ name: 'Native personal centre contains the activity entry and a separate unassigned registration UID', pass: nav?.textContent.includes('社区足迹') && identity?.textContent.includes('注册序号') && identity?.textContent.includes('待注册') && identity?.dataset.registrationState === 'pending' });
      nativeFeatureChecks.push({ name: 'Native account overview exposes meaningful guide-like, comment-like, contribution and discussion actions', pass: ['攻略被点赞', '评论被点赞', '已发布贡献', '参与讨论'].every(label => [...d.querySelectorAll('.rw-influence-grid-v72 button')].some(el => el.textContent.includes(label))) });
    }
    if (route === '/pve/') {
      const cta = d.querySelector('.rw-pagehead .rw-actions .rw-catalog-create-v73'), to = new URL(cta?.getAttribute('href') || '/', 'https://wiki.test');
      nativeFeatureChecks.push({ name: 'Native PVE heading places the create-gameplay CTA in its primary action area', pass: cta?.textContent.includes('新增玩法') && to.pathname === '/edit/' && to.searchParams.get('mode') === 'pve-guide' && to.searchParams.get('intent') === 'add' });
    }
    pageResults.push(row); local.window.close();
  }
  for (const link of anchorLinks) if (!anchors.get(link.path)?.has(link.id)) anchorFailures.push(link);
  check('Every declared content route has readable native HTML, with a separate 404 page', inventory.length > 0 && new Set(inventory).size === inventory.length && pageResults.every(row => row.exists && row.h1) && fs.existsSync(path.join(root, 'build/404.html')), pageResults.filter(row => !row.exists || !row.h1));
  check('Every native page retains one header, main, footer, feedback entry and maintenance block', pageResults.every(row => row.header === 1 && row.main && row.footer === 1 && row.feedback === 1 && row.maintainers === 1), pageResults.filter(row => row.header !== 1 || !row.main || row.footer !== 1 || row.feedback !== 1 || row.maintainers !== 1));
  check('Native pages use custom selects and bounded textareas throughout', pageResults.every(row => row.nativeSelects === 0) && nativeTextareas.length === 0, { nativeTextareas });
  check('Actual native internal links and referenced page assets resolve', inspectedLinks > 0 && nativeAssetCount > 0 && brokenRoutes.length === 0 && nativeAssetFailures.length === 0, { brokenRoutes: brokenRoutes.slice(0, 20), nativeAssetFailures });
  check('All static cross-page and in-page anchors resolve to emitted destination IDs', anchorLinks.length > 0 && anchorFailures.length === 0, anchorFailures.slice(0, 30));
  check('Every documentation subheading keeps its specific editor and real return anchor', headingCount > 0 && badDocumentEditors.length === 0, { headingCount, badDocumentEditors });
  check('All published Docusaurus documents keep their article sheet and whole-article editor', pageResults.filter(row => row.docSheet).length === docs.length && pageResults.filter(row => row.docSheet).every(row => row.bottomEditor));
  check('Native knowledge documents render typed internal entity references', nativeEntityChips > 0);
  for (const item of nativeFeatureChecks) check(item.name, item.pass);

  const cssFiles = filesBelow('build').filter(file => file.endsWith('.css'));
  const nativeCss = cssFiles.map(file => ({ file, text: read(file) }));
  const cssAssetFailures = [], assetDigests = new Set();
  for (const sheet of nativeCss) for (const value of cssUrls(sheet.text)) {
    const asset = cssAsset(sheet.file, value);
    if (!asset) continue;
    if (!fs.existsSync(path.join(root, asset))) cssAssetFailures.push({ css: sheet.file, asset });
    else assetDigests.add(fileDigest(asset));
  }
  check('Compiled native CSS has no missing local font or image dependencies', cssFiles.length > 0 && cssAssetFailures.length === 0, cssAssetFailures);
  const fontPath = 'static/fonts/roco-wiki-sans-v7.woff2', fontDigest = fileDigest(fontPath);
  const nativeFonts = filesBelow('build/assets/fonts').filter(file => path.basename(file).startsWith('roco-wiki-sans-v7'));
  check('Native static and bundled fonts match the final local Chinese font bytes', nativeFonts.length === 1 && nativeFonts.every(file => fileDigest(file) === fontDigest) && fileDigest('build/fonts/roco-wiki-sans-v7.woff2') === fontDigest && assetDigests.has(fontDigest));
  const scenes = json('content/scene-assets-v73.json').images;
  const expectedSections = ['pets', 'skills', 'bloodlines', 'mechanics', 'events', 'battle', 'pve', 'adventure', 'tools'];
  check('Scene manifest records nine distinct original web-game locations with official forum provenance', scenes.length === expectedSections.length && expectedSections.every(section => scenes.some(scene => scene.section === section)) && new Set(scenes.map(scene => scene.sha256)).size === expectedSections.length && scenes.every(scene => scene.source.startsWith('https://17roco.gamebbs.qq.com/') && scene.url.startsWith('https://dp.gtimg.cn/') && scene.alteration === 'None; original downloaded bytes. CSS mask only.'));
  const sceneResults = scenes.map(scene => {
    const data = bytes('static' + scene.path), native = bytes('build' + scene.path);
    const rules = nativeCss.flatMap(sheet => sceneRules(cssRules(sheet.text), scene.section).map(rule => ({ file: sheet.file, ...rule })));
    const mapped = rules.some(rule => cssUrls(rule.body).some(value => { const asset = cssAsset(rule.file, value); return asset && fs.existsSync(path.join(root, asset)) && fileDigest(asset) === scene.sha256; }));
    return { section: scene.section, original: sha(data) === scene.sha256 && data.length === scene.bytes && data.subarray(1, 4).toString() === 'PNG' && data.readUInt32BE(16) === scene.width && data.readUInt32BE(20) === scene.height, native: sha(native) === scene.sha256, mapped };
  });
  check('All nine original scene bytes, dimensions and native copies match their source manifest', sceneResults.every(row => row.original && row.native), sceneResults);
  check('Every compiled section header CSS rule points to its own verified scene image', sceneResults.every(row => row.mapped), sceneResults);
  const official = json('content/decor-assets-v71.json').assets[0];
  check('Homepage retains the original official background and unchanged source bytes', official.sourceAsset === 'https://res.17roco.qq.com/images/bg.png' && fileDigest('static' + official.path) === official.sha256 && fileDigest('build' + official.path) === official.sha256 && assetDigests.has(official.sha256));
  const compiledCss = nativeCss.map(sheet => sheet.text).join('\n');
  const fadeRules = cssRules(compiledCss).filter(rule => rule.selector.includes('.rw-pagehead-illustrated-v72:before') || rule.selector.includes('.rw-pagehead-illustrated-v72::before'));
  check('Delivered CSS masks the illustration from transparent left to clear right on a white card', fadeRules.some(rule => /background-image:var\(--rw-section-scene/.test(rule.body.replace(/\s+/g, '')) && /mask-image:\s*linear-gradient\((?:to right|90deg),\s*(?:transparent|#0000)(?:\s|,)/.test(rule.body) && /(?:#000|black)\s*92%/.test(rule.body)) && /\.rw-pagehead\.rw-pagehead-illustrated-v72[^{}]*\{[^{}]*background:(?:#fff|white)/.test(compiledCss));
  const s7 = read('src/css/v7.css'), s72 = read('src/css/v72.css'), s73 = read('src/css/v73.css');
  check('Header/footer wordmarks keep Georgia and delivered styles retain rounded layouts and reduced-motion rules', /\.rw-wordmark b\s*\{\s*font-family:\s*Georgia/.test(s7) && /\.rw-footer-v72 \.rw-footer-brand strong[^}]*Georgia/.test(s72) && compiledCss.includes('prefers-reduced-motion') && compiledCss.includes('.rw-footer-v73') && s73.includes('@media(max-width:360px)'));
  const rawTextareaSources = filesBelow('src').filter(file => /\.[jt]sx?$/.test(file) && /<textarea(?:\s|>)/.test(read(file)));
  check('Only BoundedTextarea creates a native textarea; all form entry points use the shared component', JSON.stringify(rawTextareaSources) === JSON.stringify(['src/wiki/BoundedTextarea.jsx']), rawTextareaSources);
  const previewSource = read('src/wiki/editing/PreviewContent.jsx');
  check('Reading frame/content boundaries and app recovery boundaries are connected in both delivery entry points', previewSource.includes('<PreviewBoundary scope={`reading-content:') && previewSource.includes('<PreviewBoundary scope={`reading-frame:') && read('src/theme/Root/index.jsx').includes('WikiRecoveryBoundary') && read('src/wiki/WikiPage.jsx').includes('WikiRecoveryBoundary') && read('preview/main.jsx').includes('WikiRecoveryBoundary'));

  const html = read(previewFile), vc = new VirtualConsole();
  vc.on('jsdomError', error => runtimeErrors.push(String(error.message)));
  vc.on('error', (...args) => runtimeErrors.push(args.map(String).join(' ')));
  dom = new JSDOM(html, { url: 'https://preview.wiki.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = function() { w.__scrolled = this.id; };
    w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
    w.HTMLDialogElement.prototype.close = function() { this.open = false; };
    Object.defineProperty(w.navigator, 'clipboard', { value: { async writeText(value) { w.__clipboard = value; } } });
  } });
  const w = dom.window, d = w.document, pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const unresolvedPreviewAssets = [], unboundedPreviewInputs = [];
  async function until(fn, label) { for (let i = 0; i < 160; i++) { if (fn()) return; await pause(25); } throw new Error('Timed out: ' + label); }
  function auditMounted(route) {
    previewVisits.push(route);
    for (const image of d.querySelectorAll('img[src]')) if (!image.getAttribute('src').startsWith('data:image/')) unresolvedPreviewAssets.push({ route, src: image.getAttribute('src') });
    for (const input of d.querySelectorAll('textarea')) if (!input.closest('.rw-bounded-textarea')) unboundedPreviewInputs.push({ route, name: input.getAttribute('aria-label') || input.id });
  }
  async function navigate(route, heading) {
    const pathname = route.split(/[?#]/)[0], expected = heading || pageResults.find(row => row.route === pathname)?.h1;
    w.location.hash = route;
    await until(() => clean(d.querySelector('h1')?.textContent) === expected, route);
    await pause(90); auditMounted(route);
  }
  function button(selector, label) { const el = [...d.querySelectorAll(selector)].find(item => clean(item.textContent) === label); if (!el) throw new Error('Missing control: ' + label); return el; }
  function input(el, value) { if (!el) throw new Error('Missing input'); const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new w.Event('input', { bubbles: true })); }
  const params = el => new URL((el?.getAttribute('href') || '/').replace(/^#/, ''), 'https://wiki.test').searchParams;
  await until(() => d.querySelector('.rw-v7-welcome'), 'home mount'); await pause(90); auditMounted('/');
  const previewCss = [...d.querySelectorAll('head style')].map(el => el.textContent).join('\n');
  const embeddedDigests = new Set([...html.matchAll(/data:(?:image|font|application)\/[\w.+-]+;base64,([A-Za-z0-9+/=]+)/g)].map(match => sha(Buffer.from(match[1], 'base64'))));
  check('Preview and dist copy are byte-identical and require no external scripts, styles or CSS image/font files', sha(html) === fileDigest('dist/index.html') && !d.querySelector('script[src],link[rel="stylesheet"][href]') && !/@import\s/.test(previewCss) && cssUrls(previewCss).every(value => value.startsWith('data:') || value.startsWith('#')));
  check('Delivered preview embeds every official scene, homepage background and Chinese font unchanged', [...scenes.map(scene => scene.sha256), official.sha256, fontDigest].every(digest => embeddedDigests.has(digest)));
  const embeddedSceneRules = scenes.map(scene => ({ section: scene.section, valid: sceneRules(cssRules(previewCss), scene.section).some(rule => cssUrls(rule.body).some(value => /^data:image\/png;base64,/.test(value) && sha(Buffer.from(value.split(',')[1], 'base64')) === scene.sha256)) }));
  check('Preview CSS maps each landing page to the correct embedded scene bytes', embeddedSceneRules.every(row => row.valid), embeddedSceneRules);
  check('Homepage keeps simultaneous ladder-left/type-right tables and an expiring-activities column', JSON.stringify([...d.querySelectorAll('.rw-v6-competition h3')].map(el => clean(el.textContent))) === JSON.stringify(['天梯赛', '系别排位赛']) && d.querySelector('.rw-v6-event-columns')?.textContent.includes('即将过期'));
  check('Header/footer use the same player-built encyclopedia declaration and footer offers maintenance instead of duplicate account links', d.querySelector('.rw-wordmark small')?.textContent === d.querySelector('.rw-footer-brand > div > span')?.textContent && d.querySelector('.rw-footer-brand > div > span')?.textContent === '洛克王国页游 · 玩家共建百科' && ![...d.querySelectorAll('.rw-footer-v73 a')].some(el => (el.getAttribute('href') || '').startsWith('#/account/')) && Boolean(d.querySelector('.rw-footer-v73 a[href="#/help/contributing/"]')));
  button('.rw-footer-v73 button', '反馈本页问题').click(); await until(() => d.querySelector('.rw-feedback-dialog')?.open, 'footer contextual feedback');
  check('The delivered footer opens contextual feedback with the bounded editor', Boolean(d.querySelector('.rw-feedback-dialog textarea')?.closest('.rw-bounded-textarea')) && d.querySelector('.rw-feedback-context')?.textContent.includes('/'));
  d.querySelector('[aria-label="关闭反馈"]').click(); await pause(40);
  const illustrated = [];
  for (const section of expectedSections) {
    await navigate('/' + section + '/');
    illustrated.push({ section, kind: d.querySelector('.rw-pagehead-illustrated-v72')?.dataset.headerKind });
  }
  check('All nine section landing pages mount their specific illustrated header', illustrated.every(row => row.kind === row.section), illustrated);
  await navigate('/pets/');
  check('Pet catalogue exposes add-pet without an edit-directory action', [...d.querySelectorAll('.rw-edit-entry')].some(el => el.textContent.includes('新增宠物') && params(el).get('intent') === 'add') && !d.body.textContent.includes('编辑目录'));
  await navigate('/pets/haifu/');
  check('Pet page exposes a real guardian level input and shared calculation history', d.querySelector('input[aria-label="简易能力 · 守护兽等级"]')?.type === 'number' && d.querySelector('.rw-pet-mini-result .stat-hp strong')?.textContent === '465' && Boolean(d.querySelector('.rw-calculation-records-v73')));
  const originalSpeed = d.querySelector('.rw-pet-mini-result .stat-speed strong')?.textContent;
  input(d.querySelector('input[aria-label="简易能力 · 守护兽等级"]'), '5'); await pause(60);
  check('Guardian level five uses the verified +7 mapping and preserves speed', d.querySelector('.rw-pet-mini-result .stat-hp strong')?.textContent === '472' && d.querySelector('.rw-pet-mini-result .stat-speed strong')?.textContent === originalSpeed && !d.querySelector('.rw-pet-mini-result .stat-speed small')?.textContent.includes('守护'));
  input(d.querySelector('input[aria-label="计算记录名称"]'), 'V7.3 守护兽 5 级'); await pause(30);
  button('.rw-calculation-save-v73 button', '保存本次计算').click(); await until(() => d.querySelector('.rw-calculation-record-list-v73 article'), 'first calculation record');
  input(d.querySelector('input[aria-label="简易能力 · 守护兽等级"]'), '40'); await pause(40);
  input(d.querySelector('input[aria-label="计算记录名称"]'), 'V7.3 守护兽 40 级'); await pause(30);
  button('.rw-calculation-save-v73 button', '保存本次计算').click(); await until(() => d.querySelector('.rw-calculation-compare-v73'), 'calculation comparison');
  const comparisonRows = [...d.querySelectorAll('[aria-label="六项能力对比表"] tbody tr')];
  check('Saving two real configurations produces a persisted, same-pet six-stat comparison', JSON.parse(w.localStorage.getItem('roco-wiki:stats-snapshots:v1')).records.length === 2 && d.querySelector('.rw-comparison-context-v73')?.textContent.includes('同一宠物') && comparisonRows[0]?.lastElementChild.textContent === '+43' && comparisonRows.at(-1)?.lastElementChild.textContent === '0' && d.querySelector('[aria-label="培养参数对比表"]')?.textContent.includes('性格'));
  const fullLink = d.querySelector('.rw-pet-mini-heading > a'), shared = JSON.parse(params(fullLink).get('calc'));
  check('The complete calculator link carries the pet identity and current guardian level', shared.pet === 'haifu' && shared.guardianLevel === '40');
  fullLink.click(); await until(() => d.querySelector('input[aria-label="守护兽等级"]')?.value === '40', 'shared full calculator'); auditMounted('/tools/stats/?calc=shared');
  await until(() => d.querySelector('.rw-calculation-record-list-v73')?.textContent.includes('V7.3 守护兽 40 级'), 'full calculator history hydration');
  check('The full calculator reads the same saved history and imported cultivation', Boolean(d.querySelector('.rw-calculation-records-v73')) && d.querySelector('.rw-calculation-record-list-v73')?.textContent.includes('V7.3 守护兽 40 级'));
  await navigate('/skills/');
  check('Skill search retains custom sorting, a description column and detail-only editing', Boolean(d.querySelector('.rw-skill-sort-v72 [role="combobox"]')) && [...d.querySelectorAll('thead th')].at(-1)?.textContent === '技能描述' && !d.querySelector('tbody .rw-edit-entry'));
  await navigate('/skills/xiazi/?pet=haifu');
  check('Skill detail presents compact learner cards with real links and a focused relationship editor', Boolean(d.querySelector('.rw-learner-grid-v73 .rw-learner-main-v73[href]')) && Boolean(d.querySelector('input[aria-label="搜索学习宠物"]')) && [...d.querySelectorAll('#owners .rw-edit-entry')].some(el => params(el).get('record') === 'learners'));
  button('.rw-flow-directions-v73 button', '横向').click(); await pause(60);
  const flow = d.querySelector('[data-skill-flow="components"]');
  check('Skill flow accepts an independent horizontal reading preference', flow?.dataset.flowPreference === 'horizontal' && button('.rw-flow-directions-v73 button', '横向').getAttribute('aria-pressed') === 'true');
  w.__clipboard = null; d.querySelector('.rw-flow-copy-button').click(); await until(() => w.__clipboard, 'Mermaid export');
  check('Mermaid exports the graph in the actual displayed direction', w.__clipboard.startsWith('flowchart ' + (flow.dataset.flowDirection === 'horizontal' ? 'LR' : 'TD')) && w.__clipboard.includes('-->') && !w.__clipboard.includes('undefined'));
  await navigate('/pve/');
  const addPve = d.querySelector('.rw-pagehead .rw-catalog-create-v73');
  check('The delivered PVE primary CTA enters the add-gameplay form', params(addPve).get('mode') === 'pve-guide' && params(addPve).get('intent') === 'add');
  await navigate('/pve/shanhai/');
  check('Shanhai summon remains a reward activity rather than a PVE challenge entry', Boolean(d.querySelector('#shanhai-summon[data-pve-reward-activity]')) && ![...d.querySelectorAll('.pv71-nav a,.pv71-section-nav a')].some(el => el.textContent.includes('山海召唤')));
  await navigate('/account/');
  const activities = [['攻略被点赞', 'guideLikes'], ['评论被点赞', 'commentLikes'], ['已发布贡献', 'contributions'], ['参与讨论', 'comments']];
  const activityResults = [];
  for (const [label, view] of activities) {
    await navigate('/account/');
    const metric = [...d.querySelectorAll('.rw-influence-grid-v72 button')].find(el => el.textContent.includes(label));
    metric?.click(); await until(() => d.querySelector('.rw-community-activity-v73')?.dataset.activityView === view, 'metric destination ' + view);
    const to = new URL(w.location.hash.slice(1), 'https://wiki.test');
    activityResults.push({ view, path: to.pathname, tab: to.searchParams.get('tab'), selected: to.searchParams.get('view'), heading: d.querySelector('.rw-activity-records-heading-v73 h3')?.textContent, action: Boolean(d.querySelector('.rw-activity-empty-v73 a[href]')) });
    auditMounted(to.pathname + to.search);
  }
  check('Every influence metric opens its matching activity records and useful empty-state action', activityResults.every((row, i) => row.path === '/account/' && row.tab === 'activity' && row.selected === activities[i][1] && row.heading === activities[i][0] && row.action), activityResults);
  await navigate('/account/?tab=profile');
  await until(() => /^[a-f0-9-]{36}$/i.test(d.querySelector('#rw-profile-uuid')?.value || ''), 'profile UUID');
  const uuid = d.querySelector('#rw-profile-uuid').value;
  check('Profile keeps the persisted UUID separate from the server-assigned registration order', JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')).profile.uuid === uuid && d.querySelector('.rw-registration-profile-v73')?.textContent.includes('服务器') && d.querySelector('.rw-registration-uid-v73')?.dataset.registrationState === 'pending' && d.querySelector('#rw-profile-uuid').readOnly);
  await navigate('/account/?tab=honors&view=checkin');
  await until(() => d.querySelector('.rw-checkin-button-v72:not(:disabled)'), 'available check-in');
  check('Check-in defaults to a month calendar and keeps week view directly accessible', d.querySelector('[data-calendar-view="month"]') && Boolean(button('.rw-calendar-views-v73 button', '周视图')) && d.querySelector('.rw-calendar-summary-v73')?.textContent.includes('跨周、跨月'));
  d.querySelector('.rw-checkin-button-v72').click(); await until(() => d.querySelector('.rw-checkin-reward-v73'), 'random check-in result');
  const amount = Number(d.querySelector('.rw-checkin-reward-v73')?.textContent.match(/\d+/)?.[0]);
  check('A real first check-in records a random 3–7 reward and prevents repeat claims', Number.isInteger(amount) && amount >= 3 && amount <= 7 && d.querySelector('.rw-checkin-button-v72')?.disabled && d.querySelector('.rw-ledger-table-v72')?.textContent.includes('+' + amount), { amount });
  button('.rw-calendar-views-v73 button', '周视图').click(); await until(() => d.querySelector('[data-calendar-view="week"]'), 'check-in week view');
  check('Week switching preserves the signed day and actual reward without resetting the streak', d.querySelector('.rw-calendar-days-v73 .is-checked')?.textContent.includes('+' + amount) && d.querySelector('.rw-checkin-button-v72')?.disabled);
  await navigate('/guides/returning/');
  d.querySelector('.rw-page-discussion-v72').open = true;
  const comment = 'V7.3 讨论回环：[海芙约忒](/pets/haifu/) 的技能和培养记录可以继续核对。';
  input(d.querySelector('textarea[aria-label="本页评论"]'), comment); await pause(45);
  d.querySelector('.rw-discussion-body-v72 form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => d.querySelector('.rw-comments-v72 > li'), 'local comment publication');
  const commentId = d.querySelector('.rw-comments-v72 > li').id;
  check('Published local comments render typed pet references and protect against self-likes', Boolean(d.querySelector('.rw-comments-v72 .rw-entity-reference[data-entity-kind="宠物"] img')) && Boolean(d.querySelector('.rw-comments-v72 .rw-entity-reference-arrow')) && d.querySelector('.rw-comments-v72 button')?.disabled);
  await navigate('/account/?tab=activity&view=comments');
  await until(() => d.querySelector('.rw-activity-records-v73 [data-activity-record]'), 'my discussion activity');
  const commentLink = [...d.querySelectorAll('.rw-activity-records-v73 a')].find(el => clean(el.textContent) === '回到这条讨论');
  check('Discussion activity shows the saved comment and links to its actual comment anchor', d.querySelector('.rw-activity-records-v73')?.textContent.includes('V7.3 讨论回环') && commentLink?.getAttribute('href')?.endsWith('#' + commentId));
  commentLink.click(); await until(() => d.getElementById(commentId) && d.querySelector('.rw-page-discussion-v72')?.open, 'activity return to exact comment');
  check('Following discussion history returns to an open, anchored discussion on the original page', w.location.hash.endsWith('#' + commentId) && d.querySelectorAll('.rw-maintainers-v72').length === 1);

  const doc = docs.find(item => item.path === '/guides/returning/');
  const request = { entity: doc.title, section: doc.sections[0].title, mode: 'article', returnTo: doc.path + '#section-1', intent: 'edit' };
  const marker = 'V7.3 交付读回：先核对宠物条目的血脉列表。';
  const markdown = marker + '\n\n[海芙约忒](/pets/haifu/)\n\n[培养资料](./training.md)';
  const workspace = JSON.parse(w.localStorage.getItem('roco-wiki-v4:community'));
  workspace.submissions = [...(workspace.submissions || []), { id: 'v73-integration-document', status: 'published', editorVersion: 7, editorMode: 'article', editorRequest: request, target: doc.title, section: request.section, authorId: uuid, author: '资料维护验收员', avatar: 'dimo', typedData: { markdown }, before: doc.sections[0].markdown, after: markdown, updatedAt: new Date(Date.now() - 1000).toISOString(), snapshotKey: [doc.title, request.section, 'article', 'all', 'existing'].join('::') }];
  w.localStorage.setItem('roco-wiki-v4:community', JSON.stringify(workspace)); w.dispatchEvent(new w.Event('roco:community-updated'));
  await until(() => d.body.textContent.includes(marker) && d.querySelector('.rw-maintainers-list-v72'), 'published section and maintainer');
  check('A locally published article revision is readable and credits its identified maintainer', d.body.textContent.includes('第二步：看当前还能获得什么') && d.querySelector('.rw-maintainers-list-v72')?.textContent.includes('资料维护验收员'));
  await navigate('/account/?tab=activity&view=contributions');
  await until(() => d.querySelector('.rw-activity-records-v73 [data-activity-record]'), 'published contribution history');
  check('Contribution activity leads back to both the revised section and its review record', [...d.querySelectorAll('.rw-activity-records-v73 a')].some(el => el.getAttribute('href') === '#/guides/returning/#section-1') && [...d.querySelectorAll('.rw-activity-records-v73 a')].some(el => el.getAttribute('href') === '#/review/?submission=v73-integration-document'));
  await navigate('/guides/returning/');
  d.querySelector('.rw-reading-markdown h2 .rw-edit-entry').click();
  await until(() => d.querySelector('.ev7-root'), 'article editor'); await pause(160); auditMounted('/edit/?mode=article');
  const articleInput = [...d.querySelectorAll('textarea')].find(el => el.value.includes(marker));
  check('A section editor reopens the published text in a bounded input', Boolean(articleInput?.closest('.rw-bounded-textarea')));
  const draftMarker = '这段尚未提交，返回时应保存在草稿。';
  input(articleInput, markdown + '\n\n' + draftMarker); await pause(65);
  button('.ev7-toolbar button', '预览效果').click();
  await until(() => d.querySelector('.ev71-preview-iframe')?.contentDocument?.querySelector('[data-readonly-preview="true"]'), 'actual delivered reading iframe');
  const frame = d.querySelector('.ev71-preview-iframe'), inside = frame.contentDocument;
  check('The delivered reading frame displays unsaved content through the sandboxed readonly preview', inside.body.textContent.includes(draftMarker) && Boolean(inside.querySelector('.rw-entity-reference[data-entity-kind="宠物"]')) && !inside.querySelector('.rw-edit-entry') && frame.getAttribute('sandbox') === 'allow-same-origin' && !d.querySelector('.rw-local-render-error-v73,.rw-recovery-v73'));
  const returnControl = [...d.querySelectorAll('.ev7-root button')].filter(el => clean(el.textContent).includes('返回原页')).at(-1);
  check('The editor keeps a bottom return action beside its work controls', Boolean(returnControl));
  returnControl.click(); await until(() => w.location.hash.startsWith('#/guides/returning/') && clean(d.querySelector('h1')?.textContent) === doc.title, 'bottom editor return');
  check('Returning preserves an unpublished draft and leaves the published page intact', (JSON.parse(w.localStorage.getItem('roco-wiki-v4:community')).drafts || []).some(row => row.typedData?.markdown?.includes(draftMarker)) && !d.body.textContent.includes(draftMarker));
  check('Every image mounted during the final preview journey is embedded and all textareas stay in the shared component', unresolvedPreviewAssets.length === 0 && unboundedPreviewInputs.length === 0, { unresolvedPreviewAssets, unboundedPreviewInputs });
  check('The exact delivered preview completes the journey without React, uncaught JavaScript or recovery fallback errors', runtimeErrors.filter(error => !error.includes('Could not parse CSS stylesheet')).length === 0 && !d.querySelector('.rw-recovery-v73,.rw-local-render-error-v73'), runtimeErrors.slice(0, 10));
  dom.window.close(); dom = null;
}

main().catch(error => check('Integration runner completed', false, String(error.stack || error))).finally(() => {
  if (dom) dom.window.close();
  const tracked = [
    ...filesBelow('src').filter(file => /\.(?:[jt]sx?|css)$/.test(file)),
    'content/routes.json', 'content/published-docs-v7.json', 'content/scene-assets-v73.json', 'content/decor-assets-v71.json',
    'content/pet-appearances-v72.json', 'content/calculator-mappings-v73.json', 'content/community-ecology-v73.json',
    'preview/main.jsx', 'preview/router.jsx', 'preview/generated-docs.json', 'scripts/build-preview.mjs',
    'docusaurus.config.js', 'package.json', 'validation/check-v73-integration.cjs',
  ];
  const report = { version: '7.3', scope: 'Actual native HTML routes, static anchors and referenced assets; byte-level official scene/font integrity and compiled CSS mapping; exact self-contained preview executed in JSDOM. Query-specific activity links and saved-comment anchors are exercised interactively. No browser geometry, screenshots, frame rate, current game client or remote-service validation. Iframe lifecycle fault injection is in the focused V7.3 suites.',
    checkedAt: new Date().toISOString(), passed: checks.filter(item => item.pass).length, failed: checks.filter(item => !item.pass).length,
    routeCount: inventory.length, documentCount: docs.length, checks, pageResults, previewVisits, runtimeErrors,
    previewSha256: fs.existsSync(path.join(root, previewFile)) ? sha(bytes(previewFile)) : null,
    sourceHashes: Object.fromEntries([...new Set(tracked)].sort().map(file => [file, sha(bytes(file))])),
    nativeCssHashes: Object.fromEntries(fs.existsSync(path.join(root, 'build')) ? filesBelow('build').filter(file => file.endsWith('.css')).map(file => [file, fileDigest(file)]) : []),
  };
  fs.writeFileSync(path.join(__dirname, 'v73-integration-check-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, routes: inventory.length, failures: checks.filter(item => !item.pass) }));
  process.exitCode = report.failed ? 1 : 0;
});
