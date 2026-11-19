import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfflineSync} from '../src/totustpv/offline-sync.js';

function fixture(count,dispatch){
 const rows=Array.from({length:count},(_,i)=>({id:String(i).padStart(4,'0'),status:'queued',revision:1,ticket:{}}));
 const journal={list:async({after,limit})=>rows.filter(row=>row.id>after).slice(0,limit).map(row=>({...row})),get:async id=>({...rows.find(row=>row.id===id)}),
  claim:async(id,revision)=>{const row=rows.find(row=>row.id===id);const won=row.revision===revision&&row.status==='queued';if(won){row.status='dispatching';row.revision++;}return {won,record:{...row}};},
  settle:async(id,revision,{status})=>{const row=rows.find(row=>row.id===id);if(row.revision===revision){row.status=status;row.revision++;}return {record:{...row}};}};
 const calls=[];const adapter={dispatch:async args=>{calls.push(args.operationId);return dispatch(args);},recover:async({operationId})=>({operationId,status:'confirmed',verified:true})};
 return {rows,calls,sync:createOfflineSync({journal,adapter})};
}
test('manual and automatic queue triggers share one paginated sweep',async()=>{
 const {sync,calls,rows}=fixture(129,async({operationId})=>({operationId,status:'confirmed',verified:true}));
 const first=sync.synchronizePending(),second=sync.synchronizePending();assert.equal(first,second);
 assert.deepEqual(await first,{synced:129,conflict:0,pending:0});assert.equal(new Set(calls).size,129);assert.equal(calls.length,129);assert.ok(rows.every(row=>row.status==='synced'));
 assert.deepEqual(await sync.synchronizePending(),{synced:0,conflict:0,pending:0});assert.equal(calls.length,129);
});
test('lost connection stops sweep and next attempt recovers without resending',async()=>{
 const {sync,calls,rows}=fixture(3,async()=>{throw Error('disconnected');});
 assert.deepEqual(await sync.synchronizePending(),{synced:0,conflict:0,pending:1});assert.deepEqual(calls,['0000']);assert.equal(rows[1].status,'queued');
 assert.deepEqual(await sync.synchronizePending(),{synced:1,conflict:0,pending:1});assert.deepEqual(calls,['0000','0001']);assert.equal(rows[0].status,'synced');
});
