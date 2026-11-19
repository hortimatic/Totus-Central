import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {commercialFromExpected} from '../../src/totustpv/offline-commercial.js';
export async function exerciseNativeOperatorCheckout({call,handle,selection,fixture,db,paths,actor,configure,loseSaleReply,saleReplyWasLost}){
 const sql=async(query,args)=>{await db.exec('reset role');return db.query(query,args);};
 const sales=()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length;
 const raw=async body=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const prepare=async()=>{const operationId=randomUUID();await call({action:'prepare',selection,operationId,lines:[{productId:fixture.productId,attributeId:0,qty:1}]});const record=(await sql('select expected from private.totus_tpv_operations where id=$1',[operationId])).rows[0];return {operationId,expected:record.expected};};
 const request=(sale,ack)=>({action:'submit',selection,operationId:sale.operationId,payments:{allocations:[{id:'cash',method:'cash',amountCents:sale.expected.totalCents,receivedCents:1000}],confirmation:{accepted:true,operationId:sale.operationId,totalCents:sale.expected.totalCents,currency:'EUR',...(ack?{operatorAcknowledgement:ack}:{})}}});
 const before=sales(),sale=await prepare();await configure({switchEnabled:true,requireAtCheckout:true,expectedRevision:0});
 for(const ack of [undefined,{actorId:randomUUID(),accepted:true}]){const rejected=await raw(request(sale,ack));assert.equal(rejected.status,400);assert.match(rejected.body.error,/TPV_CHECKOUT_OPERATOR_(REQUIRED|INVALID)/);assert.equal(sales(),before);}
 assert.equal((await sql('select status from private.totus_tpv_operations where id=$1',[sale.operationId])).rows[0].status,'ready');
 const ack={actorId:actor,accepted:true};loseSaleReply();const sent=await call(request(sale,ack));assert.equal(sent.status,'confirmed','The native adapter immediately reconciles the lost POST response');assert.equal(saleReplyWasLost(),true);assert.equal(sales(),before+1);
 const recovered=await call({action:'recover',selection,operationId:sale.operationId});assert.equal(recovered.status,'confirmed');assert.equal(sales(),before+1);
 const stored=(await sql('select actor_id,total_cents from private.totus_tpv_operator_acknowledgements where operation_id=$1',[sale.operationId])).rows[0];assert.equal(stored.actor_id,actor);assert.equal(Number(stored.total_cents),sale.expected.totalCents);
 for(const captured of [false,true]){
  const offline=await prepare(),ticket={cashSessionId:selection.sessionId,commercial:commercialFromExpected(offline.expected),currency:'EUR',totalCents:offline.expected.totalCents,lines:[{productId:fixture.productId,attributeId:0,qty:1}],payments:[{method:'cash',amountCents:offline.expected.totalCents,receivedCents:1000}],...(captured?{operatorAcknowledgement:ack}:{})},deviceId=randomUUID();
  const received=await call({action:'offline-receive',selection,operationId:offline.operationId,deviceId,ticket});assert.deepEqual(received.ticket,ticket);
  const baseline=sales();if(!captured){const rejected=await raw({action:'offline-sync',selection,operationId:offline.operationId});assert.equal(rejected.status,400);assert.equal(rejected.body.error,'TPV_CHECKOUT_OPERATOR_REQUIRED');assert.equal(sales(),baseline);}
  const command={action:'offline-sync',selection,operationId:offline.operationId,...(!captured?{operatorAcknowledgement:ack}:{})};const synced=await call(command);assert.equal(synced.status,'confirmed');assert.equal(synced.verified,true);assert.equal(sales(),baseline+1);
  const readback=await call({action:'offline-get',selection,operationId:offline.operationId});assert.deepEqual(readback.ticket,ticket,'Acknowledging a legacy ticket never rewrites its sealed data');
  await call({action:'offline-recover',selection,operationId:offline.operationId});assert.equal(sales(),baseline+1);
 }
 assert.equal(sales(),before+3);console.log('PASS native operator checkout: setting enabled after preparation, omitted/foreign actor refused without sale, lost native reply recovered once, actor/amount audit, new sealed offline acknowledgement and manual legacy synchronization without rewriting tickets. Loopback native shop only.');
 return {focus:'operator-checkout',sales:3,remoteShopTouched:false};
}
