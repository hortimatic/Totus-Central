import {closingIncomeAmount,expenseCostAmount} from './calculations.js';
import {informationalTaxPayments} from './payment-information.js';
/** Uses the same amount functions and scope as the Informes summary. */
export function periodReport(data,filters){
 const sum=(rows,amount)=>rows.reduce((n,r)=>n+Number(amount(r)||0),0),money=n=>Math.round((n+Number.EPSILON)*100)/100;
 const closures=sum(data.closings,closingIncomeAmount);
 const invoices=sum(data.invoices.filter(r=>r.document_type==='factura'&&r.status==='emitida'&&r.include_in_income===true),r=>r.total_amount);
 const adjustments=sum(data.fiscalAdjustments.filter(r=>r.kind==='ingreso_extra'),r=>r.amount);
 const manual=sum(data.incomeAdjustments,r=>r.amount);
 const accounting=sum(data.expenses.filter(r=>!r.management_only),expenseCostAmount);
 const internal=sum(data.expenses.filter(r=>r.management_only),expenseCostAmount);
 const tax=sum(informationalTaxPayments(data.taxPayments,filters),r=>r.amount);
 return {from:filters.from,to:filters.to,store:filters.store||'all',currency:'EUR',complete:true,
  income:money(closures+invoices+adjustments+manual),income_breakdown:{closings:money(closures),issued_invoices:money(invoices),adjustments:money(adjustments),manual:money(manual)},
  recorded_expenses:money(accounting),internal_expenses:money(internal+tax),internal_breakdown:{expenses:money(internal),paid_taxes:money(tax)},result_before_taxes:money(closures+invoices+adjustments+manual-accounting),
  pending_fiscal_review:data.expenses.filter(r=>!r.management_only&&r.fiscal_reviewed===false).length,
  counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),note:'Coincide con el resumen de Informes para el mismo periodo y tienda, sin búsqueda de texto. Resultado antes de impuestos, no una liquidación fiscal.'};
}
