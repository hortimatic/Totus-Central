import assert from 'node:assert/strict';
export async function exerciseOperatorSettings({db,id,connection,manager}){
 await db.exec('reset role');const source=(await db.query('select * from private.totus_tpv_assignments where actor_id=$1 and connection_id=$2 and drawer_id=$3',[manager,connection,id(3)])).rows[0],person=id(9531);
 await db.query("insert into public.profiles(id,email,active,role,full_name) values($1,'chooser-9531@example.invalid',true,'employee','Empleado del puesto')",[person]);await db.exec("insert into public.team_members(email,active,role) values('chooser-9531@example.invalid',true,'employee')");
 await db.query('insert into private.totus_tpv_assignments(environment,actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_open,can_reconcile,active) values($1,$2,$3,$4,$5,$6,$7,true,true,true,true)',[source.environment,person,connection,source.website_key,source.store_id,source.shop_id,source.drawer_id]);
 const snapshot=async()=>(await db.query('select (select count(*) from private.totus_tpv_operations) sales,(select count(*) from private.totus_tpv_sessions) sessions,(select count(*) from private.totus_tpv_cash_movements) movements')).rows[0];const before=await snapshot();
 const auth=async who=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);};
 const settings=async(data=null,drawer=source.drawer_id)=>(await db.query('select public.totus_tpv_operator_settings($1,$2,$3,$4::jsonb) result',[connection,source.shop_id,drawer,data===null?null:JSON.stringify(data)])).rows[0].result;
 const choices=async(scoped=true)=>(await db.query('select public.totus_tpv_operator_choices($1,$2,$3) result',scoped?[connection,source.shop_id,source.drawer_id]:[null,null,null])).rows[0].result;
 await auth(manager);assert.deepEqual(await settings(),{switchEnabled:true,revision:0});assert.equal((await choices()).enabled,true);
 assert.deepEqual(await settings({switchEnabled:false,expectedRevision:0}),{switchEnabled:false,revision:1});assert.deepEqual(await settings({switchEnabled:false,expectedRevision:0}),{switchEnabled:false,revision:1},'Lost reply retry does not increase revision');
 assert.deepEqual(await choices(),{actorId:manager,items:[],enabled:false});assert.equal((await choices(false)).enabled,true,'Other enabled workstations remain usable');assert.equal((await choices(false)).items.some(r=>r.operatorId===person),false);
 assert.deepEqual(await settings(null,id(240)),{switchEnabled:true,revision:0});
 await assert.rejects(settings({switchEnabled:true,expectedRevision:0}),/STALE/);
 for(const bad of [{switchEnabled:true,expectedRevision:'1'},{switchEnabled:'false',expectedRevision:1},{switchEnabled:true,expectedRevision:1,actorId:manager},{switchEnabled:true}])await assert.rejects(settings(bad),/INVALID/);
 await auth(person);assert.deepEqual(await settings(),{switchEnabled:false,revision:1});assert.equal((await choices()).enabled,false);await assert.rejects(settings({switchEnabled:true,expectedRevision:1}),/FORBIDDEN/);await assert.rejects(db.query('select * from private.totus_tpv_operator_settings'),/permission denied/);
 await auth(manager);assert.deepEqual(await settings({switchEnabled:true,expectedRevision:1}),{switchEnabled:true,revision:2});assert.ok((await choices()).items.some(r=>r.operatorId===person));
 for(const role of ['anon','service_role']){await db.exec('reset role;set role '+role);await assert.rejects(settings(),/permission denied/);}
 await db.exec('reset role');assert.deepEqual(await snapshot(),before);console.log('PASS operator settings SQL: drawer-wide enabled default, authenticated manager writes, monotonic revision, idempotent replay, stale refusal, disabled directory scope/global intersection, read-only colleague and direct-role denial; finance unchanged. Isolated database.');
}
