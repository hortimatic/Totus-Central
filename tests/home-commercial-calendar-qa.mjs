import assert from 'node:assert/strict';
import {test} from 'node:test';
import {commercialMarginSummary,commercialMarginWidget,commercialMarginChart} from '../src/home-current-margin.js';
import {calendarRange,calendarShift} from '../src/home-task-calendar.js';
const row=(margin_value,extra={})=>({id:'1',valid:'1',currency_code:'EUR',margin_value,date_add:'2026-11-12 12:00:00',...extra});
test('commercial margin includes both stores without merging their local IDs and keeps negative margins',()=>{
 const s=commercialMarginSummary({hortimatic:{complete:true,rows:[row(4.20),row(-2.10,{id:'2'})]},newoldsmok:{complete:true,rows:[row(1.20)]}},{from:'2026-11-11',to:'2026-11-12'});
 assert.equal(s.amount,3.30);assert.equal(s.count,3);assert.equal(s.covered,3);assert(s.complete);assert.deepEqual(s.series,[{date:'2026-11-11',value:0},{date:'2026-11-12',value:3.30}]);assert.match(commercialMarginChart(s),/polyline/);
});
test('unknown costs, currency, status and incomplete pages do not become a complete total or graph',()=>{
 for(const read of [{complete:false,rows:[row(1)]},{complete:true,rows:[row(null)]},{complete:true,rows:[row(1,{currency_code:'USD'})]},{complete:true,rows:[row(1,{valid:undefined})]}]){const s=commercialMarginSummary({hortimatic:read});assert.equal(s.complete,false);assert.equal(commercialMarginChart(s),'');}
 const s=commercialMarginSummary({hortimatic:{complete:true,rows:[row(4)]},newoldsmok:undefined});assert.equal(s.amount,4);assert.equal(s.pending,1);assert(!s.complete);
});
test('empty complete query is zero, while an unqueried store and errors are explicit',()=>{
 assert.equal(commercialMarginSummary({hortimatic:{complete:true,rows:[]}}).amount,0);assert(commercialMarginSummary({hortimatic:{complete:true,rows:[]}}).complete);
 assert(!commercialMarginSummary({}).complete);assert.match(commercialMarginWidget({hortimatic:{error:'Sin acceso'}},{id:'x',from:'2026-11-11',to:'2026-11-12'}),/Sin acceso/);
 assert.match(commercialMarginWidget({hortimatic:{complete:true,rows:[row(-5)]}},{id:'x',from:'2026-11-12',to:'2026-11-12'}),/No es beneficio neto/);
});
test('order cents, store totals and daily chart use the same rounding, including losses',()=>{
 const s=commercialMarginSummary({hortimatic:{complete:true,rows:[row(1.005),row(-0.005)]},newoldsmok:{complete:true,rows:[row(0.005)]}});
 assert.equal(s.amount,1.01);assert.equal(s.series[0].value,1.01);assert.equal(s.stores.reduce((n,r)=>n+Math.round(r.amount*100),0),101);
 assert.equal(commercialMarginSummary({hortimatic:{complete:true,rows:[row(1e20)]}}).complete,false);
});
test('day/week/month calendar handles leap years and month end without rolling into an unrelated month',()=>{
 assert.deepEqual(calendarRange('2026-11-12','day'),{from:'2026-11-12',to:'2026-11-12'});assert.deepEqual(calendarRange('2026-11-12','week'),{from:'2026-11-09',to:'2026-11-15'});
 assert.equal(calendarShift('2024-01-31','month',1),'2024-02-29');assert.equal(calendarShift('2026-03-31','month',-1),'2026-02-28');assert.equal(calendarShift('2026-12-31','day',1),'2027-01-01');
});
