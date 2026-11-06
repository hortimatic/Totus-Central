import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const src=new URL('../supabase/functions/totus-connections/index.ts',import.meta.url);
let code=readFileSync(src,'utf8')
 .replace(/import \{createClient\} from '[^']+';/,"const createClient=()=>{throw Error('No external client expected')};");
for(const [relative,path] of [
 ["./github.js","../supabase/functions/totus-connections/github.js"],
 ["./prestashop.js","../supabase/functions/totus-connections/prestashop.js"],
 ["./transport.js","../supabase/functions/totus-connections/transport.js"],
 ["./prestashop-create.js","../supabase/functions/totus-connections/prestashop-create.js"],
 ["./prestashop-write.js","../supabase/functions/totus-connections/prestashop-write.js"],
 ["../../../src/prestashop-readonly.js","../src/prestashop-readonly.js"]
]){
 code=code.replaceAll("'"+relative+"'",JSON.stringify(new URL(path,import.meta.url).href));
}
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
const id='11111111-1111-4111-8111-111111111111',call_id='22222222-2222-4222-8222-222222222222',
 user_id='33333333-3333-4333-8333-333333333333';
const conf={id,name:'PrestaShop · Hortimatic',protocol:'prestashop',revision:2,verified_revision:2,enabled:true,
 real_data_authorized:true,endpoint:'https://hortimatic.com/api/',secret:'fake-key-not-real'};
const base={id,call_id,revision:2,store:'hortimatic'};
const blank='<prestashop><product><id><![CDATA[]]></id><id_category_default><![CDATA[]]></id_category_default><reference><![CDATA[]]></reference><price><![CDATA[]]></price><active><![CDATA[]]></active><name><language id="1"><![CDATA[]]></language></name><link_rewrite><language id="1"><![CDATA[]]></language></link_rewrite><associations><categories><category><id><![CDATA[]]></id></category></categories></associations></product></prestashop>';
const c='<prestashop><category><id><![CDATA[33]]></id></category></prestashop>',empty='<prestashop><products/></prestashop>',
 created='<prestashop><product><id><![CDATA[701]]></id></product></prestashop>',verified='<prestashop><product><id><![CDATA[701]]></id><reference><![CDATA[PRUEBAS-DEMO]]></reference><active><![CDATA[0]]></active></product></prestashop>';
const xml=s=>new Response(s,{status:200,headers:{'content-type':'application/xml'}});
const req=(body,token=true)=>new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',
 ...(token?{Authorization:'Bearer account-session-valid'}:{})},body:JSON.stringify(body)});
const environment=write=>({get:key=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',
 SUPABASE_SERVICE_ROLE_KEY:'server-only',TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED:write?'1':''})[key]});
const fixture=(opts={})=>{
 const calls=[],journal=new Map();
 const factory=(_url,key)=>({
  auth:{getUser:async()=>({data:{user:{id:user_id,email:'admin@example.invalid'}}})},
  rpc:async(name,payload)=>{
   calls.push({type:'rpc',name,key,payload});
   if(name==='totus_api_manager')return opts.denied?{error:{message:'Permiso de administración necesario'}}:{data:{connections:[{id,revision:2}]}};
   if(name==='totus_api_server')return {data:conf};
   if(name==='totus_api_call')return {data:null};
   if(name==='totus_prestashop_product_create_journal'){
    assert.equal(key,'server-only');
    assert.equal(payload.p_data.actor_id,user_id);
    assert.equal(payload.p_data.connection_id,id);
    const k=payload.p_request_id,a=payload.p_action;
    if(a==='lookup')return {data:journal.get(k)||null};
    if(a==='claim'){
     if(journal.has(k))return {data:{status:'pending'}};
     journal.set(k,{status:'pending',signature:payload.p_data.signature,store:'hortimatic',reference:'PRUEBAS-DEMO'});
     return {data:{status:'claimed'}};
    }
    if(a==='complete'){
     journal.set(k,{...journal.get(k),status:'completed',product_id:payload.p_data.product_id});
     return {data:{status:'completed',product_id:payload.p_data.product_id}};
    }
    if(a==='uncertain'){journal.set(k,{...journal.get(k),status:'uncertain'});return {data:{status:'uncertain'}};}
   }
   throw Error('Unexpected rpc '+name);
  }
 });
 const request=async(url,opts2)=>{
  const u=new URL(url),method=opts2.method;calls.push({type:'http',method,path:u.pathname,search:u.search,body:opts2.body});
  assert.equal(u.origin,'https://hortimatic.com');assert.ok(opts2.headers.Authorization.startsWith('Basic '));
  if(method==='POST')return xml(created);
  if(u.pathname==='/api/products/701')return xml(verified);
  if(u.pathname==='/api/categories/33')return xml(c);
  if(u.pathname==='/api/products'&&u.searchParams.get('schema')==='blank')return xml(blank);
  if(u.pathname==='/api/products'&&u.searchParams.has('filter[reference]'))return xml(empty);
  throw Error('Unknown '+method+' '+u.pathname+u.search);
 };
 return {calls,journal,factory,request};
};
const context=async(run)=>{
 const original=globalThis.Deno;
 globalThis.Deno={resolveDns:async()=>['8.8.8.8']};
 try{return await run();}finally{if(original===undefined)delete globalThis.Deno;else globalThis.Deno=original;}
};
test('perfil sin login y sesión sin permiso no leen credenciales ni salen a PrestaShop',()=>context(async()=>{
 const f=fixture({denied:true}),body={...base,action:'prestashop_product_create_profile'};
 let res=await handle(req(body,false),environment(),f.factory,f.request);
 assert.equal(res.status,401);
 res=await handle(req(body),environment(),f.factory,f.request);
 assert.equal(res.status,400);assert.match((await res.json()).error,/Permiso de administración/);
 assert.equal(f.calls.filter(x=>x.type==='http').length,0);
 assert.equal(f.calls.some(x=>x.name==='totus_api_server'),false);
}));
test('perfil y prevalidación requieren administración y únicamente llaman GET',()=>context(async()=>{
 const f=fixture();
 let res=await handle(req({...base,action:'prestashop_product_create_profile'}),environment(),f.factory,f.request);
 assert.equal(res.status,200);assert.deepEqual((await res.json()).language_ids,['1']);
 const values={...base,action:'prestashop_product_create_prepare',reference:'PRUEBAS-DEMO',price:'0.00',category_id:'33',
  translations:[{language_id:'1',name:'Pruebas',link_rewrite:'pruebas'}]};
 res=await handle(req(values),environment(),f.factory,f.request);
 assert.equal(res.status,200);
 const result=await res.json();assert.equal(result.persisted,false);assert.match(result.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(f.calls.filter(x=>x.type==='http').every(x=>x.method==='GET'),true);
 assert.equal(f.calls.filter(x=>x.name==='totus_prestashop_product_create_journal').length,0);
 assert.equal(JSON.stringify(f.calls).includes('fake-key-not-real'),false);
}));
test('confirmación sin habilitación rechaza antes de POST y journal',()=>context(async()=>{
 const f=fixture(),body={...base,action:'prestashop_product_create_commit',reference:'PRUEBAS-DEMO',price:'0.00',category_id:'33',
  translations:[{language_id:'1',name:'Pruebas',link_rewrite:'pruebas'}],
  expected_fingerprint:'a'.repeat(64),request_id:'44444444-4444-4444-8444-444444444444',confirmed:true};
 const res=await handle(req(body),environment(),f.factory,f.request);
 assert.equal(res.status,400);assert.match((await res.json()).error,/Alta bloqueada/);
 assert.equal(f.calls.filter(x=>x.type==='http').length,0);
 assert.equal(f.calls.filter(x=>x.name==='totus_prestashop_product_create_journal').length,0);
}));
test('alta verificada por ruta completa utiliza diario idempotente y jamás llama al navegador con claves',()=>context(async()=>{
 const f=fixture(),values={...base,action:'prestashop_product_create_prepare',reference:'PRUEBAS-DEMO',price:'0.00',category_id:'33',
  translations:[{language_id:'1',name:'Pruebas',link_rewrite:'pruebas'}]};
 const prepared=await handle(req(values),environment(true),f.factory,f.request);
 assert.equal(prepared.status,200);
 const pre=await prepared.json();
 const request_id='44444444-4444-4444-8444-444444444444';
 const res=await handle(req({...values,action:'prestashop_product_create_commit',request_id,confirmed:true,expected_fingerprint:pre.fingerprint}),
  environment(true),f.factory,f.request);
 assert.equal(res.status,200);
 const result=await res.json();assert.equal(result.record_id,'701');assert.equal(result.verified,true);assert.equal(result.active,false);
 assert.equal(f.calls.filter(x=>x.type==='http'&&x.method==='POST').length,1);
 assert.deepEqual(f.calls.filter(x=>x.name==='totus_prestashop_product_create_journal').map(x=>x.payload.p_action),['lookup','claim','complete']);
 assert(!JSON.stringify(result).includes('fake-key-not-real'));
}));
