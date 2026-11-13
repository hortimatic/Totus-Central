import test from 'node:test';
import assert from 'node:assert/strict';
import {WEBSITE_CHOICES,installWebsiteContext,resetWebsiteChoices,websiteBusinessId} from '../src/website-registry.js';
import {PRODUCT_STORES} from '../src/productos-core.js';
import {productWebUrl,productPhoto} from '../src/productos-catalog.js';
import {adaptStoreText} from '../src/productos-copy-text.js';
import {buildProductRequest} from '../src/productos-request.js';
import {createDirectorySession} from '../src/contact-directory-session.js';
const records=Array.from({length:4},(_,i)=>({key:'web-'+(i+1),name:'Tienda '+(i+1),connection_id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),origin:'https://shop'+(i+1)+'.example',status:'active',include_in_totals:i!==2,business_id:i===2?'business-3':null}));
test('four connected websites reach product selectors, URLs, copy texts and assistant requests without source edits',()=>{
 try{
  installWebsiteContext({websites:records});
  assert.equal(PRODUCT_STORES.length,4);assert.equal(WEBSITE_CHOICES[2].label,'Tienda 3');
  assert.equal(productWebUrl({id:'7'},'web-3'),'https://shop3.example/index.php?controller=product&id_product=7');
  assert.equal(productPhoto({id_default_image:'9'},'web-4'),'https://shop4.example/9-home_default/product.jpg');
  assert.equal(adaptStoreText('Tienda 1 · https://shop1.example','web-1','web-4'),'Tienda 4 · https://shop4.example');
  assert.match(buildProductRequest({operation:'copy',store:'web-4',source_store:'web-3',product_id:'7'}),/Destino: Tienda 4/);
  assert.equal(websiteBusinessId('web-3',[{id:'business-3',active:true}]),'business-3');
  assert.equal(websiteBusinessId('web-1',[{id:'other',name:'web-1'}]),null);
 }finally{resetWebsiteChoices();}
 assert.equal(PRODUCT_STORES.length,2);
});
test('directory reads on a newly registered website bind the connection ID, not a matching display name',async()=>{
 try{
  installWebsiteContext({websites:records});const site=records[3],calls=[];
  const profile={id:site.connection_id,name:'Nombre de conexión distinto',store_key:site.key,protocol:'prestashop',enabled:true,configured:true,real_data_authorized:true,revision:2,verified_revision:2};
  const session=createDirectorySession({kind:'clientes',actor:()=> 'account',can:()=>true,rpc:async()=>({connections:[profile]}),invoke:async q=>{calls.push(q);return {...q,ok:true,rows:[{id:'7',firstname:'QA'}],possibly_more:false};}});
  await session.enter(site.key);assert.equal((await session.read('customers')).rows[0].id,'7');
  assert.equal(calls[0].id,site.connection_id);assert.equal(calls[0].store,site.key);
 }finally{resetWebsiteChoices();}
});
