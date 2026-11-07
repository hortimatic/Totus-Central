import assert from 'node:assert/strict';
import test from 'node:test';
import {deflateSync,crc32} from 'node:zlib';
import {readPrestashopProductCreateProfile,runPrestashopProductCreate} from '../../supabase/functions/totus-connections/prestashop-create.js';
import {runPrestashopProductWrite} from '../../supabase/functions/totus-connections/prestashop-write.js';
import {inspectReconciledNewProduct,minimalBlankProductSchema} from '../../src/productos-write-contract.js';
import {runPrestashopProductStage} from '../../supabase/functions/totus-connections/prestashop-product-stage.js';
import {buildVisualProductDescription} from '../../src/productos-description.js';

const key='TOTUSPRESTASHOPQA123456789012345';
const localBase='http://localhost:8000';
const connection={
 protocol:'prestashop',name:'PrestaShop · Hortimatic',endpoint:'https://hortimatic.com/api/',
 enabled:true,real_data_authorized:true,verified_revision:2,revision:2,secret:key
};
const resolve=async()=>['8.8.8.8'];
const calls=[];
async function localOnlyRequest(url,opts={}){
 const remote=new URL(url);
 assert.equal(remote.origin,'https://hortimatic.com','No test request may target any other origin.');
 assert(remote.pathname.startsWith('/api/'));
 // Hortimatic returns a complete blank schema, unlike this image's legacy
 // schema=blank HTTP500. Model that read response; every POST/PUT still reaches
 // the real disposable PrestaShop and its database, never the live shop.
 if(remote.pathname==='/api/products'&&remote.searchParams.get('schema')==='blank'){
  const complete=minimalBlankProductSchema(['1'])
   .replace('<reference>','<id_default_image><![CDATA[]]></id_default_image><id_default_combination><![CDATA[]]></id_default_combination><position_in_category><![CDATA[]]></position_in_category><type><![CDATA[]]></type><reference>')
   .replace('</associations>','<images><image><id><![CDATA[]]></id></image></images><stock_availables><stock_available><id><![CDATA[]]></id><id_product_attribute><![CDATA[]]></id_product_attribute></stock_available></stock_availables><product_bundle><product><id><![CDATA[]]></id><quantity><![CDATA[]]></quantity></product></product_bundle></associations>');
  return new Response(complete,{headers:{'Content-Type':'application/xml'}});
 }
 const local=new URL(remote.pathname+remote.search,localBase);
 const headers=new Headers(opts.headers);
 assert.equal(headers.get('authorization'),'Basic '+btoa(key+':'));
 calls.push({method:opts.method||'GET',path:local.pathname});
 const response=await fetch(local,{...opts,redirect:'manual',headers});
 if(!response.ok){
  const body=await response.clone().text();
  console.error('CI isolated webservice HTTP',response.status,local.pathname+local.search,'body=',body.slice(0,1600));
  if(opts.method==='POST'&&response.status===500){
   const path='/api/products?filter%5Breference%5D=%5BTOTUS-CI-PRUEBAS%5D&display=%5Bid%2Creference%2Cactive%2Cprice%2Cid_category_default%2Cname%2Clink_rewrite%5D';
   const inspect=await fetch(new URL(path,localBase),{headers,redirect:'manual'});
   console.log('POST 500 reconciliation diagnostic',inspect.status,(await inspect.text()).slice(0,2200));
  }
 }
 return response;
}
const environment={get:name=>['TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED','TOTUS_PRESTASHOP_PRODUCT_STAGES_ENABLED','TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED'].includes(name)?'1':undefined};
const journalData=new Map();
const journal={
 lookup:async key=>journalData.get(key)||null,
 claim:async record=>{
  if(journalData.has(record.request_id)||[...journalData.values()].some(row=>row.store===record.store&&row.reference===record.reference))return {status:'duplicate_reference'};
  journalData.set(record.request_id,{...record,status:'pending'});return {status:'claimed'};
 },
 complete:async ({request_id,product_id})=>{
  const row=journalData.get(request_id);assert.equal(row?.status,'pending');Object.assign(row,{status:'completed',product_id});
 },
 uncertain:async ({request_id,product_id})=>{
  const row=journalData.get(request_id);assert.equal(row?.status,'pending');Object.assign(row,{status:'uncertain',product_id});
 }
};
test('PrestaShop Flashlight 1.7.8.11: create inactive product, verify ID and no duplicate on replay',async()=>{
 const root=await localOnlyRequest('https://hortimatic.com/api/',{
  method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/xml'}
 });
 assert.equal(root.status,200,'PrestaShop Webservice GET must accept our fictional CI key; redirect='+String(root.headers.get('location')||'none'));
 await root.body?.cancel();
 const profile=await readPrestashopProductCreateProfile(connection,{store:'hortimatic'},
  {request:localOnlyRequest,resolve});
 assert.equal(profile.persisted,false);assert(profile.language_ids.length>0);
 const record={action:'prestashop_product_create_prepare',
   id:'11111111-1111-4111-8111-111111111111',
   call_id:'22222222-2222-4222-8222-222222222222',
   revision:2,store:'hortimatic',
   reference:'TOTUS-CI-PRUEBAS',
   price:'1.00',category_id:'2',fields:[{field:'wholesale_price',value:'0.39'},{field:'weight',value:'0.15'},{field:'unit_price_ratio',value:'2'},{field:'unity',value:'l'},{field:'width',value:'0.35'},{field:'height',value:'0.24'},{field:'depth',value:'0.16'}],
   translations:profile.language_ids.map(id=>({language_id:id,name:'Pruebas CI',link_rewrite:'pruebas-ci',description:'Descripción de prueba aislada',meta_title:'SEO de prueba'}))
 };
 const preflight=await runPrestashopProductCreate(connection,record,{request:localOnlyRequest,resolve,env:environment});
 assert.equal(preflight.persisted,false);
 assert.match(preflight.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(calls.some(x=>x.method==='POST'),false,'Preflight must not write.');
 const request_id='33333333-3333-4333-8333-333333333333';
 const commit={...record,action:'prestashop_product_create_commit',request_id,
  confirmed:true,expected_fingerprint:preflight.fingerprint};
 const result=await runPrestashopProductCreate(connection,commit,
  {request:localOnlyRequest,resolve,env:environment,journal});
 assert.equal(result.persisted,true);
 assert.equal(result.active,false);
 assert.equal(result.verified,true);
 assert.match(result.record_id,/^[1-9]\d+$/);
 assert.equal(calls.filter(x=>x.method==='POST').length,1);
 const repeat=await runPrestashopProductCreate(connection,commit,
  {request:localOnlyRequest,resolve,env:environment,journal});
 assert.equal(repeat.reused,true);
 assert.equal(repeat.record_id,result.record_id);
 assert.equal(calls.filter(x=>x.method==='POST').length,1,'Replay must never send a second POST.');
 const url=new URL('https://hortimatic.com/api/products');
 url.searchParams.set('filter[reference]','['+record.reference+']');
 url.searchParams.set('display','[id,reference,active,price,id_category_default,name,link_rewrite,wholesale_price,weight,description,meta_title,unit_price_ratio,unity,width,height,depth]');
 const readBack=await localOnlyRequest(url.href,{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/xml'}});
 assert.equal(readBack.status,200);
 const verified=inspectReconciledNewProduct(await readBack.text(),record,result.record_id);
 assert.equal(verified.active,false);
 console.log('SANDBOX 1.7.8.11: ID '+result.record_id+' inactivo, 1 POST, relectura y reintento idempotente.');
 const stageData=new Map(),stageJournal={parent:async()=>journalData.get(request_id),lookup:async op=>stageData.get(op.stage)||null,
  claim:async(op,signature)=>{if(stageData.has(op.stage))return stageData.get(op.stage);stageData.set(op.stage,{status:'pending',signature});return {status:'claimed'};},
  complete:async(op,signature,record_id)=>{assert.equal(stageData.get(op.stage).signature,signature);stageData.set(op.stage,{status:'completed',signature,record_id});},
  uncertain:async op=>{stageData.get(op.stage).status='uncertain';}};
 const optionResponse=await localOnlyRequest('https://hortimatic.com/api/product_option_values?output_format=JSON&display=[id]&sort=[id_DESC]&limit=0,1',{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/json'}});
 assert.equal(optionResponse.status,200);const option=(await optionResponse.json()).product_option_values[0];assert(option?.id);
 const stage={action:'prestashop_product_step_prepare',id:record.id,call_id:record.call_id,revision:2,store:'hortimatic',parent_request_id:request_id,product_id:result.record_id,kind:'variation',step_key:'ci_blue',fields:{reference:'TOTUS-CI-PRUEBAS-BLUE',price:'0.50',wholesale_price:'0.39',weight:'0.02',minimal_quantity:'1',default_on:'1'},associations:{product_option_values:[String(option.id)]}};
 const options={request:localOnlyRequest,resolve,env:environment,journal:stageJournal};
 const prep=await runPrestashopProductStage(connection,stage,options);
 const variation=await runPrestashopProductStage(connection,{...stage,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prep.fingerprint},options);
 assert.equal(variation.verified,true);
 const replay=await runPrestashopProductStage(connection,{...stage,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prep.fingerprint},options);assert.equal(replay.reused,true);
 assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/combinations').length,1);
 const otherOptionsResponse=await localOnlyRequest('https://hortimatic.com/api/product_option_values?output_format=JSON&display=[id]&sort=[id_ASC]&limit=0,2',{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/json'}});
 assert.equal(otherOptionsResponse.status,200);
 const otherOption=(await otherOptionsResponse.json()).product_option_values.find(o=>String(o.id)!==String(option.id));assert(otherOption?.id);
 const secondary={...stage,step_key:'ci_secondary',fields:{...stage.fields,reference:'TOTUS-CI-PRUEBAS-SECONDARY',default_on:'0'},associations:{product_option_values:[String(otherOption.id)]}};
 const secondaryPrep=await runPrestashopProductStage(connection,secondary,options);
 const secondaryCommit={...secondary,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:secondaryPrep.fingerprint};
 const secondaryDone=await runPrestashopProductStage(connection,secondaryCommit,options);assert.equal(secondaryDone.verified,true);
 const secondaryRead=await localOnlyRequest('https://hortimatic.com/api/combinations/'+secondaryDone.record_id+'?output_format=JSON',{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/json'}});
 assert.equal(secondaryRead.status,200);assert.equal((await secondaryRead.json()).combination.default_on,null,'Native non-default combinations use SQL NULL');
 const secondaryWrites=calls.filter(c=>c.method==='POST'&&c.path==='/api/combinations').length;
 assert.equal((await runPrestashopProductStage(connection,secondaryCommit,options)).reused,true);
 assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/combinations').length,secondaryWrites);
 const stock={...stage,kind:'stock',step_key:'ci_stock',fields:{id_product_attribute:variation.record_id,quantity:'7',out_of_stock:'0',depends_on_stock:'0'}};delete stock.associations;
 const stockPrep=await runPrestashopProductStage(connection,stock,options);
 const stockDone=await runPrestashopProductStage(connection,{...stock,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:stockPrep.fingerprint},options);
 assert.equal(stockDone.verified,true);
 console.log('SANDBOX: variación '+variation.record_id+' creada una vez y existencias 7 verificadas por GET.');
 const supplierResponse=await localOnlyRequest('https://hortimatic.com/api/suppliers?output_format=JSON&display=[id]&sort=[id_DESC]&limit=0,1',{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/json'}});
 assert.equal(supplierResponse.status,200);const supplier=(await supplierResponse.json()).suppliers[0];
 const currencyResponse=await localOnlyRequest('https://hortimatic.com/api/currencies?output_format=JSON&display=[id]&limit=0,1',{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/json'}});
 assert.equal(currencyResponse.status,200);const currency=(await currencyResponse.json()).currencies[0];
 const supplierPrice={...stage,kind:'supplier_price',step_key:'ci_supplier',fields:{id_product_attribute:variation.record_id,id_supplier:String(supplier.id),id_currency:String(currency.id),product_supplier_reference:'CI-SUPPLIER-BLUE',product_supplier_price_te:'0.35'}};delete supplierPrice.associations;
 const supplierPrep=await runPrestashopProductStage(connection,supplierPrice,options);
 assert.equal((await runPrestashopProductStage(connection,{...supplierPrice,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:supplierPrep.fingerprint},options)).verified,true);
 const offer={...stage,kind:'special_price',step_key:'ci_offer',fields:{id_product_attribute:variation.record_id,id_shop:'0',id_shop_group:'0',id_currency:'0',id_country:'0',id_group:'0',id_customer:'0',id_cart:'0',price:'-1',from_quantity:'1',reduction:'0.10',reduction_tax:'1',reduction_type:'percentage',from:'0000-00-00 00:00:00',to:'0000-00-00 00:00:00'}};delete offer.associations;
 const offerPrep=await runPrestashopProductStage(connection,offer,options);
 assert.equal((await runPrestashopProductStage(connection,{...offer,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:offerPrep.fingerprint},options)).verified,true);
 const chunk=(name,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(name,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+data.length)),8+data.length);return b;};
 const header=Buffer.alloc(13);header.writeUInt32BE(64);header.writeUInt32BE(64,4);header[8]=8;header[9]=6;
 const pixels=Buffer.alloc(64*(64*4+1));for(let y=16;y<48;y++)for(let x=16;x<48;x++){const p=y*257+1+x*4;pixels[p]=20;pixels[p+1]=130;pixels[p+2]=80;pixels[p+3]=255;}
 const image64=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
 const upload={...stage,kind:'image',step_key:'ci_picture',image:{name:'ci-transparent.png',mime:'image/png',base64:image64}};delete upload.fields;delete upload.associations;
 const uploadPrep=await runPrestashopProductStage(connection,upload,options);
 const picture=await runPrestashopProductStage(connection,{...upload,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:uploadPrep.fingerprint},options);
 assert.equal(picture.verified,true);assert.equal(picture.original_transparent,true);
 const visual=buildVisualProductDescription({store:'hortimatic',title:'Pruebas CI',intro:'Muestra no comprable.',detailTitle:'Detalle',detailText:'Contenido de prueba.',specifications:'Capacidad: 2 litros\nMaterial: Metal',box:'Una muestra.',notice:'No comprar: demostración.',images:[{id:picture.record_id}]});
 const finish={...stage,kind:'finish',step_key:'ci_finish',fields:{active:'1',available_for_order:'0',visibility:'none',description:profile.language_ids.map(language_id=>({language_id,value:visual.description})),description_short:profile.language_ids.map(language_id=>({language_id,value:visual.description_short}))}};delete finish.associations;
 const finishPrep=await runPrestashopProductStage(connection,finish,options);
 const finished=await runPrestashopProductStage(connection,{...finish,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:finishPrep.fingerprint},options);
 assert.equal(finished.verified,true);
 const untouched=await localOnlyRequest('https://hortimatic.com/api/products/'+result.record_id+'?output_format=JSON&display=[id,wholesale_price,price,weight,active,available_for_order]',{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/json'}});
 assert.equal(untouched.status,200);const savedData=await untouched.json(),saved=savedData.product||savedData.products?.[0];assert(saved,'Native response must contain its product');
 assert.equal(Number(saved.wholesale_price),0.39);assert.equal(Number(saved.price),1);assert.equal(Number(saved.weight),0.15);assert.equal(Number(saved.available_for_order),0);
 let editStatus=null;
 const editJournal={lookup:async()=>editStatus,claim:async()=>{assert.equal(editStatus,null);editStatus={status:'pending'};return {status:'claimed'};},complete:async()=>{editStatus={status:'completed'};},uncertain:async()=>{editStatus={status:'uncertain'};}};
 const edit={action:'prestashop_product_prepare',id:record.id,call_id:crypto.randomUUID(),revision:record.revision,store:'hortimatic',resource:'products',record_id:result.record_id,changes:[{field:'price',value:'2.35'}]};
 const editOptions={request:localOnlyRequest,resolve,env:environment,journal:editJournal};
 const editPrepared=await runPrestashopProductWrite(connection,edit,editOptions);
 const editCommit={...edit,action:'prestashop_product_commit',request_id:crypto.randomUUID(),expected_fingerprint:editPrepared.fingerprint,confirmed:true};
 assert.equal((await runPrestashopProductWrite(connection,editCommit,editOptions)).verified,true);
 const ratioResponse=await localOnlyRequest('https://hortimatic.com/api/products/'+result.record_id+'?output_format=JSON&display=[id,price,unit_price_ratio,unity]',{method:'GET',headers:{Authorization:'Basic '+btoa(key+':'),Accept:'application/json'}});
 assert.equal(ratioResponse.status,200);
 const ratioData=await ratioResponse.json(),ratioProduct=ratioData.product||ratioData.products?.[0];
 assert.equal(Number(ratioProduct.price),2.35);
 assert.equal(Number(ratioProduct.unit_price_ratio),2,'Changing price must preserve the original unit ratio');
 assert.equal(ratioProduct.unity,'l');
 const writesBefore=calls.filter(c=>c.method==='PUT').length;
 assert.equal((await runPrestashopProductWrite(connection,editCommit,editOptions)).replayed,true);
 assert.equal(calls.filter(c=>c.method==='PUT').length,writesBefore);
 console.log('SANDBOX: PNG transparente cargado y publicación no comprable verificada; coste, precio y peso conservados.');
});
