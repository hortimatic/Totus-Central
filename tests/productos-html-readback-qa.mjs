import test from 'node:test';
import assert from 'node:assert/strict';
import {equivalentProductHTML,validateProductCreateRequest,prepareProductCreationXml,minimalBlankProductSchema,inspectReconciledNewProduct,inspectProductStageXml,selectedXmlValues,sha256Text} from '../src/productos-write-contract.js';
import {runPrestashopProductCreate} from '../supabase/functions/totus-connections/prestashop-create.js';
const sent='<p>Texto exacto<br><img src="https://example.com/91-home_default/product.jpg" alt="A > B" width="260"></p>';
const saved=sent.replace('<br>','<br />').replace('width="260">','width="260" />');
const id='11111111-1111-4111-8111-111111111111',input={id,call_id:id,revision:2,store:'hortimatic',action:'prestashop_product_create_commit',reference:'QA-VOID-HTML',price:'10',category_id:'2',translations:[{language_id:'1',name:'Prueba',link_rewrite:'prueba',description:sent}],confirmed:true,request_id:id,expected_fingerprint:'a'.repeat(64)};
const op=validateProductCreateRequest(input),xml=prepareProductCreationXml(minimalBlankProductSchema(['1']),op).replace('<id><![CDATA[]]></id>','<id>701</id>').replace('<product>','<products><product>').replace('</prestashop>','</products></prestashop>').replace(sent,saved);
test('native void closing syntax is equivalent, including > inside quoted attributes',()=>{
 assert(equivalentProductHTML(sent,saved));assert(equivalentProductHTML(saved,sent));
 for(const value of [saved.replace('Texto exacto','Otro texto'),saved.replace('91-home','92-home'),saved.replace('alt="A > B"','alt="Otro"'),saved.replace(/<img[^]*? \/>/,''),saved.replace('<br />','')])assert(!equivalentProductHTML(sent,value));
 assert(!equivalentProductHTML('<img src=https://example.com/a>','<img src=https://example.com/a/>'));
 assert(!equivalentProductHTML('<script>"<br>"</script>','<script>"<br />"</script>'));
 assert(!equivalentProductHTML('<!-- <br> -->','<!-- <br /> -->'));
 assert(!equivalentProductHTML('&lt;br&gt;','&lt;br /&gt;'));
});
test('create, staged description and selective editing verify the same content without accepting data loss',()=>{
 assert.equal(inspectReconciledNewProduct(xml,op,'701').native_html_normalized,true);
 const product=xml.replace('<products>','').replace('</products>','');
 assert.equal(inspectProductStageXml(product,'products',{description:[{language_id:'1',value:sent}]}).native_html_normalized,true);
 assert.equal(selectedXmlValues(product,'products','701',[{field:'description',language_id:'1',value:sent}]).changes[0].changed,false);
 assert.throws(()=>inspectReconciledNewProduct(xml.replace('Texto exacto','Pérdida'),op,'701'),/description/);
});
test('uncertain create is recovered by GET and its existing journal; never a second POST',async()=>{
 const signature=await sha256Text(JSON.stringify({store:op.store,reference:op.reference,price:op.price,category_id:op.category_id,translations:op.translations,fields:op.fields,relations:op.relations}));
 const calls=[],complete=[];
 const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,real_data_authorized:true,revision:2,verified_revision:2,endpoint:'https://hortimatic.com/api/',secret:'fictional'};
 const result=await runPrestashopProductCreate(connection,input,{resolve:async()=>['8.8.8.8'],env:{get:()=> '1'},request:async(url,options)=>{calls.push(options.method);assert.equal(options.method,'GET');return new Response(xml,{headers:{'content-type':'application/xml'}});},journal:{lookup:async()=>({status:'uncertain',store:'hortimatic',reference:op.reference,signature,product_id:'701'}),claim:async()=>{throw Error('No new claim');},complete:async data=>complete.push(data),uncertain:async()=>{throw Error('Must verify');}}});
 assert.equal(result.record_id,'701');assert.equal(result.reused,true);assert.deepEqual(calls,['GET','GET']);assert.equal(complete.length,1);
});
