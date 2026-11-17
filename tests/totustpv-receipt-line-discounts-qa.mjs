import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptHtml} from '../src/totustpv/documents.js';
import {receiptOptions} from '../src/totustpv/receipt-options.js';
const document={existing_document:true,kind:'receipt',currency:'EUR',order_id:42,reference:'QA-42',created_at:'2026-11-17 12:00:00',merchant:{name:'Tienda ficticia'},
 lines:[{name:'Artículo',reference:'QA-1',quantity:2,line_cents:1450,unit_tax_incl_micros:7250000,original_unit_tax_incl_micros:8012100,original_line_cents:1602,line_discount_cents:152}],
 total_cents:1350,discount_cents:100,line_discount_cents:152,line_discounts_complete:true,payments:{cash:1350}};
const options={showOriginalPrice:true,showLineDiscount:true,includeLineDiscountsInTotal:true};
test('original prices and item reductions are opt-in, with native unit precision and separate coupon totals',()=>{
 for(const key of Object.keys(options)){assert.equal(receiptOptions()[key],false);assert.equal(receiptOptions({[key]:'true'})[key],false);}
 assert.doesNotMatch(receiptHtml(document),/Precio original|Descuento del artículo|Total descuentos/);
 const html=receiptHtml(document,options);assert.match(html,/Precio original: 8,0121/);assert.match(html,/data-item-discounts/);assert.ok(html.includes('title="Descuento del artículo">Dto.</abbr>'));assert.match(html,/<td>−1,52/);assert.match(html,/Total descuentos<\/dt><dd>−2,52/);assert.match(html,/13,50/);
 assert.match(receiptHtml(document,{...options,includeLineDiscountsInTotal:false}),/Descuentos de ticket<\/dt><dd>−1,00/);
 assert.doesNotMatch(receiptHtml(document,{...options,showDiscounts:false}),/<dt>Total descuentos|<dt>Descuentos de ticket/);
});
test('gift documents disclose no prices, item reductions or totals even when every option is enabled',()=>{
 assert.doesNotMatch(receiptHtml({...document,kind:'gift'},options),/Precio original|Descuento del artículo|Total descuentos|€/);
});
test('old connector responses identify missing historical detail instead of inventing article savings',()=>{
 const old={...document,line_discounts_complete:undefined,line_discount_cents:undefined,lines:[{name:'Artículo antiguo',quantity:1,line_cents:1350}]};
 const html=receiptHtml(old,options);assert.match(html,/no dispone del desglose histórico/);assert.doesNotMatch(html,/Precio original:|Descuento del artículo:|Total descuentos/);assert.match(html,/Descuentos de ticket<\/dt><dd>−1,00/);
});
