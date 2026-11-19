import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedBillingMetadata,readBillingDocument} from '../src/totustpv/server/billing-service.js';
const sale={id:'sale',orderId:10,totalCents:1210,currency:'EUR',sourceActorId:'actor',expected:{customerId:2,invoiceAddressId:3,
 lines:[{productId:50,attributeId:0,qty:2}]},refunds:[{id:'refund',totalCents:100}],refundSources:[{id:'refund',actorId:'return-actor'}]};
const document={source:'native-billing-document',kind:'billing',existing_document:true,order_id:10,order_reference:'LAB',invoice_id:20,
 number:30,formatted_number:'LAB-30',issued_at:'2026-11-18 00:00:00',currency:'EUR',customer_id:2,invoice_address_id:3,total_cents:1210,
 total_tax_incl:'12.100000',total_tax_excl:'10.000000',discount_tax_incl:'0.000000',discount_tax_excl:'0.000000',
 shipping_tax_incl:'0.000000',shipping_tax_excl:'0.000000',secret:'excluded',lines:[{detail_id:40,product_id:50,attribute_id:0,
 name:'Nombre <seguro>',quantity:2,unit_tax_excl:'5.000000',unit_tax_incl:'6.050000',line_tax_excl:'10.000000',line_tax_incl:'12.100000',
 recorded_tax_rate:'21.000000',recorded_ecotax:'0.000000',recorded_ecotax_tax_rate:'0.000000',secret:'excluded'}]};
test('billing metadata belongs to the confirmed sale and projects explicit historical fields',()=>{
 const actual=verifiedBillingMetadata(document,sale);assert.equal(actual.invoice_id,20);assert.equal(actual.secret,undefined);
 assert.equal(actual.lines[0].secret,undefined);assert.equal(actual.lines[0].unit_tax_incl,'6.050000');
 for(const change of [{order_id:11},{customer_id:5},{invoice_address_id:8},{currency:'USD'},{total_cents:1},{total_tax_incl:'1.000000'},
  {existing_document:false},{number:0},{lines:[]},{lines:[{...document.lines[0],quantity:3}]},{lines:[{...document.lines[0],recorded_tax_rate:null}]}])
  assert.throws(()=>verifiedBillingMetadata({...document,...change},sale),/TPV_BILLING_DOCUMENT_MISMATCH/);
});
test('native metadata/PDF source identities come only from the server journal, without mutation',async()=>{
 const requests=[],rpc=async(name,args)=>{requests.push({name,args});return {data:sale};};
 const transport={readNativeBilling:async args=>{requests.push(args);return document;},readNativeDocument:async args=>{
  requests.push(args);return {existing_document:true,kind:args.kind,order_id:10,mime:'application/pdf',base64:Buffer.from('%PDF-1.4\nfixture').toString('base64')};}};
 const result=await readBillingDocument({rpc,scope:{},operationId:'sale',kind:'billing',transport});
 assert.deepEqual(requests[1],{operationId:'sale',sourceActorId:'actor'});assert.equal(result.sale.sourceActorId,undefined);assert.equal(result.sale.expected,undefined);
 await readBillingDocument({rpc,scope:{},operationId:'sale',kind:'credit-note',refundId:'refund',transport});
 assert.deepEqual(requests.at(-1),{operationId:'refund',sourceActorId:'return-actor',kind:'credit-note'});
 await assert.rejects(()=>readBillingDocument({rpc,scope:{},operationId:'sale',kind:'credit-note',refundId:'foreign',transport}),/TPV_BILLING_RETURN_NOT_FOUND/);
 assert.ok(requests.filter(row=>row.name).every(row=>row.name==='totus_tpv_billing_read'));
});


test('billing signature archive verifies exact signed bytes and needs no native transport',async()=>{
 const {readBillingSignature}=await import('../src/totustpv/server/billing-service.js');
 const {signatureHash}=await import('../src/totustpv/signature-document.js');
 const bytes=Buffer.from('%PDF-1.4\nsigned-fixture'),sha256=await signatureHash(bytes),originalSha256='1'.repeat(64);
 const record={operationId:'sale',orderId:10,status:'signed',original:{sha256:originalSha256},signed:{mime:'application/pdf',filename:'totus-invoice-10-firmada.pdf',base64:bytes.toString('base64'),sha256,originalSha256},actorName:'Operador',signedAt:'2026-11-19T02:00:00Z'};
 let value=record;const calls=[],rpc=async(name,args)=>{calls.push({name,args});return {data:value};};
 const result=await readBillingSignature({rpc,scope:{actorId:'reader'},operationId:'sale'});assert.equal(result.available,true);assert.equal(result.base64,record.signed.base64);assert.equal(result.filename,record.signed.filename);assert.equal(result.original,undefined);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'totus_tpv_billing_signature');assert.equal(calls[0].args.p_scope.actorId,'reader');
 value=null;assert.deepEqual(await readBillingSignature({rpc,scope:{},operationId:'sale'}),{available:false});
 for(const change of [{operationId:'other'},{orderId:11},{status:'prepared'},{signed:{...record.signed,sha256:'0'.repeat(64)}},{signed:{...record.signed,originalSha256:'0'.repeat(64)}}]){value={...record,...change};await assert.rejects(()=>readBillingSignature({rpc,scope:{},operationId:'sale'}));}
 await assert.rejects(()=>readBillingSignature({rpc:async()=>({error:{message:'TPV_BILLING_FORBIDDEN'}}),scope:{},operationId:'sale'}),/TPV_BILLING_FORBIDDEN/);
});
