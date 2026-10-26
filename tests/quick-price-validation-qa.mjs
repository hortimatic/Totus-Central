import assert from 'node:assert/strict';
import {parseDecimal,quickPriceStudy} from '../src/calculations.js';
for(const invalid of ['12abc','abc','12,3,4','1e3','Infinity','NaN','--1'])
 assert.throws(()=>parseDecimal(invalid),/válido/i,invalid);
assert.equal(parseDecimal('12,50'),12.5);
assert.equal(parseDecimal('12.50'),12.5);
assert.equal(parseDecimal('1.234,50'),1234.5);
assert.equal(parseDecimal('1,234.50'),1234.5);
assert.equal(parseDecimal('1.234'),1.234,'A single separator remains decimal, never silently changes interpretation');
assert.equal(parseDecimal(1e-9),1e-9,'Already numeric values must not lose small finite amounts');
for(const field of ['cost','pvp','competitor','discount','vat','re'])
 assert.throws(()=>quickPriceStudy({cost:10,pvp:20,[field]:-1}),/negativ|entre/i,field);
assert.throws(()=>quickPriceStudy({cost:10,pvp:20,discount:101}),/100/);
assert.throws(()=>quickPriceStudy({cost:Number.MAX_VALUE,pvp:20}),/demasiado grandes/);
const loss=quickPriceStudy({cost:10,pvp:10});
assert(loss.margin<0,'Real negative margins must remain supported');
assert.equal(quickPriceStudy({cost:0,pvp:20,discount:100}).finalSale,0);
console.log('QUICK PRICE VALIDATION QA: no truncated text, non-finite values, negative inputs or out-of-range percentages; valid decimal/grouped amounts, zero and negative profit preserved');
