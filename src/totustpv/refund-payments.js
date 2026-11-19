const methods=['cash','card','bizum','transfer'];
const valid=n=>Number.isSafeInteger(n)&&n>=0;
/** Largest remainders, using integer cents and the verified remaining balances. */
export function originalRefundPayments(total,balances){
 if(!valid(total)||!balances||typeof balances!=='object'||Array.isArray(balances)||Object.keys(balances).some(k=>!methods.includes(k))||Object.values(balances).some(n=>!valid(n)))throw Error('TPV_REFUND_PAYMENT_INVALID');
 const rows=methods.map((method,index)=>({method,index,cap:balances[method]||0})),sum=rows.reduce((n,r)=>n+BigInt(r.cap),0n);
 if(BigInt(total)>sum)throw Error('TPV_REFUND_PAYMENT_INVALID');
 if(total===0)return [];
 for(const row of rows){const amount=BigInt(total)*BigInt(row.cap);row.amount=Number(amount/sum);row.remainder=amount%sum;}
 let remainder=total-rows.reduce((n,r)=>n+r.amount,0);
 for(const row of [...rows].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1))if(remainder>0&&row.amount<row.cap){row.amount++;remainder--;}
 if(remainder!==0)throw Error('TPV_REFUND_PAYMENT_INVALID');
 return rows.filter(r=>r.amount>0).map(r=>({method:r.method,amountCents:r.amount}));
}
export function requireOriginalRefundPayments(policy,payments,total,balances){
 if(policy?.requireOriginalPayment!==true)return;
 const expected=originalRefundPayments(total,balances);
 if(!Array.isArray(payments)||payments.length!==expected.length||expected.some(e=>!payments.some(p=>p.method===e.method&&p.amountCents===e.amountCents)))throw Error('TPV_REFUND_ORIGINAL_PAYMENT_REQUIRED');
}
