import assert from 'node:assert/strict';
export async function exerciseBudgetSettings({db,id,scope}){
 const auth=async who=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);};
 const call=async(settings=null,drawer=scope.drawerId)=>(await db.query('select public.totus_tpv_budget_settings($1,$2,$3,$4::jsonb) result',[scope.connectionId,scope.shopId,drawer,settings===null?null:JSON.stringify(settings)])).rows[0].result;
 await auth(scope.actorId);const defaults={enabled:false,prefix:'P-',lastNumber:0,hidePrices:false,revision:0};assert.deepEqual(await call(),defaults);
 const intent={enabled:true,prefix:'P-',lastNumber:43,hidePrices:true,expectedRevision:0},saved={enabled:true,prefix:'P-',lastNumber:43,hidePrices:true,revision:1};
 assert.deepEqual(await call(intent),saved);assert.deepEqual(await call(intent),saved);assert.deepEqual(await call(),saved);
 await assert.rejects(call({...intent,prefix:'OTHER-'}),/STALE/);
 await assert.rejects(call({...intent,expectedRevision:100}),/STALE/);
 await assert.rejects(call({...intent,lastNumber:42,expectedRevision:1}),/DECREASE/);
 for(const bad of [{...intent,lastNumber:1.5},{...intent,lastNumber:1000000000},{...intent,prefix:'<script>'},{...intent,expectedRevision:'1'},{...intent,hidePrices:'true'},{...intent,actorId:scope.actorId},{}])await assert.rejects(call(bad),/INVALID/);
 await assert.rejects(call(null,id(999999)),/FORBIDDEN/);
 await db.exec('reset role');const sharedDrawer=id(12910);await db.query('insert into public.ops_cash_drawers(id,store_id,active,name) values($1,$2,true,$3)',[sharedDrawer,scope.storeId,'Otra caja de presupuestos']);await db.query('insert into private.totus_tpv_assignments select environment,actor_id,connection_id,website_key,store_id,shop_id,$1,can_sell,can_reconcile,can_open,active from private.totus_tpv_assignments where actor_id=$2 and drawer_id=$3',[sharedDrawer,scope.actorId,scope.drawerId]);await auth(scope.actorId);assert.deepEqual(await call(null,sharedDrawer),saved,'All assigned tills of this establishment share the settings and counter');
 await auth(id(9531));assert.deepEqual(await call(),saved);await assert.rejects(call({...intent,expectedRevision:1,prefix:'READONLY-'}),/FORBIDDEN/);
 await db.exec('reset role;set role anon');await assert.rejects(call(),/permission denied/);
 await db.exec('reset role;set role service_role');await assert.rejects(call(),/permission denied/);
 await auth(scope.actorId);assert.deepEqual(await call(),saved);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from private.totus_tpv_budget_settings_audit')).rows[0].n,1,'Lost reply creates no second settings audit event');
 console.log('PASS budget settings SQL: scoped defaults, persisted manager settings and exact lost-reply retry, revision conflict, counter rollback refusal, forged/invalid input and direct browser/private access denial. Isolated SQL only.');
}
