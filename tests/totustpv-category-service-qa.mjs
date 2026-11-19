import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogueIntakeService} from '../src/totustpv/server/catalogue-intake-service.js';
const id='00000000-0000-4000-8000-000000000001',token='00000000-0000-4000-8000-000000000002';
function fixture(){let row=null,native=null,posts=0,lostNative=false,lostAck=false;
 const rpc=async(name,{p_action:a,p_data:d})=>{assert.equal(name,'totus_tpv_catalogue_intake');
  if(a==='get'&&!row)return {error:{message:'TPV_CATALOGUE_INTENT_NOT_FOUND'}};
  if(a==='list')return {data:row?[{id,name:row.payload.name,status:row.status}]:[]};
  if(a==='create')row={...d,id,status:'ready',recordId:null,version:1};
  if(a==='start'){if(row.status==='processing')return {data:{...structuredClone(row),busy:true}};
   if(!['completed','cancelled'].includes(row.status))Object.assign(row,{status:'processing',leaseToken:d.token});}
  if(a==='verified'){if(lostAck){lostAck=false;return {error:{message:'TPV_STORAGE_UNAVAILABLE'}};}
   Object.assign(row,{status:'completed',recordId:d.recordId,leaseToken:null});}
  if(a==='failed')Object.assign(row,{status:'attention',leaseToken:null,errorCode:d.code});
  if(a==='cancel')row.status='cancelled';return {data:structuredClone(row)};};
 const products={categoryClaimed:async()=>native,prepareCategory:async()=>({ok:true,can_commit:true,fingerprint:'a'.repeat(64)}),
  commitCategory:async()=>{if(!native){posts++;native={ok:true,verified:true,persisted:true,record_id:'42'};}
   if(lostNative){lostNative=false;throw Error('lost native reply');}return native;}};
 return {service:createCatalogueIntakeService({rpc,products,scope:{},randomId:()=>token}),get posts(){return posts;},get row(){return row;},
  loseNative:()=>lostNative=true,loseAck:()=>lostAck=true,expire:()=>Object.assign(row,{status:'attention',leaseToken:null})};
}
const payload={name:'Nueva familia',parentId:'2'};
test('category review is immutable and browser projection excludes native command and lease',async()=>{
 const f=fixture(),review=await f.service.prepare(id,payload);assert.equal(f.posts,0);assert.equal(review.name,payload.name);
 for(const key of ['payload','payloadHash','fingerprint','leaseToken'])assert.equal(Object.hasOwn(review,key),false);
 assert.deepEqual(await f.service.prepare(id,payload),review);
 await assert.rejects(f.service.prepare(id,{...payload,name:'Otro nombre'}),/INTENT_BOUND/);
 await assert.rejects(f.service.prepare(id,{...payload,shopId:5}),/FIELDS_REJECTED/);
});
test('lost native response is checked through the same category claim without another creation',async()=>{
 const f=fixture();await f.service.prepare(id,payload);f.loseNative();assert.equal((await f.service.advance(id)).status,'attention');
 await assert.rejects(f.service.cancel(id),/REVIEW_REQUIRED/);
 assert.equal((await f.service.advance(id)).recordId,'42');assert.equal(f.posts,1);
 assert.equal((await f.service.advance(id)).status,'completed');assert.equal(f.posts,1);
});
test('lost coordinator acknowledgement retains lease and recovers after expiry',async()=>{
 const f=fixture();await f.service.prepare(id,payload);f.loseAck();await assert.rejects(f.service.advance(id),/STORAGE_UNAVAILABLE/);
 assert.equal((await f.service.advance(id)).busy,true);assert.equal(f.posts,1);f.expire();
 assert.equal((await f.service.advance(id)).status,'completed');assert.equal(f.posts,1);
});
test('uncommitted category can be cancelled without native effect',async()=>{
 const f=fixture();await f.service.prepare(id,payload);assert.equal((await f.service.cancel(id)).status,'cancelled');assert.equal(f.posts,0);
});
