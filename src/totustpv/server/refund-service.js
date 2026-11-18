import {documentPaymentReferences} from '../payment-reference.js';
const need=(ok,code)=>{if(!ok)throw new Error(code);};
const uint=value=>Number.isSafeInteger(value)&&value>=0;
const positive=value=>uint(value)&&value>0;
const fields=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));

/** Exact cumulative allocation agrees with native partial-credit-note rounding.
 * All prices/caps come from authenticated native readback, not the browser.
 */
export function refundIntent({scope,sale,available,items,payments,reason}){
 need(reason===undefined||typeof reason==='string'&&reason.trim()===reason&&reason.length>0&&reason.length<=500&&!/[\x00-\x1f]/.test(reason),'TPV_REFUND_REASON_INVALID');
 need(sale?.status==='confirmed'&&sale.scope?.currency===scope.currency&&available?.sale_operation_id===sale.id&&
  available.order_id===sale.orderId&&available.currency_id===sale.expected?.currencyId&&
  /^[a-f0-9]{64}$/.test(available.state_fingerprint||'')&&Array.isArray(available.items), 'TPV_REFUND_SOURCE_INVALID');
 need(Array.isArray(items)&&items.length>0&&items.length<=200&&new Set(items.map(item=>item.detailId)).size===items.length,
  'TPV_REFUND_ITEMS_INVALID');
 const lineAmounts=[],preview=[];
 const selected=items.map(item=>{
  need(fields(item,['detailId','qty','restock'])&&positive(item.detailId)&&positive(item.qty)&&item.qty<=10000&&
   typeof item.restock==='boolean','TPV_REFUND_ITEMS_INVALID');
  const line=available.items.find(line=>line.detail_id===item.detailId);
  need(line&&positive(line.sold_quantity)&&uint(line.returned_quantity)&&uint(line.remaining_quantity)&&
   uint(line.allocated_cents)&&uint(line.refunded_cents)&&line.refunded_cents<=line.allocated_cents&&
   line.returned_quantity+line.remaining_quantity===line.sold_quantity&&item.qty<=line.remaining_quantity,
   'TPV_REFUND_QUANTITY_EXCEEDED');
  const cumulative=(BigInt(line.allocated_cents)*BigInt(line.returned_quantity+item.qty)*2n+BigInt(line.sold_quantity))/
   (BigInt(line.sold_quantity)*2n),amount=Number(cumulative)-line.refunded_cents;
  need(uint(amount),'TPV_REFUND_AMOUNT_INVALID');lineAmounts.push({detail_id:item.detailId,amount_cents:amount});
  preview.push({detailId:item.detailId,name:line.name,qty:item.qty,restock:item.restock,amountCents:amount});
  return {detail_id:item.detailId,quantity:item.qty,restock:item.restock};
 });
 const totalCents=lineAmounts.reduce((sum,line)=>sum+line.amount_cents,0);
 need(uint(totalCents)&&Array.isArray(payments)&&payments.length<=4&&new Set(payments.map(row=>row.method)).size===payments.length,
  'TPV_REFUND_PAYMENT_INVALID');
 const planned=payments.map(row=>{
  need(fields(row,['method','amountCents'])&&['cash','card','bizum','transfer'].includes(row.method)&&positive(row.amountCents)&&
   uint(available.remaining_payments?.[row.method])&&row.amountCents<=available.remaining_payments[row.method],
   'TPV_REFUND_PAYMENT_INVALID');
  return {method:row.method,amount_cents:row.amountCents};
 });
 need(planned.reduce((sum,row)=>sum+row.amount_cents,0)===totalCents,'TPV_REFUND_PAYMENT_INVALID');
 return {intent:{sale_operation_id:sale.id,state_fingerprint:available.state_fingerprint,items:selected,payments:planned,...(reason?{reason}:{})},
  totalCents,lineAmounts,preview};
}

export function createRefundService({rpc,transport,scope}){
 need(typeof rpc==='function'&&['readNativeReturnable','nativeCommand','readNativeOperation'].every(key=>typeof transport?.[key]==='function'),
  'TPV_REFUND_ADAPTER_REQUIRED');
 scope=structuredClone(scope);
 async function call(name,args){const response=await rpc(name,args);if(response?.error)
  throw new Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_REFUND_STORAGE_UNAVAILABLE');
  need(response&&Object.hasOwn(response,'data'),'TPV_REFUND_STORAGE_UNAVAILABLE');return response.data;}
 const journal=(action,id,data={})=>call('totus_tpv_refund_journal',{p_action:action,p_id:id,p_scope:scope,p_data:structuredClone(data)});
 const source=id=>call('totus_tpv_sale_for_return',{p_scope:scope,p_sale_id:id});
 async function available(saleId){const sale=await source(saleId),snapshot=await transport.readNativeReturnable(saleId);
  need(snapshot?.sale_operation_id===sale.id&&snapshot.order_id===sale.orderId&&sale.scope.currency===scope.currency,
   'TPV_REFUND_SOURCE_INVALID');return {sale,snapshot};}
 function result(record){return {id:record.id,saleId:record.saleId,status:record.status,totalCents:record.totalCents,
  result:record.result,reason:record.intent?.reason,retryRefundForbidden:record.status!=='ready'};}
 async function reconcile(record){
  need(record,'TPV_REFUND_NOT_FOUND');
  if(['ready','cancelled'].includes(record.status))return result(record);
  try{
   const sale=await source(record.saleId),read=await transport.readNativeOperation(record.id),observed=read?.result;
   need(read?.status==='verified'&&read.operation_id===record.id&&observed?.verified===true&&observed.native_reference===record.id&&
    observed.sale_operation_id===record.saleId&&observed.order_id===sale.orderId&&observed.total_cents===record.totalCents&&
    observed.external_refund_attested===true&&observed.bank_api_executed===false&&observed.reason===record.intent.reason,'TPV_REFUND_READBACK_REQUIRED');
   need(Array.isArray(observed.items)&&observed.items.length===record.intent.items.length&&Array.isArray(observed.refund_payments)&&
    observed.refund_payments.length===record.intent.payments.length,'TPV_REFUND_READBACK_REQUIRED');
   for(const item of record.intent.items){const found=observed.items.find(row=>row.detail_id===item.detail_id),
    amount=record.lineAmounts.find(row=>row.detail_id===item.detail_id)?.amount_cents;
    need(found&&uint(amount)&&uint(found.amount_cents)&&found.quantity===item.quantity&&found.restock===item.restock&&found.amount_cents===amount,'TPV_REFUND_READBACK_REQUIRED');}
   for(const payment of record.intent.payments)need(observed.refund_payments.some(row=>row.method===payment.method&&
    row.amount_cents===payment.amount_cents),'TPV_REFUND_READBACK_REQUIRED');
   need(Array.isArray(observed.credit_note_ids)&&(record.totalCents===0||observed.credit_note_ids.length>0)&&
    observed.credit_note_ids.every(positive)&&new Set(observed.credit_note_ids).size===observed.credit_note_ids.length,
    'TPV_REFUND_DOCUMENT_REQUIRED');
   return result(await journal('confirm',record.id,{result:observed}));
  }catch{
   try{const saved=await journal('uncertain',record.id);if(saved?.status==='confirmed')return result(saved);}catch{}
   return {...result(record),status:'uncertain',retryRefundForbidden:true};
  }
 }
 return Object.freeze({
  async returnable(saleId){const data=await available(saleId);
   const payment_intent=Array.isArray(data.sale.payments)?data.sale.payments.map(row=>row&&typeof row==='object'?{method:row.method,...(Object.hasOwn(row,'reference')?{external_reference:row.reference}:{})}:null):null;
   return {saleId,orderId:data.sale.orderId,pendingRefund:data.sale.pendingRefund,...data.snapshot,
    originalPaymentReferences:documentPaymentReferences({kind:'receipt',payment_intent})};},
  async prepare({operationId,saleId,items,payments,reason}){
   const data=await available(saleId),prepared=refundIntent({scope,sale:data.sale,available:data.snapshot,items,payments,reason});
   const record=await journal('prepare',operationId,{intent:prepared.intent,totalCents:prepared.totalCents,lineAmounts:prepared.lineAmounts});
   need(record?.status!=='cancelled','TPV_REFUND_CANCELLED');
   return {...result(record),lines:prepared.preview};
  },
  async submit({operationId,confirmation}){
   const record=await journal('get',operationId);need(record,'TPV_REFUND_NOT_FOUND');
   need(record.status!=='cancelled','TPV_REFUND_CANCELLED');
   if(record.status==='confirmed')return result(record);
   if(record.status!=='ready')return reconcile(record);
   need(fields(confirmation,['operationId','totalCents','currency','accepted'])&&confirmation.accepted===true&&
    confirmation.operationId===operationId&&confirmation.totalCents===record.totalCents&&confirmation.currency===scope.currency,
    'TPV_REFUND_CONFIRMATION_REQUIRED');
   const claimed=await journal('claim',operationId,{confirmation});
   if(claimed?.won===true){try{await transport.nativeCommand({operationId,command:'return.commit',
    payload:{...record.intent,operator_confirmed:true}});}catch{}}
   return reconcile(claimed);
  },async recover(operationId){return reconcile(await journal('get',operationId));},
  async cancel(operationId){return result(await journal('cancel',operationId));}
 });
}
