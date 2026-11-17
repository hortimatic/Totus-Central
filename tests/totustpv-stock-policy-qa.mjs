import test from 'node:test';
import assert from 'node:assert/strict';
import {stockPolicy,stockPolicyHtml,stockPolicyFromForm,canExceedStock} from '../src/totustpv/stock-policy.js';
import {createCatalogueTable} from '../src/totustpv/catalogue-table.js';
test('stock policy defaults to refusal and accepts only the explicit boolean preference',()=>{
 assert.deepEqual(stockPolicy(),{allowOutOfStock:false});assert.deepEqual(stockPolicy({}),{allowOutOfStock:false});assert.deepEqual(stockPolicy({allowOutOfStock:true}),{allowOutOfStock:true});
 for(const value of [null,true,[],{allowOutOfStock:1},{allowOutOfStock:'true'},{allowOutOfStock:null},{shopId:1},{allowOutOfStock:true,force:true}])assert.throws(()=>stockPolicy(value),/política/);
 assert.deepEqual(stockPolicyFromForm(new Map([['allowOutOfStock','on']])),{allowOutOfStock:true});assert.deepEqual(stockPolicyFromForm(new Map()),{allowOutOfStock:false});
});
test('both sealed native counter permission and workstation opt-in are required, without truthy coercion',()=>{
 assert.equal(canExceedStock({allowOutOfStock:true},{allowOutOfStock:true}),true);
 for(const value of [undefined,false,null,1,'true']){assert.equal(canExceedStock({allowOutOfStock:value},{allowOutOfStock:true}),false);assert.equal(canExceedStock({allowOutOfStock:true},{allowOutOfStock:value}),false);}
});
test('table selection intersects rights, native counter capability, explicit policy and stock instead of fabricating availability',()=>{
 const table=createCatalogueTable(),rows=[{id:'1:0',name:'Permitido',stock:0,allowOutOfStock:true},{id:'2:0',name:'No permitido',stock:0,allowOutOfStock:false}];
 const state=html=>[...html.matchAll(/data-tpv-add="([^"]+)" ([^>]*)>/g)].map(match=>[match[1],match[2].includes('disabled')]);
 assert.deepEqual(state(table.html(rows)),[['1:0',true],['2:0',true]]);
 assert.deepEqual(state(table.html(rows,{stockPolicy:{allowOutOfStock:true}})),[['1:0',false],['2:0',true]]);
 assert.deepEqual(state(table.html(rows,{stockPolicy:{allowOutOfStock:true},canSelect:false})),[['1:0',true],['2:0',true]]);
 assert.match(stockPolicyHtml({allowOutOfStock:true},false),/checked disabled/);
});
