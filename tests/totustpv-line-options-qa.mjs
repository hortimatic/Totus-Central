import test from 'node:test';
import assert from 'node:assert/strict';
import {lineOptions,lineOptionsFromForm,lineOptionsHtml,lineAdjustment} from '../src/totustpv/line-options.js';
test('price changes default off and cannot be enabled through truthy or unknown fields',()=>{
 assert.deepEqual(lineOptions(),{allowPriceChanges:false});assert.deepEqual(lineOptions({allowPriceChanges:true}),{allowPriceChanges:true});
 for(const value of [null,[],true,{allowPriceChanges:'true'},{allowPriceChanges:1},{allowPriceChanges:null},{allowPriceChanges:true,actorId:'other'}])assert.throws(()=>lineOptions(value));
 assert.deepEqual(lineOptionsFromForm(new Map([['allowPriceChanges','on']])),{allowPriceChanges:true});
 assert.match(lineOptionsHtml({allowPriceChanges:true},false),/name="allowPriceChanges" checked disabled/);
});
test('unit price overrides are positive integer cents, with existing reduction contracts preserved',()=>{
 for(const value of [1,725,999999999])assert.deepEqual(lineAdjustment({kind:'price',value}),{kind:'price',value});
 assert.deepEqual(lineAdjustment({kind:'percent',value:9999}),{kind:'percent',value:9999});assert.deepEqual(lineAdjustment({kind:'amount',value:100000000000}),{kind:'amount',value:100000000000});
 assert.equal(lineAdjustment(undefined),undefined);
 for(const value of [null,{},[],{kind:'price',value:0},{kind:'price',value:-1},{kind:'price',value:7.25},{kind:'price',value:'725'},{kind:'price',value:1000000000},{kind:'price',value:725,actorId:'other'},{kind:'percent',value:10000},{kind:'amount',value:100000000001},{kind:'cost',value:725}])assert.throws(()=>lineAdjustment(value),/TPV_LINE_ADJUSTMENT_INVALID/);
});
