import test from 'node:test';import assert from 'node:assert/strict';
import {tenderSummaryHtml} from '../src/totustpv/tender-summary.js';
test('final mixed-payment summary distinguishes discounted total, cash allocation and change',()=>{
 const html=tenderSummaryHtml({totalCents:701,cashPartCents:300,receivedCents:1000,discountCents:50,externalLabel:'Transferencia'});
 assert.match(html,/Total a cobrar.*7,01/);assert.match(html,/incluido.*0,50/);assert.match(html,/Parte en efectivo.*3,00/);
 assert.match(html,/Cambio a devolver.*7,00/);assert.match(html,/transferencia.*4,01/);
});
test('cashless summaries have no cash change and invalid allocations never render',()=>{
 const html=tenderSummaryHtml({totalCents:801,cashPartCents:0,receivedCents:0,externalLabel:'<b>Tarjeta</b>'});
 assert.match(html,/8,01/);assert.doesNotMatch(html,/data-tpv-change|Entregado|<b>tarjeta/);assert.match(html,/&lt;b&gt;tarjeta/);
 assert.throws(()=>tenderSummaryHtml({totalCents:801,cashPartCents:802,receivedCents:1000}));
 const missing=tenderSummaryHtml({totalCents:801,cashPartCents:801,receivedCents:500});assert.match(missing,/Falta por entregar.*3,01/);
});
