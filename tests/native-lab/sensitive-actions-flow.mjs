import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {commercialFromExpected} from '../../src/totustpv/offline-commercial.js';
/** Real isolated SQL and native HTTP. Auth is a synthetic fixture, never a real user's password. */
export async function exerciseSensitiveActions({call,handle,selection,fixture,db,paths,actor}){
 const sql=async(query,args=[])=>{await db.exec('reset role');return db.query(query,args);};
 const count=path=>paths.filter(p=>p.method==='POST'&&p.path==='/api/'+path).length;
 const raw=async(body,bearer='synthetic-auth-fixture')=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const prepare=async price=>{const operationId=randomUUID(),line={productId:fixture.productId,attributeId:0,qty:1,...(price?{discount:{kind:'price',value:901}}:{})};await call({action:'prepare',selection,operationId,lines:[line]});return {operationId,line,expected:(await sql('select expected from private.totus_tpv_operations where id=$1',[operationId])).rows[0].expected};};
 const submit=(sale,approvalId)=>({action:'submit',selection,operationId:sale.operationId,payments:{allocations:[{id:'cash',method:'cash',amountCents:sale.expected.totalCents,receivedCents:2000}],confirmation:{operationId:sale.operationId,totalCents:sale.expected.totalCents,currency:'EUR',accepted:true,...(approvalId?{approvalId}:{})}}});
 const approve=async(kind,targetId)=>{
  const now=Math.floor(Date.now()/1000),sessionId=randomUUID(),base={sub:actor,iss:'https://local-edge.invalid/auth/v1',aud:'authenticated',role:'authenticated',iat:now,exp:now+3600};
  // Match the fixture's SUPABASE_URL exactly; tokens are accepted only by this local Auth stub.
  const encode=value=>'eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify(value)).toString('base64url')+'.c2lnbmVk';
  await sql('insert into auth.sessions(id,user_id) values($1,$2)',[sessionId,actor]);
  const proofJwt=encode({...base,session_id:sessionId,amr:[{method:'password',timestamp:now}]}),primary=encode({...base,session_id:randomUUID()});
  const result=await raw({action:'action-approval',selection,operationId:randomUUID(),kind,targetId,proofJwt},primary);
  assert.equal(result.status,200,JSON.stringify(result.body));await sql('delete from auth.sessions where id=$1',[sessionId]);return result.body.approvalId;
 };
 await call({action:'action-policy',selection,operationId:randomUUID(),settings:{requirePrice:true,requireRefund:true,expectedRevision:0}});
 await db.exec('reset role;set role authenticated');await db.query('select public.totus_tpv_workspace_preferences($1,$2,$3,$4::jsonb)',[selection.connectionId,selection.shopId,selection.drawerId,JSON.stringify({lineOptions:{allowPriceChanges:true}})]);
 const sales=count('totus_tpv_sales'),sale=await prepare(true);assert.equal(sale.expected.totalCents,901);
 const denied=await raw(submit(sale));assert.equal(denied.body.error,'TPV_ACTION_APPROVAL_REQUIRED');assert.equal(count('totus_tpv_sales'),sales);
 const approval=await approve('price',sale.operationId);assert.equal((await call(submit(sale,approval))).status,'confirmed');assert.equal(count('totus_tpv_sales'),sales+1);
 await call(submit(sale,approval));assert.equal(count('totus_tpv_sales'),sales+1,'Approval/submit replay never creates a second order');
 const available=await call({action:'returnable',selection,operationId:randomUUID(),saleId:sale.operationId}),refundId=randomUUID();
 const detail=available.items.find(i=>i.remaining_quantity>0);assert.ok(detail);
 const prepared=await call({action:'prepare-refund',selection,operationId:refundId,saleId:sale.operationId,items:[{detailId:detail.detail_id,qty:1,restock:true}],payments:[{method:'cash',amountCents:901}],reason:'Prueba aislada de autorización'});
 const returns=count('totus_tpv_returns'),refund=approvalId=>({action:'submit-refund',selection,operationId:refundId,confirmation:{operationId:refundId,totalCents:prepared.totalCents,currency:'EUR',accepted:true,...(approvalId?{approvalId}:{})}});
 assert.equal((await raw(refund())).body.error,'TPV_ACTION_APPROVAL_REQUIRED');assert.equal(count('totus_tpv_returns'),returns);
 assert.equal((await raw(refund(approval))).body.error,'TPV_ACTION_APPROVAL_REQUIRED');
 const refundApproval=await approve('refund',refundId);assert.equal((await call(refund(refundApproval))).status,'confirmed');await call(refund(refundApproval));assert.equal(count('totus_tpv_returns'),returns+1);
 const offline=await prepare(true),ticket={cashSessionId:selection.sessionId,commercial:commercialFromExpected(offline.expected),currency:'EUR',totalCents:901,lines:[offline.line],payments:[{method:'cash',amountCents:901,receivedCents:2000}]};
 await call({action:'offline-receive',selection,operationId:offline.operationId,deviceId:randomUUID(),ticket});
 const beforeSync=count('totus_tpv_sales');assert.equal((await raw({action:'offline-sync',selection,operationId:offline.operationId})).body.error,'TPV_ACTION_APPROVAL_REQUIRED');assert.equal(count('totus_tpv_sales'),beforeSync);
 const syncApproval=await approve('price',offline.operationId);assert.equal((await call({action:'offline-sync',selection,operationId:offline.operationId,approvalId:syncApproval})).verified,true);
 await call({action:'offline-recover',selection,operationId:offline.operationId});assert.equal(count('totus_tpv_sales'),beforeSync+1);
 assert.deepEqual((await call({action:'offline-get',selection,operationId:offline.operationId})).ticket,ticket,'Approval metadata never changes the sealed offline ticket');
 const consumed=(await sql('select kind,consumed_at from private.totus_tpv_action_approvals order by issued_at')).rows;assert.equal(consumed.length,3);assert.ok(consumed.every(r=>r.consumed_at));
 console.log('PASS sensitive actions native: missing/wrong approval makes no sale/refund, verified isolated price sale and credit exactly once, scoped single-use SQL approvals, closed proof sessions, replay recovery, offline sync with separate approval and unchanged sealed ticket. Loopback native shop and synthetic Auth only.');
}
