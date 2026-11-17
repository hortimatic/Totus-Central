import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceiptDelivery} from '../src/totustpv/receipt-delivery.js';
const sale={id:'sale-fixture',status:'confirmed',orderId:42,totalCents:150};
const document={kind:'receipt',existing_document:true,order_id:42,currency:'EUR',total_cents:150};
function fixture(read=async()=>document){const calls={reads:[],prints:[]};return {calls,delivery:createReceiptDelivery({
 getDocument:async args=>{calls.reads.push(args);return read();},print:(...args)=>calls.prints.push(args)})};}
test('automatic documents never run for an unconfirmed or unidentified sale, or by default',async()=>{
 const {calls,delivery}=fixture();
 for(const status of ['ready','dispatched','uncertain','cancelled'])assert.equal(await delivery.afterConfirmation({sale:{...sale,status},options:{printAfterSale:true}}),null);
 for(const orderId of [0,null,'42'])assert.equal(await delivery.afterConfirmation({sale:{...sale,orderId},options:{printAfterSale:true}}),null);
 for(const totalCents of [null,'150',-1])assert.equal(await delivery.afterConfirmation({sale:{...sale,totalCents},options:{printAfterSale:true}}),null);
 assert.equal(await delivery.afterConfirmation({sale}),null);
 assert.equal(await delivery.afterConfirmation({sale,options:{printAfterSale:'true'}}),null);
 assert.equal(calls.reads.length,0);assert.equal(calls.prints.length,0);
});
test('opening the verified receipt reads only that existing document and does not print',async()=>{
 const {calls,delivery}=fixture();const result=await delivery.afterConfirmation({sale,options:{showAfterSale:true}});
 assert.equal(result.document,document);assert.equal(result.printRequested,false);
 assert.deepEqual(calls.reads,[{saleId:sale.id,kind:'receipt'}]);assert.equal(calls.prints.length,0);
});
test('automatic print is requested once; recovering the same result cannot repeat it',async()=>{
 const {calls,delivery}=fixture();const args={sale,options:{showAfterSale:true,printAfterSale:true}};
 assert.equal((await delivery.afterConfirmation(args)).document,document);
 assert.equal(await delivery.afterConfirmation(args),null);
 assert.equal(calls.reads.length,1);assert.equal(calls.prints.length,1);assert.equal(calls.prints[0][0],document);
});
test('mismatched, gift or unverified documents cannot reach the printer',async()=>{
 for(const response of [{...document,order_id:43},{...document,kind:'gift'},{...document,existing_document:false},{...document,total_cents:151},{...document,currency:'USD'}]){
  const {calls,delivery}=fixture(async()=>response);assert.match((await delivery.afterConfirmation({sale,options:{printAfterSale:true}})).warning,/Pedido confirmado/);
  assert.equal(calls.prints.length,0);
 }
});
test('a late response after account or workspace change cannot print or open private data',async()=>{
 let resolve,current=true;const {calls,delivery}=fixture(()=>new Promise(done=>resolve=done));
 const pending=delivery.afterConfirmation({sale,options:{printAfterSale:true,showAfterSale:true},current:()=>current});
 current=false;resolve(document);assert.equal(await pending,null);assert.equal(calls.prints.length,0);
});
test('failed document delivery preserves the confirmed sale and leaves manual recovery',async()=>{
 const {calls,delivery}=fixture(async()=>{throw Error('Unavailable');});
 const args={sale,options:{printAfterSale:true}};assert.match((await delivery.afterConfirmation(args)).warning,/Documentos/);
 assert.equal(sale.status,'confirmed');assert.equal(await delivery.afterConfirmation(args),null);
 assert.equal(calls.reads.length,1);assert.equal(calls.prints.length,0);
});
test('the printer receives a live context guard for its asynchronous iframe load',async()=>{
 let current=true;const {calls,delivery}=fixture();
 await delivery.afterConfirmation({sale,options:{printAfterSale:true},current:()=>current});
 const guard=calls.prints[0][2].current;assert.equal(guard(),true);current=false;assert.equal(guard(),false);
});
