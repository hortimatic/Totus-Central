import {activitySeries,activityChartHtml} from '../dashboard-activity.js';
import {cotejos} from '../stock-cotejos.js';
import {normalizeReportOrder} from '../report-layout.js';
import {taxExpenseRecord} from '../tax-expense.js';
import {incomeBreakdown} from '../income-breakdown.js';
import {informationalTaxPayments,taxPaymentLabel} from '../payment-information.js';
import {oneDrivePanel,oneDriveStorageCard,oneDriveCredentialNotice} from '../onedrive-connection.js';
import {planStorage} from '../storage-planning.js';
import {MAX_SAVED_BACKUPS,backupRetentionCount,backupRunState,backupFailureSummary} from '../backup-retention.js';
import {archiveAccepted,quarterPresented,lastDrawerBalance} from '../historical-acceptance.js';
import {SUPABASE_URL} from '../config.js';
import {reportMonths,selectReportData,matchesText,searchText,selectDocuments} from '../report-period.js';
import {state,isAdmin,isManager,getFilters,getView} from '../state.js';
import {canUser,rolePermissions,PERMISSION_MODULES,PERMISSION_ACTIONS} from '../permissions.js';
import {sum,money,fmtDate,inRange,monthRange,isoToday,esc} from '../utils.js';
import {kpi,table,dateFilters,btn,moneyCell,stateBadge,formField,selectField,fieldHelp} from '../components.js';
import {expenseAttachedInvoices} from '../expense-register.js';
import {quickPriceStudy,isInvoiceRefund,invoiceOutstanding,issuedDocumentFileLocked} from '../calculations.js';
import {manualClosingReconciled,sourceClosingReconciled,computeModel130Accumulated,estimatePriorModel130,isReviewedFiscalExpense,deductibleExpenseTotal,expenseCostAmount,isUnreconciledPayment,isExpensePaymentEvidence,closingIncomeAmount} from '../calculations.js';

const stores=()=>state.data.stores.filter(x=>x.active!==false);
const storeName=id=>stores().find(x=>x.id===id)?.name||'—';
const acceptedExpense=row=>archiveAccepted(state.data.settings,row,'expense');
const acceptedClosing=row=>archiveAccepted(state.data.settings,row,'closing')||sourceClosingReconciled(row)||manualClosingReconciled(row);
const acceptedBadge='<span class="badge good">Conciliado y aceptado</span>';
const bookPaymentPending=row=>{if(acceptedExpense(row))return false;try{return JSON.parse(row?.source_ref||'{}').kind==='gestoria_book_entry'&&JSON.parse(row.source_ref).requires_payment_reconciliation===true}catch{return false}};
const expensePaymentBadge=row=>acceptedExpense(row)?acceptedBadge:isExpensePaymentEvidence(row)&&!isUnreconciledPayment(row)?'<span class="badge good">Pago conciliado</span>':bookPaymentPending(row)?'<span class="badge warn">Pago sin conciliar</span>':stateBadge(row.paid_status||'pendiente');
const closingHasOrigin=row=>{try{return JSON.parse(row?.source_ref||'{}').kind==='closing_source_snapshot'}catch{return false}};
const closingMonthlyReference=row=>state.data.incomeAdjustments.find(ref=>ref.store_id===row?.store_id&&Number(ref.amount)>0&&(()=>{try{const source=JSON.parse(ref.notes);return source.kind==='monthly_source_reference'&&source.period===String(row.business_date).slice(0,7)}catch{return false}})());

function closingDisplayDrawers(row,source){
 const drawers=state.data.drawers.filter(d=>d.store_id===row.store_id&&d.active!==false).map(d=>({...d}));
 const normal=name=>String(name||'').toLocaleLowerCase('es').replace(/^caja\s+/,'').trim();
 if(row.entry_mode==='source_snapshot')for(const raw of source?.daily_drawers??source?.drawers??[]){
  if(!drawers.some(d=>normal(d.name)===normal(raw.name)))drawers.push({name:raw.name,displayName:raw.name+' · registro anterior'});
 }
 return drawers;
}
function retainedCashByDrawer(row){
 const normal=name=>String(name||'').toLocaleLowerCase('es').replace(/^caja\s+/,'').trim();
 let source=null;try{source=JSON.parse(row.source_ref||'{}')}catch{}
 const drawers=closingDisplayDrawers(row,source);
 const amount=value=>value==null||value===''?'Sin importe anotado':money(value);
 return drawers.map(drawer=>{
  let opening,closing;
  if(row.entry_mode==='source_snapshot'){
   const matches=(source?.daily_drawers??source?.drawers??[]).filter(d=>normal(d.name)===normal(drawer.name));
   opening=matches[0]?.opening;closing=matches.at(-1)?.closing;
  }else{
   const saved=state.data.closingDrawers.find(x=>x.closing_id===row.id&&x.drawer_id===drawer.id);
   opening=saved?.opening_cash;closing=saved?.closing_cash;
  }
  return `<div class="drawer-cash-summary"><b>${esc(drawer.displayName||drawer.name)}</b><span>Para empezar ese día <b>${amount(opening)}</b></span><span>Lo que se deja al terminar <b>${amount(closing)}</b></span></div>`;
 }).join('');
}

function dailySalesByDrawer(row){
 const normal=name=>String(name||'').toLocaleLowerCase('es').replace(/^caja\s+/,'').trim();
 let source=null;try{source=JSON.parse(row.source_ref||'{}')}catch{}
 const drawers=closingDisplayDrawers(row,source);
 const detail=drawers.map(drawer=>{
  let sales=null;
  if(row.entry_mode==='source_snapshot'){
   const match=(source?.daily_drawers??source?.drawers??[]).filter(d=>normal(d.name)===normal(drawer.name));
   if(match.length&&match.every(d=>d.al_fin!=null))sales=match.reduce((n,d)=>n+Number(d.al_fin),0);
  }else{
   const d=state.data.closingDrawers.find(x=>x.closing_id===row.id&&x.drawer_id===drawer.id);
   if(d)sales=Number(d.closing_cash||0)+Number(d.cash_withdrawals||0)+Number(d.cash_expenses_declared||0)+Number(d.cash_extra_out||0)-Number(d.opening_cash||0)-Number(d.cash_extra_in||0)+Number(d.card_sales||0)+Number(d.bizum_sales||0)+Number(d.online_sales||0)+Number(d.other_income||0);
  }
  return `<span>${esc(drawer.displayName||drawer.name)} <b>${sales==null?'Sin importe anotado':money(sales)}</b></span>`;
 }).join('');
 const total=row.entry_mode==='source_snapshot'&&!sourceClosingReconciled(row)?row.reported_total_sales:['cash_sales','card_sales','bizum_sales','online_sales','other_income'].reduce((n,key)=>n+Number(row[key]||0),0);
 const collections=row.entry_mode==='source_snapshot'&&!sourceClosingReconciled(row)?`<span>Tarjeta <b>${source?.card_sales==null?'Sin importe anotado':money(source.card_sales)}</b></span><span>Los cobros en efectivo no están separados en el registro anterior.</span>`:[['Efectivo','cash_sales'],['Tarjeta','card_sales'],['Bizum','bizum_sales'],['Internet','online_sales'],['Otros cobros','other_income']].map(([name,key])=>`<span>${name} <b>${money(row[key]||0)}</b></span>`).join('');
 return `<div class="compact-detail">${sourceClosingReconciled(row)?'<span>Total conciliado de la tienda; cobros y retiradas sin reparto por caja.</span>':detail}<span><b>Ventas totales del día</b><b>${total==null?'Sin importe anotado':money(total)}</b></span><div class="compact-detail cash-collection-summary">${collections}</div></div>`;
}

export function inicio(){
 const today=isoToday(),month=monthRange(today),year=Number(today.slice(0,4)),m=Number(today.slice(5,7)),quarter=Math.ceil(m/3);
 const qFrom=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`,qTo=`${year}-${String(quarter*3).padStart(2,'0')}-${String(new Date(year,quarter*3,0).getDate()).padStart(2,'0')}`;
 const activeStores=stores(),activityFilter=getFilters('inicio'),activity=activitySeries(state.data,activityFilter);
 const monthClosings=state.data.closings.filter(x=>inRange(x.business_date,month.from,month.to));
 const quarterExpenses=state.data.expenses.filter(x=>inRange(x.expense_date,qFrom,qTo));
 const todays=state.data.closings.filter(x=>x.business_date===today);
 const missingStores=activeStores.filter(s=>!todays.some(x=>x.store_id===s.id&&x.status==='cerrado'));
 const draftClosings=state.data.closings.filter(x=>x.status==='borrador'&&!acceptedClosing(x)).length;
 const mismatches=state.data.closings.filter(x=>!acceptedClosing(x)&&Math.abs(Number(x.difference||0))>.01).length;
 const pendingExpenses=state.data.expenses.filter(x=>!acceptedExpense(x)&&x.paid_status&&x.paid_status!=='pagado'&&!bookPaymentPending(x));
 const pendingExpenseAmount=sum(pendingExpenses,x=>Math.max(0,Number(x.accounting_amount??x.gross_expense??0)-Number(x.withholding_amount||0)-Number(x.amount_paid||0)));
 const pendingRefunds=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&isInvoiceRefund(x)&&invoiceOutstanding(x)>.02);
 const pendingInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.paid_status!=='pagada'&&!isInvoiceRefund(x)).sort((a,b)=>String(a.due_date||a.issue_date||'').localeCompare(String(b.due_date||b.issue_date||'')));
 const pendingInvoiceAmount=sum(pendingInvoices,x=>Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)));
 const draftInvoices=state.data.invoices.filter(x=>x.status==='borrador').length;
 const recentDocs=[...state.data.documents].sort((a,b)=>String(b.created_at||b.document_date||'').localeCompare(String(a.created_at||a.document_date||''))).slice(0,4);
 const pendingDocs=state.data.documents.filter(x=>x.status==='pendiente').length;
 const usage=state.data.storageUsage||{};
 // Never silently show 0 MB on the home dashboard when the server measurement fails.
 const storageOk=usage.status==='ok'&&Number.isFinite(Number(usage.total_bytes))&&Number.isFinite(Number(usage.limit_bytes))&&Number(usage.limit_bytes)>0;
 const used=storageOk?Number(usage.total_bytes):null,limit=storageOk?Number(usage.limit_bytes):null,storagePct=storageOk?used/limit*100:null;
 const storageFiles=Number(usage.all_buckets_bytes),storageFilesOk=usage.all_buckets_bytes!=null&&Number.isFinite(storageFiles)&&storageFiles>=0;
 const yFrom=`${year}-01-01`;
 const incomeYtd=sum(state.data.closings.filter(x=>x.include_in_income!==false&&inRange(x.business_date,yFrom,qTo)),closingIncomeAmount)
  +sum(state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,yFrom,qTo)),x=>x.total_amount)
  +sum(state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,yFrom,qTo)),x=>x.amount)
  +sum(state.data.incomeAdjustments.filter(x=>inRange(x.income_date,yFrom,qTo)),x=>x.amount);
 const ytdExpenses=state.data.expenses.filter(x=>isReviewedFiscalExpense(x)&&inRange(x.expense_date,yFrom,qTo));
 const deductedYtd=deductibleExpenseTotal(ytdExpenses,state.data.expenseLines);
 const homeAdjustments=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,yFrom,qTo));
 const homeExtra=kinds=>sum(homeAdjustments.filter(x=>kinds.includes(x.kind)),x=>x.amount);
 const home130=computeModel130Accumulated({income:incomeYtd,deductible:deductedYtd,extraDeductible:homeExtra(['gasto_deducible_extra','amortizacion']),reductions:homeExtra(['reduccion']),withholdings:homeExtra(['retencion_soportada']),previousPayments:estimatePriorModel130(state.data,year,quarter).total,
  rate:state.data.settings?.irpf_prepayment_rate??20,difficultRate:state.data.settings?.difficult_expense_pct??5,difficultAnnualCap:state.data.settings?.difficult_expense_annual_cap??2000,difficultEnabled:state.data.settings?.difficult_expense_enabled!==false}).due;
 const homeQuarterIds=new Set(quarterExpenses.filter(isReviewedFiscalExpense).map(x=>x.id));
 const homeRetention=model=>sum(state.data.expenseLines.filter(x=>homeQuarterIds.has(x.expense_id)&&x.withholding_model===model),x=>x.withholding_amount);
 const homeForecast=[['130',home130],['111',homeRetention('111')],['115',homeRetention('115')]];
 const homeReserve=sum(homeForecast,([model,amount])=>Math.max(0,amount-sum(state.data.taxPayments.filter(x=>x.tax_type===model&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter&&['pagado','compensado'].includes(x.status)),x=>x.amount)));
 const pendingFiscal=state.data.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed===false&&inRange(x.expense_date,yFrom,qTo));
 const alerts=[];
 if(pendingFiscal.length)alerts.push({level:'warn',title:'Gastos fiscales sin revisar',text:pendingFiscal.length+' pendientes; no incluidos en la previsión de impuestos',route:'gastos'});
 if(missingStores.length)alerts.push({level:'warn',title:'Cierres pendientes hoy',text:missingStores.map(x=>x.name).join(', '),route:'cajas'});
 if(draftClosings)alerts.push({level:'warn',title:'Cierres en borrador',text:`${draftClosings} pendientes de cerrar`,route:'cajas'});
 if(mismatches)alerts.push({level:'bad',title:'Descuadres de caja',text:`${mismatches} cierre${mismatches===1?'':'s'} con diferencia`,route:'cajas'});
 if(pendingExpenses.length)alerts.push({level:'warn',title:'Gastos pendientes de pago',text:`${pendingExpenses.length} · ${money(pendingExpenseAmount)} pendientes`,route:'gastos'});
 if(pendingInvoices.length)alerts.push({level:'warn',title:'Facturas pendientes de cobro',text:`${pendingInvoices.length} · ${money(pendingInvoiceAmount)} pendientes`,route:'facturacion'});
 if(pendingRefunds.length)alerts.push({level:'warn',title:'Devoluciones pendientes',text:`${pendingRefunds.length} · ${money(sum(pendingRefunds,invoiceOutstanding))} por devolver a clientes`,route:'facturacion'});
 if(draftInvoices)alerts.push({level:'info',title:'Facturas/proformas en borrador',text:`${draftInvoices} por terminar`,route:'facturacion'});
 if(pendingDocs)alerts.push({level:'info',title:'Documentos por revisar',text:`${pendingDocs} pendientes`,route:'documentos'});
 if(storageOk&&storagePct>=85)alerts.push({level:storagePct>=95?'bad':'warn',title:'Almacenamiento',text:`${storagePct.toFixed(1).replace('.',',')} % utilizado`,route:'administracion'});
 if(!storageOk&&isManager())alerts.push({level:'warn',title:'Almacenamiento sin medición',text:'Supabase no ha confirmado el espacio utilizado.',route:'administracion'});
 const openingCards=activeStores.flatMap(store=>state.data.drawers.filter(d=>d.store_id===store.id&&d.active!==false).map(drawer=>{
  const balance=lastDrawerBalance({closings:state.data.closings,closingDrawers:state.data.closingDrawers,storeId:store.id,drawer,before:new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10)});
  return `<article class="opening-card"><h3>${esc(store.name)} · ${esc(drawer.name)}</h3><strong>${balance?.amount==null?'Por indicar':money(balance.amount)}</strong><p>${balance?'Dejado el '+fmtDate(balance.date):'Sin cierre anterior'}</p></article>`;
 })).join('');
 const storeCards=activeStores.map(store=>{
  const close=todays.find(x=>x.store_id===store.id),storeMonth=monthClosings.filter(x=>x.store_id===store.id);
  const monthSales=sum(storeMonth,closingIncomeAmount);
  const todaySales=closingIncomeAmount(close);
  return `<article class="store-status-card"><div class="section-head"><div><h3>${esc(store.name)}</h3><p>${close?fmtDate(close.business_date):'Sin cierre de hoy'}</p></div>${close?stateBadge(close.status):'<span class="badge warn">Pendiente</span>'}</div><div class="metric-list" style="margin-top:12px"><div class="metric-box"><span>Hoy</span><b>${close?money(todaySales):'—'}</b></div><div class="metric-box"><span>Mes</span><b>${money(monthSales)}</b></div><div class="metric-box"><span>Dinero dejado · total tienda</span><b>${close?money(close.actual_cash):'—'}</b></div><div class="metric-box"><span>Diferencia</span><b class="${close&&Math.abs(Number(close.difference||0))>.01?'danger-text':'good-text'}">${close?money(close.difference||0):'—'}</b></div></div><div class="form-actions">${close?btn('Abrir cierre','closing-edit','secondary',`data-id="${close.id}"`):btn('Registrar cierre','closing-new','primary',`data-store="${store.id}"`)}</div></article>`;
 }).join('');
 const expenseByStore=activeStores.map(store=>{const rows=quarterExpenses.filter(x=>x.store_id===store.id),regular=rows.filter(x=>!x.management_only),internal=rows.filter(x=>x.management_only);return `<div class="summary-row"><div><b>${esc(store.name)}</b><div class="small muted">${regular.length} contabilizados · ${internal.length} internos</div></div><strong>${money(sum(rows,expenseCostAmount))}</strong></div>`}).join('');
 const invoiceRows=pendingInvoices.slice(0,4).map(x=>`<div class="summary-row"><div><b>${esc(x.display_number||x.external_number_text||'Factura')}</b><div class="small muted">${esc(x.customer_name||'Cliente')} · ${money(Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)))} pendientes${x.due_date?' · vence '+fmtDate(x.due_date):''}</div></div><div class="inline-actions">${btn('Vista previa','invoice-preview','secondary',`data-id="${x.id}"`)}</div></div>`).join('');
 const docRows=recentDocs.map(d=>`<div class="summary-row"><div><b>${esc(d.original_name||'Documento')}</b><div class="small muted">${esc(d.supplier_or_customer||d.doc_type||'')} · ${fmtDate(d.document_date||d.created_at)}</div></div><div class="inline-actions">${btn('Ver','document-preview','secondary',`data-id="${d.id}"`)}</div></div>`).join('');
 const activeUsers=state.data.team.filter(x=>x.active!==false).length;
 return `<div class="page dashboard-page">
  <div class="dashboard-hero card card-pad"><div><div class="eyebrow">Inicio · ${fmtDate(today)}</div><h2>Totus Central</h2><p>Mesa de trabajo para consultar, registrar, revisar y decidir sin saltar entre pantallas innecesariamente.</p></div><div class="dashboard-hero-actions">${btn('Nuevo cierre','closing-new','primary')}${btn('Registrar gasto','expense-new','secondary')}${btn('Nueva factura','invoice-new','secondary')}${btn('Subir documento','document-new','secondary')}</div></div>
  <section class="card card-pad opening-panel"><h2>Dinero para abrir las cajas</h2><p>Lo que quedó en cada caja al cerrar. Comprueba la fecha y cuenta el efectivo antes de abrir.</p><div class="opening-grid">${openingCards}</div></section>
  <div class="kpis home-period-kpis">${kpi(activityFilter.from===month.from&&activityFilter.to===month.to?'Ingresos del mes':'Ingresos del periodo',money(activity.totals.sales),`${fmtDate(activityFilter.from)} → ${fmtDate(activityFilter.to)}`)}${kpi('Gastos contables',money(activity.totals.fiscal),'Gastos fiscalizables registrados')}${kpi('Ingresos menos gastos',money(activity.totals.sales-activity.totals.fiscal),'Antes de gastos internos; no es el saldo del banco')}${kpi('Gastos internos',money(activity.totals.internal),'Solo información · incluye impuestos pagados')}</div>
  <section class="card card-pad home-activity"><div class="section-head"><div><h2>Ventas y gastos del periodo</h2><p>Elige las fechas y la tienda. La gráfica y los cuatro importes de arriba muestran el mismo periodo.</p></div></div>${dateFilters({...activityFilter,stores:activeStores},'inicio')}${activityChartHtml(activity)}</section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Operativa de hoy</h2><p>Cierres y control de gasto del trimestre.</p></div></div><div class="dashboard-store-grid">${storeCards}</div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Gastos del ${quarter}T</h3><p>Total contabilizado e interno por establecimiento.</p></div>${btn('Nuevo gasto','expense-new','primary')}</div><div class="home-big-number">${money(sum(quarterExpenses,expenseCostAmount))}</div><div class="stack">${expenseByStore}</div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Pendientes y avisos</h3><p>Solo incidencias que requieren atención.</p></div></div><div class="dashboard-alerts">${alerts.length?alerts.map(a=>`<button class="dashboard-alert ${a.level}" data-route="${a.route}"><span><b>${esc(a.title)}</b><small>${esc(a.text)}</small></span><span>→</span></button>`).join(''):'<div class="empty compact-empty"><strong>Todo al día</strong><span>No hay avisos operativos pendientes.</span></div>'}</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Precios y ventas</h2><p>Consulta un precio al vuelo y controla los cobros abiertos.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Consulta rápida de precio</h3><p>Admite punto o coma decimal.</p></div><button class="btn secondary" data-route="pricing">Abrir Pricing</button></div><div class="home-quick-grid"><input id="homePriceQuery" placeholder="Producto / referencia"><input id="homePriceCost" inputmode="decimal" placeholder="Coste sin impuestos"><input id="homePricePvp" inputmode="decimal" placeholder="PVP final"><input id="homePriceCompetitor" inputmode="decimal" placeholder="Competencia"><input id="homePriceDiscount" inputmode="decimal" placeholder="Descuento %"></div><div class="home-price-metrics"><div><span>Coste real</span><b id="homePriceReal">0,00 €</b></div><div><span>Venta final</span><b id="homePriceSale">0,00 €</b></div><div><span>Margen €</span><b id="homePriceMargin">0,00 €</b></div><div><span>Margen %</span><b id="homePriceMarginPct">0,00 %</b></div><div><span>Vs competencia</span><b id="homePriceCompetition">—</b></div></div><div class="form-actions">${btn('Guardar consulta','home-price-save','primary')}</div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Facturación y cobros</h3><p>${pendingInvoices.length} factura${pendingInvoices.length===1?'':'s'} pendientes · ${money(pendingInvoiceAmount)}</p></div>${btn('Nueva factura','invoice-new','primary')}</div><div class="summary-row"><span>Pendiente de cobro</span><strong>${money(pendingInvoiceAmount)}</strong></div><div class="stack">${invoiceRows||'<div class="empty compact-empty"><strong>Sin cobros pendientes</strong><span>No hay facturas emitidas pendientes de cobro.</span></div>'}</div><div class="dashboard-links"><button class="btn secondary" data-route="facturacion">Abrir facturación</button>${btn('Nueva proforma','proforma-new','secondary')}</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Documentos y fiscalidad</h2><p>Acceso rápido a archivo documental y previsión fiscal.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Documentos recientes</h3><p>${pendingDocs} pendientes de revisar.</p></div>${btn('Subir documento','document-new','primary')}</div><div class="stack">${docRows||'<div class="empty compact-empty"><strong>Sin documentos</strong><span>Todavía no hay documentos archivados.</span></div>'}</div><div class="dashboard-links"><button class="btn secondary" data-route="documentos">Buscar documentos</button></div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Fiscalidad · ${quarter}T ${year}</h3><p>Previsión propia con los datos que llevas registrados.</p></div><button class="btn secondary" data-route="fiscalidad">Abrir fiscalidad</button></div><div class="summary-row"><span>Ingresos acumulados</span><strong>${money(incomeYtd)}</strong></div><div class="summary-row"><span>Gasto deducible</span><strong>− ${money(deductedYtd)}</strong></div>${homeForecast.map(([model,amount])=>`<div class="summary-row"><span>${model==='130'?'Anticipo de IRPF estimado':model==='111'?'Retenciones de nóminas y profesionales':'Retención del alquiler de Azuqueca'} · ${model}</span><strong>${money(amount)}</strong></div>`).join('')}<div class="summary-row"><b>Total por reservar este trimestre</b><strong>${money(homeReserve)}</strong></div><p class="small muted">Se actualiza con tu actividad, sin sustituir el cálculo por cifras de gestoría. No supone ingresos ni gastos de los días que faltan. Consulta el desglose y los anticipos utilizados en Fiscalidad.</p></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Seguimiento y sistema</h2><p>Informes, usuarios y almacenamiento en un vistazo.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Informes y gestoría</h3><p>Prepara libros y paquetes con el periodo correcto.</p></div></div><div class="home-report-cards"><button class="report-shortcut" data-action="home-report-quarter"><span>Trimestre actual</span><b>${quarter}T ${year}</b><small>${fmtDate(qFrom)} → ${fmtDate(qTo)}</small></button><button class="report-shortcut" data-action="home-report-year"><span>Año actual</span><b>${year}</b><small>01/01/${year} → 31/12/${year}</small></button></div><div class="dashboard-links"><button class="btn secondary" data-route="informes">Abrir informes</button></div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Estado del sistema</h3><p>Control básico de la herramienta.</p></div>${isManager()?'<button class="btn secondary" data-route="administracion">Administración</button>':''}</div><div class="summary-row"><span>Usuarios activos</span><strong>${activeUsers}</strong></div><div class="summary-row"><span>Documentos</span><strong>${state.data.documents.length}</strong></div><div class="summary-row"><span>Almacenamiento usado · archivos de Totus</span><strong>${storageOk&&storageFilesOk?(storageFiles/1048576).toFixed(1).replace('.',',')+' MB':'No disponible'}</strong></div><div class="summary-row"><span>De ellos, documentos y logos</span><strong>${storageOk?(used/1048576).toFixed(1).replace('.',',')+' MB':'No disponible'}</strong></div><div class="summary-row"><span>Base de datos · por separado</span><strong>${storageOk&&usage.database_bytes!=null&&Number.isFinite(Number(usage.database_bytes))?(Number(usage.database_bytes)/1048576).toFixed(1).replace('.',',')+' MB':'No disponible'}</strong></div><div class="summary-row"><span>Ocupación del límite interno</span><strong class="${storageOk&&storagePct>=95?'danger-text':storageOk&&storagePct>=85?'warn-text':''}">${storageOk?storagePct.toFixed(1).replace('.',',')+' % de '+(limit/1048576).toFixed(0)+' MB':'Sin medir'}</strong></div><div class="dashboard-links">${isManager()?'<button class="btn secondary" data-action="admin-storage-home">Almacenamiento</button><button class="btn secondary" data-action="admin-users-home">Usuarios</button>':''}</div></article>
  </div></section>
 </div>`;
}

function readClosingSource(row){
 try{const value=JSON.parse(row.source_ref||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}
export function cajas(){
 const view=getView('cajas');
 if(view.mode==='record'){
   const row=view.id?state.data.closings.find(x=>x.id===view.id):null;
   return closingRecordHtml(row);
 }
 const f=getFilters('cajas');
 const rows=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&matchesText(f.query,x.notes,storeName(x.store_id),x.status,acceptedClosing(x)?'conciliado aceptado':x.entry_mode==='source_snapshot'?'por conciliar':x.status==='borrador'?'borrador por terminar':'cerrado'));
 const total=sum(rows,row=>Number(row.card_sales||0));
 const withdrawals=sum(rows,row=>Number(row.cash_withdrawals||0));
 const historical=rows.filter(x=>!acceptedClosing(x)&&(String(x.source_ref||'').startsWith('EXCEL2026-')||x.entry_mode==='source_snapshot'));
 const mismatches=rows.filter(x=>!acceptedClosing(x)&&x.entry_mode!=='source_snapshot'&&Math.abs(Number(x.difference||0))>.01).length;
 const drafts=rows.filter(x=>x.status==='borrador'&&!acceptedClosing(x)).length;
 const headers=[
  {label:'Cierre',html:r=>`<b class="date-display">${fmtDate(r.business_date)}</b><div class="small muted">${esc(storeName(r.store_id))}</div>`},
  {label:'Ventas del día',html:r=>dailySalesByDrawer(r)},
  {label:'Dinero de cada caja',html:r=>r.entry_mode==='source_snapshot'?`<div class="compact-detail">${retainedCashByDrawer(r)}<span>Retirada total tienda <b>${readClosingSource(r).withdrawals==null?'Sin anotación':money(r.cash_withdrawals)}</b></span>${readClosingSource(r).missing_drawers?.length?'<span class="warn-text">Ver detalle por caja</span>':''}</div>`:`<div class="compact-detail">${retainedCashByDrawer(r)}<span>${String(r.source_ref||'').startsWith('EXCEL2026-')?'Salida de caja (Excel)':'Retiradas'} <b>${money(r.cash_withdrawals)}</b></span><span>Gastos caja <b>${money(r.cash_expenses_declared)}</b></span></div>`},
  {label:'Total ventas',html:r=>{
   const rawSource=r.entry_mode==='source_snapshot'&&!sourceClosingReconciled(r);
   const total=rawSource?r.reported_total_sales:['cash_sales','card_sales','bizum_sales','online_sales','other_income'].reduce((n,key)=>n+Number(r[key]||0),0);
   return `<div class="compact-detail"><span><b>${total==null?'Sin importe anotado':money(total)}</b></span>${r.entry_mode==='source_snapshot'?`<span>${r.include_in_income===false?(closingMonthlyReference(r)?'Fiscalidad: referencia mensual registrada':'Sin referencia fiscal registrada'):'Incluido en ingresos fiscales'}</span>`:`<span>Diferencia <b class="${Math.abs(Number(r.difference||0))>.01?'danger-text':'good-text'}">${money(r.difference||0)}</b></span>${Math.abs(Number(r.difference||0))>.01?`<span>Total anotado <b>${r.reported_total_sales==null?'—':money(r.reported_total_sales)}</b></span>`:''}`}</div>`;
  }},
  {label:'Estado',html:r=>acceptedClosing(r)?`${acceptedBadge}${r.entry_mode!=='source_snapshot'&&r.notes?`<div class="small muted record-note">${esc(r.notes)}</div>`:''}`:r.entry_mode==='source_snapshot'?'<span class="badge warn">Por conciliar</span><div class="small muted">Captura y Excel conservados</div>':`${r.status==='cerrado'&&closingHasOrigin(r)?'<span class="badge good">Conciliado</span>':stateBadge(r.status)}${r.notes?`<div class="small muted record-note">${esc(r.notes)}</div>`:''}`},
  {label:'Acciones',html:r=>`<div class="inline-actions">${r.entry_mode==='source_snapshot'&&!acceptedClosing(r)?btn('Conciliar','closing-reconcile-source','primary',`data-id="${r.id}"`):''}${btn(r.entry_mode==='source_snapshot'?'Ver detalle':r.status==='borrador'?'Continuar':'Ver detalle','closing-edit','secondary',`data-id="${r.id}"`)}${btn('Eliminar','closing-delete','danger',`data-id="${r.id}"`)}</div>`}
 ];
 return `<div class="page">
  <div class="kpis closing-kpis">${kpi('Tarjeta registrada',money(total),'El total fiscal se consulta en Fiscalidad')}${kpi('Salidas en metálico',money(withdrawals),'Retiradas de las cajas · filtros aplicados')}${kpi('Registros',String(rows.length))}${kpi('Borradores',String(drafts))}${kpi('Descuadres',String(mismatches),historical.length?historical.length+' históricos pendientes de conciliación':mismatches?'Revisar antes de cerrar':'Sin incidencias')}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Cierres de caja</h2><p>${historical.length?'Hay '+historical.length+' registros históricos pendientes de conciliación de caja. Fiscalidad conserva las referencias mensuales registradas. Conciliar comprueba el desglose de caja y no duplica esos ingresos.':'Histórico completo. Abre un cierre para ver o editar su ficha.'}</p></div><div class="inline-actions">${btn('Exportar','export-closings-current','secondary')}${btn('+ Nuevo cierre','closing-new','primary')}</div></div>
   ${dateFilters({...f,stores:stores()},'cajas')}
   ${table(headers,rows,{emptyTitle:'No hay cierres',emptyText:'No existen cierres para las fechas seleccionadas.'})}
  </section>
 </div>`;
}


function taxPaymentInformationHtml(filters){
 const payments=((!filters.paid||['all','pagado'].includes(filters.paid))?informationalTaxPayments(state.data.taxPayments,filters):[]).map(payment=>({type:'tax',record:payment,date:payment.payment_date,party:'Agencia Tributaria',concept:taxPaymentLabel(payment),period:payment.period_label||[payment.fiscal_year,payment.quarter?payment.quarter+'T':''].filter(Boolean).join(' · '),amount:Number(payment.amount),documentId:payment.document_id}));
 const expenses=selectReportData(state.data,filters).expenses.filter(row=>row.management_only&&!isExpensePaymentEvidence(row)&&(!filters.paid||filters.paid==='all'||row.paid_status===filters.paid)).map(row=>({type:'expense',record:row,date:row.expense_date,party:row.supplier_name||'Gasto interno',concept:row.description||row.invoice_number||'Control interno',period:storeName(row.store_id),amount:expenseCostAmount(row),documentId:row.document_id}));
 const rows=[...expenses,...payments].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 if(!rows.length)return '';
 return `<section class="card table-card internal-expenses-panel"><div class="section-head card-pad"><div><h2>Control interno</h2><p>Gastos internos y pagos de impuestos. Se conservan con su justificante. No se restan del beneficio fiscal.</p></div><strong>${money(sum(rows,x=>x.amount))}</strong></div>${table([
 {label:'Fecha',html:r=>fmtDate(r.date)},
 {label:'Proveedor / concepto',html:r=>'<b>'+esc(r.party)+'</b><div class="small muted">'+esc(r.concept)+'</div>'},
 {label:'Tienda / periodo',html:r=>esc(r.period)},
 {label:'Importe',num:true,html:r=>money(r.amount)},
 {label:'Tratamiento',html:()=>'<span class="badge info">Solo información interna · excluido del cálculo fiscal</span>'},
 {label:'Justificante y acciones',html:r=>{
  const doc=state.data.documents.find(d=>d.id===r.documentId);
  const preview=doc?btn('Vista previa',r.type==='tax'?'tax-payment-document-preview':'expense-document-preview','secondary',`data-id="${r.type==='tax'?r.record.id:doc.id}"`):'';
  const download=doc?btn('Descargar',r.type==='tax'?'tax-payment-document-download':'expense-document-download','secondary',`data-id="${r.type==='tax'?r.record.id:doc.id}"`):'';
  const receipt=r.type==='tax'?btn(doc?'Cambiar justificante':'Adjuntar justificante','tax-payment-receipt','secondary',`data-id="${r.record.id}"`):'';
  return `<div class="expense-file-actions">${doc?'<span class="small">'+esc(doc.original_name)+'</span>':''}${preview}${download}${receipt}${btn(r.type==='tax'||doc?'Revisar':'Adjuntar justificante',r.type==='tax'?'expense-tax-edit':'expense-edit','secondary',`data-id="${r.record.id}"`)}</div>`;
 }}
 ],rows)}<p class="small muted card-pad">Se usa la misma ficha de gasto y el mismo sistema de adjuntos. Los pagos de modelos mantienen un único registro compartido con Fiscalidad. Las cuotas de autónomo y la Seguridad Social conservan su tratamiento fiscal como gastos.</p></section>`;
}


function expensePaymentRelation(row){
 let source;try{source=JSON.parse(row?.source_ref||'{}')}catch{return null}
 if(source.kind!=='bank_payment_source'||!source.related_invoice_expense_id)return null;
 const invoice=state.data.expenses.find(x=>x.id===source.related_invoice_expense_id&&!x.management_only);
 if(!invoice||!invoice.document_id||invoice.document_id!==row.document_id)return null;
 const net=Number(invoice.gross_expense??invoice.accounting_amount??0)-Number(invoice.withholding_amount||0);
 return {invoice,net,originalAmount:Number(source.source?.amount??row.amount_paid??0),difference:Math.round((Number(row.amount_paid||0)-net)*100)/100};
}

export function gastos(){
 const view=getView('gastos');
 if(view.mode==='record'){
   const tax=view.taxPaymentId?state.data.taxPayments.find(x=>x.id===view.taxPaymentId):null;
   const row=tax?taxExpenseRecord(tax):view.id?state.data.expenses.find(x=>x.id===view.id):null;
   return expenseRecordHtml(row);
 }
 if(view.section==='facturas')return expenseInvoiceSectionHtml();
 if(view.section==='proveedores')return expenseSuppliersHtml();
 const f=getFilters('gastos');
 const kind=f.kind||'all',paid=f.paid||'all';
 const rows=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)
   &&(kind==='all'||(kind==='payment'?isExpensePaymentEvidence(x):kind==='internal'?x.management_only&&!isExpensePaymentEvidence(x):!x.management_only))
   &&(paid==='all'||x.paid_status===paid)
   &&matchesText(f.query,/internet inteligente/i.test(x.supplier_name||'')?'Vaperalia':'',x.supplier_name,x.supplier_tax_id,x.invoice_number,x.description,x.payment_method,x.notes,storeName(x.store_id)));
 const total=sum(rows.filter(x=>!x.management_only),expenseCostAmount);
 const internal=sum(rows.filter(x=>x.management_only),expenseCostAmount);
 const taxInformation=(kind==='all'||kind==='internal')&&(paid==='all'||paid==='pagado')?sum(informationalTaxPayments(state.data.taxPayments,f),x=>x.amount):0;
 const pending=rows.filter(x=>!acceptedExpense(x)&&(isUnreconciledPayment(x)||x.paid_status!=='pagado')).length;
 const linkedPayments=rows.filter(x=>isUnreconciledPayment(x)&&expensePaymentRelation(x)).length;
 const headers=[
  {label:'Gasto',html:r=>`<b class="date-display">${fmtDate(r.expense_date)}</b><div class="small muted expense-row-meta"><span>${esc(storeName(r.store_id))}</span>${acceptedExpense(r)?acceptedBadge:isExpensePaymentEvidence(r)?(!isUnreconciledPayment(r)?'<span class="badge good">Pago conciliado</span>':expensePaymentRelation(r)?'<span class="badge info">Factura vinculada · revisar diferencia</span>':'<span class="badge warn">Pago por vincular</span>'):r.management_only?'<span class="badge warn">Interno</span>':r.fiscal_reviewed===false?'<span class="badge warn">Sin conciliar</span>':'<span class="badge info">Fiscal revisado</span>'}</div>`},
  {label:'Documento / proveedor',html:r=>`<b>${/internet inteligente/i.test(r.supplier_name||'')?'Vaperalia':esc(r.supplier_name||'—')}</b>${/internet inteligente/i.test(r.supplier_name||'')?`<div class="small muted">${esc(r.supplier_name)}</div>`:''}<div class="small muted">${esc(r.invoice_number||r.document_kind||'Sin número')}</div>`},
  {label:'Concepto',html:r=>`<div>${esc(r.description||'—')}</div><div class="small muted">${esc(r.payment_method||'')} · ${esc(r.withholding_model?('Modelo '+r.withholding_model):'Sin retención')}</div>`},
  {label:'Fiscal / revisión',html:r=>{
    const relation=expensePaymentRelation(r);
    if(relation)return `<div class="compact-detail"><span>Factura <b>${esc(relation.invoice.invoice_number)}</b></span><span>Neto factura <b>${money(relation.net)}</b></span><span>Diferencia de pago <b>${money(relation.difference)}</b></span>${Math.abs(relation.originalAmount-Number(r.amount_paid||0))>.005?`<span>Excel original <b>${money(relation.originalAmount)}</b></span><span class="small muted">Corregido según la factura.</span>`:''}<span class="small muted">El pago no duplica el gasto fiscal.</span></div>`;
    return `<div class="compact-detail">${acceptedExpense(r)&&isUnreconciledPayment(r)?'<span>Apunte bancario aceptado; no se deduce otra vez</span>':isUnreconciledPayment(r)?'<span>Pago registrado · factura o importe por contrastar</span>':r.fiscal_reviewed===false?'<span>Pendiente de desglose fiscal y cotejo de factura</span>':`<span>Base <b>${money(r.base_amount)}</b></span><span>IVA <b>${money(r.vat_amount)}</b></span><span>Recargo <b>${money(r.re_amount)}</b></span><span>IRPF retenido <b>${money(r.withholding_amount)}</b></span>`}</div>`;
   }},
  {label:'Total',num:true,html:r=>`<b>${money(r.gross_expense??r.accounting_amount??r.amount_paid??0)}</b><div class="small">${expensePaymentBadge(r)}</div>`},
  {label:'Documento adjunto',html:r=>{
    const d=state.data.documents.find(x=>x.id===r.document_id);
    return d?`<div class="small expense-document-name"><b>${esc(d.original_name||'Factura')}</b></div><div class="expense-file-actions">${btn('Vista previa','expense-document-preview','secondary',`data-id="${d.id}"`)}${btn('Descargar','expense-document-download','secondary',`data-id="${d.id}"`)}</div>`:`<span class="small muted">${acceptedExpense(r)&&isUnreconciledPayment(r)?'Apunte bancario conservado en el Excel':isUnreconciledPayment(r)?'Factura pendiente de recibir o pago por conciliar':'Sin justificante adjunto'}</span>`;
   }},
  {label:'Acciones',html:r=>`<div class="expense-row-actions">${btn(r.document_id?'Revisar':'Adjuntar','expense-edit','secondary',`data-id="${r.id}" title="Abrir el gasto, revisar sus datos o adjuntar una factura"`)}${btn('Eliminar','expense-delete','danger',`data-id="${r.id}" title="Eliminar este registro de gasto"`)}</div>`}
 ];
 const extras=`<div class="field"><label>Tipo</label><select id="gastosKind"><option value="all" ${kind==='all'?'selected':''}>Todos</option><option value="fiscal" ${kind==='fiscal'?'selected':''}>Fiscal</option><option value="payment" ${kind==='payment'?'selected':''}>Pagos del Excel</option><option value="internal" ${kind==='internal'?'selected':''}>Solo interno</option></select></div><div class="field"><label>Pago</label><select id="gastosPaid"><option value="all" ${paid==='all'?'selected':''}>Todos</option><option value="pagado" ${paid==='pagado'?'selected':''}>Pagado</option><option value="pendiente" ${paid==='pendiente'?'selected':''}>Pendiente</option><option value="parcial" ${paid==='parcial'?'selected':''}>Parcial</option></select></div>`;
 return `<div class="page expense-page">
  ${expenseTabs('registros')}
  ${rows.some(x=>isUnreconciledPayment(x)&&!acceptedExpense(x))?`<p class="note warn">${rows.filter(x=>isUnreconciledPayment(x)&&!acceptedExpense(x)).length} pagos en revisión${linkedPayments?`: ${linkedPayments} con factura vinculada`:''}. Los importes del Excel se conservan como pagos y no duplican el gasto fiscal.</p>`:''}
  <div class="kpis">${kpi('Gasto del periodo',money(total),'Los pagos por conciliar no se duplican como gasto')}${kpi('Solo control interno',money(internal+taxInformation),'Incluye impuestos pagados; no reduce el beneficio fiscal')}${kpi('Registros',String(rows.length))}${kpi('Registros pendientes',String(pending),'Factura, pago o diferencia por comprobar')}</div>
  ${(kind==='all'||kind==='internal')?taxPaymentInformationHtml({...f,paid}):''}
  <section class="card table-card expense-register-card">
   <div class="section-head card-pad"><div><h2>Gastos</h2><p>Accede a cada factura desde su gasto o consulta el archivo ordenado en «Facturas y justificantes».</p></div><div class="inline-actions">${btn('Proveedores','expense-suppliers','secondary')}${btn('Exportar','export-expenses-current','secondary')}${btn('+ Nuevo gasto','expense-new','primary')}</div></div>
   ${dateFilters({...f,stores:stores()},'gastos',extras)}
   ${table(headers,rows.filter(r=>!r.management_only||isExpensePaymentEvidence(r)),{emptyTitle:kind==='internal'?'Consulta el detalle de control interno':'No hay gastos',emptyText:'No existen otros gastos para los filtros seleccionados.'})}
  </section>
 </div>`;
}


function expenseTabs(section){
 return `<div class="tabs module-tabs expense-tabs" role="group" aria-label="Secciones de gastos">
  <button class="tab ${section==='registros'?'active':''}" data-action="expense-section" data-section="registros">Registros de gastos</button>
  <button class="tab ${section==='facturas'?'active':''}" data-action="expense-section" data-section="facturas">Facturas y justificantes</button>
  <button class="tab ${section==='proveedores'?'active':''}" data-action="expense-section" data-section="proveedores">Proveedores</button>
 </div>`;
}
function expenseSuppliersHtml(){
 const query=String(getFilters('gastos').supplierQuery||''),needle=searchText(query);
 const showInactive=!!getFilters('gastos').supplierShowInactive;
 const suppliers=state.data.suppliers.filter(s=>(showInactive||s.active!==false)&&(!needle||matchesText(needle,s.name,s.tax_id,s.email,s.phone,s.notes))).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const headers=[
  {label:'Proveedor',html:s=>`<b>${esc(s.name)}</b><div class="small muted">${esc(s.tax_id||'Sin NIF/CIF')}</div>`},
  {label:'Contacto',html:s=>`<div>${esc(s.email||'—')}</div><div class="small muted">${esc(s.phone||'')}</div>`},
  {label:'Valores de las facturas',html:s=>`<div>IVA ${Number(s.default_vat_rate||0)} % · RE ${Number(s.default_re_rate||0)} %</div><div class="small muted">${Number(s.default_withholding_rate||0)?`Retención ${Number(s.default_withholding_rate)} % · modelo ${esc(s.default_withholding_model||'Sin asignar')}`:'Sin retención por defecto'}</div>`},
  {label:'Estado',html:s=>stateBadge(s.active!==false?'activo':'inactivo')},
  {label:'Acciones',html:s=>`<div class="inline-actions">${btn('Editar','expense-supplier-edit','secondary',`data-id="${s.id}"`)}${btn('Eliminar','expense-supplier-delete','danger',`data-id="${s.id}"`)}</div>`}
 ];
 return `<div class="page">${expenseTabs('proveedores')}<section class="card table-card"><div class="section-head card-pad"><div><h2>Proveedores de gastos</h2><p>Compras, servicios y arrendadores. Sus datos se reutilizan al registrar una factura.</p></div>${btn('+ Nuevo proveedor','expense-supplier-new','primary')}</div><div class="toolbar card-pad"><label class="field">Buscar proveedor<input id="expenseSuppliersQuery" value="${esc(query)}" placeholder="Nombre, NIF, correo o teléfono"></label><label class="check-field"><input id="expenseSuppliersInactive" type="checkbox" ${showInactive?'checked':''}> Mostrar inactivos</label>${btn('Buscar','expense-suppliers-search','secondary')}</div>${table(headers,suppliers,{emptyTitle:'Sin proveedores',emptyText:'Crea un proveedor o cambia la búsqueda.'})}</section></div>`;
}
function expenseInvoiceSectionHtml(){
 const f=getFilters('gastos'),kind=f.kind||'all',paid=f.paid||'all',attachment=f.attachment||'all';
 const rows=expenseAttachedInvoices(state.data.expenses,state.data.documents)
  .filter(({expense,document,date,searchable})=>
   inRange(date,f.from,f.to)
   &&(f.store==='all'||(expense?.store_id||document?.store_id)===f.store)
   &&(kind==='all'||(expense&&(kind==='payment'?isExpensePaymentEvidence(expense):kind==='internal'?!!expense.management_only&&!isExpensePaymentEvidence(expense):!expense.management_only)))
   &&(paid==='all'||expense?.paid_status===paid)
   &&(attachment==='all'||(attachment==='attached'?!!document:!document))
   &&(!f.query||matchesText(f.query,searchable,/internet inteligente/i.test(expense?.supplier_name||document?.supplier_or_customer||'')?'Vaperalia':'')))
  .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.expense?.supplier_name||a.document?.supplier_or_customer||'').localeCompare(String(b.expense?.supplier_name||b.document?.supplier_or_customer||''),'es'));
 const headers=[
  {label:'Fecha / tienda',html:r=>`<b>${fmtDate(r.date)}</b><div class="small muted">${esc(storeName(r.expense?.store_id||r.document?.store_id))}</div>`},
  {label:'Factura / proveedor',html:r=>`<b>${esc(r.expense?.invoice_number||r.document?.invoice_number||'Sin número')}</b><div>${esc(r.expense?.supplier_name||r.document?.supplier_or_customer||'Sin identificar')}</div><div class="small muted">${esc(r.expense?.supplier_tax_id||r.document?.tax_id||'Sin NIF/CIF')}</div>`},
  {label:'Concepto / archivo',html:r=>`<span>${esc(r.expense?.description||r.document?.original_name||'—')}</span><div class="small muted">${esc(r.document?.original_name||'Sin justificante')}</div>`},
  {label:'Importes',html:r=>{
    const relation=expensePaymentRelation(r.expense),invoice=relation?.invoice||r.expense;
    if(isExpensePaymentEvidence(r.expense)&&!relation)return '<span class="small muted">Justificante de pago · factura pendiente de cotejo</span>';
    return invoice?`<div class="expense-amounts"><span>Base <b>${money(invoice.base_amount||0)}</b></span><span>IVA <b>${money(invoice.vat_amount||0)}</b></span><span>Recargo <b>${money(invoice.re_amount||0)}</b></span><span>IRPF retenido <b>${money(invoice.withholding_amount||0)}</b></span></div>`:'Pendiente de asociar';
   }},
  {label:'Factura / pago',num:true,html:r=>{
    if(!r.expense)return '—';
    if(isExpensePaymentEvidence(r.expense)){
     const relation=expensePaymentRelation(r.expense);
     return `<div class="expense-amounts"><span>Pagado <b>${money(r.expense.amount_paid||0)}</b></span>${relation?`<span>Neto factura <b>${money(relation.net)}</b></span>`:''}</div><div class="small">${expensePaymentBadge(r.expense)}</div>`;
    }
    return `<div class="expense-amounts"><span>Total <b>${money(Number(r.expense.base_amount||0)+Number(r.expense.vat_amount||0)+Number(r.expense.re_amount||0))}</b></span><span>Neto <b>${money(Number(r.expense.base_amount||0)+Number(r.expense.vat_amount||0)+Number(r.expense.re_amount||0)-Number(r.expense.withholding_amount||0))}</b></span></div><div class="small">${expensePaymentBadge(r.expense)}</div>`;
   }},
  {label:'Revisión',html:r=>acceptedExpense(r.expense)?acceptedBadge:r.unlinked?'<span class="badge warn">Sin asociar</span>':isExpensePaymentEvidence(r.expense)?(!isUnreconciledPayment(r.expense)?'<span class="badge good">Pago conciliado</span>':expensePaymentRelation(r.expense)?'<span class="badge info">Factura vinculada · revisar diferencia</span>':'<span class="badge warn">Pago por vincular</span>'):r.expense?.management_only?'<span class="badge warn">Interno, no gestoría</span>':r.expense?.fiscal_reviewed===false?'<span class="badge warn">Sin revisar</span>':'<span class="badge info">Revisado</span>'},
  {label:'Acciones',html:r=>`<div class="expense-file-actions">
   ${r.document?btn('Vista previa','expense-document-preview','secondary',`data-id="${esc(r.document.id)}"`):'<span class="small muted">Sin archivo</span>'}
   ${r.document?btn('Descargar','expense-document-download','secondary',`data-id="${esc(r.document.id)}"`):''}
   ${r.expense?btn('Registrar pago','expense-payment-open','secondary',`data-id="${esc(r.expense.id)}"`):''}
   ${r.expense?btn('Datos gestoría','expense-gestor-detail','secondary',`data-id="${esc(r.expense.id)}"`):''}
   ${r.expense?btn('Abrir gasto','expense-edit','secondary',`data-id="${esc(r.expense.id)}"`):btn('Abrir archivo','expense-unlinked-open','secondary',`data-id="${esc(r.document?.id||'')}"`)}
   ${r.expense?btn('Eliminar gasto','expense-delete','danger',`data-id="${esc(r.expense.id)}"`):''}
   </div>`}
 ];
 const extras=`<div class="field"><label for="gastosKind">Tipo</label><select id="gastosKind"><option value="all" ${kind==='all'?'selected':''}>Todos</option><option value="fiscal" ${kind==='fiscal'?'selected':''}>Fiscal</option><option value="payment" ${kind==='payment'?'selected':''}>Pagos del Excel</option><option value="internal" ${kind==='internal'?'selected':''}>Interno</option></select></div>
 <div class="field"><label for="gastosPaid">Pago</label><select id="gastosPaid"><option value="all" ${paid==='all'?'selected':''}>Todos</option><option value="pagado" ${paid==='pagado'?'selected':''}>Pagado</option><option value="pendiente" ${paid==='pendiente'?'selected':''}>Pendiente</option><option value="parcial" ${paid==='parcial'?'selected':''}>Parcial</option></select></div>
 <div class="field"><label for="gastosAttachment">Archivo</label><select id="gastosAttachment"><option value="all" ${attachment==='all'?'selected':''}>Todos</option><option value="attached" ${attachment==='attached'?'selected':''}>Con archivo</option><option value="missing" ${attachment==='missing'?'selected':''}>Sin archivo</option></select></div>`;
 return `<div class="page expense-page">
  ${expenseTabs('facturas')}
  <div class="kpis">${kpi('Registros con archivo',String(rows.filter(r=>r.document).length))}${kpi('Gastos sin justificante',String(rows.filter(r=>r.expense&&!r.document).length))}${kpi('Archivos sin asociar',String(rows.filter(r=>r.unlinked).length))}${kpi('Registros',String(rows.length))}</div>
  <section class="card table-card expense-invoice-card">
   <div class="section-head card-pad"><div><h2>Facturas y justificantes de gastos</h2><p>Listado con búsqueda por fechas, tienda, proveedor, NIF y número de factura. La vista previa no descarga el archivo. Los importes sin revisión fiscal son provisionales.</p></div>
    <div class="inline-actions">${btn('Exportar gastos Excel','export-expenses-current','secondary')}${btn('+ Nuevo gasto','expense-new','primary')}</div></div>
   ${dateFilters({...f,stores:stores()},'gastos',extras)}
   ${table(headers,rows,{emptyTitle:'No hay facturas para estos filtros',emptyText:'Revisa las fechas, el establecimiento o el filtro de archivo.'})}
  </section>
  <div class="note">«Datos gestoría» permite revisar el desglose completo de 20 columnas utilizado en el libro. Los documentos sin asociar se identifican claramente; nunca se asignan automáticamente por el nombre del archivo.</div>
 </div>`;
}

export function facturacion(){
 const view=getView('facturacion');
 if(view.mode==='record'){
   const row=view.id?state.data.invoices.find(x=>x.id===view.id):null;
   return invoiceRecordHtml(row,view.docType||row?.document_type||'factura',view.invoiceKind||row?.invoice_kind||'invoice',view.origin||row?.origin||'totus');
 }
 const section=view.section||'documentos';
 const tabs=`<div class="tabs module-tabs"><button class="tab ${section==='documentos'?'active':''}" data-action="billing-section" data-section="documentos">Documentos</button><button class="tab ${section==='clientes'?'active':''}" data-action="billing-section" data-section="clientes">Clientes</button><button class="tab ${section==='plantillas'?'active':''}" data-action="billing-section" data-section="plantillas">Plantillas y marca</button><button class="tab ${section==='series'?'active':''}" data-action="billing-section" data-section="series">Series</button></div><p class="tab-scroll-hint">Más secciones: desliza la barra horizontalmente →</p>`;
 if(section==='clientes') return `<div class="page">${tabs}${customersSectionHtml()}</div>`;
 if(section==='plantillas') return `<div class="page">${tabs}${templatesSectionHtml()}</div>`;
 if(section==='series') return `<div class="page">${tabs}${seriesSectionHtml()}</div>`;

 const f=getFilters('facturacion');
 const rows=state.data.invoices.filter(x=>inRange(x.issue_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&matchesText(f.query,x.display_number,x.external_number_text,x.customer_name,x.customer_tax_id,x.concept,x.status,x.document_type,x.invoice_kind,storeName(x.store_id)));
 const headers=[
  {label:'Documento',html:r=>`<b>${esc(r.display_number||r.external_number_text||'Borrador')}</b><div class="small muted">${fmtDate(r.issue_date)} · ${r.document_type==='proforma'?'Proforma':r.invoice_kind==='rectifying'?'Rectificativa':r.origin==='externa'?'Factura externa':'Factura'}</div>`},
  {label:'Cliente',html:r=>`<b>${esc(r.customer_name||'—')}</b><div class="small muted">${esc(r.customer_tax_id||'')}</div>`},
  {label:'Cobro / devolución',html:r=>r.document_type==='proforma'?'<span class="muted">No aplica</span>':isInvoiceRefund(r)?`${stateBadge(r.paid_status==='pagada'?'devuelta':r.paid_status||'pendiente')}<div class="small muted">${money(invoiceOutstanding(r))} por devolver</div>`:stateBadge(r.paid_status||'pendiente')},
  {label:'Total',num:true,html:r=>`<b>${money(r.total_amount)}</b>`},
  {label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','invoice-preview','secondary',`data-id="${r.id}"`)}${r.status==='borrador'?btn('Editar','invoice-edit','secondary',`data-id="${r.id}"`):btn('Abrir','invoice-open','secondary',`data-id="${r.id}"`)}${r.document_type==='proforma'&&['emitida','aceptada'].includes(r.status)?btn('Convertir','proforma-convert','primary',`data-id="${r.id}"`):''}${r.status==='borrador'?btn('Eliminar borrador','invoice-delete','danger',`data-id="${r.id}"`):''}</div>`}
 ];
 return `<div class="page">
  ${tabs}
  <div class="kpis">${kpi('Documentos',String(rows.length))}${kpi('Facturado',money(sum(rows.filter(x=>x.document_type==='factura'&&x.status==='emitida'),x=>x.total_amount)))}${kpi('Pendiente de cobro',money(sum(rows.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.paid_status!=='pagada'),x=>Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)))))}${kpi('Borradores',String(rows.filter(x=>x.status==='borrador').length))}${rows.some(isInvoiceRefund)?kpi('Pendiente de devolver',money(sum(rows.filter(x=>x.status==='emitida'&&isInvoiceRefund(x)),invoiceOutstanding))):''}</div>
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
 const headers=[{label:'Plantilla',html:r=>`<b>${esc(r.name)}</b><div class="small muted">${esc(r.code)} · ${esc(r.style)}</div>`},{label:'Marca',html:r=>`<span class="brand-swatch" style="background:${esc(r.primary_color||'#172033')}"></span> ${r.logo_name?esc(r.logo_name):'Sin logo'}`},{label:'Uso',html:r=>`${r.default_invoice?'<span class="badge info">Factura</span>':''} ${r.default_proforma?'<span class="badge info">Proforma</span>':''}`},{label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','template-preview','secondary',`data-id="${r.id}"`)}${btn('Editar','template-edit','secondary',`data-id="${r.id}"`)}${isAdmin()?btn('Eliminar','template-delete','danger',`data-id="${r.id}"`):''}</div>`}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Plantillas y marca</h2><p>El logo se configura únicamente aquí y se congela al emitir.</p></div>${btn('+ Nueva plantilla','template-new','primary')}</div>${table(headers,rows,{emptyTitle:'Sin plantillas',emptyText:'Crea una plantilla para facturas y proformas.'})}</section>`;
}
function seriesSectionHtml(){
 const rows=[...state.data.series].sort((a,b)=>Number(b.year)-Number(a.year)||String(a.code).localeCompare(String(b.code),'es'));
 const headers=[{label:'Serie',html:r=>`<b>${esc(r.code)}</b><div class="small muted">${r.document_type==='proforma'?'Proforma':r.series_kind==='rectifying'?'Rectificativa':'Factura'} · ${r.year}</div>`},{label:'Tienda',html:r=>esc(r.store_id?storeName(r.store_id):'General')},{label:'Formato',html:r=>`${esc(r.prefix)} · ${r.padding} dígitos`},{label:'Siguiente',num:true,html:r=>String(r.next_number)},{label:'Estado',html:r=>stateBadge(r.active?'activo':'inactivo')},{label:'',html:r=>isAdmin()?`<div class="inline-actions">${btn('Editar','series-edit','secondary',`data-id="${r.id}"`)}${btn(r.active?'Desactivar':'Activar','series-toggle','secondary',`data-id="${r.id}" data-active="${r.active?'false':'true'}"`)}</div>`:''}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Series</h2><p>Las dos tiendas comparten la serie ordinaria del titular. Las proformas y rectificativas tienen series propias. Las series usadas conservan su identidad y numeración.</p></div>${isAdmin()?btn('+ Nueva serie','series-new','primary'):''}</div>${table(headers,rows,{emptyTitle:'Sin series',emptyText:'Crea las series de facturas, rectificativas y proformas.'})}</section>`;
}

export function documentos(){
 const view=getView('documentos');
 if(view.mode==='record'){
   const row=view.id?state.data.documents.find(x=>x.id===view.id):null;
   return documentRecordHtml(row);
 }
 const f=getFilters('documentos');
 const status=f.status||'all',type=f.type||'all';
 const rows=selectDocuments(state.data,f);
 const headers=[
  {label:'Documento',html:r=>`<b>${esc(r.original_name||'Documento')}</b><div class="small muted">${fmtDate(r.document_date||r.created_at)} · ${esc(storeName(r.store_id))}</div>`},
  {label:'Clasificación',html:r=>`<b>${esc(r.category_code==='control_interno'?'Control interno':String(r.doc_type||'—').replaceAll('_',' '))}</b><div class="small muted">${esc(r.supplier_or_customer||'')} ${r.invoice_number?'· '+esc(r.invoice_number):''}</div>`},
  {label:'Tamaño',num:true,html:r=>`${(Number(r.size_bytes||0)/1024/1024).toFixed(2).replace('.',',')} MB`},
  {label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','document-preview','secondary',`data-id="${r.id}"`)}${btn('Descargar','document-download','secondary',`data-id="${r.id}"`)}${btn('Abrir','document-edit','secondary',`data-id="${r.id}"`)}${!issuedDocumentFileLocked(r.id,state.data.invoices)&&canUser(state.user,'documentos','delete',state.data.userPermissions)&&(isManager()||r.uploaded_by===state.session?.user?.id)?btn('Eliminar','document-delete','danger',`data-id="${r.id}"`):''}</div>`}
 ];
 const extra=`<div class="field"><label>Estado</label><select id="documentosStatus"><option value="all">Todos</option>${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(v=>`<option value="${v}" ${status===v?'selected':''}>${v.replaceAll('_',' ')}</option>`).join('')}</select></div><div class="field"><label>Tipo</label><select id="documentosType"><option value="all">Todos</option>${['factura_recibida','factura_emitida','factura_rectificativa','proforma','ticket','contrato','impuesto','informe','otro','control_interno'].map(v=>`<option value="${v}" ${type===v?'selected':''}>${v.replaceAll('_',' ')}</option>`).join('')}</select></div>`;
 return `<div class="page documents-page">
  <div class="kpis">${kpi('Documentos filtrados',String(rows.length))}${kpi('Tamaño de los documentos filtrados',(rows.reduce((total,doc)=>total+Number(doc.size_bytes||0),0)/1024/1024).toFixed(1).replace('.',',')+' MB','Volumen de los originales filtrados · capacidad total en Almacenamiento')}${kpi('Pendientes',String(rows.filter(x=>x.status==='pendiente').length))}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Archivo documental</h2><p>Busca por fecha, tienda, proveedor o número de factura. Abre cada documento para revisar su clasificación y sus datos.</p></div><div class="inline-actions">${btn('+ Subir documento','document-new','primary')}</div></div>
   <div class="document-filters">${dateFilters({...f,stores:stores()},'documentos',extra)}</div><div class="document-batch-toolbar"><span class="small muted">${rows.length} documentos encontrados</span><div class="inline-actions">${btn('Descargar ZIP filtrado','documents-zip','secondary')}${btn('Importar lote ZIP','document-bulk-select','secondary')}<input id="documentBulkZip" type="file" accept=".zip,application/zip" hidden></div></div>
   ${table(headers,rows,{emptyTitle:'No hay documentos',emptyText:'No existen documentos para los filtros seleccionados.'})}
  </section>
 </div>`;
}

export function documentRecordHtml(row=null){
 const fileLocked=issuedDocumentFileLocked(row?.id,state.data.invoices);
 const canEdit=!row?canUser(state.user,'documentos','create',state.data.userPermissions):((isManager()||(row.uploaded_by&&row.uploaded_by===state.session?.user?.id))&&canUser(state.user,'documentos','edit',state.data.userPermissions));
 if(row&&!canEdit)return `<div class="page record-page"><div class="record-toolbar"><h2>${esc(row.original_name||'Documento')}</h2></div><section class="card card-pad"><p class="note">Puedes consultar y descargar este archivo. La edición corresponde a quien lo subió o a gerencia.</p><div class="inline-actions">${btn('Vista previa','document-preview','secondary',`data-id="${row.id}"`)}${btn('Descargar','document-download','secondary',`data-id="${row.id}"`)}${btn('Volver','document-back','secondary')}</div></section></div>`;
 const storeOptions=[{value:'',label:'Sin tienda'},...stores().map(s=>({value:s.id,label:s.name}))];
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="document-back">← Volver a documentos</button><div class="eyebrow">Documentos · ${row?'Ficha':'Nuevo'}</div><h2>${row?esc(row.original_name||'Documento'):'Subir documento'}</h2></div><div>${row?(acceptedClosing(row)?acceptedBadge:stateBadge(row.status)):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>Archivo</h3><p>Máximo 20 MB. PDF, imagen, Excel, CSV, TXT o MD.</p></div></div>
     ${row?`<div class="attachment-box" style="margin-top:14px"><div><b>${esc(row.original_name)}</b><div class="small muted">${(Number(row.size_bytes||0)/1024/1024).toFixed(2).replace('.',',')} MB · ${esc(row.mime_type||'')}</div></div><div class="inline-actions">${btn('Vista previa','document-preview','secondary',`data-id="${row.id}"`)}${btn('Descargar','document-download','secondary',`data-id="${row.id}"`)}</div></div>`:''}
     ${fileLocked?'<p class="note">Original de factura emitida: puedes descargarlo y editar su clasificación, pero no sustituir el archivo.</p>':''}
     <label class="file-picker wide" style="margin-top:14px">${row?'Sustituir archivo':'Seleccionar archivo'}<input id="docFile" type="file" ${fileLocked?'disabled':''} accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md"></label>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>Clasificación</h3></div></div><div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','docStore',storeOptions,row?.store_id||'')}
      ${formField('Fecha','docDate',row?.document_date||isoToday(),'date')}
      ${selectField('Tipo','docType',[{value:'factura_recibida',label:'Factura recibida'},{value:'factura_emitida',label:'Factura emitida'},{value:'factura_rectificativa',label:'Factura rectificativa'},{value:'proforma',label:'Proforma'},{value:'ticket',label:'Ticket'},{value:'contrato',label:'Contrato'},{value:'impuesto',label:'Impuesto'},{value:'informe',label:'Informe'},{value:'otro',label:'Otro'},{value:'control_interno',label:'Control interno'}],row?.category_code==='control_interno'?'control_interno':row?.doc_type||'factura_recibida')}
      ${selectField('Estado','docStatus',[{value:'pendiente',label:'Pendiente'},{value:'pagada',label:'Pagada'},{value:'revisada',label:'Revisada'},{value:'preparada_gestor',label:'Preparada gestor'},{value:'entregada_gestor',label:'Entregada gestor'},{value:'archivada',label:'Archivada'}],row?.status||'pendiente')}
      ${formField('Proveedor / cliente','docParty',row?.supplier_or_customer||'')}
      ${formField('NIF/CIF','docTax',row?.tax_id||'')}
      ${formField('Nº documento','docNumber',row?.invoice_number||'')}
      ${formField('Código / categoría','docCategory',row?.category_code||'')}
      <label class="wide">Notas<textarea id="docNotes" rows="4">${esc(row?.notes||'')}</textarea></label>
     </div></section>
   </div>
   <aside class="record-side"><section class="card card-pad sticky-summary"><h3>Acciones</h3><div class="stack">${row&&!fileLocked&&canUser(state.user,'documentos','delete',state.data.userPermissions)&&(isManager()||row.uploaded_by===state.session?.user?.id)?btn('Eliminar documento','document-delete','danger',`data-id="${row.id}"`):''}${btn(row?'Guardar cambios':'Subir y guardar','document-save','primary',row?`data-id="${row.id}"`:'')}${btn('Cancelar','document-back','secondary')}</div></section></aside>
  </div>
 </div>`;
}


function incomeBreakdownHtml(closings,additional){
 const b=incomeBreakdown(closings,additional);
 if(!closings.length&&!additional)return '';
 const row=(label,value,help)=>`<div class="summary-row"><span class="field-caption">${label}${fieldHelp(label,help)}</span><strong>${money(value)}</strong></div>`;
 return `<section class="card card-pad"><div class="income-breakdown-heading"><h2>De dónde salen los ingresos</h2>${fieldHelp('De dónde salen los ingresos','Este desglose explica los ingresos ya registrados; no añade ventas. Las retiradas de caja son movimientos de dinero y solo se muestran para comprobar el efectivo. No se suman otra vez a las ventas.')}</div>
 ${row('Cobros con tarjeta de los cierres',b.card,'Ventas cobradas con tarjeta el día de la venta. El ingreso del banco puede llegar al día siguiente; no es una segunda venta.')}
 ${row('Efectivo retirado de las cajas',b.withdrawals,'Dinero sacado de las cajas durante el periodo. No equivale por sí solo a las ventas en efectivo: también hay que considerar lo que quedó en las cajas y lo que había al abrir.')}
 ${row('Variación del dinero que queda en caja',b.cashChange,'Es la suma del dinero que quedó al cerrar menos el dinero que había al abrir cada cierre del periodo. Ejemplo: abrir con 100 € y dejar 120 € supone +20 €. Ese efectivo vendido sigue dentro de la caja. Si se dejan 90 €, la variación es −10 €. No es un gasto adicional. En Hortimatic el cierre puede sumar las dos cajas; el detalle de cada caja se consulta en Cajas.')}
 ${b.cashMovements?row('Pagos y otras entradas o salidas de efectivo',b.cashMovements,'Suma pagos realizados desde caja y otras salidas, y resta aportaciones de dinero ajenas a ventas. Se utiliza para reconstruir los cobros en efectivo, sin convertir una aportación del titular en una venta.'):''}
 ${b.other?row('Otros cobros de los cierres',b.other,'Cobros por Bizum, internet y otros medios registrados en los cierres. No incluye la tarjeta ni el efectivo mostrado en las otras filas.'):''}
 ${b.difference?row('Diferencias de cierre por comprobar',b.difference,'Parte de las ventas registradas que no queda explicada por los cobros y movimientos anteriores. Una diferencia debe revisarse en el cierre; no se corrige automáticamente.'):''}
 ${row('Otros ingresos registrados · fuera de los cierres',b.additional,'Facturas adicionales marcadas para sumar ingresos, ingresos manuales y referencias históricas mensuales. Las facturas que ya están incluidas en un cierre no se suman de nuevo.')}
 ${row('Total de ingresos del periodo',b.total,'Total de las ventas e ingresos incluidos en este periodo. Debe coincidir con el indicador de ingresos. Consulta Fiscalidad para distinguir ingresos, beneficio e impuestos estimados.')}
 <p class="small muted">La tarjeta corresponde al día de la venta. En el Excel histórico se anotaba al día siguiente, cuando entraba al banco. Pulsa las «i» para entender cada cifra.</p></section>`;
}

export function fiscalidad(){
 const f=getFilters('fiscalidad'),to=f.to||isoToday(),year=Number(String(to).slice(0,4)),quarter=Math.max(1,Math.min(4,Math.ceil(Number(String(to).slice(5,7))/3)));
 const qFrom=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`,qTo=`${year}-${String(quarter*3).padStart(2,'0')}-${String(new Date(year,quarter*3,0).getDate()).padStart(2,'0')}`,yFrom=`${year}-01-01`;
 const calculationTo=to<qTo?to:qTo;
 const storeOk=x=>f.store==='all'||x.store_id===f.store;
 const periodClose=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&storeOk(x)&&x.include_in_income!==false);
 const ytdClose=state.data.closings.filter(x=>inRange(x.business_date,yFrom,calculationTo)&&storeOk(x)&&x.include_in_income!==false);
 const periodInv=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,f.from,f.to)&&storeOk(x));
 const ytdInv=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,yFrom,calculationTo)&&storeOk(x));
 const periodAdj=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,f.from,f.to)&&storeOk(x));
 const ytdAdj=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,yFrom,calculationTo)&&storeOk(x));
 const periodManual=state.data.incomeAdjustments.filter(x=>inRange(x.income_date,f.from,f.to)&&storeOk(x));
 const ytdManual=state.data.incomeAdjustments.filter(x=>inRange(x.income_date,yFrom,calculationTo)&&storeOk(x));
 const sumIncome=(cs,is,as)=>sum(cs,closingIncomeAmount)+sum(is,x=>x.total_amount)+sum(as,x=>x.amount);
 const periodIncome=sumIncome(periodClose,periodInv,periodAdj)+sum(periodManual,x=>x.amount),ytdIncome=sumIncome(ytdClose,ytdInv,ytdAdj)+sum(ytdManual,x=>x.amount);
 const periodExpenses=state.data.expenses.filter(x=>isReviewedFiscalExpense(x)&&inRange(x.expense_date,f.from,f.to)&&storeOk(x)),ytdExpenses=state.data.expenses.filter(x=>isReviewedFiscalExpense(x)&&inRange(x.expense_date,yFrom,calculationTo)&&storeOk(x));
 const internalPeriod=state.data.expenses.filter(x=>x.management_only&&inRange(x.expense_date,f.from,f.to)&&storeOk(x));
 const pendingFiscal=state.data.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed===false&&inRange(x.expense_date,yFrom,calculationTo)&&storeOk(x));
 const periodDed=deductibleExpenseTotal(periodExpenses,state.data.expenseLines),ytdDedBase=deductibleExpenseTotal(ytdExpenses,state.data.expenseLines);
 const fiscalYtd=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,yFrom,calculationTo)&&storeOk(x)),fiscalPeriod=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,f.from,f.to)&&storeOk(x));
 const extraIncomeYtd=sum(fiscalYtd.filter(x=>x.kind==='ingreso_extra'),x=>x.amount),extraDedYtd=sum(fiscalYtd.filter(x=>['gasto_deducible_extra','amortizacion'].includes(x.kind)),x=>x.amount),reductionsYtd=sum(fiscalYtd.filter(x=>x.kind==='reduccion'),x=>x.amount),withheldYtd=sum(fiscalYtd.filter(x=>x.kind==='retencion_soportada'),x=>x.amount);
 const dPct=Number(state.data.settings?.difficult_expense_pct??5),dCap=Number(state.data.settings?.difficult_expense_annual_cap??2000),rate=Number(state.data.settings?.irpf_prepayment_rate??20);
 const prior130=estimatePriorModel130(state.data,year,quarter,f.store),previous130=prior130.total;
 const model130=computeModel130Accumulated({income:ytdIncome,deductible:ytdDedBase,extraDeductible:extraDedYtd,reductions:reductionsYtd,previousPayments:previous130,withholdings:withheldYtd,rate,difficultRate:dPct,difficultAnnualCap:dCap,difficultEnabled:state.data.settings?.difficult_expense_enabled!==false});
 const {difficult,base,gross:gross130,due:calc130}=model130;
 const current130=state.data.taxPayments.find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter);
 const qExpenses=state.data.expenses.filter(x=>isReviewedFiscalExpense(x)&&inRange(x.expense_date,qFrom,calculationTo)&&storeOk(x)),qIds=new Set(qExpenses.map(x=>x.id)),qLines=state.data.expenseLines.filter(x=>qIds.has(x.expense_id));
 const calc111=sum(qLines.filter(x=>x.withholding_model==='111'),x=>x.withholding_amount),calc115=sum(qLines.filter(x=>x.withholding_model==='115'),x=>x.withholding_amount);
 const pay111=state.data.taxPayments.find(x=>x.tax_type==='111'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter),pay115=state.data.taxPayments.find(x=>x.tax_type==='115'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter);
 const internal=sum(internalPeriod,expenseCostAmount);
 const taxInformation=sum(informationalTaxPayments(state.data.taxPayments,f),x=>x.amount);
 const quarterButtons=[1,2,3,4].map(q=>btn(`${q}T`,'fiscal-quarter',q===quarter?'primary':'secondary',`data-year="${year}" data-quarter="${q}"`)).join('');
 const presented=quarterPresented(state.data.settings,year,quarter);
 const estimates={'130':calc130,'111':calc111,'115':calc115};
 const forecastRows=[['130','Tu anticipo de IRPF',calc130],['111','Retenciones de nóminas y profesionales',calc111],['115','Retención del alquiler de Azuqueca',calc115]].map(([model,label,amount])=>{
  const paid=sum(state.data.taxPayments.filter(x=>x.tax_type===model&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter&&['pagado','compensado'].includes(x.status)),x=>x.amount);
  return {model,label,amount,paid,reserve:Math.max(0,amount-paid)};
 });
 const reserve=sum(forecastRows,x=>x.reserve);
 const forecastCards=forecastRows.map(x=>`<article class="fiscal-declaration"><h3>${esc(x.label)} · ${x.model}</h3><div class="declaration-amount"><span>Acumulado según tus registros</span><strong>${money(x.amount)}</strong></div><p class="small muted">Pagado o compensado este trimestre: ${money(x.paid)}</p><div class="summary-row"><span>Por reservar</span><strong>${money(x.reserve)}</strong></div></article>`).join('');
 const paymentRows=[['130',current130],['111',pay111],['115',pay115]].map(([model,pay])=>{
  const paid=pay?.status==='pagado',amount=pay?Number(pay.amount||0):null;
  const difference=amount==null?null:Math.round((estimates[model]-amount)*100)/100;
  return `<article class="fiscal-declaration"><h3>${({'130':'Anticipo de tu IRPF · Modelo 130','111':'Retenciones de nóminas y profesionales · Modelo 111','115':'Retención del alquiler de Azuqueca · Modelo 115'})[model]}</h3><p>${presented?'<span class="badge good">Presentado y aceptado</span>':'<span class="badge info">Trimestre en preparación</span>'}</p><div class="declaration-amount"><span>Referencia comunicada por gestoría</span><strong>${amount==null?'Importe pendiente de anotar':money(amount)}</strong></div>${difference==null?'':`<p class="small">${Math.abs(difference)<.01?'Coincide con el cálculo de la herramienta':`La herramienta calcula ${money(Math.abs(difference))} ${difference>0?'más':'menos'} · pendiente de contraste`}</p>`}${pay?`<p class="small muted">${paid?'Pago anotado'+(pay.payment_date?' · '+fmtDate(pay.payment_date):''):'Sin pago anotado'}</p>`:''}<div class="form-actions">${btn(pay?'Ver o corregir importe':'Anotar importe de gestoría','tax-payment-edit','secondary',`data-model="${model}" data-year="${year}" data-quarter="${quarter}" ${pay?`data-id="${pay.id}"`:''}`)}</div></article>`;
 }).join('');
 return `<div class="page fiscal-page">${presented?'<p class="note good"><b>Trimestre presentado y aceptado.</b> Confirmado por el titular. La previsión permite contrastar el cálculo. El importe declarado y su pago se consultan en el apartado de gestoría.</p>':''}${state.data.settings?.closed_through?`<details class="note"><summary>Histórico protegido hasta ${fmtDate(state.data.settings.closed_through)} · ver notas de contraste</summary><p>${esc(state.data.settings.period_close_notes||'')}</p></details>`:''}
  ${state.data.expenses.some(x=>isUnreconciledPayment(x)&&!acceptedExpense(x)&&inRange(x.expense_date,f.from,f.to)&&storeOk(x))?'<p class="note warn">Carga con pagos pendientes de soporte o conciliación. Los impuestos y el resultado siguen siendo provisionales.</p>':''}
  <section class="card">${dateFilters({...f,stores:stores()},'fiscal',`<div class="field"><label>Acceso rápido</label><div class="inline-actions">${quarterButtons}</div></div>`)}</section>
  ${pendingFiscal.length?`<p class="note warn fiscal-pending-review" role="status"><b>${pendingFiscal.length} gasto${pendingFiscal.length===1?' fiscal sin revisar':'s fiscales sin revisar'}</b> · No incluido${pendingFiscal.length===1?'':'s'} en esta previsión. Abre cada gasto, comprueba la factura y marca «He cotejado el documento, sus conceptos e impuestos» para incluirlo. El aviso abarca desde enero hasta la fecha de cálculo.</p>`:''}
  <div class="kpis">${kpi('Ingresos del periodo',money(periodIncome))}${kpi('Gastos que reducen el IRPF',money(periodDed),'Importe fiscal; puede diferir del total de la factura')}${kpi('Beneficio para calcular el IRPF',money(periodIncome-periodDed),'Ingresos menos gastos deducibles; antes de deducciones y anticipos del modelo 130')}${kpi('Gastos internos · solo información',money(internal+taxInformation),'Incluye impuestos pagados; no se resta del beneficio fiscal ni reduce el IRPF')}</div>
  ${incomeBreakdownHtml(periodClose,periodIncome-sum(periodClose,closingIncomeAmount))}
  <div class="split">
   <section class="card card-pad fiscal-forecast"><div class="section-head"><div><h2>Previsión de impuestos · ${quarter}T ${year}</h2><p>Se actualiza con tus cierres, facturas y gastos. No utiliza las cifras de gestoría para calcular este trimestre ni supone ventas o gastos que todavía no has registrado.</p></div></div><div class="fiscal-declaration-grid">${forecastCards}</div><div class="summary-row"><b>Total que conviene reservar para este trimestre</b><strong>${money(reserve)}</strong></div><p class="small muted">El 130 acumula desde enero; el 111 y el 115 suman las retenciones de este trimestre. Los gastos internos no reducen estos impuestos.</p>${prior130.estimated>0?`<p class="note">Para planificar se han usado ${money(prior130.estimated)} de anticipos anteriores calculados por la herramienta, todavía sin pago anotado. Al registrar sus liquidaciones reales se actualizará la previsión.</p>`:''}${f.store!=='all'?'<p class="note warn">Has seleccionado una tienda. Para planificar los impuestos del autónomo, selecciona «Todas».</p>':''}</section>
   <section class="card card-pad fiscal-calculation"><div class="section-head"><div><h2>Cálculo de impuestos con los datos registrados</h2><p>Modelo 130 · ${quarter}T ${year}. El IRPF se calcula desde enero hasta ${fmtDate(calculationTo)}, descontando los anticipos anteriores anotados. El resultado es una estimación; el importe presentado por gestoría aparece en su apartado.</p></div></div>
    <div class="summary-row"><span>Ingresos acumulados</span><strong>${money(ytdIncome)}</strong></div>
    <div class="summary-row"><span>De esos ingresos: ajustes añadidos</span><strong>${money(extraIncomeYtd)}</strong></div>
    <div class="summary-row"><span>De esos ingresos: resúmenes y anotaciones manuales</span><strong>${money(sum(ytdManual,x=>x.amount))}</strong></div>
    <div class="summary-row"><span>Gasto deducible acumulado</span><strong>− ${money(ytdDedBase)}</strong></div>
    <div class="summary-row"><span>Gastos/amortizaciones extra</span><strong>− ${money(extraDedYtd)}</strong></div>
    <div class="summary-row"><span>Reducciones</span><strong>− ${money(reductionsYtd)}</strong></div>
    <div class="summary-row"><span>Deducción adicional para pequeños gastos (${dPct} %, tope ${money(dCap)})</span><strong>− ${money(difficult)}</strong></div>
    <div class="summary-row"><span>Beneficio acumulado usado para la estimación</span><strong>${money(base)}</strong></div>
    <div class="summary-row"><span>${rate.toFixed(1).replace('.',',')} %</span><strong>${money(gross130)}</strong></div>
    <div class="summary-row"><span>Anticipos de IRPF anteriores utilizados</span><strong>− ${money(previous130)}</strong></div><p class="small muted">Pagos o compensaciones anotados: ${money(prior130.recorded)} · calculados para la previsión: ${money(prior130.estimated)}.</p>
    <div class="summary-row"><span>IRPF que ya te han retenido</span><strong>− ${money(withheldYtd)}</strong></div>
    <div class="summary-row"><span>Anticipo de IRPF estimado · Modelo 130</span><strong>${money(calc130)}</strong></div>
    <div class="summary-row"><span>Retenciones anotadas en nóminas y profesionales · 111</span><strong>${money(calc111)}</strong></div>
    <div class="summary-row"><span>Retenciones anotadas en el alquiler de Azuqueca · 115</span><strong>${money(calc115)}</strong></div>
    <p class="note">Previsión según la actividad registrada: cambiará al añadir ventas, gastos o pagos. Las cifras comunicadas por gestoría se comparan aparte en «Contraste con gestoría». La liquidación definitiva también puede incluir compensaciones y otras casillas personales del modelo 130 que debes revisar al cerrar el trimestre.</p>
    ${f.store!=='all'?'<p class="note warn">Has seleccionado una tienda: esta simulación es parcial. Tu declaración como autónomo incluye las dos tiendas.</p>':''}
   </section>
   <section class="card card-pad fiscal-declarations"><div class="section-head"><div><h2>Contraste con gestoría · ${quarter}T</h2><p>Referencias para comparar al cerrar el trimestre. No sustituyen el cálculo de arriba ni se consideran pagos hasta que los registres como realizados.</p></div></div><div class="fiscal-declaration-grid">${paymentRows}</div><div class="note rental-tax-note">El modelo 115 corresponde a la retención del alquiler, no al IVA. En vuestra operativa se aplica al local de Azuqueca. El alquiler de Alcalá no debe recibir esa retención por defecto. Cada factura conserva sus propios porcentajes y justificante.</div></section>

  </div>
  <section class="card card-pad"><div class="section-head"><div><h2>Ajustes fiscales del periodo</h2><p>Ninguna diferencia se corrige de forma silenciosa.</p></div>${btn('+ Ajuste fiscal','fiscal-adjustment-new','primary')}</div><div class="stack" style="margin-top:12px">${fiscalPeriod.length?fiscalPeriod.map(x=>`<div class="summary-row"><div><b>${esc(x.kind.replaceAll('_',' '))}</b><div class="small muted">${fmtDate(x.adjustment_date)} · ${esc(x.description||'')}</div></div><strong>${money(x.amount)}</strong><div class="inline-actions">${btn('Editar','fiscal-adjustment-edit','secondary',`data-id="${x.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin ajustes</strong><span>No hay ajustes fiscales explícitos en este periodo.</span></div>'}</div></section>
  <section class="card card-pad"><div class="section-head"><div><h2>Ingresos manuales</h2><p>Movimientos no incluidos en cierres ni facturas emitidas.</p></div>${btn('+ Registrar ingreso','income-adjustment-new','primary')}</div>
   <div class="stack" style="margin-top:12px">${periodManual.length?periodManual.slice().sort((a,b)=>String(b.income_date).localeCompare(String(a.income_date))).map(x=>`<div class="summary-row"><div><b>${esc(x.concept||'Ingreso manual')}</b><div class="small muted">${fmtDate(x.income_date)} · ${esc(state.data.stores.find(s=>s.id===x.store_id)?.name||'General / sin tienda')}</div></div><strong>${money(x.amount)}</strong><div class="inline-actions">${btn('Editar','income-adjustment-edit','secondary',`data-id="${x.id}"`)}${btn('Eliminar','income-adjustment-delete','danger',`data-id="${x.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin ingresos manuales</strong><span>Añádelos solo si no se contabilizan ya en otro apartado.</span></div>'}</div>
  </section>

 </div>`;
}

export function informes(){
 const f=getFilters('informes'),periods=reportMonths(f),year=Number(String(f.to||isoToday()).slice(0,4)),selected=selectReportData(state.data,f);
 const c=selected.closings.filter(x=>x.include_in_income!==false),g=selected.expenses;
 const extraInv=selected.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true);
 const incomeAdj=selected.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'),manualIncome=selected.incomeAdjustments;
 const sales=sum(c,closingIncomeAmount)+sum(extraInv,x=>x.total_amount)+sum(incomeAdj,x=>x.amount)+sum(manualIncome,x=>x.amount);
 const unreviewed=g.filter(x=>!x.management_only&&x.fiscal_reviewed===false).length;
 const accounting=sum(g.filter(x=>!x.management_only),expenseCostAmount),internal=sum(g.filter(x=>x.management_only),expenseCostAmount);
 const taxInformation=sum(informationalTaxPayments(state.data.taxPayments,f),x=>x.amount);
 const saved=state.data.profiles.find(p=>p.id===state.user?.id)?.ui_preferences?.report_blocks;
 const order=normalizeReportOrder(saved),month=Number(String(f.to||isoToday()).slice(5,7)),quarter=Math.ceil(month/3);
 const blocks={
 income:{title:'Desglose de ingresos',html:incomeBreakdownHtml(c,sales-sum(c,closingIncomeAmount))},
 internal:{title:'Control interno',html:taxPaymentInformationHtml(f)},
 monthly:{title:'Diarios mensuales',html:`<section class="card card-pad"><div class="section-head"><div><h2>Diarios mensuales de gastos y ventas</h2><p>Todos los meses del periodo aplicado. Cada archivo incluye solo las fechas, tienda y búsqueda seleccionadas.</p></div></div><div class="monthly-reports">${periods.map(period=>`<section class="monthly-report"><h3>${esc(period.label)}</h3>${stores().filter(s=>f.store==='all'||s.id===f.store).map(s=>`<div class="summary-row"><b>${esc(s.name)}</b><div class="inline-actions">${btn('Vista previa','report-store-preview','secondary',`data-store="${s.id}" data-year="${period.year}" data-month="${period.month}"`)}${btn('Descargar Excel','export-store-book','primary',`data-store="${s.id}" data-year="${period.year}" data-month="${period.month}"`)}</div></div>`).join('')}</section>`).join('')}</div></section>`},
 gestor:{title:'Gestoría y auditoría',html:`<section class="card card-pad"><div class="section-head"><div><h2>Gestoría y auditoría</h2><p>Elige un mes o trimestre de cualquier año. La tabla y el paquete usan las mismas fechas, tienda y búsqueda aplicadas arriba. Solo los gastos fiscales revisados entran en la tabla de gestoría; el control interno se entrega separado.</p></div></div>
 <div class="gestor-period-picker" role="group" aria-label="Elegir periodo para gestoría">
 ${formField('Año del informe','reportPeriodYear',year,'number','min="2000" max="2199" data-draft-ignore')}
 ${selectField('Trimestre','reportPeriodQuarter',[1,2,3,4].map(q=>({value:String(q),label:q+'º trimestre'})),String(quarter),'data-draft-ignore')}
 ${btn('Aplicar trimestre','report-period-quarter','secondary')}
 ${selectField('Mes','reportPeriodMonth',Array.from({length:12},(_,i)=>({value:String(i+1),label:new Date(2026,i,1).toLocaleDateString('es-ES',{month:'long'})})),String(month),'data-draft-ignore')}
 ${btn('Aplicar mes','report-period-month','secondary')}</div>
 <p class="note" role="status">Periodo para descargar: <b>${fmtDate(f.from)} → ${fmtDate(f.to)}</b> · ${f.store==='all'?'Todas las tiendas':esc(storeName(f.store))}${f.query?' · Búsqueda: '+esc(f.query):''}</p>
 <div class="report-actions">${btn('Ver tabla de gestoría','report-gestor-source-preview','secondary')}${btn('Descargar tabla Excel','export-gestor-source','primary')}${btn('Imprimir / guardar PDF','report-gestor-source-print','secondary')}${btn('Descargar paquete del periodo ZIP','export-gestor-period-package','primary')}</div>
 <p class="small muted">El ZIP incluye la tabla de gestoría, los ingresos, los diarios del periodo y los justificantes vinculados a los gastos y facturas de clientes. Incluye un listado de registros sin adjunto para que puedas completarlos. Nºfra.rec. y Rt quedan para la gestoría.</p>
 <details class="report-extra"><summary>Descargas anuales y auditoría complementaria</summary><div class="report-actions">${btn('Descargar conciliación anual '+year,'export-gestor-book','secondary',`data-year="${year}"`)}${btn('Preparar paquete anual gestor ZIP','export-gestor-package','secondary',`data-year="${year}"`)}</div></details></section>`},
 exports:{title:'Exportaciones de trabajo',html:`<section class="card card-pad"><div class="section-head"><div><h2>Exportaciones de trabajo</h2><p>Para análisis puntual con las fechas exactas seleccionadas.</p></div></div><div class="toolbar" style="margin-top:16px">${btn('Cierres detallados','export-closings','secondary')}${btn('Gastos detallados','export-expenses','secondary')}${btn('Resumen del periodo','export-summary','secondary')}</div></section>`}
 };
 const visible=order.filter(id=>blocks[id]?.html),content=visible.map((id,index)=>`<div class="report-movable-block" data-report-block="${id}"><div class="report-block-controls"><span>${blocks[id].title}</span><div class="inline-actions">${btn('↑ Subir','report-block-up','secondary',`data-block="${id}" aria-label="Subir ${blocks[id].title}" ${index===0?'disabled':''}`)}${btn('↓ Bajar','report-block-down','secondary',`data-block="${id}" aria-label="Bajar ${blocks[id].title}" ${index===visible.length-1?'disabled':''}`)}</div></div>${blocks[id].html}</div>`).join('');
 return `<div class="page reports-page"><section class="card">${dateFilters({...f,stores:stores()},'informes')}</section>
 ${g.some(x=>isUnreconciledPayment(x)&&!acceptedExpense(x))?'<p class="note warn">Hay pagos del Excel pendientes de vincular o desglosar. Se conservan para consulta, sin volver a restarlos como gasto. El resultado es provisional.</p>':''}
 <div class="kpis">${kpi('Ventas del periodo',money(sales))}${kpi('Gastos registrados',money(accounting))}${kpi('Gastos internos · solo información',money(internal+taxInformation),'Incluye los impuestos pagados, mostrados en el detalle inferior')}${kpi('Resultado antes de pagar impuestos',money(sales-accounting),'No descuenta control interno ni impuestos pagados. Para el IRPF, consulta Fiscalidad')}</div>
 ${unreviewed?`<div class="note">${unreviewed} gastos pendientes de revisión están incluidos en el resultado real, pero excluidos de las deducciones del modelo 130 y del libro fiscal de gestoría hasta cotejar sus facturas.</div>`:''}
 <div class="report-order-hint"><p>Usa ↑ Subir y ↓ Bajar para ordenar los bloques. Se guarda en tu cuenta para todos tus dispositivos.</p>${btn('Restablecer orden','report-block-reset','secondary')}</div><div class="report-blocks">${content}</div></div>`;
}

export function administracion(){
 if(!canUser(state.user,'administracion','view',state.data.userPermissions))return '<div class="page"><div class="card card-pad"><h2>Sin acceso</h2></div></div>';
 const selectedSection=getView('administracion').section||'usuarios';
 const section=selectedSection==='onedrive'?'storage':selectedSection;
 const tabs=`<div class="tabs module-tabs"><button class="tab ${section==='usuarios'?'active':''}" data-action="admin-section" data-section="usuarios">Usuarios</button><button class="tab ${section==='roles'?'active':''}" data-action="admin-section" data-section="roles">Roles y permisos</button><button class="tab ${section==='negocio'?'active':''}" data-action="admin-section" data-section="negocio">Negocio y cajas</button><button class="tab ${section==='fiscal'?'active':''}" data-action="admin-section" data-section="fiscal">Configuración fiscal</button><button class="tab ${section==='storage'?'active':''}" data-action="admin-section" data-section="storage">Almacenamiento</button><button class="tab ${section==='backups'?'active':''}" data-action="admin-section" data-section="backups">Copias</button><button class="tab ${section==='log'?'active':''}" data-action="admin-section" data-section="log">Log</button></div><p class="tab-scroll-hint">Más secciones: desliza la barra horizontalmente →</p>`;
 return `<div class="page">${tabs}${section==='usuarios'?adminUsersHtml():section==='roles'?adminRolesHtml():section==='negocio'?adminBusinessHtml():section==='fiscal'?adminFiscalHtml():section==='storage'?adminStorageHtml():section==='backups'?adminBackupHtml():adminLogHtml()}</div>`;
}
function adminUsersHtml(){
 if(!isAdmin())return '<section class="card card-pad"><h2>Usuarios</h2><div class="note">Solo el administrador gestiona usuarios.</div></section>';
 const rows=state.data.team;
 const headers=[{label:'Usuario',html:r=>`<b>${esc(r.full_name)}</b><div class="small muted">${esc(r.email)}</div>`},{label:'Rol',html:r=>esc(state.data.roles.find(role=>role.code===r.role)?.name||r.role)},{label:'Puesto',html:r=>esc(r.job_title||'—')},{label:'Estado',html:r=>stateBadge(r.active?'activo':'inactivo')},{label:'Acciones',html:r=>`<div class="inline-actions">${btn('Editar','user-edit','secondary',`data-email="${esc(r.email)}"`)}${r.role!=='admin'?btn('Permisos','user-permissions','secondary',`data-email="${esc(r.email)}"`):''}</div>`}];
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Usuarios</h2><p>Los permisos generales se configuran en Roles y permisos. Las excepciones se editan en la fila de cada usuario. Administración siempre mantiene control total.</p></div><div class="inline-actions">${btn('Configurar roles','admin-section','secondary','data-section="roles"')}${btn('+ Nuevo usuario','user-new','primary')}</div></div>${table(headers,rows,{emptyTitle:'Sin usuarios'})}</section>`;
}
function adminRolesHtml(){
 if(!isAdmin())return '<section class="card card-pad"><h2>Roles y permisos</h2><p>Solo el administrador puede gestionar roles.</p></section>';
 const records=(state.data.roles||[]).slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||a.name.localeCompare(b.name,'es'));
 const cards=records.map(role=>{
  const people=state.data.team.filter(t=>t.role===role.code);
  const modules=PERMISSION_MODULES.filter(([m])=>rolePermissions(role.code,m).view).length;
  const canDelete=!role.is_system&&people.length===0;
  const buttons=[
   role.code!=='admin'?btn('Configurar permisos','role-permissions','primary',`data-role="${esc(role.code)}"`):'<span class="role-fixed-access" title="El administrador dispone de todos los permisos y su acceso es permanente">Acceso completo · permanente</span>',
   role.code!=='admin'?btn('Editar nombre','role-rename','secondary',`data-role="${esc(role.code)}"`):'',
   !role.is_system?btn('Eliminar','role-delete',canDelete?'danger':'secondary',`data-role="${esc(role.code)}" ${canDelete?'':'disabled title="Asigna otro rol a sus usuarios antes de eliminar"'}`):''
  ].join('');
  const summary=PERMISSION_MODULES.map(([module,label])=>{
   const p=rolePermissions(role.code,module);
   const actions=PERMISSION_ACTIONS.filter(([a])=>p[a]).map(([,txt])=>txt).join(' · ');
   return `<div class="role-scope-row"><span>${esc(label)}</span><span>${esc(actions||'Sin acceso')}</span></div>`;
  }).join('');
  return `<article class="card card-pad role-card"><div class="section-head"><div><h3>${esc(role.name)}</h3><p>${esc(role.description||'Permisos configurables por módulo')}</p></div><span class="badge ${role.is_system?'info':'ok'}">${role.is_system?'Rol del sistema':'Personalizado'}</span></div>
    <div class="role-meta"><span><b>${people.length}</b> usuario${people.length===1?'':'s'}</span><span><b>${modules}</b> de ${PERMISSION_MODULES.length} módulos visibles</span></div>
    <details class="role-details"><summary>Ver permisos actuales <span aria-hidden="true">⌄</span></summary><div class="role-scope-list">${summary}</div></details>
    <div class="inline-actions role-actions">${buttons}</div></article>`;
 }).join('');
 return `<div class="stack role-page">
 <section class="card card-pad role-guide"><div class="section-head"><div><h2>Roles y permisos</h2><p>Crea puestos con acceso propio. Cada usuario hereda los permisos de su rol; las excepciones se ajustan desde Usuarios → Permisos.</p></div>${btn('+ Crear rol','role-new','primary')}</div>
 <div class="note">El Administrador conserva el control total y no se puede eliminar. Puedes editar el nombre y los permisos de los puestos existentes. Su código se conserva. Los roles del sistema no se eliminan; los personalizados pueden borrarse cuando nadie los utiliza. Los ajustes de seguridad se validan también en Supabase.</div></section>
 <div class="role-card-grid">${cards}</div></div>`;
}
function adminBusinessHtml(){
 const s=state.data.settings||{}; const locked=isAdmin()?'':'disabled';
 const storeRows=state.data.stores.map(st=>`<div class="admin-entity"><div><b>${esc(st.name)}</b><div class="small muted">${esc(st.code||'')} · ${st.active?'Activo':'Inactivo'}</div></div><div class="inline-actions">${isAdmin()?btn('Editar','store-edit','secondary',`data-id="${st.id}"`):''}</div><div class="entity-children">${state.data.drawers.filter(d=>d.store_id===st.id).map(d=>`<div class="summary-row"><span>${esc(d.name)} ${d.active?'':'(inactiva)'}</span>${isAdmin()?btn('Editar caja','drawer-edit','secondary',`data-id="${d.id}" data-store="${st.id}"`):''}</div>`).join('')||'<div class="small muted">Sin cajas</div>'}${isAdmin()?btn('+ Añadir caja','drawer-new','secondary',`data-store="${st.id}"`):''}</div></div>`).join('');
 return `<div class="split business-layout">
  <section class="card card-pad"><div class="section-head"><div><h2>Titular autónomo y domicilio fiscal</h2><p>Un único emisor para las dos tiendas. Tus facturas de venta y las compras deben identificar al titular con su nombre, NIF y domicilio fiscal. La tienda determina el logo y el control interno.</p></div></div><div class="form-grid" style="margin-top:14px">${formField('Nombre y apellidos del titular','cfgBusiness',s.business_name||'','text',locked)}${formField('NIF','cfgTax',s.tax_id||'','text',locked)}${formField('Domicilio fiscal','cfgAddress',s.business_address||'','text',locked)}${formField('Email','cfgEmail',s.business_email||'','email',locked)}${formField('Teléfono','cfgPhone',s.business_phone||'','text',locked)}</div>${isAdmin()?`<div class="form-actions">${btn('Guardar datos','config-save','primary')}</div>`:''}</section>
  <section class="card card-pad business-stores"><div class="section-head business-stores-head"><div><h2>Establecimientos y cajas</h2><p>Dos tiendas del mismo titular: Hortimatic (Azuqueca) y NewOldSmok (Alcalá). Cajas y gastos se asignan a cada tienda; la identidad fiscal es común.</p></div>${isAdmin()?btn('+ Establecimiento','store-new','primary'):''}</div><div class="stack" style="margin-top:14px">${storeRows}</div></section>
 </div>`;
}
function adminFiscalHtml(){
 const s=state.data.settings||{}; const locked=isAdmin()?'':'disabled';
 return `<section class="card card-pad"><h2>Cierre de periodos</h2><p>Protege importes, fechas y clasificaciones históricas. El cierre operativo conserva los asuntos pendientes y no confirma la presentación fiscal.</p><p><b>${s.closed_through?'Protegido hasta '+fmtDate(s.closed_through):'Sin periodo protegido'}</b></p><p class="note">${esc(s.period_close_notes||'Sin anotaciones de cierre.')}</p>${isAdmin()?`<div class="form-grid">${formField('Último día del trimestre','periodCloseDate',s.closed_through||'','date')}<label class="wide">Motivo y pendientes<textarea id="periodCloseReason" rows="3">${esc(s.period_close_notes||'')}</textarea></label></div><div class="form-actions">${btn('Cerrar periodo','admin-period-close','primary')}${s.closed_through?btn('Reabrir periodos','admin-period-reopen','secondary'):''}</div>`:''}</section><section class="card card-pad"><div class="section-head"><div><h2>Configuración fiscal</h2><p>Parámetros de previsión. No sustituye a la gestoría.</p></div></div><div class="form-grid" style="margin-top:14px">
 ${formField('IVA venta (%)','cfgVat',s.default_sales_vat_rate??21,'number',locked+' step="0.1"')}${formField('Recargo equivalencia compra (%)','cfgPurchaseRe',s.purchase_re_rate??5.2,'number',locked+' step="0.1"')}${formField('Pago fraccionado IRPF (%)','cfgIrpf',s.irpf_prepayment_rate??20,'number',locked+' step="0.1"')}${formField('Difícil justificación (%)','cfgDifficultPct',s.difficult_expense_pct??5,'number',locked+' step="0.1"')}${formField('Tope anual difícil justificación','cfgDifficultCap',s.difficult_expense_annual_cap??2000,'number',locked+' step="0.01"')}
 <label class="check-field wide"><input id="cfgDifficultEnabled" type="checkbox" ${s.difficult_expense_enabled===false?'':'checked'} ${locked}> Aplicar difícil justificación en previsión</label>
 <p class="note wide">Las cuotas de autónomos se registran en Gastos, con la categoría Seguridad Social de autónomos. La previsión fiscal utiliza los gastos registrados y revisados.</p><label class="wide">Notas fiscales<textarea id="cfgFiscalNotes" rows="4" ${locked}>${esc(s.fiscal_notes||'')}</textarea></label>
 </div>${isAdmin()?`<div class="form-actions">${btn('Guardar configuración fiscal','config-save','primary')}</div>`:''}</section>
 <section class="card card-pad"><div class="section-head"><div><h2>Categorías de gastos</h2><p>Códigos usados por Gastos, fiscalidad y los libros Excel.</p></div>${isAdmin()?btn('+ Nueva categoría','expense-category-new','primary'):''}</div>
 <div class="stack" style="margin-top:12px">${state.data.categories.length?state.data.categories.slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),'es')).map(c=>`<div class="summary-row"><div><b>${esc(c.name)}</b><div class="small muted">${esc(c.code)}${c.aeat_group?' · '+esc(c.aeat_group):''}${c.manager_code?' · gestor '+esc(c.manager_code):''}</div></div><div>${stateBadge(c.active?'activo':'inactivo')}</div><div class="inline-actions">${isAdmin()?btn('Editar','expense-category-edit','secondary',`data-id="${c.id}"`):''}</div></div>`).join(''):'<div class="empty"><strong>Sin categorías</strong><span>Crea categorías antes de registrar gastos.</span></div>'}</div></section>`;
}
function adminStorageHtml(){
 const u=state.data.storageUsage||{},keep=backupRetentionCount(state.data.backupConfig?.retention_days);
 const bytes=v=>Number(v||0),mb=v=>(bytes(v)/1048576).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' MB';
 const healthy=u.status==='ok';
 if(!healthy)return `<section class="card card-pad storage-dashboard" role="status">
  <div class="section-head"><div><h2>Almacenamiento · Supabase</h2><p>La lectura de almacenamiento no se ha podido verificar. No mostramos 0 MB porque podría ser incorrecto.</p></div>${btn('Reintentar conexión','storage-refresh','primary')}</div>
  <div class="note warn"><b>Datos no disponibles</b> · ${esc(u.message||'Comprueba la conexión a Supabase y los permisos de la sesión.')}</div>
 </section>${oneDrivePanel()}`;
 const total=bytes(u.total_bytes),limit=Math.max(1,bytes(u.limit_bytes)),backups=bytes(u.backup_bytes);
 const dbSize=Number(u.database_bytes),measuredTotal=Number(u.observed_total_bytes);
 const measuredOk=Number.isFinite(dbSize)&&dbSize>=0&&Number.isFinite(measuredTotal)&&measuredTotal>=total+backups+dbSize-1;
 const measuredDenominator=measuredOk?Math.max(1,measuredTotal):1;
 const measurePercent=v=>(100*Math.max(0,bytes(v))/measuredDenominator).toFixed(4);
 const pct=Math.max(0,Math.min(100,total/limit*100));
 const stamp=u.measured_at?new Date(u.measured_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}):'Sin fecha';
 const remaining=Math.max(0,limit-total);
 const fileTotal=Number(u.all_buckets_bytes),fileTotalOk=u.all_buckets_bytes!=null&&Number.isFinite(fileTotal)&&fileTotal>=total+backups;
 const projectRef=String(SUPABASE_URL).match(/^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/)?.[1];
 const providerUrl=projectRef?'https://supabase.com/dashboard/project/'+projectRef:'https://supabase.com/dashboard/organizations';
 const reference=state.data.settings?.storage_provider_reference||{};
 const freeReference=reference.plan==='Free'&&reference.checked_at&&Number(reference.database_limit_bytes)>0&&Number(reference.files_limit_bytes)>0;
 const referenceDate=freeReference?new Date(reference.checked_at).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'}):'';
 const databaseRemaining=freeReference&&Number.isFinite(dbSize)?Math.max(0,Number(reference.database_limit_bytes)-dbSize):null;
 const capacityBar=(id,label,used,capacity,location,shared=false)=>{
  const other=shared?Math.max(0,fileTotal-used):0,available=Math.max(0,capacity-used-other);
  const width=n=>Math.min(100,Math.max(0,n/capacity*100)).toFixed(4);
  return `<article class="card card-pad storage-space-card"><h3>${label}</h3><p class="small">${location}</p><div class="storage-usage-header"><strong>${mb(used)} usados</strong><span>${mb(available)} ${shared?'de margen en este proyecto':'libres aprox.'}</span></div><div id="${id}" class="storage-space-bar" role="img" aria-label="${esc(label)}: ${mb(used)} usados; ${mb(other)} de otros archivos; ${mb(available)} de margen"><span class="storage-space-used" style="width:${width(used)}%"></span><span class="storage-space-other" style="width:${width(other)}%"></span></div><div class="storage-usage-footer"><span>${(used/capacity*100).toLocaleString('es-ES',{maximumFractionDigits:2})} % ${shared?'del espacio compartido':'ocupado'}</span><span>${mb(capacity)} ${shared?'compartidos':'de capacidad'}</span></div>${shared?`<p class="small muted">Azul: estos archivos. Gris: otros archivos de Totus (${mb(other)}). El espacio sin rellenar es común, no una reserva exclusiva para ${label.toLowerCase()}.</p>`:''}</article>`;
 };
 const spaceBars=freeReference&&fileTotalOk?`<section class="storage-space-section"><h2>Espacio usado y disponible</h2><p>Estas barras miden solo Supabase. Los documentos verificados se abren desde OneDrive. En Supabase, documentos pendientes, logos y copias comparten 1 GB; la base de datos tiene su propia capacidad.</p><div class="storage-information-grid">${capacityBar('storageFilesCapacityBar','Todos los archivos',fileTotal,Number(reference.files_limit_bytes),'Supabase Storage · documentos + logos + copias')}${capacityBar('storageDatabaseCapacityBar','Base de datos',dbSize,Number(reference.database_limit_bytes),'Supabase Database · contabilidad, cajas, usuarios y permisos')}${capacityBar('storageDocumentsCapacityBar','Facturas y documentos',bytes(u.documents_bytes),Number(reference.files_limit_bytes),'Supabase Storage · business-documents',true)}${capacityBar('storageAssetsCapacityBar','Logos y recursos',bytes(u.assets_bytes),Number(reference.files_limit_bytes),'Supabase Storage · business-assets',true)}${capacityBar('storageBackupsCapacityBar','Copias de seguridad',backups,Number(reference.files_limit_bytes),'Supabase Storage · business-backups · '+Number(u.backup_count||0)+' archivos y partes',true)}</div><p class="note">Las copias completas verificadas están en OneDrive cuando así lo indica Copias. En Supabase quedan sus índices pequeños y el archivo privado de revisión y recuperación. El margen de archivos mostrado descuenta todos los archivos de este proyecto. Otros proyectos de la organización también pueden consumir ese mismo gigabyte: el libre global se confirma en Supabase → Usage. Las copias locales descargadas no ocupan este espacio.</p></section>`:'';

 const planning=planStorage({usage:u,reference,keep,activeOriginalBytes:sum(state.data.documents,d=>Number(d.size_bytes||0))+Number(u.assets_bytes||0),runs:state.data.backupRuns||[],protectedPaths:(state.data.recoveryJobs||[]).flatMap(j=>[j.checkpoint_path,j.source_path])});
 const spacePlanning=planStorage({usage:u,reference,keep,activeOriginalBytes:sum(state.data.documents,d=>Number(d.size_bytes||0))+Number(u.assets_bytes||0),runs:state.data.backupRuns||[],protectedPaths:(state.data.recoveryJobs||[]).flatMap(j=>[j.checkpoint_path,j.source_path]),archiveLimit:Infinity});
 const duration=days=>{if(days==null)return 'Más de 10 años en esta simulación';if(days<30)return 'Unos '+days+' días';if(days<365)return 'Unos '+(days/30.4375).toLocaleString('es-ES',{maximumFractionDigits:1})+' meses';const months=Math.floor(days/30.4375),years=Math.floor(months/12),rest=months%12;return 'Unos '+years+' '+(years===1?'año':'años')+(rest?' y '+rest+' '+(rest===1?'mes':'meses'):'');};
 const forecastHtml=`<section class="card card-pad storage-planning" aria-labelledby="storagePlanningTitle"><h2 id="storagePlanningTitle">Cuánto puede durar el espacio</h2>
 <p>Estimación al ritmo de vuestros 9 meses de datos.</p>
 <div class="kpis">
 ${kpi('Archivos de Supabase · duración',spacePlanning.available?duration(spacePlanning.days):'Sin estimación','Simulación conservadora sin trasladar nuevos archivos a OneDrive')}
 ${kpi('GitHub · tiempo restante','No depende de los meses cargados','Vuestra contabilidad se guarda en Supabase')}
 </div>
 <p id="storageForecastResult" class="note ${spacePlanning.available&&spacePlanning.days!=null&&spacePlanning.days<365?'warn':''}">${!spacePlanning.available?'Faltan datos para estimar la duración.':spacePlanning.days!=null&&spacePlanning.days<365?'Con las copias actuales, el espacio no alcanza para un año.':'Previsión de archivos. El crecimiento de la base de datos se consulta por separado.'}</p>
 ${planning.available&&planning.reason==='archive'&&!(state.data.backupRuns||[]).some(r=>r.status==='success'&&r.archive_manifest?.bundle_version===4)?'<p class="note warn">Copias de seguridad: hay que ampliar su límite técnico antes de '+duration(planning.days).toLowerCase()+'.</p>':''}
 <div class="storage-forecast-method"><p>Base de datos: Plazo aún no calculable. Falta medir su crecimiento. GitHub: Sin plazo por cargar datos; repositorio 9,68 MB aproximados, consultado el 20/10/2026.</p>
 <p>${planning.available?mb(planning.monthlyOriginalBytes)+'/mes de documentos y logos. Una copia completa ocupa aproximadamente '+mb(planning.currentCopyBytes)+'.':'Falta la referencia de crecimiento.'} Las ${keep} copias configuradas se guardan en OneDrive cuando está conectado. Se reserva espacio para terminar la nueva antes de borrar la más vieja. Es una simulación; otros proyectos pueden consumir el espacio compartido.</p>
 <h3>Qué puedes descargar y eliminar para liberar espacio</h3>
 <p>Copias antiguas: <b>${planning.available?planning.downloadableOlderCount+' copias · '+mb(planning.downloadableOlderBytes):'Consultar en Copias'}</b>. Descargar no libera espacio: después tendrías que eliminar las que decidas retirar. Las copias diarias volverán a generarse hasta ${keep}.</p>
 <p>Conserva los originales de las facturas en OneDrive. Solo se retiran de Supabase sus duplicados comprobados y protegidos por una copia completa. La limpieza no borra vuestra contabilidad.</p>
 <p class="small muted">GitHub no tiene una caducidad calculable por vuestra actividad contable. Los cambios de código y su historial crecen por separado. <a href="https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits" target="_blank" rel="noopener noreferrer">Límites de GitHub Pages</a>: web publicada hasta 1 GB; recomendación de 1 GB para su repositorio fuente. No son una misma cuota.</p>
 </div>
 <div class="inline-actions">${btn('Ver copias: descargar o eliminar','admin-section','primary','data-section="backups"')}<button class="btn secondary" data-route="documentos">Abrir documentos</button></div>
 </section>`;
 const caution=total/limit>=.9?'Almacenamiento interno cercano al límite.':total/limit>=.75?'El espacio disponible está disminuyendo.':'Esta cifra se calcula con el límite interno configurado en Totus.';
 const technicalHtml=`<div class="stack storage-dashboard">
  <section class="card card-pad">
   <div class="section-head"><div><h2>Detalle de medición y límites</h2><p>Tamaño actual de los archivos y de la base de datos, medido en este proyecto.</p></div>
    </div>
   <div class="storage-sync-line"><span class="storage-status"><span class="storage-online-dot" aria-hidden="true"></span> Datos verificados en Supabase</span><span>Medición: <b >${esc(stamp)}</b> · Se actualiza cada 60 segundos</span></div>
   <div class="kpis" style="margin-top:16px">${kpi('Todos los archivos de Totus',fileTotalOk?mb(fileTotal):'No disponible','Incluye documentos, logos y archivos de copias')}${kpi('Base de datos · por separado',Number.isFinite(dbSize)?mb(dbSize):'No disponible','No comparte la cuota de los archivos')}</div>
   <p class="note">El espacio de archivos y el de la base de datos tienen límites distintos en Supabase. El límite de ${mb(limit)} de Totus es solo un control interno de documentos y logos; no es la capacidad del plan. <a href="${esc(providerUrl)}" target="_blank" rel="noopener noreferrer">Abrir este proyecto en Supabase</a> → organización → Usage para consultar la cuota y el consumo del plan.</p>
   <div class="storage-observed-heading"><div><h3>Reparto de los componentes medidos</h3><p>Suma de archivos y base de datos. No es el espacio total del servidor ni una cuota única del plan.</p></div><strong id="storageObservedTotal">${measuredOk?mb(measuredTotal):'No disponible'}</strong></div>
   ${measuredOk?`<div id="storageObservedBar" class="storage-breakdown-bar" role="img" aria-label="Distribución del almacenamiento observado: PostgreSQL ${mb(dbSize)}, documentos ${mb(u.documents_bytes)}, logos ${mb(u.assets_bytes)}, copias ${mb(backups)}">
    <span class="storage-segment-db" style="width:${measurePercent(dbSize)}%" title="PostgreSQL: ${mb(dbSize)}"></span><span class="storage-segment-docs" style="width:${measurePercent(u.documents_bytes)}%" title="Documentos: ${mb(u.documents_bytes)}"></span><span class="storage-segment-assets" style="width:${measurePercent(u.assets_bytes)}%" title="Logos: ${mb(u.assets_bytes)}"></span><span class="storage-segment-backups" style="width:${measurePercent(backups)}%" title="Copias: ${mb(backups)}"></span>
   </div><div class="storage-legend"><span><i class="storage-legend-db"></i> PostgreSQL · ${mb(dbSize)}</span><span><i class="storage-legend-docs"></i> Documentos · ${mb(u.documents_bytes)}</span><span><i class="storage-legend-assets"></i> Logos · ${mb(u.assets_bytes)}</span><span><i class="storage-legend-backups"></i> Copias · ${mb(backups)}</span></div>`:'<div class="note warn">No se dispone de una medición verificable de la base de datos. No se calcula una barra ficticia.</div>'}
   <div class="storage-quota-title"><h3>Control interno de subidas · documentos y logos</h3><p>Esta barra solo controla nuevas subidas en Totus. No incluye copias ni base de datos, y no indica cuánto queda libre en el plan de Supabase.</p></div>
   <div class="storage-usage-header"><strong>${mb(total)} usados</strong><strong>${mb(remaining)} disponibles</strong></div>
   <progress id="storageUsageBar" aria-label="Porcentaje ocupado del límite de documentos y logos" max="100" value="${pct.toFixed(2)}"></progress>
   <div class="storage-usage-footer"><span>${pct.toLocaleString('es-ES',{maximumFractionDigits:1})} % ocupado</span><span>Límite interno de Totus: ${mb(limit)}</span></div>
   <p class="note">${esc(caution)} Este indicador <b>no representa la cuota total contratada con Supabase</b>; mide el límite operativo que Totus aplica a documentos y logos.</p>
  </section>
  <div class="kpis">
   ${kpi('Facturas y documentos',mb(u.documents_bytes||0))}
   ${kpi('Logos y recursos',mb(u.assets_bytes||0))}
   ${kpi('Archivos de copias en Supabase',mb(backups),'Pueden incluir partes o intentos; no es un recuento de copias completas')}
   ${kpi('Plan acordado',freeReference?'Free · 0 €/mes':'Sin referencia verificada','La herramienta no contrata ampliaciones de pago')}
  </div>
  <div class="storage-information-grid">
   <section class="card card-pad">
    <h3>Distribución del almacenamiento</h3>
    <div class="summary-row"><span>Documentos originales</span><strong>${mb(u.documents_bytes)} · ${Number(u.documents_count||0)} archivo(s)</strong></div>
    <div class="summary-row"><span>Logos y recursos</span><strong>${mb(u.assets_bytes)} · ${Number(u.assets_count||0)} archivo(s)</strong></div>
    <div class="summary-row"><span>Backups · archivos y partes almacenados</span><strong>${mb(backups)} · ${Number(u.backup_count||0)} archivo(s)</strong></div>
    <div class="summary-row"><span>Total de archivos en estos tres espacios</span><strong>${mb(u.all_buckets_bytes)}</strong></div>
    <div class="summary-row"><span>Base de datos PostgreSQL (aprox.)</span><strong>${Number.isFinite(Number(u.database_bytes))?mb(u.database_bytes):'No disponible'}</strong></div>
    <div class="summary-row"><span>Total observado en Totus + PostgreSQL</span><strong>${Number.isFinite(Number(u.observed_total_bytes))?mb(u.observed_total_bytes):'No disponible'}</strong></div>
    <p class="small muted">Las copias y PostgreSQL consumen espacio en Supabase, pero no se descuentan del límite interno de documentos y logos. La cifra de PostgreSQL incluye sobrecarga de la base y no equivale por sí sola a la cuota facturable de tu plan.</p>
   </section>
   <section class="card card-pad">
    <h3>Capacidad gratuita y ubicación de los datos</h3>
    ${freeReference?`<p>Referencia del plan <b>Free</b> consultada el ${esc(referenceDate)}. El uso actual se mide arriba; los límites del plan no se sincronizan automáticamente con facturación.</p>
    <div class="summary-row"><span>Base de datos · capacidad por proyecto</span><strong>${mb(reference.database_limit_bytes)}</strong></div>
    <div class="summary-row"><span>Base de datos · espacio libre aproximado</span><strong>${databaseRemaining==null?'No disponible':mb(databaseRemaining)}</strong></div>
    <div class="summary-row"><span>Archivos · capacidad compartida de la organización</span><strong>${(Number(reference.files_limit_bytes)/1073741824).toLocaleString('es-ES')} GB</strong></div>
    <p class="note">Documentos, logos y copias comparten el espacio de archivos. Cada carpeta o contenedor no dispone de una cuota independiente. El espacio libre global depende también de otros proyectos de la organización: se comprueba en Supabase → Usage, no se inventa a partir de este proyecto.</p>`:'<p class="note warn">Cuota del plan pendiente de verificar. Los tamaños medidos son reales; no se muestra una capacidad libre del proveedor sin referencia.</p>'}
    <div class="summary-row"><span>Contabilidad, cajas, usuarios y permisos</span><strong>Supabase · base de datos</strong></div>
    <div class="summary-row"><span>Facturas y justificantes originales</span><strong>OneDrive · originales verificados</strong></div>
    <div class="summary-row"><span>Logos de las tiendas</span><strong>Supabase · recursos</strong></div>
    <div class="summary-row"><span>Archivos de copias en la nube</span><strong>OneDrive · copias completas; Supabase · índices y recuperación</strong></div>
    <p class="small muted">La web se publica en GitHub Pages. Los datos de trabajo se guardan en Supabase; el navegador conserva la sesión de acceso. Las descargas y copias locales que decidas guardar quedan fuera de estas cifras.</p>
    <p class="small muted">Supabase → Usage puede mostrar un promedio del periodo y tardar en actualizarse. No es lo mismo que el tamaño actual de los archivos.</p>
    <p class="small muted"><a href="https://supabase.com/pricing" target="_blank" rel="noopener noreferrer">Condiciones actuales del plan Free</a>: no tiene una fecha de fin anunciada; sus condiciones pueden cambiar y los proyectos inactivos pueden pausarse.</p>
   </section>
  </div>
 </div>`;
 const capacityRow=(label,used,capacity,forecast)=>`<div class="storage-capacity-row"><div class="storage-capacity-label"><b>${label}</b><span>${mb(used)} de ${mb(capacity)}</span></div><div class="storage-capacity-meter"><progress aria-label="${esc(label)} · espacio ocupado" max="${capacity}" value="${used}"></progress><span><b>${mb(Math.max(0,capacity-used))}</b> libres en este proyecto</span></div><div class="storage-capacity-duration"><span>Duración estimada</span><b>${forecast}</b></div></div>`;
 const savedRuns=(state.data.backupRuns||[]).filter(r=>r.status==='success'&&r.storage_path),bc=state.data.backupConfig||{},backupTime=String(bc.run_hour??0).padStart(2,'0')+':'+String(bc.run_minute??35).padStart(2,'0');
 const locationsHtml=`<section class="storage-locations" aria-labelledby="storageLocationsTitle"><h2 id="storageLocationsTitle" class="sr-only">Espacio por servicio</h2><div class="storage-provider-grid">
 <article class="storage-provider-card storage-provider-supabase"><header class="storage-service-heading"><h3>Supabase</h3><p>Contabilidad, cajas, gastos y acceso de usuarios</p></header>${freeReference?capacityRow('Base de datos',dbSize,Number(reference.database_limit_bytes),'Sin estimación fiable'):'<p>Capacidad de la base de datos pendiente de verificar.</p>'}${freeReference&&fileTotalOk?capacityRow('Archivos auxiliares',fileTotal,Number(reference.files_limit_bytes),spacePlanning.available?duration(spacePlanning.days):'Sin estimación'):'<p>Capacidad de archivos pendiente de verificar.</p>'}<p class="storage-service-footnote">Los archivos auxiliares incluyen logos, índices y el relevo privado. Su duración simula nuevos archivos sin trasladarlos a OneDrive; no estima la duración de la base de datos. La cuota de archivos se comparte con otros proyectos.</p></article>
 ${oneDriveStorageCard(planning.available?planning.monthlyOriginalBytes:0)}
 <article class="storage-provider-card storage-provider-github"><header class="storage-service-heading"><h3>GitHub</h3><p>Código, web, versiones y manuales</p></header><div class="storage-capacity-row storage-github-row"><div class="storage-capacity-label"><b>9,68 MB aprox.</b><span>Repositorio · referencia 20/10/2026</span></div><div class="storage-capacity-meter"><b>No depende de los meses cargados</b><span>Las facturas y la contabilidad se guardan fuera de GitHub.</span></div><div class="storage-capacity-duration"><span>Capacidad restante</span><b>No medida</b></div></div></article>
 </div></section>`;
 return `<div class="stack storage-dashboard storage-organized storage-compact">
 <header class="storage-page-heading"><div><h2>Almacenamiento</h2><p id="storageMeasuredAt">Actualizado: ${esc(stamp)}</p></div><div class="inline-actions">${btn('Actualizar','storage-refresh','secondary')}</div></header>
 ${locationsHtml}
 ${oneDriveCredentialNotice()}
 <section class="storage-backup-strip" aria-label="Resumen de copias"><div><h3>Copias de seguridad</h3><p><b>${savedRuns.length} guardadas</b> · máximo ${keep} · ${bc.enabled?({daily:'diaria',weekly:'semanal',monthly:'mensual'}[bc.frequency]||'programada')+' a las '+backupTime+' (Madrid)':'programación desactivada'}</p></div>${btn('Gestionar copias','admin-section','secondary','data-section="backups"')}</section>
 ${planning.available&&planning.reason==='archive'&&!savedRuns.some(r=>r.archive_manifest?.bundle_version===4)?`<aside class="storage-backup-limit" role="note"><b>Mantenimiento de las copias · no es falta de espacio</b><p>El formato actual admite copias de 120 MB. Al ritmo observado, habrá que ampliarlo en ${duration(planning.days).replace(/^Unos /,'unos ')}. OneDrive seguirá teniendo espacio disponible.</p></aside>`:''}
 <details class="storage-detail-panel" data-storage-detail="capacity"><summary>Desglose de archivos de Supabase</summary><p>La base de datos tiene capacidad propia. Las categorías de archivos comparten su cuota; no son espacios independientes.</p>${spaceBars}</details>
 <details class="storage-detail-panel" data-storage-detail="forecast"><summary>Cómo se calcula y qué puedes limpiar</summary>${forecastHtml}</details>
 <details class="storage-detail-panel" data-storage-detail="onedrive"><summary>Conexión y comprobaciones de OneDrive</summary>${oneDrivePanel()}</details>
 <details class="storage-detail-panel" data-storage-detail="cleaning"><summary>Revisar archivos que ya no se utilizan</summary><p>Descargar no libera espacio. Conserva las facturas y los documentos contables; solo retira duplicados comprobados y copias antiguas que no necesites.</p><div class="inline-actions">${btn('Ver copias: descargar o eliminar','admin-section','primary','data-section="backups"')}<button class="btn secondary" data-route="documentos">Abrir documentos</button>${isAdmin()?btn('Revisar logos sin uso','admin-unused-logos','secondary'):''}</div></details>
 <details class="storage-detail-panel storage-technical" data-storage-detail="technical"><summary>Información técnica y ubicación de los datos</summary>${technicalHtml}</details>
 </div>`;
}
function adminBackupHtml(){
 if(!isAdmin())return '<section class="card card-pad"><h2>Copias de seguridad</h2><p>Solo el administrador puede configurar y consultar copias.</p></section>';
 const config=state.data.backupConfig||{},keep=backupRetentionCount(config.retention_days),runs=(state.data.backupRuns||[]).slice().sort((a,b)=>String(b.started_at||'').localeCompare(String(a.started_at||'')));
 const active=!!config.enabled,frequency=config.frequency||'daily';
 const hh=String(config.run_hour??3).padStart(2,'0'),mm=String(config.run_minute??0).padStart(2,'0');
 const frequencyOptions=[['daily','Cada día'],['weekly','Cada semana'],['monthly','Cada mes']].map(([v,label])=>`<option value="${v}" ${frequency===v?'selected':''}>${label}</option>`).join('');
 const weekOptions=[['1','Lunes'],['2','Martes'],['3','Miércoles'],['4','Jueves'],['5','Viernes'],['6','Sábado'],['0','Domingo']].map(([v,label])=>`<option value="${v}" ${Number(config.weekday??1)===Number(v)?'selected':''}>${label}</option>`).join('');
 const days=Array.from({length:28},(_,i)=>`<option value="${i+1}" ${Number(config.month_day??1)===i+1?'selected':''}>Día ${i+1}</option>`).join('');
 const paths=runs.filter(x=>backupRunState(x)==='saved'),recent=paths[0];
 const backupBytes=state.data.storageUsage?.status==='ok'?Number(state.data.storageUsage.backup_bytes):null;
 const labels={saved:'Guardada',failed:'No se creó la copia',unfinished:'Sin finalizar',running:'Preparando copia',removed:'Eliminada por conservación'};
 const currentFiles=(state.data.documents||[]).filter(d=>d.storage_path).length;
 const outdated=recent&&Number(recent.files_count)<currentFiles;
 const lastAttempt=runs[0],lastState=lastAttempt?backupRunState(lastAttempt):null;
 const columns=[
  {label:'Creación',html:r=>esc(new Date(r.started_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))},
  {label:'Tipo',html:r=>r.mode==='scheduled'?'Automática':'Manual'},
  {label:'Estado',html:r=>`<span class="badge ${backupRunState(r)==='saved'?'ok':backupRunState(r)==='running'?'info':'warn'}">${labels[backupRunState(r)]}</span><div class="small muted">${r.storage_provider==='onedrive'?'OneDrive':'Supabase'}</div>`},
  {label:'Tamaño',html:r=>r.size_bytes?((Number(r.size_bytes)/1024/1024).toFixed(2)+' MB'):'—'},
  {label:'Datos / archivos',html:r=>`${Number(r.rows_count||0)} registros · ${Number(r.files_count||0)} archivos`},
  {label:'Incidencias',html:r=>r.error_message?`<span>${esc(r.status==='running'?r.error_message:backupFailureSummary(r.error_message))}</span><details><summary>Detalle técnico</summary><p class="small">${esc(r.error_message)}</p></details>`:backupRunState(r)==='unfinished'?'No hay confirmación de que haya terminado. No cuenta como copia guardada.':'—'},
  {label:'',html:r=>r.status==='success'&&r.storage_path?`<div class="inline-actions">${btn('Descargar','backup-history-download','secondary',`data-id="${r.id}"`)}${btn('Verificar','backup-history-verify','secondary',`data-id="${r.id}"`)}${btn('Restaurar esta copia','backup-history-restore','primary',`data-id="${r.id}"`)}${btn('Eliminar','backup-history-delete','danger',`data-id="${r.id}" ${paths.length<=1?'disabled title="Conserva al menos una copia"':''}`)}</div>`:''}
 ];
 return `<div class="stack">
  <div class="kpis">${kpi('Programación',active?'Activada':'Desactivada')}${kpi('Copias guardadas',paths.length+' de '+keep)}${kpi('Archivos de copias en Supabase',backupBytes==null?'Sin medición':(backupBytes/1048576).toLocaleString('es-ES',{maximumFractionDigits:2})+' MB','Incluye copias, fragmentos y puntos de recuperación')}${kpi('Conservación',keep+' copias más recientes')}</div>
  <section class="card card-pad backup-health"><h2>Estado de las copias</h2>
   <p>${recent?'Última copia guardada: <b>'+esc(new Date(recent.started_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))+'</b> · '+Number(recent.files_count||0)+' archivos incluidos.':'Todavía no hay una copia completa guardada.'}</p>
   ${lastAttempt?`<p>Último intento: <b>${labels[lastState]}</b> · ${esc(new Date(lastAttempt.started_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))}.</p>`:''}
   ${lastState==='running'&&lastAttempt?.error_message?'<p class="note" role="status">'+esc(lastAttempt.error_message)+'</p>':''}
   ${['failed','unfinished'].includes(lastState)?`<p class="note warn">${esc(backupFailureSummary(lastAttempt?.error_message||''))} Las copias guardadas anteriores se conservan.</p>`:''}
   ${outdated?`<p class="note warn"><b>Falta una copia actualizada.</b> La última guardada contiene ${Number(recent.files_count)} archivos y ahora hay ${currentFiles} documentos con archivo adjunto. No contiene todos los documentos actuales.</p>`:''}
   <p class="note">${active?'La programación está activada.':'Las copias automáticas están desactivadas.'} Un intento fallido no es una copia guardada y no sustituye a las anteriores. Se conserva un máximo de ${keep} copias completadas.</p>
  </section>
  <section class="card card-pad"><div class="section-head"><div><h2>Copias automáticas</h2><p>Programa copias completas en el servidor: datos, facturas y otros archivos. Funciona aunque cierres el navegador.</p></div></div>
   <div class="form-grid" style="margin-top:14px">
    <label class="check-field wide emphasis-check"><input type="checkbox" id="backupEnabled" ${active?'checked':''}> Activar copias programadas</label>
    <div class="field"><label for="backupFrequency">Frecuencia</label><select id="backupFrequency">${frequencyOptions}</select></div>
    <div class="field"><label for="backupTime">Hora en España (Madrid)</label><input id="backupTime" type="time" value="${hh}:${mm}"></div>
    <div class="field" id="backupWeekdayWrapper" ${frequency!=='weekly'?'hidden':''}><label for="backupWeekday">Día de la semana</label><select id="backupWeekday">${weekOptions}</select></div>
    <div class="field" id="backupMonthdayWrapper" ${frequency!=='monthly'?'hidden':''}><label for="backupMonthday">Día de cada mes</label><select id="backupMonthday">${days}</select></div>
    <div class="field"><label for="backupRetention">Máximo de copias guardadas</label><input id="backupRetention" type="number" value="${keep}" min="1" max="${MAX_SAVED_BACKUPS}" step="1" required aria-describedby="backupRetentionHelp"><p id="backupRetentionHelp" class="small muted">Elige de 1 a 10 y pulsa Guardar programación. Solo se retira una antigua después de verificar una nueva; las copias de recuperación protegidas se conservan.</p></div>
    <div class="field"><label for="backupFolder">Carpeta de destino (nube privada)</label><input id="backupFolder" value="${esc(config.destination_folder||'automaticas')}" maxlength="48" pattern="[a-zA-Z0-9_-]{3,48}" placeholder="automaticas"></div>
   </div>
   <div class="note">Destino: <b>OneDrive → Apps → Totus Central → 02 Copias de seguridad</b> cuando la conexión está comprobada. El servidor envía y verifica cada fragmento directamente en OneDrive. En Supabase solo queda el índice pequeño. Si falla la transferencia, se muestra el intento fallido y se conservan las copias anteriores. Si OneDrive no está conectado, el respaldo se guarda en Supabase. Se conservan las ${keep} copias más recientes. Después de completar y verificar una nueva, se elimina la más antigua junto con sus fragmentos. El proceso no incorpora contraseñas.</div>
   <div class="form-actions backup-control-actions">${btn('Guardar programación','backup-settings-save','primary')}${btn('Crear copia privada ahora','backup-run-now','secondary')}</div>
   <div class="note">Las copias nuevas conservan autores, datos y permisos. La recuperación prepara archivos nuevos y guarda antes el estado actual. Las cuentas de acceso mantienen sus contraseñas. Las copias por componentes separan los datos, los documentos en ZIP numerados y el código. Se comprueban por partes, sin juntar todos los documentos en memoria. Para recuperarlas, selecciona su índice .totusbackup y todos sus ZIP. Las copias anteriores siguen siendo compatibles.</div>
  </section>
  <section class="card table-card"><div class="section-head card-pad"><div><h2>Copias guardadas · descargas</h2><p>Elige la fecha que quieres recuperar y pulsa «Restaurar esta copia». Primero verás un resumen; nada se sustituye sin tu confirmación. «Descargar» permite guardar una copia fuera de la herramienta.</p></div>${btn('Actualizar historial','backup-refresh','secondary')}</div>
   ${table(columns.filter(c=>c.label!=='Incidencias'),paths,{emptyTitle:'Sin copias guardadas',emptyText:'Los intentos fallidos aparecen por separado y no cuentan como copia.'})}
  </section>
  <section class="card card-pad"><div class="section-head"><div><h2>Copia local y comprobación</h2><p>Las copias nuevas se descargan por partes desde su fila. Para comprobar un juego, selecciona su índice y todos sus ZIP. También se conserva la descarga en un ZIP único para copias de hasta 120 MB.</p></div>${btn('Descargar copia local','backup-create','primary')}</div>
  <div class="form-grid" style="margin-top:12px"><label class="wide">Seleccionar copia para comprobar
   <span class="backup-file-control"><span class="file-picker backup-file-picker">Elegir copia de seguridad<input id="backupFile" data-draft-ignore multiple type="file" accept=".totusbackup,.zip,application/zip"></span>
   <span id="backupSelectedFile" role="status" class="small muted">Ningún archivo seleccionado</span></span>
  </label></div>
  <div class="form-actions">${btn('Verificar integridad','backup-verify','secondary')}${btn('Revisar para recuperar','recovery-review','primary')}</div>
  </section>
  ${adminRecoveryHistoryHtml()}
 </div>`;
}

function adminRecoveryHistoryHtml(){
 const labels={uploaded:'Pendiente de subida o confirmación',preparing:'Preparando',prepared:'Preparada; falta confirmar',committed:'Completada',failed:'Fallida'};
 return `<section class="card table-card"><div class="section-head card-pad"><div><h2>Recuperaciones</h2><p>Consulta el resultado antes de reintentar una operación interrumpida. La copia anterior permite recuperar el estado previo.</p></div>${btn('Actualizar','backup-refresh','secondary')}</div>${table([
  {label:'Fecha',html:r=>esc(new Date(r.created_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))},
  {label:'Solicitante',get:'requested_email'},
  {label:'Estado',html:r=>`<span class="badge ${r.status==='committed'?'ok':r.status==='failed'?'warn':'info'}">${esc(labels[r.status]||r.status)}</span>`},
  {label:'Incidencia',html:r=>esc(r.error||'—')},
  {label:'',html:r=>`<div class="inline-actions">${r.checkpoint_path?btn('Copia anterior','recovery-download','secondary',`data-id="${r.id}" data-kind="checkpoint"`):''}${r.source_path?btn('Copia solicitada','recovery-download','secondary',`data-id="${r.id}" data-kind="source"`):''}${r.requested_by===state.session?.user?.id&&['uploaded','prepared'].includes(r.status)?btn('Continuar recuperación','recovery-continue','secondary',`data-id="${r.id}"`):''}</div>`}
 ],(state.data.recoveryJobs||[]).slice(0,20),{emptyTitle:'Sin recuperaciones',emptyText:'Las recuperaciones y sus puntos de vuelta atrás aparecerán aquí.'})}</section>`;
}
function adminLogHtml(){
 const f=state.filters.adminLog||{},all=state.data.audit||[];
 const from=f.from||'',to=f.to||'',query=searchText(f.query),actor=searchText(f.actor);
 const areas=[...new Set(all.map(x=>String(x.area||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const actions=[...new Set(all.map(x=>String(x.action||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const rows=all.filter(r=>{
  const date=r.created_at?new Date(r.created_at).toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'}):'';
  return (!from||date>=from)&&(!to||date<=to)
   &&(!f.area||r.area===f.area)&&(!f.action||r.action===f.action)
   &&(!actor||matchesText(actor,r.user_email))
   &&(!query||matchesText(query,r.area,r.action,r.user_email,JSON.stringify(r.detail||{})));
 }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 const headers=[
  {label:'Fecha y hora',html:r=>esc(new Date(r.created_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))},
  {label:'Usuario',html:r=>esc(r.user_email||'—')},
  {label:'Área',html:r=>esc(r.area||'—')},
  {label:'Acción',html:r=>esc(r.action||'—')},
  {label:'Detalle',html:r=>`<span class="small muted">${esc(JSON.stringify(r.detail||{}).slice(0,130))}${JSON.stringify(r.detail||{}).length>130?'…':''}</span>`},
  {label:'',html:r=>btn('Ver detalle','admin-log-detail','secondary',`data-id="${esc(r.id)}"`)}
 ];
 return `<div class="stack">
  <section class="card table-card"><div class="section-head card-pad"><div><h2>Registro de actividad (Log)</h2><p>Cambios guardados en los datos y gestión de usuarios. Actualización automática cada 30 segundos mientras consultas este panel. Los cambios de código se consultan en GitHub.</p></div><div class="inline-actions">
  ${btn('Actualizar','admin-log-refresh','secondary')}
  ${btn('Exportar CSV filtrado','admin-log-export','primary')}
  </div></div>
  <div class="filters">
   <div class="field"><label for="logFrom">Desde</label><input id="logFrom" type="date" value="${esc(from)}"></div>
   <div class="field"><label for="logTo">Hasta</label><input id="logTo" type="date" value="${esc(to)}"></div>
   <div class="field"><label for="logActor">Usuario o email</label><input id="logActor" value="${esc(f.actor||'')}" placeholder="Buscar usuario"></div>
   <div class="field"><label for="logArea">Área</label><select id="logArea"><option value="">Todas</option>${areas.map(v=>`<option value="${esc(v)}" ${f.area===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>
   <div class="field"><label for="logAction">Acción</label><select id="logAction"><option value="">Todas</option>${actions.map(v=>`<option value="${esc(v)}" ${f.action===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>
   <div class="field search"><label for="logQuery">Texto en detalle</label><input id="logQuery" value="${esc(f.query||'')}" placeholder="Buscar evento"></div>
   <div class="log-filter-actions">${btn('Aplicar filtros','admin-log-filter','primary')}${btn('Limpiar filtros','admin-log-clear','secondary')}</div>
  </div>
  ${state.data.auditError?`<div class="note warn" role="alert">No se ha podido actualizar el registro: ${esc(state.data.auditError)}. Los datos mostrados pueden estar desactualizados.</div>`:''}<div class="card-pad small muted">Última lectura: ${state.data.auditUpdatedAt?esc(new Date(state.data.auditUpdatedAt).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})):'Sin actualizar'} · Hasta 1000 eventos recientes · Resultados: ${rows.length} · Se conservan las trazas originales; esta pantalla no permite borrarlas.</div>
  ${table(headers,rows,{emptyTitle:'Sin eventos para estos filtros',emptyText:'Comprueba las fechas o pulsa Limpiar filtros.'})}
  </section>
 </div>`;
}


export function pricing(){
 const view=getView('pricing');
 if(view.mode==='record'){
   const row=view.id?state.data.products.find(x=>x.id===view.id):null;
   return productRecordHtml(row);
 }
 const q=getFilters('pricing').query.toLowerCase();
 const rows=state.data.products.filter(x=>!q||matchesText(q,x.name,x.sku,x.status));
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
  {label:'Margen real',num:true,html:r=>{const price=Number(r.current_pvp??r.proposed_pvp??0),cost=costOf(r);const vat=Number(state.data.settings?.default_sales_vat_rate??21),re=Number(state.data.settings?.purchase_re_rate??5.2);const result=quickPriceStudy({cost,pvp:price,vat,re});return price>0?result.marginPct.toFixed(1).replace('.',',')+' %':'—'}},
  {label:'Estado',html:r=>stateBadge(r.status)},{label:'',html:r=>btn('Abrir','product-edit','secondary',`data-id="${r.id}"`)}
 ];
 const consultations=state.data.consultations.slice(0,20);
 return `<div class="page">
 <div class="kpis">${kpi('Productos',String(rows.length))}${kpi('Familias',String(state.data.families.length))}${kpi('Proveedores',String(state.data.providers.length))}${kpi('Consultas',String(state.data.consultations.length))}</div>
 <section class="card table-card"><div class="section-head card-pad"><div><h2>Pricing</h2><p>Costes, PVP, margen, proveedores, variantes y competencia.</p></div><div class="inline-actions">${btn('Marcas y familias','families-manage','secondary')}${btn('Proveedores','providers-manage','secondary')}${btn('+ Nuevo producto','product-new','primary')}</div></div><div class="filters"><div class="field search"><label>Buscar</label><input id="pricingQuery" data-draft-ignore value="${esc(getFilters('pricing').query)}" placeholder="Producto, referencia o estado"></div>${btn('Buscar','pricing-search','primary')}</div>${table(headers,rows,{emptyTitle:'Sin productos',emptyText:'Todavía no hay productos registrados.'})}</section>
 <section class="card card-pad"><div class="section-head"><div><h2>Consulta rápida</h2><p>Calcula y guarda consultas reutilizables.</p></div></div><div class="form-grid" style="margin-top:14px">
  ${formField('Consulta / producto','pqQuery','')}
  ${formField('Coste neto','pqCost','','number','step="0.01" min="0"')}
  ${formField('PVP','pqPvp','','number','step="0.01" min="0"')}
  ${formField('Competencia','pqCompetitor','','number','step="0.01" min="0"')}
  ${formField('Descuento (%)','pqDiscount',0,'number','step="0.1" min="0" max="100"')}
 </div>
 <div class="home-price-metrics" style="margin-top:12px"><div><span>Coste real</span><b id="pqReal">0,00 €</b></div><div><span>Venta final</span><b id="pqSale">0,00 €</b></div><div><span>Margen €</span><b id="pqMargin">0,00 €</b></div><div><span>Margen %</span><b id="pqMarginPct">0,00 %</b></div><div><span>Vs competencia</span><b id="pqCompetition">—</b></div></div>
 <div class="form-actions">${btn('Guardar consulta','consultation-save','primary')}</div>
 <div class="stack" style="margin-top:14px">${consultations.length?consultations.map(c=>`<div class="summary-row"><div><b>${esc(c.query)}</b><div class="small muted">PVP ${money(c.pvp)} · Margen ${Number(c.margin_pct||0).toFixed(1).replace('.',',')} %</div></div><div class="inline-actions">${btn('Reutilizar','consultation-reuse','secondary',`data-id="${c.id}"`)}${btn('Convertir a producto','consultation-convert','primary',`data-id="${c.id}"`)}${btn('Eliminar','consultation-delete','danger',`data-id="${c.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin consultas</strong><span>Las consultas guardadas aparecerán aquí.</span></div>'}</div>
 </section>
 </div>`;
}

export function providerCost(row){
 const base=Number(row?.net_cost||0)*(1-Number(row?.provider_discount||0)/100);
 return base+Number(row?.shipping_unit||0);
}


export const renderers={inicio,pricing,cajas,gastos,facturacion,documentos,cotejos,fiscalidad,informes,administracion};

export function openingDrawerCash(storeId,drawerId,targetDate=isoToday()){
 const drawer=state.data.drawers.find(x=>x.id===drawerId);
 if(!drawer)return '';
 return lastDrawerBalance({closings:state.data.closings,closingDrawers:state.data.closingDrawers,storeId,drawer,before:targetDate})?.amount??'';
}

function drawerEditor(drawer,row,locked=false){
 let saved=row?state.data.closingDrawers.find(x=>x.closing_id===row.id&&x.drawer_id===drawer.id):null;
 if(!saved&&row?.entry_mode==='source_snapshot'&&getView('cajas').reconcileSource){
  const normalize=name=>String(name).toLocaleLowerCase('es').replace(/^caja\s+/,'').trim();
  const origin=JSON.parse(row.source_ref),captured=(origin.daily_drawers??origin.drawers).find(d=>normalize(d.name)===normalize(drawer.name));
  const single=(origin.expected_drawers??origin.drawers.length)===1;
  saved={opening_cash:captured?.opening??'',closing_cash:captured?.closing??'',card_sales:single?(origin.card_sales??''):'',cash_withdrawals:single?(origin.withdrawals??''):''};
 }
 const targetDate=row?.business_date||getView('cajas').date||isoToday();
 const open=saved?.opening_cash??openingDrawerCash(drawer.store_id,drawer.id,targetDate);
 return `<section class="card card-pad drawer-entry" data-drawer-id="${drawer.id}">
  <div class="section-head"><div><h3>${esc(drawer.name)}</h3><p>El efectivo que dejas aquí será la apertura de esta misma caja el próximo día.</p></div></div>
  <div class="form-grid" style="margin-top:12px">
   ${formField('Dinero que quedó del cierre anterior',`drOpen_${drawer.id}`,open,'number','step="0.01" '+(locked?'disabled':''))}
   ${formField('Dinero que dejas para el próximo día',`drClose_${drawer.id}`,saved?.closing_cash??'','number','step="0.01" '+(locked?'disabled':''))}
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
 const sourceReconcile=row?.entry_mode==='source_snapshot'&&getView('cajas').reconcileSource;
 if(row?.entry_mode==='source_snapshot'&&!sourceReconcile)return sourceClosingRecordHtml(row);
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const view=getView('cajas');
 const sid=row?.store_id||view.storeId||storeOptions[0]?.value||'';
 const recordDate=row?.business_date||view.date||isoToday();
 const drawers=state.data.drawers.filter(x=>x.store_id===sid&&x.active!==false);
 const calculated=Number(row?.cash_sales||0)+Number(row?.card_sales||0)+Number(row?.bizum_sales||0)+Number(row?.online_sales||0)+Number(row?.other_income||0);
 const locked=row?.status==='cerrado';
 return `<div class="page record-page">
  ${sourceReconcile?`<section class="note warn"><b>Conciliar el cierre importado</b><p>Las ventas del día y la referencia fiscal mensual se conservan. Aquí se comprueban la apertura, los movimientos de efectivo y el dinero que queda en cada caja. Completa los campos vacíos con el dato real, o con 0 si confirmas que no hubo movimiento. No se inventa el reparto entre cajas.</p><p>Referencia de la tienda: tarjeta ${JSON.parse(row.source_ref).card_sales==null?'sin anotación':money(JSON.parse(row.source_ref).card_sales)} · retiradas ${JSON.parse(row.source_ref).withdrawals==null?'sin anotación':money(JSON.parse(row.source_ref).withdrawals)} · ventas del día registradas ${money(row.reported_total_sales)}.</p></section>`:''}
  <div class="record-toolbar"><div><button class="btn link" data-action="closing-back">← Volver a cierres</button><div class="eyebrow">Cajas · ${row?'Cierre '+fmtDate(row.business_date):'Nuevo cierre'}</div><h2>${row?esc(storeName(row.store_id)):'Nuevo cierre de caja'}</h2></div><div>${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad">
     <div class="section-head"><div><h3>Datos del cierre</h3><p>Indica la tienda y el día trabajado. Después completa cada caja por separado.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','clStore',storeOptions,sid,locked||sourceReconcile?'disabled':'')}
      ${formField('Fecha','clDate',recordDate,'date',locked||sourceReconcile?'disabled':'')}
      ${formField('Total ventas','clReported',sourceReconcile?'':row?.reported_total_sales??'','number','step="0.01" min="0" '+(locked?'disabled':''))}
      ${!locked&&!sourceReconcile?selectField('Estado al guardar','clSaveStatus',[{value:'cerrado',label:'Conciliar y aceptar el cierre'},{value:'borrador',label:'Borrador · terminar después'}],'cerrado'):''}
      <label class="wide">Observaciones<textarea id="clNotes" rows="3" ${locked?'disabled':''}>${esc(row?.notes||'')}</textarea></label>
     </div>
    </section>
    <section class="stack" id="closingDrawers">${drawers.map(d=>drawerEditor(d,row,locked)).join('')||'<div class="note bad">Esta tienda no tiene cajas activas configuradas.</div>'}</section>
   </div>
   <aside class="record-side">
    <section class="card card-pad sticky-summary">
     <h3>Resumen</h3>
     <div class="summary-row"><span>Total ventas</span><strong id="clCalcTotal">${money(calculated)}</strong></div>
     <div class="summary-row"><span>Diferencia</span><strong id="clDifference" class="${Math.abs(Number(row?.difference||0))>.01?'danger-text':'good-text'}">${row?.reported_total_sales==null?'Sin total para comparar':money(row?.difference||0)}</strong></div>
     <div class="note" style="margin-top:12px">Las ventas en efectivo se obtienen con el dinero que queda, más lo retirado y los gastos pagados en caja, menos el dinero con el que abriste. Las entradas y otras salidas se ajustan aparte. No confundas las ventas con lo que dejas para mañana.</div>
     <div class="stack" style="margin-top:14px">
      ${closingHasOrigin(row)?btn('Ver registro anterior','closing-view-source','secondary',`data-id="${row.id}"`):''}
      ${row&&locked?btn('Reabrir cierre','closing-reopen','secondary',`data-id="${row.id}"`):sourceReconcile?'':btn('Guardar para terminar después','closing-save-draft','secondary',row?`data-id="${row.id}"`:'')}
      ${!locked?btn(sourceReconcile?'Comprobar y cerrar':drawers.length>1?'Cerrar las cajas':'Cerrar caja','closing-save-close','primary',row?`data-id="${row.id}"`:''):''}
      ${row?btn('Eliminar','closing-delete','danger',`data-id="${row.id}"`):''}
     </div>
    </section>
   </aside>
  </div>
 </div>`;
}

export function sourceClosingRecordHtml(row,{embedded=false}={}){
 let origin;try{origin=JSON.parse(row.source_ref)}catch{throw new Error('No se puede leer el origen del cierre importado.');}
 if(origin?.kind!=='closing_source_snapshot'||!Array.isArray(origin.drawers))throw new Error('El origen del cierre importado está incompleto.');
 const amount=value=>value==null?'Sin anotación':money(value);
 return `<div class="page record-page"><div class="record-toolbar"><div>${embedded?'':btn('← Volver a cierres','closing-back','link')}<div class="eyebrow">Cierre de caja · ${fmtDate(row.business_date)}</div><h2>${esc(storeName(row.store_id))}</h2></div><span class="badge ${row.status==='cerrado'||acceptedClosing(row)?'good':'warn'}">${acceptedClosing(row)?'Conciliado y aceptado':row.status==='cerrado'?'Conciliado':'Pendiente de conciliación'}</span></div>
 <section class="card card-pad"><h3>Datos del registro anterior</h3><p>Datos conservados sin repartir tarjetas ni retiradas entre cajas cuando el origen solo indica el total de tienda.</p>${origin.missing_drawers?.length?`<p class="note warn">Sin captura de ${esc(origin.missing_drawers.join(', '))} en esta fecha. No se ha creado una caja con importes a cero.</p>`:''}${table([
 {label:'Caja',html:d=>esc(d.name)}, {label:'Dinero que quedó del cierre anterior',html:d=>amount(d.opening)},
 {label:sourceClosingReconciled(row)?'Importe «al fin» de la captura':'Ventas del día anotadas',html:d=>amount(d.al_fin)}, {label:'Dinero para abrir el siguiente día',html:d=>amount(d.closing)},
 {label:'Anotación original',html:d=>esc(d.comment)}, {label:'Referencia',html:d=>esc(d.source_id)}
 ],origin.drawers)}</section>
 <section class="card card-pad"><h3>Excel de la misma tienda</h3><div class="summary-row"><span>Tarjeta · venta ${fmtDate(row.business_date)}</span><strong>${amount(origin.card_sales)}</strong></div><p class="small muted">Ingreso en banco: ${fmtDate(origin.bank_date)}. ${esc(origin.book)} · filas ${esc((origin.card_rows||[]).join(', ')||'sin anotación')}.</p>
 <div class="summary-row"><span>Retiradas registradas · total tienda</span><strong>${amount(origin.withdrawals)}</strong></div><p class="note">${(origin.expected_drawers??origin.drawers.length)>1?'El reparto de las retiradas entre Vape y Head no figura en el Excel. Se conserva el total de tienda, sin asignarlo a una caja ficticiamente.':'Importe de la caja de este establecimiento.'}</p></section>
 <section class="card card-pad"><h3>Ventas e ingresos fiscales</h3><p>${row.include_in_income===false?(closingMonthlyReference(row)?`Fiscalidad utiliza la referencia mensual registrada: ${money(closingMonthlyReference(row).amount)} para esta tienda. Este cierre se conserva para contrastar el detalle; no se añade otra vez al total mensual. ${(()=>{try{return !acceptedClosing(row)&&JSON.parse(closingMonthlyReference(row).notes).gestoria_income_compared===false?'Origen: Excel original; pendiente de contraste con el libro de ingresos de gestoría.':''}catch{return ''}})()}`:'No hay una referencia fiscal mensual que cubra este cierre.'): `Se incorporan ${money(closingIncomeAmount(row))} de ventas verificadas. Las tarjetas y retiradas no se suman de nuevo.`} Conciliar el efectivo no cambia por sí solo el criterio fiscal ni corrige importes de gestoría.</p><details><summary>Notas conservadas del registro anterior</summary><p>${esc(String(row.notes||'').replace('Este registro no se suma a los ingresos fiscales.',''))}</p></details><div class="form-actions">${embedded||row.status==='cerrado'||acceptedClosing(row)?'':btn('Conciliar cierre','closing-reconcile-source','primary',`data-id="${row.id}"`)}</div></section></div>`;
}

export function expenseLineRow(line={},index=0,categories=[]){
 return `<div class="expense-line" data-line-index="${index}">
  <div class="form-grid">
   ${selectField('Categoría',`exLineCategory_${index}`,[{value:'',label:'Sin categoría'},...categories],line.category_id||'')}
   ${formField('Descripción',`exLineDesc_${index}`,line.description||'')}
   ${formField('Base',`exLineBase_${index}`,line.base_amount??'','number','step="0.01"')}
   ${formField('IVA (%)',`exLineVat_${index}`,line.vat_rate??21,'number','step="0.1" min="0"')}
   ${formField('Recargo (%)',`exLineRe_${index}`,line.re_rate??0,'number','step="0.1" min="0"')}
   ${formField('Retención (%)',`exLineWh_${index}`,line.withholding_rate??0,'number','step="0.1" min="0"')}
   ${selectField('Modelo',`exLineModel_${index}`,[{value:'',label:'Sin modelo'},{value:'111',label:'111 · Nóminas y profesionales'},{value:'115',label:'115 · Alquiler del local'}],line.withholding_model||'')}
   ${formField('% deducible',`exLineDedPct_${index}`,line.deductible_pct??100,'number','min="0" max="100"')}
   <label class="check-field"><input id="exLineDed_${index}" type="checkbox" ${line.deductible_irpf===false?'':'checked'}> Este gasto reduce el IRPF</label>
   <label class="check-field"><input id="exLineFixed_${index}" type="checkbox" ${line.fixed_asset?'checked':''}> Equipo o inversión para varios años</label>
   ${formField('Años amortización',`exLineAmort_${index}`,line.amortization_years??'','number','step="0.1" min="0"')}
  </div>
  <div class="inline-actions" style="justify-content:flex-end;margin-top:8px">${btn('Quitar línea','expense-line-remove','danger',`data-index="${index}"`)}</div>
 </div>`;
}

export function expenseRecordHtml(row=null){
 const taxRecord=!!row?._taxPayment,isTax=taxRecord;
 const storeOptions=[{value:'',label:'Común al autónomo · ambas tiendas'},...stores().map(s=>({value:s.id,label:s.name}))];
 const suppliers=[{value:'',label:'Proveedor manual'},...state.data.suppliers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const categories=state.data.categories.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name||x.code||'Categoría'}));
 const lines=taxRecord?[{description:row.description,base_amount:row.amount_paid,vat_rate:0,re_rate:0,withholding_rate:0,deductible_irpf:false,deductible_pct:0}]:row?state.data.expenseLines.filter(x=>x.expense_id===row.id).sort((a,b)=>a.sort_order-b.sort_order):[{description:'',base_amount:'',vat_rate:21,re_rate:0,withholding_rate:0,deductible_irpf:true,deductible_pct:100,fixed_asset:false}];
 const doc=row?.document_id?state.data.documents.find(x=>x.id===row.document_id):null;
 const total=Number(row?.gross_expense??row?.accounting_amount??row?.amount_paid??0);
 return `<div class="page record-page">
  ${bookPaymentPending(row)?`<div class="note warn">Asiento fiscal contrastado con el libro de gestoría. El pago del banco está registrado en el Excel original y pendiente de conciliación; no significa que esté impagado. El adjunto es un soporte del libro, no el documento individual original. ${esc(row.notes||'')}</div>`:''}
  <div class="record-toolbar"><div><button class="btn link" data-action="expense-back">← Volver a gastos</button><div class="eyebrow">Gastos · ${row?'Registro':'Nuevo'}</div><h2>${row?esc(row.supplier_name||'Gasto'):'Nuevo gasto'}</h2></div><div>${acceptedExpense(row)?acceptedBadge:row?(row.management_only?'<span class="badge warn">Solo control interno</span>':'<span class="badge info">Fiscal</span>'):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>1 · Documento y proveedor</h3><p>La tienda clasifica el gasto. La factura recibida debe identificar a ${esc(state.data.settings?.business_name||'tu nombre como autónomo')} con su NIF y domicilio fiscal comunes.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      ${selectField('Tienda','exStore',storeOptions,row?.store_id||(!taxRecord?stores()[0]?.id:'')||'')}
      ${formField('Fecha','exDate',row?.expense_date||isoToday(),'date')}
      ${selectField('Proveedor guardado','exSupplierId',suppliers,row?.supplier_id||'')}
      ${formField('Proveedor','exSupplier',row?.supplier_name||'')}
      ${formField('NIF/CIF','exTax',row?.supplier_tax_id||'')}
      ${formField('Nº factura / justificante','exInvoice',row?.invoice_number||'')}
      ${selectField('Tipo documento','exDocKind',[{value:'factura',label:'Factura'},{value:'rectificativa',label:'Rectificativa'},{value:'ticket',label:'Ticket'},{value:'nomina',label:'Nómina'},{value:'seguridad_social',label:'Seguridad Social'},{value:'recibo',label:'Recibo'},{value:'otro',label:'Otro'},{value:'control_interno',label:'Control interno'},...(!row||taxRecord?[{value:'impuesto',label:'Pago de impuesto · solo control interno'}]:[])],row?.management_only&&row?.document_kind==='otro'?'control_interno':row?.document_kind||'factura')}
     </div>
     <div class="attachment-box" style="margin-top:14px">
      <div><b>Justificante</b><div class="small muted">${doc?esc(doc.original_name):'Sin archivo vinculado'}</div></div>
      <div class="inline-actions">${doc?btn('Vista previa','expense-document-preview','secondary',`data-id="${doc.id}"`):''}${doc?btn('Descargar','expense-document-download','secondary',`data-id="${doc.id}"`):''}${doc&&!taxRecord?btn('Quitar','expense-document-unlink','danger',`data-expense="${row.id}" data-document="${doc.id}"`):''}</div>
      <div class="expense-attachment-picker"><label class="file-picker">${doc?'Sustituir factura adjunta':'Seleccionar factura o justificante'}<input id="exFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md"></label>
      <div id="exSelectedFile" class="small muted" aria-live="polite">No se ha seleccionado una factura nueva.</div><p class="small muted">Si aún no has recibido la factura, conserva este gasto y adjúntala aquí cuando esté disponible. Subir el archivo no cambia los importes ni lo marca como revisado. Si la factura ya figura en otro gasto, vincula el pago a ese registro; no registres el coste dos veces.</p>
      ${btn('Vista previa antes de guardar','expense-file-preview','secondary','id="exFilePreview" disabled')}${row?btn('Guardar solo adjunto',taxRecord?'expense-tax-attach-save':'expense-attach-save','primary',`data-id="${row.id}"`):''}</div>
     </div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>2 · Conceptos</h3><p>Una factura puede tener varias líneas fiscales. Para un abono de proveedor, selecciona «Rectificativa» e introduce las bases y el importe devuelto con signo negativo; los porcentajes siguen positivos.</p></div>${btn('+ Añadir línea','expense-line-add','secondary')}</div>
     <p id="exTaxConcept" class="note" hidden>Pago de impuesto · solo control interno. Indica el importe y su fecha de pago en «Tratamiento general». No tiene IVA, recargo ni gasto fiscal deducible.</p><div id="expenseLines" class="stack" style="margin-top:14px">${lines.map((l,i)=>expenseLineRow(l,i,categories)).join('')}</div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>3 · Tratamiento general</h3><p>Control interno, pago y observaciones.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      <div id="exTaxPaymentFields" class="wide form-grid" ${isTax?'':'hidden'}>
       ${selectField('Impuesto pagado','exTaxPaymentModel',[{value:'130',label:'130 · IRPF del autónomo'},{value:'111',label:'111 · Retenciones de nóminas y profesionales'},{value:'115',label:'115 · Retenciones del alquiler'},{value:'309',label:'309 · IVA ocasional'}],row?._taxPayment?.tax_type||'130')}
       ${formField('Año del impuesto','exTaxPaymentYear',row?._taxPayment?.fiscal_year||Number(isoToday().slice(0,4)),'number','min="2020" max="2100"')}
       ${selectField('Trimestre del impuesto','exTaxPaymentQuarter',[1,2,3,4].map(q=>({value:String(q),label:q+'T'})),String(row?._taxPayment?.quarter||Math.ceil(Number(isoToday().slice(5,7))/3)))}
       <p class="small muted wide">Pago común del autónomo. Se guarda una sola vez y también aparece en Fiscalidad. Elige el trimestre al que corresponde, aunque se pague después.</p>
      </div>
      <label class="check-field wide emphasis-check"><input id="exManagement" type="checkbox" ${row?.management_only?'checked':''}> Solo información interna · excluir del cálculo fiscal</label>
      <label class="check-field wide"><input id="exFiscalReviewed" type="checkbox" ${row?.fiscal_reviewed===true?'checked':''}> He cotejado el documento, sus conceptos e impuestos; gasto fiscal revisado</label>
      <p class="small muted wide">Un gasto nuevo permanece sin revisar hasta que marques esta casilla. Los gastos internos nunca se incluirán en el cálculo fiscal.</p>
      ${formField('Tipo interno','exPersonnelKind',row?.personnel_kind||'')}
      ${selectField('Forma de pago','exPayment',[...(taxRecord?[{value:'',label:'No indicado'}]:[]),{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||(taxRecord?'':'tarjeta'))}
      ${selectField('Estado de pago','exPaidStatus',[{value:'pagado',label:'Pagado'},{value:'pendiente',label:'Pendiente'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pagado')}
      ${formField('Fecha de pago','exPaidDate',row?.paid_date||(row?'':isoToday()),'date')}
      ${formField('Importe pagado / devuelto','exPaidAmount',row?.amount_paid??'','number','step="0.01"')}
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
    <div class="stack" style="margin-top:14px">${row&&!taxRecord?btn('Eliminar gasto','expense-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar','expense-save','primary',row?`data-id="${row.id}"`:'')}${btn('Cancelar','expense-back','secondary')}</div>
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
 const originalId=isRect?(row?.rectified_invoice_id||getView('facturacion').rectifiedInvoiceId):null;
 const rectified=state.data.invoices.find(x=>x.id===originalId);
 const rectifiedOptions=[{value:'',label:'Selecciona la factura emitida'},...state.data.invoices.filter(x=>x.id!==row?.id&&x.document_type==='factura'&&x.status==='emitida').map(x=>({value:x.id,label:(x.display_number||x.external_number_text||'Factura')+' · '+fmtDate(x.issue_date)+' · '+x.customer_name}))];
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const view=getView('facturacion');
 const selectedStore=row?.store_id||rectified?.store_id||view.storeId||storeOptions[0]?.value||'';
 const series=state.data.series.filter(s=>s.active!==false&&Number(s.year)===Number(String(row?.issue_date||isoToday()).slice(0,4))&&s.document_type===docType&&(!s.store_id||s.store_id===selectedStore)&&(!isProforma?s.series_kind===(isRect?'rectifying':'invoice'):true)).sort((a,b)=>Number(!!a.store_id)-Number(!!b.store_id)).map(s=>({value:s.id,label:s.code}));
 const activeTemplates=state.data.templates.filter(x=>x.active!==false&&(!x.store_id||x.store_id===selectedStore));
 const defaultTemplate=activeTemplates.find(x=>x.store_id===selectedStore&&(isProforma?x.default_proforma:x.default_invoice))
   ||activeTemplates.find(x=>!x.store_id&&(isProforma?x.default_proforma:x.default_invoice));
 const templates=[{value:'',label:'Sin plantilla'},...activeTemplates.map(x=>({value:x.id,label:x.name+(x.store_id?' · '+storeName(x.store_id):' · General')}))];
 const customers=[{value:'',label:'Cliente nuevo / manual'},...state.data.customers.filter(x=>x.active!==false).map(x=>({value:x.id,label:x.name}))];
 const lines=row?state.data.invoiceLines.filter(x=>x.invoice_id===row.id).sort((a,b)=>a.sort_order-b.sort_order):isRect&&rectified?state.data.invoiceLines.filter(x=>x.invoice_id===rectified.id).sort((a,b)=>a.sort_order-b.sort_order).map(x=>({...x,quantity:-Number(x.quantity)})):[{description:'',quantity:1,unit_price_base:'',discount_pct:0,vat_rate:21}];
 const original=row?.source_document_id?state.data.documents.find(x=>x.id===row.source_document_id):null;
 const title=isProforma?'Proforma':isRect?'Factura rectificativa':isExternal?'Factura externa':'Factura';
 const issued=!!row&&row.status!=='borrador',lock=issued?'disabled':'';
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="invoice-back">← Volver a facturación</button><div class="eyebrow">Facturación · ${title}</div><h2>${row?esc(row.display_number||row.external_number_text||'Borrador'):'Nueva '+title.toLowerCase()}</h2></div><div class="inline-actions">${btn('Vista previa ampliada','invoice-draft-preview','secondary')}${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
  <p class="small muted invoice-issuer-note">Emisor: <b>${esc(state.data.settings?.business_name||'Titular pendiente de configurar')}</b>. NIF y domicilio fiscal comunes. Elige la tienda para aplicar su logo; la serie de facturas es compartida.</p><div class="record-layout invoice-workspace">
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
      ${isRect?selectField('Factura original','ivRectifiedInvoice',rectifiedOptions,originalId||'',lock):''}
      ${isRect?`<label class="wide">Motivo de rectificación<textarea id="ivRectificationReason" rows="2" ${lock}>${esc(row?.rectification_reason||'')}</textarea></label><p class="note wide">Rectificación por diferencias: las líneas indican el importe que se añade o se resta a la factura original. Introduce una cantidad negativa para una devolución.</p>`:''}
     </div>
     ${isExternal?`<div class="attachment-box" style="margin-top:14px"><div><b>Original obligatorio</b><div class="small muted">${original?esc(original.original_name):'Sin archivo original'}</div></div><div class="inline-actions">${original?btn('Vista previa','invoice-source-preview','secondary',`data-id="${original.id}"`):''}${original?btn('Descargar','invoice-source-download','secondary',`data-id="${original.id}"`):''}</div>${!issued?'<label class="file-picker">Seleccionar original<input id="ivSourceFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></label>':''}</div>`:''}
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>2 · Cliente</h3></div></div><div class="form-grid" style="margin-top:14px">
      ${selectField('Cliente guardado','ivCustomerId',customers,row?.customer_id||'',lock)}
      ${formField('Cliente','ivCustomer',row?.customer_name??rectified?.customer_name??'','text',lock)}
      ${formField('NIF/CIF','ivTax',row?.customer_tax_id??rectified?.customer_tax_id??'','text',lock)}
      ${formField('Email','ivEmail',row?.customer_email??rectified?.customer_email??'','email',lock)}
      <label class="wide">Dirección<textarea id="ivAddress" rows="2" ${lock}>${esc(row?.customer_address??rectified?.customer_address??'')}</textarea></label>
     </div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>3 · Líneas</h3><p>Conceptos facturados.</p></div>${!issued?btn('+ Añadir línea','invoice-line-add','secondary'):''}</div><div id="invoiceLines" class="stack" style="margin-top:14px">${lines.map((l,i)=>issued?invoiceLineRow(l,i).replaceAll('<input ','<input disabled ').replaceAll('data-action="invoice-line-remove"','disabled data-action="invoice-line-remove"'):invoiceLineRow(l,i)).join('')}</div></section>
    <section class="card card-pad"><div class="section-head"><div><h3>4 · Cobro${issued&&!isProforma?' · editable tras emitir':' y notas'}</h3><p>${issued&&!isProforma?'Solo estos datos de cobro pueden cambiar después de emitir.':'Forma de pago, estado y notas internas.'}</p></div></div><div class="form-grid" style="margin-top:14px">
      ${formField('Concepto general','ivConcept',row?.concept||'','text',lock)}
      ${selectField('Forma de pago','ivPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'transferencia')}
      ${!isProforma?selectField(isRect?'Estado de liquidación':'Estado de cobro','ivPaidStatus',[{value:'pendiente',label:'Pendiente'},{value:'pagada',label:isRect?'Saldada':'Pagada'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pendiente'):''}
      ${!isProforma?formField(isRect?'Fecha de liquidación':'Fecha de cobro','ivPaidDate',row?.paid_date||'','date'):''}
      ${!isProforma?formField(isRect?'Importe cobrado o devuelto':'Importe cobrado','ivPaidAmount',row?.paid_amount??0,'number','step="0.01" min="0"'):''}
      ${isRect?'<p class="note wide">En una rectificativa negativa, este importe corresponde al dinero devuelto al cliente y se escribe en positivo. Deja Pendiente si todavía no se ha devuelto.</p>':''}
      ${!isProforma?`<label class="check-field wide"><input id="ivIncludeIncome" type="checkbox" ${(row?.include_in_income??(isRect?rectified?.include_in_income:false))?'checked':''} ${issued?'disabled':''}> Sumar esta factura a ingresos porque no está incluida en los cierres diarios</label>`:''}
      <label class="wide">Notas internas<textarea id="ivNotes" rows="3" ${issued?'disabled':''}>${esc(row?.notes||'')}</textarea></label>
     </div></section>
    <details class="card card-pad design-details invoice-presentation"><summary><b>5 · Plantilla y presentación</b><span class="small muted">Secundario</span></summary><div class="form-grid invoice-presentation-fields" style="margin-top:14px">${selectField('Plantilla','ivTemplate',templates,row?.template_id||defaultTemplate?.id||'',lock)}<label class="wide">Términos<textarea id="ivTerms" rows="2" ${lock}>${esc(row?.terms_text||'')}</textarea></label><label class="wide">Pie<textarea id="ivFooter" rows="2" ${lock}>${esc(row?.footer_text||'')}</textarea></label></div></details>
   </div>
   <aside class="record-side"><section class="card card-pad sticky-summary"><h3>Resumen</h3><div class="summary-row"><span>Base</span><strong id="ivSumBase">${money(row?.base_amount||0)}</strong></div><div class="summary-row"><span>IVA</span><strong id="ivSumVat">${money(row?.vat_amount||0)}</strong></div><div class="summary-row"><span>Total</span><strong id="ivSumTotal">${money(row?.total_amount||0)}</strong></div><div class="stack" style="margin-top:14px">${row?.status==='borrador'||!row?btn('Guardar borrador','invoice-save','secondary',`${row?`data-id="${row.id}" `:''}data-type="${docType}" data-kind="${invoiceKind}" data-origin="${origin}"`):''}${row?.status==='borrador'?btn(isProforma?'Emitir proforma':'Emitir documento','invoice-finalize','primary',`data-id="${row.id}"`):''}${row&&issued&&!isProforma?btn(isRect?'Guardar liquidación':'Guardar cobro','invoice-payment-save','primary',`data-id="${row.id}"`):''}${row&&isProforma&&['emitida','aceptada'].includes(row.status)?btn('Convertir en factura','proforma-convert','primary',`data-id="${row.id}"`):''}${row?.status==='borrador'?btn('Eliminar borrador','invoice-delete','danger',`data-id="${row.id}"`):''}${row&&issued&&!isProforma?btn('Crear rectificativa','invoice-rectify','secondary',`data-id="${row.id}"`):''}${row&&issued?'<p class="small muted">La factura emitida conserva su numeración: para corregirla, crea una rectificativa.</p>':''}${btn('Volver','invoice-back','secondary')}</div></section><section class="card card-pad invoice-preview-card"><h3>Vista previa en vivo</h3><p class="small muted">Se actualiza mientras completas el documento. No guarda ni emite la factura.</p><div id="invoiceDraftPreview" class="invoice-live-preview"></div></section></aside>
  </div>
 </div>`;
}

export function invoicePreview(row,logoUrl='',options={}){
 const lines=[...(options.lines||state.data.invoiceLines.filter(x=>x.invoice_id===row.id))].sort((a,b)=>a.sort_order-b.sort_order);
 const frozen=row.status!=='borrador'&&row.template_snapshot&&Object.keys(row.template_snapshot||{}).length?row.template_snapshot:null;
 const tpl=frozen||(state.data.templates.find(x=>x.id===row.template_id)||{});
 const title=row.document_type==='proforma'?(tpl.proforma_title||'FACTURA PROFORMA'):(row.invoice_kind==='rectifying'?'FACTURA RECTIFICATIVA':(tpl.invoice_title||'FACTURA'));
 const primary=tpl.primary_color||'#17365D',secondary=tpl.secondary_color||'#4472C4',biz=frozen?.issuer||state.data.settings||{};
 const paymentText=[row.payment_method?('Forma de pago: '+row.payment_method):'',row.paid_status&&row.document_type!=='proforma'?('Estado: '+row.paid_status):'',tpl.bank_details||'',row.terms_text||tpl.payment_terms_default||''].filter(Boolean).join(' · ');
 const textColor=tpl.text_color||'#17202A',font=tpl.font_family==='courier'?'Courier New, monospace':tpl.font_family==='georgia'?'Georgia, serif':tpl.font_family==='times'?'Times New Roman, serif':'Arial, Helvetica, sans-serif',style=({brand:'modern',clean:'minimal',compact:'classic'})[tpl.style]||tpl.style||'modern';
 return `<article class="invoice-preview invoice-style-${esc(style)}" style="--invoice-primary:${esc(primary)};--invoice-secondary:${esc(secondary)};--invoice-text:${esc(textColor)};--invoice-font:${esc(font)}">
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
  ${row.invoice_kind==='rectifying'?`<section class="invoice-payment-box"><b>Rectificación por diferencias</b><div>Factura original: ${esc(row.rectified_invoice_snapshot?.number||'Pendiente')} · ${fmtDate(row.rectified_invoice_snapshot?.issue_date)}</div><div>Motivo: ${esc(row.rectification_reason||'Pendiente')}</div></section>`:''}
  <div class="invoice-lines-wrap">${table([
   {label:'Descripción',html:l=>esc(l.description)},{label:'Cantidad',num:true,html:l=>String(l.quantity)},{label:'Precio',num:true,html:l=>moneyCell(l.unit_price_base)},
   {label:'Dto.',num:true,html:l=>`${Number(l.discount_pct||0).toFixed(1).replace('.',',')} %`},{label:'IVA',num:true,html:l=>`${Number(l.vat_rate||0).toFixed(1).replace('.',',')} %`},{label:'Total',num:true,html:l=>moneyCell(l.total_amount)}
  ],lines,{emptyTitle:'Sin líneas'})}</div>
  <div class="invoice-totals"><div class="summary-row"><span>Base imponible</span><strong>${money(row.base_amount)}</strong></div><div class="summary-row"><span>IVA</span><strong>${money(row.vat_amount)}</strong></div><div class="summary-row invoice-grand-total"><span>Total</span><strong>${money(row.total_amount)}</strong></div>${row.document_type!=='proforma'&&Number(row.paid_amount||0)>0?`<div class="summary-row"><span>${isInvoiceRefund(row)?'Devuelto':'Cobrado'}</span><strong>${money(row.paid_amount)}</strong></div><div class="summary-row"><span>${isInvoiceRefund(row)?'Pendiente de devolver':'Pendiente'}</span><strong>${money(invoiceOutstanding(row))}</strong></div>`:''}</div>
  ${paymentText&&tpl.show_payment_details!==false?`<section class="invoice-payment-box"><b>Pago</b><div>${esc(paymentText)}</div></section>`:''}
  ${(row.footer_text||tpl.footer_text)?`<footer class="invoice-footer">${esc(row.footer_text||tpl.footer_text)}</footer>`:''}
  ${options.actions===false?'':`<div class="form-actions no-print">${btn('Imprimir / Guardar PDF','invoice-print','primary',`data-id="${row.id}"`)}</div>`}
 </article>`;
}

export function productRecordHtml(row=null){
 const families=state.data.families.map(x=>({value:x.id,label:x.name}));
 const prices=row?state.data.providerPrices.filter(x=>x.product_id===row.id&&!x.variant_id):[];
 const comps=row?state.data.competitors.filter(x=>x.product_id===row.id&&!x.variant_id):[];
 const variants=row?state.data.variants.filter(x=>x.product_id===row.id&&x.active!==false):[];
 const chosen=prices.find(x=>x.selected)||(prices.length?[...prices].sort((a,b)=>providerCost(a)-providerCost(b))[0]:null);
 const vat=Number(state.data.settings?.default_sales_vat_rate??21),re=Number(state.data.settings?.purchase_re_rate??5.2);
 const cost=providerCost(chosen),pvp=Number(row?.current_pvp??row?.proposed_pvp??0);
 const hasCost=!!chosen&&chosen.net_cost!=null&&Number.isFinite(Number(chosen.net_cost));
 const study=hasCost&&pvp>0?quickPriceStudy({cost,pvp,vat,re}):null;
 const fiscalCost=study?.costReal??null,margin=study?.margin??null,marginPct=study?.marginPct??null;
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
    <div class="summary-row"><span>Coste neto</span><strong>${hasCost?money(cost):'Sin proveedor'}</strong></div><div class="summary-row"><span>Coste con IVA + RE</span><strong>${fiscalCost==null?'—':money(fiscalCost)}</strong></div><div class="summary-row"><span>PVP final</span><strong>${pvp>0?money(pvp):'Sin precio'}</strong></div><div class="summary-row"><span>Margen real</span><strong class="${margin!=null&&margin<0?'danger-text':''}">${margin==null?'—':money(margin)}</strong></div><div class="summary-row"><span>Margen real %</span><strong class="${margin!=null&&margin<0?'danger-text':''}">${marginPct==null?'—':marginPct.toFixed(1).replace('.',',')+' %'}</strong></div>
    ${!hasCost?'<div class="note warn">Añade un proveedor y su coste para calcular el margen real.</div>':''}
    <div class="stack" style="margin-top:14px">${row?btn('Eliminar producto','product-delete','danger',`data-id="${row.id}"`):''}${btn('Guardar','product-save','primary',row?`data-id="${row.id}"`:'')}${btn('Cancelar','product-back','secondary')}</div>
   </section></aside>
  </div>
 </div>`;
}
