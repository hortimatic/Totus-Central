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

test('el esquema nativo completo no envía setters calculados ni asociaciones vacías',()=>{
 const full=blank.replace('<reference>',
  '<id_default_image><![CDATA[]]></id_default_image><id_default_combination><![CDATA[]]></id_default_combination><position_in_category><![CDATA[]]></position_in_category><type><![CDATA[]]></type><reference>')
  .replace('</associations>', '<images><image><id><![CDATA[]]></id></image></images><stock_availables><stock_available><id><![CDATA[]]></id><id_product_attribute><![CDATA[]]></id_product_attribute></stock_available></stock_availables><product_bundle><product><id><![CDATA[]]></id><quantity><![CDATA[]]></quantity></product></product_bundle></associations>');
 const request=validateProductCreateRequest({...input,fields:[{field:'weight',value:'0.65'},{field:'wholesale_price',value:'3.90'}],relations:{supplier_id:'1',category_ids:['33','40'],features:[{feature_id:'4',value_id:'51'}]}});
 const actual=prepareProductCreationXml(full,request);
 assert.doesNotMatch(actual,/<(?:id_default_image|id_default_combination|position_in_category|type|images|stock_availables|product_bundle)>/);
 assert.match(actual,/<weight><!\[CDATA\[0\.65\]\]><\/weight>/);
 assert.match(actual,/<wholesale_price><!\[CDATA\[3\.90\]\]><\/wholesale_price>/);
 assert.match(actual,/<id_supplier><!\[CDATA\[1\]\]><\/id_supplier>/);
 assert.match(actual,/<id_feature_value><!\[CDATA\[51\]\]><\/id_feature_value>/);
 assert.match(actual,/<language id="2"><!\[CDATA\[Tests\]\]><\/language>/);
 assert.throws(()=>prepareProductCreationXml(full.replace('<id><![CDATA[]]></id>','<id>12</id>'),request),/no es una ficha en blanco/);
});

test('alta relaciona múltiples categorías, marca, proveedor, impuestos, materiales, etiquetas y productos relacionados',()=>{
 const op=validateProductCreateRequest({...input,relations:{manufacturer_id:'3',supplier_id:'4',tax_rules_group_id:'1',category_ids:['33','40'],related_product_ids:['51'],tag_ids:['8'],features:[{feature_id:'2',value_id:'5'}]}});
 const xml=prepareProductCreationXml(blank,op);
 assert.match(xml,/<id_manufacturer><!\[CDATA\[3\]\]><\/id_manufacturer>/);
 assert.match(xml,/<accessories><product><id><!\[CDATA\[51\]\]><\/id><\/product><\/accessories>/);
 assert.match(xml,/<id_feature_value><!\[CDATA\[5\]\]><\/id_feature_value>/);
 const persisted=xml.replace('<id><![CDATA[]]></id>','<id><![CDATA[301]]></id>').replace('<product>','<products><product>').replace('</prestashop>','</products></prestashop>');
 assert.equal(inspectReconciledNewProduct(persisted,op,'301').verified,true);
 assert.throws(()=>inspectReconciledNewProduct(persisted.replace('CDATA[51','CDATA[52'),op,'301'),/accessories/);
 assert.throws(()=>validateProductCreateRequest({...input,relations:{category_ids:['40']}}),/principal/);
 assert.throws(()=>validateProductCreateRequest({...input,relations:{features:[{feature_id:'2',value_id:'5'},{feature_id:'2',value_id:'6'}]}}),/repetida/);
 assert.throws(()=>validateProductCreateRequest({...input,relations:{manufacturer_id:'https://evil.test'}}),/registro real/);
});

test('un valor de otra característica se rechaza antes de crear el producto',async()=>{
 const f=fixture();const calls=[];
 const request=async(url,opts)=>{
  const path=new URL(url).pathname;calls.push({path,method:opts.method});
  if(path==='/api/product_features/2')return response('<prestashop><product_feature><id>2</id></product_feature></prestashop>');
  if(path==='/api/product_feature_values/5')return response('<prestashop><product_feature_value><id>5</id><id_feature>9</id_feature></product_feature_value></prestashop>');
  return f.request(url,opts);
 };
 await assert.rejects(()=>runPrestashopProductCreate(connection,{...input,relations:{features:[{feature_id:'2',value_id:'5'}]}},{request,resolve,env:{get:()=>''}}),/no pertenece/);
 assert.equal(calls.some(c=>c.method==='POST'),false);
});
test('alta conserva campos adicionales, traducciones y entidades literales; la relectura detecta pérdidas',()=>{
 const extra={...input,fields:[{field:'wholesale_price',value:'3.90'},{field:'ean13',value:'1234567890123'}],translations:input.translations.map(t=>({...t,description:'Texto &amp; literal ]]> fin',meta_title:'Título SEO'}))};
 const op=validateProductCreateRequest(extra),xml=prepareProductCreationXml(blank,op);
 assert.match(xml,/<wholesale_price><!\[CDATA\[3\.90\]\]><\/wholesale_price>/);
 const product=xml.replace('<id><![CDATA[]]></id>','<id><![CDATA[301]]></id>').replace('<product>','<products><product>').replace('</product>','</product></products>');
 assert.equal(inspectReconciledNewProduct(product,op,'301').verified,true);
 assert.throws(()=>inspectReconciledNewProduct(product.replace('CDATA[3.90','CDATA[3.00'),op,'301'),/wholesale_price/);
 assert.throws(()=>validateProductCreateRequest({...extra,fields:[{field:'id_shop',value:'2'}]}),/admitido/);
});
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
  if(path==='/api/products'&&params.has('filter[reference]'))return response(extra.duplicate?'<prestashop><products><product id="120"/></products></prestashop>':created?'<prestashop><products><product><id><![CDATA[301]]></id><reference><![CDATA[TOTUS-PRUEBAS-DEMO]]></reference><active><![CDATA[0]]></active><price><![CDATA[0.000000]]></price><id_category_default><![CDATA[33]]></id_category_default><name><language id="1"><![CDATA[Pruebas]]></language><language id="2"><![CDATA[Tests]]></language></name><link_rewrite><language id="1"><![CDATA[pruebas]]></language><language id="2"><![CDATA[tests]]></language></link_rewrite></product></products></prestashop>':list);
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
 assert.ok(xml.includes('<state><![CDATA[1]]></state>'),'saved state is independent of public activation');
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
 assert.deepEqual(calls.map(c=>c.method),['GET','GET','GET','GET']);
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
 assert.deepEqual(calls.map(c=>c.method),['GET','GET','GET','GET','POST','GET']);
 assert.equal(calls.at(-1).params.find(x=>x[0]==='display')?.[1],'[id,reference,active,price,id_category_default,name,link_rewrite]');
 assert.equal(logged[0][0],'claim');assert.equal(logged[1][0],'complete');
 assert.ok(calls.find(c=>c.method==='POST').body.includes('<active><![CDATA[0]]></active>'));
});
test('POST con respuesta incierta no se reintenta automáticamente',async()=>{
 const f=fixture(),logged=[];
 const journal={lookup:async()=>null,claim:async()=>({status:'claimed'}),complete:async()=>{},uncertain:async data=>logged.push(data)};
 const prepare=await runPrestashopProductCreate(connection,input,{request:f.request,resolve,env:{get:()=>''}});
 const bad=async(url,opts)=>opts.method==='POST'?Promise.reject(Error('Error red')):f.request(url,opts);
 await assert.rejects(()=>runPrestashopProductCreate(connection,{...input,action:'prestashop_product_create_commit',request_id:id,confirmed:true,expected_fingerprint:prepare.fingerprint},{request:bad,resolve,env:{get:()=> '1'},journal}),/incierta/);
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
 const xml='<prestashop><products><product><id>301</id><reference>TOTUS-PRUEBAS-DEMO</reference><active>0</active><price>0.000000</price><id_category_default>33</id_category_default><name><language id="1">Pruebas</language><language id="2">Tests</language></name><link_rewrite><language id="1">pruebas</language><language id="2">tests</language></link_rewrite></product></products></prestashop>';
 const op={reference:input.reference,price:input.price,category_id:input.category_id,translations:input.translations};
 assert.equal(inspectReconciledNewProduct(xml,op,'301').id,'301');
 assert.throws(()=>inspectReconciledNewProduct(xml,{...op,price:'1.00'}),/precio/i);
 assert.throws(()=>inspectReconciledNewProduct(xml,{...op,category_id:'2'}),/categoría/i);
 assert.throws(()=>inspectReconciledNewProduct(xml,{...op,reference:'OTRA-REF'}),/referencia/i);
 assert.throws(()=>inspectReconciledNewProduct(xml.replace('<active>0</active>','<active>1</active>'),op),/inactivo/i);
 assert.throws(()=>inspectReconciledNewProduct(xml,op,'302'),/otro ID/i);
 assert.throws(()=>inspectReconciledNewProduct(xml.replace('>Pruebas</language>','>Otro nombre</language>'),op),/Traducción name/i);
 assert.throws(()=>inspectReconciledNewProduct(xml.replace('>tests</language>','>otro-slug</language>'),op),/Traducción link_rewrite/i);
});
test('reconciliar una respuesta perdida solo relee: no repite POST y completa el diario incierto',async()=>{
 const f=fixture(),entries=new Map();let interrupt=true;
 const journal={lookup:async k=>entries.get(k)||null,claim:async row=>{entries.set(row.request_id,{...row,status:'pending'});return {status:'claimed'};},complete:async row=>{entries.set(row.request_id,{...entries.get(row.request_id),status:'completed',product_id:row.product_id});},uncertain:async row=>{entries.set(row.request_id,{...entries.get(row.request_id),status:'uncertain'});}};
 const request=async(url,opts)=>{if(interrupt&&opts.method==='GET'&&new URL(url).searchParams.get('display')?.includes('active'))throw Error('Lectura interrumpida');return f.request(url,opts);};
 const preview=await runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=> '1'}});
 const command={...input,action:'prestashop_product_create_commit',confirmed:true,request_id:id,expected_fingerprint:preview.fingerprint};
 await assert.rejects(()=>runPrestashopProductCreate(connection,command,{request,resolve,env:{get:()=> '1'},journal}),/incierta/);
 assert.equal(entries.get(id).status,'uncertain');interrupt=false;
 const recovered=await runPrestashopProductCreate(connection,command,{request,resolve,env:{get:()=> '1'},journal});
 assert.equal(recovered.record_id,'301');assert.equal(recovered.reused,true);assert.equal(entries.get(id).status,'completed');
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});

test('recuperación explícita conserva UUID e intención, comprueba ausencia dos veces y solo reclama un incierto',async()=>{
 const f=fixture();let saved=null,retries=0;
 const j={lookup:async()=>saved,claim:async()=>{throw Error('No usar claim nuevo');},complete:async r=>{saved={...saved,status:'completed',product_id:r.product_id};},uncertain:async()=>{},retryAbsent:async()=>{assert.equal(saved.status,'uncertain');saved.status='pending';retries++;return {status:'claimed'};}};
 const preview=await runPrestashopProductCreate(connection,input,{request:f.request,resolve,env:{get:()=> '1'}});
 const signature=await (await import('../src/productos-write-contract.js')).sha256Text(JSON.stringify({store:'hortimatic',reference:input.reference,price:input.price,category_id:input.category_id,translations:input.translations,fields:[]}));
 saved={status:'uncertain',store:'hortimatic',reference:input.reference,signature,product_id:null};
 const cmd={...input,action:'prestashop_product_create_commit',confirmed:true,request_id:id,expected_fingerprint:preview.fingerprint};
 await assert.rejects(()=>runPrestashopProductCreate(connection,cmd,{request:f.request,resolve,env:{get:()=> '1'},journal:j}),/exactamente/);
 assert.equal(retries,0);assert.equal(f.calls.some(c=>c.method==='POST'),false);
 const before=f.calls.length;
 const result=await runPrestashopProductCreate(connection,{...cmd,retry_absent:true},{request:f.request,resolve,env:{get:()=> '1'},journal:j});
 assert.equal(result.record_id,'301');assert.equal(retries,1);
 assert.equal(f.calls.slice(before).filter(c=>c.method==='GET'&&c.params.some(([k,v])=>k==='display'&&v==='[id,reference]')).length,2);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 const again=await runPrestashopProductCreate(connection,{...cmd,retry_absent:true},{request:f.request,resolve,env:{get:()=> '1'},journal:j});
 assert.equal(again.reused,true);assert.equal(retries,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 assert.throws(()=>validateProductCreateRequest({...input,retry_absent:true}),/confirmación expresa/);
});

test('nombre nativo inválido se rechaza antes de consultar o reservar un alta',async()=>{
 const f=fixture();
 await assert.rejects(()=>runPrestashopProductCreate(connection,{...input,translations:input.translations.map(t=>({...t,name:'pruebas#2'}))},{request:f.request,resolve,env:{get:()=>''}}),/caracteres/);
 assert.equal(f.calls.length,0);
});

test('perfil multilingüe prevalece sobre un blank limitado al idioma predeterminado',async()=>{
 const f=fixture();
 const request=async(url,options)=>new URL(url).searchParams.get('schema')==='blank'
  ?response(blank.replaceAll('<language id="1"><![CDATA[]]></language>','')):f.request(url,options);
 const result=await runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=>''}});
 assert.deepEqual(result.language_ids,['1','2']);
 assert.equal(result.persisted,false);
 assert.equal(f.calls.some(c=>c.method==='POST'),false);
});

test('corregir alta ausente conserva UUID y referencia y exige CAS de la firma anterior',async()=>{
 const f=fixture(),old='b'.repeat(64);let saved={status:'uncertain',store:input.store,reference:input.reference,signature:old,product_id:null};
 const journal={lookup:async()=>saved,claim:async()=>{throw Error('No nueva reserva');},uncertain:async()=>{},
 retryAbsent:async row=>{
  assert.equal(row.previous_signature,old);assert.notEqual(row.signature,old);
  assert.equal(row.request_id,id);assert.equal(row.reference,input.reference);
  assert.equal(f.calls.filter(c=>c.params.some(([k,v])=>k==='display'&&v==='[id,reference]')).length,3);
  saved={...saved,signature:row.signature,status:'pending'};return {status:'claimed'};
 },complete:async row=>{saved={...saved,status:'completed',product_id:row.product_id};}};
 const preview=await runPrestashopProductCreate(connection,input,{request:f.request,resolve,env:{get:()=> '1'}});
 const cmd={...input,action:'prestashop_product_create_commit',confirmed:true,request_id:id,expected_fingerprint:preview.fingerprint};
 await assert.rejects(()=>runPrestashopProductCreate(connection,cmd,{request:f.request,resolve,env:{get:()=> '1'},journal}),/otra solicitud/);
 const result=await runPrestashopProductCreate(connection,{...cmd,retry_absent:true},{request:f.request,resolve,env:{get:()=> '1'},journal});
 assert.equal(result.record_id,'301');assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 const again=await runPrestashopProductCreate(connection,{...cmd,retry_absent:true},{request:f.request,resolve,env:{get:()=> '1'},journal});
 assert.equal(again.reused,true);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});

test('alta y relectura solicitan expresamente todos los idiomas instalados',async()=>{
 const f=fixture(),request=async(url,opts)=>{
  const u=new URL(url);
  if(opts.method==='POST'||u.searchParams.get('display')?.includes('active'))assert.equal(u.searchParams.get('language'),'[1|2]');
  return f.request(url,opts);
 };
 const j={lookup:async()=>null,claim:async()=>({status:'claimed'}),complete:async()=>{},uncertain:async()=>{throw Error('Idioma perdido');}};
 const prepared=await runPrestashopProductCreate(connection,input,{request,resolve,env:{get:()=> '1'}});
 assert.equal((await runPrestashopProductCreate(connection,{...input,action:'prestashop_product_create_commit',request_id:id,expected_fingerprint:prepared.fingerprint,confirmed:true},{request,resolve,env:{get:()=> '1'},journal:j})).verified,true);
});
