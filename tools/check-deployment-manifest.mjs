import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('supabase/functions/deployment-manifest.json','utf8'));
for(const service of manifest.services){
 assert(service.files.includes(service.entrypoint),service.name+' is missing its entrypoint');
 const files=new Set(service.files.map(file=>path.resolve(file)));
 for(const file of service.files){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.[^'"]+)['"]/g)){
   const dependency=path.resolve(path.dirname(file),match[1]);
   assert(files.has(dependency),service.name+': missing deployment dependency '+match[1]+' from '+file);
  }
 }
}
console.log('DEPLOYMENT MANIFEST: '+manifest.services.length+' complete service bundles, including shared dependencies');
