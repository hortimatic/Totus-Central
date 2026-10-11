import {state,isAdmin,isManager,getFilters,getView} from '../state.js';
import {sum,money,fmtDate,inRange,monthRange,isoToday,esc} from '../utils.js';
import {kpi,table,dateFilters,btn,dateCell,moneyCell,stateBadge,modal,formField,selectField} from '../components.js';

const stores=()=>state.data.stores.filter(x=>x.active!==false);
const storeName=id=>stores().find(x=>x.id===id)?.name||'—';

export function inicio(){
 const today=isoToday(),month=monthRange(today),year=Number(today.slice(0,4)),m=Number(today.slice(5,7)),quarter=Math.ceil(m/3);
 const qFrom=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`,qTo=new Date(year,quarter*3,0).toISOString().slice(0,10);
 const activeStores=stores();
 const monthClosings=state.data.closings.filter(x=>inRange(x.business_date,month.from,month.to));
 const monthExpenses=state.data.expenses.filter(x=>inRange(x.expense_date,month.from,month.to));
 const quarterExpenses=state.data.expenses.filter(x=>inRange(x.expense_date,qFrom,qTo));
 const monthInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&inRange(x.issue_date,month.from,month.to));
 const salesFromClosings=sum(monthClosings.filter(x=>x.include_in_income!==false),x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
 const extraInvoices=sum(monthInvoices.filter(x=>x.include_in_income===true),x=>x.total_amount);
 const monthIncomeAdjustments=sum(state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,month.from,month.to)),x=>x.amount);
 const sales=salesFromClosings+extraInvoices+monthIncomeAdjustments;
 const accountingExpenses=sum(monthExpenses.filter(x=>!x.management_only),x=>x.accounting_amount||x.gross_expense||x.amount_paid||0);
 const internalExpenses=sum(monthExpenses.filter(x=>x.management_only),x=>x.accounting_amount||x.gross_expense||x.amount_paid||0);
 const realResult=sales-accountingExpenses-internalExpenses;
 const todays=state.data.closings.filter(x=>x.business_date===today);
 const missingStores=activeStores.filter(s=>!todays.some(x=>x.store_id===s.id&&x.status==='cerrado'));
 const draftClosings=state.data.closings.filter(x=>x.status==='borrador').length;
 const mismatches=state.data.closings.filter(x=>Math.abs(Number(x.difference||0))>.01).length;
 const pendingExpenses=state.data.expenses.filter(x=>x.paid_status&&x.paid_status!=='pagado');
 const pendingExpenseAmount=sum(pendingExpenses,x=>Math.max(0,Number(x.accounting_amount||x.gross_expense||0)-Number(x.amount_paid||0)));
 const pendingInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.paid_status!=='pagada').sort((a,b)=>String(a.due_date||a.issue_date||'').localeCompare(String(b.due_date||b.issue_date||'')));
 const pendingInvoiceAmount=sum(pendingInvoices,x=>Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)));
 const draftInvoices=state.data.invoices.filter(x=>x.status==='borrador').length;
 const recentDocs=[...state.data.documents].sort((a,b)=>String(b.created_at||b.document_date||'').localeCompare(String(a.created_at||a.document_date||''))).slice(0,4);
 const pendingDocs=state.data.documents.filter(x=>['pendiente','revisada'].includes(x.status)).length;
 const usage=state.data.storageUsage||{},used=Number(usage.total_bytes||0),limit=Number(usage.limit_bytes||500*1024*1024),storagePct=limit?used/limit*100:0;
 const qIncome=sum(state.data.closings.filter(x=>x.include_in_income!==false&&inRange(x.business_date,qFrom,qTo)),x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))
  +sum(state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,qFrom,qTo)),x=>x.total_amount)
  +sum(state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,qFrom,qTo)),x=>x.amount);
 const qExpenses=state.data.expenses.filter(x=>!x.management_only&&inRange(x.expense_date,qFrom,qTo));
 const qExpenseIds=new Set(qExpenses.map(x=>x.id)),qLines=state.data.expenseLines.filter(x=>qExpenseIds.has(x.expense_id)),qWithLines=new Set(qLines.map(x=>x.expense_id));
 const qDed=sum(qLines,x=>x.deductible_irpf===false?0:Number(x.irpf_imputable||0))+sum(qExpenses.filter(x=>!qWithLines.has(x.id)&&x.deductible_irpf!==false),x=>Number(x.accounting_amount||x.gross_expense||0)*(Number(x.deductible_pct??100)/100));
 const qNet=Math.max(0,qIncome-qDed),qIrpf=Math.max(0,qNet*Number(state.data.settings?.irpf_prepayment_rate||20)/100);
 const current130=state.data.taxPayments.find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter);
 const alerts=[];
 if(missingStores.length)alerts.push({level:'warn',title:'Cierres pendientes hoy',text:missingStores.map(x=>x.name).join(', '),route:'cajas'});
 if(draftClosings)alerts.push({level:'warn',title:'Cierres en borrador',text:`${draftClosings} pendientes de cerrar`,route:'cajas'});
 if(mismatches)alerts.push({level:'bad',title:'Descuadres de caja',text:`${mismatches} cierre${mismatches===1?'':'s'} con diferencia`,route:'cajas'});
 if(pendingExpenses.length)alerts.push({level:'warn',title:'Gastos pendientes de pago',text:`${pendingExpenses.length} · ${money(pendingExpenseAmount)} pendientes`,route:'gastos'});
 if(pendingInvoices.length)alerts.push({level:'warn',title:'Facturas pendientes de cobro',text:`${pendingInvoices.length} · ${money(pendingInvoiceAmount)} pendientes`,route:'facturacion'});
 if(draftInvoices)alerts.push({level:'info',title:'Facturas/proformas en borrador',text:`${draftInvoices} por terminar`,route:'facturacion'});
 if(pendingDocs)alerts.push({level:'info',title:'Documentos por revisar',text:`${pendingDocs} pendientes`,route:'documentos'});
 if(storagePct>=85)alerts.push({level:storagePct>=95?'bad':'warn',title:'Almacenamiento',text:`${storagePct.toFixed(1).replace('.',',')} % utilizado`,route:'administracion'});
 const storeCards=activeStores.map(store=>{
  const close=todays.find(x=>x.store_id===store.id),storeMonth=monthClosings.filter(x=>x.store_id===store.id);
  const monthSales=sum(storeMonth,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
  const todaySales=close?Number(close.cash_sales||0)+Number(close.card_sales||0)+Number(close.bizum_sales||0)+Number(close.online_sales||0)+Number(close.other_income||0):0;
  return `<article class="store-status-card"><div class="section-head"><div><h3>${esc(store.name)}</h3><p>${close?fmtDate(close.business_date):'Sin cierre de hoy'}</p></div>${close?stateBadge(close.status):'<span class="badge warn">Pendiente</span>'}</div><div class="metric-list" style="margin-top:12px"><div class="metric-box"><span>Hoy</span><b>${close?money(todaySales):'—'}</b></div><div class="metric-box"><span>Mes</span><b>${money(monthSales)}</b></div><div class="metric-box"><span>Efectivo final</span><b>${close?money(close.actual_cash):'—'}</b></div><div class="metric-box"><span>Diferencia</span><b class="${close&&Math.abs(Number(close.difference||0))>.01?'danger-text':'good-text'}">${close?money(close.difference||0):'—'}</b></div></div><div class="form-actions">${close?btn('Abrir cierre','closing-edit','secondary',`data-id="${close.id}"`):btn('Registrar cierre','closing-new','primary',`data-store="${store.id}"`)}</div></article>`;
 }).join('');
 const expenseByStore=activeStores.map(store=>{const rows=quarterExpenses.filter(x=>x.store_id===store.id),regular=rows.filter(x=>!x.management_only),internal=rows.filter(x=>x.management_only);return `<div class="summary-row"><div><b>${esc(store.name)}</b><div class="small muted">${regular.length} contabilizados · ${internal.length} internos</div></div><strong>${money(sum(rows,x=>x.accounting_amount||x.gross_expense||x.amount_paid||0))}</strong></div>`}).join('');
 const invoiceRows=pendingInvoices.slice(0,4).map(x=>`<div class="summary-row"><div><b>${esc(x.display_number||x.external_number_text||'Factura')}</b><div class="small muted">${esc(x.customer_name||'Cliente')} · ${money(Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)))} pendientes${x.due_date?' · vence '+fmtDate(x.due_date):''}</div></div><div class="inline-actions">${btn('Vista previa','invoice-preview','secondary',`data-id="${x.id}"`)}</div></div>`).join('');
 const docRows=recentDocs.map(d=>`<div class="summary-row"><div><b>${esc(d.original_name||'Documento')}</b><div class="small muted">${esc(d.supplier_or_customer||d.doc_type||'')} · ${fmtDate(d.document_date||d.created_at)}</div></div><div class="inline-actions">${btn('Ver','document-preview','secondary',`data-id="${d.id}"`)}</div></div>`).join('');
 const activeUsers=state.data.team.filter(x=>x.active!==false).length;
 return `<div class="page dashboard-page">
  <div class="dashboard-hero card card-pad"><div><div class="eyebrow">Inicio · ${fmtDate(today)}</div><h2>Totus Central</h2><p>Mesa de trabajo para consultar, registrar, revisar y decidir sin saltar entre pantallas innecesariamente.</p></div><div class="dashboard-hero-actions">${btn('Nuevo cierre','closing-new','primary')}${btn('Registrar gasto','expense-new','secondary')}${btn('Nueva factura','invoice-new','secondary')}${btn('Subir documento','document-new','secondary')}</div></div>
  <div class="kpis">${kpi('Ingresos del mes',money(sales),`${fmtDate(month.from)} → ${fmtDate(month.to)}`)}${kpi('Gastos contables',money(accountingExpenses),internalExpenses?('+'+money(internalExpenses)+' internos'):'Sin gasto interno')}${kpi('Resultado real',money(realResult),realResult>=0?'Ingresos − todos los gastos':'Mes en negativo')}${kpi('Pendiente de cobro',money(pendingInvoiceAmount),`${pendingInvoices.length} factura${pendingInvoices.length===1?'':'s'}`)}</div>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Operativa de hoy</h2><p>Cierres y control de gasto del trimestre.</p></div></div><div class="dashboard-store-grid">${storeCards}</div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Gastos del ${quarter}T</h3><p>Total contabilizado e interno por establecimiento.</p></div>${btn('Nuevo gasto','expense-new','primary')}</div><div class="home-big-number">${money(sum(quarterExpenses,x=>x.accounting_amount||x.gross_expense||x.amount_paid||0))}</div><div class="stack">${expenseByStore}</div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Pendientes y avisos</h3><p>Solo incidencias que requieren atención.</p></div></div><div class="dashboard-alerts">${alerts.length?alerts.map(a=>`<button class="dashboard-alert ${a.level}" data-route="${a.route}"><span><b>${esc(a.title)}</b><small>${esc(a.text)}</small></span><span>→</span></button>`).join(''):'<div class="empty compact-empty"><strong>Todo al día</strong><span>No hay avisos operativos pendientes.</span></div>'}</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Precios y ventas</h2><p>Consulta un precio al vuelo y controla los cobros abiertos.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Consulta rápida de precio</h3><p>Admite punto o coma decimal.</p></div><button class="btn secondary" data-route="pricing">Abrir Pricing</button></div><div class="home-quick-grid"><input id="homePriceQuery" placeholder="Producto / referencia"><input id="homePriceCost" inputmode="decimal" placeholder="Coste sin impuestos"><input id="homePricePvp" inputmode="decimal" placeholder="PVP final"><input id="homePriceCompetitor" inputmode="decimal" placeholder="Competencia"><input id="homePriceDiscount" inputmode="decimal" placeholder="Descuento %"></div><div class="home-price-metrics"><div><span>Coste real</span><b id="homePriceReal">0,00 €</b></div><div><span>Venta final</span><b id="homePriceSale">0,00 €</b></div><div><span>Margen €</span><b id="homePriceMargin">0,00 €</b></div><div><span>Margen %</span><b id="homePriceMarginPct">0,00 %</b></div><div><span>Vs competencia</span><b id="homePriceCompetition">—</b></div></div><div class="form-actions">${btn('Guardar consulta','home-price-save','primary')}</div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Facturación y cobros</h3><p>${pendingInvoices.length} factura${pendingInvoices.length===1?'':'s'} pendientes · ${money(pendingInvoiceAmount)}</p></div>${btn('Nueva factura','invoice-new','primary')}</div><div class="stack">${invoiceRows||'<div class="empty compact-empty"><strong>Sin cobros pendientes</strong><span>No hay facturas emitidas pendientes de cobro.</span></div>'}</div><div class="dashboard-links"><button class="btn secondary" data-route="facturacion">Abrir facturación</button>${btn('Nueva proforma','proforma-new','secondary')}</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Documentos y fiscalidad</h2><p>Acceso rápido a archivo documental y previsión fiscal.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Documentos recientes</h3><p>${pendingDocs} pendientes de revisar.</p></div>${btn('Subir documento','document-new','primary')}</div><div class="stack">${docRows||'<div class="empty compact-empty"><strong>Sin documentos</strong><span>Todavía no hay documentos archivados.</span></div>'}</div><div class="dashboard-links"><button class="btn secondary" data-route="documentos">Buscar documentos</button></div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Fiscalidad · ${quarter}T ${year}</h3><p>Indicador interno del trimestre.</p></div><button class="btn secondary" data-route="fiscalidad">Abrir fiscalidad</button></div><div class="summary-row"><span>Ingresos acumulados</span><strong>${money(qIncome)}</strong></div><div class="summary-row"><span>Gasto deducible</span><strong>− ${money(qDed)}</strong></div><div class="summary-row"><span>Base previa estimada</span><strong>${money(qNet)}</strong></div><div class="summary-row"><span>IRPF orientativo</span><strong>${money(qIrpf)}</strong></div><div class="summary-row"><span>Modelo 130 registrado</span><strong>${current130?money(current130.amount):'—'}</strong></div><div class="note warn">Indicador de control interno; el cálculo detallado y ajustes están en Fiscalidad.</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Seguimiento y sistema</h2><p>Informes, usuarios y almacenamiento en un vistazo.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Informes y gestoría</h3><p>Prepara libros y paquetes con el periodo correcto.</p></div></div><div class="home-report-cards"><button class="report-shortcut" data-action="home-report-quarter"><span>Trimestre actual</span><b>${quarter}T ${year}</b><small>${fmtDate(qFrom)} → ${fmtDate(qTo)}</small></button><button class="report-shortcut" data-action="home-report-year"><span>Año actual</span><b>${year}</b><small>01/01/${year} → 31/12/${year}</small></button></div><div class="dashboard-links"><button class="btn secondary" data-route="informes">Abrir informes</button></div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Estado del sistema</h3><p>Control básico de la herramienta.</p></div>${isManager()?'<button class="btn secondary" data-route="administracion">Administración</button>':''}</div><div class="summary-row"><span>Usuarios activos</span><strong>${activeUsers}</strong></div><div class="summary-row"><span>Documentos</span><strong>${state.data.documents.length}</strong></div><div class="summary-row"><span>Almacenamiento usado</span><strong>${(used/1048576).toFixed(1).replace('.',',')} MB</strong></div><div class="summary-row"><span>Ocupación</span><strong class="${storagePct>=95?'danger-text':storagePct>=85?'warn-text':''}">${storagePct.toFixed(1).replace('.',',')} % de ${(limit/1048576).toFixed(0)} MB</strong></div><div class="dashboard-links">${isManager()?'<button class="btn secondary" data-action="admin-storage-home">Almacenamiento</button><button class="btn secondary" data-action="admin-users-home">Usuarios</button>':''}</div></article>
  </div></section>
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
  {label:'Documento',html:r=>`<b>${esc(r.display_number||r.external_number_text||'Borrador')}</b><div class="small muted">${fmtDate(r.issue_date)} · ${r.document_type==='proforma'?'Proforma':r.invoice_kind==='rectifying'?'Rectificativa':r.origin==='externa'?'Factura externa':'Factura'}</div>`},
  {label:'Cliente',html:r=>`<b>${esc(r.customer_name||'—')}</b><div class="small muted">${esc(r.customer_tax_id||'')}</div>`},
  {label:'Cobro',html:r=>r.document_type==='proforma'?'<span class="muted">No aplica</span>':stateBadge(r.paid_status||'pendiente')},
  {label:'Total',num:true,html:r=>`<b>${money(r.total_amount)}</b>`},
  {label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','invoice-preview','secondary',`data-id="${r.id}"`)}${r.status==='borrador'?btn('Editar','invoice-edit','secondary',`data-id="${r.id}"`):btn('Abrir','invoice-open','secondary',`data-id="${r.id}"`)}${r.document_type==='proforma'&&['emitida','aceptada'].includes(r.status)?btn('Convertir','proforma-convert','primary',`data-id="${r.id}"`):''}</div>`}
 ];
 return `<div class="page">
  ${tabs}
  <div class="kpis">${kpi('Documentos',String(rows.length))}${kpi('Facturado',money(sum(rows.filter(x=>x.document_type==='factura'&&x.status==='emitida'),x=>x.total_amount)))}${kpi('Pendiente de cobro',money(sum(rows.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.paid_status!=='pagada'),x=>x.total_amount)))}${kpi('Borradores',String(rows.filter(x=>x.status==='borrador').length))}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Facturación</h2><p>Facturas, rectificativas, externas y proformas.</p></div><div class="inline-actions">${btn('Factura externa','external-invoice-new','secondary')}${btn('Rectificativa','rectifying-new','secondary')}${btn('Proforma','proforma-new','secondary')}${btn('+ Nueva factura','invoice-new','primary')}</div></div>
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
 const headers=[{label:'Serie',html:r=>`<b>${esc(r.code)}</b><div class="small muted">${r.document_type==='proforma'?'Proforma':r.series_kind==='rectifying'?'Rectificativa':'Factura'} · ${r.year}</div>`},{label:'Tienda',html:r=>esc(r.store_id?storeName(r.store_id):'General')},{label:'Formato',html:r=>`${esc(r.prefix)} · ${r.padding} dígitos`},{label:'Siguiente',num:true,html:r=>String(r.next_number)},{label:'Estado',html:r=>stateBadge(r.active?'activo':'inactivo')},{label:'',html:r=>isAdmin()?btn(r.active?'Desactivar':'Activar','series-toggle','secondary',`data-id="${r.id}" data-active="${r.active?'false':'true'}"`):''}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Series</h2><p>Numeración anual protegida. Prefijo y padding no se cambian después de usarse.</p></div></div>${table(headers,rows,{emptyTitle:'Sin series'})}</section>`;
}

export function documentos(){
 const view=getView('documentos');
 if(view.mode==='record'){
   const row=view.id?state.data.documents.find(x=>x.id===view.id):null;
   return documentRecordHtml(row);
 }
 const f=getFilters('documentos');
 const usage=state.data.storageUsage||{};
 const used=Number(usage.total_bytes||0),limit=Number(usage.limit_bytes||500*1024*1024),usagePct=limit?Math.min(100,used/limit*100):0;
 const status=f.status||'all',type=f.type||'all';
 const rows=state.data.documents.filter(x=>inRange(x.document_date||x.created_at,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)
  &&(status==='all'||x.status===status)&&(type==='all'||x.doc_type===type)
  &&(!f.query||[x.original_name,x.supplier_or_customer,x.invoice_number,x.doc_type,x.category_code,x.status].join(' ').toLowerCase().includes(f.query.toLowerCase())));
 const headers=[
  {label:'Documento',html:r=>`<b>${esc(r.original_name||'Documento')}</b><div class="small muted">${fmtDate(r.document_date||r.created_at)} · ${esc(storeName(r.store_id))}</div>`},
  {label:'Clasificación',html:r=>`<b>${esc(r.doc_type||'—')}</b><div class="small muted">${esc(r.supplier_or_customer||'')} ${r.invoice_number?'· '+esc(r.invoice_number):''}</div>`},
  {label:'Tamaño',num:true,html:r=>`${(Number(r.size_bytes||0)/1024/1024).toFixed(2).replace('.',',')} MB`},
  {label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','document-preview','secondary',`data-id="${r.id}"`)}${btn('Descargar','document-download','secondary',`data-id="${r.id}"`)}${btn('Abrir','document-edit','secondary',`data-id="${r.id}"`)}</div>`}
 ];
 const extra=`<div class="field"><label>Estado</label><select id="documentosStatus"><option value="all">Todos</option>${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(v=>`<option value="${v}" ${status===v?'selected':''}>${v.replaceAll('_',' ')}</option>`).join('')}</select></div><div class="field"><label>Tipo</label><select id="documentosType"><option value="all">Todos</option>${['factura_recibida','factura_emitida','factura_rectificativa','proforma','ticket','contrato','impuesto','informe','otro'].map(v=>`<option value="${v}" ${type===v?'selected':''}>${v.replaceAll('_',' ')}</option>`).join('')}</select></div>`;
 return `<div class="page">
  <div class="kpis">${kpi('Documentos filtrados',String(rows.length))}${kpi('Uso de almacenamiento',(used/1024/1024).toFixed(1).replace('.',',')+' MB',usagePct.toFixed(1).replace('.',',')+' % de '+(limit/1024/1024).toFixed(0)+' MB')}${kpi('Archivos en Storage',String(Number(usage.documents_count||0)+Number(usage.assets_count||0)))}${kpi('Pendientes',String(rows.filter(x=>x.status==='pendiente').length))}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Archivo documental</h2><p>Subida, clasificación, vista previa, descarga y paquetes.</p></div><div class="inline-actions">${btn('Descargar ZIP filtrado','documents-zip','secondary')}${btn('+ Subir documento','document-new','primary')}</div></div>
   <div class="filters">${dateFilters({...f,stores:stores()},'documentos').replace(/^<div class="filters">|<\/div>$/g,'')}${extra}</div>
   ${table(headers,rows,{emptyTitle:'No hay documentos',emptyText:'No existen documentos para los filtros seleccionados.'})}
  </section>
 </div>`;
}

export function documentRecordHtml(row=null){
 const storeOptions=[{value:'',label:'Sin tienda'},...stores().map(s=>({value:s.id,label:s.name}))];
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="document-back">← Volver a documentos</button><div class="eyebrow">Documentos · ${row?'Ficha':'Nuevo'}</div><h2>${row?esc(row.original_name||'Documento'):'Subir documento'}</h2></div><div>${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>Archivo</h3><p>Máximo 20 MB. PDF, imagen, Excel, CSV, TXT o MD.</p></div></div>
     ${row?`<div class="attachment-box" style="margin-top:14px"><div><b>${esc(row.original_name)}</b><div class="small muted">${(Number(row.size_bytes||0)/1024/1024).toFixed(2).replace('.',',')} MB · ${esc(row.mime_type||'')}</div></div><div class="inline-actions">${btn('Vista previa','document-preview','secondary',`data-id="${row.id}"`)}${btn('Descargar','document-download','secondary',`data-id="${row.id}"`)}</div></div>`:''}
     <label class="file-picker wide" style="margin-top:14px">${row?'Sustituir archivo':'Seleccionar archivo'}<input id="docFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md"></label>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>Clasificación</h3></div></div><div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','docStore',storeOptions,row?.store_id||'')}
      ${formField('Fecha','docDate',row?.document_date||isoToday(),'date')}
      ${selectField('Tipo','docType',[{value:'factura_recibida',label:'Factura recibida'},{value:'factura_emitida',label:'Factura emitida'},{value:'factura_rectificativa',label:'Factura rectificativa'},{value:'proforma',label:'Proforma'},{value:'ticket',label:'Ticket'},{value:'contrato',label:'Contrato'},{value:'impuesto',label:'Impuesto'},{value:'informe',label:'Informe'},{value:'otro',label:'Otro'}],row?.doc_type||'factura_recibida')}
      ${selectField('Estado','docStatus',[{value:'pendiente',label:'Pendiente'},{value:'pagada',label:'Pagada'},{value:'revisada',label:'Revisada'},{value:'preparada_gestor',label:'Preparada gestor'},{value:'entregada_gestor',label:'Entregada gestor'},{value:'archivada',label:'Archivada'}],row?.status||'pendiente')}
      ${formField('Proveedor / cliente','docParty',row?.supplier_or_customer||'')}
      ${formField('NIF/CIF','docTax',row?.tax_id||'')}
      ${formField('Nº documento','docNumber',row?.invoice_number||'')}
      ${formField('Código / categoría','docCategory',row?.category_code||'')}
      <label class="wide">Notas<textarea id="docNotes" rows="4">${esc(row?.notes||'')}</textarea></label>
     </div></section>
   </div>
   <aside class="record-side"><section class="card card-pad sticky-summary"><h3>Acciones</h3><div class="stack">${row?btn('Eliminar documento','document-delete','danger',`data-id="${row.id}"`):''}${btn(row?'Guardar cambios':'Subir y guardar','document-save','primary',row?`data-id="${row.id}"`:'')}${btn('Cancelar','document-back','secondary')}</div></section></aside>
  </div>
 </div>`;
}

export function fiscalidad(){
 const f=getFilters('fiscalidad'),to=f.to||isoToday(),year=Number(String(to).slice(0,4)),quarter=Math.max(1,Math.min(4,Math.ceil(Number(String(to).slice(5,7))/3)));
 const qFrom=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`,qTo=new Date(year,quarter*3,0).toISOString().slice(0,10),yFrom=`${year}-01-01`;
 const storeOk=x=>f.store==='all'||x.store_id===f.store;
 const periodClose=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&storeOk(x)&&x.include_in_income!==false);
 const ytdClose=state.data.closings.filter(x=>inRange(x.business_date,yFrom,qTo)&&storeOk(x)&&x.include_in_income!==false);
 const periodInv=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,f.from,f.to)&&storeOk(x));
 const ytdInv=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,yFrom,qTo)&&storeOk(x));
 const periodAdj=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,f.from,f.to)&&storeOk(x));
 const ytdAdj=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,yFrom,qTo)&&storeOk(x));
 const sumIncome=(cs,is,as)=>sum(cs,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))+sum(is,x=>x.total_amount)+sum(as,x=>x.amount);
 const periodIncome=sumIncome(periodClose,periodInv,periodAdj),ytdIncome=sumIncome(ytdClose,ytdInv,ytdAdj);
 const periodExpenses=state.data.expenses.filter(x=>!x.management_only&&inRange(x.expense_date,f.from,f.to)&&storeOk(x)),ytdExpenses=state.data.expenses.filter(x=>!x.management_only&&inRange(x.expense_date,yFrom,qTo)&&storeOk(x));
 const internalPeriod=state.data.expenses.filter(x=>x.management_only&&inRange(x.expense_date,f.from,f.to)&&storeOk(x));
 const deductibleFor=expenses=>{const ids=new Set(expenses.map(x=>x.id)),lines=state.data.expenseLines.filter(x=>ids.has(x.expense_id)),withLines=new Set(lines.map(x=>x.expense_id));return sum(lines,x=>x.deductible_irpf===false?0:Number(x.irpf_imputable||0))+sum(expenses.filter(x=>!withLines.has(x.id)&&x.deductible_irpf!==false),x=>Number(x.accounting_amount||x.gross_expense||0)*(Number(x.deductible_pct??100)/100))};
 const periodDed=deductibleFor(periodExpenses),ytdDedBase=deductibleFor(ytdExpenses);
 const fiscalYtd=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,yFrom,qTo)),fiscalPeriod=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,f.from,f.to));
 const extraIncomeYtd=sum(fiscalYtd.filter(x=>x.kind==='ingreso_extra'),x=>x.amount),extraDedYtd=sum(fiscalYtd.filter(x=>['gasto_deducible_extra','amortizacion'].includes(x.kind)),x=>x.amount),reductionsYtd=sum(fiscalYtd.filter(x=>x.kind==='reduccion'),x=>x.amount),withheldYtd=sum(fiscalYtd.filter(x=>x.kind==='retencion_soportada'),x=>x.amount);
 const netBeforeDiff=Math.max(0,ytdIncome-ytdDedBase-extraDedYtd-reductionsYtd),dPct=Number(state.data.settings?.difficult_expense_pct||5),dCap=Number(state.data.settings?.difficult_expense_annual_cap||2000),difficult=state.data.settings?.difficult_expense_enabled===false?0:Math.min(netBeforeDiff*dPct/100,dCap),base=Math.max(0,netBeforeDiff-difficult),rate=Number(state.data.settings?.irpf_prepayment_rate||20),gross130=base*rate/100;
 const previous130=sum(state.data.taxPayments.filter(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)<quarter&&x.status==='pagado'),x=>x.amount),calc130=Math.max(0,gross130-previous130-withheldYtd);
 const current130=state.data.taxPayments.find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter),paid130=current130?.status==='pagado'?Number(current130.amount||0):0,diff130=paid130-calc130;
 const qExpenses=state.data.expenses.filter(x=>!x.management_only&&inRange(x.expense_date,qFrom,qTo)&&storeOk(x)),qIds=new Set(qExpenses.map(x=>x.id)),qLines=state.data.expenseLines.filter(x=>qIds.has(x.expense_id));
 const calc111=sum(qLines.filter(x=>x.withholding_model==='111'),x=>x.withholding_amount),calc115=sum(qLines.filter(x=>x.withholding_model==='115'),x=>x.withholding_amount);
 const pay111=state.data.taxPayments.find(x=>x.tax_type==='111'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter),pay115=state.data.taxPayments.find(x=>x.tax_type==='115'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter);
 const accountingPeriod=sum(periodExpenses,x=>x.accounting_amount||x.gross_expense||x.amount_paid),internal=sum(internalPeriod,x=>x.accounting_amount||x.gross_expense||x.amount_paid);
 const quarterButtons=[1,2,3,4].map(q=>btn(`${q}T`,'fiscal-quarter',q===quarter?'primary':'secondary',`data-year="${year}" data-quarter="${q}"`)).join('');
 const paymentRows=[['130',calc130,current130],['111',calc111,pay111],['115',calc115,pay115]].map(([model,calc,pay])=>{const paid=pay?Number(pay.amount||0):0,diff=paid-Number(calc||0);return `<div class="summary-row"><div><b>Modelo ${model}</b><div class="small muted">${pay?`${esc(pay.status)} · ${fmtDate(pay.payment_date)}`:'Sin registro'}</div></div><div class="compact-detail"><span>Calculado <b>${money(calc)}</b></span><span>Registrado <b>${money(paid)}</b></span><span>Diferencia <b class="${Math.abs(diff)<.02?'good-text':'warn-text'}">${money(diff)}</b></span></div><div class="inline-actions">${btn(pay?'Editar':'Registrar','tax-payment-edit','secondary',`data-model="${model}" data-year="${year}" data-quarter="${quarter}" ${pay?`data-id="${pay.id}"`:''}`)}</div></div>`}).join('');
 return `<div class="page">
  <section class="card"><div class="filters">${dateFilters({...f,stores:stores()},'fiscal').replace(/^<div class="filters">|<\/div>$/g,'')}<div class="field"><label>Acceso rápido</label><div class="inline-actions">${quarterButtons}</div></div></div></section>
  <div class="kpis">${kpi('Ingresos del periodo',money(periodIncome))}${kpi('Gasto deducible',money(periodDed))}${kpi('Gasto interno',money(internal))}${kpi('Resultado real',money(periodIncome-accountingPeriod-internal))}</div>
  <div class="split">
   <section class="card card-pad"><div class="section-head"><div><h2>Modelo 130 · ${quarter}T ${year}</h2><p>Cálculo acumulado del 01/01/${year} al ${fmtDate(qTo)}.</p></div>${btn('Ajuste fiscal','fiscal-adjustment-new','secondary')}</div>
    <div class="summary-row"><span>Ingresos acumulados</span><strong>${money(ytdIncome)}</strong></div>
    <div class="summary-row"><span>Ajustes de ingreso</span><strong>${money(extraIncomeYtd)}</strong></div>
    <div class="summary-row"><span>Gasto deducible acumulado</span><strong>− ${money(ytdDedBase)}</strong></div>
    <div class="summary-row"><span>Gastos/amortizaciones extra</span><strong>− ${money(extraDedYtd)}</strong></div>
    <div class="summary-row"><span>Reducciones</span><strong>− ${money(reductionsYtd)}</strong></div>
    <div class="summary-row"><span>Difícil justificación (${dPct} %, tope ${money(dCap)})</span><strong>− ${money(difficult)}</strong></div>
    <div class="summary-row"><span>Base acumulada</span><strong>${money(base)}</strong></div>
    <div class="summary-row"><span>${rate.toFixed(1).replace('.',',')} %</span><strong>${money(gross130)}</strong></div>
    <div class="summary-row"><span>Pagos 130 anteriores</span><strong>− ${money(previous130)}</strong></div>
    <div class="summary-row"><span>Retenciones soportadas</span><strong>− ${money(withheldYtd)}</strong></div>
    <div class="summary-row"><span>130 calculado del trimestre</span><strong>${money(calc130)}</strong></div>
    <div class="summary-row"><span>130 registrado/pagado</span><strong>${money(paid130)}</strong></div>
    <div class="summary-row"><span>Diferencia</span><strong class="${Math.abs(diff130)<.02?'good-text':'warn-text'}">${money(diff130)}</strong></div>
    <div class="note warn" style="margin-top:12px">Control interno basado en registros Totus y ajustes explícitos. No sustituye el cálculo definitivo de la gestoría.</div>
   </section>
   <section class="card card-pad"><div class="section-head"><div><h2>Modelos y pagos · ${quarter}T</h2><p>Calculado frente a lo registrado.</p></div></div><div class="stack" style="margin-top:12px">${paymentRows}</div></section>
  </div>
  <section class="card card-pad"><div class="section-head"><div><h2>Ajustes fiscales del periodo</h2><p>Ninguna diferencia se corrige de forma silenciosa.</p></div>${btn('+ Nuevo ajuste','fiscal-adjustment-new','primary')}</div><div class="stack" style="margin-top:12px">${fiscalPeriod.length?fiscalPeriod.map(x=>`<div class="summary-row"><div><b>${esc(x.kind.replaceAll('_',' '))}</b><div class="small muted">${fmtDate(x.adjustment_date)} · ${esc(x.description||'')}</div></div><strong>${money(x.amount)}</strong><div class="inline-actions">${btn('Editar','fiscal-adjustment-edit','secondary',`data-id="${x.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin ajustes</strong><span>No hay ajustes fiscales explícitos en este periodo.</span></div>'}</div></section>
 </div>`;
}

export function informes(){
 const f=getFilters('informes'),year=Number(f.year||state.data.settings?.current_year||new Date().getFullYear());
 const c=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&x.include_in_income!==false);
 const g=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const extraInv=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const incomeAdj=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store));
 const sales=sum(c,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))+sum(extraInv,x=>x.total_amount)+sum(incomeAdj,x=>x.amount);
 const accounting=sum(g.filter(x=>!x.management_only),x=>x.gross_expense||x.accounting_amount||x.amount_paid),internal=sum(g.filter(x=>x.management_only),x=>x.gross_expense||x.accounting_amount||x.amount_paid);
 return `<div class="page">
 <section class="card"><div class="filters">${dateFilters({...f,stores:stores()},'informes').replace(/^<div class="filters">|<\/div>$/g,'')}<div class="field"><label>Año de libros</label><input id="informesYear" type="number" min="2020" max="2100" value="${year}"></div></div></section>
 <div class="kpis">${kpi('Ventas del periodo',money(sales))}${kpi('Gastos contables',money(accounting))}${kpi('Gastos internos',money(internal))}${kpi('Resultado real',money(sales-accounting-internal))}</div>
 <div class="split">
  <section class="card card-pad"><div class="section-head"><div><h2>Libros como los Excel originales</h2><p>Doce hojas mensuales, mismos bloques, fórmulas, códigos de color y estructura de ventas/gastos.</p></div></div>
   <div class="stack" style="margin-top:14px">${stores().map(s=>`<div class="summary-row"><div><b>${esc(s.name)}</b><div class="small muted">Gastos y ventas · ${year}</div></div>${btn('Descargar Excel','export-store-book','primary',`data-store="${s.id}" data-year="${year}"`)}</div>`).join('')}</div>
  </section>
  <section class="card card-pad"><div class="section-head"><div><h2>Gestoría y auditoría</h2><p>Libro de gastos, conciliación por trimestre y auditoría del Modelo 130.</p></div></div>
   <div class="stack" style="margin-top:14px">${btn('Descargar libro gestor','export-gestor-book','primary',`data-year="${year}"`)}${btn('Preparar paquete gestor ZIP','export-gestor-package','secondary',`data-year="${year}"`)}</div>
  </section>
 </div>
 <section class="card card-pad"><div class="section-head"><div><h2>Exportaciones de trabajo</h2><p>Para análisis puntual con las fechas exactas seleccionadas.</p></div></div><div class="toolbar" style="margin-top:16px">${btn('Cierres detallados','export-closings','secondary')}${btn('Gastos detallados','export-expenses','secondary')}${btn('Resumen del periodo','export-summary','secondary')}</div></section>
 </div>`;
}

export function administracion(){
 if(!isManager())return '<div class="page"><div class="card card-pad"><h2>Sin acceso</h2></div></div>';
 const section=getView('administracion').section||'usuarios';
 const tabs=`<div class="tabs module-tabs"><button class="tab ${section==='usuarios'?'active':''}" data-action="admin-section" data-section="usuarios">Usuarios</button><button class="tab ${section==='negocio'?'active':''}" data-action="admin-section" data-section="negocio">Negocio y cajas</button><button class="tab ${section==='fiscal'?'active':''}" data-action="admin-section" data-section="fiscal">Configuración fiscal</button><button class="tab ${section==='storage'?'active':''}" data-action="admin-section" data-section="storage">Almacenamiento</button><button class="tab ${section==='backups'?'active':''}" data-action="admin-section" data-section="backups">Copias</button><button class="tab ${section==='log'?'active':''}" data-action="admin-section" data-section="log">Log</button></div>`;
 return `<div class="page">${tabs}${section==='usuarios'?adminUsersHtml():section==='negocio'?adminBusinessHtml():section==='fiscal'?adminFiscalHtml():section==='storage'?adminStorageHtml():section==='backups'?adminBackupHtml():adminLogHtml()}</div>`;
}
function adminUsersHtml(){
 if(!isAdmin())return '<section class="card card-pad"><h2>Usuarios</h2><div class="note">Solo el administrador gestiona usuarios.</div></section>';
 const rows=state.data.team;
 const headers=[{label:'Usuario',html:r=>`<b>${esc(r.full_name)}</b><div class="small muted">${esc(r.email)}</div>`},{label:'Rol',html:r=>esc(r.role)},{label:'Puesto',html:r=>esc(r.job_title||'—')},{label:'Estado',html:r=>stateBadge(r.active?'activo':'inactivo')},{label:'',html:r=>btn('Editar','user-edit','secondary',`data-email="${esc(r.email)}"`)}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Usuarios</h2><p>Accesos, roles y contraseñas.</p></div>${btn('+ Nuevo usuario','user-new','primary')}</div>${table(headers,rows,{emptyTitle:'Sin usuarios'})}</section>`;
}
function adminBusinessHtml(){
 const s=state.data.settings||{}; const locked=isAdmin()?'':'disabled';
 const storeRows=state.data.stores.map(st=>`<div class="admin-entity"><div><b>${esc(st.name)}</b><div class="small muted">${esc(st.code||'')} · ${st.active?'Activo':'Inactivo'}</div></div><div class="inline-actions">${isAdmin()?btn('Editar','store-edit','secondary',`data-id="${st.id}"`):''}</div><div class="entity-children">${state.data.drawers.filter(d=>d.store_id===st.id).map(d=>`<div class="summary-row"><span>${esc(d.name)} ${d.active?'':'(inactiva)'}</span>${isAdmin()?btn('Editar caja','drawer-edit','secondary',`data-id="${d.id}" data-store="${st.id}"`):''}</div>`).join('')||'<div class="small muted">Sin cajas</div>'}${isAdmin()?btn('+ Añadir caja','drawer-new','secondary',`data-store="${st.id}"`):''}</div></div>`).join('');
 return `<div class="split">
  <section class="card card-pad"><div class="section-head"><div><h2>Datos del negocio</h2><p>Una sola ubicación para identidad fiscal y contacto.</p></div></div><div class="form-grid" style="margin-top:14px">${formField('Nombre / razón fiscal','cfgBusiness',s.business_name||'','text',locked)}${formField('NIF','cfgTax',s.tax_id||'','text',locked)}${formField('Dirección','cfgAddress',s.business_address||'','text',locked)}${formField('Email','cfgEmail',s.business_email||'','email',locked)}${formField('Teléfono','cfgPhone',s.business_phone||'','text',locked)}</div>${isAdmin()?`<div class="form-actions">${btn('Guardar datos','config-save','primary')}</div>`:''}</section>
  <section class="card card-pad"><div class="section-head"><div><h2>Establecimientos y cajas</h2><p>Configuración física usada por Cajas.</p></div>${isAdmin()?btn('+ Establecimiento','store-new','primary'):''}</div><div class="stack" style="margin-top:14px">${storeRows}</div></section>
 </div>`;
}
function adminFiscalHtml(){
 const s=state.data.settings||{}; const locked=isAdmin()?'':'disabled';
 return `<section class="card card-pad"><div class="section-head"><div><h2>Configuración fiscal</h2><p>Parámetros de previsión. No sustituye a la gestoría.</p></div></div><div class="form-grid" style="margin-top:14px">
 ${formField('IVA venta (%)','cfgVat',s.default_sales_vat_rate??21,'number',locked+' step="0.1"')}${formField('Recargo equivalencia compra (%)','cfgPurchaseRe',s.purchase_re_rate??5.2,'number',locked+' step="0.1"')}${formField('Pago fraccionado IRPF (%)','cfgIrpf',s.irpf_prepayment_rate??20,'number',locked+' step="0.1"')}${formField('Difícil justificación (%)','cfgDifficultPct',s.difficult_expense_pct??5,'number',locked+' step="0.1"')}${formField('Tope anual difícil justificación','cfgDifficultCap',s.difficult_expense_annual_cap??2000,'number',locked+' step="0.01"')}${formField('Cuota RETA actual','cfgReta',s.actual_reta_monthly??'','number',locked+' step="0.01"')}${formField('Tipo RETA referencia (%)','cfgRetaRate',s.reta_total_rate??31.5,'number',locked+' step="0.1"')}${formField('Deducción RETA genérica (%)','cfgRetaDeduction',s.reta_generic_deduction_pct??7,'number',locked+' step="0.1"')}${formField('Margen operativo objetivo (%)','cfgMargin',s.target_operating_margin_pct??15,'number',locked+' step="0.1"')}
 <label class="check-field wide"><input id="cfgDifficultEnabled" type="checkbox" ${s.difficult_expense_enabled===false?'':'checked'} ${locked}> Aplicar difícil justificación en previsión</label>
 <label class="wide">Notas fiscales<textarea id="cfgFiscalNotes" rows="4" ${locked}>${esc(s.fiscal_notes||'')}</textarea></label>
 </div>${isAdmin()?`<div class="form-actions">${btn('Guardar configuración fiscal','config-save','primary')}</div>`:''}</section>`;
}
function adminStorageHtml(){
 const u=state.data.storageUsage||{},used=Number(u.total_bytes||0),limit=Number(u.limit_bytes||524288000);
 return `<div class="kpis">${kpi('Uso total',(used/1024/1024).toFixed(1).replace('.',',')+' MB')}${kpi('Límite configurado',(limit/1024/1024).toFixed(0)+' MB')}${kpi('Documentos',String(u.documents_count||0))}${kpi('Assets',String(u.assets_count||0))}</div><section class="card card-pad"><h2>Almacenamiento</h2><div class="summary-row"><span>Documentos</span><strong>${(Number(u.documents_bytes||0)/1024/1024).toFixed(1).replace('.',',')} MB</strong></div><div class="summary-row"><span>Logos/assets</span><strong>${(Number(u.assets_bytes||0)/1024/1024).toFixed(1).replace('.',',')} MB</strong></div><div class="summary-row"><span>Disponible</span><strong>${(Math.max(0,limit-used)/1024/1024).toFixed(1).replace('.',',')} MB</strong></div><div class="note" style="margin-top:12px">El contador usa bytes reales de Storage y el límite configurado de 500 MB.</div></section>`;
}
function adminBackupHtml(){
 if(!isAdmin())return '<section class="card card-pad"><h2>Copias</h2><div class="note">Solo el administrador puede descargar o restaurar copias completas.</div></section>';
 return `<section class="card card-pad"><div class="section-head"><div><h2>Copias de seguridad</h2><p>Incluye datos, documentos y logos. Auth/usuarios quedan fuera.</p></div>${btn('Descargar copia completa','backup-create','primary')}</div><div class="form-grid" style="margin-top:14px"><label class="wide">Cargar copia<input id="backupFile" type="file" accept=".totusbackup,application/zip"></label></div><div class="note warn" style="margin-top:12px">Restaurar sustituye los datos de negocio y exige tres confirmaciones.</div><div class="form-actions">${btn('Restaurar copia','backup-restore','danger')}</div></section>`;
}
function adminLogHtml(){
 const headers=[{label:'Fecha',html:r=>esc(new Date(r.created_at).toLocaleString('es-ES'))},{label:'Usuario',html:r=>esc(r.user_email||'—')},{label:'Área',html:r=>esc(r.area)},{label:'Acción',html:r=>esc(r.action)},{label:'Detalle',html:r=>`<span class="small">${esc(JSON.stringify(r.detail||{}))}</span>`}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Log</h2><p>Trazabilidad administrativa y cambios relevantes.</p></div></div>${table(headers,state.data.audit,{emptyTitle:'Sin registros'})}</section>`;
}

export function pricing(){
 const view=getView('pricing');
 if(view.mode==='record'){
   const row=view.id?state.data.products.find(x=>x.id===view.id):null;
   return productRecordHtml(row);
 }
 const q=getFilters('pricing').query.toLowerCase();
 const rows=state.data.products.filter(x=>!q||[x.name,x.sku,x.status].join(' ').toLowerCase().includes(q));
 const familyName=id=>state.data.families.find(x=>x.id===id)?.name||'—';
 const costOf=prod=>{
   const list=state.data.providerPrices.filter(x=>x.product_id===prod.id&&!x.variant_id);
   if(!list.length)return 0;
   const chosen=list.find(x=>x.selected)||[...list].sort((a,b)=>providerCost(a)-providerCost(b))[0];
   return providerCost(chosen);
 };
 const headers=[
  {label:'Producto',html:r=>`<b>${esc(r.name)}</b><div class="small muted">${esc(r.sku)}</div>`},
  {label:'Familia',html:r=>esc(familyName(r.family_id))},
  {label:'Coste',num:true,html:r=>moneyCell(costOf(r))},
  {label:'PVP',num:true,html:r=>moneyCell(r.current_pvp||r.proposed_pvp)},
  {label:'Margen',num:true,html:r=>{const price=Number(r.current_pvp||r.proposed_pvp||0),cost=costOf(r),vat=Number(state.data.settings?.default_sales_vat_rate||21),net=price/(1+vat/100);return net>0?((net-cost)/net*100).toFixed(1).replace('.',',')+' %':'—'}},
  {label:'Estado',html:r=>stateBadge(r.status)},{label:'',html:r=>btn('Abrir','product-edit','secondary',`data-id="${r.id}"`)}
 ];
 const consultations=state.data.consultations.slice(0,20);
 return `<div class="page">
 <div class="kpis">${kpi('Productos',String(rows.length))}${kpi('Familias',String(state.data.families.length))}${kpi('Proveedores',String(state.data.providers.length))}${kpi('Consultas',String(state.data.consultations.length))}</div>
 <section class="card table-card"><div class="section-head card-pad"><div><h2>Pricing</h2><p>Costes, PVP, margen, proveedores, variantes y competencia.</p></div><div class="inline-actions">${btn('Marcas y familias','families-manage','secondary')}${btn('Proveedores','providers-manage','secondary')}${btn('+ Nuevo producto','product-new','primary')}</div></div><div class="filters"><div class="field search"><label>Buscar</label><input id="pricingQuery" value="${esc(getFilters('pricing').query)}" placeholder="Producto, referencia o estado"></div>${btn('Buscar','pricing-search','primary')}</div>${table(headers,rows,{emptyTitle:'Sin productos',emptyText:'Todavía no hay productos registrados.'})}</section>
 <section class="card card-pad"><div class="section-head"><div><h2>Consulta rápida</h2><p>Calcula y guarda consultas reutilizables.</p></div></div><div class="form-grid" style="margin-top:14px">
  ${formField('Consulta / producto','pqQuery','')}
  ${formField('Coste neto','pqCost','','number','step="0.01" min="0"')}
  ${formField('PVP','pqPvp','','number','step="0.01" min="0"')}
  ${formField('Competencia','pqCompetitor','','number','step="0.01" min="0"')}
  ${formField('Descuento (%)','pqDiscount',0,'number','step="0.1" min="0" max="100"')}
 </div><div class="form-actions">${btn('Calcular y guardar','consultation-save','primary')}</div>
 <div class="stack" style="margin-top:14px">${consultations.length?consultations.map(c=>`<div class="summary-row"><div><b>${esc(c.query)}</b><div class="small muted">PVP ${money(c.pvp)} · Margen ${Number(c.margin_pct||0).toFixed(1).replace('.',',')} %</div></div><div class="inline-actions">${btn('Reutilizar','consultation-reuse','secondary',`data-id="${c.id}"`)}${btn('Eliminar','consultation-delete','danger',`data-id="${c.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin consultas</strong><span>Las consultas guardadas aparecerán aquí.</span></div>'}</div>
 </section>
 </div>`;
}

export function providerCost(row){
 const base=Number(row?.net_cost||0)*(1-Number(row?.provider_discount||0)/100);
 return base+Number(row?.shipping_unit||0);
}


export const renderers={inicio,pricing,cajas,gastos,facturacion,documentos,fiscalidad,informes,administracion};

export function openingDrawerCash(storeId,drawerId){
 const previous=state.data.closings.filter(x=>x.store_id===storeId&&x.status==='cerrado').sort((a,b)=>String(b.business_date).localeCompare(String(a.business_date)))[0];
 if(!previous)return 0;
 return Number(state.data.closingDrawers.find(x=>x.closing_id===previous.id&&x.drawer_id===drawerId)?.closing_cash||0);
}

function drawerEditor(drawer,row,locked=false){
 const saved=row?state.data.closingDrawers.find(x=>x.closing_id===row.id&&x.drawer_id===drawer.id):null;
 const open=saved?.opening_cash??openingDrawerCash(drawer.store_id,drawer.id);
 return `<section class="card card-pad drawer-entry" data-drawer-id="${drawer.id}">
  <div class="section-head"><div><h3>${esc(drawer.name)}</h3><p>Importes de esta caja.</p></div></div>
  <div class="form-grid" style="margin-top:12px">
   ${formField('Apertura efectivo',`drOpen_${drawer.id}`,open,'number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Efectivo final',`drClose_${drawer.id}`,saved?.closing_cash??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Tarjeta',`drCard_${drawer.id}`,saved?.card_sales??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Bizum',`drBizum_${drawer.id}`,saved?.bizum_sales??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Pedidos online',`drOnline_${drawer.id}`,saved?.online_sales??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Otros ingresos',`drOther_${drawer.id}`,saved?.other_income??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Salidas de efectivo',`drWithdraw_${drawer.id}`,saved?.cash_withdrawals??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Gastos pagados en caja',`drCashExpense_${drawer.id}`,saved?.cash_expenses_declared??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Entradas extraordinarias',`drExtraIn_${drawer.id}`,saved?.cash_extra_in??'','number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Salidas extraordinarias',`drExtraOut_${drawer.id}`,saved?.cash_extra_out??'','number','step="0.01" '+(locked?'disabled':''))}
  </div>
 </section>`;
}

export function closingRecordHtml(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const view=getView('cajas');
 const sid=row?.store_id||view.storeId||storeOptions[0]?.value||'';
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
      ${selectField('Tienda','clStore',storeOptions,sid,locked?'disabled':'')}
      ${formField('Fecha','clDate',row?.business_date||isoToday(),'date',locked?'disabled':'')}
      ${formField('Total TPV / control','clReported',row?.reported_total_sales??'','number','step="0.01" min="0" '+(locked?'disabled':''))}
      <label class="wide">Observaciones<textarea id="clNotes" rows="3" ${locked?'disabled':''}>${esc(row?.notes||'')}</textarea></label>
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

export function expenseLineRow(line={},index=0,categories=[]){
 return `<div class="expense-line" data-line-index="${index}">
  <div class="form-grid">
   ${selectField('Categoría',`exLineCategory_${index}`,[{value:'',label:'Sin categoría'},...categories],line.category_id||'')}
   ${formField('Descripción',`exLineDesc_${index}`,line.description||'')}
   ${formField('Base',`exLineBase_${index}`,line.base_amount??'','number','step="0.01" min="0"')}
   ${formField('IVA (%)',`exLineVat_${index}`,line.vat_rate??21,'number','step="0.1" min="0"')}
   ${formField('Recargo (%)',`exLineRe_${index}`,line.re_rate??0,'number','step="0.1" min="0"')}
   ${formField('Retención (%)',`exLineWh_${index}`,line.withholding_rate??0,'number','step="0.1" min="0"')}
   ${selectField('Modelo',`exLineModel_${index}`,[{value:'',label:'Sin modelo'},{value:'111',label:'111'},{value:'115',label:'115'}],line.withholding_model||'')}
   ${formField('% deducible',`exLineDedPct_${index}`,line.deductible_pct??100,'number','min="0" max="100"')}
   <label class="check-field"><input id="exLineDed_${index}" type="checkbox" ${line.deductible_irpf===false?'':'checked'}> Deducible IRPF</label>
   <label class="check-field"><input id="exLineFixed_${index}" type="checkbox" ${line.fixed_asset?'checked':''}> Inmovilizado</label>
   ${formField('Años amortización',`exLineAmort_${index}`,line.amortization_years??'','number','step="0.1" min="0"')}
  </div>
  <div class="inline-actions" style="justify-content:flex-end;margin-top:8px">${btn('Quitar línea','expense-line-remove','danger',`data-index="${index}"`)}</div>
 </div>`;
}

export function expenseRecordHtml(row=null){
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const suppliers=[{value:'',label:'Proveedor manual'},...state.data.suppliers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const categories=state.data.categories.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||x.code||'Categoría'}));
 const lines=row?state.data.expenseLines.filter(x=>x.expense_id===row.id).sort((a,b)=>a.sort_order-b.sort_order):[{description:'',base_amount:'',vat_rate:21,re_rate:0,withholding_rate:0,deductible_irpf:true,deductible_pct:100,fixed_asset:false}];
 const doc=row?.document_id?state.data.documents.find(x=>x.id===row.document_id):null;
 const total=Number(row?.gross_expense||row?.accounting_amount||row?.amount_paid||0),paid=Number(row?.amount_paid||0),pending=Math.max(0,total-paid);
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
     </div>
     <div class="attachment-box" style="margin-top:14px">
      <div><b>Justificante</b><div class="small muted">${doc?esc(doc.original_name):'Sin archivo vinculado'}</div></div>
      <div class="inline-actions">${doc?btn('Vista previa','expense-document-preview','secondary',`data-id="${doc.id}"`):''}${doc?btn('Descargar','expense-document-download','secondary',`data-id="${doc.id}"`):''}${doc?btn('Quitar','expense-document-unlink','danger',`data-expense="${row.id}" data-document="${doc.id}"`):''}</div>
      <label class="file-picker">Seleccionar o sustituir archivo<input id="exFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md"></label>
     </div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>2 · Conceptos</h3><p>Una factura puede tener varias líneas fiscales.</p></div>${btn('+ Añadir línea','expense-line-add','secondary')}</div>
     <div id="expenseLines" class="stack" style="margin-top:14px">${lines.map((l,i)=>expenseLineRow(l,i,categories)).join('')}</div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>3 · Tratamiento general</h3><p>Control interno, pago y observaciones.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      <label class="check-field wide emphasis-check"><input id="exManagement" type="checkbox" ${row?.management_only?'checked':''}> Solo control interno · no enviar a gestoría ni incluir en cálculo fiscal</label>
      ${formField('Tipo interno','exPersonnelKind',row?.personnel_kind||'')}
      ${selectField('Forma de pago','exPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'tarjeta')}
      ${selectField('Estado de pago','exPaidStatus',[{value:'pagado',label:'Pagado'},{value:'pendiente',label:'Pendiente'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pagado')}
      ${formField('Fecha de pago','exPaidDate',row?.paid_date||'','date')}
      ${formField('Importe pagado','exPaidAmount',row?.amount_paid??'','number','step="0.01" min="0"')}
      <label class="wide">Observaciones<textarea id="exNotes" rows="4">${esc(row?.notes||'')}</textarea></label>
     </div>
    </section>
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
 const isRect=invoiceKind==='rectifying';
 const isExternal=origin==='externa';
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const view=getView('facturacion');
 const selectedStore=row?.store_id||view.storeId||storeOptions[0]?.value||'';
 const series=state.data.series.filter(s=>s.active!==false&&s.document_type===docType&&(!s.store_id||s.store_id===selectedStore)&&(!isProforma?s.series_kind===(isRect?'rectifying':'invoice'):true)).map(s=>({value:s.id,label:s.code}));
 const activeTemplates=state.data.templates.filter(x=>x.active!==false);
 const defaultTemplate=activeTemplates.find(x=>isProforma?x.default_proforma:x.default_invoice);
 const templates=[{value:'',label:'Sin plantilla'},...activeTemplates.map(x=>({value:x.id,label:x.name}))];
 const customers=[{value:'',label:'Cliente nuevo / manual'},...state.data.customers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const lines=row?state.data.invoiceLines.filter(x=>x.invoice_id===row.id).sort((a,b)=>a.sort_order-b.sort_order):[{description:'',quantity:1,unit_price_base:'',discount_pct:0,vat_rate:21}];
 const original=row?.source_document_id?state.data.documents.find(x=>x.id===row.source_document_id):null;
 const title=isProforma?'Proforma':isRect?'Factura rectificativa':isExternal?'Factura externa':'Factura';
 const issued=!!row&&row.status!=='borrador',lock=issued?'disabled':'';
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="invoice-back">← Volver a facturación</button><div class="eyebrow">Facturación · ${title}</div><h2>${row?esc(row.display_number||row.external_number_text||'Borrador'):'Nueva '+title.toLowerCase()}</h2></div><div>${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>1 · Documento</h3><p>Serie, fechas y referencia.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','ivStore',storeOptions,selectedStore,lock)}
      ${selectField('Serie','ivSeries',series,row?.series_id||series[0]?.value||'',lock)}
      ${formField('Fecha emisión','ivDate',row?.issue_date||isoToday(),'date',lock)}
      ${formField('Fecha operación','ivOperation',row?.operation_date||'','date',lock)}
      ${formField('Fecha vencimiento','ivDue',row?.due_date||'','date',lock)}
      ${isExternal?formField('Número externo','ivExternalNumber',row?.external_number_text||'','text',lock):''}
      ${formField('Referencia pedido','ivPO',row?.purchase_order_ref||'','text',lock)}
     </div>
     ${isExternal?`<div class="attachment-box" style="margin-top:14px"><div><b>Original obligatorio</b><div class="small muted">${original?esc(original.original_name):'Sin archivo original'}</div></div><div class="inline-actions">${original?btn('Vista previa','invoice-source-preview','secondary',`data-id="${original.id}"`):''}${original?btn('Descargar','invoice-source-download','secondary',`data-id="${original.id}"`):''}</div>${!issued?'<label class="file-picker">Seleccionar original<input id="ivSourceFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></label>':''}</div>`:''}
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>2 · Cliente</h3></div></div><div class="form-grid" style="margin-top:14px">
      ${selectField('Cliente guardado','ivCustomerId',customers,row?.customer_id||'',lock)}
      ${formField('Cliente','ivCustomer',row?.customer_name||'','text',lock)}
      ${formField('NIF/CIF','ivTax',row?.customer_tax_id||'','text',lock)}
      ${formField('Email','ivEmail',row?.customer_email||'','email',lock)}
      <label class="wide">Dirección<textarea id="ivAddress" rows="2" ${lock}>${esc(row?.customer_address||'')}</textarea></label>
     </div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>3 · Líneas</h3><p>Conceptos facturados.</p></div>${!issued?btn('+ Añadir línea','invoice-line-add','secondary'):''}</div><div id="invoiceLines" class="stack" style="margin-top:14px">${lines.map((l,i)=>issued?invoiceLineRow(l,i).replaceAll('<input ','<input disabled ').replaceAll('data-action="invoice-line-remove"','disabled data-action="invoice-line-remove"'):invoiceLineRow(l,i)).join('')}</div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>4 · Cobro y notas</h3></div></div><div class="form-grid" style="margin-top:14px">
      ${formField('Concepto general','ivConcept',row?.concept||'','text',lock)}
      ${selectField('Forma de pago','ivPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'transferencia')}
      ${!isProforma?selectField('Estado de cobro','ivPaidStatus',[{value:'pendiente',label:'Pendiente'},{value:'pagada',label:'Pagada'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pendiente'):''}
      ${!isProforma?formField('Fecha de cobro','ivPaidDate',row?.paid_date||'','date'):''}
      ${!isProforma?formField('Importe cobrado','ivPaidAmount',row?.paid_amount??0,'number','step="0.01" min="0"'):''}
      ${!isProforma?`<label class="check-field wide"><input id="ivIncludeIncome" type="checkbox" ${row?.include_in_income?'checked':''}> Incluir esta factura como ingreso adicional fuera de los cierres diarios</label>`:''}
      <label class="wide">Notas internas<textarea id="ivNotes" rows="3" ${issued?'disabled':''}>${esc(row?.notes||'')}</textarea></label>
     </div></section>
    <details class="card card-pad design-details"><summary><b>5 · Plantilla y presentación</b><span class="small muted">Secundario</span></summary><div class="form-grid" style="margin-top:14px">${selectField('Plantilla','ivTemplate',templates,row?.template_id||defaultTemplate?.id||'',lock)}<label class="wide">Términos<textarea id="ivTerms" rows="2">${esc(row?.terms_text||'')}</textarea></label><label class="wide">Pie<textarea id="ivFooter" rows="2">${esc(row?.footer_text||'')}</textarea></label></div></details>
   </div>
   <aside class="record-side"><section class="card card-pad sticky-summary"><h3>Resumen</h3><div class="summary-row"><span>Base</span><strong id="ivSumBase">${money(row?.base_amount||0)}</strong></div><div class="summary-row"><span>IVA</span><strong id="ivSumVat">${money(row?.vat_amount||0)}</strong></div><div class="summary-row"><span>Total</span><strong id="ivSumTotal">${money(row?.total_amount||0)}</strong></div><div class="stack" style="margin-top:14px">${row?btn('Vista previa','invoice-preview','secondary',`data-id="${row.id}"`):''}${row?.status==='borrador'||!row?btn('Guardar borrador','invoice-save','secondary',`${row?`data-id="${row.id}" `:''}data-type="${docType}" data-kind="${invoiceKind}" data-origin="${origin}"`):''}${row?.status==='borrador'?btn(isProforma?'Emitir proforma':'Emitir documento','invoice-finalize','primary',`data-id="${row.id}"`):''}${row&&issued&&!isProforma?btn('Guardar cobro','invoice-payment-save','primary',`data-id="${row.id}"`):''}${row&&isProforma&&['emitida','aceptada'].includes(row.status)?btn('Convertir en factura','proforma-convert','primary',`data-id="${row.id}"`):''}${btn('Volver','invoice-back','secondary')}</div></section></aside>
  </div>
 </div>`;
}

export function invoicePreview(row,logoUrl=''){
 const lines=state.data.invoiceLines.filter(x=>x.invoice_id===row.id).sort((a,b)=>a.sort_order-b.sort_order);
 const frozen=row.status!=='borrador'&&row.template_snapshot&&Object.keys(row.template_snapshot||{}).length?row.template_snapshot:null;
 const tpl=frozen||(state.data.templates.find(x=>x.id===row.template_id)||{});
 const title=row.document_type==='proforma'?(tpl.proforma_title||'FACTURA PROFORMA'):(row.invoice_kind==='rectifying'?'FACTURA RECTIFICATIVA':(tpl.invoice_title||'FACTURA'));
 const primary=tpl.primary_color||'#17365D',secondary=tpl.secondary_color||'#4472C4',biz=state.data.settings||{};
 const paymentText=[row.payment_method?('Forma de pago: '+row.payment_method):'',row.paid_status&&row.document_type!=='proforma'?('Estado: '+row.paid_status):'',tpl.bank_details||'',tpl.payment_terms_default||''].filter(Boolean).join(' · ');
 return `<article class="invoice-preview" style="--invoice-primary:${esc(primary)};--invoice-secondary:${esc(secondary)}">
  <header class="invoice-document-head">
   <div class="invoice-company">
    ${logoUrl&&tpl.show_logo!==false?`<img src="${esc(logoUrl)}" alt="Logo" class="invoice-logo" style="max-width:${Math.max(70,Math.min(260,Number(tpl.logo_width_mm||34)*4))}px">`:''}
    <div><b class="invoice-company-name">${esc(biz.business_name||'')}</b><div>${esc(biz.tax_id||'')}</div><div>${esc(biz.business_address||'')}</div>${tpl.show_company_email!==false&&biz.business_email?`<div>${esc(biz.business_email)}</div>`:''}${tpl.show_company_phone!==false&&biz.business_phone?`<div>${esc(biz.business_phone)}</div>`:''}</div>
   </div>
   <div class="invoice-identity"><div class="invoice-title">${esc(title)}</div><div class="invoice-number">${esc(row.display_number||row.external_number_text||'BORRADOR')}</div><div>Emisión: <b>${fmtDate(row.issue_date)}</b></div>${row.operation_date?`<div>Operación: <b>${fmtDate(row.operation_date)}</b></div>`:''}${row.due_date?`<div>Vencimiento: <b>${fmtDate(row.due_date)}</b></div>`:''}</div>
  </header>
  ${tpl.header_text?`<div class="invoice-header-text">${esc(tpl.header_text)}</div>`:''}
  <section class="invoice-client-box"><div class="eyebrow">Cliente</div><b>${esc(row.customer_name||'—')}</b><div>${esc(row.customer_tax_id||'')}</div><div>${esc(row.customer_address||'')}</div>${row.customer_email?`<div>${esc(row.customer_email)}</div>`:''}</section>
  ${row.concept?`<div class="invoice-concept"><b>Concepto:</b> ${esc(row.concept)}</div>`:''}
  <div class="invoice-lines-wrap">${table([
   {label:'Descripción',html:l=>esc(l.description)},{label:'Cantidad',num:true,html:l=>String(l.quantity)},{label:'Precio',num:true,html:l=>moneyCell(l.unit_price_base)},
   {label:'Dto.',num:true,html:l=>`${Number(l.discount_pct||0).toFixed(1).replace('.',',')} %`},{label:'IVA',num:true,html:l=>`${Number(l.vat_rate||0).toFixed(1).replace('.',',')} %`},{label:'Total',num:true,html:l=>moneyCell(l.total_amount)}
  ],lines,{emptyTitle:'Sin líneas'})}</div>
  <div class="invoice-totals"><div class="summary-row"><span>Base imponible</span><strong>${money(row.base_amount)}</strong></div><div class="summary-row"><span>IVA</span><strong>${money(row.vat_amount)}</strong></div><div class="summary-row invoice-grand-total"><span>Total</span><strong>${money(row.total_amount)}</strong></div>${row.document_type!=='proforma'&&Number(row.paid_amount||0)>0?`<div class="summary-row"><span>Cobrado</span><strong>${money(row.paid_amount)}</strong></div><div class="summary-row"><span>Pendiente</span><strong>${money(Math.max(0,Number(row.total_amount||0)-Number(row.paid_amount||0)))}</strong></div>`:''}</div>
  ${paymentText?`<section class="invoice-payment-box"><b>Pago</b><div>${esc(paymentText)}</div></section>`:''}
  ${tpl.footer_text?`<footer class="invoice-footer">${esc(tpl.footer_text)}</footer>`:''}
  <div class="form-actions no-print">${btn('Imprimir / Guardar PDF','invoice-print','primary',`data-id="${row.id}"`)}</div>
 </article>`;
}

export function productRecordHtml(row=null){
 const families=state.data.families.map(x=>({value:x.id,label:x.name}));
 const prices=row?state.data.providerPrices.filter(x=>x.product_id===row.id&&!x.variant_id):[];
 const comps=row?state.data.competitors.filter(x=>x.product_id===row.id&&!x.variant_id):[];
 const variants=row?state.data.variants.filter(x=>x.product_id===row.id&&x.active!==false):[];
 const chosen=prices.find(x=>x.selected)||(prices.length?[...prices].sort((a,b)=>providerCost(a)-providerCost(b))[0]:null);
 const vat=Number(state.data.settings?.default_sales_vat_rate||21),re=Number(state.data.settings?.purchase_re_rate||5.2);
 const cost=providerCost(chosen),pvp=Number(row?.current_pvp||row?.proposed_pvp||0),net=pvp/(1+vat/100),fiscalCost=cost*(1+vat/100+re/100),grossMargin=pvp-fiscalCost,margin=net-cost,marginPct=net>0?margin/net*100:0;
 const providerName=id=>state.data.providers.find(x=>x.id===id)?.name||'Proveedor';
 const providerRows=prices.map(x=>`<div class="summary-row"><div><b>${esc(providerName(x.provider_id))}</b><div class="small muted">Coste final ${money(providerCost(x))} · base ${money(x.net_cost)} · dto ${Number(x.provider_discount||0).toFixed(1).replace('.',',')} %${x.apply_special_tax?' · + impuesto especial':''}</div></div><div class="inline-actions">${x.selected?'<span class="badge ok">Seleccionado</span>':''}${btn('Editar','provider-price-edit','secondary',`data-id="${x.id}" data-product="${row.id}"`)}${btn('Eliminar','provider-price-delete','danger',`data-id="${x.id}" data-product="${row.id}"`)}</div></div>`).join('')||'<div class="empty"><strong>Sin proveedores</strong><span>Añade al menos un coste de compra.</span></div>';
 const compRows=comps.map(x=>`<div class="summary-row"><div><b>${esc(x.competitor_name)}</b><div class="small muted">${money(x.price)} · dto ${Number(x.discount||0).toFixed(1).replace('.',',')} % · envío ${money(x.shipping)}</div></div><div class="inline-actions">${btn('Editar','competitor-edit','secondary',`data-id="${x.id}" data-product="${row.id}"`)}${btn('Eliminar','competitor-delete','danger',`data-id="${x.id}" data-product="${row.id}"`)}</div></div>`).join('')||'<div class="empty"><strong>Sin competencia</strong><span>Añade precios comparables si los necesitas.</span></div>';
 const variantRows=variants.map(v=>`<div class="summary-row"><div><b>${esc(v.name)}</b><div class="small muted">${esc(v.sku)}${v.nicotine_mg_ml!=null?' · '+v.nicotine_mg_ml+' mg/ml':''}${v.pvp!=null?' · PVP '+money(v.pvp):''}</div></div><div class="inline-actions">${btn('Editar','variant-edit','secondary',`data-id="${v.id}" data-product="${row.id}"`)}${btn('Eliminar','variant-delete','danger',`data-id="${v.id}" data-product="${row.id}"`)}</div></div>`).join('')||'<div class="empty"><strong>Sin variantes</strong><span>Producto simple o sin variantes creadas.</span></div>';
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="product-back">← Volver a Pricing</button><div class="eyebrow">Pricing · ${row?'Producto':'Nuevo'}</div><h2>${row?esc(row.name):'Nuevo producto'}</h2></div><div>${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>Producto</h3><p>Datos maestros y PVP.</p></div></div><div class="form-grid" style="margin-top:14px">
     ${formField('Nombre','prName',row?.name||'')}${formField('Referencia / SKU','prSku',row?.sku||'')}
     ${selectField('Familia','prFamily',[{value:'',label:'Sin familia'},...families],row?.family_id||'')}
     ${selectField('Tipo','prType',[{value:'simple',label:'Simple'},{value:'variants',label:'Con variantes'}],row?.product_type||'simple')}
     ${formField('PVP actual','prPvp',row?.current_pvp??'','number','step="0.01" min="0"')}
     ${formField('PVP propuesto','prProposed',row?.proposed_pvp??'','number','step="0.01" min="0"')}
     ${formField('Unidades/mes','prUnits',row?.units_month??0,'number','min="0"')}
     ${selectField('Estado','prStatus',[{value:'PENDIENTE',label:'Pendiente'},{value:'ACEPTADO',label:'Aceptado'}],row?.status||'PENDIENTE')}
     <label class="wide">Notas<textarea id="prNotes" rows="3">${esc(row?.notes||'')}</textarea></label>
    </div></section>
    ${row?`<section class="card card-pad"><div class="section-head"><div><h3>Proveedores</h3><p>Comparativa real de coste de compra.</p></div>${btn('+ Añadir proveedor','provider-price-new','secondary',`data-product="${row.id}"`)}</div><div style="margin-top:12px">${providerRows}</div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>Competencia</h3><p>Precios externos y promociones.</p></div>${btn('+ Añadir competencia','competitor-new','secondary',`data-product="${row.id}"`)}</div><div style="margin-top:12px">${compRows}</div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>Variantes</h3><p>Nicotina, formatos, colores u otros atributos.</p></div>${btn('+ Añadir variante','variant-new','secondary',`data-product="${row.id}"`)}</div><div style="margin-top:12px">${variantRows}</div></section>`:''}
   </div>
   <aside class="record-side"><section class="card card-pad sticky-summary"><h3>Resumen</h3>
    <div class="summary-row"><span>Coste neto</span><strong>${money(cost)}</strong></div><div class="summary-row"><span>Coste con IVA + RE</span><strong>${money(fiscalCost)}</strong></div><div class="summary-row"><span>PVP final</span><strong>${money(pvp)}</strong></div><div class="summary-row"><span>Margen neto</span><strong>${money(margin)}</strong></div><div class="summary-row"><span>Margen neto %</span><strong>${marginPct.toFixed(1).replace('.',',')} %</strong></div><div class="summary-row"><span>Margen caja tras IVA + RE</span><strong>${money(grossMargin)}</strong></div>
    <div class="stack" style="margin-top:14px">${row?btn('Eliminar producto','product-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar','product-save','primary',row?`data-id="${row.id}"`:'')}${btn('Cancelar','product-back','secondary')}</div>
   </section></aside>
  </div>
 </div>`;
}

