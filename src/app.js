import {SET_FORMAT,uploadSelectedBackupSet} from './backup-set.js';
import {archiveHash as componentHash} from './recovery-core.js';
import {validateTaxExpense} from './tax-expense.js';
import {workbookPreviewText} from './workbook-preview.js';
import {oneDriveRequest,setOneDriveStatus,setOneDriveMaintenance,oneDriveCredentialNotice} from './onedrive-connection.js';
import {backupRetentionCount} from './backup-retention.js';
import {selectReportData,matchesText,searchText,selectDocuments} from './report-period.js';
import {captureFormDraft,hasFormDraft,originalFormValue,setPristineFormValue} from './form-drafts.js';
import {ROUTES,SUPABASE_URL} from './config.js';
import {PERMISSION_MODULES,PERMISSION_ACTIONS,permissionsFor,rolePermissions,canUser} from './permissions.js';
import {state,isAdmin,isManager,getFilters,patchFilters,setRoute,getView,setView,resetView} from './state.js';
import {sb,select,login,logout,recover,loadCore,reloadStorageUsage,reloadAudit,rpc,insert,update,remove,invokeTeam,invokeRecovery,upload,signedUrl,downloadFile,removeFile} from './api.js';
import {renderers,invoiceLineRow,expenseLineRow,invoicePreview,sourceClosingRecordHtml,openingDrawerCash} from './pages/main.js';
import {setHeader,closeModal,confirmAction,toast,modal,btn,formField,selectField,table} from './components.js';
import {$,monthRange,n,isoToday,fmtDate,esc,download,csv,money} from './utils.js';
import {closingIncomeAmount,expenseCostAmount,quickPriceStudy,validateExpensePayment,validateExpenseLineAmounts,validateExpenseClassification,validateInvoiceSettlement,issuedDocumentFileLocked} from './calculations.js';
import {validateDocumentFile,previewKind,safeFileSegment,uniqueArchiveDocumentPath} from './file-utils.js';
import {collectArchiveDocuments} from './archive-documents.js';
import {expenseRegisterLines,GESTOR_EXPENSE_COLUMNS} from './expense-register.js';
import {exportClosingsWorkbook,exportExpensesWorkbook,exportSummaryWorkbook,exportStoreMonthlyWorkbook,exportGestorWorkbook,buildStoreMonthlyWorkbook,buildGestorWorkbook,workbookBlob} from './excel.js';
import {createBackup,inspectBackup} from './backup.js';
import {readBackupObject,writeBackupObject} from './backup-transport.js';
import {buildGestorSourceWorkbook,exportGestorSourceWorkbook} from './excel.js';
import {buildGestorSourceRows,gestorSourcePrintHtml} from './gestor-format.js';
import {renderPdfPreview} from './pdf-preview.js';

const titles={
 inicio:['General','Inicio'],pricing:['Trabajo','Pricing'],cajas:['Trabajo','Cajas'],gastos:['Trabajo','Gastos'],
 facturacion:['Trabajo','Facturación'],documentos:['Trabajo','Documentos'],fiscalidad:['Control','Fiscalidad'],
 informes:['Control','Informes'],administracion:['Sistema','Administración']
};

function can(module,action='view'){return canUser(state.user,module,action,state.data.userPermissions||[])}
function routeAllowed(r){return can(r.id,'view')}
function permissionForAction(action,el){
 let module=null;
 if(/^(closing-|export-closings-current)/.test(action))module='cajas';
 else if(/^(expense-|export-expenses-current)/.test(action))module='gastos';
 else if(/^(invoice-|proforma-|rectifying-|external-invoice-|customer-|customers-|template-|series-|billing-)/.test(action))module='facturacion';
 else if(/^(document-|documents-)/.test(action))module='documentos';
 else if(/^(tax-payment-|fiscal-|reta-|expense-category-|income-adjustment-)/.test(action))module='fiscalidad';
 else if(/^(pricing-|product-|brand-|family-|families-|provider-|providers-|variant-|competitor-|consultation-|home-price-)/.test(action))module='pricing';
 else if(/^(report-|export-gestor-|export-store-|export-summary)/.test(action))module='informes';
 else if(/^(user-|role-|store-|drawer-|config-|backup-|admin-|recovery-|onedrive-)/.test(action))module='administracion';
 else if(action.startsWith('export-'))module='informes';
 if(!module)return null;
 const a=action.toLowerCase();
 let operation='view';
 if(/(^export-|\-export|\-download$|\-zip$|\-print$)/.test(a))operation='export';
 else if(/\-delete$/.test(a))operation='delete';
 else if(/\-new$|\-add$|\-duplicate$/.test(a))operation='create';
 else if(/\-save$|\-save-close$|\-save-draft$/.test(a))operation=el?.dataset?.id?'edit':'create';
 else if(/\-toggle$|\-reopen$|\-finalize$|\-convert$|\-convert-save$|\-unlink$|\-reset$|\-remove$|\-verify$/.test(a))operation='edit';
 if(a==='role-new'||a==='role-rename'||a==='role-save'||a==='role-delete'||a==='role-bulk-apply'||a==='role-permissions'||a==='role-permissions-save'||a==='role-permissions-reset'||a==='user-permissions' || a==='user-permissions-save'||a==='user-permissions-reset'||a==='user-save'||a==='user-delete'||a==='user-toggle')return {module:'administracion',operation:'edit',adminOnly:true};
 if(a.startsWith('admin-period-'))return {module:'administracion',operation:'edit',adminOnly:true};
 if(a==='config-save'||a.startsWith('backup-')||a==='store-save'||a==='drawer-save')return {module:'administracion',operation:'edit',adminOnly:true};
 if(a.startsWith('onedrive-'))return {module:'administracion',operation:'edit',adminOnly:true};
 if(a.startsWith('recovery-'))return {module:'administracion',operation:'edit',adminOnly:true};
 if(a==='document-bulk-select'||a==='document-bulk-import')operation='create';
 if(a==='proforma-convert')operation='create';
 if(a==='invoice-rectify')operation='create';
 if(a==='closing-save-close'&&el?.dataset?.id)operation='edit';
 if(a==='closing-reconcile-source'||a==='tax-payment-receipt')operation='edit';
 return {module,operation};
}
function checkActionPermission(action,el){
 const required=permissionForAction(action,el);
 if(!required)return true;
 if(required.adminOnly&&!isAdmin())return false;
 return can(required.module,required.operation);
}
function hideForbiddenButtons(){
 document.querySelectorAll('#content [data-action]').forEach(el=>{
  if(!checkActionPermission(el.dataset.action,el))el.remove();
 });
 // Navigation shortcuts in cards must obey the same view grants as the side menu.
 document.querySelectorAll('#content [data-route]').forEach(el=>{
  if(!can(el.dataset.route,'view'))el.remove();
 });
}

function renderNav(){
 const nav=$('#nav');let current='';
 nav.innerHTML=ROUTES.filter(routeAllowed).map(r=>{
  const group=r.group!==current?(current=r.group,`<div class="eyebrow" style="padding:15px 12px 5px;color:#718096">${esc(r.group)}</div>`):'';
  return group+`<button class="nav-btn ${state.route===r.id?'active':''}" data-route="${r.id}"><span class="nav-icon">${r.icon}</span>${esc(r.label)}</button>`
 }).join('');
}
function render(){
 if(!state.user)return;
 if(!can(state.route,'view')){
  const first=ROUTES.find(routeAllowed);
  if(!first){$('#nav').innerHTML='';setHeader('Acceso','Sin permisos');$('#content').innerHTML='<section class="card card-pad" role="alert"><h2>No tienes módulos asignados</h2><p>Solicita al administrador permiso para acceder a la herramienta.</p></section>';return}
  state.route=first.id;
 }
 renderNav();
 const [eye,title]=titles[state.route]||['Totus Central',''];
 setHeader(eye,title);
 const renderer=renderers[state.route]||renderers.inicio;
 draftPreviewResizeObserver?.disconnect();
 const openStorageDetails=state.route==='administracion'&&getView('administracion').section==='storage'?[...document.querySelectorAll('#content details[open][data-storage-detail]')].map(el=>el.dataset.storageDetail):[];
 const maintenance=isStoragePanelVisible()?'':oneDriveCredentialNotice({compact:true});
 $('#content').innerHTML='<div id="credentialNoticeHost"'+(maintenance?'':' hidden')+'>'+maintenance+'</div>'+renderer();
 document.querySelectorAll('#content details[data-storage-detail]').forEach(el=>{el.open=openStorageDetails.includes(el.dataset.storageDetail);});
 // Scrolling to a subtab used to reset after each rerender on mobile, hiding the active item.
 const tabs=$('#content .module-tabs'),active=tabs?.querySelector('.tab.active');
 if(active&&tabs.scrollWidth>tabs.clientWidth){
  const bar=tabs.getBoundingClientRect(),item=active.getBoundingClientRect();
  tabs.scrollLeft+=item.left-bar.left-(tabs.clientWidth-item.width)/2;
 }
 hideForbiddenButtons();
 $('#userCard').innerHTML=`<b>${esc(state.user.full_name||state.user.email)}</b><span>${esc(state.user.role||'usuario')}</span>`;
 if(input('invoiceDraftPreview')){updateInvoiceSummary();updateDraftInvoicePreview()}
 if(input('exDocKind'))updateExpenseTaxTreatment();
 captureFormDraft($('#content'));
}
let discardPromptActive=false,preserveMainDraftOnRefresh=false,writeInProgress=false;
const draftRoots=()=>[$('#content'),$('#modalHost [data-modal-content]')].filter(Boolean);
async function allowDiscardDrafts({modalOnly=false,ignore=[]}={}){
 if(discardPromptActive)return false;
 const roots=(modalOnly?[$('#modalHost [data-modal-content]')]:draftRoots()).filter(root=>hasFormDraft(root,ignore));
 if(!roots.length)return true;
 const host=$('#modalHost'),previous=[...host.childNodes],focused=document.activeElement;
 // Move the actual nodes: cloning would lose selected files and local listeners.
 const held=document.createDocumentFragment();previous.forEach(node=>held.appendChild(node));
 discardPromptActive=true;let accepted=false;
 try{
  accepted=await confirmAction('Hay cambios sin guardar. Si sales ahora, se perderán los campos y archivos pendientes.',{title:'Cambios sin guardar',acceptLabel:'Salir sin guardar'});
  if(accepted)roots.forEach(captureFormDraft);
  return accepted;
 }finally{
  discardPromptActive=false;
  if(!accepted){host.replaceChildren(held);if(focused?.isConnected)focused.focus()}
 }
}
window.addEventListener('beforeunload',e=>{
 if(writeInProgress||discardPromptActive||draftRoots().some(root=>hasFormDraft(root))){e.preventDefault();e.returnValue=''}
});
let storageRefreshInFlight=false;
function isStoragePanelVisible(){
 return !!state.user&&state.route==='administracion'&&getView('administracion').section==='storage';
}
async function refreshStoragePanel(){
 if(!isStoragePanelVisible()||storageRefreshInFlight||state.loading||$('#odClientSecret')?.value)return;
 storageRefreshInFlight=true;
 try{
  const result=await reloadStorageUsage();
  if(isAdmin())try{setOneDriveStatus(await oneDriveRequest('status'));}catch{}
  if(isStoragePanelVisible()){
   const scroll=document.scrollingElement?.scrollTop||0;
   render();
   window.scrollTo(0,scroll);
  }
  if(result.status!=='ok')toast('No se pudo consultar Storage: '+result.message,'bad');
 }finally{storageRefreshInFlight=false}
}
function refreshMaintenanceNotice(){
 if(!isAdmin())return;
 const owner=state.user?.email;
 void oneDriveRequest('maintenance-status').then(result=>{
  if(!isAdmin()||state.user?.email!==owner)return;
  setOneDriveMaintenance(result);
  const host=$('#credentialNoticeHost');if(!host)return;
  const html=isStoragePanelVisible()?'':oneDriveCredentialNotice({compact:true});
  host.innerHTML=html;host.hidden=!html;
 }).catch(()=>{});
}
async function refresh(message=''){
 state.loading=true;
 try{
  await loadCore();
  refreshMaintenanceNotice();
  if(message)toast(message,'ok');
  if(preserveMainDraftOnRefresh&&hasFormDraft($('#content'))){renderNav();hideForbiddenButtons()}else render()
 }
 catch(e){
  console.error(e);toast(e.message,'bad');
  const content=$('#content');
  if(content)content.innerHTML=`<section class="card card-pad" role="alert"><h2>No se han podido cargar los datos</h2><p>${esc(e.message||'Error de conexión o permisos.')} No se ha borrado ningún dato.</p>${btn('Volver a intentar','retry-load','primary')}</section>`;
 }
 finally{state.loading=false}
}
let auditRefreshInFlight=false;
async function refreshAuditPanel(){
 if(auditRefreshInFlight)return false;
 auditRefreshInFlight=true;
 try{await reloadAudit();return true}
 catch(error){state.data.auditError=error.message;return false}
 finally{auditRefreshInFlight=false;if(state.route==='administracion'&&getView('administracion').section==='log')render()}
}
function input(id){return document.getElementById(id)}
function val(id){return input(id)?.value??''}
function required(id,label){const v=val(id).trim();if(!v)throw new Error(`${label} es obligatorio.`);return v}
function num(id){return n(val(id))}
function actionEl(e){return e.target.closest('[data-action],[data-route]')}
function validateDecimalFields(){
 for(const field of document.querySelectorAll('input[data-decimal="true"]')){
  if(field.disabled)continue;
  const raw=String(field.value||'').trim().replace(/\s/g,'');
  if(!raw)continue;
  // Signo opcional, agrupación de miles ES/EN y decimales con coma o punto.
  const valid=/^-?\d+(?:[.,]\d+)?$/.test(raw)
   ||/^-?\d{1,3}(?:\.\d{3})+[,]\d+$/.test(raw)
   ||/^-?\d{1,3}(?:,\d{3})+[.]\d+$/.test(raw);
  if(!valid){field.focus();const err=new Error('El campo "'+(field.closest('label')?.textContent||field.id).trim()+'" contiene un importe no válido.');err.name='ValidationError';throw err}
 }
}


async function saveClosing(id='',status='borrador'){
 if(!['borrador','cerrado'].includes(status))throw new Error('Selecciona un estado válido para el cierre.');
 const reconcilingSource=!!getView('cajas').reconcileSource;
 const store=required('clStore','Tienda'),date=required('clDate','Fecha');
 if(date>isoToday())throw new Error('La fecha del cierre no puede ser futura.');
 if(reconcilingSource&&val('clReported').trim()===''){input('clReported')?.focus();throw new Error('Indica las ventas totales del día para comprobar el cierre. La referencia fiscal mensual se conserva sin duplicar ingresos.');}
 const drawerEls=[...document.querySelectorAll('.drawer-entry')];
 if(!drawerEls.length)throw new Error('La tienda no tiene cajas activas configuradas.');
 const drawers=drawerEls.map(el=>{
   const d=el.dataset.drawerId;
   const raw=suffix=>document.getElementById(`dr${suffix}_${d}`)?.value??'';
   const missing=reconcilingSource&&['Open','Close','Card','Bizum','Online','Other','Withdraw','CashExpense','ExtraIn','ExtraOut'].find(suffix=>raw(suffix).trim()==='');
   if(missing){document.getElementById(`dr${missing}_${d}`)?.focus();throw new Error('Completa todos los importes de cada caja para conciliar; escribe 0 solo cuando confirmes que no hubo movimiento.');}
   const read=suffix=>n(raw(suffix));
   if(status==='cerrado'&&raw('Open').trim()===''){document.getElementById(`drOpen_${d}`)?.focus();throw new Error('Indica el dinero de apertura de cada caja; escribe 0 solo si confirmas que estaba vacía.');}
   if(status==='cerrado'&&raw('Close')==='')throw new Error('Falta el efectivo final de una caja.');
   const row={drawer_id:d,opening_cash:read('Open'),closing_cash:read('Close'),card_sales:read('Card'),bizum_sales:read('Bizum'),online_sales:read('Online'),other_income:read('Other'),cash_withdrawals:read('Withdraw'),cash_expenses_declared:read('CashExpense'),cash_extra_in:read('ExtraIn'),cash_extra_out:read('ExtraOut'),notes:state.data.closingDrawers.find(x=>x.closing_id===id&&x.drawer_id===d)?.notes||''};
   if(Object.entries(row).some(([k,v])=>k!=='drawer_id'&&k!=='notes'&&Number(v)<0))throw new Error('No se admiten importes negativos en Cajas.');
   return row;
 });
 if(status==='cerrado'){
  if(val('clReported').trim()==='')throw new Error('Indica el total de ventas antes de conciliar el cierre.');
  const calculated=drawers.reduce((sum,d)=>sum+d.closing_cash+d.cash_withdrawals+d.cash_expenses_declared+d.cash_extra_out-d.cash_extra_in-d.opening_cash+d.card_sales+d.bizum_sales+d.online_sales+d.other_income,0);
  const difference=Math.round(calculated*100)-Math.round(num('clReported')*100);
  if(Math.abs(difference)>1)throw new Error('El cierre no cuadra: diferencia '+money(difference/100)+'. Revisa Total ventas y los importes de cada caja.');
 }
 const payload={id:id||null,store_id:store,business_date:date,reported_total_sales:val('clReported')===''?null:num('clReported'),notes:val('clNotes').trim(),status};
 const savedId=await rpc('totus_save_closing',{p_closing:payload,p_drawers:drawers});
 setView('cajas',{mode:'record',id:savedId,reconcileSource:false});
 await refresh(status==='cerrado'?(reconcilingSource?'Cierre conciliado, cerrado y cuadrado.':'Cierre cerrado y cuadrado.'):'Borrador guardado.');
}
async function reopenClosing(id){
 if(!confirm('¿Reabrir este cierre para corregirlo? La acción quedará registrada.'))return;
 const row=state.data.closings.find(x=>x.id===id);if(!row)return;
 const drawers=state.data.closingDrawers.filter(x=>x.closing_id===id).map(x=>({drawer_id:x.drawer_id,opening_cash:x.opening_cash,closing_cash:x.closing_cash,card_sales:x.card_sales,bizum_sales:x.bizum_sales,online_sales:x.online_sales,other_income:x.other_income,cash_withdrawals:x.cash_withdrawals,cash_expenses_declared:x.cash_expenses_declared,cash_extra_in:x.cash_extra_in,cash_extra_out:x.cash_extra_out,notes:x.notes||''}));
 await rpc('totus_save_closing',{p_closing:{id,store_id:row.store_id,business_date:row.business_date,reported_total_sales:row.reported_total_sales,notes:row.notes||'',status:'borrador'},p_drawers:drawers});
 await refresh('Cierre reabierto.');
}
async function deleteClosing(id){
 if(!confirm('¿Eliminar este cierre de caja y sus importes? Se actualizarán los informes y puede variar la apertura de la siguiente jornada.'))return;
 const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 await rpc('totus_delete_closing',{p_id:id,p_reason:reason.trim()});
 resetView('cajas');await refresh('Cierre eliminado.');
}


function showExpenseGestorDetail(id){
 const expense=state.data.expenses.find(x=>x.id===id);
 if(!expense)throw new Error('No se encuentra el gasto seleccionado.');
 const items=expenseRegisterLines([expense],state.data.expenseLines);
 const tHeaders=GESTOR_EXPENSE_COLUMNS.map(label=>({label,html:row=>{
  const i=GESTOR_EXPENSE_COLUMNS.indexOf(label),value=row.fields[i];
  if(typeof value==='number')return i===0?String(value):[9,12,16].includes(i)?value.toLocaleString('es-ES',{maximumFractionDigits:2})+' %':money(value);
  return esc(value??'—');
 }}));
 const warning=expense.management_only?'Es un gasto de control interno: no debe incorporarse al libro fiscal de gestoría.':
  expense.fiscal_reviewed===false?'SIN REVISAR: contrasta la factura y los importes antes de enviarlos a gestoría.':'Detalle desglosado por concepto fiscal.';
 const doc=state.data.documents.find(d=>d.id===expense.document_id);
 const actions=doc?`<div class="inline-actions">${btn('Ver factura original','expense-document-preview','secondary',`data-id="${esc(doc.id)}"`)}${btn('Descargar factura','expense-document-download','secondary',`data-id="${esc(doc.id)}"`)}</div>`:'<p class="note">Este gasto todavía no tiene un justificante adjunto.</p>';
 const rows=items.map(x=>({
  ...x,fields:x.fields.map((v,i)=>i===1?fmtDate(v):v)
 }));
 modal('Datos para gestoría · '+(expense.invoice_number||expense.supplier_name||'Gasto'),
  `<div class="stack"><p class="note ${expense.fiscal_reviewed===false?'warn':''}">${esc(warning)}</p><div class="gestor-details-scroll">${table(tHeaders,rows)}</div>
  ${items.some(x=>x.missingBreakdown)?'<p class="note">Falta el desglose original por líneas; revisa este gasto antes de declararlo.</p>':''}
  ${actions}</div>`);
}
async function previewPendingExpenseFile(){
 const file=input('exFile')?.files?.[0];
 if(!file)throw new Error('Selecciona primero una factura para verla.');
 const settings=state.data.settings||{},usage=state.data.storageUsage||{};
 const existingId=getView('gastos').id,existing=state.data.expenses.find(x=>x.id===existingId);
 const old=state.data.documents.find(d=>d.id===existing?.document_id);
 validateDocumentFile(file,{maxBytes:Number(settings.document_max_bytes||20*1024*1024),usedBytes:Number(usage.total_bytes||0),limitBytes:Number(usage.limit_bytes||500*1024*1024),replacingBytes:Number(old?.size_bytes||0)});
 const kind=previewKind(file.name,file.type);
 if(kind==='pdf'){
  modal('Vista previa · '+file.name,`<div class="stack"><div class="note">Archivo seleccionado pero todavía NO guardado. ${(file.size/1024).toFixed(1)} KB</div><div id="pdfPreviewHost" class="document-frame pdf-viewer"></div><div class="form-actions">${btn('Volver al gasto','close-modal','secondary')}</div></div>`);
  await renderPdfPreview(file,document.getElementById('pdfPreviewHost'));return;
 }
 let content='';
 if(kind==='image'){
  const url=URL.createObjectURL(file);
  content=`<div class="image-preview-wrap"><img class="document-image-preview" src="${url}" alt="${esc(file.name)}"></div>`;
  setTimeout(()=>URL.revokeObjectURL(url),180000);
 }else if(kind==='excel'){
  const workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array'});
  content=`<div class="excel-preview">${workbook.SheetNames.slice(0,8).map((sheet,i)=>`<details ${i===0?'open':''}><summary>${esc(sheet)}</summary><div class="excel-preview-sheet"><table class="data-table"><tbody>${window.XLSX.utils.sheet_to_json(workbook.Sheets[sheet],{header:1,raw:false,defval:''}).slice(0,120).map(line=>`<tr>${line.slice(0,20).map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`).join('')}</div>`;
 }else if(kind==='text'){
  content=`<pre class="text-preview">${esc((await file.text()).slice(0,100000))}</pre>`;
 }else{
  content='<p class="note">Este archivo se puede guardar y descargar. No hay vista previa integrada para este formato.</p>';
 }
 modal('Vista previa · '+file.name,`<div class="stack"><div class="note">Archivo seleccionado pero todavía NO guardado. ${(file.size/1024).toFixed(1)} KB</div>${content}<div class="form-actions">${btn('Volver al gasto','close-modal','secondary')}</div></div>`);
}

function expenseSuppliersManager(){setView('gastos',{mode:'list',id:null,section:'proveedores'});setRoute('gastos');render()}

function expenseSupplierForm(row=null){
 const categories=[{value:'',label:'Sin categoría'},...state.data.categories.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||x.code||'Categoría'}))];
 const body=`<div class="form-grid">
  ${formField('Nombre','esName',row?.name||'')}
  ${formField('NIF/CIF','esTax',row?.tax_id||'')}
  ${formField('Email','esEmail',row?.email||'','email')}
  ${formField('Teléfono','esPhone',row?.phone||'')}
  ${formField('Dirección','esAddress',row?.address||'')}
  ${formField('Ciudad','esCity',row?.city||'')}
  ${formField('Código postal','esPostal',row?.postal_code||'')}
  ${formField('Provincia','esProvince',row?.province||'')}
  ${selectField('Categoría por defecto','esCategory',categories,row?.default_category_id||'')}
  ${selectField('Pago por defecto','esPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.default_payment_method||'transferencia')}
  ${selectField('Documento por defecto','esDocKind',[{value:'factura',label:'Factura'},{value:'rectificativa',label:'Rectificativa'},{value:'ticket',label:'Ticket'},{value:'nomina',label:'Nómina'},{value:'seguridad_social',label:'Seguridad Social'},{value:'recibo',label:'Recibo'},{value:'otro',label:'Otro'}],row?.default_document_kind||'factura')}
  ${formField('IVA (%)','esVat',row?.default_vat_rate??21,'number','step="0.1" min="0"')}
  ${formField('Recargo (%)','esRe',row?.default_re_rate??0,'number','step="0.1" min="0"')}
  ${formField('Retención (%)','esWh',row?.default_withholding_rate??0,'number','step="0.1" min="0"')}
  ${selectField('Modelo retención','esWhModel',[{value:'',label:'Sin modelo'},{value:'111',label:'111 · Nóminas y profesionales'},{value:'115',label:'115 · Alquiler del local'}],row?.default_withholding_model||'')}
  ${formField('% deducible','esDedPct',row?.default_deductible_pct??100,'number','min="0" max="100"')}
  <label><input id="esDeductible" type="checkbox" ${row?.default_deductible_irpf===false?'':'checked'}> Deducible IRPF por defecto</label>
  <label class="wide">Notas<textarea id="esNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 <label class="check-field"><input id="esActive" type="checkbox" ${row?.active===false?'':'checked'}> Proveedor activo</label></div><div class="form-actions">${btn('Guardar proveedor','expense-supplier-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar proveedor de gastos':'Nuevo proveedor de gastos',body);
}
async function saveExpenseSupplier(id=''){
 const taxId=val('esTax').trim();
 if(taxId){
   const dup=state.data.suppliers.find(x=>x.id!==id&&String(x.tax_id||'').trim().toLowerCase()===taxId.toLowerCase());
   if(dup)throw new Error('Ya existe un proveedor con ese NIF/CIF.');
 }
 const row={name:required('esName','Nombre'),tax_id:taxId,email:val('esEmail').trim(),phone:val('esPhone').trim(),address:val('esAddress').trim(),city:val('esCity').trim(),postal_code:val('esPostal').trim(),province:val('esProvince').trim(),country:'España',default_category_id:val('esCategory')||null,default_payment_method:val('esPayment'),default_document_kind:val('esDocKind'),default_vat_rate:Math.max(0,num('esVat')),default_re_rate:Math.max(0,num('esRe')),default_withholding_rate:Math.max(0,num('esWh')),default_withholding_model:val('esWhModel')||null,default_deductible_irpf:!!input('esDeductible')?.checked,default_deductible_pct:Math.min(100,Math.max(0,num('esDedPct'))),notes:val('esNotes').trim(),active:input('esActive')?.checked!==false,source:'manual',updated_at:new Date().toISOString()};
 try{if(id)await update('ops_suppliers',id,row);else await insert('ops_suppliers',{...row,created_by:state.user?.id||null})}
 catch(e){if(String(e.message).toLowerCase().includes('unique'))throw new Error('Ya existe un proveedor con ese NIF/CIF.');throw e}
 closeModal();await refresh('Proveedor de gastos guardado.');
}
async function deleteExpenseSupplier(id){
 const linked=state.data.expenses.filter(x=>x.supplier_id===id).length;
 if(linked)throw new Error('No se puede eliminar: hay '+linked+' gastos vinculados. Puedes dejar de usarlo sin borrar el histórico.');
 if(!confirm('¿Eliminar este proveedor de gastos?'))return;
 await remove('ops_suppliers',id);closeModal();await refresh('Proveedor eliminado.');
}

async function fileSha256(file){const buf=await file.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function quarterFromDate(date){const m=Number(String(date).slice(5,7));return 'T'+Math.ceil(m/3)}
async function verifiedStorageMetrics(){
 const usage=await reloadStorageUsage();
 if(usage.status!=='ok')throw new Error('No se puede comprobar el espacio en Supabase. Reintenta cuando se restablezca la conexión antes de subir archivos.');
 return usage;
}
async function createStoredDocument(file,{storeId=null,date,docType='otro',status='pendiente',party='',taxId='',number='',category='',notes='',linkedType=null,linkedId=null}={}){
 const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);
 const usage=await verifiedStorageMetrics(),limit=Number(usage.limit_bytes),used=Number(usage.total_bytes);
 validateDocumentFile(file,{maxBytes:max,usedBytes:used,limitBytes:limit});
 const y=String(date).slice(0,4),m=String(date).slice(5,7),storeNameValue=state.data.stores.find(s=>s.id===storeId)?.name||'General';
 const path=`${y}/${quarterFromDate(date)}/${m}/${safeFileSegment(storeNameValue)}/${safeFileSegment(docType)}/${safeFileSegment(party)}/${crypto.randomUUID()}_${safeFileSegment(file.name)}`;
 await upload('business-documents',path,file);
 let doc;
 try{
   doc=await insert('ops_documents',{store_id:storeId||null,doc_type:docType,document_date:date,supplier_or_customer:party,tax_id:taxId,invoice_number:number,category_code:category,status,storage_path:path,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:await fileSha256(file),linked_entity_type:linkedType||'',linked_entity_id:linkedId,notes,uploaded_by:state.session?.user?.id||null});
 }catch(e){throw await rollbackUploadedFile('business-documents',path,e)}
 return doc;
}
async function destroyDocument(doc){
 if(!doc)return;
 if(doc.storage_path)await removeFile('business-documents',doc.storage_path);
 await remove('ops_documents',doc.id);
}
async function rollbackUploadedFile(bucket,path,error){
 try{await removeFile(bucket,path);return error}
 catch(cleanup){console.error('Archivo pendiente de retirar',{bucket,path,error:cleanup});return new Error(error.message+' El archivo subido no se ha podido retirar del almacenamiento. No se ha presentado la operación como completada.')}
}
async function rollbackNewDocument(doc,error){
 try{await destroyDocument(doc);return error}
 catch(cleanup){return new Error(error.message+' No se ha podido completar la retirada del adjunto: '+cleanup.message+'. Revisa su ficha en Documentos antes de reintentar.')}
}

async function saveExpenseAttachment(id){
 const expense=state.data.expenses.find(x=>x.id===id);
 if(!expense)throw new Error('El gasto ya no está disponible. Actualiza el listado.');
 const file=input('exFile')?.files?.[0];
 if(!file)throw new Error('Selecciona primero la factura o justificante.');
 const newDoc=await createStoredDocument(file,{storeId:expense.store_id,date:expense.expense_date,docType:'factura_recibida',status:'pendiente',party:expense.supplier_name,taxId:expense.supplier_tax_id,number:expense.invoice_number,category:'gasto',notes:'Adjunto incorporado al gasto existente; revisión fiscal independiente',linkedType:'expense'});
 try{await update('ops_expenses',id,{document_id:newDoc.id})}
 catch(e){throw await rollbackNewDocument(newDoc,e)}
 // Financial fields, source references and fiscal review remain exactly as saved.
 // Preserve the previous document in the archive when replacing an attachment.
 await refresh('Factura adjuntada al mismo gasto. Importes y revisión fiscal conservados.');
}


function updateExpenseTaxTreatment(){
 const tax=val('exDocKind')==='impuesto',panel=input('exTaxPaymentFields');
 if(panel)panel.hidden=!tax;
 const management=input('exManagement');if(tax&&management)management.checked=true;
 const fiscal=input('exFiscalReviewed');if(fiscal){fiscal.disabled=tax;if(tax)fiscal.checked=false}
 for(const id of ['exStore','exSupplierId','exTax','exPayment','exPersonnelKind','exPaidStatus','exDate']){
  const el=input(id);if(el)el.disabled=tax;
 }
 const lines=input('expenseLines');if(lines)lines.hidden=tax;
 document.querySelector('[data-action="expense-line-add"]')?.classList.toggle('hidden',tax);
 const hint=input('exTaxConcept');if(hint)hint.hidden=!tax;
 for(const id of ['exSupplier','exInvoice']){const el=input(id);if(el)el.readOnly=tax}
 if(tax){
  if(input('exDate'))input('exDate').value=val('exPaidDate');
  if(input('exStore'))input('exStore').value='';
  const method=input('exPayment');if(method){if(![...method.options].some(o=>o.value===''))method.add(new Option('No indicado',''));method.value=''}
  if(input('exSupplier'))input('exSupplier').value='Agencia Tributaria';
  if(input('exInvoice'))input('exInvoice').value='Modelo '+val('exTaxPaymentModel')+' · '+val('exTaxPaymentQuarter')+'T '+val('exTaxPaymentYear');
  if(input('exPaidStatus'))input('exPaidStatus').value='pagado';
 }
 updateExpenseSummary();
}
function requireTaxExpensePermission(id){
 if(!can('fiscalidad',id?'edit':'create'))throw new Error('Necesitas permiso para '+(id?'editar':'crear')+' pagos en Fiscalidad.');
}
async function saveTaxExpenseAttachment(id){
 requireTaxExpensePermission(id);
 const payment=state.data.taxPayments.find(x=>x.id===id);
 if(!payment)throw new Error('El pago ya no está disponible.');
 const file=input('exFile')?.files?.[0];if(!file)throw new Error('Selecciona un justificante.');
 const doc=await createStoredDocument(file,{date:payment.payment_date,docType:'impuesto',status:'archivada',party:'Agencia Tributaria',number:'Modelo '+payment.tax_type+' · '+payment.period_label,category:'justificante_bancario',notes:'Justificante del mismo pago; solo control interno',linkedType:'tax_payment',linkedId:id});
 try{await update('ops_tax_payments',id,{document_id:doc.id})}
 catch(error){throw await rollbackNewDocument(doc,error)}
 await refresh('Justificante guardado. El importe y el tratamiento interno no han cambiado.');
}
async function saveTaxExpenseFromGastos(id=''){
 requireTaxExpensePermission(id);
 if(getView('gastos').id)throw new Error('No conviertas una factura existente en un pago de impuesto. Crea un registro nuevo.');
 const row=validateTaxExpense({model:val('exTaxPaymentModel'),year:num('exTaxPaymentYear'),quarter:num('exTaxPaymentQuarter'),date:val('exPaidDate'),amount:val('exPaidAmount').trim()===''?NaN:num('exPaidAmount'),internal:!!input('exManagement')?.checked,status:val('exPaidStatus'),today:isoToday()});
 const current=id?state.data.taxPayments.find(x=>x.id===id):null;
 if(id&&!current)throw new Error('El pago ya no está disponible.');
 if(state.data.taxPayments.some(x=>x.id!==id&&x.tax_type===row.tax_type&&Number(x.fiscal_year)===row.fiscal_year&&Number(x.quarter)===row.quarter))throw new Error('Ya existe este modelo para ese trimestre. Revisa el pago existente en Control interno; no lo dupliques.');
 const paymentId=id||crypto.randomUUID();
 row.notes=val('exNotes').trim();row.document_id=current?.document_id||null;
 let newDoc=null;
 const file=input('exFile')?.files?.[0];
 if(file){newDoc=await createStoredDocument(file,{date:row.payment_date,docType:'impuesto',status:'archivada',party:'Agencia Tributaria',number:'Modelo '+row.tax_type+' · '+row.period_label,category:'justificante_bancario',notes:'Solo control interno; excluido del cálculo fiscal',linkedType:'tax_payment',linkedId:paymentId});row.document_id=newDoc.id}
 try{
  if(id)await update('ops_tax_payments',id,row);
  else await insert('ops_tax_payments',{...row,id:paymentId,created_by:state.user?.id||null});
 }catch(error){throw newDoc?await rollbackNewDocument(newDoc,error):error}
 resetView('gastos');await refresh('Impuesto guardado como solo control interno, sin duplicar el gasto fiscal.');
}

async function saveExpense(id=''){
 if(val('exDocKind')==='impuesto'){await saveTaxExpenseFromGastos(getView('gastos').taxPaymentId||'');return}
 if(getView('gastos').taxPaymentId)throw new Error('Este registro es un pago de impuesto. Conserva su tipo y tratamiento interno.');
 const existing=id?state.data.expenses.find(x=>x.id===id):null;
 if(existing&&state.data.settings?.closed_through&&existing.expense_date<=state.data.settings.closed_through)throw new Error('Este gasto pertenece a un periodo cerrado. Usa «Registrar pago» para actualizar su pago; administración debe reabrir el periodo para corregir importes.');
 const storeId=required('exStore','Tienda'),date=required('exDate','Fecha'),supplier=required('exSupplier','Proveedor');
 if(date>isoToday())throw new Error('La fecha del gasto no puede ser futura.');
 const invoiceNumber=val('exInvoice').trim(),taxId=val('exTax').trim();
 if(invoiceNumber){
   const duplicate=state.data.expenses.find(x=>x.id!==id&&String(x.invoice_number||'').trim().toLowerCase()===invoiceNumber.toLowerCase()&&((taxId&&String(x.supplier_tax_id||'').trim().toLowerCase()===taxId.toLowerCase())||(!taxId&&String(x.supplier_name||'').trim().toLowerCase()===supplier.toLowerCase())));
   if(duplicate)throw new Error('Ya existe un gasto con esta factura para el mismo proveedor.');
 }
 const paidStatus=val('exPaidStatus')||'pagado',paidDate=paidStatus==='pendiente'?null:(val('exPaidDate')||null);
 if(paidStatus==='pagado'&&!paidDate)throw new Error('Indica la fecha en que se pagó el gasto.');
 if(paidDate&&paidDate>isoToday())throw new Error('La fecha de pago no puede ser futura.');
 const lineEls=[...document.querySelectorAll('.expense-line')];
 if(!lineEls.length)throw new Error('Añade al menos un concepto.');
 const lines=lineEls.map((el,i)=>{
   const ix=el.dataset.lineIndex,base=n(val(`exLineBase_${ix}`)),vat=n(val(`exLineVat_${ix}`)),re=n(val(`exLineRe_${ix}`)),wh=n(val(`exLineWh_${ix}`)),dedPct=n(val(`exLineDedPct_${ix}`));
   validateExpenseLineAmounts({base,vat,re,withholding:wh,deductiblePct:dedPct,documentKind:val('exDocKind')});
   const description=required(`exLineDesc_${ix}`,`Descripción de la línea ${i+1}`);
   return {sort_order:(i+1)*10,category_id:val(`exLineCategory_${ix}`)||null,description,base_amount:base,vat_rate:vat,vat_amount:0,re_base:0,re_rate:re,re_amount:0,irpf_imputable:0,withholding_base:0,withholding_rate:wh,withholding_amount:0,withholding_model:val(`exLineModel_${ix}`)||null,deductible_irpf:!!input(`exLineDed_${ix}`)?.checked,deductible_pct:dedPct,fixed_asset:!!input(`exLineFixed_${ix}`)?.checked,amortization_years:val(`exLineAmort_${ix}`)===''?null:n(val(`exLineAmort_${ix}`)),notes:''};
 });
 validateExpenseClassification(lines,state.data.categories,!!input('exManagement')?.checked);
 const total=lines.reduce((acc,l)=>acc+l.base_amount+l.base_amount*l.vat_rate/100+l.base_amount*l.re_rate/100-l.base_amount*l.withholding_rate/100,0);
 const amountPaid=val('exPaidAmount')===''?(paidStatus==='pagado'?total:0):num('exPaidAmount');
 validateExpensePayment(total,amountPaid,paidStatus,val('exDocKind'));
 const current=id?state.data.expenses.find(x=>x.id===id):null,oldDoc=current?.document_id?state.data.documents.find(x=>x.id===current.document_id):null;
 const file=input('exFile')?.files?.[0]||null;
 let newDoc=null,documentId=oldDoc?.id||null;
 if(file){
   newDoc=await createStoredDocument(file,{storeId,date,docType:'factura_recibida',status:paidStatus==='pagado'?'pagada':'pendiente',party:supplier,taxId,number:invoiceNumber,category:'gasto',notes:'Justificante de gasto',linkedType:'expense'});
   documentId=newDoc.id;
 }
 const first=lines[0];
 const expense={id:id||null,store_id:storeId,expense_date:date,supplier_id:val('exSupplierId')||null,supplier_name:supplier,supplier_tax_id:taxId,invoice_number:invoiceNumber,category_id:first.category_id,description:lines.map(l=>l.description).join(' · '),payment_method:val('exPayment'),paid_status:paidStatus,paid_date:paidDate,vat_rate:first.vat_rate,re_rate:first.re_rate,withholding_rate:first.withholding_rate,withholding_model:first.withholding_model,amount_paid:amountPaid,deductible_irpf:lines.every(l=>l.deductible_irpf),deductible_pct:first.deductible_pct,fixed_asset:lines.some(l=>l.fixed_asset),amortization_years:first.amortization_years,document_id:documentId,notes:val('exNotes').trim(),document_kind:val('exDocKind')||'factura',source:'manual',fiscal_reviewed:!input('exManagement')?.checked&&!!input('exFiscalReviewed')?.checked,management_only:!!input('exManagement')?.checked,personnel_kind:val('exPersonnelKind').trim()||null};
 let savedId;
 try{savedId=await rpc('totus_save_expense',{p_expense:expense,p_lines:lines})}
 catch(e){throw newDoc?await rollbackNewDocument(newDoc,e):e}
 setView('gastos',{mode:'record',id:savedId});await refresh('Gasto guardado.');
}
async function unlinkExpenseDocument(expenseId,documentId){
 const expense=state.data.expenses.find(x=>String(x.id)===String(expenseId));
 if(!expense||String(expense.document_id)!==String(documentId))throw new Error('El justificante ya no pertenece a este gasto. Actualiza la ficha.');
 if(!confirm('¿Desvincular el justificante? El original se conservará en Documentos; podrás eliminarlo allí por separado.'))return;
 await update('ops_expenses',expenseId,{document_id:null});
 await refresh('Justificante desvinculado. El archivo original se conserva en Documentos.');
}
async function deleteExpense(id){
 if(!confirm('¿Eliminar este gasto?'))return;
 const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 const row=state.data.expenses.find(x=>x.id===id),doc=row?.document_id?state.data.documents.find(x=>x.id===row.document_id):null;
 await rpc('totus_delete_expense',{p_id:id,p_reason:reason.trim()});
 resetView('gastos');await refresh(doc?'Gasto eliminado. El justificante original se conserva en Documentos.':'Gasto eliminado.');
}

function externalSequenceNumber(text){
 const m=String(text||'').match(/(\d+)\s*$/);return m?Number(m[1]):0;
}
async function saveInvoice(id='',type='factura',invoiceKind='invoice',origin='totus'){
 const issue=required('ivDate','Fecha de emisión'),operation=val('ivOperation')||null,due=val('ivDue')||null,paidDate=val('ivPaidDate')||null;
 if(issue>isoToday())throw new Error('La fecha de emisión no puede ser futura.');
 if(operation&&operation>isoToday())throw new Error('La fecha de operación no puede ser futura.');
 if(due&&due<issue)throw new Error('El vencimiento no puede ser anterior a la emisión.');
 if(paidDate&&paidDate>isoToday())throw new Error('La fecha de cobro no puede ser futura.');
 const lineEls=[...document.querySelectorAll('.invoice-line')];
 if(!lineEls.length)throw new Error('Añade al menos una línea.');
 const lines=lineEls.map((el,i)=>{
   const idx=el.dataset.lineIndex;
   const description=required(`ivDesc_${idx}`,`Descripción de la línea ${i+1}`);
   const quantity=n(val(`ivQty_${idx}`));if(Math.abs(quantity)<0.000001)throw new Error('La cantidad de la línea '+(i+1)+' no puede ser cero.');
   const unit_price_base=n(val(`ivUnit_${idx}`));
   const discount_pct=Math.min(100,Math.max(0,n(val(`ivDisc_${idx}`))));
   const vat_rate=Math.max(0,n(val(`ivVat_${idx}`)));
   return {sort_order:(i+1)*10,description,quantity,unit_price_base,discount_pct,vat_rate};
 });
 const customerName=required('ivCustomer','Cliente'),customerTax=val('ivTax').trim();
 let customerId=val('ivCustomerId')||null;
 if(customerId){
   const master=state.data.customers.find(x=>x.id===customerId);
   if(master&&(String(master.name||'').trim()!==customerName.trim()||String(master.tax_id||'').trim()!==customerTax))customerId=null;
 }
 const isProforma=type==='proforma';
 const paidStatus=isProforma?'pendiente':(val('ivPaidStatus')||'pendiente'),paidAmount=isProforma?0:num('ivPaidAmount');
 if(!isProforma)validateInvoiceSettlement(readInvoiceDraft().row.total_amount,paidAmount,paidStatus,paidDate,isoToday());
 if(invoiceKind==='rectifying'&&!isProforma){required('ivRectifiedInvoice','Factura original');required('ivRectificationReason','Motivo de rectificación')}
 const current=id?state.data.invoices.find(x=>x.id===id):null;
 const oldSource=current?.source_document_id?state.data.documents.find(x=>x.id===current.source_document_id):null;
 let sourceDoc=oldSource||null,newSource=null;
 if(origin==='externa'){
   if(!val('ivExternalNumber').trim())throw new Error('Indica el número de la factura externa.');
   const sourceFile=input('ivSourceFile')?.files?.[0]||null;
   if(sourceFile)newSource=await createStoredDocument(sourceFile,{storeId:required('ivStore','Tienda'),date:issue,docType:'factura_emitida',status:'archivada',party:customerName,taxId:customerTax,number:val('ivExternalNumber').trim(),category:'facturacion',notes:'Original de factura externa',linkedType:'sales_invoice'});
   sourceDoc=newSource||oldSource;
   if(!sourceDoc)throw new Error('La factura externa exige el archivo original.');
   if(!val('ivExternalNumber').trim())throw new Error('Indica el número de la factura externa.');
 }

 const doc={id:id||null,series_id:required('ivSeries','Serie'),store_id:required('ivStore','Tienda'),issue_date:issue,due_date:due,operation_date:operation,origin,document_type:type,invoice_kind:isProforma?'invoice':invoiceKind,customer_id:customerId,customer_name:customerName,customer_tax_id:customerTax,customer_address:val('ivAddress').trim(),customer_email:val('ivEmail').trim(),concept:val('ivConcept').trim(),payment_method:val('ivPayment'),paid_status:paidStatus,paid_date:isProforma?null:paidDate,paid_amount:paidAmount,include_in_income:isProforma?false:!!input('ivIncludeIncome')?.checked,template_id:val('ivTemplate')||null,purchase_order_ref:val('ivPO').trim(),terms_text:val('ivTerms').trim(),footer_text:val('ivFooter').trim(),notes:val('ivNotes').trim(),source_document_id:sourceDoc?.id||null,external_number_text:origin==='externa'?val('ivExternalNumber').trim():''};
 doc.rectified_invoice_id=invoiceKind==='rectifying'&&!isProforma?val('ivRectifiedInvoice')||null:null;
 doc.rectification_reason=invoiceKind==='rectifying'&&!isProforma?val('ivRectificationReason').trim():'';
 let savedId;
 try{savedId=await rpc('totus_save_sales_document',{p_document:doc,p_lines:lines})}
 catch(e){throw newSource?await rollbackNewDocument(newSource,e):e}
 setView('facturacion',{mode:'record',id:savedId,docType:type,invoiceKind:doc.invoice_kind,origin});
 await refresh(isProforma?'Proforma guardada.':'Documento guardado.');
}
async function saveInvoicePayment(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)throw new Error('Factura no encontrada.');
 const status=val('ivPaidStatus')||'pendiente',amount=num('ivPaidAmount'),date=val('ivPaidDate')||null,method=val('ivPayment')||'transferencia';
 validateInvoiceSettlement(Number(row.total_amount||0),amount,status,date,isoToday());
 await rpc('totus_update_invoice_payment',{p_id:id,p_payment:{paid_status:status,paid_amount:amount,paid_date:date,payment_method:method}});
 await refresh(row.invoice_kind==='rectifying'?'Liquidación actualizada.':'Cobro actualizado.');
}

async function deleteDraftInvoice(id){
 const row=state.data.invoices.find(x=>x.id===id);
 if(!row)throw new Error('El borrador ya no existe. Actualiza los documentos.');
 if(row.status!=='borrador'||row.number!=null||row.issued_at||String(row.display_number||'').trim())throw new Error('Este documento ya está emitido o numerado. Para corregirlo utiliza una rectificativa; no se puede borrar.');
 if(!confirm('¿Eliminar este borrador y todos sus conceptos? El documento original adjunto, si existe, permanecerá en Documentos.'))return;
 const reason=prompt('Indica el motivo de eliminación del borrador:');
 if(!reason?.trim())return;
 await rpc('totus_delete_sales_draft',{p_id:id,p_reason:reason.trim()});
 resetView('facturacion');await refresh('Borrador eliminado. La operación ha quedado registrada.');
}

async function finalizeInvoice(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)return;
 if(!confirm(row.origin==='externa'?'¿Registrar definitivamente esta factura externa?':'¿Emitir este documento? Después quedará bloqueado.'))return;
 if(row.origin==='externa'){
   const seq=externalSequenceNumber(row.external_number_text);
   if(!seq)throw new Error('No puedo obtener la parte numérica del número externo.');
   await rpc('totus_register_external_document',{p_id:id,p_number:seq});
 }else{
   await rpc('totus_finalize_sales_document',{p_id:id});
 }
 await refresh('Documento emitido.');
}

async function saveProduct(id=''){
 const sku=required('prSku','Referencia'),name=required('prName','Nombre');
 const duplicate=state.data.products.find(x=>x.id!==id&&String(x.sku||'').trim().toLowerCase()===sku.trim().toLowerCase());
 if(duplicate)throw new Error('Ya existe un producto con esa referencia.');
 const row={name,sku,family_id:val('prFamily')||null,product_type:val('prType'),current_pvp:num('prPvp')||null,proposed_pvp:num('prProposed')||null,units_month:Math.max(0,Math.round(num('prUnits'))),status:val('prStatus')||'PENDIENTE',notes:val('prNotes').trim(),updated_at:new Date().toISOString()};
 let saved;
 if(id)saved=await update('products',id,row);else saved=await insert('products',{...row,created_by:state.user?.id||null});
 setView('pricing',{mode:'record',id:saved.id});await refresh('Producto guardado.');
}
async function deleteProduct(id){
 const p=state.data.products.find(x=>x.id===id);if(!p)return;
 if(!confirm('¿Eliminar el producto '+p.name+' y todos sus precios, variantes e histórico?'))return;
 const check=prompt('Escribe ELIMINAR PRODUCTO para confirmar:');if(check!=='ELIMINAR PRODUCTO')return;
 await remove('products',id);resetView('pricing');await refresh('Producto eliminado.');
}

function addExpenseLine(){
 const host=document.getElementById('expenseLines');if(!host)return;
 const indexes=[...host.querySelectorAll('.expense-line')].map(x=>Number(x.dataset.lineIndex)||0);
 const next=indexes.length?Math.max(...indexes)+1:0;
 const categories=state.data.categories.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||x.code||'Categoría'}));
 host.insertAdjacentHTML('beforeend',expenseLineRow({},next,categories));
 updateExpenseSummary();
}
function removeExpenseLine(index){
 const rows=[...document.querySelectorAll('.expense-line')];
 if(rows.length<=1){toast('Debe quedar al menos una línea.','bad');return}
 document.querySelector(`.expense-line[data-line-index="${index}"]`)?.remove();updateExpenseSummary();
}
function updateExpenseSummary(){
 if(val('exDocKind')==='impuesto'){for(const id of ['exSumBase','exSumVat','exSumRe','exSumWh'])if(input(id))input(id).textContent=money(0);if(input('exSumTotal'))input('exSumTotal').textContent=money(num('exPaidAmount'));return}

 const rows=[...document.querySelectorAll('.expense-line')];let base=0,vat=0,re=0,wh=0;
 for(const el of rows){const ix=el.dataset.lineIndex,b=Math.max(0,n(val(`exLineBase_${ix}`))),v=Math.max(0,n(val(`exLineVat_${ix}`))),r=Math.max(0,n(val(`exLineRe_${ix}`))),w=Math.max(0,n(val(`exLineWh_${ix}`)));base+=b;vat+=b*v/100;re+=b*r/100;wh+=b*w/100}
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=money(v)};
 set('exSumBase',base);set('exSumVat',vat);set('exSumRe',re);set('exSumWh',wh);set('exSumTotal',base+vat+re-wh);
}
function updateClosingSummary(){
 const rows=[...document.querySelectorAll('.drawer-entry')];let total=0;
 for(const el of rows){const d=el.dataset.drawerId,read=s=>n(document.getElementById(`dr${s}_${d}`)?.value||0);const cash=read('Close')+read('Withdraw')+read('CashExpense')+read('ExtraOut')-read('ExtraIn')-read('Open');total+=cash+read('Card')+read('Bizum')+read('Online')+read('Other')}
 const reported=val('clReported')===''?null:num('clReported'),diff=reported==null?0:Math.round((total-reported)*100)/100,fmt=v=>money(v);
 const t=document.getElementById('clCalcTotal'),r=document.getElementById('clReportedTotal'),d=document.getElementById('clDifference');if(t)t.textContent=fmt(total);if(r)r.textContent=reported==null?'—':fmt(reported);if(d){d.textContent=reported==null?'Sin total para comparar':fmt(diff);d.className=reported==null?'muted':Math.abs(diff)>.01?'danger-text':'good-text'}
}
function updateInvoiceSummary(){
 const draft=readInvoiceDraft(),base=draft.row.base_amount,vat=draft.row.vat_amount;
 const fmt=v=>money(v);for(const [id,v] of [['ivSumBase',base],['ivSumVat',vat],['ivSumTotal',base+vat]]){const el=document.getElementById(id);if(el)el.textContent=fmt(v)}
}
function readInvoiceDraft(){
 const current=state.data.invoices.find(x=>x.id===getView('facturacion').id)||{},view=getView('facturacion');
 const round=value=>Math.sign(value)*Math.round((Math.abs(value)+Number.EPSILON)*100)/100;
 const lines=[...document.querySelectorAll('.invoice-line')].map((el,i)=>{
  const ix=el.dataset.lineIndex,quantity=n(val(`ivQty_${ix}`)),unit_price_base=n(val(`ivUnit_${ix}`)),discount_pct=Math.min(100,Math.max(0,n(val(`ivDisc_${ix}`)))),vat_rate=Math.max(0,n(val(`ivVat_${ix}`)));
  const base_amount=round(quantity*unit_price_base*(1-discount_pct/100)),vat_amount=round(base_amount*vat_rate/100);
  return {sort_order:i,description:val(`ivDesc_${ix}`),quantity,unit_price_base,discount_pct,vat_rate,base_amount,vat_amount,total_amount:round(base_amount+vat_amount)};
 });
 const base_amount=round(lines.reduce((sum,line)=>sum+line.base_amount,0)),vat_amount=round(lines.reduce((sum,line)=>sum+line.vat_amount,0));
 const row={...current,status:current.status||'borrador',document_type:current.document_type||view.docType||'factura',invoice_kind:current.invoice_kind||view.invoiceKind||'invoice',issue_date:val('ivDate'),operation_date:val('ivOperation'),due_date:val('ivDue'),external_number_text:val('ivExternalNumber'),customer_name:val('ivCustomer'),customer_tax_id:val('ivTax'),customer_address:val('ivAddress'),customer_email:val('ivEmail'),concept:val('ivConcept'),payment_method:val('ivPayment'),paid_status:val('ivPaidStatus'),paid_amount:num('ivPaidAmount'),template_id:val('ivTemplate'),terms_text:val('ivTerms'),footer_text:val('ivFooter'),base_amount,vat_amount,total_amount:round(base_amount+vat_amount)};
 row.rectified_invoice_id=val('ivRectifiedInvoice')||current.rectified_invoice_id||null;
 row.rectification_reason=val('ivRectificationReason')||current.rectification_reason||'';
 const original=state.data.invoices.find(x=>x.id===row.rectified_invoice_id);
 row.rectified_invoice_snapshot=current.rectified_invoice_id===row.rectified_invoice_id&&current.rectified_invoice_snapshot&&Object.keys(current.rectified_invoice_snapshot).length?current.rectified_invoice_snapshot:original?{number:original.display_number||original.external_number_text,issue_date:original.issue_date}:{};
 return {row,lines};
}
let draftPreviewSequence=0;
const draftLogoCache=new Map();
async function draftPreviewHtml(){
 const {row,lines}=readInvoiceDraft(),tpl=row.status!=='borrador'&&row.template_snapshot?row.template_snapshot:state.data.templates.find(t=>t.id===row.template_id);
 const key=tpl?.show_logo===false?'':tpl?.logo_path||'';
 let cached=draftLogoCache.get(key);
 if(!cached||cached.expires<Date.now()){cached={expires:Date.now()+240000,url:key?invoiceLogoUrl(row):Promise.resolve('')};draftLogoCache.set(key,cached)}
 return invoicePreview(row,await cached.url,{lines,actions:false});
}
let draftPreviewResizeObserver;
async function updateDraftInvoicePreview(){
 const host=input('invoiceDraftPreview');if(!host)return;
 const sequence=++draftPreviewSequence,html=await draftPreviewHtml();
 if(host.isConnected&&sequence===draftPreviewSequence){
  host.innerHTML=html;
  const fit=()=>{if(host.isConnected)host.style.setProperty('--preview-scale',String(Math.min(1,host.clientWidth/794)))};
  fit();
  draftPreviewResizeObserver?.disconnect();draftPreviewResizeObserver=new ResizeObserver(fit);draftPreviewResizeObserver.observe(host);
 }
}
async function showDraftInvoicePreview(){modal('Vista previa del documento sin guardar',`<div class="note">Esta vista no guarda ni emite el documento.</div>${await draftPreviewHtml()}`)}
function exportCurrentModule(module){
 const f=getFilters(module);
 if(module==='cajas'){
   const closings=state.data.closings.filter(x=>(!f.from||x.business_date>=f.from)&&(!f.to||x.business_date<=f.to)&&(f.store==='all'||x.store_id===f.store)&&matchesText(f.query,x.notes,state.data.stores.find(s=>s.id===x.store_id)?.name,x.status));
   return exportClosingsWorkbook({settings:state.data.settings,closings,closingDrawers:state.data.closingDrawers.filter(d=>closings.some(c=>c.id===d.closing_id)),stores:state.data.stores,drawers:state.data.drawers,from:f.from,to:f.to});
 }
 // In the invoices/receipts subtab the exported expenses must match the visible
 // attachment filter. In the normal expense subtab that filter is not displayed.
 const invoiceSection=getView('gastos').section==='facturas';
 const attachmentFilter=invoiceSection?(f.attachment||'all'):'all';
 const documentsById=new Map(state.data.documents.map(d=>[String(d.id),d]));
 const search=searchText(f.query);
 const expenses=state.data.expenses.filter(x=>(!f.from||x.expense_date>=f.from)&&(!f.to||x.expense_date<=f.to)&&(f.store==='all'||x.store_id===f.store)&&(f.kind==='all'||!f.kind||(f.kind==='internal'?x.management_only:!x.management_only))&&(f.paid==='all'||!f.paid||x.paid_status===f.paid)
  &&(attachmentFilter==='all'||(attachmentFilter==='attached'?documentsById.has(String(x.document_id)):!documentsById.has(String(x.document_id))))
  &&(!search||(invoiceSection
   ?[x.supplier_name,x.supplier_tax_id,x.invoice_number,x.description,documentsById.get(String(x.document_id))?.original_name]
   :[x.supplier_name,x.invoice_number,x.description,x.payment_method,x.supplier_tax_id,x.notes,state.data.stores.find(s=>s.id===x.store_id)?.name]).filter(Boolean).map(searchText).join(' ').includes(search)));
 return exportExpensesWorkbook({settings:state.data.settings,expenses,stores:state.data.stores,taxPayments:state.data.taxPayments,reportFilter:f,from:f.from,to:f.to});
}

function addInvoiceLine(){
 const host=document.getElementById('invoiceLines');if(!host)return;
 const indexes=[...host.querySelectorAll('.invoice-line')].map(x=>Number(x.dataset.lineIndex)||0);
 const next=indexes.length?Math.max(...indexes)+1:0;
 host.insertAdjacentHTML('beforeend',invoiceLineRow({},next));updateInvoiceSummary();updateDraftInvoicePreview();
}
function removeInvoiceLine(index){
 const rows=[...document.querySelectorAll('.invoice-line')];
 if(rows.length<=1){toast('Debe quedar al menos una línea.','bad');return}
 document.querySelector(`.invoice-line[data-line-index="${index}"]`)?.remove();updateInvoiceSummary();updateDraftInvoicePreview();
}
async function invoiceLogoUrl(row){
 const frozen=row.status!=='borrador'&&row.template_snapshot&&Object.keys(row.template_snapshot||{}).length?row.template_snapshot:null;
 const tpl=frozen||(state.data.templates.find(x=>x.id===row.template_id));
 if(!tpl?.logo_path||tpl.show_logo===false)return '';
 try{return await signedUrl('business-assets',tpl.logo_path,300)}catch{return ''}
}
async function showInvoicePreview(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)return;
 const logo=await invoiceLogoUrl(row);
 modal('Vista previa',invoicePreview(row,logo));
}
async function printInvoice(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)return;
 const w=window.open('','_blank');if(!w)throw new Error('El navegador ha bloqueado la ventana de impresión.');
 try{w.opener=null}catch{}
 const logo=await invoiceLogoUrl(row);
 const html=invoicePreview(row,logo).replace(/<div class="form-actions">[\s\S]*?<\/div>\s*<\/div>$/,'</div>');
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(row.display_number||'Documento')}</title><link rel="stylesheet" href="${new URL('src/styles.css',location.href).href}"><style>body{padding:28px;background:white}.btn,.form-actions{display:none!important}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}
async function convertProforma(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)return;
 const series=state.data.series.filter(s=>s.active!==false&&s.document_type==='factura'&&s.series_kind==='invoice'&&(!s.store_id||s.store_id===row.store_id));
 if(!series.length)throw new Error('No hay serie ordinaria de factura para esta tienda.');
 if(!confirm('¿Convertir esta proforma en factura?'))return;
 await rpc('totus_convert_proforma',{p_id:id,p_invoice_series:series[0].id});
 await refresh('Proforma convertida en factura.');
}

function familiesManager(){
 const brands=[...state.data.brands].sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const families=[...state.data.families].sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const brandName=id=>brands.find(x=>x.id===id)?.name||'—';
 const body=`<div class="split">
  <section><div class="section-head"><div><h3>Marcas</h3><p>Maestro usado por las familias.</p></div>${btn('+ Marca','brand-new','primary')}</div><div class="stack" style="margin-top:12px">${brands.length?brands.map(b=>`<div class="summary-row"><div><b>${esc(b.name)}</b><div class="small muted">${families.filter(f=>f.brand_id===b.id).length} familias</div></div><div class="inline-actions">${btn('Editar','brand-edit','secondary',`data-id="${b.id}"`)}${btn('Eliminar','brand-delete','danger',`data-id="${b.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin marcas</strong></div>'}</div></section>
  <section><div class="section-head"><div><h3>Familias</h3><p>Agrupa productos y margen objetivo.</p></div>${btn('+ Familia','family-new','primary')}</div><div class="stack" style="margin-top:12px">${families.length?families.map(f=>`<div class="summary-row"><div><b>${esc(f.name)}</b><div class="small muted">${esc(brandName(f.brand_id))} · ${esc(f.category||'')} · margen ${Number(f.default_margin||0).toFixed(1).replace('.',',')} %</div></div><div class="inline-actions">${btn('Editar','family-edit','secondary',`data-id="${f.id}"`)}${btn('Eliminar','family-delete','danger',`data-id="${f.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin familias</strong></div>'}</div></section>
 </div>`;
 modal('Marcas y familias',body);
}
function brandForm(row=null){
 const body=`<div class="form-grid">${formField('Nombre','brName',row?.name||'')}</div><div class="form-actions">${btn('Guardar marca','brand-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar marca':'Nueva marca',body,{small:true});
}
async function saveBrand(id=''){
 const name=required('brName','Nombre');
 const dup=state.data.brands.find(x=>x.id!==id&&String(x.name||'').trim().toLowerCase()===name.toLowerCase());if(dup)throw new Error('Ya existe una marca con ese nombre.');
 if(id)await update('brands',id,{name});else await insert('brands',{name});
 closeModal();await refresh('Marca guardada.');
}
async function deleteBrand(id){
 const linked=state.data.families.filter(x=>x.brand_id===id).length;if(linked)throw new Error('No se puede eliminar: la marca tiene '+linked+' familias vinculadas.');
 if(!confirm('¿Eliminar esta marca?'))return;await remove('brands',id);closeModal();await refresh('Marca eliminada.');
}
function familyForm(row=null){
 if(!state.data.brands.length){toast('Crea primero una marca.','bad');brandForm();return}
 const brands=state.data.brands.map(x=>({value:x.id,label:x.name}));
 const body=`<div class="form-grid">${selectField('Marca','fmBrand',brands,row?.brand_id||brands[0]?.value||'')}${formField('Nombre','fmName',row?.name||'')}${formField('Categoría','fmCategory',row?.category||'General')}${formField('Margen objetivo (%)','fmMargin',row?.default_margin??30,'number','step="0.1" min="0" max="100"')}</div><div class="form-actions">${btn('Guardar familia','family-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar familia':'Nueva familia',body,{small:true});
}
async function saveFamily(id=''){
 const brandId=required('fmBrand','Marca'),name=required('fmName','Nombre'),category=required('fmCategory','Categoría'),default_margin=Math.min(100,Math.max(0,num('fmMargin')));
 const dup=state.data.families.find(x=>x.id!==id&&x.brand_id===brandId&&String(x.name||'').trim().toLowerCase()===name.toLowerCase());if(dup)throw new Error('Ya existe esa familia para la misma marca.');
 const row={brand_id:brandId,name,category,default_margin};
 if(id)await update('families',id,row);else await insert('families',row);
 closeModal();await refresh('Familia guardada.');
}
async function deleteFamily(id){
 const linked=state.data.products.filter(x=>x.family_id===id).length;if(linked)throw new Error('No se puede eliminar: la familia tiene '+linked+' productos vinculados.');
 if(!confirm('¿Eliminar esta familia?'))return;await remove('families',id);closeModal();await refresh('Familia eliminada.');
}

function providersManager(){
 const rows=state.data.providers.filter(x=>x.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const body=`<div class="section-head"><div><p>Directorio único de proveedores para Pricing.</p></div>${btn('Nuevo proveedor','provider-new','primary')}</div>
 <div class="stack" style="margin-top:14px">${rows.length?rows.map(p=>`<div class="summary-row"><div><b>${esc(p.name)}</b><div class="small muted">${state.data.providerPrices.filter(x=>x.provider_id===p.id).length} precios vinculados</div></div><div class="inline-actions">${btn('Editar','provider-edit','secondary',`data-id="${p.id}"`)}${btn('Eliminar','provider-delete','danger',`data-id="${p.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin proveedores</strong><span>Añade el primero.</span></div>'}</div>`;
 modal('Proveedores',body);
}
function providerForm(row=null){
 const body=`<div class="form-grid">${formField('Nombre','pvName',row?.name||'')}</div><div class="form-actions">${btn('Guardar proveedor','provider-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar proveedor':'Nuevo proveedor',body,{small:true});
}
async function saveProvider(id=''){
 const row={name:required('pvName','Nombre'),active:true};
 if(id)await update('providers',id,row);else await insert('providers',row);
 closeModal();await refresh('Proveedor guardado.');
}
async function deleteProvider(id){
 const linked=state.data.providerPrices.filter(x=>x.provider_id===id).length;
 if(linked)throw new Error('No se puede eliminar: el proveedor tiene '+linked+' precios vinculados.');
 if(!confirm('¿Eliminar este proveedor?'))return;
 await remove('providers',id);closeModal();await refresh('Proveedor eliminado.');
}
function providerPriceForm(productId,row=null){
 if(!state.data.providers.length){toast('Crea primero un proveedor.','bad');providersManager();return}
 const providers=state.data.providers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}));
 const body=`<div class="form-grid">
  ${selectField('Proveedor','ppProvider',providers,row?.provider_id||providers[0]?.value||'')}
  ${formField('Coste proveedor','ppNet',row?.net_cost??'','number','step="0.01"')}
  ${formField('Descuento proveedor (%)','ppDiscount',row?.provider_discount??0,'number','step="0.1" min="0" max="100"')}
  ${formField('Transporte por unidad','ppShipping',row?.shipping_unit??0,'number','step="0.01"')}
  ${formField('Pedido mínimo','ppMoq',row?.moq??0,'number','min="0"')}
  ${formField('Stock / plazo','ppStock',row?.stock_status||'')}
  ${formField('Origen compra','ppOrigin',row?.purchase_origin||'España')}
  <label><input id="ppSelected" type="checkbox" ${row?.selected?'checked':''}> Proveedor seleccionado</label>
  <label class="wide">Notas<textarea id="ppNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="note">El coste de proveedor debe ser el coste real de compra sin IVA/RE. El impuesto especial de sales ya viene incluido en ese coste y no se suma de nuevo.</div>
 <div class="form-actions">${btn('Guardar coste','provider-price-save','primary',`data-product="${productId}" ${row?`data-id="${row.id}"`:''}`)}</div>`;
 modal(row?'Editar coste de proveedor':'Añadir proveedor al producto',body);
}
async function saveProviderPrice(productId,id=''){
 const selected=!!input('ppSelected')?.checked;
 const row={product_id:productId,variant_id:null,provider_id:required('ppProvider','Proveedor'),net_cost:num('ppNet'),provider_discount:Math.min(100,Math.max(0,num('ppDiscount'))),shipping_unit:Math.max(0,num('ppShipping')),moq:Math.max(0,Math.round(num('ppMoq'))),stock_status:val('ppStock').trim(),price_date:isoToday(),notes:val('ppNotes').trim(),selected,purchase_origin:val('ppOrigin').trim()||'España',apply_special_tax:false,special_tax_amount:0};
 if(selected){const r=await sb.from('product_provider_prices').update({selected:false}).eq('product_id',productId).is('variant_id',null);if(r.error)throw r.error}
 if(id)await update('product_provider_prices',id,row);else await insert('product_provider_prices',row);
 closeModal();await refresh('Coste de proveedor guardado.');setView('pricing',{mode:'record',id:productId});setRoute('pricing');render();
}
async function deleteProviderPrice(productId,id){
 if(!confirm('¿Eliminar este coste de proveedor?'))return;
 await remove('product_provider_prices',id);closeModal();await refresh('Coste eliminado.');setView('pricing',{mode:'record',id:productId});setRoute('pricing');render();
}
function competitorForm(productId,row=null){
 const body=`<div class="form-grid">
  ${formField('Competidor','cpName',row?.competitor_name||'')}
  ${formField('Precio','cpPrice',row?.price??'','number','step="0.01"')}
  ${formField('Descuento (%)','cpDiscount',row?.discount??0,'number','step="0.1" min="0" max="100"')}
  ${formField('Envío','cpShipping',row?.shipping??0,'number','step="0.01"')}
  ${formField('Stock','cpStock',row?.stock_status||'Sí')}
  ${formField('Promoción','cpPromo',row?.promo_type||'')}
  ${formField('URL','cpUrl',row?.url||'','url')}
  <label class="wide">Notas<textarea id="cpNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="form-actions">${btn('Guardar competencia','competitor-save','primary',`data-product="${productId}" ${row?`data-id="${row.id}"`:''}`)}</div>`;
 modal(row?'Editar competencia':'Añadir competencia',body);
}
async function saveCompetitor(productId,id=''){
 const row={product_id:productId,variant_id:null,competitor_name:required('cpName','Competidor'),url:val('cpUrl').trim(),price:num('cpPrice'),discount:Math.min(100,Math.max(0,num('cpDiscount'))),shipping:Math.max(0,num('cpShipping')),stock_status:val('cpStock').trim()||'Sí',promo_type:val('cpPromo').trim(),capture_date:isoToday(),notes:val('cpNotes').trim()};
 if(id)await update('product_competitor_prices',id,row);else await insert('product_competitor_prices',row);
 closeModal();await refresh('Competencia guardada.');setView('pricing',{mode:'record',id:productId});setRoute('pricing');render();
}
async function deleteCompetitor(productId,id){
 if(!confirm('¿Eliminar este precio de competencia?'))return;
 await remove('product_competitor_prices',id);closeModal();await refresh('Competencia eliminada.');setView('pricing',{mode:'record',id:productId});setRoute('pricing');render();
}
function variantForm(productId,row=null){
 const body=`<div class="form-grid">
  ${formField('Nombre variante','vrName',row?.name||'')}
  ${formField('Referencia / SKU','vrSku',row?.sku||'')}
  ${formField('Nicotina mg/ml','vrNic',row?.nicotine_mg_ml??'','number','step="0.1" min="0"')}
  ${formField('Volumen ml','vrVol',row?.volume_ml??'','number','step="0.1" min="0"')}
  ${formField('Impuesto €/ml (informativo)','vrTaxRate',row?.special_tax_rate_ml??'','number','step="0.01" min="0"')}
  ${formField('Impuesto total (informativo)','vrTaxAmount',row?.special_tax_amount??'','number','step="0.01" min="0"')}
  ${formField('Coste neto final','vrCost',row?.cost_net??'','number','step="0.01"')}
  ${formField('PVP','vrPvp',row?.pvp??'','number','step="0.01"')}
 </div><div class="note">El coste neto final debe ser el coste real de compra. El impuesto se guarda como información y no se suma de nuevo automáticamente.</div>
 <div class="form-actions">${btn('Guardar variante','variant-save','primary',`data-product="${productId}" ${row?`data-id="${row.id}"`:''}`)}</div>`;
 modal(row?'Editar variante':'Nueva variante',body);
}
async function saveVariant(productId,id=''){
 const row={product_id:productId,name:required('vrName','Nombre'),sku:required('vrSku','Referencia'),attributes:id?(state.data.variants.find(x=>x.id===id)?.attributes||{}):{},nicotine_mg_ml:val('vrNic')===''?null:num('vrNic'),volume_ml:val('vrVol')===''?null:num('vrVol'),special_tax_rate_ml:val('vrTaxRate')===''?null:num('vrTaxRate'),special_tax_amount:val('vrTaxAmount')===''?null:num('vrTaxAmount'),cost_net:val('vrCost')===''?null:num('vrCost'),pvp:val('vrPvp')===''?null:num('vrPvp'),active:true};
 if(id)await update('product_variants',id,row);else await insert('product_variants',row);
 closeModal();await refresh('Variante guardada.');setView('pricing',{mode:'record',id:productId});setRoute('pricing');render();
}
async function deleteVariant(productId,id){
 if(!confirm('¿Eliminar esta variante?'))return;
 await remove('product_variants',id);closeModal();await refresh('Variante eliminada.');setView('pricing',{mode:'record',id:productId});setRoute('pricing');render();
}
function updatePricingQuick(){
 const r=quickPriceStudy({cost:val('pqCost'),pvp:val('pqPvp'),competitor:val('pqCompetitor'),discount:val('pqDiscount'),vat:state.data.settings?.default_sales_vat_rate??21,re:state.data.settings?.purchase_re_rate??5.2});
 const set=(id,text,cls='')=>{const el=document.getElementById(id);if(el){el.textContent=text;el.className=cls}};
 set('pqReal',money(r.costReal));set('pqSale',money(r.finalSale));set('pqMargin',money(r.margin),r.margin<0?'danger-text':r.marginPct<18?'warn-text':'good-text');set('pqMarginPct',r.marginPct.toFixed(1).replace('.',',')+' %',r.margin<0?'danger-text':r.marginPct<18?'warn-text':'good-text');set('pqCompetition',r.competitorDiff==null?'—':((r.competitorDiff>0?'+':'')+money(r.competitorDiff)),r.competitorDiff==null?'':r.competitorDiff>0?'warn-text':'good-text');
}
async function saveConsultation(){
 const query=required('pqQuery','Consulta');
 const r=quickPriceStudy({cost:val('pqCost'),pvp:val('pqPvp'),competitor:val('pqCompetitor'),discount:val('pqDiscount'),vat:state.data.settings?.default_sales_vat_rate??21,re:state.data.settings?.purchase_re_rate??5.2});
 const row=await insert('consultations',{query,cost_net:r.cost,pvp:r.pvp,competitor:r.competitor,discount:r.discount,cost_real:r.costReal,final_sale:r.finalSale,margin:r.margin,margin_pct:r.marginPct,created_by:state.user?.id||null,last_reopened_at:null,updated_at:new Date().toISOString()});
 const logged=await recordConsultationHistory({consultation_id:row.id,user_id:state.user?.id||null,action:'CREADA',consultation_query:query,snapshot:row});
 await refresh(logged?'Consulta guardada.':'Consulta guardada, pero no se pudo guardar su historial. Revisa el registro antes de continuar.');
}
async function recordConsultationHistory(row){
 try{await insert('consultation_history',row);return true}
 catch(error){console.warn('No se pudo guardar el historial de la consulta',error);return false}
}
function consultationConvertForm(id){
 const c=state.data.consultations.find(x=>x.id===id);if(!c)return;
 const families=[{value:'',label:'Sin familia'},...state.data.families.map(x=>({value:x.id,label:x.name}))];
 const providers=[{value:'',label:'Sin proveedor'},...state.data.providers.map(x=>({value:x.id,label:x.name}))];
 const body=`<div class="form-grid">
  ${formField('Nombre producto','ccName',c.query||'')}
  ${formField('Referencia / SKU','ccSku','')}
  ${selectField('Familia','ccFamily',families,'')}
  ${selectField('Proveedor obligatorio','ccProvider',[{value:'',label:'Selecciona proveedor'},...providers],'')}
  ${formField('Coste neto','ccCost',c.cost_net??0,'number','step="0.01" min="0"')}
  ${formField('PVP','ccPvp',c.pvp??0,'number','step="0.01" min="0"')}
 </div><div class="note" style="margin-top:12px">El impuesto especial de sales no se vuelve a sumar: el coste introducido se conserva como coste de compra.</div><div class="form-actions">${btn('Crear producto','consultation-convert-save','primary',`data-id="${id}"`)}</div>`;
 modal('Convertir consulta en producto',body,{small:true});
}
async function convertConsultation(id){
 const c=state.data.consultations.find(x=>x.id===id);if(!c)throw new Error('Consulta no encontrada.');
 const sku=required('ccSku','Referencia / SKU').trim(),name=required('ccName','Nombre');
 const dup=state.data.products.find(x=>String(x.sku||'').trim().toLowerCase()===sku.toLowerCase());if(dup)throw new Error('Ya existe un producto con esa referencia.');
 const providerId=required('ccProvider','Proveedor'),cost=num('ccCost');
 if(cost<=0)throw new Error('Introduce el coste de compra neto antes de convertir la consulta en producto.');
 const pvp=num('ccPvp');if(pvp<=0)throw new Error('Indica un PVP válido antes de convertir la consulta en producto.');
 const product=await insert('products',{name,sku,family_id:val('ccFamily')||null,product_type:'simple',current_pvp:pvp,proposed_pvp:null,units_month:0,status:'ACTIVO',notes:'Creado desde consulta: '+c.query,created_by:state.user?.id||null,updated_at:new Date().toISOString()});
 try{
  await insert('product_provider_prices',{product_id:product.id,variant_id:null,provider_id:providerId,net_cost:cost,provider_discount:0,shipping_unit:0,moq:0,stock_status:'',price_date:isoToday(),notes:'Coste trasladado desde consulta',selected:true,purchase_origin:'España',apply_special_tax:false,special_tax_amount:0});
 }catch(e){
  try{await remove('products',product.id)}catch(rollbackError){throw new Error('No se pudo asignar el proveedor al producto; tampoco se pudo revertir el alta: '+rollbackError.message)}
  throw new Error('No se pudo guardar el coste del proveedor. No se ha creado el producto: '+e.message);
 }
 const logged=await recordConsultationHistory({consultation_id:id,user_id:state.user?.id||null,action:'CONVERTIDA',consultation_query:c.query,snapshot:{...c,product_id:product.id}});
 closeModal();await refresh(logged?'Producto creado desde la consulta.':'Producto creado, pero no se pudo guardar el historial de conversión.');setView('pricing',{mode:'record',id:product.id});setRoute('pricing');render();
}

async function reuseConsultation(id){
 const c=state.data.consultations.find(x=>x.id===id);if(!c)return;
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??''};
 set('pqQuery',c.query);set('pqCost',c.cost_net);set('pqPvp',c.pvp);set('pqCompetitor',c.competitor);set('pqDiscount',c.discount);
 await update('consultations',id,{last_reopened_at:new Date().toISOString(),updated_at:new Date().toISOString()});
 const logged=await recordConsultationHistory({consultation_id:id,user_id:state.user?.id||null,action:'ABIERTA',consultation_query:c.query,snapshot:c});
 toast(logged?'Consulta cargada.':'Consulta cargada, pero no se pudo guardar su historial.',logged?'ok':'warn');
}
async function deleteConsultation(id){
 if(!confirm('¿Eliminar esta consulta guardada?'))return;
 await remove('consultations',id);await refresh('Consulta eliminada.');
}

function customerForm(row=null){
 const body=`<div class="form-grid">
  ${formField('Nombre / razón social','cuName',row?.name||'')}
  ${formField('NIF/CIF','cuTax',row?.tax_id||'')}
  ${formField('Email','cuEmail',row?.email||'','email')}
  ${formField('Teléfono','cuPhone',row?.phone||'')}
  ${formField('Dirección','cuAddress',row?.address||'')}
  ${formField('Ciudad','cuCity',row?.city||'')}
  ${formField('Código postal','cuPostal',row?.postal_code||'')}
  ${formField('Provincia','cuProvince',row?.province||'')}
  ${selectField('Forma de pago','cuPayment',[{value:'transferencia',label:'Transferencia'},{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.default_payment_method||'transferencia')}
  <label class="wide">Notas<textarea id="cuNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="form-actions">${row?btn('Eliminar','customer-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar cliente','customer-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar cliente':'Nuevo cliente',body);
}
function customersManager(){
 const rows=state.data.customers.filter(x=>x.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const body=`<div class="section-head"><div><p>Clientes guardados para facturación.</p></div>${btn('Nuevo cliente','customer-new','primary')}</div>
 <div class="stack" style="margin-top:14px">${rows.length?rows.map(c=>`<div class="summary-row"><div><b>${esc(c.name)}</b><div class="small muted">${esc(c.tax_id||'')} ${c.email?'· '+esc(c.email):''}</div></div>${btn('Editar','customer-edit','secondary',`data-id="${c.id}"`)}</div>`).join(''):'<div class="empty"><strong>Sin clientes</strong><span>Todavía no hay clientes guardados.</span></div>'}</div>`;
 modal('Clientes',body);
}
async function saveCustomer(id=''){
 const taxId=val('cuTax').trim();
 if(taxId){
   const dup=state.data.customers.find(x=>x.id!==id&&String(x.tax_id||'').trim().toLowerCase()===taxId.toLowerCase());
   if(dup)throw new Error('Ya existe un cliente con ese NIF/CIF.');
 }
 const row={name:required('cuName','Nombre'),tax_id:taxId,email:val('cuEmail').trim(),phone:val('cuPhone').trim(),address:val('cuAddress').trim(),city:val('cuCity').trim(),postal_code:val('cuPostal').trim(),province:val('cuProvince').trim(),country:'España',default_payment_method:val('cuPayment'),notes:val('cuNotes').trim(),active:true,updated_at:new Date().toISOString()};
 if(id)await update('ops_customers',id,row);else await insert('ops_customers',row);
 closeModal();await refresh('Cliente guardado.');
}
async function deleteCustomer(id){
 if(!confirm('¿Eliminar este cliente?'))return;
 await remove('ops_customers',id);closeModal();await refresh('Cliente eliminado.');
}
function templateForm(row=null){
 const stores=[{value:'',label:'General'},...state.data.stores.filter(x=>x.active!==false).map(s=>({value:s.id,label:s.name}))];
 const body=`<div class="form-grid">
  ${formField('Nombre','tpName',row?.name||'')}
  ${formField('Código','tpCode',row?.code||'')}
  ${selectField('Tienda','tpStore',stores,row?.store_id||'')}
  ${selectField('Estilo','tpStyle',[{value:'brand',label:'Moderna'},{value:'clean',label:'Minimal'},{value:'compact',label:'Clásica'}],({modern:'brand',minimal:'clean',classic:'compact'})[row?.style]||row?.style||'brand')}
  ${formField('Color principal','tpPrimary',row?.primary_color||'#17365D','color')}
  ${formField('Color secundario','tpSecondary',row?.secondary_color||'#4472C4','color')}
  ${formField('Color de texto','tpTextColor',row?.text_color||'#17202A','color')}
  ${selectField('Tipografía','tpFont',[{value:'helvetica',label:'Helvetica / Arial'},{value:'courier',label:'Courier'},{value:'times',label:'Times'}],row?.font_family||'helvetica')}
  ${selectField('Posición logo','tpLogoPos',[{value:'left',label:'Izquierda'},{value:'center',label:'Centro'},{value:'right',label:'Derecha'}],row?.logo_position||'left')}
  ${formField('Ancho logo (mm)','tpLogoWidth',row?.logo_width_mm??34,'number','min="10" max="70"')}
  ${formField('Título factura','tpInvoiceTitle',row?.invoice_title||'FACTURA')}
  ${formField('Título proforma','tpProformaTitle',row?.proforma_title||'FACTURA PROFORMA')}
  <label class="wide">Logo<input id="tpLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
  <label class="wide">Cabecera<textarea id="tpHeader" rows="2">${esc(row?.header_text||'')}</textarea></label>
  <label class="wide">Pie<textarea id="tpFooter" rows="2">${esc(row?.footer_text||'')}</textarea></label>
  <label class="wide">Notas por defecto<textarea id="tpNotes" rows="2">${esc(row?.notes_default||'')}</textarea></label>
  <label class="wide">Condiciones de pago<textarea id="tpTerms" rows="2">${esc(row?.payment_terms_default||'')}</textarea></label>
  <label class="wide">Datos bancarios<textarea id="tpBank" rows="2">${esc(row?.bank_details||'')}</textarea></label>
  <label class="check-field"><input id="tpShowLogo" type="checkbox" ${row?.show_logo===false?'':'checked'}> Mostrar logo</label>
  <label class="check-field"><input id="tpShowPayment" type="checkbox" ${row?.show_payment_details===false?'':'checked'}> Mostrar detalles de pago</label>
  <label class="check-field"><input id="tpShowEmail" type="checkbox" ${row?.show_company_email===false?'':'checked'}> Mostrar email</label>
  <label class="check-field"><input id="tpShowPhone" type="checkbox" ${row?.show_company_phone===false?'':'checked'}> Mostrar teléfono</label>
  <label class="check-field"><input id="tpDefaultInvoice" type="checkbox" ${row?.default_invoice?'checked':''}> Predeterminada factura</label>
  <label class="check-field"><input id="tpDefaultProforma" type="checkbox" ${row?.default_proforma?'checked':''}> Predeterminada proforma</label>
 </div>${row?.logo_name?`<div class="note" style="margin-top:12px">Logo actual: ${esc(row.logo_name)}</div>`:''}
 <div class="form-actions">${row?btn('Duplicar','template-duplicate','secondary',`data-id="${row.id}"`):''}${btn('Guardar plantilla','template-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar plantilla':'Nueva plantilla',body);
}
async function clearOtherTemplateDefaults(id,storeId,{invoice=false,proforma=false}={}){
 if(!invoice&&!proforma)return;
 let q=sb.from('ops_document_templates').update({
  ...(invoice?{default_invoice:false}:{}),
  ...(proforma?{default_proforma:false}:{})
 });
 q=storeId?q.eq('store_id',storeId):q.is('store_id',null);
 if(id)q=q.neq('id',id);
 const r=await q;if(r.error)throw new Error('No se pudieron actualizar las plantillas predeterminadas: '+r.error.message);
}
async function previewTemplate(id){
 const tpl=state.data.templates.find(x=>x.id===id);if(!tpl)return;
 let logo='';if(tpl.logo_path&&tpl.show_logo!==false){try{logo=await signedUrl('business-assets',tpl.logo_path,300)}catch{}}
 const fakeId='__template_preview__'+id;
 const line={id:'__preview_line__',invoice_id:fakeId,sort_order:10,description:'Ejemplo de concepto o producto',quantity:2,unit_price_base:50,discount_pct:0,vat_rate:21,total_amount:121};
 state.data.invoiceLines.push(line);
 try{
   const row={id:fakeId,template_id:id,status:'borrador',document_type:'factura',invoice_kind:'invoice',display_number:'EJEMPLO-0001',issue_date:isoToday(),customer_name:'Cliente de ejemplo',customer_tax_id:'12345678Z',customer_address:'Dirección del cliente',customer_email:'cliente@ejemplo.es',concept:'Vista previa de plantilla',payment_method:'transferencia',paid_status:'pendiente',paid_amount:0,base_amount:100,vat_amount:21,total_amount:121};
   modal('Vista previa · '+tpl.name,invoicePreview(row,logo));
 }finally{state.data.invoiceLines=state.data.invoiceLines.filter(x=>x.id!=='__preview_line__')}
}

function logoReferencedElsewhere(path,excludeTemplateId=''){
 if(!path)return false;
 return state.data.templates.some(t=>t.id!==excludeTemplateId&&t.logo_path===path)
  ||state.data.invoices.some(x=>x.template_snapshot?.logo_path===path||x.design_snapshot?.logo_path===path);
}
async function saveTemplate(id=''){
 const current=id?state.data.templates.find(x=>x.id===id):null;
 if(id&&!current)throw new Error('La plantilla ya no existe. Actualiza la página.');
 // Validar antes de subir. Un formulario incompleto no debe consumir Storage.
 const storeId=val('tpStore')||null,defaultInvoice=!!input('tpDefaultInvoice')?.checked,defaultProforma=!!input('tpDefaultProforma')?.checked;
 const code=required('tpCode','Código').trim().toUpperCase(),name=required('tpName','Nombre');
 const duplicate=state.data.templates.find(x=>x.id!==id&&String(x.code||'').trim().toUpperCase()===code);
 if(duplicate)throw new Error('Ya existe una plantilla con ese código. El código debe ser único en toda la herramienta.');
 const file=input('tpLogo')?.files?.[0]||null;
 if(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('El logo debe ser PNG, JPG o WEBP.');
  if(!file.size)throw new Error('El logo seleccionado está vacío.');
  if(file.size>5*1024*1024)throw new Error('El logo supera 5 MB.');
  const usage=await verifiedStorageMetrics();
  if(Number(usage.total_bytes)+file.size-Number(current?.logo_size_bytes||0)>Number(usage.limit_bytes))
   throw new Error('No queda suficiente almacenamiento para el logo.');
 }
 const oldLogoPath=current?.logo_path||null;
 let logoPath=oldLogoPath,logoName=current?.logo_name||null,logoMime=current?.logo_mime||null,logoSize=Number(current?.logo_size_bytes||0),uploadedPath=null;
 if(file){
  const ext=(file.name.split('.').pop()||'img').replace(/[^a-z0-9]/gi,'').toLowerCase();
  uploadedPath=`logos/${crypto.randomUUID()}.${ext}`;
  await upload('business-assets',uploadedPath,file);
  logoPath=uploadedPath;logoName=file.name;logoMime=file.type;logoSize=file.size;
 }
 let savedTemplate=null;
 const row={name,code,store_id:storeId,style:val('tpStyle'),primary_color:val('tpPrimary'),secondary_color:val('tpSecondary'),text_color:val('tpTextColor'),font_family:val('tpFont'),logo_position:val('tpLogoPos'),logo_width_mm:Math.min(70,Math.max(10,n(val('tpLogoWidth'))||34)),show_logo:input('tpShowLogo')?.checked!==false,show_payment_details:input('tpShowPayment')?.checked!==false,show_company_email:input('tpShowEmail')?.checked!==false,show_company_phone:input('tpShowPhone')?.checked!==false,default_invoice:defaultInvoice,default_proforma:defaultProforma,invoice_title:val('tpInvoiceTitle').trim()||'FACTURA',proforma_title:val('tpProformaTitle').trim()||'FACTURA PROFORMA',header_text:val('tpHeader').trim(),footer_text:val('tpFooter').trim(),notes_default:val('tpNotes').trim(),payment_terms_default:val('tpTerms').trim(),bank_details:val('tpBank').trim(),logo_path:logoPath,logo_name:logoName,logo_mime:logoMime,logo_size_bytes:logoSize,active:true,updated_at:new Date().toISOString()};
 try{
  savedTemplate=id?await update('ops_document_templates',id,row):await insert('ops_document_templates',row);
 }catch(e){throw uploadedPath?await rollbackUploadedFile('business-assets',uploadedPath,e):e}
 // No desactivar otras plantillas predeterminadas hasta confirmar que se guardó esta.
 // Si la actualización de las anteriores falla, indicar que debe revisarse: no ocultar un guardado parcial.
 let defaultsError=null;
 try{await clearOtherTemplateDefaults(savedTemplate?.id||id,storeId,{invoice:defaultInvoice,proforma:defaultProforma})}catch(e){defaultsError=e}
 if(oldLogoPath&&oldLogoPath!==logoPath&&!logoReferencedElsewhere(oldLogoPath,id)){
  await removeFile('business-assets',oldLogoPath).catch(e=>{console.warn('No se pudo retirar el logo sustituido',e);toast('La plantilla se ha guardado. El logo anterior sigue almacenado porque no se ha podido retirar.','bad')});
 }
 closeModal();
 await refresh(defaultsError?'Plantilla guardada; revisa las predeterminadas.':'Plantilla guardada.');
 if(defaultsError)toast('No se pudo actualizar la plantilla predeterminada anterior: '+defaultsError.message,'bad');
}
async function duplicateTemplate(id){
 const src=state.data.templates.find(x=>x.id===id);if(!src)return;
 const copy={...src};delete copy.id;delete copy.created_at;delete copy.updated_at;
 copy.name=src.name+' · copia';copy.code=(src.code+'-COPIA').slice(0,50);copy.default_invoice=false;copy.default_proforma=false;copy.active=true;
 let suffix=2;while(state.data.templates.some(x=>x.code===copy.code)){copy.code=(src.code+'-COPIA-'+suffix++).slice(0,50)}
 await insert('ops_document_templates',copy);closeModal();await refresh('Plantilla duplicada.');
}

async function deleteTemplate(id){
 if(!isAdmin())throw new Error('Solo el administrador puede eliminar plantillas.');
 const row=state.data.templates.find(x=>x.id===id);if(!row)return;
 const drafts=state.data.invoices.filter(x=>x.template_id===id&&x.status==='borrador').length;if(drafts)throw new Error('No se puede eliminar: hay '+drafts+' borrador(es) usando esta plantilla.');
 if(!confirm('¿Eliminar esta plantilla?'))return;
 await remove('ops_document_templates',id);
 const logoUsed=logoReferencedElsewhere(row.logo_path,id);
 if(row.logo_path&&!logoUsed)await removeFile('business-assets',row.logo_path).catch(()=>toast('La plantilla se ha eliminado, pero su logo sigue almacenado. Revisa los logos sin uso.','bad'));
 await refresh('Plantilla eliminada.');
}
function seriesForm(row=null){
 const used=row?state.data.invoices.filter(x=>x.series_id===row.id).length:0,locked=used?'disabled':'';
 const stores=[{value:'',label:'General'},...state.data.stores.filter(x=>x.active!==false).map(s=>({value:s.id,label:s.name}))];
 const body=`<div class="form-grid">
  ${selectField('Tienda','srStore',stores,row?.store_id||'',locked)}
  ${formField('Año','srYear',row?.year??new Date().getFullYear(),'number',locked+' min="2020" max="2100"')}
  ${formField('Código','srCode',row?.code||'','text',locked)}
  ${formField('Prefijo','srPrefix',row?.prefix||'','text',locked)}
  ${selectField('Documento','srDocType',[{value:'factura',label:'Factura'},{value:'proforma',label:'Proforma'}],row?.document_type||'factura',locked)}
  ${selectField('Tipo de serie','srKind',[{value:'invoice',label:'Ordinaria'},{value:'rectifying',label:'Rectificativa'}],row?.series_kind||'invoice',locked)}
  ${formField('Dígitos','srPadding',row?.padding??4,'number',locked+' min="1" max="10"')}
  ${formField('Siguiente número','srNext',row?.next_number??1,'number','min="1"')}
  <label class="check-field"><input id="srActive" type="checkbox" ${row?.active===false?'':'checked'}> Activa</label>
 </div>${used?`<div class="note warn" style="margin-top:12px">Serie usada en ${used} documento(s): identidad, año, prefijo y formato quedan bloqueados. Solo puedes cambiar estado y siguiente número.</div>`:''}
 <div class="form-actions">${btn('Guardar serie','series-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar serie':'Nueva serie',body,{small:true});
}
async function saveSeries(id=''){
 if(!isAdmin())throw new Error('Solo el administrador puede gestionar series.');
 const current=id?state.data.series.find(x=>x.id===id):null,used=current?state.data.invoices.filter(x=>x.series_id===id).length:0;
 const row={active:!!input('srActive')?.checked,next_number:Math.max(1,Math.round(num('srNext')))};
 if(!used){
   row.store_id=val('srStore')||null;row.year=Math.round(num('srYear'));row.code=required('srCode','Código').trim().toUpperCase();row.prefix=required('srPrefix','Prefijo').trim();row.document_type=val('srDocType');row.series_kind=row.document_type==='proforma'?'invoice':val('srKind');row.padding=Math.min(10,Math.max(1,Math.round(num('srPadding'))));
   if(row.year<2020||row.year>2100)throw new Error('Año de serie no válido.');
   const dup=state.data.series.find(x=>x.id!==id&&Number(x.year)===row.year&&String(x.code).toUpperCase()===row.code);if(dup)throw new Error('Ya existe ese código de serie para el mismo año.');
 }
 if(id)await update('ops_invoice_series',id,row);else await insert('ops_invoice_series',row);
 closeModal();await refresh('Serie guardada.');
}
function expenseCategoryForm(row=null){
 const body=`<div class="form-grid">
  ${formField('Código','ecCode',row?.code||'')}
  ${formField('Nombre','ecName',row?.name||'')}
  ${formField('Grupo AEAT','ecAeat',row?.aeat_group||'')}
  ${formField('Código gestor','ecManager',row?.manager_code||'')}
  ${formField('Orden','ecSort',row?.sort_order??0,'number','min="0"')}
  <label class="check-field"><input id="ecDeductible" type="checkbox" ${row?.deductible_default===false?'':'checked'}> Deducible por defecto</label>
  <label class="check-field"><input id="ecFixed" type="checkbox" ${row?.fixed_asset_default?'checked':''}> Inmovilizado por defecto</label>
  <label class="check-field"><input id="ecActive" type="checkbox" ${row?.active===false?'':'checked'}> Activa</label>
 </div><div class="form-actions">${btn('Guardar categoría','expense-category-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar categoría':'Nueva categoría',body,{small:true});
}
async function saveExpenseCategory(id=''){
 if(!isAdmin())throw new Error('Solo el administrador puede gestionar categorías.');
 const code=required('ecCode','Código').trim().toUpperCase(),name=required('ecName','Nombre');
 const dup=state.data.categories.find(x=>x.id!==id&&String(x.code||'').trim().toUpperCase()===code);if(dup)throw new Error('Ya existe una categoría con ese código.');
 const row={code,name,aeat_group:val('ecAeat').trim(),manager_code:val('ecManager').trim(),sort_order:Math.max(0,Math.round(num('ecSort'))),deductible_default:!!input('ecDeductible')?.checked,fixed_asset_default:!!input('ecFixed')?.checked,active:!!input('ecActive')?.checked};
 if(id)await update('ops_expense_categories',id,row);else await insert('ops_expense_categories',row);
 closeModal();await refresh('Categoría guardada.');
}

async function toggleSeries(id,active){
 if(!isAdmin())throw new Error('Solo el administrador puede cambiar series.');
 await update('ops_invoice_series',id,{active});
 await refresh('Serie actualizada.');
}

async function saveDocument(id=''){
 const current=id?state.data.documents.find(x=>x.id===id):null;
 if(id&&!current)throw new Error('Documento no encontrado. Actualiza el listado.');
 if(current&&!isManager()&&current.uploaded_by!==state.session?.user?.id)throw new Error('Solo quien subió el documento o gerencia puede modificarlo.');
 const date=required('docDate','Fecha');if(date>isoToday())throw new Error('La fecha del documento no puede ser futura.');
 const storeId=val('docStore')||null,file=input('docFile')?.files?.[0]||null;
 if(file&&current&&issuedDocumentFileLocked(current.id,state.data.invoices))throw new Error('El archivo pertenece a una factura emitida. Conserva el original; para corregir la factura utiliza una rectificativa.');
 const meta={store_id:storeId,doc_type:val('docType'),document_date:date,supplier_or_customer:val('docParty').trim(),tax_id:val('docTax').trim(),invoice_number:val('docNumber').trim(),category_code:val('docCategory').trim(),status:val('docStatus'),notes:val('docNotes').trim()};
 if(!current&&!file)throw new Error('Selecciona un archivo.');
 let row=current,newPath=null;
 if(!current){
   row=await createStoredDocument(file,{storeId,date,docType:meta.doc_type,status:meta.status,party:meta.supplier_or_customer,taxId:meta.tax_id,number:meta.invoice_number,category:meta.category_code,notes:meta.notes});
 }else if(file){
   const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);const usage=await verifiedStorageMetrics(),limit=Number(usage.limit_bytes),used=Number(usage.total_bytes);
   validateDocumentFile(file,{maxBytes:max,usedBytes:used,limitBytes:limit,replacingBytes:Number(current.size_bytes||0)});
   const y=date.slice(0,4),m=date.slice(5,7),storeNameValue=state.data.stores.find(x=>x.id===storeId)?.name||'General';
   newPath=`${y}/${quarterFromDate(date)}/${m}/${safeFileSegment(storeNameValue)}/${safeFileSegment(meta.doc_type)}/${safeFileSegment(meta.supplier_or_customer)}/${crypto.randomUUID()}_${safeFileSegment(file.name)}`;
   await upload('business-documents',newPath,file);
   try{
     row=await update('ops_documents',id,{...meta,storage_path:newPath,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:await fileSha256(file)});
   }catch(err){throw await rollbackUploadedFile('business-documents',newPath,err)}
   if(current.storage_path&&current.storage_path!==newPath)await removeFile('business-documents',current.storage_path).catch(()=>toast('El documento se ha actualizado. El archivo anterior sigue almacenado porque no se ha podido retirar.','bad'));
 }else{
   row=await update('ops_documents',id,meta);
 }
 setView('documentos',{mode:'record',id:row.id});await refresh(current?'Documento actualizado.':'Documento archivado.');
}

// Importación documental: pendientes de revisar, sin crear gastos automáticamente.
// Los PDF quedan sin tienda ni asociación fiscal hasta que se contraste la factura.
async function importDocumentZip(zipFile){
 if(!zipFile) return;
 if(!window.JSZip) throw new Error('No está disponible el lector ZIP.');
 if(zipFile.size>150*1024*1024) throw new Error('El archivo ZIP supera el máximo de 150 MB.');
 const zip=await window.JSZip.loadAsync(zipFile);
 const entries=Object.values(zip.files).filter(f=>!f.dir&&/\.(pdf|xlsx|docx)$/i.test(f.name)&&!f.name.startsWith('__MACOSX/'));
 if(!entries.length)throw new Error('El ZIP no contiene PDF, Excel o Word admitidos.');
 if(entries.length>500)throw new Error('Máximo 500 documentos por lote.');
 const knownHashes=new Set(state.data.documents.map(d=>d.sha256).filter(Boolean));
 const missing=entries;
 const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);
 const quota=await verifiedStorageMetrics(),used=Number(quota.total_bytes),limit=Number(quota.limit_bytes);
 const estimated=missing.reduce((a,f)=>a+Number(f._data?.uncompressedSize||0),0);
 if(used+estimated>limit)throw new Error('El lote supera el almacenamiento disponible. Elimina otros archivos o utiliza un lote menor.');
 if(!await confirmAction('Se revisarán '+missing.length+' archivos en Totus Central. Se omitirán los que tengan el mismo contenido que un documento ya guardado. Los nuevos quedarán pendientes de clasificar, sin crear gastos ni modificar los cálculos fiscales.',{title:'Importar documentos',acceptLabel:'Importar archivos'}))return;
 const months={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};
 let ok=0,skipped=entries.length-missing.length;const errors=[];
 modal('Importación de documentos',`<div class="stack"><p>Los archivos se guardan como <b>pendientes</b> y no se computan fiscalmente.</p><p id="bulkZipProgress" role="status">Preparando ${missing.length} documentos…</p></div>`);
 const report=(message)=>{const el=document.getElementById('bulkZipProgress');if(el)el.textContent=message};
 for(let i=0;i<missing.length;i++){
  const e=missing[i],name=e.name.split('/').pop();
  try{
   const raw=await e.async('blob');
   if(raw.size>max)throw new Error('Supera el límite de '+(max/1048576).toFixed(0)+' MB por archivo');
   const ext=name.toLowerCase().split('.').pop();
   const mime=ext==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/pdf';
   const file=new File([raw],name,{type:mime});
   const hash=await fileSha256(file);
   if(knownHashes.has(hash)){skipped++;report(`Procesados ${i+1}/${missing.length} · Guardados ${ok} · Fallidos ${errors.length} · Ya existentes ${skipped}`);continue;}
   const segments=e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
   const folder=Object.keys(months).find(m=>segments.includes(m));
   const fm=folder?months[folder]:null;
   const dm=name.match(/(?:^|[^\d])(\d{1,2})[-._](\d{1,2})[-._](20\d{2})(?:[^\d]|$)/);
   let date=dm&&+dm[1]>=1&&+dm[1]<=31&&+dm[2]>=1&&+dm[2]<=12?`${dm[3]}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`:null;
   if(date){const parsed=new Date(date+'T12:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)date=null;}
   const provisional=!date;
   const fallbackYear=e.name.match(/20\d{2}/)?.[0]||String(state.data.settings?.current_year||new Date().getFullYear());
   date=date||`${fallbackYear}-${String(fm||1).padStart(2,'0')}-01`;
   const reportFile=/gestoria|ingresos|gastos .*gestor|modelo 130|informe/i.test(name)||/\.(xlsx|docx)$/i.test(name);
   const party=name.replace(/\.pdf$/i,'').replace(/\b\d{1,2}[-._]\d{1,2}[-._]20\d\d\b/g,'').trim().slice(0,150);
   const notes=`[ORIGEN-ZIP:${e.name}] ${provisional?'Fecha provisional tomada del mes de carpeta (o enero si no consta). ':''}DOCUMENTO SIN CONCILIAR: confirmar tienda, proveedor, fecha, número de factura, importe e impuestos antes de asociarlo.`;
   const doc=await createStoredDocument(file,{storeId:null,date,docType:reportFile?'informe':'factura_recibida',status:'pendiente',party,notes});
   state.data.documents.push(doc);knownHashes.add(hash);ok++;
  }catch(err){errors.push(name+': '+(err?.message||String(err)))}
  if((i+1)%5===0||i===missing.length-1)report(`Procesados ${i+1}/${missing.length} · Guardados ${ok} · Fallidos ${errors.length} · Ya existentes ${skipped}`);
 }
 await refresh();
 modal('Resultado de importación ZIP',`<div class="stack"><p><b>${ok}</b> documentos guardados; <b>${skipped}</b> duplicados omitidos; <b>${errors.length}</b> errores.</p>${errors.length?'<div class="note">'+esc(errors.slice(0,20).join(' | '))+'</div>':''}<p>Todos los archivos siguen pendientes de revisar y no afectan a los informes fiscales.</p></div>`);
}

async function getDocumentBlob(doc){
 return downloadFile('business-documents',doc.storage_path,doc);
}
async function downloadDocument(id){
 const d=state.data.documents.find(x=>x.id===id);if(!d)return;

 const blob=await getDocumentBlob(d);download(blob,d.original_name||'documento');
}
async function previewDocument(id){
 const d=state.data.documents.find(x=>x.id===id);if(!d)throw new Error('El archivo adjunto no está disponible. Actualiza el listado y vuelve a abrir el gasto.');
 modal(d.original_name||'Documento','<div role="status">Cargando archivo adjunto…</div>');
 const loadingPanel=document.querySelector('#modalHost .modal');
 let blob;
 try{blob=await getDocumentBlob(d)}catch(error){
  if(loadingPanel?.isConnected)loadingPanel.querySelector('.modal-body').innerHTML=`<div class="note bad" role="alert">${esc(error.message)}</div>`;
  return;
 }
 if(!loadingPanel?.isConnected)return;
 const mime=String(d.mime_type||blob.type||'').toLowerCase(),name=String(d.original_name||'').toLowerCase();
 let body='';const kind=previewKind(name,mime);
 if(kind==='pdf'){
   modal(d.original_name||'Documento',`<div class="stack"><div id="pdfPreviewHost" class="document-frame pdf-viewer"></div><div class="form-actions">${btn('Descargar','document-download','primary',`data-id="${d.id}"`)}</div></div>`);
   document.querySelector('#modalHost .modal').classList.add('pdf-document-modal');
   await renderPdfPreview(blob,document.getElementById('pdfPreviewHost'));return;
 }else if(kind==='image'){
   const url=URL.createObjectURL(blob);body=`<div class="image-preview-wrap"><img class="document-image-preview" src="${url}" alt="${esc(d.original_name||'Imagen')}"></div>`;
   setTimeout(()=>URL.revokeObjectURL(url),180000);
 }else if(kind==='excel'){
   const buf=await blob.arrayBuffer();const wb=window.XLSX.read(buf,{type:'array'});body=`<div class="note">Libro Excel: ${wb.SheetNames.length} hoja(s). Puedes abrir y revisar cada hoja sin descargarlo.</div><div class="excel-preview">${wb.SheetNames.map((sheetName,i)=>`<details ${i===0?'open':''}><summary>${esc(sheetName)}</summary><div class="excel-preview-sheet">${`<table class="data-table"><tbody>${window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:false,defval:''}).slice(0,200).map(row=>`<tr>${row.slice(0,30).map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`}</div></details>`).join('')}</div>`;
 }else if(kind==='docx'){
   if(!window.JSZip)throw new Error('No está disponible el lector de documentos Word.');
   const zip=await window.JSZip.loadAsync(blob),xml=await zip.file('word/document.xml')?.async('text');
   if(!xml)throw new Error('El archivo Word no contiene un documento válido.');
   const doc=new DOMParser().parseFromString(xml,'application/xml');
   if(doc.querySelector('parsererror'))throw new Error('No se pudo interpretar el documento Word.');
   const paragraphs=[...doc.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join('')).filter(Boolean);
   body=`<div class="note">Vista del texto del Word; puede diferir del diseño original.</div><div class="excel-preview">${paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')||'<p>Documento sin texto visible.</p>'}</div>`;
 }else if(kind==='text'){
   const txt=await blob.text();body=`<pre class="text-preview">${esc(txt.slice(0,200000))}</pre>`;
 }else{
   body='<div class="note">Este formato no admite vista previa integrada, pero sí descarga.</div>';
 }
 modal(d.original_name||'Documento',`<div class="stack">${body}<div class="form-actions">${btn('Descargar','document-download','primary',`data-id="${d.id}"`)}</div></div>`);
}
function documentIsLinked(id){
 return state.data.expenses.some(x=>x.document_id===id)||state.data.taxPayments.some(x=>x.document_id===id)||state.data.invoices.some(x=>x.source_document_id===id||x.generated_document_id===id)||state.data.documents.some(x=>x.id===id&&x.linked_entity_id);
}
async function deleteDocument(id){
 if(!can('documentos','delete'))throw new Error('No tienes permiso para eliminar documentos.');
 const d=state.data.documents.find(x=>x.id===id);if(!d)return;
if(!isManager()&&d.uploaded_by!==state.session?.user?.id)throw new Error('Solo puedes eliminar documentos que hayas subido.');
 if(documentIsLinked(id))throw new Error('Este documento está vinculado a otro registro. Quita primero el vínculo desde su ficha.');
 if(!await confirmAction('Se quitará el documento «'+d.original_name+'» de la herramienta. Si ya tiene copia en OneDrive, su archivo se conservará en «99 Archivo de documentos retirados». Si todavía no está copiado, se eliminará su archivo de Supabase.'))return;
 // Keep the metadata when Storage rejects deletion, so the user can retry.
 if(d.storage_path)await removeFile('business-documents',d.storage_path);
 try{await remove('ops_documents',id)}catch(e){await refresh();throw new Error('El archivo se retiró, pero queda su ficha documental. Reintenta eliminar la ficha. '+e.message)}
 resetView('documentos');await refresh('Documento eliminado.');
}
async function zipFilteredDocuments(){
 const f=getFilters('documentos');
 const rows=selectDocuments(state.data,f);
 if(!rows.length)throw new Error('No hay documentos para los filtros actuales.');
 const zip=new window.JSZip();
 for(const d of rows){const blob=await getDocumentBlob(d);zip.file(`${safeFileSegment(d.doc_type)}/${safeFileSegment(d.id)}_${safeFileSegment(d.original_name)}`,blob)}
 const out=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
 download(out,`documentos_${f.from||'inicio'}_${f.to||'fin'}.zip`);
}


function storeForm(row=null){
 const body=`<div class="form-grid">${formField('Nombre','stName',row?.name||'')}${formField('Código','stCode',row?.code||'')}${formField('Dirección','stAddress',row?.address||'')}${formField('Teléfono','stPhone',row?.phone||'')}${formField('Orden','stSort',row?.sort_order??10,'number','min="0"')}<label class="check-field"><input id="stActive" type="checkbox" ${row?.active===false?'':'checked'}> Activo</label></div><div class="form-actions">${btn('Guardar','store-save','primary',row?`data-id="${row.id}"`:'')}</div>`;modal(row?'Editar establecimiento':'Nuevo establecimiento',body,{small:true});
}
async function saveStore(id=''){
 const code=required('stCode','Código').toUpperCase(),name=required('stName','Nombre');
 const dup=state.data.stores.find(x=>x.id!==id&&String(x.code||'').toUpperCase()===code);if(dup)throw new Error('Ya existe un establecimiento con ese código.');
 const row={code,name,address:val('stAddress').trim(),phone:val('stPhone').trim(),sort_order:Math.max(0,Math.round(num('stSort'))),active:!!input('stActive')?.checked};
 if(id)await update('ops_stores',id,row);else await insert('ops_stores',row);closeModal();await refresh('Establecimiento guardado.');
}
function drawerForm(storeId,row=null){
 const body=`<div class="form-grid">${formField('Nombre de caja','drName',row?.name||'')}${formField('Código','drCode',row?.code||'')}${formField('Orden','drSort',row?.sort_order??10,'number','min="0"')}<label class="check-field"><input id="drActive" type="checkbox" ${row?.active===false?'':'checked'}> Activa</label></div><div class="form-actions">${btn('Guardar','drawer-save','primary',`data-store="${storeId}" ${row?`data-id="${row.id}"`:''}`)}</div>`;modal(row?'Editar caja':'Nueva caja',body,{small:true});
}
async function saveDrawer(storeId,id=''){
 const name=required('drName','Nombre'),code=required('drCode','Código').toUpperCase();
 const dup=state.data.drawers.find(x=>x.id!==id&&x.store_id===storeId&&String(x.code||'').toUpperCase()===code);if(dup)throw new Error('Ya existe una caja con ese código en el establecimiento.');
 const row={store_id:storeId,name,code,sort_order:Math.max(0,Math.round(num('drSort'))),active:!!input('drActive')?.checked};
 if(id)await update('ops_cash_drawers',id,row);else await insert('ops_cash_drawers',row);closeModal();await refresh('Caja guardada.');
}

function rolePresetFor(rights){
 const v=PERMISSION_ACTIONS.map(([a])=>!!rights[a]);
 if(v.every(x=>!x))return 'none';
 if(v[0]&&v.slice(1).every(x=>!x))return 'read';
 if(v[0]&&v[1]&&v[2]&&!v[3]&&!v[4])return 'work';
 if(v.every(Boolean))return 'all';
 return 'custom';
}
function setRoleModulePreset(module,preset){
 const pattern={none:[],read:['view'],work:['view','create','edit'],all:PERMISSION_ACTIONS.map(([a])=>a)};
 if(!(preset in pattern))return;
 for(const [action] of PERMISSION_ACTIONS){
  const el=input('roleperm_'+module+'_'+action);
  if(el&&!el.disabled)el.checked=pattern[preset].includes(action);
 }
}
function rolePermissionsModal(role){
 if(!isAdmin()||role==='admin'||!state.data.roles.some(r=>r.code===role))throw new Error('Rol no editable.');
 const definition=state.data.roles.find(r=>r.code===role);
 const isCustom=!definition.is_system;
 const rows=PERMISSION_MODULES.map(([module,label])=>{
  const values=rolePermissions(role,module);
  const restricted=isCustom&&module==='administracion';
  const preset=restricted?'none':rolePresetFor(values);
  const cells=PERMISSION_ACTIONS.map(([action,txt])=>`<label class="role-access-check"><input type="checkbox" id="roleperm_${module}_${action}" ${values[action]&&!restricted?'checked':''} ${restricted?'disabled':''}><span>${esc(txt)}</span></label>`).join('');
  return `<div class="role-module" data-module="${module}"><div class="role-module-head"><div><strong>${esc(label)}</strong><p>${restricted?'La administración de usuarios y ajustes críticos está reservada a los roles del sistema.':'Elige el acceso general o ajusta cada operación.'}</p></div><select class="role-preset" id="rolepreset_${module}" data-module="${module}" ${restricted?'disabled':''} aria-label="Nivel de acceso a ${esc(label)}"><option value="none" ${preset==='none'?'selected':''}>Sin acceso</option><option value="read" ${preset==='read'?'selected':''}>Solo consultar</option><option value="work" ${preset==='work'?'selected':''}>Consultar y gestionar</option><option value="all" ${preset==='all'?'selected':''}>Control completo</option><option value="custom" ${preset==='custom'?'selected':''}>Personalizado</option></select></div><details class="role-module-detail"><summary>Ajustar acciones individualmente</summary><div class="role-access-checks">${cells}</div></details></div>`;
 }).join('');
 const body=`<div class="stack"><div class="note">Los cambios de <b>${esc(definition.name)}</b> se aplican a todos los usuarios de este rol que no tengan permisos individuales. <b>Ver</b> es necesario para permitir cualquier otra acción. No se modifican permisos de otros roles.</div>
 <div class="role-bulk"><label for="roleBulkPreset">Aplicar un nivel a todos los módulos</label><select id="roleBulkPreset"><option value="read">Solo consultar</option><option value="work">Consultar y gestionar</option><option value="all">Control completo</option><option value="none">Sin acceso</option></select>${btn('Aplicar a todos','role-bulk-apply','secondary')}</div>
 <div class="role-module-list">${rows}</div><div class="form-actions">${btn('Restablecer','role-permissions-reset','secondary',`data-role="${role}"`)}${btn('Guardar permisos','role-permissions-save','primary',`data-role="${role}"`)}</div></div>`;
 modal('Permisos · '+definition.name,body);
}
async function saveRolePermissions(role){
 if(!isAdmin()||role==='admin'||!state.data.roles.some(r=>r.code===role))throw new Error('Rol no editable.');
 const isCustom=!state.data.roles.find(r=>r.code===role)?.is_system;
 const rows=PERMISSION_MODULES.map(([module])=>{
  const row={role,module,updated_at:new Date().toISOString(),updated_by:state.session?.user?.id||null};
  for(const [action] of PERMISSION_ACTIONS)row['can_'+action]=!isCustom||module!=='administracion'?!!input('roleperm_'+module+'_'+action)?.checked:false;
  if(!row.can_view){for(const [action] of PERMISSION_ACTIONS)if(action!=='view')row['can_'+action]=false}
  return row;
 });
 const {error}=await sb.from('ops_role_permissions').upsert(rows,{onConflict:'role,module'});
 if(error)throw new Error('No se pudieron guardar los permisos: '+error.message);
 closeModal();await refresh('Permisos del rol guardados.');
}
async function resetRolePermissions(role){
 if(!isAdmin()||role==='admin'||!state.data.roles.some(r=>r.code===role))throw new Error('Rol no editable.');
 if(!confirm('¿Restablecer los permisos de '+role+'? Los roles personalizados quedarán sin acceso.'))return;
 const {error}=await sb.from('ops_role_permissions').delete().eq('role',role);
 if(error)throw new Error('No se pudieron restablecer permisos: '+error.message);
 closeModal();await refresh('Permisos restablecidos.');
}
function roleForm(role=null){
 if(!isAdmin())throw new Error('Acceso restringido.');
 if(role?.is_system)throw new Error('Los roles del sistema están protegidos.');
 const body=`<div class="stack"><p>${role?'El nombre y la descripción se pueden modificar. El identificador del rol no cambia.':'Crea un nuevo puesto. El identificador técnico se genera a partir de su nombre y debe ser único.'}</p>
 <div class="form-grid">${formField('Nombre del rol','roleName',role?.name||'','text','maxlength="80" required')}
 ${role?formField('Código fijo','roleCode',role.code,'text','disabled'):formField('Código único','roleCode','','text','pattern="[a-z][a-z0-9_]{2,31}" maxlength="32" required')}
 <label class="wide">Descripción<textarea id="roleDescription" rows="3" maxlength="240">${esc(role?.description||'')}</textarea></label>
 ${role?'':selectField('Permisos iniciales','roleTemplate',[{value:'read',label:'Solo lectura'},{value:'work',label:'Operativa sin borrado'},{value:'staff',label:'Como Encargado'},{value:'manager',label:'Como Gerencia'},{value:'none',label:'Sin acceso'}],'read')}
 </div><div class="form-actions">${btn(role?'Guardar cambios':'Crear rol','role-save','primary',role?`data-role="${role.code}"`:'')}</div></div>`;
 modal(role?'Editar rol':'Crear rol',body,{small:true});
}
async function saveRole(code=''){
 if(!isAdmin())throw new Error('Acceso restringido.');
 const name=required('roleName','Nombre del rol');
 const slug=(code||required('roleCode','Código del rol')).trim().toLowerCase();
 if(!/^[a-z][a-z0-9_]{2,31}$/.test(slug))throw new Error('Código: entre 3 y 32 caracteres, letras sin tilde, números y guiones bajos.');
 if(name.length<3||name.length>80)throw new Error('El nombre debe tener entre 3 y 80 caracteres.');
 if(state.data.roles.some(x=>x.code===slug && (!code||x.is_system)))throw new Error('Este código ya existe o está protegido.');
 const description=val('roleDescription').trim();
 if(code){
  const role=state.data.roles.find(r=>r.code===code);
  if(!role||role.is_system)throw new Error('No se puede modificar este rol.');
  const {error}=await sb.from('ops_roles').update({name,description}).eq('code',code);
  if(error)throw new Error('Error al actualizar el rol: '+error.message);
 }else{
  const {error}=await sb.from('ops_roles').insert({code:slug,name,description,is_system:false,sort_order:100});
  if(error)throw new Error('No se pudo crear el rol: '+error.message);
  const preset=val('roleTemplate');
  const rows=PERMISSION_MODULES.map(([module])=>{
   let x={view:false,create:false,edit:false,delete:false,export:false};
   if(module!=='administracion'){
    if(preset==='read')x={...x,view:true};
    if(preset==='work')x={...x,view:true,create:true,edit:true};
    if(preset==='staff')x=rolePermissions('encargado',module);
    if(preset==='manager')x=rolePermissions('gerente',module);
   }
   const row={role:slug,module};
   for(const [action] of PERMISSION_ACTIONS)row['can_'+action]=!!x[action];
   return row;
  });
  const {error:permissionError}=await sb.from('ops_role_permissions').insert(rows);
  if(permissionError){
   await sb.from('ops_roles').delete().eq('code',slug);
   throw new Error('Error al inicializar los permisos; creación cancelada: '+permissionError.message);
  }
 }
 closeModal();await refresh(code?'Rol actualizado.':'Rol creado. Ya puedes asignarlo a usuarios.');
}
async function deleteRole(code){
 if(!isAdmin())throw new Error('Acceso restringido.');
 const role=state.data.roles.find(r=>r.code===code);
 if(!role||role.is_system)throw new Error('Los roles protegidos no se pueden eliminar.');
 const users=state.data.team.filter(u=>u.role===code);
 if(users.length)throw new Error('El rol está asignado a '+users.length+' usuario(s). Cambia su rol antes de eliminarlo.');
 if(!confirm('¿Eliminar el rol "'+role.name+'"? Se eliminarán sus permisos, pero no otros roles.'))return;
 if(prompt('Escribe ELIMINAR ROL para confirmar:')!=='ELIMINAR ROL')return;
 const {error}=await sb.from('ops_roles').delete().eq('code',code);
 if(error)throw new Error('No se pudo eliminar el rol: '+error.message);
 await refresh('Rol eliminado.');
}

function userPermissionsModal(email){
 if(!isAdmin())throw new Error('Solo el administrador puede editar permisos.');
 const member=state.data.team.find(x=>x.email?.toLowerCase()===String(email).toLowerCase());
 if(!member)throw new Error('Usuario no encontrado.');
 if(member.role==='admin')throw new Error('Los administradores conservan permisos completos por seguridad.');
 const rows=PERMISSION_MODULES.map(([module,label])=>{
  const values=permissionsFor(member,module,state.data.userPermissions||[]);
  const cells=PERMISSION_ACTIONS.map(([action,actionLabel])=>`<td class="permission-cell"><label title="${esc(actionLabel)}: ${esc(label)}"><input type="checkbox" id="perm_${module}_${action}" ${values[action]?'checked':''} aria-label="${esc(actionLabel)} en ${esc(label)}"></label></td>`).join('');
  return `<tr><th scope="row">${esc(label)}</th>${cells}</tr>`;
 }).join('');
 const head=PERMISSION_ACTIONS.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('');
 const body=`<div class="stack"><p>Define los permisos de <b>${esc(member.full_name||member.email)}</b> (<b>${esc(member.role)}</b>). Los cambios se aplican también en el servidor. Para restablecer los permisos habituales del rol, utiliza el botón correspondiente.</p><div class="table-scroll"><table class="permissions-table"><thead><tr><th scope="col">Módulo</th>${head}</tr></thead><tbody>${rows}</tbody></table></div><div class="form-actions">${btn('Restablecer rol','user-permissions-reset','secondary',`data-email="${esc(email)}"`)}${btn('Guardar permisos','user-permissions-save','primary',`data-email="${esc(email)}"`)}</div></div>`;
 modal('Permisos del usuario',body);
}
async function saveUserPermissions(email){
 if(!isAdmin())throw new Error('Solo el administrador puede asignar permisos.');
 const member=state.data.team.find(x=>x.email?.toLowerCase()===String(email).toLowerCase());
 if(!member||member.role==='admin')throw new Error('No se pueden asignar permisos a esta cuenta.');
 const list=PERMISSION_MODULES.map(([module])=>{
  const row={email:member.email,module,updated_at:new Date().toISOString(),updated_by:state.session?.user?.id||null};
  for(const [action] of PERMISSION_ACTIONS)row['can_'+action]=!!document.getElementById('perm_'+module+'_'+action)?.checked;
  return row;
 });
 const {error}=await sb.from('ops_user_permissions').upsert(list,{onConflict:'email,module'});
 if(error)throw new Error('No se pudieron guardar los permisos: '+error.message);
 closeModal();await refresh('Permisos actualizados.');
}
async function resetUserPermissions(email){
 if(!isAdmin())throw new Error('Solo el administrador puede restablecer permisos.');
 if(!confirm('¿Restablecer todos los permisos de '+email+' a los valores de su rol?'))return;
 const {error}=await sb.from('ops_user_permissions').delete().eq('email',email);
 if(error)throw new Error('No se pudieron restablecer los permisos: '+error.message);
 closeModal();await refresh('Permisos del rol restablecidos.');
}

function userModal(row=null){
 const self=row&&row.email?.toLowerCase()===state.user?.email?.toLowerCase();
 const body=`<div class="form-grid">
  ${formField('Nombre completo','usName',row?.full_name||'')}
  ${formField('Email','usEmail',row?.email||'','email',row?'disabled':'')}
  ${selectField('Rol','usRole',(state.data.roles||[]).map(r=>({value:r.code,label:r.name})),row?.role||'gerente')}
  ${formField('Teléfono','usPhone',row?.phone||'')}
  ${formField('Puesto','usJob',row?.job_title||'')}
  ${formField('Tienda / centro','usStore',row?.store||'','text','autocomplete="off" data-lpignore="true" data-1p-ignore="true"')}
  <label class="wide">Notas<textarea id="usNotes" rows="3">${esc(row?.employee_notes||'')}</textarea></label>
  ${row?formField('Nueva contraseña (opcional)','usPassword','','password','minlength="12" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true"'):formField('Contraseña inicial','usPassword','','password','minlength="12" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true"')}
 </div>
 ${row?`<div class="note" style="margin-top:12px">Estado actual: <b>${row.active?'Activo':'Inactivo'}</b>. La contraseña solo cambia si escribes una nueva. Al cambiar de rol se restablecen los permisos individuales anteriores.</div>`:''}
 <div class="form-actions">
  ${row&&!self?btn(row.active?'Desactivar':'Activar','user-toggle','secondary',`data-email="${esc(row.email)}" data-active="${row.active?'false':'true'}"`):''}
  ${row?btn('Enviar recuperación','user-reset','secondary',`data-email="${esc(row.email)}"`):''}
  ${row&&!self?btn('Eliminar usuario','user-delete','danger',`data-email="${esc(row.email)}"`):''}
  ${btn('Guardar usuario','user-save','primary',row?`data-email="${esc(row.email)}"`:'')}
 </div>`;
 modal(row?'Editar usuario':'Nuevo usuario',body);
}

async function saveUser(email=''){
 const payload={full_name:required('usName','Nombre'),email:email||required('usEmail','Email').toLowerCase(),role:val('usRole'),phone:val('usPhone').trim(),job_title:val('usJob').trim(),store:val('usStore').trim(),employee_notes:val('usNotes').trim()};
 const password=val('usPassword');
 // Validate before updating any profile field; browser autofill must not leave a partial save.
 if(password&&password.length<12)throw new Error('La contraseña debe tener al menos 12 caracteres.');
 if(!email&&!password)throw new Error('La contraseña inicial debe tener al menos 12 caracteres.');
 if(email){
   const current=state.data.team.find(x=>x.email===email);
   await invokeTeam({action:'update_member',...payload,active:current?.active!==false});
   if(current&&current.role!==payload.role){
    const {error:permissionError}=await sb.from('ops_user_permissions').delete().eq('email',email);
    if(permissionError)throw new Error('Se cambió el rol, pero no se pudieron restablecer los permisos anteriores: '+permissionError.message);
   }
   if(password){await invokeTeam({action:'set_password',email,password,full_name:payload.full_name,role:payload.role})}
 }else{
   await invokeTeam({action:'create_user',...payload,password});
 }
 closeModal();await refresh('Usuario guardado.');
}
async function toggleUser(email,active){
 if(email.toLowerCase()===state.user?.email?.toLowerCase())throw new Error('No puedes desactivar tu propio usuario.');
 if(!confirm((active?'¿Activar ':'¿Desactivar ')+email+'?'))return;
 await invokeTeam({action:'set_active',email,active});closeModal();await refresh('Estado del usuario actualizado.');
}
async function resetUser(email){
 if(!confirm('¿Enviar un correo de recuperación a '+email+'?'))return;
 const r=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(r.error)throw r.error;
 toast('Correo de recuperación solicitado.','ok');
}
async function deleteUser(email){
 if(email.toLowerCase()===state.user?.email?.toLowerCase())throw new Error('No puedes eliminar tu propio usuario.');
 if(!await confirmAction('Se eliminarán definitivamente el acceso y la ficha de '+email+'.',{phrase:'ELIMINAR USUARIO'}))return;
 await invokeTeam({action:'hard_delete',email});closeModal();await refresh('Usuario eliminado.');
}


function taxReceiptForm(id){
 const row=state.data.taxPayments.find(p=>p.id===id);
 if(!row)throw new Error('No se encuentra este pago. Actualiza los datos.');
 const doc=state.data.documents.find(d=>d.id===row.document_id);
 modal('Justificante bancario · Modelo '+row.tax_type,`<p><strong>${esc(row.period_label||row.fiscal_year)} · ${money(row.amount)}</strong> · ${fmtDate(row.payment_date)}</p>
 <p>Adjunta el comprobante del banco. El importe, la fecha, el estado del pago y el cálculo fiscal se conservarán.</p>
 ${doc?`<p>Justificante actual: ${esc(doc.original_name)}. Si lo sustituyes, el original seguirá en Documentos.</p>`:''}
 <label class="file-picker">Seleccionar justificante bancario<input id="txReceiptFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></label>
 <div class="form-actions">${btn('Guardar justificante','tax-payment-receipt-save','primary',`data-id="${id}"`)}</div>`,{small:true});
}
async function saveTaxReceipt(id){
 const row=state.data.taxPayments.find(p=>p.id===id);
 if(!row)throw new Error('No se encuentra este pago. Actualiza los datos.');
 const file=input('txReceiptFile')?.files?.[0];
 if(!file)throw new Error('Selecciona el justificante bancario antes de guardar.');
 const doc=await createStoredDocument(file,{date:row.payment_date||isoToday(),docType:'impuesto',status:'archivada',party:'Hacienda',number:'Modelo '+row.tax_type+' · '+(row.period_label||row.fiscal_year),category:'justificante_bancario',notes:'Comprobante bancario del pago de impuesto; no es otro gasto deducible',linkedType:'tax_payment',linkedId:id});
 try{await update('ops_tax_payments',id,{document_id:doc.id})}
 catch(error){throw await rollbackNewDocument(doc,error)}
 closeModal();await refresh('Justificante bancario guardado. El pago y sus importes no han cambiado.');
}
function taxReceiptDocument(id){
 const payment=state.data.taxPayments.find(p=>p.id===id);
 if(!payment?.document_id)throw new Error('Este pago aún no tiene justificante adjunto.');
 return payment.document_id;
}

function taxPaymentForm(model,year,quarter,row=null){
 const body=`<div class="form-grid">
  ${formField('Modelo','txModel',model,'text','disabled')}
  ${formField('Año','txYear',year,'number','disabled')}
  ${formField('Trimestre','txQuarter',quarter,'number','disabled')}
  ${selectField('Estado','txStatus',[{value:'previsto',label:'Referencia para contrastar · sin pago anotado'},{value:'pagado',label:'Pagado'},{value:'compensado',label:'Compensado'}],row?.status||'previsto')}
  ${formField('Fecha de pago','txDate',row?.payment_date||'','date')}
  ${formField('Importe','txAmount',row?.amount??'','number','step="0.01" min="0"')}
  <label class="wide">Notas<textarea id="txNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="form-actions">${row?btn('Eliminar','tax-payment-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar','tax-payment-save','primary',`data-model="${model}" data-year="${year}" data-quarter="${quarter}" ${row?`data-id="${row.id}"`:''}`)}</div>`;
 modal(`Modelo ${model} · ${quarter}T ${year}`,body,{small:true});
}
async function saveTaxPayment(id='',model,year,quarter){
 const date=val('txDate')||null;if(date&&date>isoToday())throw new Error('La fecha de pago no puede ser futura.');
 if(val('txStatus')==='pagado'&&!date)throw new Error('Para marcarlo como pagado, indica la fecha real del pago.');
 const amountText=required('txAmount','Importe').trim(),amount=n(amountText);
 if(!Number.isFinite(amount)||amount<0)throw new Error('El importe fiscal no puede ser negativo.');
 if(![1,2,3,4].includes(Number(quarter))||!Number.isInteger(Number(year))||Number(year)<2020||Number(year)>2100)
  throw new Error('Año o trimestre fiscal incorrecto.');
 const row={tax_type:model,fiscal_year:Number(year),quarter:Number(quarter),period_label:`${quarter}T ${year}`,payment_date:val('txStatus')==='previsto'?null:date,amount,status:val('txStatus'),notes:val('txNotes').trim()};
 if(!id)row.created_by=state.user?.id||null;
 try{if(id)await update('ops_tax_payments',id,row);else await insert('ops_tax_payments',row)}
 catch(e){if(String(e.message).toLowerCase().includes('unique'))throw new Error('Ya existe un registro para ese modelo, año y trimestre.');throw e}
 closeModal();await refresh('Modelo actualizado.');
}
async function deleteTaxPayment(id){if(!confirm('¿Eliminar este registro fiscal?'))return;await remove('ops_tax_payments',id);closeModal();await refresh('Registro fiscal eliminado.')}
function fiscalAdjustmentForm(row=null){
 const fiscalStores=[{value:'',label:'General / todas'},...state.data.stores.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const body=`<div class="form-grid">
  ${selectField('Tienda','faStore',fiscalStores,row?.store_id||'')}
  ${formField('Fecha','faDate',row?.adjustment_date||isoToday(),'date')}
  ${selectField('Tipo','faKind',[{value:'ingreso_extra',label:'Ingreso extra'},{value:'gasto_deducible_extra',label:'Gasto deducible extra'},{value:'retencion_soportada',label:'Retención soportada'},{value:'amortizacion',label:'Amortización'},{value:'reduccion',label:'Reducción'},{value:'otro',label:'Otro'}],row?.kind||'otro')}
  ${formField('Importe','faAmount',row?.amount??'','number','step="0.01" min="0"')}
  <label class="wide">Descripción<textarea id="faDescription" rows="3">${esc(row?.description||'')}</textarea></label>
 </div><div class="form-actions">${row?btn('Eliminar','fiscal-adjustment-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar ajuste','fiscal-adjustment-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar ajuste fiscal':'Nuevo ajuste fiscal',body,{small:true});
}
async function saveFiscalAdjustment(id=''){
 const date=required('faDate','Fecha');if(date>isoToday())throw new Error('La fecha del ajuste no puede ser futura.');
 const amountText=required('faAmount','Importe').trim(),amount=n(amountText);
 if(!Number.isFinite(amount)||amount<0)throw new Error('El ajuste fiscal no puede tener un importe negativo.');
 const row={store_id:val('faStore')||null,adjustment_date:date,kind:val('faKind'),amount,description:required('faDescription','Descripción')};
 if(!id){row.document_id=null;row.created_by=state.user?.id||null}
 if(id)await update('ops_fiscal_adjustments',id,row);else await insert('ops_fiscal_adjustments',row);closeModal();await refresh('Ajuste fiscal guardado.');
}
async function deleteFiscalAdjustment(id){if(!confirm('¿Eliminar este ajuste fiscal?'))return;await remove('ops_fiscal_adjustments',id);closeModal();await refresh('Ajuste eliminado.')}
function incomeAdjustmentForm(row=null){
 const opts=[{value:'',label:'General / sin tienda'},...state.data.stores.map(s=>({value:s.id,label:s.name}))];
 const body=`<div class="form-grid">
  ${selectField('Tienda','iaStore',opts,row?.store_id||'')}
  ${formField('Fecha','iaDate',row?.income_date||isoToday(),'date')}
  ${formField('Concepto','iaConcept',row?.concept||'')}
  ${formField('Importe','iaAmount',row?.amount??'','number','step="0.01" min="0"')}
  <label class="wide">Observaciones<textarea id="iaNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="note">No dupliques ingresos que ya estén incluidos en cierres, facturas emitidas o ajustes fiscales de ingreso extra.</div>
 <div class="form-actions">${row?btn('Eliminar','income-adjustment-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar ingreso','income-adjustment-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar ingreso manual':'Nuevo ingreso manual',body,{small:true});
}
async function saveIncomeAdjustment(id=''){
 const income_date=required('iaDate','Fecha');
 if(income_date>isoToday())throw new Error('La fecha del ingreso no puede ser futura.');
 const amount=num('iaAmount');if(!Number.isFinite(amount)||amount<=0)throw new Error('El importe debe ser mayor que cero.');
 const row={store_id:val('iaStore')||null,income_date,amount,concept:required('iaConcept','Concepto'),notes:val('iaNotes').trim()};
 if(!id)row.created_by=state.session?.user?.id||null;
 if(id)await update('ops_income_adjustments',id,row);else await insert('ops_income_adjustments',row);
 closeModal();await refresh('Ingreso manual guardado.');
}
async function deleteIncomeAdjustment(id){
 if(!confirm('¿Eliminar este ingreso manual y actualizar los informes?'))return;
 const reason=prompt('Motivo de la eliminación:');if(!reason?.trim())return;
 await rpc('totus_delete_income_adjustment',{p_id:id,p_reason:reason.trim()});
 closeModal();await refresh('Ingreso manual eliminado y registrado en el Log.');
}
function setFiscalQuarter(year,q){
 const from=`${year}-${String((q-1)*3+1).padStart(2,'0')}-01`,to=`${year}-${String(q*3).padStart(2,'0')}-${String(new Date(year,q*3,0).getDate()).padStart(2,'0')}`;patchFilters('fiscalidad',{from,to});render();
}


function applyAdminLogFilters(){
 const from=val('logFrom'),to=val('logTo');
 if(from&&to&&from>to)throw new Error('La fecha inicial del Log no puede ser posterior a la final.');
 state.filters.adminLog={from,to,area:val('logArea'),action:val('logAction'),actor:val('logActor').trim(),query:val('logQuery').trim()};
 render();
}
function filteredLogRows(){
 const f=state.filters.adminLog||{};
 const key=searchText;
 return (state.data.audit||[]).filter(r=>{
  const day=r.created_at?new Date(r.created_at).toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'}):'';
  return (!f.from||day>=f.from)&&(!f.to||day<=f.to)
   &&(!f.area||f.area===r.area)&&(!f.action||f.action===r.action)
   &&(!f.actor||key(r.user_email).includes(key(f.actor)))
   &&(!f.query||key([r.user_email,r.action,r.area,JSON.stringify(r.detail||{})].join(' ')).includes(key(f.query)));
 });
}
function showLogEntry(id){
 const row=(state.data.audit||[]).find(r=>String(r.id)===String(id));
 if(!row)throw new Error('El evento no está disponible.');
 const detail=JSON.stringify(row.detail||{},null,2);
 modal('Detalle del evento',`<div class="stack">
  <p><b>Fecha:</b> ${esc(new Date(row.created_at).toLocaleString('es-ES'))}</p>
  <p><b>Usuario:</b> ${esc(row.user_email||'—')}</p>
  <p><b>Área:</b> ${esc(row.area||'—')}</p>
  <p><b>Acción:</b> ${esc(row.action||'—')}</p>
  <pre class="text-preview">${esc(detail)}</pre>
 </div>`);
}
function exportLogCsv(){
 const rows=filteredLogRows();
 const escCell=v=>{const value=String(v??'').replace(/[\r\n]+/g,' ');return '"'+(/^[=+@-]/.test(value)?'\'':'')+value.replaceAll('"','""')+'"'};
 const cols=['Fecha','Usuario','Área','Acción','Detalle JSON'];
 const csvText='\uFEFF'+[cols,...rows.map(r=>[r.created_at||'',r.user_email||'',r.area||'',r.action||'',JSON.stringify(r.detail||{})])].map(row=>row.map(escCell).join(';')).join('\r\n');
 download(new Blob([csvText],{type:'text/csv;charset=utf-8'}),'Log_Totus_'+isoToday()+'.csv');
}


async function setClosedPeriod(reopen=false){
 if(!isAdmin())throw new Error('Solo administración.');
 const reason=val('periodCloseReason').trim(),through=reopen?null:val('periodCloseDate');
 if(reason.length<15)throw new Error('Explica el motivo y los pendientes con al menos 15 caracteres.');
 if(!reopen&&!through)throw new Error('Selecciona el último día del trimestre.');
 if(!await confirmAction(reopen?'Se permitirán correcciones históricas. El motivo quedará registrado.':'Se protegerán los importes hasta '+fmtDate(through)+'. Los pendientes seguirán visibles.',{title:reopen?'Reabrir periodos':'Cerrar periodo',acceptLabel:reopen?'Reabrir':'Cerrar periodo'}))return;
 await rpc('totus_set_closed_period',{p_through:through,p_reason:reason});await refresh(reopen?'Periodos reabiertos con motivo registrado.':'Periodo protegido.');
}
function expensePaymentForm(id){
 const e=state.data.expenses.find(x=>x.id===id);if(!e)throw new Error('Gasto no encontrado.');
 modal('Registrar pago',`<p>${esc(e.supplier_name)} · ${esc(e.invoice_number||'Sin número')}</p><p class="note">Actualiza el pago sin modificar ni duplicar el gasto fiscal.</p><div class="form-grid">${selectField('Estado','expensePaymentStatus',[{value:'pendiente',label:'Pendiente'},{value:'parcial',label:'Parcial'},{value:'pagado',label:'Pagado'}],e.paid_status)}${formField('Importe pagado / devuelto','expensePaymentAmount',e.amount_paid||0,'number','step="0.01"')}${formField('Fecha de pago','expensePaymentDate',e.paid_date||isoToday(),'date')}</div><div class="form-actions">${btn('Cancelar','close-modal','secondary')}${btn('Guardar pago','expense-payment-save','primary',`data-id="${e.id}"`)}</div>`);
}
async function saveExpensePayment(id){
 const e=state.data.expenses.find(x=>x.id===id);if(!e)throw new Error('Gasto no encontrado.');
 const status=val('expensePaymentStatus'),amount=num('expensePaymentAmount'),date=status==='pendiente'?null:val('expensePaymentDate');
 validateExpensePayment(Number(e.base_amount)+Number(e.vat_amount)+Number(e.re_amount)-Number(e.withholding_amount),amount,status,e.document_kind);
 if(status!=='pendiente'&&!date||date&&date>isoToday())throw new Error('Indica una fecha de pago válida.');
 await rpc('totus_set_expense_payment',{p_id:id,p_status:status,p_amount:amount,p_date:date});closeModal();await refresh('Pago registrado sin modificar el gasto.');
}

async function saveBackupSettings(){
 if(!isAdmin())throw new Error('Solo el administrador configura las copias.');
 const h=val('backupTime'),match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(h);
 if(!match)throw new Error('Introduce una hora válida de 00:00 a 23:59.');
 const folder=val('backupFolder').trim();
 if(!/^[a-zA-Z0-9_-]{3,48}$/.test(folder))throw new Error('La carpeta debe tener de 3 a 48 letras, números, _ o -.');
 const frequency=val('backupFrequency');
 if(!['daily','weekly','monthly'].includes(frequency))throw new Error('Frecuencia incorrecta.');
 const retention=backupRetentionCount(num('backupRetention'));
 const enabled=!!input('backupEnabled')?.checked;
 if(enabled&&!await confirmAction('¿Guardar esta programación de copias de Totus Central? El servidor conservará hasta '+retention+' copias completas con la frecuencia indicada.',{title:'Guardar programación',acceptLabel:'Guardar cambios'}))return;
 await rpc('totus_backup_save_settings',{p:{
  enabled,frequency,run_hour:Number(match[1]),run_minute:Number(match[2]),
  weekday:Number(val('backupWeekday')),month_day:Number(val('backupMonthday')),
  retention_days:retention,destination_folder:folder
 }});
 await refresh(enabled?'Programación activada.':'Configuración guardada; programación desactivada.');
}
let cloudBackupRunning=false;
async function runBackupOnServer(){
 if(!isAdmin())throw new Error('Solo el administrador puede generar copias.');
 if(cloudBackupRunning)throw new Error('Ya hay una copia en curso. Puedes continuar trabajando.');
 if(!await confirmAction('¿Crear ahora una copia privada completa de Totus Central? Se guardará en OneDrive si la conexión está comprobada.',{title:'Crear copia privada',acceptLabel:'Crear copia'}))return;
 cloudBackupRunning=true;
 toast('Copia iniciada en segundo plano. Puedes continuar trabajando.');
 void sb.functions.invoke('totus-backup-run',{body:{mode:'manual'}}).then(({data,error})=>{
  if(error||data?.error)throw new Error('Copia no completada: '+(data?.error||error?.message||'Error desconocido'));
  if(data?.pending){toast('Copia en preparación por componentes. El servidor continuará aunque cierres la herramienta.');return;}
  if(data?.skipped){toast(data.reason||'Ya hay una copia en curso.');return}
  toast('Copia creada: '+((Number(data.size_bytes||0)/1048576).toFixed(2))+' MB. Pulsa «Actualizar historial» para verla.','ok');
 }).catch(error=>toast(error.message||String(error),'bad')).finally(()=>{cloudBackupRunning=false});
}
async function deleteStoredBackup(id){
 if(!isAdmin())throw new Error('Solo el administrador puede eliminar copias.');
 const run=(state.data.backupRuns||[]).find(r=>String(r.id)===String(id));
 if(!run||run.status!=='success'||!run.storage_path)throw new Error('La copia no está disponible.');
 if((state.data.backupRuns||[]).filter(r=>r.status==='success'&&r.storage_path).length<=1)throw new Error('Conserva al menos una copia guardada.');
 const date=new Date(run.started_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'});
 if(!await confirmAction('Se eliminará definitivamente la copia del '+date+' y sus fragmentos guardados en la nube. Los datos actuales de la herramienta no se borran. Esta acción no se puede deshacer.',{title:'Eliminar copia de seguridad',acceptLabel:'Eliminar esta copia'}))return;
 const {data,error}=await sb.functions.invoke('totus-backup-run',{body:{mode:'manual',action:'delete',id}});
 if(error||data?.error)throw new Error(data?.error||error?.message||'No se pudo eliminar la copia.');
 if(data?.deleted!==id)throw new Error('La eliminación no se ha confirmado. Actualiza y comprueba el estado.');
 await refresh(data.cloud_warning||'Copia eliminada de la lista y del almacenamiento.');
}
async function readBackupStorage(path){
 const run=(state.data.backupRuns||[]).find(r=>r.storage_path&&(r.storage_path===path||path.startsWith(r.storage_path+'.')));
 if(run?.storage_provider!=='onedrive'){
  const {data,error}=await sb.storage.from('business-backups').download(path);
  if(!error&&data)return data;
 }
 if(!run)throw new Error('No se pudo localizar la copia.');
 const {data:link,error:locationError}=await sb.functions.invoke('totus-onedrive',{body:{action:'backup-file-url',run_id:run.id,path}});
 if(locationError||!link?.url||new URL(link.url).protocol!=='https:')throw new Error('No se pudo leer la copia de OneDrive.');
 const response=await fetch(link.url,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error('No se pudo descargar la copia de OneDrive.');
 return response.blob();
}
async function writeBackupStorage(path,bytes){
 const {error}=await sb.storage.from('business-backups').upload(path,new Blob([bytes],{type:'application/octet-stream'}),{contentType:'application/octet-stream',upsert:false});
 if(error)throw new Error('No se pudo guardar la copia: '+error.message);
}
async function getStoredBackup(id){
 if(!isAdmin())throw new Error('Solo administrador.');
 const run=(state.data.backupRuns||[]).find(r=>String(r.id)===String(id));
 if(!run||run.status!=='success'||!run.storage_path)throw new Error('La copia no está disponible para descarga.');
 const bytes=await readBackupObject(run.storage_path,readBackupStorage,componentHash,run.archive_sha256||null);
 return {run,blob:bytes?.format===SET_FORMAT?bytes:new Blob([bytes],{type:'application/octet-stream'})};
}
async function downloadStoredBackup(id){
 const {run,blob}=await getStoredBackup(id);
 if(blob?.format===SET_FORMAT){
  const labels={datos:'Datos contables y configuración',documentos:'Facturas y documentos',codigo:'Código de Totus Central'};
  const buttons=blob.index.parts.map((part,n)=>'<div class="summary-row"><span>'+esc(labels[part.kind])+' · parte '+(part.number+1)+' · '+(part.size/1048576).toLocaleString('es-ES',{maximumFractionDigits:2})+' MB</span>'+btn('Descargar ZIP','backup-component-download','secondary','data-id="'+esc(run.id)+'" data-part="'+n+'"')+'</div>').join('');
  modal('Descargar juego de copia',`<p>Este juego cuenta como una sola copia. Guarda su índice y todos los ZIP juntos en una carpeta para poder comprobarlo o recuperarlo.</p><div class="inline-actions">${btn('Descargar índice','backup-component-download','primary','data-id="'+esc(run.id)+'" data-part="-1"')}</div><div class="stack">${buttons}</div>`);return;
 }
 download(blob,run.storage_path.split('/').pop()||'Totus_Central.totusbackup');
}
async function downloadBackupComponent(id,partNumber){
 if(!isAdmin())throw new Error('Solo administración.');
 const {run,blob}=await getStoredBackup(id);
 if(blob?.format!==SET_FORMAT)throw new Error('Esta copia no está dividida en componentes.');
 const n=Number(partNumber);
 if(n===-1){download(new Blob([JSON.stringify(blob.index)],{type:'application/json'}),run.storage_path.split('/').pop());return;}
 if(!Number.isInteger(n)||n<0||n>=blob.index.parts.length)throw new Error('Componente no válido.');
 const part=blob.index.parts[n],file=await readBackupStorage(part.path);
 if(file.size!==part.size||await componentHash(file)!==part.sha256)throw new Error('El componente no supera la comprobación de integridad.');
 download(file,part.path.split('/').pop());
}
let verifyingStoredBackup=false;
async function verifyStoredBackup(id){
 if(verifyingStoredBackup){toast('Ya se está comprobando una copia. Espera a que termine.');return;}
 verifyingStoredBackup=true;
 const controls=[...document.querySelectorAll('[data-action="backup-history-verify"]')],labels=controls.map(button=>button.textContent);
 controls.forEach(button=>{button.disabled=true;if(button.dataset.id===String(id))button.textContent='Comprobando…';});
 toast('Leyendo y comprobando la copia completa. Puede tardar unos minutos.');
 try{
 const {blob}=await getStoredBackup(id);
 const result=await inspectBackup(blob);
 const rows=Object.values(result.database).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);
 const files=Object.values(result.manifest.storage||{}).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);
 modal('Copia de seguridad verificada',`<div class="stack"><p class="note">Integridad SHA-256 comprobada. Esta operación no restaura ni modifica datos.</p>
 <div class="summary-row"><span>Tablas</span><b>${result.manifest.tables.length}</b></div>
 <div class="summary-row"><span>Registros</span><b>${rows}</b></div>
 <div class="summary-row"><span>Archivos</span><b>${files}</b></div>
 <p class="note">${result.manifest.version===3?'Esta copia conserva autores y permisos y se puede revisar para recuperar los datos en este mismo proyecto.':'Esta copia antigua solo admite comprobación; para recuperar autores y permisos necesitas una copia nueva.'}</p></div>`);
 }finally{verifyingStoredBackup=false;controls.forEach((button,index)=>{if(button.isConnected){button.disabled=false;button.textContent=labels[index];}});}
}

async function downloadBackup(){
 if(!isAdmin())throw new Error('Solo el administrador puede crear copias completas.');
 toast('Preparando copia completa…');
 const out=await createBackup();
 toast('Copia creada: '+(out.size/1024/1024).toFixed(1).replace('.',',')+' MB','ok');
}
async function verifyBackupFromInput(){
 if(!isAdmin())throw new Error('Solo el administrador puede comprobar copias.');
 const selected=Array.from(input('backupFile')?.files||[]),file=selected.length>1?selected:selected[0];
 if(!file)throw new Error('Selecciona una copia antes de comprobarla.');
 const result=await inspectBackup(file);
 const rows=Object.values(result.database).reduce((a,entries)=>a+(Array.isArray(entries)?entries.length:0),0);
 const files=Object.values(result.manifest.storage||{}).reduce((a,entries)=>a+(Array.isArray(entries)?entries.length:0),0);
 modal('Comprobación de copia',`<div class="stack"><div class="note">Integridad validada. No se ha modificado ningún dato.</div><p>Versión: <b>${esc(result.manifest.version)}</b></p><p>Registros de negocio: <b>${rows}</b></p><p>Archivos: <b>${files}</b></p><div class="note">${result.manifest.version===3?'Usa «Revisar para recuperar» para comprobar el destino y preparar la recuperación.':'La copia antigua se puede revisar, pero no permite recuperar todos los autores. Genera una copia nueva.'}</div></div>`);
}

let recoveryCandidate=null,recoveryBusy=false;
async function reviewRecoveryFile(){
 if(!isAdmin())throw new Error('Solo administración puede recuperar una copia.');
 const selected=Array.from(input('backupFile')?.files||[]),file=selected.length>1?selected:selected[0];
 if(!file)throw new Error('Selecciona la copia que quieres recuperar.');
 const archive=await inspectBackup(file);
 if(archive.manifest.version!==3)throw new Error('Esta copia antigua no conserva todos los autores. Solo admite comprobación; la recuperación necesita una copia nueva.');
 if(archive.manifest.project_ref!==new URL(SUPABASE_URL).hostname.split('.')[0])throw new Error('La copia pertenece a otro proyecto.');
 const current=await rpc('totus_export_recovery_snapshot');
 if(current.database_instance!==archive.manifest.database_instance||current.schema_hash!==archive.manifest.schema_hash)throw new Error('La copia no corresponde a este proyecto o su estructura es incompatible.');
 const rows=Object.values(archive.database).reduce((sum,list)=>sum+list.length,0),files=Object.values(archive.manifest.storage).reduce((sum,list)=>sum+list.length,0);
 recoveryCandidate={file,selectedSet:archive.selectedSet,manifest:archive.manifest};
 modal('Revisar recuperación',`<p><b>${esc(Array.isArray(file)?'Juego de copia · '+file.length+' archivos':file.name)}</b></p><div class="summary-row"><span>Fecha de la copia</span><strong>${esc(new Date(archive.manifest.created_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))}</strong></div><div class="summary-row"><span>Registros</span><strong>${rows}</strong></div><div class="summary-row"><span>Archivos vinculados</span><strong>${files}</strong></div><p class="note warn">Se sustituirán los datos y permisos por los de esta copia. Las contraseñas de las cuentas actuales se conservan. Antes se guardará una copia del estado anterior y se verificarán los archivos.</p><div class="form-actions">${btn('Cancelar','close-modal','secondary')}${btn('Continuar','recovery-confirm','primary')}</div>`);
}
async function performRecovery(jobId=''){
 if(!isAdmin())throw new Error('Solo administración puede recuperar una copia.');
 if(recoveryBusy)throw new Error('Ya hay una recuperación en curso. Consulta su estado.');
 const candidate=recoveryCandidate;
 if(!jobId&&!candidate)throw new Error('Revisa primero la copia que quieres recuperar.');
 if(!await confirmAction('Se recuperarán los datos y permisos de la copia seleccionada. Se conservará un punto de vuelta atrás antes de sustituir los registros.',{phrase:'RECUPERAR COPIA',title:'Confirmar recuperación',acceptLabel:'Recuperar datos'}))return;
 recoveryBusy=true;
 const id=jobId||crypto.randomUUID();
 try{
  toast('Preparando punto de recuperación y archivos…');
  if(!jobId){
   const registered=await invokeRecovery(id,'register');
   if(candidate.selectedSet)await uploadSelectedBackupSet(registered.source_path,candidate.selectedSet,writeBackupStorage);else await writeBackupObject(registered.source_path,candidate.file,writeBackupStorage,readBackupStorage);
  }
  const current=await rpc('totus_export_recovery_snapshot');
  const ready=/^[a-f0-9]{64}$/.test(current.revision||'')&&(state.data.backupRuns||[]).some(r=>r.status==='success'&&r.storage_path&&r.snapshot_revision===current.revision);
  const {data:checkpoint,error:checkpointError}=ready?{data:{status:'success'},error:null}:await sb.functions.invoke('totus-backup-run',{body:{mode:'manual'}});
  if(checkpointError||checkpoint?.error||checkpoint?.skipped)throw new Error('Antes de recuperar se necesita una copia actual completa. '+(checkpoint?.error||checkpoint?.reason||checkpointError?.message||'Revisa el historial de copias.'));
  if(checkpoint?.pending)throw new Error('La copia de protección se está preparando por componentes en el servidor. Cuando termine, pulsa Continuar en la recuperación registrada; no se ha sustituido ningún dato.');
  await invokeRecovery(id);
  recoveryCandidate=null;await refresh('Recuperación completada y verificada.');
 }catch(error){
  const {data:job}=await sb.from('ops_recovery_jobs').select('*').eq('id',id).maybeSingle();
  if(job?.status==='committed'){recoveryCandidate=null;await refresh('Recuperación completada. Se ha confirmado el resultado tras una interrupción de conexión.');return}
  await refresh();
  throw new Error((error.message||String(error))+' Revisa el estado en «Recuperaciones» antes de reintentar.');
 }finally{recoveryBusy=false}
}
async function downloadRecoveryComponent(id,kind,partNumber){
 if(!isAdmin())throw new Error('Solo administración.');
 const job=(state.data.recoveryJobs||[]).find(j=>j.id===id),path=kind==='checkpoint'?job?.checkpoint_path:job?.source_path;
 if(!path)throw new Error('Copia no disponible.');
 const handle=await readBackupObject(path,readBackupStorage);
 if(handle?.format!==SET_FORMAT)throw new Error('La copia no está dividida en componentes.');
 const n=Number(partNumber);
 if(n===-1){download(new Blob([JSON.stringify(handle.index)],{type:'application/json'}),path.split('/').pop());return;}
 if(!Number.isInteger(n)||n<0||n>=handle.index.parts.length)throw new Error('Componente no válido.');
 const part=handle.index.parts[n],file=await readBackupStorage(part.path);
 if(file.size!==part.size||await componentHash(file)!==part.sha256)throw new Error('Componente dañado.');
 download(file,part.path.split('/').pop());
}
async function downloadRecoveryFile(id,kind){
 if(!isAdmin())throw new Error('Solo administración puede descargar estas copias.');
 const job=(state.data.recoveryJobs||[]).find(x=>x.id===id),path=kind==='checkpoint'?job?.checkpoint_path:job?.source_path;
 if(!path)throw new Error('El archivo no está disponible.');
 const bytes=await readBackupObject(path,readBackupStorage);
 if(bytes?.format===SET_FORMAT){
  const buttons=bytes.index.parts.map((p,n)=>'<div class="summary-row"><span>'+esc(p.kind)+' · '+(p.number+1)+'</span>'+btn('Descargar ZIP','recovery-component-download','secondary','data-id="'+esc(id)+'" data-kind="'+esc(kind)+'" data-part="'+n+'"')+'</div>').join('');
  modal('Componentes de recuperación','<p>Conserva el índice y todos los ZIP juntos.</p>'+btn('Descargar índice','recovery-component-download','primary','data-id="'+esc(id)+'" data-kind="'+esc(kind)+'" data-part="-1"')+'<div class="stack">'+buttons+'</div>');return;
 }
 download(new Blob([bytes],{type:'application/octet-stream'}),path.split('/').pop());
}

async function saveConfig(){
 if(!isAdmin())throw new Error('Solo el administrador puede cambiar la configuración.');
 const current={...(state.data.settings||{})},patch={updated_at:new Date().toISOString()};
 const setIf=(id,key,transform=v=>v)=>{const el=input(id);if(el)patch[key]=transform(el.value)};
 setIf('cfgBusiness','business_name',v=>v.trim());setIf('cfgTax','tax_id',v=>v.trim());setIf('cfgAddress','business_address',v=>v.trim());setIf('cfgEmail','business_email',v=>v.trim());setIf('cfgPhone','business_phone',v=>v.trim());
 const bounded=(label,max=100,min=0)=>v=>{
  // n() intentionally falls back to zero for non-numeric UI calculations.
  // Configuration must never silently persist that fallback as a real value.
  const raw=String(v??'').trim().replace(/\s/g,'');
  if(!/^[+-]?[\d.,]+$/.test(raw))throw new Error(label+' debe ser un número válido (admite coma o punto decimal).');
  const normalized=raw.includes(',')&&raw.includes('.')
   ?(raw.lastIndexOf(',')>raw.lastIndexOf('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,''))
   :raw.replace(',','.');
  const number=Number(normalized);
  if(!Number.isFinite(number))throw new Error(label+' debe ser un número válido (admite coma o punto decimal).');
  if(number<min||number>max)throw new Error(label+' debe estar entre '+min+' y '+max+'.');
  return number;
 };
 setIf('cfgVat','default_sales_vat_rate',bounded('IVA (%)'));
 setIf('cfgPurchaseRe','purchase_re_rate',bounded('Recargo de equivalencia (%)'));
 setIf('cfgIrpf','irpf_prepayment_rate',bounded('Pago fraccionado IRPF (%)'));
 setIf('cfgDifficultPct','difficult_expense_pct',bounded('Difícil justificación (%)'));
 setIf('cfgDifficultCap','difficult_expense_annual_cap',bounded('Tope anual de gastos',100000000));
 if(input('cfgDifficultEnabled'))patch.difficult_expense_enabled=!!input('cfgDifficultEnabled').checked;if(input('cfgFiscalNotes'))patch.fiscal_notes=val('cfgFiscalNotes').trim();
 await update('ops_business_settings',current.id||1,patch);await refresh('Configuración guardada.');
}

const filterRoute={cajas:'cajas',gastos:'gastos',facturas:'facturacion',documentos:'documentos',fiscal:'fiscalidad',informes:'informes'};
function applyFilter(prefix){
 const route=filterRoute[prefix];if(!route)return;
 const from=val(prefix+'From'),to=val(prefix+'To');if(from&&to&&from>to)throw new Error('La fecha Desde no puede ser posterior a Hasta.');
 if(prefix==='informes'&&(!from||!to))throw new Error('Selecciona Desde y Hasta para mostrar los meses del periodo.');
 const patch={from,to,store:val(prefix+'Store'),query:val(prefix+'Query').trim()};
 if(prefix==='gastos'){patch.kind=val('gastosKind')||'all';patch.paid=val('gastosPaid')||'all';if(input('gastosAttachment'))patch.attachment=val('gastosAttachment')||'all'}
 if(prefix==='documentos'){patch.status=val('documentosStatus')||'all';patch.type=val('documentosType')||'all'}

 patchFilters(route,patch);render();
}
function thisMonth(prefix){const route=filterRoute[prefix];if(!route)return;const r=monthRange();patchFilters(route,{from:r.from,to:r.to});render()}
function updateHomePrice(){
 const result=quickPriceStudy({cost:val('homePriceCost'),pvp:val('homePricePvp'),competitor:val('homePriceCompetitor'),discount:val('homePriceDiscount'),vat:state.data.settings?.default_sales_vat_rate??21,re:state.data.settings?.purchase_re_rate??5.2});
 const set=(id,text,cls='')=>{const el=document.getElementById(id);if(el){el.textContent=text;el.className=cls}};
 set('homePriceReal',money(result.costReal));
 set('homePriceSale',money(result.finalSale));
 set('homePriceMargin',money(result.margin),result.margin<0?'danger-text':result.marginPct<18?'warn-text':'good-text');
 set('homePriceMarginPct',result.marginPct.toFixed(1).replace('.',',')+' %',result.margin<0?'danger-text':result.marginPct<18?'warn-text':'good-text');
 set('homePriceCompetition',result.competitorDiff==null?'—':((result.competitorDiff>0?'+':'')+money(result.competitorDiff)),result.competitorDiff==null?'':result.competitorDiff>0?'warn-text':'good-text');
}
async function saveHomePrice(){
 const query=required('homePriceQuery','Producto / referencia');
 const r=quickPriceStudy({cost:val('homePriceCost'),pvp:val('homePricePvp'),competitor:val('homePriceCompetitor'),discount:val('homePriceDiscount'),vat:state.data.settings?.default_sales_vat_rate??21,re:state.data.settings?.purchase_re_rate??5.2});
 const row=await insert('consultations',{query,cost_net:r.cost,pvp:r.pvp,competitor:r.competitor,discount:r.discount,cost_real:r.costReal,final_sale:r.finalSale,margin:r.margin,margin_pct:r.marginPct,created_by:state.user?.id||null,last_reopened_at:null,updated_at:new Date().toISOString()});
 const logged=await recordConsultationHistory({consultation_id:row.id,user_id:state.user?.id||null,action:'CREADA',consultation_query:query,snapshot:{...row,source:'inicio'}});
 await refresh(logged?'Consulta guardada.':'Consulta guardada, pero no se pudo guardar su historial.');
}
function homeReport(kind){
 const now=isoToday(),year=Number(now.slice(0,4)),month=Number(now.slice(5,7)),q=Math.ceil(month/3);
 if(kind==='quarter'){const from=`${year}-${String((q-1)*3+1).padStart(2,'0')}-01`,to=`${year}-${String(q*3).padStart(2,'0')}-${String(new Date(year,q*3,0).getDate()).padStart(2,'0')}`;patchFilters('informes',{from,to,year});}
 else patchFilters('informes',{from:`${year}-01-01`,to:`${year}-12-31`,year});
 setRoute('informes');render();
}
function openAdminSection(section){setView('administracion',{section});setRoute('administracion');render();}

function sheetPreviewTable(sheet){
 const range=window.XLSX.utils.decode_range(sheet['!ref']||'A1'),lastRow=Math.min(range.e.r,range.s.r+199),lastCol=Math.min(range.e.c,range.s.c+29);
 let firstCol=range.s.c;
 while(firstCol<lastCol&&!Array.from({length:lastRow-range.s.r+1},(_,i)=>sheet[window.XLSX.utils.encode_cell({r:range.s.r+i,c:firstCol})]).some(cell=>cell?.v!==undefined&&cell.v!==''))firstCol++;
 const merges=sheet['!merges']||[],covered=new Set(),starts=new Map();
 for(const merge of merges){starts.set(`${merge.s.r}:${merge.s.c}`,merge);for(let r=merge.s.r;r<=merge.e.r;r++)for(let c=merge.s.c;c<=merge.e.c;c++)if(r!==merge.s.r||c!==merge.s.c)covered.add(`${r}:${c}`)}
 const rgb=value=>/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value?.rgb||'')?'#'+value.rgb.slice(-6):'';
 const rows=[];
 for(let r=range.s.r;r<=lastRow;r++){
  const cells=[];let headings=0;
  for(let c=firstCol;c<=lastCol;c++){
   if(covered.has(`${r}:${c}`))continue;
   const cell=sheet[window.XLSX.utils.encode_cell({r,c})],style=cell?.s||{},fill=rgb(style.fill?.fgColor),color=rgb(style.font?.color),merge=starts.get(`${r}:${c}`);
   const css=[fill?`background:${fill}`:'',color?`color:${color}`:'',style.font?.bold?'font-weight:700':'',style.alignment?.horizontal?`text-align:${['left','center','right'].includes(style.alignment.horizontal)?style.alignment.horizontal:'left'}`:''].filter(Boolean).join(';');
   if(r<6&&style.font?.bold&&fill)headings++;
   cells.push(`<td ${merge?`colspan="${Math.min(merge.e.c,lastCol)-c+1}" rowspan="${Math.min(merge.e.r,lastRow)-r+1}"`:''} style="${css}">${esc(workbookPreviewText(cell,window.XLSX.utils.format_cell,window.XLSX.SSF))}</td>`);
  }
  rows.push(`<tr ${headings>2?'class="sheet-header"':''}>${cells.join('')}</tr>`);
 }
 const widths=Array.from({length:lastCol-firstCol+1},(_,i)=>Math.min(420,Math.max(76,Number(sheet['!cols']?.[firstCol+i]?.wch||14)*8+24)));
 const columns=widths.map(width=>`<col style="width:${width}px">`).join(''),tableWidth=widths.reduce((sum,width)=>sum+width,0);
 return `<table class="workbook-preview" style="width:${tableWidth}px;min-width:${tableWidth}px"><colgroup>${columns}</colgroup><tbody>${rows.join('')}</tbody></table>${range.e.r>lastRow||range.e.c>lastCol?'<div class="note">Vista de hasta 200 filas y 30 columnas. El archivo descargado contiene todos los datos.</div>':''}`;
}

function previewWorkbookExact(wb,title,downloadButton){
 const sheets=wb.SheetNames.map(sheetName=>`<section class="workbook-sheet">${wb.SheetNames.length>1?`<h3>${esc(sheetName)}</h3>`:''}${sheetPreviewTable(wb.Sheets[sheetName])}</section>`).join('');
 modal(title,`<div class="workbook-view"><p class="small muted">Vista del archivo que vas a descargar, con sus columnas, colores y totales. Desliza la tabla para consultar todas las columnas.</p><div class="workbook-scroll">${sheets}</div><div class="form-actions">${downloadButton}</div></div>`);
 document.querySelector('#modalHost .modal')?.classList.add('workbook-modal');
}
function reportStorePreview(storeId,year,month){
 const store=state.data.stores.find(x=>x.id===storeId);if(!store)return;
 const wb=buildStoreMonthlyWorkbook({store,year,month,...selectReportData(state.data,getFilters('informes')),categories:state.data.categories});
 previewWorkbookExact(wb,`${store.name} · ${year}-${String(month).padStart(2,'0')}`,btn('Descargar Excel','export-store-book','primary',`data-store="${storeId}" data-year="${year}" data-month="${month}"`));
}

function reportArgs(year){
 return {year,onlyPeriodsWithData:year===2026,settings:state.data.settings,stores:state.data.stores,closings:state.data.closings,expenses:state.data.expenses,expenseLines:state.data.expenseLines,invoices:state.data.invoices,fiscalAdjustments:state.data.fiscalAdjustments,incomeAdjustments:state.data.incomeAdjustments,taxPayments:state.data.taxPayments,categories:state.data.categories};
}
function gestorSourceArgs(){
 const f=getFilters('informes');
 if(!f.from||!f.to||f.from>f.to)throw new Error('Selecciona un periodo válido en Desde y Hasta.');
 if(f.from.slice(0,4)!==f.to.slice(0,4))throw new Error('Prepara la tabla de gestoría de un ejercicio cada vez.');
 return {...reportArgs(Number(f.from.slice(0,4))),...selectReportData(state.data,f),from:f.from,to:f.to,store:f.store||'all'};
}
function reportGestorSourcePreview(){
 previewWorkbookExact(buildGestorSourceWorkbook(gestorSourceArgs()),'Tabla de la gestoría',btn('Descargar tabla Excel','export-gestor-source','primary')+btn('Imprimir / guardar PDF','report-gestor-source-print','secondary'));
}
function printGestorSource(){
 const args=gestorSourceArgs(),rows=buildGestorSourceRows(args);
 const previousTo=new Date(args.from+'T12:00:00');previousTo.setDate(previousTo.getDate()-1);
 const previousEnd=[previousTo.getFullYear(),String(previousTo.getMonth()+1).padStart(2,'0'),String(previousTo.getDate()).padStart(2,'0')].join('-');
 const previousRows=args.from>`${args.year}-01-01`?buildGestorSourceRows({...args,from:`${args.year}-01-01`,to:previousEnd}):[];
 const html=gestorSourcePrintHtml({...args,rows,previousRows});
 const w=window.open('','_blank');if(!w)throw new Error('El navegador ha bloqueado la ventana de impresión.');
 try{w.opener=null}catch{}
 w.document.open();w.document.write(html);w.document.close();
 w.addEventListener('load',()=>{w.focus();w.print()},{once:true});
}
function exportStoreBook(storeId,year,month){
 const store=state.data.stores.find(x=>x.id===storeId);if(!store)throw new Error('Establecimiento no encontrado.');
 exportStoreMonthlyWorkbook({store,year,month,...selectReportData(state.data,getFilters('informes')),categories:state.data.categories});
}
let annualExportInProgress=false;
async function exportGestorPackage(year){
 if(annualExportInProgress){toast('El paquete anual ya se está preparando.');return;}
 annualExportInProgress=true;
 modal('Preparando paquete anual','<p id="annualPackageProgress" role="status" aria-live="polite">Preparando libros y documentos…</p>');
 try{
 const zip=new window.JSZip(),args=reportArgs(year),stores=state.data.stores.filter(x=>x.active!==false);
 const ingresos=zip.folder('01_INGRESOS'),gastos=zip.folder('02_GASTOS'),diarios=zip.folder('03_DIARIOS'),resumen=zip.folder('04_RESUMEN'),docs=zip.folder('05_DOCUMENTOS');
 const incomeRows=[
  ...state.data.closings.filter(x=>x.include_in_income!==false&&String(x.business_date).startsWith(String(year))).map(x=>[fmtDate(x.business_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'','Cierre',closingIncomeAmount(x),x.notes||'']),
  ...state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&String(x.issue_date).startsWith(String(year))).map(x=>[fmtDate(x.issue_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'','Factura adicional',n(x.total_amount),x.display_number||x.external_number_text||'']),
  ...state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&String(x.adjustment_date).startsWith(String(year))).map(x=>[fmtDate(x.adjustment_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'General','Ajuste de ingreso',n(x.amount),x.description||'']),
  ...state.data.incomeAdjustments.filter(x=>String(x.income_date).startsWith(String(year))).map(x=>[fmtDate(x.income_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'General','Ingreso manual',n(x.amount),x.concept||''])
 ].sort((a,b)=>{const key=d=>String(d||'').split('/').reverse().join('-');return key(a[0]).localeCompare(key(b[0]))});
 const incomeCsv=csv(incomeRows,['Fecha','Tienda','Origen','Importe','Detalle'].map((label,i)=>({label,get:r=>r[i]})));ingresos.file(`Ingresos_${year}.csv`,incomeCsv);
 const gestor=buildGestorWorkbook(args);gastos.file(`Libros_gestor_y_auditoria_${year}_Totus.xlsx`,workbookBlob(gestor));
 gastos.file(`Tabla_gestoria_${year}.xlsx`,workbookBlob(buildGestorSourceWorkbook({...args,from:`${year}-01-01`,to:`${year}-12-31`,store:'all'})));
 for(const store of stores)for(let month=1;month<=12;month++){const wb=buildStoreMonthlyWorkbook({store,year,month,closings:state.data.closings,expenses:state.data.expenses,categories:state.data.categories,incomeAdjustments:state.data.incomeAdjustments});diarios.file(`${safeFileSegment(store.name)}/${year}-${String(month).padStart(2,'0')} Gastos y ventas.xlsx`,workbookBlob(wb))}
 const yearClosings=state.data.closings.filter(x=>x.include_in_income!==false&&String(x.business_date).startsWith(String(year))),yearExpenses=state.data.expenses.filter(x=>String(x.expense_date).startsWith(String(year)));
 const yearInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&String(x.issue_date).startsWith(String(year)));
 const yearAdjustments=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&String(x.adjustment_date).startsWith(String(year)));
 const sales=yearClosings.reduce((v,x)=>v+closingIncomeAmount(x),0)+yearInvoices.reduce((v,x)=>v+n(x.total_amount),0)+yearAdjustments.reduce((v,x)=>v+n(x.amount),0)+state.data.incomeAdjustments.filter(x=>String(x.income_date).startsWith(String(year))).reduce((v,x)=>v+n(x.amount),0),accounting=yearExpenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false).reduce((v,x)=>v+expenseCostAmount(x),0),internal=yearExpenses.filter(x=>x.management_only).reduce((v,x)=>v+expenseCostAmount(x),0);
 resumen.file(`Resumen_${year}.csv`,`Concepto;Importe\nVentas;${sales.toFixed(2)}\nGastos fiscales revisados;${accounting.toFixed(2)}\nGastos internos;${internal.toFixed(2)}\nResultado real;${(sales-accounting-internal).toFixed(2)}\n`);
 const yearDocs=state.data.documents.filter(x=>String(x.document_date||x.created_at).startsWith(String(year)));
 const usedPaths=new Set(),manifest=[];
 const originals=await collectArchiveDocuments(yearDocs,getDocumentBlob,{onProgress:(done,total)=>{const progress=document.getElementById('annualPackageProgress');if(progress)progress.textContent=`Comprobando documentos ${done}/${total}…`;}});
 for(const [index,d] of yearDocs.entries()){
   const blob=originals[index];
   const archivePath=uniqueArchiveDocumentPath(d,usedPaths);
   docs.file(archivePath,blob);
   manifest.push([d.id,d.document_date||'',state.data.stores.find(x=>x.id===d.store_id)?.name||'General',d.doc_type||'',d.supplier_or_customer||'',d.original_name||'',archivePath,d.sha256||'',Number(d.size_bytes||blob.size||0)]);
 }
 if(manifest.length!==yearDocs.length||usedPaths.size!==yearDocs.length)throw new Error('Error de integridad: faltan documentos en el paquete.');
 docs.file('Indice_documentos_'+year+'.csv',csv(manifest,['ID','Fecha','Tienda','Tipo','Proveedor / cliente','Archivo original','Ruta ZIP','SHA256','Tamaño bytes'].map((label,i)=>({label,get:r=>r[i]}))));
 const progress=document.getElementById('annualPackageProgress');if(progress)progress.textContent='Comprimiendo paquete verificado…';
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:1}});download(blob,`Paquete_gestor_${year}.zip`);
 }finally{annualExportInProgress=false;if(document.getElementById('annualPackageProgress'))closeModal();}
}
function exportRows(type){
 const f=getFilters('informes');
 if(!f.from||!f.to)throw new Error('Selecciona Desde y Hasta.');
 const {closings,expenses,invoices,fiscalAdjustments,incomeAdjustments}=selectReportData(state.data,f);
 const stores=state.data.stores.filter(x=>f.store==='all'||x.id===f.store);
 if(type==='closings')return exportClosingsWorkbook({settings:state.data.settings,closings,closingDrawers:state.data.closingDrawers.filter(d=>closings.some(c=>c.id===d.closing_id)),stores:state.data.stores,drawers:state.data.drawers,from:f.from,to:f.to});
 if(type==='expenses')return exportExpensesWorkbook({settings:state.data.settings,expenses,stores:state.data.stores,taxPayments:state.data.taxPayments,reportFilter:f,from:f.from,to:f.to});
 return exportSummaryWorkbook({closings,expenses,stores,invoices,fiscalAdjustments,incomeAdjustments,taxPayments:state.data.taxPayments,reportFilter:f,from:f.from,to:f.to});
}

async function reviewUnusedLogos(){
 if(!isAdmin())throw new Error('Solo administración puede limpiar archivos.');
 await loadCore();
 const references=()=>JSON.stringify([state.data.templates,state.data.invoices,state.data.settings]);
 const files=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await sb.storage.from('business-assets').list('logos',{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
  if(error)throw error;
  files.push(...(data||[]).filter(x=>x.id).map(x=>'logos/'+x.name));
  if((data||[]).length<1000)break;
 }
 const unused=files.filter(path=>!references().includes(path));
 if(!unused.length){toast('Todos los logos están vinculados a plantillas o facturas.');return}
 if(!await confirmAction('Estos logos no aparecen en las plantillas, facturas ni configuración actuales: '+unused.join(', ')+'. Comprueba tu copia antes de retirarlos.',{phrase:'ELIMINAR LOGOS'}))return;
 await loadCore();
 let removed=0;
 try{
  for(const path of unused){
   if(references().includes(path))continue;
   await removeFile('business-assets',path);removed++;
  }
 }finally{
  if(removed)await insert('ops_audit_log',{user_id:state.session.user.id,user_email:state.user.email.toLowerCase(),area:'administracion',action:'unused_logos_removed',detail:{count:removed}});
  await refresh();
 }
 toast(removed+' logo(s) sin uso retirados.','ok');
}

document.addEventListener('click',async e=>{
 const el=actionEl(e);if(!el)return;
 if(writeInProgress&&!(el.dataset.action==='close-modal'&&$('#modalHost [data-confirm]'))){toast('Espera a que termine la operación en curso.');return}
 const route=el.dataset.route;if(route){if(!can(route,'view')){toast('No tienes permiso para acceder a esta sección.','bad');return}if(!await allowDiscardDrafts())return;closeModal();if(el.hasAttribute('data-maintenance-storage'))setView('administracion',{section:'storage'});setRoute(route);document.body.classList.remove('menu-open');render();if(isStoragePanelVisible())await refreshStoragePanel();return}
 const a=el.dataset.action;if(!a)return;
 if(!checkActionPermission(a,el)){toast('No tienes permiso para esta operación.','bad');return}
 if(a==='close-modal'){
  if(el.classList.contains('modal-backdrop')&&e.target!==el)return;
  if(discardPromptActive){closeModal();return}
  if(!await allowDiscardDrafts({modalOnly:true}))return;
 }
 const replacesPage=/(?:-back|-section|-home|-refresh)$/.test(a)||['logout','retry-load','closing-new','closing-edit','expense-new','expense-edit','invoice-new','proforma-new','rectifying-new','external-invoice-new','invoice-edit','invoice-open','invoice-rectify','document-new','document-edit','product-new','product-edit','expense-suppliers'].includes(a);
 if(replacesPage&&!await allowDiscardDrafts())return;
 if(!replacesPage&&/(?:-new|-edit|-permissions)$/.test(a)&&!await allowDiscardDrafts({modalOnly:true}))return;
 if(a==='invoice-finalize'&&hasFormDraft($('#content'))){toast('Guarda los cambios del borrador antes de emitir el documento.','bad');return}
 preserveMainDraftOnRefresh=!!el.closest('[data-modal-content]')&&hasFormDraft($('#content'));
 const writes=/-save(?:$|-)|-delete$|-finalize$|-reopen$|-run-now$|^recovery-confirm$|^recovery-continue$/.test(a),lockedControls=[];
 try{
  if(a.endsWith('-save')||a==='closing-save-close'||a==='closing-save-draft')validateDecimalFields();
  if(writes){writeInProgress=true;document.querySelectorAll('#content input,#content select,#content textarea,#content button,#modalHost input,#modalHost select,#modalHost textarea,#modalHost button,#nav button').forEach(control=>{lockedControls.push([control,control.disabled]);control.disabled=true})}
  if(a==='retry-load'){await refresh();return}
  if(a==='logout'){await logout();location.reload();return}
  if(a==='toggle-menu'){document.body.classList.toggle('menu-open');return}
  if(a==='close-modal'){if(el.classList.contains('modal-backdrop')&&e.target!==el)return;closeModal();return}
  if(a==='role-bulk-apply'){const preset=val('roleBulkPreset');for(const [module] of PERMISSION_MODULES){setRoleModulePreset(module,preset);const select=input('rolepreset_'+module);if(select&&!select.disabled)select.value=preset}return}
  if(a.endsWith('-clear')&&filterRoute[a.replace('-clear','')]){patchFilters(filterRoute[a.replace('-clear','')],{...monthRange(),store:'all',query:'',kind:'all',paid:'all',status:'all',type:'all',attachment:'all'});await refresh();return}
  if(a.endsWith('-apply')){applyFilter(a.replace('-apply',''));await refresh();return}
  if(a.endsWith('-month')){thisMonth(a.replace('-month',''));await refresh();return}
  if(a==='pricing-search'){patchFilters('pricing',{query:val('pricingQuery').trim()});render();return}
  if(a==='home-price-save'){await saveHomePrice();return}
  if(a==='home-report-quarter'){homeReport('quarter');return}
  if(a==='home-report-year'){homeReport('year');return}
  if(a==='admin-storage-home'){openAdminSection('storage');await refreshStoragePanel();return}
  if(a==='admin-users-home'){openAdminSection('usuarios');return}
  if(a==='closing-new'){setView('cajas',{mode:'record',id:null,storeId:el.dataset.store||null});setRoute('cajas');render();return}
  if(a==='closing-edit'){setView('cajas',{mode:'record',id:el.dataset.id,reconcileSource:false});render();return}
  if(a==='closing-view-source'){
   const row=state.data.closings.find(x=>x.id===el.dataset.id);if(!row)throw new Error('No se encuentra el cierre.');
   modal('Datos originales del cierre',sourceClosingRecordHtml(row,{embedded:true}));return;
  }
  if(a==='closing-save-draft'){await saveClosing(el.dataset.id||'','borrador');return}
  if(a==='closing-reconcile-source'){
   if(!can('cajas','edit'))throw new Error('No tienes permiso para conciliar cierres.');
   closeModal();
   setView('cajas',{mode:'record',id:el.dataset.id,reconcileSource:true});render();return;
  }
  if(a==='closing-save-close'){await saveClosing(el.dataset.id||'',val('clSaveStatus')||'cerrado');return}
  if(a==='closing-reopen'){await reopenClosing(el.dataset.id);return}
  if(a==='closing-back'){resetView('cajas');render();return}
  if(a==='export-closings-current'){exportCurrentModule('cajas');return}
  if(a==='closing-delete'){await deleteClosing(el.dataset.id);return}
  if(a==='expense-suppliers-search'){patchFilters('gastos',{supplierQuery:val('expenseSuppliersQuery').trim(),supplierShowInactive:!!input('expenseSuppliersInactive')?.checked});render();return}
  if(a==='expense-suppliers'){expenseSuppliersManager();return}
  if(a==='expense-supplier-new'){expenseSupplierForm();return}
  if(a==='expense-supplier-edit'){expenseSupplierForm(state.data.suppliers.find(x=>x.id===el.dataset.id));return}
  if(a==='expense-supplier-save'){await saveExpenseSupplier(el.dataset.id||'');return}
  if(a==='expense-supplier-delete'){await deleteExpenseSupplier(el.dataset.id);return}
  if(a==='expense-section'){setView('gastos',{mode:'list',id:null,section:el.dataset.section||'registros'});render();return}
  if(a==='expense-gestor-detail'){showExpenseGestorDetail(el.dataset.id);return}
  if(a==='expense-unlinked-open'){setRoute('documentos');setView('documentos',{mode:'record',id:el.dataset.id});render();return}
  if(a==='expense-file-preview'){await previewPendingExpenseFile();return}
  if(a==='expense-new'){setView('gastos',{mode:'record',id:null,taxPaymentId:null});setRoute('gastos');render();return}
  if(a==='expense-tax-edit'){setView('gastos',{mode:'record',id:null,taxPaymentId:el.dataset.id});render();return}
  if(a==='expense-tax-attach-save'){await saveTaxExpenseAttachment(el.dataset.id);return}
  if(a==='expense-edit'){setView('gastos',{mode:'record',id:el.dataset.id,taxPaymentId:null});render();return}
  if(a==='expense-attach-save'){await saveExpenseAttachment(el.dataset.id);return}
  if(a==='expense-save'){await saveExpense(el.dataset.id||'');return}
  if(a==='expense-back'){resetView('gastos');render();return}
  if(a==='expense-line-add'){addExpenseLine();return}
  if(a==='expense-line-remove'){removeExpenseLine(el.dataset.index);return}
  if(a==='expense-document-preview'){await previewDocument(el.dataset.id);return}
  if(a==='expense-document-download'){await downloadDocument(el.dataset.id);return}
  if(a==='expense-document-unlink'){await unlinkExpenseDocument(el.dataset.expense,el.dataset.document);return}
  if(a==='export-expenses-current'){exportCurrentModule('gastos');return}
  if(a==='expense-delete'){await deleteExpense(el.dataset.id);return}
  if(a==='invoice-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'invoice',origin:'totus'});setRoute('facturacion');render();return}
  if(a==='proforma-new'){setView('facturacion',{mode:'record',id:null,docType:'proforma',invoiceKind:'invoice',origin:'totus'});render();return}
  if(a==='rectifying-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'rectifying',origin:'totus',rectifiedInvoiceId:null});render();return}
  if(a==='external-invoice-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'invoice',origin:'externa'});render();return}
  if(a==='invoice-edit'||a==='invoice-open'){const row=state.data.invoices.find(x=>x.id===el.dataset.id);if(row){setView('facturacion',{mode:'record',id:row.id,docType:row.document_type,invoiceKind:row.invoice_kind,origin:row.origin});render()}return}
  if(a==='invoice-save'){await saveInvoice(el.dataset.id||'',el.dataset.type||'factura',el.dataset.kind||'invoice',el.dataset.origin||'totus');return}
  if(a==='invoice-back'){setView('facturacion',{mode:'list',id:null});render();return}
  if(a==='billing-section'){setView('facturacion',{mode:'list',id:null,section:el.dataset.section||'documentos'});render();return}
  if(a==='invoice-source-preview'){await previewDocument(el.dataset.id);return}
  if(a==='invoice-source-download'){await downloadDocument(el.dataset.id);return}
  if(a==='invoice-finalize'){await finalizeInvoice(el.dataset.id);return}
  if(a==='invoice-payment-save'){await saveInvoicePayment(el.dataset.id);return}
  if(a==='invoice-delete'){await deleteDraftInvoice(el.dataset.id);return}
  if(a==='invoice-rectify'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'rectifying',origin:'totus',rectifiedInvoiceId:el.dataset.id});render();return}
  if(a==='invoice-line-add'){addInvoiceLine();return}
  if(a==='invoice-line-remove'){removeInvoiceLine(el.dataset.index);return}
  if(a==='invoice-draft-preview'){await showDraftInvoicePreview();return}
  if(a==='invoice-preview'){await showInvoicePreview(el.dataset.id);return}
  if(a==='invoice-print'){await printInvoice(el.dataset.id);return}
  if(a==='proforma-convert'){await convertProforma(el.dataset.id);return}
  if(a==='families-manage'){familiesManager();return}
  if(a==='brand-new'){brandForm();return}
  if(a==='brand-edit'){brandForm(state.data.brands.find(x=>x.id===el.dataset.id));return}
  if(a==='brand-save'){await saveBrand(el.dataset.id||'');return}
  if(a==='brand-delete'){await deleteBrand(el.dataset.id);return}
  if(a==='family-new'){familyForm();return}
  if(a==='family-edit'){familyForm(state.data.families.find(x=>x.id===el.dataset.id));return}
  if(a==='family-save'){await saveFamily(el.dataset.id||'');return}
  if(a==='family-delete'){await deleteFamily(el.dataset.id);return}
  if(a==='providers-manage'){providersManager();return}
  if(a==='provider-new'){providerForm();return}
  if(a==='provider-edit'){providerForm(state.data.providers.find(x=>x.id===el.dataset.id));return}
  if(a==='provider-save'){await saveProvider(el.dataset.id||'');return}
  if(a==='provider-delete'){await deleteProvider(el.dataset.id);return}
  if(a==='provider-price-new'){providerPriceForm(el.dataset.product);return}
  if(a==='provider-price-edit'){providerPriceForm(el.dataset.product,state.data.providerPrices.find(x=>x.id===el.dataset.id));return}
  if(a==='provider-price-save'){await saveProviderPrice(el.dataset.product,el.dataset.id||'');return}
  if(a==='provider-price-delete'){await deleteProviderPrice(el.dataset.product,el.dataset.id);return}
  if(a==='competitor-new'){competitorForm(el.dataset.product);return}
  if(a==='competitor-edit'){competitorForm(el.dataset.product,state.data.competitors.find(x=>x.id===el.dataset.id));return}
  if(a==='competitor-save'){await saveCompetitor(el.dataset.product,el.dataset.id||'');return}
  if(a==='competitor-delete'){await deleteCompetitor(el.dataset.product,el.dataset.id);return}
  if(a==='variant-new'){variantForm(el.dataset.product);return}
  if(a==='variant-edit'){variantForm(el.dataset.product,state.data.variants.find(x=>x.id===el.dataset.id));return}
  if(a==='variant-save'){await saveVariant(el.dataset.product,el.dataset.id||'');return}
  if(a==='variant-delete'){await deleteVariant(el.dataset.product,el.dataset.id);return}
  if(a==='consultation-save'){await saveConsultation();return}
  if(a==='consultation-reuse'){await reuseConsultation(el.dataset.id);return}
  if(a==='consultation-convert'){consultationConvertForm(el.dataset.id);return}
  if(a==='consultation-convert-save'){await convertConsultation(el.dataset.id);return}
  if(a==='consultation-delete'){await deleteConsultation(el.dataset.id);return}
  if(a==='customers-manage'){customersManager();return}
  if(a==='customer-new'){customerForm();return}
  if(a==='customer-edit'){customerForm(state.data.customers.find(x=>x.id===el.dataset.id));return}
  if(a==='customer-save'){await saveCustomer(el.dataset.id||'');return}
  if(a==='customer-delete'){await deleteCustomer(el.dataset.id);return}
  if(a==='template-preview'){await previewTemplate(el.dataset.id);return}
  if(a==='template-duplicate'){await duplicateTemplate(el.dataset.id);return}
  if(a==='template-new'){templateForm();return}
  if(a==='template-edit'){templateForm(state.data.templates.find(x=>x.id===el.dataset.id));return}
  if(a==='template-save'){await saveTemplate(el.dataset.id||'');return}
  if(a==='template-delete'){await deleteTemplate(el.dataset.id);return}
  if(a==='series-new'){seriesForm();return}
  if(a==='series-edit'){seriesForm(state.data.series.find(x=>x.id===el.dataset.id));return}
  if(a==='series-save'){await saveSeries(el.dataset.id||'');return}
  if(a==='series-toggle'){await toggleSeries(el.dataset.id,el.dataset.active==='true');return}
  if(a==='expense-category-new'){expenseCategoryForm();return}
  if(a==='expense-category-edit'){expenseCategoryForm(state.data.categories.find(x=>x.id===el.dataset.id));return}
  if(a==='expense-category-save'){await saveExpenseCategory(el.dataset.id||'');return}
  if(a==='document-bulk-select'){input('documentBulkZip')?.click();return}
  if(a==='document-new'){setView('documentos',{mode:'record',id:null});setRoute('documentos');render();return}
  if(a==='document-edit'){setView('documentos',{mode:'record',id:el.dataset.id});render();return}
  if(a==='document-back'){resetView('documentos');render();return}
  if(a==='document-save'){await saveDocument(el.dataset.id||'');return}
  if(a==='document-download'){await downloadDocument(el.dataset.id);return}
  if(a==='document-delete'){await deleteDocument(el.dataset.id);return}
  if(a==='documents-zip'){await zipFilteredDocuments();return}
  if(a==='document-preview'){await previewDocument(el.dataset.id);return}
  if(a==='product-new'){setView('pricing',{mode:'record',id:null});render();return}
  if(a==='product-edit'){setView('pricing',{mode:'record',id:el.dataset.id});render();return}
  if(a==='product-save'){await saveProduct(el.dataset.id||'');return}
  if(a==='product-back'){resetView('pricing');render();return}
  if(a==='product-delete'){await deleteProduct(el.dataset.id);return}
  if(a==='store-new'){storeForm();return}
  if(a==='store-edit'){storeForm(state.data.stores.find(x=>x.id===el.dataset.id));return}
  if(a==='store-save'){await saveStore(el.dataset.id||'');return}
  if(a==='drawer-new'){drawerForm(el.dataset.store);return}
  if(a==='drawer-edit'){drawerForm(el.dataset.store,state.data.drawers.find(x=>x.id===el.dataset.id));return}
  if(a==='drawer-save'){await saveDrawer(el.dataset.store,el.dataset.id||'');return}
  if(a==='user-new'){userModal();return}
  if(a==='user-edit'){userModal(state.data.team.find(x=>x.email===el.dataset.email));return}
  if(a==='user-save'){await saveUser(el.dataset.email||'');return}
  if(a==='role-new'){roleForm();return}
  if(a==='role-rename'){roleForm(state.data.roles.find(r=>r.code===el.dataset.role));return}
  if(a==='role-save'){await saveRole(el.dataset.role||'');return}
  if(a==='role-delete'){await deleteRole(el.dataset.role);return}
  if(a==='role-permissions'){rolePermissionsModal(el.dataset.role);return}
  if(a==='role-permissions-save'){await saveRolePermissions(el.dataset.role);return}
  if(a==='role-permissions-reset'){await resetRolePermissions(el.dataset.role);return}
  if(a==='user-permissions'){userPermissionsModal(el.dataset.email);return}
  if(a==='user-permissions-save'){await saveUserPermissions(el.dataset.email);return}
  if(a==='user-permissions-reset'){await resetUserPermissions(el.dataset.email);return}
  if(a==='user-toggle'){await toggleUser(el.dataset.email,el.dataset.active==='true');return}
  if(a==='user-reset'){await resetUser(el.dataset.email);return}
  if(a==='user-delete'){await deleteUser(el.dataset.email);return}
  if(a==='config-save'){await saveConfig();return}
  if(a==='admin-section'){setView('administracion',{section:el.dataset.section||'usuarios'});render();if(el.dataset.section==='storage')await refreshStoragePanel();if(el.dataset.section==='onedrive')await refreshOneDrivePanel();return}

  if(a==='onedrive-expiry-save'){
   const expires=val('odCredentialExpiry');
   if(!expires)throw new Error('Indica la fecha de caducidad que aparece en Microsoft.');
   await oneDriveRequest('save-expiry',{expires_at:expires});await refreshOneDrivePanel();toast('Fecha guardada. Avisaremos desde 90 días antes.');return;
  }
  if(a==='onedrive-refresh'){await refreshOneDrivePanel();return}
  if(a==='onedrive-credential-save'){
   const field=$('#odClientSecret'),value=field?.value||'';
   try{await oneDriveRequest('configure',{client_secret:value});if(field)field.value='';await refreshOneDrivePanel();toast('Credencial guardada de forma privada.');}finally{if(field)field.value='';}
   return;
  }
  if(a==='onedrive-begin'){
   const result=await oneDriveRequest('begin');
   const authorization=new URL(result.authorization_url);
   if(authorization.origin!=='https://login.microsoftonline.com'||authorization.pathname!=='/consumers/oauth2/v2.0/authorize')throw new Error('Dirección de autorización no válida.');
   modal('Autorizar OneDrive',`<p>Microsoft solicitará acceso a la carpeta exclusiva de esta aplicación y permiso para mantener la conexión con el navegador cerrado.</p><p>No concede acceso general a tus otras carpetas.</p><a class="btn primary" href="${esc(authorization.href)}" target="_blank" rel="noopener noreferrer">Continuar en Microsoft</a><p>Después vuelve aquí y pulsa Actualizar conexión.</p>`);return;
  }
  if(a==='onedrive-backup-mirror'){
   toast('Copiando y comprobando la seguridad en OneDrive…');
   try{const result=await oneDriveRequest('mirror-backups',{full:true});await refreshOneDrivePanel();toast(result.complete?'Copia completa comprobada en OneDrive.':'Se ha avanzado el lote. Actualiza su estado antes de continuar.');}
   catch(error){await refreshOneDrivePanel().catch(()=>{});throw error;}return;
  }
  if(a==='onedrive-mirror'){
   toast('Copiando y comprobando hasta cinco documentos en el servidor…');
   try{const result=await oneDriveRequest('mirror-documents');await refreshOneDrivePanel();toast(result.copied+' documentos copiados y comprobados. Quedan '+result.pending+'.');}
   catch(error){await refreshOneDrivePanel().catch(()=>{});throw error;}return;
  }
  if(a==='onedrive-test'){
   toast('Guardando y leyendo el archivo de prueba…');
   const result=await oneDriveRequest('test');
   if(result.verified!==true)throw new Error('No se ha verificado el archivo de prueba.');
   await refreshOneDrivePanel();toast('Archivo guardado y vuelto a leer correctamente desde OneDrive.');return;
  }

  if(a==='storage-refresh'){await refreshStoragePanel();return}
  if(a==='admin-unused-logos'){await reviewUnusedLogos();return}
  if(a==='admin-log-filter'){applyAdminLogFilters();return}
  if(a==='admin-log-clear'){state.filters.adminLog={from:'',to:'',area:'',action:'',actor:'',query:''};render();return}
  if(a==='admin-log-refresh'){if(await refreshAuditPanel())toast('Eventos actualizados.');else toast(state.data.auditError,'bad');return}
  if(a==='admin-log-detail'){showLogEntry(el.dataset.id);return}
  if(a==='admin-log-export'){exportLogCsv();return}
  if(a==='admin-period-close'){await setClosedPeriod();return}
  if(a==='admin-period-reopen'){await setClosedPeriod(true);return}
  if(a==='expense-payment-open'){expensePaymentForm(el.dataset.id);return}
  if(a==='expense-payment-save'){await saveExpensePayment(el.dataset.id);return}
  if(a==='backup-settings-save'){await saveBackupSettings();return}
  if(a==='backup-run-now'){await runBackupOnServer();return}
  if(a==='backup-component-download'){await downloadBackupComponent(el.dataset.id,el.dataset.part);return}
  if(a==='backup-history-download'){await downloadStoredBackup(el.dataset.id);return}
  if(a==='backup-history-verify'){await verifyStoredBackup(el.dataset.id);return}
  if(a==='backup-history-delete'){await deleteStoredBackup(el.dataset.id);return}
  if(a==='backup-refresh'){await refresh('Historial de copias actualizado.');return}
  if(a==='backup-create'){await downloadBackup();return}
  if(a==='backup-verify'){await verifyBackupFromInput();return}
  if(a==='recovery-review'){await reviewRecoveryFile();return}
  if(a==='recovery-confirm'){await performRecovery();return}
  if(a==='recovery-continue'){await performRecovery(el.dataset.id);return}
  if(a==='recovery-component-download'){await downloadRecoveryComponent(el.dataset.id,el.dataset.kind,el.dataset.part);return}
  if(a==='recovery-download'){await downloadRecoveryFile(el.dataset.id,el.dataset.kind);return}
  if(a==='tax-payment-receipt'){taxReceiptForm(el.dataset.id);return}
  if(a==='tax-payment-receipt-save'){await saveTaxReceipt(el.dataset.id);return}
  if(a==='tax-payment-document-preview'){await previewDocument(taxReceiptDocument(el.dataset.id));return}
  if(a==='tax-payment-document-download'){await downloadDocument(taxReceiptDocument(el.dataset.id));return}
  if(a==='fiscal-quarter'){setFiscalQuarter(Number(el.dataset.year),Number(el.dataset.quarter));await refresh();return}
  if(a==='tax-payment-edit'){const row=el.dataset.id?state.data.taxPayments.find(x=>x.id===el.dataset.id):null;taxPaymentForm(el.dataset.model,Number(el.dataset.year),Number(el.dataset.quarter),row);return}
  if(a==='tax-payment-save'){await saveTaxPayment(el.dataset.id||'',el.dataset.model,Number(el.dataset.year),Number(el.dataset.quarter));return}
  if(a==='tax-payment-delete'){await deleteTaxPayment(el.dataset.id);return}
  if(a==='fiscal-adjustment-new'){fiscalAdjustmentForm();return}
  if(a==='fiscal-adjustment-edit'){fiscalAdjustmentForm(state.data.fiscalAdjustments.find(x=>x.id===el.dataset.id));return}
  if(a==='fiscal-adjustment-save'){await saveFiscalAdjustment(el.dataset.id||'');return}
  if(a==='fiscal-adjustment-delete'){await deleteFiscalAdjustment(el.dataset.id);return}
  if(a==='income-adjustment-new'){incomeAdjustmentForm();return}
  if(a==='income-adjustment-edit'){incomeAdjustmentForm(state.data.incomeAdjustments.find(x=>x.id===el.dataset.id));return}
  if(a==='income-adjustment-save'){await saveIncomeAdjustment(el.dataset.id||'');return}
  if(a==='income-adjustment-delete'){await deleteIncomeAdjustment(el.dataset.id);return}
  if(a==='export-closings'){exportRows('closings');return}
  if(a==='export-expenses'){exportRows('expenses');return}
  if(a==='export-summary'){exportRows('summary');return}
  if(a==='report-store-preview'){reportStorePreview(el.dataset.store,Number(el.dataset.year),Number(el.dataset.month));return}
  if(a==='report-gestor-source-preview'){reportGestorSourcePreview();return}
  if(a==='export-gestor-source'){exportGestorSourceWorkbook(gestorSourceArgs());return}
  if(a==='report-gestor-source-print'){printGestorSource();return}
  if(a==='export-store-book'){exportStoreBook(el.dataset.store,Number(el.dataset.year),Number(el.dataset.month));return}
  if(a==='export-gestor-book'){exportGestorWorkbook(reportArgs(Number(el.dataset.year)));return}
  if(a==='export-gestor-package'){await exportGestorPackage(Number(el.dataset.year));return}
 }catch(err){if(err.name!=='ValidationError')console.error(err);toast(err.message||String(err),'bad')}
 finally{lockedControls.forEach(([control,disabled])=>control.disabled=disabled);if(writes)writeInProgress=false;preserveMainDraftOnRefresh=false}
});

document.addEventListener('input',e=>{
 if(e.target?.id==='roleCode')e.target.dataset.manual='1';
 if(e.target?.id==='roleName'){
  const code=input('roleCode');
  if(code&&!code.disabled&&code.dataset.manual!=='1'){
   code.value=String(e.target.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,32);
  }
 }
 const id=e.target?.id||'';
 if(id==='clReported'||id.startsWith('dr'))updateClosingSummary();
 if(id.startsWith('homePrice'))updateHomePrice();
 if(id.startsWith('pq'))updatePricingQuick();
 if(id.startsWith('exLine')||id==='exPaidAmount')updateExpenseSummary();
 if(id.startsWith('iv')&&input('invoiceDraftPreview')){updateInvoiceSummary();updateDraftInvoicePreview()}
});

document.addEventListener('change',async e=>{
 if(e.target?.id==='clSaveStatus'){const button=document.querySelector('[data-action="closing-save-close"]');if(button)button.textContent=e.target.value==='borrador'?'Guardar borrador':document.querySelectorAll('.drawer-entry').length>1?'Cerrar las cajas':'Cerrar caja';return}
 if(['exDocKind','exTaxPaymentModel','exTaxPaymentYear','exTaxPaymentQuarter','exManagement','exPaidDate'].includes(e.target?.id)){updateExpenseTaxTreatment();return}
 if(e.target?.id?.startsWith('iv')&&input('invoiceDraftPreview'))queueMicrotask(()=>{updateInvoiceSummary();updateDraftInvoicePreview()});
 if(e.target?.id==='backupFile'){
  recoveryCandidate=null;
  const file=e.target.files?.[0],count=e.target.files?.length||0,label=input('backupSelectedFile');
  if(label)label.textContent=file?(count>1?count+' archivos seleccionados':file.name)+' · '+(file.size/1024).toFixed(1)+' KB':'Ningún archivo seleccionado';
  return;
 }
 if(e.target?.id==='backupFrequency'){
  const weekly=input('backupWeekdayWrapper'),monthly=input('backupMonthdayWrapper');
  if(weekly)weekly.hidden=e.target.value!=='weekly';
  if(monthly)monthly.hidden=e.target.value!=='monthly';
  return;
 }
 if(e.target?.id==='exFile'){
  const selected=e.target.files?.[0],name=input('exSelectedFile'),button=input('exFilePreview');
  if(name)name.textContent=selected?selected.name+' · '+(selected.size/1024).toFixed(1)+' KB · pendiente de guardar':'No se ha seleccionado una factura nueva.';
  if(button)button.disabled=!selected;
  return;
 }
 if(e.target?.classList?.contains('role-preset')){
   setRoleModulePreset(e.target.dataset.module,e.target.value);
   return;
 }
 if(e.target?.id?.startsWith('roleperm_')){
   const parts=e.target.id.split('_');const action=parts.pop(),module=parts.slice(1).join('_');
   if(action==='view'&&!e.target.checked){setRoleModulePreset(module,'none')}
   else if(action!=='view'&&e.target.checked){const view=input('roleperm_'+module+'_view');if(view)view.checked=true}
   const rights=Object.fromEntries(PERMISSION_ACTIONS.map(([a])=>[a,!!input('roleperm_'+module+'_'+a)?.checked]));
   const preset=input('rolepreset_'+module);if(preset)preset.value=rolePresetFor(rights);
   return;
 }
 if(e.target?.id==='documentBulkZip'){const file=e.target.files?.[0];e.target.value='';importDocumentZip(file).catch(err=>toast(err.message||String(err),'bad'));return}
 if(e.target?.id==='clStore'&&getView('cajas').mode==='record'&&!getView('cajas').id){
  if(!await allowDiscardDrafts({ignore:['clStore']})){e.target.value=originalFormValue($('#content'),'clStore');return}
  setView('cajas',{mode:'record',id:null,storeId:e.target.value,date:val('clDate')||isoToday()});render();return;
 }
 if(e.target?.id==='clDate'&&getView('cajas').mode==='record'&&!getView('cajas').id){const date=e.target.value||isoToday();setView('cajas',{date});for(const drawer of state.data.drawers.filter(d=>d.store_id===val('clStore')&&d.active!==false))setPristineFormValue($('#content'),`drOpen_${drawer.id}`,openingDrawerCash(drawer.store_id,drawer.id,date));updateClosingSummary();return}
 if(['ivStore','ivDate'].includes(e.target?.id)&&getView('facturacion').mode==='record'){
  const view=getView('facturacion'),saved=state.data.invoices.find(x=>x.id===view.id),storeId=val('ivStore'),docType=saved?.document_type||view.docType||'factura',kind=saved?.invoice_kind||view.invoiceKind||'invoice',year=Number(val('ivDate').slice(0,4));setView('facturacion',{storeId});
  let series=state.data.series.filter(s=>s.active!==false&&s.document_type===docType&&Number(s.year)===year&&(!s.store_id||s.store_id===storeId)&&(docType==='proforma'||s.series_kind===kind));
  if(docType==='factura'&&kind==='invoice'&&series.some(s=>!s.store_id))series=series.filter(s=>!s.store_id);
  const previousSeries=val('ivSeries');input('ivSeries').innerHTML=series.map(s=>`<option value="${esc(s.id)}">${esc(s.code)}</option>`).join('');input('ivSeries').value=series.some(s=>s.id===previousSeries)?previousSeries:series[0]?.id||'';
  if(e.target.id==='ivStore'){
   const templates=state.data.templates.filter(t=>t.active!==false&&(!t.store_id||t.store_id===storeId)),previousTemplate=val('ivTemplate');
   const chosen=templates.find(t=>t.store_id===storeId&&(docType==='proforma'?t.default_proforma:t.default_invoice))||templates.find(t=>t.id===previousTemplate)||templates.find(t=>docType==='proforma'?t.default_proforma:t.default_invoice);
   input('ivTemplate').innerHTML='<option value="">Sin plantilla</option>'+templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');input('ivTemplate').value=chosen?.id||'';
  }
  updateInvoiceSummary();updateDraftInvoicePreview();return;
 }
 if(e.target?.id==='exSupplierId'){
   const s=state.data.suppliers.find(x=>x.id===e.target.value);if(!s)return;
   const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.value=v};
   set('exSupplier',s.name);set('exTax',s.tax_id);set('exPayment',s.default_payment_method||'tarjeta');
   const first=document.querySelector('.expense-line');if(first){const ix=first.dataset.lineIndex;set('exLineCategory_'+ix,s.default_category_id||'');set('exLineVat_'+ix,s.default_vat_rate??21);set('exLineRe_'+ix,s.default_re_rate??0);set('exLineWh_'+ix,s.default_withholding_rate??0);set('exLineModel_'+ix,s.default_withholding_model||'');set('exLineDedPct_'+ix,s.default_deductible_pct??100);const d=document.getElementById('exLineDed_'+ix);if(d)d.checked=s.default_deductible_irpf!==false;const category=state.data.categories.find(c=>c.id===s.default_category_id);if(String(category?.code||'').startsWith('INTERNAL_')){const m=input('exManagement'),p=input('exLineDedPct_'+ix);if(m)m.checked=true;if(d)d.checked=false;if(p)p.value='0'}updateExpenseSummary()}
 }
 if(/^exLineCategory_\d+$/.test(e.target?.id||'')){
   const category=state.data.categories.find(x=>String(x.id)===String(e.target.value));
   if(String(category?.code||'').startsWith('INTERNAL_')){
     const index=e.target.id.slice('exLineCategory_'.length);
     const management=input('exManagement'),deductible=input('exLineDed_'+index),percentage=input('exLineDedPct_'+index);
     if(management)management.checked=true;
     if(deductible)deductible.checked=false;
     if(percentage)percentage.value='0';
     toast('Concepto interno: excluido de fiscalidad y gestoría.','ok');
   }
   updateExpenseSummary();
 }
 if(e.target?.id==='ivCustomerId'){
   const c=state.data.customers.find(x=>x.id===e.target.value);if(!c)return;
   const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
   set('ivCustomer',c.name);set('ivTax',c.tax_id);set('ivEmail',c.email);set('ivAddress',[c.address,c.postal_code,c.city,c.province].filter(Boolean).join(', '));set('ivPayment',c.default_payment_method||'transferencia');
 }
});

let recoveringPassword=false;
function showPasswordRecovery(){
 recoveringPassword=true;
 $('#app').classList.add('hidden');$('#login').classList.remove('hidden');
 $('#loginEmail').closest('label')?.classList.add('hidden');
 $('#loginPassword').closest('label')?.classList.add('hidden');
 $('#loginForm').querySelector('button[type="submit"]')?.classList.add('hidden');
 $('#recoverBtn').classList.add('hidden');
 $('#passwordResetPanel').classList.remove('hidden');
 $('#loginMessage').textContent='Elige una contraseña nueva y confírmala.';
}
$('#saveRecoveryPassword').addEventListener('click',async()=>{
 const message=$('#loginMessage'),password=val('recoveryPassword'),confirmPassword=val('recoveryPasswordConfirm');
 if(password.length<12){message.textContent='Utiliza al menos 12 caracteres.';return}
 if(password!==confirmPassword){message.textContent='Las contraseñas no coinciden.';return}
 const button=$('#saveRecoveryPassword');button.disabled=true;
 try{
  const {error}=await sb.auth.updateUser({password});
  if(error)throw error;
  recoveringPassword=false;
  await sb.auth.signOut();
  $('#passwordResetPanel').classList.add('hidden');
  $('#loginEmail').closest('label')?.classList.remove('hidden');
  $('#loginPassword').closest('label')?.classList.remove('hidden');
  $('#loginForm').querySelector('button[type="submit"]')?.classList.remove('hidden');
  $('#recoverBtn').classList.remove('hidden');
  $('#recoveryPassword').value='';$('#recoveryPasswordConfirm').value='';
  message.textContent='Contraseña actualizada. Ya puedes iniciar sesión.';
 }catch(err){message.textContent=err.message||'No se pudo cambiar la contraseña.'}
 finally{button.disabled=false}
});

$('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const m=$('#loginMessage');m.textContent='Comprobando acceso…';
 try{state.session=await login(val('loginEmail').trim().toLowerCase(),val('loginPassword'));await boot()}
 catch(err){m.textContent=err.message}
});
$('#recoverBtn').addEventListener('click',async()=>{
 const email=val('loginEmail').trim().toLowerCase();if(!email){$('#loginMessage').textContent='Escribe primero tu correo.';return}
 try{await recover(email);$('#loginMessage').textContent='Correo de recuperación solicitado.'}catch(e){$('#loginMessage').textContent=e.message}
});

async function boot(){
 if(recoveringPassword){showPasswordRecovery();return}
 const session=(await sb.auth.getSession()).data.session;state.session=session;
 if(!session){$('#login').classList.remove('hidden');$('#app').classList.add('hidden');return}
 const [teamRows,profileRows]=await Promise.all([
  select('team_members',{limit:1,allowTruncated:true,filter:q=>q.eq('email',session.user.email.toLowerCase())}),
  select('profiles',{limit:1,allowTruncated:true,filter:q=>q.eq('id',session.user.id)})
 ]);
 const member=teamRows[0],profile=profileRows[0];
 if(!member||member.active===false){await logout();throw new Error('Tu usuario no tiene acceso activo.')}
 if(!profile&&member.role==='admin')await insert('profiles',{id:session.user.id,email:session.user.email.toLowerCase(),full_name:member.full_name,role:member.role,active:true});
 state.user={...member,id:profile?.id||session.user.id};
 $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
 await refresh();
}
sb.auth.onAuthStateChange((event,session)=>{state.session=session;if(event==='PASSWORD_RECOVERY'){showPasswordRecovery();return}if(event==='SIGNED_OUT'){state.user=null;$('#app').classList.add('hidden');$('#login').classList.remove('hidden')}});

// Poll only while the Storage subtab is visible: no background traffic on other pages.
setInterval(()=>{if(document.visibilityState==='visible'&&isStoragePanelVisible())refreshStoragePanel().catch(console.error)},60000);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&isStoragePanelVisible())refreshStoragePanel().catch(console.error);
});
setInterval(()=>{if(document.visibilityState==='visible'&&state.route==='administracion'&&getView('administracion').section==='log'&&!state.loading&&!document.activeElement?.id?.startsWith('log')&&!input('modalHost')?.children.length)refreshAuditPanel()},30000);
boot().catch(e=>{$('#loginMessage').textContent=e.message;$('#login').classList.remove('hidden');$('#app').classList.add('hidden')});

// Enter applies the same visible controls as the Apply button, without submitting unrelated forms.
document.addEventListener('keydown',async e=>{
 if(e.key==='Escape'&&$('#modalHost')?.children.length){
  e.preventDefault();
  if(discardPromptActive)closeModal();else allowDiscardDrafts({modalOnly:true}).then(ok=>{if(ok)closeModal()});
  return;
 }
 if(e.key!=='Enter'||e.target?.tagName==='TEXTAREA')return;
 const prefix=e.target?.closest('[data-filter-prefix]')?.dataset.filterPrefix;
 try{
  if(prefix){e.preventDefault();applyFilter(prefix);await refresh()}
  else if(e.target?.id?.startsWith('log')){e.preventDefault();applyAdminLogFilters()}
  else if(e.target?.id==='pricingQuery'){e.preventDefault();patchFilters('pricing',{query:val('pricingQuery').trim()});render()}
  else if(e.target?.id==='expenseSuppliersQuery'){e.preventDefault();patchFilters('gastos',{supplierQuery:val('expenseSuppliersQuery').trim()});render()}
 }catch(error){toast(error.message||String(error),'bad')}
});

async function refreshOneDrivePanel(){
 if(!isAdmin())throw new Error('Solo administración puede consultar esta conexión.');
 setOneDriveStatus(await oneDriveRequest('status'));
 if(state.route==='administracion'&&['storage','onedrive'].includes(getView('administracion').section))render();
}
