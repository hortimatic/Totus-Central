import test from 'node:test';import assert from 'node:assert/strict';
import {cashVisibility,cashVisibilityHtml,cashSummaryPresentation} from '../src/totustpv/cash-visibility.js';
import {cashReportHtml} from '../src/totustpv/cash-reports.js';
test('drawer visibility accepts only the explicit boolean and reflects the current permission',()=>{
 assert.deepEqual(cashVisibility({hideSummary:true}),{hideSummary:true});for(const v of [undefined,null,{},[],{hideSummary:1},{hideSummary:'true'},{hideSummary:true,actorId:'forged'}])assert.throws(()=>cashVisibility(v));
 assert.match(cashVisibilityHtml({hideSummary:true},false),/checked disabled/);assert.doesNotMatch(cashVisibilityHtml({hideSummary:false},false),/Guardar visibilidad/);
});
test('hidden financial summaries retain lifecycle flags and never fabricate a zero balance',()=>{
 const value=cashSummaryPresentation({sessionId:'s',status:'open',cashSummaryHidden:true,pendingSales:1,pendingRefunds:2,expectedCashCents:10055,countedCents:10050,payments:{cash:9999},secret:'private'});
 assert.deepEqual(value,{sessionId:'s',status:'open',pendingSales:1,pendingRefunds:2,cashSummaryHidden:true,unresolved:3});assert.throws(()=>cashSummaryPresentation({cashSummaryHidden:'true'}));
});
test('ordinary cash summary preserves the previous calculations exactly',()=>{
 const value=cashSummaryPresentation({payments:{cash:801,card:1602},refunds:{cash:100},countedCents:11000,expectedCashCents:11001});assert.equal(value.salesCents,2403);assert.equal(value.cashCents,801);assert.equal(value.refundCashCents,100);assert.equal(value.differenceCents,-1);
});
test('hidden printable reports omit all amounts, movements and observations even from an overfull reply',()=>{
 const html=cashReportHtml({currency:'EUR',environment:'qa',status:'closed',cashSummaryHidden:true,storeName:'<Tienda>',drawerName:'Caja',expectedCashCents:10055,countedCents:10050,differenceCents:-5,note:'SECRET',movements:[{amountCents:55,reason:'SECRET'}]});assert.match(html,/importes.*ocultos/);assert.doesNotMatch(html,/€|NaN|SECRET|Efectivo esperado/);assert.match(html,/&lt;Tienda&gt;/);
});
