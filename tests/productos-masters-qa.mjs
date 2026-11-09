import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProductWriteRequest,selectedXmlValues} from '../src/productos-write-contract.js';
import {validateProductStage} from '../src/productos-stages-contract.js';
import {associatedMasterProducts} from '../src/productos-masters-ui.js';
import {runPrestashopProductWrite} from '../supabase/functions/totus-connections/prestashop-write.js';
import {runPrestashopProductStage} from '../supabase/functions/totus-connections/prestashop-product-stage.js';
const uuid='11111111-1111-4111-8111-111111111111';
const request=(resource,changes)=>({action:'prestashop_product_prepare',id:uuid,call_id:uuid,store:'hortimatic',revision:1,resource,record_id:'5',changes});
test('shared entity fields use native localization and preserve unrelated languages and fields',()=>{
 const brand=validateProductWriteRequest(request('manufacturers',[{field:'name',value:'Marca nueva'}]));assert.equal(brand.changes[0].language_id,undefined);
 assert.throws(()=>validateProductWriteRequest(request('manufacturers',[{field:'name',value:'Marca nueva',language_id:'1'}])));
 assert.throws(()=>validateProductWriteRequest(request('product_options',[{field:'name',value:'Tamaño'}])));
 const source='<prestashop><manufacturer><id>5</id><name>Marca</name><active>1</active><description><language id="1">Uno</language><language id="2">Two</language></description><associations><addresses/></associations></manufacturer></prestashop>';
 const checked=selectedXmlValues(source,'manufacturers','5',brand.changes);assert.match(checked.patched,/<name><!\[CDATA\[Marca nueva\]\]><\/name>/);assert.match(checked.patched,/<language id="2">Two<\/language>/);assert.match(checked.patched,/<addresses\/>/);
 const group=validateProductWriteRequest(request('product_options',[{field:'group_type',value:'color'}]));assert.deepEqual(group.changes.at(-1),{field:'is_color_group',value:'1'});
 assert.throws(()=>validateProductWriteRequest(request('product_option_values',[{field:'id_attribute_group',value:'7'}])),'Moving a value to another group must not silently alter combinations');
});
test('shared counts include supplier relations and deduplicate products across combinations',()=>{
 const inventory={products:[{id:'1',id_manufacturer:'5',id_supplier:'2'},{id:'2',id_manufacturer:'5',id_supplier:'3'}],suppliers:[{id_product:'2',id_supplier:'2'}],values:[{id:'8',id_attribute_group:'6'}],combinations:[{id:'11',id_product:'1',associations:{product_option_values:[{id:'8'}]}},{id:'12',id_product:'1',associations:{product_option_values:[{id:'8'}]}}]};
 assert.equal(associatedMasterProducts('manufacturers','5',inventory).products.length,2);assert.equal(associatedMasterProducts('suppliers','2',inventory).products.length,2);assert.deepEqual(associatedMasterProducts('product_options','6',inventory),{products:[inventory.products[0]],combinations:2});
});
test('new brand/supplier stages require a real product operation and native typed names',()=>{
 for(const kind of ['manufacturer','supplier']){const input={action:'prestashop_product_step_prepare',id:uuid,call_id:uuid,parent_request_id:uuid,step_key:'entity',store:'hortimatic',revision:1,product_id:'42',existing_product:true,kind,fields:{name:'Registro de prueba',active:'1'}};assert.equal(validateProductStage(input).fields.name,'Registro de prueba');assert.throws(()=>validateProductStage({...input,fields:{name:'',active:'1'}}));assert.throws(()=>validateProductStage({...input,fields:{name:'Nombre',active:'sí'}}));}
});
test('shared write keeps server-side identity, same request journal and exact readback',async()=>{
 let native='<prestashop><supplier><id>5</id><name>Anterior</name><active>1</active><description><language id="1">Texto</language><language id="2">Text</language></description></supplier></prestashop>',writes=0,claimed=0,completed=0;
 const input=request('suppliers',[{field:'name',value:'Proveedor nuevo'}]);
 const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,revision:1,verified_revision:1,real_data_authorized:true,endpoint:'https://hortimatic.com/api',secret:'fictional'};
 const options={resolve:async()=>['8.8.8.8'],env:{get:()=> '1'},journal:{lookup:async()=>null,claim:async()=>{claimed++;return {status:'claimed'};},complete:async()=>{completed++;},uncertain:async()=>assert.fail('Unexpected uncertainty')},request:async(url,init)=>{const path=new URL(url).pathname;if(path==='/api/languages')return new Response('<prestashop><languages><language id="1"/><language id="2"/></languages></prestashop>');assert.equal(path,'/api/suppliers/5');assert.equal(new URL(url).searchParams.get('language'),'[1|2]');if(init.method==='PUT'){writes++;native=init.body;}return new Response(native,{headers:{'content-type':'application/xml'}});}};
 const review=await runPrestashopProductWrite(connection,input,options);assert.equal(writes,0);const result=await runPrestashopProductWrite(connection,{...input,action:'prestashop_product_commit',expected_fingerprint:review.fingerprint,request_id:uuid,confirmed:true},options);assert.equal(result.verified,true);assert.equal(writes,1);assert.equal(claimed,1);assert.equal(completed,1);assert.match(native,/<language id="2">Text<\/language>/);
});
test('native brand and supplier creation verifies IDs and replays without another POST',async()=>{
 for(const kind of ['manufacturer','supplier']){
  const resource=kind==='manufacturer'?'manufacturers':'suppliers',input={action:'prestashop_product_step_prepare',id:uuid,call_id:uuid,parent_request_id:uuid,step_key:'new-entity',store:'hortimatic',revision:1,product_id:'42',existing_product:true,kind,fields:{name:'Entidad de prueba',active:'1'}};
  let saved=null,entry=null,posts=0;
  const blank='<prestashop><'+kind+'><id></id><name></name><active>0</active><link_rewrite></link_rewrite><description><language id="1"/></description>'+(kind==='manufacturer'?'<associations><addresses/></associations>':'')+'</'+kind+'></prestashop>';
  const xml=value=>new Response(value,{headers:{'content-type':'application/xml'}});
  const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,revision:1,verified_revision:1,real_data_authorized:true,endpoint:'https://hortimatic.com/api',secret:'fictional'};
  const options={resolve:async()=>['8.8.8.8'],env:{get:()=> '1'},journal:{parent:async()=>({status:'completed',store:'hortimatic',product_id:'42'}),lookup:async()=>entry,claim:async(op,signature)=>{entry={signature,status:'pending'};return {status:'claimed'};},complete:async(op,signature,record_id)=>{entry={signature,record_id,status:'completed'};},uncertain:async()=>assert.fail('Unexpected uncertain entity')},request:async(url,init)=>{const u=new URL(url);if(u.pathname==='/api/')return xml('<prestashop><api><'+resource+' get="true" post="true"/></api></prestashop>');if(u.pathname==='/api/languages')return xml('<prestashop><languages><language id="1"/></languages></prestashop>');if(u.pathname==='/api/products/42')return xml('<prestashop><product><id>42</id><reference>UNCHANGED</reference></product></prestashop>');if(u.pathname==='/api/'+resource+'/901')return xml(saved);assert.equal(u.pathname,'/api/'+resource);if(u.searchParams.get('schema')==='blank')return xml(blank);if(init.method==='POST'){posts++;assert(!init.body.includes('<id_product>'));assert(!init.body.includes('<link_rewrite>'));saved=init.body.replace('<id></id>','<id>901</id>');return xml(saved);}return new Response(JSON.stringify({[resource]:saved?[{id:'901',name:'Entidad de prueba'}]:[]}),{headers:{'content-type':'application/json'}});}};
  const review=await runPrestashopProductStage(connection,input,options),commit={...input,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:review.fingerprint};assert.equal(review.can_commit,true);assert.equal(posts,0);assert.equal((await runPrestashopProductStage(connection,commit,options)).verified,true);assert.equal((await runPrestashopProductStage(connection,commit,options)).reused,true);assert.equal(posts,1);
 }
});
