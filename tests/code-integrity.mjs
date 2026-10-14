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
if(!cache['src/config.js'].includes('https://awmojepsasikxocoeqtu.supabase.co'))problems.push('Staging debe permanecer desconectado de producción');
if(cache['src/config.js'].includes('zwkpmjjuurgjygcrejiw'))problems.push('Staging no debe contener credenciales ni dirección de producción');
// Hosting agnóstico: la interfaz debe funcionar como archivos estáticos contra Supabase.
const hostingMarkers=['vercel.app','vercel.com','@vercel/','process.env.vercel','import.meta.env.vercel'];
for(const file of deployable){
 const content=fs.readFileSync(file,'utf8').toLowerCase();
 if(hostingMarkers.some(marker=>content.includes(marker)))problems.push(file+': dependencia de Vercel en código publicado');
}
for(const required of ['index.html','src/app.js','src/api.js','src/config.js','src/styles.css']){
 if(!fs.existsSync(required))problems.push('Falta archivo esencial para alojamiento estático: '+required);
}
if(!cache['src/api.js'].includes('window.supabase.createClient('))problems.push('Supabase: falta conexión directa desde navegador');
for(const name of ['styleMoney','addAutoFilter','quarterStats'])if(new RegExp('\\b'+name+'\\b').test(cache['src/excel.js']))problems.push('Dead Excel helper still in use: '+name);
if(problems.length){console.error('CODE INTEGRITY FAILED\n'+problems.join('\n'));process.exit(1)}
console.log('CODE INTEGRITY: '+source.length+' JS modules and all named imports validated; no duplicate functions or dead Excel helpers');

 
// Regression guard: cleanup must remain read-only and additive API must not drop tables.
for(const sqlPath of ['supabase/cleanup.sql','supabase/totus_api.sql']){
 const sqlText=fs.readFileSync(sqlPath,'utf8');
 const active=sqlText.split(/\r?\n/).filter(line=>!/^\s*--/.test(line));
 if(active.some(line=>/^\s*drop\s+table\b/i.test(line))) {
  console.error('UNSAFE SQL detected in '+sqlPath+': DROP TABLE');
  process.exit(1);
 }
}

const backupSql=fs.readFileSync('supabase/backup.sql','utf8');
const contractStart=backupSql.indexOf('create or replace function public.totus_backup_contract()');
assert.ok(contractStart>=0,'Backup contract missing from SQL source');
const contractEnd=backupSql.indexOf('revoke all on function public.totus_backup_contract()',contractStart);
const contractBody=backupSql.slice(contractStart,contractEnd);
assert.ok(contractBody.includes('as '+String.fromCharCode(36,36)+'\n'+'begin'),'Backup contract opening delimiter invalid');
assert.ok(contractBody.includes('end;\n'+String.fromCharCode(36,36)+';'),'Backup contract closing delimiter invalid');

const restoreSource=fs.readFileSync('src/backup.js','utf8');
const restoreStart=restoreSource.indexOf('export async function restoreBackup(');
assert.ok(restoreStart>=0,'Restore entrypoint missing');
const restoreBody=restoreSource.slice(restoreStart);
assert.ok(restoreBody.includes('await inspectBackup(file)'),'Restore must validate backup before refusing unsafe operations');
assert.ok(restoreBody.includes('throw new Error('),'Restore safety lock must be explicit');
assert.ok(!restoreBody.includes("rpc('totus_restore_backup'"),'Unsafe database restoration must remain blocked');
assert.ok(!restoreSource.includes('async function restoreStorage('),'Unsafe independent storage replacement must remain removed');

// Document paths must never resolve to relative navigation segments.
const {safeFileSegment}=await import('../src/file-utils.js');
for(const input of ['.','..','  ..  '])assert.equal(safeFileSegment(input),'sin_dato','Unsafe document path segment');
assert.equal(safeFileSegment('../factura.pdf'),'.._factura.pdf');

// The backup validator must reject unexpected ZIP members and duplicate manifest paths.
assert.ok(restoreSource.includes("new Set(['manifest.json','database.json'])"),'Backup allowed file list is missing');
assert.ok(restoreSource.includes('new Set(paths).size!==paths.length'),'Backup duplicate path validation is missing');
assert.ok(restoreSource.includes('!expectedEntries.has(name)'),'Unexpected ZIP members must be rejected');

// Contextual help markers must remain available on common financial fields.
const componentSource=fs.readFileSync('src/components.js','utf8');
for(const label of ['Importe pagado','% deducible','Gastos pagados en caja','Recargo (%)','Estado de pago'])assert.ok(componentSource.includes("'"+label+"':"),'Missing contextual help: '+label);
assert.ok(componentSource.includes('fieldHelp(label)'), 'Common fields must display contextual help');

// Field guidance must be usable on touchscreens and by keyboard, not title-only hover hints.
assert.ok(componentSource.includes('<details class="field-help"'),'Contextual help needs native tap-to-open details');
assert.ok(componentSource.includes('<summary aria-label='),'Contextual help needs keyboard-accessible summary');

// Reporting totals must preserve explicit zero values instead of falling back to paid amounts.
const pagesSource=fs.readFileSync('src/pages/main.js','utf8');
assert.ok(!pagesSource.includes('x.gross_expense||x.accounting_amount||x.amount_paid'),'Gastos total must not treat 0 as missing');
assert.ok(pagesSource.includes('x.gross_expense??x.accounting_amount??x.amount_paid??0'),'Gastos total fallback should use nullish values');
