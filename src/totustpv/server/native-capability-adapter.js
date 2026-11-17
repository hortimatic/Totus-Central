/** Server-owned native capability adapter. Keeps Central's durable checkout,
 * independent order/payment readback and explicit cash/card attestations.
 * The native receipt supplies attributed stock movements, never a guessed
 * difference of global quantities. No write is performed during recovery.
 */
import {createNativeSaleAdapter} from './native-adapter.js';
import {paymentSummary} from '../model.js';
const need=(ok,code)=>{if(!ok)throw new Error(code);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function createNativeCapabilityAdapter({scope,transport,verifyPrepared}){
 scope=structuredClone(scope);
 need(['nativeCommand','readNativeOperation','assertMutationTarget'].every(key=>typeof transport?.[key]==='function'),
  'TPV_NATIVE_CAPABILITY_REQUIRED');
 function same(requested){need(requested&&['connectionId','connectionRevision','storeId','shopId','actorId','drawerId','sessionId','currency','environment']
  .every(key=>requested[key]===scope[key]),'TPV_NATIVE_ORDER_SCOPE_MISMATCH');}
 async function receipt(operationId,expected,orderId,sourceActorId=scope.actorId){
  need(uuid(operationId),'TPV_NATIVE_OPERATION_INVALID');
  const read=await transport.readNativeOperation(operationId,{sourceActorId}),result=read?.result;
  need(read?.status==='verified'&&result?.verified===true&&result.order_id===orderId&&result.native_reference===orderId&&
   result.cart_id===expected.cartId&&result.total_cents===expected.totalCents&&
   result.quote_operation_id===expected.nativeQuoteOperationId&&result.quote_fingerprint===expected.nativeQuoteFingerprint&&
   Array.isArray(result.invoice_ids)&&result.invoice_ids.length===1&&Array.isArray(result.inventory),
   'TPV_NATIVE_RECEIPT_MISMATCH');
  return result;
 }
 const base=createNativeSaleAdapter({scope,transport,verifyPrepared,
  async readInventoryEvidence({orderId,expected}){
   return (await receipt(expected.nativeSaleOperationId,expected,orderId,expected.nativeSourceActorId||scope.actorId)).inventory;
  }});
 function validatePayments({scope:requested,expected,payments}){
  same(requested);need(transport.assertMutationTarget()===true,'TPV_QA_POLICY_REQUIRED');
  need(expected?.paymentModule==='totuscentralconnector'&&uuid(expected.nativeQuoteOperationId)&&
   /^[a-f0-9]{64}$/.test(expected.nativeQuoteFingerprint||''),'TPV_NATIVE_CAPABILITY_QUOTE_REQUIRED');
  need(Array.isArray(payments)&&payments.length>0&&payments.length<=4&&
   new Set(payments.map(row=>row.method)).size===payments.length&&payments.every(row=>
    ['cash','card','bizum','transfer'].includes(row.method)&&typeof expected.nativePaymentLabels?.[row.method]==='string'),
   'TPV_NATIVE_PAYMENT_UNSUPPORTED');
  need(paymentSummary(expected.totalCents,payments).fullyPaid,'TPV_PAYMENT_NOT_SETTLED');return true;
 }
 return Object.freeze({ordersForCart:base.ordersForCart,validatePayments,
  async revalidatePrepared({scope:requested,record}){
   same(requested);
   // The owned native quote reads actual Cart flags and identities. The classic
   // Webservice omits some of those fields in 8.2.8; absence is not treated as
   // false. Validate them natively instead of issuing duplicate HTTP reads.
   return verifyPrepared({scope:structuredClone(scope),record:structuredClone(record)});
  },
  async submitOrderOnce({scope:requested,operationId,expected,payments}){
   validatePayments({scope:requested,expected,payments});need(uuid(operationId),'TPV_NATIVE_OPERATION_INVALID');
   const response=await transport.nativeCommand({operationId,command:'sale.commit',payload:{cart_id:expected.cartId,
    ...(expected.allowOutOfStock===true?{allow_out_of_stock:true}:{}),
    quote_operation_id:expected.nativeQuoteOperationId,quote_fingerprint:expected.nativeQuoteFingerprint,
    payments:payments.map(row=>({method:row.method,amount_cents:row.amountCents,
     ...(row.method==='cash'?{received_cents:row.receivedCents}:{})}))}});
   need(response?.verified===true&&Number.isSafeInteger(response.order_id)&&response.order_id>0,
    'TPV_NATIVE_SALE_UNCERTAIN');
   await receipt(operationId,expected,response.order_id);return {orderId:response.order_id};
  },
  async readSale({scope:requested,operationId,sourceActorId=scope.actorId,orderId,expected}){
   same(requested);const observed=await receipt(operationId,expected,orderId,sourceActorId);
   if(observed.order_evidence){
    need(observed.order_evidence.orderId===orderId&&observed.order_evidence.shopId===scope.shopId&&
     observed.order_evidence.cartId===expected.cartId,'TPV_NATIVE_RECEIPT_MISMATCH');
    // This evidence was freshly rebuilt by native GET recovery from actual
    // orders, details, payments, state, invoice and stock movements. Central's
    // verifyRemoteSale/payment checks still run; no global quantity is inferred.
    return {...structuredClone(observed.order_evidence),connectionId:scope.connectionId,storeId:scope.storeId};
   }
   return base.readSale({scope:requested,orderId,expected:{...structuredClone(expected),nativeSaleOperationId:operationId,nativeSourceActorId:sourceActorId}});
  }
 });
}
