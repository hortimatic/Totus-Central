import {selectReportData,reportMonths} from './report-period.js';
import {informationalTaxPayments} from './payment-information.js';
import {closingIncomeAmount,expenseCostAmount} from './calculations.js';
export function calendarReportPeriod(year,kind,index){
 year=Number(year);index=Number(index);if(!Number.isInteger(year)||year<2000||year>2199)throw new Error('Indica un año entre 2000 y 2199.');
 if(!['month','quarter'].includes(kind)||!Number.isInteger(index)||index<1||index>(kind==='month'?12:4))throw new Error('Selecciona un mes o trimestre válido.');
 const start=kind==='month'?index:(index-1)*3+1,end=kind==='month'?index:index*3;
 return {from:year+'-'+String(start).padStart(2,'0')+'-01',to:year+'-'+String(end).padStart(2,'0')+'-'+new Date(Date.UTC(year,end,0)).getUTCDate()};
}
export function reportPackagePlan(data,filters){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(filters.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(filters.to||'')||filters.from>filters.to||filters.from.slice(0,4)!==filters.to.slice(0,4))throw new Error('Selecciona un periodo válido de un único ejercicio.');
 const selected=selectReportData(data,filters),expenseIds=new Set(selected.expenses.map(x=>x.id)),invoices=selected.invoices.filter(x=>x.document_type==='factura'&&x.status==='emitida'),invoiceIds=new Set(invoices.map(x=>x.id)),ids=new Set();
 const add=id=>{if(id)ids.add(id)};
 selected.expenses.forEach(x=>add(x.document_id));invoices.forEach(x=>{add(x.generated_document_id);add(x.source_document_id)});
 const taxPayments=informationalTaxPayments(data.taxPayments,filters);taxPayments.forEach(x=>add(x.document_id));
 for(const d of data.documents||[])if((d.linked_entity_type==='expense'&&expenseIds.has(d.linked_entity_id))||(d.linked_entity_type==='sales_invoice'&&invoiceIds.has(d.linked_entity_id)))add(d.id);
 const documents=(data.documents||[]).filter(d=>ids.has(d.id));
 const missing=[...ids].filter(id=>!documents.some(d=>d.id===id));
 if(missing.length)throw new Error('Faltan fichas de documentos vinculados. Actualiza antes de preparar el paquete.');
 const missingAttachments=[
  ...selected.expenses.map(x=>({type:'Gasto',date:x.expense_date,name:x.supplier_name,number:x.invoice_number,attached:!!(x.document_id||(data.documents||[]).some(d=>d.linked_entity_type==='expense'&&d.linked_entity_id===x.id))})),
  ...invoices.map(x=>({type:'Factura cliente',date:x.issue_date,name:x.customer_name,number:x.display_number||x.external_number_text,attached:!!(x.generated_document_id||x.source_document_id||(data.documents||[]).some(d=>d.linked_entity_type==='sales_invoice'&&d.linked_entity_id===x.id))})),
  ...taxPayments.map(x=>({type:'Impuesto pagado · control interno',date:x.payment_date,name:'Agencia Tributaria',number:'Modelo '+x.tax_type+' · '+x.quarter+'T '+x.fiscal_year,attached:!!x.document_id}))
 ].filter(x=>!x.attached);
 return {...selected,invoices,documents,taxPayments,missingAttachments,months:reportMonths(filters),year:Number(filters.from.slice(0,4)),from:filters.from,to:filters.to,store:filters.store||'all',key:filters.from+'_'+filters.to};
}

/** Annual downloads keep standalone annual documents and every linked original,
 * even when its file date is outside the accounting year. Paid taxes remain
 * informational cash movements and never reduce the fiscal comparison. */
export function annualReportPlan(data,year){
 year=Number(year);
 if(!Number.isInteger(year)||year<2000||year>2199)throw new Error('Indica un año entre 2000 y 2199.');
 const plan=reportPackagePlan(data,{from:year+'-01-01',to:year+'-12-31',store:'all',query:''});
 const linked=new Set(plan.documents.map(d=>d.id));
 const documents=(data.documents||[]).filter(d=>linked.has(d.id)||String(d.document_date||d.created_at||'').startsWith(year+'-'));
 const sum=(rows,amount)=>rows.reduce((s,row)=>s+Number(amount(row)||0),0);
 const sales=sum(plan.closings.filter(x=>x.include_in_income!==false),closingIncomeAmount)
  +sum(plan.invoices.filter(x=>x.include_in_income===true),x=>x.total_amount)
  +sum(plan.fiscalAdjustments.filter(x=>x.kind==='ingreso_extra'),x=>x.amount)
  +sum(plan.incomeAdjustments,x=>x.amount);
 const accounting=sum(plan.expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false),expenseCostAmount);
 const internalWithoutTax=sum(plan.expenses.filter(x=>x.management_only),expenseCostAmount);
 const taxInformation=sum(plan.taxPayments,x=>x.amount),internal=internalWithoutTax+taxInformation;
 return {...plan,documents,sales,accounting,internalWithoutTax,taxInformation,internal,
  fiscalBalance:sales-accounting,cashBalance:sales-accounting-internal};
}
