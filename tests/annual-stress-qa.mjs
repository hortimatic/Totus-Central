import assert from 'node:assert/strict';
import xlsx from 'xlsx-js-style';
import {computeModel130Accumulated} from '../src/calculations.js';
let output=null;
global.window={XLSX:{...xlsx,writeFile:(wb,name)=>{output={wb,name}}}};
const {buildGestorWorkbook,buildStoreAnnualWorkbook,exportSummaryWorkbook}=await import('../src/excel.js');
const shops=[{id:'h',name:'Hortimatic'},{id:'n',name:'NewOldSmok'}];
const data={year:2026,stores:shops,settings:{difficult_expense_pct:5,difficult_expense_annual_cap:2000,irpf_prepayment_rate:20,difficult_expense_enabled:true},
 closings:[],expenses:[],expenseLines:[],invoices:[],incomeAdjustments:[],fiscalAdjustments:[],taxPayments:[],categories:[]};
const monthKey=m=>String(m).padStart(2,'0');
for(let month=1;month<=12;month++){
 const m=monthKey(month),days=new Date(2026,month,0).getDate();
 for(let day=1;day<=days;day++)for(const shop of shops){
  const date='2026-'+m+'-'+monthKey(day),excluded=month===12&&day===days&&shop.id==='n';
  data.closings.push({id:shop.id+'c'+date,store_id:shop.id,business_date:date,include_in_income:!excluded,status:'cerrado',
   cash_sales:40,card_sales:20+day%4,bizum_sales:2,online_sales:3,other_income:1,cash_withdrawals:10});
 }
 for(const shop of shops){
  const extraCount=month===1?84:4;
  for(let k=0;k<extraCount;k++){
   const id=shop.id+'e'+month+'_'+k,internal=k===0,pending=k===1,date='2026-'+m+'-12';
   const amount=internal?300:pending?75:20+k;
   data.expenses.push({id,store_id:shop.id,expense_date:date,accounting_amount:amount,gross_expense:amount,
    amount_paid:amount,management_only:internal,fiscal_reviewed:!pending,description:'Gasto simulado '+id,supplier_name:'Proveedor QA',invoice_number:id});
   data.expenseLines.push({id:'l'+id,expense_id:id,sort_order:10,base_amount:amount,vat_rate:0,vat_amount:0,
    re_base:0,re_rate:0,re_amount:0,withholding_amount:0,deductible_irpf:!internal,irpf_imputable:internal?0:amount});
  }
  data.invoices.push({store_id:shop.id,issue_date:'2026-'+m+'-14',document_type:'factura',status:'emitida',include_in_income:true,total_amount:100});
  data.invoices.push({store_id:shop.id,issue_date:'2026-'+m+'-15',document_type:'factura',status:'borrador',include_in_income:true,total_amount:99999});
 }
}
data.expenses.push({id:'general',store_id:null,expense_date:'2026-04-10',accounting_amount:30,gross_expense:30,management_only:false,fiscal_reviewed:true});
data.expenseLines.push({id:'general-line',expense_id:'general',sort_order:10,base_amount:30,vat_amount:0,re_amount:0,deductible_irpf:true,irpf_imputable:30});
data.incomeAdjustments.push({store_id:null,income_date:'2026-01-11',amount:17},{store_id:'h',income_date:'2026-05-11',amount:23});
data.fiscalAdjustments.push({store_id:null,adjustment_date:'2026-04-11',kind:'gasto_deducible_extra',amount:40},
 {store_id:null,adjustment_date:'2026-07-11',kind:'reduccion',amount:12},
 {store_id:'n',adjustment_date:'2026-05-12',kind:'retencion_soportada',amount:5});
data.taxPayments.push({tax_type:'130',fiscal_year:2026,quarter:1,status:'pagado',amount:100},
 {tax_type:'130',fiscal_year:2026,quarter:2,status:'pagado',amount:200});
assert.equal(data.closings.length,730,'Debe simularse cada fecha del año en ambas tiendas');
assert(data.expenses.length>200,'Faltan gastos y casos excepcionales');
const netIncome=arr=>arr.filter(x=>x.include_in_income!==false).reduce((a,x)=>a+x.cash_sales+x.card_sales+x.bizum_sales+x.online_sales+x.other_income,0);
const amount=x=>Number(x.accounting_amount??x.gross_expense??x.amount_paid??0);
const fiscalExpenses=data.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false);
const pending=data.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed===false);
const internal=data.expenses.filter(x=>x.management_only);
const expectedIncome=netIncome(data.closings)+data.invoices.filter(x=>x.status==='emitida').reduce((a,x)=>a+x.total_amount,0)+40;
const expectedFiscal=fiscalExpenses.reduce((a,x)=>a+amount(x),0);
const expectedPending=pending.reduce((a,x)=>a+amount(x),0);
const expectedInternal=internal.reduce((a,x)=>a+amount(x),0);
exportSummaryWorkbook({closings:data.closings,expenses:data.expenses,stores:shops,invoices:data.invoices,fiscalAdjustments:data.fiscalAdjustments,incomeAdjustments:data.incomeAdjustments,from:'2026-01-01',to:'2026-12-31'});
assert(output?.wb?.Sheets?.Resumen,'El resumen no generó libro');
const summary=output.wb.Sheets.Resumen,perStore=output.wb.Sheets['Por tienda'];
const eq=(actual,expected,reason)=>assert(Math.abs(Number(actual)-expected)<0.02,reason+': '+actual+' frente a '+expected);
eq(summary.B8.v,expectedIncome,'Ingresos anuales cruzados');
eq(summary.B9.v,expectedFiscal+expectedPending,'Los gastos registrados incluyen facturas por cotejar');
eq(summary.B10.v,expectedInternal,'Gastos internos');
eq(summary.B13.v,expectedPending,'Gastos pendientes de revisar');
eq(summary.B12.v,expectedIncome-expectedFiscal-expectedPending-expectedInternal,'Resultado neto debe descontar gastos pendientes');
eq(perStore.E2.v+perStore.E3.v+perStore.E4.v,summary.B12.v,'Suma de resultados por tienda y sin tienda');
eq(perStore.F2.v+perStore.F3.v+perStore.F4.v,expectedPending,'Pendientes de los tres orígenes');
for(const store of shops){
 const wb=buildStoreAnnualWorkbook({...data,store});
 assert.equal(wb.SheetNames.length,12,store.name+': faltan meses');
 assert.equal(wb.Sheets.Enero['!ref'].match(/[0-9]+$/)?.[0]>80,true,'Más de 80 líneas en un mismo mes no pueden recortarse');
 const all=wb.SheetNames.flatMap(name=>Object.values(wb.Sheets[name]).filter(v=>v&&typeof v==='object').map(v=>v.v));
 assert(!all.includes(99999),'Una factura borrador se ha incorporado a las ventas diarias');
}
const gestor=buildGestorWorkbook(data);
assert(gestor.SheetNames.includes('Auditoría gestor'));
for(let q=1;q<=4;q++)assert(gestor.SheetNames.includes('Libro gestor '+q+'T')&&gestor.SheetNames.includes('Conciliación '+q+'T'),'Falta trimestre '+q);
const audit=gestor.Sheets['Auditoría gestor'];
for(let q=1;q<=4;q++){
 const end=String(q*3).padStart(2,'0')+'-'+new Date(2026,q*3,0).getDate();
 const until='2026-'+end;
 const closings=data.closings.filter(x=>x.business_date<=until);
 const invoices=data.invoices.filter(x=>x.issue_date<=until&&x.status==='emitida');
 const ytdIncome=netIncome(closings)+invoices.reduce((a,x)=>a+x.total_amount,0)
  +data.incomeAdjustments.filter(x=>x.income_date<=until).reduce((a,x)=>a+x.amount,0);
 const ytdDed=fiscalExpenses.filter(x=>x.expense_date<=until).reduce((a,x)=>a+amount(x),0);
 const prior=data.taxPayments.filter(x=>x.quarter<q).reduce((a,x)=>a+x.amount,0);
 const calc=computeModel130Accumulated({income:ytdIncome,deductible:ytdDed,extraDeductible:q>=2?40:0,
  reductions:q>=3?12:0,withholdings:q>=2?5:0,previousPayments:prior});
 eq(audit['G'+(q+3)].v,-calc.due,q+'T IRPF acumulado');
}
console.log('ANNUAL STRESS QA: 730 cierres, '+data.expenses.length+' gastos, 24 facturas emitidas, 24 borradores, 12 meses x 2 tiendas, 4 modelos 130 e ingresos comunes conciliados.');
