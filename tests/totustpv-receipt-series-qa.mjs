import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptSeries,receiptSeriesFromForm,receiptSeriesHtml,receiptNumber} from '../src/totustpv/receipt-series.js';
import {receiptHtml} from '../src/totustpv/documents.js';
const defaults={enabled:false,salePrefix:'V',returnPrefix:'D',lastSaleNumber:0,lastReturnNumber:0};
test('receipt settings preserve typed counters and prefixes and reject ambiguous data',()=>{
 assert.deepEqual(receiptSeries(defaults),defaults);for(const value of [null,{},[],{...defaults,enabled:1},{...defaults,salePrefix:'<script>'},{...defaults,lastSaleNumber:1.5},{...defaults,lastReturnNumber:-1},{...defaults,lastSaleNumber:1000000000},{...defaults,actorId:'foreign'}])assert.throws(()=>receiptSeries(value));
 const fields=new Map([['series-enabled','on'],['series-salePrefix','V-'],['series-returnPrefix','D/'],['series-lastSaleNumber','123'],['series-lastReturnNumber','9']]);assert.deepEqual(receiptSeriesFromForm(fields),{enabled:true,salePrefix:'V-',returnPrefix:'D/',lastSaleNumber:123,lastReturnNumber:9});
 fields.set('series-lastSaleNumber','1e2');assert.throws(()=>receiptSeriesFromForm(fields));
 assert.equal(receiptSeriesHtml(defaults,false).includes('Guardar numeración'),false);assert.match(receiptSeriesHtml(defaults,true),/Guardar numeración/);
});
test('historical receipt identities require exact prefix and number binding',()=>{
 const value={kind:'sale',prefix:'V-',number:41,label:'V-41'};assert.deepEqual(receiptNumber(value),value);assert.equal(receiptNumber(undefined),null);
 for(const patch of [{label:'V-42'},{prefix:'<x>'},{kind:'invoice'},{number:0},{number:'41'}])assert.throws(()=>receiptNumber({...value,...patch}));
});
test('receipt and gift print the immutable ticket identity alongside the native order reference',()=>{
 const document={existing_document:true,kind:'receipt',currency:'EUR',order_id:42,reference:'QA-42',created_at:'2026-11-17 12:00:00',merchant:{name:'Tienda ficticia'},lines:[],total_cents:0,payments:{},ticket_number:{kind:'sale',number:41,prefix:'V-',label:'V-41'}};
 for(const kind of ['receipt','gift']){const html=receiptHtml({...document,kind});assert.match(html,/Ticket V-41/);assert.match(html,/Pedido #42/);assert.match(html,/QA-42/);}
 assert.doesNotMatch(receiptHtml({...document,ticket_number:null}),/Ticket V-41/);
 assert.throws(()=>receiptHtml({...document,ticket_number:{...document.ticket_number,label:'forged'}}),/TPV_RECEIPT_NUMBER_INVALID/);
});
