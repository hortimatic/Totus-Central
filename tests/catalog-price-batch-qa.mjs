import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogPriceBatchPlan} from '../src/catalog-price-batch.js';
const row=(id='1',price='10',shop='hortimatic')=>({id,price,__store:shop,name:'Producto QA'});
test('price plans retain shop identity and exact six-decimal base arithmetic',()=>{
 const plan=catalogPriceBatchPlan([row(),row('1','0.333333','newoldsmok')],{mode:'percent',value:'12,5'});
 assert.equal(plan[0].after,'11.250000');assert.equal(plan[1].after,'0.375000');assert.notEqual(plan[0].key,plan[1].key);
 assert.equal(catalogPriceBatchPlan([row()],{mode:'percent',value:'-100'})[0].after,'0.000000');
 assert.equal(catalogPriceBatchPlan([row()],{mode:'fixed',value:'3,500001'})[0].after,'3.500001');
});
test('invalid, duplicate, excessive and imprecise selections fail before a write exists',()=>{
 for(const [rows,options] of [[[],{mode:'fixed',value:'1'}],[[row(),row()],{mode:'fixed',value:'1'}],[[row('1','')],{mode:'fixed',value:'1'}],[[row('1','1','unknown')],{mode:'fixed',value:'1'}],[[row()],{mode:'percent',value:'-100.1'}],[[row()],{mode:'fixed',value:'1.0000001'}],[[row()],{mode:'fixed',value:'1e3'}],[Array.from({length:201},(_,i)=>row(String(i+1))),{mode:'fixed',value:'1'}]])assert.throws(()=>catalogPriceBatchPlan(rows,options));
});
