import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite(),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
const scope={actorId:id(1),connectionId:connection,connectionRevision:1,shopId:1,storeId:id(2),currency:'EUR',environment:'qa'};
try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,email text,active boolean,full_name text);
 create table public.ops_stores(id uuid primary key,name text,active boolean);
 create table public.ops_cash_drawers(id uuid primary key,store_id uuid,name text);
 create table private.totus_api_connections(id uuid primary key,revision bigint,verified_revision bigint,protocol text,enabled boolean,real_data_authorized boolean);
 create table private.totus_websites(key text primary key,connection_id uuid,status text,origin text,include_in_totals boolean);
 create table private.totus_tpv_native_profiles(connection_id uuid,connection_revision bigint,shop_id bigint,store_id uuid,website_key text,environment text,profile jsonb);
 create table private.totus_tpv_operations(id uuid primary key,created_at timestamptz,created_by uuid,drawer_id uuid,status text,connection_id uuid,shop_id bigint,store_id uuid,environment text,currency text,order_id bigint,expected jsonb);
 create table private.totus_tpv_refunds(id uuid primary key,sale_id uuid,actor_id uuid,total_cents bigint,status text,created_at timestamptz);
 create function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select $1='billing@example.invalid' and $2='facturacion' and $3='view'$$;
 create function private.totus_can(module text,action text) returns boolean language sql stable as $$select private.totus_module_can((select email from public.profiles where id=auth.uid()),$1,$2)$$;
 insert into public.profiles values('${id(1)}','billing@example.invalid',true,'Contabilidad'),('${id(9)}','no@example.invalid',true,'Sin permiso');
 insert into public.ops_stores values('${id(2)}','Laboratorio',true);
 insert into public.ops_cash_drawers values('${id(3)}','${id(2)}','Mostrador');
 insert into private.totus_api_connections values('${connection}',1,1,'prestashop',true,true);
 insert into private.totus_websites values('qa','${connection}','active','https://preproduccion.hortimatic.com',false);
 insert into private.totus_tpv_native_profiles values('${connection}',1,1,'${id(2)}','qa','qa','{"verified":true,"configured":true,"native_version":"8.2.8","currency":"EUR"}');
 insert into private.totus_tpv_operations values('${id(4)}',now(),'${id(1)}','${id(3)}','confirmed','${connection}',1,'${id(2)}','qa','EUR',100,'{"totalCents":1210,"customerId":2}'),
 ('${id(5)}',now()-interval '1 second','${id(1)}','${id(3)}','ready','${connection}',1,'${id(2)}','qa','EUR',101,'{"totalCents":999}'),
 ('${id(6)}',now()-interval '2 seconds','${id(1)}','${id(3)}','confirmed','${connection}',2,'${id(2)}','qa','EUR',102,'{"totalCents":888}'),
 ('${id(7)}',now()-interval '3 seconds','${id(1)}','${id(3)}','confirmed','${connection}',1,'${id(2)}','qa','EUR',103,'{"totalCents":200}');
 insert into private.totus_tpv_refunds values('${id(8)}','${id(4)}','${id(1)}',100,'confirmed',now());
 grant usage on schema public,private,auth to authenticated,service_role;
 grant select on all tables in schema public,private to service_role;`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261117234736_totustpv_billing_bridge.sql',import.meta.url),'utf8'));
 const rpc=async(s=scope,sale=null,query={})=>(await db.query('select public.totus_tpv_billing_read($1::jsonb,$2::uuid,$3::jsonb) result',[JSON.stringify(s),sale,JSON.stringify(query)])).rows[0].result;
 await db.exec('set role service_role');
 const list=await rpc();assert.deepEqual(list.items.map(row=>row.orderId),[100,103]);assert.equal(list.items[0].refundCents,100);
 assert.equal(list.items[0].sourceActorId,undefined);assert.equal(list.items[0].expected,undefined);
 assert.equal((await rpc(scope,id(4))).sourceActorId,id(1));assert.equal((await rpc(scope,id(4))).refundSources[0].actorId,id(1));
 const first=await rpc(scope,null,{limit:1});assert.equal(first.hasMore,true);
 assert.deepEqual((await rpc(scope,null,{limit:1,cursor:first.cursor})).items.map(row=>row.orderId),[103]);
 assert.equal((await rpc(scope,null,{limit:1,cursor:first.cursor})).hasMore,false);
 assert.equal((await rpc(scope,null,{search:'%'})).items.length,0);assert.equal((await rpc(scope,null,{search:'103'})).items.length,1);
 for(const query of [{limit:51},{limit:1.5},{unknown:true},{cursor:{id:id(4)}}])await assert.rejects(()=>rpc(scope,null,query));
 for(const changed of [{actorId:id(9)},{connectionRevision:2},{shopId:2},{storeId:id(9)},{environment:'production'},{currency:'USD'}])
  await assert.rejects(()=>rpc({...scope,...changed}),/TPV_BILLING_(FORBIDDEN|CONTEXT_STALE)/);
 await assert.rejects(()=>rpc(scope,id(6)),/TPV_BILLING_SALE_NOT_FOUND/);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);await db.exec('set role authenticated');
 const ctx=(await db.query('select public.totus_tpv_billing_context() result')).rows[0].result;
 assert.equal(ctx.actorId,id(1));assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].storeName,'Laboratorio');
 await assert.rejects(()=>rpc(),/permission denied/);await assert.rejects(()=>db.query('select * from private.totus_tpv_operations'),/permission denied/);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(9)]);await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select public.totus_tpv_billing_context()'),/TPV_BILLING_FORBIDDEN/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select public.totus_tpv_billing_context()'),/permission denied/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from private.totus_tpv_operations')).rows[0].n,4);
 console.log('PASS billing SQL: unassigned accounting reader, explicit Facturación permission, scoped confirmed-only documents/refunds, stable pagination, literal search, stale scope and direct-table/RPC denial; no fiscal/revenue writes. Isolated PostgreSQL.');
}finally{await db.close();}
