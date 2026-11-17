import test from 'node:test';import assert from 'node:assert/strict';
import {commercialFromNativeQuote} from '../src/totustpv/server/commercial-quote-contract.js';
import {nativeQuoteFingerprint,expectedFromNativeQuote} from '../src/totustpv/server/quote-contract.js';
const scope={actorId:'actor',connectionId:'connection',connectionRevision:1,storeId:'store',shopId:1,drawerId:'drawer',sessionId:'session',currency:'EUR',environment:'qa'},ownedCart={...scope,commercialOnly:true,cartId:701,customerId:501,invoiceAddressId:601,deliveryAddressId:602,currencyId:2,languageId:1,carrierId:5},profile={...scope,verified:true,nativeVersion:'8.2.8',quoteLifetimeMs:120000};
const quote={commercial_only:true,cart_id:701,shop_id:1,customer_id:501,invoice_address_id:601,delivery_address_id:602,currency_id:2,currency:'EUR',language_id:1,carrier_id:5,round_mode:2,round_type:2,total_tax_incl:'8.010000',total_tax_excl:'6.620000',products_tax_incl:'8.010000',products_tax_excl:'6.620000',shipping_tax_incl:'0.000000',discounts_tax_incl:'0.000000',total_cents:801,lines:[{product_id:101,attribute_id:7,quantity:1,catalogue_name:'Artículo · Rojo',unit_tax_incl:'8.012100',unit_tax_excl:'6.621570',line_tax_incl:'8.010000',line_tax_excl:'6.620000'}]};
async function run(patch={},q=quote){return commercialFromNativeQuote({scope,ownedCart,profile,now:100000,response:{verified:true,native_reference:701,quoted_at:99900,quote:q,quote_fingerprint:await nativeQuoteFingerprint(q)},...patch});}
test('commercial snapshots preserve native pricing and names without stock or payment authority',async()=>{
 const result=await run();assert.equal(result.commercial,true);assert.equal(result.snapshot.totalCents,801);assert.equal(result.snapshot.lines[0].unitTaxInclMicros,8012100);assert.equal(result.snapshot.lines[0].name,'Artículo · Rojo');
 assert.equal(result.expected,undefined);for(const key of ['paymentModule','paidStateIds','nativePaymentLabels','stockBefore','stockRecordId'])assert.equal(JSON.stringify(result).includes(key),false);
 await assert.rejects(expectedFromNativeQuote({response:{quote}}),/COMMERCIAL_QUOTE_NOT_PAYABLE/);
});
test('commercial snapshot rejects foreign ownership, ordinary carts, expiry, price tampering and unnamed lines',async()=>{
 for(const patch of [{ownedCart:{...ownedCart,commercialOnly:false}},{scope:{...scope,actorId:'foreign'}},{scope:{...scope,drawerId:'foreign'}},{now:300000},{response:{verified:true,native_reference:701,quoted_at:99900,quote:{...quote,total_cents:1},quote_fingerprint:'0'.repeat(64)}}])await assert.rejects(run(patch),/TPV_/);
 await assert.rejects(run({}, {...quote,commercial_only:false}),/COMMERCIAL_QUOTE_REQUIRED/);
 await assert.rejects(run({}, {...quote,lines:[{...quote.lines[0],catalogue_name:''}]}),/LINE_NAME_INVALID/);
 await assert.rejects(run({}, {...quote,total_cents:1}),/TOTAL_INVALID/);
});
test('zero-price commercial quotes are valid without constructing a zero-value payment',async()=>{
 const q={...quote,total_cents:0,total_tax_incl:'0.000000',total_tax_excl:'0.000000',products_tax_incl:'0.000000',products_tax_excl:'0.000000',lines:[{...quote.lines[0],unit_tax_incl:'0.000000',unit_tax_excl:'0.000000',line_tax_incl:'0.000000',line_tax_excl:'0.000000'}]};
 const result=await run({},q);assert.equal(result.snapshot.totalCents,0);assert.equal(result.expected,undefined);
});
