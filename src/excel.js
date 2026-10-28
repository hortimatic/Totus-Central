import {expenseReportStyle,normalizeExpenseColor,EXPENSE_REPORT_COLORS,expenseReportOverride} from './expense-colors.js';
import {informationalTaxPayments,taxPaymentLabel} from './payment-information.js';
import {archiveAccepted} from './historical-acceptance.js';
import {closingDrawerValue,closingMissingFields,incompleteClosing,closingStateLabel} from './cash-closing.js';
import {fmtDate,n} from './utils.js';
import {computeModel130Accumulated,estimatePriorModel130,deductibleExpenseTotal,expenseCostAmount,isExpensePaymentEvidence,closingIncomeAmount,closingSalesAmount} from './calculations.js';
import {GESTOR_SOURCE_COLUMNS,GESTOR_AMOUNT_COLUMNS,buildGestorSourceRows,gestorSourceTotals} from './gestor-format.js';
import {matchesText} from './report-period.js';

const XLSX=window.XLSX;
const euro='#,##0.00 "€"';
const headerStyle={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1F2937'}},alignment:{horizontal:'center',vertical:'center'},border:{bottom:{style:'thin',color:{rgb:'CBD5E1'}}}};
const titleStyle={font:{bold:true,sz:16},alignment:{horizontal:'left'}};
const subStyle={font:{bold:true,color:{rgb:'475569'}},fill:{fgColor:{rgb:'F1F5F9'}}};
const totalStyle={font:{bold:true},fill:{fgColor:{rgb:'E2E8F0'}},border:{top:{style:'thin',color:{rgb:'94A3B8'}}}};

function styleHeader(ws,row,cols){for(let c=0;c<cols;c++){const cell=ws[XLSX.utils.encode_cell({r:row,c})];if(cell)cell.s=headerStyle}}
function autoWidths(ws,widths){ws['!cols']=widths.map(w=>({wch:w}))}
function book(){return XLSX.utils.book_new()}
function write(wb,name){XLSX.writeFile(wb,name,{cellStyles:true});if(typeof document!=='undefined')document.dispatchEvent(new CustomEvent('totus-download-prepared',{detail:{format:'xlsx'}}))}
function storeName(stores,id){return stores.find(s=>s.id===id)?.name||''}
function drawerName(drawers,id){return drawers.find(d=>d.id===id)?.name||''}

export function exportClosingsWorkbook({closings,closingDrawers,stores,drawers,from,to,settings=null}){
 const wb=book();
 const rows=closings.map(c=>c.entry_mode==='source_snapshot'?[
  fmtDate(c.business_date),storeName(stores,c.store_id),'',readClosingSource(c).card_sales??'','','','',c.include_in_income===false?'':closingIncomeAmount(c),n(c.actual_cash),closingStateLabel(c,settings),c.notes||''
 ]:[
  fmtDate(c.business_date),storeName(stores,c.store_id),incompleteClosing(c)?'':n(c.cash_sales),n(c.card_sales),n(c.bizum_sales),n(c.online_sales),n(c.other_income),
  incompleteClosing(c)?'':closingSalesAmount(c),Object.values(closingMissingFields(c)).some(fields=>fields.includes('closing_cash'))?'':n(c.actual_cash),closingStateLabel(c,settings),c.notes||''
 ]);
 const aoa=[['CIERRES DE CAJA'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],['Fecha','Tienda','Efectivo','Tarjeta','Bizum','Online','Otros','Total ventas','Efectivo final','Estado','Observaciones'],...rows];
 const totalRow=aoa.length;
 aoa.push(['','','','','','','','TOTAL','','','']);
 const ws=XLSX.utils.aoa_to_sheet(aoa);
 ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,11);
 ws[`H${totalRow+1}`]=closings.length&&closings.every(c=>c.entry_mode==='source_snapshot'&&c.include_in_income===false)?{t:'s',v:'Ventas no sumadas aquí',s:totalStyle}:{t:'n',f:rows.length?`SUM(H5:H${totalRow})`:'0',v:rows.reduce((t,row)=>t+(typeof row[7]==='number'?row[7]:0),0),s:totalStyle,z:euro};
 for(let r=5;r<=totalRow;r++)for(const col of ['C','D','E','F','G','H','I'])if(ws[`${col}${r}`])ws[`${col}${r}`].z=euro;
 autoWidths(ws,[12,18,13,13,13,13,13,15,15,12,35]);
 ws['!freeze']={xSplit:0,ySplit:4};
 ws['!autofilter']={ref:`A4:K${totalRow}`};
 XLSX.utils.book_append_sheet(wb,ws,'Cierres');

 const byId=new Map(closings.map(c=>[c.id,c]));
 const detail=closingDrawers.filter(d=>byId.has(d.closing_id)).map(d=>{
   const c=byId.get(d.closing_id);
   const opening=closingDrawerValue(c,d.drawer_id,'opening_cash',d.opening_cash),closing=closingDrawerValue(c,d.drawer_id,'closing_cash',d.closing_cash);
   const total=opening==null||closing==null?'':n(closing)+n(d.cash_withdrawals)+n(d.cash_expenses_declared)+n(d.cash_extra_out)-n(d.cash_extra_in)-n(opening)+n(d.card_sales)+n(d.bizum_sales)+n(d.online_sales)+n(d.other_income);
   return [fmtDate(c.business_date),storeName(stores,c.store_id),drawerName(drawers,d.drawer_id),opening??'',closing??'',n(d.card_sales),n(d.bizum_sales),n(d.online_sales),n(d.other_income),n(d.cash_withdrawals),n(d.cash_expenses_declared),n(d.cash_extra_in),n(d.cash_extra_out),total];
 });
 const wa=XLSX.utils.aoa_to_sheet([['Fecha','Tienda','Caja','Apertura','Cierre','Tarjeta','Bizum','Online','Otros','Salidas','Gastos caja','Entradas extra','Salidas extra','Total'],...detail]);
 styleHeader(wa,0,14);for(let r=2;r<=detail.length+1;r++)for(const col of ['D','E','F','G','H','I','J','K','L','M','N'])if(wa[`${col}${r}`])wa[`${col}${r}`].z=euro;
 autoWidths(wa,[12,18,18,13,13,13,13,13,13,13,13,13,13,15]);wa['!autofilter']={ref:`A1:N${detail.length+1}`};wa['!freeze']={ySplit:1};
 XLSX.utils.book_append_sheet(wb,wa,'Detalle por caja');

 const originals=closings.filter(c=>{try{return JSON.parse(c.source_ref).kind==='closing_source_snapshot'}catch{return false}}).flatMap(c=>readClosingSource(c).drawers.map(d=>[
  fmtDate(c.business_date),storeName(stores,c.store_id),d.name,d.opening??'',d.al_fin??'',d.closing??'',d.comment||'',d.source_id||'',c.include_in_income===false?'No':'Sí · ventas declaradas en origen'
 ]));
 if(originals.length){
  const sourceSheet=XLSX.utils.aoa_to_sheet([['Fecha','Tienda','Caja','Apertura original','Al fin original','Efectivo siguiente apertura','Comentario original','Referencia','Incluido en ingresos fiscales'],...originals]);
  styleHeader(sourceSheet,0,9);autoWidths(sourceSheet,[12,18,14,18,18,24,38,16,32]);sourceSheet['!autofilter']={ref:`A1:I${originals.length+1}`};sourceSheet['!freeze']={ySplit:1};
  XLSX.utils.book_append_sheet(wb,sourceSheet,'Orígenes importados');
 }

 write(wb,`cierres_${from}_${to}.xlsx`);
}


function appendInformationalPayments(wb,taxPayments=[],filters={}){
 const rows=informationalTaxPayments(taxPayments,filters);
 if(!rows.length)return;
 const ws=XLSX.utils.aoa_to_sheet([
 ['IMPUESTOS PAGADOS · SOLO INFORMACIÓN'],
 ['No reducen el beneficio fiscal ni se suman a los gastos. Son comunes a las dos tiendas.'],
 [],
 ['Fecha de pago','Impuesto','Periodo','Importe pagado'],
 ...rows.map(p=>[fmtDate(p.payment_date),taxPaymentLabel(p),p.period_label||[p.fiscal_year,p.quarter?p.quarter+'T':''].filter(Boolean).join(' · '),n(p.amount)]),
 ['TOTAL INFORMATIVO','','',rows.reduce((s,p)=>s+n(p.amount),0)]
 ]);
 ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:3}}];
 ws['!rows']=[{hpt:28},{hpt:36}];styleHeader(ws,3,4);autoWidths(ws,[16,58,30,20]);
 for(let r=5;r<=5+rows.length;r++)if(ws['D'+r])ws['D'+r].z=euro;
 ws['!freeze']={ySplit:4};if(rows.length)ws['!autofilter']={ref:'A4:D'+(4+rows.length)};
 XLSX.utils.book_append_sheet(wb,ws,'Impuestos pagados');
}

export function exportExpensesWorkbook({expenses,stores,from,to,settings=null,taxPayments=[],reportFilter={}}){
 const wb=book();
 const rows=expenses.map(x=>[
   fmtDate(x.expense_date),storeName(stores,x.store_id),x.supplier_name||'',x.supplier_tax_id||'',x.invoice_number||'',x.description||'',
   n(x.base_amount),n(x.vat_amount),n(x.re_amount),n(x.withholding_amount),n(x.gross_expense??x.accounting_amount??x.amount_paid??0),x.management_only?'Interno':'Contable',x.payment_method||'',archiveAccepted(settings,x,'expense')?'Conciliado y aceptado':x.paid_status||'',x.notes||''
 ]);
 const aoa=[['GASTOS'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],['Fecha','Tienda','Proveedor','NIF','Factura','Descripción','Base','IVA','RE','Retención','Total','Tipo','Pago','Estado','Observaciones'],...rows];
 const end=aoa.length;aoa.push(['Total de registros · incluye apuntes de pago']);
 const summaries=[
  ['Gastos sin duplicar apuntes de pago',expenses.reduce((s,x)=>s+expenseCostAmount(x),0)],
  ['De ellos: gasto fiscal revisado',expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false).reduce((s,x)=>s+expenseCostAmount(x),0)],
  ['De ellos: solo control interno',expenses.filter(x=>x.management_only).reduce((s,x)=>s+expenseCostAmount(x),0)],
  ['Apuntes de pago · no sumarlos otra vez como gasto',expenses.filter(isExpensePaymentEvidence).reduce((s,x)=>s+n(x.gross_expense??x.accounting_amount??x.amount_paid??0),0)]
 ];
 summaries.forEach(([label,amount])=>{const row=Array(15).fill('');row[0]=label;row[10]=amount;aoa.push(row)});
 const ws=XLSX.utils.aoa_to_sheet(aoa);ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,15);
 ws[`K${end+1}`]={t:'n',f:rows.length?`SUM(K5:K${end})`:'0',s:totalStyle,z:euro};
 ws['!merges']=[];
 for(let r=end+1;r<=aoa.length;r++){
  ws['!merges'].push({s:{r:r-1,c:0},e:{r:r-1,c:9}});
  ws['A'+r].s={...totalStyle,alignment:{horizontal:'right',vertical:'center',wrapText:true}};
  ws['K'+r].s=totalStyle;ws['K'+r].z=euro;
 }
 for(let r=5;r<=end;r++)for(const col of ['G','H','I','J','K'])if(ws[`${col}${r}`])ws[`${col}${r}`].z=euro;
 autoWidths(ws,[12,18,22,16,16,32,13,13,13,13,15,13,15,13,35]);ws['!autofilter']={ref:`A4:O${end}`};ws['!freeze']={ySplit:4};
 XLSX.utils.book_append_sheet(wb,ws,'Gastos');
 appendInformationalPayments(wb,taxPayments,{...reportFilter,from,to});
 write(wb,`gastos_${from}_${to}.xlsx`);
}

export function exportSummaryWorkbook({closings,expenses,stores,invoices=[],fiscalAdjustments=[],incomeAdjustments=[],taxPayments=[],reportFilter={},from,to}){
 const wb=book();
 const closeSales=closings.filter(x=>x.include_in_income!==false).reduce((a,x)=>a+closingIncomeAmount(x),0);
 const extraInvoiceSales=invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true).reduce((a,x)=>a+n(x.total_amount),0);
 const adjustmentSales=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra').reduce((a,x)=>a+n(x.amount),0)+incomeAdjustments.reduce((a,x)=>a+n(x.amount),0);
 const sales=closeSales+extraInvoiceSales+adjustmentSales;
 const accounting=expenses.filter(x=>!x.management_only).reduce((a,x)=>a+expenseCostAmount(x),0);
 const pending=expenses.filter(x=>!x.management_only&&x.fiscal_reviewed===false).reduce((a,x)=>a+expenseCostAmount(x),0);
 const internal=expenses.filter(x=>x.management_only).reduce((a,x)=>a+expenseCostAmount(x),0);
 const costs=accounting+internal;
 const summary=[
  ['RESUMEN DE GESTIÓN'],[`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`],[],
  ['Concepto','Importe'],['Ventas de cierres',closeSales],['Facturas adicionales',extraInvoiceSales],['Ajustes de ingreso',adjustmentSales],['Ingresos totales',sales],['Gastos contables',accounting],['Gastos internos',internal],['Gastos totales',costs],['Resultado real',sales-costs],['Pendientes de revisión (incluidos)',pending]
 ];
 const taxInformation=informationalTaxPayments(taxPayments,{...reportFilter,from,to}).reduce((s,p)=>s+n(p.amount),0);
 summary.push(['Impuestos pagados · solo información',taxInformation],['Control interno e impuestos · informativo',internal+taxInformation]);
 const ws=XLSX.utils.aoa_to_sheet(summary);ws['A1'].s=titleStyle;ws['A2'].s=subStyle;styleHeader(ws,3,2);for(let r=5;r<=summary.length;r++)if(ws[`B${r}`])ws[`B${r}`].z=euro;
 ws['A12'].s=totalStyle;ws['B12'].s={...totalStyle};ws['B12'].z=euro;autoWidths(ws,[24,18]);XLSX.utils.book_append_sheet(wb,ws,'Resumen');

 const perStore=stores.map(s=>{
  const cs=closings.filter(x=>x.store_id===s.id&&x.include_in_income!==false),es=expenses.filter(x=>x.store_id===s.id);
  const is=invoices.filter(x=>x.store_id===s.id&&x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true);
  const as=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&x.store_id===s.id);
  const sv=cs.reduce((a,x)=>a+closingIncomeAmount(x),0)+is.reduce((a,x)=>a+n(x.total_amount),0)+as.reduce((a,x)=>a+n(x.amount),0)+incomeAdjustments.filter(x=>x.store_id===s.id).reduce((a,x)=>a+n(x.amount),0);
  const amt=expenseCostAmount;
  const accounting=es.filter(x=>!x.management_only).reduce((a,x)=>a+amt(x),0);
  const internal=es.filter(x=>x.management_only).reduce((a,x)=>a+amt(x),0);
  const notReviewed=es.filter(x=>!x.management_only&&x.fiscal_reviewed===false).reduce((a,x)=>a+amt(x),0);
  return [s.name,sv,accounting,internal,sv-accounting-internal,notReviewed];
 });
 const generalIncome=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&!x.store_id).reduce((a,x)=>a+n(x.amount),0)+incomeAdjustments.filter(x=>!x.store_id).reduce((a,x)=>a+n(x.amount),0);
 const generalExpenses=expenses.filter(x=>!x.store_id),ga=expenseCostAmount;
 const generalAccounting=generalExpenses.filter(x=>!x.management_only).reduce((a,x)=>a+ga(x),0);
 const generalInternal=generalExpenses.filter(x=>x.management_only).reduce((a,x)=>a+ga(x),0);
 const generalPending=generalExpenses.filter(x=>!x.management_only&&x.fiscal_reviewed===false).reduce((a,x)=>a+ga(x),0);
 if(generalIncome||generalAccounting||generalInternal||generalPending)
  perStore.push(['General / sin tienda',generalIncome,generalAccounting,generalInternal,generalIncome-generalAccounting-generalInternal,generalPending]);
 const ws2=XLSX.utils.aoa_to_sheet([['Tienda','Ventas','Gastos registrados','Gastos internos','Resultado','Sin revisión fiscal'],...perStore]);styleHeader(ws2,0,6);for(let r=2;r<=perStore.length+1;r++)for(const c of ['B','C','D','E','F'])if(ws2[`${c}${r}`])ws2[`${c}${r}`].z=euro;autoWidths(ws2,[22,16,18,18,16,25]);XLSX.utils.book_append_sheet(wb,ws2,'Por tienda');
 appendInformationalPayments(wb,taxPayments,{...reportFilter,from,to});
 write(wb,`resumen_${from}_${to}.xlsx`);
}


const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
const XLSX_WCH_PAD=0.83203125;
const LEGACY_COLORS={...EXPENSE_REPORT_COLORS,total:'FF0000',stripe:'DCE6F1',header:'4F81BD',grid:'95B3D7'};

function excelDateKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function moneyStyle(fill){return {fill:fill?{fgColor:{rgb:fill}}:undefined,font:{name:'Calibri',sz:11},alignment:{horizontal:'right'},numFmt:'#,##0.00',border:{top:{style:'thin',color:{rgb:'95B3D7'}},bottom:{style:'thin',color:{rgb:'95B3D7'}}}}}
function textStyle(fill,bold=false,align='left'){return {fill:fill?{fgColor:{rgb:fill}}:undefined,font:{name:'Calibri',sz:11,bold},alignment:{horizontal:align,vertical:'center'},border:{top:{style:'thin',color:{rgb:'95B3D7'}},bottom:{style:'thin',color:{rgb:'95B3D7'}}}}}
function sumFormula(refs){return refs.length?`SUM(${refs.join(',')})`:'0'}
// The original daily cash book records the supplier's net bill; withheld tax
// remains payable to the tax authority and is recorded separately when paid.
function legacyExpenseAmount(expense){return n(expense.gross_expense??expense.accounting_amount??expense.amount_paid??0)-n(expense.withholding_amount)}
function setCell(ws,addr,value,style,formula=null){
 const t=typeof value==='number'?'n':'s';ws[addr]={t,v:value,s:style};if(formula)ws[addr].f=formula;
}
function readClosingSource(closing){
 let source;try{source=JSON.parse(closing.source_ref)}catch{throw new Error('No se puede exportar un cierre cuyo origen no se puede leer.');}
 if(source?.kind!=='closing_source_snapshot'||!Array.isArray(source.drawers))throw new Error('El cierre de origen está incompleto.');
 return source;
}
function monthlySourceReference(incomeAdjustments,storeId,period){
 const sources=[];
 for(const row of incomeAdjustments.filter(x=>x.store_id===storeId)){
  let source;try{source=JSON.parse(row.notes)}catch{continue;}
  if(source?.kind==='monthly_source_reference'&&source.period===period){
   if(!['bank_entries','withdrawal_entries','payment_entries'].every(key=>Array.isArray(source[key])))throw new Error('El origen del libro mensual está incompleto.');
   sources.push(source);
  }
 }
 if(sources.length>1)throw new Error('Hay más de un origen para el mismo libro mensual. Revisa la importación.');
 return sources[0];
}
function appendLegacyMonthlySheet(wb,{store,year,month,closings,expenses,categories,incomeAdjustments=[],monthlySourceReferences=incomeAdjustments,reportFilter={},invoiceNumbers=false}){
 const invoiceReferences=new Map();
 const monthName=MONTHS[month],ws={};
 ws['!ref']='A1:F80';ws['!cols']=[null,...[11.7109375,!/newold|smok/i.test(store.name||'')&&month===0?33:30.7109375,9.140625,9.140625,12.140625].map(w=>({wch:w-XLSX_WCH_PAD}))];ws['!merges']=[XLSX.utils.decode_range('B1:F1')];ws['!freeze']={ySplit:2};
 const legacyTitle=year===2026&&month>=3&&month<=6?`${/newold|smok/i.test(store.name||'')?(month===3?'NewOldSmok':'Newoldsmok'):'Hortimatic'} ${monthName} ${year}`:`${monthName} ${year}`;
 setCell(ws,'B1',legacyTitle,{fill:{fgColor:{rgb:'000000'}},font:{name:'Calibri',sz:11,bold:true,color:{rgb:'FFFF00'}},alignment:{horizontal:'center'}});
 const headers=['Dia','Gastos','Precio','Tarjeta','Salida de caja'];
 for(let i=0;i<headers.length;i++)setCell(ws,XLSX.utils.encode_cell({r:1,c:i+1}),headers[i],{fill:{fgColor:{rgb:LEGACY_COLORS.header}},font:{name:'Calibri',sz:11,bold:true,color:{rgb:'FFFFFF'}},alignment:{horizontal:'center'}});
 const days=new Date(year,month+1,0).getDate();let row=3;const groupRefs={other:[],payroll:[],orders:[],fixed:[],irpf:[]};const expenseRefs=[];
 const byDateClose=new Map();
 for(const closing of closings.filter(x=>x.store_id===store.id&&x.include_in_income!==false&&String(x.business_date).startsWith(`${year}-${String(month+1).padStart(2,'0')}`))){
  const date=String(closing.business_date).slice(0,10);
  const totals=byDateClose.get(date)||{card_sales:0,cash_withdrawals:0};
  totals.card_sales+=n(closing.card_sales);
  totals.cash_withdrawals+=n(closing.cash_withdrawals);
  byDateClose.set(date,totals);
 }
 const period=`${year}-${String(month+1).padStart(2,'0')}`,source=monthlySourceReference(monthlySourceReferences,store.id,period);
 const sourceDateMatches=date=>(!reportFilter.from||date>=reportFilter.from)&&(!reportFilter.to||date<=reportFilter.to);
 let monthExpenses=expenses.filter(x=>x.store_id===store.id&&String(x.expense_date).startsWith(period));
 if(source){
  byDateClose.clear();
  for(const [field,entries] of [['card_sales',source.bank_entries],['cash_withdrawals',source.withdrawal_entries]])for(const entry of entries){
   if(!String(entry.date).startsWith(period)||!Number.isFinite(Number(entry.amount)))throw new Error('Apunte bancario fuera del mes o con importe inválido.');
   if(!sourceDateMatches(entry.date)||!matchesText(reportFilter.query,store.name,entry.date,field==='card_sales'?'Tarjeta':'Salida de caja'))continue;
   const totals=byDateClose.get(entry.date)||{card_sales:null,cash_withdrawals:null};totals[field]=(totals[field]??0)+Number(entry.amount);byDateClose.set(entry.date,totals);
  }
  const belongsToSource=expense=>{try{const ref=JSON.parse(expense.source_ref);return typeof source.batch==='string'&&source.batch!==''&&ref.batch===source.batch}catch{return false}};
  const imported=expenses.filter(x=>x.store_id===store.id&&belongsToSource(x));
  monthExpenses=source.payment_entries.filter(entry=>sourceDateMatches(entry.date)&&matchesText(reportFilter.query,store.name,entry.date,entry.label,entry.invoice_number)).map(entry=>{
   if(!String(entry.date).startsWith(period)||!Number.isFinite(Number(entry.amount)))throw new Error('Pago original fuera del mes o con importe inválido.');
   const invoice=entry.invoice_number?imported.find(x=>x.invoice_number===entry.invoice_number):null;
   const raw=imported.find(x=>{try{const ref=JSON.parse(x.source_ref);return ref.kind==='bank_payment_source'&&ref.source?.row===entry.row}catch{return false}});
   const displaySource=expenseReportOverride(raw)?raw:invoice||raw;
   return {...(invoice||raw||{}),source_ref:displaySource?.source_ref,source_row:entry.row,source_group:entry.group,source_color:normalizeExpenseColor(entry.color)||undefined,expense_date:entry.date,description:entry.label,invoice_number:entry.invoice_number||'',gross_expense:Number(entry.amount),withholding_amount:0,management_only:invoice?invoice.management_only:raw?.management_only??true};
  }).concat(monthExpenses.filter(x=>!belongsToSource(x)));
 }
 const expMonth=monthExpenses.sort((a,b)=>String(a.expense_date).localeCompare(String(b.expense_date))||(a.source_row!=null&&b.source_row!=null?a.source_row-b.source_row:String(a.created_at||'').localeCompare(String(b.created_at||''))));
 for(let d=1;d<=days;d++){
   const key=excelDateKey(year,month,d),close=byDateClose.get(key),dayExp=expMonth.filter(x=>String(x.expense_date).slice(0,10)===key);
   const count=Math.max(1,dayExp.length);
   for(let k=0;k<count;k++,row++){
     const stripe=row%2===1?LEGACY_COLORS.stripe:null,ex=dayExp[k]||null;
     if(k===0)setCell(ws,`B${row}`,`${d} ${WEEKDAYS[new Date(year,month,d).getDay()]}`,textStyle(stripe,true));
     else setCell(ws,`B${row}`,'',textStyle(stripe,true));
     if(ex){
       invoiceReferences.set(row,ex.invoice_number||'');
       const {group:g,color}=expenseReportStyle(ex,categories),amount=legacyExpenseAmount(ex);
       setCell(ws,`C${row}`,ex.description||ex.supplier_name||'Gasto',textStyle(color,false));
       setCell(ws,`D${row}`,amount,moneyStyle(stripe));groupRefs[g].push(`D${row}`);expenseRefs.push(`D${row}`);
     }else{setCell(ws,`C${row}`,'',textStyle(stripe));setCell(ws,`D${row}`,'',moneyStyle(stripe))}
     if(k===0&&close){
       setCell(ws,`E${row}`,close.card_sales==null?'':n(close.card_sales),moneyStyle(stripe));setCell(ws,`F${row}`,close.cash_withdrawals==null?'':n(close.cash_withdrawals),moneyStyle(stripe));
     }else{setCell(ws,`E${row}`,'',moneyStyle(stripe));setCell(ws,`F${row}`,'',moneyStyle(stripe))}
   }
 }
 row+=2;const summaryStart=row;
 const cardTotal=[...byDateClose.values()].reduce((t,d)=>t+n(d.card_sales),0),cashTotal=[...byDateClose.values()].reduce((t,d)=>t+n(d.cash_withdrawals),0),grossExpenses=expMonth.reduce((t,e)=>t+legacyExpenseAmount(e),0);
 const groups=[['Otros','other'],['SS y nominas','payroll'],['Pedidos ','orders'],['Gastos fijos','fixed'],['IRPF','irpf']];
 for(const [label,g] of groups){setCell(ws,`B${row}`,label,textStyle(LEGACY_COLORS[g],true));setCell(ws,`C${row}`,groupRefs[g].reduce((total,addr)=>total+n(ws[addr]?.v),0),textStyle(row%2===1?LEGACY_COLORS.stripe:null,false,'center'),sumFormula(groupRefs[g]));row++}
 const totalRow=row;setCell(ws,`B${row}`,'Total',textStyle(LEGACY_COLORS.total,true));setCell(ws,`C${row}`,grossExpenses,textStyle(LEGACY_COLORS.stripe,false,'center'),`SUM(C${summaryStart}:C${row-1})`);setCell(ws,`D${row}`,grossExpenses,moneyStyle(LEGACY_COLORS.stripe),expenseRefs.length?`SUM(${expenseRefs.join(',')})`:'0');
 const firstData=3,lastData=summaryStart-3;setCell(ws,`E${row}`,cardTotal,moneyStyle(LEGACY_COLORS.stripe),`SUM(E${firstData}:E${lastData})`);setCell(ws,`F${row}`,cashTotal,moneyStyle(LEGACY_COLORS.stripe),`SUM(F${firstData}:F${lastData})`);
 row+=2;
 const internalTotal=expMonth.filter(x=>x.management_only).reduce((a,x)=>a+legacyExpenseAmount(x),0);
 setCell(ws,`C${row}`,monthName,{font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}});row++;
 const fmtEuro=value=>Number(value||0).toFixed(2).replace('.',',');
 const recalc=`SUM(E${totalRow},F${totalRow})`;setCell(ws,`C${row}`,`${fmtEuro(cardTotal)}€ Tarjeta + ${fmtEuro(cashTotal)}€ metalico`,{fill:{fgColor:{rgb:'FFFF00'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(E${totalRow},"0.00")&"€ Tarjeta + "&TEXT(F${totalRow},"0.00")&"€ metalico"`);row++;
 setCell(ws,`C${row}`,`Total recaudado: ${fmtEuro(cardTotal+cashTotal)}€`,{fill:{fgColor:{rgb:'FFFF00'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`"Total recaudado: "&TEXT(${recalc},"0.00")&"€"`);row++;
 setCell(ws,`C${row}`,`Gastos: ${fmtEuro(grossExpenses)}€`,{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'left'}},`"Gastos: "&TEXT(D${totalRow},"0.00")&"€"`);row++;
 if(source){
  setCell(ws,`C${row}`,`Saldo de tesorería: ${fmtEuro(cardTotal+cashTotal-grossExpenses)}€`,{fill:{fgColor:{rgb:'DCE6F1'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`"Saldo de tesorería: "&TEXT(${recalc}-D${totalRow},"0.00")&"€"`);
 }else{
 if(internalTotal>0){setCell(ws,`C${row}`,`Menos gastos internos: ${internalTotal.toFixed(2).replace('.',',')}€`,{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'left'}});row++}
 const fiscalFormula=internalTotal>0?`D${totalRow}-${internalTotal}`:`D${totalRow}`;
 setCell(ws,`C${row}`,`${fmtEuro(grossExpenses)}€ - ${fmtEuro(internalTotal)}€ = ${fmtEuro(grossExpenses-internalTotal)}€`,{fill:{fgColor:{rgb:'92D050'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(D${totalRow},"0.00")&"€ - "&TEXT(${internalTotal},"0.00")&"€ = "&TEXT(${fiscalFormula},"0.00")&"€"`);row++;
 setCell(ws,`C${row}`,`${fmtEuro(cardTotal+cashTotal)}€ - ${fmtEuro(grossExpenses-internalTotal)}€ = ${fmtEuro(cardTotal+cashTotal-grossExpenses+internalTotal)}€`,{fill:{fgColor:{rgb:'DCE6F1'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`TEXT(${recalc},"0.00")&"€ - "&TEXT(${fiscalFormula},"0.00")&"€ = "&TEXT(${recalc}-(${fiscalFormula}),"0.00")&"€"`);row++;
 setCell(ws,`C${row}`,`Total ${fmtEuro(cardTotal+cashTotal-grossExpenses+internalTotal)}€`,{fill:{fgColor:{rgb:'00B0F0'}},font:{name:'Calibri',sz:11},alignment:{horizontal:'center'}},`"Total  "&TEXT(${recalc}-(${fiscalFormula}),"0.00")&"€"`);
 }
 if(source){row+=2;setCell(ws,`C${row}`,'Libro original de tesorería: pagos y tarjetas por fecha bancaria. El saldo no es el beneficio fiscal. La revisión fiscal se consulta en el libro de gestoría.',{font:{name:'Calibri',sz:10},alignment:{wrapText:true,vertical:'top'}});ws['!merges'].push(XLSX.utils.decode_range(`C${row}:F${row}`));ws['!rows']=ws['!rows']||[];ws['!rows'][row-1]={hpt:44};}
 ws['!ref']=`A1:F${Math.max(row,totalRow)}`;
 let output=ws;
 if(invoiceNumbers){
  output={};
  const shiftFormula=formula=>formula.replace(/(\$?)([A-Z]{1,3})(\$?\d+)/g,(_match,dollar,column,number)=>dollar+XLSX.utils.encode_col(XLSX.utils.decode_col(column)+(XLSX.utils.decode_col(column)>=3?1:0))+number);
  for(const [address,cell] of Object.entries(ws)){
   if(address.startsWith('!'))continue;
   const position=XLSX.utils.decode_cell(address);if(position.c>=3)position.c++;
   output[XLSX.utils.encode_cell(position)]={...cell,...(cell.f?{f:shiftFormula(cell.f)}:{})};
  }
  output['!cols']=[...ws['!cols'].slice(0,3),{wch:20},...ws['!cols'].slice(3)];
  output['!merges']=ws['!merges'].map(range=>({s:{...range.s,c:range.s.c>=3?range.s.c+1:range.s.c},e:{...range.e,c:range.e.c>=3?range.e.c+1:range.e.c}}));output['!ref']=`A1:G${Math.max(row,totalRow)}`;if(ws['!rows'])output['!rows']=ws['!rows'];
  output['D2']={...ws.C2,v:'Nº factura'};
  for(let r=3;r<=lastData;r++)output[`D${r}`]={t:'s',v:invoiceReferences.get(r)||'',s:{...textStyle(r%2===1?LEGACY_COLORS.stripe:null),alignment:{vertical:'center',wrapText:true}}};
  output['!autofilter']={ref:`B2:G${lastData}`};
  output['!freeze']={xSplit:0,ySplit:2};
 }
 XLSX.utils.book_append_sheet(wb,output,monthName);
}
export function buildStoreAnnualWorkbook({store,year,closings,expenses,categories,incomeAdjustments=[]}){
 const wb=book();for(let month=0;month<12;month++)appendLegacyMonthlySheet(wb,{store,year,month,closings,expenses,categories,incomeAdjustments});
 wb.Workbook=wb.Workbook||{};wb.Workbook.CalcPr={calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true};return wb;
}
export function buildStoreMonthlyWorkbook(args){
 if(!Number.isInteger(args.month)||args.month<1||args.month>12)throw new Error('Selecciona un mes válido.');
 if(!Number.isInteger(args.year)||args.year<2020||args.year>2100)throw new Error('Selecciona un año válido.');
 const wb=book();appendLegacyMonthlySheet(wb,{...args,month:args.month-1,invoiceNumbers:true});
 wb.Workbook={CalcPr:{calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true}};return wb;
}
export function exportStoreMonthlyWorkbook(args){write(buildStoreMonthlyWorkbook(args),`Gastos y ventas ${args.store.name} ${args.year}-${String(args.month).padStart(2,'0')} ${MONTHS[args.month-1]}.xlsx`)}


const GESTOR_NAVY='17365D',GESTOR_BLUE='4472C4',GESTOR_ALT='D9EAF7',GESTOR_LINE='5B9BD5';
function gestorHeader(ws,row,cols){
 for(let i=0;i<cols;i++){const a=XLSX.utils.encode_cell({r:row,c:i});if(ws[a])ws[a].s={fill:{fgColor:{rgb:GESTOR_BLUE}},font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:10},alignment:{horizontal:'center',vertical:'center'},border:{bottom:{style:'thin',color:{rgb:GESTOR_LINE}}}}}
}
function gestorTitle(ws,title,lastCol){
 ws['A1']={t:'s',v:title,s:{fill:{fgColor:{rgb:GESTOR_NAVY}},font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:14},alignment:{horizontal:'left',vertical:'center'}}};
 ws['!merges']=(ws['!merges']||[]).concat([XLSX.utils.decode_range(`A1:${lastCol}1`)]);
}
function sheetCurrency(ws,start,end,cols){
 for(let r=start;r<=end;r++)for(const col of cols){const a=`${col}${r}`;if(ws[a]){ws[a].z='#,##0.00 "€"';ws[a].s={...(ws[a].s||{}),alignment:{horizontal:'right'},fill:{fgColor:{rgb:r%2?GESTOR_ALT:'FFFFFF'}},border:{bottom:{style:'thin',color:{rgb:GESTOR_LINE}}}}}}
}
function quarterRange(year,q){const sm=(q-1)*3+1,em=q*3;return {from:`${year}-${String(sm).padStart(2,'0')}-01`,to:`${year}-${String(em).padStart(2,'0')}-${String(new Date(year,em,0).getDate()).padStart(2,'0')}`,months:[sm-1,sm,sm+1]}}
function inDate(v,from,to){const d=String(v||'').slice(0,10);return d>=from&&d<=to}
function categoryConcept(categories,id){const c=categories.find(x=>x.id===id);return (c?.name||c?.code||'OTROS').toUpperCase().slice(0,28)}
function fiscalIncomeForPeriod({from,to,closings,invoices=[],fiscalAdjustments=[],incomeAdjustments=[]}){
 const close=closings.filter(x=>x.include_in_income!==false&&inDate(x.business_date,from,to)).reduce((a,x)=>a+closingIncomeAmount(x),0);
 const inv=invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inDate(x.issue_date,from,to)).reduce((a,x)=>a+n(x.total_amount),0);
 const adj=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&inDate(x.adjustment_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
 return close+inv+adj+incomeAdjustments.filter(x=>inDate(x.income_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
}
function expenseLineRows({from,to,expenses,expenseLines,categories}){
 const valid=expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false&&inDate(x.expense_date,from,to));
 const byExpense=new Map(valid.map(x=>[x.id,x]));const out=[];let order=1;
 for(const line of expenseLines.filter(x=>byExpense.has(x.expense_id)).sort((a,b)=>String(byExpense.get(a.expense_id).expense_date).localeCompare(String(byExpense.get(b.expense_id).expense_date))||(a.sort_order||0)-(b.sort_order||0))){
   const e=byExpense.get(line.expense_id),base=n(line.base_amount),vat=n(line.vat_amount),re=n(line.re_amount),wh=n(line.withholding_amount),total=base+vat+re,net=total-wh;
   out.push([order++,fmtDate(e.expense_date),'',e.invoice_number||'', '',e.supplier_tax_id||'',e.supplier_name||'',categoryConcept(categories,line.category_id||e.category_id),base,n(line.vat_rate),vat,n(line.re_base),n(line.re_rate),re,n(line.irpf_imputable),n(line.withholding_base),n(line.withholding_rate),wh,total,net]);
 }
 return out;
}
function appendGestorBookSheet(wb,q,args){
 const {year,expenses,expenseLines,categories}=args,rng=quarterRange(year,q),rows=expenseLineRows({from:rng.from,to:rng.to,expenses,expenseLines,categories});
 const headers=['Orden','Fecha','Nº fra. recibida','Nº fra. proveedor','Rt','NIF/CIF','Razón social','Concepto','Base IVA','% IVA','Cuota IVA','Base R.E.','% R.E.','Cuota R.E.','Imputable a IRPF','Base retención','% retención','Cuota retenida','Total factura','Neto pagado'];
 const ws=XLSX.utils.aoa_to_sheet([[null],[],headers,...rows]);gestorTitle(ws,`Compras y gastos / Facturas recibidas - Libro gestor ${q}T`,'T');gestorHeader(ws,2,20);
 ws['!cols']=[8,13,14,21,6,14,31,25,14,10,13,14,10,13,17,16,11,15,15,15].map(w=>({wch:w-XLSX_WCH_PAD}));ws['!freeze']={ySplit:3};ws['!autofilter']={ref:`A3:T${rows.length+3}`};
 for(let r=4;r<=rows.length+3;r++){for(let col=0;col<20;col++){const a=XLSX.utils.encode_cell({r:r-1,c:col});if(ws[a])ws[a].s={...(ws[a].s||{}),font:{name:'Calibri',sz:9},fill:{fgColor:{rgb:r%2?GESTOR_ALT:'FFFFFF'}},border:{bottom:{style:'thin',color:{rgb:GESTOR_LINE}}}}}}
 sheetCurrency(ws,4,rows.length+3,['I','J','K','L','M','N','O','P','Q','R','S','T']);
 XLSX.utils.book_append_sheet(wb,ws,`Libro gestor ${q}T`);
 return rows;
}
function monthTotals(args,month){
 const {year,stores,closings,expenses,invoices=[],fiscalAdjustments=[],incomeAdjustments=[]}=args,from=excelDateKey(year,month,1),to=`${year}-${String(month+1).padStart(2,'0')}-${String(new Date(year,month+1,0).getDate()).padStart(2,'0')}`;
 const sales=stores.map(s=>{
   const close=closings.filter(x=>x.store_id===s.id&&x.include_in_income!==false&&inDate(x.business_date,from,to)).reduce((a,x)=>a+closingIncomeAmount(x),0);
   const inv=invoices.filter(x=>x.store_id===s.id&&x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true&&inDate(x.issue_date,from,to)).reduce((a,x)=>a+n(x.total_amount),0);
   const adj=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&x.store_id===s.id&&inDate(x.adjustment_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
   return close+inv+adj+incomeAdjustments.filter(x=>x.store_id===s.id&&inDate(x.income_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
 });
 const commonIncome=fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'&&!x.store_id&&inDate(x.adjustment_date,from,to)).reduce((a,x)=>a+n(x.amount),0)
   +incomeAdjustments.filter(x=>!x.store_id&&inDate(x.income_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
 const direct=stores.map(s=>expenses.filter(x=>x.store_id===s.id&&!x.management_only&&x.fiscal_reviewed!==false&&inDate(x.expense_date,from,to)).reduce((a,x)=>a+n(x.accounting_amount??x.gross_expense??x.amount_paid??0),0));
 const common=expenses.filter(x=>!x.store_id&&!x.management_only&&x.fiscal_reviewed!==false&&inDate(x.expense_date,from,to)).reduce((a,x)=>a+n(x.accounting_amount??x.gross_expense??x.amount_paid??0),0);
 return {from,to,sales,direct,common,commonIncome};
}
function appendReconciliationSheet(wb,q,args){
 const {year,fiscalAdjustments=[]}=args,rng=quarterRange(year,q);const months=rng.months.map(m=>monthTotals(args,m));
 const rows=months.map((x,i)=>{const adjustment=fiscalAdjustments.filter(a=>inDate(a.adjustment_date,x.from,x.to)&&['gasto_deducible_extra','amortizacion'].includes(a.kind)).reduce((s,a)=>s+n(a.amount),0);const sales=x.sales.reduce((a,b)=>a+b,0)+x.commonIncome,direct=x.direct.reduce((a,b)=>a+b,0),gestor=direct+x.common+adjustment;return [MONTHS[rng.months[i]],x.sales[0]||0,x.sales[1]||0,sales,-(x.direct[0]||0),-(x.direct[1]||0),-x.common,adjustment,-gestor,sales-gestor,0,sales-gestor]});
 const totals=new Array(12).fill(0);totals[0]='TOTAL';for(let c=1;c<12;c++)totals[c]=rows.reduce((a,r)=>a+n(r[c]),0);
 const headers=['Mes','Ventas Hortimatic','Ventas NewOldSmok','Ventas totales','Gasto directo Horti','Gasto directo NewOld','Gastos comunes','Ajuste / diferencia gestor','Gastos gestor','Resultado fiscal','Luz almacén incluida','Resultado corregido sin luz almacén'];
 const ws=XLSX.utils.aoa_to_sheet([[null],[],headers,...rows,totals,[],['Fórmula visible: Ventas totales - Gastos del gestor = Resultado fiscal. Los gastos del gestor se forman con gastos directos de las dos tiendas + gastos comunes + ajustes de conciliación.']]);gestorTitle(ws,`Conciliación fiscal trazable - ${q}T ${year}`,'L');gestorHeader(ws,2,12);ws['!cols']=[15,18,19,17,19,20,17,22,17,17,18,24].map(w=>({wch:w-XLSX_WCH_PAD}));ws['!freeze']={ySplit:3};
 sheetCurrency(ws,4,7,['B','C','D','E','F','G','H','I','J','K','L']);for(let c=1;c<12;c++){const col=XLSX.utils.encode_col(c);const cell=ws[col+'7'];if(cell){cell.f=`SUM(${col}4:${col}6)`;cell.t='n';cell.z='#,##0.00 "€"'}}for(let c=0;c<12;c++){const a=XLSX.utils.encode_cell({r:6,c});if(ws[a])ws[a].s={...(ws[a].s||{}),font:{bold:true},fill:{fgColor:{rgb:'D9EAD3'}}}}
 ws['!merges']=(ws['!merges']||[]).concat([XLSX.utils.decode_range('A9:L13')]);
 XLSX.utils.book_append_sheet(wb,ws,`Conciliación ${q}T`);
 }
function appendAuditSheet(wb,args){
 const {year,taxPayments=[],fiscalAdjustments=[],settings={}}=args,rows=[];
 const deductible=(from,to)=>deductibleExpenseTotal(args.expenses.filter(x=>inDate(x.expense_date,from,to)),args.expenseLines||[]);
 const adjustment=(from,to,kinds)=>fiscalAdjustments.filter(x=>kinds.includes(x.kind)&&inDate(x.adjustment_date,from,to)).reduce((a,x)=>a+n(x.amount),0);
 for(let q=1;q<=4;q++){
  const rng=quarterRange(year,q),from=`${year}-01-01`,to=rng.to;
  const periodIncome=fiscalIncomeForPeriod({...args,from:rng.from,to:rng.to});
  const periodExpenses=deductible(rng.from,rng.to)+adjustment(rng.from,rng.to,['gasto_deducible_extra','amortizacion']);
  const ytdIncome=fiscalIncomeForPeriod({...args,from,to});
  const ytdExpenses=deductible(from,to),ytdExtra=adjustment(from,to,['gasto_deducible_extra','amortizacion']);
  const priorPayments=estimatePriorModel130(args,year,q).total;
  const estimate=computeModel130Accumulated({income:ytdIncome,deductible:ytdExpenses,extraDeductible:ytdExtra,
   reductions:adjustment(from,to,['reduccion']),withholdings:adjustment(from,to,['retencion_soportada']),previousPayments:priorPayments,
   rate:n(settings?.irpf_prepayment_rate??20),difficultRate:n(settings?.difficult_expense_pct??5),
   difficultAnnualCap:n(settings?.difficult_expense_annual_cap??2000),difficultEnabled:settings?.difficult_expense_enabled!==false});
  const paid=taxPayments.find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===q&&x.status==='pagado');
  const status=paid?(Math.abs(n(paid.amount)-estimate.due)<.02?'Coincide al céntimo':'Diferencia '+(n(paid.amount)-estimate.due).toFixed(2)+' €'):'Sin pago registrado';
  rows.push([`${q}T`,periodIncome,-periodExpenses,periodIncome-periodExpenses,-estimate.difficult,estimate.base,-estimate.due,status]);
 }
 const ws=XLSX.utils.aoa_to_sheet([['Auditoría y conciliación con la gestoría - Año '+year],[],['Periodo','Ventas del trimestre','Gastos del trimestre','Resultado del trimestre','Difícil justificación acumulada','Base acumulada','130 a ingresar (trimestre)','Conciliación de pago'],...rows]);
 gestorTitle(ws,`Auditoría y conciliación con la gestoría - Año ${year}`,'H');gestorHeader(ws,2,8);
 ws['!cols']=[28,22,22,22,28,24,25,45].map(w=>({wch:w-XLSX_WCH_PAD}));
 sheetCurrency(ws,4,7,['B','C','D','E','F','G']);
 for(const [col,label] of [['A','Incidencia'],['B','Periodo'],['C','Importe incluido'],['D','Impacto en gasto'],['E','Impacto estimado en IRPF'],['F','Acción recomendada']])
  setCell(ws,col+'8',label,{font:{name:'Calibri',sz:10,bold:true},fill:{fgColor:{rgb:GESTOR_ALT}},alignment:{wrapText:true}});
 ws['!merges'].push(XLSX.utils.decode_range('A12:H17'));
 setCell(ws,'A12','Modelo 130 orientativo: cálculo acumulado desde enero, descontando pagos anteriores, retenciones y reducciones. Contrastar con la gestoría.',{font:{name:'Calibri',sz:11},alignment:{wrapText:true,vertical:'top'}});
 ws['!ref']='A1:H17';XLSX.utils.book_append_sheet(wb,ws,'Auditoría gestor');
}
export function buildGestorWorkbook(args){const wb=book();appendAuditSheet(wb,args);const lastDataQuarter=[...args.closings.map(x=>x.business_date),...args.expenses.map(x=>x.expense_date),...(args.invoices||[]).map(x=>x.issue_date),...(args.fiscalAdjustments||[]).map(x=>x.adjustment_date),...(args.incomeAdjustments||[]).map(x=>x.income_date)].filter(x=>String(x||'').startsWith(String(args.year)+'-')).reduce((max,x)=>Math.max(max,Math.ceil(Number(String(x).slice(5,7))/3)||0),0);const maxQ=args.firstSemesterOnly===true?2:args.onlyPeriodsWithData===true?Math.max(2,lastDataQuarter):4;for(let q=1;q<=maxQ;q++)appendReconciliationSheet(wb,q,args);for(let q=1;q<=maxQ;q++)appendGestorBookSheet(wb,q,args);appendInformationalPayments(wb,args.taxPayments,{from:args.year+'-01-01',to:args.year+'-12-31'});wb.Workbook=wb.Workbook||{};wb.Workbook.CalcPr={calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true};return wb;}
export function exportGestorWorkbook(args){const wb=buildGestorWorkbook(args);write(wb,`Libros_gestor_y_auditoria_${args.year}_Totus.xlsx`);}
export function workbookBlob(wb){return new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx',cellStyles:true})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}

export function buildGestorSourceWorkbook(args){
 const rows=buildGestorSourceRows(args),totals=gestorSourceTotals(rows),wb=book();
 const ws=XLSX.utils.aoa_to_sheet([[args.settings?.business_name||''],['Compras y gastos / Facturas recibidas (Var.Ex.-Desg.Sop./Rep.)'],[`${fmtDate(args.from)} - ${fmtDate(args.to)}`],[],GESTOR_SOURCE_COLUMNS,...rows,totals]);
 ws['!merges']=[XLSX.utils.decode_range('A1:Q1'),XLSX.utils.decode_range('A2:Q2'),XLSX.utils.decode_range('A3:Q3')];
 ws['!cols']=[6,12,12,20,4,45,30,14,8,14,15,8,15,18,16,8,16].map(w=>({wch:w}));
 ws['!autofilter']={ref:`A5:Q${5+rows.length}`};ws['!freeze']={ySplit:5};
 for(let r=5;r<=6+rows.length;r++)for(let c=0;c<17;c++){
  const addr=XLSX.utils.encode_cell({r:r-1,c}),cell=ws[addr];if(!cell)continue;
  const last=r===6+rows.length;
  cell.s={font:{name:'Arial',sz:10,bold:r===5||last,color:{rgb:r===5?'FFFFFF':'24354B'}},alignment:{horizontal:c>=7?'right':'left',vertical:'center',wrapText:c<7},fill:{fgColor:{rgb:r===5?'17365D':last?'DCE6F1':r%2===0?'F1F5FA':'FFFFFF'}},border:r===5||last?{top:{style:'thin',color:{rgb:'000000'}}}:undefined};
  if(c>=7)cell.z='#,##0.00';
  if(last&&GESTOR_AMOUNT_COLUMNS.includes(c)){cell.f=rows.length?`SUM(${XLSX.utils.encode_col(c)}6:${XLSX.utils.encode_col(c)}${5+rows.length})`:'0';cell.t='n'}
 }
 ws['A1'].s={font:{name:'Arial',sz:16,bold:true,color:{rgb:'17365D'}}};ws['A2'].s={font:{name:'Arial',sz:11,color:{rgb:'475569'}}};ws['!rows']=[{hpt:27},{hpt:21},{hpt:19},{hpt:8},{hpt:36},...rows.map(()=>({hpt:30})),{hpt:25}];
 ws[`A${6+rows.length}`]={t:'s',v:'TOTAL',s:{font:{name:'Arial',sz:10,bold:true,color:{rgb:'17365D'}},fill:{fgColor:{rgb:'DCE6F1'}}}};
 XLSX.utils.book_append_sheet(wb,ws,'Compras y gastos');
 return wb;
}
export function exportGestorSourceWorkbook(args){write(buildGestorSourceWorkbook(args),`Tabla_gestoria_${args.from}_${args.to}.xlsx`)}
