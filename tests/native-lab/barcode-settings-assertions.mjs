export async function exerciseBarcodeSettings({db,id,scope,check,denied}){
 const options=async(value=null,selected=scope)=>(await db.query('select public.totus_tpv_barcode_options($1,$2,$3,$4::jsonb) result',[selected.connectionId,selected.shopId,selected.drawerId,value===null?null:JSON.stringify(value)])).rows[0].result;
 await db.exec('reset role');
 const definition=(await db.query("select pg_get_functiondef('private.totus_module_can(text,text,text)'::regprocedure) source")).rows[0].source;
 const financial=async()=>{const result=[];for(const table of ['totus_tpv_sessions','totus_tpv_operations','totus_tpv_payment_events','totus_tpv_cash_movements','totus_tpv_native_commands'])result.push((await db.query(`select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) value from private.${table} r`)).rows[0].value);return result;};
 const before=await financial();
 try{
  await db.exec('set role anon');await denied(()=>options(),/permission denied/);
  await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub','',false)");await denied(()=>options(),/AUTH_REQUIRED/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(5)]);
  check(await options(),{field:'ean13',generatorEnabled:false});
  check(await options({field:'upc',generatorEnabled:true}),{field:'upc',generatorEnabled:true});
  check(await options({field:'reference'}),{field:'reference',generatorEnabled:true});
  check(await options({generatorEnabled:false}),{field:'reference',generatorEnabled:false});
  check(await options({}),{field:'reference',generatorEnabled:false});
  for(const invalid of [[],true,'ean13',{field:null},{field:'isbn'},{field:3},{generatorEnabled:'true'},{generatorEnabled:1},{generatorEnabled:null},{actorId:id(9)},{field:'ean13',secret:'x'}])await denied(()=>options(invalid),/SETTINGS_INVALID/);
  await denied(()=>options({}, {...scope,shopId:2}),/FORBIDDEN/);await denied(()=>options({}, {...scope,drawerId:id(999)}),/FORBIDDEN/);
  await denied(()=>db.query('select * from private.totus_tpv_barcode_settings'),/permission denied/);
  await denied(()=>db.query("update private.totus_tpv_barcode_settings set generator_enabled=true"),/permission denied/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(9)]);await denied(()=>options(),/FORBIDDEN|ACCESS/);
  await db.exec('reset role');await db.exec(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select not($2='productos' and $3='edit') and exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$`);
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(5)]);
  check(await options(),{field:'reference',generatorEnabled:false});await denied(()=>options({generatorEnabled:true}),/BARCODE_FORBIDDEN/);
  await db.exec('reset role');await db.exec(definition);await db.exec('set role authenticated');
  check(await options({field:'ean13',generatorEnabled:false}),{field:'ean13',generatorEnabled:false});
  await db.exec('reset role');check(await financial(),before);
  check((await db.query("select relrowsecurity from pg_class where oid='private.totus_tpv_barcode_settings'::regclass")).rows[0].relrowsecurity,true);
  console.log('PASS barcode settings SQL: authenticated own-account/drawer defaults and partial saves, Products/edit revocation, forged scopes and direct-table denial; all native commands and financial rows unchanged. Isolated PostgreSQL only.');
 }finally{await db.exec('reset role');await db.exec(definition);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(5)]);await db.exec('set role authenticated');}
}
