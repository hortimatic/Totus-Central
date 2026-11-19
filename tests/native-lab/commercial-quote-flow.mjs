import assert from 'node:assert/strict';
import {nativeCents} from '../../src/totustpv/server/native-adapter.js';
import {commercialFromNativeQuote} from '../../src/totustpv/server/commercial-quote-contract.js';
export async function exerciseCommercialQuote({api,command,fixture,customerId,addressId,session,drawer,inspect}){
 const capabilities=await api('totus_tpv_catalogue?product_id='+fixture.productId+'&product_capabilities_only=1');assert.equal(capabilities.result.commercial_quotes,true);assert.equal(capabilities.result.commercial_scope,true);
 const before=inspect(fixture.productId,0);assert.ok(before.stock>0&&before.stock<10000);
 for(const qty of [1,10000]){
  const cartCommand=command('cart.prepare',{session_id:session,drawer_id:drawer,customer_id:customerId,invoice_address_id:addressId,delivery_address_id:addressId,commercial_only:true,lines:[{product_id:fixture.productId,attribute_id:0,quantity:qty}]});
  const prepared=await api('totus_tpv_carts',{method:'POST',body:cartCommand});assert.equal(prepared.result.verified,true,JSON.stringify(prepared.result));assert.equal(prepared.result.commercial_only,true);
  assert.deepEqual((await api('totus_tpv_carts',{method:'POST',body:cartCommand})).result,prepared.result);
  const recovered=await api('totus_tpv_operations?operation_id='+cartCommand.operation_id,{actor:cartCommand.actor_id});assert.equal(recovered.result.status,'verified');assert.equal(recovered.result.result.commercial_only,true);
  const quotedCommand=command('cart.quote',{cart_id:prepared.result.cart_id,commercial_only:true}),quoted=await api('totus_tpv_quotes',{method:'POST',body:quotedCommand});assert.equal(quoted.result.verified,true,JSON.stringify(quoted.result));
  assert.equal(quoted.result.quote.commercial_only,true);assert.equal(quoted.result.quote.lines[0].quantity,qty);assert.ok(quoted.result.quote.lines[0].catalogue_name.length>0);
  const total=nativeCents(quoted.result.quote.total_tax_incl);assert.ok(total>0);
  const q=quoted.result.quote,scope={actorId:cartCommand.actor_id,connectionId:'local-connection',connectionRevision:1,storeId:'local-store',shopId:1,drawerId:drawer,sessionId:session,currency:q.currency,environment:'qa'};
  const snapshot=await commercialFromNativeQuote({scope,ownedCart:{...scope,commercialOnly:prepared.result.commercial_only===true,cartId:prepared.result.cart_id,customerId:q.customer_id,invoiceAddressId:q.invoice_address_id,deliveryAddressId:q.delivery_address_id,currencyId:q.currency_id,languageId:q.language_id,carrierId:q.carrier_id},profile:{...scope,verified:true,nativeVersion:'8.2.8',quoteLifetimeMs:120000},response:quoted.result});
  assert.equal(snapshot.snapshot.totalCents,total);assert.equal(snapshot.snapshot.lines[0].qty,qty);assert.equal(snapshot.expected,undefined);
  const sale=await api('totus_tpv_sales',{method:'POST',body:command('sale.commit',{cart_id:prepared.result.cart_id,quote_operation_id:quotedCommand.operation_id,quote_fingerprint:quoted.result.quote_fingerprint,payments:[{method:'cash',amount_cents:total,received_cents:total}]})});
  assert.equal(sale.result.status,'uncertain',JSON.stringify(sale.result));assert.equal(sale.result.reason,'TOTUS_SALE_COMMERCIAL_QUOTE_FORBIDDEN');
  const after=inspect(fixture.productId,prepared.result.cart_id);assert.equal(after.commercialOnly,true);assert.equal(after.orders,0);assert.equal(after.stock,before.stock);
 }
 console.log('PASS native commercial quotes: native prices and names with available/insufficient stock, durable commercial-only ownership, idempotent preparation, both paid-sale attempts refused before order creation, unchanged stock. Local lab only.');
}
