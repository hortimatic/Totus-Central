import assert from 'node:assert/strict';
import test from 'node:test';
import {createCustomerDisplay,customerDisplayOptions,customerDisplayView,customerDisplayOptionsFromForm} from '../src/totustpv/customer-display.js';
test('customer display options fail closed for activation and customer names and constrain style values',()=>{
 assert.deepEqual(customerDisplayOptions(),{enabled:false,showPrices:true,showCustomer:false,color:'#1773c9',fontSize:23});
 assert.equal(customerDisplayOptions({enabled:'true',showCustomer:'true',color:'url(evil)',fontSize:100}).enabled,false);
 assert.equal(customerDisplayOptions({color:'#ABCDEF',fontSize:14}).color,'#abcdef');
 const fields=new Map([['customer-display-enabled','on'],['customer-display-fontSize','40'],['customer-display-color','#abcdef']]);
 assert.deepEqual(customerDisplayOptionsFromForm(fields),{enabled:true,showPrices:false,showCustomer:false,color:'#abcdef',fontSize:40});
});
test('the public-facing projection excludes identities, contact and payment details and respects current customer permission',()=>{
 const state={phase:'verified',storeName:'Mi tienda',environment:'qa',customerName:'Nombre ficticio',customerId:17,email:'never@example.invalid',address:'Nunca visible',secret:'NEVER',totalCents:1234,
  lines:[{name:'Artículo ficticio',quantity:2,cents:1234,productId:8,secret:'NEVER'}]};
 const view=customerDisplayView(state,{showCustomer:true},{canShowCustomer:true});assert.equal(view.customerName,'Nombre ficticio');assert.equal(view.totalCents,1234);
 for(const forbidden of ['email','address','customerId','productId','secret','NEVER'])assert.equal(JSON.stringify(view).includes(forbidden),false);
 assert.equal(customerDisplayView(state,{showCustomer:true},{canShowCustomer:false}).customerName,'');
 const noPrices=customerDisplayView({...state,discountCents:100},{showPrices:false,showCustomer:true},{canShowCustomer:true});assert.equal(noPrices.totalCents,null);assert.equal(noPrices.lines[0].cents,null);assert.equal(noPrices.discountCents,null);
 for(const phase of ['idle','confirmed','uncertain'])assert.equal(customerDisplayView({...state,phase},{showCustomer:true},{canShowCustomer:true}).customerName,'');
 const idle=customerDisplayView({...state,phase:'idle'},{});assert.deepEqual(idle.lines,[]);assert.equal(idle.totalCents,null);
});
test('blocked popups give a useful action and a lost session cannot open a public window',()=>{
 let allowed=true,calls=0;const screen=createCustomerDisplay({allowed:()=>allowed,getOptions:()=>({enabled:true}),getState:()=>({}),openWindow:()=>{calls++;return null;}});
 assert.throws(()=>screen.open(),/ventanas emergentes/);assert.equal(calls,1);allowed=false;assert.throws(()=>screen.open(),/Vuelve a entrar/);assert.equal(calls,1);
});
