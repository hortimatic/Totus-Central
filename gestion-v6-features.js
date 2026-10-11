(function(){
'use strict';

const O=window.TotusGestion;
if(!O)return;

const {
 h:H,n:N,isoToday:today,sum,inRange,storeName,manager,adminOnly:admin,
 statusBadge,dlBlob,audit,selectAll,infoButton,openOpsModal,closeOpsModal
}=O.core;

const E=O.features={
 loaded:false,
 customers:[],
 templates:[],
 auditRows:[],
 storageUsage:{documents_count:0,documents_bytes:0,assets_count:0,assets_bytes:0,total_bytes:0},
 invoiceMode:'factura',
 invoiceView:'list',
 invoiceDraft:null,
 invoiceQuery:'',
 invoiceStatus:'all',
 reportFrom:`${O.year}-01-01`,
 reportTo:`${O.year}-12-31`
};

const euro=v=>eur(Number(v)||0);
const qBounds=(y,q)=>{
 const startMonth=(q-1)*3+1,endMonth=q*3,last=new Date(y,endMonth,0).getDate();
 return{start:`${y}-${String(startMonth).padStart(2,'0')}-01`,end:`${y}-${String(endMonth).padStart(2,'0')}-${String(last).padStart(2,'0')}`};
};

async function load(force=false){
 if(E.loaded&&!force)return;
 const [customers,templates,auditRows,storage]=await Promise.all([
  selectAll('ops_customers','name',true),
  selectAll('ops_document_templates','name',true),
  manager()?selectAll('ops_audit_log','created_at',false):Promise.resolve([]),
  sb.rpc('ops_storage_usage').then(r=>r.error?null:r.data).catch(()=>null)
 ]);
 E.customers=customers;
 E.templates=templates;
 E.auditRows=auditRows;
 E.storageUsage=storage||{
  documents_count:O.documents.length,
  documents_bytes:sum(O.documents,d=>N(d.size_bytes)),
  assets_count:templates.filter(t=>N(t.logo_size_bytes)>0).length,
  assets_bytes:sum(templates,t=>N(t.logo_size_bytes)),
  total_bytes:sum(O.documents,d=>N(d.size_bytes))+sum(templates,t=>N(t.logo_size_bytes))
 };
 O.storageUsage=E.storageUsage;
 E.loaded=true;
}

function incomeTotal(from,to,store='all'){
 const closings=sum(O.closings.filter(x=>x.include_in_income!==false&&inRange(x.business_date,from,to)&&(store==='all'||x.store_id===store)),x=>N(x.cash_sales)+N(x.card_sales)+N(x.bizum_sales)+N(x.online_sales)+N(x.other_income));
 const invoices=sum(O.invoices.filter(x=>x.document_type!=='proforma'&&x.status==='emitida'&&x.include_in_income&&inRange(x.issue_date,from,to)&&(store==='all'||x.store_id===store)),x=>N(x.total_amount));
 const adjustments=sum(O.incomeAdjustments.filter(x=>inRange(x.income_date,from,to)&&(store==='all'||x.store_id===store)),x=>N(x.amount));
 return closings+invoices+adjustments;
}

function deductibleExpenseTotal(from,to,store='all'){
 const linesByExpense=new Map();
 O.expenseLines.forEach(l=>{
  if(!linesByExpense.has(l.expense_id))linesByExpense.set(l.expense_id,[]);
  linesByExpense.get(l.expense_id).push(l);
 });
 let total=0;
 O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store)).forEach(e=>{
  const lines=linesByExpense.get(e.id)||[];
  if(lines.length)total+=sum(lines,l=>l.deductible_irpf===false||l.fixed_asset?0:N(l.irpf_imputable));
  else if(e.deductible_irpf!==false)total+=N(e.accounting_amount||e.gross_expense);
 });
 total+=sum(O.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,from,to)&&['gasto_deducible_extra','amortizacion'].includes(x.kind)),x=>N(x.amount));
 return total;
}

function internalExpenseTotal(from,to,store='all'){
 return sum(O.expenses.filter(e=>e.management_only&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store)),e=>N(e.accounting_amount||e.gross_expense||e.amount_paid));
}

function taxSettled(s){return['pagado','compensado'].includes(String(s||''))}
function taxPaymentTotal(model,y,q){
 return sum((O.taxPayments||[]).filter(t=>t.tax_type===model&&t.fiscal_year===y&&N(t.quarter)===q&&taxSettled(t.status)),t=>N(t.amount));
}
function retainedModel(model,from,to){
 const ids=new Set(O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)).map(e=>e.id));
 return sum(O.expenseLines.filter(l=>ids.has(l.expense_id)&&l.withholding_model===model),l=>N(l.withholding_amount));
}
function fiscalProjection(y=O.year,q=O.quarter,extraExpense=0){
 const from=`${y}-01-01`,qb=qBounds(y,q),end=qb.end;
 const income=incomeTotal(from,end),expenses=deductibleExpenseTotal(from,end)+N(extraExpense),pre=income-expenses;
 const diffEnabled=O.settings?.difficult_expense_enabled!==false,pct=N(O.settings?.difficult_expense_pct||5),cap=N(O.settings?.difficult_expense_annual_cap||2000);
 const difficult=diffEnabled&&pre>0?Math.min(pre*pct/100,cap):0;
 const net=pre-difficult,rate=N(O.settings?.irpf_prepayment_rate||20),gross=Math.max(0,net)*rate/100;
 const prev=sum((O.taxPayments||[]).filter(t=>t.tax_type==='130'&&t.fiscal_year===y&&N(t.quarter)<q&&taxSettled(t.status)),t=>N(t.amount));
 const supported=sum(O.fiscalAdjustments.filter(a=>a.kind==='retencion_soportada'&&inRange(a.adjustment_date,from,end)),a=>N(a.amount));
 const calc130=Math.max(0,gross-prev-supported),paid130=taxPaymentTotal('130',y,q);
 const m111=retainedModel('111',qb.start,qb.end),m115=retainedModel('115',qb.start,qb.end);
 const paid111=taxPaymentTotal('111',y,q),paid115=taxPaymentTotal('115',y,q);
 return{
  income,expenses,difficult,net,gross,prev,supported,
  payable130:Math.max(0,calc130-paid130),
  model111:Math.max(0,m111-paid111),
  model115:Math.max(0,m115-paid115),
  reserve:Math.max(0,calc130-paid130)+Math.max(0,m111-paid111)+Math.max(0,m115-paid115),
  qIncome:incomeTotal(qb.start,qb.end),
  qExpense:deductibleExpenseTotal(qb.start,qb.end)
 };
}

function fiscalSnapshot(){
 const f=fiscalProjection(),b=qBounds(O.year,O.quarter);
 const stores=O.stores.filter(s=>s.active!==false).map(s=>{
  const income=incomeTotal(b.start,b.end,s.id);
  const expense=deductibleExpenseTotal(b.start,b.end,s.id)+internalExpenseTotal(b.start,b.end,s.id);
  return{id:s.id,name:s.name,income,expense,result:income-expense,expenseSource:'Datos actuales de Totus'};
 });
 return{
  year:O.year,quarter:O.quarter,payable130:f.payable130,model111:f.model111,model115:f.model115,reserve:f.reserve,
  fiscalIncome:f.qIncome,fiscalExpense:f.qExpense,fiscalResult:f.qIncome-f.qExpense,
  operationalIncome:sum(stores,x=>x.income),operationalExpense:sum(stores,x=>x.expense),operationalResult:sum(stores,x=>x.result),stores
 };
}
window.__opsHomeFiscalSnapshot=fiscalSnapshot;

function summaryHtml(){
 const b=qBounds(O.year,O.quarter),income=incomeTotal(b.start,b.end),fiscal=deductibleExpenseTotal(b.start,b.end),internal=internalExpenseTotal(b.start,b.end),f=fiscalProjection();
 return `<div class="ops-kpis">
  <div class="ops-kpi"><small>Ingresos T${O.quarter}</small><strong>${euro(income)}</strong></div>
  <div class="ops-kpi"><small>Gastos fiscales</small><strong>${euro(fiscal)}</strong></div>
  <div class="ops-kpi"><small>Gastos internos</small><strong>${euro(internal)}</strong></div>
  <div class="ops-kpi ${income-fiscal-internal>=0?'good':'bad'}"><small>Resultado real</small><strong>${euro(income-fiscal-internal)}</strong></div>
  <div class="ops-kpi warn"><small>Reserva fiscal</small><strong>${euro(f.reserve)}</strong></div>
 </div>`;
}

function invoiceRows(){
 return O.invoices.filter(x=>{
  const mode=x.document_type==='proforma'?'proforma':(x.invoice_kind==='rectifying'?'rectificativa':'factura');
  const q=String(E.invoiceQuery||'').toLowerCase();
  const matches=!q||[x.display_number,x.customer_name,x.customer_tax_id,x.status].join(' ').toLowerCase().includes(q);
  const status=E.invoiceStatus==='all'||x.status===E.invoiceStatus;
  return mode===E.invoiceMode&&String(x.issue_date||'').startsWith(String(O.year))&&status&&matches&&(O.storeId==='all'||x.store_id===O.storeId);
 });
}
function invoiceListHtml(){
 const rows=invoiceRows();
 return `<div class="ops-card">
  <div class="section-head"><div><div class="eyebrow">Facturación</div><h3>Documentos de venta</h3><div class="small">Base limpia: borradores, facturas, rectificativas y proformas sin capas históricas.</div></div>${manager()?'<button class="primary" onclick="opsNewDocument(\'factura\')">+ Nueva factura</button>':''}</div>
  <div class="ops-list-toolbar">
   <div class="ops-list-search"><span>⌕</span><input aria-label="Buscar documentos de facturación" placeholder="Número, cliente o NIF/CIF" value="${H(E.invoiceQuery)}" oninput="opsInvoiceSearch(this.value)"></div>
   <select aria-label="Tipo de documento" onchange="opsInvoiceMode(this.value)"><option value="factura" ${E.invoiceMode==='factura'?'selected':''}>Facturas</option><option value="rectificativa" ${E.invoiceMode==='rectificativa'?'selected':''}>Rectificativas</option><option value="proforma" ${E.invoiceMode==='proforma'?'selected':''}>Proformas</option></select>
   <select aria-label="Estado de documento" onchange="opsInvoiceStatus(this.value)"><option value="all">Todos</option>${['borrador','emitida','aceptada','rechazada','convertida','anulada'].map(x=>`<option value="${x}" ${E.invoiceStatus===x?'selected':''}>${x}</option>`).join('')}</select>
  </div>
  ${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Estado</th><th>Total</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${H(x.issue_date||'')}</td><td><b>${H(x.display_number||'Borrador')}</b></td><td>${H(x.customer_name||'—')}</td><td>${statusBadge(x.status)}</td><td class="num"><b>${euro(x.total_amount)}</b></td><td><button class="ghost" onclick="opsPreviewInvoice('${x.id}')">Vista previa</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos registrados.</div>'}
 </div>`;
}
function blankInvoice(type='factura'){
 const series=O.series.find(s=>s.year===O.year&&s.active&&s.document_type===(type==='proforma'?'proforma':'factura')&&(type!=='rectificativa'||s.series_kind==='rectifying'))||O.series.find(s=>s.year===O.year&&s.active);
 return{documentType:type,seriesId:series?.id||'',storeId:O.storeId==='all'?'':O.storeId,date:today(),customer:'',taxId:'',email:'',address:'',description:'',qty:'1',price:'',vat:String(O.settings?.default_sales_vat_rate||21),payment:'transferencia',notes:''};
}
function invoiceFormHtml(){
 const d=E.invoiceDraft||blankInvoice(E.invoiceMode),base=N(d.qty)*N(d.price),vat=base*N(d.vat)/100,total=base+vat;
 return `<div class="ops-record-view"><div class="ops-record-back"><button class="ghost" onclick="opsInvoiceCancel()">← Volver a facturación</button></div><div class="ops-card">
  <div class="section-head"><div><div class="eyebrow">Borrador limpio</div><h3>${d.documentType==='proforma'?'Proforma':d.documentType==='rectificativa'?'Factura rectificativa':'Factura'}</h3></div><button class="primary" onclick="opsSaveInvoiceDraft()">Guardar borrador</button></div>
  <div class="ops-form">
   <div><label>Serie</label><select aria-label="Serie" onchange="opsInvoiceField('seriesId',this.value)">${O.series.filter(s=>s.year===O.year&&s.active).map(s=>`<option value="${s.id}" ${d.seriesId===s.id?'selected':''}>${H(s.code)}</option>`).join('')}</select></div>
   <div><label>Fecha</label><input type="date" max="${today()}" value="${H(d.date)}" onchange="opsInvoiceField('date',this.value)"></div>
   <div><label>Establecimiento</label><select onchange="opsInvoiceField('storeId',this.value)"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div>
   <div><label>Forma de pago</label><select onchange="opsInvoiceField('payment',this.value)">${['transferencia','efectivo','tarjeta','bizum','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div>
   <div class="span2"><label>Cliente</label><input value="${H(d.customer)}" oninput="opsInvoiceField('customer',this.value)"></div>
   <div><label>NIF/CIF</label><input value="${H(d.taxId)}" oninput="opsInvoiceField('taxId',this.value)"></div>
   <div><label>Email</label><input type="email" value="${H(d.email)}" oninput="opsInvoiceField('email',this.value)"></div>
   <div class="span4"><label>Dirección</label><input value="${H(d.address)}" oninput="opsInvoiceField('address',this.value)"></div>
   <div class="span2"><label>Concepto</label><input value="${H(d.description)}" oninput="opsInvoiceField('description',this.value,true)"></div>
   <div><label>Cantidad</label><input inputmode="decimal" value="${H(d.qty)}" oninput="opsInvoiceField('qty',this.value,true)"></div>
   <div><label>Precio base</label><input inputmode="decimal" value="${H(d.price)}" oninput="opsInvoiceField('price',this.value,true)"></div>
   <div><label>IVA %</label><input inputmode="decimal" value="${H(d.vat)}" oninput="opsInvoiceField('vat',this.value,true)"></div>
   <div class="span3"><label>Notas</label><textarea oninput="opsInvoiceField('notes',this.value)">${H(d.notes)}</textarea></div>
  </div>
  <div class="ops-kpis" style="margin-top:14px"><div class="ops-kpi"><small>Base</small><strong>${euro(base)}</strong></div><div class="ops-kpi"><small>IVA</small><strong>${euro(vat)}</strong></div><div class="ops-kpi"><small>Total</small><strong>${euro(total)}</strong></div></div>
 </div></div>`;
}
window.opsInvoiceMode=v=>{E.invoiceMode=v;E.invoiceView='list';E.invoiceDraft=null;render()};
window.opsInvoiceSearch=v=>{E.invoiceQuery=v;render()};
window.opsInvoiceStatus=v=>{E.invoiceStatus=v;render()};
window.opsNewDocument=function(type='factura'){if(!manager())return;E.invoiceMode=type;E.invoiceView='form';E.invoiceDraft=blankInvoice(type);render()};
window.opsInvoiceCancel=function(){E.invoiceView='list';E.invoiceDraft=null;render()};
window.opsInvoiceField=function(k,v,re=false){if(!E.invoiceDraft)E.invoiceDraft=blankInvoice(E.invoiceMode);E.invoiceDraft[k]=v;if(re)render()};
window.opsSaveInvoiceDraft=async function(){
 const d=E.invoiceDraft;if(!d||!d.seriesId||!d.date||!d.customer.trim()||!d.description.trim())return alert('Serie, fecha, cliente y concepto son obligatorios.');
 const base=N(d.qty)*N(d.price),vat=base*N(d.vat)/100,total=base+vat;
 const row={series_id:d.seriesId,store_id:d.storeId||null,issue_date:d.date,document_type:d.documentType==='proforma'?'proforma':'factura',invoice_kind:d.documentType==='rectificativa'?'rectifying':'invoice',status:'borrador',customer_name:d.customer.trim(),customer_tax_id:d.taxId.trim(),customer_address:d.address.trim(),customer_email:d.email.trim(),concept:d.description.trim(),payment_method:d.payment,base_amount:base,vat_amount:vat,total_amount:total,notes:d.notes||'',created_by:authSession?.user?.id||null,updated_at:new Date().toISOString()};
 const ins=await sb.from('ops_sales_invoices').insert(row).select().single();
 if(ins.error)return alert(ins.error.message);
 const li=await sb.from('ops_sales_invoice_lines').insert({invoice_id:ins.data.id,sort_order:10,description:d.description.trim(),quantity:N(d.qty)||1,unit_price_base:N(d.price),discount_pct:0,vat_rate:N(d.vat),base_amount:base,vat_amount:vat,total_amount:total});
 if(li.error){await sb.from('ops_sales_invoices').delete().eq('id',ins.data.id);return alert(li.error.message)}
 await audit('facturas','crear_borrador',ins.data.id,{tipo:d.documentType,total});
 await window.opsLoadData(true);E.invoiceView='list';E.invoiceDraft=null;render();
};
window.opsPreviewInvoice=function(id){
 const x=O.invoices.find(v=>v.id===id);if(!x)return;
 const html=`<div class="ops-help-copy"><b>${H(x.display_number||'Borrador')}</b><br>${H(x.customer_name||'')} · ${euro(x.total_amount)}<br>Fecha: ${H(x.issue_date||'')} · Estado: ${H(x.status||'')}</div><div class="ops-preview-actions"><button class="primary" id="ops_preview_close">Cerrar</button></div>`;
 const m=openOpsModal('Vista previa de documento',html);m.querySelector('#ops_preview_close').onclick=closeOpsModal;
};

function documentsHtml(){
 const rows=O.documents.slice().sort((a,b)=>String(b.document_date||'').localeCompare(String(a.document_date||'')));
 return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Archivo</div><h3>Documentos</h3><div class="small">Archivo documental limpio. Sin importaciones históricas ni copias automáticas.</div></div></div>
 ${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Proveedor / cliente</th><th>Número</th><th>Archivo</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td>${H(d.document_date||'')}</td><td>${H(d.doc_type||'')}</td><td>${H(d.supplier_or_customer||'')}</td><td>${H(d.invoice_number||'')}</td><td>${H(d.original_name||'')}</td><td><button class="ghost" onclick="opsPreviewDoc('${d.id}')">Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos archivados.</div>'}</div>`;
}
window.opsPreviewDoc=async function(id){
 const d=O.documents.find(x=>x.id===id);if(!d)return;
 const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);
 if(error)return alert(error.message);
 const url=URL.createObjectURL(data);
 const m=openOpsModal(d.original_name||'Documento',`<iframe class="ops-pdf-frame" src="${url}" title="Vista previa"></iframe><div class="ops-preview-actions"><button class="primary" id="ops_doc_close">Cerrar</button></div>`,true);
 m.querySelector('#ops_doc_close').onclick=()=>{URL.revokeObjectURL(url);closeOpsModal()};
};

function fiscalHtml(){
 const f=fiscalProjection(),b=qBounds(O.year,O.quarter),internal=internalExpenseTotal(b.start,b.end);
 return `<div class="ops-kpis">
  <div class="ops-kpi"><small>Ingresos T${O.quarter}</small><strong>${euro(f.qIncome)}</strong></div>
  <div class="ops-kpi"><small>Gastos fiscales T${O.quarter}</small><strong>${euro(f.qExpense)}</strong></div>
  <div class="ops-kpi"><small>Control interno fuera de fiscalidad</small><strong>${euro(internal)}</strong></div>
  <div class="ops-kpi warn"><small>Modelo 130 pendiente</small><strong>${euro(f.payable130)}</strong></div>
  <div class="ops-kpi warn"><small>Reserva total</small><strong>${euro(f.reserve)}</strong><div class="sub">111 ${euro(f.model111)} · 115 ${euro(f.model115)}</div></div>
 </div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Cálculo actual</div><h3>Fiscalidad sin fuentes heredadas</h3><div class="small">Solo usa cierres, facturas, gastos, ajustes y modelos registrados actualmente en Totus.</div></div></div></div>`;
}

function csvBlob(rows){
 const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\n');
 return new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
}
window.opsReportField=function(k,v){if(k==='from')E.reportFrom=v;else E.reportTo=v;if(E.reportFrom>E.reportTo){if(k==='from')E.reportTo=v;else E.reportFrom=v}render()};
window.opsExportCleanReport=function(kind){
 const from=E.reportFrom,to=E.reportTo;
 if(kind==='cajas'){
  const rows=[['Fecha','Tienda','Efectivo','Tarjeta','Bizum','Online','Otros','Total']];
  O.closings.filter(x=>inRange(x.business_date,from,to)).forEach(x=>rows.push([x.business_date,storeName(x.store_id),N(x.cash_sales),N(x.card_sales),N(x.bizum_sales),N(x.online_sales),N(x.other_income),N(x.cash_sales)+N(x.card_sales)+N(x.bizum_sales)+N(x.online_sales)+N(x.other_income)]));
  dlBlob(csvBlob(rows),`cajas_${from}_${to}.csv`);
 }else if(kind==='gastos'){
  const rows=[['Fecha','Tienda','Proveedor','Factura','Importe','Interno']];
  O.expenses.filter(x=>inRange(x.expense_date,from,to)).forEach(x=>rows.push([x.expense_date,storeName(x.store_id),x.supplier_name||'',x.invoice_number||'',N(x.accounting_amount||x.gross_expense),x.management_only?'Sí':'No']));
  dlBlob(csvBlob(rows),`gastos_${from}_${to}.csv`);
 }else{
  const rows=[['Fecha','Número','Cliente','Estado','Total']];
  O.invoices.filter(x=>inRange(x.issue_date,from,to)).forEach(x=>rows.push([x.issue_date,x.display_number||'',x.customer_name||'',x.status||'',N(x.total_amount)]));
  dlBlob(csvBlob(rows),`facturas_${from}_${to}.csv`);
 }
};
function reportsHtml(){
 return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Periodo</div><h3>Informes</h3><div class="small">Exportación directa de los datos actuales. Sin fuentes históricas mezcladas.</div></div></div><div class="ops-form"><div><label>Desde</label><input aria-label="Informe desde" type="date" value="${H(E.reportFrom)}" onchange="opsReportField('from',this.value)"></div><div><label>Hasta</label><input aria-label="Informe hasta" type="date" value="${H(E.reportTo)}" onchange="opsReportField('to',this.value)"></div></div><div class="ops-actions" style="margin-top:14px"><button class="secondary" onclick="opsExportCleanReport('cajas')">Cajas CSV</button><button class="secondary" onclick="opsExportCleanReport('gastos')">Gastos CSV</button><button class="secondary" onclick="opsExportCleanReport('facturas')">Facturas CSV</button></div></div>`;
}

function configHtml(){
 if(!admin())return '<div class="ops-card">Solo administración puede modificar configuración.</div>';
 const s=O.settings||{};
 return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Empresa</div><h3>Configuración general</h3><div class="small">Un único sitio para datos fiscales y parámetros globales.</div></div><button class="primary" onclick="opsSaveCleanSettings()">Guardar</button></div><div class="ops-form">
  <div class="span2"><label>Titular / empresa</label><input id="clean_business_name" value="${H(s.business_name||'')}"></div>
  <div><label>NIF/CIF</label><input id="clean_tax_id" value="${H(s.tax_id||'')}"></div>
  <div><label>Email</label><input id="clean_email" value="${H(s.business_email||'')}"></div>
  <div class="span4"><label>Dirección fiscal</label><input id="clean_address" value="${H(s.business_address||'')}"></div>
  <div><label>IRPF %</label><input id="clean_irpf" inputmode="decimal" value="${H(s.irpf_prepayment_rate||20)}"></div>
  <div><label>IVA venta %</label><input id="clean_vat" inputmode="decimal" value="${H(s.default_sales_vat_rate||21)}"></div>
  <div><label>Difícil justificación %</label><input id="clean_diff" inputmode="decimal" value="${H(s.difficult_expense_pct||5)}"></div>
  <div><label>Límite difícil justificación</label><input id="clean_diff_cap" inputmode="decimal" value="${H(s.difficult_expense_annual_cap||2000)}"></div>
 </div></div>`;
}
window.opsSaveCleanSettings=async function(){
 const row={
  business_name:document.getElementById('clean_business_name')?.value?.trim()||'',
  tax_id:document.getElementById('clean_tax_id')?.value?.trim()||'',
  business_email:document.getElementById('clean_email')?.value?.trim()||'',
  business_address:document.getElementById('clean_address')?.value?.trim()||'',
  irpf_prepayment_rate:N(document.getElementById('clean_irpf')?.value),
  default_sales_vat_rate:N(document.getElementById('clean_vat')?.value),
  difficult_expense_pct:N(document.getElementById('clean_diff')?.value),
  difficult_expense_annual_cap:N(document.getElementById('clean_diff_cap')?.value),
  updated_at:new Date().toISOString()
 };
 const {error}=await sb.from('ops_business_settings').update(row).eq('id',O.settings?.id||1);
 if(error)return alert(error.message);
 await audit('config','actualizar',null,{campos:Object.keys(row)});
 await window.opsLoadData(true);render();
};

function logHtml(){
 if(!manager())return '<div class="ops-card">Sin acceso.</div>';
 const rows=(E.auditRows||[]).slice(0,300);
 return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trazabilidad</div><h3>Log</h3><div class="small">Actividad generada por la versión actual.</div></div></div>${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Área</th><th>Acción</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${H(new Date(x.created_at).toLocaleString('es-ES'))}</td><td>${H(x.user_email||'')}</td><td>${H(x.area||'')}</td><td>${H(x.action||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">Sin actividad todavía.</div>'}</div>`;
}

function body(tab){
 if(!E.loaded)return null;
 if(tab==='resumen')return summaryHtml();
 if(tab==='facturas')return E.invoiceView==='form'?invoiceFormHtml():invoiceListHtml();
 if(tab==='documentos')return documentsHtml();
 if(tab==='fiscal')return fiscalHtml();
 if(tab==='informes')return reportsHtml();
 if(tab==='config')return configHtml();
 if(tab==='log')return logHtml();
 return null;
}

window.TotusGestionFeatures={load,body};
window.__TotusOpsTest={incomeTotal,deductibleExpenseTotal,fiscalProjection};

})();