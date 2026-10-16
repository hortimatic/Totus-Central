import {ROUTES} from './config.js';
import {PERMISSION_MODULES,PERMISSION_ACTIONS,permissionsFor,rolePermissions,defaultRolePermissions,canUser} from './permissions.js';
import {state,isAdmin,isManager,getFilters,patchFilters,setRoute,getView,setView,resetView} from './state.js';
import {sb,login,logout,recover,loadCore,rpc,insert,update,remove,invokeTeam,upload,signedUrl,removeFile} from './api.js';
import {renderers,invoiceLineRow,expenseLineRow,invoicePreview} from './pages/main.js';
import {setHeader,closeModal,toast,modal,btn,formField,selectField,table} from './components.js';
import {$,monthRange,n,isoToday,fmtDate,esc,download,csv,money} from './utils.js';
import {quickPriceStudy,validateExpensePayment,validateExpenseLineAmounts,validateExpenseClassification} from './calculations.js';
import {validateDocumentFile,previewKind,safeFileSegment,uniqueArchiveDocumentPath} from './file-utils.js';
import {exportClosingsWorkbook,exportExpensesWorkbook,exportSummaryWorkbook,exportStoreAnnualWorkbook,exportGestorWorkbook,buildStoreAnnualWorkbook,buildGestorWorkbook,workbookBlob} from './excel.js';
import {createBackup,inspectBackup} from './backup.js';

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
 else if(/^(tax-payment-|fiscal-|reta-|expense-category-)/.test(action))module='fiscalidad';
 else if(/^(pricing-|product-|brand-|family-|families-|provider-|providers-|variant-|competitor-|consultation-|home-price-)/.test(action))module='pricing';
 else if(/^(report-|export-gestor-|export-store-|export-summary)/.test(action))module='informes';
 else if(/^(user-|role-|store-|drawer-|config-|backup-|admin-)/.test(action))module='administracion';
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
 if(a==='config-save'||a==='backup-create'||a==='backup-restore'||a==='store-save'||a==='drawer-save')return {module:'administracion',operation:'edit',adminOnly:true};
 if(a==='document-bulk-select'||a==='document-bulk-import')operation='create';
 if(a==='proforma-convert')operation='create';
 if(a==='closing-save-close'&&el?.dataset?.id)operation='edit';
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
 $('#content').innerHTML=renderer();
 hideForbiddenButtons();
 $('#userCard').innerHTML=`<b>${esc(state.user.full_name||state.user.email)}</b><span>${esc(state.user.role||'usuario')}</span>`;
}
async function refresh(message=''){
 state.loading=true;
 try{
  await loadCore();
  if(message)toast(message,'ok');render()
 }
 catch(e){
  console.error(e);toast(e.message,'bad');
  const content=$('#content');
  if(content)content.innerHTML=`<section class="card card-pad" role="alert"><h2>No se han podido cargar los datos</h2><p>${esc(e.message||'Error de conexión o permisos.')} No se ha borrado ningún dato.</p>${btn('Volver a intentar','retry-load','primary')}</section>`;
 }
 finally{state.loading=false}
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
 const store=required('clStore','Tienda'),date=required('clDate','Fecha');
 if(date>isoToday())throw new Error('La fecha del cierre no puede ser futura.');
 const drawerEls=[...document.querySelectorAll('.drawer-entry')];
 if(!drawerEls.length)throw new Error('La tienda no tiene cajas activas configuradas.');
 const drawers=drawerEls.map(el=>{
   const d=el.dataset.drawerId;
   const raw=suffix=>document.getElementById(`dr${suffix}_${d}`)?.value??'';
   const read=suffix=>n(raw(suffix));
   if(status==='cerrado'&&raw('Close')==='')throw new Error('Falta el efectivo final de una caja.');
   const row={drawer_id:d,opening_cash:read('Open'),closing_cash:read('Close'),card_sales:read('Card'),bizum_sales:read('Bizum'),online_sales:read('Online'),other_income:read('Other'),cash_withdrawals:read('Withdraw'),cash_expenses_declared:read('CashExpense'),cash_extra_in:read('ExtraIn'),cash_extra_out:read('ExtraOut'),notes:''};
   if(Object.entries(row).some(([k,v])=>k!=='drawer_id'&&k!=='notes'&&Number(v)<0))throw new Error('No se admiten importes negativos en Cajas.');
   return row;
 });
 const payload={id:id||null,store_id:store,business_date:date,reported_total_sales:val('clReported')===''?null:num('clReported'),notes:val('clNotes').trim(),status};
 const savedId=await rpc('totus_save_closing',{p_closing:payload,p_drawers:drawers});
 setView('cajas',{mode:'record',id:savedId});
 await refresh(status==='cerrado'?'Cierre cerrado y cuadrado.':'Borrador guardado.');
}
async function reopenClosing(id){
 if(!confirm('¿Reabrir este cierre para corregirlo? La acción quedará registrada.'))return;
 const row=state.data.closings.find(x=>x.id===id);if(!row)return;
 const drawers=state.data.closingDrawers.filter(x=>x.closing_id===id).map(x=>({drawer_id:x.drawer_id,opening_cash:x.opening_cash,closing_cash:x.closing_cash,card_sales:x.card_sales,bizum_sales:x.bizum_sales,online_sales:x.online_sales,other_income:x.other_income,cash_withdrawals:x.cash_withdrawals,cash_expenses_declared:x.cash_expenses_declared,cash_extra_in:x.cash_extra_in,cash_extra_out:x.cash_extra_out,notes:x.notes||''}));
 await rpc('totus_save_closing',{p_closing:{id,store_id:row.store_id,business_date:row.business_date,reported_total_sales:row.reported_total_sales,notes:row.notes||'',status:'borrador'},p_drawers:drawers});
 await refresh('Cierre reabierto.');
}
async function deleteClosing(id){
 if(!confirm('¿Eliminar este cierre?'))return;
 const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 await rpc('totus_delete_closing',{p_id:id,p_reason:reason.trim()});
 resetView('cajas');await refresh('Cierre eliminado.');
}

function expenseSuppliersManager(){
 const rows=state.data.suppliers.filter(x=>x.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const body=`<div class="section-head"><div><p>Proveedores de gastos con valores fiscales predeterminados.</p></div>${btn('Nuevo proveedor','expense-supplier-new','primary')}</div>
 <div class="stack" style="margin-top:14px">${rows.length?rows.map(s=>`<div class="summary-row"><div><b>${esc(s.name)}</b><div class="small muted">${esc(s.tax_id||'')}${s.default_payment_method?' · '+esc(s.default_payment_method):''}</div></div><div class="inline-actions">${btn('Editar','expense-supplier-edit','secondary',`data-id="${s.id}"`)}${btn('Eliminar','expense-supplier-delete','danger',`data-id="${s.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin proveedores</strong><span>Crea el primero para reutilizar sus datos en Gastos.</span></div>'}</div>`;
 modal('Proveedores de gastos',body);
}
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
  ${selectField('Modelo retención','esWhModel',[{value:'',label:'Sin modelo'},{value:'111',label:'111'},{value:'115',label:'115'}],row?.default_withholding_model||'')}
  ${formField('% deducible','esDedPct',row?.default_deductible_pct??100,'number','min="0" max="100"')}
  <label><input id="esDeductible" type="checkbox" ${row?.default_deductible_irpf===false?'':'checked'}> Deducible IRPF por defecto</label>
  <label class="wide">Notas<textarea id="esNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="form-actions">${btn('Guardar proveedor','expense-supplier-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar proveedor de gastos':'Nuevo proveedor de gastos',body);
}
async function saveExpenseSupplier(id=''){
 const taxId=val('esTax').trim();
 if(taxId){
   const dup=state.data.suppliers.find(x=>x.id!==id&&String(x.tax_id||'').trim().toLowerCase()===taxId.toLowerCase());
   if(dup)throw new Error('Ya existe un proveedor con ese NIF/CIF.');
 }
 const row={name:required('esName','Nombre'),tax_id:taxId,email:val('esEmail').trim(),phone:val('esPhone').trim(),address:val('esAddress').trim(),city:val('esCity').trim(),postal_code:val('esPostal').trim(),province:val('esProvince').trim(),country:'España',default_category_id:val('esCategory')||null,default_payment_method:val('esPayment'),default_document_kind:val('esDocKind'),default_vat_rate:Math.max(0,num('esVat')),default_re_rate:Math.max(0,num('esRe')),default_withholding_rate:Math.max(0,num('esWh')),default_withholding_model:val('esWhModel')||null,default_deductible_irpf:!!input('esDeductible')?.checked,default_deductible_pct:Math.min(100,Math.max(0,num('esDedPct'))),notes:val('esNotes').trim(),active:true,source:'manual',updated_at:new Date().toISOString()};
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
async function createStoredDocument(file,{storeId=null,date,docType='otro',status='pendiente',party='',taxId='',number='',category='',notes='',linkedType=null,linkedId=null}={}){
 const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);
 const usage=state.data.storageUsage||{},limit=Number(usage.limit_bytes||500*1024*1024),used=Number(usage.total_bytes||0);
 validateDocumentFile(file,{maxBytes:max,usedBytes:used,limitBytes:limit});
 const y=String(date).slice(0,4),m=String(date).slice(5,7),storeNameValue=state.data.stores.find(s=>s.id===storeId)?.name||'General';
 const path=`${y}/${quarterFromDate(date)}/${m}/${safeFileSegment(storeNameValue)}/${safeFileSegment(docType)}/${safeFileSegment(party)}/${crypto.randomUUID()}_${safeFileSegment(file.name)}`;
 await upload('business-documents',path,file);
 let doc;
 try{
   doc=await insert('ops_documents',{store_id:storeId||null,doc_type:docType,document_date:date,supplier_or_customer:party,tax_id:taxId,invoice_number:number,category_code:category,status,storage_path:path,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:await fileSha256(file),linked_entity_type:linkedType,linked_entity_id:linkedId,notes,uploaded_by:state.session?.user?.id||null});
 }catch(e){await removeFile('business-documents',path).catch(()=>{});throw e}
 return doc;
}
async function destroyDocument(doc){
 if(!doc)return;
 await remove('ops_documents',doc.id);
 if(doc.storage_path)await removeFile('business-documents',doc.storage_path).catch(()=>{});
}

async function saveExpense(id=''){
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
   validateExpenseLineAmounts({base,vat,re,withholding:wh,deductiblePct:dedPct});
   const description=required(`exLineDesc_${ix}`,`Descripción de la línea ${i+1}`);
   return {sort_order:(i+1)*10,category_id:val(`exLineCategory_${ix}`)||null,description,base_amount:base,vat_rate:vat,vat_amount:0,re_base:0,re_rate:re,re_amount:0,irpf_imputable:0,withholding_base:0,withholding_rate:wh,withholding_amount:0,withholding_model:val(`exLineModel_${ix}`)||null,deductible_irpf:!!input(`exLineDed_${ix}`)?.checked,deductible_pct:dedPct,fixed_asset:!!input(`exLineFixed_${ix}`)?.checked,amortization_years:val(`exLineAmort_${ix}`)===''?null:n(val(`exLineAmort_${ix}`)),notes:''};
 });
 validateExpenseClassification(lines,state.data.categories,!!input('exManagement')?.checked);
 const total=lines.reduce((acc,l)=>acc+l.base_amount+l.base_amount*l.vat_rate/100+l.base_amount*l.re_rate/100-l.base_amount*l.withholding_rate/100,0);
 const amountPaid=val('exPaidAmount')===''?(paidStatus==='pagado'?total:0):num('exPaidAmount');
 validateExpensePayment(total,amountPaid,paidStatus);
 const current=id?state.data.expenses.find(x=>x.id===id):null,oldDoc=current?.document_id?state.data.documents.find(x=>x.id===current.document_id):null;
 const file=input('exFile')?.files?.[0]||null;
 let newDoc=null,documentId=oldDoc?.id||null;
 if(file){
   newDoc=await createStoredDocument(file,{storeId,date,docType:'factura_recibida',status:paidStatus==='pagado'?'pagada':'pendiente',party:supplier,taxId,number:invoiceNumber,category:'gasto',notes:'Justificante de gasto',linkedType:'expense'});
   documentId=newDoc.id;
 }
 const first=lines[0];
 const expense={id:id||null,store_id:storeId,expense_date:date,supplier_id:val('exSupplierId')||null,supplier_name:supplier,supplier_tax_id:taxId,invoice_number:invoiceNumber,category_id:first.category_id,description:lines.map(l=>l.description).join(' · '),payment_method:val('exPayment'),paid_status:paidStatus,paid_date:paidDate,vat_rate:first.vat_rate,re_rate:first.re_rate,withholding_rate:first.withholding_rate,withholding_model:first.withholding_model,amount_paid:amountPaid,deductible_irpf:lines.every(l=>l.deductible_irpf),deductible_pct:first.deductible_pct,fixed_asset:lines.some(l=>l.fixed_asset),amortization_years:first.amortization_years,document_id:documentId,notes:val('exNotes').trim(),document_kind:val('exDocKind')||'factura',source:'manual',fiscal_reviewed:false,management_only:!!input('exManagement')?.checked,personnel_kind:val('exPersonnelKind').trim()||null};
 let savedId;
 try{savedId=await rpc('totus_save_expense',{p_expense:expense,p_lines:lines})}
 catch(e){if(newDoc)await destroyDocument(newDoc).catch(()=>{});throw e}
 if(newDoc){await update('ops_documents',newDoc.id,{linked_entity_id:savedId});if(oldDoc&&oldDoc.id!==newDoc.id)await destroyDocument(oldDoc).catch(()=>{})}
 setView('gastos',{mode:'record',id:savedId});await refresh('Gasto guardado.');
}
async function unlinkExpenseDocument(expenseId,documentId){
 if(!confirm('¿Quitar el justificante de este gasto?'))return;
 const doc=state.data.documents.find(x=>x.id===documentId);
 await update('ops_expenses',expenseId,{document_id:null});
 if(doc)await destroyDocument(doc);
 await refresh('Justificante eliminado.');
}
async function deleteExpense(id){
 if(!confirm('¿Eliminar este gasto?'))return;
 const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 const row=state.data.expenses.find(x=>x.id===id),doc=row?.document_id?state.data.documents.find(x=>x.id===row.document_id):null;
 await rpc('totus_delete_expense',{p_id:id,p_reason:reason.trim()});
 if(doc)await destroyDocument(doc).catch(()=>{});
 resetView('gastos');await refresh('Gasto eliminado.');
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
 const paidStatus=isProforma?'pendiente':(val('ivPaidStatus')||'pendiente'),paidAmount=isProforma?0:Math.max(0,num('ivPaidAmount'));if(paidStatus==='pendiente'&&paidAmount>0)throw new Error('Un documento pendiente no puede tener importe cobrado.');if(paidStatus==='pagada'&&!paidDate)throw new Error('Indica la fecha de cobro.');
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
 let savedId;
 try{savedId=await rpc('totus_save_sales_document',{p_document:doc,p_lines:lines})}
 catch(e){if(newSource)await destroyDocument(newSource).catch(()=>{});throw e}
 if(newSource){await update('ops_documents',newSource.id,{linked_entity_id:savedId});if(oldSource&&oldSource.id!==newSource.id)await destroyDocument(oldSource).catch(()=>{})}
 setView('facturacion',{mode:'record',id:savedId,docType:type,invoiceKind:doc.invoice_kind,origin});
 await refresh(isProforma?'Proforma guardada.':'Documento guardado.');
}
async function saveInvoicePayment(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)throw new Error('Factura no encontrada.');
 const status=val('ivPaidStatus')||'pendiente',amount=Math.max(0,num('ivPaidAmount')),date=val('ivPaidDate')||null,method=val('ivPayment')||'transferencia';
 if(date&&date>isoToday())throw new Error('La fecha de cobro no puede ser futura.');
 if(status==='pendiente'&&amount>0)throw new Error('Una factura pendiente no puede tener importe cobrado.');
 if(status==='pagada'&&(Math.abs(amount-Number(row.total_amount||0))>.02||!date))throw new Error('Una factura pagada debe tener fecha y el total cobrado.');
 if(status==='parcial'&&(amount<=0||amount>=Number(row.total_amount||0)||!date))throw new Error('Un cobro parcial debe tener fecha e importe mayor que 0 y menor que el total.');
 await rpc('totus_update_invoice_payment',{p_id:id,p_payment:{paid_status:status,paid_amount:amount,paid_date:date,payment_method:method}});
 await refresh('Cobro actualizado.');
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
 const rows=[...document.querySelectorAll('.expense-line')];let base=0,vat=0,re=0,wh=0;
 for(const el of rows){const ix=el.dataset.lineIndex,b=Math.max(0,n(val(`exLineBase_${ix}`))),v=Math.max(0,n(val(`exLineVat_${ix}`))),r=Math.max(0,n(val(`exLineRe_${ix}`))),w=Math.max(0,n(val(`exLineWh_${ix}`)));base+=b;vat+=b*v/100;re+=b*r/100;wh+=b*w/100}
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=money(v)};
 set('exSumBase',base);set('exSumVat',vat);set('exSumRe',re);set('exSumWh',wh);set('exSumTotal',base+vat+re-wh);
}
function updateClosingSummary(){
 const rows=[...document.querySelectorAll('.drawer-entry')];let total=0;
 for(const el of rows){const d=el.dataset.drawerId,read=s=>n(document.getElementById(`dr${s}_${d}`)?.value||0);const cash=read('Close')+read('Withdraw')+read('CashExpense')+read('ExtraOut')-read('ExtraIn')-read('Open');total+=cash+read('Card')+read('Bizum')+read('Online')+read('Other')}
 const reported=val('clReported')===''?null:num('clReported'),diff=reported==null?0:total-reported,fmt=v=>money(v);
 const t=document.getElementById('clCalcTotal'),r=document.getElementById('clReportedTotal'),d=document.getElementById('clDifference');if(t)t.textContent=fmt(total);if(r)r.textContent=reported==null?'—':fmt(reported);if(d){d.textContent=fmt(diff);d.className=Math.abs(diff)>.01?'danger-text':'good-text'}
}
function updateInvoiceSummary(){
 let base=0,vat=0;for(const el of document.querySelectorAll('.invoice-line')){const ix=el.dataset.lineIndex,q=n(val(`ivQty_${ix}`)),u=n(val(`ivUnit_${ix}`)),disc=Math.min(100,Math.max(0,n(val(`ivDisc_${ix}`)))),vr=Math.max(0,n(val(`ivVat_${ix}`)));const b=q*u*(1-disc/100);base+=b;vat+=b*vr/100}
 const fmt=v=>money(v);for(const [id,v] of [['ivSumBase',base],['ivSumVat',vat],['ivSumTotal',base+vat]]){const el=document.getElementById(id);if(el)el.textContent=fmt(v)}
}
function exportCurrentModule(module){
 const f=getFilters(module);
 if(module==='cajas'){
   const closings=state.data.closings.filter(x=>(!f.from||x.business_date>=f.from)&&(!f.to||x.business_date<=f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.notes,state.data.stores.find(s=>s.id===x.store_id)?.name,x.status].join(' ').toLowerCase().includes(f.query.toLowerCase())));
   return exportClosingsWorkbook({closings,closingDrawers:state.data.closingDrawers.filter(d=>closings.some(c=>c.id===d.closing_id)),stores:state.data.stores,drawers:state.data.drawers,from:f.from,to:f.to});
 }
 const expenses=state.data.expenses.filter(x=>(!f.from||x.expense_date>=f.from)&&(!f.to||x.expense_date<=f.to)&&(f.store==='all'||x.store_id===f.store)&&(f.kind==='all'||!f.kind||(f.kind==='internal'?x.management_only:!x.management_only))&&(f.paid==='all'||!f.paid||x.paid_status===f.paid)&&(!f.query||[x.supplier_name,x.invoice_number,x.description,x.payment_method].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 return exportExpensesWorkbook({expenses,stores:state.data.stores,from:f.from,to:f.to});
}

function addInvoiceLine(){
 const host=document.getElementById('invoiceLines');if(!host)return;
 const indexes=[...host.querySelectorAll('.invoice-line')].map(x=>Number(x.dataset.lineIndex)||0);
 const next=indexes.length?Math.max(...indexes)+1:0;
 host.insertAdjacentHTML('beforeend',invoiceLineRow({},next));
}
function removeInvoiceLine(index){
 const rows=[...document.querySelectorAll('.invoice-line')];
 if(rows.length<=1){toast('Debe quedar al menos una línea.','bad');return}
 document.querySelector(`.invoice-line[data-line-index="${index}"]`)?.remove();
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
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${row.display_number||'Documento'}</title><link rel="stylesheet" href="${new URL('src/styles.css',location.href).href}"><style>body{padding:28px;background:white}.btn,.form-actions{display:none!important}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
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
 const r=quickPriceStudy({cost:val('pqCost'),pvp:val('pqPvp'),competitor:val('pqCompetitor'),discount:val('pqDiscount'),vat:state.data.settings?.default_sales_vat_rate||21,re:state.data.settings?.purchase_re_rate||5.2});
 const set=(id,text,cls='')=>{const el=document.getElementById(id);if(el){el.textContent=text;el.className=cls}};
 set('pqReal',money(r.costReal));set('pqSale',money(r.finalSale));set('pqMargin',money(r.margin),r.margin<0?'danger-text':r.marginPct<18?'warn-text':'good-text');set('pqMarginPct',r.marginPct.toFixed(1).replace('.',',')+' %',r.margin<0?'danger-text':r.marginPct<18?'warn-text':'good-text');set('pqCompetition',r.competitorDiff==null?'—':((r.competitorDiff>0?'+':'')+money(r.competitorDiff)),r.competitorDiff==null?'':r.competitorDiff>0?'warn-text':'good-text');
}
async function saveConsultation(){
 const query=required('pqQuery','Consulta');
 const r=quickPriceStudy({cost:val('pqCost'),pvp:val('pqPvp'),competitor:val('pqCompetitor'),discount:val('pqDiscount'),vat:state.data.settings?.default_sales_vat_rate||21,re:state.data.settings?.purchase_re_rate||5.2});
 const row=await insert('consultations',{query,cost_net:r.cost,pvp:r.pvp,competitor:r.competitor,discount:r.discount,cost_real:r.costReal,final_sale:r.finalSale,margin:r.margin,margin_pct:r.marginPct,created_by:state.user?.id||null,last_reopened_at:null,updated_at:new Date().toISOString()});
 await insert('consultation_history',{consultation_id:row.id,user_id:state.user?.id||null,action:'CREADO',consultation_query:query,snapshot:row}).catch(()=>{});
 await refresh('Consulta guardada.');
}
function consultationConvertForm(id){
 const c=state.data.consultations.find(x=>x.id===id);if(!c)return;
 const families=[{value:'',label:'Sin familia'},...state.data.families.map(x=>({value:x.id,label:x.name}))];
 const providers=[{value:'',label:'Sin proveedor'},...state.data.providers.map(x=>({value:x.id,label:x.name}))];
 const body=`<div class="form-grid">
  ${formField('Nombre producto','ccName',c.query||'')}
  ${formField('Referencia / SKU','ccSku','')}
  ${selectField('Familia','ccFamily',families,'')}
  ${selectField('Proveedor opcional','ccProvider',providers,'')}
  ${formField('Coste neto','ccCost',c.cost_net??0,'number','step="0.01" min="0"')}
  ${formField('PVP','ccPvp',c.pvp??0,'number','step="0.01" min="0"')}
 </div><div class="note" style="margin-top:12px">El impuesto especial de sales no se vuelve a sumar: el coste introducido se conserva como coste de compra.</div><div class="form-actions">${btn('Crear producto','consultation-convert-save','primary',`data-id="${id}"`)}</div>`;
 modal('Convertir consulta en producto',body,{small:true});
}
async function convertConsultation(id){
 const c=state.data.consultations.find(x=>x.id===id);if(!c)throw new Error('Consulta no encontrada.');
 const sku=required('ccSku','Referencia / SKU').trim(),name=required('ccName','Nombre');
 const dup=state.data.products.find(x=>String(x.sku||'').trim().toLowerCase()===sku.toLowerCase());if(dup)throw new Error('Ya existe un producto con esa referencia.');
 const product=await insert('products',{name,sku,family_id:val('ccFamily')||null,product_type:'simple',current_pvp:Math.max(0,num('ccPvp')),proposed_pvp:null,units_month:0,status:'ACTIVO',notes:'Creado desde consulta: '+c.query,created_by:state.user?.id||null,updated_at:new Date().toISOString()});
 const providerId=val('ccProvider')||null,cost=Math.max(0,num('ccCost'));
 if(providerId)await insert('product_provider_prices',{product_id:product.id,variant_id:null,provider_id:providerId,net_cost:cost,provider_discount:0,shipping_unit:0,moq:0,stock_status:'',price_date:isoToday(),notes:'Coste trasladado desde consulta',selected:true,purchase_origin:'España',apply_special_tax:false,special_tax_amount:0});
 await insert('consultation_history',{consultation_id:id,user_id:state.user?.id||null,action:'CONVERTIDO_A_PRODUCTO',consultation_query:c.query,snapshot:{...c,product_id:product.id}}).catch(()=>{});
 closeModal();await refresh('Producto creado desde la consulta.');setView('pricing',{mode:'record',id:product.id});setRoute('pricing');render();
}

async function reuseConsultation(id){
 const c=state.data.consultations.find(x=>x.id===id);if(!c)return;
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??''};
 set('pqQuery',c.query);set('pqCost',c.cost_net);set('pqPvp',c.pvp);set('pqCompetitor',c.competitor);set('pqDiscount',c.discount);
 await update('consultations',id,{last_reopened_at:new Date().toISOString(),updated_at:new Date().toISOString()}).catch(()=>{});
 await insert('consultation_history',{consultation_id:id,user_id:state.user?.id||null,action:'REABIERTO',consultation_query:c.query,snapshot:c}).catch(()=>{});
 toast('Consulta cargada.','ok');
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
  ${selectField('Estilo','tpStyle',[{value:'modern',label:'Moderna'},{value:'minimal',label:'Minimal'},{value:'classic',label:'Clásica'}],row?.style==='brand'?'modern':row?.style==='clean'?'minimal':row?.style==='compact'?'classic':(row?.style||'modern'))}
  ${formField('Color principal','tpPrimary',row?.primary_color||'#17365D','color')}
  ${formField('Color secundario','tpSecondary',row?.secondary_color||'#4472C4','color')}
  ${formField('Color de texto','tpTextColor',row?.text_color||'#17202A','color')}
  ${selectField('Tipografía','tpFont',[{value:'helvetica',label:'Helvetica / Arial'},{value:'georgia',label:'Georgia'},{value:'times',label:'Times'}],row?.font_family||'helvetica')}
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

async function saveTemplate(id=''){
 const current=id?state.data.templates.find(x=>x.id===id):null;
 const file=input('tpLogo')?.files?.[0]||null;
 if(file){
   const allowed=['image/png','image/jpeg','image/webp'];if(!allowed.includes(file.type))throw new Error('El logo debe ser PNG, JPG o WEBP.');
   if(file.size>5*1024*1024)throw new Error('El logo supera 5 MB.');
 }
 let logoPath=current?.logo_path||null,logoName=current?.logo_name||null,logoMime=current?.logo_mime||null,logoSize=Number(current?.logo_size_bytes||0),uploadedPath=null;
 if(file){
   const ext=(file.name.split('.').pop()||'img').replace(/[^a-z0-9]/gi,'');
   uploadedPath=`logos/${crypto.randomUUID()}.${ext}`;
   await upload('business-assets',uploadedPath,file);
   logoPath=uploadedPath;logoName=file.name;logoMime=file.type;logoSize=file.size;
 }
 const storeId=val('tpStore')||null,defaultInvoice=!!input('tpDefaultInvoice')?.checked,defaultProforma=!!input('tpDefaultProforma')?.checked;
 const code=required('tpCode','Código').trim().toUpperCase(),name=required('tpName','Nombre');
 const duplicate=state.data.templates.find(x=>x.id!==id&&String(x.code||'').trim().toUpperCase()===code&&String(x.store_id||'')===String(storeId||''));
 if(duplicate){if(uploadedPath)await removeFile('business-assets',uploadedPath).catch(()=>{});throw new Error('Ya existe una plantilla con ese código para la misma tienda.')}
 const row={name,code,store_id:storeId,style:val('tpStyle'),primary_color:val('tpPrimary'),secondary_color:val('tpSecondary'),text_color:val('tpTextColor'),font_family:val('tpFont'),logo_position:val('tpLogoPos'),logo_width_mm:Math.min(70,Math.max(10,n(val('tpLogoWidth'))||34)),show_logo:input('tpShowLogo')?.checked!==false,show_payment_details:input('tpShowPayment')?.checked!==false,show_company_email:input('tpShowEmail')?.checked!==false,show_company_phone:input('tpShowPhone')?.checked!==false,default_invoice:defaultInvoice,default_proforma:defaultProforma,invoice_title:val('tpInvoiceTitle').trim()||'FACTURA',proforma_title:val('tpProformaTitle').trim()||'FACTURA PROFORMA',header_text:val('tpHeader').trim(),footer_text:val('tpFooter').trim(),notes_default:val('tpNotes').trim(),payment_terms_default:val('tpTerms').trim(),bank_details:val('tpBank').trim(),logo_path:logoPath,logo_name:logoName,logo_mime:logoMime,logo_size_bytes:logoSize,active:true,updated_at:new Date().toISOString()};
 try{
   await clearOtherTemplateDefaults(id,storeId,{invoice:defaultInvoice,proforma:defaultProforma});
   if(id)await update('ops_document_templates',id,row);else await insert('ops_document_templates',row);
 }catch(e){if(uploadedPath)await removeFile('business-assets',uploadedPath).catch(()=>{});throw e}
 closeModal();await refresh('Plantilla guardada.');
}async function duplicateTemplate(id){
 const src=state.data.templates.find(x=>x.id===id);if(!src)return;
 const copy={...src};delete copy.id;delete copy.created_at;delete copy.updated_at;
 copy.name=src.name+' · copia';copy.code=(src.code+'-COPIA').slice(0,50);copy.default_invoice=false;copy.default_proforma=false;copy.active=true;
 let suffix=2;while(state.data.templates.some(x=>x.code===copy.code&&String(x.store_id||'')===String(copy.store_id||''))){copy.code=(src.code+'-COPIA-'+suffix++).slice(0,50)}
 await insert('ops_document_templates',copy);closeModal();await refresh('Plantilla duplicada.');
}

async function deleteTemplate(id){
 if(!isAdmin())throw new Error('Solo el administrador puede eliminar plantillas.');
 const row=state.data.templates.find(x=>x.id===id);if(!row)return;
 const drafts=state.data.invoices.filter(x=>x.template_id===id&&x.status==='borrador').length;if(drafts)throw new Error('No se puede eliminar: hay '+drafts+' borrador(es) usando esta plantilla.');
 if(!confirm('¿Eliminar esta plantilla?'))return;
 await remove('ops_document_templates',id);
 const logoUsed=row.logo_path&&state.data.invoices.some(x=>x.status!=='borrador'&&(x.template_snapshot?.logo_path===row.logo_path||x.design_snapshot?.logo_path===row.logo_path));
 if(row.logo_path&&!logoUsed)await removeFile('business-assets',row.logo_path).catch(()=>{});
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
 const meta={store_id:storeId,doc_type:val('docType'),document_date:date,supplier_or_customer:val('docParty').trim(),tax_id:val('docTax').trim(),invoice_number:val('docNumber').trim(),category_code:val('docCategory').trim(),status:val('docStatus'),notes:val('docNotes').trim()};
 if(!current&&!file)throw new Error('Selecciona un archivo.');
 let row=current,newPath=null;
 if(!current){
   row=await createStoredDocument(file,{storeId,date,docType:meta.doc_type,status:meta.status,party:meta.supplier_or_customer,taxId:meta.tax_id,number:meta.invoice_number,category:meta.category_code,notes:meta.notes});
 }else if(file){
   const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);const usage=state.data.storageUsage||{},limit=Number(usage.limit_bytes||500*1024*1024),used=Number(usage.total_bytes||0);
   validateDocumentFile(file,{maxBytes:max,usedBytes:used,limitBytes:limit,replacingBytes:Number(current.size_bytes||0)});
   const y=date.slice(0,4),m=date.slice(5,7),storeNameValue=state.data.stores.find(x=>x.id===storeId)?.name||'General';
   newPath=`${y}/${quarterFromDate(date)}/${m}/${safeFileSegment(storeNameValue)}/${safeFileSegment(meta.doc_type)}/${safeFileSegment(meta.supplier_or_customer)}/${crypto.randomUUID()}_${safeFileSegment(file.name)}`;
   await upload('business-documents',newPath,file);
   try{
     row=await update('ops_documents',id,{...meta,storage_path:newPath,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:await fileSha256(file)});
   }catch(err){await removeFile('business-documents',newPath).catch(()=>{});throw err}
   if(current.storage_path&&current.storage_path!==newPath)await removeFile('business-documents',current.storage_path).catch(()=>{});
 }else{
   row=await update('ops_documents',id,meta);
 }
 setView('documentos',{mode:'record',id:row.id});await refresh(current?'Documento actualizado.':'Documento archivado.');
}

// Importación documental por lote solo para staging.
// Los PDF quedan sin tienda ni asociación fiscal hasta que se contraste la factura.
async function importDocumentZip(zipFile){
 if(!zipFile) return;
 if(!window.JSZip) throw new Error('No está disponible el lector ZIP.');
 if(zipFile.size>150*1024*1024) throw new Error('El archivo ZIP supera el máximo de 150 MB.');
 const zip=await window.JSZip.loadAsync(zipFile);
 const entries=Object.values(zip.files).filter(f=>!f.dir&&/\.(pdf|xlsx|docx)$/i.test(f.name)&&!f.name.startsWith('__MACOSX/'));
 if(!entries.length)throw new Error('El ZIP no contiene PDF, Excel o Word admitidos.');
 if(entries.length>500)throw new Error('Máximo 500 documentos por lote.');
 const known=new Set(state.data.documents.map(d=>String(d.notes||'').match(/\[ORIGEN-ZIP:([^\]]+)\]/)?.[1]).filter(Boolean));
 const missing=entries.filter(f=>!known.has(f.name));
 const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);
 const used=Number(state.data.storageUsage?.total_bytes||0),limit=Number(state.data.storageUsage?.limit_bytes||500*1024*1024);
 const estimated=missing.reduce((a,f)=>a+Number(f._data?.uncompressedSize||0),0);
 if(used+estimated>limit)throw new Error('El lote supera el almacenamiento disponible. Elimina otros archivos o utiliza un lote menor.');
 if(!confirm('Se van a importar '+missing.length+' archivos a STAGING como pendientes de clasificar, sin afectar a producción. ¿Continuar?'))return;
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
   const segments=e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
   const folder=Object.keys(months).find(m=>segments.includes(m));
   const fm=folder?months[folder]:null;
   const dm=name.match(/(?:^|[^\d])(\d{1,2})[-._](\d{1,2})[-._](20\d{2})(?:[^\d]|$)/);
   let date=dm&&+dm[1]>=1&&+dm[1]<=31&&+dm[2]>=1&&+dm[2]<=12?`${dm[3]}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`:null;
   if(date&&!Number.isFinite(Date.parse(date)))date=null;
   const provisional=!date;
   date=date||`2026-${String(fm||1).padStart(2,'0')}-01`;
   const reportFile=/gestoria|ingresos|gastos .*gestor|modelo 130|informe/i.test(name)||/\.(xlsx|docx)$/i.test(name);
   const party=name.replace(/\.pdf$/i,'').replace(/\b\d{1,2}[-._]\d{1,2}[-._]20\d\d\b/g,'').trim().slice(0,150);
   const notes=`[ORIGEN-ZIP:${e.name}] ${provisional?'Fecha provisional tomada del mes de carpeta (o enero si no consta). ':''}DOCUMENTO SIN CONCILIAR: confirmar tienda, proveedor, fecha, número de factura, importe e impuestos antes de asociarlo.`;
   const doc=await createStoredDocument(file,{storeId:null,date,docType:reportFile?'informe':'factura_recibida',status:'pendiente',party,notes});
   state.data.documents.push(doc);known.add(e.name);ok++;
  }catch(err){errors.push(name+': '+(err?.message||String(err)))}
  if((i+1)%5===0||i===missing.length-1)report(`Procesados ${i+1}/${missing.length} · Guardados ${ok} · Fallidos ${errors.length} · Ya existentes ${skipped}`);
 }
 await refresh();
 modal('Resultado de importación ZIP',`<div class="stack"><p><b>${ok}</b> documentos guardados; <b>${skipped}</b> duplicados omitidos; <b>${errors.length}</b> errores.</p>${errors.length?'<div class="note">'+esc(errors.slice(0,20).join(' | '))+'</div>':''}<p>Todos los archivos siguen pendientes de revisar y no afectan a los informes fiscales.</p></div>`);
}

async function getDocumentBlob(doc){
 const {data,error}=await sb.storage.from('business-documents').download(doc.storage_path);
 if(error)throw new Error('No se pudo leer el archivo: '+error.message);
 return data;
}
async function downloadDocument(id){
 const d=state.data.documents.find(x=>x.id===id);if(!d)return;

 const blob=await getDocumentBlob(d);download(blob,d.original_name||'documento');
}
async function previewDocument(id){
 const d=state.data.documents.find(x=>x.id===id);if(!d)return;
 const blob=await getDocumentBlob(d),mime=String(d.mime_type||blob.type||'').toLowerCase(),name=String(d.original_name||'').toLowerCase();
 let body='';const kind=previewKind(name,mime);
 if(kind==='pdf'){
   const url=URL.createObjectURL(blob);body=`<iframe class="document-frame" src="${url}" title="${esc(d.original_name||'PDF')}"></iframe>`;
   setTimeout(()=>URL.revokeObjectURL(url),180000);
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
 return state.data.expenses.some(x=>x.document_id===id)||state.data.invoices.some(x=>x.source_document_id===id||x.generated_document_id===id)||state.data.documents.some(x=>x.id===id&&x.linked_entity_id);
}
async function deleteDocument(id){
 if(!can('documentos','delete'))throw new Error('No tienes permiso para eliminar documentos.');
 const d=state.data.documents.find(x=>x.id===id);if(!d)return;
if(!isManager()&&d.uploaded_by!==state.session?.user?.id)throw new Error('Solo puedes eliminar documentos que hayas subido.');
 if(documentIsLinked(id))throw new Error('Este documento está vinculado a otro registro. Quita primero el vínculo desde su ficha.');
 if(!confirm('¿Eliminar definitivamente este documento?'))return;
 await remove('ops_documents',id);if(d.storage_path)await removeFile('business-documents',d.storage_path).catch(()=>{});
 resetView('documentos');await refresh('Documento eliminado.');
}
async function zipFilteredDocuments(){
 const f=getFilters('documentos'),status=f.status||'all',type=f.type||'all';
 const rows=state.data.documents.filter(x=>(!f.from||String(x.document_date||x.created_at).slice(0,10)>=f.from)&&(!f.to||String(x.document_date||x.created_at).slice(0,10)<=f.to)&&(f.store==='all'||x.store_id===f.store)&&(status==='all'||x.status===status)&&(type==='all'||x.doc_type===type)&&(!f.query||[x.original_name,x.supplier_or_customer,x.invoice_number,x.doc_type].join(' ').toLowerCase().includes(f.query.toLowerCase())));
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
  ${formField('Tienda / centro','usStore',row?.store||'')}
  <label class="wide">Notas<textarea id="usNotes" rows="3">${esc(row?.employee_notes||'')}</textarea></label>
  ${row?formField('Nueva contraseña (opcional)','usPassword','','password','minlength="8"'):formField('Contraseña inicial','usPassword','','password','minlength="8"')}
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
 if(email){
   const current=state.data.team.find(x=>x.email===email);
   await invokeTeam({action:'update_member',...payload,active:current?.active!==false});
   if(current&&current.role!==payload.role){
    const {error:permissionError}=await sb.from('ops_user_permissions').delete().eq('email',email);
    if(permissionError)throw new Error('Se cambió el rol, pero no se pudieron restablecer los permisos anteriores: '+permissionError.message);
   }
   if(password){if(password.length<8)throw new Error('La contraseña debe tener al menos 8 caracteres.');await invokeTeam({action:'set_password',email,password,full_name:payload.full_name,role:payload.role})}
 }else{
   if(password.length<8)throw new Error('La contraseña inicial debe tener al menos 8 caracteres.');
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
 if(!confirm('¿Eliminar definitivamente a '+email+'?'))return;
 const check=prompt('Escribe ELIMINAR USUARIO para confirmar:');if(check!=='ELIMINAR USUARIO')return;
 await invokeTeam({action:'hard_delete',email});closeModal();await refresh('Usuario eliminado.');
}

function taxPaymentForm(model,year,quarter,row=null){
 const body=`<div class="form-grid">
  ${formField('Modelo','txModel',model,'text','disabled')}
  ${formField('Año','txYear',year,'number','disabled')}
  ${formField('Trimestre','txQuarter',quarter,'number','disabled')}
  ${selectField('Estado','txStatus',[{value:'previsto',label:'Previsto'},{value:'pagado',label:'Pagado'},{value:'compensado',label:'Compensado'}],row?.status||'pagado')}
  ${formField('Fecha de pago','txDate',row?.payment_date||isoToday(),'date')}
  ${formField('Importe','txAmount',row?.amount??'','number','step="0.01" min="0"')}
  <label class="wide">Notas<textarea id="txNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="form-actions">${row?btn('Eliminar','tax-payment-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar','tax-payment-save','primary',`data-model="${model}" data-year="${year}" data-quarter="${quarter}" ${row?`data-id="${row.id}"`:''}`)}</div>`;
 modal(`Modelo ${model} · ${quarter}T ${year}`,body,{small:true});
}
async function saveTaxPayment(id='',model,year,quarter){
 const date=val('txDate')||null;if(date&&date>isoToday())throw new Error('La fecha de pago no puede ser futura.');
 const row={tax_type:model,fiscal_year:Number(year),quarter:Number(quarter),period_label:`${quarter}T ${year}`,payment_date:date,amount:Math.max(0,num('txAmount')),status:val('txStatus'),notes:val('txNotes').trim(),created_by:state.user?.id||null};
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
 const row={store_id:val('faStore')||null,adjustment_date:date,kind:val('faKind'),amount:Math.max(0,num('faAmount')),description:required('faDescription','Descripción'),document_id:null,created_by:state.user?.id||null};
 if(id)await update('ops_fiscal_adjustments',id,row);else await insert('ops_fiscal_adjustments',row);closeModal();await refresh('Ajuste fiscal guardado.');
}
async function deleteFiscalAdjustment(id){if(!confirm('¿Eliminar este ajuste fiscal?'))return;await remove('ops_fiscal_adjustments',id);closeModal();await refresh('Ajuste eliminado.')}
function setFiscalQuarter(year,q){
 const from=`${year}-${String((q-1)*3+1).padStart(2,'0')}-01`,to=`${year}-${String(q*3).padStart(2,'0')}-${String(new Date(year,q*3,0).getDate()).padStart(2,'0')}`;patchFilters('fiscalidad',{from,to});render();
}

async function downloadBackup(){
 if(!isAdmin())throw new Error('Solo el administrador puede crear copias completas.');
 toast('Preparando copia completa…');
 const out=await createBackup();
 toast('Copia creada: '+(out.size/1024/1024).toFixed(1).replace('.',',')+' MB','ok');
}
async function verifyBackupFromInput(){
 if(!isAdmin())throw new Error('Solo el administrador puede comprobar copias.');
 const file=input('backupFile')?.files?.[0];
 if(!file)throw new Error('Selecciona una copia antes de comprobarla.');
 const result=await inspectBackup(file);
 const rows=Object.values(result.database).reduce((a,entries)=>a+(Array.isArray(entries)?entries.length:0),0);
 const files=Object.values(result.manifest.storage||{}).reduce((a,entries)=>a+(Array.isArray(entries)?entries.length:0),0);
 modal('Comprobación de copia',`<div class="stack"><div class="note">Integridad validada. No se ha modificado ningún dato.</div><p>Versión: <b>${esc(result.manifest.version)}</b></p><p>Registros de negocio: <b>${rows}</b></p><p>Archivos: <b>${files}</b></p><div class="note warn">Validar la copia no significa que se pueda restaurar aún. La restauración sigue bloqueada por seguridad.</div></div>`);
}

async function saveConfig(){
 if(!isAdmin())throw new Error('Solo el administrador puede cambiar la configuración.');
 const current={...(state.data.settings||{})},patch={updated_at:new Date().toISOString()};
 const setIf=(id,key,transform=v=>v)=>{const el=input(id);if(el)patch[key]=transform(el.value)};
 setIf('cfgBusiness','business_name',v=>v.trim());setIf('cfgTax','tax_id',v=>v.trim());setIf('cfgAddress','business_address',v=>v.trim());setIf('cfgEmail','business_email',v=>v.trim());setIf('cfgPhone','business_phone',v=>v.trim());
 setIf('cfgVat','default_sales_vat_rate',n);setIf('cfgPurchaseRe','purchase_re_rate',n);setIf('cfgIrpf','irpf_prepayment_rate',n);setIf('cfgDifficultPct','difficult_expense_pct',n);setIf('cfgDifficultCap','difficult_expense_annual_cap',n);setIf('cfgReta','actual_reta_monthly',v=>v===''?null:n(v));setIf('cfgRetaRate','reta_total_rate',n);setIf('cfgRetaDeduction','reta_generic_deduction_pct',n);setIf('cfgMargin','target_operating_margin_pct',n);
 if(input('cfgDifficultEnabled'))patch.difficult_expense_enabled=!!input('cfgDifficultEnabled').checked;if(input('cfgFiscalNotes'))patch.fiscal_notes=val('cfgFiscalNotes').trim();
 await update('ops_business_settings',current.id||1,patch);await refresh('Configuración guardada.');
}

const filterRoute={cajas:'cajas',gastos:'gastos',facturas:'facturacion',documentos:'documentos',fiscal:'fiscalidad',informes:'informes'};
function applyFilter(prefix){
 const route=filterRoute[prefix];if(!route)return;
 const from=val(prefix+'From'),to=val(prefix+'To');if(from&&to&&from>to)throw new Error('La fecha Desde no puede ser posterior a Hasta.');
 const patch={from,to,store:val(prefix+'Store'),query:val(prefix+'Query').trim()};
 if(prefix==='gastos'){patch.kind=val('gastosKind')||'all';patch.paid=val('gastosPaid')||'all'}
 if(prefix==='documentos'){patch.status=val('documentosStatus')||'all';patch.type=val('documentosType')||'all'}
 if(prefix==='informes'){patch.year=Math.max(2020,Math.min(2100,Math.round(num('informesYear')||new Date().getFullYear())))}
 patchFilters(route,patch);render();
}
function thisMonth(prefix){const route=filterRoute[prefix];if(!route)return;const r=monthRange();patchFilters(route,{from:r.from,to:r.to});render()}
function updateHomePrice(){
 const result=quickPriceStudy({cost:val('homePriceCost'),pvp:val('homePricePvp'),competitor:val('homePriceCompetitor'),discount:val('homePriceDiscount'),vat:state.data.settings?.default_sales_vat_rate||21,re:state.data.settings?.purchase_re_rate||5.2});
 const set=(id,text,cls='')=>{const el=document.getElementById(id);if(el){el.textContent=text;el.className=cls}};
 set('homePriceReal',money(result.costReal));
 set('homePriceSale',money(result.finalSale));
 set('homePriceMargin',money(result.margin),result.margin<0?'danger-text':result.marginPct<18?'warn-text':'good-text');
 set('homePriceMarginPct',result.marginPct.toFixed(1).replace('.',',')+' %',result.margin<0?'danger-text':result.marginPct<18?'warn-text':'good-text');
 set('homePriceCompetition',result.competitorDiff==null?'—':((result.competitorDiff>0?'+':'')+money(result.competitorDiff)),result.competitorDiff==null?'':result.competitorDiff>0?'warn-text':'good-text');
}
async function saveHomePrice(){
 const query=required('homePriceQuery','Producto / referencia');
 const r=quickPriceStudy({cost:val('homePriceCost'),pvp:val('homePricePvp'),competitor:val('homePriceCompetitor'),discount:val('homePriceDiscount'),vat:state.data.settings?.default_sales_vat_rate||21,re:state.data.settings?.purchase_re_rate||5.2});
 const row=await insert('consultations',{query,cost_net:r.cost,pvp:r.pvp,competitor:r.competitor,discount:r.discount,cost_real:r.costReal,final_sale:r.finalSale,margin:r.margin,margin_pct:r.marginPct,created_by:state.user?.id||null,last_reopened_at:null,updated_at:new Date().toISOString()});
 await insert('consultation_history',{consultation_id:row.id,user_id:state.user?.id||null,action:'CREADO_DESDE_INICIO',consultation_query:query,snapshot:row}).catch(()=>{});
 await refresh('Consulta guardada.');
}
function homeReport(kind){
 const now=isoToday(),year=Number(now.slice(0,4)),month=Number(now.slice(5,7)),q=Math.ceil(month/3);
 if(kind==='quarter'){const from=`${year}-${String((q-1)*3+1).padStart(2,'0')}-01`,to=`${year}-${String(q*3).padStart(2,'0')}-${String(new Date(year,q*3,0).getDate()).padStart(2,'0')}`;patchFilters('informes',{from,to,year});}
 else patchFilters('informes',{from:`${year}-01-01`,to:`${year}-12-31`,year});
 setRoute('informes');render();
}
function openAdminSection(section){setView('administracion',{section});setRoute('administracion');render();}

function sheetPreviewTable(sheet){
 const range=window.XLSX.utils.decode_range(sheet['!ref']||'A1');
 const visible={s:range.s,e:{r:Math.min(range.e.r,range.s.r+199),c:Math.min(range.e.c,range.s.c+29)}};
 const rows=window.XLSX.utils.sheet_to_json(sheet,{header:1,range:window.XLSX.utils.encode_range(visible),raw:false,defval:''});
 const html=rows.map(row=>`<tr>${(Array.isArray(row)?row:[row]).map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
 const truncated=range.e.r>visible.e.r||range.e.c>visible.e.c;
 return `<table class="data-table"><tbody>${html}</tbody></table>${truncated?'<div class="note">Vista parcial: se muestran hasta 200 filas y 30 columnas. Descarga el archivo para consultar todo.</div>':''}`;
}
function previewWorkbookExact(wb,title,downloadButton){
 const sheets=wb.SheetNames.map((sheetName,i)=>`<details ${i===0?'open':''}><summary>${esc(sheetName)}</summary><div class="excel-preview-sheet">${sheetPreviewTable(wb.Sheets[sheetName])}</div></details>`).join('');
 modal(title,`<div class="stack"><div class="note">Vista de todas las hojas del mismo libro que genera la descarga. La representación web no conserva necesariamente colores, bordes o anchuras de Excel.</div><div class="excel-preview">${sheets}</div><div class="form-actions">${downloadButton}</div></div>`);
}
function reportStorePreview(storeId,year){
 const store=state.data.stores.find(x=>x.id===storeId);if(!store)return;
 const wb=buildStoreAnnualWorkbook({store,year,closings:state.data.closings,expenses:state.data.expenses,categories:state.data.categories});
 previewWorkbookExact(wb,`${store.name} · ${year}`,btn('Descargar Excel','export-store-book','primary',`data-store="${storeId}" data-year="${year}"`));
}
function reportGestorPreview(year){
 const wb=buildGestorWorkbook(reportArgs(year));
 previewWorkbookExact(wb,`Libro de gestoría · ${year}`,btn('Descargar libro gestor','export-gestor-book','primary',`data-year="${year}"`));
}
function reportArgs(year){
 return {year,onlyPeriodsWithData:year===2026,settings:state.data.settings,stores:state.data.stores,closings:state.data.closings,expenses:state.data.expenses,expenseLines:state.data.expenseLines,invoices:state.data.invoices,fiscalAdjustments:state.data.fiscalAdjustments,incomeAdjustments:state.data.incomeAdjustments,taxPayments:state.data.taxPayments,categories:state.data.categories};
}
function exportStoreBook(storeId,year){
 const store=state.data.stores.find(x=>x.id===storeId);if(!store)throw new Error('Establecimiento no encontrado.');
 exportStoreAnnualWorkbook({store,year,closings:state.data.closings,expenses:state.data.expenses,categories:state.data.categories});
}
async function exportGestorPackage(year){
 const zip=new window.JSZip(),args=reportArgs(year),stores=state.data.stores.filter(x=>x.active!==false);
 const ingresos=zip.folder('01_INGRESOS'),gastos=zip.folder('02_GASTOS'),diarios=zip.folder('03_DIARIOS'),resumen=zip.folder('04_RESUMEN'),docs=zip.folder('05_DOCUMENTOS');
 const incomeRows=[
  ...state.data.closings.filter(x=>x.include_in_income!==false&&String(x.business_date).startsWith(String(year))).map(x=>[fmtDate(x.business_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'','Cierre',n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),x.notes||'']),
  ...state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&String(x.issue_date).startsWith(String(year))).map(x=>[fmtDate(x.issue_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'','Factura adicional',n(x.total_amount),x.display_number||x.external_number_text||'']),
  ...state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&String(x.adjustment_date).startsWith(String(year))).map(x=>[fmtDate(x.adjustment_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'General','Ajuste de ingreso',n(x.amount),x.description||'']),
  ...state.data.incomeAdjustments.filter(x=>String(x.income_date).startsWith(String(year))).map(x=>[fmtDate(x.income_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'General','Ingreso manual',n(x.amount),x.concept||''])
 ].sort((a,b)=>{const key=d=>String(d||'').split('/').reverse().join('-');return key(a[0]).localeCompare(key(b[0]))});
 const incomeCsv=csv(incomeRows,['Fecha','Tienda','Origen','Importe','Detalle'].map((label,i)=>({label,get:r=>r[i]})));ingresos.file(`Ingresos_${year}.csv`,incomeCsv);
 const gestor=buildGestorWorkbook(args);gastos.file(`Libros_gestor_y_auditoria_${year}_Totus.xlsx`,workbookBlob(gestor));
 for(const store of stores){const wb=buildStoreAnnualWorkbook({store,year,closings:state.data.closings,expenses:state.data.expenses,categories:state.data.categories});diarios.file(`Gastos y ventas ${safeFileSegment(store.name)} ${year}.xlsx`,workbookBlob(wb))}
 const yearClosings=state.data.closings.filter(x=>x.include_in_income!==false&&String(x.business_date).startsWith(String(year))),yearExpenses=state.data.expenses.filter(x=>String(x.expense_date).startsWith(String(year)));
 const yearInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&String(x.issue_date).startsWith(String(year)));
 const yearAdjustments=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&String(x.adjustment_date).startsWith(String(year)));
 const sales=yearClosings.reduce((v,x)=>v+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0)+yearInvoices.reduce((v,x)=>v+n(x.total_amount),0)+yearAdjustments.reduce((v,x)=>v+n(x.amount),0)+state.data.incomeAdjustments.filter(x=>String(x.income_date).startsWith(String(year))).reduce((v,x)=>v+n(x.amount),0),accounting=yearExpenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false).reduce((v,x)=>v+n(x.accounting_amount||x.gross_expense||x.amount_paid),0),internal=yearExpenses.filter(x=>x.management_only).reduce((v,x)=>v+n(x.accounting_amount||x.gross_expense||x.amount_paid),0);
 resumen.file(`Resumen_${year}.csv`,`Concepto;Importe\nVentas;${sales.toFixed(2)}\nGastos fiscales revisados;${accounting.toFixed(2)}\nGastos internos;${internal.toFixed(2)}\nResultado real;${(sales-accounting-internal).toFixed(2)}\n`);
 const yearDocs=state.data.documents.filter(x=>String(x.document_date||x.created_at).startsWith(String(year)));
 const usedPaths=new Set(),manifest=[];
 for(const d of yearDocs){
  try{
   const blob=await getDocumentBlob(d);
   const archivePath=uniqueArchiveDocumentPath(d,usedPaths);
   docs.file(archivePath,blob);
   manifest.push([d.id,d.document_date||'',state.data.stores.find(x=>x.id===d.store_id)?.name||'General',d.doc_type||'',d.supplier_or_customer||'',d.original_name||'',archivePath,d.sha256||'',Number(d.size_bytes||blob.size||0)]);
  }catch(e){throw new Error('No se pudo incluir '+(d.original_name||'documento')+' en el ZIP: '+e.message)}
 }
 if(manifest.length!==yearDocs.length||usedPaths.size!==yearDocs.length)throw new Error('Error de integridad: faltan documentos en el paquete.');
 docs.file('Indice_documentos_'+year+'.csv',csv(manifest,['ID','Fecha','Tienda','Tipo','Proveedor / cliente','Archivo original','Ruta ZIP','SHA256','Tamaño bytes'].map((label,i)=>({label,get:r=>r[i]}))));
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});download(blob,`Paquete_gestor_${year}.zip`);
}
function exportRows(type){
 const f=getFilters('informes');
 if(!f.from||!f.to)throw new Error('Selecciona Desde y Hasta.');
 const closings=state.data.closings.filter(x=>x.business_date>=f.from&&x.business_date<=f.to&&(f.store==='all'||x.store_id===f.store));
 const expenses=state.data.expenses.filter(x=>x.expense_date>=f.from&&x.expense_date<=f.to&&(f.store==='all'||x.store_id===f.store));
 const stores=state.data.stores.filter(x=>f.store==='all'||x.id===f.store);
 if(type==='closings')return exportClosingsWorkbook({closings,closingDrawers:state.data.closingDrawers.filter(d=>closings.some(c=>c.id===d.closing_id)),stores:state.data.stores,drawers:state.data.drawers,from:f.from,to:f.to});
 if(type==='expenses')return exportExpensesWorkbook({expenses,stores:state.data.stores,from:f.from,to:f.to});
 const invoices=state.data.invoices.filter(x=>x.issue_date>=f.from&&x.issue_date<=f.to&&(f.store==='all'||x.store_id===f.store));
 const fiscalAdjustments=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&x.adjustment_date>=f.from&&x.adjustment_date<=f.to&&(f.store==='all'||x.store_id===f.store));
 const incomeAdjustments=state.data.incomeAdjustments.filter(x=>x.income_date>=f.from&&x.income_date<=f.to&&(f.store==='all'||x.store_id===f.store));
 return exportSummaryWorkbook({closings,expenses,stores,invoices,fiscalAdjustments,incomeAdjustments,from:f.from,to:f.to});
}

document.addEventListener('click',async e=>{
 const el=actionEl(e);if(!el)return;
 const route=el.dataset.route;if(route){if(!can(route,'view'))throw new Error('No tienes permiso para acceder a esta sección.');setRoute(route);document.body.classList.remove('menu-open');render();return}
 const a=el.dataset.action;if(!a)return;
 if(!checkActionPermission(a,el)){toast('No tienes permiso para esta operación.','bad');return}
 try{
  if(a.endsWith('-save')||a==='closing-save-close'||a==='closing-save-draft')validateDecimalFields();
  if(a==='retry-load'){await refresh();return}
  if(a==='logout'){await logout();location.reload();return}
  if(a==='toggle-menu'){document.body.classList.toggle('menu-open');return}
  if(a==='close-modal'){if(el.classList.contains('modal-backdrop')&&e.target!==el)return;closeModal();return}
  if(a==='role-bulk-apply'){const preset=val('roleBulkPreset');for(const [module] of PERMISSION_MODULES){setRoleModulePreset(module,preset);const select=input('rolepreset_'+module);if(select&&!select.disabled)select.value=preset}return}
  if(a.endsWith('-apply')){applyFilter(a.replace('-apply',''));return}
  if(a.endsWith('-month')){thisMonth(a.replace('-month',''));return}
  if(a==='pricing-search'){patchFilters('pricing',{query:val('pricingQuery').trim()});render();return}
  if(a==='home-price-save'){await saveHomePrice();return}
  if(a==='home-report-quarter'){homeReport('quarter');return}
  if(a==='home-report-year'){homeReport('year');return}
  if(a==='admin-storage-home'){openAdminSection('storage');return}
  if(a==='admin-users-home'){openAdminSection('usuarios');return}
  if(a==='closing-new'){setView('cajas',{mode:'record',id:null,storeId:el.dataset.store||null});setRoute('cajas');render();return}
  if(a==='closing-edit'){setView('cajas',{mode:'record',id:el.dataset.id});render();return}
  if(a==='closing-save-draft'){await saveClosing(el.dataset.id||'','borrador');return}
  if(a==='closing-save-close'){await saveClosing(el.dataset.id||'','cerrado');return}
  if(a==='closing-reopen'){await reopenClosing(el.dataset.id);return}
  if(a==='closing-back'){resetView('cajas');render();return}
  if(a==='export-closings-current'){exportCurrentModule('cajas');return}
  if(a==='closing-delete'){await deleteClosing(el.dataset.id);return}
  if(a==='expense-suppliers'){expenseSuppliersManager();return}
  if(a==='expense-supplier-new'){expenseSupplierForm();return}
  if(a==='expense-supplier-edit'){expenseSupplierForm(state.data.suppliers.find(x=>x.id===el.dataset.id));return}
  if(a==='expense-supplier-save'){await saveExpenseSupplier(el.dataset.id||'');return}
  if(a==='expense-supplier-delete'){await deleteExpenseSupplier(el.dataset.id);return}
  if(a==='expense-new'){setView('gastos',{mode:'record',id:null});setRoute('gastos');render();return}
  if(a==='expense-edit'){setView('gastos',{mode:'record',id:el.dataset.id});render();return}
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
  if(a==='rectifying-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'rectifying',origin:'totus'});render();return}
  if(a==='external-invoice-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'invoice',origin:'externa'});render();return}
  if(a==='invoice-edit'||a==='invoice-open'){const row=state.data.invoices.find(x=>x.id===el.dataset.id);if(row){setView('facturacion',{mode:'record',id:row.id,docType:row.document_type,invoiceKind:row.invoice_kind,origin:row.origin});render()}return}
  if(a==='invoice-save'){await saveInvoice(el.dataset.id||'',el.dataset.type||'factura',el.dataset.kind||'invoice',el.dataset.origin||'totus');return}
  if(a==='invoice-back'){setView('facturacion',{mode:'list',id:null});render();return}
  if(a==='billing-section'){setView('facturacion',{mode:'list',id:null,section:el.dataset.section||'documentos'});render();return}
  if(a==='invoice-source-preview'){await previewDocument(el.dataset.id);return}
  if(a==='invoice-source-download'){await downloadDocument(el.dataset.id);return}
  if(a==='invoice-finalize'){await finalizeInvoice(el.dataset.id);return}
  if(a==='invoice-payment-save'){await saveInvoicePayment(el.dataset.id);return}
  if(a==='invoice-line-add'){addInvoiceLine();return}
  if(a==='invoice-line-remove'){removeInvoiceLine(el.dataset.index);return}
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
  if(a==='admin-section'){setView('administracion',{section:el.dataset.section||'usuarios'});render();return}
  if(a==='backup-create'){await downloadBackup();return}
  if(a==='backup-verify'){await verifyBackupFromInput();return}
  if(a==='fiscal-quarter'){setFiscalQuarter(Number(el.dataset.year),Number(el.dataset.quarter));return}
  if(a==='tax-payment-edit'){const row=el.dataset.id?state.data.taxPayments.find(x=>x.id===el.dataset.id):null;taxPaymentForm(el.dataset.model,Number(el.dataset.year),Number(el.dataset.quarter),row);return}
  if(a==='tax-payment-save'){await saveTaxPayment(el.dataset.id||'',el.dataset.model,Number(el.dataset.year),Number(el.dataset.quarter));return}
  if(a==='tax-payment-delete'){await deleteTaxPayment(el.dataset.id);return}
  if(a==='fiscal-adjustment-new'){fiscalAdjustmentForm();return}
  if(a==='fiscal-adjustment-edit'){fiscalAdjustmentForm(state.data.fiscalAdjustments.find(x=>x.id===el.dataset.id));return}
  if(a==='fiscal-adjustment-save'){await saveFiscalAdjustment(el.dataset.id||'');return}
  if(a==='fiscal-adjustment-delete'){await deleteFiscalAdjustment(el.dataset.id);return}
  if(a==='export-closings'){exportRows('closings');return}
  if(a==='export-expenses'){exportRows('expenses');return}
  if(a==='export-summary'){exportRows('summary');return}
  if(a==='report-store-preview'){reportStorePreview(el.dataset.store,Number(el.dataset.year));return}
  if(a==='report-gestor-preview'){reportGestorPreview(Number(el.dataset.year));return}
  if(a==='export-store-book'){exportStoreBook(el.dataset.store,Number(el.dataset.year));return}
  if(a==='export-gestor-book'){exportGestorWorkbook(reportArgs(Number(el.dataset.year)));return}
  if(a==='export-gestor-package'){await exportGestorPackage(Number(el.dataset.year));return}
 }catch(err){if(err.name!=='ValidationError')console.error(err);toast(err.message||String(err),'bad')}
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
 if(id.startsWith('exLine'))updateExpenseSummary();
 if(id.startsWith('ivQty_')||id.startsWith('ivUnit_')||id.startsWith('ivDisc_')||id.startsWith('ivVat_'))updateInvoiceSummary();
});

document.addEventListener('change',e=>{
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
 if(e.target?.id==='clStore'&&getView('cajas').mode==='record'&&!getView('cajas').id){setView('cajas',{mode:'record',id:null,storeId:e.target.value,date:val('clDate')||isoToday()});render();return}
 if(e.target?.id==='clDate'&&getView('cajas').mode==='record'&&!getView('cajas').id){setView('cajas',{mode:'record',id:null,storeId:val('clStore'),date:e.target.value||isoToday()});render();return}
 if(e.target?.id==='ivStore'&&getView('facturacion').mode==='record'&&!getView('facturacion').id){setView('facturacion',{storeId:e.target.value});render();return}
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
 if(password.length<8){message.textContent='Utiliza al menos 8 caracteres.';return}
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
 const [team,profiles]=await Promise.all([
  sb.from('team_members').select('*').eq('email',session.user.email.toLowerCase()).maybeSingle(),
  sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle()
 ]);
 if(team.error)throw new Error('No se pudo comprobar el acceso: '+team.error.message);
 if(profiles.error)throw new Error('No se pudo cargar el perfil: '+profiles.error.message);
 const member=team.data;if(!member||member.active===false){await logout();throw new Error('Tu usuario no tiene acceso activo.')}
 if(!profiles.data&&member.role==='admin')await insert('profiles',{id:session.user.id,email:session.user.email.toLowerCase(),full_name:member.full_name,role:member.role,active:true});
 state.user={...member,id:profiles.data?.id||session.user.id};
 $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
 await refresh();
}
sb.auth.onAuthStateChange((event,session)=>{state.session=session;if(event==='PASSWORD_RECOVERY'){showPasswordRecovery();return}if(event==='SIGNED_OUT'){state.user=null;$('#app').classList.add('hidden');$('#login').classList.remove('hidden')}});

boot().catch(e=>{$('#loginMessage').textContent=e.message;$('#login').classList.remove('hidden');$('#app').classList.add('hidden')});
