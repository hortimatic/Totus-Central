import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESTASHOP_STORES,storeConnection,prestashopPage,prestashopRows} from '../src/prestashop-readonly.js';
import {readPrestashopPage} from '../supabase/functions/totus-connections/prestashop.js';
const base={id:'11111111-1111-4111-8111-111111111111',protocol:'prestashop',name:'PrestaShop · Hortimatic',endpoint:'https://example.com/api',secret:'fixture-secret',auth_kind:'basic',enabled:true,revision:3,verified_revision:3,real_data_authorized:true};
const resolve=async()=>['8.8.8.8'];

test('PrestaShop 1.7 empty root collection is valid; malformed responses still fail',async()=>{
 assert.deepEqual(prestashopRows([],'orders',100),{rows:[],possibly_more:false});
 for(const payload of [{},null,{errors:[]},[{id:1}],{products:[]}])assert.throws(()=>prestashopRows(payload,'orders',100),/no compatible/);
 const result=await readPrestashopPage(base,{store:'hortimatic',resource:'orders',page:1,page_size:100},{resolve,request:async()=>Response.json([])});
 assert.equal(result.rows.length,0);assert.equal(result.possibly_more,false);
});
test('two distinct store identities, no fuzzy matching or accidental cross-store links',()=>{
 assert.equal(PRESTASHOP_STORES.length,2);
 assert.equal(storeConnection([base],'hortimatic'),base);
 assert.equal(storeConnection([base],'newoldsmok'),null);
 assert.equal(storeConnection([{...base,name:'Hortimatic'}],'hortimatic'),null);
 assert.equal(storeConnection([base,base],'hortimatic'),null);
});
test('only known read resources and bounded pages are accepted',()=>{
 assert.deepEqual(prestashopPage('orders',0,25).offset,0);
 assert.equal(prestashopPage('stock_availables',2,100).offset,200);
 assert.equal(prestashopPage('stock_movements',1,25).offset,25);
 for(const [resource,page,size] of [['products;DROP TABLE',0,25],['orders',-1,25],['orders',1001,25],['orders',0,0],['orders',0,101],['orders','0',25]])assert.throws(()=>prestashopPage(resource,page,size));
});
test('stock movements include signed quantity and reason without inventing a supplier receipt',()=>{
 const result=prestashopRows({stock_movements:[{id:7,id_product:20,physical_quantity:3,sign:1,id_stock_mvt_reason:9,date_add:'2026-11-03 12:00:00',supplier_invoice:'never'}]},'stock_movements',25);
 assert.equal(result.rows[0].physical_quantity,'3');
 assert.equal(result.rows[0].sign,'1');
 assert.equal(result.rows[0].supplier_invoice,undefined);
});
test('normalizes strictly whitelisted fields and never returns customer data or duplicate rows',()=>{
 const parsed=prestashopRows({orders:[{id:1,reference:'A',date_add:'2026-11-03 11:00:00',payment:'Tarjeta',total_paid_tax_incl:'12.30',customer_id:42,email:'secret@example.com'}]},'orders',25);
 assert.equal(parsed.rows[0].total_paid_tax_incl,'12.30');
 assert.equal(parsed.rows[0].customer_id,undefined);
 assert.equal(parsed.rows[0].email,undefined);
 assert.equal(parsed.possibly_more,false);
 assert.throws(()=>prestashopRows({orders:[{id:1},{id:1}]},'orders',25),/duplicada/);
});
test('request uses server-side Basic credentials, paginates and does not return keys',async()=>{
 let called=0;
 const result=await readPrestashopPage(base,{store:'hortimatic',resource:'orders',page:1,page_size:2},{resolve,request:async(url,init)=>{
  called++;const u=new URL(url);
  assert.equal(u.pathname,'/api/orders');assert.equal(u.searchParams.get('limit'),'2,2');
  assert.match(u.searchParams.get('display'),/^\[id,reference,date_add,payment,total_paid_tax_incl,/);
  assert(!url.includes(base.secret));assert.equal(init.headers.Authorization,'Basic '+btoa(base.secret+':'));
  assert.equal(init.method,'GET');assert.equal(init.redirect,'error');
  return Response.json({orders:[{id:'3',total_paid_tax_incl:'9.99'},{id:'4',total_paid_tax_incl:'6.10'}]});
 }});
 assert.equal(called,1);assert.equal(result.rows.length,2);
 assert.equal(result.possibly_more,true);
 assert(!JSON.stringify(result).includes(base.secret));
});
test('fail closed on wrong store, stale session, missing permission, unsafe endpoint and forbidden resource',async()=>{
 let calls=0;const request=async()=>{calls++;return Response.json({orders:[]});};
 for(const [connection,input] of [
 [base,{store:'newoldsmok',resource:'orders',page:0,page_size:25}],
 [{...base,verified_revision:2},{store:'hortimatic',resource:'orders',page:0,page_size:25}],
 [{...base,real_data_authorized:false},{store:'hortimatic',resource:'orders',page:0,page_size:25}],
 [{...base,endpoint:'http://localhost/api'},{store:'hortimatic',resource:'orders',page:0,page_size:25}],
 [base,{store:'hortimatic',resource:'arbitrary_sql',page:0,page_size:25}]
 ])await assert.rejects(readPrestashopPage(connection,input,{request,resolve}));
 assert.equal(calls,0);
});
test('bad provider responses do not produce fake empty results',async()=>{
 for(const response of [new Response('<html>Login</html>',{headers:{'content-type':'text/html'}}),Response.json({some_other_resource:[]}),new Response('',{status:401})])await assert.rejects(readPrestashopPage(base,{store:'hortimatic',resource:'orders',page:0,page_size:25},{resolve,request:async()=>response}));
});
