import test from 'node:test';
import assert from 'node:assert/strict';
import {readPrestashopProductItem} from '../supabase/functions/totus-connections/prestashop.js';
const connection={name:'PrestaShop · Hortimatic',protocol:'prestashop',revision:1,verified_revision:1,enabled:true,real_data_authorized:true,endpoint:'https://hortimatic.com/api/',secret:'fixture-only'};
const input={store:'hortimatic',resource:'images',record_id:'91',product_id:'42'};
test('copy source photos uses fixed authenticated GET and verifies product membership, MIME and size',async()=>{
 const calls=[],request=async(url,options)=>{calls.push({url:String(url),options});return String(url).includes('/images/')?new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}}):Response.json({product:{id:'42',associations:{images:[{id:'91'}]}}});};
 const result=await readPrestashopProductItem(connection,input,{request,resolve:async()=>['8.8.8.8']});assert.equal(result.item.base64,'AQID');assert.equal(result.item.id_product,'42');assert(calls.every(c=>c.options.method==='GET'));assert.equal(new URL(calls[1].url).pathname,'/api/images/products/42/91');assert(!JSON.stringify(result).includes(connection.secret));
 let images=0;await assert.rejects(()=>readPrestashopProductItem(connection,{...input,record_id:'92'},{resolve:async()=>['8.8.8.8'],request:async(url)=>{if(String(url).includes('/images/'))images++;return Response.json({product:{id:'42',associations:{images:[{id:'91'}]}}});}}),/no pertenece/);assert.equal(images,0);
 for(const type of ['text/html','image/svg+xml'])await assert.rejects(()=>readPrestashopProductItem(connection,input,{resolve:async()=>['8.8.8.8'],request:async(url)=>String(url).includes('/images/')?new Response('untrusted',{headers:{'content-type':type}}):Response.json({product:{id:'42',associations:{images:[{id:'91'}]}}})}),/fotograf/);
 await assert.rejects(()=>readPrestashopProductItem(connection,input,{resolve:async()=>['8.8.8.8'],request:async(url)=>String(url).includes('/images/')?new Response(new Uint8Array(8388609),{headers:{'content-type':'image/png'}}):Response.json({product:{id:'42',associations:{images:[{id:'91'}]}}})}),/8 MB/);
 await assert.rejects(()=>readPrestashopProductItem(connection,{...input,product_id:'42/../../x'},{request}),/no válida/);
});
