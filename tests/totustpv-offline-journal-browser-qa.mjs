import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 const result=await page.evaluate(async()=>{
  const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const scope={actorId:id(1),connectionId:id(2),storeId:id(3),shopId:1,drawerId:id(4),deviceId:id(5)},name='offline-qa-'+crypto.randomUUID();
  const store=createOfflineJournal({scope,name}),ticket={lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801}],totalCents:801,currency:'EUR'};
  const first=await store.capture({id:id(10),ticket}),again=await store.capture({id:id(10),ticket});
  let changedRejected=false;try{await store.capture({id:id(10),ticket:{...ticket,totalCents:802}});}catch{changedRejected=true;}
  const other=createOfflineJournal({scope,name}),claims=await Promise.all([store.claim(id(10),1),other.claim(id(10),1)]);
  const winner=claims.find(x=>x.won),pending=await store.settle(id(10),winner.record.revision,{status:'uncertain',remoteOperationId:id(10)});
  const denied=await other.claim(id(10),pending.record.revision),synced=await other.settle(id(10),pending.record.revision,{status:'synced',remoteOperationId:id(10)});
  const stale=await store.settle(id(10),pending.record.revision,{status:'uncertain',remoteOperationId:id(10)});
  const foreign=createOfflineJournal({scope:{...scope,actorId:id(9)},name});
  window.offlineFixture={scope,name,id:id(10)};
  return {first:first.status,again:again.revision,changedRejected,winners:claims.filter(x=>x.won).length,denied:denied.won,synced:synced.record.status,stale:stale.updated,foreign:await foreign.get(id(10)),foreignList:(await foreign.list()).length};
 });
 assert.deepEqual(result,{first:'queued',again:1,changedRejected:true,winners:1,denied:false,synced:'synced',stale:false,foreign:null,foreignList:0});
 const saved=await page.evaluate(()=>offlineFixture);await page.reload();
 assert.equal(await page.evaluate(async f=>{const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');return (await createOfflineJournal({scope:f.scope,name:f.name}).get(f.id)).status;},saved),'synced');

 const second=await page.context().newPage();await second.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 const prepare=async(f)=>{const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');window.diskJournal=createOfflineJournal({scope:f.scope,name:f.name});};
 await page.evaluate(prepare,saved);await second.evaluate(prepare,saved);
 const raceId='00000000-0000-4000-8000-000000000020';
 await page.evaluate(async id=>diskJournal.capture({id,ticket:{lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:100}],totalCents:100,currency:'EUR'}}),raceId);
 await page.context().setOffline(true);
 const claims=await Promise.all([page.evaluate(id=>diskJournal.claim(id,1),raceId),second.evaluate(id=>diskJournal.claim(id,1),raceId)]);assert.equal(claims.filter(r=>r.won).length,1);
 assert.equal(await second.evaluate(async id=>(await diskJournal.get(id)).status,raceId),'dispatching');
 const quota=await page.evaluate(async()=>{
  const id='00000000-0000-4000-8000-000000000021',original=IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add=function(){throw new DOMException('Synthetic storage quota exhausted','QuotaExceededError');};
  let rejected=false;try{await diskJournal.capture({id,ticket:{lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:100}],totalCents:100,currency:'EUR'}});}catch{rejected=true;}finally{IDBObjectStore.prototype.add=original;}
  return {rejected,saved:await diskJournal.get(id)};
 });assert.deepEqual(quota,{rejected:true,saved:null});
 await page.context().setOffline(false);await second.close();

 const delivery=await page.evaluate(async()=>{
  const {createOfflineSync}=await import('/src/totustpv/offline-sync.js');
  const id='00000000-0000-4000-8000-000000000030',ticket={lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:100}],totalCents:100,currency:'EUR'};
  await diskJournal.capture({id,ticket});let sends=0,reads=0;
  const sync=createOfflineSync({journal:diskJournal,adapter:{dispatch:async()=>{sends++;throw Error('Response lost after server accepted');},recover:async({operationId})=>{reads++;return {operationId,status:'confirmed',verified:true};}}});
  const lost=await sync.synchronize(id),recovered=await sync.synchronize(id),again=await sync.synchronize(id);
  const mismatchId='00000000-0000-4000-8000-000000000031';await diskJournal.capture({id:mismatchId,ticket});let mismatchSends=0;
  const mismatched=createOfflineSync({journal:diskJournal,adapter:{dispatch:async()=>{mismatchSends++;return {operationId:id,status:'confirmed',verified:true};},recover:async()=>({operationId:mismatchId,status:'confirmed',verified:false})}});
  const wrong=await mismatched.synchronize(mismatchId),unverified=await mismatched.synchronize(mismatchId);
  return {lost:lost.status,recovered:recovered.status,again:again.status,sends,reads,wrong:wrong.status,unverified:unverified.status,mismatchSends};
 });assert.deepEqual(delivery,{lost:'uncertain',recovered:'synced',again:'synced',sends:1,reads:1,wrong:'uncertain',unverified:'uncertain',mismatchSends:1});

 const pagination=await page.evaluate(async()=>{
  const ticket={lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:100}],totalCents:100,currency:'EUR'};
  for(let n=100;n<225;n++)await diskJournal.capture({id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),ticket});
  const ids=[];let after='';for(;;){const rows=await diskJournal.list({after,limit:17});if(!rows.length)break;ids.push(...rows.map(row=>row.id));after=rows.at(-1).id;}
  let refused=false;try{await diskJournal.list({limit:101});}catch{refused=true;}
  return {count:ids.length,unique:new Set(ids).size,refused};
 });assert.deepEqual(pagination,{count:129,unique:129,refused:true});
 const tamper=await page.evaluate(async f=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(f.name,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('operations','readwrite'),store=tx.objectStore('operations'),r=store.openCursor();r.onsuccess=()=>{const c=r.result;if(c){const row=c.value;row.ticket.lines[0].qty=2;c.update(row);}};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
  let listRejected=false;try{await diskJournal.list();}catch{listRejected=true;}
  return {listRejected};
 },saved);assert.deepEqual(tamper,{listRejected:true});

 const commercialSaved=await page.evaluate(async f=>{const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');const journal=createOfflineJournal({scope:f.scope,name:f.name+'-commercial'});const commercial={currency:'EUR',customerId:1,invoiceAddressId:2,deliveryAddressId:2,totalCents:801,totalTaxExclCents:662,discountCents:0,shippingCents:0,nativeRoundMode:2,nativeRoundType:1,lines:[{productId:1,attributeId:0,qty:1,unitTaxInclMicros:8012100,unitTaxExclMicros:6621570,lineTaxInclCents:801,lineTaxExclCents:662}]};const ticket={commercial,lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801}],totalCents:801,currency:'EUR'};await journal.capture({id:f.id,ticket});return (await journal.get(f.id)).ticket.commercial;},saved);assert.equal(commercialSaved.lines[0].unitTaxInclMicros,8012100);

 const duplicates=await page.evaluate(async f=>{
  const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');
  const journal=createOfflineJournal({scope:f.scope,name:f.name+'-duplicate-lines'});
  const ticket={lines:[{productId:1,qty:1},{productId:1,attributeId:0,qty:1}],payments:[{method:'cash',amountCents:200}],totalCents:200,currency:'EUR'};
  let rejected=false;try{await journal.capture({id:crypto.randomUUID(),ticket});}catch{rejected=true;}
  const before=(await journal.list()).length;
  await journal.capture({id:crypto.randomUUID(),ticket:{...ticket,lines:[{productId:1,attributeId:1,qty:1},{productId:1,attributeId:2,qty:1}]}});
  return {rejected,before,after:(await journal.list()).length};
 },saved);assert.deepEqual(duplicates,{rejected:true,before:0,after:1});

 const references=await page.evaluate(async f=>{
  const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');const journal=createOfflineJournal({scope:f.scope,name:f.name+'-references'});
  const ticket={lines:[{productId:1,qty:1}],payments:[{method:'card',amountCents:801,reference:'CARD-2026/42'}],totalCents:801,currency:'EUR'};
  await journal.capture({id:f.id,ticket});let rejected=0;
  for(const payment of [{method:'cash',amountCents:801,reference:'CASH-1'},...['4111111111111111','',null,' PADDED '].map(reference=>({method:'card',amountCents:801,reference}))]){try{await journal.capture({id:crypto.randomUUID(),ticket:{...ticket,payments:[payment]}});}catch{rejected++;}}
  return {reference:(await journal.get(f.id)).ticket.payments[0].reference,rejected,count:(await journal.list()).length};
 },saved);assert.deepEqual(references,{reference:'CARD-2026/42',rejected:5,count:1});

 const submission=await page.evaluate(async f=>{
  const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');const {submitWithLocalReceipt}=await import('/src/totustpv/local-sale-submission.js');
  const journal=createOfflineJournal({scope:f.scope,name:f.name+'-submission'}),ticket={lines:[{productId:1,qty:1,discount:{kind:'percent',value:500},displayName:'Artículo preparado'}],adjustment:{kind:'amount',value:50},coupon:'PROMO_5',note:'Recogida\nLlamar antes',payments:[{method:'card',amountCents:801,reference:'CARD-42'}],totalCents:801,currency:'EUR'};
  let sends=0;const submit=async()=>{sends++;const saved=await journal.get(f.id);if(saved.status!=='dispatching'||saved.ticket.note!==ticket.note)throw Error('Persistence missing');return {id:f.id,status:'uncertain'};};
  const result=await submitWithLocalReceipt({journal,operationId:f.id,ticket,submit,isCurrent:()=>true});let repeated=false;try{await submitWithLocalReceipt({journal,operationId:f.id,ticket,submit,isCurrent:()=>true});}catch{repeated=true;}
  const original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(){throw new DOMException('Quota exhausted','QuotaExceededError');};let failed=false;
  try{await submitWithLocalReceipt({journal,operationId:crypto.randomUUID(),ticket,submit,isCurrent:()=>true});}catch{failed=true;}finally{IDBObjectStore.prototype.add=original;}
  return {status:result.status,sends,repeated,failed,ticket:(await journal.get(f.id)).ticket};
 },saved);assert.equal(submission.status,'uncertain');assert.equal(submission.sends,1);assert.equal(submission.repeated,true);assert.equal(submission.failed,true);assert.equal(submission.ticket.coupon,'PROMO_5');assert.equal(submission.ticket.lines[0].discount.value,500);assert.equal(submission.ticket.note,'Recogida\nLlamar antes');
 const malformed=await page.evaluate(async f=>{
  const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');const {submitWithLocalReceipt}=await import('/src/totustpv/local-sale-submission.js');
  const journal=createOfflineJournal({scope:f.scope,name:f.name+'-invalid-replies'}),ticket={lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801}],totalCents:801,currency:'EUR'},out=[];
  for(const reply of [undefined,{id:crypto.randomUUID(),status:'confirmed',totalCents:801},{status:'confirmed',totalCents:802},{status:'confirmed'}]){
   const id=crypto.randomUUID(),response=reply&&{id,...reply};const result=await submitWithLocalReceipt({journal,operationId:id,ticket,submit:async()=>response,isCurrent:()=>true,isOnline:()=>true});
   out.push({status:result.status,saved:(await journal.get(id)).status,same:result.id===id,total:result.totalCents});
  }return out;
 },saved);assert.deepEqual(malformed,Array.from({length:4},()=>({status:'uncertain',saved:'uncertain',same:true,total:801})));
 const queued=await page.evaluate(async f=>{
  const {createOfflineJournal}=await import('/src/totustpv/offline-journal.js');const {submitWithLocalReceipt}=await import('/src/totustpv/local-sale-submission.js');
  const journal=createOfflineJournal({scope:f.scope,name:f.name+'-offline-submit'}),id=crypto.randomUUID();
  const ticket={lines:[{productId:1,qty:1}],payments:[{method:'cash',amountCents:801,receivedCents:1000}],totalCents:801,currency:'EUR'};
  let sends=0;const submit=async()=>{sends++;return {id,status:'confirmed',totalCents:801};};
  const args={journal,operationId:id,ticket,submit,isCurrent:()=>true,isOnline:()=>false};
  const result=await submitWithLocalReceipt(args);await submitWithLocalReceipt(args);
  const exact=await submitWithLocalReceipt({...args,operationId:crypto.randomUUID(),ticket:{...ticket,payments:[{method:'cash',amountCents:801}]}});
  if(exact.changeCents!==0)throw Error('Exact cash must give zero change');
  const before=await journal.get(id);await submitWithLocalReceipt({...args,isOnline:()=>true});
  let rejected=false;try{await submitWithLocalReceipt(args);}catch{rejected=true;}
  return {localQueued:result.localQueued,change:result.changeCents,before:before.status,after:(await journal.get(id)).status,sends,rejected};
 },saved);assert.deepEqual(queued,{localQueued:true,change:199,before:'queued',after:'synced',sends:1,rejected:true});
 console.log('PASS local offline journal: immutable capture, cross-client atomic claim, uncertain recovery without re-dispatch, stale-result refusal, account isolation and browser reload. No sale API called. Full offline checkout not implemented.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
