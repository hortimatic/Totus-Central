import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync,crc32} from 'node:zlib';
import {validateProductStage} from '../src/productos-stages-contract.js';
import {inspectTransparentProductPng} from '../src/productos-png.js';
import {prepareProductStageXml,inspectProductStageXml,productFinalizationFields} from '../src/productos-write-contract.js';

test('finalización deriva tipo de combinaciones reales y guardado, sin activar compras',()=>{
 const root=ids=>'<prestashop><product><id>601</id><associations><combinations>'+ids.map(id=>'<combination><id>'+id+'</id></combination>').join('')+'</combinations></associations></product></prestashop>';
 assert.deepEqual(productFinalizationFields(root(['701','702']),{active:'0',available_for_order:'0'}),{active:'0',available_for_order:'0',state:'1',product_type:'combinations'});
 assert.equal(productFinalizationFields(root([]),{active:'0'}).product_type,'standard');
 assert.throws(()=>productFinalizationFields(root(['wrong']),{active:'0'}),/verificables/);
 const actual=root(['701']),fields=productFinalizationFields(actual,{active:'0',available_for_order:'0'}),saved=prepareProductStageXml(actual,'products',fields,{},'601');
 assert.equal(inspectProductStageXml(saved,'products',fields).verified,true);
 assert.throws(()=>inspectProductStageXml(saved.replace('CDATA[combinations','CDATA[standard'),'products',fields),/no coincide/);
});
import {runPrestashopProductStage} from '../supabase/functions/totus-connections/prestashop-product-stage.js';
import {buildVisualProductDescription} from '../src/productos-description.js';
import {productInputValue} from '../src/productos-core.js';
const base={action:'prestashop_product_step_prepare',id:'11111111-1111-4111-8111-111111111111',call_id:'22222222-2222-4222-8222-222222222222',revision:2,store:'hortimatic',parent_request_id:'33333333-3333-4333-8333-333333333333',product_id:'601',kind:'variation',step_key:'blue',fields:{reference:'PRUEBAS-BLUE',price:'1.25',wholesale_price:'3.90',weight:'0.15',minimal_quantity:'1',default_on:'1'},associations:{product_option_values:['10']}};
test('constructor visual usa imágenes de la tienda, escapa textos y admite decimales españoles sin cambiar EAN',()=>{
 const built=buildVisualProductDescription({store:'hortimatic',title:'pruebas <script>',intro:'Riego de plantas',detailText:'Cuerpo metálico',specifications:'Capacidad: 2 L\nMaterial: Metal',box:'Una regadera',notice:'Datos ficticios',images:[{id:'901'}]});
 assert(built.description.includes('https://hortimatic.com/901-large_default/product.jpg'));
 assert(!built.description.includes('<script>'));assert(built.description.includes('&lt;script&gt;'));assert(built.description_short.includes('Capacidad'));
 assert.throws(()=>buildVisualProductDescription({store:'hortimatic',title:'pruebas',images:[{id:'https://evil.test/a'}]}),/verificadas/);
 assert.throws(()=>buildVisualProductDescription({store:'hortimatic',title:'pruebas',specifications:'sin separador'}),/especificaciones/);
 assert.equal(productInputValue('price','3,90'),'3.90');assert.equal(productInputValue('price',',39'),'0.39');assert.equal(productInputValue('price','-,50'),'-0.50');assert.equal(productInputValue('ean13','0000000000001'),'0000000000001');
});
const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,revision:2,verified_revision:2,real_data_authorized:true,endpoint:'https://hortimatic.com/api/',secret:'only-a-fixture'};
const root='<prestashop><product><id>601</id><reference>PRUEBAS</reference></product></prestashop>';
const blank='<prestashop><combination><id></id><id_product></id_product><reference></reference><price></price><wholesale_price></wholesale_price><weight></weight><minimal_quantity></minimal_quantity><default_on></default_on><quantity>0</quantity><associations><product_option_values><product_option_value><id></id></product_option_value></product_option_values><images/></associations></combination></prestashop>';
test('legacy Totus HTML5 recovery requires all text and images; arbitrary transformations fail',()=>{
 const root='<section style="max-width:1100px;margin:0 auto;color:#17382b;font-family:Arial,Helvetica,sans-serif;">';
 const image='<img src="https://hortimatic.com/901-large_default/product.jpg" alt="Demo" style="display:block;width:100%;max-width:900px;height:auto;margin:0 auto;" />';
 const original=root+'<header style="padding:28px;background:#edf5ef;border-radius:20px;"><h2>Demo</h2></header>'+image+'</section>';
 const saved='<h2>Demo</h2>'+image.replace('display:block;width:100%;','');
 const xmlFor=html=>'<prestashop><product><id>601</id><description><language id="1"><![CDATA['+html+']]></language></description></product></prestashop>';
 const fields={description:[{language_id:'1',value:original}]};
 assert.equal(inspectProductStageXml(xmlFor(saved),'products',fields).native_html_normalized,true);
 for(const broken of [saved.replace('Demo','Lost'),saved.replace(/<img[^>]+>/,''),saved.replace('/901-','/902-')])assert.throws(()=>inspectProductStageXml(xmlFor(broken),'products',fields),/no coincide/);
 assert.throws(()=>inspectProductStageXml(xmlFor(saved),'products',{description:[{language_id:'1',value:original.replace('<header style=','<header onclick="bad()" style=')}]}),/no coincide/);
 assert.throws(()=>inspectProductStageXml(xmlFor('<p>text</p>'),'products',{description:[{language_id:'1',value:'<section><p>text</p></section>'}]}),/no coincide/);
});
test('native NULL means a non-default combination; missing fields and actual defaults still fail',()=>{
 const secondary='<prestashop><combination><id>702</id><default_on><![CDATA[]]></default_on></combination></prestashop>';
 assert.equal(inspectProductStageXml(secondary,'combinations',{default_on:'0'}).verified,true);
 assert.throws(()=>inspectProductStageXml(secondary,'combinations',{default_on:'1'}),/no coincide/);
 assert.throws(()=>inspectProductStageXml(secondary.replace('<![CDATA[]]>','1'),'combinations',{default_on:'0'}),/no coincide/);
 assert.throws(()=>inspectProductStageXml(secondary.replace('<default_on><![CDATA[]]></default_on>',''),'combinations',{default_on:'0'}),/campo único/);
 assert.throws(()=>inspectProductStageXml('<prestashop><product><id>601</id><active></active></product></prestashop>','products',{active:'0'}),/no coincide/);
});
const xml=body=>new Response(body,{headers:{'Content-Type':'application/xml'}}),json=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
function fixture(options={}){
 let saved=null,entry=null;const calls=[];
 const request=async(url,opts)=>{
  const u=new URL(url);calls.push({path:u.pathname,method:opts.method,body:opts.body});
  if(u.pathname==='/api/products/601')return xml(root);
  if(u.pathname==='/api/product_option_values/10')return json({product_option_value:{id:10,id_attribute_group:5}});
  if(u.pathname==='/api/combinations'&&u.searchParams.get('schema')==='blank')return options.schema500?new Response('error',{status:500}):xml(blank);
  if(u.pathname==='/api/combinations'&&opts.method==='POST'){
   saved=opts.body.replace('<id></id>','<id>701</id>');
   return options.post500?new Response('error',{status:500}):xml(saved);
  }
  if(u.pathname==='/api/combinations/701')return xml(saved);
  if(u.pathname==='/api/combinations')return json(saved?{combinations:[{id:701}]}:[]);
  throw Error('Unexpected fixture path '+u.pathname);
 };
 const journal={parent:async()=>({status:'completed',store:options.wrongStore?'newoldsmok':'hortimatic',product_id:601,reference:'PRUEBAS'}),lookup:async()=>entry,claim:async(op,signature)=>{if(entry)return entry;entry={status:'pending',signature};return {status:'claimed'};},complete:async(op,signature,id)=>{assert.equal(entry.signature,signature);entry={status:'completed',signature,record_id:id};},uncertain:async()=>{entry.status='uncertain';}};
 return {calls,request,journal,env:{get:()=>options.disabled?'':'1'},resolve:async()=>['8.8.8.8']};
}
test('etapas: valida campos, atributos, precios especiales y referencias de producto',()=>{
 assert.equal(validateProductStage(base).resource,'combinations');
 assert.throws(()=>validateProductStage({...base,fields:{...base.fields,id_product:'999'}}),/obligatorios/);
 assert.throws(()=>validateProductStage({...base,associations:{product_option_values:['10','10']}}),/atributos/);
 assert.throws(()=>validateProductStage({...base,associations:{product_option_values:[]}}),/necesita/);
 assert.throws(()=>validateProductStage({...base,step_key:'../../secrets'}),/Identidad/);
 assert.throws(()=>validateProductStage({...base,action:'prestashop_product_step_commit'}),/confirmación/);
});
test('combinación: preparar, crear, releer y recuperar sin repetir POST',async()=>{
 const f=fixture(),prepared=await runPrestashopProductStage(connection,base,f);
 assert.equal(prepared.persisted,false);assert(!f.calls.some(c=>c.method==='POST'));
 const op={...base,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint};
 const done=await runPrestashopProductStage(connection,op,f);assert.equal(done.record_id,'701');assert.equal(done.verified,true);
 assert(!f.calls.find(c=>c.method==='POST').body.includes('<quantity>'));
 const again=await runPrestashopProductStage(connection,op,f);assert.equal(again.reused,true);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('HTTP 500 después de insertar una variación se concilia por relectura',async()=>{
 const f=fixture({post500:true}),prepared=await runPrestashopProductStage(connection,base,f);
 const done=await runPrestashopProductStage(connection,{...base,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint},f);
 assert.equal(done.reconciled,true);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('el esquema vacío defectuoso de PrestaShop 1.7 usa solo el contrato tipado conocido',async()=>{
 const f=fixture({schema500:true}),prepared=await runPrestashopProductStage(connection,base,f);
 assert.equal(prepared.legacy_schema_fallback,true);
 const done=await runPrestashopProductStage(connection,{...base,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint},f);
 assert.equal(done.verified,true);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('sin habilitación o con otra tienda nunca se escriben etapas',async()=>{
 const f=fixture({disabled:true}),prepared=await runPrestashopProductStage(connection,base,f);
 assert.equal(prepared.can_commit,false);
 await assert.rejects(()=>runPrestashopProductStage(connection,{...base,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint},f),/habilitadas/);
 assert(!f.calls.some(c=>c.method==='POST'));
 const foreign=fixture({wrongStore:true});await assert.rejects(()=>runPrestashopProductStage(connection,base,foreign),/no pertenece/);assert.equal(foreign.calls.length,0);
});
test('una traducción de descripción conserva los demás idiomas y elimina solo campos calculados',()=>{
 const original='<prestashop><product><id>601</id><manufacturer_name>Marca</manufacturer_name><quantity>9</quantity><description><language id="1">Antes</language><language id="2">Keep</language></description><associations><stock_availables><stock_available><id>9</id></stock_available></stock_availables><categories><category><id>3</id></category></categories></associations></product></prestashop>';
 const values={description:[{language_id:'1',value:'Después & literal'}]},result=prepareProductStageXml(original,'products',values,{},'601');
 assert(result.includes('<language id="2">Keep</language>'));assert(result.includes('<category><id>3</id></category>'));assert(!result.includes('manufacturer_name'));assert(!result.includes('stock_availables'));
 assert.equal(inspectProductStageXml(result,'products',values).verified,true);
});
const chunk=(name,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(name,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+data.length)),8+data.length);return b;};
function png(alpha){const header=Buffer.alloc(13);header.writeUInt32BE(2);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,30,120,70,alpha,40,130,80,255]))),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
test('imágenes: comprueba píxeles transparentes reales y rechaza PNG opacos o truncados',async()=>{
 const image=await inspectTransparentProductPng(png(0));assert.equal(image.transparent_pixels,1);assert.equal(image.width,2);
 await assert.rejects(()=>inspectTransparentProductPng(png(255)),/opaco/);
 await assert.rejects(()=>inspectTransparentProductPng('not a png'),/PNG/);
});

test('producto existente: añade combinación sin diario de alta y no repite el POST',async()=>{
 const f=fixture();f.journal.parent=async()=>({status:'completed',store:'hortimatic',product_id:'601'});
 await assert.rejects(()=>runPrestashopProductStage(connection,base,f),/no corresponde/);
 const args={...base,existing_product:true},prepared=await runPrestashopProductStage(connection,args,f);
 const commit={...args,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint};
 const done=await runPrestashopProductStage(connection,commit,f);assert.equal(done.verified,true);
 const repeat=await runPrestashopProductStage(connection,commit,f);assert.equal(repeat.reused,true);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 assert.throws(()=>validateProductStage({...args,existing_product:false}),/expresamente/);
});

test('producto existente rechaza atributos ya usados aunque cambie la referencia',async()=>{
 const f=fixture(),original=f.request;f.journal.parent=async()=>({status:'completed',store:'hortimatic',product_id:'601'});
 f.request=async(url,opts)=>new URL(url).searchParams.get('display')==='full'?json({combinations:[{id:999,id_product:601,reference:'OTHER',associations:{product_option_values:[{id:10}]}}]}):original(url,opts);
 await assert.rejects(()=>runPrestashopProductStage(connection,{...base,existing_product:true},f),/esos atributos/);
 assert.equal(f.calls.some(c=>c.method==='POST'),false);
});
