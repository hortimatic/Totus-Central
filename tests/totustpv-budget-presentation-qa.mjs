import {test} from 'node:test';import assert from 'node:assert/strict';
import {budgetDocumentHtml} from '../src/totustpv/budget-document.js';
import {budgetOptions,budgetOptionsFromForm,budgetOptionsHtml} from '../src/totustpv/budget-options.js';
const source=()=>({reference:'P-000001',title:'Propuesta',status:'saved',storeName:'Tienda',createdAt:'2026-11-19T10:00:00Z',validUntil:'2026-12-19T10:00:00Z',snapshot:{currency:'EUR',totalCents:12345,totalTaxExclCents:10202,shippingCents:789,discountCents:456,merchant:{name:'Tienda'},lines:[{name:'Artículo <script>',qty:3,unitTaxInclMicros:12345678,lineTaxInclCents:3704}]}});
test('hidden-price document contains quantities and reference but no rendered monetary values; commercial snapshot stays byte-identical',()=>{
 const document=source(),before=JSON.stringify(document);Object.freeze(document.snapshot.lines[0]);Object.freeze(document.snapshot.lines);Object.freeze(document.snapshot);
 const html=budgetDocumentHtml({...document,presentation:{hidePrices:true}});
 for(const value of ['123,45','102,02','21,43','7,89','4,56','12,345678','37,04','unitTaxInclMicros','totalCents',' €','&euro;'])assert.equal(html.includes(value),false,value);
 assert.ok(html.includes('<th>Cantidad</th>'));assert.ok(html.includes('<td>3</td>'));assert.ok(html.includes('P-000001'));assert.ok(html.includes('&lt;script&gt;'));assert.equal(JSON.stringify(document),before);
});
test('ordinary and explicit visible documents preserve original commercial amounts',()=>{const document=source();assert.equal(budgetDocumentHtml(document),budgetDocumentHtml({...document,presentation:{hidePrices:false}}));assert.ok(budgetDocumentHtml(document).includes('123,45'));});
test('malformed presentation cannot silently expose a hidden-price document',()=>{for(const presentation of [null,[],{},'true',{hidePrices:'true'},{hidePrices:false,other:true}]){if(presentation===null)continue;assert.throws(()=>budgetDocumentHtml({...source(),presentation}),/presentación/);}});
test('counter intent rejects decimal/exponent/unsafe input and never lets a stale form lower the displayed counter',()=>{
 const current={...budgetOptions(),lastNumber:42,revision:7};
 for(const value of ['41','4.2','1e3','01','9007199254740993','-1','1000000000'])assert.throws(()=>budgetOptionsFromForm(new Map([['budget-lastNumber',value],['budget-prefix','P-']]),current));
 const intent=budgetOptionsFromForm(new Map([['budget-lastNumber','43'],['budget-prefix','PROP/'],['budget-enabled','on'],['budget-hidePrices','on']]),current);
 assert.deepEqual(intent,{enabled:true,prefix:'PROP/',lastNumber:43,hidePrices:true,expectedRevision:7});assert.equal(current.lastNumber,42);
});
test('read-only settings have no save action and preserve typed defaults; injected draft values are escaped',()=>{const html=budgetOptionsHtml(budgetOptions(),false,{'budget-prefix':'"><img src=x>'});assert.equal(html.includes('type="submit"'),false);assert.equal(html.includes('<img'),false);assert.ok(html.includes('disabled'));assert.ok(html.includes('&lt;img'));});
