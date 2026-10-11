import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const must=[
 'index.html','src/app.js','src/api.js','src/state.js','src/config.js','src/utils.js','src/components.js','src/pages/main.js','src/styles.css','src/excel.js','src/backup.js','src/calculations.js','src/file-utils.js','supabase/totus_api.sql','supabase/backup.sql'
];
const errors=[];
for(const f of must)if(!fs.existsSync(path.join(root,f)))errors.push('Falta '+f);
const text=f=>fs.readFileSync(path.join(root,f),'utf8');
const all=must.map(text).join('\n');
const appSource=text('src/app.js');
const pageSource=text('src/pages/main.js');

for(const forbidden of ['gestion-v6.js','gestion-v6-features.js','app-shell-v6.css','legacyAllocation','ops_legacy_daily_rows','ops_historical_income_periods','ops_gestor_source_rows','ops_gestor_quarter_summary','ops_reconciliation_notes','ops_backup_archives']){
 if(all.includes(forbidden))errors.push('Residuo prohibido: '+forbidden);
}
for(const required of ['Inicio','Pricing','Cajas','Gastos','Facturación','Documentos','Fiscalidad','Informes','Administración','Usuarios','Log','Desde','Hasta']){
 if(!all.includes(required))errors.push('Falta concepto obligatorio: '+required);
}
if(!text('src/config.js').includes('500*1024*1024'))errors.push('El límite configurado debe ser 500 MB');
if(/\bT[1-4]\b/.test(text('src/components.js')))errors.push('Los trimestres no pueden ser el filtro principal');
if(text('index.html').length>8000)errors.push('index.html vuelve a ser monolítico');
if(!text('src/styles.css').includes('@media(max-width:800px)'))errors.push('Falta responsive tablet/móvil');
if(!text('src/styles.css').includes('@media(max-width:520px)'))errors.push('Falta responsive móvil estrecho');

for(const f of ['src/app.js','src/api.js','src/state.js','src/config.js','src/utils.js','src/components.js','src/pages/main.js','src/excel.js','src/backup.js','src/calculations.js','src/file-utils.js']){
 try{execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'pipe'})}
 catch(e){errors.push('Error de sintaxis en '+f+': '+String(e.stderr||e.message))}
}

const stateSource=text('src/state.js'),apiSource=text('src/api.js');
const stateDataMatch=stateSource.match(/data:\{([\s\S]*?)\}\n\};/);
const declaredData=new Set([...(stateDataMatch?.[1]||'').matchAll(/([A-Za-z0-9_]+)\s*:/g)].map(m=>m[1]));
const loadedData=new Set([...apiSource.matchAll(/\['([A-Za-z0-9_]+)','[^']+'/g)].map(m=>m[1]));
const usedData=new Set([...(appSource+'\n'+pageSource+'\n'+text('src/excel.js')+'\n'+text('src/backup.js')).matchAll(/state\.data\.([A-Za-z0-9_]+)/g)].map(m=>m[1]));
for(const key of usedData){
 if(!declaredData.has(key))errors.push('state.data usado pero no inicializado: '+key);
 if(!loadedData.has(key)&&!['audit','storageUsage'].includes(key))errors.push('state.data usado pero no cargado por loadCore: '+key);
}

const {state,setView}=await import(path.resolve(root,'src/state.js'));
const pages=await import(path.resolve(root,'src/pages/main.js'));
state.user={role:'admin',email:'test@example.com',full_name:'Test'};
state.data.settings={id:1,irpf_prepayment_rate:20,default_sales_vat_rate:21,storage_limit_bytes:500*1024*1024,difficult_expense_pct:5,difficult_expense_annual_cap:2000};state.data.storageUsage={total_bytes:0,limit_bytes:500*1024*1024,documents_count:0,assets_count:0};
state.data.stores=[{id:'s1',name:'Hortimatic',active:true},{id:'s2',name:'NewOldSmok',active:true}];
state.data.drawers=[{id:'d1',store_id:'s1',active:true},{id:'d2',store_id:'s2',active:true}];
state.data.categories=[];state.data.suppliers=[];state.data.closings=[];state.data.closingDrawers=[];
state.data.expenses=[];state.data.expenseLines=[];state.data.customers=[];
state.data.series=[{id:'i1',code:'H-2026',prefix:'H-',padding:4,year:2026,next_number:1,document_type:'factura',series_kind:'invoice',active:true,store_id:'s1'},{id:'r1',code:'RH-2026',prefix:'RH-',padding:4,year:2026,next_number:1,document_type:'factura',series_kind:'rectifying',active:true,store_id:'s1'},{id:'p1',code:'HPF-2026',prefix:'HPF-',padding:4,year:2026,next_number:1,document_type:'proforma',series_kind:'invoice',active:true,store_id:'s1'}];
state.data.invoices=[];state.data.invoiceLines=[];state.data.documents=[];state.data.taxPayments=[];state.data.reta=[];
state.data.fiscalAdjustments=[];state.data.audit=[];state.data.templates=[];
state.data.brands=[];state.data.families=[];state.data.products=[];state.data.variants=[];state.data.providers=[];
state.data.providerPrices=[];state.data.competitors=[];state.data.consultations=[];state.data.team=[];

const inicioHtml=pages.inicio();
for(const term of ['Operativa de hoy','Gastos del','Pendientes y avisos','Precios y ventas','Consulta rápida de precio','Facturación y cobros','Documentos recientes','Fiscalidad','Seguimiento y sistema','Informes y gestoría','Estado del sistema','Hortimatic','NewOldSmok']){
 if(!inicioHtml.includes(term))errors.push('Inicio incompleto: '+term);
}
if(!inicioHtml.includes('data-route="fiscalidad"')||!inicioHtml.includes('data-route="facturacion"'))errors.push('Inicio sin accesos directos funcionales');
for(const [action,route] of [['closing-new','cajas'],['expense-new','gastos'],['invoice-new','facturacion'],['document-new','documentos']]){
 const re=new RegExp("if\\(a==='"+action+"'\\)[\\s\\S]{0,220}setRoute\\('"+route+"'\\)");
 if(!re.test(appSource))errors.push('Acción rápida de Inicio no navega: '+action+' → '+route);
}
if(!inicioHtml.includes('data-store="s1"')&&!inicioHtml.includes('data-id='))errors.push('Inicio no permite actuar sobre cierres por tienda');

for(const name of ['inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion']){
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
if(appSource.includes("status:'archivado'"))errors.push('Documentos usa estado inválido archivado');
for(const requiredDocValue of ['factura_recibida','factura_emitida','factura_rectificativa','impuesto','informe','archivada']){
 if(!appSource.includes(requiredDocValue)&&!pageSource.includes(requiredDocValue))errors.push('Falta valor válido de documentos: '+requiredDocValue);
}
if(appSource.includes('patchFilters({'))errors.push('Persisten filtros globales antiguos');
if(!appSource.includes("patchFilters('pricing'"))errors.push('Pricing no tiene filtro independiente');
if(!pageSource.includes("series_kind==='invoice'")&&!pageSource.includes("series_kind==='rectifying'"))errors.push('Facturación no separa series ordinarias y rectificativas');

for(const rpc of ['totus_save_closing','totus_save_expense','totus_save_sales_document','totus_finalize_sales_document','totus_convert_proforma','totus_update_invoice_payment']){
 if(!text('src/app.js').includes(rpc))errors.push('Falta integración '+rpc);
}

for(const deadCall of ['productModal(','expenseModal(','invoiceModal(','closingModal(','documentModal(']){
 if(appSource.includes(deadCall))errors.push('Llamada heredada inexistente: '+deadCall);
}

for(const oldRpc of ['ops_save_closing','ops_save_expense','ops_save_document_draft','ops_finalize_document','ops_delete_closing_controlled','ops_delete_expense_controlled']){
 if(text('src/app.js').includes(oldRpc))errors.push('RPC antiguo todavía usado: '+oldRpc);
}
if(!text('src/app.js').includes('invoice-line-add')||!text('src/app.js').includes('invoice-line-remove'))errors.push('Facturación no soporta múltiples líneas');
if(!pageSource.includes('closingRecordHtml')||!pageSource.includes('drawer-entry'))errors.push('Cajas no usa listado → ficha por caja');
if(!pageSource.includes('expenseRecordHtml')||!pageSource.includes('expenseLineRow'))errors.push('Gastos no usa ficha con múltiples líneas');
if(!pageSource.includes('invoiceRecordHtml')||!pageSource.includes('invoicePreview'))errors.push('Facturación no usa ficha y vista previa');
if(!pageSource.includes('invoice-payment-save')||!appSource.includes('saveInvoicePayment'))errors.push('Facturación emitida no permite registrar cobros de forma segura');
if(!pageSource.includes('documentRecordHtml'))errors.push('Documentos no usa listado → ficha');
if(!pageSource.includes('administracion()'))errors.push('Falta Administración consolidada');
if(!text('src/pages/main.js').includes('proforma-convert'))errors.push('Falta conversión de proforma');
if(!text('index.html').includes('xlsx-js-style'))errors.push('Falta motor Excel');
if(/download\([^\n]*\.csv|text\/csv|cierres_[^\n]*\.csv|gastos_[^\n]*\.csv|resumen_[^\n]*\.csv/.test(appSource))errors.push('Persisten exportaciones CSV en Informes');
for(const term of ['exportClosingsWorkbook','exportExpensesWorkbook','exportSummaryWorkbook','cellStyles:true','SUM('])if(!text('src/excel.js').includes(term))errors.push('Excel incompleto: '+term);
for(const term of ['provider-price-new','competitor-new','variant-new','consultation-save','providers-manage'])if(!text('src/app.js').includes(term)&&!text('src/pages/main.js').includes(term))errors.push('Pricing incompleto: '+term);
if(/apply_special_tax\s*\?\s*Number\([^\n]*special_tax_amount[^\n]*\)\s*:\s*0/.test(pageSource)||text('src/app.js').includes('ppApplyTax'))errors.push('Pricing vuelve a sumar impuesto especial ya incluido');
for(const term of ['management_only','withholding_model','deductible_pct','fixed_asset'])if(!text('src/pages/main.js').includes(term)&&!text('src/app.js').includes(term))errors.push('Gastos/fiscalidad incompleto: '+term);
for(const fn of ['totus_save_closing','totus_save_expense','totus_save_sales_document','totus_finalize_sales_document','totus_convert_proforma','totus_update_invoice_payment'])if(!text('supabase/totus_api.sql').includes(fn))errors.push('API SQL incompleta: '+fn);

for(const term of ['closing-save-draft','closing-save-close','closing-reopen','reported_total_sales'])if(!appSource.includes(term)&&!pageSource.includes(term)&&!text('supabase/totus_api.sql').includes(term))errors.push('Cajas incompleto: '+term);
for(const term of ['expense-document-preview','expense-document-download','expense-line-add','management_only'])if(!appSource.includes(term)&&!pageSource.includes(term))errors.push('Gastos incompleto: '+term);
for(const term of ['external-invoice-new','rectifying-new','billing-section','invoice-source-preview','totus_register_external_document'])if(!appSource.includes(term)&&!pageSource.includes(term)&&!text('supabase/totus_api.sql').includes(term))errors.push('Facturación incompleta: '+term);
for(const term of ['documents-zip','document-download','document-delete','sheet_to_html','document-frame'])if(!appSource.includes(term)&&!pageSource.includes(term)&&!text('src/styles.css').includes(term))errors.push('Documentos incompleto: '+term);
for(const term of ['record-layout','sticky-summary','module-tabs','@media(max-width:800px)'])if(!text('src/styles.css').includes(term))errors.push('Interfaz responsive incompleta: '+term);
if(/\b(usuarios|configuracion|log)\s*:\s*\[/.test(text('src/config.js')))errors.push('Persisten rutas administrativas duplicadas');

const actionSources=pageSource+'\n'+text('src/components.js')+'\n'+appSource;
const literalActions=[...actionSources.matchAll(/btn\([^,]+,\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
const ignoredActionPrefixes=['cajas-','gastos-','facturas-','documentos-','fiscal-','informes-'];
for(const action of new Set(literalActions)){
 if(action.includes('${'))continue;
 const handled=appSource.includes("a==='"+action+"'")||appSource.includes('a==="'+action+'"')||ignoredActionPrefixes.some(p=>action.startsWith(p));
 if(!handled)errors.push('Botón sin acción conectada: '+action);
}

const uiMatrix=[
 ['cajas',pages.cajas(),['Desde','Hasta','Nuevo cierre','Exportar']],
 ['gastos',pages.gastos(),['Desde','Hasta','Nuevo gasto','Proveedores','Exportar']],
 ['facturacion',pages.facturacion(),['Desde','Hasta','Nueva factura','Proforma','Factura externa','Rectificativa']],
 ['documentos',pages.documentos(),['Desde','Hasta','Subir documento','Descargar ZIP filtrado']],
 ['fiscalidad',pages.fiscalidad(),['Desde','Hasta','Modelo 130','Ajuste fiscal']],
 ['informes',pages.informes(),['Desde','Hasta','Libros como los Excel originales','Gestoría y auditoría']]
];
for(const [name,html,terms] of uiMatrix){
 for(const term of terms)if(!html.includes(term))errors.push(name+' incompleto: '+term);
 if(!html.includes('type="date"')&&['cajas','gastos','facturacion','documentos','fiscalidad','informes'].includes(name))errors.push(name+' no usa fechas completas');
}
setView('cajas',{mode:'record',id:null});const newClosing=pages.cajas();
for(const id of ['clStore','clDate','clReported','clNotes'])if(!newClosing.includes('id="'+id+'"'))errors.push('Cajas ficha falta '+id);
for(const action of ['closing-save-draft','closing-save-close','closing-back'])if(!newClosing.includes('data-action="'+action+'"'))errors.push('Cajas ficha falta acción '+action);

setView('gastos',{mode:'record',id:null});const newExpense=pages.gastos();
for(const id of ['exStore','exDate','exSupplier','exInvoice','exFile','exPaidStatus','exNotes'])if(!newExpense.includes('id="'+id+'"'))errors.push('Gastos ficha falta '+id);
for(const action of ['expense-line-add','expense-save','expense-back'])if(!newExpense.includes('data-action="'+action+'"'))errors.push('Gastos ficha falta acción '+action);

setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'invoice',origin:'totus'});const newInvoice=pages.facturacion();
for(const id of ['ivStore','ivSeries','ivDate','ivCustomer','ivPayment','ivPaidStatus','ivPaidAmount','ivIncludeIncome'])if(!newInvoice.includes('id="'+id+'"'))errors.push('Facturación ficha falta '+id);
for(const action of ['invoice-line-add','invoice-save','invoice-back'])if(!newInvoice.includes('data-action="'+action+'"'))errors.push('Facturación ficha falta acción '+action);

setView('documentos',{mode:'record',id:null});const newDocument=pages.documentos();
for(const id of ['docFile','docStore','docDate','docType','docStatus','docParty','docNumber','docNotes'])if(!newDocument.includes('id="'+id+'"'))errors.push('Documentos ficha falta '+id);
for(const action of ['document-save','document-back'])if(!newDocument.includes('data-action="'+action+'"'))errors.push('Documentos ficha falta acción '+action);

setView('administracion',{section:'backups'});const backupHtml=pages.administracion();
for(const term of ['Descargar copia completa','Cargar copia','Restaurar copia'])if(!backupHtml.includes(term))errors.push('Administración copias incompleta: '+term);
const fileUtils=await import(path.resolve(root,'src/file-utils.js'));
const fake=(name,type,size=1024)=>({name,type,size});
for(const [name,type,kind] of [
 ['a.pdf','application/pdf','pdf'],['a.jpg','image/jpeg','image'],['a.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','excel'],
 ['a.xls','application/vnd.ms-excel','excel'],['a.csv','text/csv','text'],['a.txt','text/plain','text'],['a.md','text/markdown','text']
]){
 const f=fake(name,type);const v=fileUtils.validateDocumentFile(f,{maxBytes:20*1024*1024,usedBytes:0,limitBytes:500*1024*1024});
 if(v.kind!==kind)errors.push('Vista previa incorrecta para '+name);
}
try{fileUtils.validateDocumentFile(fake('mal.exe','application/octet-stream'),{});errors.push('Documentos permite extensión no soportada')}catch{}
try{fileUtils.validateDocumentFile(fake('grande.pdf','application/pdf',21*1024*1024),{});errors.push('Documentos permite archivo >20 MB')}catch{}
try{fileUtils.validateDocumentFile(fake('sin-espacio.pdf','application/pdf',2*1024*1024),{usedBytes:499*1024*1024,limitBytes:500*1024*1024});errors.push('Documentos no respeta límite de Storage')}catch{}

setView('facturacion',{mode:'list',id:null,section:'series'});const seriesHtml=pages.facturacion();
for(const term of ['Nueva serie','series-new','series-edit'])if(!seriesHtml.includes(term))errors.push('Gestión de series incompleta: '+term);
setView('administracion',{section:'fiscal'});const adminFiscal=pages.administracion();
for(const term of ['Categorías de gastos','expense-category-new'])if(!adminFiscal.includes(term))errors.push('Gestión de categorías incompleta: '+term);
if(!pageSource.includes("'expense-category-edit'"))errors.push('Gestión de categorías sin acción Editar');
for(const action of ['series-new','series-edit','series-save','expense-category-new','expense-category-edit','expense-category-save','template-preview','report-store-preview','report-gestor-preview'])if(!appSource.includes("a==='"+action+"'"))errors.push('Falta handler: '+action);

const backupSource=text('src/backup.js');
const backupSql=text('supabase/backup.sql');
if(!text('index.html').includes('jszip'))errors.push('Falta motor ZIP para backup');
for(const term of ['business-documents','business-assets','database.json','manifest.json','totus-clean-backup','totus_restore_backup'])if(!backupSource.includes(term))errors.push('Backup incompleto: '+term);
for(const term of ['backup-create','backup-restore','RESTAURAR TOTUS'])if(!appSource.includes(term)&&!pageSource.includes(term))errors.push('Control de backup incompleto: '+term);
if(backupSource.includes("'team_members'")||backupSource.includes("'profiles'"))errors.push('El backup no debe restaurar usuarios/Auth');
if(/delete\s+from\s+public\.(team_members|profiles)/i.test(backupSql))errors.push('Restaurar backup podría borrar usuarios');
for(const term of ['totus_restore_backup','totus_is_admin','totus_storage_usage'])if(!backupSql.includes(term))errors.push('SQL backup no versionado: '+term);

if(errors.length){console.error('\nQA FALLÓ\n- '+errors.join('\n- '));process.exit(1)}
console.log('QA estructural, sintaxis y render: OK');
