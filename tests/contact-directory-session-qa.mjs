import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDirectorySession} from '../src/contact-directory-session.js';
import {concurrentRead} from '../src/concurrent-read.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const connections=['Hortimatic','NewOldSmok'].map(name=>({id,name:'PrestaShop · '+name,protocol:'prestashop',revision:1,verified_revision:1,enabled:true,configured:true,real_data_authorized:true}));
test('complete directory pagination and cache do not stop at the first 100 records',async()=>{
 let requests=0;const session=createDirectorySession({kind:'clientes',actor:()=>id,can:()=>true,rpc:async()=>({connections}),invoke:async q=>{requests++;return {...q,ok:true,rows:Array.from({length:q.page?37:100},(_,i)=>({id:String(q.page*100+i+1)})),possibly_more:q.page===0};}});
 await session.enter('hortimatic');assert.equal((await session.read('customers')).rows.length,137);assert.equal((await session.read('customers',{}, {cached:true})).rows.length,137);assert.equal(requests,2);
 await session.enter('newoldsmok');assert.equal((await session.read('customers',{}, {cached:true})).rows.length,137);assert.equal(requests,4);
});
test('late account responses and duplicate pages cannot enter the directory cache',async()=>{
 let actor=id,release;const session=createDirectorySession({kind:'clientes',actor:()=>actor,can:()=>true,rpc:async()=>({connections}),invoke:q=>new Promise(resolve=>release=()=>resolve({...q,ok:true,rows:[{id:'1'}],possibly_more:false}))});
 await session.enter('hortimatic');const pending=session.read('customers');actor='another';release();await assert.rejects(pending);
 const duplicate=createDirectorySession({kind:'clientes',actor:()=>id,can:()=>true,rpc:async()=>({connections}),invoke:async q=>({...q,ok:true,rows:[{id:'1'}],possibly_more:true})});await duplicate.enter('hortimatic');await assert.rejects(duplicate.read('customers'),/repetido/);
});
test('one publish button internally prepares, commits, verifies and keeps failed intent stable',async()=>{
 const bodies=[];let fail=true;const session=createDirectorySession({kind:'clientes',actor:()=>id,can:()=>true,rpc:async()=>({connections}),invoke:async q=>{bodies.push(q);if(q.action.endsWith('_prepare'))return {...q,ok:true,can_commit:true,fingerprint:'a'.repeat(64)};if(fail)throw Error('Network fixture');return {...q,ok:true,persisted:true,verified:true};}});
 await session.enter('hortimatic');await assert.rejects(session.publish('customers','4',{firstname:'Nuevo'}));fail=false;const result=await session.publish('customers','4',{firstname:'Nuevo'});assert(result.verified);assert.equal(bodies[0].request_id,bodies[2].request_id);assert.equal(bodies[1].confirmed,true);
});

test('identical concurrent reads share one transport call and return independent snapshots',async()=>{
 let requests=0,release;
 const session=createDirectorySession({kind:'clientes',actor:()=>id,can:()=>true,rpc:async()=>({connections}),invoke:q=>{requests++;return new Promise(resolve=>release=()=>resolve({...q,ok:true,rows:[{id:'1'}],possibly_more:false}));}});
 await session.enter('hortimatic');const a=session.read('customers'),b=session.read('customers');
 assert.equal(requests,1);release();const [first,second]=await Promise.all([a,b]);first.rows[0].id='999';
 assert.equal(second.rows[0].id,'1');assert.equal(session.peek('customers').rows[0].id,'1');
 await session.enter('newoldsmok');assert.equal(session.peek('customers'),null);
});

test('independent reads overlap in bounded waves and preserve input order',async()=>{
 let running=0,peak=0;const releases=[];
 const pending=concurrentRead([0,1,2,3,4,5],async value=>{
  running++;peak=Math.max(peak,running);await new Promise(resolve=>releases.push(resolve));running--;return value;
 });
 assert.equal(peak,3);assert.equal(releases.length,3);
 releases.splice(0).forEach(release=>release());await new Promise(resolve=>setImmediate(resolve));
 assert.equal(releases.length,3);releases.splice(0).forEach(release=>release());
 assert.deepEqual(await pending,[0,1,2,3,4,5]);assert.equal(peak,3);
});

test('cached directory data is invalidated after a verified publication',async()=>{
 const session=createDirectorySession({kind:'clientes',actor:()=>id,can:()=>true,rpc:async()=>({connections}),invoke:async q=>q.action.endsWith('_read')?{...q,ok:true,rows:[{id:'1'}],possibly_more:false}:q.action.endsWith('_prepare')?{...q,ok:true,can_commit:true,fingerprint:'a'.repeat(64)}:{...q,ok:true,persisted:true,verified:true}});
 await session.enter('hortimatic');await session.read('customers');assert(session.peek('customers'));
 await session.publish('customers','1',{firstname:'Actualizado'});assert.equal(session.peek('customers'),null);
});
