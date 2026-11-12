import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const location=new URL('../supabase/functions/totus-connections/index.ts',import.meta.url);
let code=await readFile(location,'utf8');
code=code.replace(/import \{createClient\} from 'npm:[^']+';/,"const createClient=()=>{throw Error('Unexpected real client');};");
code=code.replace(/(from\s*|import\()(['"])(\.[^'"]+)\2/g,(_,before,quote,path)=>before+quote+new URL(path,location).href+quote);
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',input={id,call_id:id,revision:1,store:'hortimatic',kind:'clientes',resource:'customers',action:'prestashop_directory_read',page:0,page_size:20};
function fixture({denied=false,logged=true}={}){
 const calls=[],env={get:key=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server'}[key])};
 const factory=(_url,key,options)=>({auth:{getUser:async()=>({data:{user:logged?{id,email:'actor@example.invalid'}:null},error:null})},rpc:async(name,args)=>{calls.push({key,name,args});if(name==='totus_directory_context')return denied?{error:{message:'Sin permiso'}}:{data:{connections:[{id,revision:1}]}};if(name==='totus_api_server')return {data:{id,revision:1,verified_revision:1,name:'PrestaShop · Hortimatic',protocol:'prestashop',endpoint:'https://hortimatic.com/api',secret:'PRIVATE_KEY',enabled:true,real_data_authorized:true}};if(name==='totus_api_call')return {data:{}};throw Error('Unexpected RPC '+name);}});
 let requests=0;const request=async()=>{requests++;return Response.json({customers:[{id:'4',firstname:'Cliente',passwd:'HASH_PRIVATE',secure_key:'KEY_PRIVATE'}]});};
 const run=(body=input,auth=true)=>handle(new Request('https://example.invalid',{method:'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer test-session'}:{})},body:JSON.stringify(body)}),env,factory,request);
 return {calls,run,get requests(){return requests;}};
}
test('authenticated directory reads use their module context and never log customer fields or credentials',async()=>{
 const previous=globalThis.Deno;globalThis.Deno={resolveDns:async()=>['8.8.8.8']};
 try{const f=fixture(),response=await f.run(),body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.rows,[{id:'4',firstname:'Cliente'}]);assert.equal(f.requests,1);assert.deepEqual(f.calls.find(c=>c.name==='totus_directory_context').args,{p_kind:'clientes',p_action:'view'});const audit=JSON.stringify(f.calls.filter(c=>c.name==='totus_api_call'));for(const secret of ['Cliente','HASH_PRIVATE','KEY_PRIVATE','PRIVATE_KEY'])assert(!audit.includes(secret));}finally{globalThis.Deno=previous;}
});
test('permission failure and missing session stop before private connection lookup or provider access',async()=>{
 for(const options of [{denied:true},{logged:false}]){const f=fixture(options),response=await f.run();assert(response.status>=400);assert.equal(f.requests,0);assert(!f.calls.some(c=>c.name==='totus_api_server'));}
 const f=fixture();assert.equal((await f.run(input,false)).status,401);assert.equal(f.calls.length,0);
});
test('a directory cannot select foreign resources or arbitrary server module permissions',async()=>{
 for(const extra of [{module:'administracion'},{resource:'product_options'},{kind:'administracion'}]){const f=fixture(),response=await f.run({...input,...extra});assert.equal(response.status,400);assert.equal(f.calls.length,0);assert.equal(f.requests,0);}
});
