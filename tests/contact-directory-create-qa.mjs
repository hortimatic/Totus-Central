import {test} from 'node:test';import assert from 'node:assert/strict';
import {writeContactDirectory} from '../supabase/functions/totus-connections/contact-directory-write.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',c={id,name:'PrestaShop · Hortimatic',protocol:'prestashop',endpoint:'https://hortimatic.com/api',secret:'fixture',revision:1,verified_revision:1,enabled:true,real_data_authorized:true};
const base={id,call_id:id,request_id:id,revision:1,kind:'clientes',store:'hortimatic',action:'prestashop_directory_prepare',resource:'customers',operation:'create',fields:{firstname:'Prueba',lastname:'Cliente',email:'qa@example.invalid'}};
function fixture({fail=false,existing=false}={}){
 let row=existing?{id:'9',email:'qa@example.invalid'}:null,xml='',posts=0,entry=null;
 const request=async(address,init)=>{const u=new URL(address);if(init.method==='POST'){posts++;assert(init.body.includes('<passwd>'));assert(!init.body.includes('PRIVATE_KEY'));xml=init.body.replace('<id></id>','<id>42</id>');row={id:'42',email:'qa@example.invalid'};return new Response(fail?'':xml,{status:fail?500:201,headers:{'content-type':'application/xml'}});}if(u.pathname.endsWith('/42'))return new Response(xml,{headers:{'content-type':'application/xml'}});return Response.json({customers:row?[row]:[]});};
 const journal={lookup:async()=>entry,claim:async(_signature,_recordId,data)=>{entry={status:'pending',baseline_ids:data.baseline_ids};return {status:'claimed'};},complete:async(_s,recordId)=>{entry={...entry,status:'completed',record_id:recordId};},uncertain:async(_s,recordId)=>{entry={...entry,status:'uncertain',record_id:recordId};}};
 return {request,journal,resolve:async()=>['8.8.8.8'],get posts(){return posts;}};
}
test('native customer creation generates a server password, verifies the record and replays without another POST',async()=>{
 const f=fixture(),prepared=await writeContactDirectory(c,base,f);assert(prepared.can_commit);assert.equal(f.posts,0);
 const result=await writeContactDirectory(c,{...base,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},f);assert.equal(result.record_id,'42');assert(result.verified);assert.equal(f.posts,1);assert(!JSON.stringify(result).includes('passwd'));
 const replay=await writeContactDirectory(c,base,f);assert(replay.replayed);assert.equal(f.posts,1);
});
test('native HTTP 500 after customer insert is reconciled without repeating creation',async()=>{
 const f=fixture({fail:true}),prepared=await writeContactDirectory(c,base,f);const result=await writeContactDirectory(c,{...base,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},f);assert(result.verified&&result.reconciled);assert.equal(f.posts,1);
});
test('an existing customer email cannot be used to create another customer',async()=>{
 const f=fixture({existing:true});await assert.rejects(writeContactDirectory(c,base,f),/Ya existe/);assert.equal(f.posts,0);
});
