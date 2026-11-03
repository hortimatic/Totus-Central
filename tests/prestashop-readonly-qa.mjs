import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESTASHOP_VERSION,PRESTASHOP_RESOURCES,PRESTASHOP_STORES,linkedPrestashop,prestashopPage,prestashopReadUrl,prestashopRows} from '../src/prestashop-core.js';
import {readPrestashop} from '../supabase/functions/totus-connections/prestashop.js';
const noSecret='fixture-only-service-key';
const profile={id:'11111111-1111-4111-8111-111111111111',name:'PrestaShop · Hortimatic',endpoint:'https://example.com/api',protocol:'prestashop',auth_kind:'basic',secret:noSecret,revision:3,verified_revision:3,enabled:true,configured:true,free_confirmed:true,real_data_authorized:true};
const resolve=async()=>['8.8.8.8'];
test('PrestaShop 1.7.8.11 store contracts stay separate and never expose SQL',()=>{
 assert.equal(PRESTASHOP_VERSION,'1.7.8.11');assert.deepEqual(PRESTASHOP_STORES.map(s=>s.id),['hortimatic','newoldsmok']);
 assert.deepEqual(Object.keys(PRESTASHOP_RESOURCES),['stock_availables','stock_movements']);
 assert.equal(linkedPrestashop([profile],'hortimatic').connection,profile);assert.equal(linkedPrestashop([profile],'newoldsmok').connection,null);
 assert.equal(linkedPrestashop([profile,profile],'hortimatic').ambiguous,true);
 assert.throws(()=>linkedPrestashop([profile],'unknown'),/Tienda/);
 for(const bad of ['orders','customers','psog_posp_cajas','ps0d_posp_cajas','../../../admin','stock_availables?sql=select','__proto__','constructor','toString'])assert.throws(()=>prestashopReadUrl(profile,{resource:bad}),/Recurso/);
});
test('pagination is bounded, ordered and uses the existing /api endpoint',()=>{
 assert.deepEqual(prestashopPage({offset:0,limit:50}),{offset:0,limit:50});
 for(const bad of [{offset:-1},{offset:1.5},{limit:0},{limit:101},{offset:1000001},{offset:'0'},{limit:'50'}])assert.throws(()=>prestashopPage(bad),/Paginación/);
 const url=new URL(prestashopReadUrl(profile,{resource:'stock_movements',offset:100,limit:50}));
 assert.equal(url.origin,'https://example.com');assert.equal(url.pathname,'/api/stock_movements');assert.equal(url.searchParams.get('limit'),'100,50');assert.equal(url.searchParams.get('sort'),'[id_ASC]');
 assert.equal(url.searchParams.get('display'),'full');assert.equal(url.searchParams.get('output_format'),'JSON');assert.equal(url.searchParams.has('key'),false);
 for(const endpoint of ['https://example.com/api/stock_availables','https://example.com/path','https://example.com/api?key=leak','https://user:pass@example.com/api'])assert.throws(()=>prestashopReadUrl({...profile,endpoint},{resource:'stock_availables'}),/Configura/);
});
test('projected stock rows preserve quantity, variant and provenance without raw supplier data',()=>{
 const raw={stock_availables:[{id:4,id_product:10,id_product_attribute:15,id_shop:2,id_shop_group:0,quantity:-3,out_of_stock:0,depends_on_stock:0,location:'A1',extra:'secret'}]};
 assert.deepEqual(prestashopRows('stock_availables',raw),[{id:'4',id_product:'10',id_product_attribute:'15',id_shop:'2',id_shop_group:'0',quantity:'-3',depends_on_stock:'0',out_of_stock:'0',location:'A1'}]);
 assert.deepEqual(prestashopRows('stock_movements',{stock_movements:[]}),[]);
 assert.throws(()=>prestashopRows('stock_movements',{errors:['Key not authorized']}),/no ha devuelto/);
 for(const bad of ['__proto__','constructor','toString'])assert.throws(()=>prestashopRows(bad,{stock_availables:[]}),/Recurso/);
 assert.throws(()=>prestashopRows('stock_availables',{stock_availables:{stock_available:{id:3}}}),/formato/);
 assert.throws(()=>prestashopRows('stock_availables',{stock_availables:new Array(101).fill({})}),/mayor/);
});
test('read is a single GET using private Basic header; no key or raw data returned',async()=>{
 let calls=0;const result=await readPrestashop(profile,{store:'hortimatic',resource:'stock_movements',offset:0,limit:50},{resolve,request:async(url,init)=>{
  calls++;assert.equal(new URL(url).pathname,'/api/stock_movements');assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
  assert.equal(init.headers.Authorization,'Basic '+btoa(noSecret+':'));assert(!url.includes(noSecret));assert(!init.body);
  return Response.json({stock_movements:[{id:55,id_product:20,id_product_attribute:3,id_employee:2,id_stock_mvt_reason:1,physical_quantity:8,sign:1,date_add:'2026-11-03 10:25:00',reference:'A-01',internal:'do-not-return'}]});
 }});
 assert.equal(calls,1);assert.equal(result.store,'hortimatic');assert.equal(result.writes,false);assert.equal(result.rows.length,1);
 assert.equal(result.rows[0].physical_quantity,'8');assert.equal(result.rows[0].sign,'1');assert.equal(result.rows[0].date_add,'2026-11-03 10:25:00');
 assert.equal(result.possibly_more,false);assert(!JSON.stringify(result).includes(noSecret));assert(!JSON.stringify(result).includes('do-not-return'));
});
test('cross-store key, stale profile and missing permission never reach the network',async()=>{
 for(const p of [{...profile,name:'PrestaShop · NewOldSmok'},{...profile,enabled:false},{...profile,verified_revision:1},{...profile,real_data_authorized:false},{...profile,secret:null}]){
  let calls=0;await assert.rejects(readPrestashop(p,{store:'hortimatic',resource:'stock_availables'},{resolve,request:async()=>{calls++;return Response.json({});}}));assert.equal(calls,0);
 }
});
test('HTTP failures, HTML login and unexpected JSON fail closed',async()=>{
 const payload={store:'hortimatic',resource:'stock_availables',offset:0,limit:50};
 for(const body of [new Response('',{status:403}),new Response('<html>Login</html>',{headers:{'Content-Type':'text/html'}}),Response.json({errors:['Unauthorized']}),new Response('not-json',{headers:{'Content-Type':'application/json'}})]){
  await assert.rejects(readPrestashop(profile,payload,{resolve,request:async()=>body}));
 }
});
test('bounded listing signals next page without reusing old identifiers',async()=>{
 const rows=Array.from({length:50},(_,i)=>({id:i+1,id_product:i+10,quantity:2}));
 const result=await readPrestashop(profile,{store:'hortimatic',resource:'stock_availables',offset:50,limit:50},{resolve,request:async()=>Response.json({stock_availables:rows})});
 assert.equal(result.offset,50);assert.equal(result.limit,50);assert.equal(result.possibly_more,true);
});
