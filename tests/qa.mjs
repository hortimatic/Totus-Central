import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const must=[
 'index.html','src/app.js','src/api.js','src/state.js','src/config.js','src/utils.js','src/components.js','src/pages/main.js','src/styles.css'
];
const errors=[];
for(const f of must){
 if(!fs.existsSync(path.join(root,f)))errors.push('Falta '+f);
}
const text=f=>fs.readFileSync(path.join(root,f),'utf8');
const all=must.filter(f=>f.endsWith('.js')||f.endsWith('.html')||f.endsWith('.css')).map(text).join('\n');

for(const forbidden of ['gestion-v6.js','gestion-v6-features.js','app-shell-v6.css','legacyAllocation','ops_legacy_daily_rows','ops_historical_income_periods','ops_gestor_source_rows','ops_gestor_quarter_summary','ops_reconciliation_notes','ops_backup_archives']){
 if(all.includes(forbidden))errors.push('Residuo prohibido: '+forbidden);
}
for(const required of ['Desde','Hasta','Pricing','Cajas','Gastos','Facturación','Documentos','Fiscalidad','Informes','Usuarios','Configuración','Log']){
 if(!all.includes(required))errors.push('Falta concepto obligatorio: '+required);
}
const config=text('src/config.js');
if(!config.includes('500*1024*1024'))errors.push('El límite configurado debe ser 500 MB');
if(/T1|T2|T3|T4/.test(text('src/components.js')))errors.push('Los trimestres no pueden ser el filtro principal');
if(text('index.html').length>8000)errors.push('index.html vuelve a ser monolítico');

const app=text('src/app.js');
for(const fn of ['saveClosing','saveExpense','saveInvoice','saveProduct','saveDocument','saveUser','saveConfig']){
 if(!app.includes('function '+fn)&&!app.includes('async function '+fn))errors.push('Falta flujo '+fn);
}
const styles=text('src/styles.css');
for(const q of ['@media(max-width:800px)','@media(max-width:520px)'])if(!styles.includes(q))errors.push('Falta responsive '+q);

if(errors.length){console.error('\nQA FALLÓ\n- '+errors.join('\n- '));process.exit(1)}
console.log('QA estructural OK');
