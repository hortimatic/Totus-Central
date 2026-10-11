import {ROUTES} from './config.js';
import {state,isAdmin,isManager,getFilters,patchFilters,setRoute} from './state.js';
import {sb,login,logout,recover,loadCore,rpc,insert,update,remove,invokeTeam,upload,signedUrl,removeFile} from './api.js';
import {renderers,closingModal,expenseModal,invoiceModal,productModal} from './pages/main.js';
import {setHeader,closeModal,toast,modal,btn,formField,selectField} from './components.js';
import {$,monthRange,n,isoToday,fmtDate,download,csv,esc} from './utils.js';

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
 const store=required('clStore','Tienda'),date=required('clDate','Fecha'),opening=num('clOpening'),actual=num('clActual');
 const activeDrawers=state.data.drawers.filter(x=>x.store_id===store&&x.active!==false);
 if(!activeDrawers.length)throw new Error('La tienda no tiene una caja activa configurada.');
 const payload={id:id||null,store_id:store,business_date:date,opening_cash:opening,actual_cash:actual,card_sales:num('clCard'),bizum_sales:num('clBizum'),online_sales:num('clOnline'),other_income:num('clOther'),cash_withdrawals:num('clWithdraw'),cash_expenses_declared:0,notes:val('clNotes').trim(),status:'cerrado'};
 const drawers=activeDrawers.map((d,i)=>({drawer_id:d.id,opening_cash:i===0?opening:0,closing_cash:i===0?actual:0,card_sales:i===0?payload.card_sales:0,bizum_sales:i===0?payload.bizum_sales:0,online_sales:i===0?payload.online_sales:0,other_income:i===0?payload.other_income:0,cash_withdrawals:i===0?payload.cash_withdrawals:0,cash_expenses_declared:0,notes:''}));
 await rpc('ops_save_closing',{p_closing:payload,p_drawers:drawers});closeModal();await refresh('Cierre guardado.');
}
async function deleteClosing(id){
 if(!confirm('¿Eliminar este cierre?'))return;
 const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 await rpc('ops_delete_closing_controlled',{p_closing_id:id,p_reason:reason.trim()});closeModal();await refresh('Cierre eliminado.');
}

async function saveExpense(id=''){
 const base=num('exBase'),vatRate=num('exVatRate'),reRate=num('exReRate'),whRate=num('exWhRate');
 const vat=base*vatRate/100,re=base*reRate/100,wh=base*whRate/100,total=base+vat+re-wh;
 const expense={id:id||null,store_id:required('exStore','Tienda'),expense_date:required('exDate','Fecha'),supplier_name:required('exSupplier','Proveedor'),supplier_tax_id:val('exTax').trim(),invoice_number:val('exInvoice').trim(),description:val('exDesc').trim(),payment_method:val('exPayment'),paid_status:'pagado',base_amount:base,vat_rate:vatRate,vat_amount:vat,re_rate:reRate,re_amount:re,withholding_rate:whRate,withholding_amount:wh,gross_expense:total,amount_paid:total,deductible_irpf:true,deductible_pct:100,notes:val('exNotes').trim(),document_kind:'factura',source:'manual',management_only:false};
 const lines=[{sort_order:10,description:expense.description||expense.supplier_name,base_amount:base,vat_rate:vatRate,re_rate:reRate,withholding_rate:whRate,deductible_irpf:true,deductible_pct:100,notes:''}];
 await rpc('ops_save_expense',{p_expense:expense,p_lines:lines});closeModal();await refresh('Gasto guardado.');
}
async function deleteExpense(id){
 if(!confirm('¿Eliminar este gasto?'))return;const reason=prompt('Motivo de eliminación:');if(!reason?.trim())return;
 await rpc('ops_delete_expense_controlled',{p_expense_id:id,p_reason:reason.trim()});closeModal();await refresh('Gasto eliminado.');
}

async function saveInvoice(id='',type='factura'){
 const qty=Math.max(.01,num('ivQty')),unit=num('ivUnit'),vatRate=num('ivVat'),base=qty*unit,vat=base*vatRate/100;
 const doc={id:id||null,series_id:required('ivSeries','Serie'),store_id:required('ivStore','Tienda'),issue_date:required('ivDate','Fecha'),origin:'totus',document_type:type,invoice_kind:type==='factura'?'invoice':'invoice',customer_name:required('ivCustomer','Cliente'),customer_tax_id:val('ivTax').trim(),customer_address:val('ivAddress').trim(),customer_email:val('ivEmail').trim(),concept:val('ivConcept').trim(),payment_method:val('ivPayment'),paid_status:'pendiente',include_in_income:type==='factura',notes:''};
 const lines=[{sort_order:10,description:required('ivLineDesc','Descripción'),quantity:qty,unit_price_base:unit,discount_pct:0,vat_rate:vatRate,base_amount:base,vat_amount:vat,total_amount:base+vat}];
 await rpc('ops_save_document_draft',{p_document:doc,p_lines:lines});closeModal();await refresh(type==='proforma'?'Proforma guardada.':'Factura guardada.');
}
async function finalizeInvoice(id){
 if(!confirm('¿Emitir este documento? Una vez emitido no debe editarse como borrador.'))return;
 await rpc('ops_finalize_document',{p_document_id:id});closeModal();await refresh('Documento emitido.');
}

async function saveProduct(id=''){
 const row={name:required('prName','Nombre'),sku:required('prSku','Referencia'),family_id:val('prFamily')||null,product_type:val('prType'),current_pvp:num('prPvp')||null,proposed_pvp:num('prProposed')||null,notes:val('prNotes').trim(),status:'PENDIENTE',updated_at:new Date().toISOString()};
 if(id)await update('products',id,row);else await insert('products',row);
 closeModal();await refresh('Producto guardado.');
}
async function deleteProduct(id){if(!confirm('¿Eliminar definitivamente este producto?'))return;await remove('products',id);closeModal();await refresh('Producto eliminado.')}

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
 if(type==='closings'){
  const rows=state.data.closings.filter(x=>x.business_date>=f.from&&x.business_date<=f.to&&(f.store==='all'||x.store_id===f.store));
  download(new Blob(['\ufeff'+csv(rows,[{label:'Fecha',get:r=>fmtDate(r.business_date)},{label:'Tienda',get:r=>state.data.stores.find(s=>s.id===r.store_id)?.name||''},{label:'Efectivo',get:r=>r.cash_sales},{label:'Tarjeta',get:r=>r.card_sales},{label:'Bizum',get:r=>r.bizum_sales},{label:'Online',get:r=>r.online_sales},{label:'Efectivo final',get:r=>r.actual_cash}])],{type:'text/csv;charset=utf-8'}),`cierres_${f.from}_${f.to}.csv`);
 }else if(type==='expenses'){
  const rows=state.data.expenses.filter(x=>x.expense_date>=f.from&&x.expense_date<=f.to&&(f.store==='all'||x.store_id===f.store));
  download(new Blob(['\ufeff'+csv(rows,[{label:'Fecha',get:r=>fmtDate(r.expense_date)},{label:'Proveedor',get:r=>r.supplier_name},{label:'Factura',get:r=>r.invoice_number},{label:'Descripción',get:r=>r.description},{label:'Importe',get:r=>r.gross_expense||r.amount_paid}])],{type:'text/csv;charset=utf-8'}),`gastos_${f.from}_${f.to}.csv`);
 }else{
  const closings=state.data.closings.filter(x=>x.business_date>=f.from&&x.business_date<=f.to),expenses=state.data.expenses.filter(x=>x.expense_date>=f.from&&x.expense_date<=f.to);
  const sales=closings.reduce((a,x)=>a+Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0),0),cost=expenses.reduce((a,x)=>a+Number(x.gross_expense||x.amount_paid||0),0);
  download(new Blob([`Periodo;${fmtDate(f.from)} - ${fmtDate(f.to)}\nVentas;${sales.toFixed(2)}\nGastos;${cost.toFixed(2)}\nResultado;${(sales-cost).toFixed(2)}\n`],{type:'text/csv;charset=utf-8'}),`resumen_${f.from}_${f.to}.csv`);
 }
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
