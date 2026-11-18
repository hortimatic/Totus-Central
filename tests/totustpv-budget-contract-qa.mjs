import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetDraft} from '../src/totustpv/budget-contract.js';
import {createCommercialBudgetService,budgetQuoteRefreshId} from '../src/totustpv/server/commercial-budget-service.js';
import {nativeQuoteFingerprint} from '../src/totustpv/server/quote-contract.js';
import {nativeStepId} from '../src/totustpv/server/native-request-service.js';
test('commercial command identities never reuse financial cart or quote identities',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 for(const step of ['cart','quote']){
  const financial=await nativeStepId(id,step),commercial=await nativeStepId(id,step,'budget');
  assert.equal(financial,await nativeStepId(id,step,'sale'));assert.notEqual(financial,commercial);
  assert.equal(commercial,await nativeStepId(id,step,'budget'));
 }
 await assert.rejects(nativeStepId(id,'cart','unknown'),/TPV_NATIVE_OPERATION_INVALID/);
});
test('commercial quote renewal IDs share a bounded retry window and stay outside financial identities',async()=>{
 const id='abcdefab-1111-4111-8111-111111111111',renewed=await budgetQuoteRefreshId(id,120001);
 assert.equal(renewed,await budgetQuoteRefreshId(id.toUpperCase(),239999));
 assert.notEqual(renewed,await budgetQuoteRefreshId(id,240000));
 assert.notEqual(renewed,await budgetQuoteRefreshId('11111111-1111-4111-8111-111111111111',120001));
 for(const purpose of ['sale','budget'])for(const step of ['cart','quote'])assert.notEqual(renewed,await nativeStepId(id,step,purpose));
 for(const now of [-1,NaN,1.5])await assert.rejects(budgetQuoteRefreshId(id,now),/TPV_BUDGET_REQUEST_INVALID/);
});
test('native fingerprint matches PHP for Unicode line separators',async()=>{
 assert.equal(await nativeQuoteFingerprint({text:'A\u2028B\u2029C'}),'d3e021c77b1614b2727a6e91755627a9d1502d4142f551e383f3d1aa62941ca0');
});
const lines=[{productId:101,attributeId:7,qty:2}];
test('budget intent supplies defaults and normalizes customer and public text',()=>{
 assert.deepEqual(budgetDraft({lines}),{lines,title:'Presupuesto',publicNote:'',validDays:30});
 const result=budgetDraft({lines,customerId:5,invoiceAddressId:6,publicNote:' A\r\nB ',title:' Oferta '});
 assert.equal(result.deliveryAddressId,6);assert.equal(result.publicNote,'A\nB');assert.equal(result.title,'Oferta');
});
test('browser cannot supply financial evidence or document identity',()=>{
 for(const extra of [{totalCents:1},{snapshot:{}},{id:'fake'},{validUntil:'2099-01-01'},{nativeCartId:1}])assert.throws(()=>budgetDraft({lines,...extra}),/TPV_BUDGET_INPUT_INVALID/);
 for(const extra of [{price:1},{label:'forged'},{unitTaxInclMicros:1}])assert.throws(()=>budgetDraft({lines:[{...lines[0],...extra}]}),/TPV_BUDGET_INPUT_INVALID/);
});
test('budget intent rejects duplicate variants, invalid quantities and incomplete customers',()=>{
 for(const value of [{lines:[]},{lines:[...lines,...lines]},{lines:[{...lines[0],qty:0}]},{lines:[{...lines[0],qty:10001}]},{lines,customerId:5},{lines,validDays:0},{lines,validDays:366},{lines,title:'\u0000'},{lines,title:'\ud800'}])assert.throws(()=>budgetDraft(value),/TPV_/);
});
test('saved budget recovery needs no native connection and retains its identity',async()=>{
 const calls=[],id='11111111-1111-4111-8111-111111111111',saved={id,reference:'P-000001',validUntil:'2026-12-01'};
 const service=createCommercialBudgetService({scope:{actorId:'actor'},rpc:async(name,args)=>{calls.push({name,args});return {data:saved};}});
 assert.deepEqual(await service.create(id,{lines}),saved);assert.equal(calls.length,1);assert.equal(calls[0].args.p_action,'recover');assert.equal(calls[0].args.p_scope.sessionId,id);assert.match(calls[0].args.p_data.intentHash,/^[a-f0-9]{64}$/);
 await assert.rejects(service.create(id,{lines,totalCents:1}),/TPV_BUDGET_INPUT_INVALID/);assert.equal(calls.length,1);
});
