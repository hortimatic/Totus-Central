import assert from 'node:assert/strict';
import {annualReportPlan} from '../src/report-package.js';
const data={stores:[],closings:[{business_date:'2026-01-01',cash_sales:500,include_in_income:true}],expenses:[
 {id:'e',expense_date:'2026-01-02',gross_expense:100,fiscal_reviewed:true,document_id:'prior-year'},
 {id:'internal',expense_date:'2026-01-03',gross_expense:20,management_only:true},
 {id:'pending',expense_date:'2026-01-04',gross_expense:10,fiscal_reviewed:false}
],invoices:[{id:'invoice',issue_date:'2026-01-05',status:'emitida',document_type:'factura',include_in_income:true,total_amount:50,generated_document_id:'future-year'}],fiscalAdjustments:[],incomeAdjustments:[],taxPayments:[
 {id:'tax',tax_type:'130',status:'pagado',payment_date:'2026-01-10',amount:30,document_id:'tax-proof'},
 {id:'not-paid',tax_type:'115',status:'previsto',payment_date:'2026-01-10',amount:999}
],documents:[
 {id:'prior-year',document_date:'2025-12-31'},
 {id:'future-year',document_date:'2027-01-01'},
 {id:'tax-proof',document_date:'2025-12-31'},
 {id:'standalone',document_date:'2026-08-01'},
 {id:'unrelated',document_date:'2025-01-01'}
]};
const plan=annualReportPlan(data,2026);
assert.equal(plan.sales,550);
assert.equal(plan.accounting,100);
assert.equal(plan.internalWithoutTax,20);
assert.equal(plan.taxInformation,30);
assert.equal(plan.internal,50);
assert.equal(plan.fiscalBalance,450,'Internal information must not reduce the fiscal comparison');
assert.equal(plan.cashBalance,400,'Informational cash control includes paid taxes once');
assert.deepEqual(plan.documents.map(x=>x.id).sort(),['prior-year','future-year','tax-proof','standalone'].sort());
assert.equal(new Set(plan.documents.map(x=>x.id)).size,plan.documents.length);
assert(plan.missingAttachments.some(x=>x.type==='Gasto'&&x.date==='2026-01-03'));
assert.throws(()=>annualReportPlan(data,2026.5),/año/i);
assert.throws(()=>annualReportPlan({...data,documents:data.documents.filter(d=>d.id!=='prior-year')},2026),/Faltan fichas/);
const linked=annualReportPlan({...data,expenses:[...data.expenses,{id:'reverse',expense_date:'2026-02-01',supplier_name:'Vínculo inverso',gross_expense:0}],documents:[...data.documents,{id:'reverse-doc',document_date:'2025-12-31',linked_entity_type:'expense',linked_entity_id:'reverse'}],taxPayments:[...data.taxPayments,{id:'missing-tax',tax_type:'115',status:'pagado',payment_date:'2026-02-02',amount:5}]},2026);
assert(linked.documents.some(d=>d.id==='reverse-doc'));
assert(!linked.missingAttachments.some(x=>x.name==='Vínculo inverso'));
assert(linked.missingAttachments.some(x=>x.type==='Impuesto pagado · control interno'));
console.log('ANNUAL PACKAGE QA: paid taxes are internal only; fiscal balance unaffected; cross-year linked originals, standalone documents, missing references and deduplication verified');
