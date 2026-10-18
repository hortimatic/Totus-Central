import assert from 'node:assert/strict';
import {validateInvoiceSettlement,invoiceOutstanding,isInvoiceRefund} from '../src/calculations.js';
import {state} from '../src/state.js';
import {inicio,invoicePreview,invoiceRecordHtml} from '../src/pages/main.js';
const today='2026-10-18';
for(const total of [121,-121]){
 for(const [amount,status,date] of [[0,'pendiente',null],[20,'parcial',today],[121,'pagada',today]])
  assert.equal(validateInvoiceSettlement(total,amount,status,date,today),true);
 for(const [amount,status,date] of [[-1,'parcial',today],[122,'pagada',today],[121,'parcial',today],[20,'parcial',null],[121,'pagada',null],[10,'pendiente',null],[0,'unknown',null],[NaN,'pendiente',null],[20,'parcial','2026-10-19']])
  assert.throws(()=>validateInvoiceSettlement(total,amount,status,date,today));
}
assert.equal(invoiceOutstanding({total_amount:-121,paid_amount:20}),101);
assert.equal(isInvoiceRefund({invoice_kind:'rectifying',total_amount:-121}),true);
state.user={role:'admin',email:'qa@example.invalid'};
const original={id:'original',document_type:'factura',invoice_kind:'invoice',status:'emitida',total_amount:121,paid_amount:121,paid_status:'pagada',display_number:'F-2026-001',issue_date:today,customer_name:'QA',include_in_income:true};
const credit={id:'credit',document_type:'factura',invoice_kind:'rectifying',status:'emitida',total_amount:-121,paid_amount:20,paid_status:'parcial',display_number:'R-2026-001',issue_date:today,rectified_invoice_id:original.id,rectified_invoice_snapshot:{number:'F-2026-001',issue_date:today},rectification_reason:'Devolución de artículo <QA>'};
state.data.invoices=[original,credit];
const html=invoicePreview(credit);
assert.match(html,/F-2026-001/);assert.match(html,/Devolución de artículo &lt;QA&gt;/);
assert.match(html,/Devuelto/);assert.match(html,/101,00/);
assert.match(inicio(),/Devoluciones pendientes/);
assert.match(inicio(),/Pendiente de cobro<\/span><strong>0,00/,'A refund must not appear as money receivable');
const form=invoiceRecordHtml(null,'factura','rectifying');
assert.match(form,/ivRectifiedInvoice/);assert.match(form,/ivRectificationReason/);
console.log('RECTIFYING REFUNDS QA: original reference, reason, positive settlement magnitudes, pending refunds and encoded print output OK');
