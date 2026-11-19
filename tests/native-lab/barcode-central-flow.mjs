import {exerciseCentralBarcodeBrowser} from './barcode-central-browser.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {checkDigit} from '../../src/totustpv/barcode-options.js';
export async function exerciseCentralBarcodes({call,handle,actor,selection,db,paths,nativeRead,loseCompletion,setExternalCode,changeCurrentCode,fixtureProductId}){
 const operationId=randomUUID(),request=(action,extra={})=>call({action,selection,operationId,...extra});
 await db.exec('reset role');
 const before=(await db.query('select (select count(*) from private.totus_tpv_sessions) sessions,(select count(*) from private.totus_tpv_operations) sales,(select count(*) from private.totus_tpv_payment_events) payments')).rows[0];
 await request('barcode-options',{settings:{field:'ean13',generatorEnabled:true}});
 let job=await request('barcode-create');assert.equal(job.status,'preparing');
 while(job.status==='preparing')job=await request('barcode-capture');
 assert.equal(job.status,'review');assert.ok(job.capturedCount>50,'Full capture must span native pages');
 const total=job.capturedCount;assert.equal(job.generatedCount,0);
 const race=job.items.find(row=>row.ordinal>job.items[0].ordinal&&row.reference.startsWith('QA-'));assert.ok(race,'Own QA race target is required');let raced=false;
 assert.equal(paths.filter(p=>p.method==='POST'&&p.path==='/api/totus_tpv_barcodes').length,0,'Capture cannot assign a code');
 const first=job.items[0],resource=first.attributeId?'combinations/'+first.attributeId:'products/'+first.productId;
 const initial=await nativeRead(resource),original=first.attributeId?(initial.combination??initial.combinations?.[0]):(initial.product??initial.products?.[0]);
 assert.ok(original,'Native read must contain the exact selected product or variant');
 assert.ok(!original.ean13);
 job=await request('barcode-confirm',{accepted:true});assert.equal(job.status,'processing');
 job=await request('barcode-step');assert.equal(job.generatedCount,0,'Planning persists identities before any write');
 loseCompletion();job=await request('barcode-step');assert.equal(job.uncertainCount,1);
 const posts=()=>paths.filter(p=>p.method==='POST'&&p.path==='/api/totus_tpv_barcodes').length;
 assert.equal(posts(),1);
 job=await request('barcode-pause');assert.equal(job.status,'paused');
 job=await request('barcode-step');assert.equal(job.generatedCount,1);assert.equal(job.uncertainCount,0);assert.equal(posts(),1,'Paused recovery must only GET the original result');
 const read=await nativeRead(resource),written=first.attributeId?(read.combination??read.combinations?.[0]):(read.product??read.products?.[0]);
 assert.equal(written.ean13,job.items[0].code);assert.equal(written.price,original.price);assert.equal(written.reference,original.reference);
 job=await request('barcode-resume');
 for(let n=0;job.status==='processing'&&n<total*2+10;n++){
  if(!raced){await db.exec('reset role');const pending=(await db.query("select l.payload->'items'->((l.payload->>'item_index')::int) item from private.totus_tpv_barcode_lines l left join private.totus_tpv_native_commands c on c.id=l.operation_id where l.job_id=$1 and l.operation_id is not null and c.id is null order by l.ordinal limit 1",[operationId])).rows[0]?.item;
   if(pending?.product_id===race.productId&&pending.attribute_id===race.attributeId){const changed=await setExternalCode(pending);assert.equal(changed.code,pending.code);raced=true;}
  }
  job=await request('barcode-step');
 }
 assert.equal(raced,true);assert.equal(job.status,'completed');assert.equal(job.generatedCount,total-1);assert.equal(job.keptCount,1);assert.equal(job.uncertainCount,0);assert.equal(job.pendingCount,0);assert.equal(posts(),total);
 const afterPosts=posts();job=await request('barcode-step');assert.equal(job.status,'completed');assert.equal(posts(),afterPosts);
 const labels=await request('barcode-labels',{query:{after:0,pageSize:50}});
 assert.equal(labels.field,'ean13');assert.equal(labels.items.length,Math.min(50,total));assert.equal(labels.items[0].code,written.ean13);
 assert.ok(labels.items.every(row=>row.symbology==='ean13'&&row.modules.length===95&&/^[01]+$/.test(row.modules)));
 assert.equal(posts(),afterPosts,'Current label lookup must be read-only');
 await db.exec('reset role');const own=(await db.query('select ordinal from private.totus_tpv_barcode_targets where job_id=$1 and product_id=$2 and attribute_id=0',[operationId,fixtureProductId])).rows[0];assert.ok(own);
 const query={after:Number(own.ordinal)-1,pageSize:1},originalLabel=(await request('barcode-labels',{query})).items[0];
 const body='29'+String(Date.now()%10000000000).padStart(10,'0'),replacement=body+checkDigit(body);
 await changeCurrentCode(fixtureProductId,originalLabel.code,replacement);
 try{
  const current=(await request('barcode-labels',{query})).items[0];assert.equal(current.code,replacement);
  const historical=await request('barcode-get',{query});assert.equal(historical.items[0].code,originalLabel.code,'Historical assignment receipt must remain unchanged');
  assert.equal(posts(),afterPosts,'Fresh label reads must not execute a barcode command');
 }finally{await changeCurrentCode(fixtureProductId,replacement,originalLabel.code);}
 await db.exec('reset role');
 const operations=(await db.query("select id,payload,result,status from private.totus_tpv_native_commands where command='barcodes.assign' order by created_at")).rows;
 assert.equal(operations.length,total);const generated=operations.filter(row=>row.status==='verified');assert.equal(generated.length,total-1);assert.ok(generated.every(row=>row.result.native_reference===row.id));
 assert.equal(new Set(generated.map(row=>row.result.items[0].code)).size,total-1);const kept=operations.find(row=>row.status!=='verified');assert.equal(kept.status,'uncertain');assert.equal(kept.result,null);
 assert.equal((await db.query('select count(*)::int n from private.totus_tpv_barcode_resolutions where operation_id=$1',[kept.id])).rows[0].n,1);
 const after=(await db.query('select (select count(*) from private.totus_tpv_sessions) sessions,(select count(*) from private.totus_tpv_operations) sales,(select count(*) from private.totus_tpv_payment_events) payments')).rows[0];assert.deepEqual(after,before);
 assert.equal(paths.some(p=>p.path==='/api/totus_tpv_sales'),false);
 console.log('PASS Central barcode flow: real handler → PostgreSQL → native HTTP, complete multi-page capture, persisted plans/UUIDs, lost Central completion, paused GET-only recovery, unchanged price/reference, unique native codes and exact verified receipts, no cash session/order/payment. Loopback laboratory only.');
 await exerciseCentralBarcodeBrowser({handle,actor,loseCompletion,paths});
 return {total,jobId:operationId};
}
