// Source-only inventory. Does not call services or read credentials.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROUTES} from '../src/config.js';
const paths=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n');
const files=paths.filter(p=>/^(src|supabase\/functions)\/.+\.(js|ts)$/.test(p)&&!p.includes('/vendor/'));
const sources=[],rpc={},environment={},origins={};
for(const p of files){
 const text=await fs.readFile(p,'utf8');sources.push({path:p,lines:text.split('\n').length,sha256:createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex')});
 for(const m of text.matchAll(/\brpc\(\s*['"]([a-z_0-9]+)['"]/g))(rpc[m[1]]??=[]).push(p);
 for(const m of text.matchAll(/(?:env|Deno\.env)\.get\(['"]([A-Z][A-Z_0-9]+)['"]\)/g))(environment[m[1]]??=[]).push(p);
 for(const m of text.matchAll(/https:\/\/([a-zA-Z0-9.-]+)/g))(origins[m[1]]??=[]).push(p);
}
const unique=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,[...new Set(v)]]));
const output={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),routes:ROUTES.map(({id,label,group})=>({id,label,group})),sources,rpc:unique(rpc),environment:unique(environment),origins:unique(origins),sql:{migrations:paths.filter(x=>x.startsWith('supabase/migrations/')&&x.endsWith('.sql')).length,reviewPatches:paths.filter(x=>x.startsWith('supabase/review_patches/')&&x.endsWith('.sql')).length},tests:paths.filter(x=>x.startsWith('tests/')&&/\.(mjs|sql)$/.test(x)).length};
await fs.mkdir('artifacts/functional-audit',{recursive:true});await fs.writeFile('artifacts/functional-audit/source-inventory.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({modules:output.routes.length,sourceFiles:sources.length,rpcNames:Object.keys(rpc).length,environmentNames:Object.keys(environment).length,...output.sql,tests:output.tests}));
