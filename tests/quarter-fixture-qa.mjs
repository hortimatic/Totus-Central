import xlsx from 'xlsx-js-style';
import {computeModel130Accumulated,deductibleExpenseTotal} from '../src/calculations.js';
global.window={XLSX:xlsx};
const {buildGestorWorkbook,buildStoreAnnualWorkbook}=await import('../src/excel.js');
const stores=[{id:'h',name:'Hortimatic'},{id:'n',name:'NewOldSmok'}];
const closing=(id,store,date,cash,card)=>({id,store_id:store,business_date:date,cash_sales:cash,card_sales:card,bizum_sales:0,online_sales:0,other_income:0,cash_withdrawals:0,include_in_income:true});
const expense=(id,store,date,amount,internal=false)=>({id,store_id:store,expense_date:date,accounting_amount:amount,gross_expense:amount,amount_paid:amount,management_only:internal,supplier_name:'Proveedor de simulación'});
const data={
 year:2026,stores,settings:{difficult_expense_pct:5,irpf_prepayment_rate:20},
 categories:[],expenseLines:[],taxPayments:[{tax_type:'130',fiscal_year:2026,quarter:1,status:'pagado',amount:61.712},{tax_type:'130',fiscal_year:2026,quarter:2,status:'pagado',amount:66.5}],
 closings:[
  closing('h1','h','2026-01-05',100,50),closing('h2','h','2026-02-05',0,200),closing('n1','n','2026-01-05',75,0),
  closing('h3','h','2026-04-05',500,0),closing('n2','n','2026-05-05',100,0),
  closing('h4','h','2026-07-05',300,0),closing('n3','n','2026-08-05',500,0)
 ],
 expenses:[
  expense('e1','h','2026-01-05',126.2),expense('e2','n','2026-01-10',65),expense('e3',null,'2026-01-12',100),expense('e4','h','2026-01-07',300,true),
  expense('e5','h','2026-04-05',200),expense('e6','n','2026-05-05',50),
  expense('e7','h','2026-07-05',300),expense('e8','n','2026-08-05',600)
 ],
 invoices:[
  {store_id:'h',issue_date:'2026-01-05',document_type:'factura',status:'emitida',include_in_income:true,total_amount:121},
  {store_id:'h',issue_date:'2026-04-05',document_type:'factura',status:'borrador',include_in_income:true,total_amount:999}
 ],
 fiscalAdjustments:[
  {store_id:'h',adjustment_date:'2026-02-05',kind:'ingreso_extra',amount:20},
  {store_id:null,adjustment_date:'2026-01-12',kind:'gasto_deducible_extra',amount:20}
 ],
 incomeAdjustments:[
  {store_id:'h',income_date:'2026-01-05',amount:30},
  {store_id:null,income_date:'2026-01-12',amount:40}
 ]
};
const wb=buildGestorWorkbook(data),audit=wb.Sheets['Auditoría gestor'];
const eq=(a,b,label)=>{if(Math.abs(Number(a)-b)>0.011)throw new Error(label+': '+a+' != '+b)};
eq(audit.B4.v,636,'1T incomes');
eq(audit.C4.v,-311.2,'1T gestor expenses (including extra deduction)');
eq(audit.D4.v,324.8,'1T profit');
eq(audit.E4.v,-16.24,'1T 5 percent');
eq(audit.G4.v,-61.712,'1T Modelo 130');
eq(audit.B5.v,600,'2T incomes');
eq(audit.C5.v,-250,'2T expenses');
eq(audit.D5.v,350,'2T profit');
eq(audit.B6.v,800,'3T incomes');
eq(audit.C6.v,-900,'3T expenses');
eq(audit.D6.v,-100,'3T loss');
eq(audit.E5.v,-33.74,'2T difficult expense must be accumulated, not quarterly');
eq(audit.F5.v,641.06,'2T cumulative taxable base');
eq(audit.G5.v,-66.5,'2T due minus Q1 payment');
eq(audit.E6.v,-28.74,'3T accumulated difficult expense recalculated after loss');
eq(audit.G6.v,0,'3T loss must not invent a new payment when prior installments exceed cumulative liability');
const calc=computeModel130Accumulated({income:1236,deductible:561.2,extraDeductible:0,previousPayments:61.712,difficultRate:5,rate:20});
eq(calc.due,66.5,'shared model 130 calculator');
if(!String(audit.H5.v).includes('Coincide'))throw new Error('Q2 previous payment not reconciled');
for(const r of [4,5,6])eq(audit['B'+r]?.v+audit['C'+r]?.v,audit['D'+r]?.v,r+'T arithmetic consistency');
const q1=wb.Sheets['Conciliación 1T'],q2=wb.Sheets['Conciliación 2T'],q3=wb.Sheets['Conciliación 3T'];
eq(q1.D4.v,150+75+121+30+40,'January income including general');
eq(q1.D5.v,200+20,'February income');
eq(q2.D4.v,500,'April income without draft invoice');
eq(q3.D4.v,300,'July income');
eq(q3.D5.v,500,'August income');
const previewData={...data,closings:[...data.closings,{...closing('excluded','h','2026-07-05',0,999),include_in_income:false}]};
const sampleAnnual=buildStoreAnnualWorkbook({...previewData,store:stores[0]});
if(sampleAnnual.Sheets.Julio.E5?.v===999||Object.values(sampleAnnual.Sheets.Julio).some(c=>c?.v===999))
 throw new Error('Los cierres excluidos no deben contaminar los libros por tienda');
for(const [name,amount] of [['Hortimatic',300],['NewOldSmok',600]]){
 const store=stores.find(x=>x.name===name),book=buildStoreAnnualWorkbook({...data,store});
 if(book.SheetNames.length!==12)throw Error('Store quarterly annual workbook incomplete');
 const july=book.Sheets.Julio,august=book.Sheets.Agosto;
 if(name==='Hortimatic'&&!Object.values(july).some(c=>c?.v===amount))throw Error('Q3 Horti expense not exported');
 if(name==='NewOldSmok'&&!Object.values(august).some(c=>c?.v===amount))throw Error('Q3 NewOld expense not exported');
}
const mixedCase={...data,expenseLines:[
 {expense_id:'e1',deductible_irpf:true,irpf_imputable:63.1,base_amount:100,vat_amount:21,re_amount:5.2,sort_order:10},
 {expense_id:'e2',deductible_irpf:false,irpf_imputable:65,base_amount:65,sort_order:10}
]};
const mixedWorkbook=buildGestorWorkbook(mixedCase);
eq(deductibleExpenseTotal(mixedCase.expenses,mixedCase.expenseLines),1313.1,'Shared IRPF expenses: 50% deductible and fully nondeductible');
const q1Ded=deductibleExpenseTotal(mixedCase.expenses.filter(e=>e.expense_date<='2026-03-31'),mixedCase.expenseLines);
eq(q1Ded,163.1,'First quarter deductible base mismatch');
const q1Calc=computeModel130Accumulated({income:636,deductible:q1Ded,extraDeductible:20,rate:20,difficultRate:5,difficultAnnualCap:2000});
eq(mixedWorkbook.Sheets['Auditoría gestor'].G4.v,-q1Calc.due,'Gestor workbook IRPF differs from Fiscalidad line calculation');
console.log('QUARTER QA: Q1/Q2/Q3, two stores, partial IRPF deductions, unreviewed and internal, draft invoices and shared formulas OK');
