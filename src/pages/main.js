import {state,isAdmin,isManager,patchFilters} from '../state.js';
import {sum,money,fmtDate,inRange,monthRange,isoToday,esc} from '../utils.js';
import {kpi,table,dateFilters,btn,dateCell,moneyCell,stateBadge,modal,toast,formField,selectField} from '../components.js';
import {rpc,select,insert,update,remove} from '../api.js';

const stores=()=>state.data.stores.filter(x=>x.active!==false);
const storeName=id=>stores().find(x=>x.id===id)?.name||'—';

export function inicio(){
 const today=isoToday();
 const todays=state.data.closings.filter(x=>x.business_date===today);
 const month=monthRange(today);
 const monthClosings=state.data.closings.filter(x=>inRange(x.business_date,month.from,month.to));
 const monthExpenses=state.data.expenses.filter(x=>inRange(x.expense_date,month.from,month.to));
 const sales=sum(monthClosings,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
 const expenses=sum(monthExpenses,x=>x.gross_expense||x.accounting_amount||x.amount_paid||0);
 const pendingInv=state.data.invoices.filter(x=>x.status==='borrador').length;
 const recent=[...state.data.documents].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,6);
 return `<div class="page">
  <div class="kpis">
   ${kpi('Ventas este mes',money(sales),`${month.from.split('-').reverse().join('/')} → ${month.to.split('-').reverse().join('/')}`)}
   ${kpi('Gastos este mes',money(expenses))}
   ${kpi('Resultado operativo',money(sales-expenses))}
   ${kpi('Facturas en borrador',String(pendingInv))}
  </div>
  <div class="split">
   <section class="card card-pad"><div class="section-head"><div><h2>Cierres de hoy</h2><p>Estado actual por establecimiento.</p></div>${btn('Nuevo cierre','closing-new','primary')}</div>
    <div class="stack" style="margin-top:14px">${stores().map(s=>{const c=todays.find(x=>x.store_id===s.id);return `<div class="summary-row"><div><b>${esc(s.name)}</b><div class="small muted">${c?fmtDate(c.business_date):'Sin cierre registrado'}</div></div><div>${c?stateBadge(c.status):'<span class="badge warn">Pendiente</span>'}</div></div>`}).join('')}</div>
   </section>
   <section class="card card-pad"><div class="section-head"><div><h2>Acciones rápidas</h2><p>Lo más habitual, sin menús extra.</p></div></div>
    <div class="stack" style="margin-top:14px">
     ${btn('Registrar gasto','expense-new','primary')}
     ${btn('Crear factura','invoice-new','secondary')}
     ${btn('Subir documento','document-new','secondary')}
    </div>
   </section>
  </div>
  <section class="card card-pad"><div class="section-head"><div><h2>Documentos recientes</h2><p>Últimos archivos archivados.</p></div></div>
   <div style="margin-top:12px">${recent.length?recent.map(d=>`<div class="summary-row"><div><b>${esc(d.original_name||'Documento')}</b><div class="small muted">${esc(d.supplier_or_customer||d.doc_type||'')} · ${fmtDate(d.document_date)}</div></div><div>${stateBadge(d.status)}</div></div>`).join(''):'<div class="empty"><strong>Sin documentos</strong><span>Todavía no has archivado documentos.</span></div>'}</div>
  </section>
 </div>`;
}

export function cajas(){
 const f=state.filters;
 const rows=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.notes,storeName(x.store_id),x.status].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const total=sum(rows,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
 const headers=[
  {label:'Fecha',html:r=>dateCell(r.business_date)},{label:'Tienda',html:r=>esc(storeName(r.store_id))},
  {label:'Efectivo',num:true,html:r=>moneyCell(r.cash_sales)},{label:'Tarjeta',num:true,html:r=>moneyCell(r.card_sales)},
  {label:'Bizum',num:true,html:r=>moneyCell(r.bizum_sales)},{label:'Online',num:true,html:r=>moneyCell(r.online_sales)},
  {label:'Total',num:true,html:r=>moneyCell(Number(r.cash_sales||0)+Number(r.card_sales||0)+Number(r.bizum_sales||0)+Number(r.online_sales||0)+Number(r.other_income||0))},
  {label:'Estado',html:r=>stateBadge(r.status)},{label:'',html:r=>`<div class="inline-actions">${btn('Ver','closing-edit','secondary',`data-id="${r.id}"`)}</div>`}
 ];
 return `<div class="page"><div class="kpis">${kpi('Cierres',String(rows.length))}${kpi('Ventas filtradas',money(total))}${kpi('Efectivo',money(sum(rows,x=>x.cash_sales)))}${kpi('Tarjeta + Bizum',money(sum(rows,x=>Number(x.card_sales||0)+Number(x.bizum_sales||0))))}</div>
  <section class="card table-card"><div class="section-head card-pad"><div><h2>Cajas</h2><p>Cierres diarios con fechas reales y filtros Desde/Hasta.</p></div>${btn('Nuevo cierre','closing-new','primary')}</div>
  ${dateFilters({...f,stores:stores()},'cajas')}
  ${table(headers,rows,{emptyTitle:'No hay cierres',emptyText:'No existen cierres para las fechas seleccionadas.'})}</section></div>`;
}

export function gastos(){
 const f=state.filters;
 const rows=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.supplier_name,x.invoice_number,x.description,x.payment_method].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const headers=[
  {label:'Fecha',html:r=>dateCell(r.expense_date)},{label:'Proveedor',html:r=>esc(r.supplier_name||'—')},{label:'Factura',html:r=>esc(r.invoice_number||'—')},
  {label:'Descripción',html:r=>esc(r.description||'—')},{label:'Importe',num:true,html:r=>moneyCell(r.gross_expense||r.amount_paid||r.accounting_amount)},
  {label:'Pago',html:r=>esc(r.payment_method||'—')},{label:'Estado',html:r=>stateBadge(r.paid_status||'registrado')},{label:'',html:r=>btn('Ver','expense-edit','secondary',`data-id="${r.id}"`)}
 ];
 return `<div class="page"><div class="kpis">${kpi('Gastos',String(rows.length))}${kpi('Total filtrado',money(sum(rows,x=>x.gross_expense||x.amount_paid||x.accounting_amount)))}${kpi('Pagados',String(rows.filter(x=>x.paid_status==='pagado').length))}${kpi('Pendientes',String(rows.filter(x=>x.paid_status!=='pagado').length))}</div>
  <section class="card table-card"><div class="section-head card-pad"><div><h2>Gastos</h2><p>Registro único, ordenado y sin formularios duplicados.</p></div>${btn('Nuevo gasto','expense-new','primary')}</div>
  ${dateFilters({...f,stores:stores()},'gastos')}
  ${table(headers,rows,{emptyTitle:'No hay gastos',emptyText:'No existen gastos para las fechas seleccionadas.'})}</section></div>`;
}

export function facturacion(){
 const f=state.filters;
 const rows=state.data.invoices.filter(x=>inRange(x.issue_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.display_number,x.customer_name,x.customer_tax_id,x.concept,x.status].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const headers=[
  {label:'Fecha',html:r=>dateCell(r.issue_date)},{label:'Número',html:r=>esc(r.display_number||'Borrador')},{label:'Tipo',html:r=>esc(r.document_type||'factura')},
  {label:'Cliente',html:r=>esc(r.customer_name||'—')},{label:'Total',num:true,html:r=>moneyCell(r.total_amount)},{label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>btn('Ver','invoice-edit','secondary',`data-id="${r.id}"`)}
 ];
 return `<div class="page"><div class="kpis">${kpi('Documentos',String(rows.length))}${kpi('Total',money(sum(rows,x=>x.total_amount)))}${kpi('Emitidas',String(rows.filter(x=>x.status==='emitida').length))}${kpi('Borradores',String(rows.filter(x=>x.status==='borrador').length))}</div>
  <section class="card table-card"><div class="section-head card-pad"><div><h2>Facturación</h2><p>Facturas y proformas en una lista clara.</p></div><div class="inline-actions">${btn('Nueva factura','invoice-new','primary')}${btn('Nueva proforma','proforma-new','secondary')}</div></div>
  ${dateFilters({...f,stores:stores()},'facturas')}
  ${table(headers,rows,{emptyTitle:'No hay documentos',emptyText:'No existen facturas o proformas para estas fechas.'})}</section></div>`;
}

export function documentos(){
 const f=state.filters;
 const rows=state.data.documents.filter(x=>inRange(x.document_date||x.created_at,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.original_name,x.supplier_or_customer,x.invoice_number,x.doc_type].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const headers=[
  {label:'Fecha',html:r=>dateCell(r.document_date||r.created_at)},{label:'Archivo',html:r=>esc(r.original_name||'—')},{label:'Tipo',html:r=>esc(r.doc_type||'—')},
  {label:'Proveedor / cliente',html:r=>esc(r.supplier_or_customer||'—')},{label:'Estado',html:r=>stateBadge(r.status)},{label:'',html:r=>`<div class="inline-actions">${btn('Ver','document-preview','secondary',`data-id="${r.id}"`)}</div>`}
 ];
 return `<div class="page"><section class="card table-card"><div class="section-head card-pad"><div><h2>Documentos</h2><p>Archivo documental centralizado.</p></div>${btn('Subir documento','document-new','primary')}</div>
 ${dateFilters({...f,stores:stores()},'documentos')}
 ${table(headers,rows,{emptyTitle:'No hay documentos',emptyText:'No existen documentos para estas fechas.'})}</section></div>`;
}

export function fiscalidad(){
 const f=state.filters;
 const closings=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const expenses=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const income=sum(closings,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))+sum(state.data.incomeAdjustments.filter(x=>inRange(x.income_date,f.from,f.to)),x=>x.amount);
 const expense=sum(expenses,x=>x.accounting_amount||x.gross_expense||x.amount_paid);
 const result=income-expense;
 const prepay=Math.max(0,result*Number(state.data.settings?.irpf_prepayment_rate||20)/100);
 return `<div class="page">
  <section class="card">${dateFilters({...f,stores:stores()},'fiscal')}</section>
  <div class="kpis">${kpi('Ingresos',money(income))}${kpi('Gastos',money(expense))}${kpi('Resultado',money(result))}${kpi('IRPF estimado',money(prepay),'Estimación orientativa')}</div>
  <div class="split"><section class="card card-pad"><h2>Resumen fiscal</h2><div class="summary-row"><span>Periodo</span><strong>${fmtDate(f.from)} → ${fmtDate(f.to)}</strong></div><div class="summary-row"><span>Ingresos registrados</span><strong>${money(income)}</strong></div><div class="summary-row"><span>Gastos registrados</span><strong>${money(expense)}</strong></div><div class="summary-row"><span>Resultado previo</span><strong>${money(result)}</strong></div><div class="summary-row"><span>Tipo configurado modelo 130</span><strong>${Number(state.data.settings?.irpf_prepayment_rate||20)} %</strong></div></section>
  <section class="card card-pad"><h2>Modelos y pagos</h2>${state.data.taxPayments.length?state.data.taxPayments.slice(0,10).map(x=>`<div class="summary-row"><div><b>${esc(x.tax_type)}</b><div class="small muted">${esc(x.period_label||'')} · ${fmtDate(x.payment_date)}</div></div><strong>${money(x.amount)}</strong></div>`).join(''):'<div class="empty"><strong>Sin pagos fiscales</strong><span>No hay registros.</span></div>'}</section></div>
 </div>`;
}

export function informes(){
 const f=state.filters;
 const c=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const g=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 return `<div class="page"><section class="card">${dateFilters({...f,stores:stores()},'informes')}</section>
 <div class="kpis">${kpi('Cierres',String(c.length))}${kpi('Gastos',String(g.length))}${kpi('Ventas',money(sum(c,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))))}${kpi('Gastos',money(sum(g,x=>x.gross_expense||x.amount_paid||x.accounting_amount)))}</div>
 <section class="card card-pad"><div class="section-head"><div><h2>Exportaciones</h2><p>Genera informes usando el periodo exacto seleccionado.</p></div></div><div class="toolbar" style="margin-top:16px">${btn('Excel de cierres','export-closings','primary')}${btn('Excel de gastos','export-expenses','secondary')}${btn('Resumen del periodo','export-summary','secondary')}</div></section></div>`;
}

export function usuarios(){
 if(!isAdmin())return '<div class="page"><div class="card card-pad"><h2>Sin acceso</h2></div></div>';
 const rows=state.data.team;
 const headers=[{label:'Nombre',html:r=>esc(r.full_name)},{label:'Email',html:r=>esc(r.email)},{label:'Rol',html:r=>esc(r.role)},{label:'Estado',html:r=>stateBadge(r.active?'activo':'inactivo')},{label:'',html:r=>btn('Editar','user-edit','secondary',`data-email="${esc(r.email)}"`)}];
 return `<div class="page"><section class="card table-card"><div class="section-head card-pad"><div><h2>Usuarios</h2><p>Accesos y permisos de Totus Central.</p></div>${btn('Nuevo usuario','user-new','primary')}</div>${table(headers,rows,{emptyTitle:'Sin usuarios'})}</section></div>`;
}

export function configuracion(){
 if(!isManager())return '<div class="page"><div class="card card-pad"><h2>Sin acceso</h2></div></div>';
 const s=state.data.settings||{};
 return `<div class="page"><div class="split">
 <section class="card card-pad"><h2>Negocio</h2><div class="form-grid" style="margin-top:14px">
 ${formField('Nombre / razón fiscal','cfgBusiness',s.business_name||'')}
 ${formField('NIF','cfgTax',s.tax_id||'')}
 ${formField('Dirección','cfgAddress',s.business_address||'')}
 ${formField('Email','cfgEmail',s.business_email||'','email')}
 ${formField('Teléfono','cfgPhone',s.business_phone||'')}
 ${formField('Límite documental (MB)','cfgStorage',Math.round(Number(s.storage_limit_bytes||524288000)/1024/1024),'number')}
 </div><div class="form-actions">${btn('Guardar configuración','config-save','primary')}</div></section>
 <section class="card card-pad"><h2>Fiscalidad</h2><div class="form-grid" style="margin-top:14px">
 ${formField('IVA ventas (%)','cfgVat',s.default_sales_vat_rate??21,'number','step="0.1"')}
 ${formField('Pago fraccionado IRPF (%)','cfgIrpf',s.irpf_prepayment_rate??20,'number','step="0.1"')}
 ${formField('Cuota RETA actual','cfgReta',s.actual_reta_monthly??'','number','step="0.01"')}
 ${formField('Margen operativo objetivo (%)','cfgMargin',s.target_operating_margin_pct??15,'number','step="0.1"')}
 </div></section></div></div>`;
}

export function log(){
 if(!isManager())return '<div class="page"><div class="card card-pad"><h2>Sin acceso</h2></div></div>';
 const headers=[{label:'Fecha',html:r=>esc(new Date(r.created_at).toLocaleString('es-ES'))},{label:'Usuario',html:r=>esc(r.user_email||'—')},{label:'Área',html:r=>esc(r.area)},{label:'Acción',html:r=>esc(r.action)},{label:'Detalle',html:r=>`<span class="small">${esc(JSON.stringify(r.detail||{}))}</span>`}];
 return `<div class="page"><section class="card table-card"><div class="section-head card-pad"><div><h2>Log</h2><p>Trazabilidad técnica y administrativa.</p></div></div>${table(headers,state.data.audit,{emptyTitle:'Sin registros'})}</section></div>`;
}

export function pricing(){
 const q=state.filters.query.toLowerCase();
 const rows=state.data.products.filter(x=>!q||[x.name,x.sku,x.status].join(' ').toLowerCase().includes(q));
 const familyName=id=>state.data.families.find(x=>x.id===id)?.name||'—';
 const costOf=p=>{const list=state.data.providerPrices.filter(x=>x.product_id===p.id);return list.length?Math.min(...list.map(x=>Number(x.net_cost||0)+Number(x.shipping_unit||0)+Number(x.special_tax_amount||0))):0};
 const headers=[{label:'Producto',html:r=>`<b>${esc(r.name)}</b><div class="small muted">${esc(r.sku)}</div>`},{label:'Familia',html:r=>esc(familyName(r.family_id))},{label:'Coste',num:true,html:r=>moneyCell(costOf(r))},{label:'PVP',num:true,html:r=>moneyCell(r.current_pvp||r.proposed_pvp)},{label:'Margen',num:true,html:r=>{const p=Number(r.current_pvp||r.proposed_pvp||0),c=costOf(r);return p?((p/1.21-c)/(p/1.21)*100).toFixed(1).replace('.',',')+' %':'—'}},{label:'Estado',html:r=>stateBadge(r.status)},{label:'',html:r=>btn('Editar','product-edit','secondary',`data-id="${r.id}"`)}];
 return `<div class="page"><div class="kpis">${kpi('Productos',String(rows.length))}${kpi('Familias',String(state.data.families.length))}${kpi('Proveedores',String(state.data.providers.length))}${kpi('Consultas',String(state.data.consultations.length))}</div>
 <section class="card table-card"><div class="section-head card-pad"><div><h2>Pricing</h2><p>Costes, PVP, margen, proveedores y competencia.</p></div>${btn('Nuevo producto','product-new','primary')}</div><div class="filters"><div class="field search"><label>Buscar</label><input id="pricingQuery" value="${esc(state.filters.query)}" placeholder="Producto, referencia o estado"></div>${btn('Buscar','pricing-search','primary')}</div>${table(headers,rows,{emptyTitle:'Sin productos',emptyText:'Todavía no hay productos registrados.'})}</section></div>`;
}

export const renderers={inicio,pricing,cajas,gastos,facturacion,documentos,fiscalidad,informes,usuarios,configuracion,log};

export function openingCash(storeId){
 const previous=state.data.closings.filter(x=>x.store_id===storeId&&x.status==='cerrado').sort((a,b)=>String(b.business_date).localeCompare(String(a.business_date)))[0];
 return Number(previous?.actual_cash||0);
}

export function closingModal(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const sid=row?.store_id||storeOptions[0]?.value||'';
 const body=`<div class="form-grid">
 ${selectField('Tienda','clStore',storeOptions,sid)}
 ${formField('Fecha','clDate',row?.business_date||isoToday(),'date')}
 ${formField('Apertura efectivo','clOpening',row?.opening_cash??openingCash(sid),'number','step="0.01"')}
 ${formField('Efectivo final','clActual',row?.actual_cash??'','number','step="0.01"')}
 ${formField('Tarjeta','clCard',row?.card_sales??'','number','step="0.01"')}
 ${formField('Bizum','clBizum',row?.bizum_sales??'','number','step="0.01"')}
 ${formField('Pedidos online','clOnline',row?.online_sales??'','number','step="0.01"')}
 ${formField('Otros ingresos','clOther',row?.other_income??'','number','step="0.01"')}
 ${formField('Salidas de efectivo','clWithdraw',row?.cash_withdrawals??'','number','step="0.01"')}
 <label class="wide">Observaciones<textarea id="clNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="note">El efectivo vendido se calcula automáticamente: efectivo final + salidas − apertura.</div><div class="form-actions">${row?btn('Eliminar','closing-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar cierre','closing-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar cierre':'Nuevo cierre',body);
}

export function expenseModal(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const body=`<div class="form-grid">
 ${selectField('Tienda','exStore',storeOptions,row?.store_id||storeOptions[0]?.value||'')}
 ${formField('Fecha','exDate',row?.expense_date||isoToday(),'date')}
 ${formField('Proveedor','exSupplier',row?.supplier_name||'')}
 ${formField('NIF proveedor','exTax',row?.supplier_tax_id||'')}
 ${formField('Nº factura / justificante','exInvoice',row?.invoice_number||'')}
 ${selectField('Forma de pago','exPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'tarjeta')}
 ${formField('Base imponible','exBase',row?.base_amount??'','number','step="0.01"')}
 ${formField('IVA (%)','exVatRate',row?.vat_rate??21,'number','step="0.1"')}
 ${formField('Recargo (%)','exReRate',row?.re_rate??0,'number','step="0.1"')}
 ${formField('Retención (%)','exWhRate',row?.withholding_rate??0,'number','step="0.1"')}
 <label class="wide">Descripción<textarea id="exDesc" rows="3">${esc(row?.description||'')}</textarea></label>
 <label class="wide">Observaciones<textarea id="exNotes" rows="2">${esc(row?.notes||'')}</textarea></label>
 </div><div class="form-actions">${row?btn('Eliminar','expense-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar gasto','expense-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar gasto':'Nuevo gasto',body);
}

export function invoiceModal(row=null,type='factura'){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const series=state.data.series.filter(s=>s.active!==false&&s.document_type===type).map(s=>({value:s.id,label:s.code}));
 const body=`<div class="form-grid">
 ${selectField('Tienda','ivStore',storeOptions,row?.store_id||storeOptions[0]?.value||'')}
 ${selectField('Serie','ivSeries',series,row?.series_id||series[0]?.value||'')}
 ${formField('Fecha','ivDate',row?.issue_date||isoToday(),'date')}
 ${formField('Cliente','ivCustomer',row?.customer_name||'')}
 ${formField('NIF/CIF','ivTax',row?.customer_tax_id||'')}
 ${formField('Email','ivEmail',row?.customer_email||'','email')}
 <label class="wide">Dirección<textarea id="ivAddress" rows="2">${esc(row?.customer_address||'')}</textarea></label>
 ${formField('Concepto','ivConcept',row?.concept||'')}
 ${selectField('Forma de pago','ivPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'transferencia')}
 </div><div class="card" style="margin-top:16px"><div class="card-pad"><h3>Línea</h3><div class="form-grid" style="margin-top:12px">${formField('Descripción','ivLineDesc',state.data.invoiceLines.find(x=>x.invoice_id===row?.id)?.description||'')}${formField('Cantidad','ivQty',state.data.invoiceLines.find(x=>x.invoice_id===row?.id)?.quantity||1,'number','step="0.01"')}${formField('Precio sin IVA','ivUnit',state.data.invoiceLines.find(x=>x.invoice_id===row?.id)?.unit_price_base||'','number','step="0.01"')}${formField('IVA (%)','ivVat',state.data.invoiceLines.find(x=>x.invoice_id===row?.id)?.vat_rate||21,'number','step="0.1"')}</div></div></div>
 <div class="form-actions">${btn('Guardar borrador','invoice-save','primary',row?`data-id="${row.id}" data-type="${type}"`:`data-type="${type}"`)}${row?.status==='borrador'?btn(type==='proforma'?'Emitir proforma':'Emitir factura','invoice-finalize','secondary',`data-id="${row.id}"`):''}</div>`;
 modal(row?'Editar documento':(type==='proforma'?'Nueva proforma':'Nueva factura'),body);
}

export function productModal(row=null){
 const families=state.data.families.map(x=>({value:x.id,label:x.name}));
 const body=`<div class="form-grid">
 ${formField('Nombre','prName',row?.name||'')}
 ${formField('Referencia / SKU','prSku',row?.sku||'')}
 ${selectField('Familia','prFamily',[{value:'',label:'Sin familia'},...families],row?.family_id||'')}
 ${selectField('Tipo','prType',[{value:'simple',label:'Simple'},{value:'variants',label:'Con variantes'}],row?.product_type||'simple')}
 ${formField('PVP actual','prPvp',row?.current_pvp??'','number','step="0.01"')}
 ${formField('PVP propuesto','prProposed',row?.proposed_pvp??'','number','step="0.01"')}
 <label class="wide">Notas<textarea id="prNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div><div class="form-actions">${row?btn('Eliminar','product-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar producto','product-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar producto':'Nuevo producto',body);
}
