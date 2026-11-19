import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileNativeSubtotal} from '../src/totustpv/server/native-subtotal.js';
test('native subtotal retains exact total and micros with stable allocation across response ordering',()=>{
 const lines=[{key:'101:0',micros:1005000},{key:'102:7',micros:1005000}];
 const result=reconcileNativeSubtotal(lines,201,2);
 assert.deepEqual(result,[{key:'101:0',micros:1005000,cents:101,roundingAdjustmentCents:0},{key:'102:7',micros:1005000,cents:100,roundingAdjustmentCents:-1}]);
 assert.deepEqual(reconcileNativeSubtotal([...lines].reverse(),201,2),result);
 assert.deepEqual(lines,[{key:'101:0',micros:1005000},{key:'102:7',micros:1005000}]);
 assert.throws(()=>reconcileNativeSubtotal(lines,202,2),/MISMATCH/);
 assert.throws(()=>reconcileNativeSubtotal([lines[0],lines[0]],201,2),/LINES_INVALID/);
 assert.throws(()=>reconcileNativeSubtotal([{key:'1:0',micros:-1}],0,2),/LINES_INVALID/);
});
test('already rounded native unit and line amounts need no adjustment',()=>{
 for(const mode of [0,1,2,3,4,5]){
  const result=reconcileNativeSubtotal([{key:'101:0',micros:1010000},{key:'102:7',micros:1010000}],202,mode);
  assert.equal(result.reduce((total,line)=>total+line.cents,0),202);
  assert.ok(result.every(line=>line.roundingAdjustmentCents===0));
 }
});

test('joint net and gross reconciliation preserves exact totals without negative line tax',async()=>{
 const {reconcileNativeTaxedSubtotal}=await import('../src/totustpv/server/native-subtotal.js');
 const lines=[{key:'1:0',netMicros:6000,grossMicros:6000},{key:'2:0',netMicros:4000,grossMicros:8000}];
 const result=reconcileNativeTaxedSubtotal(lines,{netCents:1,grossCents:1,mode:2});
 assert.deepEqual(result.map(row=>[row.netCents,row.grossCents,row.taxCents]),[[1,1,0],[0,0,0]]);
 assert.deepEqual(reconcileNativeTaxedSubtotal([...lines].reverse(),{netCents:1,grossCents:1,mode:2}),result);
 assert.throws(()=>reconcileNativeTaxedSubtotal(lines,{netCents:2,grossCents:1,mode:2}),/TAX_INVALID/);
 assert.throws(()=>reconcileNativeTaxedSubtotal([{key:'1:0',netMicros:100,grossMicros:99}],{netCents:0,grossCents:0,mode:2}),/TAX_INVALID/);
});

test('joint allocation retains net, gross and nonnegative taxes across deterministic fractional baskets',async()=>{
 const {reconcileNativeTaxedSubtotal}=await import('../src/totustpv/server/native-subtotal.js');
 const {roundPriceMicros}=await import('../src/totustpv/offline-rounding.js');
 let seed=41;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let n=0;n<3000;n++){
  const lines=Array.from({length:1+next()%8},(_,i)=>{const netMicros=next()%100000;return {key:(i+1)+':0',netMicros,grossMicros:netMicros+next()%30000};});
  for(let mode=0;mode<6;mode++){
   const netCents=roundPriceMicros(lines.reduce((sum,line)=>sum+line.netMicros,0),mode),grossCents=roundPriceMicros(lines.reduce((sum,line)=>sum+line.grossMicros,0),mode);
   const rows=reconcileNativeTaxedSubtotal(lines,{netCents,grossCents,mode});
   assert.equal(rows.reduce((sum,line)=>sum+line.netCents,0),netCents);
   assert.equal(rows.reduce((sum,line)=>sum+line.grossCents,0),grossCents);
   assert.equal(rows.reduce((sum,line)=>sum+line.taxCents,0),grossCents-netCents);
   assert.ok(rows.every(line=>line.taxCents>=0));
  }
 }
});

test('tax-free lines never receive tax from another line rounding remainder',async()=>{
 const {reconcileNativeTaxedSubtotal}=await import('../src/totustpv/server/native-subtotal.js');
 const lines=[{key:'1:0',netMicros:3000,grossMicros:3000},{key:'2:0',netMicros:1000,grossMicros:3000}];
 const rows=reconcileNativeTaxedSubtotal(lines,{netCents:0,grossCents:1,mode:2});
 assert.deepEqual(rows.map(row=>row.taxCents),[0,1]);
 for(const reverse of [false,true]){
  const actual=[{key:reverse?'2:0':'1:0',netMicros:1005000,grossMicros:1005000},{key:reverse?'1:0':'2:0',netMicros:1005000,grossMicros:1216050}];
  const result=reconcileNativeTaxedSubtotal(actual,{netCents:201,grossCents:222,mode:2});
  assert.equal(result.find(row=>row.netMicros===row.grossMicros).taxCents,0);
  assert.equal(result.reduce((sum,row)=>sum+row.taxCents,0),21);
 }
});
