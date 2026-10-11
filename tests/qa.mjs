import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const must=[
 'index.html','src/app.js','src/api.js','src/state.js','src/config.js','src/utils.js','src/components.js','src/pages/main.js','src/styles.css','src/excel.js','supabase/totus_api.sql'
];
const errors=[];
for(const f of must)if(!fs.existsSync(path.join(root,f)))errors.push('Falta '+f);
const text=f=>fs.readFileSync(path.join(root,f),'utf8');
const all=must.map(text).join('\n');

for(const forbidden of ['gestion-v6.js','gestion-v6-features.js','app-shell-v6.css','legacyAllocation','ops_legacy_daily_rows','ops_historical_income_periods','ops_gestor_source_rows','ops_gestor_quarter_summary','ops_reconciliation_notes','ops_backup_archives']){
 if(all.includes(forbidden))errors.push('Residuo prohibido: '+forbidden);
}
for(const required of ['Inicio','Pricing','Cajas','Gastos','Facturación','Documentos','Fiscalidad','Informes','Usuarios','Configuración','Log','Desde','Hasta']){
 if(!all.includes(required))errors.push('Falta concepto obligatorio: '+required);
}
if(!text('src/config.js').includes('500*1024*1024'))errors.push('El límite configurado debe ser 500 MB');
if(/\bT[1-4]\b/.test(text('src/components.js')))errors.push('Los trimestres no pueden ser el filtro principal');
if(text('index.html').length>8000)errors.push('index.html vuelve a ser monolítico');
if(!text('src/styles.css').includes('@media(max-width:800px)'))errors.push('Falta responsive tablet/móvil');
if(!text('src/styles.css').includes('@media(max-width:520px)'))errors.push('Falta responsive móvil estrecho');

for(const f of ['src/app.js','src/api.js','src/state.js','src/config.js','src/utils.js','src/components.js','src/pages/main.js','src/excel.js']){
 try{execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'pipe'})}
 catch(e){errors.push('Error de sintaxis en '+f+': '+String(e.stderr||e.message))}
}

const {state}=await import(path.resolve(root,'src/state.js'));
const pages=await import(path.resolve(root,'src/pages/main.js'));
state.user={role:'admin',email:'test@example.com',full_name:'Test'};
state.data.settings={irpf_prepayment_rate:20,default_sales_vat_rate:21,storage_limit_bytes:500*1024*1024};
state.data.stores=[{id:'s1',name:'Hortimatic',active:true},{id:'s2',name:'NewOldSmok',active:true}];
state.data.drawers=[{id:'d1',store_id:'s1',active:true},{id:'d2',store_id:'s2',active:true}];
state.data.categories=[];state.data.suppliers=[];state.data.closings=[];state.data.closingDrawers=[];
state.data.expenses=[];state.data.expenseLines=[];state.data.customers=[];
state.data.series=[{id:'i1',code:'H-2026',document_type:'factura',active:true},{id:'p1',code:'HPF-2026',document_type:'proforma',active:true}];
state.data.invoices=[];state.data.invoiceLines=[];state.data.documents=[];state.data.taxPayments=[];state.data.reta=[];
state.data.fiscalAdjustments=[];state.data.incomeAdjustments=[];state.data.audit=[];state.data.templates=[];
state.data.brands=[];state.data.families=[];state.data.products=[];state.data.variants=[];state.data.providers=[];
state.data.providerPrices=[];state.data.competitors=[];state.data.consultations=[];state.data.team=[];

for(const name of ['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','usuarios','configuracion','log']){
 try{
   const html=pages[name]();
   if(typeof html!=='string'||html.length<20)errors.push('Render vacío: '+name);
   if(['cajas','gastos','facturacion','documentos','fiscalidad','informes'].includes(name)){
     if(!html.includes('type="date"'))errors.push('Sin fecha completa en '+name);
     if(!html.includes('Desde')||!html.includes('Hasta'))errors.push('Sin Desde/Hasta en '+name);
   }
 }catch(e){errors.push('Fallo al renderizar '+name+': '+e.message)}
}

for(const fn of ['saveClosing','saveExpense','saveInvoice','saveProduct','saveDocument','saveUser','saveConfig']){
 if(!text('src/app.js').includes('function '+fn)&&!text('src/app.js').includes('async function '+fn))errors.push('Falta flujo '+fn);
}
const appSource=text('src/app.js');
const pageSource=text('src/pages/main.js');
if(appSource.includes("status:'archivado'"))errors.push('Documentos usa estado inválido archivado');
for(const requiredDocValue of ['factura_recibida','factura_emitida','factura_rectificativa','impuesto','informe','archivada']){
 if(!appSource.includes(requiredDocValue))errors.push('Falta valor válido de documentos: '+requiredDocValue);
}
if(appSource.includes('patchFilters({'))errors.push('Persisten filtros globales antiguos');
if(!appSource.includes("patchFilters('pricing'"))errors.push('Pricing no tiene filtro independiente');
if(!pageSource.includes("s.series_kind==='invoice'"))errors.push('Facturación ordinaria puede mezclar series rectificativas');

for(const rpc of ['totus_save_closing','totus_save_expense','totus_save_sales_document','totus_finalize_sales_document','totus_convert_proforma']){
 if(!text('src/app.js').includes(rpc))errors.push('Falta integración '+rpc);
}

for(const oldRpc of ['ops_save_closing','ops_save_expense','ops_save_document_draft','ops_finalize_document','ops_delete_closing_controlled','ops_delete_expense_controlled']){
 if(text('src/app.js').includes(oldRpc))errors.push('RPC antiguo todavía usado: '+oldRpc);
}
if(!text('src/app.js').includes('invoice-line-add')||!text('src/app.js').includes('invoice-line-remove'))errors.push('Facturación no soporta múltiples líneas');
if(!text('src/pages/main.js').includes('drawer-entry'))errors.push('Cajas no está desglosado por caja');
if(!text('src/pages/main.js').includes('invoicePreview'))errors.push('Falta vista previa de facturación');
if(!text('src/pages/main.js').includes('proforma-convert'))errors.push('Falta conversión de proforma');
if(!text('index.html').includes('xlsx-js-style'))errors.push('Falta motor Excel');
if(text('src/app.js').includes('.csv'))errors.push('Persisten exportaciones CSV');
for(const term of ['exportClosingsWorkbook','exportExpensesWorkbook','exportSummaryWorkbook','cellStyles:true','SUM('])if(!text('src/excel.js').includes(term))errors.push('Excel incompleto: '+term);
for(const term of ['provider-price-new','competitor-new','variant-new','consultation-save','providers-manage'])if(!text('src/app.js').includes(term)&&!text('src/pages/main.js').includes(term))errors.push('Pricing incompleto: '+term);
if(!text('src/pages/main.js').includes('apply_special_tax?Number(row?.special_tax_amount||0):0'))errors.push('Pricing puede duplicar impuesto especial');
for(const term of ['management_only','withholding_model','deductible_pct','fixed_asset'])if(!text('src/pages/main.js').includes(term)&&!text('src/app.js').includes(term))errors.push('Gastos/fiscalidad incompleto: '+term);
for(const fn of ['totus_save_closing','totus_save_expense','totus_save_sales_document','totus_finalize_sales_document','totus_convert_proforma'])if(!text('supabase/totus_api.sql').includes(fn))errors.push('API SQL incompleta: '+fn);

if(errors.length){console.error('\nQA FALLÓ\n- '+errors.join('\n- '));process.exit(1)}
console.log('QA estructural, sintaxis y render: OK');
