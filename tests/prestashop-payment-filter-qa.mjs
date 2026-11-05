import assert from 'node:assert/strict';
import {paymentFilterKey,paymentFilterChoices,matchesPaymentFilter} from '../src/prestashop-payment-filter.js';
for(const [name,key] of [['Bizum','bizum'],['Pago con Bizum / Redsys','bizum'],['Transferencia bancaria','transfer'],['Bank wire','transfer'],['Tarjeta de crédito','card'],['Metálico','cash'],['PayPal','paypal'],['Contra reembolso','cod'],['','unknown'],['Pago especial','raw:pago especial']])assert.equal(paymentFilterKey(name),key);
const methods=paymentFilterChoices([{payment:'Pago especial'}]);assert(methods.some(([id])=>id==='bizum'));assert(methods.some(([id])=>id==='transfer'));assert(methods.some(([id])=>id==='raw:pago especial'));
assert(matchesPaymentFilter('Transferencia bancaria',['bizum','transfer']));assert(matchesPaymentFilter('BIZUM',['bizum','transfer']));assert(!matchesPaymentFilter('Tarjeta',['bizum','transfer']));assert(matchesPaymentFilter('Tarjeta',[]));
assert(paymentFilterChoices([],["raw:otro pago"]).some(([id])=>id==='raw:otro pago'));
console.log('Payment filters: common methods, original provider names, multiple OR selection and all payments OK');
