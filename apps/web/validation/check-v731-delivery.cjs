/** Focused V7.3.1 delivery gates only: welcome artwork, directories, PVE CTA and flow relationships.
 * Executes the delivered preview, without rebuilding it. JSDOM gets one mocked flow width
 * to enter the horizontal layout; this is not browser geometry or lifecycle validation.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const bytes = file => fs.readFileSync(path.join(root, file));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const clean = value => String(value || '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
const check = (name, pass, details) => checks.push({ name, pass: Boolean(pass), ...(!pass ? { details } : {}) });
const checks = [], errors = [], nativePages = [], searchResults = [], graphResults = [];
const previewFile = 'RocoWiki_UI_V7_3_1.html';
const directories = [
  { path: '/places/', kind: 'places', heading: '地图与地区', search: '搜索地区和子场景', term: '教学楼', result: '/places/academy/', mode: 'index' },
  { path: '/npcs/', kind: 'npcs', heading: '人物与NPC', search: '搜索人物', term: '格里芬', result: '/npcs/griffin/', mode: 'npc' },
  { path: '/tasks/', kind: 'tasks', heading: '任务与剧情', search: null, term: '徽章', result: '/tasks/badges/', mode: 'index' },
  { path: '/items/', kind: 'items', heading: '道具与物品', search: '搜索道具', term: 'HP', result: '/items/potion/', mode: 'index' },
];
const routes = ['/', '/adventure/', '/pve/', ...directories.map(row => row.path), '/skills/xiazi/', '/skills/tianhe/'];
let dom, normalCtaContrast = null, welcomePositions = null;

function filesBelow(relative) {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const next = relative + '/' + entry.name;
    return entry.isDirectory() ? filesBelow(next) : [next];
  });
}
function urlsInCss(css) {
  return [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g)].map(row => (row[1] ?? row[2] ?? row[3]).trim());
}
function internalUrl(raw, current = '/') { return new URL((raw || '/').replace(/^#(?=\/)/, ''), 'https://wiki.test' + current); }
function nativeFile(route) { return 'build/' + route.replace(/^\//, '') + 'index.html'; }
function hasFile(url) {
  const candidate = path.join(root, 'build', decodeURIComponent(url.pathname));
  return fs.existsSync(candidate) || fs.existsSync(path.join(candidate, 'index.html'));
}
function addedEntries(d, route) {
  return [...d.querySelectorAll('.rw-edit-entry[href]')].filter(el => {
    const to = internalUrl(el.getAttribute('href'), route);
    return to.pathname === '/edit/' && to.searchParams.get('intent') === 'add';
  });
}
function numericColor(value) {
  const short = /^#([0-9a-f]{3})$/i.exec(value), long = /^#([0-9a-f]{6})$/i.exec(value);
  if (short) return short[1].split('').map(part => parseInt(part + part, 16));
  if (long) return [0, 2, 4].map(offset => parseInt(long[1].slice(offset, offset + 2), 16));
  const rgb = /^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)$/.exec(value);
  return rgb && (rgb[4] === undefined || Number(rgb[4]) === 1) ? rgb.slice(1, 4).map(Number) : null;
}
function contrast(a, b) {
  const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  if (!a || !b) return null;
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + .05) / (dark + .05);
}
function mermaidRelations(source) {
  const decode = value => value.replace(/#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  const nodes = [...source.matchAll(/^\s*(n\d+)(\[|\{)"([^\n]*)"(?:\]|\})\s*$/gm)].map(row => ({ id: row[1], decision: row[2] === '{', label: decode(row[3]) }));
  const edges = [...source.matchAll(/^\s*(n\d+) -->\s*(?:\|"([^\n]*?)"\|)?\s*(n\d+)\s*$/gm)].map(row => ({ from: row[1], to: row[3], label: decode(row[2] || '') }));
  return { nodes, edges };
}
const edgeKey = row => [row.from, row.to, row.label].join(' → ');

async function main() {
  const broken = [], missingAssets = [], nativeDirectories = [];
  for (const route of routes) {
    const file = nativeFile(route);
    if (!fs.existsSync(path.join(root, file))) { nativePages.push({ route, exists: false }); continue; }
    const local = new JSDOM(read(file)), d = local.window.document;
    const row = { route, exists: true, title: clean(d.querySelector('h1')?.textContent), sha256: sha(bytes(file)) };
    for (const link of d.querySelectorAll('a[href]')) {
      const raw = link.getAttribute('href');
      if (!raw || /^(mailto:|tel:|javascript:)/.test(raw)) continue;
      const to = internalUrl(raw, route);
      if (to.origin === 'https://wiki.test' && !hasFile(to)) broken.push({ from: route, to: to.pathname });
    }
    for (const el of d.querySelectorAll('img[src],script[src],link[rel="stylesheet"][href]')) {
      const value = el.getAttribute(el.tagName === 'LINK' ? 'href' : 'src');
      if (!value || /^(data:|https?:|\/\/)/.test(value)) continue;
      const to = internalUrl(value, route);
      if (!hasFile(to)) missingAssets.push({ from: route, asset: to.pathname });
    }
    const directory = directories.find(item => item.path === route);
    if (directory) {
      const panel = d.querySelector(`.rw-directory[data-directory="${directory.kind}"]`), additions = addedEntries(d, route);
      const query = internalUrl(additions[0]?.getAttribute('href'), route).searchParams;
      nativeDirectories.push({ route, title: row.title === directory.heading, panel: Boolean(panel), search: !directory.search || Boolean(panel?.querySelector(`form.rw-directory-search input[aria-label="${directory.search}"]`)),
        add: additions.length === 1 && Boolean(additions[0]?.closest('.rw-pagehead')) && query.get('mode') === directory.mode && query.get('returnTo') === route,
        resultLink: Boolean(panel?.querySelector(`a[href="${directory.result}"]`)) });
    }
    if (route === '/') row.welcome = Boolean(d.querySelector('.rw-v7-welcome > .rw-welcome-scene[aria-hidden="true"]'));
    if (route === '/pve/') {
      const cta = d.querySelector('.rw-pagehead .rw-edit-entry-primary.rw-catalog-create-v73'), to = internalUrl(cta?.getAttribute('href'));
      row.primaryCta = cta?.textContent.includes('新增玩法') && to.pathname === '/edit/' && to.searchParams.get('mode') === 'pve-guide' && to.searchParams.get('intent') === 'add';
    }
    nativePages.push(row); local.window.close();
  }
  check('All affected native pages retain readable headings and their real local routes/assets', nativePages.every(row => row.exists && row.title) && broken.length === 0 && missingAssets.length === 0, { broken, missingAssets, pages: nativePages.filter(row => !row.exists || !row.title) });
  check('The four native adventure directories include their shared panel, searchable content and one contextual create action', nativeDirectories.length === directories.length && nativeDirectories.every(row => row.title && row.panel && row.search && row.add && row.resultLink), nativeDirectories);
  check('Native homepage uses the dedicated decorative layer and PVE renders its primary create CTA', nativePages.find(row => row.route === '/')?.welcome && nativePages.find(row => row.route === '/pve/')?.primaryCta);

  const nativeCssFiles = filesBelow('build/assets/css').filter(file => file.endsWith('.css'));
  const cssAssetErrors = [], nativeCss = nativeCssFiles.map(file => ({ file, text: read(file) }));
  for (const sheet of nativeCss) for (const value of urlsInCss(sheet.text)) {
    if (/^(data:|https?:|\/\/|#)/.test(value)) continue;
    const asset = value.startsWith('/') ? 'build' + value.split(/[?#]/)[0] : path.posix.normalize(path.posix.dirname(sheet.file) + '/' + value.split(/[?#]/)[0]);
    if (!fs.existsSync(path.join(root, asset))) cssAssetErrors.push({ css: sheet.file, asset });
  }
  check('The affected pages compiled stylesheet has no missing local image/font files', nativeCss.length > 0 && cssAssetErrors.length === 0, cssAssetErrors);
  const official = JSON.parse(read('content/decor-assets-v71.json')).assets[0];
  const original = bytes('static' + official.path), nativeArt = bytes('build' + official.path);
  check('Homepage keeps the exact official 2000×2070 PNG in both source and native delivery', sha(original) === official.sha256 && sha(nativeArt) === official.sha256 && original.readUInt32BE(16) === 2000 && original.readUInt32BE(20) === 2070);

  const html = read(previewFile), vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(String(error.message)));
  vc.on('error', (...values) => errors.push(values.map(String).join(' ')));
  dom = new JSDOM(html, { url: 'https://preview.wiki.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
    w.HTMLDialogElement.prototype.close = function() { this.open = false; };
    const originalRect = w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect = function() {
      return this.classList.contains('rw-skill-effect-flow') ? { x: 0, y: 0, left: 0, top: 0, right: 1100, bottom: 700, width: 1100, height: 700 } : originalRect.call(this);
    };
    Object.defineProperty(w.navigator, 'clipboard', { value: { async writeText(value) { w.__copiedMermaid = value; } } });
  } });
  const w = dom.window, d = w.document, pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(fn, label) { for (let attempt = 0; attempt < 140; attempt++) { if (fn()) return; await pause(25); } throw new Error('Timed out: ' + label); }
  const current = () => internalUrl(w.location.hash.slice(1) || '/');
  async function navigate(route) {
    const heading = nativePages.find(row => row.route === route.split('?')[0])?.title;
    w.location.hash = route;
    await until(() => clean(d.querySelector('h1')?.textContent) === heading, route); await pause(90);
  }
  function button(selector, label) { const el = [...d.querySelectorAll(selector)].find(item => clean(item.textContent) === label); if (!el) throw new Error('Missing button: ' + label); return el; }
  function input(el, value) { if (!el) throw new Error('Missing input'); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new w.Event('input', { bubbles: true })); }
  await until(() => d.querySelector('.rw-welcome-scene'), 'welcome backdrop mount'); await pause(90);
  const previewCss = [...d.querySelectorAll('head style')].map(el => el.textContent).join('\n');
  const backgrounds = [...previewCss.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map(match => sha(Buffer.from(match[1], 'base64')));
  check('The exact preview embeds the unchanged official homepage artwork and has no external style/script dependencies', backgrounds.includes(official.sha256) && !d.querySelector('script[src],link[rel="stylesheet"][href]') && urlsInCss(previewCss).every(value => /^(data:|#)/.test(value)) && sha(html) === sha(bytes('dist/index.html')));
  welcomePositions = Object.fromEntries([
    ['backdrop', '.rw-welcome-scene'], ['copy', '.rw-v7-welcome-copy'], ['petArt', '.rw-v7-welcome-art'], ['sourceCredit', '.rw-welcome-source-v71'],
  ].map(([name, selector]) => [name, w.getComputedStyle(d.querySelector('.rw-v7-welcome ' + selector)).position]));
  check('Effective welcome CSS keeps the picture/credit outside document flow and the copy above the background', welcomePositions.backdrop === 'absolute' && welcomePositions.copy === 'relative' && welcomePositions.petArt === 'absolute' && welcomePositions.sourceCredit === 'absolute' && w.getComputedStyle(d.querySelector('.rw-welcome-scene')).zIndex === '0', welcomePositions);
  const backdropStyle = w.getComputedStyle(d.querySelector('.rw-welcome-scene'));
  const leftTransparent = /linear-gradient\((?:to right|90deg),\s*(?:transparent|#0000|rgba\(0,\s*0,\s*0,\s*0\))/.test(backdropStyle.maskImage || backdropStyle.getPropertyValue('-webkit-mask-image'));
  // JSDOM keeps variable-bearing background shorthands intact instead of expanding longhands.
  const rightAligned = backdropStyle.backgroundPosition.startsWith('right') || /(?:^|\s)(?:right top|100% 0)\s*\//.test(backdropStyle.background);
  check('The displayed welcome layer carries its own left-transparent mask and right-aligned image', leftTransparent && rightAligned);

  for (const directory of directories) {
    await navigate(directory.path);
    const panel = () => d.querySelector(`.rw-directory[data-directory="${directory.kind}"]`);
    const result = () => panel()?.querySelector(`a[href="#${directory.result}"]`);
    if (!directory.search) {
      const story = [...panel().querySelectorAll('a[href]')].find(el => internalUrl(el.getAttribute('href')).searchParams.get('view') === 'story');
      story?.click(); await until(() => current().searchParams.get('view') === 'story', 'task category'); await pause(50);
      check('Task directory category links show the selected category without inventing uncollected tasks', !result() && Boolean(d.querySelector('.rw-empty')) && current().pathname === '/tasks/');
      searchResults.push({ directory: directory.kind, categoryNavigation: true });
      continue;
    }
    const field = () => panel()?.querySelector(`input[aria-label="${directory.search}"]`);
    async function search(term) {
      input(field(), term); await pause(30);
      panel().querySelector('form.rw-directory-search').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      await until(() => current().searchParams.get('q') === term, directory.kind + ' search URL'); await pause(65);
    }
    await search(directory.term); const matched = Boolean(result());
    await search('无匹配_731_核对'); const removed = !result();
    panel().querySelector('button[aria-label="清空搜索"]').click();
    await until(() => !current().searchParams.has('q') && result(), directory.kind + ' clear');
    const cleared = field().value === '' && Boolean(result()) && d.activeElement === field();
    searchResults.push({ directory: directory.kind, matched, removed, cleared });
    check(directory.heading + ': submitting filters actual records, and clear restores the catalogue, URL and input focus', matched && removed && cleared, searchResults.at(-1));
  }
  await navigate('/pve/');
  const cta = d.querySelector('.rw-pagehead .rw-edit-entry-primary.rw-catalog-create-v73'), ctaStyle = w.getComputedStyle(cta);
  normalCtaContrast = { foreground: ctaStyle.color, background: ctaStyle.backgroundColor, ratio: contrast(numericColor(ctaStyle.color), numericColor(ctaStyle.backgroundColor)) };
  check('The rendered PVE create action uses readable white text with at least 4.5:1 contrast', numericColor(ctaStyle.color)?.every(value => value === 255) && normalCtaContrast.ratio >= 4.5 && w.getComputedStyle(cta.querySelector('span')).color === ctaStyle.color, normalCtaContrast);
  cta.click(); await until(() => d.querySelector('.ev7-root .ev7-mode-pill'), 'PVE create form');
  check('Clicking the PVE primary action enters the dedicated add-gameplay editor', current().pathname === '/edit/' && current().searchParams.get('mode') === 'pve-guide' && current().searchParams.get('intent') === 'add' && d.querySelector('.ev7-mode-pill')?.textContent.includes('玩法'));

  for (const [route, falseBranch] of [['/skills/xiazi/', false], ['/skills/tianhe/', true]]) {
    await navigate(route);
    button('.rw-flow-directions-v73 button', '横向').click();
    await until(() => d.querySelector('[data-flow-graph="tree"]') && d.querySelector('[data-skill-flow="components"]')?.dataset.flowDirection === 'horizontal', route + ' horizontal graph');
    w.__copiedMermaid = null; d.querySelector('.rw-flow-copy-button').click(); await until(() => w.__copiedMermaid, route + ' Mermaid');
    const graph = mermaidRelations(w.__copiedMermaid), nodeIds = [...d.querySelectorAll('[data-flow-graph="tree"] [data-flow-node-id]')].map(el => el.dataset.flowNodeId);
    const edgeElements = [...d.querySelectorAll('[data-flow-graph="tree"] [data-flow-edge-from][data-flow-edge-to]')];
    const edges = edgeElements.map(el => ({ from: el.dataset.flowEdgeFrom, to: el.dataset.flowEdgeTo, label: el.dataset.flowEdgeLabel || '' }));
    const connectionsPlaced = edgeElements.every(el => el.parentElement.dataset.flowChildId === el.dataset.flowEdgeTo && el.nextElementSibling?.dataset.flowSubtreeRoot === el.dataset.flowEdgeTo && el.parentElement.parentElement.dataset.flowParentId === el.dataset.flowEdgeFrom);
    const sameNodes = JSON.stringify([...nodeIds].sort()) === JSON.stringify(graph.nodes.map(node => node.id).sort());
    const sameEdges = JSON.stringify(edges.map(edgeKey).sort()) === JSON.stringify(graph.edges.map(edgeKey).sort());
    const decisionIds = graph.nodes.filter(node => node.decision).map(node => node.id);
    const relationship = falseBranch
      ? decisionIds.some(id => edges.some(edge => edge.from === id && edge.label === '成立') && edges.some(edge => edge.from === id && edge.label === '不成立'))
      : decisionIds.length > 1 && new Set(decisionIds.map(id => edges.find(edge => edge.to === id)?.from)).size === 1;
    graphResults.push({ route, nodes: nodeIds.length, edges: edges.length, sameNodes, sameEdges, connectionsPlaced, relationship });
    check(route + ': horizontal nodes and every labelled edge agree with LR Mermaid and connect the matching subtrees', w.__copiedMermaid.startsWith('flowchart LR') && sameNodes && sameEdges && connectionsPlaced && relationship && new Set(nodeIds).size === nodeIds.length, graphResults.at(-1));
    button('.rw-flow-directions-v73 button', '纵向').click();
    await until(() => d.querySelector('[data-skill-flow="components"]')?.dataset.flowDirection === 'vertical', route + ' vertical');
    w.__copiedMermaid = null; d.querySelector('.rw-flow-copy-button').click(); await until(() => w.__copiedMermaid, route + ' vertical Mermaid');
    const vertical = mermaidRelations(w.__copiedMermaid);
    check(route + ': returning to vertical changes reading direction while keeping all graph relationships', w.__copiedMermaid.startsWith('flowchart TD') && JSON.stringify(vertical.edges.map(edgeKey).sort()) === JSON.stringify(graph.edges.map(edgeKey).sort()) && !d.querySelector('[data-flow-graph="tree"]'));
  }
  check('The focused delivered-page journey completes without React or uncaught JavaScript errors', errors.length === 0, errors);
  dom.window.close(); dom = null;
}

main().catch(error => check('Focused delivery runner completed', false, String(error.stack || error))).finally(() => {
  if (dom) dom.window.close();
  const tracked = ['src/wiki/WelcomeBackdrop.jsx', 'src/wiki/WelcomeBackdrop.css', 'src/wiki/HomePage.jsx', 'src/css/v72.css', 'src/css/v73.css', 'src/css/custom.css', 'src/wiki/DirectoryPanel.jsx', 'src/wiki/DirectoryPanel.css', 'src/wiki/WorldPages.jsx', 'src/wiki/WorldPages.css', 'src/wiki/WorldV7.css', 'src/wiki/PvePages.jsx', 'src/wiki/editing/EditEntry.jsx', 'src/wiki/editing/EditEntry.css', 'src/wiki/EditingV7.css', 'src/wiki/SkillBranchView.jsx', 'src/wiki/SkillBranchView.css', 'src/wiki/skillFlow.js', 'src/wiki/skillConditions.js', 'src/wiki/data.js', 'src/wiki/visuals.jsx', 'content/decor-assets-v71.json', 'preview/main.jsx', 'preview/router.jsx', 'scripts/build-preview.mjs', 'validation/check-v731-delivery.cjs'].filter(file => fs.existsSync(path.join(root, file)));
  const report = { version: '7.3.1', checkedAt: new Date().toISOString(), scope: 'Only the V7.3.1 welcome artwork and layer positioning, adventure directories/search/create entries, PVE CTA contrast, and horizontal skill relationships in native output and the exact preview. One 1100px flow width is mocked to select horizontal mode. No account, calculator, lifecycle, browser screenshot or device-layout regression suite.',
    passed: checks.filter(row => row.pass).length, failed: checks.filter(row => !row.pass).length, total: checks.length, checks, nativePages, searchResults, graphResults, welcomePositions, normalCtaContrast, errors,
    previewSha256: fs.existsSync(path.join(root, previewFile)) ? sha(bytes(previewFile)) : null,
    sourceHashes: Object.fromEntries(tracked.map(file => [file, sha(bytes(file))])),
  };
  fs.writeFileSync(path.join(__dirname, 'v731-delivery-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, failures: checks.filter(row => !row.pass) }));
  process.exitCode = report.failed ? 1 : 0;
});
