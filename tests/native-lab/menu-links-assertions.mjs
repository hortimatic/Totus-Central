import assert from 'node:assert/strict';
export async function exerciseMenuLinks({db,id,scope,prefs}){
 const call=async(value,selection=scope)=>(await db.query('select public.totus_tpv_menu_links($1,$2,$3,$4,$5::jsonb) result',[scope.actorId,selection.connectionId,selection.shopId,selection.drawerId,value===undefined?null:JSON.stringify(value)])).rows[0].result;
 const count=async()=>{await db.exec('reset role');const result=(await db.query('select (select count(*) from private.totus_tpv_operations) sales,(select count(*) from private.totus_tpv_refunds) refunds,(select count(*) from private.totus_tpv_cash_movements) movements')).rows[0];await db.exec('set role authenticated');return result;};
 const permissions=(await db.query(`select
 has_function_privilege('anon','public.totus_tpv_menu_links(uuid,uuid,bigint,uuid,jsonb)','execute') anon_public,
 has_function_privilege('anon','totus_tpv_internal.menu_links(uuid,uuid,bigint,uuid,jsonb)','execute') anon_internal,
 has_function_privilege('authenticated','totus_tpv_internal.menu_links(uuid,uuid,bigint,uuid,jsonb)','execute') own_internal,
 (select prosecdef from pg_proc where oid='public.totus_tpv_menu_links(uuid,uuid,bigint,uuid,jsonb)'::regprocedure) public_definer,
 (select prosecdef from pg_proc where oid='totus_tpv_internal.menu_links(uuid,uuid,bigint,uuid,jsonb)'::regprocedure) internal_definer`)).rows[0];
 assert.deepEqual(permissions,{anon_public:false,anon_internal:false,own_internal:true,public_definer:false,internal_definer:true},'Only authenticated callers reach the scoped non-exposed implementation');
 const baseline=await prefs(scope),before=await count(),links=[{label:'Clientes',url:'/clientes'},{label:'Ayuda',url:'https://example.invalid/ayuda?seccion=caja'}];
 assert.deepEqual(await call(),[]);assert.deepEqual(await call(links),links);assert.deepEqual(await call(),links);
 await prefs(scope,{viewMode:'table'});assert.deepEqual(await call(),links,'Saving other preferences preserves menu links');
 for(const value of [null,{},Array(7).fill(links[0]),[{label:' ',url:'/clientes'}],[{label:'Clientes',url:'javascript:alert(1)'}],[{label:'Clientes',url:'//other.invalid'}],[{label:'Clientes',url:'https://user:pass@example.invalid/'}],[{label:'Clientes',url:'https://example.invalid/?token=private'}],[{label:'Clientes',url:'https://example.invalid/?%74oken=private'}],[{label:'Clientes',url:'https://example.invalid/#access_token=private'}],[{label:'Clientes',url:'/clientes',secret:'bad'}],[links[0],links[0]]])await assert.rejects(call(value),/TPV_MENU_LINKS_INVALID/);
 assert.deepEqual(await call(),links,'Rejected changes leave the original menu intact');
 for(const selection of [{...scope,drawerId:id(33)},{...scope,shopId:99},{...scope,connectionId:id(99)}])await assert.rejects(call(undefined,selection),/FORBIDDEN/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(9)]);await assert.rejects(call(),/FORBIDDEN|AUTH_REQUIRED/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[scope.actorId]);
 await assert.rejects(db.query('update private.totus_tpv_workspace_preferences set menu_links=\'[]\''),/permission denied/);
 assert.deepEqual(await call([]),[]);await prefs(scope,{viewMode:baseline.viewMode});assert.deepEqual(await count(),before);
 console.log('PASS menu links SQL: authenticated own scope, save/readback, independent preferences, invalid/credential links and duplicates rejected atomically, foreign scopes and direct table writes denied; financial journals unchanged. Isolated PostgreSQL only.');
}
