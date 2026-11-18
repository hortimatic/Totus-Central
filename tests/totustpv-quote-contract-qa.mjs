import test from 'node:test';import assert from 'node:assert/strict';
import {expectedFromNativeQuote,nativeQuoteFingerprint} from '../src/totustpv/server/quote-contract.js';
import {createNativeQuoteVerifier} from '../src/totustpv/server/quote-verifier.js';
const scope={actorId:'actor',connectionId:'connection',connectionRevision:1,storeId:'store',shopId:1,
 drawerId:'drawer',sessionId:'session',currency:'EUR'};
const ownedCart={...scope,id:'owned-operation',cartId:701,customerId:501,invoiceAddressId:601,deliveryAddressId:602,
 currencyId:2,languageId:1,carrierId:5};
const profile={...scope,verified:true,nativeVersion:'8.2.8',quoteLifetimeMs:120000,paymentModule:'totustpv',
 nativePaymentLabels:{cash:'Efectivo',card:'Tarjeta'},operatorPaymentPolicy:{revision:1,modes:{cash:'cash-in-hand',card:'external-terminal'}},paidStateIds:[11]};
const quote={cart_id:701,shop_id:1,customer_id:501,invoice_address_id:601,delivery_address_id:602,currency_id:2,
 currency:'EUR',language_id:1,carrier_id:5,total_tax_incl:'8.010000',total_tax_excl:'6.620000',
 products_tax_incl:'8.010000',products_tax_excl:'6.620000',shipping_tax_incl:'0.000000',discounts_tax_incl:'0.000000',
 round_mode:2,round_type:2,total_cents:801,lines:[{product_id:101,attribute_id:7,quantity:1,
 unit_tax_incl:'8.012100',unit_tax_excl:'6.621570',line_tax_incl:'8.010000',line_tax_excl:'6.620000'}]};
const stockRecords=[{id:801,productId:101,attributeId:7,shopId:1,shopGroupId:0,dependsOnStock:false,quantity:5}];
async function run(patch={}){return expectedFromNativeQuote({scope,ownedCart,profile,stockRecords,now:100000,
 response:{verified:true,native_reference:701,quoted_at:99900,quote,quote_fingerprint:await nativeQuoteFingerprint(quote)},...patch});}
test('commercial quotations can never become a financial checkout quote',async()=>{
 for(const commercial_only of [true,'true',1])await assert.rejects(run({response:{quote:{...quote,commercial_only}}}),/TPV_COMMERCIAL_QUOTE_NOT_PAYABLE/);
});
test('native quote keeps exact unit prices, authoritative rounded line totals and bounded expiry',async()=>{
 const result=await run();assert.equal(result.expected.totalCents,801);
 assert.equal(result.expected.lines[0].unitTaxInclMicros,8012100);assert.equal(result.expected.lines[0].lineTaxInclCents,801);
 assert.equal(result.expected.lines[0].stockRecordId,801);assert.equal(result.quoteExpiresAt,219900);
});

test('configured payment references require a typed native capability sealed in the owned quote',async()=>{
 const configured={...profile,operatorPaymentPolicy:{...profile.operatorPaymentPolicy,referencePolicy:{card:'required'}}};
 for(const marker of [undefined,false,'true',1]){
  const changed=marker===undefined?quote:{...quote,payment_reference_annotations:marker};
  await assert.rejects(run({profile:configured,response:{verified:true,native_reference:701,quoted_at:99900,quote:changed,quote_fingerprint:await nativeQuoteFingerprint(changed)}}),/REFERENCE_UNAVAILABLE/);
 }
 const changed={...quote,payment_reference_annotations:true};
 const result=await run({profile:configured,response:{verified:true,native_reference:701,quoted_at:99900,quote:changed,quote_fingerprint:await nativeQuoteFingerprint(changed)}});
 assert.equal(result.expected.supportsPaymentReferences,true);
});
test('insufficient stock requires explicit workstation policy and sealed native counter permission, including negative-stock bounds',async()=>{
 const withPolicy=async({enabled,native=true,quantity=0}={})=>{
  const changed={...quote,lines:[{...quote.lines[0],allow_out_of_stock:native}]};
  return run({profile:{...profile,allowOutOfStock:enabled},stockRecords:[{...stockRecords[0],quantity}],response:{verified:true,native_reference:701,quoted_at:99900,quote:changed,quote_fingerprint:await nativeQuoteFingerprint(changed)}});
 };
 for(const enabled of [undefined,false])await assert.rejects(withPolicy({enabled}),/STOCK_UNAVAILABLE/);
 await assert.rejects(withPolicy({enabled:true,native:false}),/STOCK_UNAVAILABLE/);
 await assert.rejects(withPolicy({enabled:'true'}),/PROFILE_INVALID/);
 await assert.rejects(withPolicy({enabled:true,native:'true'}),/LINES_INVALID/);
 await assert.rejects(run({profile:{...profile,allowOutOfStock:true}}),/STOCK_POLICY_UNAVAILABLE/);
 const allowed=await withPolicy({enabled:true,quantity:-2});assert.equal(allowed.expected.allowOutOfStock,true);assert.equal(allowed.expected.lines[0].stockBefore,-2);
 await assert.rejects(withPolicy({enabled:true,quantity:-2147483648}),/STOCK_UNAVAILABLE/);
 await assert.rejects(withPolicy({enabled:true,quantity:0.5}),/STOCK_UNAVAILABLE/);
});
test('canonical fingerprint is insensitive to field order, but not changed line prices',async()=>{
 const reverse=Object.fromEntries(Object.entries(quote).reverse());assert.equal(await nativeQuoteFingerprint(reverse),await nativeQuoteFingerprint(quote));
 const response={verified:true,native_reference:701,quoted_at:99900,quote:{...quote,total_tax_incl:'7.00'},quote_fingerprint:await nativeQuoteFingerprint(quote)};
 await assert.rejects(run({response}),/FINGERPRINT_MISMATCH/);
});
test('foreign cashier/cash session, stale connection, missing stock and wrong native customer are blocked',async()=>{
 for(const patch of [{ownedCart:{...ownedCart,actorId:'other'}},{ownedCart:{...ownedCart,sessionId:'other'}},
  {profile:{...profile,connectionRevision:2}},{profile:{...profile,verified:false}},
  {stockRecords:[{...stockRecords[0],quantity:0}]},{stockRecords:[{...stockRecords[0],shopId:2}]}])await assert.rejects(run(patch));
 const changed={...quote,customer_id:502};await assert.rejects(run({response:{verified:true,native_reference:701,quoted_at:99900,
  quote:changed,quote_fingerprint:await nativeQuoteFingerprint(changed)}}),/SCOPE_MISMATCH/);
});
test('expired/future native quote and a reconstructed total inconsistent with native lines are refused',async()=>{
 for(const quoted_at of [-30000,106000])await assert.rejects(run({response:{verified:true,native_reference:701,quoted_at,
  quote,quote_fingerprint:await nativeQuoteFingerprint(quote)}}),/EXPIRED/);
 const changed={...quote,total_cents:802,total_tax_incl:'8.020000'};
 await assert.rejects(run({response:{verified:true,native_reference:701,quoted_at:99900,quote:changed,
  quote_fingerprint:await nativeQuoteFingerprint(changed)}}),/TOTAL_INVALID/);
});
test('checkout revalidation recalculates owned native cart; changed prices/policy or insufficient stock cannot pass',async()=>{
 let currentQuote=structuredClone(quote),currentPolicy=structuredClone(profile),stock=structuredClone(stockRecords),calls=[];
 const verifier=createNativeQuoteVerifier({loadOwnedCart:async()=>structuredClone(ownedCart),
  readProfile:async()=>structuredClone(currentPolicy),readStockRecords:async()=>structuredClone(stock),now:()=>100000,
  uuid:()=>`quote-${calls.length+1}`,requestNativeQuote:async request=>{calls.push(request);return {
   verified:true,native_reference:701,quoted_at:99900,quote:structuredClone(currentQuote),quote_fingerprint:await nativeQuoteFingerprint(currentQuote)};}});
 const record=await verifier.calculate({scope,cartId:701});
 assert.equal((await verifier.verifyPrepared({scope,record})).unchanged,true);
 assert.notEqual(calls[0].operationId,calls[1].operationId);
 stock[0].quantity=4;assert.equal((await verifier.verifyPrepared({scope,record})).unchanged,true);
 stock[0].quantity=0;await assert.rejects(verifier.verifyPrepared({scope,record}),/STOCK_UNAVAILABLE/);stock[0].quantity=5;
 currentPolicy.operatorPaymentPolicy.revision=2;await assert.rejects(verifier.verifyPrepared({scope,record}),/QUOTE_CHANGED/);
 currentPolicy=structuredClone(profile);currentQuote.total_cents=901;currentQuote.total_tax_incl='9.010000';
 currentQuote.products_tax_incl='9.010000';currentQuote.lines[0].unit_tax_incl='9.012100';currentQuote.lines[0].line_tax_incl='9.010000';
 await assert.rejects(verifier.verifyPrepared({scope,record}),/QUOTE_CHANGED/);
});
