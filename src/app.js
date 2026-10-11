import {ROUTES} from './config.js';
import {state,isAdmin,isManager,getFilters,patchFilters,setRoute} from './state.js';
import {sb,login,logout,recover,loadCore,rpc,insert,update,remove,invokeTeam,upload,signedUrl,removeFile} from './api.js';
import {renderers,closingModal,expenseModal,invoiceModal,invoiceLineRow,invoicePreview,productModal} from './pages/main.js';
import {setHeader,closeModal,toast,modal,btn,formField,selectField} from './components.js';
import {$,monthRange,n,isoToday,fmtDate,esc} from './utils.js';
import {exportClosingsWorkbook,exportExpensesWorkbook,exportSummaryWorkbook} from './excel.js';

const titles={
 inicio:['General','Inicio'],pricing:['Trabajo','Pricing'],cajas:['Trabajo','Cajas'],gastos:['Trabajo','Gastos'],
 facturacion:['Trabajo','Facturación'],documentos:['Trabajo','Documentos'],fiscalidad:['Control','Fiscalidad'],
 informes:['Control','Informes'],usuarios:['Administración','Usuarios'],configuracion:['Administración','Configuración'],log:['Administración','Log']
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

async function saveClosing(id=''){
 const store=required('clStore','Tienda'),date=required('clDate','Fecha');
 const drawerEls=[...document.querySelectorAll('.drawer-entry')];
 if(!drawerEls.length)throw new Error('La tienda no tiene cajas activas configuradas.');
 const drawers=drawerEls.map(el=>{
   const d=el.dataset.drawerId;
   const read=suffix=>n(document.getElementById(`dr${suffix}_${d}`)?.value||0);
   return {drawer_id:d,opening_cash:read('Open'),closing_cash:read('Close'),card_sales:read('Card'),bizum_sales:read('Bizum'),online_sales:read('Online'),other_income:read('Other'),cash_withdrawals:read('Withdraw'),cash_expenses_declared:read('CashExpense'),cash_extra_in:read('ExtraIn'),cash_extra_out:read('ExtraOut'),notes:''};
 });
 const payload={id:id||null,store_id:store,business_date:date,notes:val('clNotes').trim(),status:'cerrado'};
 await rpc('totus_save_closing',{p_closing:payload,p_drawers:drawers});
 closeModal();await refresh('Cierre guardado.');
}
async function deleteClosing(id){
 if(!confirm('¿Eliminar este cierre?'))return;
 const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 await rpc('totus_delete_closing',{p_id:id,p_reason:reason.trim()});closeModal();await refresh('Cierre eliminado.');
}

async function saveExpense(id=''){
 const base=num('exBase'),vatRate=num('exVatRate'),reRate=num('exReRate'),whRate=num('exWhRate');
 const vat=base*vatRate/100,re=base*reRate/100,wh=base*whRate/100,total=base+vat+re-wh;
 const expense={id:id||null,store_id:required('exStore','Tienda'),expense_date:required('exDate','Fecha'),supplier_name:required('exSupplier','Proveedor'),supplier_tax_id:val('exTax').trim(),invoice_number:val('exInvoice').trim(),description:val('exDesc').trim(),payment_method:val('exPayment'),paid_status:'pagado',base_amount:base,vat_rate:vatRate,vat_amount:vat,re_rate:reRate,re_amount:re,withholding_rate:whRate,withholding_amount:wh,gross_expense:total,amount_paid:total,deductible_irpf:true,deductible_pct:100,notes:val('exNotes').trim(),document_kind:'factura',source:'manual',management_only:false};
 const lines=[{sort_order:10,description:expense.description||expense.supplier_name,base_amount:base,vat_rate:vatRate,re_rate:reRate,withholding_rate:whRate,deductible_irpf:true,deductible_pct:100,notes:''}];
 await rpc('totus_save_expense',{p_expense:expense,p_lines:lines});closeModal();await refresh('Gasto guardado.');
}
async function deleteExpense(id){
 if(!confirm('¿Eliminar este gasto?'))return;const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 await rpc('totus_delete_expense',{p_id:id,p_reason:reason.trim()});closeModal();await refresh('Gasto eliminado.');
}

async function saveInvoice(id='',type='factura'){
 const lineEls=[...document.querySelectorAll('.invoice-line')];
 if(!lineEls.length)throw new Error('Añade al menos una línea.');
 const lines=lineEls.map((el,i)=>{
   const idx=el.dataset.lineIndex;
   const description=required(`ivDesc_${idx}`,`Descripción de la línea ${i+1}`);
   const quantity=Math.max(.01,n(val(`ivQty_${idx}`)));
   const unit_price_base=n(val(`ivUnit_${idx}`));
   const discount_pct=Math.min(100,Math.max(0,n(val(`ivDisc_${idx}`))));
   const vat_rate=Math.max(0,n(val(`ivVat_${idx}`)));
   return {sort_order:(i+1)*10,description,quantity,unit_price_base,discount_pct,vat_rate};
 });
 const doc={id:id||null,series_id:required('ivSeries','Serie'),store_id:required('ivStore','Tienda'),issue_date:required('ivDate','Fecha'),due_date:val('ivDue')||null,origin:'totus',document_type:type,invoice_kind:'invoice',customer_id:val('ivCustomerId')||null,customer_name:required('ivCustomer','Cliente'),customer_tax_id:val('ivTax').trim(),customer_address:val('ivAddress').trim(),customer_email:val('ivEmail').trim(),concept:val('ivConcept').trim(),payment_method:val('ivPayment'),paid_status:'pendiente',include_in_income:type==='factura',template_id:val('ivTemplate')||null,purchase_order_ref:val('ivPO').trim(),notes:''};
 await rpc('totus_save_sales_document',{p_document:doc,p_lines:lines});
 closeModal();await refresh(type==='proforma'?'Proforma guardada.':'Factura guardada.');
}
async function finalizeInvoice(id){
 if(!confirm('¿Emitir este documento? Una vez emitido no debe editarse como borrador.'))return;
 await rpc('totus_finalize_sales_document',{p_id:id});closeModal();await refresh('Documento emitido.');
}

async function saveProduct(id=''){
 const row={name:required('prName','Nombre'),sku:required('prSku','Referencia'),family_id:val('prFamily')||null,product_type:val('prType'),current_pvp:num('prPvp')||null,proposed_pvp:num('prProposed')||null,notes:val('prNotes').trim(),status:'PENDIENTE',updated_at:new Date().toISOString()};
 if(id)await update('products',id,row);else await insert('products',row);
 closeModal();await refresh('Producto guardado.');
}
async function deleteProduct(id){if(!confirm('¿Eliminar definitivamente este producto?'))return;await remove('products',id);closeModal();await refresh('Producto eliminado.')}

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
function showInvoicePreview(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)return;
 modal('Vista previa',invoicePreview(row));
}
function printInvoice(id){
 const row=state.data.invoices.find(x=>x.id===id);if(!row)return;
 const html=invoicePreview(row).replace(/<div class="form-actions">[\s\S]*?<\/div>\s*<\/div>$/,'</div>');
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
 const row={name:required('cuName','Nombre'),tax_id:val('cuTax').trim(),email:val('cuEmail').trim(),phone:val('cuPhone').trim(),address:val('cuAddress').trim(),city:val('cuCity').trim(),postal_code:val('cuPostal').trim(),province:val('cuProvince').trim(),country:'España',default_payment_method:val('cuPayment'),notes:val('cuNotes').trim(),active:true,updated_at:new Date().toISOString()};
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
 if(file&&current?.logo_path&&current.logo_path!==uploadedPath)await removeFile('business-assets',current.logo_path).catch(()=>{});
 closeModal();await refresh('Plantilla guardada.');
}
async function deleteTemplate(id){
 if(!isAdmin())throw new Error('Solo el administrador puede eliminar plantillas.');
 const row=state.data.templates.find(x=>x.id===id);if(!row)return;
 if(!confirm('¿Eliminar esta plantilla?'))return;
 await remove('ops_document_templates',id);
 if(row.logo_path)await removeFile('business-assets',row.logo_path).catch(()=>{});
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

function documentModal(){
 const stores=state.data.stores.filter(x=>x.active!==false).map(s=>({value:s.id,label:s.name}));
 const body=`<div class="form-grid">
  ${selectField('Tienda','docStore',stores,stores[0]?.value||'')}
  ${formField('Fecha','docDate',isoToday(),'date')}
  ${selectField('Tipo','docType',[{value:'factura_recibida',label:'Factura recibida'},{value:'factura_emitida',label:'Factura emitida'},{value:'factura_rectificativa',label:'Factura rectificativa'},{value:'proforma',label:'Proforma'},{value:'ticket',label:'Ticket'},{value:'contrato',label:'Contrato'},{value:'impuesto',label:'Impuesto'},{value:'informe',label:'Informe'},{value:'otro',label:'Otro'}],'factura_compra')}
  ${formField('Proveedor / cliente','docParty','')}
  ${formField('Nº documento','docNumber','')}
  <label class="wide">Archivo<input id="docFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"></label>
  <label class="wide">Notas<textarea id="docNotes" rows="3"></textarea></label>
 </div><div class="form-actions">${btn('Guardar documento','document-save','primary')}</div>`;
 modal('Subir documento',body);
}
async function saveDocument(){
 const file=input('docFile')?.files?.[0];if(!file)throw new Error('Selecciona un archivo.');
 const max=Number(state.data.settings?.document_max_bytes||20*1024*1024);if(file.size>max)throw new Error('El archivo supera el tamaño máximo permitido.');
 const store=required('docStore','Tienda'),date=required('docDate','Fecha'),path=`${date.slice(0,4)}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 await upload('business-documents',path,file);
 try{
   await insert('ops_documents',{store_id:store,doc_type:val('docType'),document_date:date,supplier_or_customer:val('docParty').trim(),invoice_number:val('docNumber').trim(),status:'archivada',storage_path:path,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,notes:val('docNotes').trim(),uploaded_by:state.session?.user?.id||null});
 }catch(e){await removeFile('business-documents',path).catch(()=>{});throw e}
 closeModal();await refresh('Documento archivado.');
}
async function previewDocument(id){
 const d=state.data.documents.find(x=>x.id===id);if(!d)return;
 const url=await signedUrl('business-documents',d.storage_path,180);
 modal(d.original_name||'Documento',`<div class="stack"><div class="summary-row"><span>Fecha</span><strong>${fmtDate(d.document_date)}</strong></div><div class="summary-row"><span>Proveedor / cliente</span><strong>${esc(d.supplier_or_customer||'—')}</strong></div><div class="summary-row"><span>Tipo</span><strong>${esc(d.doc_type||'—')}</strong></div><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">Abrir archivo</a></div>`,{small:true});
}

function userModal(row=null){
 const body=`<div class="form-grid">${formField('Nombre completo','usName',row?.full_name||'')}${formField('Email','usEmail',row?.email||'','email',row?'disabled':'')}${selectField('Rol','usRole',[{value:'admin',label:'Administrador'},{value:'gerente',label:'Gerente'},{value:'encargado',label:'Encargado'}],row?.role||'gerente')}${formField('Teléfono','usPhone',row?.phone||'')}${formField('Puesto','usJob',row?.job_title||'')}${formField('Tienda / centro','usStore',row?.store||'')}<label class="wide">Notas<textarea id="usNotes" rows="3">${esc(row?.employee_notes||'')}</textarea></label>${row?'':formField('Contraseña inicial','usPassword','','password','minlength="8"')}</div><div class="form-actions">${btn('Guardar usuario','user-save','primary',row?`data-email="${esc(row.email)}"`:'')}</div>`;
 modal(row?'Editar usuario':'Nuevo usuario',body);
}
async function saveUser(email=''){
 const payload={full_name:required('usName','Nombre'),email:email||required('usEmail','Email').toLowerCase(),role:val('usRole'),phone:val('usPhone').trim(),job_title:val('usJob').trim(),store:val('usStore').trim(),employee_notes:val('usNotes').trim()};
 if(email){await invokeTeam({action:'update_member',...payload,active:true})}
 else{const password=val('usPassword');if(password.length<8)throw new Error('La contraseña inicial debe tener al menos 8 caracteres.');await invokeTeam({action:'create_user',...payload,password})}
 closeModal();await refresh('Usuario guardado.');
}
async function saveConfig(){
 const row={business_name:val('cfgBusiness').trim(),tax_id:val('cfgTax').trim(),business_address:val('cfgAddress').trim(),business_email:val('cfgEmail').trim(),business_phone:val('cfgPhone').trim(),storage_limit_bytes:Math.max(1,num('cfgStorage'))*1024*1024,default_sales_vat_rate:num('cfgVat'),irpf_prepayment_rate:num('cfgIrpf'),actual_reta_monthly:num('cfgReta')||null,target_operating_margin_pct:num('cfgMargin'),updated_at:new Date().toISOString()};
 const id=state.data.settings?.id||1;await update('ops_business_settings',id,row);await refresh('Configuración guardada.');
}
const filterRoute={cajas:'cajas',gastos:'gastos',facturas:'facturacion',documentos:'documentos',fiscal:'fiscalidad',informes:'informes'};
function applyFilter(prefix){
 const route=filterRoute[prefix];if(!route)return;
 const from=val(prefix+'From'),to=val(prefix+'To');if(from&&to&&from>to)throw new Error('La fecha Desde no puede ser posterior a Hasta.');
 patchFilters(route,{from,to,store:val(prefix+'Store'),query:val(prefix+'Query').trim()});render();
}
function thisMonth(prefix){const route=filterRoute[prefix];if(!route)return;const r=monthRange();patchFilters(route,{from:r.from,to:r.to});render()}
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
  if(a==='closing-new'){closingModal();return}
  if(a==='closing-edit'){closingModal(state.data.closings.find(x=>x.id===el.dataset.id));return}
  if(a==='closing-save'){await saveClosing(el.dataset.id||'');return}
  if(a==='closing-delete'){await deleteClosing(el.dataset.id);return}
  if(a==='expense-new'){expenseModal();return}
  if(a==='expense-edit'){expenseModal(state.data.expenses.find(x=>x.id===el.dataset.id));return}
  if(a==='expense-save'){await saveExpense(el.dataset.id||'');return}
  if(a==='expense-delete'){await deleteExpense(el.dataset.id);return}
  if(a==='invoice-new'){invoiceModal(null,'factura');return}
  if(a==='proforma-new'){invoiceModal(null,'proforma');return}
  if(a==='invoice-edit'){const row=state.data.invoices.find(x=>x.id===el.dataset.id);invoiceModal(row,row?.document_type||'factura');return}
  if(a==='invoice-save'){await saveInvoice(el.dataset.id||'',el.dataset.type||'factura');return}
  if(a==='invoice-finalize'){await finalizeInvoice(el.dataset.id);return}
  if(a==='invoice-line-add'){addInvoiceLine();return}
  if(a==='invoice-line-remove'){removeInvoiceLine(el.dataset.index);return}
  if(a==='invoice-preview'){showInvoicePreview(el.dataset.id);return}
  if(a==='invoice-print'){printInvoice(el.dataset.id);return}
  if(a==='proforma-convert'){await convertProforma(el.dataset.id);return}
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
  if(a==='document-new'){documentModal();return}
  if(a==='document-save'){await saveDocument();return}
  if(a==='document-preview'){await previewDocument(el.dataset.id);return}
  if(a==='product-new'){productModal();return}
  if(a==='product-edit'){productModal(state.data.products.find(x=>x.id===el.dataset.id));return}
  if(a==='product-save'){await saveProduct(el.dataset.id||'');return}
  if(a==='product-delete'){await deleteProduct(el.dataset.id);return}
  if(a==='user-new'){userModal();return}
  if(a==='user-edit'){userModal(state.data.team.find(x=>x.email===el.dataset.email));return}
  if(a==='user-save'){await saveUser(el.dataset.email||'');return}
  if(a==='config-save'){await saveConfig();return}
  if(a==='export-closings'){exportRows('closings');return}
  if(a==='export-expenses'){exportRows('expenses');return}
  if(a==='export-summary'){exportRows('summary');return}
 }catch(err){console.error(err);toast(err.message||String(err),'bad')}
});

document.addEventListener('change',e=>{
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
