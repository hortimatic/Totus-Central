import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const source=['src/app.js','src/api.js','src/state.js','src/utils.js','src/config.js','src/components.js','src/calculations.js','src/file-utils.js','src/excel.js','src/backup.js','src/pages/main.js'];
const cache=Object.fromEntries(source.map(file=>[file,fs.readFileSync(file,'utf8')]));
const problems=[];
for(const [file,content] of Object.entries(cache)){
 const defs=[...content.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/g)].map(x=>x[1]);
 const duplicated=defs.filter((x,i)=>defs.indexOf(x)!==i);
 if(duplicated.length)problems.push(file+': duplicate function '+[...new Set(duplicated)].join(','));
 for(const statement of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),statement[2]));
  if(!cache[target]){problems.push(file+': module does not exist '+target);continue}
  const exported=cache[target];
  for(const specifier of statement[1].split(',')){
   const name=specifier.trim().split(/\s+as\s+/)[0];
   if(!name)continue;
   const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const exp=new RegExp('export\\s+(?:async\\s+)?(?:const|let|var|function|class)\\s+'+escaped+'(?=\\W|$)|export\\s*\\{[^}]*\\b'+escaped+'\\b');
   if(!exp.test(exported))problems.push(file+': missing named export '+name+' in '+target);
  }
 }
}
// Evitar reincorporar enlaces y servicios pertenecientes a aplicaciones abandonadas.
const deployable=['index.html',...source,'src/styles.css'];
const forbidden=[
 {pattern:/hortimatic\.github\.io\/totus-pricing-demo/i,label:'URL de la aplicación anterior'},
 {pattern:/qgyufbjytcewuevbketz/i,label:'Supabase anterior'},
 {pattern:/totus-pricing-demo/i,label:'Identificador anterior'}
];
for(const file of deployable){
 const content=fs.readFileSync(file,'utf8');
 for(const rule of forbidden)if(rule.pattern.test(content))problems.push(file+': '+rule.label);
}
if(!/https:\/\/zwkpmjjuurgjygcrejiw\.supabase\.co/.test(cache['src/config.js']))problems.push('Supabase: conexión no apunta al proyecto activo');
for(const name of ['styleMoney','addAutoFilter','quarterStats'])if(new RegExp('\\b'+name+'\\b').test(cache['src/excel.js']))problems.push('Dead Excel helper still in use: '+name);
if(problems.length){console.error('CODE INTEGRITY FAILED\n'+problems.join('\n'));process.exit(1)}
console.log('CODE INTEGRITY: '+source.length+' JS modules and all named imports validated; no duplicate functions or dead Excel helpers');
