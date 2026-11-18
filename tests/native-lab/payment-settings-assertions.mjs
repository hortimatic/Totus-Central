export async function exercisePaymentSettings({db,id,scope,check,denied}){
 const options=async(value=null,selected=scope)=>(await db.query('select public.totus_tpv_payment_options($1,$2,$3,$4::jsonb) result',[selected.connectionId,selected.shopId,selected.drawerId,value===null?null:JSON.stringify(value)])).rows[0].result;
 await db.exec('reset role');
 const definition=(await db.query("select pg_get_functiondef('private.totus_module_can(text,text,text)'::regprocedure) source")).rows[0].source;
 const native=(await db.query('select profile from private.totus_tpv_native_profiles where connection_id=$1 and shop_id=$2',[scope.connectionId,scope.shopId])).rows[0].profile;
 try{
  await db.exec('set role anon');await denied(()=>options(),/permission denied/);
  await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub','',false)");await denied(()=>options(),/AUTH_REQUIRED/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(5)]);
  const initial=await options();check(initial.revision,0);check(initial.options.enabledMethods.includes('cash'),true);
  const saved=await options({enabledMethods:['card'],labels:{card:'  Datáfono  '}});
  check(saved.revision,1);check(saved.options.enabledMethods,['card']);check(saved.options.labels.card,'Datáfono');
  check((await options({enabledMethods:['card'],labels:{card:'Datáfono'}})).revision,1);
  check((await options({enabledMethods:['cash']})).revision,2);
  for(const invalid of [[],true,{enabledMethods:[]},{enabledMethods:['cash','cash']},{enabledMethods:['cheque']},{enabledMethods:[1]},{labels:[]},{labels:{cash:null}},{labels:{cash:'<x>'}},{labels:{cash:'x'.repeat(41)}},{labels:{cash:'Tarjeta',card:'tarjeta'}},{revision:2}])await denied(()=>options(invalid),/SETTINGS_INVALID/);
  await denied(()=>options({}, {...scope,drawerId:id(999)}),/FORBIDDEN/);
  await denied(()=>options({}, {...scope,shopId:2}),/FORBIDDEN/);
  await denied(()=>db.query('select * from private.totus_tpv_payment_settings'),/permission denied/);
  await denied(()=>db.query('delete from private.totus_tpv_payment_settings_history'),/permission denied/);
  await db.exec('reset role');await db.exec(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select not($2='configuracion' and $3='edit') and exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$`);
  await db.exec('set role authenticated');check((await options()).revision,2);await denied(()=>options({enabledMethods:['card']}),/FORBIDDEN/);
  await db.exec('reset role');
  check((await db.query('select profile from private.totus_tpv_native_profiles where connection_id=$1 and shop_id=$2',[scope.connectionId,scope.shopId])).rows[0].profile,native);
  const history=(await db.query('select revision,before_options,after_options from private.totus_tpv_payment_settings_history order by revision')).rows;
  check(history.length,2);check(history[0].before_options,null);check(history[1].before_options,history[0].after_options);
  await db.query("insert into public.profiles(id,email,active,role) values($1,'payment-colleague@example.invalid',true,'admin')",[id(778)]);
  await db.exec("insert into public.team_members(email,active,role) values('payment-colleague@example.invalid',true,'admin')");
  await db.query('insert into private.totus_tpv_assignments(actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_reconcile,can_open) select $1,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_reconcile,can_open from private.totus_tpv_assignments where actor_id=$2 and connection_id=$3 and shop_id=$4 and drawer_id=$5',[id(778),id(5),scope.connectionId,scope.shopId,scope.drawerId]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(778)]);await db.exec('set role authenticated');
  check((await options()).options.enabledMethods,['cash']);check((await options()).revision,2);
  await db.exec('reset role');await db.query('update private.totus_tpv_assignments set active=false where actor_id=$1',[id(778)]);await db.exec('set role authenticated');await denied(()=>options(),/FORBIDDEN|ACCESS/);
  console.log('PASS payment settings SQL: scoped normal JWT, Configuración/edit, cash/card-only, idempotent revision, immutable native labels and audited changes; direct table access denied.');
 }finally{
  await db.exec('reset role');await db.exec(definition);
  await db.query('delete from private.totus_tpv_assignments where actor_id=$1',[id(778)]);
  await db.exec("delete from public.team_members where email='payment-colleague@example.invalid'");await db.query('delete from public.profiles where id=$1',[id(778)]);
  await db.exec('delete from private.totus_tpv_payment_settings_history;delete from private.totus_tpv_payment_settings');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(5)]);await db.exec('set role authenticated');
 }
}
