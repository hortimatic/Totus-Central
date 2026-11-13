import assert from 'node:assert/strict';
import {previewClosing,drawerCashSales} from '../src/cash-closing.js';
import {closingIncomeAmount} from '../src/calculations.js';
for(const delta of [4.7,-4.7]){
 const reading={drawer_id:'qa',opening_cash:100,closing_cash:150+delta,card_sales:100,reported_total_sales:150,cash_discrepancy:delta,cash_discrepancy_reason:'Venta o movimiento pendiente de identificar'};
 const preview=previewClosing([reading],150);
 assert.equal(preview.valid,true);assert.equal(preview.total,150);assert.equal(preview.difference,0);assert.equal(drawerCashSales(preview.drawers[0]),50);assert.equal(preview.drawers[0].closing_cash,150+delta);
 assert.equal(closingIncomeAmount({status:'cerrado',cash_sales:50,card_sales:100}),150,'Unexplained cash is not another sale');
 assert.equal(previewClosing([{...reading,cash_discrepancy_reason:''}],150).valid,false);
 assert.equal(previewClosing([{...reading,reported_total_sales:''}],150).valid,false);
 assert.equal(previewClosing([{...reading,cash_discrepancy:4.711}],150).valid,false);
}
assert.equal(previewClosing([{opening_cash:100,closing_cash:150,reported_total_sales:50}],50).total,50,'Existing balanced close unchanged');
console.log('Pending cash: positive/negative, physical carry, recognised sales, explanation and precision PASS.');
