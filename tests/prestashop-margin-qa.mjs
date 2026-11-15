import assert from 'node:assert/strict';
import {approximateOrderMargin as calculate} from '../src/prestashop-margin.js';
const order={total_paid_tax_excl:'110',total_shipping_tax_excl:'8',total_wrapping_tax_excl:'2'};
const detail={rows:[{product_quantity:'2',purchase_supplier_price:'3.90',original_wholesale_price:'3'},{product_quantity:'1',purchase_supplier_price:'0',original_wholesale_price:'2.50'}],possibly_more:false};
let result=calculate(order,detail);
assert.equal(result.complete,true);assert.equal(result.revenue,100);assert.equal(result.cost,10.3);assert.equal(result.margin,89.7);assert.equal(result.percent,89.7);
assert.equal(calculate(order,{...detail,possibly_more:true}).margin,null);
assert.equal(calculate(order,{rows:[{product_quantity:1,purchase_supplier_price:0,original_wholesale_price:0}]}).margin,null);
assert.equal(calculate({...order,total_paid_tax_excl:''},detail).margin,null);
assert.equal(calculate(order,{rows:[]}).margin,null);
assert(calculate({...order,total_paid_tax_excl:'5'},detail).margin<0);
assert.equal(calculate({...order,total_paid_tax_excl:'10'},detail).percent,null);
console.log('Approximate margins: costs, quantities, fallback, VAT/shipping exclusion, incomplete data, zero costs and losses OK');

assert.equal(calculate(order,{rows:[{product_quantity:'2',current_wholesale_price:'3.90',purchase_supplier_price:'3'}]}).cost,7.8);
assert.equal(calculate(order,{rows:[{product_quantity:'1',current_wholesale_price:'0'}]}).cost,0);

const {approximateOrderGain}=await import('../src/prestashop-margin.js');
const gain=approximateOrderGain({...order,total_paid_tax_incl:'20'},{rows:[{product_quantity:'1',current_wholesale_price:'10'}]},{vat:21,re:5.2});assert(Math.abs(gain.cost-12.62)<1e-9);assert(Math.abs(gain.margin-7.38)<1e-9);assert.equal(approximateOrderGain(order,detail,{vat:21,re:5.2}).complete,false);assert.equal(approximateOrderGain({...order,total_paid_tax_incl:'5'},detail,{vat:21,re:5.2}).margin<0,true);assert.equal(approximateOrderGain({...order,total_paid_tax_incl:'20'},detail,{vat:null,re:5.2}).complete,false);
