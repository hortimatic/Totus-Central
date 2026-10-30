import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const workflow=fs.readFileSync('.github/workflows/publish.yml','utf8').replace(/\r\n/g,'\n');
const found=workflow.match(/python3 - <<'PY'\n([\s\S]*?)\n\s+PY/);
assert.ok(found,'Publication build script must be testable');
const lines=found[1].split('\n'),indent=Math.min(...lines.filter(s=>s.trim()).map(s=>s.match(/^ */)[0].length));
const script=lines.map(s=>s.slice(indent)).join('\n'),sha='a'.repeat(40);
fs.mkdirSync('artifacts',{recursive:true});
const folder=fs.mkdtempSync('artifacts/published-graph-');
for(const file of ['index.html','favicon.svg','fondo_original.png'])fs.copyFileSync(file,path.join(folder,file));
fs.cpSync('src',path.join(folder,'src'),{recursive:true});
fs.cpSync('assets',path.join(folder,'assets'),{recursive:true});
fs.writeFileSync(path.join(folder,'src/graph-fixture.js'),"export {state} from './state.js';\nexport const api=()=>import( './api.js' );\nexport const pdf=()=>import(\"./vendor/pdfjs/pdf.mjs\");\n");
const result=spawnSync(process.env.PYTHON||'python3',['-c',script],{cwd:folder,env:{...process.env,PYTHONUTF8:'1',GITHUB_SHA:sha},encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const sourceDir=path.join(folder,'_site/src');
const graph=[];
for(const relative of fs.readdirSync(sourceDir,{recursive:true}).filter(p=>p.endsWith('.js')&&!p.split(path.sep).join('/').startsWith('vendor/'))){
 const source=fs.readFileSync(path.join(sourceDir,relative),'utf8');
 for(const regex of [/\bfrom\s*['"](\.[^'"]+)['"]/g,/\bimport\s*\(\s*['"](\.[^'"]+)['"]/g]){
  for(const match of source.matchAll(regex)){
   if(!/\.(?:m?js)(?:\?|$)/.test(match[1]))continue;
   const url=new URL(match[1],'https://test.invalid/src/'+relative.split(path.sep).join('/')+'?v='+sha);
   assert.equal(url.searchParams.get('v'),sha,relative+' imports an unversioned module: '+match[1]);
   graph.push(url.href);
  }
 }
}
const fixture=fs.readFileSync(path.join(sourceDir,'graph-fixture.js'),'utf8');
assert.ok(fixture.includes("import( './api.js?v="+sha+"' )"));
assert.ok(fixture.includes('pdf.mjs?v='+sha));
const apiUrls=graph.filter(url=>new URL(url).pathname==='/src/api.js');
assert.ok(apiUrls.length>=3,'Static and lazy imports must both exercise the shared API');
assert.equal(new Set(apiUrls).size,1,'All callers must use exactly the same API module URL');
let html=fs.readFileSync('tests/app-mock.html','utf8')
 .replace('src="mock-supabase.js"','src="/tests/mock-supabase.js"')
 .replaceAll('../node_modules/','/node_modules/')
 .replace('href="../src/styles.css"','href="./_site/src/styles.css"')
 .replace('src="../src/app.js"','src="./_site/src/app.js?v='+sha+'"');
const counter='<script>window.__supabaseCreateCount=0;const original=window.supabase.createClient;window.supabase.createClient=function(...args){window.__supabaseCreateCount++;return original.apply(this,args)};</script>\n';
html=html.replace('<script type="module"',counter+'<script type="module"');
fs.writeFileSync(path.join(folder,'mock.html'),html);
fs.writeFileSync('artifacts/published-graph-location.json',JSON.stringify({folder,sha}));
console.log('PUBLISHED GRAPH QA: actual publication build preserves one static/lazy API identity and versions JS/MJS imports');
