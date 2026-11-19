import assert from 'node:assert/strict';
export async function exerciseQuoteRefresh({db,id,scope,expected,check,denied}){
 const operation=id(8998),price=expected(908998),args=[JSON.stringify(scope),operation,1,JSON.stringify(price),Date.now()+60000];
 const refresh=(values=args)=>db.query('select public.totus_tpv_refresh_quote($1::jsonb,$2::uuid,$3::bigint,$4::jsonb,$5::bigint) result',values);
 check((await db.query("select has_function_privilege('authenticated','public.totus_tpv_refresh_quote(jsonb,uuid,bigint,jsonb,bigint)','EXECUTE') allowed")).rows[0].allowed,false);
 check((await db.query("select has_function_privilege('anon','public.totus_tpv_refresh_quote(jsonb,uuid,bigint,jsonb,bigint)','EXECUTE') allowed")).rows[0].allowed,false);
 await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb)',['prepare',operation,JSON.stringify(scope),JSON.stringify({expected:price,quoteExpiresAt:Date.now()+30000})]);
 for(const [index,value] of [[0,JSON.stringify({...scope,actorId:id(9999)})],[2,999],[3,JSON.stringify({...price,totalCents:price.totalCents+1})],[4,Date.now()-1000],[4,Date.now()+600000]]){
  const changed=[...args];changed[index]=value;await denied(()=>refresh(changed),/TPV_/);
 }
 const result=(await refresh()).rows[0].result;check(result.revision,2);assert.deepEqual(result.expected,price);check(result.id,operation);
 await denied(()=>refresh(),/TPV_OPERATION_STALE/);
 await db.exec('reset role');await db.query("update private.totus_tpv_operations set status='dispatched',dispatch_token=$2,payments='[]'::jsonb where id=$1",[operation,id(8997)]);await db.exec('set role service_role');
 await denied(()=>refresh([args[0],operation,2,args[3],args[4]]),/TPV_OPERATION_ALREADY_DISPATCHED/);
 await db.exec('reset role');await db.query('delete from private.totus_tpv_operations where id=$1',[operation]);await db.exec('set role service_role');
}
