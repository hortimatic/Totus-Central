import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';
import {PARKING_DURATIONS,parkingOptions,parkingOptionsFromForm,parkingOptionsHtml,parkingExpiry} from '../src/totustpv/parking-options.js';
test('parking stays enabled indefinitely by default and accepts only explicit typed settings',()=>{
 assert.deepEqual(parkingOptions(),{enabled:true,ttlDays:0});assert.deepEqual(parkingOptions({}),{enabled:true,ttlDays:0});
 for(const ttlDays of Object.keys(PARKING_DURATIONS).map(Number))assert.deepEqual(parkingOptions({enabled:false,ttlDays}),{enabled:false,ttlDays});
 for(const value of [null,[],true,'true',{enabled:'false'},{enabled:0},{enabled:null},{ttlDays:'7'},{ttlDays:2},{ttlDays:1.5},{ttlDays:NaN},{ttlDays:-1},{ttlDays:366},{enabled:true,actorId:'other'}])assert.throws(()=>parkingOptions(value));
});
test('form choices preserve the selected lifetime even when parking is disabled',()=>{
 assert.deepEqual(parkingOptionsFromForm(new Map([['parkingEnabled','on'],['parkingTtlDays','7']])),{enabled:true,ttlDays:7});
 assert.deepEqual(parkingOptionsFromForm(new Map([['parkingTtlDays','30']])),{enabled:false,ttlDays:30});
 for(const ttl of [null,'','01','2','7.0','3650'])assert.throws(()=>parkingOptionsFromForm(new Map([['parkingTtlDays',ttl]])));
 assert.match(parkingOptionsHtml({enabled:true,ttlDays:15},false),/<fieldset[^>]+disabled/);assert.match(parkingOptionsHtml({ttlDays:15},true),/value="15" selected/);
});
test('expiry metadata comes from the server, never a browser date or truthy flag',()=>{
 assert.deepEqual(parkingExpiry({}),{expiresAt:null,expired:false});
 assert.deepEqual(parkingExpiry({expiresAt:'2026-11-18T15:22:04.123456+00:00',expired:true}),{expiresAt:'2026-11-18T15:22:04.123456+00:00',expired:true});
 assert.deepEqual(parkingExpiry({expiresAt:'2000-01-01T00:00:00Z',expired:false}).expired,false);
 for(const value of [null,[],{expiresAt:'not a date'},{expiresAt:'1'},{expiresAt:1},{expired:'true'},{expired:null},{expired:true},{expiresAt:null,expired:true}])assert.throws(()=>parkingExpiry(value));
});
test('Central adapter preserves expiry DTOs and normalizes legacy tickets without a local clock',async()=>{
 const station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true};
 let rows=[{id:'legacy',version:4,label:'Anterior'},{id:'timed',version:2,expiresAt:'2000-01-01T00:00:00Z',expired:false}];
 const adapter=createCentralTpvAdapter({actorId:'operator',invoke:async body=>body.action==='context'?{actorId:'operator',workstations:[station]}:rows,storage:{getItem:()=>null,setItem:()=>{}},uuid:()=>crypto.randomUUID()});
 await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});
 assert.deepEqual(await adapter.drafts(),[{...rows[0],expiresAt:null,expired:false},rows[1]]);
 rows=[{id:'malformed',expiresAt:'2000-01-01T00:00:00Z',expired:'true'}];await assert.rejects(adapter.drafts(),/validez/);
});
