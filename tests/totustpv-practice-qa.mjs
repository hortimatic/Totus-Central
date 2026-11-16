import test from 'node:test';
import assert from 'node:assert/strict';
import {createTpvPracticeAdapter} from '../src/totustpv/practice-adapter.js';
import {inputCents} from '../src/totustpv/workspace.js';
function fixture(){
 const data=new Map();let time=100000,sequence=0;
 const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 const make=actorId=>createTpvPracticeAdapter({actorId,storage,now:()=>time,uuid:()=>`fixture-${++sequence}`,locks:null});
 const api=make('actor-a');
 return {api,make,data,advance:()=>{time+=120001;},async open(){return api.openSession({storeId:'demo-store-a',drawerId:'demo-drawer-a',openingCents:10000});}};
}
const lines=[{productId:'demo-1',qty:1}];
const cash=[{method:'cash',amountCents:801,receivedCents:1000}];
test('practice has no real/native adapter, and keeps each user in a separate namespace',async()=>{
 const f=fixture();await f.open();assert.equal((await f.api.context()).sessions.length,1);
 assert.equal((await f.make('actor-b').context()).sessions.length,0);
 assert.ok([...f.data.keys()].every(key=>key.startsWith('totus:tpv:practice:')));
});
test('cash, change and repeated submit persist a single fictitious ticket',async()=>{
 const f=fixture(),session=await f.open(),quote=await f.api.quote({sessionId:session.id,lines});
 const results=await Promise.all([f.api.submit({operationId:quote.id,payments:cash}),f.api.submit({operationId:quote.id,payments:cash})]);
 assert.equal(results[0].id,results[1].id);assert.equal(results[0].changeCents,199);
 assert.equal((await f.api.history({sessionId:session.id})).length,1);
 assert.equal((await f.api.sessionSummary({sessionId:session.id})).expectedCashCents,10801);
});
test('mixed and card payments do not turn non-cash amounts into physical cash',async()=>{
 const f=fixture(),session=await f.open(),quote=await f.api.quote({sessionId:session.id,lines});
 const payments=[{method:'cash',amountCents:300,receivedCents:500},
  {method:'card',amountCents:501,simulatedAccepted:true}];
 const sale=await f.api.submit({operationId:quote.id,payments});assert.equal(sale.changeCents,200);
 assert.equal((await f.api.sessionSummary({sessionId:session.id})).expectedCashCents,10300);
 const q=await f.api.quote({sessionId:session.id,lines});
 await assert.rejects(f.api.submit({operationId:q.id,payments:[{method:'card',amountCents:801}]}),/expresamente/);
});
test('lost response survives a new adapter and recovery does not create another ticket',async()=>{
 const f=fixture(),session=await f.open(),quote=await f.api.quote({sessionId:session.id,lines});
 await f.api.submit({operationId:quote.id,payments:cash,scenario:'lost-response'});
 assert.equal((await f.api.searchProducts({sessionId:session.id})).find(p=>p.id==='demo-1').stock,19);
 await assert.rejects(f.api.closeSession({sessionId:session.id,countedCents:10801}),/pendientes/);
 const restored=f.make('actor-a');assert.equal((await restored.recover({operationId:quote.id})).status,'confirmed');
 await restored.recover({operationId:quote.id});
 assert.equal((await restored.history({sessionId:session.id})).length,1);
 assert.equal((await restored.sessionSummary({sessionId:session.id})).cashCents,801);
});
test('rejected payments, expired quotes, foreign drawers and invalid allocations cannot create practice sales',async()=>{
 const f=fixture(),session=await f.open(),q=await f.api.quote({sessionId:session.id,lines});
 await assert.rejects(f.api.submit({operationId:q.id,payments:cash,scenario:'rejected'}),/Rechazo/);
 assert.equal((await f.api.history({sessionId:session.id})).length,0);
 await assert.rejects(f.api.submit({operationId:q.id,payments:[{method:'cash',amountCents:800,receivedCents:1000}]}),/exactamente/);
 f.advance();await assert.rejects(f.api.submit({operationId:q.id,payments:cash}),/caducado/);
 await assert.rejects(f.api.openSession({storeId:'demo-store-a',drawerId:'demo-drawer-b',openingCents:0}),/pertenece/);
});
test('close records a difference and refuses further quotes on the closed session',async()=>{
 const f=fixture(),session=await f.open();const closed=await f.api.closeSession({sessionId:session.id,countedCents:9990});
 assert.equal(closed.differenceCents,-10);await assert.rejects(f.api.quote({sessionId:session.id,lines}),/Abre una caja/);
});
test('money input preserves cents and rejects scientific notation, mixed separators and excess precision',()=>{
 assert.equal(inputCents('8,01'),801);assert.equal(inputCents('8.1'),810);assert.equal(inputCents('0'),0);
 for(const value of ['-1','8,001','1,000.00','1e3','NaN','Infinity',''])assert.throws(()=>inputCents(value));
});
test('partial practice refunds preserve discounted pennies, caps, original payments and defective stock',async()=>{
 const f=fixture(),session=await f.open(),quote=await f.api.quote({sessionId:session.id,lines:[{productId:'demo-1',qty:3}],discountPercent:50});
 // Practice rounds the discount (12.015 -> 12.02), then subtracts it.
 // This is deliberately not evidence of PrestaShop's cart rounding policy.
 assert.equal(quote.totalCents,1201);
 await f.api.submit({operationId:quote.id,payments:[{method:'cash',amountCents:1201,receivedCents:1201}]});
 const returned=[];
 for(let n=0;n<3;n++){
  const command={operationId:`return-${n}`,sessionId:session.id,saleId:quote.id,
   items:[{productId:'demo-1',qty:1,restock:n!==1}],refundConfirmed:true};
  const result=await f.api.refund(command);returned.push(result.totalCents);
  assert.equal((await f.api.refund(command)).id,result.id);
 }
 assert.deepEqual(returned,[400,401,400]);
 assert.equal((await f.api.returnable({sessionId:session.id,saleId:quote.id})).lines[0].remainingQty,0);
 await assert.rejects(f.api.refund({operationId:'return-extra',sessionId:session.id,saleId:quote.id,
  items:[{productId:'demo-1',qty:1,restock:true}],refundConfirmed:true}),/supera/);
 assert.equal((await f.api.searchProducts({sessionId:session.id})).find(p=>p.id==='demo-1').stock,19);
 assert.equal((await f.api.sessionSummary({sessionId:session.id})).expectedCashCents,10000);
});
test('practice card refunds never reduce physical cash; foreign shops and reused IDs are rejected',async()=>{
 const f=fixture(),session=await f.open(),quote=await f.api.quote({sessionId:session.id,lines});
 await f.api.submit({operationId:quote.id,payments:[{method:'card',amountCents:801,simulatedAccepted:true}]});
 const command={operationId:'card-refund',sessionId:session.id,saleId:quote.id,
  items:[{productId:'demo-1',qty:1,restock:false}],refundConfirmed:true};
 const result=await f.api.refund(command);assert.equal(result.payments[0].method,'card');
 assert.equal((await f.api.sessionSummary({sessionId:session.id})).expectedCashCents,10000);
 await assert.rejects(f.api.refund({...command,items:[{productId:'demo-1',qty:1,restock:true}]}),/identificador/);
 const other=await f.api.openSession({storeId:'demo-store-b',drawerId:'demo-drawer-b',openingCents:0});
 await assert.rejects(f.api.returnable({sessionId:other.id,saleId:quote.id}),/esta tienda/);
});
