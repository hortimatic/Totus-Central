import test from 'node:test';import assert from 'node:assert/strict';
import {receiptHtml,receiptPreviewHtml} from '../src/totustpv/documents.js';
import {receiptOptions,receiptOptionsFromForm} from '../src/totustpv/receipt-options.js';
const document={existing_document:true,kind:'receipt',currency:'EUR',merchant:{name:'Tienda'},lines:[],payments:{cash:900},total_cents:900,discount_cents:300,vouchers_complete:true,vouchers:[{name:'Vale <cliente>',amount_cents:100},{name:'Promoción',amount_cents:200}]};
test('optional historical breakdown escapes names and leaves confirmed totals unchanged',()=>{
 assert.equal(receiptOptions().showVouchers,false);
 assert.equal(receiptOptions({showVouchers:'true'}).showVouchers,false);
 assert.equal(receiptOptionsFromForm(new Map([['receipt-showVouchers','on']])).showVouchers,true);
 assert.doesNotMatch(receiptHtml(document),/Vale &lt;cliente/);
 const html=receiptHtml(document,{showVouchers:true});assert.match(html,/Vale &lt;cliente&gt;/);assert.match(html,/Promoción/);
 assert.match(html,/<dt>Total<\/dt><dd><strong>9,00/);assert.equal(document.total_cents,900);
 assert.match(receiptPreviewHtml({showVouchers:true}),/Vale de ejemplo/);
});
test('gift hides breakdown and incomplete historical rows cannot advertise false totals',()=>{
 assert.doesNotMatch(receiptHtml({...document,kind:'gift'},{showVouchers:true}),/Vale|Promoción|€/);
 for(const patch of [{vouchers:undefined},{vouchers_complete:false},{vouchers:[{name:'Vale',amount_cents:299}]},{vouchers:[{name:'Vale',amount_cents:-300}]}]){
  const html=receiptHtml({...document,...patch},{showVouchers:true});assert.match(html,/desglose histórico.*no está disponible/);assert.match(html,/<dt>Total<\/dt><dd><strong>9,00/);
 }
 assert.doesNotMatch(receiptHtml({...document,discount_cents:0},{showVouchers:true}),/desglose histórico|Vales y descuentos/);
});
