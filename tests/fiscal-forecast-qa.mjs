import assert from 'node:assert/strict';
import {estimatePriorModel130,isReviewedFiscalExpense,deductibleExpenseTotal} from '../src/calculations.js';
import {state,patchFilters} from '../src/state.js';
import {fiscalidad} from '../src/pages/main.js';

state.user={role:'admin'};
state.data.stores=[{id:'h',name:'Hortimatic'},{id:'n',name:'NewOldSmok'}];
state.data.settings={irpf_prepayment_rate:20,difficult_expense_enabled:false};
state.data.closings=[{id:'q1',store_id:'h',business_date:'2026-03-31',cash_sales:1000,include_in_income:true},
 {id:'q2',store_id:'n',business_date:'2026-06-30',cash_sales:1000,include_in_income:true},
 {id:'q3',store_id:'h',business_date:'2026-08-01',cash_sales:500,include_in_income:true},
 {id:'later',store_id:'h',business_date:'2026-09-30',cash_sales:9000,include_in_income:true}];
state.data.expenses=[{id:'rent',store_id:'h',expense_date:'2026-08-01',management_only:false},
 {id:'internal',store_id:'h',expense_date:'2026-08-01',management_only:true,gross_expense:1000}];
state.data.expenseLines=[{expense_id:'rent',irpf_imputable:100,deductible_irpf:true,withholding_model:'115',withholding_amount:19},
 {expense_id:'internal',irpf_imputable:1000,deductible_irpf:true,withholding_model:'111',withholding_amount:900}];
state.data.invoices=[];state.data.incomeAdjustments=[];state.data.fiscalAdjustments=[];state.data.taxPayments=[];
assert.deepEqual(estimatePriorModel130(state.data,2026,3),{total:400,recorded:0,estimated:400});
patchFilters('fiscalidad',{from:'2026-07-01',to:'2026-08-31',store:'all',query:''});
const forecast=()=>fiscalidad().split('fiscal-forecast')[1].split('</section>')[0];
const before=forecast();
assert(before.includes('80,00')&&before.includes('19,00')&&before.includes('99,00'),'Forecast must use recorded income to the selected date and exclude internal costs');
state.data.taxPayments=[{tax_type:'130',fiscal_year:2026,quarter:3,status:'previsto',amount:99999},
 {tax_type:'115',fiscal_year:2026,quarter:3,status:'previsto',amount:88888},
 {tax_type:'130',fiscal_year:2026,quarter:1,status:'previsto',amount:77777}];
assert.equal(forecast(),before,'Current and historical comparison figures must not drive the independent forecast');
state.data.taxPayments.push({tax_type:'130',fiscal_year:2026,quarter:1,status:'pagado',amount:150});
assert.deepEqual(estimatePriorModel130(state.data,2026,3),{total:400,recorded:150,estimated:250});
state.data.taxPayments.push({tax_type:'115',fiscal_year:2026,quarter:3,status:'pagado',amount:19});
assert(forecast().includes('80,00'),'Actual payment reduces the reserve without overwriting the tax estimate');
state.data.closings=state.data.closings.filter(x=>x.id!=='later');
assert.equal(estimatePriorModel130(state.data,2026,4).total,480,'Future planning must carry forward our own earlier estimate when a payment has not been recorded');
assert.equal(isReviewedFiscalExpense({fiscal_reviewed:false,management_only:false}),false);
assert.equal(isReviewedFiscalExpense({fiscal_reviewed:true,management_only:true}),false);
assert.equal(isReviewedFiscalExpense({fiscal_reviewed:true,management_only:false}),true);
const savedForecast=forecast(),savedDeduction=deductibleExpenseTotal(state.data.expenses,state.data.expenseLines);
state.data.expenses.push(
 {id:'pending111',store_id:'h',expense_date:'2026-08-15',management_only:false,fiscal_reviewed:false},
 {id:'pending115',store_id:'n',expense_date:'2026-08-15',management_only:false,fiscal_reviewed:false});
state.data.expenseLines.push(
 {expense_id:'pending111',irpf_imputable:100,deductible_irpf:true,withholding_model:'111',withholding_amount:15},
 {expense_id:'pending115',irpf_imputable:100,deductible_irpf:true,withholding_model:'115',withholding_amount:19});
assert.equal(forecast(),savedForecast,'Unreviewed expenses must not change any of the three forecasts');
assert.equal(deductibleExpenseTotal(state.data.expenses,state.data.expenseLines),savedDeduction);
assert(fiscalidad().includes('2 gastos fiscales sin revisar'),'Missing visible exclusion warning');
state.data.expenses.find(x=>x.id==='pending111').fiscal_reviewed=true;
assert(forecast().includes('15,00'),'A reviewed expense must enter withholding forecasts');
assert(fiscalidad().includes('1 gasto fiscal sin revisar'));
patchFilters('fiscalidad',{store:'h'});
assert(!fiscalidad().includes('fiscal-pending-review'),'The warning must respect the selected store');
console.log('FISCAL FORECAST QA: independent references, live activity, date cutoff, both stores, internal costs, paid versus estimated advances and reserve');
