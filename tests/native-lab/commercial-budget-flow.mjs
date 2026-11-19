import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {exerciseNativeBudgetBrowser} from './commercial-budget-browser.mjs';
/** Real Central handler, migrated SQL and native commercial cart/quote HTTP.
 * First saves without cash; then explicitly converts, sells and refunds one
 * separate ordinary checkout. Everything stays in the local laboratory. */
export async function exerciseCommercialBudget({handle,call,selection,fixture,db,paths,inspectCommercialCart,actor,preferences,budgetSettings,simulateBudgetConfirmLoss,simulateBudgetCreateFailure,simulateBudgetCreateRace}){
 const {sessionId,...closedSelection}=selection,id=randomUUID(),payload={lines:[{productId:fixture.productId,attributeId:0,qty:10000}],title:'Oferta de mostrador',publicNote:'Válido durante 30 días',validDays:30};
 const raw=async body=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,result:await response.json()};};
 const inspect=async(sql,args=[])=>{await db.exec('reset role');return db.query(sql,args);};
 const sessions=()=>inspect('select count(*)::int n from private.totus_tpv_sessions');
 assert.equal((await sessions()).rows[0].n,0);const before=inspectCommercialCart(fixture.productId,0);
 const settingsDrawer={id:closedSelection.drawerId,connectionId:closedSelection.connectionId,shopId:closedSelection.shopId};if(budgetSettings){const rules=await budgetSettings(settingsDrawer);assert.equal(rules.revision,0);await budgetSettings(settingsDrawer,{enabled:true,prefix:'P-',lastNumber:37,hidePrices:true,expectedRevision:0});}
 const saved=await call({action:'budget-create',selection:closedSelection,operationId:id,payload});
 assert.equal(saved.id,id);assert.match(saved.reference,/^P-[0-9]{6,}$/);if(budgetSettings){assert.equal(saved.reference,'P-000038');assert.deepEqual(saved.presentation,{hidePrices:true});}assert.equal(saved.status,'saved');assert.equal(saved.snapshot.lines[0].qty,10000);assert.ok(saved.totalCents>0);
 assert.equal(saved.snapshot.nativeCartId,undefined);assert.equal(saved.snapshot.nativeQuoteFingerprint,undefined);
 assert.equal(saved.draftId,null);assert.equal(saved.orderId,null);assert.equal(saved.expired,false);
 assert.ok(saved.snapshot.merchant.name.length>0);assert.equal(saved.snapshot.customer,null);assert.equal(saved.snapshot.delivery,null);
 const posts=paths.filter(row=>row.method==='POST').length;assert.equal(posts,2);
 // Simulates a caller that lost the successful reply and repeats the same ID.
 assert.deepEqual(await call({action:'budget-create',selection:closedSelection,operationId:id,payload}),saved);
 assert.equal(paths.filter(row=>row.method==='POST').length,posts);if(budgetSettings)assert.equal((await budgetSettings(settingsDrawer)).lastNumber,38);
 assert.deepEqual(await call({action:'budget-get',selection:closedSelection,operationId:id}),saved);
 const list=await call({action:'budgets',selection:closedSelection,operationId:randomUUID(),query:{search:saved.reference}});
 assert.equal(list.items.length,1);assert.equal(list.items[0].payload,undefined);assert.equal(list.items[0].snapshot,undefined);
 assert.equal((await raw({action:'budget-create',selection:closedSelection,operationId:id,payload:{...payload,title:'Different intent'}})).result.error,'TPV_BUDGET_ALREADY_BOUND');
 assert.equal((await raw({action:'budget-create',selection:closedSelection,operationId:randomUUID(),payload:{...payload,totalCents:1}})).result.error,'TPV_BUDGET_INPUT_INVALID');
 const cart=(await inspect('select (snapshot->>\'nativeCartId\')::int id from private.totus_tpv_budgets where id=$1',[id])).rows[0].id;
 const after=inspectCommercialCart(fixture.productId,cart);assert.equal(after.commercialOnly,true);assert.equal(after.orders,0);assert.equal(after.stock,before.stock);
 assert.equal((await sessions()).rows[0].n,0);assert.equal((await inspect('select count(*)::int n from private.totus_tpv_operations')).rows[0].n,0);
 assert.equal(paths.filter(row=>row.method==='POST').length,posts);assert.equal(paths.filter(row=>row.path==='/api/totus_tpv_sales').length,0);
 console.log('PASS commercial budget: closed cash desk → actual native calculation → durable commercial snapshot, 10000 units without reservation, immutable identity/recovery without a second POST, browser amount rejection, no cash session/order/payment/stock change. Local laboratory only.');
 if(process.argv.includes('--budget-expiry')){
  const pendingId=randomUUID(),request={action:'budget-create',selection:closedSelection,operationId:pendingId,payload};
  const beforePosts=paths.filter(row=>row.method==='POST').length;simulateBudgetCreateFailure();
  assert.equal((await raw(request)).result.error,'TPV_BUDGET_STORAGE_UNAVAILABLE');
  assert.equal((await inspect('select count(*)::int n from private.totus_tpv_budgets where id=$1',[pendingId])).rows[0].n,0);
  assert.equal(paths.filter(row=>row.method==='POST').length,beforePosts+2);
  console.log('Waiting for the actual native commercial calculation to expire (122 seconds); no mocked clock or quote timestamps.');
  await new Promise(resolve=>setTimeout(resolve,122000));
  const renewed=await call(request);assert.equal(renewed.id,pendingId);assert.equal(renewed.status,'saved');
  const afterPosts=paths.filter(row=>row.method==='POST').length;assert.equal(afterPosts,beforePosts+3,'Only the non-financial quote is renewed; no second cart');
  assert.deepEqual(await call(request),renewed);assert.equal(paths.filter(row=>row.method==='POST').length,afterPosts);
  assert.equal((await inspect('select count(*)::int n from private.totus_tpv_budgets where id=$1',[pendingId])).rows[0].n,1);
  assert.equal((await sessions()).rows[0].n,0);assert.equal(inspectCommercialCart(fixture.productId,0).stock,before.stock);
  assert.equal(paths.filter(row=>row.path==='/api/totus_tpv_sales').length,0);
  console.log('PASS expired budget preparation: failed durable save, real native quote expiry, renewed calculation on the same commercial cart and budget identity, exactly one budget, no cash/order/payment/stock mutation and repeat recovery without another POST.');
 }
 const raceId=randomUUID(),raceRequest={action:'budget-create',selection:closedSelection,operationId:raceId,payload};
 simulateBudgetCreateRace();const raceSaved=await call(raceRequest);assert.equal(raceSaved.id,raceId);
 const racePosts=paths.filter(row=>row.method==='POST').length;
 assert.deepEqual(await call(raceRequest),raceSaved);assert.equal(paths.filter(row=>row.method==='POST').length,racePosts);
 assert.equal((await inspect('select count(*)::int n from private.totus_tpv_budgets where id=$1',[raceId])).rows[0].n,1);
 assert.equal((await sessions()).rows[0].n,0);assert.equal(inspectCommercialCart(fixture.productId,0).stock,before.stock);
 console.log('PASS concurrent-budget outcome recovery: bound-result signal recovers the original saved document with its intent hash, one budget, no cash or stock mutation and no repeated native POST. Commit-race signal is injected after actual SQL persistence.');
 const saleBudgetId=randomUUID(),saleBudget=await call({action:'budget-create',selection:closedSelection,operationId:saleBudgetId,payload:{...payload,lines:[{productId:fixture.productId,attributeId:0,qty:1}]}});
 await call({action:'open',selection:closedSelection,operationId:sessionId,openingCents:10000});
 const opened=await call({action:'budget-open',selection,operationId:saleBudgetId,version:saleBudget.version});assert.equal(opened.draft.status,'claimed');
 assert.deepEqual(await call({action:'budget-open',selection,operationId:saleBudgetId,version:saleBudget.version}),opened);
 const saleId=randomUUID(),ready=await call({action:'prepare',selection,operationId:saleId,lines:opened.draft.payload.lines.map(({productId,attributeId,qty})=>({productId,attributeId,qty})),draftId:opened.draft.id,draftVersion:opened.draft.version});
 assert.equal(ready.status,'ready');assert.equal(ready.expected.totalCents,saleBudget.totalCents);
 const sourceCart=(await inspect("select (snapshot->>'nativeCartId')::int id from private.totus_tpv_budgets where id=$1",[saleBudgetId])).rows[0].id;
 assert.notEqual(ready.expected.cartId,sourceCart);assert.equal(inspectCommercialCart(fixture.productId,ready.expected.cartId).commercialOnly,false);
 const total=ready.expected.totalCents,payments={allocations:[{id:'budget-cash',method:'cash',amountCents:total,receivedCents:total}],confirmation:{operationId:saleId,totalCents:total,currency:'EUR',accepted:true}};
 const expire=()=>inspect("update private.totus_tpv_budgets set created_at=clock_timestamp()-interval '2 days',valid_until=clock_timestamp()-interval '1 day' where id=$1",[saleBudgetId]);
 const restoreDates=()=>inspect('update private.totus_tpv_budgets set created_at=$1::timestamptz,valid_until=$2::timestamptz where id=$3',[saleBudget.createdAt,saleBudget.validUntil,saleBudgetId]);
 // Checkout may refresh its owned price quote before claiming dispatch. The
 // expiry invariant is that no sale/payment/stock command can be dispatched.
 const salePosts=()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length;
 await expire();const beforeBlocked=salePosts();
 assert.equal((await raw({action:'submit',selection,operationId:saleId,payments})).result.error,'TPV_BUDGET_EXPIRED');assert.equal(salePosts(),beforeBlocked);
 assert.equal((await inspect('select status from private.totus_tpv_operations where id=$1',[saleId])).rows[0].status,'ready');await restoreDates();
 simulateBudgetConfirmLoss();const uncertain=await call({action:'submit',selection,operationId:saleId,payments});assert.equal(uncertain.status,'uncertain');
 const beforeRecovery=paths.filter(row=>row.method==='POST').length;await expire();
 const sold=await call({action:'recover',selection,operationId:saleId});assert.equal(sold.status,'confirmed');assert.equal(paths.filter(row=>row.method==='POST').length,beforeRecovery);await restoreDates();
 const nativePosts=paths.filter(row=>row.method==='POST').length;
 assert.equal((await call({action:'submit',selection,operationId:saleId,payments})).status,'confirmed');assert.equal(paths.filter(row=>row.method==='POST').length,nativePosts);
 const completed=await call({action:'budget-get',selection,operationId:saleBudgetId});assert.equal(completed.status,'sold');assert.equal(completed.orderId,sold.orderId);assert.deepEqual(completed.snapshot,saleBudget.snapshot);
 assert.equal((await raw({action:'budget-open',selection,operationId:saleBudgetId,version:completed.version})).result.error,'TPV_BUDGET_CLOSED');
 assert.equal(inspectCommercialCart(fixture.productId,sourceCart).orders,0);assert.equal(inspectCommercialCart(fixture.productId,ready.expected.cartId).orders,1);assert.equal(inspectCommercialCart(fixture.productId,0).stock,before.stock-1);
 assert.equal((await call({action:'document',selection,operationId:saleId,kind:'receipt'})).total_cents,total);
 const invoice=await call({action:'document',selection,operationId:saleId,kind:'invoice'});assert.equal(invoice.mime,'application/pdf');assert.equal(Buffer.from(invoice.base64,'base64').subarray(0,5).toString(),'%PDF-');
 const available=await call({action:'returnable',selection,operationId:randomUUID(),saleId}),refundId=randomUUID();
 await call({action:'prepare-refund',selection,operationId:refundId,saleId,items:[{detailId:available.items[0].detail_id,qty:1,restock:true}],payments:[{method:'cash',amountCents:total}]});
 assert.equal((await call({action:'submit-refund',selection,operationId:refundId,confirmation:{accepted:true,operationId:refundId,totalCents:total,currency:'EUR'}})).status,'confirmed');
 assert.equal(inspectCommercialCart(fixture.productId,0).stock,before.stock);assert.equal((await call({action:'budget-get',selection,operationId:saleBudgetId})).status,'sold');
 const credit=await call({action:'document',selection,operationId:saleId,kind:'credit-note',refundId});assert.equal(credit.mime,'application/pdf');assert.equal(Buffer.from(credit.base64,'base64').subarray(0,5).toString(),'%PDF-');
 console.log('PASS budget conversion: separate payable native cart, expiry blocks first dispatch, expired already-dispatched sale recovers after lost Central confirmation without another POST, verified order/payment/invoice/stock, budget-to-order link, immutable original snapshot, refused second conversion, receipt, refund and restock. Local only.');
 await exerciseNativeBudgetBrowser({handle,actor,fixture,preferences,budgetSettings,selection,paths,call,inspectCommercialCart});
 return {budgetId:id,reference:saved.reference};
}
