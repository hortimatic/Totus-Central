import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeContactDirectory} from '../supabase/functions/totus-connections/contact-directory-write.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const c={id,name:'PrestaShop · Hortimatic',protocol:'prestashop',endpoint:'https://hortimatic.com/api',secret:'fixture',enabled:true,real_data_authorized:true,revision:1,verified_revision:1};
const q={action:'prestashop_directory_prepare',kind:'clientes',store:'hortimatic',id,call_id:id,revision:1,request_id:id,resource:'customers',operation:'update',record_id:'4',fields:{firstname:'Después'}};
const resolve=async()=>['8.8.8.8'];
function fixture({fail=false,mismatch=false}={}){
 let state='<prestashop><customer><id>4</id><firstname>Antes</firstname><lastname>Apellido</lastname><passwd>HASH_INTACTO</passwd><active>1</active></customer></prestashop>',writes=0,entry=null;
 const schema='<prestashop><customer><id/><firstname/><lastname/><passwd/><active/><secure_key readOnly="true"/></customer></prestashop>';
 const request=async(url,init)=>{const u=new URL(url);if(u.searchParams.has('schema'))return new Response(schema,{headers:{'content-type':'application/xml'}});if(init.method==='PUT'){writes++;assert(init.body.includes('HASH_INTACTO'));assert(!init.body.includes('secure_key'));if(!mismatch)state=init.body;return new Response('',{status:fail?500:200});}return new Response(state,{headers:{'content-type':'application/xml'}});};
 const journal={lookup:async()=>entry,claim:async()=>{if(entry)return entry;entry={status:'pending'};return {status:'claimed'};},complete:async()=>{entry={status:'completed'};},uncertain:async()=>{entry={status:'uncertain'};}};
 return {request,journal,get writes(){return writes;},get entry(){return entry;},setState(v){state=v;}};
}
test('native customer update publishes once, rereads and preserves password',async()=>{
 const f=fixture(),prepared=await writeContactDirectory(c,q,{...f,resolve});assert(prepared.can_commit);assert(!JSON.stringify(prepared).includes('HASH_INTACTO'));assert.equal(f.writes,0);
 const input={...q,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint};
 const result=await writeContactDirectory(c,input,{request:f.request,journal:f.journal,resolve});assert(result.persisted&&result.verified);assert.equal(f.writes,1);
 const replay=await writeContactDirectory(c,input,{request:f.request,journal:f.journal,resolve});assert(replay.replayed);assert.equal(f.writes,1);
});
test('HTTP 500 after native save is reconciled by exact reread, without retrying PUT',async()=>{
 const f=fixture({fail:true}),prepared=await writeContactDirectory(c,q,{request:f.request,resolve});const result=await writeContactDirectory(c,{...q,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},{request:f.request,journal:f.journal,resolve});assert(result.reconciled&&result.verified);assert.equal(f.writes,1);
});
test('mismatched reread records uncertainty and never returns a successful publication',async()=>{
 const f=fixture({mismatch:true}),prepared=await writeContactDirectory(c,q,{request:f.request,resolve});await assert.rejects(writeContactDirectory(c,{...q,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},{request:f.request,journal:f.journal,resolve}));assert.equal(f.entry.status,'uncertain');assert.equal(f.writes,1);
});
test('wrong store, changed record and missing journal reject before any PUT',async()=>{
 const f=fixture(),prepared=await writeContactDirectory(c,q,{request:f.request,resolve});const input={...q,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint};
 await assert.rejects(writeContactDirectory({...c,name:'PrestaShop · NewOldSmok'},input,{request:f.request,journal:f.journal,resolve}));
 await assert.rejects(writeContactDirectory(c,input,{request:f.request,resolve}));
 f.setState('<prestashop><customer><id>4</id><firstname>Otra edición</firstname><lastname>Apellido</lastname><passwd>HASH_INTACTO</passwd><active>1</active></customer></prestashop>');
 await assert.rejects(writeContactDirectory(c,input,{request:f.request,journal:f.journal,resolve}));assert.equal(f.writes,0);
});

test('native 1.7.8 synopsis failure uses its official preservation contract only with verified version',async()=>{
 const f=fixture();const request=async(url,init)=>new URL(url).searchParams.has('schema')?new Response('',{status:500,headers:{'psws-version':'1.7.8.11'}}):f.request(url,init);
 const prepared=await writeContactDirectory(c,q,{request,resolve});assert(prepared.can_commit);const result=await writeContactDirectory(c,{...q,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},{request,journal:f.journal,resolve});assert(result.verified);assert.equal(f.writes,1);
 const unknown=async(url,init)=>new URL(url).searchParams.has('schema')?new Response('',{status:500,headers:{'psws-version':'8.2.8'}}):f.request(url,init);await assert.rejects(writeContactDirectory(c,q,{request:unknown,resolve}),/versión/);
});
