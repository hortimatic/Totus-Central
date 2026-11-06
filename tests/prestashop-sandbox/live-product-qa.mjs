import assert from 'node:assert/strict';
import test from 'node:test';
import {readPrestashopProductCreateProfile,runPrestashopProductCreate} from '../../supabase/functions/totus-connections/prestashop-create.js';
import {inspectNewProduct} from '../../src/productos-write-contract.js';

const key='TOTUSPRESTASHOPQA123456789012345';
const localBase='http://localhost:8000';
const connection={
 protocol:'prestashop',name:'PrestaShop · Hortimatic',endpoint:'https://hortimatic.com/api/',
 enabled:true,real_data_authorized:true,verified_revision:2,revision:2,secret:key
};
const resolve=async()=>['8.8.8.8'];
const calls=[];
async function localOnlyRequest(url,opts={}){
 const remote=new URL(url);
 assert.equal(remote.origin,'https://hortimatic.com','No test request may target any other origin.');
 assert(remote.pathname.startsWith('/api/'));
 const local=new URL(remote.pathname+remote.search,localBase);
 const headers=new Headers(opts.headers);
 assert.equal(headers.get('authorization'),'Basic '+btoa(key+':'));
 calls.push({method:opts.method||'GET',path:local.pathname});
 const response=await fetch(local,{...opts,redirect:'manual',headers});
 if(!response.ok){const body=await response.clone().text();console.error('CI isolated webservice HTTP',response.status,local.pathname+local.search,'body=',body.slice(0,1600));}
 return response;
}
const environment={get:name=>name==='TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED'?'1':undefined};
const journalData=new Map();
const journal={
 lookup:async key=>journalData.get(key)||null,
 claim:async record=>{
  if(journalData.has(record.request_id)||[...journalData.values()].some(row=>row.store===record.store&&row.reference===record.reference))return {status:'duplicate_reference'};
  journalData.set(record.request_id,{...record,status:'pending'});return {status:'claimed'};
 },
 complete:async ({request_id,product_id})=>{
  const row=journalData.get(request_id);assert.equal(row?.status,'pending');Object.assign(row,{status:'completed',product_id});
 },
 uncertain:async ({request_id,product_id})=>{
  const row=journalData.get(request_id);assert.equal(row?.status,'pending');Object.assign(row,{status:'uncertain',product_id});
 }
};
test('PrestaShop Flashlight 1.7.8.11: create inactive product, verify ID and no duplicate on replay',async()=>{
 const root=await localOnlyRequest('https://hortimatic.com/api/',{
  method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/xml'}
 });
 assert.equal(root.status,200,'PrestaShop Webservice GET must accept our fictional CI key; redirect='+String(root.headers.get('location')||'none'));
 await root.body?.cancel();
 const profile=await readPrestashopProductCreateProfile(connection,{store:'hortimatic'},
  {request:localOnlyRequest,resolve});
 assert.equal(profile.persisted,false);assert(profile.language_ids.length>0);
 const record={action:'prestashop_product_create_prepare',
   id:'11111111-1111-4111-8111-111111111111',
   call_id:'22222222-2222-4222-8222-222222222222',
   revision:2,store:'hortimatic',
   reference:'TOTUS-CI-PRUEBAS',
   price:'1.00',category_id:'2',
   translations:profile.language_ids.map(id=>({language_id:id,name:'Pruebas CI',link_rewrite:'pruebas-ci'}))
 };
 const preflight=await runPrestashopProductCreate(connection,record,{request:localOnlyRequest,resolve,env:environment});
 assert.equal(preflight.persisted,false);
 assert.match(preflight.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(calls.some(x=>x.method==='POST'),false,'Preflight must not write.');
 const request_id='33333333-3333-4333-8333-333333333333';
 const commit={...record,action:'prestashop_product_create_commit',request_id,
  confirmed:true,expected_fingerprint:preflight.fingerprint};
 const result=await runPrestashopProductCreate(connection,commit,
  {request:localOnlyRequest,resolve,env:environment,journal});
 assert.equal(result.persisted,true);
 assert.equal(result.active,false);
 assert.equal(result.verified,true);
 assert.match(result.record_id,/^[1-9]\d+$/);
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
 const repeat=await runPrestashopProductCreate(connection,commit,
  {request:localOnlyRequest,resolve,env:environment,journal});
 assert.equal(repeat.reused,true);
 assert.equal(repeat.record_id,result.record_id);
 assert.equal(calls.filter(x=>x.method==='POST').length,1,'Replay must never send a second POST.');
 const readBack=await localOnlyRequest('https://hortimatic.com/api/products/'+result.record_id,
  {method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/xml'}});
 assert.equal(readBack.status,200);
 const verified=inspectNewProduct(await readBack.text(),result.record_id,record.reference);
 assert.equal(verified.active,false);
 console.log('SANDBOX 1.7.8.11: ID '+result.record_id+' inactivo, 1 POST, relectura y reintento idempotente.');
});
