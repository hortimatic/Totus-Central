import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProductCreateRequest,prepareProductCreationXml,inspectProductReferenceListing,inspectReconciledNewProduct,parseCreatedProductId,productLanguageIdsFromListing} from '../src/productos-write-contract.js';
import {runPrestashopProductCreate} from '../supabase/functions/totus-connections/prestashop-create.js';
const id='11111111-1111-4111-8111-111111111111',call='22222222-2222-4222-8222-222222222222';
const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,real_data_authorized:true,verified_revision:2,revision:2,endpoint:'https://hortimatic.com/api/',secret:'fake-local-only'};
const input={action:'prestashop_product_create_prepare',id,call_id:call,revision:2,store:'hortimatic',reference:'TOTUS-PRUEBAS-DEMO',price:'0.00',category_id:'33',translations:[{language_id:'1',name:'Pruebas',link_rewrite:'pruebas'},{language_id:'2',name:'Tests',link_rewrite:'tests'}]};
const blank='<?xml version="1.0"?><prestashop><product><id><![CDATA[]]></id><id_category_default><![CDATA[]]></id_category_default><reference><![CDATA[]]></reference><price><![CDATA[]]></price><active><![CDATA[]]></active><name><language id="1"><![CDATA[]]></language><language id="2"><![CDATA[]]></language></name><link_rewrite><language id="1"><![CDATA[]]></language><language id="2"><![CDATA[]]></language></link_rewrite><associations><categories><category><id><![CDATA[]]></id></category></categories></associations></product></prestashop>';
const category='<prestashop><category><id><![CDATA[33]]></id><name><language id="1"><![CDATA[Cat]]></language></name></category></prestashop>';
const list='<prestashop><products/></prestashop>',newProduct='<prestashop><product><id><![CDATA[301]]></id></product></prestashop>';
const readBack='<prestashop><product><id><![CDATA[301]]></id><reference><![CDATA[TOTUS-PRUEBAS-DEMO]]></reference><active><![CDATA[0]]></active></product></prestashop>';
const response=xml=>new Response(xml,{status:200,headers:{'content-type':'application/xml'}});
const resolve=async()=>['8.8.8.8'];
const fixture=(extra={})=>{
 const calls=[];let created=false;
 const request=async(url,options)=>{
  const path=new URL(url).pathname,method=options.method,params=new URL(url).searchParams;
  calls.push({path,method,params:[...params.entries()],body:options.body});
  if(method==='POST'){created=true;return extra.post500?new Response('<prestashop><errors><error><code>5</code></error></errors></prestashop>',{status:500,headers:{'content-type':'application/xml'}}):response(newProduct);}
  if(path==='/api/categories/33')return response(category);
  if(path==='/api/products/301')return response(readBack);
  if(path==='/api/products'&&params.get('schema')==='blank')return extra.schema500?new Response('<prestashop><errors><error><code>5</code></error></errors></prestashop>',{status:500,headers:{'content-type':'application/xml'}}):response(blank);
  if(path==='/api/languages'&&params.get('display')==='[id]')return response('<prestashop><languages><language id="1"/><language id="2"/></languages></prestashop>');
  if(path==='/api/products'&&params.has('filter[reference]'))return response(extra.duplicate?'<prestashop><products><product id="120"/></products></prestashop>':created?'<prestashop><products><product><id><![CDATA[301]]></id><reference><![CDATA[TOTUS-PRUEBAS-DEMO]]></reference><active><![CDATA[0]]></active><price><![CDATA[0.000000]]></price><id_category_default><![CDATA[33]]></id_category_default></product></products></prestashop>':list);
  throw Error('Consulta inesperada: '+method+' '+path);
 };
 return {calls,request};
};
test('preparación completa idioma por idioma, precio y categoría sin activar el producto',()=>{
 const op=validateProductCreateRequest(input);
 const xml=prepareProductCreationXml(blank,op);
 assert.ok(xml.includes('<reference><![CDATA[TOTUS-PRUEBAS-DEMO]]></reference>'));
 assert.ok(xml.includes('<price><![CDATA[0.00]]></price>'));
 assert.ok(xml.includes('<active><![CDATA[0]]></active>'));
 assert.ok(xml.includes('<language id="2"><![CDATA[Tests]]></language>'));
 assert.ok(xml.includes('<id><![CDATA[33]]></id>'));
 assert.ok(!xml.includes('<id><![CDATA[301]]></id>'));
 assert.throws(()=>prepareProductCreationXml(blank,{...op,translations:[op.translations[0]]}),/idiomas del destino/);
 assert.throws(()=>validateProductCreateRequest({...input,reference:'Pruebas español'}),/Referencia/);
 assert.throws(()=>validateProductCreateRequest({...input,price:'-1'}),/Importe/);
 assert.throws(()=>validateProductCreateRequest({...input,translations:[op.translations[0],op.translations[0]]}),/repetidos/);
});
test('no crear si falta uno de los idiomas o existe referencia',async()=>{
 const {request,calls}=fixture({duplicate:true});
 await assert.rejects(()=>runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=>''}}),/Ya existe/);
 assert.equal(calls.some(x=>x.method==='POST'),false);
 assert.deepEqual(inspectProductReferenceListing('<prestashop><products><product id="100"/></products></prestashop>'),['100']);
 assert.equal(parseCreatedProductId(newProduct),'301');
});
test('preflight solo hace GET de esquema, categoría y duplicados sin tocar la tienda',async()=>{
 const {request,calls}=fixture();
 const result=await runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=>''}});
 assert.equal(result.persisted,false);assert.equal(result.operation,'create');assert.match(result.fingerprint,/^[a-f0-9]{64}$/);
 assert.deepEqual(calls.map(c=>c.method),['GET','GET','GET']);
 assert.ok(calls.every(c=>!c.body));
 assert.equal(result.language_ids.join(','),'1,2');
});
test('el commit requiere circuito de idempotencia y habilitación antes de llamar a PrestaShop',async()=>{
 const {request,calls}=fixture();
 await assert.rejects(()=>runPrestashopProductCreate(connection,{...input,action:'prestashop_product_create_commit',confirmed:true,request_id:id,expected_fingerprint:'a'.repeat(64)},{request,resolve,env:{get:()=>''}}),/Alta bloqueada/);
 assert.equal(calls.length,0);
});
test('POST aislado con journal, ID asignado por PrestaShop y relectura completa',async()=>{
 const {request,calls}=fixture(),logged=[];
 const journal={lookup:async()=>null,claim:async v=>(logged.push(['claim',v]),{status:'claimed'}),complete:async v=>logged.push(['complete',v]),uncertain:async()=>{throw Error('No hay incertidumbre');}};
 const prepare=await runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=>''}});
 calls.length=0;
 const commit={...input,action:'prestashop_product_create_commit',request_id:id,confirmed:true,expected_fingerprint:prepare.fingerprint};
 const result=await runPrestashopProductCreate(connection,commit,{request,resolve,env:{get:()=> '1'},journal});
 assert.equal(result.record_id,'301');assert.equal(result.verified,true);assert.equal(result.active,false);
 assert.deepEqual(calls.map(c=>c.method),['GET','GET','GET','POST','GET']);
 assert.equal(calls.at(-1).params.find(x=>x[0]==='display')?.[1],'[id,reference,active,price,id_category_default]');
 assert.equal(logged[0][0],'claim');assert.equal(logged[1][0],'complete');
 assert.ok(calls.find(c=>c.method==='POST').body.includes('<active><![CDATA[0]]></active>'));
});
test('POST con respuesta incierta no se reintenta automáticamente',async()=>{
 const f=fixture(),logged=[];
 const journal={lookup:async()=>null,claim:async()=>({status:'claimed'}),complete:async()=>{},uncertain:async data=>logged.push(data)};
 const prepare=await runPrestashopProductCreate(connection,input,{request:f.request,resolve,env:{get:()=>''}});
 const bad=async(url,opts)=>opts.method==='POST'?Promise.reject(Error('Error red')):f.request(url,opts);
 await assert.rejects(()=>runPrestashopProductCreate(connection,{...input,action:'prestashop_product_create_commit',request_id:id,confirmed:true,expected_fingerprint:prepare.fingerprint},{request:bad,resolve,env:{get:()=> '1'},journal}),/incierto/);
 assert.equal(logged.length,1);
 assert.equal(logged[0].request_id,id);
});
test('no admite enlaces, IDs o referencias ajenos a Hortimatic',async()=>{
 const f=fixture();
 await assert.rejects(()=>runPrestashopProductCreate({...connection,endpoint:'https://newoldsmok.com/api/'},input,{request:f.request,resolve,env:{get:()=>''}}),/URL oficial/);
 await assert.rejects(()=>runPrestashopProductCreate(connection,{...input,store:'newoldsmok'},{request:f.request,resolve,env:{get:()=>''}}),/no corresponde/);
});


test('PrestaShop 1.7.8 con schema=blank HTTP 500: plantilla mínima usa idiomas propios y no copia productos',async()=>{
 const {request,calls}=fixture({schema500:true});
 const result=await runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=>''}});
 assert.equal(result.persisted,false);
 assert.equal(result.legacy_schema_fallback,true);
 assert.match(result.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(calls.some(c=>c.path==='/api/languages'),true);
 assert.equal(calls.some(c=>c.method==='POST'),false);
 assert.deepEqual(calls.map(c=>c.method),['GET','GET','GET','GET']);
});

test('idiomas PrestaShop permiten ID atributo o nodo, pero bloquean inconsistencias y duplicados',()=>{
 assert.deepEqual(productLanguageIdsFromListing('<prestashop><languages><language id="1"/><language id="2"/></languages></prestashop>'),['1','2']);
 assert.deepEqual(productLanguageIdsFromListing('<prestashop><languages><language><id><![CDATA[1]]></id></language><language><id>2</id></language></languages></prestashop>'),['1','2']);
 assert.throws(()=>productLanguageIdsFromListing('<prestashop><languages><language id="1"><id>2</id></language></languages></prestashop>'),/ambiguo/);
 assert.throws(()=>productLanguageIdsFromListing('<prestashop><languages><language id="1"/><language><id>1</id></language></languages></prestashop>'),/duplicados/);
});

test('HTTP 500 tras crear: un GET demuestra el alta y el diario la completa sin segundo POST',async()=>{
 const {request,calls}=fixture({post500:true}),journalRecords=new Map();
 const journal={
  lookup:async request_id=>journalRecords.get(request_id)||null,
  claim:async row=>{journalRecords.set(row.request_id,{...row,status:'pending'});return {status:'claimed'};},
  complete:async row=>{journalRecords.set(row.request_id,{...journalRecords.get(row.request_id),product_id:row.product_id,status:'completed'});},
  uncertain:async row=>{journalRecords.set(row.request_id,{...journalRecords.get(row.request_id),status:'uncertain'});}
 };
 const preview=await runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=>''}});
 const cmd={...input,action:'prestashop_product_create_commit',request_id:id,confirmed:true,expected_fingerprint:preview.fingerprint};
 const result=await runPrestashopProductCreate(connection,cmd,{request,resolve,env:{get:()=> '1'},journal});
 assert.equal(result.record_id,'301');
 assert.equal(result.reconciled_after_post_error,true);
 assert.equal(journalRecords.get(id).status,'completed');
 const repeated=await runPrestashopProductCreate(connection,cmd,{request,resolve,env:{get:()=> '1'},journal});
 assert.equal(repeated.record_id,'301');assert.equal(repeated.reused,true);
 assert.equal(calls.filter(c=>c.method==='POST').length,1);
});
test('comprobación de relectura exige precio, categoría, referencia e inactividad',()=>{
 const xml='<prestashop><products><product><id>301</id><reference>TOTUS-PRUEBAS-DEMO</reference><active>0</active><price>0.000000</price><id_category_default>33</id_category_default></product></products></prestashop>';
 const op={reference:input.reference,price:input.price,category_id:input.category_id};
 assert.equal(inspectReconciledNewProduct(xml,op,'301').id,'301');
 assert.throws(()=>inspectReconciledNewProduct(xml,{...op,price:'1.00'}),/precio/i);
 assert.throws(()=>inspectReconciledNewProduct(xml,{...op,category_id:'2'}),/categoría/i);
 assert.throws(()=>inspectReconciledNewProduct(xml,{...op,reference:'OTRA-REF'}),/referencia/i);
 assert.throws(()=>inspectReconciledNewProduct(xml.replace('<active>0</active>','<active>1</active>'),op),/inactivo/i);
 assert.throws(()=>inspectReconciledNewProduct(xml,op,'302'),/otro ID/i);
});
