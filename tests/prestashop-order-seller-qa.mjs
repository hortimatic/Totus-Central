import test from 'node:test';
import assert from 'node:assert/strict';
import {orderRegistrationEmployee,loadOrderSellers} from '../src/prestashop-order-seller.js';
import {prestashopQuery,PRESTASHOP_RESOURCES} from '../src/prestashop-readonly.js';
import {readPrestashopPage} from '../supabase/functions/totus-connections/prestashop.js';
const order={id:'42',date_add:'2026-11-09 19:38:35'},first={id:'10',id_order:'42',id_employee:'1',date_add:order.date_add};
test('registration employee is not replaced by a later editor or guessed by time',()=>{
 assert.equal(orderRegistrationEmployee(order,[{...first,id:'11',id_employee:'2',date_add:'2026-11-09 20:00:00'},first]),'1');
 assert.equal(orderRegistrationEmployee(order,[{...first,id_employee:'0'},{...first,id:'11',id_employee:'2',date_add:'2026-11-09 20:00:00'}]),null);
 assert.equal(orderRegistrationEmployee(order,[{...first,date_add:'2026-11-09 19:38:36'}]),null);
 assert.equal(orderRegistrationEmployee(order,[first,{...first,id:'11',id_employee:'2'}]),null);
 assert.equal(orderRegistrationEmployee(order,[{...first,id_order:'43'}]),null);
});
test('history is selected by order; employees never expose email or credentials',async()=>{
 assert.throws(()=>prestashopQuery({resource:'order_histories',page:0,page_size:100}));
 assert.throws(()=>prestashopQuery({resource:'employees',page:0,page_size:100}));
 assert.deepEqual(PRESTASHOP_RESOURCES.employees,['id','firstname','lastname']);
 const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',endpoint:'https://example.com/api',secret:'fixture',auth_kind:'basic',enabled:true,revision:3,verified_revision:3,real_data_authorized:true};
 let url;
 const result=await readPrestashopPage(connection,{store:'hortimatic',resource:'order_histories',page:0,page_size:100,order_ids:['42']},{resolve:async()=>['8.8.8.8'],request:async value=>{url=new URL(value);return Response.json({order_histories:[first]});}});
 assert.equal(url.searchParams.get('filter[id_order]'),'[42]');assert.equal(result.rows[0].id_employee,'1');
 await assert.rejects(()=>readPrestashopPage(connection,{store:'hortimatic',resource:'order_histories',page:0,page_size:100,order_ids:['42']},{resolve:async()=>['8.8.8.8'],request:async()=>Response.json({order_histories:[{...first,id_order:'43'}]})}),/ajena/);
});
test('complete history pagination and verified employee cache avoid redundant reads',async()=>{
 const calls=[],employees=new Map();
 const invoke=async args=>{calls.push(args);return args.resource==='employees'?{ok:true,store:'hortimatic',resource:'employees',rows:[{id:'1',firstname:'Test',lastname:'Vendedor'}],possibly_more:args.page_size===1}:{ok:true,store:'hortimatic',resource:'order_histories',page:args.page,rows:args.page?[{...first,id:'11',date_add:'2026-11-10 10:00:00',id_employee:'2'}]:[first],possibly_more:args.page===0};};
 const result=await loadOrderSellers({store:'hortimatic',orders:[order],invoke,employees});assert.equal(result.get('42').name,'Test Vendedor');assert.equal(calls.length,3);assert.equal(calls.find(row=>row.resource==='employees').page_size,2,'An exact-ID result must not look truncated because the page size is one');
 await loadOrderSellers({store:'hortimatic',orders:[order],invoke,employees});assert.equal(calls.filter(row=>row.resource==='employees').length,1);
});
test('foreign-store, incomplete and cancelled reads never attribute a seller',async()=>{
 await assert.rejects(()=>loadOrderSellers({store:'hortimatic',orders:[order],invoke:async()=>({ok:true,store:'newoldsmok',resource:'order_histories',page:0,rows:[first]})}),/no corresponde/);
 await assert.rejects(()=>loadOrderSellers({store:'hortimatic',orders:[order],invoke:async()=>({ok:true,store:'hortimatic',resource:'order_histories',page:0,rows:[],possibly_more:true})}),/completar/);
 assert.equal(await loadOrderSellers({store:'hortimatic',orders:[order],current:()=>false,invoke:async()=>{throw Error('must not run');}}),null);
});
