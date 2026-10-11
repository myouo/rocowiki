import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd(),src=path.join(root,'apps/web/src'),content=path.join(root,'apps/web/content');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const files=walk(src).filter(file=>/\.(js|jsx|ts|tsx)$/.test(file)&&!file.endsWith('.d.ts'));
const violations=[],graph=new Map();
function resolve(from,specifier){
  if(!specifier.startsWith('.'))return null;
  const target=path.resolve(path.dirname(from),specifier);
  return [target,...['.js','.jsx','.ts','.tsx','.json'].map(ext=>target+ext),...['index.js','index.jsx','index.ts','index.tsx'].map(file=>path.join(target,file))].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile())||target;
}
for(const file of files){
  const text=fs.readFileSync(file,'utf8'),relative=path.relative(root,file);
  if(text.split('\n').length>1000)violations.push(`${relative}: exceeds 1000 lines; split by domain`);
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const imports=source.statements.filter(node=>ts.isImportDeclaration(node)||ts.isExportDeclaration(node)).flatMap(node=>node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)?[node.moduleSpecifier.text]:[]);
  const dependencies=imports.map(specifier=>resolve(file,specifier)).filter(Boolean);graph.set(file,dependencies);
  for(const dependency of dependencies){
    if(dependency.startsWith(content+path.sep)&&file!==path.join(src,'wiki/content/bundled.js'))violations.push(`${relative}: content JSON must enter through wiki/content/bundled.js`);
    if(/(?:Model|model)\.js$/.test(file)&&dependency.endsWith('.jsx'))violations.push(`${relative}: model imports a UI component ${path.relative(src,dependency)}`);
  }
  if(/(?:Model|model)\.js$/.test(file)&&imports.some(name=>name==='react'||name.startsWith('@docusaurus/')))violations.push(`${relative}: model depends on a UI framework`);
}
// Newly separated feature modules must remain acyclic. Legacy application-wide cycles are outside this gate.
for(const domain of ['community','catalog','world']){
  const prefix=path.join(src,'wiki',domain)+path.sep,visited=new Set();
  const visit=(file,ancestors=[])=>{
    if(ancestors.includes(file)){violations.push(`Cycle in ${domain}: ${[...ancestors,file].map(f=>path.relative(src,f)).join(' -> ')}`);return;}
    if(visited.has(file))return;
    for(const dep of graph.get(file)||[])if(dep.startsWith(prefix))visit(dep,[...ancestors,file]);
    visited.add(file);
  };
  files.filter(file=>file.startsWith(prefix)).forEach(file=>visit(file));
}
if(violations.length){console.error(violations.join('\n'));process.exitCode=1;}
else console.log(`Web architecture boundaries passed: ${files.length} modules, centralized content inputs and acyclic feature folders.`);
