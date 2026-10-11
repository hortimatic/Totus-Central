import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};

const index=read('index.html');
const core=read('gestion-v6.js');
const modules=read('gestion-v6-features.js');
const css=read('gestion-v6.css');
const shell=read('app-shell-v6.css');

const active=[['index.html',index],['gestion-v6.js',core],['gestion-v6-features.js',modules],['gestion-v6.css',css],['app-shell-v6.css',shell]];
const forbidden=[
 'ops_legacy_daily_rows','ops_historical_income_periods','ops_gestor_source_rows',
 'ops_gestor_quarter_summary','ops_import_batches','ops_fiscal_reference_periods',
 'ops_reconciliation_notes','ops_personnel','ops_backup_archives',
 'ops_restore_backup_data','gestorRows','legacyAllocation'
];

for(const [name,src] of active){
 for(const term of forbidden)assert(!src.includes(term),name+' conserva residuo obsoleto: '+term);
}

assert(!index.includes("goOps('backup')"),'Inicio todavía enlaza Backup');
assert(!index.includes('Última copia'),'Inicio todavía muestra Backup');
assert(!index.includes('Óscar</b>'),'Cabecera conserva un usuario precargado');
assert(!index.includes('BEATRIZ'),'Index conserva usuario retirado');

for(const label of ['Inicio','Pricing','Cajas','Gastos','Facturación','Documentos','Fiscalidad','Informes','Administración']){
 assert(index.includes('>'+label+'<'), 'Falta navegación principal: '+label);
}

assert(core.includes('aria-label="Cierres desde"')&&core.includes('aria-label="Cierres hasta"'),'Cajas no tiene rango Desde/Hasta');
assert(core.includes('aria-label="Gastos desde"')&&core.includes('aria-label="Gastos hasta"'),'Gastos no tiene rango Desde/Hasta');
assert(modules.includes('aria-label="Informe desde"')&&modules.includes('aria-label="Informe hasta"'),'Informes no tiene rango Desde/Hasta');

assert(modules.length<50000,'La capa operativa vuelve a crecer por encima de 50 KB');
assert(!modules.includes('PRE_RESTORE')&&!modules.includes('totus-backups'),'La capa operativa conserva restauración de backups');

new Function(core);
new Function(modules);

const inline=[...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
for(const [i,src] of inline.entries()){
 try{new Function(src)}catch(e){throw new Error('Script inline '+(i+1)+' no compila: '+e.message)}
}

console.log('Totus clean QA OK');
console.log(JSON.stringify({
 activeFiles:active.map(([name,src])=>({name,bytes:Buffer.byteLength(src)})),
 modulesBytes:Buffer.byteLength(modules),
 forbiddenTermsChecked:forbidden.length
},null,2));
