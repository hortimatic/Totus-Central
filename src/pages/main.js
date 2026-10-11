import {state,isAdmin,isManager,getFilters} from '../state.js';
import {sum,money,fmtDate,inRange,monthRange,isoToday,esc} from '../utils.js';
import {kpi,table,dateFilters,btn,dateCell,moneyCell,stateBadge,modal,formField,selectField} from '../components.js';

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
 const f=getFilters('cajas');
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
 const f=getFilters('gastos');
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
 const f=getFilters('facturacion');
 const rows=state.data.invoices.filter(x=>inRange(x.issue_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.display_number,x.customer_name,x.customer_tax_id,x.concept,x.status].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const headers=[
  {label:'Fecha',html:r=>dateCell(r.issue_date)},{label:'Número',html:r=>esc(r.display_number||'Borrador')},{label:'Tipo',html:r=>esc(r.document_type||'factura')},
  {label:'Cliente',html:r=>esc(r.customer_name||'—')},{label:'Total',num:true,html:r=>moneyCell(r.total_amount)},{label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','invoice-preview','secondary',`data-id="${r.id}"`)}${r.status==='borrador'?btn('Editar','invoice-edit','secondary',`data-id="${r.id}"`):''}${r.document_type==='proforma'&&['emitida','aceptada'].includes(r.status)?btn('Convertir','proforma-convert','primary',`data-id="${r.id}"`):''}</div>`}
 ];
 return `<div class="page"><div class="kpis">${kpi('Documentos',String(rows.length))}${kpi('Total',money(sum(rows,x=>x.total_amount)))}${kpi('Emitidas',String(rows.filter(x=>x.status==='emitida').length))}${kpi('Borradores',String(rows.filter(x=>x.status==='borrador').length))}</div>
  <section class="card table-card"><div class="section-head card-pad"><div><h2>Facturación</h2><p>Facturas y proformas en una lista clara.</p></div><div class="inline-actions">${btn('Nueva factura','invoice-new','primary')}${btn('Nueva proforma','proforma-new','secondary')}${btn('Clientes','customers-manage','secondary')}</div></div>
  ${dateFilters({...f,stores:stores()},'facturas')}
  ${table(headers,rows,{emptyTitle:'No hay documentos',emptyText:'No existen facturas o proformas para estas fechas.'})}</section></div>`;
}

export function documentos(){
 const f=getFilters('documentos');
 const usage=state.data.storageUsage||{};
 const used=Number(usage.total_bytes||0),limit=Number(usage.limit_bytes||500*1024*1024),usagePct=limit?Math.min(100,used/limit*100):0;
 const rows=state.data.documents.filter(x=>inRange(x.document_date||x.created_at,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.original_name,x.supplier_or_customer,x.invoice_number,x.doc_type].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const headers=[
  {label:'Fecha',html:r=>dateCell(r.document_date||r.created_at)},{label:'Archivo',html:r=>esc(r.original_name||'—')},{label:'Tipo',html:r=>esc(r.doc_type||'—')},
  {label:'Proveedor / cliente',html:r=>esc(r.supplier_or_customer||'—')},{label:'Estado',html:r=>stateBadge(r.status)},{label:'',html:r=>`<div class="inline-actions">${btn('Ver','document-preview','secondary',`data-id="${r.id}"`)}</div>`}
 ];
 return `<div class="page"><div class="kpis">${kpi('Documentos',String(rows.length))}${kpi('Uso de almacenamiento',(used/1024/1024).toFixed(1).replace('.',',')+' MB',usagePct.toFixed(1).replace('.',',')+' % de 500 MB')}${kpi('Archivos guardados',String(Number(usage.documents_count||0)+Number(usage.assets_count||0)))}</div><section class="card table-card"><div class="section-head card-pad"><div><h2>Documentos</h2><p>Archivo documental centralizado.</p></div>${btn('Subir documento','document-new','primary')}</div>
 ${dateFilters({...f,stores:stores()},'documentos')}
 ${table(headers,rows,{emptyTitle:'No hay documentos',emptyText:'No existen documentos para estas fechas.'})}</section></div>`;
}

export function fiscalidad(){
 const f=getFilters('fiscalidad');
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
 const f=getFilters('informes');
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
 const locked=isAdmin()?'':'disabled';
 const templateRows=state.data.templates.map(t=>`<div class="summary-row"><div><b>${esc(t.name)}</b><div class="small muted">${esc(t.code)} · ${esc(t.style)}${t.logo_name?' · logo '+esc(t.logo_name):''}</div></div><div class="inline-actions">${btn('Editar','template-edit','secondary',`data-id="${t.id}"`)}${isAdmin()?btn('Eliminar','template-delete','danger',`data-id="${t.id}"`):''}</div></div>`).join('')||'<div class="empty"><strong>Sin plantillas</strong><span>Crea una plantilla para facturas y proformas.</span></div>';
 const seriesRows=state.data.series.map(sr=>`<div class="summary-row"><div><b>${esc(sr.code)}</b><div class="small muted">${esc(sr.document_type)} · ${esc(sr.series_kind)} · año ${sr.year}</div></div><div class="inline-actions"><span class="badge ${sr.active?'ok':'bad'}">${sr.active?'Activa':'Inactiva'}</span><span class="badge info">Siguiente ${sr.next_number}</span>${isAdmin()?btn(sr.active?'Desactivar':'Activar','series-toggle','secondary',`data-id="${sr.id}" data-active="${sr.active?'false':'true'}"`):''}</div></div>`).join('');
 return `<div class="page">
 <div class="split">
  <section class="card card-pad"><div class="section-head"><div><h2>Datos del negocio</h2><p>Una única ubicación para datos fiscales y de contacto.</p></div></div><div class="form-grid" style="margin-top:14px">
   ${formField('Nombre / razón fiscal','cfgBusiness',s.business_name||'','text',locked)}
   ${formField('NIF','cfgTax',s.tax_id||'','text',locked)}
   ${formField('Dirección','cfgAddress',s.business_address||'','text',locked)}
   ${formField('Email','cfgEmail',s.business_email||'','email',locked)}
   ${formField('Teléfono','cfgPhone',s.business_phone||'','text',locked)}
   ${formField('Límite documental (MB)','cfgStorage',Math.round(Number(s.storage_limit_bytes||524288000)/1024/1024),'number',locked)}
   <div class="wide note">Uso actual: ${((Number(state.data.storageUsage?.total_bytes||0))/1024/1024).toFixed(1).replace('.',',')} MB de 500 MB configurados.</div>
  </div>${isAdmin()?`<div class="form-actions">${btn('Guardar configuración','config-save','primary')}</div>`:'<div class="note" style="margin-top:14px">Solo el administrador puede cambiar los datos generales del negocio.</div>'}</section>
  <section class="card card-pad"><h2>Fiscalidad</h2><div class="form-grid" style="margin-top:14px">
   ${formField('IVA ventas (%)','cfgVat',s.default_sales_vat_rate??21,'number',locked+' step="0.1"')}
   ${formField('Pago fraccionado IRPF (%)','cfgIrpf',s.irpf_prepayment_rate??20,'number',locked+' step="0.1"')}
   ${formField('Cuota RETA actual','cfgReta',s.actual_reta_monthly??'','number',locked+' step="0.01"')}
   ${formField('Margen operativo objetivo (%)','cfgMargin',s.target_operating_margin_pct??15,'number',locked+' step="0.1"')}
  </div></section>
 </div>
 <section class="card card-pad"><div class="section-head"><div><h2>Plantillas de facturación</h2><p>Logo, colores y textos se administran aquí, no en otras pantallas.</p></div>${btn('Nueva plantilla','template-new','primary')}</div><div style="margin-top:12px">${templateRows}</div></section>
 <section class="card card-pad"><div class="section-head"><div><h2>Series</h2><p>Numeración de facturas, rectificativas y proformas.</p></div></div><div style="margin-top:12px">${seriesRows}</div></section>
 </div>`;
}

export function log(){
 if(!isManager())return '<div class="page"><div class="card card-pad"><h2>Sin acceso</h2></div></div>';
 const headers=[{label:'Fecha',html:r=>esc(new Date(r.created_at).toLocaleString('es-ES'))},{label:'Usuario',html:r=>esc(r.user_email||'—')},{label:'Área',html:r=>esc(r.area)},{label:'Acción',html:r=>esc(r.action)},{label:'Detalle',html:r=>`<span class="small">${esc(JSON.stringify(r.detail||{}))}</span>`}];
 return `<div class="page"><section class="card table-card"><div class="section-head card-pad"><div><h2>Log</h2><p>Trazabilidad técnica y administrativa.</p></div></div>${table(headers,state.data.audit,{emptyTitle:'Sin registros'})}</section></div>`;
}

export function pricing(){
 const q=getFilters('pricing').query.toLowerCase();
 const rows=state.data.products.filter(x=>!q||[x.name,x.sku,x.status].join(' ').toLowerCase().includes(q));
 const familyName=id=>state.data.families.find(x=>x.id===id)?.name||'—';
 const costOf=prod=>{
   const list=state.data.providerPrices.filter(x=>x.product_id===prod.id&&!x.variant_id);
   if(!list.length)return 0;
   const chosen=list.find(x=>x.selected)||list.sort((a,b)=>providerCost(a)-providerCost(b))[0];
   return providerCost(chosen);
 };
 const headers=[{label:'Producto',html:r=>`<b>${esc(r.name)}</b><div class="small muted">${esc(r.sku)}</div>`},{label:'Familia',html:r=>esc(familyName(r.family_id))},{label:'Coste',num:true,html:r=>moneyCell(costOf(r))},{label:'PVP',num:true,html:r=>moneyCell(r.current_pvp||r.proposed_pvp)},{label:'Margen',num:true,html:r=>{const price=Number(r.current_pvp||r.proposed_pvp||0),cost=costOf(r),net=price/1.21;return net>0?((net-cost)/net*100).toFixed(1).replace('.',',')+' %':'—'}},{label:'Estado',html:r=>stateBadge(r.status)},{label:'',html:r=>btn('Abrir','product-edit','secondary',`data-id="${r.id}"`)}];
 const consultations=state.data.consultations.slice(0,20);
 return `<div class="page">
 <div class="kpis">${kpi('Productos',String(rows.length))}${kpi('Familias',String(state.data.families.length))}${kpi('Proveedores',String(state.data.providers.length))}${kpi('Consultas',String(state.data.consultations.length))}</div>
 <section class="card table-card"><div class="section-head card-pad"><div><h2>Pricing</h2><p>Costes, PVP, margen, proveedores, variantes y competencia.</p></div><div class="inline-actions">${btn('Nuevo producto','product-new','primary')}${btn('Proveedores','providers-manage','secondary')}</div></div><div class="filters"><div class="field search"><label>Buscar</label><input id="pricingQuery" value="${esc(getFilters('pricing').query)}" placeholder="Producto, referencia o estado"></div>${btn('Buscar','pricing-search','primary')}</div>${table(headers,rows,{emptyTitle:'Sin productos',emptyText:'Todavía no hay productos registrados.'})}</section>
 <section class="card card-pad"><div class="section-head"><div><h2>Consulta rápida</h2><p>Calcula y guarda consultas reutilizables.</p></div></div><div class="form-grid" style="margin-top:14px">
  ${formField('Consulta / producto','pqQuery','')}
  ${formField('Coste neto','pqCost','','number','step="0.01"')}
  ${formField('PVP','pqPvp','','number','step="0.01"')}
  ${formField('Competencia','pqCompetitor','','number','step="0.01"')}
  ${formField('Descuento (%)','pqDiscount',0,'number','step="0.1" min="0" max="100"')}
 </div><div class="form-actions">${btn('Calcular y guardar','consultation-save','primary')}</div>
 <div class="stack" style="margin-top:14px">${consultations.length?consultations.map(c=>`<div class="summary-row"><div><b>${esc(c.query)}</b><div class="small muted">PVP ${money(c.pvp)} · Margen ${Number(c.margin_pct||0).toFixed(1).replace('.',',')} %</div></div><div class="inline-actions">${btn('Reutilizar','consultation-reuse','secondary',`data-id="${c.id}"`)}${btn('Eliminar','consultation-delete','danger',`data-id="${c.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin consultas</strong><span>Las consultas guardadas aparecerán aquí.</span></div>'}</div>
 </section>
 </div>`;
}

export function providerCost(row){
 const base=Number(row?.net_cost||0)*(1-Number(row?.provider_discount||0)/100);
 return base+Number(row?.shipping_unit||0)+(row?.apply_special_tax?Number(row?.special_tax_amount||0):0);
}


export const renderers={inicio,pricing,cajas,gastos,facturacion,documentos,fiscalidad,informes,usuarios,configuracion,log};

export function openingDrawerCash(storeId,drawerId){
 const previous=state.data.closings.filter(x=>x.store_id===storeId&&x.status==='cerrado').sort((a,b)=>String(b.business_date).localeCompare(String(a.business_date)))[0];
 if(!previous)return 0;
 return Number(state.data.closingDrawers.find(x=>x.closing_id===previous.id&&x.drawer_id===drawerId)?.closing_cash||0);
}

function drawerEditor(drawer,row){
 const saved=row?state.data.closingDrawers.find(x=>x.closing_id===row.id&&x.drawer_id===drawer.id):null;
 const open=saved?.opening_cash??openingDrawerCash(drawer.store_id,drawer.id);
 return `<section class="card card-pad drawer-entry" data-drawer-id="${drawer.id}">
  <div class="section-head"><div><h3>${esc(drawer.name)}</h3><p>Importes de esta caja.</p></div></div>
  <div class="form-grid" style="margin-top:12px">
   ${formField('Apertura efectivo',`drOpen_${drawer.id}`,open,'number','step="0.01"')}
   ${formField('Efectivo final',`drClose_${drawer.id}`,saved?.closing_cash??'','number','step="0.01"')}
   ${formField('Tarjeta',`drCard_${drawer.id}`,saved?.card_sales??'','number','step="0.01"')}
   ${formField('Bizum',`drBizum_${drawer.id}`,saved?.bizum_sales??'','number','step="0.01"')}
   ${formField('Pedidos online',`drOnline_${drawer.id}`,saved?.online_sales??'','number','step="0.01"')}
   ${formField('Otros ingresos',`drOther_${drawer.id}`,saved?.other_income??'','number','step="0.01"')}
   ${formField('Salidas de efectivo',`drWithdraw_${drawer.id}`,saved?.cash_withdrawals??'','number','step="0.01"')}
   ${formField('Gastos pagados en caja',`drCashExpense_${drawer.id}`,saved?.cash_expenses_declared??'','number','step="0.01"')}
   ${formField('Entradas extraordinarias',`drExtraIn_${drawer.id}`,saved?.cash_extra_in??'','number','step="0.01"')}
   ${formField('Salidas extraordinarias',`drExtraOut_${drawer.id}`,saved?.cash_extra_out??'','number','step="0.01"')}
  </div>
 </section>`;
}

export function closingModal(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const sid=row?.store_id||storeOptions[0]?.value||'';
 const drawers=state.data.drawers.filter(x=>x.store_id===sid&&x.active!==false);
 const body=`<div class="form-grid">
 ${selectField('Tienda','clStore',storeOptions,sid)}
 ${formField('Fecha','clDate',row?.business_date||isoToday(),'date')}
 <label class="wide">Observaciones<textarea id="clNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div>
 <div id="closingDrawers" class="stack" style="margin-top:16px">${drawers.map(d=>drawerEditor(d,row)).join('')||'<div class="note bad">Esta tienda no tiene cajas activas configuradas.</div>'}</div>
 <div class="note" style="margin-top:14px">Cada caja mantiene su propia apertura, cobros y efectivo final. Totus calcula el cierre general sumando todas las cajas.</div>
 <div class="form-actions">${row?btn('Eliminar','closing-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar cierre','closing-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar cierre':'Nuevo cierre',body);
}

export function expenseModal(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const suppliers=[{value:'',label:'Proveedor manual'},...state.data.suppliers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const categories=[{value:'',label:'Sin categoría'},...state.data.categories.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||x.code||'Categoría'}))];
 const body=`<div class="form-grid">
 ${selectField('Tienda','exStore',storeOptions,row?.store_id||storeOptions[0]?.value||'')}
 ${formField('Fecha','exDate',row?.expense_date||isoToday(),'date')}
 ${selectField('Proveedor guardado','exSupplierId',suppliers,row?.supplier_id||'')}
 ${formField('Proveedor','exSupplier',row?.supplier_name||'')}
 ${formField('NIF proveedor','exTax',row?.supplier_tax_id||'')}
 ${formField('Nº factura / justificante','exInvoice',row?.invoice_number||'')}
 ${selectField('Categoría','exCategory',categories,row?.category_id||'')}
 ${selectField('Documento','exDocKind',[{value:'factura',label:'Factura'},{value:'rectificativa',label:'Rectificativa'},{value:'ticket',label:'Ticket'},{value:'nomina',label:'Nómina'},{value:'seguridad_social',label:'Seguridad Social'},{value:'recibo',label:'Recibo'},{value:'otro',label:'Otro'}],row?.document_kind||'factura')}
 ${selectField('Forma de pago','exPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'tarjeta')}
 ${selectField('Estado de pago','exPaidStatus',[{value:'pagado',label:'Pagado'},{value:'pendiente',label:'Pendiente'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pagado')}
 ${formField('Fecha de pago','exPaidDate',row?.paid_date||'','date')}
 ${formField('Base imponible','exBase',row?.base_amount??'','number','step="0.01"')}
 ${formField('IVA (%)','exVatRate',row?.vat_rate??21,'number','step="0.1" min="0"')}
 ${formField('Recargo (%)','exReRate',row?.re_rate??0,'number','step="0.1" min="0"')}
 ${formField('Retención (%)','exWhRate',row?.withholding_rate??0,'number','step="0.1" min="0"')}
 ${selectField('Modelo retención','exWhModel',[{value:'',label:'Sin modelo'},{value:'111',label:'Modelo 111'},{value:'115',label:'Modelo 115'}],row?.withholding_model||'')}
 ${formField('% deducible IRPF','exDedPct',row?.deductible_pct??100,'number','step="1" min="0" max="100"')}
 <label><input id="exDeductible" type="checkbox" ${row?.deductible_irpf===false?'':'checked'}> Deducible en IRPF</label>
 <label><input id="exFixed" type="checkbox" ${row?.fixed_asset?'checked':''}> Inmovilizado / amortizable</label>
 ${formField('Años amortización','exAmortYears',row?.amortization_years??'','number','step="0.1" min="0"')}
 <label><input id="exManagement" type="checkbox" ${row?.management_only?'checked':''}> Gasto interno de gestión (no contable)</label>
 ${formField('Tipo interno','exPersonnelKind',row?.personnel_kind||'')}
 <label class="wide">Descripción<textarea id="exDesc" rows="3">${esc(row?.description||'')}</textarea></label>
 <label class="wide">Observaciones<textarea id="exNotes" rows="2">${esc(row?.notes||'')}</textarea></label>
 </div>
 <div class="note">Los importes fiscales se calculan a partir de la base y los porcentajes. Marca “gasto interno” para costes de gestión que quieres controlar sin mezclarlos con la contabilidad oficial.</div>
 <div class="form-actions">${row?btn('Eliminar','expense-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar gasto','expense-save','primary',row?`data-id="${row.id}"`:'')}</div>`;
 modal(row?'Editar gasto':'Nuevo gasto',body);
}

export function invoiceLineRow(line={},index=0){
 return `<div class="invoice-line" data-line-index="${index}">
  <div class="form-grid">
   ${formField('Descripción',`ivDesc_${index}`,line.description||'')}
   ${formField('Cantidad',`ivQty_${index}`,line.quantity??1,'number','step="0.01" min="0.01"')}
   ${formField('Precio sin IVA',`ivUnit_${index}`,line.unit_price_base??'','number','step="0.01"')}
   ${formField('Descuento (%)',`ivDisc_${index}`,line.discount_pct??0,'number','step="0.1" min="0" max="100"')}
   ${formField('IVA (%)',`ivVat_${index}`,line.vat_rate??21,'number','step="0.1" min="0"')}
  </div>
  <div class="inline-actions" style="justify-content:flex-end;margin-top:8px">${btn('Quitar línea','invoice-line-remove','danger',`data-index="${index}"`)}</div>
 </div>`;
}

export function invoiceModal(row=null,type='factura'){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const series=state.data.series.filter(s=>s.active!==false&&s.document_type===type&&(type!=='factura'||s.series_kind==='invoice')).map(s=>({value:s.id,label:s.code}));
 const templates=[{value:'',label:'Sin plantilla'},...state.data.templates.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const customers=[{value:'',label:'Cliente nuevo / manual'},...state.data.customers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const lines=row?state.data.invoiceLines.filter(x=>x.invoice_id===row.id).sort((a,b)=>a.sort_order-b.sort_order):[{description:'',quantity:1,unit_price_base:'',discount_pct:0,vat_rate:21}];
 const body=`<div class="form-grid">
 ${selectField('Tienda','ivStore',storeOptions,row?.store_id||storeOptions[0]?.value||'')}
 ${selectField('Serie','ivSeries',series,row?.series_id||series[0]?.value||'')}
 ${formField('Fecha emisión','ivDate',row?.issue_date||isoToday(),'date')}
 ${formField('Fecha vencimiento','ivDue',row?.due_date||'','date')}
 ${selectField('Cliente guardado','ivCustomerId',customers,row?.customer_id||'')}
 ${formField('Cliente','ivCustomer',row?.customer_name||'')}
 ${formField('NIF/CIF','ivTax',row?.customer_tax_id||'')}
 ${formField('Email','ivEmail',row?.customer_email||'','email')}
 <label class="wide">Dirección<textarea id="ivAddress" rows="2">${esc(row?.customer_address||'')}</textarea></label>
 ${formField('Concepto','ivConcept',row?.concept||'')}
 ${selectField('Forma de pago','ivPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'transferencia')}
 ${selectField('Plantilla','ivTemplate',templates,row?.template_id||'')}
 ${formField('Referencia pedido','ivPO',row?.purchase_order_ref||'')}
 </div>
 <div class="card" style="margin-top:16px"><div class="card-pad">
  <div class="section-head"><div><h3>Líneas</h3><p>Una o varias líneas por documento.</p></div>${btn('Añadir línea','invoice-line-add','secondary')}</div>
  <div id="invoiceLines" class="stack" style="margin-top:14px">${lines.map((l,i)=>invoiceLineRow(l,i)).join('')}</div>
 </div></div>
 <div class="form-actions">${btn('Guardar borrador','invoice-save','primary',row?`data-id="${row.id}" data-type="${type}"`:`data-type="${type}"`)}${row?.status==='borrador'?btn(type==='proforma'?'Emitir proforma':'Emitir factura','invoice-finalize','secondary',`data-id="${row.id}"`):''}</div>`;
 modal(row?'Editar documento':(type==='proforma'?'Nueva proforma':'Nueva factura'),body);
}

export function invoicePreview(row){
 const lines=state.data.invoiceLines.filter(x=>x.invoice_id===row.id).sort((a,b)=>a.sort_order-b.sort_order);
 return `<div class="stack">
  <div class="section-head"><div><div class="eyebrow">${esc(row.document_type||'Documento')}</div><h2>${esc(row.display_number||'BORRADOR')}</h2></div>${stateBadge(row.status)}</div>
  <div class="split">
   <div><div class="small muted">Cliente</div><b>${esc(row.customer_name||'—')}</b><div class="small">${esc(row.customer_tax_id||'')}</div><div class="small">${esc(row.customer_address||'')}</div></div>
   <div><div class="summary-row"><span>Fecha</span><strong>${fmtDate(row.issue_date)}</strong></div><div class="summary-row"><span>Vencimiento</span><strong>${fmtDate(row.due_date)}</strong></div></div>
  </div>
  ${table([
   {label:'Descripción',html:l=>esc(l.description)},{label:'Cant.',num:true,html:l=>String(l.quantity)},{label:'Precio',num:true,html:l=>moneyCell(l.unit_price_base)},
   {label:'Dto.',num:true,html:l=>`${Number(l.discount_pct||0).toFixed(1).replace('.',',')} %`},{label:'IVA',num:true,html:l=>`${Number(l.vat_rate||0).toFixed(1).replace('.',',')} %`},{label:'Total',num:true,html:l=>moneyCell(l.total_amount)}
  ],lines,{emptyTitle:'Sin líneas'})}
  <div class="metric-list"><div class="metric-box"><span>Base</span><b>${money(row.base_amount)}</b></div><div class="metric-box"><span>IVA</span><b>${money(row.vat_amount)}</b></div><div class="metric-box"><span>Total</span><b>${money(row.total_amount)}</b></div></div>
  <div class="form-actions">${btn('Imprimir / PDF','invoice-print','primary',`data-id="${row.id}"`)}</div>
 </div>`;
}

export function productModal(row=null){
 const families=state.data.families.map(x=>({value:x.id,label:x.name}));
 const baseForm=`<div class="form-grid">
 ${formField('Nombre','prName',row?.name||'')}
 ${formField('Referencia / SKU','prSku',row?.sku||'')}
 ${selectField('Familia','prFamily',[{value:'',label:'Sin familia'},...families],row?.family_id||'')}
 ${selectField('Tipo','prType',[{value:'simple',label:'Simple'},{value:'variants',label:'Con variantes'}],row?.product_type||'simple')}
 ${formField('PVP actual','prPvp',row?.current_pvp??'','number','step="0.01"')}
 ${formField('PVP propuesto','prProposed',row?.proposed_pvp??'','number','step="0.01"')}
 ${formField('Unidades/mes','prUnits',row?.units_month??0,'number','min="0"')}
 ${selectField('Estado','prStatus',[{value:'PENDIENTE',label:'Pendiente'},{value:'ACEPTADO',label:'Aceptado'}],row?.status||'PENDIENTE')}
 <label class="wide">Notas<textarea id="prNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
 </div>`;
 if(!row){
   modal('Nuevo producto',baseForm+`<div class="form-actions">${btn('Guardar producto','product-save','primary')}</div>`);
   return;
 }
 const prices=state.data.providerPrices.filter(x=>x.product_id===row.id&&!x.variant_id);
 const comps=state.data.competitors.filter(x=>x.product_id===row.id&&!x.variant_id);
 const variants=state.data.variants.filter(x=>x.product_id===row.id&&x.active!==false);
 const chosen=prices.find(x=>x.selected)||(prices.length?[...prices].sort((a,b)=>providerCost(a)-providerCost(b))[0]:null);
 const cost=providerCost(chosen),pvp=Number(row.current_pvp||row.proposed_pvp||0),net=pvp/1.21,margin=net-cost,marginPct=net>0?margin/net*100:0;
 const providerName=id=>state.data.providers.find(x=>x.id===id)?.name||'Proveedor';
 const providerRows=prices.map(x=>`<div class="summary-row"><div><b>${esc(providerName(x.provider_id))}</b><div class="small muted">Coste final ${money(providerCost(x))} · base ${money(x.net_cost)} · dto ${Number(x.provider_discount||0).toFixed(1).replace('.',',')} %${x.apply_special_tax?' · + impuesto especial':''}</div></div><div class="inline-actions">${x.selected?'<span class="badge ok">Seleccionado</span>':''}${btn('Editar','provider-price-edit','secondary',`data-id="${x.id}" data-product="${row.id}"`)}${btn('Eliminar','provider-price-delete','danger',`data-id="${x.id}" data-product="${row.id}"`)}</div></div>`).join('')||'<div class="empty"><strong>Sin proveedores</strong><span>Añade al menos un coste de compra.</span></div>';
 const compRows=comps.map(x=>`<div class="summary-row"><div><b>${esc(x.competitor_name)}</b><div class="small muted">${money(x.price)} · dto ${Number(x.discount||0).toFixed(1).replace('.',',')} % · envío ${money(x.shipping)}</div></div><div class="inline-actions">${btn('Editar','competitor-edit','secondary',`data-id="${x.id}" data-product="${row.id}"`)}${btn('Eliminar','competitor-delete','danger',`data-id="${x.id}" data-product="${row.id}"`)}</div></div>`).join('')||'<div class="empty"><strong>Sin competencia</strong><span>Añade precios comparables si los necesitas.</span></div>';
 const variantRows=variants.map(v=>`<div class="summary-row"><div><b>${esc(v.name)}</b><div class="small muted">${esc(v.sku)}${v.nicotine_mg_ml!=null?' · '+v.nicotine_mg_ml+' mg/ml':''}${v.pvp!=null?' · PVP '+money(v.pvp):''}</div></div><div class="inline-actions">${btn('Editar','variant-edit','secondary',`data-id="${v.id}" data-product="${row.id}"`)}${btn('Eliminar','variant-delete','danger',`data-id="${v.id}" data-product="${row.id}"`)}</div></div>`).join('')||'<div class="empty"><strong>Sin variantes</strong><span>Producto simple o sin variantes creadas.</span></div>';
 const body=`${baseForm}
 <div class="kpis" style="margin-top:16px">${kpi('Coste seleccionado',money(cost))}${kpi('PVP',money(pvp))}${kpi('Margen',money(margin))}${kpi('Margen %',marginPct.toFixed(1).replace('.',',')+' %')}</div>
 <section class="card card-pad" style="margin-top:16px"><div class="section-head"><div><h3>Proveedores</h3><p>Comparativa real de coste de compra.</p></div>${btn('Añadir proveedor','provider-price-new','secondary',`data-product="${row.id}"`)}</div><div style="margin-top:12px">${providerRows}</div></section>
 <section class="card card-pad" style="margin-top:16px"><div class="section-head"><div><h3>Competencia</h3><p>Precios externos y promociones.</p></div>${btn('Añadir competencia','competitor-new','secondary',`data-product="${row.id}"`)}</div><div style="margin-top:12px">${compRows}</div></section>
 <section class="card card-pad" style="margin-top:16px"><div class="section-head"><div><h3>Variantes</h3><p>Nicotina, formatos, colores u otros atributos.</p></div>${btn('Añadir variante','variant-new','secondary',`data-product="${row.id}"`)}</div><div style="margin-top:12px">${variantRows}</div></section>
 <div class="form-actions">${btn('Eliminar producto','product-delete','danger',`data-id="${row.id}"`)}${btn('Guardar producto','product-save','primary',`data-id="${row.id}"`)}</div>`;
 modal('Ficha de producto',body);
}

