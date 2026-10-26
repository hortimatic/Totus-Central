import assert from 'node:assert/strict';
import {expenseTotals} from '../src/expense-totals.js';
assert.deepEqual(expenseTotals([{base_amount:100,vat_rate:21,re_rate:5.2,withholding_rate:19}]),{base:100,vat:21,re:5.2,withholding:19,cost:126.2,total:107.2});
assert.equal(expenseTotals([{base_amount:-10,vat_rate:21,re_rate:5.2}]).total,-12.62);
for(const sign of [1,-1]){
 const rows=[{base_amount:sign*.03,vat_rate:21},{base_amount:sign*.03,vat_rate:21}];
 assert.equal(expenseTotals(rows).total,sign*.08,'Round each tax line as PostgreSQL numeric does');
 assert.equal(expenseTotals([{base_amount:sign*.05,vat_rate:10}]).vat,sign*.01,'Half cents round away from zero');
}
assert.equal(expenseTotals([]).total,0);
console.log('EXPENSE TOTALS QA: cost versus payable, credits, per-line cents and signed half-cents');
