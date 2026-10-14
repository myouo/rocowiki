/** V7.3.1 horizontal node/edge correspondence. Source + JSDOM, not browser geometry. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const React = require('react');
const { act } = React;
const esbuild = require('esbuild');

const project = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'roco-v731-flow-'));
const sourceFiles = ['src/wiki/SkillBranchView.jsx', 'src/wiki/SkillBranchView.css', 'src/wiki/skillFlow.js', 'src/wiki/skillConditions.js', 'validation/check-v731-flow.cjs'];
const checks = [], runtimeErrors = [];
const check = (name, pass) => { checks.push({ name, pass: Boolean(pass) }); assert.ok(pass, name); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortedEdges = edges => edges.map(({ from, to, label }) => [from, to, label]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
let root, dom, previousNavigator, previousConsoleError;

async function main() {
  await esbuild.build({
    stdin: { resolveDir: project, loader: 'jsx', contents: `export * from './src/wiki/SkillBranchView';export * from './src/wiki/skillFlow';export * from './src/wiki/skillConditions';` },
    outfile: path.join(temporary, 'check.cjs'), bundle: true, platform: 'node', format: 'cjs', loader: { '.css': 'empty' }, logLevel: 'silent',
    plugins: [require('./runtime-context-plugin.cjs'), { name: 'framework', setup(build) {
      build.onResolve({ filter: /^(react|react-dom|lucide-react)(\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [project] }), external: true }));
      build.onResolve({ filter: /^@docusaurus\// }, args => ({ path: args.path, namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ loader: 'jsx', resolveDir: project, contents: args.path.endsWith('/Link') ? `import React from 'react';export default function Link({to,children,...rest}){return <a href={to} {...rest}>{children}</a>}` : args.path.endsWith('/router') ? `export function useHistory(){return {push(){},replace(){}}};export function useLocation(){return {pathname:'/',search:''}}` : `export default function useBaseUrl(value){return value}` }));
    } }]
  });
  dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'https://wiki.test/skills/layout-check/', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  Object.assign(global, { window: w, document: d, HTMLElement: w.HTMLElement, CustomEvent: w.CustomEvent, localStorage: w.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  previousNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
  Object.defineProperty(global, 'navigator', { configurable: true, value: w.navigator });
  // Width enables the existing horizontal preference; no pixel-position or
  // browser rendering assertions are derived from this mock.
  w.HTMLElement.prototype.getBoundingClientRect = function () { return { width: 960, height: 0, x: 0, y: 0, top: 0, left: 0, right: 960, bottom: 0 }; };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  previousConsoleError = console.error;
  console.error = (...args) => runtimeErrors.push(args.map(String).join(' '));
  const css = fs.readFileSync(path.join(project, 'src/wiki/SkillBranchView.css'), 'utf8');
  const style = d.createElement('style'); style.textContent = css; d.head.append(style);
  const C = require(path.join(temporary, 'check.cjs'));
  const { createRoot } = require('react-dom/client');
  root = createRoot(d.getElementById('root'));
  async function render(node) { await act(async () => { root.render(node); await pause(); }); await act(async () => { await pause(); }); }
  async function click(scope, text) { const button = [...scope.querySelectorAll('button')].find(node => node.textContent.trim() === text); assert.ok(button, `Button exists: ${text}`); await act(async () => { button.click(); await pause(); }); }
  const rounds = (start, end = start, basis = 'skill-sequence') => ({ kind: 'rounds', basis, mode: 'ranges', ranges: [{ start, end }] });
  const clause = text => ({ kind: 'clause', text });
  const fixture = {
    name: '分支对应测试', summary: '仅用于布局验证的合成数据。', common: ['基础效果甲', '基础效果乙'],
    phases: [
      { id: 'rounds', label: '第 1 回合', conditionTree: rounds(1), effect: '首段成立效果\n首段随后效果', children: [
        { label: '第 2–5 回合', conditionTree: { kind: 'group', operator: 'all', children: [rounds(2, 5), clause('本分支标记仍存在')] }, effect: '中间回合效果', children: [
          { label: '第 6 回合', conditionTree: rounds(6), effect: '末段回合效果' }
        ] }
      ], otherwiseBranch: { relation: 'else', effect: '首段未成立效果', children: [{ conditionTree: rounds(4, 5, 'battle-round'), effect: '否则下级效果' }] } },
      { id: 'independent', label: '并列环境条件', conditionTree: clause('天气条件成立'), effect: '天气对应效果', otherwiseBranch: { relation: 'independent', conditionTree: clause('环境条件成立'), effect: '环境对应效果' } },
      { id: 'else-if', label: '先判断再继续', conditionTree: clause('首个判断成立'), effect: '首个判断效果', otherwiseBranch: { relation: 'else-if', conditionTree: { kind: 'group', operator: 'any', children: [rounds(3, 4), clause('备用条件成立')] }, effect: '后续判断效果' } },
      { id: 'children-only', label: '不虚构空效果', conditionTree: clause('进入无中间效果的判断'), effect: '', children: [{ conditionTree: rounds(2), effect: '直接进入的成立下级效果' }], otherwiseBranch: { relation: 'else', effect: '', children: [{ conditionTree: rounds(5), effect: '直接进入的否则下级效果' }] } }
    ]
  };
  const longText = '长段文字与链接都必须完整留在所属节点中。'.repeat(70) + '[海芙约忒](/pets/haifuyueti/)';
  const cases = [
    ['nested round / otherwise / independent / else-if', fixture],
    ['same labels are distinct occurrences', { name: '重复文本', phases: [{ label: '同名判断', when: '同一条件', effect: '甲分支效果', otherwise: '甲分支否则' }, { label: '同名判断', when: '同一条件', effect: '乙分支效果', otherwise: '乙分支否则' }] }],
    ['long effects remain complete', { name: '长文本', common: Array.from({ length: 16 }, (_, i) => `长顺序效果 ${i + 1}`), phases: [{ label: '很长的条件', when: longText, effect: longText, otherwise: '短的另一分支' }] }],
    ['only unconditioned effects', { name: '基础效果', common: ['基础一', '基础二'] }],
    ['an unrecorded reverse result has no invented edge', { name: '单向效果', phases: [{ when: '仅记载成立结果', effect: '已知效果' }] }],
    ['empty graph is one root', { name: '空资料' }]
  ];
  function flatten(tree, nodes = [], edges = []) { nodes.push(tree.node.id); if (tree.edge) edges.push(tree.edge); tree.children.forEach(child => flatten(child, nodes, edges)); return { nodes, edges }; }
  for (const [name, data] of cases) {
    const before = JSON.stringify(data), vertical = C.buildSkillFlowGraph(data), horizontal = C.buildSkillFlowGraph(data, { direction: 'horizontal' }), layout = flatten(C.buildSkillFlowTree(horizontal));
    check(`${name}: layout preserves every node once`, equal(layout.nodes.slice().sort(), horizontal.nodes.map(node => node.id).sort()) && new Set(layout.nodes).size === horizontal.nodes.length);
    check(`${name}: layout preserves every from/to/label edge`, equal(sortedEdges(layout.edges), sortedEdges(horizontal.edges)));
    check(`${name}: vertical and horizontal export differ only by direction`, vertical.mermaid.startsWith('flowchart TD\n') && horizontal.mermaid.startsWith('flowchart LR\n') && vertical.mermaid.split('\n').slice(1).join('\n') === horizontal.mermaid.split('\n').slice(1).join('\n') && equal(vertical.nodes, horizontal.nodes) && equal(vertical.edges, horizontal.edges));
    check(`${name}: input is unchanged and graph has one parent per non-root`, JSON.stringify(data) === before && horizontal.edges.length === horizontal.nodes.length - 1 && new Set(horizontal.edges.map(edge => edge.to)).size === horizontal.edges.length);
  }
  const graph = C.buildSkillFlowGraph(fixture, { direction: 'horizontal' });
  const byLabel = label => graph.nodes.find(node => node.label === label);
  const primary = index => graph.nodes.find(node => node.branchIndex === index);
  const incoming = node => graph.edges.find(edge => edge.to === node.id);
  const hasEdge = (from, to, label) => graph.edges.some(edge => edge.from === from.id && edge.to === to.id && edge.label === label);
  check('True and false outcomes both originate in their actual first-round decision', hasEdge(primary(0), byLabel('首段成立效果'), '成立') && hasEdge(primary(0), byLabel('首段未成立效果'), '不成立'));
  check('Ordered effects retain their subsequent edge before nested rounds', hasEdge(byLabel('首段成立效果'), byLabel('首段随后效果'), '随后') && graph.nodes.find(node => node.id === graph.edges.find(edge => edge.from === byLabel('首段随后效果').id).to).role === 'child-context');
  const independent = graph.nodes.find(node => node.role === 'independent-condition');
  check('Independent conditions share a hub and are not attached to the first condition false path', incoming(primary(1)).from === incoming(independent).from && incoming(independent).label === '独立判断' && !graph.edges.some(edge => edge.from === primary(1).id && edge.to === independent.id));
  const elseIf = graph.nodes.find(node => node.role === 'else-if-condition');
  check('Else-if is reached only by the original condition not being satisfied', hasEdge(primary(2), elseIf, '不成立') && hasEdge(elseIf, byLabel('后续判断效果'), '成立'));
  const noIntermediate = graph.edges.filter(edge => edge.from === primary(3).id);
  check('Empty effects connect straight to separate true/false child contexts', noIntermediate.length === 2 && equal(noIntermediate.map(edge => edge.label).sort(), ['不成立', '成立'].sort()) && noIntermediate.every(edge => graph.nodes.find(node => node.id === edge.to).role === 'child-context'));
  const simpleGraph = C.buildSkillFlowGraph(cases[4][1]);
  check('A missing reverse effect does not create an unrecorded not-satisfied path', !simpleGraph.edges.some(edge => edge.label === '不成立'));
  const n = id => ({ id, label: id, type: 'effect', role: 'effect' });
  const e = (from, to) => ({ from, to, label: '' });
  for (const [name, input, pattern] of [
    ['DAG merges are rejected rather than dropped or duplicated', { nodes: ['r', 'a', 'b', 'x'].map(n), edges: [e('r', 'a'), e('r', 'b'), e('a', 'x'), e('b', 'x')] }, /合流/],
    ['Cycles are rejected rather than recursively duplicated', { nodes: ['r', 'a'].map(n), edges: [e('r', 'a'), e('a', 'r')] }, /循环/],
    ['Disconnected cyclic components cannot disappear', { nodes: ['r', 'a', 'b'].map(n), edges: [e('a', 'b'), e('b', 'a')] }, /未连接|循环/],
    ['Dangling edge targets cannot disappear', { nodes: [n('r')], edges: [e('r', 'missing')] }, /不存在/],
    ['Duplicate node IDs cannot overwrite another node', { nodes: [n('r'), n('r')], edges: [] }, /重复/]
  ]) { let message = ''; try { C.buildSkillFlowTree(input); } catch (error) { message = error.message; } check(name, pattern.test(message)); }

  const actions = [];
  function FlowCase({ data, name }) { return React.createElement('section', { 'data-case': name }, React.createElement(C.SkillEffectFlow, { data, baseAction: React.createElement('button', { type: 'button', 'data-edit-base': true, onClick: () => actions.push('base') }, '编辑基础'), actionFor: (branch, index) => React.createElement('button', { type: 'button', 'data-edit-branch': index, onClick: () => actions.push([index, branch.id]) }, `编辑分支 ${index + 1}`) })); }
  await render(React.createElement(React.Fragment, null, React.createElement(FlowCase, { data: fixture, name: 'first' }), React.createElement(FlowCase, { data: fixture, name: 'second' })));
  const first = d.querySelector('[data-case=first]'), second = d.querySelector('[data-case=second]');
  const verticalMarkup = first.querySelector('.rw-skill-branch-list').innerHTML;
  await click(first, '横向');
  check('Horizontal selection swaps the body into the real graph reader', first.querySelector('[data-skill-flow]').dataset.flowDirection === 'horizontal' && !!first.querySelector('[data-flow-graph=tree]') && !first.querySelector('.rw-flow-paths'));
  check('Selecting one flow leaves the other flow vertical', second.querySelector('[data-skill-flow]').dataset.flowDirection === 'vertical' && !second.querySelector('[data-flow-graph]'));

  function verifyRenderedGraph(scope, expected, name) {
    const scroll = scope.querySelector('[data-flow-graph=tree]');
    const nodes = [...scroll.querySelectorAll('[data-flow-node-id]')], edgeElements = [...scroll.querySelectorAll('[data-flow-edge-from]')];
    const edges = edgeElements.map(node => ({ from: node.dataset.flowEdgeFrom, to: node.dataset.flowEdgeTo, label: node.dataset.flowEdgeLabel }));
    check(`${name}: every actual node ID appears once`, equal(nodes.map(node => node.dataset.flowNodeId).sort(), expected.nodes.map(node => node.id).sort()) && new Set(nodes.map(node => node.id)).size === nodes.length);
    check(`${name}: every rendered edge matches a Mermaid graph edge exactly`, equal(sortedEdges(edges), sortedEdges(expected.edges)));
    check(`${name}: each edge belongs to the actual source subtree and destination child`, edgeElements.every(edge => {
      const item = edge.parentElement, childTree = edge.nextElementSibling, sourceTree = item.parentElement.parentElement;
      return item.dataset.flowChildId === edge.dataset.flowEdgeTo && item.parentElement.dataset.flowParentId === edge.dataset.flowEdgeFrom && childTree.dataset.flowSubtreeRoot === edge.dataset.flowEdgeTo && childTree.querySelector(':scope > [data-flow-node-id]').dataset.flowNodeId === edge.dataset.flowEdgeTo && sourceTree.querySelector(':scope > [data-flow-node-id]').dataset.flowNodeId === edge.dataset.flowEdgeFrom;
    }));
    check(`${name}: branch labels are attached to the same incoming edge`, edgeElements.every(edge => (edge.querySelector('.rw-flow-horizontal-edge-label')?.textContent || '') === edge.dataset.flowEdgeLabel));
    check(`${name}: text and structured conditions remain attached to their node`, nodes.every(element => {
      const node = expected.nodes.find(row => row.id === element.dataset.flowNodeId);
      if (element.getAttribute('aria-label') !== node.label) return false;
      if (node.type === 'decision') {
        function leaves(condition) { return condition.kind === 'group' ? condition.children.flatMap(leaves) : condition.kind === 'rounds' ? [C.roundBasisLabel(condition.basis, condition.basisNote || ''), ...(condition.ranges || []).map(range => C.rangeLabel(range, condition.basis))] : [condition.text || '条件待补充']; }
        return leaves(node.conditionTree).every(text => element.textContent.replace(/\s/g, '').includes(text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s/g, '')));
      }
      return element.textContent.replace(/\s/g, '').includes(node.label.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s/g, ''));
    }));
    return { scroll, nodes, edgeElements };
  }
  const rendered = verifyRenderedGraph(first, graph, 'Complex branching UI');
  check('The graph region has its own keyboard-accessible scroll and explanation', rendered.scroll.getAttribute('tabindex') === '0' && rendered.scroll.getAttribute('role') === 'region' && d.getElementById(rendered.scroll.getAttribute('aria-describedby'))?.textContent.includes('横向滚动'));
  check('Only the graph expands in width; its outer region stays contained', w.getComputedStyle(rendered.scroll).overflow === 'auto' && w.getComputedStyle(rendered.scroll).maxWidth === '100%' && w.getComputedStyle(rendered.scroll.querySelector('.rw-flow-horizontal-canvas')).width === 'max-content');
  check('Every subtree and node align by natural centre rather than a fixed height', [...rendered.scroll.querySelectorAll('.rw-flow-horizontal-tree')].every(element => w.getComputedStyle(element).display === 'flex' && w.getComputedStyle(element).alignItems === 'center') && rendered.nodes.every(element => ['', 'auto'].includes(w.getComputedStyle(element).height) && ['', 'none'].includes(w.getComputedStyle(element).maxHeight)));
  check('Incoming edges anchor to the centre of their own subtree', rendered.edgeElements.every(element => w.getComputedStyle(element).top === '50%' && w.getComputedStyle(element).transform === 'translateY(-50%)'));
  check('All top-level branch actions remain unique and retain their original branch index', equal([...first.querySelectorAll('[data-edit-branch]')].map(node => Number(node.dataset.editBranch)).sort(), [0, 1, 2, 3]) && first.querySelectorAll('[data-edit-base]').length === 1);
  await click(first, '编辑分支 3'); await click(first, '编辑基础');
  check('Horizontal edit actions still target the correct branch and base', equal(actions, [[2, 'else-if'], 'base']));
  let copied = '';
  Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
  await click(first, '复制为 Mermaid');
  check('Copied horizontal Mermaid contains exactly the graph displayed', copied === graph.mermaid);
  await click(second, '横向');
  const bothIds = [...d.querySelectorAll('[data-flow-node-id]')].map(node => node.id);
  check('Two copies of the same graph use distinct document IDs', new Set(bothIds).size === bothIds.length);
  await click(first, '纵向');
  check('Returning to vertical preserves the original rich cards and all actions', first.querySelector('.rw-skill-branch-list').innerHTML === verticalMarkup && !first.querySelector('[data-flow-graph]') && second.querySelector('[data-skill-flow]').dataset.flowDirection === 'horizontal');
  await click(first, '复制为 Mermaid');
  check('Copied vertical Mermaid changes direction only', copied === C.skillToMermaid(fixture) && copied.split('\n').slice(1).join('\n') === graph.mermaid.split('\n').slice(1).join('\n'));
  const selectedButton = first.querySelector('.rw-branch-navigator [aria-label="选择分支 1.1：第 2–5 回合"]');
  await act(async () => selectedButton.click());
  check('Selecting a descendant retains parent conditions while hiding unrelated roots', first.querySelector('.rw-flow-focus-note').textContent.includes('第 2–5 回合') && first.querySelector('.rw-skill-branch-list').textContent.includes('第 1 回合') && !first.querySelector('.rw-skill-branch-list').textContent.includes('并列环境条件'));
  await click(first, '复制为 Mermaid');
  check('Focused viewing still exports the complete condition tree', copied === C.skillToMermaid(fixture) && copied.includes('环境对应效果'));
  await click(first, '横向');
  check('Horizontal focus identifies the chosen occurrence even when the filtered path changes', first.querySelector('[data-flow-selected="true"]').dataset.flowBranchPath === '0.children.0' && first.querySelector('[data-flow-selected="true"]').textContent.includes('第 2–5 回合'));
  const selectedAction = first.querySelector('.rw-flow-focus-note [data-edit-branch]');
  await act(async () => selectedAction.click());
  check('Focused editing keeps the original root record identity', equal(actions.at(-1), [0, 'rounds']));
  await click(first, '返回全部分支');
  verifyRenderedGraph(first, graph, 'Restored complete graph after focus');

  for (const [name, data] of cases.slice(1, -1)) {
    await render(React.createElement(C.SkillEffectFlow, { key: name, data, initialDirection: 'horizontal' }));
    verifyRenderedGraph(d.getElementById('root'), C.buildSkillFlowGraph(data, { direction: 'horizontal' }), name);
  }
  check('Long content is allowed to wrap and no graph node has overflow clipping or line clamps', css.includes('white-space:normal;overflow-wrap:anywhere') && !/\.rw-flow-horizontal[^{}]*\{[^{}]*(?:overflow:hidden|overflow:clip|line-clamp|max-height:)/.test(css));
  check('The obsolete sticky decision and fixed left-37px arrows are removed', !css.includes('position:sticky') && !css.includes('top:37px;left:-24px') && !css.includes('minmax(170px,.75fr) minmax(0,1.5fr)'));
  check('The shared connector trunk stops at the first and last actual child centres', css.includes('.rw-flow-horizontal-child:first-child:before{top:50%}') && css.includes('.rw-flow-horizontal-child:last-child:before{bottom:50%}') && css.includes('.rw-flow-horizontal-child:only-child:before{display:none}'));
  check('Single-child chains do not accumulate empty vertical padding', css.includes('.rw-flow-horizontal-children>.rw-flow-horizontal-child:only-child{padding:0!important}'));
  check('Horizontal nodes and graph region keep rounded card styling', css.includes('border-radius:18px') && css.includes('border-radius:20px'));
  check('Graph text and Mermaid labels continue to escape syntax delimiters', C.skillToMermaid({ name: '中文"[]|', common: '效果 <&>' }, { direction: 'horizontal' }).includes('#34;#91;#93;#124;'));
  check('Targeted interactions produce no React runtime errors', runtimeErrors.length === 0);
}

main().then(async () => {
  if (root) await act(async () => root.unmount());
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(project, file))).digest('hex')]));
  fs.writeFileSync(path.join(__dirname, 'v731-flow-check.json'), JSON.stringify({
    suite: 'V7.3.1 horizontal graph node and edge correspondence', checkedAt: new Date().toISOString(), passed: checks.filter(row => row.pass).length, total: checks.length, failed: checks.filter(row => !row.pass).length, checks, sourceHashes,
    graphModel: 'Rooted tree: each authored occurrence has one unique node; all non-root nodes have one incoming edge. Unsupported merges, cycles and dangling references are rejected explicitly.',
    fixtures: 'Synthetic data covers nested round ranges, true/false branches, independent conditions, else-if, empty intermediate effects, duplicate labels, long text and ordered chains.',
    verified: 'Shared graph/DOM from-to-label equality; actual DOM ancestry of every edge; scoped IDs, structured condition text, existing vertical output, edit-action targets, Mermaid direction, and CSS layout/overflow declarations.',
    browserVisualQA: false, lifecycleScope: 'No iframe, preview lifecycle or black-screen diagnosis/testing was performed in V7.3.1.',
    limitations: 'JSDOM has no real layout engine. Pixel connector endpoints, scroll extent, text painting, zoomed screen appearance and device performance were not visually verified. The width mock only enables the existing direction toggle.',
    runtimeErrors
  }, null, 2) + '\n');
  process.stdout.write(`${checks.length}/${checks.length} V7.3.1 flow checks passed\n`);
}).catch(error => { process.stderr.write(error.stack + '\n' + runtimeErrors.join('\n') + '\n'); process.exitCode = 1; }).finally(() => {
  if (previousConsoleError) console.error = previousConsoleError;
  if (previousNavigator) Object.defineProperty(global, 'navigator', previousNavigator);
  dom?.window.close(); fs.rmSync(temporary, { recursive: true, force: true });
});
