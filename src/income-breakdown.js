import {closingIncomeAmount} from './calculations.js';
const sum=(rows,key)=>rows.reduce((s,r)=>s+Number(typeof key==='function'?key(r):r[key]||0),0);
const cents=v=>Math.round((v+Number.EPSILON)*100)/100;
export function incomeBreakdown(closings=[],additional=0){
 const rows=closings.filter(c=>c.include_in_income!==false);
 const card=sum(rows,'card_sales'),withdrawals=sum(rows,'cash_withdrawals');
 const cashChange=sum(rows,c=>Number(c.actual_cash||0)-Number(c.opening_cash||0));
 const cashMovements=sum(rows,c=>Number(c.cash_expenses_declared||0)+Number(c.cash_extra_out||0)-Number(c.cash_extra_in||0));
 const other=sum(rows,c=>Number(c.bizum_sales||0)+Number(c.online_sales||0)+Number(c.other_income||0));
 const closingTotal=sum(rows,closingIncomeAmount);
 const difference=closingTotal-card-withdrawals-cashChange-cashMovements-other;
 return Object.fromEntries(Object.entries({card,withdrawals,cashChange,cashMovements,other,difference,additional,total:closingTotal+Number(additional||0)}).map(([k,v])=>[k,cents(v)]));
}
