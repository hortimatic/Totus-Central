import {reportMonths,selectReportData,matchesText,searchText,selectDocuments} from '../report-period.js';
import {state,isAdmin,isManager,getFilters,getView} from '../state.js';
import {canUser,rolePermissions,PERMISSION_MODULES,PERMISSION_ACTIONS} from '../permissions.js';
import {sum,money,fmtDate,inRange,monthRange,isoToday,esc} from '../utils.js';
import {kpi,table,dateFilters,btn,moneyCell,stateBadge,formField,selectField} from '../components.js';
import {expenseAttachedInvoices} from '../expense-register.js';
import {quickPriceStudy,isInvoiceRefund,invoiceOutstanding,issuedDocumentFileLocked} from '../calculations.js';
import {computeModel130Accumulated,deductibleExpenseTotal} from '../calculations.js';

const stores=()=>state.data.stores.filter(x=>x.active!==false);
const storeName=id=>stores().find(x=>x.id===id)?.name||'—';

export function inicio(){
 const today=isoToday(),month=monthRange(today),year=Number(today.slice(0,4)),m=Number(today.slice(5,7)),quarter=Math.ceil(m/3);
 const qFrom=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`,qTo=`${year}-${String(quarter*3).padStart(2,'0')}-${String(new Date(year,quarter*3,0).getDate()).padStart(2,'0')}`;
 const activeStores=stores();
 const monthClosings=state.data.closings.filter(x=>inRange(x.business_date,month.from,month.to));
 const monthExpenses=state.data.expenses.filter(x=>inRange(x.expense_date,month.from,month.to));
 const quarterExpenses=state.data.expenses.filter(x=>inRange(x.expense_date,qFrom,qTo));
 const monthInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&inRange(x.issue_date,month.from,month.to));
 const salesFromClosings=sum(monthClosings.filter(x=>x.include_in_income!==false),x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
 const extraInvoices=sum(monthInvoices.filter(x=>x.include_in_income===true),x=>x.total_amount);
 const monthIncomeAdjustments=sum(state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,month.from,month.to)),x=>x.amount);
 const monthManualIncome=sum(state.data.incomeAdjustments.filter(x=>inRange(x.income_date,month.from,month.to)),x=>x.amount);
 const sales=salesFromClosings+extraInvoices+monthIncomeAdjustments+monthManualIncome;
 const accountingExpenses=sum(monthExpenses.filter(x=>!x.management_only),x=>x.accounting_amount??x.gross_expense??x.amount_paid??0);
 const internalExpenses=sum(monthExpenses.filter(x=>x.management_only),x=>x.accounting_amount??x.gross_expense??x.amount_paid??0);
 const realResult=sales-accountingExpenses-internalExpenses;
 const todays=state.data.closings.filter(x=>x.business_date===today);
 const missingStores=activeStores.filter(s=>!todays.some(x=>x.store_id===s.id&&x.status==='cerrado'));
 const draftClosings=state.data.closings.filter(x=>x.status==='borrador').length;
 const mismatches=state.data.closings.filter(x=>Math.abs(Number(x.difference||0))>.01).length;
 const pendingExpenses=state.data.expenses.filter(x=>x.paid_status&&x.paid_status!=='pagado');
 const pendingExpenseAmount=sum(pendingExpenses,x=>Math.max(0,Number(x.accounting_amount??x.gross_expense??0)-Number(x.withholding_amount||0)-Number(x.amount_paid||0)));
 const pendingRefunds=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&isInvoiceRefund(x)&&invoiceOutstanding(x)>.02);
 const pendingInvoices=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.paid_status!=='pagada'&&!isInvoiceRefund(x)).sort((a,b)=>String(a.due_date||a.issue_date||'').localeCompare(String(b.due_date||b.issue_date||'')));
 const pendingInvoiceAmount=sum(pendingInvoices,x=>Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)));
 const draftInvoices=state.data.invoices.filter(x=>x.status==='borrador').length;
 const recentDocs=[...state.data.documents].sort((a,b)=>String(b.created_at||b.document_date||'').localeCompare(String(a.created_at||a.document_date||''))).slice(0,4);
 const pendingDocs=state.data.documents.filter(x=>['pendiente','revisada'].includes(x.status)).length;
 const usage=state.data.storageUsage||{};
 // Never silently show 0 MB on the home dashboard when the server measurement fails.
 const storageOk=usage.status==='ok'&&Number.isFinite(Number(usage.total_bytes))&&Number.isFinite(Number(usage.limit_bytes))&&Number(usage.limit_bytes)>0;
 const used=storageOk?Number(usage.total_bytes):null,limit=storageOk?Number(usage.limit_bytes):null,storagePct=storageOk?used/limit*100:null;
 const yFrom=`${year}-01-01`;
 const incomeYtd=sum(state.data.closings.filter(x=>x.include_in_income!==false&&inRange(x.business_date,yFrom,qTo)),x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))
  +sum(state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,yFrom,qTo)),x=>x.total_amount)
  +sum(state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,yFrom,qTo)),x=>x.amount)
  +sum(state.data.incomeAdjustments.filter(x=>inRange(x.income_date,yFrom,qTo)),x=>x.amount);
 const ytdExpenses=state.data.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false&&inRange(x.expense_date,yFrom,qTo));
 const deductedYtd=deductibleExpenseTotal(ytdExpenses,state.data.expenseLines);
 const fiscalYtd=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,yFrom,qTo));
 const previous130=sum(state.data.taxPayments.filter(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)<quarter&&x.status==='pagado'),x=>x.amount);
 const home130=computeModel130Accumulated({
  income:incomeYtd,deductible:deductedYtd,
  extraDeductible:sum(fiscalYtd.filter(x=>['gasto_deducible_extra','amortizacion'].includes(x.kind)),x=>x.amount),
  reductions:sum(fiscalYtd.filter(x=>x.kind==='reduccion'),x=>x.amount),
  withholdings:sum(fiscalYtd.filter(x=>x.kind==='retencion_soportada'),x=>x.amount),
  previousPayments:previous130,rate:Number(state.data.settings?.irpf_prepayment_rate??20),
  difficultRate:Number(state.data.settings?.difficult_expense_pct??5),
  difficultAnnualCap:Number(state.data.settings?.difficult_expense_annual_cap??2000),
  difficultEnabled:state.data.settings?.difficult_expense_enabled!==false
 });
 const current130=state.data.taxPayments.find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter);
 const alerts=[];
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
 const storeCards=activeStores.map(store=>{
  const close=todays.find(x=>x.store_id===store.id),storeMonth=monthClosings.filter(x=>x.store_id===store.id);
  const monthSales=sum(storeMonth,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
  const todaySales=close?Number(close.cash_sales||0)+Number(close.card_sales||0)+Number(close.bizum_sales||0)+Number(close.online_sales||0)+Number(close.other_income||0):0;
  return `<article class="store-status-card"><div class="section-head"><div><h3>${esc(store.name)}</h3><p>${close?fmtDate(close.business_date):'Sin cierre de hoy'}</p></div>${close?stateBadge(close.status):'<span class="badge warn">Pendiente</span>'}</div><div class="metric-list" style="margin-top:12px"><div class="metric-box"><span>Hoy</span><b>${close?money(todaySales):'—'}</b></div><div class="metric-box"><span>Mes</span><b>${money(monthSales)}</b></div><div class="metric-box"><span>Efectivo final</span><b>${close?money(close.actual_cash):'—'}</b></div><div class="metric-box"><span>Diferencia</span><b class="${close&&Math.abs(Number(close.difference||0))>.01?'danger-text':'good-text'}">${close?money(close.difference||0):'—'}</b></div></div><div class="form-actions">${close?btn('Abrir cierre','closing-edit','secondary',`data-id="${close.id}"`):btn('Registrar cierre','closing-new','primary',`data-store="${store.id}"`)}</div></article>`;
 }).join('');
 const expenseByStore=activeStores.map(store=>{const rows=quarterExpenses.filter(x=>x.store_id===store.id),regular=rows.filter(x=>!x.management_only),internal=rows.filter(x=>x.management_only);return `<div class="summary-row"><div><b>${esc(store.name)}</b><div class="small muted">${regular.length} contabilizados · ${internal.length} internos</div></div><strong>${money(sum(rows,x=>x.accounting_amount??x.gross_expense??x.amount_paid??0))}</strong></div>`}).join('');
 const invoiceRows=pendingInvoices.slice(0,4).map(x=>`<div class="summary-row"><div><b>${esc(x.display_number||x.external_number_text||'Factura')}</b><div class="small muted">${esc(x.customer_name||'Cliente')} · ${money(Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)))} pendientes${x.due_date?' · vence '+fmtDate(x.due_date):''}</div></div><div class="inline-actions">${btn('Vista previa','invoice-preview','secondary',`data-id="${x.id}"`)}</div></div>`).join('');
 const docRows=recentDocs.map(d=>`<div class="summary-row"><div><b>${esc(d.original_name||'Documento')}</b><div class="small muted">${esc(d.supplier_or_customer||d.doc_type||'')} · ${fmtDate(d.document_date||d.created_at)}</div></div><div class="inline-actions">${btn('Ver','document-preview','secondary',`data-id="${d.id}"`)}</div></div>`).join('');
 const activeUsers=state.data.team.filter(x=>x.active!==false).length;
 return `<div class="page dashboard-page">
  <div class="dashboard-hero card card-pad"><div><div class="eyebrow">Inicio · ${fmtDate(today)}</div><h2>Totus Central</h2><p>Mesa de trabajo para consultar, registrar, revisar y decidir sin saltar entre pantallas innecesariamente.</p></div><div class="dashboard-hero-actions">${btn('Nuevo cierre','closing-new','primary')}${btn('Registrar gasto','expense-new','secondary')}${btn('Nueva factura','invoice-new','secondary')}${btn('Subir documento','document-new','secondary')}</div></div>
  <div class="kpis">${kpi('Ingresos del mes',money(sales),`${fmtDate(month.from)} → ${fmtDate(month.to)}`)}${kpi('Gastos contables',money(accountingExpenses),internalExpenses?('+'+money(internalExpenses)+' internos'):'Sin gasto interno')}${kpi('Resultado real',money(realResult),realResult>=0?'Ingresos − todos los gastos':'Mes en negativo')}${kpi('Pendiente de cobro',money(pendingInvoiceAmount),`${pendingInvoices.length} factura${pendingInvoices.length===1?'':'s'}`)}</div>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Operativa de hoy</h2><p>Cierres y control de gasto del trimestre.</p></div></div><div class="dashboard-store-grid">${storeCards}</div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Gastos del ${quarter}T</h3><p>Total contabilizado e interno por establecimiento.</p></div>${btn('Nuevo gasto','expense-new','primary')}</div><div class="home-big-number">${money(sum(quarterExpenses,x=>x.accounting_amount??x.gross_expense??x.amount_paid??0))}</div><div class="stack">${expenseByStore}</div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Pendientes y avisos</h3><p>Solo incidencias que requieren atención.</p></div></div><div class="dashboard-alerts">${alerts.length?alerts.map(a=>`<button class="dashboard-alert ${a.level}" data-route="${a.route}"><span><b>${esc(a.title)}</b><small>${esc(a.text)}</small></span><span>→</span></button>`).join(''):'<div class="empty compact-empty"><strong>Todo al día</strong><span>No hay avisos operativos pendientes.</span></div>'}</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Precios y ventas</h2><p>Consulta un precio al vuelo y controla los cobros abiertos.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Consulta rápida de precio</h3><p>Admite punto o coma decimal.</p></div><button class="btn secondary" data-route="pricing">Abrir Pricing</button></div><div class="home-quick-grid"><input id="homePriceQuery" placeholder="Producto / referencia"><input id="homePriceCost" inputmode="decimal" placeholder="Coste sin impuestos"><input id="homePricePvp" inputmode="decimal" placeholder="PVP final"><input id="homePriceCompetitor" inputmode="decimal" placeholder="Competencia"><input id="homePriceDiscount" inputmode="decimal" placeholder="Descuento %"></div><div class="home-price-metrics"><div><span>Coste real</span><b id="homePriceReal">0,00 €</b></div><div><span>Venta final</span><b id="homePriceSale">0,00 €</b></div><div><span>Margen €</span><b id="homePriceMargin">0,00 €</b></div><div><span>Margen %</span><b id="homePriceMarginPct">0,00 %</b></div><div><span>Vs competencia</span><b id="homePriceCompetition">—</b></div></div><div class="form-actions">${btn('Guardar consulta','home-price-save','primary')}</div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Facturación y cobros</h3><p>${pendingInvoices.length} factura${pendingInvoices.length===1?'':'s'} pendientes · ${money(pendingInvoiceAmount)}</p></div>${btn('Nueva factura','invoice-new','primary')}</div><div class="stack">${invoiceRows||'<div class="empty compact-empty"><strong>Sin cobros pendientes</strong><span>No hay facturas emitidas pendientes de cobro.</span></div>'}</div><div class="dashboard-links"><button class="btn secondary" data-route="facturacion">Abrir facturación</button>${btn('Nueva proforma','proforma-new','secondary')}</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Documentos y fiscalidad</h2><p>Acceso rápido a archivo documental y previsión fiscal.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Documentos recientes</h3><p>${pendingDocs} pendientes de revisar.</p></div>${btn('Subir documento','document-new','primary')}</div><div class="stack">${docRows||'<div class="empty compact-empty"><strong>Sin documentos</strong><span>Todavía no hay documentos archivados.</span></div>'}</div><div class="dashboard-links"><button class="btn secondary" data-route="documentos">Buscar documentos</button></div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Fiscalidad · ${quarter}T ${year}</h3><p>Modelo 130 acumulado desde enero, con pagos previos descontados.</p></div><button class="btn secondary" data-route="fiscalidad">Abrir fiscalidad</button></div><div class="summary-row"><span>Ingresos acumulados</span><strong>${money(incomeYtd)}</strong></div><div class="summary-row"><span>Gasto deducible</span><strong>− ${money(deductedYtd)}</strong></div><div class="summary-row"><span>Base acumulada estimada</span><strong>${money(home130.base)}</strong></div><div class="summary-row"><span>IRPF orientativo</span><strong>${money(home130.due)}</strong></div><div class="summary-row"><span>Modelo 130 registrado</span><strong>${current130?money(current130.amount):'—'}</strong></div><div class="note warn">Indicador de control interno; el cálculo detallado y ajustes están en Fiscalidad.</div></article>
  </div></section>

  <section class="home-zone"><div class="home-zone-head"><div><div class="eyebrow">Mesa de trabajo</div><h2>Seguimiento y sistema</h2><p>Informes, usuarios y almacenamiento en un vistazo.</p></div></div><div class="dashboard-grid">
   <article class="card card-pad"><div class="section-head"><div><h3>Informes y gestoría</h3><p>Prepara libros y paquetes con el periodo correcto.</p></div></div><div class="home-report-cards"><button class="report-shortcut" data-action="home-report-quarter"><span>Trimestre actual</span><b>${quarter}T ${year}</b><small>${fmtDate(qFrom)} → ${fmtDate(qTo)}</small></button><button class="report-shortcut" data-action="home-report-year"><span>Año actual</span><b>${year}</b><small>01/01/${year} → 31/12/${year}</small></button></div><div class="dashboard-links"><button class="btn secondary" data-route="informes">Abrir informes</button></div></article>
   <article class="card card-pad"><div class="section-head"><div><h3>Estado del sistema</h3><p>Control básico de la herramienta.</p></div>${isManager()?'<button class="btn secondary" data-route="administracion">Administración</button>':''}</div><div class="summary-row"><span>Usuarios activos</span><strong>${activeUsers}</strong></div><div class="summary-row"><span>Documentos</span><strong>${state.data.documents.length}</strong></div><div class="summary-row"><span>Almacenamiento usado</span><strong>${storageOk?(used/1048576).toFixed(1).replace('.',',')+' MB':'No disponible'}</strong></div><div class="summary-row"><span>Ocupación</span><strong class="${storageOk&&storagePct>=95?'danger-text':storageOk&&storagePct>=85?'warn-text':''}">${storageOk?storagePct.toFixed(1).replace('.',',')+' % de '+(limit/1048576).toFixed(0)+' MB':'Sin medir'}</strong></div><div class="dashboard-links">${isManager()?'<button class="btn secondary" data-action="admin-storage-home">Almacenamiento</button><button class="btn secondary" data-action="admin-users-home">Usuarios</button>':''}</div></article>
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
 const rows=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)&&matchesText(f.query,x.notes,storeName(x.store_id),x.status,storeName(x.store_id)));
 const total=sum(rows,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0));
 const historical=rows.filter(x=>String(x.source_ref||'').startsWith('EXCEL2026-')||x.entry_mode==='source_snapshot');
 const mismatches=rows.filter(x=>x.entry_mode!=='source_snapshot'&&Math.abs(Number(x.difference||0))>.01).length;
 const drafts=rows.filter(x=>x.status==='borrador').length;
 const headers=[
  {label:'Cierre',html:r=>`<b class="date-display">${fmtDate(r.business_date)}</b><div class="small muted">${esc(storeName(r.store_id))}</div>`},
  {label:'Cobros',html:r=>r.entry_mode==='source_snapshot'?`<div class="compact-detail"><span>Tarjeta según banco <b>${JSON.parse(r.source_ref).card_sales==null?'Sin anotación':money(r.card_sales)}</b></span><span>Efectivo vendido pendiente de conciliación</span></div>`:`<div class="compact-detail"><span>Efectivo <b>${money(r.cash_sales)}</b></span><span>Tarjeta <b>${money(r.card_sales)}</b></span><span>Bizum <b>${money(r.bizum_sales)}</b></span><span>Online <b>${money(r.online_sales)}</b></span><span>Otros <b>${money(r.other_income)}</b></span></div>`},
  {label:'Caja',html:r=>`<div class="compact-detail"><span>Apertura <b>${String(r.source_ref||'').startsWith('EXCEL2026-')?'Sin verificar':money(r.opening_cash)}</b></span><span>Final <b>${String(r.source_ref||'').startsWith('EXCEL2026-')?'Sin verificar':money(r.actual_cash)}</b></span><span>${String(r.source_ref||'').startsWith('EXCEL2026-')?'Salida de caja (Excel)':'Retiradas'} <b>${money(r.cash_withdrawals)}</b></span><span>Gastos caja <b>${money(r.cash_expenses_declared)}</b></span></div>`},
  {label:'Control',html:r=>r.entry_mode==='source_snapshot'?`<div class="compact-detail"><span>Al fin del origen <b>${money(r.reported_total_sales)}</b></span><span class="warn-text">Conciliación pendiente</span><span>No incluido en ingresos fiscales</span></div>`:`<div class="compact-detail"><span>Calculado <b>${money(Number(r.cash_sales||0)+Number(r.card_sales||0)+Number(r.bizum_sales||0)+Number(r.online_sales||0)+Number(r.other_income||0))}</b></span><span>TPV/control <b>${r.reported_total_sales==null?'—':money(r.reported_total_sales)}</b></span><span>Diferencia <b class="${Math.abs(Number(r.difference||0))>.01?'danger-text':'good-text'}">${money(r.difference||0)}</b></span></div>`},
  {label:'Estado',html:r=>`${stateBadge(r.status)}${r.notes?`<div class="small muted record-note">${esc(r.notes)}</div>`:''}`},
  {label:'Acciones',html:r=>`<div class="inline-actions">${btn(r.entry_mode==='source_snapshot'?'Ver origen':r.status==='borrador'?'Continuar':'Abrir','closing-edit','secondary',`data-id="${r.id}"`)}${btn('Eliminar','closing-delete','danger',`data-id="${r.id}"`)}</div>`}
 ];
 return `<div class="page">
  <div class="kpis">${kpi('Cobros parciales registrados',money(total))}${kpi('Registros',String(rows.length))}${kpi('Borradores',String(drafts))}${kpi('Descuadres',String(mismatches),historical.length?historical.length+' históricos pendientes de conciliación':mismatches?'Revisar antes de cerrar':'Sin incidencias')}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Cierres de caja</h2><p>${historical.length?'Hay '+historical.length+' registros históricos con su origen conservado, pendientes de conciliación. No están incluidos en ingresos fiscales. Abre cada ficha para consultar qué datos están disponibles y cuáles faltan.':'Histórico completo. Abre un cierre para ver o editar su ficha.'}</p></div><div class="inline-actions">${btn('Exportar','export-closings-current','secondary')}${btn('+ Nuevo cierre','closing-new','primary')}</div></div>
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
 if(view.section==='facturas')return expenseInvoiceSectionHtml();
 if(view.section==='proveedores')return expenseSuppliersHtml();
 const f=getFilters('gastos');
 const kind=f.kind||'all',paid=f.paid||'all';
 const rows=state.data.expenses.filter(x=>inRange(x.expense_date,f.from,f.to)&&(f.store==='all'||x.store_id===f.store)
   &&(kind==='all'||(kind==='internal'?x.management_only:!x.management_only))
   &&(paid==='all'||x.paid_status===paid)
   &&matchesText(f.query,x.supplier_name,x.supplier_tax_id,x.invoice_number,x.description,x.payment_method,x.notes,storeName(x.store_id)));
 const total=sum(rows,x=>x.gross_expense??x.accounting_amount??x.amount_paid??0);
 const internal=sum(rows.filter(x=>x.management_only),x=>x.gross_expense??x.accounting_amount??x.amount_paid??0);
 const pending=rows.filter(x=>x.paid_status!=='pagado').length;
 const headers=[
  {label:'Gasto',html:r=>`<b class="date-display">${fmtDate(r.expense_date)}</b><div class="small muted">${esc(storeName(r.store_id))} · ${r.management_only?'<span class="badge warn">Interno</span>':r.fiscal_reviewed===false?'<span class="badge warn">Sin conciliar</span>':'<span class="badge info">Fiscal revisado</span>'}</div>`},
  {label:'Documento / proveedor',html:r=>`<b>${esc(r.supplier_name||'—')}</b><div class="small muted">${esc(r.invoice_number||r.document_kind||'Sin número')}</div>`},
  {label:'Concepto',html:r=>`<div>${esc(r.description||'—')}</div><div class="small muted">${esc(r.payment_method||'')} · ${esc(r.withholding_model?('Modelo '+r.withholding_model):'Sin retención')}</div>`},
  {label:'Fiscal',html:r=>`<div class="compact-detail">${r.fiscal_reviewed===false?'<span>Pendiente de desglose fiscal y cotejo de factura</span>':`<span>Base <b>${money(r.base_amount)}</b></span><span>IVA <b>${money(r.vat_amount)}</b></span><span>RE <b>${money(r.re_amount)}</b></span><span>Ret. <b>${money(r.withholding_amount)}</b></span>`}</div>`},
  {label:'Total',num:true,html:r=>`<b>${money(r.gross_expense??r.accounting_amount??r.amount_paid??0)}</b><div class="small">${stateBadge(r.paid_status||'pendiente')}</div>`},
  {label:'Factura adjunta',html:r=>{
    const d=state.data.documents.find(x=>x.id===r.document_id);
    return d?`<div class="small"><b>${esc(d.original_name||'Factura')}</b></div><div class="expense-file-actions">${btn('Ver','expense-document-preview','secondary',`data-id="${d.id}"`)}${btn('Descargar','expense-document-download','secondary',`data-id="${d.id}"`)}</div>`:'<span class="small muted">Pendiente de adjuntar</span>';
   }},
  {label:'Acciones',html:r=>`<div class="inline-actions">${btn('Abrir','expense-edit','secondary',`data-id="${r.id}"`)}${btn('Eliminar','expense-delete','danger',`data-id="${r.id}"`)}</div>`}
 ];
 const extras=`<div class="field"><label>Tipo</label><select id="gastosKind"><option value="all" ${kind==='all'?'selected':''}>Todos</option><option value="fiscal" ${kind==='fiscal'?'selected':''}>Fiscal</option><option value="internal" ${kind==='internal'?'selected':''}>Solo interno</option></select></div><div class="field"><label>Pago</label><select id="gastosPaid"><option value="all" ${paid==='all'?'selected':''}>Todos</option><option value="pagado" ${paid==='pagado'?'selected':''}>Pagado</option><option value="pendiente" ${paid==='pendiente'?'selected':''}>Pendiente</option><option value="parcial" ${paid==='parcial'?'selected':''}>Parcial</option></select></div>`;
 return `<div class="page">
  ${expenseTabs('registros')}
  <div class="kpis">${kpi('Gasto del periodo',money(total))}${kpi('Solo control interno',money(internal))}${kpi('Registros',String(rows.length))}${kpi('Pendientes de pago',String(pending))}</div>
  <section class="card table-card">
   <div class="section-head card-pad"><div><h2>Gastos</h2><p>Accede a cada factura desde su gasto o consulta el archivo ordenado en «Facturas y justificantes».</p></div><div class="inline-actions">${btn('Proveedores','expense-suppliers','secondary')}${btn('Exportar','export-expenses-current','secondary')}${btn('+ Nuevo gasto','expense-new','primary')}</div></div>
   ${dateFilters({...f,stores:stores()},'gastos',extras)}
   ${table(headers,rows,{emptyTitle:'No hay gastos',emptyText:'No existen gastos para los filtros seleccionados.'})}
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
 const suppliers=state.data.suppliers.filter(s=>!needle||matchesText(needle,s.name,s.tax_id,s.email,s.phone,s.notes)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const headers=[
  {label:'Proveedor',html:s=>`<b>${esc(s.name)}</b><div class="small muted">${esc(s.tax_id||'Sin NIF/CIF')}</div>`},
  {label:'Contacto',html:s=>`<div>${esc(s.email||'—')}</div><div class="small muted">${esc(s.phone||'')}</div>`},
  {label:'Valores de las facturas',html:s=>`<div>IVA ${Number(s.default_vat_rate||0)} % · RE ${Number(s.default_re_rate||0)} %</div><div class="small muted">${Number(s.default_withholding_rate||0)?`Retención ${Number(s.default_withholding_rate)} % · modelo ${esc(s.default_withholding_model||'Sin asignar')}`:'Sin retención por defecto'}</div>`},
  {label:'Estado',html:s=>stateBadge(s.active!==false?'activo':'inactivo')},
  {label:'Acciones',html:s=>`<div class="inline-actions">${btn('Editar','expense-supplier-edit','secondary',`data-id="${s.id}"`)}${btn('Eliminar','expense-supplier-delete','danger',`data-id="${s.id}"`)}</div>`}
 ];
 return `<div class="page">${expenseTabs('proveedores')}<section class="card table-card"><div class="section-head card-pad"><div><h2>Proveedores de gastos</h2><p>Compras, servicios y arrendadores. Sus datos se reutilizan al registrar una factura.</p></div>${btn('+ Nuevo proveedor','expense-supplier-new','primary')}</div><div class="toolbar card-pad"><label class="field">Buscar proveedor<input id="expenseSuppliersQuery" value="${esc(query)}" placeholder="Nombre, NIF, correo o teléfono"></label>${btn('Buscar','expense-suppliers-search','secondary')}</div>${table(headers,suppliers,{emptyTitle:'Sin proveedores',emptyText:'Crea un proveedor o cambia la búsqueda.'})}</section></div>`;
}
function expenseInvoiceSectionHtml(){
 const f=getFilters('gastos'),kind=f.kind||'all',paid=f.paid||'all',attachment=f.attachment||'all';
 const rows=expenseAttachedInvoices(state.data.expenses,state.data.documents)
  .filter(({expense,document,date,searchable})=>
   inRange(date,f.from,f.to)
   &&(f.store==='all'||(expense?.store_id||document?.store_id)===f.store)
   &&(kind==='all'||(expense&&(kind==='internal'?!!expense.management_only:!expense.management_only)))
   &&(paid==='all'||expense?.paid_status===paid)
   &&(attachment==='all'||(attachment==='attached'?!!document:!document))
   &&(!f.query||matchesText(f.query,searchable)))
  .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.expense?.supplier_name||a.document?.supplier_or_customer||'').localeCompare(String(b.expense?.supplier_name||b.document?.supplier_or_customer||''),'es'));
 const headers=[
  {label:'Fecha / tienda',html:r=>`<b>${fmtDate(r.date)}</b><div class="small muted">${esc(storeName(r.expense?.store_id||r.document?.store_id))}</div>`},
  {label:'Factura / proveedor',html:r=>`<b>${esc(r.expense?.invoice_number||r.document?.invoice_number||'Sin número')}</b><div>${esc(r.expense?.supplier_name||r.document?.supplier_or_customer||'Sin identificar')}</div><div class="small muted">${esc(r.expense?.supplier_tax_id||r.document?.tax_id||'Sin NIF/CIF')}</div>`},
  {label:'Concepto / archivo',html:r=>`<span>${esc(r.expense?.description||r.document?.original_name||'—')}</span><div class="small muted">${esc(r.document?.original_name||'Sin justificante')}</div>`},
  {label:'Importes',html:r=>r.expense?`<div class="expense-amounts"><span>Base <b>${money(r.expense.base_amount||0)}</b></span><span>IVA <b>${money(r.expense.vat_amount||0)}</b></span><span>RE <b>${money(r.expense.re_amount||0)}</b></span><span>Ret. <b>${money(r.expense.withholding_amount||0)}</b></span></div>`:'Pendiente de asociar'},
  {label:'Total factura / Neto',num:true,html:r=>r.expense?`<div class="expense-amounts"><span>Total <b>${money(Number(r.expense.base_amount||0)+Number(r.expense.vat_amount||0)+Number(r.expense.re_amount||0))}</b></span><span>Neto <b>${money(Number(r.expense.base_amount||0)+Number(r.expense.vat_amount||0)+Number(r.expense.re_amount||0)-Number(r.expense.withholding_amount||0))}</b></span></div><div class="small">${stateBadge(r.expense.paid_status||'pendiente')}</div>`:'—'},
  {label:'Revisión',html:r=>r.unlinked?'<span class="badge warn">Sin asociar</span>':r.expense?.management_only?'<span class="badge warn">Interno, no gestoría</span>':r.expense?.fiscal_reviewed===false?'<span class="badge warn">Sin revisar</span>':'<span class="badge info">Revisado</span>'},
  {label:'Acciones',html:r=>`<div class="expense-file-actions">
   ${r.document?btn('Vista previa','expense-document-preview','secondary',`data-id="${esc(r.document.id)}"`):'<span class="small muted">Sin archivo</span>'}
   ${r.document?btn('Descargar','expense-document-download','secondary',`data-id="${esc(r.document.id)}"`):''}
   ${r.expense?btn('Datos gestoría','expense-gestor-detail','secondary',`data-id="${esc(r.expense.id)}"`):''}
   ${r.expense?btn('Abrir gasto','expense-edit','secondary',`data-id="${esc(r.expense.id)}"`):btn('Abrir archivo','expense-unlinked-open','secondary',`data-id="${esc(r.document?.id||'')}"`)}
   ${r.expense?btn('Eliminar gasto','expense-delete','danger',`data-id="${esc(r.expense.id)}"`):''}
   </div>`}
 ];
 const extras=`<div class="field"><label for="gastosKind">Tipo</label><select id="gastosKind"><option value="all" ${kind==='all'?'selected':''}>Todos</option><option value="fiscal" ${kind==='fiscal'?'selected':''}>Fiscal</option><option value="internal" ${kind==='internal'?'selected':''}>Interno</option></select></div>
 <div class="field"><label for="gastosPaid">Pago</label><select id="gastosPaid"><option value="all" ${paid==='all'?'selected':''}>Todos</option><option value="pagado" ${paid==='pagado'?'selected':''}>Pagado</option><option value="pendiente" ${paid==='pendiente'?'selected':''}>Pendiente</option><option value="parcial" ${paid==='parcial'?'selected':''}>Parcial</option></select></div>
 <div class="field"><label for="gastosAttachment">Archivo</label><select id="gastosAttachment"><option value="all" ${attachment==='all'?'selected':''}>Todos</option><option value="attached" ${attachment==='attached'?'selected':''}>Con archivo</option><option value="missing" ${attachment==='missing'?'selected':''}>Sin archivo</option></select></div>`;
 return `<div class="page">
  ${expenseTabs('facturas')}
  <div class="kpis">${kpi('Facturas adjuntas',String(rows.filter(r=>r.document).length))}${kpi('Gastos sin justificante',String(rows.filter(r=>r.expense&&!r.document).length))}${kpi('Por asociar',String(rows.filter(r=>r.unlinked).length))}${kpi('Registros',String(rows.length))}</div>
  <section class="card table-card">
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
 const usage=state.data.storageUsage||{};
 const storageVerified=usage.status==='ok'&&Number.isFinite(Number(usage.total_bytes))&&Number.isFinite(Number(usage.limit_bytes))&&Number(usage.limit_bytes)>0;
 const used=storageVerified?Number(usage.total_bytes):null,limit=storageVerified?Number(usage.limit_bytes):null;
 const usagePct=storageVerified?Math.min(100,used/limit*100):null;
 const status=f.status||'all',type=f.type||'all';
 const rows=selectDocuments(state.data,f);
 const headers=[
  {label:'Documento',html:r=>`<b>${esc(r.original_name||'Documento')}</b><div class="small muted">${fmtDate(r.document_date||r.created_at)} · ${esc(storeName(r.store_id))}</div>`},
  {label:'Clasificación',html:r=>`<b>${esc(String(r.doc_type||'—').replaceAll('_',' '))}</b><div class="small muted">${esc(r.supplier_or_customer||'')} ${r.invoice_number?'· '+esc(r.invoice_number):''}</div>`},
  {label:'Tamaño',num:true,html:r=>`${(Number(r.size_bytes||0)/1024/1024).toFixed(2).replace('.',',')} MB`},
  {label:'Estado',html:r=>stateBadge(r.status)},
  {label:'',html:r=>`<div class="inline-actions">${btn('Vista previa','document-preview','secondary',`data-id="${r.id}"`)}${btn('Descargar','document-download','secondary',`data-id="${r.id}"`)}${btn('Abrir','document-edit','secondary',`data-id="${r.id}"`)}${!issuedDocumentFileLocked(r.id,state.data.invoices)&&canUser(state.user,'documentos','delete',state.data.userPermissions)&&(isManager()||r.uploaded_by===state.session?.user?.id)?btn('Eliminar','document-delete','danger',`data-id="${r.id}"`):''}</div>`}
 ];
 const extra=`<div class="field"><label>Estado</label><select id="documentosStatus"><option value="all">Todos</option>${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(v=>`<option value="${v}" ${status===v?'selected':''}>${v.replaceAll('_',' ')}</option>`).join('')}</select></div><div class="field"><label>Tipo</label><select id="documentosType"><option value="all">Todos</option>${['factura_recibida','factura_emitida','factura_rectificativa','proforma','ticket','contrato','impuesto','informe','otro'].map(v=>`<option value="${v}" ${type===v?'selected':''}>${v.replaceAll('_',' ')}</option>`).join('')}</select></div>`;
 return `<div class="page documents-page">
  <div class="kpis">${kpi('Documentos filtrados',String(rows.length))}${kpi('Uso de almacenamiento',storageVerified?(used/1024/1024).toFixed(1).replace('.',',')+' MB':'No disponible',storageVerified?usagePct.toFixed(1).replace('.',',')+' % de '+(limit/1024/1024).toFixed(0)+' MB':'Sin medición fiable de Supabase')}${kpi('Pendientes',String(rows.filter(x=>x.status==='pendiente').length))}</div>
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
  <div class="record-toolbar"><div><button class="btn link" data-action="document-back">← Volver a documentos</button><div class="eyebrow">Documentos · ${row?'Ficha':'Nuevo'}</div><h2>${row?esc(row.original_name||'Documento'):'Subir documento'}</h2></div><div>${row?stateBadge(row.status):'<span class="badge info">Nuevo</span>'}</div></div>
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
      ${selectField('Tipo','docType',[{value:'factura_recibida',label:'Factura recibida'},{value:'factura_emitida',label:'Factura emitida'},{value:'factura_rectificativa',label:'Factura rectificativa'},{value:'proforma',label:'Proforma'},{value:'ticket',label:'Ticket'},{value:'contrato',label:'Contrato'},{value:'impuesto',label:'Impuesto'},{value:'informe',label:'Informe'},{value:'otro',label:'Otro'}],row?.doc_type||'factura_recibida')}
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

export function fiscalidad(){
 const f=getFilters('fiscalidad'),to=f.to||isoToday(),year=Number(String(to).slice(0,4)),quarter=Math.max(1,Math.min(4,Math.ceil(Number(String(to).slice(5,7))/3)));
 const qFrom=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`,qTo=`${year}-${String(quarter*3).padStart(2,'0')}-${String(new Date(year,quarter*3,0).getDate()).padStart(2,'0')}`,yFrom=`${year}-01-01`;
 const storeOk=x=>f.store==='all'||x.store_id===f.store;
 const periodClose=state.data.closings.filter(x=>inRange(x.business_date,f.from,f.to)&&storeOk(x)&&x.include_in_income!==false);
 const ytdClose=state.data.closings.filter(x=>inRange(x.business_date,yFrom,qTo)&&storeOk(x)&&x.include_in_income!==false);
 const periodInv=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,f.from,f.to)&&storeOk(x));
 const ytdInv=state.data.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inRange(x.issue_date,yFrom,qTo)&&storeOk(x));
 const periodAdj=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,f.from,f.to)&&storeOk(x));
 const ytdAdj=state.data.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inRange(x.adjustment_date,yFrom,qTo)&&storeOk(x));
 const periodManual=state.data.incomeAdjustments.filter(x=>inRange(x.income_date,f.from,f.to)&&storeOk(x));
 const ytdManual=state.data.incomeAdjustments.filter(x=>inRange(x.income_date,yFrom,qTo)&&storeOk(x));
 const sumIncome=(cs,is,as)=>sum(cs,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))+sum(is,x=>x.total_amount)+sum(as,x=>x.amount);
 const periodIncome=sumIncome(periodClose,periodInv,periodAdj)+sum(periodManual,x=>x.amount),ytdIncome=sumIncome(ytdClose,ytdInv,ytdAdj)+sum(ytdManual,x=>x.amount);
 const periodExpenses=state.data.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false&&inRange(x.expense_date,f.from,f.to)&&storeOk(x)),ytdExpenses=state.data.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false&&inRange(x.expense_date,yFrom,qTo)&&storeOk(x));
 const internalPeriod=state.data.expenses.filter(x=>x.management_only&&inRange(x.expense_date,f.from,f.to)&&storeOk(x));
 const periodDed=deductibleExpenseTotal(periodExpenses,state.data.expenseLines),ytdDedBase=deductibleExpenseTotal(ytdExpenses,state.data.expenseLines);
 const fiscalYtd=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,yFrom,qTo)&&storeOk(x)),fiscalPeriod=state.data.fiscalAdjustments.filter(x=>inRange(x.adjustment_date,f.from,f.to)&&storeOk(x));
 const extraIncomeYtd=sum(fiscalYtd.filter(x=>x.kind==='ingreso_extra'),x=>x.amount),extraDedYtd=sum(fiscalYtd.filter(x=>['gasto_deducible_extra','amortizacion'].includes(x.kind)),x=>x.amount),reductionsYtd=sum(fiscalYtd.filter(x=>x.kind==='reduccion'),x=>x.amount),withheldYtd=sum(fiscalYtd.filter(x=>x.kind==='retencion_soportada'),x=>x.amount);
 const dPct=Number(state.data.settings?.difficult_expense_pct??5),dCap=Number(state.data.settings?.difficult_expense_annual_cap??2000),rate=Number(state.data.settings?.irpf_prepayment_rate??20);
 const previous130=sum(state.data.taxPayments.filter(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)<quarter&&x.status==='pagado'),x=>x.amount);
 const model130=computeModel130Accumulated({income:ytdIncome,deductible:ytdDedBase,extraDeductible:extraDedYtd,reductions:reductionsYtd,previousPayments:previous130,withholdings:withheldYtd,rate,difficultRate:dPct,difficultAnnualCap:dCap,difficultEnabled:state.data.settings?.difficult_expense_enabled!==false});
 const {difficult,base,gross:gross130,due:calc130}=model130;
 const current130=state.data.taxPayments.find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter),paid130=current130?.status==='pagado'?Number(current130.amount||0):0,diff130=paid130-calc130;
 const qExpenses=state.data.expenses.filter(x=>!x.management_only&&inRange(x.expense_date,qFrom,qTo)&&storeOk(x)),qIds=new Set(qExpenses.map(x=>x.id)),qLines=state.data.expenseLines.filter(x=>qIds.has(x.expense_id));
 const calc111=sum(qLines.filter(x=>x.withholding_model==='111'),x=>x.withholding_amount),calc115=sum(qLines.filter(x=>x.withholding_model==='115'),x=>x.withholding_amount);
 const pay111=state.data.taxPayments.find(x=>x.tax_type==='111'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter),pay115=state.data.taxPayments.find(x=>x.tax_type==='115'&&Number(x.fiscal_year)===year&&Number(x.quarter)===quarter);
 const accountingPeriod=sum(state.data.expenses.filter(x=>!x.management_only&&inRange(x.expense_date,f.from,f.to)&&storeOk(x)),x=>x.accounting_amount??x.gross_expense??x.amount_paid??0),internal=sum(internalPeriod,x=>x.accounting_amount??x.gross_expense??x.amount_paid??0);
 const quarterButtons=[1,2,3,4].map(q=>btn(`${q}T`,'fiscal-quarter',q===quarter?'primary':'secondary',`data-year="${year}" data-quarter="${q}"`)).join('');
 const paymentRows=[['130',calc130,current130],['111',calc111,pay111],['115',calc115,pay115]].map(([model,calc,pay])=>{const paid=pay?Number(pay.amount||0):0,diff=paid-Number(calc||0);return `<div class="summary-row"><div><b>Modelo ${model}</b><div class="small muted">${({'130':'Pago fraccionado IRPF','111':'Retenciones de personal y profesionales','115':'Retención de alquiler · Azuqueca'})[model]||''}</div><div class="small muted">${pay?`${esc(pay.status)} · ${fmtDate(pay.payment_date)}`:'Sin registro'}</div></div><div class="compact-detail"><span>Calculado <b>${money(calc)}</b></span><span>Registrado <b>${money(paid)}</b></span><span>Diferencia <b class="${Math.abs(diff)<.02?'good-text':'warn-text'}">${money(diff)}</b></span></div><div class="inline-actions">${btn(pay?'Editar':'Registrar','tax-payment-edit','secondary',`data-model="${model}" data-year="${year}" data-quarter="${quarter}" ${pay?`data-id="${pay.id}"`:''}`)}</div></div>`}).join('');
 return `<div class="page">
  <section class="card">${dateFilters({...f,stores:stores()},'fiscal',`<div class="field"><label>Acceso rápido</label><div class="inline-actions">${quarterButtons}</div></div>`)}</section>
  <div class="kpis">${kpi('Ingresos del periodo',money(periodIncome))}${kpi('Gasto deducible',money(periodDed))}${kpi('Gasto interno',money(internal))}${kpi('Resultado real',money(periodIncome-accountingPeriod-internal))}</div>
  <div class="split">
   <section class="card card-pad"><div class="section-head"><div><h2>Modelo 130 · ${quarter}T ${year}</h2><p>Cálculo acumulado del 01/01/${year} al ${fmtDate(qTo)}.</p></div>${btn('Ajuste fiscal','fiscal-adjustment-new','secondary')}</div>
    <div class="summary-row"><span>Ingresos acumulados</span><strong>${money(ytdIncome)}</strong></div>
    <div class="summary-row"><span>Ajustes de ingreso</span><strong>${money(extraIncomeYtd)}</strong></div>
    <div class="summary-row"><span>Ingresos manuales acumulados</span><strong>${money(sum(ytdManual,x=>x.amount))}</strong></div>
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
   <section class="card card-pad"><div class="section-head"><div><h2>Modelos y pagos · ${quarter}T</h2><p>Retenciones y pagos registrados, separados del IVA de las facturas.</p></div></div><div class="stack" style="margin-top:12px">${paymentRows}</div><div class="note rental-tax-note">El modelo 115 corresponde a la retención del alquiler, no al IVA. En vuestra operativa se aplica al local de Azuqueca. El alquiler de Alcalá no debe recibir esa retención por defecto. Cada factura conserva sus propios porcentajes y justificante.</div></section>
  </div>
  <section class="card card-pad"><div class="section-head"><div><h2>Ajustes fiscales del periodo</h2><p>Ninguna diferencia se corrige de forma silenciosa.</p></div>${btn('+ Nuevo ajuste','fiscal-adjustment-new','primary')}</div><div class="stack" style="margin-top:12px">${fiscalPeriod.length?fiscalPeriod.map(x=>`<div class="summary-row"><div><b>${esc(x.kind.replaceAll('_',' '))}</b><div class="small muted">${fmtDate(x.adjustment_date)} · ${esc(x.description||'')}</div></div><strong>${money(x.amount)}</strong><div class="inline-actions">${btn('Editar','fiscal-adjustment-edit','secondary',`data-id="${x.id}"`)}</div></div>`).join(''):'<div class="empty"><strong>Sin ajustes</strong><span>No hay ajustes fiscales explícitos en este periodo.</span></div>'}</div></section>
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
 const sales=sum(c,x=>Number(x.cash_sales||0)+Number(x.card_sales||0)+Number(x.bizum_sales||0)+Number(x.online_sales||0)+Number(x.other_income||0))+sum(extraInv,x=>x.total_amount)+sum(incomeAdj,x=>x.amount)+sum(manualIncome,x=>x.amount);
 const unreviewed=g.filter(x=>!x.management_only&&x.fiscal_reviewed===false).length;
 const accounting=sum(g.filter(x=>!x.management_only),x=>x.gross_expense??x.accounting_amount??x.amount_paid??0),internal=sum(g.filter(x=>x.management_only),x=>x.gross_expense??x.accounting_amount??x.amount_paid??0);
 return `<div class="page">
 <section class="card">${dateFilters({...f,stores:stores()},'informes')}</section>
 <div class="kpis">${kpi('Ventas del periodo',money(sales))}${kpi('Gastos registrados',money(accounting))}${kpi('Gastos internos',money(internal))}${kpi('Resultado real',money(sales-accounting-internal))}</div>
 ${unreviewed?`<div class="note">${unreviewed} gastos pendientes de revisión están incluidos en el resultado real, pero excluidos de las deducciones del modelo 130 y del libro fiscal de gestoría hasta cotejar sus facturas.</div>`:'' }
 <div class="split">
  <section class="card card-pad"><div class="section-head"><div><h2>Diarios mensuales de gastos y ventas</h2><p>Todos los meses del periodo aplicado. Cada archivo incluye solo las fechas, tienda y búsqueda seleccionadas.</p></div></div>
   <div class="monthly-reports">${periods.map(period=>`<section class="monthly-report"><h3>${esc(period.label)}</h3>${stores().filter(s=>f.store==='all'||s.id===f.store).map(s=>`<div class="summary-row"><b>${esc(s.name)}</b><div class="inline-actions">${btn('Vista previa','report-store-preview','secondary',`data-store="${s.id}" data-year="${period.year}" data-month="${period.month}"`)}${btn('Descargar Excel','export-store-book','primary',`data-store="${s.id}" data-year="${period.year}" data-month="${period.month}"`)}</div></div>`).join('')}</section>`).join('')}</div>
  </section>
  <section class="card card-pad"><div class="section-head"><div><h2>Gestoría y auditoría</h2><p>Tabla de compras y gastos con las columnas y el desglose del documento de la gestoría. Solo incluye gastos fiscales revisados del periodo y tienda seleccionados. Nºfra.rec. y Rt quedan para la gestoría.</p></div></div>
   <div class="report-actions" style="margin-top:14px">${btn('Ver tabla de gestoría','report-gestor-source-preview','secondary')}${btn('Descargar tabla Excel','export-gestor-source','primary')}${btn('Imprimir / guardar PDF','report-gestor-source-print','secondary')}</div>
   <div class="report-actions" style="margin-top:14px"><details class="report-extra"><summary>Conciliación y auditoría interna</summary><p class="small muted">Libro complementario para contrastar importes; el documento para entregar es la tabla de gestoría.</p>${btn('Descargar conciliación anual '+year,'export-gestor-book','secondary',`data-year="${year}"`)}</details>${btn('Preparar paquete anual gestor ZIP','export-gestor-package','secondary',`data-year="${year}"`)}</div>
  </section>
 </div>
 <section class="card card-pad"><div class="section-head"><div><h2>Exportaciones de trabajo</h2><p>Para análisis puntual con las fechas exactas seleccionadas.</p></div></div><div class="toolbar" style="margin-top:16px">${btn('Cierres detallados','export-closings','secondary')}${btn('Gastos detallados','export-expenses','secondary')}${btn('Resumen del periodo','export-summary','secondary')}</div></section>
 </div>`;
}

export function administracion(){
 if(!canUser(state.user,'administracion','view',state.data.userPermissions))return '<div class="page"><div class="card card-pad"><h2>Sin acceso</h2></div></div>';
 const section=getView('administracion').section||'usuarios';
 const tabs=`<div class="tabs module-tabs"><button class="tab ${section==='usuarios'?'active':''}" data-action="admin-section" data-section="usuarios">Usuarios</button><button class="tab ${section==='roles'?'active':''}" data-action="admin-section" data-section="roles">Roles y permisos</button><button class="tab ${section==='negocio'?'active':''}" data-action="admin-section" data-section="negocio">Negocio y cajas</button><button class="tab ${section==='fiscal'?'active':''}" data-action="admin-section" data-section="fiscal">Configuración fiscal</button><button class="tab ${section==='storage'?'active':''}" data-action="admin-section" data-section="storage">Almacenamiento</button><button class="tab ${section==='backups'?'active':''}" data-action="admin-section" data-section="backups">Copias</button><button class="tab ${section==='log'?'active':''}" data-action="admin-section" data-section="log">Log</button></div><p class="tab-scroll-hint">Más secciones: desliza la barra horizontalmente →</p>`;
 return `<div class="page">${tabs}${section==='usuarios'?adminUsersHtml():section==='roles'?adminRolesHtml():section==='negocio'?adminBusinessHtml():section==='fiscal'?adminFiscalHtml():section==='storage'?adminStorageHtml():section==='backups'?adminBackupHtml():adminLogHtml()}</div>`;
}
function adminUsersHtml(){
 if(!isAdmin())return '<section class="card card-pad"><h2>Usuarios</h2><div class="note">Solo el administrador gestiona usuarios.</div></section>';
 const rows=state.data.team;
 const headers=[{label:'Usuario',html:r=>`<b>${esc(r.full_name)}</b><div class="small muted">${esc(r.email)}</div>`},{label:'Rol',html:r=>esc(r.role)},{label:'Puesto',html:r=>esc(r.job_title||'—')},{label:'Estado',html:r=>stateBadge(r.active?'activo':'inactivo')},{label:'Acciones',html:r=>`<div class="inline-actions">${btn('Editar','user-edit','secondary',`data-email="${esc(r.email)}"`)}${r.role!=='admin'?btn('Permisos','user-permissions','secondary',`data-email="${esc(r.email)}"`):''}</div>`}];
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
   !role.is_system?btn('Cambiar nombre','role-rename','secondary',`data-role="${esc(role.code)}"`):'',
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
 <div class="note">El Administrador conserva el control total y no se puede eliminar. Los roles del sistema son permanentes; los personalizados pueden borrarse cuando nadie los utiliza. Los ajustes de seguridad se validan también en Supabase.</div></section>
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
 return `<section class="card card-pad"><div class="section-head"><div><h2>Configuración fiscal</h2><p>Parámetros de previsión. No sustituye a la gestoría.</p></div></div><div class="form-grid" style="margin-top:14px">
 ${formField('IVA venta (%)','cfgVat',s.default_sales_vat_rate??21,'number',locked+' step="0.1"')}${formField('Recargo equivalencia compra (%)','cfgPurchaseRe',s.purchase_re_rate??5.2,'number',locked+' step="0.1"')}${formField('Pago fraccionado IRPF (%)','cfgIrpf',s.irpf_prepayment_rate??20,'number',locked+' step="0.1"')}${formField('Difícil justificación (%)','cfgDifficultPct',s.difficult_expense_pct??5,'number',locked+' step="0.1"')}${formField('Tope anual difícil justificación','cfgDifficultCap',s.difficult_expense_annual_cap??2000,'number',locked+' step="0.01"')}
 <label class="check-field wide"><input id="cfgDifficultEnabled" type="checkbox" ${s.difficult_expense_enabled===false?'':'checked'} ${locked}> Aplicar difícil justificación en previsión</label>
 <p class="note wide">Las cuotas de autónomos se registran en Gastos, con la categoría Seguridad Social de autónomos. La previsión fiscal utiliza los gastos registrados y revisados.</p><label class="wide">Notas fiscales<textarea id="cfgFiscalNotes" rows="4" ${locked}>${esc(s.fiscal_notes||'')}</textarea></label>
 </div>${isAdmin()?`<div class="form-actions">${btn('Guardar configuración fiscal','config-save','primary')}</div>`:''}</section>
 <section class="card card-pad"><div class="section-head"><div><h2>Categorías de gastos</h2><p>Códigos usados por Gastos, fiscalidad y los libros Excel.</p></div>${isAdmin()?btn('+ Nueva categoría','expense-category-new','primary'):''}</div>
 <div class="stack" style="margin-top:12px">${state.data.categories.length?state.data.categories.slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.name).localeCompare(String(b.name),'es')).map(c=>`<div class="summary-row"><div><b>${esc(c.name)}</b><div class="small muted">${esc(c.code)}${c.aeat_group?' · '+esc(c.aeat_group):''}${c.manager_code?' · gestor '+esc(c.manager_code):''}</div></div><div>${stateBadge(c.active?'activo':'inactivo')}</div><div class="inline-actions">${isAdmin()?btn('Editar','expense-category-edit','secondary',`data-id="${c.id}"`):''}</div></div>`).join(''):'<div class="empty"><strong>Sin categorías</strong><span>Crea categorías antes de registrar gastos.</span></div>'}</div></section>`;
}
function adminStorageHtml(){
 const u=state.data.storageUsage||{};
 const bytes=v=>Number(v||0),mb=v=>(bytes(v)/1048576).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' MB';
 const healthy=u.status==='ok';
 if(!healthy)return `<section class="card card-pad storage-dashboard" role="status">
  <div class="section-head"><div><h2>Almacenamiento · Supabase</h2><p>La lectura de almacenamiento no se ha podido verificar. No mostramos 0 MB porque podría ser incorrecto.</p></div>${btn('Reintentar conexión','storage-refresh','primary')}</div>
  <div class="note warn"><b>Datos no disponibles</b> · ${esc(u.message||'Comprueba la conexión a Supabase y los permisos de la sesión.')}</div>
 </section>`;
 const total=bytes(u.total_bytes),limit=Math.max(1,bytes(u.limit_bytes)),backups=bytes(u.backup_bytes);
 const dbSize=Number(u.database_bytes),measuredTotal=Number(u.observed_total_bytes);
 const measuredOk=Number.isFinite(dbSize)&&dbSize>=0&&Number.isFinite(measuredTotal)&&measuredTotal>=total+backups+dbSize-1;
 const measuredDenominator=measuredOk?Math.max(1,measuredTotal):1;
 const measurePercent=v=>(100*Math.max(0,bytes(v))/measuredDenominator).toFixed(4);
 const pct=Math.max(0,Math.min(100,total/limit*100));
 const stamp=u.measured_at?new Date(u.measured_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}):'Sin fecha';
 const remaining=Math.max(0,limit-total);
 let forecast='Sin datos históricos suficientes';
 let explanation='La previsión necesita al menos dos mediciones separadas siete días. No se calcula con cifras inventadas.';
 if(total>=limit){
  forecast='Límite alcanzado';explanation='Se ha alcanzado el máximo interno configurado para documentos y logos.';
 }else if(Number.isFinite(Number(u.estimated_days_left))&&u.estimated_days_left!==null&&Number(u.estimated_days_left)>=0&&bytes(u.daily_growth_bytes)>0){
  const days=Number(u.estimated_days_left);
  forecast=days>365?'Más de un año':days+' días aprox.';
  explanation='Estimación orientativa: tendencia neta de los últimos '+Number(u.trend_days||0)+' días ('+mb(bytes(u.daily_growth_bytes))+'/día). No predice subidas extraordinarias.';
 }else if(Number(u.trend_days||0)>=7) {
  forecast='Sin crecimiento neto';explanation='El espacio de documentos y logos no ha aumentado durante el periodo observado; no se puede estimar una fecha de llenado.';
 }
 const caution=total/limit>=.9?'Almacenamiento interno cercano al límite.':total/limit>=.75?'El espacio disponible está disminuyendo.':'Esta cifra se calcula con el límite interno configurado en Totus.';
 return `<div class="stack storage-dashboard">
  <section class="card card-pad">
   <div class="section-head"><div><h2>Almacenamiento · Supabase</h2><p>Medición real de archivos guardados en el servidor, con actualización automática mientras esta pantalla está abierta.</p></div>
    <div class="inline-actions">${btn('Actualizar ahora','storage-refresh','secondary')}${isAdmin()?btn('Revisar logos sin uso','admin-unused-logos','secondary'):''}</div></div>
   <div class="storage-sync-line"><span class="storage-status"><span class="storage-online-dot" aria-hidden="true"></span> Datos verificados en Supabase</span><span>Medición: <b id="storageMeasuredAt">${esc(stamp)}</b> · Se actualiza cada 60 segundos</span></div>
   <div class="storage-observed-heading"><div><h3>Espacio total observado en Supabase</h3><p>Desglose proporcional de lo que ocupa cada componente medido; no representa la cuota del plan.</p></div><strong id="storageObservedTotal">${measuredOk?mb(measuredTotal):'No disponible'}</strong></div>
   ${measuredOk?`<div id="storageObservedBar" class="storage-breakdown-bar" role="img" aria-label="Distribución del almacenamiento observado: PostgreSQL ${mb(dbSize)}, documentos ${mb(u.documents_bytes)}, logos ${mb(u.assets_bytes)}, copias ${mb(backups)}">
    <span class="storage-segment-db" style="width:${measurePercent(dbSize)}%" title="PostgreSQL: ${mb(dbSize)}"></span><span class="storage-segment-docs" style="width:${measurePercent(u.documents_bytes)}%" title="Documentos: ${mb(u.documents_bytes)}"></span><span class="storage-segment-assets" style="width:${measurePercent(u.assets_bytes)}%" title="Logos: ${mb(u.assets_bytes)}"></span><span class="storage-segment-backups" style="width:${measurePercent(backups)}%" title="Copias: ${mb(backups)}"></span>
   </div><div class="storage-legend"><span><i class="storage-legend-db"></i> PostgreSQL · ${mb(dbSize)}</span><span><i class="storage-legend-docs"></i> Documentos · ${mb(u.documents_bytes)}</span><span><i class="storage-legend-assets"></i> Logos · ${mb(u.assets_bytes)}</span><span><i class="storage-legend-backups"></i> Copias · ${mb(backups)}</span></div>`:'<div class="note warn">No se dispone de una medición verificable de la base de datos. No se calcula una barra ficticia.</div>'}
   <div class="storage-quota-title"><h3>Cuota interna para documentos y logos</h3><p>Este límite operativo de Totus no incluye la base de datos ni las copias.</p></div>
   <div class="storage-usage-header"><strong>${mb(total)} usados</strong><strong>${mb(remaining)} disponibles</strong></div>
   <progress id="storageUsageBar" aria-label="Porcentaje ocupado del límite de documentos y logos" max="100" value="${pct.toFixed(2)}"></progress>
   <div class="storage-usage-footer"><span>${pct.toLocaleString('es-ES',{maximumFractionDigits:1})} % ocupado</span><span>Límite interno de Totus: ${mb(limit)}</span></div>
   <p class="note">${esc(caution)} Este indicador <b>no representa la cuota total contratada con Supabase</b>; mide el límite operativo que Totus aplica a documentos y logos.</p>
  </section>
  <div class="kpis">
   ${kpi('Facturas y documentos',mb(u.documents_bytes||0))}
   ${kpi('Logos y recursos',mb(u.assets_bytes||0))}
   ${kpi('Copias privadas adicionales',mb(backups))}
   ${kpi('Estimación de capacidad',forecast)}
  </div>
  <div class="storage-information-grid">
   <section class="card card-pad">
    <h3>Distribución del almacenamiento</h3>
    <div class="summary-row"><span>Documentos originales</span><strong>${mb(u.documents_bytes)} · ${Number(u.documents_count||0)} archivo(s)</strong></div>
    <div class="summary-row"><span>Logos y recursos</span><strong>${mb(u.assets_bytes)} · ${Number(u.assets_count||0)} archivo(s)</strong></div>
    <div class="summary-row"><span>Backups en nube privada</span><strong>${mb(backups)} · ${Number(u.backup_count||0)} copia(s)</strong></div>
    <div class="summary-row"><span>Total de archivos en estos tres espacios</span><strong>${mb(u.all_buckets_bytes)}</strong></div>
    <div class="summary-row"><span>Base de datos PostgreSQL (aprox.)</span><strong>${Number.isFinite(Number(u.database_bytes))?mb(u.database_bytes):'No disponible'}</strong></div>
    <div class="summary-row"><span>Total observado en Totus + PostgreSQL</span><strong>${Number.isFinite(Number(u.observed_total_bytes))?mb(u.observed_total_bytes):'No disponible'}</strong></div>
    <p class="small muted">Las copias y PostgreSQL consumen espacio en Supabase, pero no se descuentan del límite interno de documentos y logos. La cifra de PostgreSQL incluye sobrecarga de la base y no equivale por sí sola a la cuota facturable de tu plan.</p>
   </section>
   <section class="card card-pad">
    <h3>Previsión de crecimiento</h3>
    <div class="storage-forecast-value">${esc(forecast)}</div>
    <p class="small muted">${esc(explanation)}</p>
    <div class="summary-row"><span>Mediciones históricas</span><strong>${Number(u.sample_count||0)}</strong></div>
    <div class="summary-row"><span>Tendencia media neta</span><strong>${bytes(u.daily_growth_bytes)>0?mb(u.daily_growth_bytes)+'/día':'No calculable'}</strong></div>
    <p class="note">Para verificar el almacenamiento total del proyecto y el límite de tu plan, consulta <b>Supabase → Usage</b>. Totus no inventará esa cuota.</p>
   </section>
  </div>
 </div>`;
}
function adminBackupHtml(){
 if(!isAdmin())return '<section class="card card-pad"><h2>Copias de seguridad</h2><p>Solo el administrador puede configurar y consultar copias.</p></section>';
 const config=state.data.backupConfig||{},runs=(state.data.backupRuns||[]).slice().sort((a,b)=>String(b.started_at||'').localeCompare(String(a.started_at||'')));
 const active=!!config.enabled,frequency=config.frequency||'daily',retention=config.retention_days||10;
 const hh=String(config.run_hour??3).padStart(2,'0'),mm=String(config.run_minute??0).padStart(2,'0');
 const frequencyOptions=[['daily','Cada día'],['weekly','Cada semana'],['monthly','Cada mes']].map(([v,label])=>`<option value="${v}" ${frequency===v?'selected':''}>${label}</option>`).join('');
 const weekOptions=[['1','Lunes'],['2','Martes'],['3','Miércoles'],['4','Jueves'],['5','Viernes'],['6','Sábado'],['0','Domingo']].map(([v,label])=>`<option value="${v}" ${Number(config.weekday??1)===Number(v)?'selected':''}>${label}</option>`).join('');
 const days=Array.from({length:28},(_,i)=>`<option value="${i+1}" ${Number(config.month_day??1)===i+1?'selected':''}>Día ${i+1}</option>`).join('');
 const paths=runs.filter(x=>x.status==='success'),bytes=paths.reduce((a,x)=>a+Number(x.size_bytes||0),0),recent=paths[0];
 const columns=[
  {label:'Creación',html:r=>esc(new Date(r.started_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))},
  {label:'Tipo',html:r=>r.mode==='scheduled'?'Automática':'Manual'},
  {label:'Estado',html:r=>r.status==='success'?'<span class="badge ok">Completada</span>':r.status==='failed'?'<span class="badge warn">Fallida</span>':r.status==='expired'?'<span class="badge">Caducada / rotada</span>':'<span class="badge info">En curso</span>'},
  {label:'Tamaño',html:r=>r.size_bytes?((Number(r.size_bytes)/1024/1024).toFixed(2)+' MB'):'—'},
  {label:'Datos / archivos',html:r=>`${Number(r.rows_count||0)} registros · ${Number(r.files_count||0)} archivos`},
  {label:'Incidencias',html:r=>esc(r.error_message||'—')},
  {label:'',html:r=>r.status==='success'&&r.storage_path?`<div class="inline-actions">${btn('Descargar','backup-history-download','secondary',`data-id="${r.id}"`)}${btn('Verificar','backup-history-verify','secondary',`data-id="${r.id}"`)}</div>`:''}
 ];
 return `<div class="stack">
  <div class="kpis">${kpi('Programación',active?'Activada':'Desactivada')}${kpi('Copias disponibles',String(paths.length))}${kpi('Espacio usado',bytes<1024*1024?(bytes/1024).toFixed(0)+' KB':(bytes/1024/1024).toFixed(1)+' MB')}${kpi('Conservación',String(retention)+' días')}</div>
  <section class="card card-pad"><div class="section-head"><div><h2>Copias automáticas</h2><p>Programa copias completas en el servidor: datos, facturas y otros archivos. Funciona aunque cierres el navegador.</p></div></div>
   <div class="form-grid" style="margin-top:14px">
    <label class="check-field wide emphasis-check"><input type="checkbox" id="backupEnabled" ${active?'checked':''}> Activar copias programadas</label>
    <div class="field"><label for="backupFrequency">Frecuencia</label><select id="backupFrequency">${frequencyOptions}</select></div>
    <div class="field"><label for="backupTime">Hora en España (Madrid)</label><input id="backupTime" type="time" value="${hh}:${mm}"></div>
    <div class="field" id="backupWeekdayWrapper" ${frequency!=='weekly'?'hidden':''}><label for="backupWeekday">Día de la semana</label><select id="backupWeekday">${weekOptions}</select></div>
    <div class="field" id="backupMonthdayWrapper" ${frequency!=='monthly'?'hidden':''}><label for="backupMonthday">Día de cada mes</label><select id="backupMonthday">${days}</select></div>
    <div class="field"><label for="backupRetention">Días que conservar las copias</label><input id="backupRetention" type="number" value="${retention}" min="1" max="365" step="1"></div>
    <div class="field"><label for="backupFolder">Carpeta de destino (nube privada)</label><input id="backupFolder" value="${esc(config.destination_folder||'automaticas')}" maxlength="48" pattern="[a-zA-Z0-9_-]{3,48}" placeholder="automaticas"></div>
   </div>
   <div class="note">Destino: almacenamiento privado de <b>Supabase STAGING → business-backups</b>, en la carpeta elegida. No se puede guardar automáticamente en una carpeta del ordenador mientras está apagado. Las copias antiguas se eliminan tras una nueva copia exitosa, conservando siempre la más reciente. El proceso no incorpora contraseñas.</div>
   <div class="form-actions backup-control-actions">${btn('Guardar programación','backup-settings-save','primary')}${btn('Crear copia privada ahora','backup-run-now','secondary')}</div>
   <div class="note">Las copias nuevas conservan autores, datos y permisos. La recuperación prepara archivos nuevos y guarda antes el estado actual. Las cuentas de acceso mantienen sus contraseñas. El límite de cada archivo de copia es 49 MB; un exceso se mostrará como fallo y no como respaldo correcto.</div>
  </section>
  <section class="card table-card"><div class="section-head card-pad"><div><h2>Historial y descargas</h2><p>${recent?'Última copia correcta: '+esc(new Date(recent.started_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})):'Aún no hay copias completas almacenadas.'} Revisa cada ejecución, errores, tamaño y archivos.</p></div>${btn('Actualizar historial','backup-refresh','secondary')}</div>
   ${table(columns,runs.slice(0,50),{emptyTitle:'Sin copias en el servidor',emptyText:'Puedes crear una copia manual o activar la programación.'})}
  </section>
  <section class="card card-pad"><div class="section-head"><div><h2>Copia local y comprobación</h2><p>Puedes continuar descargando una copia directamente a tu ordenador y comprobar cualquier .totusbackup guardado.</p></div>${btn('Descargar copia local','backup-create','primary')}</div>
  <div class="form-grid" style="margin-top:12px"><label class="wide">Seleccionar copia para comprobar
   <span class="backup-file-control"><span class="file-picker backup-file-picker">Elegir copia de seguridad<input id="backupFile" data-draft-ignore type="file" accept=".totusbackup,.zip,application/zip"></span>
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


export const renderers={inicio,pricing,cajas,gastos,facturacion,documentos,fiscalidad,informes,administracion};

export function openingDrawerCash(storeId,drawerId,targetDate=isoToday()){
 const previous=state.data.closings.filter(x=>x.store_id===storeId&&x.status==='cerrado'&&String(x.business_date)<String(targetDate)).sort((a,b)=>String(b.business_date).localeCompare(String(a.business_date)))[0];
 if(!previous)return 0;
 return Number(state.data.closingDrawers.find(x=>x.closing_id===previous.id&&x.drawer_id===drawerId)?.closing_cash||0);
}

function drawerEditor(drawer,row,locked=false){
 const saved=row?state.data.closingDrawers.find(x=>x.closing_id===row.id&&x.drawer_id===drawer.id):null;
 const targetDate=row?.business_date||getView('cajas').date||isoToday();
 const open=saved?.opening_cash??openingDrawerCash(drawer.store_id,drawer.id,targetDate);
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
 if(row?.entry_mode==='source_snapshot')return sourceClosingRecordHtml(row);
 const storeOptions=stores().map(s=>({value:s.id,label:s.name}));
 const view=getView('cajas');
 const sid=row?.store_id||view.storeId||storeOptions[0]?.value||'';
 const recordDate=row?.business_date||view.date||isoToday();
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
      ${formField('Fecha','clDate',recordDate,'date',locked?'disabled':'')}
      ${formField('Total TPV / control','clReported',row?.reported_total_sales??'','number','step="0.01" min="0" '+(locked?'disabled':''))}
      <label class="wide">Observaciones<textarea id="clNotes" rows="3" ${locked?'disabled':''}>${esc(row?.notes||'')}</textarea></label>
     </div>
    </section>
    <section class="stack" id="closingDrawers">${drawers.map(d=>drawerEditor(d,row,locked)).join('')||'<div class="note bad">Esta tienda no tiene cajas activas configuradas.</div>'}</section>
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

export function sourceClosingRecordHtml(row){
 let origin;try{origin=JSON.parse(row.source_ref)}catch{throw new Error('No se puede leer el origen del cierre importado.');}
 if(origin?.kind!=='closing_source_snapshot'||!Array.isArray(origin.drawers)||row.include_in_income!==false)throw new Error('El origen del cierre importado está incompleto o no está separado de ingresos fiscales.');
 const amount=value=>value==null?'Sin anotación':money(value);
 return `<div class="page record-page"><div class="record-toolbar"><div>${btn('← Volver a cierres','closing-back','link')}<div class="eyebrow">Cierre de origen · ${fmtDate(row.business_date)}</div><h2>${esc(storeName(row.store_id))}</h2></div><span class="badge warn">Pendiente de conciliación</span></div>
 <section class="card card-pad"><h3>Captura original</h3><p>Datos conservados sin repartir tarjetas ni retiradas entre cajas cuando el origen solo indica el total de tienda.</p>${origin.missing_drawers?.length?`<p class="note warn">Sin captura de ${esc(origin.missing_drawers.join(', '))} en esta fecha. No se ha creado una caja con importes a cero.</p>`:''}${table([
 {label:'Caja',html:d=>esc(d.name)}, {label:'Apertura',html:d=>amount(d.opening)},
 {label:'Al fin del origen',html:d=>amount(d.al_fin)}, {label:'Efectivo siguiente apertura',html:d=>amount(d.closing)},
 {label:'Anotación original',html:d=>esc(d.comment)}, {label:'Referencia',html:d=>esc(d.source_id)}
 ],origin.drawers)}</section>
 <section class="card card-pad"><h3>Excel de la misma tienda</h3><div class="summary-row"><span>Tarjeta · venta ${fmtDate(row.business_date)}</span><strong>${amount(origin.card_sales)}</strong></div><p class="small muted">Ingreso en banco: ${fmtDate(origin.bank_date)}. ${esc(origin.book)} · filas ${esc((origin.card_rows||[]).join(', ')||'sin anotación')}.</p>
 <div class="summary-row"><span>Retiradas registradas · total tienda</span><strong>${amount(origin.withdrawals)}</strong></div><p class="note">${(origin.expected_drawers??origin.drawers.length)>1?'El reparto de las retiradas entre Vape y Head no figura en el Excel. Se conserva el total de tienda, sin asignarlo a una caja ficticiamente.':'Importe de la caja de este establecimiento.'}</p></section>
 <section class="card card-pad"><h3>Tratamiento del histórico</h3><p>Este registro conserva el origen y no se suma a ingresos fiscales. La referencia mensual presentada se registra por separado para evitar duplicar ventas. La conciliación diaria sigue pendiente; no se crean gastos ni movimientos para forzar un cuadre.</p><p>${esc(row.notes||'')}</p></section></div>`;
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
 const total=Number(row?.gross_expense??row?.accounting_amount??row?.amount_paid??0);
 return `<div class="page record-page">
  <div class="record-toolbar"><div><button class="btn link" data-action="expense-back">← Volver a gastos</button><div class="eyebrow">Gastos · ${row?'Registro':'Nuevo'}</div><h2>${row?esc(row.supplier_name||'Gasto'):'Nuevo gasto'}</h2></div><div>${row?(row.management_only?'<span class="badge warn">Solo control interno</span>':'<span class="badge info">Fiscal</span>'):'<span class="badge info">Nuevo</span>'}</div></div>
  <div class="record-layout">
   <div class="record-main stack">
    <section class="card card-pad"><div class="section-head"><div><h3>1 · Documento y proveedor</h3><p>La tienda clasifica el gasto. La factura recibida debe identificar a ${esc(state.data.settings?.business_name||'tu nombre como autónomo')} con su NIF y domicilio fiscal comunes.</p></div></div>
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
      <div class="expense-attachment-picker"><label class="file-picker">${doc?'Sustituir factura adjunta':'Seleccionar factura o justificante'}<input id="exFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md"></label>
      <div id="exSelectedFile" class="small muted" aria-live="polite">No se ha seleccionado una factura nueva.</div>
      ${btn('Vista previa antes de guardar','expense-file-preview','secondary','id="exFilePreview" disabled')}</div>
     </div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>2 · Conceptos</h3><p>Una factura puede tener varias líneas fiscales.</p></div>${btn('+ Añadir línea','expense-line-add','secondary')}</div>
     <div id="expenseLines" class="stack" style="margin-top:14px">${lines.map((l,i)=>expenseLineRow(l,i,categories)).join('')}</div>
    </section>
    <section class="card card-pad"><div class="section-head"><div><h3>3 · Tratamiento general</h3><p>Control interno, pago y observaciones.</p></div></div>
     <div class="form-grid" style="margin-top:14px">
      <label class="check-field wide emphasis-check"><input id="exManagement" type="checkbox" ${row?.management_only?'checked':''}> Solo control interno · no enviar a gestoría ni incluir en cálculo fiscal</label>
      <label class="check-field wide"><input id="exFiscalReviewed" type="checkbox" ${row?.fiscal_reviewed===true?'checked':''}> He cotejado el documento, sus conceptos e impuestos; gasto fiscal revisado</label>
      <p class="small muted wide">Un gasto nuevo permanece sin revisar hasta que marques esta casilla. Los gastos internos nunca se incluirán en el cálculo fiscal.</p>
      ${formField('Tipo interno','exPersonnelKind',row?.personnel_kind||'')}
      ${selectField('Forma de pago','exPayment',[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'},{value:'bizum',label:'Bizum'},{value:'domiciliado',label:'Domiciliado'},{value:'otro',label:'Otro'}],row?.payment_method||'tarjeta')}
      ${selectField('Estado de pago','exPaidStatus',[{value:'pagado',label:'Pagado'},{value:'pendiente',label:'Pendiente'},{value:'parcial',label:'Parcial'}],row?.paid_status||'pagado')}
      ${formField('Fecha de pago','exPaidDate',row?.paid_date||(row?'':isoToday()),'date')}
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

