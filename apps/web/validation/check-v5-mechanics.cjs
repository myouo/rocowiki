const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const {build} = require('esbuild');
const {JSDOM, VirtualConsole} = require('jsdom');

const project = path.resolve(__dirname, '..');
const artifact = process.env.ROCO_V5_HTML || path.join(project, 'RocoWiki_UI_V5.html');
const output = path.join(__dirname, 'v5-mechanics-check-results.json');
const html = fs.readFileSync(artifact, 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(project, 'content/battle-relations-v5.json'), 'utf8'));
const routes = JSON.parse(fs.readFileSync(path.join(project, 'content/routes.json'), 'utf8'));
const docs = JSON.parse(fs.readFileSync(path.join(project, 'preview/generated-docs.json'), 'utf8'));
const allRoutes = [...new Set([...routes, ...Object.keys(docs), '/not-a-real-wiki-page/'])];
const storageKey = 'roco-wiki-v5:feedback';
const checks = [];
const runtimeErrors = [];
const coveredRoutes = [];
const sessions = [];
let dom, w, d;
let networkCalls = 0;
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, details) {
  checks.push({name, passed: Boolean(condition), ...(details === undefined ? {} : {details})});
  assert.ok(condition, name);
}
function create(route = '/mechanics/relations/', storage = {}, options = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', error => runtimeErrors.push({route, message: error.message}));
  vc.on('error', (...args) => runtimeErrors.push({route, message: args.map(String).join(' ')}));
  const created = new JSDOM(html, {
    url: 'https://roco-wiki.test/#' + route,
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
      window.fetch = async () => {networkCalls++; throw new Error('Unexpected network call in local feedback workflow');};
      // jsdom has no native dialog top layer or Escape handling. These adapters
      // exercise React show/close/cancel contracts, not real browser focus traps.
      window.HTMLDialogElement.prototype.showModal = function () {this.open = true;};
      window.HTMLDialogElement.prototype.close = function () {
        if (!this.open) return;
        this.open = false;
        this.dispatchEvent(new window.Event('close'));
      };
      for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
      if (options.blockWrites) {
        const original = window.Storage.prototype.setItem;
        window.Storage.prototype.setItem = function (key, value) {
          if (key === storageKey) throw new window.DOMException('Storage is unavailable', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      }
      if (options.blockReads) {
        const original = window.Storage.prototype.getItem;
        window.Storage.prototype.getItem = function (key) {
          if (key === storageKey) throw new window.DOMException('Storage is unavailable', 'SecurityError');
          return original.call(this, key);
        };
      }
    },
  });
  sessions.push(created);
  return created;
}
async function activate(next) {dom = next; w = dom.window; d = w.document; await pause(500);}
async function go(route) {w.location.hash = route; await pause();}
function mainText() {return d.querySelector('main')?.textContent || '';}
function query() {return new URLSearchParams(w.location.hash.split('?')[1] || '');}
function button(label, scope = d) {
  const found = [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === label || item.getAttribute('aria-label') === label);
  assert.ok(found, 'Button exists: ' + label);
  return found;
}
async function click(label, scope = d) {button(label, scope).click(); await pause();}
async function setValue(element, value) {
  assert.ok(element, 'Input exists');
  const prototype = element.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new w.Event(element.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
  await pause();
}
function savedItems() {return JSON.parse(w.localStorage.getItem(storageKey) || '[]');}
async function submitFeedback() {
  const form = d.querySelector('.rw-feedback-dialog form');
  assert.ok(form, 'Feedback form exists');
  form.dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
  await pause();
}
async function openFeedback() {d.querySelector('.rw-feedback-trigger').click(); await pause();}

async function nativeRootSmoke() {
  const compiled = await build({
    stdin: {
      contents: `import React from 'react'; import {renderToString} from 'react-dom/server'; import Root from './src/theme/Root/index.jsx'; import {RouterContext} from './preview/router.jsx'; export function renderRoute(pathname){return renderToString(<RouterContext.Provider value={{pathname,search:''}}><Root><main data-native-route={pathname}>route content</main></Root></RouterContext.Provider>);}`,
      loader: 'jsx', resolveDir: project,
    },
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    define: {'process.env.NODE_ENV': '"production"'},
    alias: {'@docusaurus/Link': path.join(project, 'preview/router.jsx'), '@docusaurus/router': path.join(project, 'preview/router.jsx'), '@docusaurus/useBaseUrl': path.join(project, 'preview/base-url.js')},
    loader: {'.css': 'empty'}, logLevel: 'silent',
  });
  const nativeFilename = path.join(project, 'validation/native-root-smoke.cjs');
  const compiledModule = new Module(nativeFilename, module);
  compiledModule.filename = nativeFilename;
  compiledModule.paths = Module._nodeModulePaths(project);
  compiledModule._compile(compiled.outputFiles[0].text, compiledModule.filename);
  const failures = [];
  for (const route of allRoutes) {
    const markup = compiledModule.exports.renderRoute(route);
    if ((markup.match(/class="rw-feedback-trigger"/g) || []).length !== 1 || (markup.match(/class="rw-feedback-dialog"/g) || []).length !== 1) failures.push(route);
  }
  check('Native Root renders one feedback trigger and dialog around arbitrary route children without browser globals', failures.length === 0, {routes: allRoutes.length, failures});
  const appSource = fs.readFileSync(path.join(project, 'node_modules/@docusaurus/core/lib/client/App.js'), 'utf8');
  check('Installed Docusaurus App uses the globally swizzled Root wrapper', appSource.includes("import Root from '@theme/Root'") && appSource.includes('<Root>'));
}

async function run() {
  await activate(create('/mechanics/relations/?existing=pressure-chencai&incoming=pressure-yanbo&from=qa'));
  check('Relation selectors resolve the requested directed pair', d.querySelector('select[aria-label="场上已有的效果"]').value === 'pressure-chencai' && d.querySelector('select[aria-label="新施加的效果"]').value === 'pressure-yanbo');
  check('Initial historical result discloses incomplete current verification and source date', mainText().includes('历史实测') && mainText().includes('当前版本复核：未完成') && mainText().includes('2022-06-05'));
  check('Result separates application, cleanup and switching phases', ['施加瞬间', '效果到期／解除', '换宠之后'].every(s => d.querySelector('.rw-relation-phases').textContent.includes(s)));
  check('Pet and variant uncertainty is visible in the main result', d.querySelector('.rw-relation-details').textContent.includes('宠物与形态') && d.querySelector('.rw-relation-details').textContent.includes('未分别复核每只'));
  check('Conditions, source link and source locator remain visible', d.querySelectorAll('.rw-relation-details li').length === 2 && d.querySelector('.rw-relation-evidence a').href === content.sources[0].url && d.querySelector('.rw-relation-evidence').textContent.includes('沉彩飞光章节末段'));
  check('Five by five matrix has exactly one selected directed pair', d.querySelectorAll('.rw-effect-matrix tbody td button').length === 25 && d.querySelectorAll('.rw-effect-matrix .is-selected').length === 1);
  await click('交换已有与新施加效果');
  check('Swapping effects encodes the reverse direction in the URL', query().get('existing') === 'pressure-yanbo' && query().get('incoming') === 'pressure-chencai');
  check('Swapping preserves unrelated URL context', query().get('from') === 'qa');
  check('Reverse direction is reflected in the result and selection', d.querySelector('.rw-query-direction').textContent.includes('烟波长静') && d.querySelector('.rw-effect-matrix .is-selected').getAttribute('aria-label') === '烟波长静已有，施加沉彩飞光', {direction:d.querySelector('.rw-query-direction').textContent, selected:d.querySelector('.rw-effect-matrix .is-selected').getAttribute('aria-label'), existing:d.querySelector('select[aria-label="场上已有的效果"]').value});
  await setValue(d.querySelector('select[aria-label="新施加的效果"]'), 'pressure-yongwei');
  check('Changing one selector updates only its own URL field', query().get('existing') === 'pressure-yanbo' && query().get('incoming') === 'pressure-yongwei');
  check('An unrecorded pair shows unknown rather than inventing coexistence or a ranking', !!d.querySelector('.rw-relation-unknown') && mainText().includes('这组配对还没有可引用的记录') && mainText().includes('未知不表示共存'));
  await click('沉彩飞光已有，施加孤壑分疆');
  check('Matrix selection updates both parameters and highlights the selected cell', query().get('existing') === 'pressure-chencai' && query().get('incoming') === 'pressure-guhe' && d.querySelectorAll('.rw-effect-matrix .is-selected').length === 1);
  check('Historical priority is accompanied by an unknown application result', d.querySelector('.rw-relation-details').textContent.includes('孤壑分疆 高于 沉彩飞光') && d.querySelector('.rw-relation-phases').textContent.includes('尚待实测') && mainText().includes('不足以单独判定'));
  await click('孤壑分疆已有，施加孤壑分疆');
  check('Same source reapplication has its own explicit unknown state', mainText().includes('同来源重复施加的关系待收录'));
  await go('/mechanics/relations/?existing=invalid-effect&incoming=pressure-guhe');
  check('An invalid effect ID shows a warning and a usable explicit fallback', mainText().includes('链接中的效果 ID 未收录') && d.querySelector('select[aria-label="场上已有的效果"]').value === 'pressure-chencai' && d.querySelector('select[aria-label="新施加的效果"]').value === 'pressure-guhe');
  await go('/mechanics/relations/?existing=invalid-effect&incoming=also-invalid');
  check('Two invalid IDs do not crash the page', !!d.querySelector('.rw-relation-result') && d.querySelectorAll('.rw-effect-matrix tbody td button').length === 25);

  for (const route of allRoutes) {
    await go(route);
    assert.equal(d.querySelectorAll('.rw-feedback-trigger').length, 1, 'One feedback trigger: ' + route);
    assert.equal(d.querySelectorAll('.rw-feedback-dialog').length, 1, 'One feedback dialog: ' + route);
    coveredRoutes.push(route);
  }
  check('Preview layout provides one feedback entry across every custom page, document and unknown route', coveredRoutes.length === allRoutes.length, {routeCount: coveredRoutes.length});
  await nativeRootSmoke();

  const feedbackRoute = '/mechanics/relations/?existing=pressure-guhe&incoming=pressure-chencai&from=feedback-test';
  await go(feedbackRoute); await openFeedback();
  check('Global feedback opens its dialog from a deep mechanism query', d.querySelector('.rw-feedback-dialog').open);
  check('Feedback captures both the page title and directed query context', d.querySelector('.rw-feedback-context').textContent.includes('效果关系查询') && d.querySelector('.rw-feedback-context').textContent.includes(feedbackRoute));
  await setValue(d.querySelector('.rw-feedback-dialog textarea'), '太短'); await submitFeedback();
  check('Short feedback is rejected without saving a record', d.querySelector('.rw-feedback-dialog [role="alert"]')?.textContent.includes('至少写 5 个字') && savedItems().length === 0);
  await setValue(d.querySelector('.rw-feedback-dialog textarea'), '在这组效果先后施加时，旧效果到期后的处理需要补充实测。');
  await setValue(d.querySelector('.rw-feedback-dialog input[type="url"]'), 'https://example.com/test-evidence');
  await setValue(d.querySelector('.rw-feedback-dialog select'), '缺少资料');
  await submitFeedback();
  check('Valid feedback is stored locally with kind, title, path and source', savedItems().length === 1 && savedItems()[0].path === feedbackRoute && savedItems()[0].kind === '缺少资料' && savedItems()[0].source === 'https://example.com/test-evidence' && savedItems()[0].title.includes('效果关系查询'));
  check('Success message clearly says the record has not been sent to a site service', d.querySelector('.rw-feedback-saved').textContent.includes('反馈已保存在本机') && d.querySelector('.rw-feedback-saved').textContent.includes('尚未连接站点反馈服务'));
  d.querySelector('.rw-feedback-saved a').click(); await pause();
  check('Success link opens the personal feedback page and reads the saved record', w.location.hash === '#/feedback/' && d.querySelectorAll('.rw-feedback-records article').length === 1 && mainText().includes('旧效果到期后的处理'));
  check('Saved page link preserves the exact directed query for revisiting', d.querySelector('.rw-feedback-records h2 a').getAttribute('href') === '#' + feedbackRoute);
  const persisted = w.localStorage.getItem(storageKey);
  await activate(create('/feedback/', {[storageKey]: persisted}));
  check('Feedback survives recreation with persisted browser storage', d.querySelectorAll('.rw-feedback-records article').length === 1 && mainText().includes('旧效果到期后的处理'));
  await openFeedback(); await setValue(d.querySelector('.rw-feedback-dialog textarea'), '这条内容不提交，只关闭窗口。');
  await click('关闭反馈', d.querySelector('.rw-feedback-dialog'));
  check('Close cancels unsaved feedback and returns focus to the trigger', !d.querySelector('.rw-feedback-dialog').open && savedItems().length === 1 && d.activeElement.classList.contains('rw-feedback-trigger'));
  await openFeedback();
  check('Reopening starts a fresh unsaved feedback form', d.querySelector('.rw-feedback-dialog textarea').value === '' && !d.querySelector('.rw-feedback-saved'));
  d.querySelector('.rw-feedback-dialog').dispatchEvent(new w.Event('cancel', {bubbles: false, cancelable: true})); await pause();
  check('Dialog cancel event (the browser Escape contract) closes without saving', !d.querySelector('.rw-feedback-dialog').open && savedItems().length === 1);
  await openFeedback();
  d.querySelector('.rw-feedback-dialog').click(); await pause();
  check('Clicking the dialog backdrop closes without saving', !d.querySelector('.rw-feedback-dialog').open && savedItems().length === 1);
  await openFeedback(); await go('/pets/haifu/');
  check('Navigating to another page closes the feedback dialog', !d.querySelector('.rw-feedback-dialog').open);

  await activate(create('/feedback/', {[storageKey]: '{broken JSON'}));
  check('Malformed JSON falls back to the empty feedback state', mainText().includes('暂时没有反馈记录') && !!d.querySelector('main'));
  await activate(create('/feedback/', {[storageKey]: JSON.stringify({not: 'an array'})}));
  check('A non-array stored shape falls back without crashing', mainText().includes('暂时没有反馈记录'));
  const dirty = [null, 42, {id: 8, details: '类型无效'}, {id: 'no-details'}, {id: 'partial', details: '只有正文的旧记录仍然可读'}, {id: 'malformed-fields', details: '字段类型损坏也不能让页面崩溃', title: {}, path: 'javascript:alert(1)', kind: {}, source: {}, createdAt: 'not-a-date'}];
  await activate(create('/feedback/', {[storageKey]: JSON.stringify(dirty)}));
  check('Partial or corrupt record fields are normalized and invalid records are excluded', d.querySelectorAll('.rw-feedback-records article').length === 2 && mainText().includes('未记录页面标题'));
  check('Invalid record path and date use safe reader-facing fallbacks', [...d.querySelectorAll('.rw-feedback-records h2 a')].every(a => a.getAttribute('href') === '#/feedback/') && !mainText().includes('Invalid Date') && !d.querySelector('.rw-feedback-records a[href^="javascript:"]'));
  await activate(create('/feedback/', {}, {blockReads: true}));
  check('Unavailable local storage reads leave the feedback page usable', mainText().includes('暂时没有反馈记录'));
  await activate(create('/mechanics/', {}, {blockWrites: true}));
  await openFeedback(); await setValue(d.querySelector('.rw-feedback-dialog textarea'), '存储已满时，请保留这份用户输入并显示错误。'); await submitFeedback();
  check('Storage write failure reports the problem and preserves the entered text', d.querySelector('.rw-feedback-dialog [role="alert"]')?.textContent.includes('无法保存反馈') && d.querySelector('.rw-feedback-dialog textarea').value.includes('保留这份用户输入') && !d.querySelector('.rw-feedback-saved'));
  check('Feedback workflow performs no remote submission', networkCalls === 0);
  check('No runtime errors occurred in the bounded mechanism and feedback checks', runtimeErrors.length === 0, runtimeErrors);
}

(async () => {
  let status = 'PASS', error;
  try {await run();} catch (caught) {status = 'FAIL'; error = {message: caught.message, stack: caught.stack};}
  const result = {
    status,
    scope: 'jsdom DOM integration and native Root SSR smoke only; no browser visual, geometry, focus-trap, performance, or native Escape-key acceptance claims',
    artifact, artifactSha256: crypto.createHash('sha256').update(html).digest('hex'), artifactBytes: Buffer.byteLength(html),
    checkedAt: new Date().toISOString(), checkCount: checks.length, passedCount: checks.filter(c => c.passed).length,
    coverage: {previewRoutes: coveredRoutes.length, listedRoutes: allRoutes.length, includesUnknownRoute: true}, checks, runtimeErrors,
    ...(error ? {error} : {}),
  };
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  for (const session of sessions) session.window.close();
  process.exitCode = status === 'PASS' ? 0 : 1;
})();
