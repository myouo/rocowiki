// SPDX-License-Identifier: GPL-3.0-only
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {affectedCatalogRoutes, type Snapshots} from './content-routes';
import {catalog, contentPath} from '../../packages/wiki-schema/src/index';
import {renderMarkdown, validateEntity} from '../../packages/content-validator/src/index';
import {hasLegacyCatalogContext} from '../../packages/wiki-schema/src/catalog-routes';

const root = process.cwd(), site = path.join(root, 'apps/web');
const require = createRequire(path.join(site, 'package.json'));
const {build} = require('esbuild') as typeof import('esbuild');
const {JSDOM} = require('jsdom');
const git = (...args: string[]) => execFileSync('git', args, {cwd:root, encoding:'utf8', maxBuffer:32 * 1024 * 1024});
const normalize = (route: string) => route === '/' ? '/' : `${route.replace(/\/+$/, '')}/`;
const before: Snapshots = {}, after: Snapshots = {};
const baseArg = process.argv.indexOf('--base');
const base = baseArg < 0 ? process.env.CI_BASE_SHA : process.argv[baseArg + 1];
if (base) git('rev-parse', '--verify', `${base}^{commit}`);
const files = base ? git('diff', '--no-renames', '--name-only', '-z', base, '--').split('\0').filter(Boolean) : ['apps/web/content/all.json'];
for (const name of await readdir(path.join(site, 'content'))) {
  if (!name.endsWith('.json')) continue;
  const file = `apps/web/content/${name}`;
  after[name] = JSON.parse(await readFile(path.join(root, file), 'utf8'));
  if (base && git('ls-tree', base, '--', file)) before[name] = JSON.parse(git('show', `${base}:${file}`));
}
const selected = affectedCatalogRoutes(before, after, files);
for (const route of after['routes.json'] as unknown as string[]) selected.add(route);
// Legacy articles and mixed/placeholder data have distinct presentation branches.
for (const kind of ['pets', 'skills']) for (const row of after[`official-${kind}.json`][kind]) {
  if (kind === 'pets' ? !row.stats : row.power === null) { selected.add(`/${kind}/${row.id}/`); break; }
}
const plugin = require(path.join(site, 'plugins/wiki-routes/index.js'))({siteDir:site, baseUrl:'/'});
const known = new Set<string>((await plugin.loadContent()).map(normalize));
async function walk(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file)); else result.push(file);
  }
  return result;
}
for (const file of await walk(path.join(site, 'docs'))) {
  if (!/\.mdx?$/.test(file)) continue;
  const slug = (await readFile(file, 'utf8')).match(/^slug:\s*(\/\S+)\s*$/m)?.[1];
  if (!slug) throw new Error(`Missing native document slug: ${file}`);
  known.add(normalize(slug));
}
for (const file of await walk(path.join(site, 'src/pages'))) {
  if (!/\.(?:tsx?|jsx?|mdx?)$/.test(file) || file.endsWith('.d.ts')) continue;
  const route = '/' + path.relative(path.join(site, 'src/pages'), file).replace(/\.(?:tsx?|jsx?|mdx?)$/, '').replace(/(?:^|\/)index$/, '');
  known.add(normalize(route));
}
for (const page of catalog) known.add(normalize(`/wiki/${page.slug}`));

function audit(route: string, html: string) {
  const dom = new JSDOM(html);
  try {
    if (!dom.window.document.querySelector('h1')?.textContent?.trim()) throw new Error(`${route}: missing page title`);
    for (const element of dom.window.document.querySelectorAll('a[href]')) {
      const href = element.getAttribute('href')!;
      if (hasLegacyCatalogContext(href)) throw new Error(`${route}: legacy catalogue context: ${href}`);
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      const target = normalize(decodeURIComponent(new URL(href, 'https://wiki.test').pathname));
      if (!known.has(target)) throw new Error(`${route}: unknown public route: ${href}`);
    }
  } finally { dom.window.close(); }
}

const temp = await mkdtemp(path.join(tmpdir(), 'rocowiki-content-render-'));
try {
  const outfile = path.join(temp, 'render.cjs');
  await build({
    stdin:{resolveDir:site, loader:'jsx', contents:`
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import WikiPage from './src/wiki/WikiPage.jsx';
      import Article from './src/components/Article.tsx';
      export function render(route) { globalThis.__contentRoute = route; return renderToStaticMarkup(<WikiPage />); }
      export function article(html, page) { return renderToStaticMarkup(<Article html={html} page={page} />); }
    `},
    outfile, bundle:true, platform:'node', format:'cjs', loader:{'.css':'empty'}, logLevel:'silent',
    plugins:[{name:'content-render-framework', setup(b) {
      b.onResolve({filter:/^(@docusaurus\/|@theme\/)/}, args => ({path:args.path, namespace:'framework'}));
      b.onLoad({filter:/.*/, namespace:'framework'}, args => ({loader:'jsx', resolveDir:site, contents:
        args.path.endsWith('/Head') ? 'export default function Head(){return null}' :
        args.path.endsWith('/router') ? `export function useLocation(){return {pathname:globalThis.__contentRoute,search:'',hash:''}}; export function useHistory(){return {push(){},replace(){},goBack(){}}}` :
        args.path.endsWith('/useDocusaurusContext') ? `export default function context(){return {siteConfig:{customFields:{workspaceMode:'server',workspaceModeExplicit:true,apiOrigin:'https://api.rocowiki.test'}}}}` :
        args.path.endsWith('/useBrokenLinks') ? 'export default function links(){return {collectAnchor(){},collectLink(){}}}' :
        args.path.endsWith('/useBaseUrl') ? 'export default function base(value){return value}' :
        args.path.endsWith('/Layout') ? `import React from 'react';export default function Layout({children}){return <main>{children}</main>}` :
        args.path.endsWith('/Link') ? `import React from 'react';export default function Link({to,href,children,...rest}){return <a href={to||href} {...rest}>{children}</a>}` :
        (() => {throw new Error('Unsupported framework import: ' + args.path)})()
      }));
    }}],
  });
  const renderer = require(outfile) as {render(route: string): string; article(html: string, page: Record<string, unknown>): string};
  for (const route of selected) audit(route, renderer.render(route));
  // Community prose uses the same sanitiser and Article component as generate-pages.
  for (const page of catalog) {
    const body = await readFile(contentPath(page), 'utf8');
    const data = page.kind === 'article' ? null : validateEntity(page, JSON.parse(body));
    const html = await renderMarkdown(data ? `# ${data.name}\n\n${data.description}` : body);
    audit(`/wiki/${page.slug}/`, renderer.article(html, {id:page.id, title:page.title, source_commit_sha:'content-validation'}));
  }
  console.log(`Content rendering passed: ${selected.size} Wiki routes and ${catalog.length} community pages; full route registry retained. This is a component smoke check, not a production artifact.`);
} finally { await rm(temp, {recursive:true, force:true}); }
