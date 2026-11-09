import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryPaths,productCategoryPicker,attributeGroupSelectors,featureValueSelectors} from '../src/productos-relations-ui.js';
import {validateProductStage} from '../src/productos-stages-contract.js';
import {runPrestashopProductStage} from '../supabase/functions/totus-connections/prestashop-product-stage.js';
const uuid='11111111-1111-4111-8111-111111111111';
const base={action:'prestashop_product_step_prepare',id:uuid,call_id:uuid,parent_request_id:uuid,step_key:'new-catalog-entry',store:'hortimatic',revision:1,product_id:'42',existing_product:true};

test('categories keep parent paths, primary and selection without Ctrl; cycles do not loop',()=>{
 const categories=[{id:'2',name:'Tienda',id_parent:'0'},{id:'4',name:'Accesorios',id_parent:'2'},{id:'5',name:'Metal',id_parent:'4'},{id:'7',name:'Huérfana',id_parent:'8'},{id:'8',name:'Ciclo',id_parent:'7'}];
 assert.equal(categoryPaths(categories).find(row=>row.id==='5').path,'Tienda › Accesorios');
 const org={catalog:{categories,product_features:[],product_feature_values:[]},categories:['5'],fields:{id_category_default:'5'},features:[]};
 const html=productCategoryPicker(org);assert.match(html,/prd-category-primary-5/);assert.match(html,/Tienda › Accesorios/);assert.match(html,/type="radio"/);assert(!html.includes('multiple'));
 const attrs=attributeGroupSelectors([{id:'1',name:'Color'}],[{id:'10',id_attribute_group:'1',name:'Azul'}],['10'],{rowId:'row'});assert.match(attrs,/value="10" selected/);assert(!attrs.includes('multiple'));assert.match(attrs,/Sin usar este atributo/);
 assert.match(featureValueSelectors(org,{canCreate:false}),/data-pr-action="feature-create" disabled/);
});

test('characteristics use typed translated fields and shared native values',()=>{
 assert.equal(validateProductStage({...base,kind:'feature',fields:{name:[{language_id:'1',value:'Material'}],position:'0'}}).resource,'product_features');
 const value={...base,kind:'feature_value',fields:{id_feature:'8',custom:'0',value:[{language_id:'1',value:'Metal'}]}};
 assert.equal(validateProductStage(value).resource,'product_feature_values');
 assert.throws(()=>validateProductStage({...value,fields:{...value.fields,custom:'1'}}));
 assert.throws(()=>validateProductStage({...value,fields:{...value.fields,id_feature:'0'}}));
 assert.throws(()=>validateProductStage({...value,fields:{...value.fields,value:[{language_id:'1',value:'x'.repeat(256)}]}}));
});

test('native feature and value POST, readback and same-request recovery never duplicate',async()=>{
 for(const kind of ['feature','feature_value']){
  const resource=kind==='feature'?'product_features':'product_feature_values',node=kind==='feature'?'product_feature':'product_feature_value',field=kind==='feature'?'name':'value';
  const fields=kind==='feature'?{name:[{language_id:'1',value:'QA material'}],position:'0'}:{id_feature:'8',custom:'0',value:[{language_id:'1',value:'QA metal'}]};
  let saved=null,entry=null,posts=0;
  const input={...base,kind,fields},xml=value=>new Response(value,{headers:{'content-type':'application/xml'}});
  const blank='<prestashop><'+node+'><id></id><'+field+'><language id="1"/></'+field+'></'+node+'></prestashop>';
  const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,revision:1,verified_revision:1,real_data_authorized:true,endpoint:'https://hortimatic.com/api',secret:'fictional'};
  const options={resolve:async()=>['8.8.8.8'],env:{get:()=> '1'},journal:{parent:async()=>({status:'completed',store:'hortimatic',product_id:'42'}),lookup:async()=>entry,claim:async(op,signature)=>{entry={signature,status:'pending'};return {status:'claimed'};},complete:async(op,signature,record_id)=>{entry={signature,record_id,status:'completed'};},uncertain:async()=>assert.fail('Unexpected uncertainty')},request:async(url,init)=>{
   const u=new URL(url);if(u.pathname==='/api/')return xml('<prestashop><api><'+resource+' get="true" post="true"/></api></prestashop>');
   if(u.pathname==='/api/languages')return xml('<prestashop><languages><language id="1"/></languages></prestashop>');
   if(u.pathname==='/api/products/42')return xml('<prestashop><product><id>42</id><reference>UNCHANGED</reference></product></prestashop>');
   if(u.pathname==='/api/product_features/8')return Response.json({product_feature:{id:'8',name:'Material'}});
   if(u.pathname==='/api/'+resource+'/901')return xml(saved);
   assert.equal(u.pathname,'/api/'+resource);
   if(u.searchParams.get('schema')==='blank')return xml(blank);
   if(init.method==='POST'){posts++;assert(!init.body.includes('<id_product>'));saved=init.body.replace('<id></id>','<id>901</id>');return xml(saved);}
   return Response.json({[resource]:saved?[{id:'901',id_feature:'8',[field]:fields[field]}]:[]});
  }};
  const prepared=await runPrestashopProductStage(connection,input,options);assert.equal(posts,0);const commit={...input,action:'prestashop_product_step_commit',confirmed:true,expected_fingerprint:prepared.fingerprint};
  assert.equal((await runPrestashopProductStage(connection,commit,options)).verified,true);assert.equal((await runPrestashopProductStage(connection,commit,options)).reused,true);assert.equal(posts,1);
 }
});
