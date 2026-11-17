import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueSearchFields,searchPreferences,searchPreferencesFromForm,searchPreferencesHtml,DEFAULT_SEARCH_FIELDS} from '../src/totustpv/search-preferences.js';
import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';
test('search criteria are a bounded unique allowlist with stable order',()=>{
 assert.deepEqual(catalogueSearchFields(),DEFAULT_SEARCH_FIELDS);assert.deepEqual(catalogueSearchFields(['name','isbn','reference']),['reference','isbn','name']);
 for(const fields of [[],['isbn','isbn'],['reference;drop'],['toString'],[null],null,'isbn'])assert.throws(()=>catalogueSearchFields(fields));
 assert.deepEqual(searchPreferences({fields:['isbn'],numericKeyboard:true}),{fields:['isbn'],numericKeyboard:true});
 assert.throws(()=>searchPreferences({fields:['isbn'],numericKeyboard:'true'}));assert.throws(()=>searchPreferences({actorId:'other'}));
});
test('multiple checkboxes survive form capture, and empty selection stays visible until corrected',()=>{
 const form=new FormData();form.append('searchFields','isbn');form.append('searchFields','name');form.set('numericKeyboard','on');
 assert.deepEqual(searchPreferencesFromForm(form),{fields:['isbn','name'],numericKeyboard:true});
 assert.deepEqual(searchPreferencesFromForm(new Map([['searchFields',['isbn','name']],['numericKeyboard','on']])),searchPreferencesFromForm(form));
 assert.throws(()=>searchPreferencesFromForm(new FormData()));
 const html=searchPreferencesHtml({fields:[],numericKeyboard:true});assert.equal((html.match(/value="[a-z0-9]+" checked/g)||[]).length,0);assert.match(html,/name="numericKeyboard" checked/);
});
test('a custom search requires explicit native confirmation; older connections cannot silently ignore it',async()=>{
 let observed,echo;const values=new Map(),adapter=createCentralTpvAdapter({actorId:'actor',storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
  uuid:()=>crypto.randomUUID(),invoke:async body=>{if(body.action==='context')return {actorId:'actor',workstations:[{environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canOpen:true,canSell:true,canReconcile:true,session:{id:'session',status:'open'}}]};
   assert.equal(body.action,'catalogue');observed=body;return {items:[],currency:'EUR',payable_cart_quote:false,...(echo?{search_fields:echo}:{})};}});
 await adapter.context();await adapter.selectSession({id:'session',storeId:'store',drawerId:'drawer'});
 await adapter.searchProducts();assert.deepEqual(observed.searchFields,DEFAULT_SEARCH_FIELDS);
 await assert.rejects(adapter.searchProducts({searchFields:['isbn']}),/criterios/);
 echo=['isbn'];await adapter.searchProducts({search:'9780306406157',searchFields:['isbn']});assert.deepEqual(observed.searchFields,['isbn']);
 echo=['name'];await assert.rejects(adapter.searchProducts({searchFields:['isbn']}),/criterios/);
});
