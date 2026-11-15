import {validateProductStage} from '../src/productos-stages-contract.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogOfferFields,createCatalogOfferBatch} from '../src/catalog-offer-batch.js';
const rows=[{__store:'hortimatic',id:'42',name:'Familia A'},{__store:'newoldsmok',id:'43',name:'Familia B'}];
test('offers preserve base price and accept Spanish percentage with native shop dates',()=>{
 const fields=catalogOfferFields({percent:'12,5',from:'2026-11-16T09:00',to:'2026-11-30T20:30',quantity:'2'});
 assert.equal(fields.reduction,'0.125000');assert.equal(fields.price,'-1');assert.equal(fields.from_quantity,'2');assert.equal(fields.id_product_attribute,'0');assert.equal(fields.from,'2026-11-16 09:00:00');
 for(const percent of ['','abc','-1','0','100.1','2,','Infinity'])assert.throws(()=>catalogOfferFields({percent}));
 assert.throws(()=>catalogOfferFields({percent:'10',from:'2026-02-30T09:00'}));assert.throws(()=>catalogOfferFields({percent:'10',from:'2026-11-30T09:00',to:'2026-11-16T09:00'}));assert.throws(()=>catalogOfferFields({percent:'10',quantity:'1.5'}));
});
function harness(){
 const state={calls:[],snapshots:[],offers:[],fail:false,live:true,permission:true,saved:new Map(),storageFails:false};let controller;
 const invoke=async(shop,action,args)=>{
  if(action.includes('_step_'))validateProductStage({...args,action,store:shop,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',call_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',revision:1});
  state.calls.push({shop,action,...structuredClone(args)});
  if(action==='prestashop_read')return {resource:'specific_prices',rows:state.offers.filter(r=>String(r.id_product)===args.product_ids[0]),possibly_more:false};
  if(action.endsWith('_prepare'))return {persisted:false,can_commit:true,fingerprint:'a'.repeat(64)};
  const key=shop+'|'+args.parent_request_id+'|'+args.step_key;
  if(!state.saved.has(key))state.saved.set(key,{persisted:true,verified:true,record_id:String(100+state.saved.size)});
  if(state.fail){state.fail=false;throw Error('Respuesta perdida');}return state.saved.get(key);
 };
 const create=()=>createCatalogOfferBatch({invoke,canEdit:()=>state.permission,current:()=>state.live,persist:async()=>{if(state.storageFails)throw Error('Almacenamiento no disponible');state.snapshots.push(controller.snapshot());}});
 controller=create();return {state,get controller(){return controller;},recover(){const snapshot=state.snapshots.at(-1);controller=create();controller.restore(snapshot);return controller;}};
}
test('review does not write; publication uses the existing native contract for each shop',async()=>{
 const h=harness();await h.controller.prepare(rows,{percent:'20'});assert.equal(h.state.saved.size,0);await h.controller.publish();assert.equal(h.state.saved.size,2);
 const commits=h.state.calls.filter(c=>c.action.endsWith('_commit'));assert(commits.every(c=>c.kind==='special_price'&&c.existing_product&&c.confirmed&&c.fields.price==='-1'));assert.deepEqual(commits.map(c=>c.shop),['hortimatic','newoldsmok']);assert(h.controller.snapshot().every(i=>i.done));
});
test('lost response stops the batch; reopening reuses exact parent and step without duplicate offers',async()=>{
 const h=harness();await h.controller.prepare(rows,{percent:'10'});h.state.fail=true;await assert.rejects(h.controller.publish(),/Respuesta perdida/);assert.equal(h.state.saved.size,1);assert(h.controller.pending());
 const original=h.state.calls.find(c=>c.action.endsWith('_commit'));await h.recover().publish();assert.equal(h.state.saved.size,2);
 const replay=h.state.calls.filter(c=>c.action.endsWith('_commit'))[1];assert.equal(replay.parent_request_id,original.parent_request_id);assert.equal(replay.step_key,original.step_key);assert.equal(replay.expected_fingerprint,original.expected_fingerprint);
});
test('overlapping existing or newly introduced offers are not overwritten',async()=>{
 const h=harness();h.state.offers=[{id:'2',id_product:'42',from:'0000-00-00 00:00:00',to:'0000-00-00 00:00:00'}];await assert.rejects(h.controller.prepare(rows,{percent:'10'}),/ya tiene una oferta/);assert.equal(h.state.saved.size,0);
 h.state.offers=[];await h.controller.prepare(rows,{percent:'10'});h.state.offers=[{id:'3',id_product:'43',from:'0000-00-00 00:00:00',to:'0000-00-00 00:00:00'}];await assert.rejects(h.controller.publish(),/han cambiado/);assert.equal(h.state.saved.size,1);assert(h.controller.snapshot()[0].done);assert(!h.controller.snapshot()[1].attempted);
});
test('permission loss and unavailable durable storage prevent writes',async()=>{
 const h=harness();await h.controller.prepare(rows,{percent:'10'});h.state.permission=false;await assert.rejects(h.controller.publish(),/permisos/);assert.equal(h.state.saved.size,0);h.state.permission=true;h.state.storageFails=true;await assert.rejects(h.controller.publish(),/Almacenamiento/);assert.equal(h.state.saved.size,0);
});
test('changing session cancels an old in-flight read before it can prepare or publish',async()=>{
 let unblock;const wait=new Promise(resolve=>unblock=resolve),calls=[];const controller=createCatalogOfferBatch({current:()=>true,canEdit:()=>true,persist:async()=>{},invoke:async(...args)=>{calls.push(args);await wait;return {resource:'specific_prices',rows:[],possibly_more:false};}});
 const pending=controller.prepare(rows,{percent:'10'});controller.reset();unblock();await assert.rejects(pending,/permisos/);assert.equal(calls.length,1);assert.deepEqual(controller.snapshot(),[]);
});
