import assert from 'node:assert/strict';
import test from 'node:test';
import {assessTpvSetup,createTpvSetupReader} from '../src/totustpv/setup-reader.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){return {businesses:[{id:id(1),name:'Establecimiento A'}],websites:[
 {key:'web-a',name:'Web A',origin:'https://shop.example.invalid',status:'active',business_id:id(1),connection_id:id(2)}],
 connections:[{id:id(2),protocol:'prestashop',store_key:'web-a',website_origin:'https://shop.example.invalid',
 enabled:true,configured:true,real_data_authorized:true,revision:5,verified_revision:5,secret:'must-not-be-returned'}]};}
const drawers=[{id:id(3),store_id:id(1),name:'Caja B',active:true},{id:id(4),store_id:id(1),name:'Caja A',active:true},
 {id:id(5),store_id:id(9),name:'Caja ajena',active:true},{id:id(6),store_id:id(1),name:'Retirada',active:false}];
test('metadata is joined by IDs, active drawers are ordered, and successful diagnostics never enable checkout',()=>{
 const result=assessTpvSetup({...fixture(),checkoutEnabled:true},drawers);
 assert.equal(result.checkoutEnabled,false);assert.equal(result.websites[0].connectionVerified,true);
 assert.deepEqual(result.websites[0].drawers.map(row=>row.name),['Caja A','Caja B']);
 assert.deepEqual(result.websites[0].issues,[]);assert.equal(JSON.stringify(result).includes('must-not-be-returned'),false);
 assert(result.unchecked.includes('native-checkout'));
});
test('an unassigned website cannot borrow a same-name business or another drawer',()=>{
 const input=fixture();input.websites[0].business_id=null;input.websites[0].name='Establecimiento A';
 const row=assessTpvSetup(input,drawers).websites[0];
 assert.equal(row.storeId,null);assert.deepEqual(row.drawers,[]);assert.deepEqual(row.issues,['store-unassigned']);
});
test('stale, mismatched or unauthorized API metadata stays unverified',()=>{
 for(const patch of [{verified_revision:4},{store_key:'other'},{website_origin:'https://other.example.invalid'},
  {enabled:false},{real_data_authorized:false},{configured:false},{revision:'5'}]){
  const input=fixture();Object.assign(input.connections[0],patch);
  assert.equal(assessTpvSetup(input,drawers).websites[0].connectionVerified,false);
 }
 const input=fixture();input.websites[0].origin='https://user:password@shop.example.invalid';
 assert.equal(assessTpvSetup(input,drawers).websites[0].origin,null);
 assert.throws(()=>assessTpvSetup({...fixture(),websites:[...fixture().websites,...fixture().websites]},drawers),/AMBIGUOUS/);
});
test('reader uses only normal sales context and drawer reads; denied access performs no IO',async()=>{
 let calls=0;const actor={id:id(7),active:true};
 const reader=createTpvSetupReader({actor:()=>actor,can:()=>true,rpc:async(name,args)=>{
  assert.equal(name,'totus_sales_context');assert.deepEqual(args,{});calls++;return fixture();},readDrawers:async()=>{calls++;return drawers;}});
 assert.equal((await reader.read()).mode,'setup-read-only');assert.equal(calls,2);
 const denied=createTpvSetupReader({actor:()=>actor,can:()=>false,rpc:()=>{throw Error('Unexpected');},readDrawers:()=>{throw Error('Unexpected');}});
 await assert.rejects(denied.read(),/FORBIDDEN/);
});
test('late account, permission and superseded responses cannot populate the next workspace',async()=>{
 let actor={id:id(7),active:true},allowed=true,releases=[];
 const reader=createTpvSetupReader({actor:()=>actor,can:()=>allowed,
  rpc:()=>new Promise(resolve=>releases.push(()=>resolve(fixture()))),readDrawers:async()=>drawers});
 const first=reader.read();actor={id:id(8),active:true};releases.shift()();await assert.rejects(first,/SESSION_CHANGED/);
 const second=reader.read();allowed=false;releases.shift()();await assert.rejects(second,/SESSION_CHANGED/);
 allowed=true;const old=reader.read(),latest=reader.read();releases.shift()();await assert.rejects(old,/SESSION_CHANGED/);
 releases.shift()();assert.equal((await latest).checkoutEnabled,false);
});
