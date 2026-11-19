import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeLineRoundingDifference} from '../src/totustpv/server/native-line-rounding.js';
const basket={mode:2,productsGrossCents:223,productsNetCents:202,initialGrossCents:222,initialNetCents:201,lines:[
 {productId:1,attributeId:0,qty:1,unitTaxInclMicros:1005000,unitTaxExclMicros:1005000,lineTaxInclCents:101,lineTaxExclCents:101},
 {productId:2,attributeId:0,qty:1,unitTaxInclMicros:1216050,unitTaxExclMicros:1005000,lineTaxInclCents:122,lineTaxExclCents:101}
]};
test('LINE discrepancy is proven from original prices, quantities and both native subtotals',()=>{
 assert.deepEqual(nativeLineRoundingDifference(basket),{grossCents:-1,netCents:-1});
 assert.deepEqual(nativeLineRoundingDifference({...basket,lines:[...basket.lines].reverse()}),{grossCents:-1,netCents:-1});
});
test('a one-cent discrepancy is not accepted merely because it is small',()=>{
 for(const key of ['productsGrossCents','productsNetCents','initialGrossCents','initialNetCents'])
  assert.throws(()=>nativeLineRoundingDifference({...basket,[key]:basket[key]+1}));
 for(const patch of [{qty:2},{lineTaxInclCents:100},{unitTaxInclMicros:990000},{unitTaxExclMicros:1100000}])
  assert.throws(()=>nativeLineRoundingDifference({...basket,lines:[{...basket.lines[0],...patch},basket.lines[1]]}));
 assert.throws(()=>nativeLineRoundingDifference({...basket,lines:[basket.lines[0],basket.lines[0]]}));
});
test('exact-cent native lines require no adjustment',()=>{
 assert.deepEqual(nativeLineRoundingDifference({mode:2,productsGrossCents:242,productsNetCents:200,initialGrossCents:242,initialNetCents:200,lines:[{productId:1,attributeId:4,qty:2,unitTaxInclMicros:1210000,unitTaxExclMicros:1000000,lineTaxInclCents:242,lineTaxExclCents:200}]}),{grossCents:0,netCents:0});
});
