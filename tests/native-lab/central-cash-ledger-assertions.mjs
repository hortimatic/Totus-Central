import assert from 'node:assert/strict';
/** Executed after the complete monetary fixture. This manager has Cajas view
 * only and no cashier assignment; the reports read real migrated SQL totals. */
export async function exerciseCentralCashLedger({db,id,scope,closedSession,otherSession}){
 await db.exec('reset role');const manager=id(1200);
 const financialSnapshot=async()=>Object.fromEntries(await Promise.all(['private.totus_tpv_sessions','private.totus_tpv_operations','private.totus_tpv_payment_events',
  'private.totus_tpv_refunds','private.totus_tpv_refund_payments','private.totus_tpv_cash_movements','public.ops_daily_closings'].map(async table=>
  [table,(await db.query('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),\'[]\'::jsonb) data from '+table+' t')).rows[0].data])));
 const before=await financialSnapshot();
 await db.query('insert into public.profiles(id,email,active,role,full_name) values($1,$2,true,$3,$4)',[manager,'cash-reader@example.invalid','employee','Consulta de cajas']);
 await db.exec(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$
  select $1='cash-reader@example.invalid' and $2='cajas' and $3='view'$$;`);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[manager]);await db.exec('set role authenticated');
 const context=async()=>(await db.query('select public.totus_tpv_central_cash_context() result')).rows[0].result;
 const ctx=await context();assert.equal(ctx.actorId,manager);assert.equal(ctx.sources.length,1);
 const source=ctx.sources[0],selection={connectionId:source.connectionId,connectionRevision:source.connectionRevision,shopId:source.shopId,storeId:source.storeId};
 assert.equal(source.environment,'qa');assert.equal(source.secret,undefined);assert.ok(source.drawers.length>=2);
 const read=async(section='sessions',query={},picked=selection)=>(await db.query('select public.totus_tpv_central_cash_read($1::jsonb,$2,$3::jsonb) result',[JSON.stringify(picked),section,JSON.stringify(query)])).rows[0].result;
 const all=await read();assert.ok(all.items.some(row=>row.id===closedSession));assert.ok(all.items.some(row=>row.id===otherSession));
 assert.equal((await read('sessions',{status:'closed'})).items.some(row=>row.status!=='closed'),false);
 const scoped=await read('sessions',{}, {...selection,drawerId:scope.drawerId});assert.ok(scoped.items.every(row=>row.drawerName===scoped.items[0].drawerName));
 assert.equal(scoped.items.some(row=>row.id===otherSession),false);
 const first=await read('sessions',{limit:1});assert.equal(first.items.length,1);assert.equal(first.hasMore,true);
 const second=await read('sessions',{limit:1,cursor:first.cursor});assert.notEqual(first.items[0].id,second.items[0].id);
 const picked={...selection,drawerId:scope.drawerId,sessionId:closedSession},detail=await read('session',{},picked);
 assert.equal(detail.status,'closed');assert.equal(detail.countedCents,10400);assert.equal(detail.differenceCents,0);assert.equal(detail.orderCount,1);
 assert.equal(detail.closingRequestId,undefined);assert.equal(detail.environment,'qa');assert.equal(detail.currency,'EUR');
 const sales=await read('sales',{},picked);assert.equal(sales.items.filter(row=>row.status==='confirmed').length,1);
 assert.equal(sales.items.find(row=>row.status==='confirmed').orderId,4901);
 assert.equal(sales.items[0].expected,undefined);assert.equal(sales.items[0].payments,undefined);
 assert.equal((await read('sales',{search:'%'} ,picked)).items.length,0);
 assert.equal((await read('sales',{from:'1900-01-01',to:'1900-01-02'},picked)).items.length,0);
 assert.ok(Array.isArray((await read('refunds',{},picked)).items));assert.ok(Array.isArray((await read('movements',{},picked)).items));
 for(const query of [{limit:51},{limit:0},{limit:1.2},{from:null},{from:'invalid'},{from:'2026-11-18',to:'2026-11-17'},
  {cursor:{id:manager}},{status:'confirmed'},{actorId:manager},{search:123}])await assert.rejects(()=>read('sessions',query));
 for(const change of [{connectionRevision:999},{storeId:id(22)},{shopId:2},{connectionId:id(1)},{actorId:manager}])await assert.rejects(()=>read('sessions',{}, {...selection,...change}));
 await assert.rejects(()=>read('session',{}, {...picked,sessionId:otherSession}),/TPV_CENTRAL_CASH_SESSION_NOT_FOUND/);
 await assert.rejects(()=>db.query('select * from private.totus_tpv_sessions'),/permission denied/);
 await db.exec('reset role');await db.query('update private.totus_api_connections set enabled=false where id=$1',[source.connectionId]);
 await db.exec('set role authenticated');assert.equal((await context()).sources.length,1);assert.equal((await read('session',{},picked)).countedCents,10400);
 await db.exec('reset role');await db.query('update private.totus_api_connections set enabled=true where id=$1',[source.connectionId]);await db.exec('set role authenticated');
 await db.exec('reset role');await db.query('update private.totus_api_connections set revision=revision+1 where id=$1',[source.connectionId]);await db.exec('set role authenticated');
 await assert.rejects(()=>read('session',{},picked),/TPV_CENTRAL_CASH_CONTEXT_STALE/);
 const changedSource=(await context()).sources[0];assert.equal(changedSource.connectionRevision,source.connectionRevision+1);
 assert.equal((await read('session',{}, {...picked,connectionRevision:changedSource.connectionRevision})).countedCents,10400);
 await db.exec('reset role');await db.query('update private.totus_api_connections set revision=revision-1 where id=$1',[source.connectionId]);
 await db.query('update public.ops_stores set active=false where id=$1',[source.storeId]);await db.exec('set role authenticated');
 assert.equal((await context()).sources[0].storeActive,false);assert.equal((await read('session',{},picked)).countedCents,10400);
 await db.exec('reset role');await db.query('update public.ops_stores set active=true where id=$1',[source.storeId]);await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select private.totus_tpv_central_cash_actor()'),/permission denied/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from private.totus_tpv_assignments where actor_id=$1',[manager])).rows[0].n,0);
 await db.exec('set role anon');await assert.rejects(context,/permission denied/);await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(9)]);await db.exec('set role authenticated');await assert.rejects(context,/TPV_CENTRAL_CASH_FORBIDDEN/);
 await db.exec('reset role');await db.query('update public.profiles set active=false where id=$1',[manager]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[manager]);await db.exec('set role authenticated');await assert.rejects(context,/TPV_CENTRAL_CASH_FORBIDDEN/);
 await db.exec('reset role');assert.deepEqual(await financialSnapshot(),before);
 console.log('PASS Central Cajas SQL: view-only unassigned reader, confirmed monetary totals, per-drawer/session scoping, full cursor pagination, filters, private-journal projection, stale/forged scope and role denial. All financial journals and daily closing rows unchanged.');
}
