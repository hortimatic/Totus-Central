import test from 'node:test';import assert from 'node:assert/strict';
import {createMovementReader,movementRow,movementLayout} from '../src/productos-movements.js';
import {prestashopQuery,PRESTASHOP_RESOURCES} from '../src/prestashop-readonly.js';
import {readPrestashopPage} from '../supabase/functions/totus-connections/prestashop.js';
const product={id:'42',reference:'QA-MOVEMENT'},stock={id:'501',id_product:'42',id_product_attribute:'0',depends_on_stock:'0'};
test('native movement fields are resolved through stock, with signed quantity and original employee',()=>{
 assert(PRESTASHOP_RESOURCES.stock_movements.includes('id_stock'));assert(!PRESTASHOP_RESOURCES.stock_movements.includes('id_product'));
 const row=movementRow({id:'9',id_stock:'501',physical_quantity:'3',sign:'-1',employee_firstname:'QA',employee_lastname:'Operador',id_order:'77',id_stock_mvt_reason:'2',date_add:'2026-11-14 10:00:00'},{product,stocks:[stock],reasons:[{id:'2',name:'Pedido'}]});
 assert.equal(row.quantity,-3);assert.equal(row.employee,'QA Operador');assert.equal(row.order,'77');assert.equal(row.reason,'Pedido');
 assert.throws(()=>movementRow({id:'9',id_stock:'999',physical_quantity:'3',sign:'1'},{product,stocks:[stock]}),/ajeno/);
 assert.throws(()=>movementRow({id:'9',id_stock:'501',physical_quantity:'3',sign:'0'},{product,stocks:[stock]}),/firmada/);
});
test('native request scopes stock IDs and rejects foreign movement responses',async()=>{
 assert.deepEqual(prestashopQuery({resource:'stock_movements',page:0,page_size:20,stock_ids:['501']}).stockIds,['501']);
 for(const stock_ids of [[],['0'],['1','1'],'501'])assert.throws(()=>prestashopQuery({resource:'stock_movements',page:0,page_size:20,stock_ids}));
 const connection={id:'11111111-1111-4111-8111-111111111111',protocol:'prestashop',name:'PrestaShop · Hortimatic',endpoint:'https://example.com/api',secret:'fixture-secret',auth_kind:'basic',enabled:true,revision:3,verified_revision:3,real_data_authorized:true};let url;
 await assert.rejects(readPrestashopPage(connection,{store:'hortimatic',resource:'stock_movements',page:0,page_size:20,stock_ids:['501']},{resolve:async()=>['8.8.8.8'],request:async value=>{url=new URL(value);return Response.json({stock_movements:[{id:9,id_stock:999,physical_quantity:3,sign:1}]});}}),/ajeno/);
 assert.equal(url.searchParams.get('filter[id_stock]'),'[501]');assert(!url.searchParams.get('display').includes('id_product'));
});
test('more than 100 combinations use filtered native batches, merged without a full-shop scan',async()=>{
 const calls=[],stocks=Array.from({length:102},(_,i)=>({...stock,id:String(501+i),id_product_attribute:String(i)}));
 const reader=createMovementReader(async(shop,action,args)=>{calls.push({shop,action,args});if(args.resource==='stock_availables')return {rows:args.page?stocks.slice(100):stocks.slice(0,100),possibly_more:args.page===0};if(args.resource==='stock_movement_reasons')return {rows:[],possibly_more:false};return {rows:[{id:args.stock_ids[0]==='501'?'10':'11',id_stock:args.stock_ids[0],physical_quantity:'2',sign:'1',id_stock_mvt_reason:'1'}],possibly_more:false};});
 await reader.open({store:'newoldsmok',product});const result=await reader.next(20);assert.deepEqual(result.rows.map(r=>r.id),['11','10']);assert.equal(result.possibly_more,false);
 assert(calls.every(c=>c.shop==='newoldsmok'&&c.action==='prestashop_read'));assert(calls.filter(c=>c.args.resource==='stock_movements').every(c=>c.args.stock_ids.length<=100));
});
test('late results after leaving a product cannot become movements of another product',async()=>{
 let release;const reader=createMovementReader(async()=>new Promise(resolve=>release=resolve));const pending=reader.open({store:'hortimatic',product});reader.cancel();release({rows:[stock],possibly_more:false});await assert.rejects(pending,/otra ficha/);
});
test('column preferences drop unknown fields and retain native record ID',()=>{assert.deepEqual(movementLayout({columns:['quantity','secret'],widths:{quantity:140,secret:999},size:'50'}),{columns:['quantity','id'],widths:{quantity:140},size:'50'});});
