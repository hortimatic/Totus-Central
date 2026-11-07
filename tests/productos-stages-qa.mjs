import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync,crc32} from 'node:zlib';
import {validateProductStage} from '../src/productos-stages-contract.js';
import {inspectTransparentProductPng} from '../src/productos-png.js';
import {prepareProductStageXml,inspectProductStageXml,productFinalizationFields,inspectProductAssociationIds} from '../src/productos-write-contract.js';

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


test('organization review validates principal category, writes only selected relations and detects missing readback',()=>{
 const request={...base,kind:'finish',existing_product:true,fields:{active:'0',available_for_order:'0',id_category_default:'4',id_manufacturer:'3',id_supplier:'0',id_tax_rules_group:'0'},associations:{categories:['4','5']}};
 assert.equal(validateProductStage(request).fields.id_supplier,'0');
 assert.throws(()=>validateProductStage({...request,associations:{categories:['5']}}),/principal/);
 assert.throws(()=>validateProductStage({...request,fields:{...request.fields,id_category_default:'0'}}),/principal/);
 assert.throws(()=>validateProductStage({...request,associations:{categories:['4','4']}}),/duplicada/);
 const original='<prestashop><product><id>601</id><name><language id="1">Conservar</language></name><associations><categories><category><id>2</id></category></categories><images><image><id>90</id></image></images><combinations/></associations></product></prestashop>';
 const next=prepareProductStageXml(original,'products',request.fields,request.associations,'601');
 assert.equal(inspectProductStageXml(next,'products',request.fields,request.associations).verified,true);
 assert(next.includes('<image><id>90</id></image>'));assert(next.includes('Conservar'));
 assert.throws(()=>inspectProductStageXml(next,'products',request.fields,{categories:['4']}),/no coinciden/);
});


test('organization finish verifies destination relationships before PUT and rereads all selected categories',async()=>{
 const requestBase={...base,kind:'finish',existing_product:true,fields:{active:'0',available_for_order:'0',visibility:'none',id_category_default:'4',id_manufacturer:'6',id_supplier:'0',id_tax_rules_group:'0'},associations:{categories:['4','5']}};
 const setup=(wrong=false,wrongFeature=false)=>{
  const calls=[];let entry=null,saved='<prestashop><product><id>601</id><reference>PRUEBAS</reference><id_category_default>4</id_category_default><id_manufacturer>3</id_manufacturer><id_supplier>0</id_supplier><id_tax_rules_group>0</id_tax_rules_group><active>0</active><available_for_order>0</available_for_order><visibility>none</visibility><associations><categories><category><id>4</id></category></categories><images><image><id>90</id></image></images><combinations/></associations></product></prestashop>';
  return {calls,request:async(url,options)=>{const u=new URL(url);calls.push({path:u.pathname,method:options.method});if(u.pathname==='/api/languages')return xml('<prestashop><languages><language id="1"/></languages></prestashop>');if(u.pathname==='/api/products/601'){if(options.method==='PUT')saved=options.body;return xml(saved);}if(u.pathname.startsWith('/api/categories/'))return json({category:{id:u.pathname.split('/').at(-1)}});if(u.pathname==='/api/manufacturers/6')return json({manufacturer:{id:wrong?'999':'6'}});if(u.pathname==='/api/product_features/8')return json({product_feature:{id:'8'}});if(u.pathname==='/api/product_feature_values/80')return json({product_feature_value:{id:'80',id_feature:wrongFeature?'999':'8'}});throw Error('Unexpected organization path '+u.pathname);},resolve:async()=>['8.8.8.8'],env:{get:()=> '1'},journal:{parent:async()=>({status:'completed',store:'hortimatic',product_id:'601',reference:'PRUEBAS'}),lookup:async()=>entry,claim:async(op,signature)=>{entry={signature};return {status:'claimed'};},complete:async(op,signature,record_id)=>{entry={status:'completed',signature,record_id};},uncertain:async()=>{entry.status='uncertain';}}};
 };
 const bad=setup(true);await assert.rejects(()=>runPrestashopProductStage(connection,requestBase,bad),/no verificable/);assert(!bad.calls.some(c=>c.method==='PUT'));
 const f=setup(),prepared=await runPrestashopProductStage(connection,requestBase,f);assert(!f.calls.some(c=>c.method==='PUT'));
 const done=await runPrestashopProductStage(connection,{...requestBase,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint},f);
 assert.equal(done.verified,true);assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
 const withFeatures={...requestBase,associations:{categories:['4','5'],product_features:[{feature_id:'8',value_id:'80'}]}};
 const foreignFeature=setup(false,true);await assert.rejects(()=>runPrestashopProductStage(connection,withFeatures,foreignFeature),/no pertenece/);assert(!foreignFeature.calls.some(c=>c.method==='PUT'));
 const features=setup(),featurePreparation=await runPrestashopProductStage(connection,withFeatures,features);assert.equal((await runPrestashopProductStage(connection,{...withFeatures,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:featurePreparation.fingerprint},features)).verified,true);
});


test('existing combination image selection is signed to its record and never creates another combination',async()=>{
 const selection={...base,kind:'variation_edit',existing_product:true,record_id:'701',fields:{},associations:{images:['90']}};
 assert.equal(validateProductStage(selection).record_id,'701');assert.throws(()=>validateProductStage({...selection,existing_product:undefined}),/existente/);assert.throws(()=>validateProductStage({...selection,associations:{}}),/imágenes/);
 const setup=(foreign=false)=>{let saved='<prestashop><combination><id>701</id><id_product>601</id_product><reference>KEEP-701</reference><price>1.25</price><associations><images/><product_option_values><product_option_value><id>10</id></product_option_value></product_option_values></associations></combination></prestashop>',entry=null;const calls=[];
 return {calls,env:{get:()=> '1'},resolve:async()=>['8.8.8.8'],journal:{parent:async()=>({status:'completed',store:'hortimatic',product_id:'601'}),lookup:async()=>entry,claim:async(op,signature)=>{entry={signature};return {status:'claimed'};},complete:async(op,signature,record_id)=>{entry={status:'completed',signature,record_id};},uncertain:async()=>{entry.status='uncertain';}},request:async(url,options)=>{const u=new URL(url);calls.push({path:u.pathname,method:options.method,body:options.body});if(u.pathname==='/api/products/601')return u.searchParams.get('output_format')==='JSON'?json({product:{id:'601',associations:{images:[{id:'90'}]}}}):xml(root);if(u.pathname==='/api/combinations/701'){if(u.searchParams.get('output_format')==='JSON')return json({combination:{id:'701',id_product:foreign?'999':'601'}});if(options.method==='PUT')saved=options.body;return xml(saved);}throw Error('Unexpected combination path '+u.pathname);}};};
 const bad=setup(true);await assert.rejects(()=>runPrestashopProductStage(connection,selection,bad),/otro producto/);assert(!bad.calls.some(c=>c.method==='PUT'));
 const f=setup(),prepared=await runPrestashopProductStage(connection,selection,f),commit={...selection,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint};
 assert.equal((await runPrestashopProductStage(connection,commit,f)).verified,true);
 assert.equal((await runPrestashopProductStage(connection,commit,f)).reused,true);
 assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);assert(!f.calls.some(c=>c.method==='POST'));
 const body=f.calls.find(c=>c.method==='PUT').body;assert(body.includes('KEEP-701'));assert(body.includes('1.25'));assert(body.includes('<id>10</id>'));assert.match(body,/<image><id>(?:<!\[CDATA\[)?90/);
});


test('removal checks ownership, explicit target and fingerprint; reconciles without a second DELETE',async()=>{
 const remove=(kind='remove_variation')=>({...base,kind,existing_product:true,record_id:kind==='remove_image'?'90':'701',fields:{},associations:{}});
 assert.throws(()=>validateProductStage({...remove(),record_id:'../702'}),/Registro/);
 const setup=({foreign=false,post500=false,stillPresent=false,canDelete=true}={})=>{let present=true,entry=null;const calls=[];return {calls,env:{get:()=> '1'},resolve:async()=>['8.8.8.8'],journal:{parent:async()=>({status:'completed',store:'hortimatic',product_id:'601'}),lookup:async()=>entry,claim:async(op,signature)=>{entry={signature};return {status:'claimed'};},complete:async(op,signature,record_id)=>{entry={status:'completed',signature,record_id};},uncertain:async()=>{entry.status='uncertain';}},request:async(url,options)=>{const u=new URL(url);calls.push({path:u.pathname,method:options.method});if(u.pathname==='/api/')return xml('<prestashop><api><combinations get="true" delete="'+canDelete+'"/><images get="true" delete="'+canDelete+'"/></api></prestashop>');if(options.method==='DELETE'){if(!stillPresent)present=false;return post500?new Response('error',{status:500}):new Response(null,{status:204});}if(u.pathname==='/api/products/601')return u.searchParams.get('output_format')==='JSON'?json({product:{id:'601',associations:{images:present?[{id:'90'}]:[],combinations:present?[{id:'701'}]:[]}}}):xml(root);if(u.pathname==='/api/combinations/701')return u.searchParams.get('output_format')==='JSON'?json({combination:{id:'701',id_product:foreign?'999':'601'}}):xml('<prestashop><combination><id>701</id><id_product>601</id_product></combination></prestashop>');throw Error('Unexpected removal path '+u.pathname);}};};
 const noDelete=setup({canDelete:false}),notAllowed=await runPrestashopProductStage(connection,remove(),noDelete);assert.equal(notAllowed.can_commit,false);assert.deepEqual(notAllowed.missing_permissions,['DELETE']);assert(!noDelete.calls.some(c=>c.method==='DELETE'));
 const bad=setup({foreign:true});await assert.rejects(()=>runPrestashopProductStage(connection,remove(),bad),/otro producto/);assert(!bad.calls.some(c=>c.method==='DELETE'));
 for(const kind of ['remove_variation','remove_image']){const f=setup(),op=remove(kind),prepared=await runPrestashopProductStage(connection,op,f);assert(!f.calls.some(c=>c.method==='DELETE'));await assert.rejects(()=>runPrestashopProductStage(connection,{...op,action:'prestashop_product_step_commit',expected_fingerprint:'b'.repeat(64),confirmed:true},f),/destino cambió/);const commit={...op,action:'prestashop_product_step_commit',expected_fingerprint:prepared.fingerprint,confirmed:true};assert.equal((await runPrestashopProductStage(connection,commit,f)).deleted,true);assert.equal((await runPrestashopProductStage(connection,commit,f)).reused,true);assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);assert.equal(f.calls.find(c=>c.method==='DELETE').path,kind==='remove_image'?'/api/images/products/601/90':'/api/combinations/701');}
 const lost=setup({post500:true}),op=remove(),ready=await runPrestashopProductStage(connection,op,lost);assert.equal((await runPrestashopProductStage(connection,{...op,action:'prestashop_product_step_commit',expected_fingerprint:ready.fingerprint,confirmed:true},lost)).reconciled,true);
 const stuck=setup({stillPresent:true}),p=await runPrestashopProductStage(connection,op,stuck),commit={...op,action:'prestashop_product_step_commit',expected_fingerprint:p.fingerprint,confirmed:true};await assert.rejects(()=>runPrestashopProductStage(connection,commit,stuck),/incierta/);await assert.rejects(()=>runPrestashopProductStage(connection,commit,stuck),/No se repite/);assert.equal(stuck.calls.filter(c=>c.method==='DELETE').length,1);
});


test('empty native XML association is zero, but missing nodes and another product are not',()=>{
 const empty='<prestashop><product><id>601</id><associations><images nodeType="image" api="images/products"/></associations></product></prestashop>';
 assert.deepEqual(inspectProductAssociationIds(empty,'601','images'),[]);
 assert.throws(()=>inspectProductAssociationIds(empty,'602','images'),/otro producto/);
 assert.throws(()=>inspectProductAssociationIds(empty.replace('<images nodeType="image" api="images/products"/>',''),'601','images'),/campo único/);
 assert.throws(()=>inspectProductAssociationIds(empty.replace('<images nodeType="image" api="images/products"/>','<images><image><id>bad</id></image></images>'),'601','images'),/no válido/);
});


test('organization features preserve the feature/value pair and reject duplicate or foreign values',()=>{
 const request={...base,kind:'finish',fields:{active:'0',available_for_order:'0'},associations:{product_features:[{feature_id:'4',value_id:'8'}],tags:['9'],accessories:['600']}};
 const op=validateProductStage(request);assert.deepEqual(op.associations.product_features,[{feature_id:'4',value_id:'8'}]);
 assert.throws(()=>validateProductStage({...request,associations:{product_features:[{feature_id:'4',value_id:'8'},{feature_id:'4',value_id:'10'}]}}),/repetidas/);
 const original='<prestashop><product><id>601</id><associations><combinations/><product_features/><tags/><accessories/></associations></product></prestashop>',saved=prepareProductStageXml(original,'products',request.fields,request.associations,'601');
 assert.equal(inspectProductStageXml(saved,'products',request.fields,request.associations).verified,true);
 assert.throws(()=>inspectProductStageXml(saved,'products',request.fields,{...request.associations,product_features:[{feature_id:'4',value_id:'99'}]}),/no coinciden/);
});


test('image metadata preserves the product, cover and other languages; validates ownership and record identity',async()=>{
 const op={...base,kind:'image_metadata',existing_product:true,record_id:'90',fields:{position:'2',legend:[{language_id:'1',value:'Nuevo texto'}]},associations:{}};
 assert.equal(validateProductStage(op).resource,'totus_product_images');assert.throws(()=>validateProductStage({...op,fields:{position:'0'}}),/posición/);assert.throws(()=>validateProductStage({...op,fields:{position:'1',legend:[{language_id:'1',value:'x'.repeat(129)}]}}),/Traducciones/);
 const setup=(foreign=false)=>{let saved='<prestashop><totus_product_image><id>90</id><id_product>601</id_product><position>1</position><cover>1</cover><legend><language id="1">Anterior</language><language id="2">Keep other language</language></legend></totus_product_image></prestashop>',entry=null;const calls=[];return {calls,env:{get:()=> '1'},resolve:async()=>['8.8.8.8'],journal:{parent:async()=>({status:'completed',store:'hortimatic',product_id:'601'}),lookup:async()=>entry,claim:async(op,signature)=>{entry={signature};return {status:'claimed'};},complete:async(op,signature,record_id)=>{entry={status:'completed',signature,record_id};},uncertain:async()=>{entry.status='uncertain';}},request:async(url,options)=>{const u=new URL(url);calls.push({path:u.pathname,method:options.method,body:options.body});if(u.pathname==='/api/languages')return xml('<prestashop><languages><language id="1"/><language id="2"/></languages></prestashop>');if(u.pathname==='/api/products/601')return u.searchParams.get('output_format')==='JSON'?json({product:{id:'601',associations:{images:[{id:foreign?'999':'90'},{id:'91'}]}}}):xml(root);if(u.pathname==='/api/totus_product_images/90'){if(options.method==='PUT')saved=options.body;return xml(saved);}throw Error('Unexpected metadata path '+u.pathname);}};};
 const bad=setup(true);await assert.rejects(()=>runPrestashopProductStage(connection,op,bad),/otro producto/);assert(!bad.calls.some(c=>c.method==='PUT'));
 const f=setup(),p=await runPrestashopProductStage(connection,op,f),result=await runPrestashopProductStage(connection,{...op,action:'prestashop_product_step_commit',expected_fingerprint:p.fingerprint,confirmed:true},f);assert.equal(result.verified,true);
 const body=f.calls.find(c=>c.method==='PUT').body;assert(!body.includes('<id_product>'));assert(!body.includes('<cover>'));assert(body.includes('Keep other language'));assert(body.includes('Nuevo texto'));assert(!f.calls.some(c=>c.method==='POST'));
});
