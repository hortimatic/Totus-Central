import test from 'node:test';import assert from 'node:assert/strict';import {groupPercentMicros,withHistoricalGroupRates,readHistoricalGroupRates} from '../src/totustpv/server/receipt-group-rates.js';
const document={kind:'receipt',order_id:42,lines:[{name:'Producto',reference:'REF',quantity:2,line_cents:1450}],total_cents:1450},row={id:'1',id_order:'42',product_name:'Producto',product_reference:'REF',product_quantity:'2',group_reduction:'7.500000'};
test('native percentage parser preserves six decimal places and refuses untyped or malformed rates',()=>{
 for(const [value,expected] of [['0',0],['7.5',7500000],['100.000000',100000000],['0.000001',1],['12.345678',12345678],[0.000001,1]])assert.equal(groupPercentMicros(value),expected);
 for(const value of [undefined,null,true,-1,101,'1e2','NaN','1.1234567',[],Infinity,NaN])assert.equal(groupPercentMicros(value),null);
});
test('historical rates bind to the existing order and an exact multiset of native line identities',()=>{
 const result=withHistoricalGroupRates(document,[row],42);assert.equal(result.lines[0].group_reduction_percent_micros,7500000);assert.equal(result.total_cents,1450);assert.equal(Object.hasOwn(document.lines[0],'group_reduction_percent_micros'),false);
 for(const patch of [{id_order:'43'},{product_name:'Other'},{product_reference:'Other'},{product_quantity:'1'},{group_reduction:'bad'}])assert.equal(Object.hasOwn(withHistoricalGroupRates(document,[{...row,...patch}],42).lines[0],'group_reduction_percent_micros'),false);
 const duplicate={...document,lines:[...document.lines,...document.lines]};assert.equal(withHistoricalGroupRates(duplicate,[row,{...row,id:'2',group_reduction:'8'}],42).lines.some(line=>Object.hasOwn(line,'group_reduction_percent_micros')),false,'Ambiguous identical lines cannot receive invented rate allocations');
 assert.equal(withHistoricalGroupRates(duplicate,[row,{...row,id:'2'}],42).lines.every(line=>line.group_reduction_percent_micros===7500000),true);
});
test('reader uses the minimal official API once, does not fetch gifts or current groups and preserves old documents on failure',async()=>{
 const calls=[],read=async(resource,query)=>{calls.push({resource,query});return {order_details:[row]};};assert.equal((await readHistoricalGroupRates({document,orderId:42,read})).lines[0].group_reduction_percent_micros,7500000);assert.equal(calls.length,1);assert.equal(calls[0].resource,'order_details');assert.equal(calls[0].query['filter[id_order]'],'[42]');assert.equal(calls[0].query.limit,'0,201');assert.doesNotMatch(calls[0].query.display,/customer|passwd|cost/);
 const gift=await readHistoricalGroupRates({document:{...document,kind:'gift',lines:[{...document.lines[0],group_reduction_percent_micros:7}]},orderId:42,read});assert.equal(calls.length,1);assert.equal(Object.hasOwn(gift.lines[0],'group_reduction_percent_micros'),false);
 assert.deepEqual(await readHistoricalGroupRates({document,orderId:42,read:async()=>{throw Error('Forbidden');}}),document);
});
