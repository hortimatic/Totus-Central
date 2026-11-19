import assert from 'node:assert/strict';
export async function exerciseCashVisibility({db,id,scope,manager}){
 await db.exec('reset role');const cashier=id(9301);
 await db.query("insert into public.profiles(id,email,active,role) values($1,'blind-cash@example.invalid',true,'employee')",[cashier]);
 const source=(await db.query("select * from private.totus_tpv_assignments where actor_id=$1 and connection_id=$2 and drawer_id=$3",[manager,scope.connectionId,scope.drawerId])).rows[0];assert.ok(source);
 await db.query('insert into private.totus_tpv_assignments(environment,actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_open,can_reconcile,active) values($1,$2,$3,$4,$5,$6,$7,true,true,true,true)',[source.environment,cashier,source.connection_id,source.website_key,source.store_id,source.shop_id,source.drawer_id]);
 // Explicit fixture: cashiers can use the TPV, but only administrators read Central Cajas/configuration.
 await db.exec(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and (p.role='admin' or p.email='blind-cash@example.invalid' and $2 in ('totustpv','ventas','cajas')))$$;`);
 const auth=async actor=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);};
 const policy=async(data=undefined)=>(await db.query('select public.totus_tpv_cash_visibility($1,$2,$3,$4::jsonb) result',[scope.connectionId,scope.shopId,scope.drawerId,data===undefined?null:JSON.stringify(data)])).rows[0].result;
 const cashScope={...scope,actorId:cashier};
 const summary=async(sc=cashScope)=>(await db.query("select public.totus_tpv_cash('summary',$1,$2::jsonb) result",[id(9302),JSON.stringify(sc)])).rows[0].result;
 await auth(manager);assert.deepEqual(await policy(),{hideSummary:false});
 await db.exec('reset role;set role service_role');const original=await summary();assert.equal(Number.isSafeInteger(original.expectedCashCents),true);
 await auth(manager);assert.deepEqual(await policy({hideSummary:true}),{hideSummary:true});
 for(const bad of [{hideSummary:'true'},{hideSummary:true,actorId:manager},{},[]])await assert.rejects(policy(bad),/VISIBILITY_INVALID/);
 await auth(cashier);assert.deepEqual(await policy(),{hideSummary:true});await assert.rejects(policy({hideSummary:false}),/VISIBILITY_FORBIDDEN/);
 const context=(await db.query('select public.totus_tpv_context() result')).rows[0].result;const station=context.workstations.find(r=>r.drawerId===scope.drawerId);assert.ok(station);if(station.session){assert.equal(Object.hasOwn(station.session,'openingCents'),false);assert.equal(station.session.cashSummaryHidden,true);}
 await assert.rejects(db.query('select totus_tpv_internal.context_unredacted_v1()'),/permission denied/);
 await assert.rejects(db.query("select totus_tpv_internal.cash_unredacted_v1('summary',$1,$2::jsonb)",[id(9302),JSON.stringify(cashScope)]),/permission denied/);
 await assert.rejects(db.query('select totus_tpv_internal.cash_reports_unredacted_v1($1::jsonb,$2)',[JSON.stringify(cashScope),scope.sessionId]),/permission denied/);
 await assert.rejects(db.query('select public.totus_tpv_cash_visibility($1,$2,$3)',[scope.connectionId,scope.shopId,id(9399)]),/FORBIDDEN/);await assert.rejects(db.query('select * from private.totus_tpv_cash_visibility'),/permission denied/);
 await db.exec('reset role;set role service_role');const hidden=await summary();assert.equal(hidden.cashSummaryHidden,true);assert.equal(hidden.sessionId,scope.sessionId);
 for(const k of ['openingCents','expectedCashCents','availableCashCents','payments','refunds','countedCents','differenceCents'])assert.equal(Object.hasOwn(hidden,k),false,k);
 const reports=(await db.query('select public.totus_tpv_cash_reports($1::jsonb,$2) result',[JSON.stringify(cashScope),scope.sessionId])).rows[0].result;assert.equal(reports.length,1);assert.equal(reports[0].cashSummaryHidden,true);assert.equal(Object.hasOwn(reports[0],'expectedCashCents'),false);assert.equal(Object.hasOwn(reports[0],'movements'),false);
 assert.deepEqual(await summary(scope),original,'Configuration manager permission retains the original financial summary');
 const raw=(await db.query('select private.totus_tpv_cash_summary($1) result',[scope.sessionId])).rows[0].result;assert.deepEqual(raw,original,'Projection does not mutate the ledger');
 await auth(manager);await policy({hideSummary:false});await db.exec('reset role;set role service_role');assert.deepEqual(await summary(),original,'Disabling the rule preserves the prior contract');
 await db.exec('reset role');const blindScope={...cashScope,drawerId:id(9311),sessionId:id(9310)};
 await db.query('insert into public.ops_cash_drawers(id,store_id,active,name) values($1,$2,true,$3)',[blindScope.drawerId,source.store_id,'Caja de arqueo sin saldo']);
 for(const who of [cashier,manager])await db.query('insert into private.totus_tpv_assignments(environment,actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_open,can_reconcile,active) values($1,$2,$3,$4,$5,$6,$7,true,true,true,true)',[source.environment,who,source.connection_id,source.website_key,source.store_id,source.shop_id,blindScope.drawerId]);
 await auth(manager);await db.query('select public.totus_tpv_cash_visibility($1,$2,$3,$4::jsonb)',[scope.connectionId,scope.shopId,blindScope.drawerId,JSON.stringify({hideSummary:true})]);
 await db.exec('reset role;set role service_role');await db.query("select public.totus_tpv_journal('open',$1,$2::jsonb,$3::jsonb)",[blindScope.sessionId,JSON.stringify(blindScope),JSON.stringify({openingCents:10000})]);
 const mutate=async(action,request,data)=>(await db.query('select public.totus_tpv_cash($1,$2,$3::jsonb,$4::jsonb) result',[action,request,JSON.stringify(blindScope),JSON.stringify(data)])).rows[0].result;
 const moved=await mutate('movement',id(9312),{kind:'cash-in',amountCents:55,reason:'Entrada ficticia'});assert.equal(moved.cashSummaryHidden,true);assert.equal(Object.hasOwn(moved,'expectedCashCents'),false);
 const closed=await mutate('close',id(9313),{countedCents:10050,note:'Recuento ficticio sin saldo'});assert.equal(closed.status,'closed');assert.equal(closed.cashSummaryHidden,true);assert.equal(Object.hasOwn(closed,'countedCents'),false);assert.equal(Object.hasOwn(closed,'differenceCents'),false);
 assert.deepEqual(await mutate('close',id(9313),{countedCents:10050,note:'Recuento ficticio sin saldo'}),closed);await assert.rejects(mutate('close',id(9313),{countedCents:0,note:'Recuento ficticio sin saldo'}),/ALREADY_BOUND/);
 const counted=(await db.query('select counted_cents,status from private.totus_tpv_sessions where id=$1',[blindScope.sessionId])).rows[0];assert.equal(Number(counted.counted_cents),10050);assert.equal(counted.status,'closed');
 const managerResult=await summary({...blindScope,actorId:manager});assert.equal(managerResult.expectedCashCents,10055);assert.equal(managerResult.countedCents,10050);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.totus_tpv_cash_visibility($1,$2,$3)',[scope.connectionId,scope.shopId,scope.drawerId]),/permission denied/);
 await db.exec('reset role');console.log('PASS cash visibility SQL: authenticated drawer policy, server-side summary/report/context projection, manager exception, invalid/revoked/direct-role denial and untouched ledger. Isolated PostgreSQL.');
}
