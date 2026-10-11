/** Focused React/JSDOM interaction checks. Geometry is mocked; this is not browser visual QA. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const project = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "roco-v73-interface-"));
const esbuild = require(require.resolve("esbuild", { paths: [project] }));
const { JSDOM, VirtualConsole } = require(require.resolve("jsdom", { paths: [project] }));
const React = require(require.resolve("react", { paths: [project] }));
const checks = [], errors = [], expectedBoundaryErrors = [], roots = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(" "));
const check = (name, value) => { checks.push({ name, pass: Boolean(value) }); assert.ok(value, name); };
let dom;
function track(target, types) {
  const listeners = new Map(types.map(type => [type, new Set()]));
  const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
  target.addEventListener = (type, listener, options) => { listeners.get(type)?.add(listener); add(type, listener, options); };
  target.removeEventListener = (type, listener, options) => { listeners.get(type)?.delete(listener); remove(type, listener, options); };
  return { count: type => listeners.get(type)?.size || 0, restore() { target.addEventListener = add; target.removeEventListener = remove; } };
}
function manualFrames(win) {
  const pending = new Map(); let next = 1;
  win.requestAnimationFrame = callback => { const id = next++; pending.set(id, callback); return id; };
  win.cancelAnimationFrame = id => pending.delete(id);
  return { pending, flush() { const jobs = [...pending.values()]; pending.clear(); jobs.forEach(callback => callback(Date.now())); } };
}
function pointer(win, type, fields = {}) {
  const event = new win.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...fields });
  Object.defineProperty(event, "pointerId", { value: fields.pointerId || 1 });
  return event;
}

async function main() {
  const vc = new VirtualConsole(); vc.on("jsdomError", error => errors.push(String(error)));
  dom = new JSDOM('<div id="parent-root"></div><button id="parent-outside">母页面按钮</button><iframe title="Wiki 子页面"></iframe>', { url: "https://wiki.test/pets/haifu/", pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, d = w.document;
  Object.assign(global, { window: w, document: d, HTMLElement: w.HTMLElement, Node: w.Node, localStorage: w.localStorage, MutationObserver: w.MutationObserver, CustomEvent: w.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(global, "navigator", { value: w.navigator, configurable: true });
  const fw = d.querySelector("iframe").contentWindow, fd = fw.document;
  fd.body.innerHTML = '<div id="frame-root"></div><button id="frame-outside">子页面按钮</button>';
  Object.defineProperties(w, { innerWidth: { value: 1440, configurable: true }, innerHeight: { value: 900, configurable: true } });
  Object.defineProperties(fw, { innerWidth: { value: 320, configurable: true }, innerHeight: { value: 360, configurable: true } });
  const scrolls = [];
  for (const win of [w, fw]) {
    win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    win.HTMLElement.prototype.scrollIntoView = function(options) { scrolls.push({ id: this.id, document: this.ownerDocument, options }); };
  }
  const frameJobs = manualFrames(fw), parentJobs = manualFrames(w);
  let fontReady;
  Object.defineProperty(fd, "fonts", { configurable: true, value: { ready: new Promise(resolve => { fontReady = resolve; }) } });
  const observers = [];
  fw.ResizeObserver = class { constructor(callback) { this.callback = callback; this.connected = true; this.element = null; observers.push(this); } observe(node) { this.element = node; } disconnect() { this.connected = false; } };
  fw.visualViewport = new fw.EventTarget();
  const winTrack = track(fw, ["resize", "scroll"]), viewportTrack = track(fw.visualViewport, ["resize", "scroll"]), docTrack = track(fd, ["pointermove", "pointerup", "pointercancel", "pointerdown"]), parentTrack = track(w, ["resize", "scroll"]);
  await esbuild.build({
    stdin: { contents: 'export {default as BoundedTextarea} from "./src/wiki/BoundedTextarea.jsx"; export {default as EntityTextarea} from "./src/wiki/EntityTextarea.jsx"; export {default as CustomSelect} from "./src/wiki/Select.jsx"; export {default as RecoveryBoundary} from "./src/wiki/WikiRecoveryBoundary.jsx"; export {default as PageCommunityFooter} from "./src/wiki/PageCommunityFooter.jsx"; export {PreviewHeader,PreviewFooter} from "./src/wiki/core.jsx"; export {default as PvePages} from "./src/wiki/PvePages.jsx"; export {commentAnchor} from "./src/wiki/pageCommunityModel.js"; export {commentEntryHref} from "./src/wiki/communityActivityModel.js"; export {SOCIAL_STORAGE_KEY,COMMUNITY_STORAGE_KEY,emptySocialState} from "./src/wiki/communitySocialModel.js";', resolveDir: project, loader: "jsx" },
    outfile: path.join(temporary, "suite.cjs"), bundle: true, format: "cjs", platform: "node", loader: { ".css": "empty" }, logLevel: "silent",
    plugins: [require('./runtime-context-plugin.cjs'), { name: "local-ui-environment", setup(build) {
      build.onResolve({ filter: /^(react|react-dom|lucide-react)(\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [project] }), external: true }));
      build.onResolve({ filter: /^@docusaurus\// }, args => ({ path: args.path, namespace: "docusaurus-stub" }));
      build.onLoad({ filter: /.*/, namespace: "docusaurus-stub" }, args => ({ loader: "jsx", resolveDir: project, contents: args.path.endsWith("/useBrokenLinks") ? "export default function useBrokenLinks(){return {collectAnchor(){},collectLink(){}};}" : args.path.endsWith("/Link")
        ? 'import React from "react"; export default function Link({to,children,...rest}) { return <a href={to} {...rest}>{children}</a>; }'
        : args.path.endsWith("/useBaseUrl") ? "export default function useBaseUrl(value){return value;}"
        : 'import React from "react"; const read=()=>({pathname:window.location.pathname,search:window.location.search,hash:window.location.hash}); export function useLocation(){const [value,set]=React.useState(read);React.useEffect(()=>{const update=()=>set(read());window.addEventListener("test-route",update);return()=>window.removeEventListener("test-route",update)},[]);return value;} export function useHistory(){return {replace(url){window.history.replaceState({},"",url);window.dispatchEvent(new window.Event("test-route"))},push(url){window.history.pushState({},"",url);window.dispatchEvent(new window.Event("test-route"))}};}' }));
    } }],
  });
  const M = require(path.join(temporary, "suite.cjs"));
  const { createRoot } = require(require.resolve("react-dom/client", { paths: [project] }));
  const frameRoot = createRoot(fd.querySelector("#frame-root"), { onCaughtError: error => expectedBoundaryErrors.push(String(error)) }); roots.push(frameRoot);
  const parentRoot = createRoot(d.querySelector("#parent-root"), { onCaughtError: error => expectedBoundaryErrors.push(String(error)) }); roots.push(parentRoot);
  const renderFrame = async element => { await React.act(async () => frameRoot.render(React.createElement(React.StrictMode, null, element))); await React.act(async () => frameJobs.flush()); };
  const renderParent = async element => { await React.act(async () => parentRoot.render(element)); await React.act(async () => parentJobs.flush()); };
  const click = async element => { assert.ok(element, "click target exists"); await React.act(async () => element.click()); await React.act(async () => { frameJobs.flush(); parentJobs.flush(); }); };
  const key = async (element, name, properties = {}) => { await React.act(async () => element.dispatchEvent(new element.ownerDocument.defaultView.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...properties }))); await React.act(async () => frameJobs.flush()); };
  const go = async url => { await React.act(async () => { w.history.pushState({}, "", url); w.dispatchEvent(new w.Event("test-route")); }); await React.act(async () => parentJobs.flush()); };
  const button = (doc, label) => [...doc.querySelectorAll("button")].find(element => element.textContent.trim() === label || element.getAttribute("aria-label") === label);

  let forwarded, inputEvent, scrollHeight = 100, compositionCount = 0;
  function InputHarness() {
    const [value, setValue] = React.useState("初始正文");
    return React.createElement(M.BoundedTextarea, { ref: node => { forwarded = node; if (node) Object.defineProperty(node, "scrollHeight", { configurable: true, get: () => scrollHeight }); }, value, rows: 1, minHeight: 72, maxHeight: 480, style: { width: "900px", height: "900px", lineHeight: "20px" }, "aria-label": "专用编辑框", onChange: event => { inputEvent = { target: event.target, currentTarget: event.currentTarget, value: event.target.value }; setValue(event.target.value); }, onCompositionStart: () => compositionCount++ });
  }
  await renderFrame(React.createElement(InputHarness));
  check("forwardRef is the actual iframe textarea and preserves the supplied accessible name", forwarded instanceof fw.HTMLTextAreaElement && !(forwarded instanceof w.HTMLTextAreaElement) && forwarded.getAttribute("aria-label") === "专用编辑框");
  check("Caller widths and native resize cannot escape the bounded-input contract", forwarded.style.width === "100%" && forwarded.style.maxWidth === "100%" && parseFloat(forwarded.style.minWidth) === 0 && forwarded.style.resize === "none" && forwarded.style.boxSizing === "border-box");
  const initialHeight = parseFloat(forwarded.style.height);
  await click(button(fd, "放大输入区")); const plusHeight = parseFloat(forwarded.style.height);
  await click(button(fd, "缩小输入区"));
  check("Input height controls grow and shrink the textarea without changing its width", plusHeight === initialHeight + 48 && parseFloat(forwarded.style.height) === initialHeight && forwarded.style.width === "100%");
  const grip = fd.querySelector('[role="separator"]');
  await key(grip, "End");
  check("Keyboard maximum uses the iframe viewport rather than the larger parent viewport", parseFloat(forwarded.style.height) <= fw.innerHeight * .72 && parseFloat(forwarded.style.height) === Number(grip.getAttribute("aria-valuemax")) + .2 && button(fd, "放大输入区").disabled);
  const inputBeforeViewportChange = forwarded;
  fw.visualViewport.height = 180;
  await React.act(async () => { fw.visualViewport.dispatchEvent(new fw.Event("resize")); frameJobs.flush(); });
  check("A smaller visual viewport reclamps an existing input to the keyboard-visible height budget", forwarded === inputBeforeViewportChange && parseFloat(forwarded.style.height) === 180 * .72 && parseFloat(forwarded.style.maxHeight) === 180 * .72 && Number(grip.getAttribute("aria-valuemax")) === Math.round(180 * .72) && forwarded.value === "初始正文" && forwarded.style.width === "100%" && button(fd, "放大输入区").disabled);
  delete fw.visualViewport.height;
  await React.act(async () => { fw.visualViewport.dispatchEvent(new fw.Event("resize")); frameJobs.flush(); });
  await key(grip, "Home");
  check("Keyboard minimum is bounded and exposes matching accessible limits", parseFloat(forwarded.style.height) === Number(grip.getAttribute("aria-valuemin")) && button(fd, "缩小输入区").disabled);
  await click(button(fd, "恢复输入区自动高度"));
  check("Reset returns to measured content height and automatic mode", parseFloat(forwarded.style.height) === initialHeight && fd.querySelector('.rw-bounded-textarea').dataset.heightMode === "auto");
  await React.act(async () => { forwarded.focus(); const setValue = Object.getOwnPropertyDescriptor(fw.HTMLTextAreaElement.prototype, "value").set; setValue.call(forwarded, "通过真实输入事件修改"); forwarded.dispatchEvent(new fw.Event("input", { bubbles: true })); forwarded.dispatchEvent(new fw.CompositionEvent("compositionstart", { bubbles: true, data: "输" })); });
  check("Bounded input preserves ordinary change-event targets and composition callbacks", inputEvent?.target === forwarded && inputEvent.currentTarget === forwarded && inputEvent.value === "通过真实输入事件修改" && forwarded.value === inputEvent.value && compositionCount === 1);
  const beforeDrag = parseFloat(forwarded.style.height);
  await React.act(async () => { grip.dispatchEvent(pointer(fw, "pointerdown", { clientX: 40, clientY: 100 })); fd.dispatchEvent(pointer(fw, "pointermove", { clientX: 999, clientY: 100 })); frameJobs.flush(); });
  check("A horizontal drag does not stretch the field or change its measured height", forwarded.style.width === "100%" && parseFloat(forwarded.style.height) === beforeDrag);
  await React.act(async () => { fd.dispatchEvent(pointer(fw, "pointermove", { clientY: 2000 })); frameJobs.flush(); });
  check("A long vertical drag clamps to the field's maximum instead of overflowing its height budget", parseFloat(forwarded.style.height) <= fw.innerHeight * .72 && docTrack.count("pointermove") === 1);
  await React.act(async () => fd.dispatchEvent(pointer(fw, "pointercancel", { clientY: 2000 })));
  check("Cancelling a drag removes document pointer listeners", ["pointermove", "pointerup", "pointercancel"].every(type => docTrack.count(type) === 0));
  await React.act(async () => { grip.dispatchEvent(pointer(fw, "pointerdown", { clientY: 100 })); fw.dispatchEvent(new fw.Event("resize")); });
  await renderFrame(null);
  fontReady(); await React.act(async () => { await Promise.resolve(); frameJobs.flush(); });
  check("StrictMode/unmount cancels drag, observers, queued measurements and viewport listeners", forwarded === null && frameJobs.pending.size === 0 && observers.every(observer => !observer.connected) && winTrack.count("resize") === 0 && viewportTrack.count("resize") === 0 && ["pointermove", "pointerup", "pointercancel"].every(type => docTrack.count(type) === 0));
  check("Iframe input lifecycle never installs size listeners on the parent window", parentTrack.count("resize") === 0);

  let entityValue = "";
  function EntityHarness() { const [value, setValue] = React.useState(""); entityValue = value; return React.createElement(M.EntityTextarea, { value, onChange: setValue, ariaLabel: "关联正文", rows: 2 }); }
  await renderFrame(React.createElement(EntityHarness));
  const entityInput = fd.querySelector('textarea[aria-label="关联正文"]');
  await React.act(async () => { entityInput.focus(); entityInput.dispatchEvent(new fw.CompositionEvent("compositionstart", { bubbles: true })); Object.getOwnPropertyDescriptor(fw.HTMLTextAreaElement.prototype, "value").set.call(entityInput, "/海芙"); entityInput.setSelectionRange(3, 3); entityInput.dispatchEvent(new fw.InputEvent("input", { bubbles: true, isComposing: true, inputType: "insertCompositionText", data: "海芙" })); });
  await key(entityInput, "Enter", { isComposing: true });
  check("IME confirmation is not hijacked by entity autocomplete while composing", entityValue === "/海芙" && !fd.querySelector('.rw-entity-menu'));
  await React.act(async () => entityInput.dispatchEvent(new fw.CompositionEvent("compositionend", { bubbles: true, data: "海芙" })));
  check("Entity search resumes after composition ends inside the bounded textarea", fd.querySelector('.rw-entity-menu [role="option"]')?.textContent.includes("海芙约忒"));
  await key(entityInput, "Enter");
  check("Selecting a slash result preserves the Markdown link and returns the caret to the iframe textarea", entityValue.includes('[海芙约忒](/pets/haifu/)') && !fd.querySelector('.rw-entity-menu') && fd.activeElement === entityInput && entityInput.selectionStart === entityValue.length);
  await click(button(fd, "关联正文：插入词条"));
  check("The explicit insert-entry action remains available after textarea replacement", fd.querySelector('.rw-entity-menu [role="listbox"]') && entityValue.endsWith('/'));
  await React.act(async () => fd.querySelector('#frame-outside').dispatchEvent(pointer(fw, "pointerdown")));
  check("Entity suggestions dismiss using the owning child document", !fd.querySelector('.rw-entity-menu'));
  await renderFrame(null);

  const originalRect = fw.HTMLElement.prototype.getBoundingClientRect;
  fw.HTMLElement.prototype.getBoundingClientRect = function() { return this.classList.contains("rw-select-panel") ? { left: 238, right: 498, width: 260, top: 321, bottom: 481, height: 160 } : this.classList.contains("rw-select") ? { left: 238, right: 398, width: 160, top: 285, bottom: 321, height: 36 } : originalRect.call(this); };
  let selected = "a";
  function SelectHarness() { const [value, setValue] = React.useState("a"); selected = value; return React.createElement(M.CustomSelect, { value, onChange: setValue, ariaLabel: "测试自绘选择", options: [{ value: "a", label: "第一项" }, { value: "b", label: "禁用项", disabled: true }, { value: "c", label: "第三项" }] }); }
  await renderFrame(React.createElement(SelectHarness));
  await click(fd.querySelector('[role="combobox"]'));
  check("Select flips and offsets using the iframe viewport with mocked geometry", fd.querySelector('.rw-select-panel.opens-up') && fd.querySelector('.rw-select-panel').style.left === "-194px" && fd.querySelector('.rw-select-options').style.maxHeight === "261px");
  await React.act(async () => d.querySelector('#parent-outside').dispatchEvent(pointer(w, "pointerdown")));
  check("A pointer event in the parent page does not dismiss an iframe selection popup", fd.querySelector('.rw-select-panel'));
  await React.act(async () => { fw.dispatchEvent(new fw.Event("scroll")); fd.body.dispatchEvent(new fw.Event("scroll", { bubbles: true })); });
  check("Scroll targets from the iframe window and DOM do not throw cross-realm Node errors", fd.querySelector('.rw-select-panel') && errors.length === 0);
  Object.defineProperties(fw, { innerWidth: { value: 400, configurable: true }, innerHeight: { value: 600, configurable: true } });
  await React.act(async () => fw.dispatchEvent(new fw.Event("resize")));
  check("Iframe resize recomputes popup placement without remounting the field", fd.querySelector('.rw-select-panel') && !fd.querySelector('.opens-up') && fd.querySelector('.rw-select-panel').style.left === "-114px");
  Object.assign(fw.visualViewport, { width: 300, height: 240, offsetLeft: 0, offsetTop: 0 });
  await React.act(async () => fw.visualViewport.dispatchEvent(new fw.Event("resize")));
  Object.assign(fw.visualViewport, { offsetLeft: 80, offsetTop: 120 });
  await React.act(async () => fw.visualViewport.dispatchEvent(new fw.Event("scroll")));
  check("A visual-viewport scroll recomputes select horizontal bounds and space above the field", fd.querySelector('.rw-select-panel.opens-up') && fd.querySelector('.rw-select-panel').style.left === "-134px" && fd.querySelector('.rw-select-options').style.maxHeight === "141px");
  for (const property of ["width", "height", "offsetLeft", "offsetTop"]) delete fw.visualViewport[property];
  await React.act(async () => fw.visualViewport.dispatchEvent(new fw.Event("resize")));
  await React.act(async () => fd.querySelector('#frame-outside').dispatchEvent(pointer(fw, "pointerdown")));
  check("The owning document's outside-pointer event closes the custom popup", !fd.querySelector('.rw-select-panel'));
  await key(fd.querySelector('[role="combobox"]'), "ArrowDown");
  await key(fd.querySelector('[role="combobox"]'), "ArrowDown");
  await key(fd.querySelector('[role="combobox"]'), "Enter", { isComposing: true });
  check("Custom selection ignores composition Enter and retains the open choice", selected === "a" && fd.querySelector('.rw-select-panel'));
  await key(fd.querySelector('[role="combobox"]'), "Enter");
  check("Keyboard choice skips disabled options and restores focus in the correct document", selected === "c" && !fd.querySelector('.rw-select-panel') && fd.activeElement === fd.querySelector('[role="combobox"]'));
  await click(fd.querySelector('[role="combobox"]'));
  await renderFrame(null);
  check("Unmounting an open select removes child-document, scroll and viewport listeners", docTrack.count("pointerdown") === 0 && winTrack.count("resize") === 0 && winTrack.count("scroll") === 0 && viewportTrack.count("resize") === 0 && viewportTrack.count("scroll") === 0);
  fw.HTMLElement.prototype.getBoundingClientRect = originalRect;

  let broken = true, resetKey = "first";
  function Failure() { if (broken) throw new Error("controlled-interface-test"); return React.createElement("p", { id: "recovered-content" }, "恢复后的内容"); }
  function OutsideSibling() { const [count, setCount] = React.useState(0); return React.createElement("button", { id: "outside-boundary", onClick: () => setCount(value => value + 1) }, String(count)); }
  const recoveryTree = () => React.createElement(React.Fragment, null, React.createElement(OutsideSibling), React.createElement(M.RecoveryBoundary, { resetKey }, React.createElement(Failure)));
  await renderParent(recoveryTree());
  check("A component failure renders actionable recovery controls instead of removing its sibling", d.querySelector('.rw-recovery-v73[role="alert"]') && button(d, "重新显示") && d.querySelector('#outside-boundary'));
  await click(d.querySelector('#outside-boundary')); await click(button(d, "重新显示"));
  check("A repeated failure remains recoverable while an outside sibling keeps its state", d.querySelector('.rw-recovery-v73') && d.querySelector('#outside-boundary').textContent === "1");
  broken = false; await click(button(d, "重新显示"));
  check("Retry renders recovered content without remounting the outside page state", d.querySelector('#recovered-content') && !d.querySelector('.rw-recovery-v73') && d.querySelector('#outside-boundary').textContent === "1");
  broken = true; await renderParent(recoveryTree()); broken = false; resetKey = "second"; await renderParent(recoveryTree());
  check("Changing the route reset key clears a previous rendering fault", d.querySelector('#recovered-content') && !d.querySelector('.rw-recovery-v73') && d.querySelector('#outside-boundary').textContent === "1");

  const actor = "20000000-0000-4000-8000-000000000001", commentId = `comment:${actor}`;
  const social = M.emptySocialState(); social.comments = [{ id: commentId, targetId: "/pets/haifu/", targetTitle: "海芙约忒", href: "/pets/haifu/", authorId: actor, author: "核对者", avatar: "haifu", body: "验证锚点能回到本条讨论。", at: "2026-10-01T00:00:00Z" }];
  w.localStorage.setItem(M.COMMUNITY_STORAGE_KEY, JSON.stringify({ version: 1, profile: { uuid: actor, nickname: "核对者", avatar: "haifu" }, submissions: [] }));
  w.localStorage.setItem(M.SOCIAL_STORAGE_KEY, JSON.stringify(social));
  await go('/pets/haifu/#discussion'); await renderParent(React.createElement(M.PageCommunityFooter));
  check("Opening #discussion expands the existing discussion panel", d.querySelector('#discussion')?.open && scrolls.some(row => row.id === "discussion" && row.document === d));
  const anchor = M.commentAnchor(commentId);
  await go(`/pets/haifu/#${anchor}`);
  check("An activity-record comment anchor matches the actual comment and receives focus scrolling", M.commentEntryHref(social.comments[0]) === `/pets/haifu/#${anchor}` && d.getElementById(anchor) && d.querySelector('#discussion').open && scrolls.some(row => row.id === anchor && row.document === d));
  await go('/pets/haifu/#comment-no-longer-present');
  check("A missing comment target falls back to its discussion panel instead of throwing", d.querySelector('#discussion').open && scrolls.at(-1).id === "discussion");
  await go('/account/#discussion');
  check("Account and editor routes do not introduce a second discussion composer", !d.querySelector('#discussion') && d.querySelector('.rw-maintainers-v72'));
  await go('/pve/');
  await renderParent(React.createElement(React.Fragment, null, React.createElement(M.PreviewHeader), React.createElement(M.PvePages, { path: "/pve/", query: new URLSearchParams() }), React.createElement(M.PreviewFooter)));
  const create = d.querySelector('.rw-pagehead .rw-actions .rw-catalog-create-v73');
  const createUrl = create && new URL(create.getAttribute('href'), 'https://wiki.test');
  check("PVE creation is a prominent page-heading action connected to the correct typed editor", create?.textContent.includes("新增玩法") && createUrl?.pathname === "/edit/" && createUrl.searchParams.get("mode") === "pve-guide" && createUrl.searchParams.get("intent") === "add");
  const footer = d.querySelector('.rw-footer-v73');
  check("Footer removes duplicate account/check-in destinations and preserves useful maintenance and official links", footer && ![...footer.querySelectorAll('a')].some(link => /^\/account\//.test(link.getAttribute('href') || '')) && footer.querySelector('a[href="/help/contributing/"]') && footer.querySelector('a[href="/history/"]') && footer.querySelector('a[href="https://17roco.qq.com/"]'));
  check("Header and footer use the same player-built encyclopedia declaration", d.querySelector('.rw-wordmark small').textContent === footer.querySelector('.rw-footer-brand > div > span').textContent && footer.querySelector('.rw-footer-brand > div > span').textContent === '洛克王国页游 · 玩家共建百科');
  let feedbackEvents = 0; const feedback = () => feedbackEvents++; w.addEventListener('roco:open-feedback', feedback);
  await click(button(footer, '反馈本页问题')); w.removeEventListener('roco:open-feedback', feedback);
  check("Footer issue feedback triggers the existing contextual feedback action", feedbackEvents === 1);
  const boundedCss = fs.readFileSync(path.join(project, 'src/wiki/BoundedTextarea.css'), 'utf8'), globalCss = fs.readFileSync(path.join(project, 'src/css/v73.css'), 'utf8'), headerCss = fs.readFileSync(path.join(project, 'src/css/v7.css'), 'utf8'), footerCss = fs.readFileSync(path.join(project, 'src/css/v72.css'), 'utf8');
  check("CSS contract keeps input containers bounded and provides a vertical-only custom grip", /\.rw-bounded-textarea\{[^}]*max-width:100%/.test(boundedCss) && boundedCss.includes('resize:none!important') && boundedCss.includes('cursor:ns-resize'));
  check("CSS contract includes a narrow single-column footer and consistent Georgia wordmark", globalCss.includes('@media(max-width:360px)') && globalCss.includes('.rw-footer-v73>nav { grid-template-columns: minmax(0,1fr); }') && headerCss.includes('font-family: Georgia, "Times New Roman", serif') && /rw-footer-brand strong[^}]*Georgia/.test(footerCss));
  check("Only deliberately thrown boundary faults were caught, with no unrelated React/runtime errors", expectedBoundaryErrors.length >= 3 && expectedBoundaryErrors.every(error => error.includes('controlled-interface-test')) && errors.length === 0);
  const sourceFiles = ['src/wiki/BoundedTextarea.jsx', 'src/wiki/BoundedTextarea.css', 'src/wiki/EntityTextarea.jsx', 'src/wiki/Select.jsx', 'src/wiki/WikiRecoveryBoundary.jsx', 'src/wiki/PageCommunityFooter.jsx', 'src/wiki/pageCommunityModel.js', 'src/wiki/core.jsx', 'src/wiki/PvePages.jsx', 'src/css/v73.css', 'src/css/v72.css', 'src/css/v7.css'];
  const report = { version: '7.3', scope: 'React interaction checks for iframe-owned input/select lifecycle, IME and entity selection, recoverable render failures, discussion deep links, footer/navigation actions; mocked geometry and CSS contracts are not browser visual QA', generatedAt: new Date().toISOString(), total: checks.length, passed: checks.filter(row => row.pass).length, checks, errors, controlledFaults: expectedBoundaryErrors.length, sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(project, file))).digest('hex')])) };
  fs.writeFileSync(path.join(project, 'validation/v73-interface-check-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`V7.3 interface: ${report.passed}/${report.total} passed`);
}
main().catch(error => { originalError(error); process.exitCode = 1; }).finally(async () => { for (const root of roots) await React.act(async () => root.unmount()); dom?.window.close(); console.error = originalError; fs.rmSync(temporary, { recursive: true, force: true }); });
