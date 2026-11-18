import test from 'node:test';
import assert from 'node:assert/strict';
import {roundPriceMicros,roundPriceLine,roundPriceSubtotal} from '../src/totustpv/offline-rounding.js';
test('six rounding modes distinguish ties and preserve quantity precision',()=>{
 assert.deepEqual([0,1,2,3,4,5].map(mode=>roundPriceMicros(1005000,mode)),[101,100,101,100,100,101]);
 assert.deepEqual([0,1,2,3,4,5].map(mode=>roundPriceMicros(1015000,mode)),[102,101,102,101,102,101]);
 assert.equal(roundPriceMicros(1000001,0),101);assert.equal(roundPriceMicros(1009999,1),100);
 assert.equal(roundPriceLine(1005000,3,{mode:2,type:1,computingPrecision:2}),303);
 assert.equal(roundPriceLine(1005000,3,{mode:2,type:2,computingPrecision:2}),302);
 assert.equal(roundPriceLine(1005000,3,{mode:2,type:1,computingPrecision:6}),302);
 assert.throws(()=>roundPriceLine(1005000,3,{mode:2,type:1}));
 for(const mode of [0,1,2,3,4,5])assert.equal(roundPriceMicros(0,mode),0);
 for(const value of [-1,NaN,Infinity,1.2,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>roundPriceMicros(value,2));
 assert.throws(()=>roundPriceLine(100,2,{mode:2,type:3}));
 assert.throws(()=>roundPriceLine(Number.MAX_SAFE_INTEGER,2,{mode:2,type:2,computingPrecision:2}));
});

test('subtotal preserves internal precision instead of summing rounded display cents',()=>{
 const lines=[{unitMicros:1005000,quantity:1},{unitMicros:1005000,quantity:1}];
 const precise=roundPriceSubtotal(lines,{mode:2,type:2,computingPrecision:6});
 assert.deepEqual(precise,{totalCents:201,lineMicros:[1005000,1005000],lineCents:[101,101],balancedLineCents:[101,100],lineRoundingAdjustmentsCents:[0,-1],roundingDifferenceCents:-1});
 assert.equal(roundPriceSubtotal(lines,{mode:2,type:1,computingPrecision:2}).totalCents,202);
 assert.equal(roundPriceSubtotal(lines,{mode:2,type:3,computingPrecision:2}).totalCents,201);
 assert.throws(()=>roundPriceSubtotal([],{mode:2,type:1,computingPrecision:6}));
 assert.throws(()=>roundPriceSubtotal(Array(201).fill(lines[0]),{mode:2,type:1,computingPrecision:6}));
 assert.throws(()=>roundPriceSubtotal([{unitMicros:Number.MAX_SAFE_INTEGER,quantity:1},{unitMicros:1,quantity:1}],{mode:2,type:3,computingPrecision:6}));
});

test('balanced line amounts always add to the unchanged native-rounded subtotal',()=>{
 for(const mode of [0,1,2,3,4,5])for(const type of [1,2,3])for(const computingPrecision of [2,6]){
  for(const amounts of [[1005000,1005000],[1001000,1009000,1003000],[1,2,3],[0,0,0]]){
   const result=roundPriceSubtotal(amounts.map(unitMicros=>({unitMicros,quantity:1})),{mode,type,computingPrecision});
   assert.equal(result.balancedLineCents.reduce((a,b)=>a+b,0),result.totalCents);
   assert.equal(result.lineRoundingAdjustmentsCents.reduce((a,b)=>a+b,0),result.roundingDifferenceCents);
   result.balancedLineCents.forEach((value,index)=>{assert.ok(Number.isSafeInteger(value)&&value>=0);assert.ok(Math.abs(value-result.lineMicros[index]/10000)<1.000001);});
  }
 }
 const result=roundPriceSubtotal([{unitMicros:1001000,quantity:1},{unitMicros:1009000,quantity:1}],{mode:2,type:3,computingPrecision:6});
 assert.deepEqual(result.balancedLineCents,[100,101]);
});
