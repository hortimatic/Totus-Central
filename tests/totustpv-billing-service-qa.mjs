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
