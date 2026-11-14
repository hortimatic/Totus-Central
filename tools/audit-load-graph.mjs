import fs from 'node:fs/promises';
import path from 'node:path';

// Inspect source imports without evaluating application code or contacting services.
export async function moduleGraph(entry){
 const files=new Map();
 async function visit(name){
  if(files.has(name))return;
  const code=await fs.readFile(name,'utf8');
  const imports=[...code.matchAll(/(?:\bfrom\s*|\bimport\s*)(['"])(\.[^'"]+\.m?js)\1/g)]
   .map(match=>path.posix.normalize(path.posix.join(path.posix.dirname(name),match[2])));
  files.set(name,{name,bytes:Buffer.byteLength(code),imports});
  for(const dependency of imports)await visit(dependency);
 }
 await visit(entry);
 const depth=(name,seen=new Set())=>seen.has(name)?0:
  1+Math.max(0,...files.get(name).imports.map(dependency=>depth(dependency,new Set([...seen,name]))));
 return {
  entry,requests:files.size,bytes:[...files.values()].reduce((total,file)=>total+file.bytes,0),
  depth:depth(entry),largest:[...files.values()].sort((a,b)=>b.bytes-a.bytes).slice(0,10),
  files:[...files.keys()]
 };
}
const graph=await moduleGraph('src/app.js');
await fs.mkdir('qa-artifacts/audit-20261114',{recursive:true});
await fs.writeFile('qa-artifacts/audit-20261114/module-graph-working.json',JSON.stringify(graph,null,2));
console.log(JSON.stringify({...graph,files:undefined,largest:graph.largest.map(({name,bytes})=>({name,bytes}))},null,2));
