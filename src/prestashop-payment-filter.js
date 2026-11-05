const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
export const PAYMENT_CHOICES=[['cash','Efectivo'],['card','Tarjeta'],['bizum','Bizum'],['transfer','Transferencia'],['paypal','PayPal'],['cod','Contra reembolso'],['unknown','Sin informar']];
export function paymentFilterKey(value){
 const name=normalized(value);if(!name)return 'unknown';
 if(/bizum/.test(name))return 'bizum';
 if(/transferencia|bank transfer|bank wire|wire transfer/.test(name))return 'transfer';
 if(/paypal/.test(name))return 'paypal';
 if(/contra\s?reembolso|cash on delivery/.test(name))return 'cod';
 if(/efectivo|metalico|^cash$/.test(name))return 'cash';
 if(/tarjeta|credit card|debit card|visa|mastercard/.test(name))return 'card';
 return 'raw:'+name;
}
export function paymentFilterChoices(rows,selected=[]){
 const choices=new Map(PAYMENT_CHOICES);
 for(const row of rows||[]){const key=paymentFilterKey(row.payment);if(!choices.has(key))choices.set(key,String(row.payment).trim());}
 for(const key of selected)if(!choices.has(key))choices.set(key,key.replace(/^raw:/,''));
 return [...choices];
}
export function matchesPaymentFilter(payment,selected=[]){return selected.length===0||selected.includes(paymentFilterKey(payment));}
