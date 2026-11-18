import test from 'node:test';import assert from 'node:assert/strict';
import {paymentReference,paymentReferencePolicy,referenceForTender,paymentReferenceFields,documentPaymentReferences} from '../src/totustpv/payment-reference.js';
import {receiptHtml} from '../src/totustpv/documents.js';
import {receiptOptions} from '../src/totustpv/receipt-options.js';
test('reconciliation references preserve cashier text without converting it into payment proof',()=>{
 for(const value of ['OP-20261118-0042','12345678','BANK/2026:18','ABC. 12_3'])assert.equal(paymentReference(' '+value+' '),value);
 assert.equal(paymentReference('  '),undefined);assert.equal(paymentReference(),undefined);
 for(const value of [null,123,{},'<reference>','x\n y','a'.repeat(65),'4111 1111 1111 1111','CARD-5555-5555-5555-4444'])assert.throws(()=>paymentReference(value));
});
test('the counter only offers configured external inputs and requires the active reference',()=>{
 const payment={paymentMethods:['cash','card','bizum'],referencePolicy:{card:'required',bizum:'hidden'}};
 assert.match(paymentReferenceFields(payment,{'reference:card':'<not markup>'}),/name="reference:card"/);
 assert.match(paymentReferenceFields(payment,{'reference:card':'<not markup>'}),/&lt;not markup&gt;/);
 assert.doesNotMatch(paymentReferenceFields(payment),/name="reference:cash"|name="reference:bizum"/);
 assert.throws(()=>referenceForTender(payment.referencePolicy,'card',' '),/Añade la referencia/);
 assert.equal(referenceForTender(payment.referencePolicy,'card',' OP-42 '),'OP-42');
 assert.throws(()=>referenceForTender(payment.referencePolicy,'bizum','OP-42'),/no admite/);
 assert.equal(referenceForTender(payment.referencePolicy,'cash',undefined),undefined);
});
test('only available external methods can configure hidden, optional or mandatory references',()=>{
 assert.deepEqual(paymentReferencePolicy(undefined,['cash','card']),{card:'hidden'});
 assert.deepEqual(paymentReferencePolicy({card:'required',transfer:'hidden'}),{card:'required',bizum:'hidden',transfer:'hidden'});
 for(const value of [null,[],{cash:'required'},{card:true},{bank:'required'}])assert.throws(()=>paymentReferencePolicy(value));
 assert.throws(()=>paymentReferencePolicy({transfer:'required'},['cash','card']));
 for(const available of [[],null,'card',['card','card'],['cheque']])assert.throws(()=>paymentReferencePolicy({},available));
});
test('printing an operator reference is opt-in and gift documents never disclose it',()=>{
 const document={existing_document:true,kind:'receipt',reference:'QA-42',created_at:'2026-11-18 12:00:00',currency:'EUR',merchant:{name:'Tienda ficticia'},lines:[{name:'Artículo',quantity:1,line_cents:801}],total_cents:801,payments:{card:801},payment_intent:[{method:'card',amount_cents:801,external_reference:'OP-0042'}]};
 assert.equal(receiptOptions().showPaymentReferences,false);assert.doesNotMatch(receiptHtml(document),/OP-0042/);
 assert.match(receiptHtml(document,{showPaymentReferences:true}),/Operación: OP-0042/);
 assert.doesNotMatch(receiptHtml(document,{showPaymentReferences:true,showPayments:false}),/OP-0042/);
 assert.doesNotMatch(receiptHtml({...document,kind:'gift'},{showPaymentReferences:true}),/OP-0042|€/);
 for(const payment_intent of [[{method:'cash',external_reference:'OP-0042'}],[{method:'card',external_reference:'4111111111111111'}],[{method:'card',external_reference:'<script>'}],Array(2).fill(document.payment_intent[0]),null])assert.deepEqual(documentPaymentReferences({...document,payment_intent}),{});
});
