import test from 'node:test';
import assert from 'node:assert/strict';
import {productCountryTaxRate,productDisplayAmounts} from '../src/productos-tax.js';
test('retail display uses verified country/rule/tax IDs, never a name or hard-coded rate',()=>{
 const data={countries:[{id:'6',iso_code:'ES',active:'1'}],rules:[{id_tax_rules_group:'53',id_country:'6',id_state:'0',zipcode_from:'0',zipcode_to:'0',id_tax:'8'}],taxes:[{id:'8',rate:'21',active:'1'}]};
 assert.equal(productCountryTaxRate('53',data),21);
 const amount=productDisplayAmounts({price:'31.809917',wholesale_price:'18.53'},21);
 assert.equal(amount.gross.toFixed(2),'38.49');
 assert.equal(productCountryTaxRate('54',data),null);
 assert.equal(productCountryTaxRate('53',{...data,rules:[{...data.rules[0],id_state:'7'}]}),null);
 assert.equal(productCountryTaxRate('53',{...data,rules:[...data.rules,...data.rules]}),null);
 assert.equal(productCountryTaxRate('0'),0);
 assert.equal(productDisplayAmounts({price:'10',wholesale_price:'0'},null).gross,null);
 assert.equal(productDisplayAmounts({},21).cost,null);
});
