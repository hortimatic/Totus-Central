import {expectedFromNativeQuote,nativeQuoteFingerprint} from './quote-contract.js';
const need=(ok,code)=>{if(!ok)throw new Error(code);};
/** Server preparation/revalidation coordinator; all providers are authenticated
 * adapters. Native quote requests can apply cart rules to the owned cart, but
 * never create a sale. Fresh calculations use a distinct quote request ID.
 */
export function createNativeQuoteVerifier({loadOwnedCart,readProfile,requestNativeQuote,readStockRecords,
 now=Date.now,uuid=()=>crypto.randomUUID()}) {
 for(const provider of [loadOwnedCart,readProfile,requestNativeQuote,readStockRecords,now,uuid])
  need(typeof provider==='function','TPV_NATIVE_QUOTE_ADAPTER_REQUIRED');
 async function calculate({scope,cartId}) {
  const selected=structuredClone(scope);
  const ownedCart=await loadOwnedCart({scope:selected,cartId});
  need(ownedCart?.cartId===cartId&&ownedCart.actorId===selected.actorId&&
   ['connectionId','connectionRevision','storeId','shopId','drawerId','sessionId','currency'].every(key=>
    ownedCart[key]===selected[key]),'TPV_CART_OWNERSHIP_REQUIRED');
  const profile=await readProfile({scope:structuredClone(selected)});
  const operationId=uuid();
  const response=await requestNativeQuote({scope:structuredClone(selected),cartId,operationId});
  const stockRecords=await readStockRecords({scope:structuredClone(selected),lines:structuredClone(response?.quote?.lines)});
  const prepared=await expectedFromNativeQuote({scope:selected,ownedCart,profile,response,stockRecords,now:now()});
  prepared.expected.nativeQuoteOperationId=operationId;
  return prepared;
 }
 return Object.freeze({calculate,
  async verifyPrepared({scope,record}) {
   need(record?.expected&&typeof record.expected.nativeQuoteFingerprint==='string','TPV_NATIVE_QUOTE_REQUIRED');
   const fresh=await calculate({scope,cartId:record.expected.cartId}),prior=record.expected,next=fresh.expected;
   const stockIdentity=expected=>expected.lines.map(line=>[line.productId,line.attributeId,line.qty,line.stockRecordId]);
   const binding=expected=>({paymentModule:expected.paymentModule,nativePaymentLabels:expected.nativePaymentLabels,
    operatorPaymentPolicy:expected.operatorPaymentPolicy,paidStateIds:expected.paidStateIds,stock:stockIdentity(expected)});
   need(next.nativeQuoteFingerprint===prior.nativeQuoteFingerprint&&
    await nativeQuoteFingerprint(binding(prior))===await nativeQuoteFingerprint(binding(next)),
    'TPV_QUOTE_CHANGED');
   return {unchanged:true,cartId:next.cartId};
  }
 });
}
