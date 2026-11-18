import {offlineCommercial,commercialFromExpected} from '../src/totustpv/offline-commercial.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {compareOfflinePrices} from '../src/totustpv/server/offline-price-comparison.js';
const snapshot=()=>({currency:'EUR',customerId:1,invoiceAddressId:2,deliveryAddressId:2,totalCents:801,totalTaxExclCents:662,discountCents:0,shippingCents:0,nativeRoundMode:2,nativeRoundType:1,lines:[{productId:10,attributeId:0,qty:1,unitTaxInclMicros:8012100,unitTaxExclMicros:6621570,lineTaxInclCents:801,lineTaxExclCents:662}]});
test('offline reconciliation compares exact historical commercial amounts without rounding away precision',()=>{
 const original=snapshot();assert.deepEqual(compareOfflinePrices(original,structuredClone(original)),{matches:true,conflicts:[]});
 const changed=snapshot();changed.lines[0].unitTaxInclMicros++;assert.equal(compareOfflinePrices(original,changed).matches,false);assert.equal(original.lines[0].unitTaxInclMicros,8012100);
 for(const key of ['totalCents','totalTaxExclCents','discountCents','shippingCents','nativeRoundMode','nativeRoundType','customerId','invoiceAddressId','deliveryAddressId']){const next=snapshot();next[key]++;assert.equal(compareOfflinePrices(original,next).matches,false,key);}
});
test('missing or ambiguous product snapshots cannot approve an offline reconciliation',()=>{
 const original=snapshot();for(const current of [null,{}, {...snapshot(),lines:[]},{...snapshot(),currency:'USD'},{...snapshot(),lines:[{...original.lines[0],qty:2}]}])assert.equal(compareOfflinePrices(original,current).matches,false);
 const duplicate=snapshot();duplicate.lines.push({...duplicate.lines[0]});assert.equal(compareOfflinePrices(duplicate,duplicate).matches,false);
});

test('portable commercial snapshot preserves native precision and excludes internal data',()=>{const original=snapshot();const source={...original,serverSecret:'must-not-travel'};assert.deepEqual(commercialFromExpected(source),original);assert.throws(()=>offlineCommercial(source));for(const value of [{...original,totalCents:802},{...original,lines:[{...original.lines[0],serverSecret:'hidden'}]},{...original,totalTaxExclCents:802}])assert.throws(()=>offlineCommercial(value));assert.equal(commercialFromExpected(source).lines[0].unitTaxInclMicros,8012100);});

test('offline total rounding retains line micros and rejects changes hidden by cents',()=>{
 const total={...snapshot(),nativeRoundType:3};Object.assign(total.lines[0],{lineTaxInclMicros:8012100,lineTaxExclMicros:6621570});
 assert.deepEqual(commercialFromExpected(total),total);
 assert.equal(compareOfflinePrices(total,structuredClone(total)).matches,true);
 const changed=structuredClone(total);changed.lines[0].lineTaxInclMicros++;
 assert.equal(compareOfflinePrices(total,changed).matches,false);
 const missing=structuredClone(total);delete missing.lines[0].lineTaxInclMicros;
 assert.throws(()=>offlineCommercial(missing));assert.equal(compareOfflinePrices(total,missing).matches,false);
 const invalid=structuredClone(total);invalid.lines[0].lineTaxExclMicros=invalid.lines[0].lineTaxInclMicros+1;
 assert.throws(()=>offlineCommercial(invalid));
});
