import test from 'node:test';import assert from 'node:assert/strict';
import {paymentOptions,paymentChoices,quotePaymentMethods,paymentFormMethods,paymentSettingsHtml,paymentSettingsFromForm} from '../src/totustpv/payment-options.js';

test('drawer settings preserve typed labels and chosen order; read-only controls and output escape names',()=>{
 const fields=new Map([['enabled:card','on'],['enabled:cash','on'],['label:card','Datáfono'],['label:cash','Caja & mostrador'],['position:card','0'],['position:cash','1']]);
 const options=paymentSettingsFromForm(fields,['cash','card']);assert.deepEqual(options.enabledMethods,['card','cash']);
 const html=paymentSettingsHtml({options},false);assert.match(html,/fieldset disabled/);assert.match(html,/Caja &amp; mostrador/);
 assert.match(paymentSettingsHtml({options},true),/Guardar medios de cobro/);
 fields.set('position:cash','0');assert.throws(()=>paymentSettingsFromForm(fields,['cash','card']));
});

test('mixed tender only appears when cash and another authorized method coexist',()=>{
 assert.deepEqual(paymentFormMethods(['card']),['card']);
 assert.deepEqual(paymentFormMethods(['cash']),['cash']);
 assert.deepEqual(paymentFormMethods(['bizum','card']),['bizum','card']);
 assert.deepEqual(paymentFormMethods(['card','cash']),['card','cash','mixed']);
 for(const methods of [[],['mixed'],['cash','cash'],null])assert.throws(()=>paymentFormMethods(methods));
});

test('the counter follows the prepared server policy rather than every installed native method',()=>{
 const nativePaymentLabels={cash:'Cash',card:'Card',bizum:'Bizum'};
 assert.deepEqual(quotePaymentMethods({nativePaymentLabels,operatorPaymentPolicy:{enabled:true,modes:{bizum:'external-receipt',card:'external-terminal'}}}),['bizum','card']);
 assert.deepEqual(quotePaymentMethods({nativePaymentLabels}),['cash','card','bizum']);
 assert.deepEqual(quotePaymentMethods({nativePaymentLabels,operatorPaymentPolicy:{enabled:true,methodOrder:['cash','card'],modes:{card:'external-terminal',cash:'cash-in-hand'}}}),['cash','card'],'JSONB object key sorting cannot change counter order');
 assert.throws(()=>quotePaymentMethods({nativePaymentLabels,operatorPaymentPolicy:{enabled:true,methodOrder:['cash','cash'],modes:{card:'external-terminal',cash:'cash-in-hand'}}}));
 for(const policy of [null,{enabled:false,modes:{cash:'cash-in-hand'}},{enabled:true,modes:{}},{enabled:true,modes:{transfer:'external-receipt'}},{enabled:true,modes:{card:'bank-confirmed'}}])assert.throws(()=>quotePaymentMethods({nativePaymentLabels,operatorPaymentPolicy:policy}));
});
test('a box can accept cash only or external payment only without inventing native support',()=>{
 const native={cash:'Efectivo nativo',card:'Tarjeta nativa'};
 assert.deepEqual(paymentChoices({enabledMethods:['cash']},native),[{id:'cash',label:'Efectivo',nativeLabel:native.cash}]);
 assert.deepEqual(paymentChoices({enabledMethods:['card']},native).map(row=>row.id),['card']);
 assert.throws(()=>paymentChoices({enabledMethods:['transfer']},native));assert.throws(()=>paymentOptions({enabledMethods:[]}));
});
test('configured order and counter labels preserve the original native method identity',()=>{
 const native={cash:'Cash',card:'Card',bizum:'Bizum'};
 const options={enabledMethods:['bizum','cash','card'],labels:{cash:'  Efectivo en caja ',card:'Datáfono',bizum:'Bizum'}};
 const rows=paymentChoices(options,native);assert.deepEqual(rows.map(row=>row.id),options.enabledMethods);assert.equal(rows[1].label,'Efectivo en caja');assert.equal(rows[1].nativeLabel,'Cash');
 assert.equal(options.labels.cash,'  Efectivo en caja ');
});
test('untyped options, duplicate methods, ambiguous names and unsupported fields fail closed',()=>{
 for(const value of [{enabledMethods:null},{labels:null},{labels:{cash:null}}])assert.throws(()=>paymentOptions(value));
 for(const value of [null,[],{enabledMethods:['cash','cash']},{enabledMethods:['cheque']},{enabledMethods:'cash'},{labels:{cash:''}},{labels:{cash:'Tarjeta',card:'tarjeta'}},{labels:{cash:'<script>'}},{labels:{cash:'x\u0000'}},{labels:{cash:'x'.repeat(41)}},{labels:{cheque:'Cheque'}},{bankConfirmed:true}])assert.throws(()=>paymentOptions(value));
 assert.throws(()=>paymentChoices(undefined,{}));assert.throws(()=>paymentChoices(undefined,{cash:1}));
});
