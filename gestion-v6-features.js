(function(){
'use strict';
const O=window.TotusGestion;
if(!O) return;
O.features=O.features||{loaded:false,customers:[],templates:[],legacyRows:[],historicalIncome:[],fiscalReference:[],gestorRows:[],gestorSummary:[],reconciliationNotes:[],auditRows:[],revisionRows:[],backupRows:[],storageUsage:{documents_count:0,documents_bytes:0,assets_count:0,assets_bytes:0,total_bytes:0},billingPanel:'documents',customerDraft:null,invoiceMode:'factura',templateId:null,invoiceStatus:'all'};
const E=O.features;
const {h:H,n:N,isoToday:today,sum,inRange,storeName,manager,adminOnly:admin,statusBadge,dlBlob,audit,selectAll,infoButton,openOpsModal,closeOpsModal,askReason}=O.core;
const all=(table,order=null,asc=true)=>selectAll(table,order,asc);
const qBounds=(y,q)=>{const sm=(q-1)*3+1,end=new Date(y,q*3,0);return{start:`${y}-${String(sm).padStart(2,'0')}-01`,end:`${y}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`}};
const yearQEnd=(y,q)=>qBounds(y,q).end;
const monthName=m=>['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][m-1];
const reportDate=v=>{const x=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(x)?x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(0,4):x};
const REFERENCE_SEMESTER_2026_BYTES=57360165;
const REFERENCE_SEMESTER_2026_FILES=301;
const REFERENCE_SEMESTER_2026_ARCHIVE_BYTES=43056409;
const euro=v=>eur(Number(v)||0);
async function featureLoad(force=false){
 if(E.loaded&&!force)return;
 const [customers,templates,legacy,hist,fiscalReference,gestor,summary,reconciliationNotes,auditRows,revisionRows,backupRows,storage]=await Promise.all([
   all('ops_customers','name',true),all('ops_document_templates','name',true),all('ops_legacy_daily_rows','row_date',true),
   all('ops_historical_income_periods','period_start',true),all('ops_fiscal_reference_periods','period_month',true),all('ops_gestor_natural_rows','expense_date',true),all('ops_gestor_quarter_summary','quarter',true),all('ops_reconciliation_notes','created_at',true),
   manager()?all('ops_audit_log','created_at',false):Promise.resolve([]),manager()?all('ops_entity_revisions','created_at',false):Promise.resolve([]),admin()?all('ops_backup_archives','created_at',false):Promise.resolve([]),
   sb.rpc('ops_storage_usage').then(r=>r.error?null:r.data).catch(()=>null)
 ]);
 E.customers=customers;E.templates=templates;E.legacyRows=legacy;E.historicalIncome=hist;E.fiscalReference=fiscalReference;E.gestorRows=gestor;E.gestorSummary=summary;E.reconciliationNotes=reconciliationNotes;E.auditRows=auditRows;E.revisionRows=revisionRows;E.backupRows=backupRows;
 E.storageUsage=storage||{documents_count:O.documents.length,documents_bytes:sum(O.documents,d=>N(d.size_bytes)),assets_count:templates.filter(t=>N(t.logo_size_bytes)>0).length,assets_bytes:sum(templates,t=>N(t.logo_size_bytes)),total_bytes:sum(O.documents,d=>N(d.size_bytes))+sum(templates,t=>N(t.logo_size_bytes))};
 E.loaded=true;
 if(!E.templateId)E.templateId=(templates.find(t=>t.default_invoice)||templates[0])?.id||null;
}
function historicalIncome(from,to,store='all'){
 return sum(E.historicalIncome.filter(x=>x.period_start>=from&&x.period_end<=to&&(store==='all'||x.store_id===store)),x=>N(x.fiscal_basis_income??x.total_income));
}
function operationalHistoricalIncome(from,to,store='all'){
 return sum(E.historicalIncome.filter(x=>x.period_start>=from&&x.period_end<=to&&(store==='all'||x.store_id===store)),x=>N(x.total_income));
}
function coveredByHistoricalIncome(closing){
 return E.historicalIncome.some(h=>h.store_id===closing.store_id&&closing.business_date>=h.period_start&&closing.business_date<=h.period_end);
}
function dailyIncome(from,to,store='all'){
 return sum(O.closings.filter(x=>x.include_in_income!==false&&inRange(x.business_date,from,to)&&(store==='all'||x.store_id===store)&&!coveredByHistoricalIncome(x)),x=>N(x.cash_sales)+N(x.card_sales)+N(x.bizum_sales)+N(x.online_sales)+N(x.other_income));
}
function invoicedExtra(from,to,store='all'){
 return sum(O.invoices.filter(x=>x.document_type!=='proforma'&&x.status==='emitida'&&x.include_in_income&&inRange(x.issue_date,from,to)&&(store==='all'||x.store_id===store)),x=>N(x.total_amount));
}
function incomeAdjust(from,to,store='all'){
 return sum(O.incomeAdjustments.filter(x=>inRange(x.income_date,from,to)&&(store==='all'||x.store_id===store)),x=>N(x.amount));
}
function incomeTotal(from,to,store='all'){return historicalIncome(from,to,store)+dailyIncome(from,to,store)+invoicedExtra(from,to,store)+incomeAdjust(from,to,store)}
function operationalIncomeTotal(from,to,store='all'){return operationalHistoricalIncome(from,to,store)+dailyIncome(from,to,store)+invoicedExtra(from,to,store)+incomeAdjust(from,to,store)}
function exactGestorExpense(from,to){
 return sum(E.gestorRows.filter(x=>x.fiscal_year===2026&&inRange(x.expense_date,from,to)),x=>N(x.imputable_irpf));
}
function currentExpense(from,to,store='all'){
 const lineMap=new Map();O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
 let t=0;
 O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store)).forEach(e=>{
   if(from.startsWith('2026')&&e.expense_date<'2026-07-01'){
     if(store==='all')return;
     if(e.source!=='importacion_gestor')return;
   }
   if(e.source==='importacion_excel'&&!e.fiscal_reviewed)return;
   const ls=lineMap.get(e.id)||[];
   if(ls.length)t+=sum(ls,l=>l.deductible_irpf===false||l.fixed_asset?0:N(l.irpf_imputable));
   else if(e.deductible_irpf!==false)t+=N(e.accounting_amount||e.gross_expense);
 });
 t+=sum(O.fiscalAdjustments.filter(a=>inRange(a.adjustment_date,from,to)&&['gasto_deducible_extra','amortizacion'].includes(a.kind)),a=>N(a.amount));
 return t;
}
function internalExpense(from,to,store='all'){
 return sum(O.expenses.filter(e=>e.management_only&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store)),e=>N(e.accounting_amount||e.gross_expense||e.amount_paid));
}
function realExpense(from,to,store='all'){
 if(store==='all')return deductibleExpenseTotal(from,to,'all')+internalExpense(from,to,'all');
 const legacyRows=E.legacyRows.filter(r=>r.store_id===store&&inRange(r.row_date,from,to));
 const legacy=sum(legacyRows,r=>N(r.expense_amount));
 const maxLegacy=E.legacyRows.filter(r=>r.store_id===store&&r.row_date).reduce((m,r)=>r.row_date>m?r.row_date:m,'');
 const newer=sum(O.expenses.filter(e=>e.store_id===store&&inRange(e.expense_date,from,to)&&(!maxLegacy||e.expense_date>maxLegacy)),e=>N(e.accounting_amount||e.gross_expense||e.amount_paid));
 return legacy+newer;
}
function deductibleExpenseTotal(from,to,store='all'){
 if(store!=='all')return currentExpense(from,to,store);
 return exactGestorExpense(from,to)+currentExpense(from,to,'all');
}
function difficult(pre){return !O.settings?.difficult_expense_enabled||pre<=0?0:Math.min(pre*(N(O.settings.difficult_expense_pct||5)/100),N(O.settings.difficult_expense_annual_cap||2000));}
function supportedTaxCosts(from,to){
 let vat=0,re=0;
 if(from<='2026-06-30'){
   const legacyTo=to<'2026-07-01'?to:'2026-06-30';
   if(legacyTo>=from){
     const rows=E.gestorRows.filter(x=>inRange(x.expense_date,from,legacyTo));
     vat+=sum(rows,x=>N(x.vat_amount));re+=sum(rows,x=>N(x.re_amount));
   }
 }
 if(to>='2026-07-01'){
   const modernFrom=from>'2026-07-01'?from:'2026-07-01';
   const ids=new Set(O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,modernFrom,to)).map(e=>e.id));
   vat+=sum(O.expenseLines.filter(l=>ids.has(l.expense_id)),l=>N(l.vat_amount));
   re+=sum(O.expenseLines.filter(l=>ids.has(l.expense_id)),l=>N(l.re_amount));
 }
 return{vat,re,total:vat+re};
}
function storeOperatingRows(from,to){
 return O.stores.filter(s=>s.active!==false).map(s=>{
   const income=operationalIncomeTotal(from,to,s.id);
   const verified=E.fiscalReference.filter(x=>x.store_id===s.id&&x.authoritative!==false&&x.expense_amount!=null&&x.period_month>=from.slice(0,7)+'-01'&&x.period_month<=to);
   const useVerified=to<='2026-06-30'&&verified.length>0;
   const expense=useVerified?sum(verified,x=>N(x.expense_amount)):realExpense(from,to,s.id);
   return{store:s,income,expense,result:income-expense,margin:income?((income-expense)/income*100):0,expenseSource:useVerified?'Informe final verificado':'Operativa registrada'};
 });
}
function supportedRetention(from,to){return sum(O.fiscalAdjustments.filter(a=>a.kind==='retencion_soportada'&&inRange(a.adjustment_date,from,to)),a=>N(a.amount));}
const taxSettledStatus=s=>['pagado','compensado'].includes(String(s||''));
function taxPaymentTotal(model,y,q){return sum(O.taxPayments.filter(t=>t.fiscal_year===y&&t.tax_type===model&&N(t.quarter)===q&&taxSettledStatus(t.status)),t=>N(t.amount))}
function retainedModel(model,from,to){
 const y=+from.slice(0,4);
 const paid=sum(O.taxPayments.filter(t=>t.fiscal_year===y&&t.tax_type===model&&taxSettledStatus(t.status)&&t.quarter&&qBounds(y,N(t.quarter)).start>=from&&qBounds(y,N(t.quarter)).end<=to),t=>N(t.amount));
 if(paid)return paid;
 if(y===2026){
   const rows=E.gestorRows.filter(x=>x.fiscal_year===2026&&inRange(x.expense_date,from,to));
   if(model==='115')return sum(rows.filter(x=>x.concept_code==='621'),x=>N(x.withholding_amount));
   if(model==='111')return Math.max(0,sum(rows,x=>N(x.withholding_amount))-sum(rows.filter(x=>x.concept_code==='621'),x=>N(x.withholding_amount)));
 }
 const ids=new Set(O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)).map(e=>e.id));
 return sum(O.expenseLines.filter(l=>ids.has(l.expense_id)&&l.withholding_model===model),l=>N(l.withholding_amount));
}
function fiscalProjection(y=O.year,q=O.quarter,planned=0){
 const from=`${y}-01-01`,end=yearQEnd(y,q),qb=qBounds(y,q);
 const income=incomeTotal(from,end,'all'),raw=deductibleExpenseTotal(from,end,'all')+N(planned),pre=income-raw,diff=difficult(Math.max(0,pre)),net=pre-diff,rate=N(O.settings?.irpf_prepayment_rate||20),gross=Math.max(0,net)*rate/100;
 const prev=sum(O.taxPayments.filter(t=>t.tax_type==='130'&&t.fiscal_year===y&&N(t.quarter)<q&&taxSettledStatus(t.status)),t=>N(t.amount)),ret=supportedRetention(from,end),payable=Math.max(0,gross-prev-ret);
 const settled130=taxPaymentTotal('130',y,q),m111=retainedModel('111',qb.start,qb.end),m115=retainedModel('115',qb.start,qb.end),settled111=taxPaymentTotal('111',y,q),settled115=taxPaymentTotal('115',y,q);
 const pending130=Math.max(0,payable-settled130),pending111=Math.max(0,m111-settled111),pending115=Math.max(0,m115-settled115);
 return{from,end,qb,income,raw,diff,net,gross,prev,ret,payable,settled130,pending130,m111,m115,settled111,settled115,pending111,pending115,reserve:pending130+pending111+pending115,qIncome:incomeTotal(qb.start,qb.end,'all'),qExpense:deductibleExpenseTotal(qb.start,qb.end,'all')};
}
window.__opsUpdateFiscalSimulation=function(){
 const actual=fiscalProjection(O.year,O.quarter,0),sim=fiscalProjection(O.year,O.quarter,N(O.plannedSpend));
 const a=document.getElementById('ops_sim_130'),b=document.getElementById('ops_sim_reserve'),d=document.getElementById('ops_sim_delta');
 if(a)a.textContent=euro(sim.pending130);
 if(b)b.textContent=euro(sim.reserve);
 if(d)d.textContent=euro(actual.pending130-sim.pending130);
};
window.__opsHomeFiscalSnapshot=function(){
 const f=fiscalProjection(O.year,O.quarter,0),b=qBounds(O.year,O.quarter);
 const stores=storeOperatingRows(b.start,b.end).map(x=>({id:x.store.id,name:x.store.name,income:x.income,expense:x.expense,result:x.result,expenseSource:x.expenseSource}));
 const operationalIncome=sum(stores,x=>x.income),operationalExpense=sum(stores,x=>x.expense);
 return {year:O.year,quarter:O.quarter,payable130:f.payable,model111:f.m111,model115:f.m115,reserve:f.reserve,
  fiscalIncome:f.qIncome,fiscalExpense:f.qExpense,fiscalResult:f.qIncome-f.qExpense,
  operationalIncome,operationalExpense,operationalResult:operationalIncome-operationalExpense,stores};
};
function retaProjection(){
 const cutoff=(O.year===new Date().getFullYear())?today():`${O.year}-12-31`,from=`${O.year}-01-01`;const net=Math.max(0,incomeTotal(from,cutoff)-deductibleExpenseTotal(from,cutoff,'all'));const days=Math.max(1,Math.round((new Date(cutoff)-new Date(from))/86400000)+1),annual=net/(days/365),monthly=annual/12*(1-N(O.settings?.reta_generic_deduction_pct||7)/100);const b=O.retaBrackets.find(x=>(x.min_net_monthly==null||monthly>N(x.min_net_monthly)||(x.min_inclusive&&monthly===N(x.min_net_monthly)))&&(x.max_net_monthly==null||monthly<N(x.max_net_monthly)||(x.max_inclusive&&monthly===N(x.max_net_monthly))));const rate=N(O.settings?.reta_total_rate||31.5)/100;return{monthly,annual,bracket:b,minQuota:b?N(b.min_base)*rate:0,maxQuota:b?N(b.max_base)*rate:0};
}
function spendingSignal(){
 const from=`${O.year}-01-01`,to=(O.year===new Date().getFullYear())?today():`${O.year}-12-31`;
 const income=operationalIncomeTotal(from,to,'all'),real=realExpense(from,to,'all'),result=income-real,targetPct=N(O.settings?.target_operating_margin_pct||15),target=income*targetPct/100,headroom=result-target;
 let state='balanced',title='Gasto equilibrado',text='El resultado está cerca del margen objetivo configurado.';
 if(headroom<0){state='tight';title='Conviene contener gasto';text='El resultado está por debajo del margen objetivo. Prioriza gasto necesario y evita adelantar compras no imprescindibles.'}
 else if(income>0&&headroom>income*.05){state='room';title='Hay margen para gasto necesario';text='Hay colchón sobre el margen objetivo. Si tienes compras reales, necesarias y deducibles pendientes, puedes simular adelantarlas antes del cierre.'}
 return{income,real,result,targetPct,target,headroom,state,title,text};
}
function importedStatusHtml(){
 const year=String(O.year);
 const inYear=x=>String(x.period_start||x.expense_date||'').startsWith(year);
 const confirmed=E.historicalIncome.filter(x=>inYear(x)&&x.verified_by_gestor).length,provisional=E.historicalIncome.filter(x=>inYear(x)&&!x.verified_by_gestor).length;
 const pendingExpenses=O.expenses.filter(x=>String(x.expense_date||'').startsWith(year)&&x.source==='importacion_excel'&&!x.fiscal_reviewed&&!x.management_only).length;
 const reconciliation=(E.reconciliationNotes||[]).filter(x=>x.active!==false&&x.fiscal_year===O.year).length;
 return `<div class="ops-note fiscal-source-note"><b>Estado de fuentes ${O.year}</b> · Ingresos: <span class="badge ok">${confirmed} periodos confirmados</span> <span class="badge warnb">${provisional} provisionales</span> · Gastos Excel pendientes de revisión fiscal: <b>${pendingExpenses}</b> · Conciliaciones documentadas: <b>${reconciliation}</b>. Los provisionales afectan al control real, no a la deducción fiscal.</div>`;
}
function dashboardHtml(){
 const b=qBounds(O.year,O.quarter),inc=operationalIncomeTotal(b.start,b.end,O.storeId),fiscalInc=incomeTotal(b.start,b.end,O.storeId),fiscalExp=deductibleExpenseTotal(b.start,b.end,O.storeId),internal=internalExpense(b.start,b.end,O.storeId),realExp=realExpense(b.start,b.end,O.storeId),f=fiscalProjection(),r=retaProjection();const assets=N(E.storageUsage?.assets_bytes);const used=N(E.storageUsage?.total_bytes),limit=N(O.settings?.storage_limit_bytes||1073741824),pct=limit?used/limit*100:0;
 return `${importedStatusHtml()}<div class="ops-kpis fiscal-summary-kpis" id="fiscal_resumen" style="margin-top:14px"><div class="ops-kpi"><small>Ingresos operativos T${O.quarter}</small><strong>${euro(inc)}</strong><div class="sub">${O.storeId==='all'?'Ambos establecimientos':H(storeName(O.storeId))}${Math.abs(inc-fiscalInc)>.01?' · Base fiscal '+euro(fiscalInc):''}</div></div><div class="ops-kpi"><small>Gastos reales T${O.quarter}</small><strong>${euro(realExp)}</strong><div class="sub">Incluye ${euro(internal)} de control interno</div></div><div class="ops-kpi ${inc-realExp>=0?'good':'bad'}"><small>Resultado real T${O.quarter}</small><strong>${euro(inc-realExp)}</strong><div class="sub">Ingresos menos todos los gastos registrados</div></div><div class="ops-kpi"><small>Gastos fiscales T${O.quarter}</small><strong>${euro(fiscalExp)}</strong><div class="sub">Base usada en fiscalidad</div></div><div class="ops-kpi warn"><small>Reserva fiscal</small><strong>${euro(f.reserve)}</strong><div class="sub">130 + 111 + 115</div></div><div class="ops-kpi"><small>RETA orientativo</small><strong>${r.bracket?euro(r.minQuota)+'–'+euro(r.maxQuota):'—'}</strong><div class="sub">Rend. mensual ${euro(r.monthly)}</div></div></div><div class="ops-grid"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trimestre</div><h3>Contador fiscal</h3></div><button class="ghost" onclick="opsTab('fiscal')">Abrir fiscalidad</button></div><div class="ops-metric-line"><span>Ingresos acumulados</span><b>${euro(f.income)}</b></div><div class="ops-metric-line"><span>Gastos deducibles + 5 %</span><b>${euro(f.raw+f.diff)}</b></div><div class="ops-metric-line"><span>130 pendiente estimado</span><b>${euro(f.pending130)}</b></div><div class="ops-metric-line"><span>Reserva total</span><b>${euro(f.reserve)}</b></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Servidor</div><h3>Archivo documental</h3></div><button class="ghost" onclick="opsTab('documentos')">Abrir</button></div><div class="ops-space-head"><b>${Math.round(used/1048576)} MB usados</b><span class="small">${pct.toFixed(1).replace('.',',')} %</span></div><div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div><div class="ops-metric-line"><span>Documentos</span><b>${N(E.storageUsage?.documents_count)} · ${(N(E.storageUsage?.documents_bytes)/1048576).toFixed(1).replace('.',',')} MB</b></div><div class="ops-metric-line"><span>Plantillas de factura</span><b>${E.templates.length}</b></div></div></div><div class="ops-grid"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trabajo diario</div><h3>Accesos rápidos</h3></div></div><div class="ops-actions"><button class="primary" onclick="opsTab('cajas')">Cerrar caja</button><button class="secondary" onclick="opsTab('gastos')">Registrar gasto</button>${manager()?`<button class="secondary" onclick="opsNewDocument('factura')">Nueva factura</button><button class="secondary" onclick="opsNewDocument('proforma')">Nueva proforma</button>`:''}<button class="secondary" onclick="opsTab('documentos')">Subir documento</button></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">2026</div><h3>Continuidad real</h3></div></div><div class="ops-metric-line"><span>Ingresos operativos históricos</span><b>${euro(sum(E.historicalIncome,x=>N(x.total_income)))}</b></div><div class="ops-metric-line"><span>Base fiscal verificada</span><b>${euro(sum(E.historicalIncome,x=>N(x.fiscal_basis_income??x.total_income)))}</b></div><div class="ops-metric-line"><span>Gastos gestoría Q1+Q2</span><b>${euro(sum(E.gestorSummary,x=>N(x.imputable_irpf)))}</b></div><div class="ops-metric-line"><span>Cierres chat importados</span><b>${O.closings.filter(x=>x.source==='importacion_excel').length}</b></div></div></div>`;
}
function newDocDraft(type='factura'){
 const mode=type,documentType=mode==='proforma'?'proforma':'factura',invoiceKind=mode==='rectificativa'?'rectifying':'invoice';
 const sid=O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'');
 const ser=O.series.find(s=>s.store_id===sid&&s.year===O.year&&s.active&&s.document_type===documentType&&(documentType!=='factura'||(s.series_kind||'invoice')===invoiceKind))
   ||O.series.find(s=>s.year===O.year&&s.active&&s.document_type===documentType&&(documentType!=='factura'||(s.series_kind||'invoice')===invoiceKind));
 const tpl=E.templates.find(t=>documentType==='proforma'?t.default_proforma:t.default_invoice)||E.templates[0];
 return {id:null,mode,documentType,invoiceKind,origin:'totus',seriesId:ser?.id||'',storeId:sid,date:today(),dueDate:'',operationDate:'',externalNumber:'',customerId:'',customer:'',taxId:'',address:'',email:'',concept:'',payment:'transferencia',paidStatus:'pendiente',paidDate:'',includeIncome:false,notes:'',terms:tpl?.payment_terms_default||'',footer:tpl?.footer_text||'',poRef:'',templateId:tpl?.id||'',sourceFile:null};
}
function invoiceDraftHasUserInput(){
 const d=O.invoiceDraft;if(!d||d.id)return false;
 if([d.customer,d.taxId,d.address,d.email,d.concept,d.externalNumber,d.poRef,d.notes].some(v=>String(v??'').trim()))return true;
 if(d.origin!=='totus'||d.paidStatus!=='pendiente'||d.includeIncome)return true;
 return (O.invoiceDraftLines||[]).some(l=>String(l.description??'').trim()||String(l.unit??'').trim()||String(l.discount??'0')!=='0'||String(l.qty??'1')!=='1');
}
function confirmDiscardInvoiceDraft(action='continuar'){
 return !invoiceDraftHasUserInput()||confirm('Hay datos sin guardar en el documento actual. ¿'+action+' y descartarlos?');
}
window.opsInvoiceStatus=function(v){E.invoiceStatus=v;render()};
window.opsBillingPanel=function(v){if(!manager()&&v!=='documents')return;E.billingPanel=v;if(v==='customers'&&!E.customerDraft)E.customerDraft=blankCustomerDraft();render()};
window.opsNewCustomerPanel=function(){if(!confirmDiscardCustomerDraft('Crear un cliente nuevo'))return;E.customerDraft=blankCustomerDraft();render()};
window.opsCustomerField=function(k,v){if(!E.customerDraft)E.customerDraft=blankCustomerDraft();E.customerDraft[k]=v};
window.opsEditCustomerPanel=function(id){const c=E.customers.find(x=>x.id===id);if(!c)return;if(!confirmDiscardCustomerDraft('Abrir otro cliente'))return;E.customerDraft={id:c.id,name:c.name||'',tax_id:c.tax_id||'',email:c.email||'',phone:c.phone||'',address:c.address||'',postal_code:c.postal_code||'',city:c.city||'',province:c.province||'',country:c.country||'España',default_payment_method:c.default_payment_method||'transferencia',notes:c.notes||'',active:c.active!==false};render()};
window.opsSaveCustomerPanel=async function(){
 if(!manager())return;
 const d=E.customerDraft||blankCustomerDraft();if(!String(d.name||'').trim())return alert('El nombre o razón social es obligatorio.');
 const tax=String(d.tax_id||'').trim();
 const duplicateTax=tax&&E.customers.find(x=>x.id!==d.id&&String(x.tax_id||'').trim().toLowerCase()===tax.toLowerCase());
 if(duplicateTax)return alert('Ya existe un cliente con ese NIF/CIF: '+duplicateTax.name+'. Abre su ficha en lugar de crear otra.');
 const row={name:String(d.name).trim(),tax_id:tax,email:String(d.email||'').trim(),phone:String(d.phone||'').trim(),address:String(d.address||'').trim(),postal_code:String(d.postal_code||'').trim(),city:String(d.city||'').trim(),province:String(d.province||'').trim(),country:String(d.country||'España').trim()||'España',default_payment_method:d.default_payment_method||'transferencia',notes:String(d.notes||'').trim(),active:d.active!==false,updated_at:new Date().toISOString()};
 const res=d.id?await sb.from('ops_customers').update(row).eq('id',d.id).select().single():await sb.from('ops_customers').insert(row).select().single();
 if(res.error)return alert('No se pudo guardar el cliente: '+res.error.message);
 await audit('facturas',d.id?'cliente_actualizar':'cliente_crear',res.data.id,{cliente:row.name});
 await featureLoad(true);E.customerDraft={id:res.data.id,...row};render();
};
window.opsToggleCustomerPanel=async function(id,active){
 if(!manager())return;
 const c=E.customers.find(x=>x.id===id);if(!c)return;
 if(!confirm((active?'Reactivar':'Archivar')+' a '+c.name+'?'))return;
 const {error}=await sb.from('ops_customers').update({active,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)return alert('No se pudo cambiar el estado: '+error.message);
 await audit('facturas',active?'cliente_reactivar':'cliente_archivar',id,{cliente:c.name});await featureLoad(true);render();
};
window.opsReportField=function(k,v){if(k==='from')O.reportFrom=v;else O.reportTo=v};
window.opsInvoiceView=function(type='factura'){E.billingPanel='documents';E.invoiceMode=type;O.invoiceDraft=null;render();};
window.opsNewDocument=function(type='factura'){if(!manager())return alert('Facturación en modo consulta. Solo administración o gerencia puede crear documentos.');if(!confirmDiscardInvoiceDraft(type===E.invoiceMode?'Crear un documento nuevo':'Cambiar de tipo de documento'))return;O.tab='facturas';E.billingPanel='documents';E.invoiceMode=type;O.invoiceDraft=newDocDraft(type);O.invoiceDraftLines=[{description:'',qty:'1',unit:'',discount:'0',vat:'21'}];render();};
function ensureDraft(){if(!O.invoiceDraft||!O.invoiceDraft.documentType){O.invoiceDraft=newDocDraft(E.invoiceMode);O.invoiceDraftLines=[{description:'',qty:'1',unit:'',discount:'0',vat:'21'}];}return O.invoiceDraft;}
function lineCalc(l){const q=N(l.qty),u=N(l.unit),d=N(l.discount),base=q*u*(1-d/100),vat=base*N(l.vat)/100;return{base,vat,total:base+vat}}
function draftTotals(){return O.invoiceDraftLines.reduce((a,l)=>{const x=lineCalc(l);a.base+=x.base;a.vat+=x.vat;a.total+=x.total;return a},{base:0,vat:0,total:0})}
function seriesFor(d){return O.series.filter(s=>s.year===O.year&&s.active&&s.document_type===d.documentType&&(d.documentType!=='factura'||(s.series_kind||'invoice')===(d.invoiceKind||'invoice'))&&(d.storeId?(!s.store_id||s.store_id===d.storeId):true))}
function documentLabel(t,kind='invoice'){return t==='proforma'?'Proforma':kind==='rectifying'?'Factura rectificativa':'Factura'}
function customerOptions(d){return `<option value="">Cliente manual</option>${E.customers.filter(c=>c.active!==false).map(c=>`<option value="${c.id}" ${d.customerId===c.id?'selected':''}>${H(c.name)}${c.tax_id?' · '+H(c.tax_id):''}</option>`).join('')}`}
function templateCards(d){return `<div class="invoice-template-row">${E.templates.filter(t=>t.active!==false).map(t=>`<button type="button" class="invoice-template-card ${d.templateId===t.id?'selected':''}" onclick="opsDocField('templateId','${t.id}',true)"><span class="template-swatch" style="background:${H(t.primary_color)}"><i style="background:${H(t.secondary_color)}"></i></span><b>${H(t.name)}</b><small>${H(t.style)}</small></button>`).join('')}</div>`}
function templateEditorHtml(tpl){
 if(!tpl?.id)return '<div class="ops-empty">No hay plantilla disponible.</div>';
 const disabled=manager()?'':'disabled';
 const live=()=>{
   const sample={documentType:'factura',invoiceKind:'invoice',templateId:tpl.id,customer:'Cliente de ejemplo',taxId:'B12345678',seriesId:O.series.find(s=>s.document_type==='factura'&&s.series_kind!=='rectifying')?.id||''};
   return miniPreview(sample,{total:1234.56});
 };
 return `<div class="template-studio">
   <div class="template-editor">
    <div class="template-group">
     <div class="template-group-head"><div><div class="eyebrow">Identidad</div><h4>Nombre y estilo</h4></div>${infoButton('facturas.template.style','Estilo de la plantilla')}</div>
     <div class="ops-form">
      <div class="span2"><label>Nombre plantilla</label><input id="ops_tpl_name" value="${H(tpl.name||'')}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
      <div><label>Estilo</label><select id="ops_tpl_style" onchange="opsTemplateLiveUpdate()" ${disabled}>${['clean','brand','compact'].map(x=>`<option value="${x}" ${tpl.style===x?'selected':''}>${x==='clean'?'Limpia':x==='brand'?'Corporativa':'Compacta'}</option>`).join('')}</select></div>
      <div><label>Fuente</label><select id="ops_tpl_font" onchange="opsTemplateLiveUpdate()" ${disabled}>${['helvetica','times','courier'].map(x=>`<option value="${x}" ${tpl.font_family===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div><label>Color principal</label><input id="ops_tpl_primary" type="color" value="${H(tpl.primary_color||'#17202A')}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
      <div><label>Color secundario</label><input id="ops_tpl_secondary" type="color" value="${H(tpl.secondary_color||'#3B82F6')}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
      <div><label>Color de texto</label><input id="ops_tpl_text" type="color" value="${H(tpl.text_color||'#17202A')}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
     </div>
    </div>

    <div class="template-group">
     <div class="template-group-head"><div><div class="eyebrow">Marca</div><h4>Logo corporativo</h4></div>${infoButton('facturas.template.logo','Uso del logo')}</div>
     <div class="ops-form">
      <div class="span2 template-logo-field"><label>Archivo del logo</label><input id="ops_tpl_logo" type="file" accept="image/png,image/jpeg,image/webp" ${disabled}><div class="small">${tpl.logo_name?`Actual: <b>${H(tpl.logo_name)}</b>`:'Sin logo cargado'} · PNG/JPG/WebP · máx. 2 MB</div></div>
      <div><label>Ancho logo (mm)</label><input id="ops_tpl_width" inputmode="decimal" value="${H(tpl.logo_width_mm||34)}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
      <div><label>Posición logo</label><select id="ops_tpl_logo_pos" onchange="opsTemplateLiveUpdate()" ${disabled}><option value="left" ${(tpl.logo_position||'left')==='left'?'selected':''}>Izquierda</option><option value="center" ${tpl.logo_position==='center'?'selected':''}>Centro</option><option value="right" ${tpl.logo_position==='right'?'selected':''}>Derecha</option></select></div>
      <div class="checkline"><input id="ops_tpl_show_logo" type="checkbox" ${tpl.show_logo!==false?'checked':''} onchange="opsTemplateLiveUpdate()" ${disabled}><label for="ops_tpl_show_logo">Mostrar logo</label></div>
     </div>
     <div class="ops-actions" style="margin-top:10px"><button class="secondary" type="button" onclick="opsUploadTemplateLogo('${tpl.id}')" ${disabled}>Subir / cambiar logo</button>${tpl.logo_path?`<button class="ghost" type="button" onclick="opsRemoveTemplateLogo('${tpl.id}')" ${disabled}>Quitar logo</button>`:''}</div>
    </div>

    <div class="template-group">
     <div class="template-group-head"><div><div class="eyebrow">Documento</div><h4>Títulos y textos</h4></div>${infoButton('facturas.template.copy','Textos de factura')}</div>
     <div class="ops-form">
      <div><label>Título factura</label><input id="ops_tpl_invoice_title" value="${H(tpl.invoice_title||'FACTURA')}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
      <div><label>Título proforma</label><input id="ops_tpl_proforma_title" value="${H(tpl.proforma_title||'FACTURA PROFORMA')}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
      <div class="span2"><label>Texto de cabecera</label><input id="ops_tpl_header" value="${H(tpl.header_text||'')}" oninput="opsTemplateLiveUpdate()" ${disabled}></div>
      <div class="span2"><label>Condiciones por defecto</label><textarea id="ops_tpl_terms" oninput="opsTemplateLiveUpdate()" ${disabled}>${H(tpl.payment_terms_default||'')}</textarea></div>
      <div class="span2"><label>Datos bancarios / pago</label><textarea id="ops_tpl_bank" oninput="opsTemplateLiveUpdate()" ${disabled}>${H(tpl.bank_details||'')}</textarea></div>
      <div class="span4"><label>Pie</label><textarea id="ops_tpl_footer" oninput="opsTemplateLiveUpdate()" ${disabled}>${H(tpl.footer_text||'')}</textarea></div>
      <div class="checkline"><input id="ops_tpl_show_pay" type="checkbox" ${tpl.show_payment_details!==false?'checked':''} onchange="opsTemplateLiveUpdate()" ${disabled}><label for="ops_tpl_show_pay">Mostrar datos de pago</label></div>
      <div class="checkline"><input id="ops_tpl_definv" type="checkbox" ${tpl.default_invoice?'checked':''} ${disabled}><label for="ops_tpl_definv">Predeterminada factura</label></div>
      <div class="checkline"><input id="ops_tpl_defpro" type="checkbox" ${tpl.default_proforma?'checked':''} ${disabled}><label for="ops_tpl_defpro">Predeterminada proforma</label></div>
     </div>
    </div>

    <div class="ops-actions template-editor-actions">
     <button class="primary" type="button" onclick="opsSaveTemplate('${tpl.id}')" ${disabled}>Guardar plantilla</button>
     <button class="secondary" type="button" onclick="opsPreviewTemplatePdf('${tpl.id}')">Vista previa PDF</button>
     <button class="ghost" type="button" onclick="opsDuplicateTemplate('${tpl.id}')" ${disabled}>Duplicar plantilla</button>
    </div>
   </div>
   <aside class="template-live-panel">
    <div class="eyebrow">Vista previa</div><h4>Así se verá la factura</h4>
    <div id="ops_tpl_live_preview" class="invoice-mini-preview">${live()}</div>
    <div class="ops-note" style="margin-top:10px">La vista rápida sirve para composición. El botón <b>Vista previa PDF</b> abre el documento real dentro de Totus antes de descargar nada.</div>
   </aside>
  </div>`;
}
function billingNavHtml(){
 const item=(key,label,active)=>`<button type="button" class="${active?'active':''}" onclick="opsBillingPanel('${key}')">${label}</button>`;
 return `<div class="billing-nav">${item('documents','Documentos',E.billingPanel==='documents')}${manager()?item('customers','Clientes',E.billingPanel==='customers'):''}${manager()?item('templates','Plantillas y marca',E.billingPanel==='templates'):''}${manager()?item('series','Series',E.billingPanel==='series'):''}</div>`;
}
function blankCustomerDraft(){return{id:null,name:'',tax_id:'',email:'',phone:'',address:'',postal_code:'',city:'',province:'',country:'España',default_payment_method:'transferencia',notes:'',active:true}}
function customerDraftHasUserInput(){
 const d=E.customerDraft;if(!d||d.id)return false;
 return [d.name,d.tax_id,d.email,d.phone,d.address,d.postal_code,d.city,d.province,d.notes].some(v=>String(v??'').trim())||d.default_payment_method!=='transferencia';
}
function confirmDiscardCustomerDraft(action='continuar'){return !customerDraftHasUserInput()||confirm('Hay datos sin guardar en la ficha de cliente. ¿'+action+' y descartarlos?')}
function billingCustomersHtml(){
 const d=E.customerDraft||blankCustomerDraft(),rows=E.customers.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="ops-grid">
  <div class="ops-card">
   <div class="section-head"><div><div class="eyebrow">${d.id?'Editar cliente':'Nuevo cliente'}</div><div class="ops-title-line"><h3>Ficha de cliente</h3>${infoButton('facturas.clientes','Qué guarda la ficha de cliente')}</div><div class="small">Una ficha completa para no volver a escribir datos fiscales, contacto, dirección ni forma de pago en cada factura.</div></div><button class="ghost" onclick="opsNewCustomerPanel()">Nuevo</button></div>
   <div class="invoice-section-title">1 · Identificación</div>
   <div class="ops-form">
    <div class="span2"><label>Nombre / razón social</label><input value="${H(d.name||'')}" oninput="opsCustomerField('name',this.value)"></div>
    <div><label>NIF/CIF</label><input value="${H(d.tax_id||'')}" oninput="opsCustomerField('tax_id',this.value)"></div>
    <div><label>Email</label><input type="email" value="${H(d.email||'')}" oninput="opsCustomerField('email',this.value)"></div>
    <div><label>Teléfono</label><input value="${H(d.phone||'')}" oninput="opsCustomerField('phone',this.value)"></div>
   </div>
   <div class="invoice-section-title">2 · Dirección fiscal / postal</div>
   <div class="ops-form">
    <div class="span2"><label>Dirección</label><input value="${H(d.address||'')}" oninput="opsCustomerField('address',this.value)"></div>
    <div><label>Código postal</label><input value="${H(d.postal_code||'')}" oninput="opsCustomerField('postal_code',this.value)"></div>
    <div><label>Ciudad</label><input value="${H(d.city||'')}" oninput="opsCustomerField('city',this.value)"></div>
    <div><label>Provincia</label><input value="${H(d.province||'')}" oninput="opsCustomerField('province',this.value)"></div>
    <div><label>País</label><input value="${H(d.country||'España')}" oninput="opsCustomerField('country',this.value)"></div>
   </div>
   <div class="invoice-section-title">3 · Preferencias</div>
   <div class="ops-form">
    <div><label>Forma de pago por defecto</label><select aria-label="Forma de pago por defecto del cliente" onchange="opsCustomerField('default_payment_method',this.value)">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${d.default_payment_method===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="span3"><label>Notas internas</label><textarea oninput="opsCustomerField('notes',this.value)">${H(d.notes||'')}</textarea></div>
   </div>
   <div class="ops-actions" style="margin-top:12px"><button class="primary" onclick="opsSaveCustomerPanel()">${d.id?'Guardar cliente':'Crear cliente'}</button></div>
  </div>
  <div class="ops-card">
   <div class="section-head"><div><div class="eyebrow">Directorio</div><h3>Clientes guardados</h3><div class="small">${rows.filter(x=>x.active!==false).length} activos · ${rows.filter(x=>x.active===false).length} archivados</div></div></div>
   ${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Cliente</th><th>NIF/CIF</th><th>Contacto</th><th>Localidad</th><th>Pago</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td><b>${H(c.name)}</b></td><td>${H(c.tax_id||'—')}</td><td>${H(c.email||c.phone||'—')}</td><td>${H([c.postal_code,c.city,c.province].filter(Boolean).join(' · ')||'—')}</td><td>${H(c.default_payment_method||'transferencia')}</td><td>${c.active!==false?'<span class="badge ok">Activo</span>':'<span class="badge warnb">Archivado</span>'}</td><td><div class="ops-actions"><button class="ghost" onclick="opsEditCustomerPanel('${c.id}')">Editar</button><button class="ghost" onclick="opsToggleCustomerPanel('${c.id}',${c.active===false?'true':'false'})">${c.active===false?'Reactivar':'Archivar'}</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay clientes guardados.</div>'}
  </div>
 </div></div>`;
}
function billingTemplatesHtml(){
 const tpl=E.templates.find(t=>t.id===E.templateId)||E.templates.find(t=>t.default_invoice)||E.templates[0]||{};
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Diseño documental</div><div class="ops-title-line"><h3>Plantillas y marca</h3>${infoButton('facturas','Cómo funcionan las plantillas')}</div><div class="small">Toda la identidad de facturas y proformas está reunida aquí: logo, colores, tipografía, títulos, condiciones, datos de pago y pie.</div></div></div><div class="invoice-template-row">${E.templates.map(t=>`<button class="invoice-template-card ${tpl.id===t.id?'selected':''}" onclick="opsSelectTemplateConfig('${t.id}')"><span class="template-swatch" style="background:${H(t.primary_color)}"><i style="background:${H(t.secondary_color)}"></i></span><b>${H(t.name)}</b><small>${t.default_invoice?'Factura predeterminada':''}${t.default_proforma?' · Proforma predeterminada':''}</small></button>`).join('')}</div>${templateEditorHtml(tpl)}</div></div>`;
}
function billingSeriesHtml(){
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Numeración</div><div class="ops-title-line"><h3>Series ${O.year}</h3>${infoButton('facturas.series','Cómo funciona la numeración')}</div><div class="small">Una serie por tienda, año y tipo de documento. El siguiente número nunca puede retroceder.</div></div></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Tipo</th><th>Tienda</th><th>Código</th><th>Prefijo</th><th>Siguiente</th><th>Dígitos</th><th></th></tr></thead><tbody>${O.series.filter(x=>x.year===O.year).map(x=>`<tr><td>${H(x.document_type||'factura')}${x.series_kind==='rectifying'?' · rectificativa':''}</td><td>${H(storeName(x.store_id))}</td><td><b>${H(x.code)}</b></td><td><input aria-label="Prefijo de ${H(x.code)}" id="ser_p_${x.id}" value="${H(x.prefix)}" ${admin()?'':'disabled'}></td><td><input aria-label="Siguiente número de ${H(x.code)}" id="ser_n_${x.id}" inputmode="numeric" value="${x.next_number}" ${admin()?'':'disabled'}></td><td><input aria-label="Dígitos de ${H(x.code)}" id="ser_d_${x.id}" inputmode="numeric" value="${x.padding}" ${admin()?'':'disabled'}></td><td><button class="ghost" onclick="opsSaveSeries('${x.id}')" ${admin()?'':'disabled'}>Guardar</button></td></tr>`).join('')}</tbody></table></div><div class="ops-note warn" style="margin-top:10px">Las series ya usadas no deben renombrarse sin un motivo administrativo claro.</div></div></div>`;
}
function invoiceRowActions(row,{readOnly=false}={}){
 const preview=`<button class="ghost" type="button" onclick="opsPreviewInvoice('${row.id}')">Vista previa</button>`;
 const original=row.source_document_id?`<button class="ghost" type="button" onclick="opsPreviewDoc('${row.source_document_id}')">Original</button>`:'';
 if(readOnly)return `<div class="ops-actions invoice-row-actions">${preview}${original}</div>`;
 const draft=row.status==='borrador';
 const immediate=draft
   ?`<button class="ghost" type="button" onclick="opsEditDocument('${row.id}')">Editar</button><button class="primary" type="button" onclick="opsFinalizeDocument('${row.id}')">Emitir</button>`
   :row.document_type==='factura'&&row.status==='emitida'&&row.paid_status!=='pagada'
      ?`<button class="primary" type="button" onclick="opsMarkInvoicePaid('${row.id}')">Cobrar</button>`
      :'';
 const more=[
   `<button class="ghost" type="button" onclick="opsDuplicateInvoice('${row.id}')">Duplicar</button>`,
   row.document_type==='factura'&&row.status==='emitida'&&row.invoice_kind!=='rectifying'?`<button class="ghost" type="button" onclick="opsCreateRectifying('${row.id}')">Crear rectificativa</button>`:'',
   row.document_type==='proforma'&&row.status==='emitida'?`<button class="ghost" type="button" onclick="opsSetProformaStatus('${row.id}','aceptada')">Aceptar proforma</button><button class="ghost" type="button" onclick="opsSetProformaStatus('${row.id}','rechazada')">Rechazar proforma</button>`:'',
   row.document_type==='proforma'&&['emitida','aceptada'].includes(row.status)&&!row.converted_invoice_id?`<button class="primary" type="button" onclick="opsConvertProforma('${row.id}')">Convertir a factura</button>`:''
 ].filter(Boolean).join('');
 const state=row.document_type==='factura'&&row.paid_status==='pagada'?'<span class="ops-pill">Cobrada ✓</span>':row.converted_invoice_id?'<span class="ops-pill">Convertida</span>':'';
 return `<div class="ops-actions invoice-row-actions">${preview}${original}${immediate}${state}${more?`<details class="ops-row-menu"><summary>Más</summary><div class="ops-row-menu-panel">${more}</div></details>`:''}</div>`;
}
function invoicesHtml(){
 if(E.billingPanel==='customers')return billingCustomersHtml();
 if(E.billingPanel==='templates')return billingTemplatesHtml();
 if(E.billingPanel==='series')return billingSeriesHtml();
 const d=ensureDraft(),tot=draftTotals(),sers=seriesFor(d);const rows=O.invoices.filter(x=>{const mode=x.document_type==='proforma'?'proforma':(x.invoice_kind==='rectifying'?'rectificativa':'factura');return mode===E.invoiceMode&&x.issue_date?.startsWith(String(O.year))&&(O.storeId==='all'||x.store_id===O.storeId)&&(E.invoiceStatus==='all'||x.status===E.invoiceStatus)}).slice(0,200);
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="invoice-toolbar"><div class="invoice-type-switch"><button class="${E.invoiceMode==='factura'?'active':''}" onclick="opsNewDocument('factura')">Facturas</button><button class="${E.invoiceMode==='rectificativa'?'active':''}" onclick="opsNewDocument('rectificativa')">Rectificativas</button><button class="${E.invoiceMode==='proforma'?'active':''}" onclick="opsNewDocument('proforma')">Proformas</button></div><div class="ops-actions invoice-work-actions"><button class="ghost" onclick="opsNewDocument('${E.invoiceMode}')">Nuevo</button><button class="secondary" onclick="opsPreviewDraft()">Vista previa</button>${d.origin==='externa'?'<button class="primary" onclick="opsSaveDocument()">Registrar externa</button>':'<button class="secondary" onclick="opsSaveDocument()">Guardar borrador</button><button class="primary" onclick="opsSaveAndFinalizeDocument()">Guardar y emitir</button>'}</div></div><div class="ops-grid invoice-grid"><div class="ops-card invoice-editor"><div class="section-head invoice-editor-head"><div><div class="eyebrow">${d.id?'Editar':'Nuevo'} ${documentLabel(d.documentType,d.invoiceKind).toLowerCase()}</div><h3>${documentLabel(d.documentType,d.invoiceKind)}</h3><div class="small">Documento, cliente, conceptos y cobro en un único flujo.</div></div><div class="invoice-editor-state"><span class="ops-status-chip ${d.origin==='externa'?'internal':'fiscal'}">${d.origin==='externa'?'Externa':'Totus'}</span><span class="ops-pill">${d.id?'Borrador guardado':'Sin guardar'}</span></div></div><div class="invoice-section-title">1 · Documento y cliente ${infoButton('facturas.external','Ayuda sobre origen y datos del documento')}</div><div class="ops-form"><div><label>Origen</label><select aria-label="Origen del documento" onchange="opsDocField('origin',this.value,true)"><option value="totus" ${d.origin==='totus'?'selected':''}>Crear en Totus</option><option value="externa" ${d.origin==='externa'?'selected':''}>Creada fuera</option></select></div><div><label>Fecha</label><input aria-label="Fecha del documento" type="date" max="${today()}" value="${H(d.date)}" oninput="opsDocField('date',this.value)"></div><div><label>Vencimiento</label><input type="date" value="${H(d.dueDate||'')}" oninput="opsDocField('dueDate',this.value)"></div><div><label>Fecha operación</label><input aria-label="Fecha de operación" type="date" max="${today()}" value="${H(d.operationDate||'')}" oninput="opsDocField('operationDate',this.value)"></div><div><label>Establecimiento</label><select aria-label="Establecimiento del documento" onchange="opsDocField('storeId',this.value,true)"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div><div><label>Serie</label><select aria-label="Serie de numeración" onchange="opsDocField('seriesId',this.value)">${sers.map(s=>`<option value="${s.id}" ${d.seriesId===s.id?'selected':''}>${H(s.code)} · ${H(s.prefix)}${String(s.next_number).padStart(s.padding,'0')}</option>`).join('')}</select></div>${d.origin==='externa'?`<div><label>Nº usado fuera</label><input inputmode="numeric" value="${H(d.externalNumber||'')}" oninput="opsDocField('externalNumber',this.value)"></div><div><label>Documento original</label><input id="ops_external_doc_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"><button type="button" class="ghost file-preview-btn" onclick="opsPreviewSelectedFile('ops_external_doc_file')">Vista previa seleccionada</button></div>`:''}<div class="span2"><label>Cliente guardado</label><select aria-label="Cliente guardado" onchange="opsSelectCustomer(this.value)">${customerOptions(d)}</select></div><div class="span2"><label>Cliente / razón social</label><input value="${H(d.customer)}" oninput="opsDocField('customer',this.value)"></div><div><label>NIF/CIF</label><input value="${H(d.taxId)}" oninput="opsDocField('taxId',this.value)"></div><div><label>Email</label><input type="email" value="${H(d.email)}" oninput="opsDocField('email',this.value)"></div><div class="span2"><label>Dirección</label><input value="${H(d.address)}" oninput="opsDocField('address',this.value)"></div><div><label>Referencia / pedido</label><input value="${H(d.poRef||'')}" oninput="opsDocField('poRef',this.value)"></div><div class="invoice-save-customer-wrap"><button class="secondary" onclick="opsSaveCustomerFromDraft()" type="button">Guardar / actualizar cliente</button></div></div><div class="invoice-section-title">2 · Conceptos</div>${d.invoiceKind==='rectifying'?'<div class="ops-note warn" style="margin-bottom:10px">En una rectificativa puedes usar importes negativos para devoluciones o correcciones. La serie rectificativa mantiene su numeración independiente.</div>':''}<div class="ops-lines invoice-lines">${O.invoiceDraftLines.map((l,i)=>`<div class="ops-line"><div><label>Descripción</label><input value="${H(l.description)}" oninput="opsDocLine(${i},'description',this.value)"></div><div><label>Cant.</label><input inputmode="decimal" value="${H(l.qty)}" oninput="opsDocLine(${i},'qty',this.value,true)"></div><div><label>Precio base</label><input inputmode="decimal" value="${H(l.unit)}" oninput="opsDocLine(${i},'unit',this.value,true)"></div><div><label>Dto %</label><input inputmode="decimal" value="${H(l.discount)}" oninput="opsDocLine(${i},'discount',this.value,true)"></div><div><label>IVA %</label><input inputmode="decimal" value="${H(l.vat)}" oninput="opsDocLine(${i},'vat',this.value,true)"></div><div class="invoice-line-actions"><button class="ghost" type="button" aria-label="Subir línea ${i+1}" onclick="opsMoveDocLine(${i},-1)" ${i===0?'disabled':''}>↑</button><button class="ghost" type="button" aria-label="Bajar línea ${i+1}" onclick="opsMoveDocLine(${i},1)" ${i===O.invoiceDraftLines.length-1?'disabled':''}>↓</button><button class="ghost" type="button" aria-label="Duplicar línea ${i+1}" onclick="opsDuplicateDocLine(${i})">⧉</button><button class="ghost" type="button" aria-label="Eliminar línea ${i+1}" onclick="opsRemoveDocLine(${i})" ${O.invoiceDraftLines.length===1?'disabled':''}>×</button></div><div class="small" id="ops_doc_line_summary_${i}" style="grid-column:1/-1">Base ${euro(lineCalc(l).base)} · IVA ${euro(lineCalc(l).vat)} · Total ${euro(lineCalc(l).total)}</div></div>`).join('')}</div><div class="ops-actions" style="margin-top:8px"><button class="secondary" onclick="opsAddDocLine()">+ Añadir línea</button></div><div class="ops-invoice-total"><span>Base <b id="ops_doc_total_base">${euro(tot.base)}</b></span><span>IVA <b id="ops_doc_total_vat">${euro(tot.vat)}</b></span><span>Total <b id="ops_doc_total_total">${euro(tot.total)}</b></span></div><div class="invoice-section-title">3 · Pago y notas ${infoButton('facturas.includeIncome','Ayuda sobre ingresos y cobro')}</div><div class="ops-form"><div><label>${d.documentType==='proforma'?'Forma de pago prevista':'Forma de pago'}</label><select aria-label="Forma de pago" onchange="opsDocField('payment',this.value)">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div>${d.documentType==='proforma'?'':`<div><label>Estado cobro</label><select aria-label="Estado de cobro" onchange="opsDocField('paidStatus',this.value)">${['pendiente','pagada','parcial'].map(x=>`<option ${d.paidStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Fecha cobro</label><input aria-label="Fecha de cobro" type="date" max="${today()}" value="${H(d.paidDate||'')}" oninput="opsDocField('paidDate',this.value)" ${d.paidStatus==='pendiente'?'disabled':''}></div><div class="checkline"><input id="ops_doc_income" type="checkbox" ${d.includeIncome?'checked':''} onchange="opsDocField('includeIncome',this.checked)"><label for="ops_doc_income">Sumar a ingresos si NO está en cierres</label></div>`}<div class="span2"><label>Condiciones / vencimiento</label><textarea oninput="opsDocField('terms',this.value)">${H(d.terms||'')}</textarea></div><div class="span2"><label>Notas / pie específico</label><textarea oninput="opsDocField('footer',this.value)">${H(d.footer||'')}</textarea></div><div class="span4"><label>Notas internas · no aparecen en el PDF</label><textarea aria-label="Notas internas del documento" placeholder="Opcional" oninput="opsDocField('notes',this.value)">${H(d.notes||'')}</textarea></div></div></div><aside class="ops-card invoice-design-panel"><div class="eyebrow">Diseño</div><div class="ops-title-line"><h3>Plantilla aplicada</h3>${infoButton('facturas','Ayuda sobre plantillas')}</div>${templateCards(d)}<div class="invoice-mini-preview" id="ops_invoice_live_preview">${miniPreview(d,tot)}</div>${manager()?`<button type="button" class="secondary" style="width:100%;margin-top:12px" onclick="opsBillingPanel('templates')">Gestionar plantillas y logo</button>`:''}<div class="ops-note" style="margin-top:12px">Al emitir, el diseño queda congelado para que cambios posteriores no alteren documentos antiguos.</div></aside></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">${O.year}</div><h3>${E.invoiceMode==='proforma'?'Proformas':E.invoiceMode==='rectificativa'?'Facturas rectificativas':'Facturas'}</h3></div><div class="ops-actions"><select aria-label="Filtrar por estado" onchange="opsInvoiceStatus(this.value)"><option value="all">Todos los estados</option>${['borrador','emitida','aceptada','rechazada','convertida','anulada'].map(x=>`<option value="${x}" ${E.invoiceStatus===x?'selected':''}>${x}</option>`).join('')}</select><button class="primary" onclick="opsNewDocument('${E.invoiceMode}')">+ Nuevo</button></div></div>${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Estado</th><th>Cobro</th><th>Total</th><th>Serie</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.issue_date?.split('-').reverse().join('/')||'—'}</td><td><b>${H(row.display_number||'Borrador')}</b>${row.origin==='externa'?'<div class="ops-tiny">Externa</div>':''}</td><td>${H(row.customer_name||'—')}</td><td>${statusBadge(row.status)}</td><td>${row.document_type==='factura'?statusBadge(row.paid_status||'pendiente'):'—'}</td><td class="num">${euro(row.total_amount)}</td><td>${H(O.series.find(s=>s.id===row.series_id)?.code||'')}</td><td>${invoiceRowActions(row)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos en esta vista.</div>'}</div></div>`;
}
function invoicesReadOnlyHtml(){
 const rows=O.invoices.filter(x=>{const mode=x.document_type==='proforma'?'proforma':(x.invoice_kind==='rectifying'?'rectificativa':'factura');return mode===E.invoiceMode&&x.issue_date?.startsWith(String(O.year))&&(O.storeId==='all'||x.store_id===O.storeId)&&(E.invoiceStatus==='all'||x.status===E.invoiceStatus)}).slice(0,200);
 return `<div class="invoice-workspace"><div class="invoice-toolbar"><div class="invoice-type-switch"><button class="${E.invoiceMode==='factura'?'active':''}" onclick="opsInvoiceView('factura')">Facturas</button><button class="${E.invoiceMode==='rectificativa'?'active':''}" onclick="opsInvoiceView('rectificativa')">Rectificativas</button><button class="${E.invoiceMode==='proforma'?'active':''}" onclick="opsInvoiceView('proforma')">Proformas</button></div></div><div class="ops-note warn">Modo consulta: el encargado puede revisar facturas, rectificativas y proformas, pero solo administración o gerencia puede crear, editar, emitir, cobrar, rectificar o convertir documentos.</div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">${O.year}</div><h3>${E.invoiceMode==='proforma'?'Proformas':E.invoiceMode==='rectificativa'?'Facturas rectificativas':'Facturas'}</h3></div><select aria-label="Filtrar por estado" onchange="opsInvoiceStatus(this.value)"><option value="all">Todos los estados</option>${['borrador','emitida','aceptada','rechazada','convertida','anulada'].map(x=>`<option value="${x}" ${E.invoiceStatus===x?'selected':''}>${x}</option>`).join('')}</select></div>${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Estado</th><th>Cobro</th><th>Total</th><th>Serie</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.issue_date?.split('-').reverse().join('/')||'—'}</td><td><b>${H(row.display_number||'Borrador')}</b>${row.origin==='externa'?'<div class="ops-tiny">Externa</div>':''}</td><td>${H(row.customer_name||'—')}</td><td>${statusBadge(row.status)}</td><td>${row.document_type==='factura'?statusBadge(row.paid_status||'pendiente'):'—'}</td><td class="num">${euro(row.total_amount)}</td><td>${H(O.series.find(s=>s.id===row.series_id)?.code||'')}</td><td>${invoiceRowActions(row,{readOnly:true})}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos en esta vista.</div>'}</div></div>`;
}
function templateMiniPreview(tpl,d,t){
 const style=tpl.style||'clean',logoText=tpl.show_logo===false?'':(tpl.logo_path?'LOGO':'TU LOGO'),title=d.documentType==='proforma'?(tpl.proforma_title||'FACTURA PROFORMA'):(tpl.invoice_title||documentLabel(d.documentType).toUpperCase());
 return `<div class="mini-doc-style ${H(style)}" style="--tpl-primary:${H(tpl.primary_color||'#17202A')};--tpl-secondary:${H(tpl.secondary_color||'#3B82F6')};--tpl-text:${H(tpl.text_color||'#17202A')}"><div class="mini-head" style="border-color:${H(tpl.secondary_color||'#3B82F6')}"><div class="mini-logo ${logoText?'':'empty'}">${H(logoText||'SIN LOGO')}</div><div><b>${H(title)}</b><small>${H(O.series.find(s=>s.id===d.seriesId)?.prefix||'SERIE-')}####</small></div></div>${tpl.header_text?`<div class="mini-header-copy">${H(tpl.header_text)}</div>`:''}<div class="mini-client"><b>${H(d.customer||'Cliente')}</b><small>${H(d.taxId||'NIF/CIF')}</small></div><div class="mini-line"></div><div class="mini-line short"></div><div class="mini-total" style="color:${H(tpl.primary_color||'#17202A')}">Total ${euro(t.total)}</div>${tpl.footer_text?`<div class="mini-footer-copy">${H(tpl.footer_text)}</div>`:''}</div>`;
}
function miniPreview(d,t){const tpl=E.templates.find(x=>x.id===d.templateId)||{};return templateMiniPreview(tpl,d,t)}
window.opsDocField=function(k,v,rer=false){const d=ensureDraft();d[k]=v;
 if(k==='customer')d.customerId='';
 if(k==='storeId'&&rer){const s=seriesFor(d).find(x=>x.store_id===v)||seriesFor(d)[0];d.seriesId=s?.id||''}
 if(k==='paidStatus'){if(v==='pendiente')d.paidDate='';else if(!d.paidDate)d.paidDate=today();rer=true}
 if(rer)render();else updateInvoiceDraftSummary()};
function updateInvoiceDraftSummary(){
 const d=ensureDraft(),tot=draftTotals();
 O.invoiceDraftLines.forEach((l,i)=>{
  const el=document.getElementById('ops_doc_line_summary_'+i),x=lineCalc(l);
  if(el)el.textContent='Base '+euro(x.base)+' · IVA '+euro(x.vat)+' · Total '+euro(x.total);
 });
 const b=document.getElementById('ops_doc_total_base'),v=document.getElementById('ops_doc_total_vat'),t=document.getElementById('ops_doc_total_total');
 if(b)b.textContent=euro(tot.base);if(v)v.textContent=euro(tot.vat);if(t)t.textContent=euro(tot.total);
 const prev=document.getElementById('ops_invoice_live_preview');if(prev)prev.innerHTML=miniPreview(d,tot);
}
window.opsDocLine=function(i,k,v,re=false){O.invoiceDraftLines[i][k]=v;if(re)updateInvoiceDraftSummary()};
window.opsAddDocLine=()=>{O.invoiceDraftLines.push({description:'',qty:'1',unit:'',discount:'0',vat:'21'});render()};
window.opsDuplicateDocLine=i=>{const src=O.invoiceDraftLines[i];if(!src)return;O.invoiceDraftLines.splice(i+1,0,{...src});render()};
window.opsMoveDocLine=(i,dir)=>{const j=i+dir;if(i<0||j<0||i>=O.invoiceDraftLines.length||j>=O.invoiceDraftLines.length)return;const a=O.invoiceDraftLines[i];O.invoiceDraftLines[i]=O.invoiceDraftLines[j];O.invoiceDraftLines[j]=a;render()};
window.opsRemoveDocLine=i=>{if(O.invoiceDraftLines.length>1){O.invoiceDraftLines.splice(i,1);render()}};
window.opsSelectCustomer=function(id){const d=ensureDraft();d.customerId=id;const c=E.customers.find(x=>x.id===id);if(c){d.customer=c.name;d.taxId=c.tax_id||'';d.email=c.email||'';d.address=[c.address,c.postal_code,c.city,c.province,c.country].filter(Boolean).join(', ');d.payment=c.default_payment_method||'transferencia'}render()};
window.opsSaveCustomerFromDraft=async function(){if(!manager())return alert('Facturación en modo consulta.');const d=ensureDraft();if(!d.customer.trim())return alert('Indica el nombre del cliente.');const tax=d.taxId.trim(),duplicateTax=tax&&E.customers.find(x=>x.id!==d.customerId&&String(x.tax_id||'').trim().toLowerCase()===tax.toLowerCase());if(duplicateTax)return alert('Ya existe un cliente con ese NIF/CIF: '+duplicateTax.name+'. Selecciónalo desde "Cliente guardado".');let row={name:d.customer.trim(),tax_id:tax,email:d.email.trim(),address:d.address.trim(),default_payment_method:d.payment,active:true,updated_at:new Date().toISOString()};let res;if(d.customerId)res=await sb.from('ops_customers').update(row).eq('id',d.customerId).select().single();else res=await sb.from('ops_customers').insert(row).select().single();if(res.error)return alert(res.error.message);await featureLoad(true);d.customerId=res.data.id;render()};
async function persistDocumentDraft({keepOpen=true}={}){if(!manager())return alert('Facturación en modo consulta.');
 const d=ensureDraft();
 if(!d.seriesId||!d.date||!d.customer.trim())return alert('Serie, fecha y cliente son obligatorios.');
 if(d.date>today())return alert('La fecha del documento no puede estar en el futuro.');
 if(d.operationDate&&d.operationDate>today())return alert('La fecha de operación no puede estar en el futuro.');
 if(d.dueDate&&d.dueDate<d.date)return alert('El vencimiento no puede ser anterior a la fecha del documento.');
 if(d.paidDate&&d.paidDate<d.date)return alert('La fecha de cobro no puede ser anterior a la fecha del documento.');
 if(d.paidDate&&d.paidDate>today())return alert('La fecha de cobro no puede estar en el futuro.');
 if(d.paidStatus!=='pendiente'&&!d.paidDate)return alert('Indica la fecha de cobro.');
 if(!O.invoiceDraftLines.length)return alert('Añade al menos una línea.');
 for(const [i,l] of O.invoiceDraftLines.entries()){
   if(!String(l.description||'').trim())return alert('Falta la descripción en la línea '+(i+1)+'.');
   const qty=N(l.qty),unit=N(l.unit),disc=N(l.discount),vat=N(l.vat);
   if(qty<=0)return alert('La cantidad de la línea '+(i+1)+' debe ser mayor que cero.');
   if(d.invoiceKind!=='rectifying'&&unit<0)return alert('Una factura normal no puede llevar precios negativos. Usa una rectificativa.');
   if(disc<0||disc>100)return alert('El descuento de la línea '+(i+1)+' debe estar entre 0 % y 100 %.');
   if(vat<0||vat>100)return alert('El IVA de la línea '+(i+1)+' no es válido.');
 }
 try{
  const external=d.origin==='externa';let num=external?parseInt(d.externalNumber,10):null;if(external&&(!num||num<1))return alert('Indica el número correlativo usado fuera.');
  const payload={id:d.id||null,series_id:d.seriesId,store_id:d.storeId||null,issue_date:d.date,due_date:d.dueDate||null,operation_date:d.operationDate||null,origin:d.origin,document_type:d.documentType,invoice_kind:d.invoiceKind||'invoice',customer_id:d.customerId||null,customer_name:d.customer.trim(),customer_tax_id:d.taxId.trim(),customer_address:d.address.trim(),customer_email:d.email.trim(),concept:d.concept||'',payment_method:d.payment,paid_status:d.paidStatus||'pendiente',paid_date:d.paidDate||null,template_id:d.templateId||null,terms_text:d.terms||'',footer_text:d.footer||'',purchase_order_ref:d.poRef||'',include_in_income:!!d.includeIncome,notes:d.notes||''};
  const lines=O.invoiceDraftLines.map((l,i)=>({sort_order:(i+1)*10,description:l.description.trim(),quantity:N(l.qty),unit_price_base:N(l.unit),discount_pct:N(l.discount),vat_rate:N(l.vat)}));
  const file=external?document.getElementById('ops_external_doc_file')?.files?.[0]:null;
  const previousExternal=d.id?O.invoices.find(x=>x.id===d.id)?.source_document_id:null;
  if(external&&!file&&!previousExternal)return alert('Adjunta el documento original emitido fuera de Totus.');
  if(file)window.__opsValidateDocumentFile(file);
  const {data:id,error}=await sb.rpc('ops_save_document_draft',{p_document:payload,p_lines:lines});if(error)throw error;
  if(external){
    if(file)await window.__opsUploadDocumentFile(file,id,d);
    const er=await sb.rpc('ops_register_external_document',{p_document_id:id,p_number:num});if(er.error)throw er.error;
  }
  await audit('facturas',d.id?'actualizar_borrador':external?'registrar_externa':'crear_borrador',id,{tipo:d.documentType,cliente:d.customer,total:draftTotals().total});
  await window.opsLoadData(true);await featureLoad(true);
  if(external){O.invoiceDraft=null;render()}
  else if(keepOpen)window.opsEditDocument(id);
  else window.opsNewDocument(d.documentType);
  return id;
 }catch(e){alert('No se pudo guardar: '+e.message);return null}
}
window.opsSaveDocument=function(){return persistDocumentDraft({keepOpen:true})};
window.opsSaveAndFinalizeDocument=async function(){
 const d=ensureDraft();
 if(d.origin==='externa')return persistDocumentDraft({keepOpen:false});
 const id=await persistDocumentDraft({keepOpen:true});if(!id)return;
 await window.opsFinalizeDocument(id);
};
window.opsEditDocument=function(id){if(!manager())return alert('Facturación en modo consulta.');if(!confirmDiscardInvoiceDraft('Abrir otro documento'))return;E.billingPanel='documents';const row=O.invoices.find(x=>x.id===id);if(!row||row.status!=='borrador')return;E.invoiceMode=row.document_type==='proforma'?'proforma':(row.invoice_kind==='rectifying'?'rectificativa':'factura');O.invoiceDraft={id:row.id,mode:E.invoiceMode,documentType:row.document_type||'factura',invoiceKind:row.invoice_kind||'invoice',origin:row.origin||'totus',seriesId:row.series_id,storeId:row.store_id||'',date:row.issue_date,dueDate:row.due_date||'',operationDate:row.operation_date||'',externalNumber:row.external_number_text||'',customerId:row.customer_id||'',customer:row.customer_name||'',taxId:row.customer_tax_id||'',address:row.customer_address||'',email:row.customer_email||'',concept:row.concept||'',payment:row.payment_method||'transferencia',paidStatus:row.paid_status||'pendiente',paidDate:row.paid_date||'',includeIncome:!!row.include_in_income,notes:row.notes||'',terms:row.terms_text||'',footer:row.footer_text||'',poRef:row.purchase_order_ref||'',templateId:row.template_id||''};O.invoiceDraftLines=O.invoiceLines.filter(l=>l.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order).map(l=>({description:l.description,qty:String(l.quantity),unit:String(l.unit_price_base),discount:String(l.discount_pct),vat:String(l.vat_rate)}));render();window.scrollTo({top:0,behavior:'smooth'})};
window.opsFinalizeDocument=async function(id){if(!manager())return alert('Facturación en modo consulta.');const row=O.invoices.find(x=>x.id===id);if(!row)return;if(!confirm(`¿Emitir ${documentLabel(row.document_type||'factura',row.invoice_kind||'invoice').toLowerCase()}? Se asignará número definitivo y quedará bloqueado.`))return;try{const {error}=await sb.rpc('ops_finalize_document',{p_document_id:id});if(error)throw error;await audit('facturas','emitir',id,{tipo:row.document_type});await window.opsLoadData(true);await featureLoad(true);render();setTimeout(()=>opsDocumentPdf(id,true),100)}catch(e){alert('No se pudo emitir: '+e.message)}};
window.opsCreateRectifying=function(id){if(!manager())return alert('Facturación en modo consulta.');
 if(!confirmDiscardInvoiceDraft('Crear la rectificativa'))return;
 const src=O.invoices.find(x=>x.id===id);if(!src||src.document_type!=='factura'||src.status!=='emitida')return;
 const rectSeries=O.series.find(x=>x.store_id===src.store_id&&x.year===O.year&&x.document_type==='factura'&&x.series_kind==='rectifying'&&x.active)
   ||O.series.find(x=>x.year===O.year&&x.document_type==='factura'&&x.series_kind==='rectifying'&&x.active);
 if(!rectSeries)return alert('No hay una serie rectificativa activa para este año.');
 E.invoiceMode='rectificativa';O.tab='facturas';
 O.invoiceDraft={
  id:null,mode:'rectificativa',documentType:'factura',invoiceKind:'rectifying',origin:'totus',
  seriesId:rectSeries.id,storeId:src.store_id||'',date:today(),dueDate:'',operationDate:src.operation_date||src.issue_date||'',
  externalNumber:'',customerId:src.customer_id||'',customer:src.customer_name||'',taxId:src.customer_tax_id||'',
  address:src.customer_address||'',email:src.customer_email||'',concept:'Rectificación de '+(src.display_number||'factura'),
  payment:src.payment_method||'transferencia',paidStatus:'pendiente',paidDate:'',includeIncome:false,
  notes:'Rectificativa de '+(src.display_number||''),terms:src.terms_text||'',footer:src.footer_text||'',
  poRef:src.display_number||'',templateId:src.template_id||'',sourceFile:null
 };
 const lines=O.invoiceLines.filter(l=>l.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order);
 O.invoiceDraftLines=lines.length?lines.map(l=>({description:'Rectificación · '+(l.description||''),qty:String(l.quantity||1),unit:String(-N(l.unit_price_base||0)),discount:String(l.discount_pct||0),vat:String(l.vat_rate||21)})):[{description:'Rectificación de '+(src.display_number||'factura'),qty:'1',unit:String(-N(src.base_amount||0)),discount:'0',vat:'21'}];
 render();window.scrollTo({top:0,behavior:'smooth'});
};
window.opsMarkInvoicePaid=async function(id){if(!manager())return alert('Facturación en modo consulta.');
 const row=O.invoices.find(x=>x.id===id);if(!row||row.document_type!=='factura')return;
 if(!confirm('¿Marcar esta factura como cobrada?'))return;
 const {error}=await sb.from('ops_sales_invoices').update({paid_status:'pagada',paid_date:today(),updated_at:new Date().toISOString()}).eq('id',id);
 if(error)return alert('No se pudo actualizar el cobro: '+error.message);
 await audit('facturas','marcar_cobrada',id,{fecha:today()});
 await window.opsLoadData(true);await featureLoad(true);render();
};
window.opsSetProformaStatus=async function(id,status){if(!manager())return alert('Facturación en modo consulta.');const {error}=await sb.from('ops_sales_invoices').update({status}).eq('id',id).eq('document_type','proforma');if(error)return alert(error.message);await audit('facturas','estado_proforma',id,{status});await window.opsLoadData(true);render()};
window.opsConvertProforma=async function(id){if(!manager())return alert('Facturación en modo consulta.');const p=O.invoices.find(x=>x.id===id);const s=O.series.find(x=>x.store_id===p.store_id&&x.year===O.year&&x.document_type==='factura'&&(x.series_kind||'invoice')==='invoice'&&x.active)||O.series.find(x=>x.year===O.year&&x.document_type==='factura'&&(x.series_kind||'invoice')==='invoice'&&x.active);if(!s)return alert('No hay serie de factura disponible.');if(!confirm('Crear una factura borrador a partir de esta proforma?'))return;const {data,error}=await sb.rpc('ops_convert_proforma',{p_proforma_id:id,p_invoice_series_id:s.id});if(error)return alert(error.message);await window.opsLoadData(true);await featureLoad(true);E.invoiceMode='factura';opsEditDocument(data)};
function hexRgb(hex){const x=String(hex||'#17202A').replace('#','');const v=parseInt(x.length===3?x.split('').map(c=>c+c).join(''):x,16);return[(v>>16)&255,(v>>8)&255,v&255]}
async function logoData(t){if(!t?.logo_path||t.show_logo===false)return null;const {data,error}=await sb.storage.from('business-assets').download(t.logo_path);if(error)return null;return await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(data)})}
function openPdfPreview(blob,title,filename){
 const url=URL.createObjectURL(blob);
 const modal=openOpsModal(title,`<iframe class="ops-pdf-frame" title="${H(title)}"></iframe><div class="ops-preview-actions"><button type="button" class="secondary" id="ops_preview_download">Descargar PDF</button><button type="button" class="ghost" id="ops_preview_close">Cerrar</button></div>`,{wide:true});
 modal.dataset.objectUrl=url;
 modal.querySelector('.ops-pdf-frame').src=url;
 modal.querySelector('#ops_preview_download').onclick=()=>dlBlob(blob,filename);
 modal.querySelector('#ops_preview_close').onclick=closeOpsModal;
}
async function makePdf(row,lines,isDraft=false){
 if(!window.jspdf?.jsPDF)throw new Error('Generador PDF no disponible.');
 const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
 const tpl=row.design_snapshot&&Object.keys(row.design_snapshot).length?row.design_snapshot:(E.templates.find(t=>t.id===row.template_id)||E.templates.find(t=>(row.document_type==='proforma'?t.default_proforma:t.default_invoice))||E.templates[0]||{});
 const [pr,pg,pb]=hexRgb(tpl.primary_color||'#17202A'),[sr,sg,sb2]=hexRgb(tpl.secondary_color||'#3B82F6'),[tr,tg,tb]=hexRgb(tpl.text_color||'#17202A');
 const font=tpl.font_family||'helvetica',style=tpl.style||'clean',business=O.settings||{},logo=await logoData(tpl);
 const title=row.document_type==='proforma'?(tpl.proforma_title||'FACTURA PROFORMA'):(row.invoice_kind==='rectifying'?'FACTURA RECTIFICATIVA':(tpl.invoice_title||'FACTURA'));
 const number=isDraft?'BORRADOR':(row.display_number||'SIN NÚMERO');
 const margin=15,pageW=210,contentW=180,compact=style==='compact';

 const setText=()=>doc.setTextColor(tr,tg,tb);
 const box=(x,y,w,h,fill=[248,250,252],stroke=[225,231,239])=>{doc.setFillColor(...fill);doc.setDrawColor(...stroke);doc.roundedRect(x,y,w,h,2,2,'FD')};
 const label=(txt,x,y)=>{doc.setFont(font,'bold');doc.setFontSize(7.2);doc.setTextColor(100,112,125);doc.text(String(txt).toUpperCase(),x,y);setText()};
 const value=(txt,x,y,opt={})=>{doc.setFont(font,opt.bold?'bold':'normal');doc.setFontSize(opt.size||8.7);doc.text(String(txt??''),x,y,opt.options||{})};

 // Cabecera.
 if(style==='brand'){doc.setFillColor(pr,pg,pb);doc.rect(0,0,pageW,38,'F')}
 else {doc.setDrawColor(pr,pg,pb);doc.setLineWidth(style==='compact'?0.7:1.4);doc.line(margin,12,pageW-margin,12)}
 const headColor=style==='brand'?[255,255,255]:[pr,pg,pb];doc.setTextColor(...headColor);
 let logoW=Math.max(20,Math.min(58,N(tpl.logo_width_mm||34))),logoH=Math.max(10,logoW*.42);
 if(logo&&tpl.show_logo!==false){
   try{
     const fmt=String(tpl.logo_mime||'').includes('png')?'PNG':'JPEG';
     const lx=tpl.logo_position==='right'?pageW-margin-logoW:tpl.logo_position==='center'?(pageW-logoW)/2:margin;
     doc.addImage(logo,fmt,lx,style==='brand'?8:16,logoW,logoH);
   }catch(e){}
 }
 const titleOnLeft=logo&&tpl.logo_position==='right';
 const tx=titleOnLeft?margin:pageW-margin,align=titleOnLeft?'left':'right';
 doc.setFont(font,'bold');doc.setFontSize(compact?16:20);doc.text(title,tx,style==='brand'?16:22,{align});
 doc.setFont(font,'normal');doc.setFontSize(8.5);doc.text(number,tx,style==='brand'?23:29,{align});
 if(isDraft){doc.setFillColor(sr,sg,sb2);doc.roundedRect(titleOnLeft?margin:pageW-margin-27,style==='brand'?27:33,27,7,1.5,1.5,'F');doc.setTextColor(255,255,255);doc.setFont(font,'bold');doc.setFontSize(7);doc.text('BORRADOR',titleOnLeft?margin+13.5:pageW-margin-13.5,style==='brand'?31.7:37.7,{align:'center'})}
 setText();

 let y=style==='brand'?45:44;
 if(tpl.header_text){doc.setFont(font,'normal');doc.setFontSize(7.5);doc.setTextColor(92,104,116);doc.text(doc.splitTextToSize(String(tpl.header_text),contentW),margin,y);y+=10;setText()}

 // Emisor + datos del documento.
 const cardH=compact?28:34;
 box(margin,y,88,cardH);box(107,y,88,cardH);
 label('Emisor',margin+5,y+6);
 const issuer=[business.business_name,business.tax_id,business.business_address,business.business_email,business.business_phone].filter(Boolean);
 let iy=y+12;issuer.forEach((v,i)=>{doc.setFont(font,i===0?'bold':'normal');doc.setFontSize(i===0?9:7.5);doc.text(doc.splitTextToSize(String(v),76),margin+5,iy);iy+=i===0?5:4});
 label('Documento',112,y+6);
 const facts=[
  ['Número',number],
  ['Fecha',(row.issue_date||'').split('-').reverse().join('/')||'—'],
  ...(row.operation_date?[['Operación',row.operation_date.split('-').reverse().join('/')]]:[]),
  ...(row.due_date?[['Vencimiento',row.due_date.split('-').reverse().join('/')]]:[]),
  ...(row.payment_method?[['Pago',String(row.payment_method)]]:[])
 ];
 let fy=y+12;facts.slice(0,compact?4:5).forEach(([k,v])=>{doc.setFont(font,'bold');doc.setFontSize(7.3);doc.text(k+':',112,fy);doc.setFont(font,'normal');doc.text(String(v),135,fy,{maxWidth:54});fy+=4.2});
 y+=cardH+6;

 // Cliente.
 box(margin,y,contentW,compact?25:31,[246,248,251],[220,227,235]);
 label('Cliente / destinatario',margin+5,y+6);
 doc.setFont(font,'bold');doc.setFontSize(10);doc.text(String(row.customer_name||'Cliente sin nombre'),margin+5,y+13,{maxWidth:100});
 doc.setFont(font,'normal');doc.setFontSize(7.7);
 const customerLines=[row.customer_tax_id,row.customer_address,row.customer_email].filter(Boolean);
 let cy=y+18;customerLines.forEach(v=>{doc.text(doc.splitTextToSize(String(v),150),margin+5,cy);cy+=4});
 if(row.purchase_order_ref){label('Referencia',150,y+8);doc.setFont(font,'normal');doc.setFontSize(7.5);doc.text(String(row.purchase_order_ref),150,y+13,{maxWidth:40})}
 y+=compact?32:38;

 // Marca de agua proforma.
 if(row.document_type==='proforma'){doc.setTextColor(225,228,232);doc.setFont(font,'bold');doc.setFontSize(34);doc.text('PROFORMA',105,154,{align:'center',angle:35});setText()}

 // Tabla.
 const cols={desc:18,qty:112,unit:132,disc:151,vat:168,total:193};
 const drawHead=()=>{
  doc.setFillColor(sr,sg,sb2);doc.roundedRect(margin,y,contentW,8,1.5,1.5,'F');
  doc.setTextColor(255,255,255);doc.setFont(font,'bold');doc.setFontSize(7.4);
  doc.text('Descripción',cols.desc,y+5.2);doc.text('Cant.',cols.qty,y+5.2,{align:'right'});doc.text('Precio',cols.unit,y+5.2,{align:'right'});doc.text('Dto.',cols.disc,y+5.2,{align:'right'});doc.text('IVA',cols.vat,y+5.2,{align:'right'});doc.text('Total',cols.total,y+5.2,{align:'right'});
  setText();y+=11;
 };
 drawHead();doc.setFont(font,'normal');doc.setFontSize(compact?7.4:8);
 lines.forEach((l,index)=>{
  if(y>244){doc.addPage();y=18;drawHead()}
  const desc=doc.splitTextToSize(String(l.description||''),82),rowH=Math.max(compact?5.5:6.5,desc.length*3.7+2);
  if(index%2===1){doc.setFillColor(249,250,252);doc.rect(margin,y-3,contentW,rowH,'F')}
  doc.text(desc,cols.desc,y);
  doc.text(String(N(l.quantity??l.qty)||0).replace('.',','),cols.qty,y,{align:'right'});
  doc.text(euro(N(l.unit_price_base??l.unit)).replace('€','').trim(),cols.unit,y,{align:'right'});
  doc.text((N(l.discount_pct??l.discount)||0).toFixed(2).replace('.',',')+' %',cols.disc,y,{align:'right'});
  doc.text((N(l.vat_rate??l.vat)||0).toFixed(2).replace('.',',')+' %',cols.vat,y,{align:'right'});
  const total=l.total_amount!=null?N(l.total_amount):lineCalc(l).total;doc.setFont(font,'bold');doc.text(euro(total).replace('€','').trim(),cols.total,y,{align:'right'});doc.setFont(font,'normal');
  y+=rowH;
 });
 const totals=lines.reduce((acc,l)=>{const base=l.base_amount!=null?N(l.base_amount):lineCalc(l).base,vat=l.vat_amount!=null?N(l.vat_amount):lineCalc(l).vat,total=l.total_amount!=null?N(l.total_amount):lineCalc(l).total;acc.base+=base;acc.vat+=vat;acc.total+=total;return acc},{base:0,vat:0,total:0});
 y+=3;if(y>244){doc.addPage();y=22}
 box(116,y,79,compact?29:34,[248,250,252],[220,227,235]);
 label('Resumen',121,y+6);
 doc.setFont(font,'normal');doc.setFontSize(8);doc.text('Base imponible',121,y+13);doc.text(euro(totals.base),190,y+13,{align:'right'});
 doc.text('IVA',121,y+19);doc.text(euro(totals.vat),190,y+19,{align:'right'});
 doc.setFillColor(pr,pg,pb);doc.roundedRect(120,y+22,71,8,1.2,1.2,'F');doc.setTextColor(255,255,255);doc.setFont(font,'bold');doc.setFontSize(10);doc.text('TOTAL',124,y+27.5);doc.text(euro(totals.total),188,y+27.5,{align:'right'});setText();
 y+=compact?36:42;

 // Condiciones y pago.
 const terms=row.terms_text||tpl.payment_terms_default||'',bank=tpl.show_payment_details!==false?(tpl.bank_details||''):'';
 if(terms||bank){
   if(y>255){doc.addPage();y=20}
   const w=terms&&bank?86:180;
   if(terms){box(margin,y,w,24,[250,251,253]);label('Condiciones',margin+5,y+6);doc.setFont(font,'normal');doc.setFontSize(7.2);doc.text(doc.splitTextToSize(String(terms),w-10),margin+5,y+12)}
   if(bank){const x=terms?109:margin;box(x,y,w,24,[250,251,253]);label('Datos de pago',x+5,y+6);doc.setFont(font,'normal');doc.setFontSize(7.2);doc.text(doc.splitTextToSize(String(bank),w-10),x+5,y+12)}
 }

 // Pie.
 doc.setDrawColor(220,226,233);doc.line(margin,279,pageW-margin,279);
 const footer=row.footer_text||tpl.footer_text||'';doc.setFont(font,'normal');doc.setTextColor(105,115,126);doc.setFontSize(7);
 if(footer)doc.text(doc.splitTextToSize(String(footer),130),margin,284);
 const legal=row.document_type==='proforma'?'Documento proforma · no constituye factura definitiva.':(row.invoice_kind==='rectifying'?'Documento rectificativo.':'Documento emitido por Totus Central.');
 doc.text(legal,pageW-margin,284,{align:'right',maxWidth:48});
 doc.setFontSize(6.5);doc.text((business.business_email||'')+(business.tax_id?' · '+business.tax_id:''),pageW-margin,290,{align:'right'});

 return doc.output('blob');
}
window.__opsUploadDocumentFile=async function(file,entityId,d){
 const max=N(O.settings?.document_max_bytes||20971520);if(file.size>max)throw new Error('El archivo supera el límite configurado.');
 const buf=await file.arrayBuffer(),dig=await crypto.subtle.digest('SHA-256',buf),sha=[...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const dup=O.documents.find(x=>x.sha256===sha);
 if(dup){
  if(dup.linked_entity_type==='sales_invoice_source'&&dup.linked_entity_id!==entityId)throw new Error('Ese archivo ya está vinculado como original de otra factura. Revisa el documento antes de continuar.');
  const link=await sb.from('ops_sales_invoices').update({source_document_id:dup.id}).eq('id',entityId).select('id,source_document_id').single();
  if(link.error)throw link.error;
  if(link.data?.source_document_id!==dup.id)throw new Error('El documento existente no quedó enlazado a la factura.');
  return dup.id;
 }
 const safe=String(file.name||'documento').replace(/[^a-zA-Z0-9._-]+/g,'_'),dt=String(d.date||today()),year=dt.slice(0,4),month=dt.slice(5,7),q='T'+Math.floor((Number(month)-1)/3+1),store=O.stores.find(x=>x.id===d.storeId)?.code||'GENERAL',type=d.documentType==='proforma'?'PROFORMAS_EXTERNAS':'FACTURAS_EXTERNAS',party=String(d.customer||'SIN_CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'SIN_CLIENTE';const path=`externos/${year}/${q}/${month}/${store}/${type}/${party}/${crypto.randomUUID()}_${safe}`;
 const up=await sb.storage.from('business-documents').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;
 const {data,error}=await sb.from('ops_documents').insert({store_id:d.storeId||null,doc_type:d.documentType==='proforma'?'proforma':'factura_emitida',document_date:d.date,supplier_or_customer:d.customer||'',tax_id:d.taxId||'',invoice_number:d.externalNumber||'',category_code:'700',status:'archivada',storage_path:path,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:sha,linked_entity_type:'sales_invoice_source',linked_entity_id:entityId,notes:'Documento creado fuera y registrado en Totus',uploaded_by:authSession.user.id}).select('id').single();
 if(error){await sb.storage.from('business-documents').remove([path]);throw error}
 const link=await sb.from('ops_sales_invoices').update({source_document_id:data.id}).eq('id',entityId).select('id,source_document_id').single();
 if(link.error){await sb.storage.from('business-documents').remove([path]).catch(()=>{});throw link.error}
 if(link.data?.source_document_id!==data.id)throw new Error('El original se subió, pero no quedó enlazado a la factura.');
 return data.id;
};
window.opsPreviewDraft=async function(){const d=ensureDraft(),t=E.templates.find(x=>x.id===d.templateId)||{};const fake={...d,document_type:d.documentType,template_id:d.templateId,issue_date:d.date,due_date:d.dueDate,operation_date:d.operationDate,customer_name:d.customer,customer_tax_id:d.taxId,customer_address:d.address,customer_email:d.email,purchase_order_ref:d.poRef,terms_text:d.terms,footer_text:d.footer,display_number:null,design_snapshot:t};try{const blob=await makePdf(fake,O.invoiceDraftLines,true);openPdfPreview(blob,'Vista previa · '+documentLabel(d.documentType,d.invoiceKind),`vista_previa_${d.documentType}.pdf`)}catch(e){alert(e.message)}};
window.opsPreviewInvoice=async function(id){
 const row=O.invoices.find(x=>x.id===id);if(!row)return;
 if(row.status!=='borrador')return window.opsDocumentPdf(id);
 try{
  const lines=O.invoiceLines.filter(x=>x.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order);
  const blob=await makePdf(row,lines,true);
  openPdfPreview(blob,'Vista previa · '+(row.display_number||documentLabel(row.document_type,row.invoice_kind)),(row.display_number||'borrador').replaceAll('/','-')+'.pdf');
 }catch(e){alert('No se pudo abrir la vista previa: '+e.message)}
};
window.opsDuplicateInvoice=function(id){
 if(!manager())return alert('Facturación en modo consulta.');
 if(!confirmDiscardInvoiceDraft('Duplicar otro documento'))return;
 const src=O.invoices.find(x=>x.id===id);if(!src)return;
 E.billingPanel='documents';E.invoiceMode=src.document_type==='proforma'?'proforma':(src.invoice_kind==='rectifying'?'rectificativa':'factura');O.tab='facturas';
 const compatible=O.series.find(x=>x.year===O.year&&x.store_id===src.store_id&&x.document_type===src.document_type&&x.series_kind===(src.invoice_kind==='rectifying'?'rectifying':'invoice')&&x.active)
  ||O.series.find(x=>x.year===O.year&&x.document_type===src.document_type&&x.series_kind===(src.invoice_kind==='rectifying'?'rectifying':'invoice')&&x.active);
 O.invoiceDraft={id:null,mode:E.invoiceMode,documentType:src.document_type||'factura',invoiceKind:src.invoice_kind||'invoice',origin:'totus',seriesId:compatible?.id||src.series_id||'',storeId:src.store_id||'',date:today(),dueDate:'',operationDate:today(),externalNumber:'',customerId:src.customer_id||'',customer:src.customer_name||'',taxId:src.customer_tax_id||'',address:src.customer_address||'',email:src.customer_email||'',concept:src.concept||'',payment:src.payment_method||'transferencia',paidStatus:'pendiente',paidDate:'',includeIncome:false,notes:'Copia de '+(src.display_number||'documento'),terms:src.terms_text||'',footer:src.footer_text||'',poRef:'',templateId:src.template_id||''};
 O.invoiceDraftLines=O.invoiceLines.filter(x=>x.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order).map(l=>({description:l.description,qty:String(l.quantity),unit:String(l.unit_price_base),discount:String(l.discount_pct),vat:String(l.vat_rate)}));
 if(!O.invoiceDraftLines.length)O.invoiceDraftLines=[{description:'',qty:'1',unit:'',discount:'0',vat:'21'}];
 render();window.scrollTo({top:0,behavior:'smooth'});
};
async function uploadGenerated(blob,row){const name=(row.display_number||row.document_type||'documento').replaceAll('/','-')+'.pdf';const file=new File([blob],name,{type:'application/pdf'});const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());const sha=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');const existing=O.documents.find(d=>d.sha256===sha);if(existing)return existing.id;const dt=String(row.issue_date||today()),year=dt.slice(0,4),month=dt.slice(5,7),q='T'+Math.floor((Number(month)-1)/3+1),store=O.stores.find(x=>x.id===row.store_id)?.code||'GENERAL',type=row.document_type==='proforma'?'PROFORMAS':'FACTURAS_EMITIDAS',party=String(row.customer_name||'SIN_CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'SIN_CLIENTE';const path=`emitidos/${year}/${q}/${month}/${store}/${type}/${party}/${crypto.randomUUID()}_${name}`;let u=await sb.storage.from('business-documents').upload(path,file,{contentType:'application/pdf',upsert:false});if(u.error)throw u.error;let r=await sb.from('ops_documents').insert({store_id:row.store_id||null,doc_type:row.document_type==='proforma'?'proforma':'factura_emitida',document_date:row.issue_date,supplier_or_customer:row.customer_name||'',tax_id:row.customer_tax_id||'',invoice_number:row.display_number||'',category_code:'700',status:'archivada',storage_path:path,original_name:name,mime_type:'application/pdf',size_bytes:file.size,sha256:sha,linked_entity_type:'sales_invoice',linked_entity_id:row.id,notes:'Generado por Totus Central',uploaded_by:authSession.user.id}).select('id').single();if(r.error){await sb.storage.from('business-documents').remove([path]);throw r.error}return r.data.id}
window.opsDocumentPdf=async function(id,saveServer=false){try{let row=O.invoices.find(x=>x.id===id);if(!row)return;let blob=null;if(row.generated_document_id&&!saveServer){const d=O.documents.find(x=>x.id===row.generated_document_id);if(d){const r=await sb.storage.from('business-documents').download(d.storage_path);if(!r.error)blob=r.data}}const lines=O.invoiceLines.filter(x=>x.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order);if(!blob)blob=await makePdf(row,lines,false);if(saveServer&&!row.generated_document_id){const did=await uploadGenerated(blob,row);await sb.from('ops_sales_invoices').update({generated_document_id:did}).eq('id',id);await window.opsLoadData(true)}openPdfPreview(blob,'Documento · '+(row.display_number||documentLabel(row.document_type,row.invoice_kind)),(row.display_number||row.document_type).replaceAll('/','-')+'.pdf')}catch(e){alert('No se pudo generar PDF: '+e.message)}};
window.opsUploadTemplateLogo=async function(id){
 if(!manager())return alert('Solo administración o gerencia puede cambiar la imagen corporativa.');
 const input=document.getElementById('ops_tpl_logo'),file=input?.files?.[0];
 if(!file)return alert('Selecciona un logo.');
 if(file.size>2097152)return alert('El logo supera 2 MB.');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))return alert('Usa PNG, JPG o WebP.');
 const tpl=E.templates.find(t=>t.id===id);if(!tpl)return alert('Plantilla no encontrada.');
 const ext=file.name.split('.').pop().toLowerCase(),path=`logos/${id}.${ext}`;
 try{
  const up=await sb.storage.from('business-assets').upload(path,file,{contentType:file.type,upsert:true});
  if(up.error)throw up.error;
  const {error}=await sb.from('ops_document_templates').update({logo_path:path,logo_name:file.name,logo_mime:file.type,logo_size_bytes:file.size,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){if(!tpl.logo_path||tpl.logo_path!==path)await sb.storage.from('business-assets').remove([path]);throw error}
  if(tpl.logo_path&&tpl.logo_path!==path)await sb.storage.from('business-assets').remove([tpl.logo_path]);
  await featureLoad(true);render();
 }catch(e){alert('No se pudo subir el logo: '+e.message)}
};
function configHtml(){
 const st=O.settings||{},used=N(E.storageUsage?.total_bytes),limit=N(st.storage_limit_bytes||1073741824),pct=limit?used/limit*100:0,dis=admin()?'':'disabled';
 const refSemesters=REFERENCE_SEMESTER_2026_BYTES?limit/REFERENCE_SEMESTER_2026_BYTES:0,refYears=refSemesters/2;
 const ro=admin()?'':'<div class="ops-note warn">Configuración en modo consulta. Solo Administración puede modificar estos parámetros.</div>';
 return `<div class="config-workspace">
  <div class="config-toolbar">
   <div><div class="eyebrow">Administración</div><div class="ops-title-line"><h2>Configuración general</h2>${infoButton('config','Qué se configura aquí')}</div><div class="small">Solo ajustes globales. Facturación, plantillas, logo, clientes y series se gestionan dentro de Facturación.</div></div>
   <div class="ops-actions"><button class="secondary" type="button" onclick="opsTab('facturas');opsBillingPanel('templates')">Abrir diseño de facturas</button><button class="primary" type="button" onclick="opsSaveSettings()" ${dis}>Guardar configuración</button></div>
  </div>
  ${ro}
  <nav class="config-nav" aria-label="Secciones de configuración">
   <button type="button" onclick="document.getElementById('cfg_empresa')?.scrollIntoView({behavior:'smooth',block:'start'})">Empresa</button>
   <button type="button" onclick="document.getElementById('cfg_fiscal')?.scrollIntoView({behavior:'smooth',block:'start'})">Fiscalidad</button>
   <button type="button" onclick="document.getElementById('cfg_reta')?.scrollIntoView({behavior:'smooth',block:'start'})">RETA</button>
   <button type="button" onclick="document.getElementById('cfg_storage')?.scrollIntoView({behavior:'smooth',block:'start'})">Almacenamiento</button>
  </nav>

  <section class="ops-card config-section" id="cfg_empresa">
   <div class="section-head"><div><div class="eyebrow">Empresa</div><div class="ops-title-line"><h3>Identidad fiscal y contacto</h3>${infoButton('config.empresa','Datos generales de empresa')}</div><div class="small">Estos datos se reutilizan en documentos, informes y facturación. El logo NO se gestiona aquí.</div></div></div>
   <div class="ops-form">
    <div class="span2"><label>Nombre / titular</label><input id="ops_set_name" value="${H(st.business_name||'')}" ${dis}></div>
    <div><label>NIF/CIF</label><input id="ops_set_tax" value="${H(st.tax_id||'')}" ${dis}></div>
    <div><label>Teléfono</label><input id="ops_set_phone" value="${H(st.business_phone||'')}" ${dis}></div>
    <div class="span4"><label>Dirección fiscal</label><input id="ops_set_address" value="${H(st.business_address||'')}" ${dis}></div>
    <div class="span2"><label>Email</label><input id="ops_set_email" type="email" value="${H(st.business_email||'')}" ${dis}></div>
   </div>
   <div class="ops-note" style="margin-top:12px"><b>Imagen corporativa:</b> logo, colores, títulos, pie y datos de pago pertenecen exclusivamente a <button type="button" class="ops-link-btn" onclick="opsTab('facturas');opsBillingPanel('templates')">Facturación → Plantillas y marca</button>.</div>
  </section>

  <section class="ops-card config-section" id="cfg_fiscal">
   <div class="section-head"><div><div class="eyebrow">Fiscalidad</div><div class="ops-title-line"><h3>Criterios de cálculo</h3>${infoButton('config.fiscal','Parámetros fiscales globales')}</div><div class="small">Afectan a las previsiones de Fiscalidad. No sustituyen los datos presentados por la gestoría.</div></div></div>
   <div class="ops-form">
    <div><label>Régimen</label><select id="ops_set_regime" ${dis}><option value="recargo_equivalencia" ${st.fiscal_regime==='recargo_equivalencia'?'selected':''}>Recargo de equivalencia</option><option value="general" ${st.fiscal_regime==='general'?'selected':''}>Régimen general</option></select></div>
    <div><label>Método estimación</label><select id="ops_set_estimation" ${dis}><option value="directa_simplificada" ${st.estimation_method==='directa_simplificada'?'selected':''}>Directa simplificada</option><option value="directa_normal" ${st.estimation_method==='directa_normal'?'selected':''}>Directa normal</option></select></div>
    <div><label>Pago fraccionado IRPF %</label><input id="ops_set_irpf" inputmode="decimal" value="${H(st.irpf_prepayment_rate??20)}" ${dis}></div>
    <div><label>IVA ventas %</label><input id="ops_set_vat" inputmode="decimal" value="${H(st.default_sales_vat_rate??21)}" ${dis}></div>
    <div class="checkline"><input id="ops_set_diff_enabled" type="checkbox" ${st.difficult_expense_enabled!==false?'checked':''} ${dis}><label for="ops_set_diff_enabled">Aplicar difícil justificación</label></div>
    <div><label>Difícil justificación %</label><input id="ops_set_diff_pct" inputmode="decimal" value="${H(st.difficult_expense_pct??5)}" ${dis}></div>
    <div><label>Tope anual €</label><input id="ops_set_diff_cap" inputmode="decimal" value="${H(st.difficult_expense_annual_cap??2000)}" ${dis}></div>
    <div><label>Margen operativo objetivo %</label><input id="ops_set_target_margin" inputmode="decimal" value="${H(st.target_operating_margin_pct??15)}" ${dis}></div>
    <div class="span4"><label>Notas fiscales internas</label><textarea id="ops_set_fiscal_notes" ${dis}>${H(st.fiscal_notes||'')}</textarea></div>
   </div>
  </section>

  <section class="ops-card config-section" id="cfg_reta">
   <div class="section-head"><div><div class="eyebrow">RETA</div><div class="ops-title-line"><h3>Referencias de cotización</h3>${infoButton('config.reta','Parámetros usados para la proyección RETA')}</div><div class="small">Solo para simulación y control. La regularización oficial depende de Seguridad Social.</div></div></div>
   <div class="ops-form">
    <div><label>Cuota actual mensual €</label><input id="ops_set_reta" inputmode="decimal" value="${H(st.actual_reta_monthly??'')}" ${dis}></div>
    <div><label>Rendimiento año anterior €</label><input id="ops_set_prevnet" inputmode="decimal" value="${H(st.previous_year_net_income??'')}" ${dis}></div>
    <div><label>Deducción genérica %</label><input id="ops_set_reta_ded" inputmode="decimal" value="${H(st.reta_generic_deduction_pct??7)}" ${dis}></div>
    <div><label>Tipo total estimado %</label><input id="ops_set_reta_rate" inputmode="decimal" value="${H(st.reta_total_rate??31.5)}" ${dis}></div>
   </div>
  </section>

  <section class="ops-card config-section" id="cfg_storage">
   <div class="section-head"><div><div class="eyebrow">Archivo</div><div class="ops-title-line"><h3>Almacenamiento documental</h3>${infoButton('config.storage','Límites de almacenamiento')}</div><div class="small">Controla el espacio reservado y el tamaño máximo por documento.</div></div><span class="badge ${pct>=95?'badb':pct>=80?'warnb':'ok'}">${pct.toFixed(1).replace('.',',')} % usado</span></div>
   <div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div>
   <div class="ops-kpis" style="margin-top:14px">
    <div class="ops-kpi"><small>Uso actual</small><strong>${(used/1048576).toFixed(1).replace('.',',')} MB</strong></div>
    <div class="ops-kpi"><small>Límite operativo</small><strong>${Math.round(limit/1048576)} MB</strong></div>
    <div class="ops-kpi"><small>Documentos</small><strong>${N(E.storageUsage?.documents_count)}</strong></div>
    <div class="ops-kpi"><small>Recursos de marca</small><strong>${N(E.storageUsage?.assets_count)}</strong></div>
   </div>
   <div class="ops-card storage-estimate-card" style="margin-top:12px">
    <div class="section-head"><div><div class="eyebrow">Estimación con datos reales</div><h4>Capacidad documental aproximada</h4></div></div>
    <div class="ops-metric-line"><span>Semestre 2026 · archivos reales</span><b>${(REFERENCE_SEMESTER_2026_BYTES/1048576).toFixed(1).replace('.',',')} MB · ${REFERENCE_SEMESTER_2026_FILES} archivos</b></div>
    <div class="ops-metric-line"><span>RAR aportado (solo referencia comprimida)</span><b>${(REFERENCE_SEMESTER_2026_ARCHIVE_BYTES/1048576).toFixed(1).replace('.',',')} MB</b></div>
    <div class="ops-metric-line"><span>Semestres equivalentes con el límite actual</span><b>${refSemesters.toFixed(1).replace('.',',')}</b></div>
    <div class="ops-metric-line"><span>Equivalencia temporal aproximada</span><b>${refYears.toFixed(1).replace('.',',')} años</b></div>
    <div class="small">Proyección calculada con los <b>57.360.165 bytes sin comprimir</b> de los 301 elementos contenidos en <b>Semestre 2026.rar</b>, porque Supabase almacenará los documentos individualmente y no como un RAR comprimido. Es una estimación conservadora: el tamaño futuro variará según cantidad y resolución. El “límite operativo” es el configurado en Totus, no una promesa del plan comercial de Supabase.</div>
   </div>
   <div class="ops-form" style="margin-top:12px">
    <div><label>Límite total MB</label><input id="ops_set_storage_mb" inputmode="numeric" value="${Math.round(limit/1048576)}" ${dis}></div>
    <div><label>Máximo por documento MB</label><input id="ops_set_doc_mb" inputmode="numeric" value="${Math.round(N(st.document_max_bytes||20971520)/1048576)}" ${dis}></div>
   </div>
  </section>

  <div class="config-savebar"><div><b>Configuración general</b><div class="small">Un único guardado para todos los cambios de esta pestaña.</div></div><button class="primary" type="button" onclick="opsSaveSettings()" ${dis}>Guardar configuración</button></div>
 </div>`;
}
window.opsSelectTemplateConfig=id=>{E.templateId=id;render()};
function readTemplateForm(base={}){
 const get=id=>document.getElementById(id);
 return {...base,
  name:(get('ops_tpl_name')?.value||base.name||'').trim(),
  style:get('ops_tpl_style')?.value||base.style||'clean',
  primary_color:get('ops_tpl_primary')?.value||base.primary_color||'#17202A',
  secondary_color:get('ops_tpl_secondary')?.value||base.secondary_color||'#3B82F6',
  text_color:get('ops_tpl_text')?.value||base.text_color||'#17202A',
  font_family:get('ops_tpl_font')?.value||base.font_family||'helvetica',
  logo_width_mm:N(get('ops_tpl_width')?.value||base.logo_width_mm||34),
  logo_position:get('ops_tpl_logo_pos')?.value||base.logo_position||'left',
  show_logo:get('ops_tpl_show_logo')?.checked??base.show_logo??true,
  show_payment_details:get('ops_tpl_show_pay')?.checked??base.show_payment_details??true,
  invoice_title:(get('ops_tpl_invoice_title')?.value||base.invoice_title||'FACTURA').trim(),
  proforma_title:(get('ops_tpl_proforma_title')?.value||base.proforma_title||'FACTURA PROFORMA').trim(),
  header_text:get('ops_tpl_header')?.value||'',
  payment_terms_default:get('ops_tpl_terms')?.value||'',
  bank_details:get('ops_tpl_bank')?.value||'',
  footer_text:get('ops_tpl_footer')?.value||'',
  default_invoice:!!get('ops_tpl_definv')?.checked,
  default_proforma:!!get('ops_tpl_defpro')?.checked
 };
}
window.opsTemplateLiveUpdate=function(){
 const tpl=E.templates.find(t=>t.id===E.templateId)||E.templates[0]||{},target=document.getElementById('ops_tpl_live_preview');if(!target)return;
 const live=readTemplateForm(tpl),sample={documentType:'factura',invoiceKind:'invoice',templateId:tpl.id,customer:'Cliente de ejemplo',taxId:'B12345678',seriesId:O.series.find(s=>s.document_type==='factura'&&s.series_kind!=='rectifying')?.id||''};
 target.innerHTML=templateMiniPreview(live,sample,{total:1234.56});
};
window.opsPreviewTemplatePdf=async function(id){
 const tpl=E.templates.find(t=>t.id===id)||{};const live=readTemplateForm(tpl);
 const fake={document_type:'factura',invoice_kind:'invoice',template_id:id,issue_date:today(),customer_name:'Cliente de ejemplo',customer_tax_id:'B12345678',customer_address:'Calle Ejemplo 1, 28000 Madrid',customer_email:'cliente@ejemplo.es',purchase_order_ref:'PED-001',payment_method:'transferencia',terms_text:live.payment_terms_default,footer_text:live.footer_text,display_number:'BORRADOR',design_snapshot:live};
 const lines=[{description:'Producto o servicio de ejemplo',quantity:2,unit_price_base:150,discount_pct:0,vat_rate:21},{description:'Segundo concepto',quantity:1,unit_price_base:934.56,discount_pct:0,vat_rate:21}];
 try{const blob=await makePdf(fake,lines,true);openPdfPreview(blob,'Vista previa de plantilla · '+(live.name||'Sin nombre'),'vista_previa_plantilla.pdf')}catch(e){alert('No se pudo generar la vista previa: '+e.message)}
};
window.opsRemoveTemplateLogo=async function(id){
 if(!manager())return;const tpl=E.templates.find(t=>t.id===id);if(!tpl?.logo_path)return;
 if(!confirm('¿Quitar el logo de esta plantilla? El resto del diseño se conservará.'))return;
 try{
  const rm=await sb.storage.from('business-assets').remove([tpl.logo_path]);if(rm.error)throw rm.error;
  const {error}=await sb.from('ops_document_templates').update({logo_path:null,logo_name:null,logo_mime:null,logo_size_bytes:0,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;
  await featureLoad(true);render();
 }catch(e){alert('No se pudo quitar el logo: '+e.message)}
};

window.opsSaveTemplate=async function(id){
 if(!manager())return alert('Solo administración o gerencia puede editar plantillas.');
 const payload=readTemplateForm(E.templates.find(t=>t.id===id)||{});
 if(!payload.name)return alert('El nombre de la plantilla es obligatorio.');
 if(payload.logo_width_mm<10||payload.logo_width_mm>80)return alert('El ancho del logo debe estar entre 10 y 80 mm.');
 const {error}=await sb.rpc('ops_save_document_template',{p_id:id,p_template:payload});
 if(error)return alert('No se pudo guardar la plantilla: '+error.message);
 await featureLoad(true);render();
};
window.opsDuplicateTemplate=function(id){
 if(!manager())return;
 const src=E.templates.find(t=>t.id===id);if(!src)return;
 const proposed=(src.name||'Plantilla')+' copia';
 const modal=openOpsModal('Duplicar plantilla',`<div class="ops-form"><div class="span4"><label>Nombre de la nueva plantilla</label><input id="ops_tpl_copy_name" aria-label="Nombre de la nueva plantilla" value="${H(proposed)}"></div></div><div class="ops-preview-actions"><button class="primary" id="ops_tpl_copy_ok">Crear copia</button><button class="ghost" id="ops_tpl_copy_cancel">Cancelar</button></div>`);
 modal.querySelector('#ops_tpl_copy_cancel').onclick=closeOpsModal;
 modal.querySelector('#ops_tpl_copy_ok').onclick=async()=>{
  const name=modal.querySelector('#ops_tpl_copy_name').value.trim();if(!name)return modal.querySelector('#ops_tpl_copy_name').focus();
  const row={...src};['id','created_at','updated_at'].forEach(k=>delete row[k]);
  row.code='TPL-'+Date.now().toString(36).toUpperCase();row.name=name;row.default_invoice=false;row.default_proforma=false;row.active=true;
  row.logo_path=null;row.logo_name=null;row.logo_mime=null;row.logo_size_bytes=0;
  const {data,error}=await sb.from('ops_document_templates').insert(row).select('id').single();
  if(error)return alert('No se pudo duplicar: '+error.message);
  closeOpsModal();await featureLoad(true);E.templateId=data.id;render();
 };
};
window.opsSaveSeries=async function(id){if(!admin())return;const s=O.series.find(x=>x.id===id),prefix=document.getElementById('ser_p_'+id).value.trim(),next=parseInt(document.getElementById('ser_n_'+id).value,10),padding=parseInt(document.getElementById('ser_d_'+id).value,10);const max=Math.max(0,...O.invoices.filter(x=>x.series_id===id&&x.number!=null).map(x=>N(x.number)));if(!prefix||!next||next<=max)return alert(`El siguiente número debe ser mayor que ${max}.`);if(padding<1||padding>10)return alert('Dígitos entre 1 y 10.');if(max>0&&(prefix!==String(s.prefix||'')||padding!==N(s.padding)))return alert('Esta serie ya tiene documentos emitidos. Su prefijo y número de dígitos quedan bloqueados para conservar la numeración histórica. Solo puedes avanzar el siguiente número.');const {error}=await sb.from('ops_invoice_series').update({prefix,next_number:next,padding}).eq('id',id);if(error)return alert(error.message);await window.opsLoadData(true);render()};
async function tabularDocumentPreview(blob,name){
 if(!window.XLSX)return '<div class="ops-empty">La vista tabular no está disponible en este navegador.</div>';
 const wb=XLSX.read(await blob.arrayBuffer(),{type:'array'}),sheetName=wb.SheetNames[0],ws=wb.Sheets[sheetName];
 const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}),shown=rows.slice(0,100),maxCols=Math.min(30,Math.max(1,...shown.map(r=>r.length)));
 const body=shown.map((r,ri)=>'<tr>'+Array.from({length:maxCols},(_,ci)=>`<${ri===0?'th':'td'}>${H(r[ci]??'')}</${ri===0?'th':'td'}>`).join('')+'</tr>').join('');
 return `<div class="ops-tabular-preview"><div class="small">${H(name)} · hoja ${H(sheetName||'1')}${rows.length>100?' · mostrando 100 de '+rows.length+' filas':''}</div><div class="ops-table-wrap"><table class="ops-table">${body}</table></div></div>`;
}
async function openDocumentBlobPreview(blob,name,mime=''){
 const type=String(mime||blob?.type||'').toLowerCase(),filename=String(name||'documento'),ext=filename.toLowerCase().split('.').pop();
 const isPdf=type==='application/pdf'||ext==='pdf',isImage=['image/jpeg','image/png','image/webp'].includes(type)||['jpg','jpeg','png','webp'].includes(ext),isTable=['xlsx','xls','csv'].includes(ext)||/spreadsheet|excel|csv/.test(type),isText=type.startsWith('text/')||['txt','md'].includes(ext);
 let html='',url='';
 if(isPdf){url=URL.createObjectURL(blob);html=`<iframe class="ops-pdf-frame" title="${H(filename)}"></iframe>`}
 else if(isImage){url=URL.createObjectURL(blob);html=`<div class="ops-image-preview"><img alt="${H(filename)}"></div>`}
 else if(isTable){html=await tabularDocumentPreview(blob,filename)}
 else if(isText){const txt=await blob.text();html=`<div class="ops-text-preview"><pre>${H(txt.slice(0,120000))}</pre></div>`}
 else html=`<div class="ops-empty"><b>Vista previa no disponible para este formato.</b><div class="small">El archivo no se ha descargado automáticamente. Puedes descargarlo desde esta misma ventana si lo necesitas.</div></div>`;
 const modal=openOpsModal('Vista previa · '+filename,html+`<div class="ops-preview-actions"><button type="button" class="secondary" id="ops_doc_preview_download">Descargar</button><button type="button" class="ghost" id="ops_doc_preview_close">Cerrar</button></div>`,{wide:true});
 if(url){modal.dataset.objectUrl=url;if(isPdf)modal.querySelector('iframe').src=url;else modal.querySelector('img').src=url}
 modal.querySelector('#ops_doc_preview_download').onclick=()=>dlBlob(blob,filename);
 modal.querySelector('#ops_doc_preview_close').onclick=closeOpsModal;
 return modal;
}
window.opsPreviewSelectedFile=async function(inputId){
 const file=document.getElementById(inputId)?.files?.[0];if(!file)return alert('Selecciona primero un archivo.');
 try{await openDocumentBlobPreview(file,file.name,file.type)}catch(e){alert('No se pudo abrir la vista previa: '+e.message)}
};
window.opsPreviewDoc=async function(id){
 const d=O.documents.find(x=>x.id===id);if(!d)return;
 try{
  const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);if(error)throw error;
  await openDocumentBlobPreview(data,d.original_name||'documento',d.mime_type||'');
 }catch(e){alert('No se pudo abrir el documento: '+e.message)}
};
function docPartyOptions(){
 const suppliers=(O.suppliers||[]).filter(x=>x.active!==false).map(x=>`<option value="S:${x.id}">Proveedor · ${H(x.name)}${x.tax_id?' · '+H(x.tax_id):''}</option>`).join('');
 const customers=E.customers.filter(x=>x.active!==false).map(x=>`<option value="C:${x.id}">Cliente · ${H(x.name)}${x.tax_id?' · '+H(x.tax_id):''}</option>`).join('');
 return `<option value="">— Escribir manualmente —</option>${suppliers}${customers}`;
}
window.opsDocPartySelect=function(v){
 const party=document.getElementById('ops_doc_party'),tax=document.getElementById('ops_doc_tax');if(!party||!tax)return;
 if(!v)return;
 const [kind,id]=String(v).split(':');
 const row=kind==='S'?(O.suppliers||[]).find(x=>x.id===id):E.customers.find(x=>x.id===id);
 if(row){party.value=row.name||'';tax.value=row.tax_id||''}
};
window.opsOpenCustomerQuick=function(){
 const m=openOpsModal('Nuevo cliente',`<div class="ops-form"><div class="span2"><label>Nombre / razón social</label><input id="ops_qc_name" aria-label="Nombre / razón social"></div><div><label>NIF/CIF</label><input id="ops_qc_tax" aria-label="NIF/CIF"></div><div><label>Email</label><input id="ops_qc_email" aria-label="Email" type="email"></div><div class="span2"><label>Dirección</label><input id="ops_qc_address" aria-label="Dirección"></div></div><div class="ops-preview-actions"><button class="primary" id="ops_qc_save">Guardar cliente</button><button class="ghost" id="ops_qc_cancel">Cancelar</button></div>`);
 m.querySelector('#ops_qc_cancel').onclick=closeOpsModal;
 m.querySelector('#ops_qc_save').onclick=async()=>{const row={name:m.querySelector('#ops_qc_name').value.trim(),tax_id:m.querySelector('#ops_qc_tax').value.trim(),email:m.querySelector('#ops_qc_email').value.trim(),address:m.querySelector('#ops_qc_address').value.trim(),default_payment_method:'transferencia',active:true,updated_at:new Date().toISOString()};if(!row.name)return m.querySelector('#ops_qc_name').focus();const dup=row.tax_id&&E.customers.find(x=>String(x.tax_id||'').trim().toLowerCase()===row.tax_id.toLowerCase());if(dup)return alert('Ya existe un cliente con ese NIF/CIF: '+dup.name+'.');const {data,error}=await sb.from('ops_customers').insert(row).select().single();if(error)return alert(error.message);closeOpsModal();await featureLoad(true);render()};
};
O.docSelected=O.docSelected||[];
function updateDocSelectionUi(){
 const docs=O.documents.filter(d=>(O.docSelected||[]).includes(d.id)),linked=docs.filter(documentIsLinked);
 const count=document.getElementById('ops_doc_selected_count');if(count)count.textContent=docs.length+' seleccionados'+(linked.length?' · '+linked.length+' vinculados':'');
 const dl=document.getElementById('ops_doc_download_selected');if(dl)dl.disabled=!docs.length;
 const del=document.getElementById('ops_doc_delete_selected');if(del){del.disabled=!docs.length||!!linked.length;del.title=linked.length?'La selección contiene documentos vinculados. Se eliminan desde su módulo de origen.':''}
}
window.opsDocSelect=function(id,on){const set=new Set(O.docSelected||[]);on?set.add(id):set.delete(id);O.docSelected=[...set];updateDocSelectionUi()};
window.opsDocSelectVisible=function(on){
 const ids=[...document.querySelectorAll('tr[data-doc-row="1"]')].filter(r=>r.style.display!=='none').map(r=>r.dataset.docId).filter(Boolean);
 const set=new Set(O.docSelected||[]);ids.forEach(id=>on?set.add(id):set.delete(id));O.docSelected=[...set];
 document.querySelectorAll('tr[data-doc-row="1"]').forEach(r=>{const cb=r.querySelector('input[type="checkbox"]');if(cb)cb.checked=set.has(r.dataset.docId)});
 updateDocSelectionUi();
};
window.opsDocSearch=function(v){
 O.docFilter.q=v;
 const q=String(v||'').trim().toLowerCase();let visible=0;
 document.querySelectorAll('tr[data-doc-row="1"]').forEach(r=>{const show=!q||String(r.dataset.docSearch||'').includes(q);r.style.display=show?'':'none';if(show)visible++});
 const empty=document.getElementById('ops_doc_search_empty');if(empty)empty.hidden=visible>0;
 const head=document.getElementById('ops_doc_select_visible');if(head)head.checked=false;
};
window.opsDownloadSelectedDocs=async function(){const docs=O.documents.filter(d=>(O.docSelected||[]).includes(d.id));if(!docs.length)return alert('Selecciona al menos un documento.');const z=new JSZip();const done=await zipDocs(docs,z,'DOCUMENTOS_SELECCIONADOS');if(done!==docs.length)return alert(`No se pudieron descargar ${docs.length-done} documentos. No se ha generado un ZIP incompleto.`);dlBlob(await z.generateAsync({type:'blob'}),`Totus_documentos_seleccionados_${today()}.zip`)};
window.opsDeleteSelectedDocs=async function(){if(!manager())return;const docs=O.documents.filter(d=>(O.docSelected||[]).includes(d.id));if(!docs.length)return alert('Selecciona al menos un documento.');const linked=docs.filter(documentIsLinked);if(linked.length)return alert('Hay '+linked.length+' documento(s) vinculados a gastos, facturas o modelos fiscales. No se pueden eliminar desde Archivo. Deselecciónalos o elimínalos desde su módulo de origen.');const reason=await askReason('Eliminar documentos seleccionados',`Se eliminarán ${docs.length} documentos independientes. Cada eliminación quedará registrada.`,'Eliminar selección');if(!reason)return;for(const d of docs){const {data,error}=await sb.rpc('ops_delete_document_controlled',{p_document_id:d.id,p_reason:reason});if(error)return alert('No se pudo eliminar '+d.original_name+': '+error.message);if(data?.storage_path)await sb.storage.from('business-documents').remove([data.storage_path])}O.docSelected=[];await window.opsLoadData(true);await featureLoad(true);render()};
function docTypeLabel(v){return({factura_recibida:'Factura recibida',factura_emitida:'Factura emitida',factura_rectificativa:'Factura rectificativa',proforma:'Proforma',ticket:'Ticket / justificante',contrato:'Contrato',impuesto:'Impuesto / modelo',informe:'Informe',otro:'Otro documento'})[v]||String(v||'Otro documento').replaceAll('_',' ')}
function docStatusLabel(v){return({pendiente:'Pendiente',pagada:'Pagada',revisada:'Revisada',preparada_gestor:'Preparada para gestoría',entregada_gestor:'Entregada a gestoría',archivada:'Archivada'})[v]||String(v||'Pendiente').replaceAll('_',' ')}
function documentIsLinked(d){return !!(d?.linked_entity_id||d?.linked_entity_type&&d.linked_entity_type!=='standalone')}
function documentLinkLabel(d){
 const t=String(d?.linked_entity_type||'');
 if(t==='expense')return 'Vinculado a gasto';
 if(t==='sales_invoice'||t==='sales_invoice_generated')return 'PDF generado de factura';
 if(t==='sales_invoice_source')return 'Original de factura externa';
 if(t==='tax_payment')return 'Vinculado a modelo fiscal';
 return t?'Vinculado':'Independiente';
}
function documentsHtml(){
 const f=O.docFilter||{from:'',to:'',store:'all',status:'all',type:'all',q:''};
 const types=['factura_recibida','factura_emitida','factura_rectificativa','proforma','ticket','contrato','impuesto','informe','otro'];
 const rows=O.documents.filter(d=>(!f.from||d.document_date>=f.from)&&(!f.to||d.document_date<=f.to)&&(f.store==='all'||d.store_id===f.store)&&(f.status==='all'||d.status===f.status)&&(f.type==='all'||d.doc_type===f.type)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.document_date||'').localeCompare(String(a.document_date||''))).slice(0,500);
 const q=String(f.q||'').trim().toLowerCase();
 const used=N(E.storageUsage?.total_bytes),limit=N(O.settings?.storage_limit_bytes||1073741824),pct=limit?used/limit*100:0;
 return `<div class="document-upload-layout"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Archivo</div><div class="ops-title-line"><h3>Subir documento</h3>${infoButton('documentos','Ayuda sobre archivo documental')}</div><div class="small">Factura, ticket, impuesto, contrato, informe o cualquier justificante.</div></div><button class="primary" onclick="opsUploadStandaloneDoc()">Subir</button></div><div class="ops-form"><div><label>Fecha</label><input id="ops_doc_date" aria-label="Fecha del documento archivado" type="date" max="${today()}" value="${today()}"></div><div><label>Tienda</label><select id="ops_doc_store"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}">${H(s.name)}</option>`).join('')}</select></div><div><label>Tipo</label><select id="ops_doc_type">${types.map(x=>`<option value="${x}">${H(docTypeLabel(x))}</option>`).join('')}</select></div><div><label>Estado</label><select id="ops_doc_status">${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option value="${x}">${H(docStatusLabel(x))}</option>`).join('')}</select></div><div class="span2"><label>Proveedor / cliente guardado</label><div class="ops-inline-field"><select aria-label="Proveedor o cliente guardado" onchange="opsDocPartySelect(this.value)">${docPartyOptions()}</select><button type="button" class="ghost" onclick="opsOpenSupplierEditor()">+ Proveedor</button><button type="button" class="ghost" onclick="opsOpenCustomerQuick()">+ Cliente</button></div><input id="ops_doc_party" style="margin-top:6px" placeholder="Nombre / razón social"></div><div><label>NIF/CIF</label><input id="ops_doc_tax"></div><div><label>Nº documento</label><input id="ops_doc_invoice"></div><div class="span2"><label>Notas internas</label><textarea id="ops_doc_notes" placeholder="Opcional · no modifica el archivo original"></textarea></div><div class="span2 ops-file-box"><label>Archivo</label><input id="ops_doc_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md"><div class="small">PDF, imagen, Excel, CSV o texto · se previsualiza antes de subir.</div><button type="button" class="ghost file-preview-btn" onclick="opsPreviewSelectedFile('ops_doc_file')">Vista previa seleccionada</button></div></div></div><div class="ops-card document-storage-card"><div class="section-head"><div><div class="eyebrow">Espacio</div><h3>${Math.round(used/1048576)} MB / ${Math.round(limit/1048576)} MB</h3></div><span class="badge ${pct>=95?'badb':pct>=80?'warnb':'ok'}">${pct.toFixed(1).replace('.',',')} %</span></div><div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div><div class="ops-metric-line"><span>Documentos</span><b>${N(E.storageUsage?.documents_count)} · ${(N(E.storageUsage?.documents_bytes)/1048576).toFixed(1).replace('.',',')} MB</b></div><div class="ops-metric-line"><span>Logos y recursos</span><b>${N(E.storageUsage?.assets_count)} · ${Math.round(N(E.storageUsage?.assets_bytes)/1024)} KB</b></div><div class="small">Aviso visual al 80 % y crítico al 95 %.</div></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Documentos</div><div class="ops-title-line"><h3>Buscar, revisar y preparar</h3>${infoButton('documentos.estado','Ayuda sobre estados documentales')}</div></div><div class="ops-actions"><span class="badge" id="ops_doc_selected_count">${(O.docSelected||[]).length} seleccionados${O.documents.filter(d=>(O.docSelected||[]).includes(d.id)&&documentIsLinked(d)).length?' · '+O.documents.filter(d=>(O.docSelected||[]).includes(d.id)&&documentIsLinked(d)).length+' vinculados':''}</span><button class="secondary" id="ops_doc_download_selected" onclick="opsDownloadSelectedDocs()" ${(O.docSelected||[]).length?'':'disabled'}>Descargar selección</button>${manager()?`<button class="danger" id="ops_doc_delete_selected" onclick="opsDeleteSelectedDocs()" ${!(O.docSelected||[]).length||O.documents.some(d=>(O.docSelected||[]).includes(d.id)&&documentIsLinked(d))?'disabled':''}>Eliminar selección</button>`:''}<button class="secondary" onclick="opsZipFilteredDocs()">ZIP filtrado</button></div></div><div class="ops-filters"><div><label>Desde</label><input type="date" value="${H(f.from||'')}" onchange="opsDocFilter('from',this.value)"></div><div><label>Hasta</label><input type="date" value="${H(f.to||'')}" onchange="opsDocFilter('to',this.value)"></div><div><label>Tienda</label><select onchange="opsDocFilter('store',this.value)"><option value="all">Todas</option>${O.stores.map(s=>`<option value="${s.id}" ${f.store===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div><div><label>Tipo</label><select onchange="opsDocFilter('type',this.value)"><option value="all">Todos</option>${types.map(x=>`<option value="${x}" ${f.type===x?'selected':''}>${H(docTypeLabel(x))}</option>`).join('')}</select></div><div><label>Estado</label><select onchange="opsDocFilter('status',this.value)"><option value="all">Todos</option>${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option value="${x}" ${f.status===x?'selected':''}>${H(docStatusLabel(x))}</option>`).join('')}</select></div><div style="flex:1;min-width:220px"><label>Buscar</label><input id="ops_doc_search" value="${H(f.q||'')}" oninput="opsDocSearch(this.value)" placeholder="Proveedor/cliente, NIF, número, archivo, tipo…"></div></div>${rows.length?`<div class="ops-table-wrap" style="margin-top:12px"><table class="ops-table ops-responsive-table document-table"><thead><tr><th><input id="ops_doc_select_visible" aria-label="Seleccionar todos los documentos visibles" type="checkbox" onchange="opsDocSelectVisible(this.checked)"></th><th>Fecha</th><th>Tienda</th><th>Tipo</th><th>Proveedor / cliente</th><th>Número</th><th>Archivo</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(d=>{const search=[d.supplier_or_customer,d.tax_id,d.invoice_number,d.original_name,d.notes,d.doc_type,d.category_code].join(' ').toLowerCase(),show=!q||search.includes(q);return `<tr data-doc-row="1" data-doc-id="${d.id}" data-doc-search="${H(search)}" style="${show?'':'display:none'}"><td data-label="Seleccionar"><input aria-label="Seleccionar ${H(d.original_name)}" type="checkbox" ${(O.docSelected||[]).includes(d.id)?'checked':''} onchange="opsDocSelect('${d.id}',this.checked)"></td><td data-label="Fecha">${String(d.document_date||'').split('-').reverse().join('/')||'—'}</td><td data-label="Tienda">${H(storeName(d.store_id))}</td><td data-label="Tipo"><b>${H(docTypeLabel(d.doc_type))}</b><div class="ops-tiny">${H(documentLinkLabel(d))}</div></td><td data-label="Proveedor / cliente">${H(d.supplier_or_customer||'—')}</td><td data-label="Número">${H(d.invoice_number||'—')}</td><td data-label="Archivo">${H(d.original_name)}<div class="ops-tiny">${Math.round(N(d.size_bytes)/1024)} KB</div></td><td data-label="Estado"><select aria-label="Estado de ${H(d.original_name)}" onchange="opsSetDocStatus('${d.id}',this.value)" ${manager()?'':'disabled'}>${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option value="${x}" ${d.status===x?'selected':''}>${H(docStatusLabel(x))}</option>`).join('')}</select></td><td data-label="Acciones"><div class="ops-actions"><button class="ghost" onclick="opsPreviewDoc('${d.id}')">Vista previa</button><button class="ghost" onclick="opsDownloadDoc('${d.id}')">Descargar</button>${manager()&&!documentIsLinked(d)?`<button class="danger" onclick="opsDeleteDocument('${d.id}')">Eliminar</button>`:''}</div></td></tr>`}).join('')}</tbody></table></div><div id="ops_doc_search_empty" class="ops-empty" ${rows.some(d=>!q||[d.supplier_or_customer,d.tax_id,d.invoice_number,d.original_name,d.notes,d.doc_type,d.category_code].join(' ').toLowerCase().includes(q))?'hidden':''}>No hay documentos que coincidan con la búsqueda.</div>`:'<div class="ops-empty">No hay documentos con esos filtros.</div>'}</div>`;
}
window.opsDeleteDocument=async function(id){
 if(!manager())return alert('Solo administración o gerencia puede eliminar documentos.');
 const d=O.documents.find(x=>x.id===id);if(!d)return;
 if(documentIsLinked(d))return alert('Este documento está '+documentLinkLabel(d).toLowerCase()+'. Elimínalo o sustitúyelo desde su módulo de origen para no romper el vínculo.');
 const reason=await askReason('Eliminar documento',`Vas a eliminar "${d.original_name}". El cambio quedará registrado.`,'Eliminar documento');
 if(!reason)return;
 try{
  const {data,error}=await sb.rpc('ops_delete_document_controlled',{p_document_id:id,p_reason:reason});if(error)throw error;
  if(data?.storage_path){const rm=await sb.storage.from('business-documents').remove([data.storage_path]);if(rm.error)console.warn('Archivo físico pendiente de limpieza:',rm.error.message)}
  await window.opsLoadData(true);await featureLoad(true);render();
 }catch(e){alert('No se pudo eliminar el documento: '+e.message)}
};
function fiscalTaxStatusBadge(v){const label=({pagado:'Pagado / presentado',previsto:'Previsto · pendiente',compensado:'Compensado'})[v]||String(v||'');return `<span class="badge ${taxSettledStatus(v)?'ok':'warnb'}">${H(label)}</span>`}
function taxPaymentsHtml(){
 const rows=(O.taxPayments||[]).filter(x=>x.fiscal_year===O.year).sort((a,b)=>N(b.quarter)-N(a.quarter)||String(a.tax_type).localeCompare(String(b.tax_type)));
 if(!manager())return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Modelos registrados</div><h3>Pagos fiscales ${O.year}</h3></div></div>${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Modelo</th><th>Periodo</th><th>Fecha</th><th>Importe</th><th>Estado</th><th>Justificante</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${H(x.tax_type)}</b></td><td>${H(x.period_label||((x.quarter||'')+'T '+x.fiscal_year))}</td><td>${x.payment_date?reportDate(x.payment_date):'—'}</td><td class="num">${euro(x.amount)}</td><td>${fiscalTaxStatusBadge(x.status)}</td><td>${x.document_id?'<span class="badge ok">Adjunto</span>':'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay pagos fiscales registrados este año.</div>'}</div>`;
 return `<div class="ops-grid" id="fiscal_modelos">
  <div class="ops-card">
   <div class="section-head"><div><div class="eyebrow">Registrar</div><div class="ops-title-line"><h3>Pago / modelo fiscal</h3>${infoButton('fiscal.pagos','Cómo registrar modelos presentados')}</div><div class="small">Añade aquí los importes realmente presentados o pagados para que las previsiones resten lo ya satisfecho.</div></div><button class="primary" type="button" onclick="opsSaveTaxPayment()">Guardar</button></div>
   <div class="ops-form">
    <div><label>Modelo / obligación</label><select id="ops_tax_type" aria-label="Modelo fiscal"><option value="130">130 · IRPF autónomo</option><option value="111">111 · Retenciones trabajo/profesionales</option><option value="115">115 · Retenciones alquiler</option><option value="309">309 · IVA no periódico</option><option value="RETA">RETA · Cuota autónomos</option><option value="OTRO">Otro pago fiscal</option></select></div>
    <div><label>Año</label><input id="ops_tax_year" aria-label="Año fiscal" inputmode="numeric" value="${O.year}"></div>
    <div><label>Trimestre</label><select id="ops_tax_quarter" aria-label="Trimestre fiscal">${[1,2,3,4].map(q=>`<option value="${q}" ${q===O.quarter?'selected':''}>T${q}</option>`).join('')}</select></div>
    <div><label>Fecha pago / presentación</label><input id="ops_tax_date" aria-label="Fecha pago o presentación" type="date" max="${today()}" value="${today()}"></div>
    <div><label>Importe</label><input id="ops_tax_amount" aria-label="Importe del modelo" inputmode="decimal" placeholder="0,00"></div>
    <div><label>Estado</label><select id="ops_tax_status" aria-label="Estado del modelo" onchange="opsTaxStatusChanged(this.value)"><option value="pagado">Pagado / presentado</option><option value="previsto">Previsto · pendiente</option><option value="compensado">Compensado</option></select></div>
    <div class="span2"><label>Justificante</label><input id="ops_tax_file" aria-label="Justificante del modelo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></div>
    <div class="span2"><label>Notas</label><textarea id="ops_tax_notes" aria-label="Notas del modelo"></textarea></div>
   </div>
  </div>
  <div class="ops-card">
   <div class="section-head"><div><div class="eyebrow">Histórico ${O.year}</div><h3>Modelos registrados</h3><div class="small">Importes reales utilizados para descontar pagos anteriores y controlar obligaciones.</div></div></div>
   ${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Modelo</th><th>Periodo</th><th>Fecha</th><th>Importe</th><th>Estado</th><th>Justificante</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${H(x.tax_type)}</b></td><td>${H(x.period_label||((x.quarter||'')+'T '+x.fiscal_year))}</td><td>${x.payment_date?reportDate(x.payment_date):'—'}</td><td class="num">${euro(x.amount)}</td><td>${fiscalTaxStatusBadge(x.status)}</td><td>${x.document_id?`<button class="ghost" type="button" onclick="opsPreviewDoc('${x.document_id}')">Vista previa</button>`:'—'}</td><td><div class="ops-actions">${admin()?`<button class="danger" type="button" onclick="opsDeleteTaxPayment('${x.id}')">Eliminar</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay pagos fiscales registrados este año.</div>'}
  </div>
 </div>`;
}
window.opsTaxStatusChanged=function(status){
 const date=document.getElementById('ops_tax_date');if(!date)return;
 if(status==='previsto'){date.removeAttribute('max');date.value=''}
 else {date.setAttribute('max',today());if(!date.value)date.value=today()}
};
window.opsSaveTaxPayment=async function(){
 if(!manager())return;
 const type=document.getElementById('ops_tax_type')?.value||'',year=parseInt(document.getElementById('ops_tax_year')?.value||'',10),quarter=parseInt(document.getElementById('ops_tax_quarter')?.value||'',10),date=document.getElementById('ops_tax_date')?.value||'',amount=N(document.getElementById('ops_tax_amount')?.value),status=document.getElementById('ops_tax_status')?.value||'pagado',notes=document.getElementById('ops_tax_notes')?.value?.trim()||'',file=document.getElementById('ops_tax_file')?.files?.[0]||null;
 if(!['130','111','115','309','RETA','OTRO'].includes(type)||!year||quarter<1||quarter>4)return alert('Modelo, año y trimestre son obligatorios.');
 if(amount<0)return alert('El importe no puede ser negativo.');
 if(['pagado','compensado'].includes(status)&&!date)return alert('Indica la fecha de pago o presentación.');
 if(['pagado','compensado'].includes(status)&&date>today())return alert('Un pago ya realizado no puede tener una fecha futura. Usa estado "Previsto" si aún no se ha presentado o pagado.');
 const dup=(O.taxPayments||[]).find(x=>x.tax_type===type&&N(x.fiscal_year)===year&&N(x.quarter)===quarter);
 if(dup&&!confirm(`Ya existe el modelo ${type} del T${quarter} ${year}. ¿Guardar otro registro igualmente?`))return;
 try{
  const row={tax_type:type,fiscal_year:year,quarter,period_label:`${quarter}T ${year}`,payment_date:date||null,amount,status,notes,created_by:authSession?.user?.id||null};
  const {data,error}=await sb.from('ops_tax_payments').insert(row).select().single();if(error)throw error;
  if(file){
   try{
    O.core.validateDocFile(file);
    const docId=await O.core.uploadDoc(file,{store_id:null,doc_type:'impuesto',document_date:date||today(),supplier_or_customer:'AEAT',tax_id:'',invoice_number:`Modelo ${type} · T${quarter} ${year}`,category_code:type,status:['pagado','compensado'].includes(status)?'archivada':'pendiente',notes},'tax_payment',data.id);
    if(!docId)throw new Error('No se pudo crear el registro documental del justificante.');
    const up=await sb.from('ops_tax_payments').update({document_id:docId}).eq('id',data.id).select('id,document_id').single();
    if(up.error)throw up.error;
    if(!up.data?.document_id)throw new Error('El justificante se subió, pero no quedó vinculado al modelo fiscal.');
   }catch(fileErr){alert('El modelo se ha guardado, pero el justificante no pudo adjuntarse: '+fileErr.message)}
  }
  await audit('fiscal','modelo_registrar',data.id,{modelo:type,year,quarter,amount,status});
  await window.opsLoadData(true);await featureLoad(true);render();
 }catch(e){alert('No se pudo guardar el modelo: '+e.message)}
};
window.opsDeleteTaxPayment=async function(id){
 if(!admin())return;
 const x=(O.taxPayments||[]).find(t=>t.id===id);if(!x)return;
 const reason=await askReason('Eliminar modelo registrado',`Se eliminará el modelo ${x.tax_type} · ${x.period_label||''} por ${euro(x.amount)}. El motivo quedará en el log.`,'Eliminar');
 if(!reason)return;
 try{
  const doc=O.documents.find(d=>d.id===x.document_id);
  const {error}=await sb.from('ops_tax_payments').delete().eq('id',id);if(error)throw error;
  if(doc){const del=await sb.rpc('ops_delete_document_controlled',{p_document_id:doc.id,p_reason:'Eliminación del modelo fiscal asociado: '+reason});if(!del.error&&doc.storage_path)await sb.storage.from('business-documents').remove([doc.storage_path])}
  await audit('fiscal','modelo_eliminar',id,{modelo:x.tax_type,periodo:x.period_label,motivo:reason});
  await window.opsLoadData(true);await featureLoad(true);render();
 }catch(e){alert('No se pudo eliminar el modelo: '+e.message)}
};

function closedFiscalPeriodsHtml(){
 const paid=(O.taxPayments||[]).filter(t=>t.tax_type==='130'&&t.fiscal_year===O.year&&taxSettledStatus(t.status)).sort((a,b)=>N(a.quarter)-N(b.quarter));
 if(!paid.length)return '';
 const rows=paid.map(t=>{
  const q=N(t.quarter),b=qBounds(O.year,q);
  const operational=operationalIncomeTotal(b.start,b.end,'all');
  const fiscal=incomeTotal(b.start,b.end,'all');
  const gestorIncome=sum(E.historicalIncome.filter(x=>x.period_start>=b.start&&x.period_end<=b.end),x=>N(x.gestor_reported_income??x.fiscal_basis_income??x.total_income));
  const expense=deductibleExpenseTotal(b.start,b.end,'all');
  const before= fiscal-expense,gdj=difficult(Math.max(0,before)),theoretical=Math.max(0,(before-gdj)*N(O.settings?.irpf_prepayment_rate||20)/100);
  const issues=(E.reconciliationNotes||[]).filter(x=>x.active!==false&&x.fiscal_year===O.year&&N(x.quarter)===q);
  const incomeIssue=issues.find(x=>x.issue_type==='ingresos_excel_vs_gestoria');
  const diff=Math.abs(theoretical-N(t.amount));
  return `<tr>
   <td><b>T${q}</b><div class="ops-tiny">${H(t.period_label||'')}</div></td>
   <td class="num"><b>${euro(fiscal)}</b><div class="ops-tiny">operativa ${euro(operational)}</div></td>
   <td class="num">${Math.abs(gestorIncome-fiscal)>.01?`<span class="badge warnb">${euro(gestorIncome)}</span><div class="ops-tiny">diferencia ${euro(fiscal-gestorIncome)}</div>`:`<span class="badge ok">${euro(gestorIncome)}</span>`}</td>
   <td class="num"><b>${euro(expense)}</b></td>
   <td class="num">${euro(before)}</td>
   <td class="num"><b>${euro(t.amount)}</b><div class="ops-tiny">cálculo ${euro(theoretical)}</div></td>
   <td>${diff<=.02?'<span class="badge ok">VERIFICADO</span>':'<span class="badge warnb">REVISAR</span>'}${incomeIssue?`<div class="ops-tiny">Anomalía documental explicada</div>`:''}</td>
  </tr>`;
 }).join('');
 return `<div class="ops-card fiscal-verified-card">
  <div class="section-head"><div><div class="eyebrow">Trimestres presentados</div><div class="ops-title-line"><h3>Cierre fiscal verificado</h3>${infoButton('fiscal.verificado','Cómo se verifican los trimestres presentados')}</div><div class="small">Distingue la venta real usada para el modelo 130 del listado auxiliar de ingresos de gestoría. Si una fuente discrepa, se conserva y se explica: no sustituye silenciosamente el dato validado.</div></div></div>
  <div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Periodo</th><th>Ventas base 130</th><th>Listado gestoría</th><th>Gastos fiscales</th><th>Resultado antes 5 %</th><th>Modelo 130 pagado</th><th>Cuadre</th></tr></thead><tbody>${rows}</tbody></table></div>
 </div>`;
}
function fiscalProjectionHtml(){
 const f=fiscalProjection(O.year,O.quarter,0),sim=fiscalProjection(O.year,O.quarter,N(O.plannedSpend)),r=retaProjection(),g=spendingSignal(),actual=N(O.settings?.actual_reta_monthly||0);
 const operationalYtd=operationalIncomeTotal(f.from,f.end,'all'),incomeGap=operationalYtd-f.income;
 const retaDelta=r.bracket?actual-r.minQuota:0,people=O.personnel||[],activeFamily=people.filter(x=>x.active&&x.person_type==='family_collaborator');
 const storeRows=storeOperatingRows(f.qb.start,f.qb.end),storeIncome=sum(storeRows,x=>x.income),storeExpense=sum(storeRows,x=>x.expense),storeResult=storeIncome-storeExpense;
 const taxQ=supportedTaxCosts(f.qb.start,f.qb.end),taxYtd=supportedTaxCosts(f.from,f.end);
 return `<div class="fiscal-workspace">
 <nav class="fiscal-nav" aria-label="Secciones de fiscalidad">
  <button type="button" onclick="document.getElementById('fiscal_resumen')?.scrollIntoView({behavior:'smooth',block:'start'})">Resumen</button>
  <button type="button" onclick="document.getElementById('fiscal_resultado')?.scrollIntoView({behavior:'smooth',block:'start'})">Resultado</button>
  <button type="button" onclick="document.getElementById('fiscal_impuestos')?.scrollIntoView({behavior:'smooth',block:'start'})">Impuestos</button>
  <button type="button" onclick="document.getElementById('fiscal_irpf')?.scrollIntoView({behavior:'smooth',block:'start'})">IRPF</button>
  <button type="button" onclick="document.getElementById('fiscal_reta')?.scrollIntoView({behavior:'smooth',block:'start'})">RETA</button>
  <button type="button" onclick="document.getElementById('fiscal_fuentes')?.scrollIntoView({behavior:'smooth',block:'start'})">Fuentes</button>
  <button type="button" onclick="document.getElementById('fiscal_modelos')?.scrollIntoView({behavior:'smooth',block:'start'})">Modelos</button>
 </nav>
 ${importedStatusHtml()}
 ${closedFiscalPeriodsHtml()}
 <div class="ops-note fiscal-regime-note" style="margin-top:14px"><b>Régimen configurado:</b> ${H(O.settings?.fiscal_regime||'recargo_equivalencia')} · ${H(O.settings?.estimation_method||'directa_simplificada')}. Control interno y previsión; las declaraciones oficiales se contrastan con gestoría.</div>
 <div class="ops-kpis" style="margin-top:14px">
  <div class="ops-kpi"><small>Ingresos fiscales acumulados</small><strong>${euro(f.income)}</strong><div class="sub">Base usada para previsión fiscal</div></div>
  <div class="ops-kpi"><small>Ingresos operativos acumulados</small><strong>${euro(operationalYtd)}</strong><div class="sub">${Math.abs(incomeGap)>.01?'Diferencia documentada '+euro(incomeGap):'Coinciden con la base fiscal'}</div></div>
  <div class="ops-kpi"><small>Gastos deducibles validados</small><strong>${euro(f.raw)}</strong></div>
  <div class="ops-kpi ${f.net>=0?'good':'bad'}"><small>Rendimiento neto</small><strong>${euro(f.net)}</strong></div>
  <div class="ops-kpi warn"><small>Reserva fiscal</small><strong>${euro(f.reserve)}</strong></div>
  <div class="ops-kpi ${g.state==='tight'?'bad':g.state==='room'?'good':'warn'}"><small>${H(g.title)}</small><strong>${euro(g.result)}</strong><div class="sub">Objetivo ${g.targetPct.toFixed(1).replace('.',',')} % = ${euro(g.target)}</div></div>
 </div>
 <div class="ops-card" id="fiscal_resultado">
  <div class="section-head"><div><div class="eyebrow">T${O.quarter} · visión de negocio</div><div class="ops-title-line"><h3>Resultado operativo por tienda</h3>${infoButton('fiscal.tiendas','Cómo leer el resultado por tienda')}</div><div class="small">Ventas y gastos registrados en vuestra operativa. Sirve para comparar establecimientos; no reparte artificialmente los gastos fiscales comunes.</div></div></div>
  <div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Establecimiento</th><th>Ventas</th><th>Gastos</th><th>Resultado</th><th>Margen</th><th>Fuente gasto</th></tr></thead><tbody>
   ${storeRows.map(x=>`<tr><td><b>${H(x.store.name)}</b></td><td class="num">${euro(x.income)}</td><td class="num">${euro(x.expense)}</td><td class="num"><b>${euro(x.result)}</b></td><td class="num">${x.margin.toFixed(2).replace('.',',')} %</td><td><span class="badge ${x.expenseSource==='Informe final verificado'?'ok':'warnb'}">${H(x.expenseSource)}</span></td></tr>`).join('')}
   <tr class="total-row"><td><b>TOTAL NEGOCIO</b></td><td class="num"><b>${euro(storeIncome)}</b></td><td class="num"><b>${euro(storeExpense)}</b></td><td class="num"><b>${euro(storeResult)}</b></td><td class="num"><b>${storeIncome?(storeResult/storeIncome*100).toFixed(2).replace('.',','):'0,00'} %</b></td><td>Consolidado</td></tr>
  </tbody></table></div>
  <div class="ops-note" style="margin-top:10px">La fiscalidad exacta se calcula consolidada porque los libros del gestor no asignan de forma fiable todos los gastos a una tienda. Totus no inventa ese reparto.</div>
 </div>
 <div class="ops-grid">
  <div class="ops-card" id="fiscal_impuestos">
   <div class="section-head"><div><div class="eyebrow">Impuestos soportados</div><div class="ops-title-line"><h3>IVA y recargo de equivalencia</h3>${infoButton('fiscal.iva_re','Qué significan estas cifras')}</div><div class="small">Información de coste soportado en compras. Estás configurado en recargo de equivalencia: Totus no lo presenta como liquidación periódica de IVA.</div></div></div>
   <div class="ops-metric-line"><span>IVA soportado T${O.quarter}</span><b>${euro(taxQ.vat)}</b></div>
   <div class="ops-metric-line"><span>Recargo equivalencia T${O.quarter}</span><b>${euro(taxQ.re)}</b></div>
   <div class="ops-metric-line"><span>IVA + RE soportado T${O.quarter}</span><b>${euro(taxQ.total)}</b></div>
   <div class="ops-metric-line"><span>IVA + RE acumulado ${O.year}</span><b>${euro(taxYtd.total)}</b></div>
  </div>
  <div class="ops-card">
   <div class="section-head"><div><div class="eyebrow">Fiscal consolidado</div><h3>Números usados para impuestos</h3><div class="small">Estos son los importes que alimentan la previsión del modelo 130.</div></div></div>
   <div class="ops-metric-line"><span>Ventas fiscales T${O.quarter}</span><b>${euro(f.qIncome)}</b></div>
   <div class="ops-metric-line"><span>Gastos fiscales T${O.quarter}</span><b>${euro(f.qExpense)}</b></div>
   <div class="ops-metric-line"><span>Resultado antes de difícil justificación</span><b>${euro(f.qIncome-f.qExpense)}</b></div>
   <div class="small">Para 1T/2T 2026, Totus contrasta estas cifras con las fuentes de gestoría y los modelos presentados.</div>
  </div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Gestión</div><h3>¿Gastar más o menos?</h3></div></div><div class="ops-note ${g.state==='tight'?'bad':g.state==='room'?'ok':'warn'}"><b>${H(g.title)}</b><br>${H(g.text)}</div><div class="ops-metric-line"><span>Resultado real acumulado</span><b>${euro(g.result)}</b></div><div class="ops-metric-line"><span>Margen objetivo</span><b>${euro(g.target)}</b></div><div class="ops-metric-line"><span>Colchón sobre objetivo</span><b>${euro(g.headroom)}</b></div><div class="small">No recomienda gastar por gastar: solo ayuda a decidir sobre compras necesarias, inversión o gastos reales que ya tengas previstos.</div></div>
  <div class="ops-card" id="fiscal_reta"><div class="section-head"><div><div class="eyebrow">RETA ${O.year}</div><div class="ops-title-line"><h3>Cuota según rendimiento</h3>${infoButton('fiscal.reta','Cómo se estima el tramo RETA')}</div></div></div>
   <div class="ops-metric-line"><span>Rendimiento mensual proyectado</span><b>${euro(r.monthly)}</b></div>
   <div class="ops-metric-line"><span>Base permitida</span><b>${r.bracket?euro(r.bracket.min_base)+' – '+euro(r.bracket.max_base):'—'}</b></div>
   <div class="ops-metric-line"><span>Cuota orientativa del tramo</span><b>${r.bracket?euro(r.minQuota)+' – '+euro(r.maxQuota):'—'}</b></div>
   <div class="ops-metric-line"><span>Cuota actual</span><b>${euro(actual)}</b></div>
   <div class="ops-note ${!r.bracket?'warn':retaDelta<0?'warn':'ok'}">${!r.bracket?'No se ha podido ubicar el rendimiento en un tramo.':retaDelta<0?`La cuota actual está aproximadamente ${euro(Math.abs(retaDelta))}/mes por debajo de la referencia mínima del tramo. Conviene revisarlo antes de una regularización.`:`La cuota actual está dentro o por encima de la referencia mínima del tramo proyectado.`}</div>
  </div>
 </div>
 <div class="ops-grid">
  <div class="ops-card" id="fiscal_irpf"><div class="section-head"><div><div class="eyebrow">Modelo 130</div><h3>Previsión IRPF T${O.quarter}</h3></div></div><div class="ops-metric-line"><span>Ingresos</span><b>${euro(f.income)}</b></div><div class="ops-metric-line"><span>Gastos + difícil justificación</span><b>${euro(f.raw+f.diff)}</b></div><div class="ops-metric-line"><span>Rendimiento</span><b>${euro(f.net)}</b></div><div class="ops-metric-line"><span>130 pendiente estimado</span><b>${euro(f.pending130)}</b></div><div class="ops-metric-line"><span>111</span><b>${euro(f.m111)}</b></div><div class="ops-metric-line"><span>115</span><b>${euro(f.m115)}</b></div></div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Simulador</div><h3>Gasto real previsto</h3></div></div><label>Gasto deducible adicional</label><input inputmode="decimal" value="${H(O.plannedSpend||'')}" oninput="opsPlannedSpend(this.value)" placeholder="0,00"><div class="ops-metric-line"><span>130 pendiente con simulación</span><b id="ops_sim_130">${euro(sim.pending130)}</b></div><div class="ops-metric-line"><span>Reserva con simulación</span><b id="ops_sim_reserve">${euro(sim.reserve)}</b></div><div class="ops-metric-line"><span>Diferencia frente a situación actual</span><b id="ops_sim_delta">${euro(f.pending130-sim.pending130)}</b></div><div class="small">No guarda nada. Sirve para probar una compra/gasto real antes de registrarlo.</div></div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Personal</div><h3>Costes laborales y colaboradores</h3></div></div><div class="ops-metric-line"><span>Empleados históricos registrados</span><b>${people.filter(x=>x.person_type==='employee').length}</b></div><div class="ops-metric-line"><span>Colaboradora familiar activa</span><b>${activeFamily.length?H(activeFamily.map(x=>x.full_name).join(', ')):'—'}</b></div><div class="small">Nóminas y Seguridad Social empresa se mantienen separadas del RETA titular y de la colaboradora familiar. La aportación a colaboradora solo se contabiliza cuando se registra realmente como gasto.</div></div>
 </div>
 <div class="ops-card" id="fiscal_fuentes">
  <div class="section-head"><div><div class="eyebrow">Fuentes y cuadre</div><div class="ops-title-line"><h3>Conciliaciones documentadas</h3>${infoButton('fiscal.conciliacion','Por qué pueden existir diferencias con una fuente')}</div><div class="small">Totus conserva la fuente original y explica cualquier diferencia aplicada al cálculo. No se corrigen datos históricos inventando.</div></div></div>
  ${(()=>{const rows=(E.reconciliationNotes||[]).filter(x=>x.active!==false&&x.fiscal_year===O.year&&(x.quarter==null||N(x.quarter)<=O.quarter));return rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Periodo</th><th>Fuente</th><th>Incidencia</th><th>Diferencia</th><th>Criterio aplicado</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.quarter?'T'+H(String(x.quarter))+' · ':''}${H(String(x.fiscal_year||''))}</td><td>${H(x.source_name||'—')}</td><td><b>${H(String(x.issue_type||'').replaceAll('_',' '))}</b><div class="small">${H(x.detail||'')}</div></td><td class="num">${x.amount_difference==null?'—':euro(x.amount_difference)}</td><td>${H(x.resolution||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay diferencias documentadas para este periodo.</div>'})()}
 </div>
 ${taxPaymentsHtml()}
 </div>`;
}
function managerExpenseRows(from,to){
  const headers=['Orden','Fecha','Nº fra. recibida','Nº fra. proveedor','Rt','NIF/CIF','Razón social','Concepto','Base IVA','% IVA','Cuota IVA','Base R.E.','% R.E.','Cuota R.E.','Imputable a IRPF','Base retención','% retención','Cuota retenida','Total factura','Neto pagado'];
  const rows=[];
  const source=E.gestorRows.filter(r=>inRange(r.expense_date,from,to)&&!r.tax_support_line);
  const importedOperational=O.expenses.filter(e=>e.source==='importacion_gestor'&&inRange(e.expense_date,from,to));
  const correctedInvoice=r=>{
    const original=String(r.supplier_invoice_no||'').trim();
    if(original&&!original.endsWith('-'))return original;
    const matches=importedOperational.filter(e=>
      e.expense_date===r.expense_date &&
      (
        (r.supplier_tax_id&&String(e.supplier_tax_id||'').replace(/[^A-Z0-9]/gi,'').toUpperCase()===String(r.supplier_tax_id).replace(/[^A-Z0-9]/gi,'').toUpperCase()) ||
        String(e.supplier_name||'').toUpperCase().includes(String(r.supplier_name||'').split(' ')[0].toUpperCase())
      ) &&
      (!original||String(e.invoice_number||'').startsWith(original))
    );
    return matches.length===1&&matches[0].invoice_number?matches[0].invoice_number:original;
  };
  const sourceGroups=new Map();
  source.forEach(r=>{
    const key=[r.expense_date,r.received_invoice_ref||'',correctedInvoice(r),r.supplier_tax_id||'',r.supplier_name||''].join('|');
    if(!sourceGroups.has(key))sourceGroups.set(key,[]);
    sourceGroups.get(key).push(r);
  });
  for(const group of sourceGroups.values()){
    const gross=sum(group,r=>N(r.base_vat)+N(r.vat_amount)+N(r.re_amount));
    const withheld=sum(group,r=>N(r.withholding_amount));
    group.forEach((r,idx)=>rows.push([
      N(r.order_no),reportDate(r.expense_date),r.received_invoice_ref||'',correctedInvoice(r),'',
      r.supplier_tax_id||'',r.supplier_name||'',r.concept_text,
      N(r.base_vat),N(r.vat_rate),N(r.vat_amount),N(r.re_base),N(r.re_rate),N(r.re_amount),
      N(r.base_vat)+N(r.vat_amount)+N(r.re_amount),N(r.withholding_base),N(r.withholding_rate),N(r.withholding_amount),
      idx===0?gross:'',idx===0?gross-withheld:''
    ]));
  }
  const lineMap=new Map();
  O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
  let order=Math.max(0,...rows.map(r=>N(r[0])));
  O.expenses
   .filter(e=>!e.management_only&&e.expense_date>='2026-07-01'&&inRange(e.expense_date,from,to)&&(e.source!=='importacion_excel'||e.fiscal_reviewed))
   .sort((x,y)=>x.expense_date.localeCompare(y.expense_date)||String(x.invoice_number||'').localeCompare(String(y.invoice_number||'')))
   .forEach(e=>{
     const lines=lineMap.get(e.id)||[];
     const gross=N(e.accounting_amount||e.gross_expense)||sum(lines,l=>N(l.base_amount)+N(l.vat_amount)+N(l.re_amount));
     const withheld=sum(lines,l=>N(l.withholding_amount));
     lines.forEach((l,idx)=>{
       const cat=O.categories.find(x=>x.id===l.category_id);
       const deductible=l.deductible_irpf!==false&&!l.fixed_asset;
       const base=N(l.base_amount),vat=N(l.vat_amount),re=N(l.re_amount);
       rows.push([
         ++order,reportDate(e.expense_date),'',e.invoice_number||'','',e.supplier_tax_id||'',e.supplier_name||'',(cat?.name||l.description||'').toUpperCase(),
         base,N(l.vat_rate),vat,N(l.re_base),N(l.re_rate),re,
         deductible?base+vat+re:0,N(l.withholding_base),N(l.withholding_rate),N(l.withholding_amount),
         idx===0?gross:'',idx===0?N(e.amount_paid||gross-withheld):''
       ]);
     });
   });
  const parseDate=x=>String(x).split('/').reverse().join('-');
  rows.sort((x,y)=>parseDate(x[1]).localeCompare(parseDate(y[1]))||N(x[0])-N(y[0]));
  const last=rows.length+1;
  const totalRow=['','','','','','','','TOTAL ACUMULADO',
   `=SUM(I2:I${last})`,'',`=SUM(K2:K${last})`,`=SUM(L2:L${last})`,'',`=SUM(N2:N${last})`,`=SUM(O2:O${last})`,`=SUM(P2:P${last})`,'',`=SUM(R2:R${last})`,`=SUM(S2:S${last})`,`=SUM(T2:T${last})`];
  return[headers,...rows,totalRow];
}
function managerExpenseSummaryRows(from,to){
 const groups=new Map();
 const add=(code,description,base=0,vat=0,reBase=0,re=0,irpf=0,retBase=0,ret=0)=>{
  const key=String(code||'')+'|'+String(description||'SIN CONCEPTO').toUpperCase();
  if(!groups.has(key))groups.set(key,{code:String(code||''),description:String(description||'SIN CONCEPTO').toUpperCase(),base:0,vat:0,reBase:0,re:0,irpf:0,retBase:0,ret:0});
  const g=groups.get(key);g.base+=N(base);g.vat+=N(vat);g.reBase+=N(reBase);g.re+=N(re);g.irpf+=N(irpf);g.retBase+=N(retBase);g.ret+=N(ret);
 };
 E.gestorRows.filter(r=>inRange(r.expense_date,from,to)).forEach(r=>add(r.concept_code,r.concept_text,r.base_vat,r.vat_amount,r.re_base,r.re_amount,r.imputable_irpf,r.withholding_base,r.withholding_amount));
 const lineMap=new Map();O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
 O.expenses.filter(e=>!e.management_only&&e.expense_date>='2026-07-01'&&inRange(e.expense_date,from,to)&&(e.source!=='importacion_excel'||e.fiscal_reviewed)).forEach(e=>(lineMap.get(e.id)||[]).forEach(l=>{
  const c=O.categories.find(x=>x.id===l.category_id),deductible=l.deductible_irpf!==false&&!l.fixed_asset;
  const base=N(l.base_amount),vat=N(l.vat_amount),re=N(l.re_amount),tax=vat+re;
  add(c?.manager_code||'',c?.name||l.description,base,vat,N(l.re_base),re,deductible?base:0,N(l.withholding_base),N(l.withholding_amount));
  if(tax)add('632','IVA SOPORTADO(RECARGO - REAGYP)',0,0,0,0,deductible?tax:0,0,0);
 }));
 const body=[...groups.values()].sort((a,b)=>String(a.code).localeCompare(String(b.code))||a.description.localeCompare(b.description)).map(g=>[g.code,g.description,g.base,g.vat,g.reBase,g.re,g.irpf,g.retBase,g.ret]);
 const last=body.length+1;
 return [['Código','Descripción','Base IVA','Cuota IVA','Base R. Equiv.','Cuota R. Equiv.','Imputable IRPF','Base retención','Cuota retenida'],
  ...body,['','TOTAL',`=SUM(C2:C${last})`,`=SUM(D2:D${last})`,`=SUM(E2:E${last})`,`=SUM(F2:F${last})`,`=SUM(G2:G${last})`,`=SUM(H2:H${last})`,`=SUM(I2:I${last})`]];
}
function managerIncomeRows(from,to){
 const headers=['Orden','Fecha','Nº factura','Rect.','Identificación del Cliente','Concepto','Base IVA','%','Cuota IVA','Base R. Equiv.','% R.Eq.','Cuota R.Equiv.','Imputable a IRPF','Base retención','% ret.','Cuota retenida'];
 const groups=new Map();
 E.historicalIncome.filter(x=>x.period_start>=from&&x.period_end<=to).forEach(x=>groups.set(x.store_id+'|'+x.period_start.slice(0,7),{store:x.store_id,date:x.period_end,total:N(x.fiscal_basis_income??x.total_income),historical:true}));
 O.closings.filter(c=>c.include_in_income!==false&&inRange(c.business_date,from,to)&&!coveredByHistoricalIncome(c)).forEach(c=>{
   const k=c.store_id+'|'+c.business_date.slice(0,7),v=groups.get(k)||{store:c.store_id,date:new Date(+c.business_date.slice(0,4),+c.business_date.slice(5,7),0).toISOString().slice(0,10),total:0};
   v.total+=N(c.cash_sales)+N(c.card_sales)+N(c.bizum_sales)+N(c.online_sales)+N(c.other_income);groups.set(k,v)
 });
 let i=0;
 const rows=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||storeName(a.store).localeCompare(storeName(b.store))).map(v=>{
   const m=+v.date.slice(5,7),y=v.date.slice(2,4),sn=storeName(v.store).toUpperCase(),alc=sn.includes('NEW');
   const ref=`${monthName(m)}${y}${alc?'ALC':''}`;
   return[++i,reportDate(v.date),ref,'',`VENTAS ${monthName(m)} ${alc?'ALCALA':'AZUQUECA'}`,'VENTAS - INGRESOS',v.total,0,0,0,0,0,v.total,0,0,0]
 });
 const last=rows.length+1;
 return[headers,...rows,['','','','','','TOTAL ACUMULADO',`=SUM(G2:G${last})`,'',0,0,'',0,`=SUM(M2:M${last})`,0,'',0]];
}
function dailyColorGroup(desc=''){
 const x=String(desc).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(!x.trim())return '';
 if(/irpf|modelo\s*130|modelo\s*111|modelo\s*115/.test(x))return 'IRPF';
 if(/nomina|seguridad social|autonom|horas extra|emplead/.test(x))return 'Personal';
 if(/almacen/.test(x))return 'Interno';
 if(/vaperalia|ecig|garden|mg vape|cold ?smok|shisha|capsula|only ?cbd|weedup|peninsula|1001|cachimba|mercader|producto/.test(x))return 'Pedidos';
 if(/alquiler|gestor|pepe|iber|factoria|microsoft|office|prosegur|seguro|mantenimiento|comision|nacex|pepenergy|suministro|internet|telefono|luz/.test(x))return 'Fijos';
 if(/^salida |^cash:/.test(x))return 'Nota';
 return 'Otros';
}
function wbBlob(sheets){
 if(!window.XLSX)throw new Error('Excel no disponible');
 const wb=XLSX.utils.book_new();
 const palettes={GASTOS:['4472C4','D9E2F3'],INGRESOS:['4472C4','D9E2F3'],RESUMEN:['17365D','D9E2F3'],default:['334155','E2E8F0']};
 const dailyFills={Pedidos:'00B0F0',Fijos:'FFFF00',Personal:'FFC000',IRPF:'92D050',Interno:'0070C0',Otros:'00B050'};
 for(const [name,rows] of Object.entries(sheets)){
  const ws=XLSX.utils.aoa_to_sheet(rows),upper=name.toUpperCase();
  const isDaily=rows?.[1]?.[0]==='Dia'&&rows?.[1]?.[1]==='Gastos';
  for(const addr of Object.keys(ws)){
   if(addr[0]==='!')continue;
   const cell=ws[addr];
   if(typeof cell?.v==='string'&&cell.v.startsWith('=')){cell.f=cell.v.slice(1);cell.t='n';cell.v=0}
  }
  const palette=palettes[upper]||palettes[upper.includes('GAST')?'GASTOS':upper.includes('INGRES')?'INGRESOS':upper.includes('RESUM')?'RESUMEN':'default'];
  const ref=ws['!ref']?XLSX.utils.decode_range(ws['!ref']):{s:{r:0,c:0},e:{r:0,c:0}};
  const widthCount=Math.max(1,...rows.map(r=>r.length));
  if(isDaily){
   ws['!merges']=[XLSX.utils.decode_range('A1:E1')];
   ws['!cols']=[{wch:15},{wch:38},{wch:14},{wch:14},{wch:18}];
   ws['!rows']=rows.map((_,i)=>({hpt:i===0?23:i===1?22:19}));
   ws['!freeze']={xSplit:0,ySplit:2,topLeftCell:'A3',activePane:'bottomLeft',state:'frozen'};
   ws['!autofilter']={ref:`A2:E${Math.max(2,rows.length)}`};
   for(let r=ref.s.r;r<=ref.e.r;r++)for(let col=ref.s.c;col<=ref.e.c;col++){
    const addr=XLSX.utils.encode_cell({r,c:col}),cell=ws[addr];if(!cell)continue;
    const isTitle=r===0,isHeader=r===1,row=rows[r]||[],label=String(row[1]||''),group=dailyColorGroup(label);
    const isSummary=['Otros','SS y nóminas','Pedidos','Gastos fijos','IRPF','TOTAL'].includes(label);
    const zebra=r>=2&&!isSummary&&(r%2===0?'DCE6F1':'FFFFFF');
    let fill=isTitle?'000000':isHeader?'4F81BD':zebra;
    let fontColor=isTitle?'FFFF00':isHeader?'FFFFFF':'111111';
    let bold=isTitle||isHeader||col===0||isSummary;
    if(col===1&&group&&group!=='Nota'&&!isSummary){fill=dailyFills[group]||fill;fontColor=group==='Interno'?'FFFFFF':'111111'}
    if(isSummary){
      const sm={Otros:'00B050','SS y nóminas':'FFC000',Pedidos:'00B0F0','Gastos fijos':'FFFF00',IRPF:'92D050',TOTAL:'FF0000'};
      if(col===1)fill=sm[label]||fill;
      if(label==='TOTAL'&&col===1)fontColor='000000';
    }
    cell.s={
      font:{name:'Calibri',sz:isTitle?11:10,bold,color:{rgb:fontColor}},
      fill:{fgColor:{rgb:fill}},
      alignment:{vertical:'center',horizontal:isTitle?'center':(isHeader?'center':(typeof cell.v==='number'?'right':'left')),wrapText:true},
      border:{top:{style:'thin',color:{rgb:'8EA9DB'}},bottom:{style:'thin',color:{rgb:'8EA9DB'}},left:{style:'thin',color:{rgb:'D9E2F3'}},right:{style:'thin',color:{rgb:'D9E2F3'}}}
    };
    if(typeof cell.v==='number')cell.z='#,##0.00;[Red]-#,##0.00';
   }
  }else{
   ws['!cols']=Array.from({length:widthCount},(_,i)=>{
    let max=10;for(const row of rows){const v=row[i];if(v!=null)max=Math.max(max,String(v).length+2)}
    const textHeavy=i===5||i===6||i===1;return{wch:Math.min(textHeavy?38:22,max)};
   });
   ws['!rows']=rows.map((_,i)=>({hpt:i===0?24:19}));
   ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
   if(rows.length&&rows[0].length)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,rows.length-1),c:rows[0].length-1}})};
   for(let r=ref.s.r;r<=ref.e.r;r++)for(let col=ref.s.c;col<=ref.e.c;col++){
    const addr=XLSX.utils.encode_cell({r,c:col}),cell=ws[addr];if(!cell)continue;
    cell.s={font:{name:'Calibri',sz:r===0?10:9,bold:r===0,color:{rgb:r===0?'FFFFFF':'1F2937'}},fill:{fgColor:{rgb:r===0?palette[0]:'FFFFFF'}},alignment:{vertical:'center',horizontal:r===0?'center':(typeof cell.v==='number'?'right':'left'),wrapText:true},border:{top:{style:'thin',color:{rgb:'D7DEE7'}},bottom:{style:'thin',color:{rgb:'D7DEE7'}},left:{style:'thin',color:{rgb:'E5E7EB'}},right:{style:'thin',color:{rgb:'E5E7EB'}}}};
    if(typeof cell.v==='number')cell.z='#,##0.00;[Red]-#,##0.00';
    if(r>0&&rows[r]?.some(v=>String(v||'').toUpperCase().includes('TOTAL'))){
      cell.s.font={name:'Calibri',sz:9,bold:true,color:{rgb:'111827'}};
      cell.s.fill={fgColor:{rgb:palette[1]}};
      cell.s.border={top:{style:'medium',color:{rgb:palette[0]}},bottom:{style:'thin',color:{rgb:palette[0]}}};
    }
   }
  }
  XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
 }
 return new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array',cellStyles:true})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function dailyWorkbook(storeId,year){
 const sheets={};
 const weekdays=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 for(let m=1;m<=12;m++){
  const first=`${year}-${String(m).padStart(2,'0')}-01`,last=new Date(year,m,0).toISOString().slice(0,10);
  const byDate=new Map();
  const add=(date,row)=>{if(!byDate.has(date))byDate.set(date,[]);byDate.get(date).push(row)};
  E.legacyRows.filter(r=>r.store_id===storeId&&inRange(r.row_date,first,last)).forEach(r=>{
    add(r.row_date,{desc:r.description||'',price:N(r.expense_amount)||'',card:N(r.card_amount)||'',cash:N(r.cash_withdrawal)||'',source:'legacy'});
  });
  const maxLegacy=E.legacyRows.filter(r=>r.store_id===storeId&&r.row_date).reduce((x,r)=>r.row_date>x?r.row_date:x,'');
  O.expenses.filter(e=>e.store_id===storeId&&inRange(e.expense_date,first,last)&&(!maxLegacy||e.expense_date>maxLegacy)).forEach(e=>{
    add(e.expense_date,{desc:e.supplier_name||e.description||'Gasto',price:N(e.accounting_amount||e.gross_expense),card:'',cash:'',source:'new'});
  });
  O.closings.filter(c=>c.store_id===storeId&&inRange(c.business_date,first,last)&&(!maxLegacy||c.business_date>maxLegacy)).forEach(c=>{
    add(c.business_date,{desc:'',price:'',card:N(c.card_sales)||'',cash:N(c.cash_withdrawals)||'',source:'new'});
  });
  const rows=[[`${monthName(m)} ${year}`,'','','',''],['Dia','Gastos','Precio','Tarjeta','Salida de caja']];
  const grouped={Otros:[],Personal:[],Pedidos:[],Fijos:[],IRPF:[]};
  [...byDate.keys()].sort().forEach(date=>{
    const entries=byDate.get(date),d=new Date(date+'T12:00:00'),label=`${Number(date.slice(8,10))} ${weekdays[d.getDay()]}`;
    entries.forEach((r,i)=>{
      rows.push([i===0?label:'',r.desc,r.price,r.card,r.cash]);
      const g=dailyColorGroup(r.desc);if(r.price!==''&&N(r.price)!==0){
        const key=g==='Personal'?'Personal':g==='Pedidos'?'Pedidos':g==='Fijos'||g==='Interno'?'Fijos':g==='IRPF'?'IRPF':'Otros';
        grouped[key].push(rows.length);
      }
    });
  });
  const dataEnd=rows.length;
  const sumRefs=indexes=>indexes.length?`=SUM(${indexes.map(r=>'C'+r).join(',')})`:'=0';
  rows.push(['','','','','']);
  rows.push(['','Otros',sumRefs(grouped.Otros),'','']);
  rows.push(['','SS y nóminas',sumRefs(grouped.Personal),'','']);
  rows.push(['','Pedidos',sumRefs(grouped.Pedidos),'','']);
  rows.push(['','Gastos fijos',sumRefs(grouped.Fijos),'','']);
  rows.push(['','IRPF',sumRefs(grouped.IRPF),'','']);
  rows.push(['','TOTAL',`=SUM(C3:C${dataEnd})`,`=SUM(D3:D${dataEnd})`,`=SUM(E3:E${dataEnd})`]);
  sheets[monthName(m)[0]+monthName(m).slice(1).toLowerCase()]=rows;
 }
 return wbBlob(sheets);
}
function managementClosingRows(from,to){
 return [['Fecha','Establecimiento','Apertura','Efectivo vendido','Tarjeta','Bizum','Online','Otros cobros','Retirada de caja','Gastos pagados desde caja','Entrada extra a caja','Salida extra de caja','Metálico final','Ventas calculadas','Total control','Diferencia','Estado'],
  ...O.closings.filter(c=>inRange(c.business_date,from,to)).sort((a,b)=>String(a.business_date).localeCompare(String(b.business_date))||storeName(a.store_id).localeCompare(storeName(b.store_id))).map(c=>[
   c.business_date,storeName(c.store_id),N(c.opening_cash),N(c.cash_sales),N(c.card_sales),N(c.bizum_sales),N(c.online_sales),N(c.other_income),
   N(c.cash_withdrawals),N(c.cash_expenses_declared),N(c.cash_extra_in),N(c.cash_extra_out),N(c.actual_cash),
   N(c.cash_sales)+N(c.card_sales)+N(c.bizum_sales)+N(c.online_sales)+N(c.other_income),
   c.reported_total_sales==null?'':N(c.reported_total_sales),c.reported_total_sales==null?'':N(c.difference),c.status||''
  ])
 ];
}
window.opsDownloadDailyExcel=function(storeId){try{dlBlob(dailyWorkbook(storeId,O.year),`Gastos_y_ventas_${storeName(storeId).replace(/\s+/g,'_')}_${O.year}.xlsx`)}catch(e){alert(e.message)}};
window.opsDownloadManagerExpenses=function(){try{dlBlob(wbBlob({'GASTOS':managerExpenseRows(O.reportFrom,O.reportTo),'DESGLOSE CONCEPTOS':managerExpenseSummaryRows(O.reportFrom,O.reportTo)}),`GASTOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`)}catch(e){alert(e.message)}};
window.opsDownloadManagerIncome=function(){try{dlBlob(wbBlob({'INGRESOS':managerIncomeRows(O.reportFrom,O.reportTo)}),`INGRESOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`)}catch(e){alert(e.message)}};
function fiscalRows(){const f=fiscalProjection();const r=retaProjection();return[['Concepto','Importe'],['Ingresos acumulados',f.income],['Gastos deducibles',f.raw],['Difícil justificación',f.diff],['Rendimiento neto',f.net],['Modelo 130 estimado',f.payable],['Modelo 111',f.m111],['Modelo 115',f.m115],['Reserva total',f.reserve],['Rendimiento mensual RETA',r.monthly]]}
window.opsManagementWorkbook=function(){const close=managementClosingRows(O.reportFrom,O.reportTo);const inv=[['Fecha','Tipo','Número','Cliente','NIF/CIF','Estado','Cobro','Base','IVA','Total','Serie'],...O.invoices.filter(i=>inRange(i.issue_date,O.reportFrom,O.reportTo)).sort((a,b)=>String(a.issue_date||'').localeCompare(String(b.issue_date||''))).map(i=>[i.issue_date,i.invoice_kind==='rectifying'?'rectificativa':i.document_type,i.display_number||'',i.customer_name,i.customer_tax_id||'',i.status,i.paid_status||'',N(i.base_amount),N(i.vat_amount),N(i.total_amount),O.series.find(s=>s.id===i.series_id)?.code||''])];dlBlob(wbBlob({Resumen:fiscalRows(),Cierres:close,Gastos:managerExpenseRows(O.reportFrom,O.reportTo),'Desglose conceptos':managerExpenseSummaryRows(O.reportFrom,O.reportTo),Facturas:inv}),`Totus_Gestion_${O.reportFrom}_${O.reportTo}.xlsx`)};
window.opsFiscalPdf=function(){if(!window.jspdf?.jsPDF)return alert('PDF no disponible');const {jsPDF}=window.jspdf,d=new jsPDF(),f=fiscalProjection(),r=retaProjection();d.setFontSize(18);d.text(`Totus Central · Fiscal T${O.quarter} ${O.year}`,15,18);d.setFontSize(10);let y=32;[['Ingresos acumulados',f.income],['Gastos deducibles',f.raw+f.diff],['Rendimiento neto',f.net],['Modelo 130 estimado',f.payable],['Modelo 111',f.m111],['Modelo 115',f.m115],['Reserva fiscal',f.reserve],['RETA mensual proyectado',r.monthly]].forEach(x=>{d.text(x[0],15,y);d.text(euro(x[1]),195,y,{align:'right'});y+=8});d.setFontSize(8);d.text('Control interno basado en los datos de Totus y los cierres de gestoría importados. Validar antes de presentar modelos oficiales.',15,y+8,{maxWidth:180});dlBlob(d.output('blob'),`Fiscal_T${O.quarter}_${O.year}.pdf`)};
function gestorDocFolder(doc,base){
 const dt=doc.document_date||'sin_fecha';
 const year=dt.slice(0,4)||'SIN_ANO';
 const month=dt.slice(5,7)||'SIN_MES';
 const q=dt.length>=7?'T'+(Math.floor((Number(month)-1)/3)+1):'SIN_TRIMESTRE';
 const store=doc.store_id?(O.stores.find(x=>x.id===doc.store_id)?.code||'TIENDA'):'GENERAL';
 const type=String(doc.doc_type||'otro').replace(/[^a-zA-Z0-9_-]+/g,'_');
 const party=String(doc.supplier_or_customer||'SIN_PROVEEDOR').replace(/[^a-zA-Z0-9._-]+/g,'_');
 return [base,'05_DOCUMENTOS',year,q,month,store,type,party].join('/');
}
window.opsGestorPack=async function(){
 if(!window.JSZip||!window.XLSX)return alert('ZIP/Excel no disponible');
 const z=new JSZip(),base=`GESTORIA_${O.reportFrom}_${O.reportTo}`;
 z.file(base+`/01_INGRESOS/INGRESOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`,wbBlob({'INGRESOS':managerIncomeRows(O.reportFrom,O.reportTo)}));
 z.file(base+`/02_GASTOS/GASTOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`,wbBlob({'GASTOS':managerExpenseRows(O.reportFrom,O.reportTo),'DESGLOSE CONCEPTOS':managerExpenseSummaryRows(O.reportFrom,O.reportTo)}));
 for(const st of O.stores){
  z.file(base+`/03_DIARIOS/Diario_${storeName(st.id).replace(/\s+/g,'_')}_${O.year}.xlsx`,dailyWorkbook(st.id,O.year));
 }
 const close=managementClosingRows(O.reportFrom,O.reportTo);
 z.file(base+`/04_RESUMEN/Totus_Gestion_${O.reportFrom}_${O.reportTo}.xlsx`,wbBlob({
   Resumen:fiscalRows(),
   Cierres:close,
   Gastos:managerExpenseRows(O.reportFrom,O.reportTo),
   Ingresos:managerIncomeRows(O.reportFrom,O.reportTo)
 }));
 const internalExpenseIds=new Set(O.expenses.filter(e=>e.management_only).map(e=>e.id));
 const docs=O.documents
  .filter(d=>inRange(d.document_date,O.reportFrom,O.reportTo))
  .filter(d=>!(d.linked_entity_type==='expense'&&internalExpenseIds.has(d.linked_entity_id)))
  .sort((a,b)=>String(a.document_date||'').localeCompare(String(b.document_date||''))||String(a.supplier_or_customer||'').localeCompare(String(b.supplier_or_customer||'')));
 const missingDocs=[];
 for(const doc of docs){
   const {data,error}=await sb.storage.from('business-documents').download(doc.storage_path);
   if(error){missingDocs.push(`${doc.document_date||'sin_fecha'} · ${doc.supplier_or_customer||'sin proveedor'} · ${doc.invoice_number||'sin número'} · ${doc.original_name}`);continue}
   const inv=String(doc.invoice_number||'SIN_NUMERO').replace(/[^a-zA-Z0-9._-]+/g,'_');
   const original=String(doc.original_name||'documento').replace(/[^a-zA-Z0-9._-]+/g,'_');
   z.file(gestorDocFolder(doc,base)+`/${doc.document_date||'sin_fecha'}_${inv}_${original}`,data);
 }
 if(missingDocs.length)throw new Error('Paquete no generado: faltan '+missingDocs.length+' documentos físicos. '+missingDocs.join(' | '));
 z.file(base+'/00_LEEME.txt',
   'PAQUETE DE GESTORIA GENERADO POR TOTUS CENTRAL\r\n\r\n'+
   '01_INGRESOS: estructura de ingresos facilitada por gestoría.\r\n'+
   '02_GASTOS: estructura de gastos facilitada por gestoría.\r\n'+
   '03_DIARIOS: libros diarios de Hortimatic y NewOldSmok.\r\n'+
   '04_RESUMEN: libro global de control.\r\n'+
   '05_DOCUMENTOS: año > trimestre > mes > establecimiento > tipo > proveedor/cliente.\r\n\r\n'+
   'Los gastos marcados como SOLO CONTROL INTERNO no se incluyen en los ficheros ni documentos para gestoría.\r\n'+
   'Periodo: '+O.reportFrom+' a '+O.reportTo+'\r\n'
 );
 dlBlob(await z.generateAsync({type:'blob'}),`PAQUETE_GESTOR_${O.reportFrom}_${O.reportTo}.zip`);
};
function reportsHtml(){return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Descargas</div><div class="ops-title-line"><h3>Informes, Excel diario y gestoría</h3>${infoButton('informes','Ayuda sobre informes')}</div><div class="small">Orden cronológico y columnas alineadas con tus hojas y los informes de gestoría.</div></div></div><div class="ops-filters"><div><label>Desde</label><input type="date" value="${H(O.reportFrom)}" onchange="opsReportField('from',this.value)"></div><div><label>Hasta</label><input type="date" value="${H(O.reportTo)}" onchange="opsReportField('to',this.value)"></div></div><div class="ops-grid-3" style="margin-top:14px"><div class="ops-card"><h4>Gastos · formato gestoría</h4><p class="small">Orden, fecha, factura, identificación, concepto, IVA, RE, IRPF y retenciones.</p><button class="secondary" onclick="opsDownloadManagerExpenses()">Descargar XLSX</button></div><div class="ops-card"><h4>Ingresos · formato gestoría</h4><p class="small">Resumen mensual por Azuqueca/Hortimatic y Alcalá/NewOldSmok.</p><button class="secondary" onclick="opsDownloadManagerIncome()">Descargar XLSX</button></div><div class="ops-card"><h4>Excel diario Hortimatic</h4><p class="small">12 hojas: Día · Gastos · Precio · Tarjeta · Salida de caja.</p><button class="secondary" onclick="opsDownloadDailyExcel('${O.stores.find(s=>s.code==='HORTIMATIC')?.id||''}')">Descargar XLSX</button></div><div class="ops-card"><h4>Excel diario NewOldSmok</h4><p class="small">Misma estructura que tu libro actual.</p><button class="secondary" onclick="opsDownloadDailyExcel('${O.stores.find(s=>s.code==='NEWOLDSMOK')?.id||''}')">Descargar XLSX</button></div><div class="ops-card"><h4>Libro completo Totus</h4><p class="small">Resumen, cierres, gastos y facturación en un único Excel.</p><button class="secondary" onclick="opsManagementWorkbook()">Descargar XLSX</button></div><div class="ops-card"><h4>Informe fiscal</h4><p class="small">130, 111, 115, resultado y RETA orientativo.</p><button class="secondary" onclick="opsFiscalPdf()">Descargar PDF</button></div><div class="ops-card"><h4>Documentos</h4><p class="small">Archivos de la franja seleccionada ordenados por fecha.</p><button class="secondary" onclick="opsZipReportDocs()">Descargar ZIP</button></div><div class="ops-card report-card featured"><div class="ops-title-line"><h4>Paquete gestor</h4>${infoButton('informes.gestor','Qué incluye el paquete')}</div><p class="small">Carpetas 01_INGRESOS · 02_GASTOS · 03_DIARIOS · 04_RESUMEN · 05_DOCUMENTOS, con un LEEME y sin gastos internos.</p><button class="primary" onclick="opsGestorPack()">Preparar paquete gestor</button></div></div></div>`}

function adminLogHtml(){
 if(!manager())return '<div class="ops-card">Sin acceso.</div>';
 const merged=[
  ...E.auditRows.map(x=>({ts:x.created_at,kind:'Actividad',user:x.user_email||'—',area:x.area||'',action:x.action||'',entity:x.entity_id||'',detail:x.detail||{}})),
  ...E.revisionRows.map(x=>({ts:x.created_at,kind:'Revisión',user:x.user_email||'—',area:x.entity_type||'',action:x.action||'',entity:x.entity_id||'',detail:{motivo:x.reason,...(x.metadata||{})}}))
 ].sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).slice(0,500);
 return `${window.adminStripHtml?window.adminStripHtml('log'):''}<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trazabilidad</div><h3>Log general</h3><div class="small">Actividad operativa y cambios administrativos sensibles en un único historial.</div></div><button class="secondary" onclick="opsExportAdminLog()">Exportar CSV</button></div>${merged.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Usuario</th><th>Área</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${merged.map(x=>`<tr><td>${H(new Date(x.ts).toLocaleString('es-ES'))}</td><td>${H(x.kind)}</td><td>${H(x.user)}</td><td>${H(x.area)}</td><td><b>${H(x.action)}</b></td><td><div class="ops-tiny">${H(JSON.stringify(x.detail))}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">Aún no hay actividad registrada.</div>'}</div>`;
}
window.opsExportAdminLog=function(){
 const rows=[['Fecha','Tipo','Usuario','Área','Acción','Entidad','Detalle']];
 E.auditRows.forEach(x=>rows.push([x.created_at,'Actividad',x.user_email||'',x.area||'',x.action||'',x.entity_id||'',JSON.stringify(x.detail||{})]));
 E.revisionRows.forEach(x=>rows.push([x.created_at,'Revisión',x.user_email||'',x.entity_type||'',x.action||'',x.entity_id||'',JSON.stringify({motivo:x.reason,...(x.metadata||{})})]));
 rows.splice(1,rows.length-1,...rows.slice(1).sort((a,b)=>String(b[0]).localeCompare(String(a[0]))));
 const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\n');
 dlBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),`Totus_log_${today()}.csv`);
};

const BACKUP_TABLES=['brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices','price_history','consultations','consultation_history','team_members','ops_business_settings','ops_stores','ops_cash_drawers','ops_daily_closings','ops_daily_closing_drawers','ops_expense_categories','ops_suppliers','ops_personnel','ops_expenses','ops_expense_lines','ops_customers','ops_document_templates','ops_invoice_series','ops_sales_invoices','ops_sales_invoice_lines','ops_documents','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_historical_income_periods','ops_legacy_daily_rows','ops_gestor_source_rows','ops_gestor_quarter_summary','ops_fiscal_reference_periods','ops_import_batches','ops_reconciliation_notes','ops_reta_brackets','ops_audit_log','ops_entity_revisions'];
async function buildBackupBlob(){
 if(!admin())throw new Error('Solo administración puede generar copias.');
 const zip=new JSZip(),manifest={format:'totusbackup',version:1,created_at:new Date().toISOString(),app:'Totus Central',tables:{},files:[]};
 for(const table of BACKUP_TABLES){
  const rows=await all(table);manifest.tables[table]=rows.length;zip.file('data/'+table+'.json',JSON.stringify(rows));
 }
 const storageSets=[['business-documents',O.documents.map(d=>({path:d.storage_path,name:d.original_name}))],['business-assets',E.templates.filter(t=>t.logo_path).map(t=>({path:t.logo_path,name:t.logo_name||'logo'}))]];
 for(const [bucket,items] of storageSets){for(const item of items){if(!item.path)continue;const {data,error}=await sb.storage.from(bucket).download(item.path);if(error)throw new Error('No se pudo incluir '+item.path+': '+error.message);zip.file('storage/'+bucket+'/'+item.path,data);manifest.files.push({bucket,path:item.path,size:data.size})}}
 zip.file('manifest.json',JSON.stringify(manifest,null,2));
 return{blob:await zip.generateAsync({type:'blob'}),manifest};
}
async function persistBackup(blob,manifest,name,{download=false,notes=''}={}){
 const buf=await blob.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buf))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const path=`${O.year}/${crypto.randomUUID()}_${name}`;
 const up=await sb.storage.from('totus-backups').upload(path,blob,{contentType:'application/octet-stream',upsert:false});if(up.error)throw up.error;
 const ins=await sb.from('ops_backup_archives').insert({file_path:path,file_name:name,file_size:blob.size,sha256:sha,format_version:manifest.version,created_by:authSession?.user?.id||null,notes}).select().single();
 if(ins.error){await sb.storage.from('totus-backups').remove([path]);throw ins.error}
 if(download)dlBlob(blob,name);
 return ins.data;
}
window.opsCreateBackup=async function(){
 try{
  const {blob,manifest}=await buildBackupBlob(),name=`Totus_${today()}_${new Date().toTimeString().slice(0,8).replaceAll(':','')}.totusbackup`;
  const rec=await persistBackup(blob,manifest,name,{download:true,notes:'Copia manual'});
  await audit('backup','crear',rec.id,{archivo:name,tamano:blob.size});await featureLoad(true);render();
 }catch(e){alert('No se pudo crear la copia: '+e.message)}
};
window.opsDownloadBackup=async function(id){const b=E.backupRows.find(x=>x.id===id);if(!b)return;const {data,error}=await sb.storage.from('totus-backups').download(b.file_path);if(error)return alert(error.message);dlBlob(data,b.file_name)};
window.opsDeleteBackup=async function(id){const b=E.backupRows.find(x=>x.id===id);if(!b)return;const reason=await O.core.askReason('Eliminar copia',`Se eliminará la copia ${b.file_name}.`,'Eliminar copia');if(!reason)return;const rm=await sb.storage.from('totus-backups').remove([b.file_path]);if(rm.error)return alert(rm.error.message);const del=await sb.from('ops_backup_archives').delete().eq('id',id);if(del.error)return alert(del.error.message);await audit('backup','eliminar',id,{archivo:b.file_name,motivo:reason});await featureLoad(true);render()};
async function readBackupFile(file){
 const zip=await JSZip.loadAsync(file),mf=zip.file('manifest.json');if(!mf)throw new Error('No contiene manifest.json');
 const manifest=JSON.parse(await mf.async('string'));if(manifest.format!=='totusbackup'||manifest.version!==1)throw new Error('Formato de copia no compatible');
 const missing=BACKUP_TABLES.filter(t=>!zip.file('data/'+t+'.json'));
 return{zip,manifest,missing};
}
window.opsValidateBackupUpload=async function(){
 const file=document.getElementById('ops_backup_file')?.files?.[0];if(!file)return alert('Selecciona una copia .totusbackup.');
 try{const {manifest,missing}=await readBackupFile(file);const m=openOpsModal('Copia validada',`<div class="ops-help-copy"><b>${H(file.name)}</b><br>Creada: ${H(manifest.created_at||'—')}<br>Tablas: ${Object.keys(manifest.tables||{}).length}<br>Archivos: ${(manifest.files||[]).length}<br>${missing.length?'<span class="badge warnb">Faltan tablas: '+H(missing.join(', '))+'</span>':'<span class="badge ok">Estructura completa y restaurable</span>'}</div><div class="ops-preview-actions"><button type="button" class="primary" id="ops_backup_validation_close">Cerrar</button></div>`);m.querySelector('#ops_backup_validation_close').onclick=closeOpsModal}catch(e){alert('Copia no válida: '+e.message)}
};
window.opsRestoreBackupUpload=async function(){
 if(!admin())return;
 const file=document.getElementById('ops_backup_file')?.files?.[0];if(!file)return alert('Selecciona una copia .totusbackup.');
 try{
  const {zip,manifest,missing}=await readBackupFile(file);if(missing.length)return alert('La copia no es completa para esta versión. Faltan: '+missing.join(', '));
  const reason=await askReason('Restaurar copia completa',`Vas a sustituir los datos actuales de Totus por "${file.name}". Antes se guardará automáticamente una copia PRE_RESTORE del estado actual.`,'Restaurar');
  if(!reason)return;
  const current=await buildBackupBlob(),preName=`PRE_RESTORE_${today()}_${new Date().toTimeString().slice(0,8).replaceAll(':','')}.totusbackup`;
  await persistBackup(current.blob,current.manifest,preName,{download:false,notes:'Copia automática previa a restauración: '+file.name});
  for(const item of (manifest.files||[])){
    const zf=zip.file('storage/'+item.bucket+'/'+item.path);if(!zf)throw new Error('Falta archivo físico en la copia: '+item.path);
    const blob=await zf.async('blob');const up=await sb.storage.from(item.bucket).upload(item.path,blob,{upsert:true});if(up.error)throw new Error(item.path+': '+up.error.message);
  }
  const tables={};for(const t of BACKUP_TABLES){tables[t]=JSON.parse(await zip.file('data/'+t+'.json').async('string'))}
  const {data,error}=await sb.functions.invoke('ops-restore-backup',{body:{tables,reason}});if(error)throw error;if(data?.error)throw new Error(data.error);
  await window.opsLoadData(true);E.loaded=false;await featureLoad(true);render();
  const done=openOpsModal('Restauración completada',`<div class="ops-help-copy"><span class="badge ok">Correcto</span><br>Se restauraron ${H(String(data?.tables||BACKUP_TABLES.length))} tablas. La copia automática PRE_RESTORE permanece guardada por seguridad.</div><div class="ops-preview-actions"><button type="button" class="primary" id="ops_backup_restore_close">Cerrar</button></div>`);done.querySelector('#ops_backup_restore_close').onclick=closeOpsModal;
 }catch(e){alert('No se pudo restaurar: '+e.message)}
};
function adminBackupHtml(){
 if(!admin())return '<div class="ops-card">Solo administración.</div>';
 return `${window.adminStripHtml?window.adminStripHtml('backup'):''}<div class="ops-grid"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Copia portátil</div><h3>Backup completo</h3><div class="small">Datos + documentos + recursos corporativos en un único .totusbackup.</div></div><button class="primary" onclick="opsCreateBackup()">Crear y descargar copia</button></div><div class="ops-note">La copia también se guarda de forma privada en Supabase y registra SHA-256.</div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Restauración</div><h3>Subir una copia</h3></div><div class="ops-actions"><button class="secondary" onclick="opsValidateBackupUpload()">Validar</button><button class="danger" onclick="opsRestoreBackupUpload()">Restaurar</button></div></div><label for="ops_backup_file">Archivo de copia .totusbackup</label><input id="ops_backup_file" type="file" accept=".totusbackup,application/octet-stream"><div class="small">Restaurar exige motivo y genera automáticamente una copia PRE_RESTORE antes de modificar datos.</div></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Histórico</div><h3>Copias guardadas</h3></div></div>${E.backupRows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Archivo</th><th>Tamaño</th><th>SHA-256</th><th></th></tr></thead><tbody>${E.backupRows.map(b=>`<tr><td>${H(new Date(b.created_at).toLocaleString('es-ES'))}</td><td><b>${H(b.file_name)}</b></td><td>${(N(b.file_size)/1048576).toFixed(1).replace('.',',')} MB</td><td><code>${H(String(b.sha256).slice(0,16))}…</code></td><td><div class="ops-actions"><button class="ghost" onclick="opsDownloadBackup('${b.id}')">Descargar</button><button class="danger" onclick="opsDeleteBackup('${b.id}')">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">Aún no hay copias guardadas.</div>'}</div>`;
}
function bodyForTab(tab){
 if(!E.loaded)return null;
 if(tab==='resumen')return dashboardHtml();
 if(tab==='facturas')return manager()?invoicesHtml():invoicesReadOnlyHtml();
 if(tab==='documentos')return documentsHtml();
 if(tab==='fiscal')return fiscalProjectionHtml();
 if(tab==='informes')return reportsHtml();
 if(tab==='config')return (window.adminStripHtml?window.adminStripHtml('config'):'')+configHtml();
 if(tab==='log')return adminLogHtml();
 if(tab==='backup')return adminBackupHtml();
 return null;
}
window.TotusGestionFeatures={load:featureLoad,body:bodyForTab};
// Expose selected helpers for automated tests without changing production behaviour.
window.__TotusOpsTest={incomeTotal,operationalIncomeTotal,deductibleExpenseTotal,fiscalProjection,managerExpenseRows,managerExpenseSummaryRows,managerIncomeRows,dailyWorkbook,makePdf,lineCalc,draftTotals,expenseDraftSupplierId:()=>O.expenseDraft?.supplierId||'',invoiceDraftCustomerId:()=>O.invoiceDraft?.customerId||'',invoiceDraftMode:()=>E.invoiceMode};
})();