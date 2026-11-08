import test from 'node:test';
import assert from 'node:assert/strict';
import {productColumns,productPhoto,productWebUrl,filterProductCatalog,productCatalogCsv,catalogProductKey} from '../src/productos-catalog.js';
import {readPrestashopPage} from '../supabase/functions/totus-connections/prestashop.js';
test('catálogo conserva nombre, descarta preferencias desconocidas y busca por EAN/categoría/marca/estado',()=>{
 assert.deepEqual(productColumns(['name','price','name','<script>']),['name','price']);
 const rows=[{id:'1',name:[{value:'Azul'}],reference:'A',ean13:'0012',active:'1',id_manufacturer:'3',id_category_default:'4'},{id:'2',name:'Rojo',active:'0',associations:{categories:[{id:'9'}]}}];
 assert.equal(filterProductCatalog(rows,{query:'0012',brand:'3',category:'4',active:'1'})[0].id,'1');
 assert.equal(filterProductCatalog(rows,{category:'9',active:'0'})[0].id,'2');
 assert.equal(filterProductCatalog(rows,{query:'inexistente'}).length,0);
 assert.equal(productPhoto({id_default_image:'7'},'newoldsmok'),'https://newoldsmok.com/7-home_default/product.jpg');
 assert.equal(productPhoto({id_default_image:'https://evil.test'},'hortimatic'),null);
 const csv=productCatalogCsv([{name:'  =HYPERLINK("bad")'}],['name'],(r,k)=>r[k]);assert(csv.includes('"\'  =HYPERLINK(""bad"")"'));
});

test('combined catalog keeps store identity even when product, category and brand IDs coincide',()=>{
 const rows=[{id:'42',__store:'hortimatic',name:'A',id_category_default:'3',id_manufacturer:'8'},{id:'42',__store:'newoldsmok',name:'B',id_category_default:'3',id_manufacturer:'8'}];
 assert.notEqual(catalogProductKey(rows[0]),catalogProductKey(rows[1]));
 assert.equal(filterProductCatalog(rows,{category:'newoldsmok|3',brand:'newoldsmok|8'})[0].name,'B');
 assert.equal(filterProductCatalog(rows,{category:'newoldsmok|3',brand:'hortimatic|8'}).length,0);
});
test('existencias por productos filtra id_product y rechaza datos ajenos sin escribir',async()=>{
 const c={protocol:'prestashop',name:'PrestaShop · Hortimatic',endpoint:'https://hortimatic.com/api',secret:'fixture',enabled:true,revision:2,verified_revision:2,real_data_authorized:true};
 const input={store:'hortimatic',resource:'stock_availables',product_ids:['42'],page:0,page_size:100};
 const opts={resolve:async()=>['8.8.8.8'],request:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(new URL(url).searchParams.get('filter[id_product]'),'[42]');return Response.json({stock_availables:[{id:9,id_product:42,id_product_attribute:0,id_shop:1,quantity:3}]});}};
 assert.equal((await readPrestashopPage(c,input,opts)).rows[0].quantity,'3');
 await assert.rejects(()=>readPrestashopPage(c,input,{...opts,request:async()=>Response.json({stock_availables:[{id:9,id_product:99,quantity:3}]})}),/ajeno/);
});

test('public product links retain the actual store and reject draft/invalid identities',()=>{
 assert.equal(productWebUrl({id:'42'},'hortimatic'),'https://hortimatic.com/index.php?controller=product&id_product=42');
 assert.equal(productWebUrl({id:'42'},'newoldsmok'),'https://newoldsmok.com/index.php?controller=product&id_product=42');
 for(const id of ['',null,'0','../bad','42&evil=1'])assert.equal(productWebUrl({id},'hortimatic'),null);
 assert.equal(productWebUrl({id:'42'},'both'),null);
});
