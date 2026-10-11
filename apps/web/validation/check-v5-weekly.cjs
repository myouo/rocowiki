/** V5 source-data/DOM integration checks. This is not a browser visual audit. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const project = path.resolve(__dirname, '..');
const previewPath = path.resolve(process.env.ROCO_V5_PREVIEW || path.join(project, 'RocoWiki_UI_V5.html'));
const outputPath = path.join(__dirname, 'v5-weekly-check-results.json');
const html = fs.readFileSync(previewPath, 'utf8');
const routes = JSON.parse(fs.readFileSync(path.join(project, 'content/routes.json'), 'utf8'));
const docs = JSON.parse(fs.readFileSync(path.join(project, 'preview/generated-docs.json'), 'utf8'));
const allRoutes = [...new Set([...routes, ...Object.keys(docs)])];
const routeSet = new Set(allRoutes);
const checks = [];
const pageResults = [];
const runtimeErrors = [];
const jsdomLimitations = [];
const badLinks = [];
const worlds = [];
const pause = (ms = 45) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, condition, details) {
  const item = { name, pass: Boolean(condition) };
  if (!condition && details !== undefined) item.details = details;
  checks.push(item);
  return item.pass;
}
function create({ route = '/', at = '2026-10-10T09:00:00Z', storage = {} } = {}) {
  const clock = { value: Date.parse(at) };
  const scheduled = new Map();
  const vc = new VirtualConsole();
  vc.on('jsdomError', (error) => {
    const message = error.message || String(error);
    if (error.type === 'css-parsing') jsdomLimitations.push({ type: error.type, message });
    else runtimeErrors.push({ route: world?.window?.location?.hash || route, message, type: error.type });
  });
  vc.on('error', (...args) => runtimeErrors.push({ route: world?.window?.location?.hash || route, message: args.map(String).join(' ') }));
  let world;
  world = new JSDOM(html, {
    url: 'https://roco-wiki.test/#' + route,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      const NativeDate = w.Date;
      w.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [clock.value])); }
        static now() { return clock.value; }
      };
      const nativeTimeout = w.setTimeout.bind(w);
      const nativeClear = w.clearTimeout.bind(w);
      w.setTimeout = (callback, delay, ...args) => {
        const id = nativeTimeout(callback, delay, ...args);
        if (typeof callback === 'function' && delay >= 1000) scheduled.set(id, { callback, delay, args });
        return id;
      };
      w.clearTimeout = (id) => { scheduled.delete(id); nativeClear(id); };
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
      for (const [key, value] of Object.entries(storage)) w.localStorage.setItem(key, value);
    },
  });
  worlds.push(world);
  return {
    window: world.window,
    document: world.window.document,
    async go(route) { world.window.location.hash = route; await pause(); await pause(); },
    async click(selector) {
      const element = world.window.document.querySelector(selector);
      if (!element) throw new Error('Missing click target: ' + selector);
      element.click(); await pause();
    },
    async setTime(instant, signal = 'focus') {
      clock.value = Date.parse(instant);
      if (signal === 'timer') {
        const candidate = [...scheduled.entries()].find(([, item]) => item.delay >= 1000 && item.delay <= 12000);
        if (!candidate) throw new Error('No scheduled Shanghai-midnight refresh timer');
        world.window.clearTimeout(candidate[0]);
        candidate[1].callback(...candidate[1].args);
      } else {
        world.window.dispatchEvent(new world.window.Event(signal));
      }
      await pause(); await pause();
    },
    close() { world.window.close(); },
  };
}
function mainText(client) { return client.document.querySelector('main')?.textContent || ''; }
function cards(client) { return [...client.document.querySelectorAll('.rw-petcard h3')].map((item) => item.textContent.trim()).sort(); }
function equalsNames(actual, expected) { return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()); }
function routeFromHref(href) {
  if (!href.startsWith('#/')) return null;
  return href.slice(1).split(/[?#]/)[0];
}
async function clickByAria(client, label) {
  const button = [...client.document.querySelectorAll('button')].find((item) => item.getAttribute('aria-label') === label);
  if (!button) throw new Error('Missing button: ' + label);
  button.click(); await pause();
}

async function run() {
  const client = create();
  await pause(120);
  const d = client.document;
  const accountLink = d.querySelector('.rw-site-header .rw-account-link');
  check('Account has a direct header link outside dropdown containers', accountLink?.getAttribute('href') === '#/account/' && !accountLink.closest('details'));
  check('Contribution guide has a dedicated header entry', d.querySelector('.rw-site-header .rw-contribute-link')?.getAttribute('href') === '#/help/contributing/');
  check('Battle mechanics has its own primary navigation entry', [...d.querySelectorAll('#rw-primary-navigation a')].some((a) => a.getAttribute('href') === '#/mechanics/' && a.textContent.includes('战斗机制')));
  check('Homepage contains four newly introduced activities', d.querySelectorAll('.rw-weekly-event').length === 4);
  check('New activity list keeps evolution qualification visible', d.querySelector('.rw-weekly-event-list')?.textContent.includes('四圣兵·修罗进化资格'));
  await client.click('#event-tab-continuing');
  check('Homepage continuing activity tab contains three activities', d.querySelectorAll('.rw-weekly-event').length === 3);
  check('Activity tab accessibility state follows selection', d.querySelector('#event-tab-continuing')?.getAttribute('aria-selected') === 'true' && d.querySelector('#weekly-event-panel')?.getAttribute('aria-labelledby') === 'event-tab-continuing');
  await client.click('#event-tab-new');
  check('Activity tabs can return to the four-item group', d.querySelectorAll('.rw-weekly-event').length === 4);
  const homeEventLinks = [...d.querySelectorAll('.rw-weekly-event')].map((a) => a.getAttribute('href'));
  check('Every homepage activity opens a registered detail route', homeEventLinks.every((href) => routeSet.has(routeFromHref(href))), homeEventLinks);
  check('October 9 type tournament shows eleven bans', d.querySelectorAll('.rw-ban-list > *').length === 11);
  check('Type tournament labels primary attributes', d.querySelector('.rw-eligible-types')?.textContent.includes('参赛主属性') && d.querySelector('.rw-eligible-types')?.textContent.includes('普通'));
  await client.click('.rw-period-choices button:nth-child(2)');
  check('October 13 type tournament shows ten bans', d.querySelectorAll('.rw-ban-list > *').length === 10);
  check('Second type period shows water fire ice', ['水', '火', '冰'].every((name) => d.querySelector('.rw-eligible-types')?.textContent.includes(name)));
  check('Homepage PVP filter link retains the selected period', d.querySelector('.rw-weekly-pvp-bottom a')?.getAttribute('href') === '#/pets/?pvp=type&period=2026-10-13');
  check('Uncatalogued bans are plain text; every linked ban resolves', [...d.querySelectorAll('.rw-ban-list a')].every((a) => a.textContent === '塞勒姆' && a.getAttribute('href') === '#/pets/sailemu/'));
  await client.click('#pvp-tab-ladder');
  check('Ladder tab shows its separate twelve bans', d.querySelectorAll('.rw-ban-list > *').length === 12);
  check('Ladder panel does not show type tournament eligibility', !d.querySelector('.rw-eligible-types') && d.querySelector('.rw-ladder-period')?.textContent.includes('天梯与巅峰赛共享'));

  await client.go('/pets/?pvp=type&period=2026-10-09');
  check('First type period filters to Abu and Moshen by primary attribute', equalsNames(cards(client), ['阿布', '魔神武王']), cards(client));
  await client.go('/pets/?pvp=type&period=2026-10-13');
  check('Second type period excludes the banned Sailemu', equalsNames(cards(client), ['碧水灵兽', '水蓝蓝', '火花', '灵瑞朱雀']), cards(client));
  check('PVP filter does not claim full team eligibility', d.querySelector('.rw-pvp-filter-note')?.textContent.includes('等级、满血与完整阵容等参赛条件仍需核对'));
  await client.go('/pets/?type=' + encodeURIComponent('恶魔'));
  check('General attribute search may match a secondary attribute', equalsNames(cards(client), ['魔神武王']), cards(client));
  await client.go('/pets/?type=' + encodeURIComponent('恶魔') + '&typeMode=primary');
  check('Primary-only attribute search excludes a secondary-only match', cards(client).length === 0 && Boolean(d.querySelector('.rw-empty')));

  await client.go('/pets/');
  await clickByAria(client, '加入对比：海芙约忒');
  await clickByAria(client, '加入对比：碧水灵兽');
  await clickByAria(client, '加入对比：迪莫');
  await clickByAria(client, '加入对比：阿布');
  check('Fourth compare selection shows actionable limit feedback', d.querySelector('.rw-comparison-message')?.textContent.includes('已选满 3 只'));
  check('Compare selection remains capped at three distinct pets', JSON.parse(client.window.localStorage.getItem('roco-wiki-v4:compare')).length === 3 && d.querySelectorAll('.rw-compare-selection button').length === 3);
  await clickByAria(client, '移出对比：海芙约忒');
  await clickByAria(client, '加入对比：阿布');
  check('Removing an entry frees a compare slot', JSON.parse(client.window.localStorage.getItem('roco-wiki-v4:compare')).includes('abu') && d.querySelector('.rw-comparison-message')?.textContent === '');
  await clickByAria(client, '清空对比');
  check('Clear compare removes the selection and tray', JSON.parse(client.window.localStorage.getItem('roco-wiki-v4:compare')).length === 0 && !d.querySelector('.rw-comparebar'));
  await client.go('/tools/compare/?pets=not-a-pet,haifu,undefined');
  check('Unknown comparison IDs are discarded without fake links', d.querySelectorAll('.rw-compare-table thead th').length === 2 && [...d.querySelectorAll('.rw-compare-table thead a')].every((a) => a.getAttribute('href') === '#/pets/haifu/'));
  await client.go('/tools/compare/?pets=haifu,haifu,bishui');
  check('Comparison query deduplicates pet IDs', d.querySelectorAll('.rw-compare-table thead th').length === 3, { columns: d.querySelectorAll('.rw-compare-table thead th').length });
  await client.go('/tools/compare/?pets=haifu,haifu,bishui,dimo,abu');
  check('Compare URL caps three unique valid IDs after deduplication', d.querySelectorAll('.rw-compare-table thead th').length === 4 && equalsNames([...d.querySelectorAll('.rw-compare-table thead a')].map((a) => a.textContent), ['海芙约忒', '碧水灵兽', '迪莫']));
  await client.go('/tools/compare/?pets=not-a-pet');
  check('Entirely unknown compare query displays an empty state', !d.querySelector('.rw-compare-table') && mainText(client).includes('先选择要比较的宠物'));
  await client.go('/pets/not-a-pet/');
  check('Unknown pet ID does not display a different pet as fallback', !d.querySelector('.rw-portrait.hero img') && !d.querySelector('.rw-stats-radar'));

  for (const route of allRoutes) {
    await client.go(route);
    const h1s = [...d.querySelectorAll('main h1')];
    const valid = h1s.length === 1 && mainText(client).trim().length > 100;
    const feedbackCount = d.querySelectorAll('.rw-feedback-trigger').length;
    pageResults.push({ route, title: h1s[0]?.textContent || null, pass: valid && feedbackCount === 1, h1Count: h1s.length, feedbackButtons: feedbackCount });
    for (const a of d.querySelectorAll('a[href^="#/"]')) {
      const href = a.getAttribute('href');
      const destination = routeFromHref(href);
      if (!routeSet.has(destination)) badLinks.push({ route, destination, href });
    }
  }
  check('All 97 registered V5 routes are included in smoke validation', allRoutes.length === 97, { custom: routes.length, docs: Object.keys(docs).length, total: allRoutes.length });
  check('Every registered route renders one substantial titled page with one feedback button', pageResults.every((item) => item.pass), pageResults.filter((item) => !item.pass));
  check('All rendered internal links have registered routes', badLinks.length === 0, badLinks);
  client.close();

  const corrupt = create({ route: '/pets/', storage: { 'roco-wiki-v4:compare': '["missing","haifu","haifu","bishui","dimo","abu"]' } });
  await pause(120);
  check('Catalog sanitizes invalid duplicate and excess saved compare IDs', corrupt.document.querySelectorAll('.rw-compare-selection button').length === 3 && !corrupt.document.querySelector('.rw-compare-selection')?.textContent.includes('missing'));
  corrupt.close();

  const nextPeriod = create({ at: '2026-10-13T01:00:00Z' });
  await pause(120);
  check('Homepage automatically selects the October 13 period on that Shanghai date', nextPeriod.document.querySelector('.rw-period-choices button[aria-pressed="true"]')?.textContent.includes('10.13') && nextPeriod.document.querySelectorAll('.rw-ban-list > *').length === 10);
  nextPeriod.close();

  const stale = create({ at: '2026-10-16T00:00:00Z' });
  await pause(120);
  check('Stale homepage explicitly labels the edition as historical', stale.document.querySelector('.rw-week-edition')?.textContent.includes('周更历史快照') && stale.document.querySelector('.rw-week-edition')?.textContent.includes('待更新本期数据'));
  check('Stale homepage no longer titles its panels this week', stale.document.querySelector('#rw-weekly-events-title')?.textContent === '本期活动记录' && stale.document.querySelector('#rw-weekly-pvp-title')?.textContent === '本期禁赛记录');
  check('Stale continuing tab is labelled as that edition’s continuation', stale.document.querySelector('#event-tab-continuing')?.textContent.includes('当期延续'));
  stale.close();

  const focus = create({ at: '2026-10-15T15:55:00Z' });
  await pause(120);
  await focus.setTime('2026-10-15T16:05:00Z');
  check('A kept-open homepage refreshes stale state when refocused after Shanghai midnight', focus.document.querySelector('.rw-week-edition')?.textContent.includes('周更历史快照'));
  focus.close();

  const midnight = create({ at: '2026-10-15T15:59:50Z' });
  await pause(120);
  await midnight.setTime('2026-10-15T16:00:02Z', 'timer');
  check('Scheduled Shanghai midnight callback refreshes an active homepage', midnight.document.querySelector('.rw-week-edition')?.textContent.includes('周更历史快照'));
  midnight.close();

  check('No JavaScript runtime or console errors occurred', runtimeErrors.length === 0, runtimeErrors);
}

run().catch((error) => { checks.push({ name: 'QA run completed', pass: false, details: error.stack || String(error) }); }).finally(() => {
  for (const world of worlds) { try { world.window.close(); } catch {} }
  const failures = checks.filter((item) => !item.pass);
  const result = {
    status: failures.length ? 'FAIL' : 'PASS',
    scope: 'jsdom DOM/data integration and deterministic clock tests; not browser rendering, visual QA or animation performance validation',
    preview: path.relative(project, previewPath),
    previewSha256: crypto.createHash('sha256').update(html).digest('hex'),
    ranAt: new Date().toISOString(),
    routeCount: pageResults.length,
    checkCount: checks.length,
    checks,
    pageResults,
    badLinks,
    runtimeErrors,
    jsdomLimitations,
  };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, routes: result.routeCount, checks: result.checkCount, failed: failures, runtimeErrors, jsdomLimitations: jsdomLimitations.length, results: path.relative(project, outputPath) }, null, 2));
  if (failures.length) process.exitCode = 1;
});
