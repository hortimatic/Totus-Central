import {ROUTES} from './config.js';
import {state,isAdmin,isManager,getFilters,patchFilters,setRoute,getView,setView,resetView} from './state.js';
import {sb,login,logout,recover,loadCore,rpc,insert,update,remove,invokeTeam,upload,signedUrl,removeFile} from './api.js';
import {renderers,invoiceLineRow,invoicePreview,productModal} from './pages/main.js';
import {setHeader,closeModal,toast,modal,btn,formField,selectField} from './components.js';
import {$,monthRange,n,isoToday,fmtDate,esc} from './utils.js';
import {exportClosingsWorkbook,exportExpensesWorkbook,exportSummaryWorkbook} from './excel.js';
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
 const row={name:required('esName','Nombre'),tax_id:val('esTax').trim(),email:val('esEmail').trim(),phone:val('esPhone').trim(),address:val('esAddress').trim(),city:val('esCity').trim(),postal_code:val('esPostal').trim(),province:val('esProvince').trim(),country:'España',default_category_id:val('esCategory')||null,default_payment_method:val('esPayment'),default_document_kind:val('esDocKind'),default_vat_rate:Math.max(0,num('esVat')),default_re_rate:Math.max(0,num('esRe')),default_withholding_rate:Math.max(0,num('esWh')),default_withholding_model:val('esWhModel')||null,default_deductible_irpf:!!input('esDeductible')?.checked,default_deductible_pct:Math.min(100,Math.max(0,num('esDedPct'))),notes:val('esNotes').trim(),active:true,source:'manual',updated_at:new Date().toISOString()};
 if(id)await update('ops_suppliers',id,row);else await insert('ops_suppliers',{...row,created_by:state.user?.id||null});
 closeModal();await refresh('Proveedor de gastos guardado.');
}
async function deleteExpenseSupplier(id){
 const linked=state.data.expenses.filter(x=>x.supplier_id===id).length;
 if(linked)throw new Error('No se puede eliminar: hay '+linked+' gastos vinculados. Puedes dejar de usarlo sin borrar el histórico.');
 if(!confirm('¿Eliminar este proveedor de gastos?'))return;
 await remove('ops_suppliers',id);closeModal();await refresh('Proveedor eliminado.');
}

async function saveExpense(id=''){
 const base=num('exBase'),vatRate=Math.max(0,num('exVatRate')),reRate=Math.max(0,num('exReRate')),whRate=Math.max(0,num('exWhRate'));
 const vat=base*vatRate/100,re=base*reRate/100,wh=base*whRate/100,total=base+vat+re-wh;
 const paidStatus=val('exPaidStatus')||'pagado';
 const expense={id:id||null,store_id:required('exStore','Tienda'),expense_date:required('exDate','Fecha'),supplier_id:val('exSupplierId')||null,supplier_name:required('exSupplier','Proveedor'),supplier_tax_id:val('exTax').trim(),invoice_number:val('exInvoice').trim(),category_id:val('exCategory')||null,description:val('exDesc').trim(),payment_method:val('exPayment'),paid_status:paidStatus,paid_date:val('exPaidDate')||null,base_amount:base,vat_rate:vatRate,vat_amount:vat,re_rate:reRate,re_amount:re,withholding_rate:whRate,withholding_amount:wh,withholding_model:val('exWhModel')||null,gross_expense:total,amount_paid:paidStatus==='pagado'?total:0,deductible_irpf:!!input('exDeductible')?.checked,deductible_pct:Math.min(100,Math.max(0,num('exDedPct'))),fixed_asset:!!input('exFixed')?.checked,amortization_years:val('exAmortYears')===''?null:num('exAmortYears'),notes:val('exNotes').trim(),document_kind:val('exDocKind')||'factura',source:'manual',fiscal_reviewed:false,management_only:!!input('exManagement')?.checked,personnel_kind:val('exPersonnelKind').trim()||null};
 const lines=[{sort_order:10,category_id:expense.category_id,description:expense.description||expense.supplier_name,base_amount:base,vat_rate:vatRate,vat_amount:0,re_base:0,re_rate:reRate,re_amount:0,irpf_imputable:0,withholding_base:0,withholding_rate:whRate,withholding_amount:0,withholding_model:expense.withholding_model,deductible_irpf:expense.deductible_irpf,deductible_pct:expense.deductible_pct,fixed_asset:expense.fixed_asset,amortization_years:expense.amortization_years,notes:''}];
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
 const tpl=state.data.templates.find(x=>x.id===row.template_id);
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
  if(a==='expense-suppliers'){expenseSuppliersManager();return}
  if(a==='expense-supplier-new'){expenseSupplierForm();return}
  if(a==='expense-supplier-edit'){expenseSupplierForm(state.data.suppliers.find(x=>x.id===el.dataset.id));return}
  if(a==='expense-supplier-save'){await saveExpenseSupplier(el.dataset.id||'');return}
  if(a==='expense-supplier-delete'){await deleteExpenseSupplier(el.dataset.id);return}
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
  if(a==='user-toggle'){await toggleUser(el.dataset.email,el.dataset.active==='true');return}
  if(a==='user-reset'){await resetUser(el.dataset.email);return}
  if(a==='user-delete'){await deleteUser(el.dataset.email);return}
  if(a==='config-save'){await saveConfig();return}
  if(a==='backup-create'){await downloadBackup();return}
  if(a==='backup-restore'){await restoreBackupFromInput();return}
  if(a==='export-closings'){exportRows('closings');return}
  if(a==='export-expenses'){exportRows('expenses');return}
  if(a==='export-summary'){exportRows('summary');return}
 }catch(err){console.error(err);toast(err.message||String(err),'bad')}
});

document.addEventListener('change',e=>{
 if(e.target?.id==='exSupplierId'){
   const s=state.data.suppliers.find(x=>x.id===e.target.value);if(!s)return;
   const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.value=v};
   set('exSupplier',s.name);set('exTax',s.tax_id);set('exPayment',s.default_payment_method||'tarjeta');set('exCategory',s.default_category_id||'');set('exVatRate',s.default_vat_rate??21);set('exReRate',s.default_re_rate??0);set('exWhRate',s.default_withholding_rate??0);set('exWhModel',s.default_withholding_model||'');set('exDedPct',s.default_deductible_pct??100);
   const d=document.getElementById('exDeductible');if(d)d.checked=s.default_deductible_irpf!==false;
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
