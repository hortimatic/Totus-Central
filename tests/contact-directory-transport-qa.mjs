import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readContactDirectory} from '../supabase/functions/totus-connections/contact-directory.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const connection={id,name:'PrestaShop · Hortimatic',protocol:'prestashop',endpoint:'https://hortimatic.com/api',secret:'fixture',revision:2,verified_revision:2,enabled:true,real_data_authorized:true};
const input={id,call_id:id,revision:2,store:'hortimatic',kind:'clientes',resource:'customers',action:'prestashop_directory_read',page:1,page_size:20};
const resolve=async()=>['8.8.8.8'];
test('directory uses native bounded filters and strips authentication data',async()=>{
 let target;
 const out=await readContactDirectory(connection,input,{resolve,request:async(url,init)=>{target=new URL(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');return Response.json({customers:[{id:'3',firstname:'Prueba',passwd:'never',secure_key:'never'}]});}});
 assert.equal(target.searchParams.get('limit'),'20,20');assert(!target.searchParams.get('display').includes('passwd'));assert.deepEqual(out.rows,[{id:'3',firstname:'Prueba'}]);assert.equal(out.possibly_more,false);
});
test('directory rejects wrong shop/revision, foreign records, HTML and HTTP failures',async()=>{
 let called=false;const request=async()=>{called=true;return Response.json([]);};
 await assert.rejects(readContactDirectory({...connection,name:'PrestaShop · NewOldSmok'},input,{resolve,request}));
 await assert.rejects(readContactDirectory({...connection,revision:3},input,{resolve,request}));assert.equal(called,false);
 for(const response of [new Response('login',{headers:{'content-type':'text/html'}}),new Response('',{status:403}),Response.json({customers:[{id:'4'}]})])await assert.rejects(readContactDirectory(connection,{...input,record_id:'3'},{resolve,request:async()=>response}));
});
test('address results must belong to the requested customer',async()=>{
 await assert.rejects(readContactDirectory(connection,{...input,resource:'addresses',customer_ids:['3']},{resolve,request:async()=>Response.json({addresses:[{id:'4',id_customer:'9'}]})}));
});
