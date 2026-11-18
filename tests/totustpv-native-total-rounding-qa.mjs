/** Local PS cart/order/invoice; recorded native readback, not an HTTP test. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {expectedFromNativeQuote} from '../src/totustpv/server/quote-contract.js';
import {createNativeSaleAdapter} from '../src/totustpv/server/native-adapter.js';
import {verifyRemoteSale} from '../src/totustpv/model.js';
const php=path.resolve('artifacts/php82/php.exe'),ini=path.resolve('artifacts/native-lab/php.ini');
await fs.copyFile('connectors/prestashop/src/NativeDocuments.php','artifacts/native-lab/shop/modules/totuscentralconnector/src/NativeDocuments.php');
execFileSync(php,['-c',ini,'tests/native-lab/rounding-cart-probe.php','--order','--mixed-tax','--type=3'],{
 env:{...process.env,OPENSSL_CONF:path.resolve('artifacts/php82/extras/ssl/openssl.cnf')},maxBuffer:4*1024*1024});
const [evidence]=JSON.parse(await fs.readFile('artifacts/native-lab/rounding-order-mixed-probe-type3.json','utf8'));
const response=evidence.nativeQuote,q=response.quote,r=evidence.readback;
const scope={actorId:'local-operator',connectionId:'local-native',connectionRevision:1,storeId:'local-store',shopId:q.shop_id,drawerId:'local-drawer',sessionId:'local-session',currency:q.currency,environment:'qa'};
const ownedCart={...scope,id:'local-owned-cart',cartId:q.cart_id,customerId:q.customer_id,invoiceAddressId:q.invoice_address_id,deliveryAddressId:q.delivery_address_id,currencyId:q.currency_id,languageId:q.language_id,carrierId:q.carrier_id};
const profile={...scope,verified:true,nativeVersion:'8.2.8',quoteLifetimeMs:120000,paymentModule:r.order.module,nativePaymentLabels:{cash:r.payments[0].payment_method},operatorPaymentPolicy:{revision:1,modes:{cash:'cash-in-hand'}},paidStateIds:[r.state.id]};
const {expected}=await expectedFromNativeQuote({scope,ownedCart,profile,response,stockRecords:evidence.stockRecords,now:response.quoted_at});
const responses={['orders/'+r.order.id]:{order:r.order},['order_states/'+r.state.id]:{order_state:r.state},['currencies/'+r.currency.id]:{currency:r.currency},order_details:{order_details:r.details},order_payments:{order_payments:r.payments}};
const adapter=createNativeSaleAdapter({scope,transport:{read:async resource=>structuredClone(responses[resource]),createOrderOnce:async()=>{throw Error('No replay allowed');}},verifyPrepared:async()=>({unchanged:true}),readInventoryEvidence:async()=>structuredClone(evidence.inventory)});
const observed=await adapter.readSale({scope,orderId:Number(r.order.id),expected});
assert.equal(verifyRemoteSale(expected,observed).status,'confirmed');
assert.equal(expected.totalCents,222);
assert.equal(evidence.order.paidCents,222);
assert.equal(evidence.order.invoiceGross,'2.220000');
assert.equal(evidence.order.invoiceNet,'2.010000');
assert.equal(expected.lines.reduce((sum,line)=>sum+line.lineTaxInclCents,0),222);
assert.equal(expected.lines.reduce((sum,line)=>sum+line.lineTaxExclCents,0),201);
assert.ok(evidence.inventory.every(row=>row.before-row.after===1));
const exempt=expected.lines.find(line=>line.unitTaxInclMicros===line.unitTaxExclMicros);
assert.equal(exempt.lineTaxInclCents,exempt.lineTaxExclCents);
console.log('PASS actual local PS8.2.8: total-rounded mixed-tax quote, order, payment and invoice 2.22 EUR; net 2.01 EUR, exact native micros and stock verified. Readback uses native snapshots, not HTTP.');

assert.deepEqual(evidence.ticketAmounts,expected.lines.map(line=>({line_cents:line.lineTaxInclCents,tax_excl_cents:line.lineTaxExclCents,tax_cents:line.lineTaxInclCents-line.lineTaxExclCents})));
console.log('PASS ticket line amounts agree with the exact checkout allocation.');
