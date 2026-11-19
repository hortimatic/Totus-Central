import test from 'node:test';import assert from 'node:assert/strict';import {originalRefundPayments,requireOriginalRefundPayments} from '../src/totustpv/refund-payments.js';
test('original mixed refunds allocate every cent within original remaining balances',()=>{
 assert.deepEqual(originalRefundPayments(401,{cash:400,card:401}),[{method:'cash',amountCents:200},{method:'card',amountCents:201}]);
 assert.deepEqual(originalRefundPayments(1,{cash:1,card:1}),[{method:'cash',amountCents:1}]);assert.deepEqual(originalRefundPayments(0,{}),[]);
 for(let n=1;n<=4000;n++){const caps={cash:n%43,card:n%61,bizum:n%11,transfer:n%7},sum=Object.values(caps).reduce((a,b)=>a+b,0),total=n%(sum+1),rows=originalRefundPayments(total,caps);assert.equal(rows.reduce((a,b)=>a+b.amountCents,0),total);for(const row of rows){assert.ok(row.amountCents>0&&row.amountCents<=caps[row.method]);assert.ok(Math.abs(row.amountCents-total*caps[row.method]/sum)<1);}assert.deepEqual(originalRefundPayments(sum,caps),Object.entries(caps).filter(([,n])=>n>0).map(([method,amountCents])=>({method,amountCents})));}
 for(const [total,caps] of [[2,{cash:1}],[-1,{}],[1,{cash:1.5}],[1,{cheque:1}],[1,{cash:'1'}]])assert.throws(()=>originalRefundPayments(total,caps));
 requireOriginalRefundPayments({requireOriginalPayment:false},[],1,{});assert.throws(()=>requireOriginalRefundPayments({requireOriginalPayment:true},[{method:'card',amountCents:401}],401,{cash:400,card:401}),/ORIGINAL_PAYMENT_REQUIRED/);
});
