import test from 'node:test';import assert from 'node:assert/strict';
import {receiptHtml,receiptPreviewHtml} from '../src/totustpv/documents.js';import {receiptOptions,receiptOptionsFromForm,receiptOptionsHtml} from '../src/totustpv/receipt-options.js';
import {historicalGroupRate,receiptPriceVisible} from '../src/totustpv/receipt-discount-display.js';
const receipt={kind:'receipt',existing_document:true,currency:'EUR',merchant:{name:'Tienda ficticia'},lines:[{name:'Artículo rebajado',reference:'R1',quantity:2,line_cents:1450,line_discount_cents:152,original_unit_tax_incl_micros:8012100,unit_tax_incl_micros:7250000,group_reduction_percent_micros:7500000},{name:'Artículo sin descuento',quantity:1,line_cents:350,line_discount_cents:0,unit_tax_incl_micros:3500000,group_reduction_percent_micros:0}],total_cents:1800,discount_cents:0,payments:{cash:1800},line_discounts_complete:true};
test('both receipt controls are typed, persistent form fields with legacy-compatible defaults',()=>{
 assert.equal(receiptOptions().showGroupDiscount,false);assert.equal(receiptOptions().showDiscountedPrices,true);
 assert.equal(receiptOptions({showGroupDiscount:'true'}).showGroupDiscount,false);assert.equal(receiptOptions({showDiscountedPrices:0}).showDiscountedPrices,true);
 const options=receiptOptionsFromForm(new Map([['receipt-showGroupDiscount','on'],['receipt-title','Ticket']]));assert.equal(options.showGroupDiscount,true);assert.equal(options.showDiscountedPrices,false);
 assert.match(receiptOptionsHtml(options),/name="receipt-showGroupDiscount" checked/);assert.match(receiptOptionsHtml(options),/name="receipt-showDiscountedPrices" /);
});
test('price suppression hides the discounted line and its unit/original/tax detail without changing total or other articles',()=>{
 const before=structuredClone(receipt),html=receiptHtml(receipt,{showDiscountedPrices:false,showUnitPrice:true,showOriginalPrice:true,showLineTax:true});const table=html.match(/<tbody>([^]*?)<\/tbody>/)[1];
 assert.doesNotMatch(table,/14,50|7,25|8,0121/);assert.match(table,/Artículo rebajado/);assert.match(table,/3,50/);assert.match(html,/<dt>Total<\/dt><dd><strong>18,00/);assert.deepEqual(receipt,before);
 assert.match(receiptHtml(receipt),/14,50/);assert.equal(receiptPriceVisible({line_discount_cents:0,group_reduction_percent_micros:7500000},{showDiscountedPrices:false}),false,'Native original prices can already include the recorded group reduction');assert.equal(receiptPriceVisible({line_discount_cents:0,group_reduction_percent_micros:0},{showDiscountedPrices:false}),true);
});
test('historical group detail preserves each recorded rate and never invents a monetary share or reads today’s group',()=>{
 const html=receiptHtml(receipt,{showGroupDiscount:true});assert.match(html,/Descuento de grupo registrado: 7,5 %/);assert.equal((html.match(/Descuento de grupo registrado:/g)||[]).length,1);
 assert.doesNotMatch(receiptHtml(receipt),/Descuento de grupo/);assert.match(receiptPreviewHtml({showGroupDiscount:true}),/Descuento de grupo registrado: 5 %/);
 for(const value of [undefined,null,'5',-1,100000001,1.5])assert.equal(historicalGroupRate({group_reduction_percent_micros:value}),null);
 const missing={...receipt,lines:[{name:'Antiguo',quantity:1,line_cents:1800}],line_discounts_complete:false};const legacy=receiptHtml(missing,{showGroupDiscount:true,showDiscountedPrices:false});assert.match(legacy,/porcentaje histórico.*no está disponible/);assert.doesNotMatch(legacy.match(/<tbody>([^]*?)<\/tbody>/)[1],/18,00/);assert.match(legacy,/<dt>Total<\/dt><dd><strong>18,00/);
});
test('gift still suppresses every price and group field even with all new and old options enabled',()=>{
 assert.doesNotMatch(receiptHtml({...receipt,kind:'gift'},{showGroupDiscount:true,showDiscountedPrices:true,showOriginalPrice:true,showUnitPrice:true,showLineDiscount:true}),/€|Descuento de grupo|Precio original|Precio unitario|14,50/);
});
