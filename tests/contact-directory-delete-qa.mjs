import {test} from 'node:test';import assert from 'node:assert/strict';
import {writeContactDirectory} from '../supabase/functions/totus-connections/contact-directory-write.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connection={id,name:'PrestaShop · Hortimatic',protocol:'prestashop',endpoint:'https://hortimatic.com/api',secret:'fixture',revision:1,verified_revision:1,enabled:true,real_data_authorized:true};
const base={id,call_id:id,request_id:id,revision:1,kind:'marcas',store:'hortimatic',action:'prestashop_directory_prepare',resource:'manufacturers',operation:'delete',record_id:'12',fields:{}};
function fixture({related=false,group=false,used=false}={}){
 let removed=false,deletes=0,entry=null;
 const request=async(address,init)=>{const u=new URL(address);if(init.method==='DELETE'){deletes++;removed=true;return new Response('',{status:200});}if(/\/12$/.test(u.pathname))return removed?new Response('',{status:404}):new Response('<prestashop><'+(group?'product_option':'manufacturer')+'><id>12</id><name>QA</name></'+(group?'product_option':'manufacturer')+'></prestashop>',{headers:{'content-type':'application/xml'}});if(u.pathname.endsWith('/product_option_values'))return Response.json({product_option_values:[{id:'21'},{id:'22'}]});if(u.pathname.endsWith('/combinations'))return Response.json({combinations:[{id:'7',associations:{product_option_values:[{id:used?'21':'31'}]}}]});return Response.json({products:related?[{id:'4'}]:[]});};
 const journal={lookup:async()=>entry,claim:async()=>{entry={status:'pending'};return {status:'claimed'};},complete:async()=>entry={status:'completed',record_id:'12'},uncertain:async()=>entry={status:'uncertain',record_id:'12'}};
 return {request,journal,resolve:async()=>['8.8.8.8'],get deletes(){return deletes;}};
}
test('brand deletion checks products and verifies native absence; replay never repeats DELETE',async()=>{
 const f=fixture(),prepared=await writeContactDirectory(connection,base,f);assert(prepared.can_commit);assert.equal(f.deletes,0);const result=await writeContactDirectory(connection,{...base,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},f);assert(result.verified&&result.deleted);assert.equal(f.deletes,1);const replay=await writeContactDirectory(connection,base,f);assert(replay.replayed);assert.equal(f.deletes,1);
});
test('brands associated with products cannot be removed',async()=>{const f=fixture({related:true});await assert.rejects(writeContactDirectory(connection,base,f),/asociados/);assert.equal(f.deletes,0);});
test('an attribute group with unused values is deleted from one action; used values protect its products',async()=>{
 const q={...base,kind:'atributos',resource:'product_options'};
 const f=fixture({group:true}),prepared=await writeContactDirectory(connection,q,f);const result=await writeContactDirectory(connection,{...q,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},f);assert(result.deleted&&result.verified);assert.equal(f.deletes,1);
 const used=fixture({group:true,used:true});await assert.rejects(writeContactDirectory(connection,q,used),/se utiliza/);assert.equal(used.deletes,0);
});
