import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const file=new URL('../supabase/functions/totus-connections/index.ts',import.meta.url);
const source=readFileSync(file,'utf8')
 .replace(/import \{createClient\} from '[^']+';/,"const createClient=()=>{throw Error('Unexpected external client')};")
 .replace("'./github.js'",JSON.stringify(new URL('../supabase/functions/totus-connections/github.js',import.meta.url).href))
 .replace("'./prestashop.js'",JSON.stringify(new URL('../supabase/functions/totus-connections/prestashop.js',import.meta.url).href))
 .replace("'./transport.js'",JSON.stringify(new URL('../supabase/functions/totus-connections/transport.js',import.meta.url).href));
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const id='11111111-1111-4111-8111-111111111111',callId='22222222-2222-4222-8222-222222222222',owner='33333333-3333-4333-8333-333333333333';
const env={get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server-only'}[k])};
const connection={id,name:'PrestaShop · Hortimatic',protocol:'prestashop',revision:3,verified_revision:3,endpoint:'https://example.com/api',auth_kind:'basic',secret:'fictional-value',free_confirmed:true,real_data_authorized:true,enabled:true};
const args={action:'prestashop_read',store:'hortimatic',id,revision:3,call_id:callId,resource:'orders',page:0,page_size:25};
const req=(body,bearer=true)=>new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer verified-owner'}:{})},body:JSON.stringify(body)});
function fixture({roleDenied=false,config=connection}={}){
 const calls=[];
 const factory=(_url,key)=>({
  auth:{getUser:async()=>({data:{user:{id:owner,email:'admin@totuscentral.invalid'}}})},
  rpc:async(name,payload)=>{
   calls.push({name,payload,key});
   if(name==='totus_api_manager')return roleDenied?{error:{message:'Solo administración con permiso de Configuración'}}:{data:{connections:[{id,revision:3}]}};
   if(name==='totus_api_server')return {data:config};
   if(name==='totus_api_call')return {data:null};
   throw Error('Unexpected RPC '+name);
  }
 });
 return {calls,factory};
}
test('unauthenticated and invalid resource requests cannot reach credential storage',async()=>{
 const f=fixture();
 assert.equal((await handle(req(args,false),env,f.factory)).status,401);
 assert.equal((await handle(req({...args,resource:'sql'}),env,f.factory)).status,400);
 assert.equal((await handle(req({...args,extra:'SQL'}),env,f.factory)).status,400);
 assert.equal((await handle(req({...args,page:1001}),env,f.factory)).status,400);
 assert(!f.calls.some(c=>c.name==='totus_api_server'));
});
test('normal Configuración permission is required even for read-only PrestaShop',async()=>{
 const f=fixture({roleDenied:true});
 const r=await handle(req(args),env,f.factory);
 assert.equal(r.status,400);assert.match((await r.json()).error,/Solo administración/);
 assert(!f.calls.some(c=>c.name==='totus_api_server'));
});
test('server reads only the known shop resource and never returns credentials',async()=>{
 const f=fixture(),previous=globalThis.Deno;let requested=0;
 globalThis.Deno={resolveDns:async()=>['8.8.8.8']};
 try{
  const r=await handle(req(args),env,f.factory,async(url,options)=>{
   requested++;
   assert.equal(new URL(url).pathname,'/api/orders');
   assert.equal(options.method,'GET');
   assert.equal(options.headers.Authorization,'Basic '+btoa('fictional-value:'));
   return Response.json({orders:[{id:1,reference:'AB',date_add:'2026-11-03 10:00:00',payment:'Efectivo',total_paid_tax_incl:'18.99',customer_id:55}]});
  });
  assert.equal(r.status,200);const body=await r.json();
  assert.equal(body.store,'hortimatic');assert.equal(body.rows[0].reference,'AB');
  assert.equal(body.rows[0].customer_id,undefined);
  assert(!JSON.stringify(body).includes('fictional-value'));
  assert.equal(requested,1);
  assert.equal(f.calls.filter(c=>c.name==='totus_api_call').length,2);
 }finally{if(previous===undefined)delete globalThis.Deno;else globalThis.Deno=previous;}
});
test('a cross-shop request fails closed and still records a failed operation',async()=>{
 const f=fixture();let requested=0;const old=globalThis.Deno;
 try{
  globalThis.Deno={resolveDns:async()=>['8.8.8.8']};
  const r=await handle(req({...args,store:'newoldsmok'}),env,f.factory,async()=>{requested++;return Response.json({orders:[]});});
  assert.equal(r.status,400);assert.equal(requested,0);
  assert.match((await r.json()).error,/no corresponde/);
  assert(f.calls.some(c=>c.name==='totus_api_call'&&c.payload.p_result?.ok===false));
 }finally{if(old===undefined)delete globalThis.Deno;else globalThis.Deno=old;}
});
