import assert from 'node:assert/strict';
export async function exerciseOperatorChoices({db,id,connection,manager}){
 await db.exec('reset role');const source=(await db.query('select * from private.totus_tpv_assignments where actor_id=$1 and connection_id=$2 and drawer_id=$3',[manager,connection,id(3)])).rows[0];assert.ok(source);
 await db.query("insert into private.totus_websites(key,connection_id,business_id,status,origin,include_in_totals) values('chooser-inactive',$1,$2,'inactive','https://inactive.example.invalid',false)",[connection,source.store_id]);
 for(let n=9401;n<=9408;n++){
  const email=`chooser-${n}@example.invalid`;await db.query('insert into public.profiles(id,email,active,role,full_name) values($1,$2,$3,$4,$5)',[id(n),email,n!==9404,'employee',n===9401?'Persona elegible':'Persona excluida '+n]);
  if(n!==9407)await db.query('insert into public.team_members(email,active,role) values($1,$2,$3)',[email,n!==9402,'employee']);
  await db.query('insert into private.totus_tpv_assignments(environment,actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_open,can_reconcile,active) values($1,$2,$3,$4,$5,$6,$7,true,true,$8,true)',[source.environment,id(n),connection,n===9408?'chooser-inactive':source.website_key,n===9403?id(22):source.store_id,source.shop_id,n===9403?id(33):source.drawer_id,n!==9405]);
 }
 await db.exec(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and (p.role='admin' or p.email like 'chooser-%@example.invalid' and p.email<>'chooser-9406@example.invalid' and $2 in ('ventas','cajas')))$$;`);
 const finances=async()=>(await db.query('select (select count(*) from private.totus_tpv_operations) sales,(select count(*) from private.totus_tpv_refunds) refunds,(select count(*) from private.totus_tpv_sessions) sessions,(select count(*) from private.totus_tpv_cash_movements) movements')).rows[0];const before=await finances();
 const auth=async actor=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor||'']);};
 const choices=async(c=null,shop=null,drawer=null)=>(await db.query('select public.totus_tpv_operator_choices($1,$2,$3) result',[c,shop,drawer])).rows[0].result;
 await auth(manager);let result=await choices(connection,source.shop_id,source.drawer_id);assert.equal(result.actorId,manager);assert.ok(result.items.some(r=>r.operatorId===id(9401)));for(let n=9402;n<=9408;n++)assert.equal(result.items.some(r=>r.operatorId===id(n)),false,'Excluded '+n);
 const candidate=result.items.find(r=>r.operatorId===id(9401));assert.deepEqual(candidate,{operatorId:id(9401),name:'Persona elegible',loginEmail:'chooser-9401@example.invalid'});assert.ok((await choices()).items.some(r=>r.operatorId===id(9401)));
 await assert.rejects(choices(connection,null,source.drawer_id),/SCOPE_INVALID/);await assert.rejects(choices(connection,1,id(9399)),/FORBIDDEN/);
 await auth(id(9401));result=await choices();assert.equal(result.actorId,id(9401));assert.ok(result.items.some(r=>r.operatorId===manager));
 await db.exec('reset role');await db.query('update private.totus_tpv_assignments set active=false where actor_id=$1',[id(9401)]);await auth(id(9401));assert.deepEqual((await choices()).items,[]);await assert.rejects(choices(connection,source.shop_id,source.drawer_id),/FORBIDDEN/);
 await auth(id(9402));await assert.rejects(choices(),/FORBIDDEN/);await auth(null);await assert.rejects(choices(),/AUTH_REQUIRED/);
 for(const role of ['anon','service_role']){await db.exec('reset role;set role '+role);await assert.rejects(choices(),/permission denied/);}
 await db.exec('reset role');assert.deepEqual(await finances(),before,'Choosing an operator must not create or close financial records');console.log('PASS operator choices SQL: actual JWT, shared workstation only, active profile/team/access/permissions, scoped/global reads, exact minimal fields, revoked/foreign/anonymous/service-role denial and unchanged finance. Isolated database.');
}
