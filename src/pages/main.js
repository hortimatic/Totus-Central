import {state,isAdmin,isManager,getFilters,getView} from '../state.js';
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
 const view=getView('cajas');
 if(view.mode==='record'){
   const row=view.id?state.data.closings.find(x=>x.id===view.id):null;
   return closingRecordHtml(row);
 }
 const f=getFilters('cajas');
 const rows=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.notes,storeName(x.store_id),x.status].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const total=sum(rows,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
 const mismatches=rows.filter(x=>Math.abs(Number(x.difference||0))>.01).length;
 const drafts=rows.filter(x=>x.status==='borrador').length;
 const headers=[
  {label:'Cierre',html:r=>`<b class="date-display">${fmtDate(r.business_date)}</b><div class="small muted">${esc(storeName(r.store_id))}</div>`},
  {label:'Cobros',html:r=>`<div class="compact-detail"><span>Efectivo <b>${money(r.cash_sales)}</b></span><span>Tarjeta <b>${money(r.card_sales)}</b></span><span>Bizum <b>${money(r.bizum_sales)}</b></span><span>Online <b>${money(r.online_sales)}</b></span><span>Otros <b>${money(r.other_income)}</b></span></div>`},
  {label:'Caja',html:r=>`<div class="compact-detail"><span>Apertura <b>${money(r.opening_cash)}</b></span><span>Final <b>${money(r.actual_cash)}</b></span><span>Retiradas <b>${money(r.cash_withdrawals)}</b></span><span>Gastos caja <b>${money(r.cash_expenses_declared)}</b></span></div>`},
  {label:'Control',html:r=>`<div class="compact-detail"><span>Calculado <b>${money(Number(r.cash_sales||0)+Number(r.card_sales||0)+Number(r.bizum_sales||0)+Number(r.online_sales||0)+Number(r.other_income||0))}</b></span><span>TPV/control <b>${r.reported_total_sales==null?'—':money(r.reported_total_sales)}</b></span><span>Diferencia <b class="${Math.abs(Number(r.difference||0))>.01?'danger-text':'good-text'}">${money(r.difference||0)}</b></span></div>`},
  {label:'Estado',html:r=>`${stateBadge(r.status)}${r.notes?`<div class="small muted record-note">${esc(r.notes)}</div>`:''}`},
  {label:'',html:r=>btn(r.status==='borrador'?'Continuar':'Abrir','closing-edit','secondary',`data-id="${r.id}"`)}
 ];
 return `<div class="page">
  <div class="kpis">${kpi('Ventas del periodo',money(total))}${kpi('Cierres',String(rows.length))}${kpi('Borradores',String(drafts))}${kpi('Descuadres',String(mismatches),mismatches?'Revisar antes de cerrar':'Sin incidencias')}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Cierres de caja</h2><p>Histórico completo. Abre un cierre para ver o editar su ficha.</p></div><div class="inline-actions">${btn('Exportar','export-closings-current','secondary')}${btn('+ Nuevo cierre','closing-new','primary')}</div></div>
   ${dateFilters({...f,stores:stores()},'cajas')}
   ${table(headers,rows,{emptyTitle:'No hay cierres',emptyText:'No existen cierres para las fechas seleccionadas.'})}
  </section>
 </div>`;
}

export function gastos(){
 const view=getView('gastos');
 if(view.mode==='record'){
   const row=view.id?state.data.expenses.find(x=>x.id===view.id):null;
   return expenseRecordHtml(row);
 }
 const f=getFilters('gastos');
 const kind=f.kind||'all',paid=f.paid||'all';
 const rows=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)
   &&(kind==='all'||(kind==='internal'?x.management_only:!x.management_only))
   &&(paid==='all'||x.paid_status===paid)
   &&(!f.query||[x.supplier_name,x.invoice_number,x.description,x.payment_method].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const total=sum(rows,x=>x.gross_expense||x.accounting_amount||x.amount_paid);
 const internal=sum(rows.filter(x=>x.management_only),x=>x.gross_expense||x.accounting_amount||x.amount_paid);
 const pending=rows.filter(x=>x.paid_status!=='pagado').length;
 const headers=[
  {label:'Gasto',html:r=>`<b class="date-display">${fmtDate(r.expense_date)}</b><div class="small muted">${esc(storeName(r.store_id))} · ${r.management_only?'<span class="badge warn">Interno</span>':'<span class="badge info">Fiscal</span>'}</div>`},
  {label:'Documento / proveedor',html:r=>`<b>${esc(r.supplier_name||'—')}</b><div class="small muted">${esc(r.invoice_number||r.document_kind||'Sin número')}</div>`},
  {label:'Concepto',html:r=>`<div>${esc(r.description||'—')}</div><div class="small muted">${esc(r.payment_method||'')} · ${esc(r.withholding_model?('Modelo '+r.withholding_model):'Sin retención')}</div>`},
  {label:'Fiscal',html:r=>`<div class="compact-detail"><span>Base <b>${money(r.base_amount)}</b></span><span>IVA <b>${money(r.vat_amount)}</b></span><span>RE <b>${money(r.re_amount)}</b></span><span>Ret. <b>${money(r.withholding_amount)}</b></span></div>`},
  {label:'Total',num:true,html:r=>`<b>${money(r.gross_expense||r.accounting_amount||r.amount_paid)}</b><div class="small">${stateBadge(r.paid_status||'pendiente')}</div>`},
  {label:'',html:r=>btn('Abrir','expense-edit','secondary',`data-id="${r.id}"`)}
 ];
 const extras=`<div class="field"><label>Tipo</label><select id="gastosKind"><option value="all" ${kind==='all'?'selected':''}>Todos</option><option value="fiscal" ${kind==='fiscal'?'selected':''}>Fiscal</option><option value="internal" ${kind==='internal'?'selected':''}>Solo interno</option></select></div><div class="field"><label>Pago</label><select id="gastosPaid"><option value="all" ${paid==='all'?'selected':''}>Todos</option><option value="pagado" ${paid==='pagado'?'selected':''}>Pagado</option><option value="pendiente" ${paid==='pendiente'?'selected':''}>Pendiente</option><option value="parcial" ${paid==='parcial'?'selected':''}>Parcial</option></select></div>`;
 return `<div class="page">
  <div class="kpis">${kpi('Gasto del periodo',money(total))}${kpi('Solo control interno',money(internal))}${kpi('Registros',String(rows.length))}${kpi('Pendientes de pago',String(pending))}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Gastos</h2><p>Listado completo. La ficha concentra documento, fiscalidad, pago y notas.</p></div><div class="inline-actions">${btn('Proveedores','expense-suppliers','secondary')}${btn('Exportar','export-expenses-current','secondary')}${btn('+ Nuevo gasto','expense-new','primary')}</div></div>
   <div class="filters">${dateFilters({...f,stores:stores()},'gastos').replace(/^<div class="filters">|<\/div>$/g,'')}${extras}</div>
   ${table(headers,rows,{emptyTitle:'No hay gastos',emptyText:'No existen gastos para los filtros seleccionados.'})}
  </section>
 </div>`;
}

export function facturacion(){
 const view=getView('facturacion');
 if(view.mode==='record'){
   const row=view.id?state.data.invoices.find(x=>x.id===view.id):null;
   return invoiceRecordHtml(row,view.docType||row?.document_type||'factura',view.invoiceKind||row?.invoice_kind||'invoice',view.origin||row?.origin||'totus');
 }
 const section=view.section||'documentos';
 const tabs=`<div class="tabs module-tabs"><button class="tab ${section==='documentos'?'active':''}" data-action="billing-section" data-section="documentos">Documentos</button><button class="tab ${section==='clientes'?'active':''}" data-action="billing-section" data-section="clientes">Clientes</button><button class="tab ${section==='plantillas'?'active':''}" data-action="billing-section" data-section="plantillas">Plantillas y marca</button><button class="tab ${section==='series'?'active':''}" data-action="billing-section" data-section="series">Series</button></div>`;
 if(section==='clientes') return `<div class="page">${tabs}${customersSectionHtml()}</div>`;
 if(section==='plantillas') return `<div class="page">${tabs}${templatesSectionHtml()}</div>`;
 if(section==='series') return `<div class="page">${tabs}${seriesSectionHtml()}</div>`;

 const f=getFilters('facturacion');
 const rows=state.data.invoices.filter(x=>inRange(x.issue_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&(!f.query||[x.display_number,x.external_number_text,x.customer_name,x.customer_tax_id,x.concept,x.status,x.document_type,x.invoice_kind].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const headers=[
  {label:'Documento',html:r=>`<b>${esc(r.display_number||r.external_number_text||'Borrador')}</b><div class="small muted">${fmtDate(r.issue_date)} · ${r.document_type==='proforma'?'Proforma':r.invoice_kind==='rectification'?'Rectificativa':r.origin==='externa'?'Factura externa':'Factura'}</div>`},
  {label:'Cliente',html:r=>`<b>${esc(r.customer_name||'—')}</b><div class="small muted">${esc(r.customer_tax_id||'')}</div>`},
  {label:'Cobro',html:r=>r.document_type==='proforma'?'<span class="muted">No aplica</span>':stateBadge(r.paid_status||'pendiente')},
  {label:'Total',num:true,html:r=>`<b>${money(r.total_amount)}</b>`},
  {label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','invoice-preview','secondary',`data-id="${r.id}"`)}${r.status==='borrador'?btn('Editar','invoice-edit','secondary',`data-id="${r.id}"`):btn('Abrir','invoice-open','secondary',`data-id="${r.id}"`)}${r.document_type==='proforma'&&['emitida','aceptada'].includes(r.status)?btn('Convertir','proforma-convert','primary',`data-id="${r.id}"`):''}</div>`}
 ];
 return `<div class="page">
  ${tabs}
  <div class="kpis">${kpi('Documentos',String(rows.length))}${kpi('Facturado',money(sum(rows.filter(x=>x.document_type==='factura'&&x.status==='emitida'),x=>x.total_amount)))}${kpi('Pendiente de cobro',money(sum(rows.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.paid_status!=='pagado'),x=>x.total_amount-Number(x.amount_paid||0))))}${kpi('Borradores',String(rows.filter(x=>x.status==='borrador').length))}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Facturación</h2><p>Facturas, rectificativas, externas y proformas.</p></div><div class="inline-actions">${btn('Factura externa','external-invoice-new','secondary')}${btn('Rectificativa','rectification-new','secondary')}${btn('Proforma','proforma-new','secondary')}${btn('+ Nueva factura','invoice-new','primary')}</div></div>
   ${dateFilters({...f,stores:stores()},'facturas')}
   ${table(headers,rows,{emptyTitle:'No hay documentos',emptyText:'No existen documentos para estas fechas.'})}
  </section>
 </div>`;
}

function customersSectionHtml(){
 const rows=state.data.customers.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
 const headers=[{label:'Cliente',html:r=>`<b>${esc(r.name)}</b><div class="small muted">${esc(r.tax_id||'Sin NIF/CIF')}</div>`},{label:'Contacto',html:r=>`${esc(r.email||'—')}<div class="small muted">${esc(r.phone||'')}</div>`},{label:'Dirección',html:r=>esc([r.address,r.postal_code,r.city,r.province].filter(Boolean).join(', ')||'—')},{label:'Pago',html:r=>esc(r.default_payment_method||'—')},{label:'',html:r=>btn('Editar','customer-edit','secondary',`data-id="${r.id}"`)}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Clientes</h2><p>Maestro reutilizable para facturación.</p></div>${btn('+ Nuevo cliente','customer-new','primary')}</div>${table(headers,rows,{emptyTitle:'Sin clientes'})}</section>`;
}
function templatesSectionHtml(){
 const rows=state.data.templates.filter(x=>x.active!==false);
 const headers=[{label:'Plantilla',html:r=>`<b>${esc(r.name)}</b><div class="small muted">${esc(r.code)} · ${esc(r.style)}</div>`},{label:'Marca',html:r=>`<span class="brand-swatch" style="background:${esc(r.primary_color||'#172033')}"></span> ${r.logo_name?esc(r.logo_name):'Sin logo'}`},{label:'Uso',html:r=>`${r.default_invoice?'<span class="badge info">Factura</span>':''} ${r.default_proforma?'<span class="badge info">Proforma</span>':''}`},{label:'',html:r=>`<div class="inline-actions">${btn('Editar','template-edit','secondary',`data-id="${r.id}"`)}${isAdmin()?btn('Eliminar','template-delete','danger',`data-id="${r.id}"`):''}</div>`}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Plantillas y marca</h2><p>El logo se configura únicamente aquí y se congela al emitir.</p></div>${btn('+ Nueva plantilla','template-new','primary')}</div>${table(headers,rows,{emptyTitle:'Sin plantillas',emptyText:'Crea una plantilla para facturas y proformas.'})}</section>`;
}
function seriesSectionHtml(){
 const rows=[...state.data.series].sort((a,b)=>String(a.code).localeCompare(String(b.code),'es'));
 const headers=[{label:'Serie',html:r=>`<b>${esc(r.code)}</b><div class="small muted">${r.document_type==='proforma'?'Proforma':r.series_kind==='rectification'?'Rectificativa':'Factura'} · ${r.year}</div>`},{label:'Tienda',html:r=>esc(r.store_id?storeName(r.store_id):'General')},{label:'Formato',html:r=>`${esc(r.prefix)} · ${r.padding} dígitos`},{label:'Siguiente',num:true,html:r=>String(r.next_number)},{label:'Estado',html:r=>stateBadge(r.active?'activo':'inactivo')},{label:'',html:r=>isAdmin()?btn(r.active?'Desactivar':'Activar','series-toggle','secondary',`data-id="${r.id}" data-active="${r.active?'false':'true'}"`):''}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Series</h2><p>Numeración anual protegida. Prefijo y padding no se cambian después de usarse.</p></div></div>${table(headers,rows,{emptyTitle:'Sin series'})}</section>`;
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
 const closings=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&x.include_in_income!==false);
 const expenses=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const officialExpenses=expenses.filter(x=>!x.management_only);
 const internalExpenses=expenses.filter(x=>x.management_only);
 const issuedInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const closingIncome=sum(closings,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
 const invoicedIncome=sum(issuedInvoices,x=>x.total_amount);
 const adjustedIncome=sum(state.data.incomeAdjustments.filter(x=>inRange(x.income_date,f.from,f.to)&&(f.store==='all'||!x.store_id||x.store_id===f.store)),x=>x.amount);
 const fiscalIncome=closingIncome+invoicedIncome+adjustedIncome;
 const officialIds=new Set(officialExpenses.map(x=>x.id));
 const lines=state.data.expenseLines.filter(x=>officialIds.has(x.expense_id));
 const idsWithLines=new Set(lines.map(x=>x.expense_id));
 const deductibleFromLines=sum(lines,x=>x.deductible_irpf===false?0:Number(x.irpf_imputable||0));
 const deductibleFallback=sum(officialExpenses.filter(x=>!idsWithLines.has(x.id)&&x.deductible_irpf!==false),x=>Number(x.accounting_amount||x.gross_expense||0)*(Number(x.deductible_pct??100)/100));
 const deductible=deductibleFromLines+deductibleFallback;
 const accountingExpense=sum(officialExpenses,x=>x.accounting_amount||x.gross_expense||x.amount_paid);
 const internalExpense=sum(internalExpenses,x=>x.accounting_amount||x.gross_expense||x.amount_paid);
 const netBeforeDifficult=fiscalIncome-deductible;
 const difficultEnabled=state.data.settings?.difficult_expense_enabled!==false;
 const difficultPct=Number(state.data.settings?.difficult_expense_pct||5);
 const annualCap=Number(state.data.settings?.difficult_expense_annual_cap||2000);
 const difficult=difficultEnabled?Math.min(Math.max(0,netBeforeDifficult*difficultPct/100),annualCap):0;
 const taxableBase=Math.max(0,netBeforeDifficult-difficult);
 const rate=Number(state.data.settings?.irpf_prepayment_rate||20);
 const prepay=taxableBase*rate/100;
 const realResult=fiscalIncome-accountingExpense-internalExpense;
 const ret111=sum(lines.filter(x=>x.withholding_model==='111'),x=>x.withholding_amount);
 const ret115=sum(lines.filter(x=>x.withholding_model==='115'),x=>x.withholding_amount);
 return `<div class="page">
  <section class="card">${dateFilters({...f,stores:stores()},'fiscal')}</section>
  <div class="kpis">
   ${kpi('Ingresos fiscales',money(fiscalIncome))}
   ${kpi('Gasto deducible IRPF',money(deductible))}
   ${kpi('Resultado real',money(realResult),internalExpense?'Incluye '+money(internalExpense)+' internos':'Sin gastos internos')}
   ${kpi('Modelo 130 estimado',money(prepay),'Estimación según configuración')}
  </div>
  <div class="split">
   <section class="card card-pad"><h2>Modelo 130 · estimación</h2>
    <div class="summary-row"><span>Periodo</span><strong>${fmtDate(f.from)} → ${fmtDate(f.to)}</strong></div>
    <div class="summary-row"><span>Ingresos por cierres</span><strong>${money(closingIncome)}</strong></div>
    <div class="summary-row"><span>Facturas incluidas aparte</span><strong>${money(invoicedIncome)}</strong></div>
    <div class="summary-row"><span>Ajustes de ingresos</span><strong>${money(adjustedIncome)}</strong></div>
    <div class="summary-row"><span>Gasto deducible</span><strong>− ${money(deductible)}</strong></div>
    <div class="summary-row"><span>Difícil justificación (${difficultPct} %, tope anual ${money(annualCap)})</span><strong>− ${money(difficult)}</strong></div>
    <div class="summary-row"><span>Base estimada</span><strong>${money(taxableBase)}</strong></div>
    <div class="summary-row"><span>Tipo configurado</span><strong>${rate.toFixed(1).replace('.',',')} %</strong></div>
    <div class="summary-row"><span>Pago fraccionado estimado</span><strong>${money(prepay)}</strong></div>
    <div class="note warn" style="margin-top:12px">Es una herramienta de control. El cálculo presentado por gestoría puede incluir regularizaciones, pagos previos y ajustes fiscales adicionales.</div>
   </section>
   <section class="card card-pad"><h2>Control de gastos y retenciones</h2>
    <div class="summary-row"><span>Gasto contable registrado</span><strong>${money(accountingExpense)}</strong></div>
    <div class="summary-row"><span>Gasto interno de gestión</span><strong>${money(internalExpense)}</strong></div>
    <div class="summary-row"><span>Retenciones modelo 111</span><strong>${money(ret111)}</strong></div>
    <div class="summary-row"><span>Retenciones modelo 115</span><strong>${money(ret115)}</strong></div>
    <h3 style="margin-top:18px">Pagos fiscales registrados</h3>
    ${state.data.taxPayments.length?state.data.taxPayments.filter(x=>!x.payment_date||inRange(x.payment_date,f.from,f.to)).slice(0,12).map(x=>`<div class="summary-row"><div><b>${esc(x.tax_type)}</b><div class="small muted">${esc(x.period_label||'')} · ${fmtDate(x.payment_date)}</div></div><strong>${money(x.amount)}</strong></div>`).join(''):'<div class="empty"><strong>Sin pagos fiscales</strong><span>No hay registros en este periodo.</span></div>'}
   </section>
  </div>
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
 ${isAdmin()?`<section class="card card-pad"><div class="section-head"><div><h2>Copias de seguridad</h2><p>Copia completa de datos, documentos y logos. Los usuarios/Auth se conservan fuera de la copia.</p></div>${btn('Descargar copia','backup-create','primary')}</div><div class="form-grid" style="margin-top:14px"><label class="wide">Cargar copia<input id="backupFile" type="file" accept=".totusbackup,application/zip"></label></div><div class="note warn" style="margin-top:12px">Restaurar sustituye los datos de negocio actuales. Requiere tres confirmaciones y un motivo.</div><div class="form-actions">${btn('Restaurar copia','backup-restore','danger')}</div></section>`:''}
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

export function closingRecordHtml(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const sid=row?.store_id||storeOptions[0]?.value||'';
 const drawers=state.data.drawers.filter(x=>x.store_id===sid&&x.active!==false);
 const calculated=Number(row?.cash_sales||0)+Number(row?.card_sales||0)+Number(row?.bizum_sales||0)+Number(row?.online_sales||0)+Number(row?.other_income||0);
 const locked=row?.status==='cerrado';
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="closing-back">← Volver a cierres</button><div class="eyebrow">Cajas · ${row?'Cierre '+fmtDate(row.business_date):'Nuevo cierre'}</div><h2>${row?esc(storeName(row.store_id)):'Nuevo cierre de caja'}</h2></div><div>${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad">
     <div class="section-head"><div><h3>Datos del cierre</h3><p>Fecha, establecimiento y total de control.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','clStore',storeOptions,sid)}
      ${formField('Fecha','clDate',row?.business_date||isoToday(),'date')}
      ${formField('Total TPV / control','clReported',row?.reported_total_sales??'','number','step="0.01" min="0"')}
      <label class="wide">Observaciones<textarea id="clNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
     </div>
    </section>
    <section class="stack" id="closingDrawers">${drawers.map(d=>drawerEditor(d,row)).join('')||'<div class="note bad">Esta tienda no tiene cajas activas configuradas.</div>'}</section>
   </div>
   <aside class="record-side">
    <section class="card card-pad sticky-summary">
     <h3>Resumen</h3>
     <div class="summary-row"><span>Total calculado</span><strong id="clCalcTotal">${money(calculated)}</strong></div>
     <div class="summary-row"><span>Total TPV/control</span><strong id="clReportedTotal">${row?.reported_total_sales==null?'—':money(row.reported_total_sales)}</strong></div>
     <div class="summary-row"><span>Diferencia</span><strong id="clDifference" class="${Math.abs(Number(row?.difference||0))>.01?'danger-text':'good-text'}">${money(row?.difference||0)}</strong></div>
     <div class="note" style="margin-top:12px">El efectivo se calcula por caja: final + retiradas + gastos de caja + salidas extra − apertura − entradas extra.</div>
     <div class="stack" style="margin-top:14px">
      ${row&&locked?btn('Reabrir cierre','closing-reopen','secondary',`data-id="${row.id}"`):btn('Guardar borrador','closing-save-draft','secondary',row?`data-id="${row.id}"`:'')}
      ${!locked?btn('Cerrar y validar','closing-save-close','primary',row?`data-id="${row.id}"`:''):''}
      ${row?btn('Eliminar','closing-delete','danger',`data-id="${row.id}"`):''}
     </div>
    </section>
   </aside>
  </div>
 </div>`;
}

export function expenseRecordHtml(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const suppliers=[{value:'',label:'Proveedor manual'},...state.data.suppliers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const categories=[{value:'',label:'Sin categoría'},...state.data.categories.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||x.code||'Categoría'}))];
 const doc=row?.document_id?state.data.documents.find(x=>x.id===row.document_id):null;
 const total=Number(row?.gross_expense||row?.accounting_amount||row?.amount_paid||0);
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="expense-back">← Volver a gastos</button><div class="eyebrow">Gastos · ${row?'Registro':'Nuevo'}</div><h2>${row?esc(row.supplier_name||'Gasto'):'Nuevo gasto'}</h2></div><div>${row?(row.management_only?'<span class="badge warn">Solo control interno</span>':'<span class="badge info">Fiscal</span>'):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>1 · Documento y proveedor</h3><p>Identificación del gasto y justificante.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','exStore',storeOptions,row?.store_id||storeOptions[0]?.value||'')}
      ${formField('Fecha','exDate',row?.expense_date||isoToday(),'date')}
      ${selectField('Proveedor guardado','exSupplierId',suppliers,row?.supplier_id||'')}
      ${formField('Proveedor','exSupplier',row?.supplier_name||'')}
      ${formField('NIF/CIF','exTax',row?.supplier_tax_id||'')}
      ${formField('Nº factura / justificante','exInvoice',row?.invoice_number||'')}
      ${selectField('Tipo documento','exDocKind',[{value:'factura',label:'Factura'},{value:'rectificativa',label:'Rectificativa'},{value:'ticket',label:'Ticket'},{value:'nomina',label:'Nómina'},{value:'seguridad_social',label:'Seguridad Social'},{value:'recibo',label:'Recibo'},{value:'otro',label:'Otro'}],row?.document_kind||'factura')}
      ${selectField('Categoría','exCategory',categories,row?.category_id||'')}
     </div>
     <div class="attachment-box" style="margin-top:14px">
      <div><b>Justificante</b><div class="small muted">${doc?esc(doc.original_name):'Sin archivo vinculado'}</div></div>
      <div class="inline-actions">${doc?btn('Vista previa','expense-document-preview','secondary',`data-id="${doc.id}"`):''}${doc?btn('Descargar','expense-document-download','secondary',`data-id="${doc.id}"`):''}${doc?btn('Quitar','expense-document-unlink','danger',`data-expense="${row.id}" data-document="${doc.id}"`):''}</div>
      <label class="file-picker">Seleccionar archivo<input id="exFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md"></label>
     </div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>2 · Concepto</h3><p>Descripción y base económica.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${formField('Base imponible','exBase',row?.base_amount??'','number','step="0.01" min="0"')}
      <label class="wide">Descripción<textarea id="exDesc" rows="3">${esc(row?.description||'')}</textarea></label>
     </div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>3 · Tratamiento fiscal</h3><p>IVA, recargo, retención y deducibilidad.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${formField('IVA (%)','exVatRate',row?.vat_rate??21,'number','step="0.1" min="0"')}
      ${formField('Recargo (%)','exReRate',row?.re_rate??0,'number','step="0.1" min="0"')}
      ${formField('Retención (%)','exWhRate',row?.withholding_rate??0,'number','step="0.1" min="0"')}
      ${selectField('Modelo retención','exWhModel',[{value:'',label:'Sin modelo'},{value:'111',label:'Modelo 111'},{value:'115',label:'Modelo 115'}],row?.withholding_model||'')}
      ${formField('% deducible IRPF','exDedPct',row?.deductible_pct??100,'number','step="1" min="0" max="100"')}
      <label class="check-field"><input id="exDeductible" type="checkbox" ${row?.deductible_irpf===false?'':'checked'}> Deducible en IRPF</label>
      <label class="check-field"><input id="exFixed" type="checkbox" ${row?.fixed_asset?'checked':''}> Inmovilizado / amortizable</label>
      ${formField('Años amortización','exAmortYears',row?.amortization_years??'','number','step="0.1" min="0"')}
      <label class="check-field wide emphasis-check"><input id="exManagement" type="checkbox" ${row?.management_only?'checked':''}> Solo control interno · no enviar a gestoría ni incluir en cálculo fiscal</label>
      ${formField('Tipo interno','exPersonnelKind',row?.personnel_kind||'')}
     </div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>4 · Pago</h3></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${selectField('Forma de pago','exPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'tarjeta')}
      ${selectField('Estado de pago','exPaidStatus',[{value:'pagado',label:'Pagado'},{value:'pendiente',label:'Pendiente'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pagado')}
      ${formField('Fecha de pago','exPaidDate',row?.paid_date||'','date')}
      ${formField('Importe pagado','exPaidAmount',row?.amount_paid??'','number','step="0.01" min="0"')}
     </div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>5 · Notas</h3></div></div><label>Observaciones<textarea id="exNotes" rows="4">${esc(row?.notes||'')}</textarea></label></section>
   </div>
   <aside class="record-side"><section class="card card-pad sticky-summary"><h3>Resumen</h3>
    <div class="summary-row"><span>Base</span><strong id="exSumBase">${money(row?.base_amount||0)}</strong></div>
    <div class="summary-row"><span>IVA</span><strong id="exSumVat">${money(row?.vat_amount||0)}</strong></div>
    <div class="summary-row"><span>Recargo</span><strong id="exSumRe">${money(row?.re_amount||0)}</strong></div>
    <div class="summary-row"><span>Retención</span><strong id="exSumWh">${money(row?.withholding_amount||0)}</strong></div>
    <div class="summary-row"><span>Total gasto</span><strong id="exSumTotal">${money(total)}</strong></div>
    <div class="stack" style="margin-top:14px">${row?btn('Eliminar gasto','expense-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar','expense-save','primary',row?`data-id="${row.id}"`:'')}${btn('Cancelar','expense-back','secondary')}</div>
   </section></aside>
  </div>
 </div>`;
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

export function invoiceRecordHtml(row=null,docType='factura',invoiceKind='invoice',origin='totus'){
 const isProforma=docType==='proforma';
 const isRect=invoiceKind==='rectification';
 const isExternal=origin==='externa';
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const series=state.data.series.filter(s=>s.active!==false&&s.document_type===docType&&(!s.store_id||s.store_id===(row?.store_id||storeOptions[0]?.value))&&(!isProforma?s.series_kind===(isRect?'rectification':'invoice'):true)).map(s=>({value:s.id,label:s.code}));
 const activeTemplates=state.data.templates.filter(x=>x.active!==false);
 const defaultTemplate=activeTemplates.find(x=>isProforma?x.default_proforma:x.default_invoice);
 const templates=[{value:'',label:'Sin plantilla'},...activeTemplates.map(x=>({value:x.id,label:x.name}))];
 const customers=[{value:'',label:'Cliente nuevo / manual'},...state.data.customers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const lines=row?state.data.invoiceLines.filter(x=>x.invoice_id===row.id).sort((a,b)=>a.sort_order-b.sort_order):[{description:'',quantity:1,unit_price_base:'',discount_pct:0,vat_rate:21}];
 const original=row?.source_document_id?state.data.documents.find(x=>x.id===row.source_document_id):null;
 const title=isProforma?'Proforma':isRect?'Factura rectificativa':isExternal?'Factura externa':'Factura';
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="invoice-back">← Volver a facturación</button><div class="eyebrow">Facturación · ${title}</div><h2>${row?esc(row.display_number||row.external_number_text||'Borrador'):'Nueva '+title.toLowerCase()}</h2></div><div>${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>1 · Documento</h3><p>Serie, fechas y referencia.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','ivStore',storeOptions,row?.store_id||storeOptions[0]?.value||'')}
      ${selectField('Serie','ivSeries',series,row?.series_id||series[0]?.value||'')}
      ${formField('Fecha emisión','ivDate',row?.issue_date||isoToday(),'date')}
      ${formField('Fecha operación','ivOperation',row?.operation_date||'','date')}
      ${formField('Fecha vencimiento','ivDue',row?.due_date||'','date')}
      ${isExternal?formField('Número externo','ivExternalNumber',row?.external_number_text||''):''}
      ${formField('Referencia pedido','ivPO',row?.purchase_order_ref||'')}
     </div>
     ${isExternal?`<div class="attachment-box" style="margin-top:14px"><div><b>Original obligatorio</b><div class="small muted">${original?esc(original.original_name):'Sin archivo original'}</div></div><div class="inline-actions">${original?btn('Vista previa','invoice-source-preview','secondary',`data-id="${original.id}"`):''}${original?btn('Descargar','invoice-source-download','secondary',`data-id="${original.id}"`):''}</div><label class="file-picker">Seleccionar original<input id="ivSourceFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></label></div>`:''}
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>2 · Cliente</h3></div></div><div class="form-grid" style="margin-top:14px">
      ${selectField('Cliente guardado','ivCustomerId',customers,row?.customer_id||'')}
      ${formField('Cliente','ivCustomer',row?.customer_name||'')}
      ${formField('NIF/CIF','ivTax',row?.customer_tax_id||'')}
      ${formField('Email','ivEmail',row?.customer_email||'','email')}
      <label class="wide">Dirección<textarea id="ivAddress" rows="2">${esc(row?.customer_address||'')}</textarea></label>
     </div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>3 · Líneas</h3><p>Conceptos facturados.</p></div>${btn('+ Añadir línea','invoice-line-add','secondary')}</div><div id="invoiceLines" class="stack" style="margin-top:14px">${lines.map((l,i)=>invoiceLineRow(l,i)).join('')}</div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>4 · Cobro y notas</h3></div></div><div class="form-grid" style="margin-top:14px">
      ${formField('Concepto general','ivConcept',row?.concept||'')}
      ${selectField('Forma de pago','ivPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'transferencia')}
      ${!isProforma?selectField('Estado de cobro','ivPaidStatus',[{value:'pendiente',label:'Pendiente'},{value:'pagado',label:'Pagada'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pendiente'):''}
      ${!isProforma?formField('Fecha de cobro','ivPaidDate',row?.paid_date||'','date'):''}
      <label class="wide">Notas internas<textarea id="ivNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
     </div></section>
    <details class="card card-pad design-details"><summary><b>5 · Plantilla y presentación</b><span class="small muted">Secundario</span></summary><div class="form-grid" style="margin-top:14px">${selectField('Plantilla','ivTemplate',templates,row?.template_id||defaultTemplate?.id||'')}<label class="wide">Términos<textarea id="ivTerms" rows="2">${esc(row?.terms_text||'')}</textarea></label><label class="wide">Pie<textarea id="ivFooter" rows="2">${esc(row?.footer_text||'')}</textarea></label></div></details>
   </div>
   <aside class="record-side"><section class="card card-pad sticky-summary"><h3>Resumen</h3><div class="summary-row"><span>Base</span><strong id="ivSumBase">${money(row?.base_amount||0)}</strong></div><div class="summary-row"><span>IVA</span><strong id="ivSumVat">${money(row?.vat_amount||0)}</strong></div><div class="summary-row"><span>Total</span><strong id="ivSumTotal">${money(row?.total_amount||0)}</strong></div><div class="stack" style="margin-top:14px">${row?btn('Vista previa','invoice-preview','secondary',`data-id="${row.id}"`):''}${row?.status==='borrador'||!row?btn('Guardar borrador','invoice-save','secondary',`${row?`data-id="${row.id}" `:''}data-type="${docType}" data-kind="${invoiceKind}" data-origin="${origin}"`):''}${row?.status==='borrador'?btn(isProforma?'Emitir proforma':'Emitir documento','invoice-finalize','primary',`data-id="${row.id}"`):''}${row&&isProforma&&['emitida','aceptada'].includes(row.status)?btn('Convertir en factura','proforma-convert','primary',`data-id="${row.id}"`):''}${btn('Volver','invoice-back','secondary')}</div></section></aside>
  </div>
 </div>`;
}

export function invoicePreview(row,logoUrl=''){
 const lines=state.data.invoiceLines.filter(x=>x.invoice_id===row.id).sort((a,b)=>a.sort_order-b.sort_order);
 const tpl=state.data.templates.find(x=>x.id===row.template_id)||{};
 const title=row.document_type==='proforma'?(tpl.proforma_title||'FACTURA PROFORMA'):(tpl.invoice_title||'FACTURA');
 const primary=tpl.primary_color||'#172033',secondary=tpl.secondary_color||'#2367d1';
 return `<div class="stack invoice-preview" style="--invoice-primary:${esc(primary)};--invoice-secondary:${esc(secondary)}">
  <div class="section-head invoice-preview-head"><div>
   ${logoUrl&&tpl.show_logo!==false?`<img src="${esc(logoUrl)}" alt="Logo" class="invoice-logo">`:''}
   <div class="eyebrow">${esc(title)}</div><h2>${esc(row.display_number||'BORRADOR')}</h2>
   ${tpl.header_text?`<div class="small muted">${esc(tpl.header_text)}</div>`:''}
  </div>${stateBadge(row.status)}</div>
  <div class="split">
   <div><div class="small muted">Cliente</div><b>${esc(row.customer_name||'—')}</b><div class="small">${esc(row.customer_tax_id||'')}</div><div class="small">${esc(row.customer_address||'')}</div></div>
   <div><div class="summary-row"><span>Fecha</span><strong>${fmtDate(row.issue_date)}</strong></div><div class="summary-row"><span>Vencimiento</span><strong>${fmtDate(row.due_date)}</strong></div></div>
  </div>
  ${table([
   {label:'Descripción',html:l=>esc(l.description)},{label:'Cant.',num:true,html:l=>String(l.quantity)},{label:'Precio',num:true,html:l=>moneyCell(l.unit_price_base)},
   {label:'Dto.',num:true,html:l=>`${Number(l.discount_pct||0).toFixed(1).replace('.',',')} %`},{label:'IVA',num:true,html:l=>`${Number(l.vat_rate||0).toFixed(1).replace('.',',')} %`},{label:'Total',num:true,html:l=>moneyCell(l.total_amount)}
  ],lines,{emptyTitle:'Sin líneas'})}
  <div class="metric-list"><div class="metric-box"><span>Base</span><b>${money(row.base_amount)}</b></div><div class="metric-box"><span>IVA</span><b>${money(row.vat_amount)}</b></div><div class="metric-box"><span>Total</span><b>${money(row.total_amount)}</b></div></div>
  ${tpl.payment_terms_default?`<div class="note">${esc(tpl.payment_terms_default)}</div>`:''}
  ${tpl.footer_text?`<div class="small muted">${esc(tpl.footer_text)}</div>`:''}
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

