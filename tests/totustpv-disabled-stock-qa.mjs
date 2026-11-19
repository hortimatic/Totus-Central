import test from 'node:test';import assert from 'node:assert/strict';
import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';import {catalogueForActor} from '../supabase/functions/totus-tpv/handler.js';
test('disabled inventory needs explicit native acknowledgement and per-item sale state',async()=>{
 let response={items:[],inventory_only:true},last;const saved=new Map();
 const adapter=createCentralTpvAdapter({actorId:'actor',storage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},invoke:async input=>{
  if(input.action==='context')return {actorId:'actor',workstations:[{environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true}]};last=input;return {currency:'EUR',payable_cart_quote:false,...response};
 }});
 await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});
 response={items:[{id:'101:0',product_id:101,name:'Deshabilitado',enabled_for_sale:false}],inventory_only:true};
 const result=await adapter.searchProducts({inventoryOnly:true});assert.equal(last.inventoryOnly,true);assert.equal(result[0].saleEnabled,false);
 for(const patch of [{inventory_only:undefined},{inventory_only:false},{items:[{id:'101:0'}]},{items:[{enabled_for_sale:'false'}]}]){
  const base=response;response={...response,...patch};await assert.rejects(adapter.searchProducts({inventoryOnly:true}),/reposición/);response=base;
 }
 await assert.rejects(adapter.searchProducts(),/reposición/,'A sales lookup cannot accept an inventory response');
 response={items:[{id:'101:0',name:'Habilitado',enabled_for_sale:true}],inventory_only:false};
 assert.equal((await adapter.searchProducts())[0].saleEnabled,true);assert.equal(last.inventoryOnly,undefined);
 await assert.rejects(adapter.searchProducts({inventoryOnly:'true'}));
});
test('inventory sale state is a strict boolean and never exposes private native fields',()=>{
 const source={items:[{id:'101:0',enabled_for_sale:false,private_payload:'omit',cost_base_cents:50}]};
 assert.deepEqual(catalogueForActor(source,false).items,[{id:'101:0',enabled_for_sale:false}]);
 for(const enabled_for_sale of [null,0,'false'])assert.throws(()=>catalogueForActor({items:[{enabled_for_sale}]},true),/TPV_CATALOGUE_INVALID/);
});
