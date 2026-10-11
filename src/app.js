import {ROUTES} from './config.js';
import {state,isAdmin,isManager,getFilters,patchFilters,setRoute,getView,setView,resetView} from './state.js';
import {sb,login,logout,recover,loadCore,rpc,insert,update,remove,invokeTeam,upload,signedUrl,removeFile} from './api.js';
import {renderers,invoiceLineRow,expenseLineRow,invoicePreview,productModal} from './pages/main.js';
import {setHeader,closeModal,toast,modal,btn,formField,selectField} from './components.js';
import {$,monthRange,n,isoToday,fmtDate,esc,download} from './utils.js';
import {exportClosingsWorkbook,exportExpensesWorkbook,exportSummaryWorkbook,exportStoreAnnualWorkbook,exportGestorWorkbook,buildStoreAnnualWorkbook,buildGestorWorkbook,workbookBlob} from './excel.js';
import {createBackup,inspectBackup,restoreBackup} from './backup.js';

const titles={
 inicio:['General','Inicio'],pricing:['Trabajo','Pricing'],cajas:['Trabajo','Cajas'],gastos:['Trabajo','Gastos'],
 facturacion:['Trabajo','Facturación'],documentos:['Trabajo','Documentos'],fiscalidad:['Control','Fiscalidad'],
 informes:['Control','Informes'],administracion:['Sistema','Administración']
};

function routeAllowed(r){
 if(r.admin&&!isAdmin())return false;
 if(r.manager&&!isManager())return false;
 return true;
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
 renderNav();
 const [eye,title]=titles[state.route]||['Totus Central',''];
 setHeader(eye,title);
 const renderer=renderers[state.route]||renderers.inicio;
 $('#content').innerHTML=renderer();
 $('#userCard').innerHTML=`<b>${esc(state.user.full_name||state.user.email)}</b><span>${esc(state.user.role||'usuario')}</span>`;
}
async function refresh(message=''){
 state.loading=true;
 try{await loadCore();if(message)toast(message,'ok');render()}
 catch(e){console.error(e);toast(e.message,'bad')}
 finally{state.loading=false}
}
function input(id){return document.getElementById(id)}
function val(id){return input(id)?.value??''}
function required(id,label){const v=val(id).trim();if(!v)throw new Error(`${label} es obligatorio.`);return v}
function num(id){return n(val(id))}
function actionEl(e){return e.target.closest('[data-action],[data-route]')}

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

function safeSegment(v){return String(v||'sin_dato').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'sin_dato'}
async function fileSha256(file){const buf=await file.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function quarterFromDate(date){const m=Number(String(date).slice(5,7));return 'T'+Math.ceil(m/3)}
async function createStoredDocument(file,{storeId=null,date,docType='otro',status='pendiente',party='',taxId='',number='',category='',notes='',linkedType=null,linkedId=null}={}){
 const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);
 if(file.size>max)throw new Error('El archivo supera el máximo de '+Math.round(max/1024/1024)+' MB.');
 const usage=state.data.storageUsage||{},limit=Number(usage.limit_bytes||500*1024*1024),used=Number(usage.total_bytes||0);
 if(used+file.size>limit)throw new Error('No hay espacio suficiente en Storage para este archivo.');
 const y=String(date).slice(0,4),m=String(date).slice(5,7),storeNameValue=state.data.stores.find(s=>s.id===storeId)?.name||'General';
 const path=`${y}/${quarterFromDate(date)}/${m}/${safeSegment(storeNameValue)}/${safeSegment(docType)}/${safeSegment(party)}/${crypto.randomUUID()}_${safeSegment(file.name)}`;
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
 const paidStatus=val('exPaidStatus')||'pagado',paidDate=val('exPaidDate')||null;
 if(paidDate&&paidDate>isoToday())throw new Error('La fecha de pago no puede ser futura.');
 const lineEls=[...document.querySelectorAll('.expense-line')];
 if(!lineEls.length)throw new Error('Añade al menos un concepto.');
 const lines=lineEls.map((el,i)=>{
   const ix=el.dataset.lineIndex,base=Math.max(0,n(val(`exLineBase_${ix}`))),vat=Math.max(0,n(val(`exLineVat_${ix}`))),re=Math.max(0,n(val(`exLineRe_${ix}`))),wh=Math.max(0,n(val(`exLineWh_${ix}`))),dedPct=Math.min(100,Math.max(0,n(val(`exLineDedPct_${ix}`))));
   const description=required(`exLineDesc_${ix}`,`Descripción de la línea ${i+1}`);
   return {sort_order:(i+1)*10,category_id:val(`exLineCategory_${ix}`)||null,description,base_amount:base,vat_rate:vat,vat_amount:0,re_base:0,re_rate:re,re_amount:0,irpf_imputable:0,withholding_base:0,withholding_rate:wh,withholding_amount:0,withholding_model:val(`exLineModel_${ix}`)||null,deductible_irpf:!!input(`exLineDed_${ix}`)?.checked,deductible_pct:dedPct,fixed_asset:!!input(`exLineFixed_${ix}`)?.checked,amortization_years:val(`exLineAmort_${ix}`)===''?null:n(val(`exLineAmort_${ix}`)),notes:''};
 });
 const current=id?state.data.expenses.find(x=>x.id===id):null,oldDoc=current?.document_id?state.data.documents.find(x=>x.id===current.document_id):null;
 const file=input('exFile')?.files?.[0]||null;
 let newDoc=null,documentId=oldDoc?.id||null;
 if(file){
   newDoc=await createStoredDocument(file,{storeId,date,docType:'factura_recibida',status:paidStatus==='pagado'?'pagada':'pendiente',party:supplier,taxId,number:invoiceNumber,category:'gasto',notes:'Justificante de gasto',linkedType:'expense'});
   documentId=newDoc.id;
 }
 const total=lines.reduce((acc,l)=>acc+l.base_amount+l.base_amount*l.vat_rate/100+l.base_amount*l.re_rate/100-l.base_amount*l.withholding_rate/100,0);
 const amountPaid=val('exPaidAmount')===''?(paidStatus==='pagado'?total:0):Math.max(0,num('exPaidAmount'));
 if(paidStatus==='pagado'&&Math.abs(amountPaid-total)>.02)throw new Error('Si el gasto está pagado, el importe pagado debe coincidir con el total.');
 if(paidStatus==='pendiente'&&amountPaid>0)throw new Error('Un gasto pendiente no puede tener importe pagado.');
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
 const current=id?state.data.invoices.find(x=>x.id===id):null;
 const oldSource=current?.source_document_id?state.data.documents.find(x=>x.id===current.source_document_id):null;
 let sourceDoc=oldSource||null,newSource=null;
 if(origin==='externa'){
   const sourceFile=input('ivSourceFile')?.files?.[0]||null;
   if(sourceFile)newSource=await createStoredDocument(sourceFile,{storeId:required('ivStore','Tienda'),date:issue,docType:'factura_emitida',status:'archivada',party:customerName,taxId:customerTax,number:val('ivExternalNumber').trim(),category:'facturacion',notes:'Original de factura externa',linkedType:'sales_invoice'});
   sourceDoc=newSource||oldSource;
   if(!sourceDoc)throw new Error('La factura externa exige el archivo original.');
   if(!val('ivExternalNumber').trim())throw new Error('Indica el número de la factura externa.');
 }
 const isProforma=type==='proforma';
 const paidStatus=isProforma?'pendiente':(val('ivPaidStatus')||'pendiente'),paidAmount=isProforma?0:Math.max(0,num('ivPaidAmount'));if(paidStatus==='pendiente'&&paidAmount>0)throw new Error('Un documento pendiente no puede tener importe cobrado.');if(paidStatus==='pagada'&&!paidDate)throw new Error('Indica la fecha de cobro.');
 const doc={id:id||null,series_id:required('ivSeries','Serie'),store_id:required('ivStore','Tienda'),issue_date:issue,due_date:due,operation_date:operation,origin,document_type:type,invoice_kind:isProforma?'invoice':invoiceKind,customer_id:customerId,customer_name:customerName,customer_tax_id:customerTax,customer_address:val('ivAddress').trim(),customer_email:val('ivEmail').trim(),concept:val('ivConcept').trim(),payment_method:val('ivPayment'),paid_status:paidStatus,paid_date:isProforma?null:paidDate,paid_amount:paidAmount,include_in_income:isProforma?false:!!input('ivIncludeIncome')?.checked,template_id:val('ivTemplate')||null,purchase_order_ref:val('ivPO').trim(),terms_text:val('ivTerms').trim(),footer_text:val('ivFooter').trim(),notes:val('ivNotes').trim(),source_document_id:sourceDoc?.id||null,external_number_text:origin==='externa'?val('ivExternalNumber').trim():''};
 let savedId;
 try{savedId=await rpc('totus_save_sales_document',{p_document:doc,p_lines:lines})}
 catch(e){if(newSource)await destroyDocument(newSource).catch(()=>{});throw e}
 if(newSource){await update('ops_documents',newSource.id,{linked_entity_id:savedId});if(oldSource&&oldSource.id!==newSource.id)await destroyDocument(oldSource).catch(()=>{})}
 setView('facturacion',{mode:'record',id:savedId,docType:type,invoiceKind:doc.invoice_kind,origin});
 await refresh(isProforma?'Proforma guardada.':'Documento guardado.');
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
 const row={name:required('prName','Nombre'),sku:required('prSku','Referencia'),family_id:val('prFamily')||null,product_type:val('prType'),current_pvp:num('prPvp')||null,proposed_pvp:num('prProposed')||null,units_month:Math.max(0,Math.round(num('prUnits'))),status:val('prStatus')||'PENDIENTE',notes:val('prNotes').trim(),updated_at:new Date().toISOString()};
 let saved;
 if(id)saved=await update('products',id,row);else saved=await insert('products',{...row,created_by:state.user?.id||null});
 closeModal();await refresh('Producto guardado.');
 if(!id&&saved?.id)productModal(state.data.products.find(x=>x.id===saved.id)||saved);
}
async function deleteProduct(id){
 const p=state.data.products.find(x=>x.id===id);if(!p)return;
 if(!confirm('¿Eliminar el producto '+p.name+' y todos sus precios, variantes e histórico?'))return;
 const check=prompt('Escribe ELIMINAR PRODUCTO para confirmar:');if(check!=='ELIMINAR PRODUCTO')return;
 await remove('products',id);closeModal();await refresh('Producto eliminado.');
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
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v)};
 set('exSumBase',base);set('exSumVat',vat);set('exSumRe',re);set('exSumWh',wh);set('exSumTotal',base+vat+re-wh);
}
function updateClosingSummary(){
 const rows=[...document.querySelectorAll('.drawer-entry')];let total=0;
 for(const el of rows){const d=el.dataset.drawerId,read=s=>n(document.getElementById(`dr${s}_${d}`)?.value||0);const cash=read('Close')+read('Withdraw')+read('CashExpense')+read('ExtraOut')-read('ExtraIn')-read('Open');total+=cash+read('Card')+read('Bizum')+read('Online')+read('Other')}
 const reported=val('clReported')===''?null:num('clReported'),diff=reported==null?0:total-reported,fmt=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);
 const t=document.getElementById('clCalcTotal'),r=document.getElementById('clReportedTotal'),d=document.getElementById('clDifference');if(t)t.textContent=fmt(total);if(r)r.textContent=reported==null?'—':fmt(reported);if(d){d.textContent=fmt(diff);d.className=Math.abs(diff)>.01?'danger-text':'good-text'}
}
function updateInvoiceSummary(){
 let base=0,vat=0;for(const el of document.querySelectorAll('.invoice-line')){const ix=el.dataset.lineIndex,q=n(val(`ivQty_${ix}`)),u=n(val(`ivUnit_${ix}`)),disc=Math.min(100,Math.max(0,n(val(`ivDisc_${ix}`)))),vr=Math.max(0,n(val(`ivVat_${ix}`)));const b=q*u*(1-disc/100);base+=b;vat+=b*vr/100}
 const fmt=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);for(const [id,v] of [['ivSumBase',base],['ivSumVat',vat],['ivSumTotal',base+vat]]){const el=document.getElementById(id);if(el)el.textContent=fmt(v)}
}
function exportCurrentModule(module){
 const f=getFilters(module);
 if(module==='cajas'){
   const closings=state.data.closings.filter(x=>(!f.from||x.business_date>=f.from)&&(!f.to||x.business_date<=f.to)&&(f.store==='all'||x.store_id===f.store));
   return exportClosingsWorkbook({closings,closingDrawers:state.data.closingDrawers.filter(d=>closings.some(c=>c.id===d.closing_id)),stores:state.data.stores,drawers:state.data.drawers,from:f.from,to:f.to});
 }
 const expenses=state.data.expenses.filter(x=>(!f.from||x.expense_date>=f.from)&&(!f.to||x.expense_date<=f.to)&&(f.store==='all'||x.store_id===f.store)&&(f.kind==='all'||!f.kind||(f.kind==='internal'?x.management_only:!x.management_only))&&(f.paid==='all'||!f.paid||x.paid_status===f.paid));
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
 const logo=await invoiceLogoUrl(row);
 const html=invoicePreview(row,logo).replace(/<div class="form-actions">[\s\S]*?<\/div>\s*<\/div>$/,'</div>');
 const w=window.open('','_blank','noopener,noreferrer');if(!w)throw new Error('El navegador ha bloqueado la ventana de impresión.');
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${row.display_number||'Documento'}</title><link rel="stylesheet" href="src/styles.css"><style>body{padding:28px;background:white}.btn,.form-actions{display:none!important}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}
async function convertProforma(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)return;
 const series=state.data.series.filter(s=>s.active!==false&&s.document_type==='factura'&&s.series_kind==='invoice'&&(!s.store_id||s.store_id===row.store_id));
 if(!series.length)throw new Error('No hay serie ordinaria de factura para esta tienda.');
 if(!confirm('¿Convertir esta proforma en factura?'))return;
 await rpc('totus_convert_proforma',{p_id:id,p_invoice_series:series[0].id});
 await refresh('Proforma convertida en factura.');
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
  ${formField('Impuesto especial adicional','ppTax',row?.special_tax_amount??0,'number','step="0.01" min="0"')}
  <label><input id="ppApplyTax" type="checkbox" ${row?.apply_special_tax?'checked':''}> Sumar impuesto especial al coste</label>
  <label><input id="ppSelected" type="checkbox" ${row?.selected?'checked':''}> Proveedor seleccionado</label>
  <label class="wide">Notas<textarea id="ppNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="note">Si el impuesto especial ya está incluido en la factura del proveedor, deja desmarcada la opción de sumarlo.</div>
 <div class="form-actions">${btn('Guardar coste','provider-price-save','primary',`data-product="${productId}" ${row?`data-id="${row.id}"`:''}`)}</div>`;
 modal(row?'Editar coste de proveedor':'Añadir proveedor al producto',body);
}
async function saveProviderPrice(productId,id=''){
 const selected=!!input('ppSelected')?.checked;
 const row={product_id:productId,variant_id:null,provider_id:required('ppProvider','Proveedor'),net_cost:num('ppNet'),provider_discount:Math.min(100,Math.max(0,num('ppDiscount'))),shipping_unit:Math.max(0,num('ppShipping')),moq:Math.max(0,Math.round(num('ppMoq'))),stock_status:val('ppStock').trim(),price_date:isoToday(),notes:val('ppNotes').trim(),selected,purchase_origin:val('ppOrigin').trim()||'España',apply_special_tax:!!input('ppApplyTax')?.checked,special_tax_amount:Math.max(0,num('ppTax'))};
 if(selected){const r=await sb.from('product_provider_prices').update({selected:false}).eq('product_id',productId).is('variant_id',null);if(r.error)throw r.error}
 if(id)await update('product_provider_prices',id,row);else await insert('product_provider_prices',row);
 closeModal();await refresh('Coste de proveedor guardado.');productModal(state.data.products.find(x=>x.id===productId));
}
async function deleteProviderPrice(productId,id){
 if(!confirm('¿Eliminar este coste de proveedor?'))return;
 await remove('product_provider_prices',id);closeModal();await refresh('Coste eliminado.');productModal(state.data.products.find(x=>x.id===productId));
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
 closeModal();await refresh('Competencia guardada.');productModal(state.data.products.find(x=>x.id===productId));
}
async function deleteCompetitor(productId,id){
 if(!confirm('¿Eliminar este precio de competencia?'))return;
 await remove('product_competitor_prices',id);closeModal();await refresh('Competencia eliminada.');productModal(state.data.products.find(x=>x.id===productId));
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
 closeModal();await refresh('Variante guardada.');productModal(state.data.products.find(x=>x.id===productId));
}
async function deleteVariant(productId,id){
 if(!confirm('¿Eliminar esta variante?'))return;
 await remove('product_variants',id);closeModal();await refresh('Variante eliminada.');productModal(state.data.products.find(x=>x.id===productId));
}
async function saveConsultation(){
 const query=required('pqQuery','Consulta'),cost=num('pqCost'),pvp=num('pqPvp'),competitor=num('pqCompetitor'),discount=Math.min(100,Math.max(0,num('pqDiscount')));
 const finalSale=pvp*(1-discount/100),net=finalSale/1.21,margin=net-cost,marginPct=net>0?margin/net*100:0;
 const row=await insert('consultations',{query,cost_net:cost,pvp,competitor,discount,cost_real:cost,final_sale:finalSale,margin,margin_pct:marginPct,created_by:state.user?.id||null,last_reopened_at:null,updated_at:new Date().toISOString()});
 await insert('consultation_history',{consultation_id:row.id,user_id:state.user?.id||null,action:'CREADO',consultation_query:query,snapshot:row}).catch(()=>{});
 await refresh('Consulta guardada.');
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
  ${selectField('Estilo','tpStyle',[{value:'clean',label:'Limpio'},{value:'brand',label:'Corporativo'},{value:'compact',label:'Compacto'}],row?.style||'clean')}
  ${formField('Color principal','tpPrimary',row?.primary_color||'#142231','color')}
  ${formField('Color secundario','tpSecondary',row?.secondary_color||'#3B82F6','color')}
  ${selectField('Posición logo','tpLogoPos',[{value:'left',label:'Izquierda'},{value:'center',label:'Centro'},{value:'right',label:'Derecha'}],row?.logo_position||'left')}
  ${formField('Ancho logo (mm)','tpLogoWidth',row?.logo_width_mm??34,'number','min="10" max="70"')}
  ${formField('Título factura','tpInvoiceTitle',row?.invoice_title||'FACTURA')}
  ${formField('Título proforma','tpProformaTitle',row?.proforma_title||'FACTURA PROFORMA')}
  <label class="wide">Logo<input id="tpLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
  <label class="wide">Cabecera<textarea id="tpHeader" rows="2">${esc(row?.header_text||'')}</textarea></label>
  <label class="wide">Pie<textarea id="tpFooter" rows="2">${esc(row?.footer_text||'')}</textarea></label>
  <label class="wide">Condiciones de pago<textarea id="tpTerms" rows="2">${esc(row?.payment_terms_default||'')}</textarea></label>
  <label><input id="tpShowLogo" type="checkbox" ${row?.show_logo===false?'':'checked'}> Mostrar logo</label>
  <label><input id="tpDefaultInvoice" type="checkbox" ${row?.default_invoice?'checked':''}> Predeterminada factura</label>
  <label><input id="tpDefaultProforma" type="checkbox" ${row?.default_proforma?'checked':''}> Predeterminada proforma</label>
 </div>${row?.logo_name?`<div class="note" style="margin-top:12px">Logo actual: ${esc(row.logo_name)}</div>`:''}
 <div class="form-actions">${btn('Guardar plantilla','template-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar plantilla':'Nueva plantilla',body);
}
async function saveTemplate(id=''){
 const current=id?state.data.templates.find(x=>x.id===id):null;
 const file=input('tpLogo')?.files?.[0]||null;
 if(file&&file.size>5*1024*1024)throw new Error('El logo supera 5 MB.');
 let logoPath=current?.logo_path||null,logoName=current?.logo_name||null,logoMime=current?.logo_mime||null,logoSize=Number(current?.logo_size_bytes||0),uploadedPath=null;
 if(file){
   const ext=(file.name.split('.').pop()||'img').replace(/[^a-z0-9]/gi,'');
   uploadedPath=`logos/${crypto.randomUUID()}.${ext}`;
   await upload('business-assets',uploadedPath,file);
   logoPath=uploadedPath;logoName=file.name;logoMime=file.type;logoSize=file.size;
 }
 const row={name:required('tpName','Nombre'),code:required('tpCode','Código'),store_id:val('tpStore')||null,style:val('tpStyle'),primary_color:val('tpPrimary'),secondary_color:val('tpSecondary'),logo_position:val('tpLogoPos'),logo_width_mm:n(val('tpLogoWidth')),show_logo:input('tpShowLogo')?.checked!==false,default_invoice:!!input('tpDefaultInvoice')?.checked,default_proforma:!!input('tpDefaultProforma')?.checked,invoice_title:val('tpInvoiceTitle').trim(),proforma_title:val('tpProformaTitle').trim(),header_text:val('tpHeader').trim(),footer_text:val('tpFooter').trim(),payment_terms_default:val('tpTerms').trim(),logo_path:logoPath,logo_name:logoName,logo_mime:logoMime,logo_size_bytes:logoSize,active:true,updated_at:new Date().toISOString()};
 try{
   if(id)await update('ops_document_templates',id,row);else await insert('ops_document_templates',row);
 }catch(e){if(uploadedPath)await removeFile('business-assets',uploadedPath).catch(()=>{});throw e}
 // No se elimina automáticamente el logo anterior: una factura emitida puede tenerlo congelado en su snapshot.
 closeModal();await refresh('Plantilla guardada.');
}
async function deleteTemplate(id){
 if(!isAdmin())throw new Error('Solo el administrador puede eliminar plantillas.');
 const row=state.data.templates.find(x=>x.id===id);if(!row)return;
 if(!confirm('¿Eliminar esta plantilla?'))return;
 await remove('ops_document_templates',id);
 const logoUsed=row.logo_path&&state.data.invoices.some(x=>x.status!=='borrador'&&(x.template_snapshot?.logo_path===row.logo_path||x.design_snapshot?.logo_path===row.logo_path));
 if(row.logo_path&&!logoUsed)await removeFile('business-assets',row.logo_path).catch(()=>{});
 await refresh('Plantilla eliminada.');
}
async function toggleSeries(id,active){
 if(!isAdmin())throw new Error('Solo el administrador puede cambiar series.');
 await update('ops_invoice_series',id,{active,updated_at:new Date().toISOString()}).catch(async e=>{
   // La tabla de series puede no tener updated_at en instalaciones antiguas.
   if(String(e.message).includes('updated_at'))return update('ops_invoice_series',id,{active});
   throw e;
 });
 await refresh('Serie actualizada.');
}

async function saveDocument(id=''){
 const current=id?state.data.documents.find(x=>x.id===id):null;
 const date=required('docDate','Fecha');if(date>isoToday())throw new Error('La fecha del documento no puede ser futura.');
 const storeId=val('docStore')||null,file=input('docFile')?.files?.[0]||null;
 const meta={store_id:storeId,doc_type:val('docType'),document_date:date,supplier_or_customer:val('docParty').trim(),tax_id:val('docTax').trim(),invoice_number:val('docNumber').trim(),category_code:val('docCategory').trim(),status:val('docStatus'),notes:val('docNotes').trim()};
 if(!current&&!file)throw new Error('Selecciona un archivo.');
 let row=current,newPath=null;
 if(!current){
   row=await createStoredDocument(file,{storeId,date,docType:meta.doc_type,status:meta.status,party:meta.supplier_or_customer,taxId:meta.tax_id,number:meta.invoice_number,category:meta.category_code,notes:meta.notes});
 }else if(file){
   const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);if(file.size>max)throw new Error('El archivo supera el tamaño máximo permitido.');
   const usage=state.data.storageUsage||{},limit=Number(usage.limit_bytes||500*1024*1024),used=Number(usage.total_bytes||0)-Number(current.size_bytes||0);
   if(used+file.size>limit)throw new Error('No hay espacio suficiente en Storage.');
   const y=date.slice(0,4),m=date.slice(5,7),storeNameValue=state.data.stores.find(x=>x.id===storeId)?.name||'General';
   newPath=`${y}/${quarterFromDate(date)}/${m}/${safeSegment(storeNameValue)}/${safeSegment(meta.doc_type)}/${safeSegment(meta.supplier_or_customer)}/${crypto.randomUUID()}_${safeSegment(file.name)}`;
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
 let body='';
 if(mime.includes('pdf')||name.endsWith('.pdf')){
   const url=URL.createObjectURL(blob);body=`<iframe class="document-frame" src="${url}" title="${esc(d.original_name||'PDF')}"></iframe>`;
   setTimeout(()=>URL.revokeObjectURL(url),180000);
 }else if(mime.startsWith('image/')||/\.(png|jpe?g|webp)$/i.test(name)){
   const url=URL.createObjectURL(blob);body=`<div class="image-preview-wrap"><img class="document-image-preview" src="${url}" alt="${esc(d.original_name||'Imagen')}"></div>`;
   setTimeout(()=>URL.revokeObjectURL(url),180000);
 }else if(/\.(xlsx|xls)$/i.test(name)){
   const buf=await blob.arrayBuffer();const wb=window.XLSX.read(buf,{type:'array'});const sheet=wb.Sheets[wb.SheetNames[0]];
   body=`<div class="note">Hoja: ${esc(wb.SheetNames[0]||'')}</div><div class="excel-preview">${window.XLSX.utils.sheet_to_html(sheet)}</div>`;
 }else if(/\.(csv|txt|md)$/i.test(name)||mime.startsWith('text/')){
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
 const d=state.data.documents.find(x=>x.id===id);if(!d)return;
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
 for(const d of rows){const blob=await getDocumentBlob(d);zip.file(`${safeSegment(d.doc_type)}/${safeSegment(d.original_name)}`,blob)}
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

function userModal(row=null){
 const self=row&&row.email?.toLowerCase()===state.user?.email?.toLowerCase();
 const body=`<div class="form-grid">
  ${formField('Nombre completo','usName',row?.full_name||'')}
  ${formField('Email','usEmail',row?.email||'','email',row?'disabled':'')}
  ${selectField('Rol','usRole',[{value:'admin',label:'Administrador'},{value:'gerente',label:'Gerente'},{value:'encargado',label:'Encargado'}],row?.role||'gerente')}
  ${formField('Teléfono','usPhone',row?.phone||'')}
  ${formField('Puesto','usJob',row?.job_title||'')}
  ${formField('Tienda / centro','usStore',row?.store||'')}
  <label class="wide">Notas<textarea id="usNotes" rows="3">${esc(row?.employee_notes||'')}</textarea></label>
  ${row?formField('Nueva contraseña (opcional)','usPassword','','password','minlength="8"'):formField('Contraseña inicial','usPassword','','password','minlength="8"')}
 </div>
 ${row?`<div class="note" style="margin-top:12px">Estado actual: <b>${row.active?'Activo':'Inactivo'}</b>. La contraseña solo cambia si escribes una nueva.</div>`:''}
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

async function downloadBackup(){
 if(!isAdmin())throw new Error('Solo el administrador puede crear copias completas.');
 toast('Preparando copia completa…');
 const out=await createBackup();
 toast('Copia creada: '+(out.size/1024/1024).toFixed(1).replace('.',',')+' MB','ok');
}
async function restoreBackupFromInput(){
 if(!isAdmin())throw new Error('Solo el administrador puede restaurar copias.');
 const file=input('backupFile')?.files?.[0];if(!file)throw new Error('Selecciona primero un archivo .totusbackup.');
 const inspected=await inspectBackup(file);
 if(!confirm('1/3 · La copia es del '+new Date(inspected.manifest.created_at).toLocaleString('es-ES')+'. ¿Continuar?'))return;
 if(!confirm('2/3 · Se sustituirán los datos de negocio actuales. Los usuarios Diego/Davinia y Auth NO se tocarán. ¿Continuar?'))return;
 const check=prompt('3/3 · Escribe RESTAURAR TOTUS para confirmar:');if(check!=='RESTAURAR TOTUS')return;
 const reason=prompt('Motivo de la restauración:');if(!reason?.trim())throw new Error('El motivo es obligatorio.');
 toast('Restaurando copia…');
 await restoreBackup(file,reason.trim());
 await refresh('Copia restaurada correctamente.');
}

async function saveConfig(){
 if(!isAdmin())throw new Error('Solo el administrador puede cambiar la configuración.');
 const current={...(state.data.settings||{})},patch={updated_at:new Date().toISOString()};
 const setIf=(id,key,transform=v=>v)=>{const el=input(id);if(el)patch[key]=transform(el.value)};
 setIf('cfgBusiness','business_name',v=>v.trim());setIf('cfgTax','tax_id',v=>v.trim());setIf('cfgAddress','business_address',v=>v.trim());setIf('cfgEmail','business_email',v=>v.trim());setIf('cfgPhone','business_phone',v=>v.trim());
 setIf('cfgVat','default_sales_vat_rate',n);setIf('cfgIrpf','irpf_prepayment_rate',n);setIf('cfgDifficultPct','difficult_expense_pct',n);setIf('cfgDifficultCap','difficult_expense_annual_cap',n);setIf('cfgReta','actual_reta_monthly',v=>v===''?null:n(v));setIf('cfgRetaRate','reta_total_rate',n);setIf('cfgRetaDeduction','reta_generic_deduction_pct',n);setIf('cfgMargin','target_operating_margin_pct',n);
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
function reportArgs(year){
 return {year,settings:state.data.settings,stores:state.data.stores,closings:state.data.closings,expenses:state.data.expenses,expenseLines:state.data.expenseLines,invoices:state.data.invoices,incomeAdjustments:state.data.incomeAdjustments,fiscalAdjustments:state.data.fiscalAdjustments,taxPayments:state.data.taxPayments,categories:state.data.categories};
}
function exportStoreBook(storeId,year){
 const store=state.data.stores.find(x=>x.id===storeId);if(!store)throw new Error('Establecimiento no encontrado.');
 exportStoreAnnualWorkbook({store,year,closings:state.data.closings,expenses:state.data.expenses,categories:state.data.categories});
}
async function exportGestorPackage(year){
 const zip=new window.JSZip(),args=reportArgs(year),stores=state.data.stores.filter(x=>x.active!==false);
 const ingresos=zip.folder('01_INGRESOS'),gastos=zip.folder('02_GASTOS'),diarios=zip.folder('03_DIARIOS'),resumen=zip.folder('04_RESUMEN'),docs=zip.folder('05_DOCUMENTOS');
 const incomeRows=state.data.closings.filter(x=>String(x.business_date).startsWith(String(year))).map(x=>[fmtDate(x.business_date),state.data.stores.find(s=>s.id===x.store_id)?.name||'',n(x.cash_sales),n(x.card_sales),n(x.bizum_sales),n(x.online_sales),n(x.other_income),n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income)]);
 const incomeCsv=['Fecha;Tienda;Efectivo;Tarjeta;Bizum;Online;Otros;Total',...incomeRows.map(r=>r.join(';'))].join('\n');ingresos.file(`Ingresos_${year}.csv`,incomeCsv);
 const gestor=buildGestorWorkbook(args);gastos.file(`Libros_gestor_y_auditoria_${year}_Totus.xlsx`,workbookBlob(gestor));
 for(const store of stores){const wb=buildStoreAnnualWorkbook({store,year,closings:state.data.closings,expenses:state.data.expenses,categories:state.data.categories});diarios.file(`Gastos y ventas ${safeSegment(store.name)} ${year}.xlsx`,workbookBlob(wb))}
 const yearClosings=state.data.closings.filter(x=>String(x.business_date).startsWith(String(year))),yearExpenses=state.data.expenses.filter(x=>String(x.expense_date).startsWith(String(year)));
 const sales=yearClosings.reduce((v,x)=>v+n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income),0),accounting=yearExpenses.filter(x=>!x.management_only).reduce((v,x)=>v+n(x.accounting_amount||x.gross_expense||x.amount_paid),0),internal=yearExpenses.filter(x=>x.management_only).reduce((v,x)=>v+n(x.accounting_amount||x.gross_expense||x.amount_paid),0);
 resumen.file(`Resumen_${year}.csv`,`Concepto;Importe\nVentas;${sales.toFixed(2)}\nGastos contables;${accounting.toFixed(2)}\nGastos internos;${internal.toFixed(2)}\nResultado real;${(sales-accounting-internal).toFixed(2)}\n`);
 const yearDocs=state.data.documents.filter(x=>String(x.document_date||x.created_at).startsWith(String(year)));
 for(const d of yearDocs){try{const blob=await getDocumentBlob(d);docs.file(`${safeSegment(d.doc_type)}/${safeSegment(d.supplier_or_customer||'Sin_parte')}/${safeSegment(d.original_name)}`,blob)}catch(e){throw new Error('No se pudo incluir '+(d.original_name||'documento')+' en el ZIP: '+e.message)}}
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
 return exportSummaryWorkbook({closings,expenses,stores,from:f.from,to:f.to});
}

document.addEventListener('click',async e=>{
 const el=actionEl(e);if(!el)return;
 const route=el.dataset.route;if(route){setRoute(route);document.body.classList.remove('menu-open');render();return}
 const a=el.dataset.action;if(!a)return;
 try{
  if(a==='logout'){await logout();location.reload();return}
  if(a==='toggle-menu'){document.body.classList.toggle('menu-open');return}
  if(a==='close-modal'){closeModal();return}
  if(a.endsWith('-apply')){applyFilter(a.replace('-apply',''));return}
  if(a.endsWith('-month')){thisMonth(a.replace('-month',''));return}
  if(a==='pricing-search'){patchFilters('pricing',{query:val('pricingQuery').trim()});render();return}
  if(a==='closing-new'){setView('cajas',{mode:'record',id:null});render();return}
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
  if(a==='expense-new'){setView('gastos',{mode:'record',id:null});render();return}
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
  if(a==='invoice-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'invoice',origin:'totus'});render();return}
  if(a==='proforma-new'){setView('facturacion',{mode:'record',id:null,docType:'proforma',invoiceKind:'invoice',origin:'totus'});render();return}
  if(a==='rectification-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'rectifying',origin:'totus'});render();return}
  if(a==='external-invoice-new'){setView('facturacion',{mode:'record',id:null,docType:'factura',invoiceKind:'invoice',origin:'externa'});render();return}
  if(a==='invoice-edit'||a==='invoice-open'){const row=state.data.invoices.find(x=>x.id===el.dataset.id);if(row){setView('facturacion',{mode:'record',id:row.id,docType:row.document_type,invoiceKind:row.invoice_kind,origin:row.origin});render()}return}
  if(a==='invoice-save'){await saveInvoice(el.dataset.id||'',el.dataset.type||'factura',el.dataset.kind||'invoice',el.dataset.origin||'totus');return}
  if(a==='invoice-back'){setView('facturacion',{mode:'list',id:null});render();return}
  if(a==='billing-section'){setView('facturacion',{mode:'list',id:null,section:el.dataset.section||'documentos'});render();return}
  if(a==='invoice-source-preview'){await previewDocument(el.dataset.id);return}
  if(a==='invoice-source-download'){await downloadDocument(el.dataset.id);return}
  if(a==='invoice-finalize'){await finalizeInvoice(el.dataset.id);return}
  if(a==='invoice-line-add'){addInvoiceLine();return}
  if(a==='invoice-line-remove'){removeInvoiceLine(el.dataset.index);return}
  if(a==='invoice-preview'){await showInvoicePreview(el.dataset.id);return}
  if(a==='invoice-print'){await printInvoice(el.dataset.id);return}
  if(a==='proforma-convert'){await convertProforma(el.dataset.id);return}
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
  if(a==='consultation-delete'){await deleteConsultation(el.dataset.id);return}
  if(a==='customers-manage'){customersManager();return}
  if(a==='customer-new'){customerForm();return}
  if(a==='customer-edit'){customerForm(state.data.customers.find(x=>x.id===el.dataset.id));return}
  if(a==='customer-save'){await saveCustomer(el.dataset.id||'');return}
  if(a==='customer-delete'){await deleteCustomer(el.dataset.id);return}
  if(a==='template-new'){templateForm();return}
  if(a==='template-edit'){templateForm(state.data.templates.find(x=>x.id===el.dataset.id));return}
  if(a==='template-save'){await saveTemplate(el.dataset.id||'');return}
  if(a==='template-delete'){await deleteTemplate(el.dataset.id);return}
  if(a==='series-toggle'){await toggleSeries(el.dataset.id,el.dataset.active==='true');return}
  if(a==='document-new'){setView('documentos',{mode:'record',id:null});render();return}
  if(a==='document-edit'){setView('documentos',{mode:'record',id:el.dataset.id});render();return}
  if(a==='document-back'){resetView('documentos');render();return}
  if(a==='document-save'){await saveDocument(el.dataset.id||'');return}
  if(a==='document-download'){await downloadDocument(el.dataset.id);return}
  if(a==='document-delete'){await deleteDocument(el.dataset.id);return}
  if(a==='documents-zip'){await zipFilteredDocuments();return}
  if(a==='document-preview'){await previewDocument(el.dataset.id);return}
  if(a==='product-new'){productModal();return}
  if(a==='product-edit'){productModal(state.data.products.find(x=>x.id===el.dataset.id));return}
  if(a==='product-save'){await saveProduct(el.dataset.id||'');return}
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
  if(a==='user-toggle'){await toggleUser(el.dataset.email,el.dataset.active==='true');return}
  if(a==='user-reset'){await resetUser(el.dataset.email);return}
  if(a==='user-delete'){await deleteUser(el.dataset.email);return}
  if(a==='config-save'){await saveConfig();return}
  if(a==='admin-section'){setView('administracion',{section:el.dataset.section||'usuarios'});render();return}
  if(a==='backup-create'){await downloadBackup();return}
  if(a==='backup-restore'){await restoreBackupFromInput();return}
  if(a==='export-closings'){exportRows('closings');return}
  if(a==='export-expenses'){exportRows('expenses');return}
  if(a==='export-summary'){exportRows('summary');return}
  if(a==='export-store-book'){exportStoreBook(el.dataset.store,Number(el.dataset.year));return}
  if(a==='export-gestor-book'){exportGestorWorkbook(reportArgs(Number(el.dataset.year)));return}
  if(a==='export-gestor-package'){await exportGestorPackage(Number(el.dataset.year));return}
 }catch(err){console.error(err);toast(err.message||String(err),'bad')}
});

document.addEventListener('input',e=>{
 const id=e.target?.id||'';
 if(id==='clReported'||id.startsWith('dr'))updateClosingSummary();
 if(id.startsWith('exLine'))updateExpenseSummary();
 if(id.startsWith('ivQty_')||id.startsWith('ivUnit_')||id.startsWith('ivDisc_')||id.startsWith('ivVat_'))updateInvoiceSummary();
});

document.addEventListener('change',e=>{
 if(e.target?.id==='clStore'&&getView('cajas').mode==='record'&&!getView('cajas').id){setView('cajas',{mode:'record',id:null,storeId:e.target.value});render();return}
 if(e.target?.id==='ivStore'&&getView('facturacion').mode==='record'&&!getView('facturacion').id){setView('facturacion',{storeId:e.target.value});render();return}
 if(e.target?.id==='exSupplierId'){
   const s=state.data.suppliers.find(x=>x.id===e.target.value);if(!s)return;
   const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.value=v};
   set('exSupplier',s.name);set('exTax',s.tax_id);set('exPayment',s.default_payment_method||'tarjeta');
   const first=document.querySelector('.expense-line');if(first){const ix=first.dataset.lineIndex;set('exLineCategory_'+ix,s.default_category_id||'');set('exLineVat_'+ix,s.default_vat_rate??21);set('exLineRe_'+ix,s.default_re_rate??0);set('exLineWh_'+ix,s.default_withholding_rate??0);set('exLineModel_'+ix,s.default_withholding_model||'');set('exLineDedPct_'+ix,s.default_deductible_pct??100);const d=document.getElementById('exLineDed_'+ix);if(d)d.checked=s.default_deductible_irpf!==false;updateExpenseSummary()}
 }
 if(e.target?.id==='ivCustomerId'){
   const c=state.data.customers.find(x=>x.id===e.target.value);if(!c)return;
   const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
   set('ivCustomer',c.name);set('ivTax',c.tax_id);set('ivEmail',c.email);set('ivAddress',[c.address,c.postal_code,c.city,c.province].filter(Boolean).join(', '));set('ivPayment',c.default_payment_method||'transferencia');
 }
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
 const session=(await sb.auth.getSession()).data.session;state.session=session;
 if(!session){$('#login').classList.remove('hidden');$('#app').classList.add('hidden');return}
 const [team,profiles]=await Promise.all([
  sb.from('team_members').select('*').eq('email',session.user.email.toLowerCase()).maybeSingle(),
  sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle()
 ]);
 if(team.error)throw team.error;
 const member=team.data;if(!member||member.active===false){await logout();throw new Error('Tu usuario no tiene acceso activo.')}
 state.user={...member,id:profiles.data?.id||session.user.id};
 $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
 await refresh();
}
sb.auth.onAuthStateChange((event,session)=>{state.session=session;if(event==='SIGNED_OUT'){state.user=null;$('#app').classList.add('hidden');$('#login').classList.remove('hidden')}});

boot().catch(e=>{$('#loginMessage').textContent=e.message;$('#login').classList.remove('hidden');$('#app').classList.add('hidden')});
