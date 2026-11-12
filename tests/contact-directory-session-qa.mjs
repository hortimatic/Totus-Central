import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDirectorySession} from '../src/contact-directory-session.js';
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
