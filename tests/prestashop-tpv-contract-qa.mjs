import test from 'node:test';
import assert from 'node:assert/strict';
import {tpvReadRequest,validateTpvBatch,tpvCapabilityStatus} from '../src/prestashop-tpv-contract.js';

const drawer={store:'hortimatic',totus_drawer_id:'11111111-1111-4111-8111-111111111111',
 tpv_drawer_id:'17',confirmed:true,evidence_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
const request={store:'hortimatic',feed:'cash_movements',from:'2026-10-25',to:'2026-11-03',
 drawer,page:0,page_size:25};
const movement={store:'hortimatic',source_id:'201',source_drawer_id:'17',
 occurred_at:'2026-10-25T02:30:00+01:00',kind:'withdrawal',direction:'out',
 payment_method:'cash',currency:'EUR',amount_cents:3000};
const payload=rows=>({store:request.store,feed:request.feed,page:0,rows});

test('known store, verified drawer, calendar range and page limits',()=>{
 assert.equal(tpvReadRequest(request).drawer.tpv_drawer_id,'17');
 assert.throws(()=>tpvReadRequest({...request,drawer:{...drawer,confirmed:false}}));
 assert.throws(()=>tpvReadRequest({...request,from:'2026-02-30'}));
 assert.throws(()=>tpvReadRequest({...request,to:'2026-12-12'}));
 assert.throws(()=>tpvReadRequest({...request,page_size:101}));
 assert.throws(()=>tpvReadRequest({...request,unexpected:'field'}));
});
test('valid withdrawal is isolated, denominated in integer cents and never persisted',()=>{
 const r=validateTpvBatch(request,payload([movement]));
 assert.equal(r.rows[0].source_key,'hortimatic:cash_movements:17:201');
 assert.equal(r.rows[0].amount_cents,3000);
 assert.equal(r.rows[0].kind,'withdrawal');
 assert.equal(r.persisted,false);
 assert.equal(r.totus_accounting_modified,false);
});
test('rejects another store, another drawer, ambiguous timestamps, invalid amounts or classification',()=>{
 for(const change of [
  {store:'newoldsmok'},{source_drawer_id:'3'},{occurred_at:'2026-10-25 02:30:00'},
  {amount_cents:-1},{amount_cents:'30.00'},{kind:'other'},{payment_method:'card'},
  {direction:'in'},{currency:'USD'}
 ])assert.throws(()=>validateTpvBatch(request,payload([{...movement,...change}])));
});
test('same-origin records are rejected within and across batches',()=>{
 const first=validateTpvBatch(request,payload([movement]));
 assert.throws(()=>validateTpvBatch(request,payload([movement,movement])));
 assert.throws(()=>validateTpvBatch(request,payload([movement]),first.source_keys));
});
test('a card transaction cannot be treated as cash withdrawal',()=>{
 const card={...movement,kind:'sale_card',direction:'non_cash',payment_method:'card'};
 const r=validateTpvBatch(request,payload([card]));
 assert.equal(r.rows[0].direction,'non_cash');
 assert.throws(()=>validateTpvBatch(request,payload([{...card,direction:'out'}])));
});
test('closing time must be explicit and completed, even on Madrid DST change',()=>{
 const q={...request,feed:'closings'};
 const close={store:'hortimatic',source_id:'91',source_drawer_id:'17',status:'closed',
  opened_at:'2026-10-25T01:55:00+02:00',closed_at:'2026-10-25T02:25:00+01:00',
  opening_cash_cents:10000,expected_cash_cents:17000,counted_cash_cents:16900};
 assert.equal(validateTpvBatch(q,{store:q.store,feed:q.feed,page:0,rows:[close]}).rows[0].counted_cash_cents,16900);
 assert.throws(()=>validateTpvBatch(q,{store:q.store,feed:q.feed,page:0,rows:[{...close,status:'open'}]}));
});
test('TPV access is blocked until module, schema, drawer and server adapter are verified',()=>{
 assert.equal(tpvCapabilityStatus({}).status,'blocked');
 assert.equal(tpvCapabilityStatus({module_verified:true,schema_verified:true,drawer_map_verified:true}).status,'blocked');
 assert.equal(tpvCapabilityStatus({module_verified:true,schema_verified:true,drawer_map_verified:true,server_adapter_verified:true}).status,'ready_for_authorized_test');
});
