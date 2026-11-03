import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const index=new URL('../supabase/functions/totus-connections/index.ts',import.meta.url);
const source=readFileSync(index,'utf8')
 .replace(/import \{createClient\} from '[^']+';/,"const createClient=()=>{throw Error('unexpected client')};")
 .replace("'./github.js'",JSON.stringify(new URL('../supabase/functions/totus-connections/github.js',import.meta.url).href))
 .replace("'./transport.js'",JSON.stringify(new URL('../supabase/functions/totus-connections/transport.js',import.meta.url).href))
 .replace("'./prestashop.js'",JSON.stringify(new URL('../supabase/functions/totus-connections/prestashop.js',import.meta.url).href))
 .replace("'../../../src/prestashop-core.js'",JSON.stringify(new URL('../src/prestashop-core.js',import.meta.url).href));
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const uid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222';
const env={get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'fixture-only-service'}[k])};
const req=(input,bearer=true)=>new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer fixture-jwt'}:{})},body:JSON.stringify(input)});
const validInput={action:'prestashop_read',id:uid,call_id:cid,revision:1,store:'hortimatic',resource:'stock_availables',offset:0,limit:2};
const profile={id:uid,name:'PrestaShop · Hortimatic',protocol:'prestashop',endpoint:'https://example.com/api',enabled:true,revision:1,verified_revision:1,free_confirmed:true,real_data_authorized:true,secret:'fixture-webservice-only',auth_kind:'basic'};
const fixture=({deny=false,enabled=true,contextProfiles=null}={})=>{
 const calls=[],listed=contextProfiles??[{id:uid,revision:1}],p={...profile,enabled};
 return {calls,factory:(_url,key,opts)=>({
  auth:{getUser:async()=>({data:{user:{id:uid,email:'manager@example.invalid'}}})},
  rpc:async(name,args)=>{calls.push({name,args:structuredClone(args||{}),key});
   if(name==='totus_api_manager')return deny?{error:{message:'Administración denegada'}}:{data:{connections:listed}};
   if(name==='totus_api_server')return {data:p};
   if(name==='totus_api_call')return {data:null};
   throw Error('Unexpected RPC '+name);
  }
 })};
};
test('anonymous, unauthorized and unknown profile never access credential or external API',async()=>{
 let count=0;const request=async()=>{count++;return Response.json({});};
 for(const [input,bearer,fixtureArgs] of [[validInput,false,{}],[validInput,true,{deny:true}],[{...validInput,id:cid},true,{}]]){
  const f=fixture(fixtureArgs),response=await handle(req(input,bearer),env,f.factory,request);assert.notEqual(response.status,200);
  assert.equal(f.calls.some(c=>c.name==='totus_api_server'),false);assert.equal(count,0);
 }
});
test('invalid input and disallowed SQL resource are rejected before lookup',async()=>{
 let count=0;
 for(const resource of ['psog_posp_cajas','orders','stock_movements/../../../admin']){
  const f=fixture(),response=await handle(req({...validInput,resource}),env,f.factory,async()=>{count++;return Response.json({});});
  assert.equal(response.status,400);assert.equal(f.calls.length,0);
 }
 assert.equal(count,0);
});
test('successful read is scoped to manager and accounted, with no credential in response',async()=>{
 const old=globalThis.Deno;globalThis.Deno={resolveDns:async()=>['8.8.8.8']};
 try{
  const f=fixture();let networkCalls=0;
  const response=await handle(req(validInput),env,f.factory,async(url,init)=>{
   networkCalls++;assert.equal(new URL(url).pathname,'/api/stock_availables');assert.equal(init.method,'GET');
   assert.equal(init.headers.Authorization,'Basic '+btoa(profile.secret+':'));return Response.json({stock_availables:[{id:1,id_product:2,id_product_attribute:0,quantity:5,internal:'hidden'}]});
  });
  assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.store,'hortimatic');assert.equal(body.rows[0].quantity,'5');assert.equal(body.writes,false);assert.equal(networkCalls,1);
  assert(!JSON.stringify(body).includes(profile.secret));assert(!JSON.stringify(body).includes('hidden'));
  assert.equal(f.calls.filter(x=>x.name==='totus_api_call').length,2);
  assert.equal(f.calls.filter(x=>x.name==='totus_api_call').at(-1).args.p_result.rows.length,1);
 }finally{if(old===undefined)delete globalThis.Deno;else globalThis.Deno=old;}
});
test('server refuses disabled profiles; does not talk to PrestaShop',async()=>{
 const f=fixture({enabled:false}),old=globalThis.Deno;globalThis.Deno={resolveDns:async()=>['8.8.8.8']};let requests=0;
 try{const response=await handle(req(validInput),env,f.factory,async()=>{requests++;return Response.json({});});assert.equal(response.status,400);assert.equal(requests,0);}
 finally{if(old===undefined)delete globalThis.Deno;else globalThis.Deno=old;}
});
