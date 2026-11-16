import test from 'node:test';
import assert from 'node:assert/strict';
import {cashTenderPreview} from '../src/totustpv/model.js';
test('cash denominations show exact change before confirming and never allocate change to card',()=>{
 assert.deepEqual(cashTenderPreview({totalCents:801,cashPartCents:801,receivedCents:1000}),{
  cashPartCents:801,cardPartCents:0,receivedCents:1000,changeCents:199,missingCents:0,cashCovered:true});
 assert.equal(cashTenderPreview({totalCents:1250,cashPartCents:1250,receivedCents:10000}).changeCents,8750);
 const mixed=cashTenderPreview({totalCents:801,cashPartCents:300,receivedCents:1000});
 assert.equal(mixed.cardPartCents,501);assert.equal(mixed.changeCents,700);
});
test('underpayment remains pending, invalid cents are rejected and card produces no cash change',()=>{
 const short=cashTenderPreview({totalCents:801,cashPartCents:801,receivedCents:500});
 assert.equal(short.cashCovered,false);assert.equal(short.missingCents,301);assert.equal(short.changeCents,0);
 assert.equal(cashTenderPreview({totalCents:801,cashPartCents:0,receivedCents:0}).cardPartCents,801);
 for(const input of [{totalCents:801,cashPartCents:802,receivedCents:1000},
  {totalCents:801,cashPartCents:0,receivedCents:1000},{totalCents:8.01,cashPartCents:801,receivedCents:1000}])assert.throws(()=>cashTenderPreview(input));
});
