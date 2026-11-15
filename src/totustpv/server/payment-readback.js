import {paymentSummary} from '../model.js';
const need=(ok,code)=>{if(!ok)throw new Error(code);};
/** The remote paid total alone cannot prove the selected payment method.
 * Compare actual native payment labels with the immutable configured labels.
 */
export function nativePaymentPlan(expected,accepted) {
 const labels=expected?.nativePaymentLabels;
 need(labels&&typeof labels==='object'&&!Array.isArray(labels),'TPV_NATIVE_PAYMENT_LABELS_REQUIRED');
 const configured=Object.entries(labels);
 need(configured.length>0&&configured.every(([method,label])=>
  ['cash','card','bizum','transfer','voucher','cheque'].includes(method)&&typeof label==='string'&&
  label.trim()===label&&label.length>0&&label.length<=70&&!/[\x00-\x1f]/.test(label))&&
  new Set(configured.map(([,label])=>label)).size===configured.length,'TPV_NATIVE_PAYMENT_LABELS_AMBIGUOUS');
 need(paymentSummary(expected.totalCents,accepted).fullyPaid,'TPV_PAYMENT_NOT_SETTLED');
 const planned=new Map();
 for(const payment of accepted){const label=labels[payment.method];need(label,'TPV_NATIVE_PAYMENT_LABELS_REQUIRED');
  planned.set(label,(planned.get(label)||0)+payment.amountCents);}
 return [...planned].map(([methodLabel,amountCents])=>({methodLabel,amountCents}));
}
export function verifyNativePaymentBreakdown(expected,accepted,observed) {
 const planned=new Map(nativePaymentPlan(expected,accepted).map(row=>[row.methodLabel,row.amountCents]));
 need(Array.isArray(observed)&&observed.length>0,'TPV_NATIVE_PAYMENT_METHOD_MISMATCH');
 const actual=new Map();
 for(const payment of observed){
  need(planned.has(payment.methodLabel)&&Number.isSafeInteger(payment.amountCents)&&payment.amountCents>0,
   'TPV_NATIVE_PAYMENT_METHOD_MISMATCH');
  const total=(actual.get(payment.methodLabel)||0)+payment.amountCents;
  need(Number.isSafeInteger(total),'TPV_NATIVE_PAYMENT_METHOD_MISMATCH');actual.set(payment.methodLabel,total);
 }
 need(actual.size===planned.size&&[...planned].every(([label,total])=>actual.get(label)===total),
  'TPV_NATIVE_PAYMENT_METHOD_MISMATCH');
 return true;
}
