import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWizard} from '../src/productos-create-ui.js';
import {mapCopyRelations} from '../src/productos-copy-map.js';
import {readPrestashopPage} from '../supabase/functions/totus-connections/prestashop.js';

test('copy metadata matches category paths, distinct IDs and feature ownership; ambiguous names remain visible',()=>{
 const product={id_category_default:'2',id_manufacturer:'3',associations:{categories:[{id:'2'}],product_features:[{id:'4',id_feature_value:'5'}]}};
 const origin={categories:[{id:'1',name:'Inicio',id_parent:'0'},{id:'2',name:'Accesorios',id_parent:'1'}],manufacturers:[{id:'3',name:'Marca'}],product_features:[{id:'4',name:'Material'}],product_feature_values:[{id:'5',id_feature:'4',value:'Metal'}]};
 const destination={categories:[{id:'10',name:'Inicio',id_parent:'0'},{id:'20',name:'Accesorios',id_parent:'10'},{id:'21',name:'Accesorios',id_parent:'0'}],manufacturers:[{id:'30',name:'Marca'},{id:'31',name:'Marca'}],product_features:[{id:'40',name:'Material'}],product_feature_values:[{id:'50',id_feature:'40',value:'Metal'},{id:'51',id_feature:'41',value:'Metal'}]};
 const result=mapCopyRelations(product,origin,destination);assert.equal(result.categoryId,'20');assert.deepEqual(result.relations.features,[{feature_id:'40',value_id:'50'}]);assert.equal(result.relations.manufacturer_id,undefined);assert.match(result.unresolved.join(),/ambigua/);
});

test('copy configuration maps languages by ISO and suppliers/currencies by name instead of IDs',async()=>{
 const source={id:'42',__sourceStore:'hortimatic',reference:'COPY',price:'10',id_category_default:'2',id_supplier:'3',name:[{id:'9',value:'Hortimatic ES'},{id:'10',value:'Hortimatic EN'}],meta_title:[{id:'9',value:'Hortimatic título'},{id:'10',value:'Hortimatic title'}],associations:{categories:[{id:'2'}]}};
 const plan={operation:'create',store:'newoldsmok',changes:['name','meta_title'].map(field=>({field,after:'NewOldSmok',changed:true})),variants:[]};
 const calls=[];const wizard=createProductWizard({invoke:async(shop,action,args)=>{
  calls.push({shop,action,args});if(action==='prestashop_product_create_profile')return {persisted:false,resource:'products',language_ids:['1','2']};
  assert.equal(action,'prestashop_read');const sourceShop=shop==='hortimatic';
  const catalogs={categories:[{id:sourceShop?'2':'20',name:'Inicio',id_parent:'0'}],suppliers:[{id:sourceShop?'3':'30',name:'Proveedor'}],currencies:[{id:sourceShop?'7':'70',iso_code:'EUR',name:'Euro'}],languages:sourceShop?[{id:'9',iso_code:'es'},{id:'10',iso_code:'en'}]:[{id:'1',iso_code:'en'},{id:'2',iso_code:'es'}],product_suppliers:[{id:'80',id_product:'42',id_product_attribute:'0',id_supplier:'3',id_currency:'7',product_supplier_price_te:'4.35',product_supplier_reference:'SUP-42'}],specific_prices:[{id:'90',id_product:'42',id_product_attribute:'0',id_currency:'7',price:'-1',from_quantity:'1',reduction:'0.1',reduction_tax:'1',reduction_type:'percentage',from:'0000-00-00 00:00:00',to:'0000-00-00 00:00:00'},{id:'91',id_product:'42',id_customer:'99'}]};
  return {resource:args.resource,rows:catalogs[args.resource]||[],possibly_more:false};
 }});
 wizard.handleChange({dataset:{prCopyOption:'prices',prCreateStore:'newoldsmok'},checked:true});
 await wizard.perform('create-copy-config','newoldsmok',plan,source);
 const saved=wizard.snapshot(),config=saved.maps[3][0][1],options=saved.copyPreferences[0][1];
 assert.equal(config.category_id,'20');assert.equal(config.relations.supplier_id,'30');assert.equal(config.translations['1'].name,'NewOldSmok EN');assert.equal(config.translations['2'].name,'NewOldSmok ES');
 assert.equal(options.priceRows.length,2);assert.equal(options.priceRows[0].fields.id_supplier,'30');assert.equal(options.priceRows[0].fields.id_currency,'70');assert.equal(options.priceRows[1].fields.id_currency,'70');assert.match(saved.copyWarnings[0][1].join(),/condiciones específicas/);
 assert(calls.filter(call=>['specific_prices','product_suppliers'].includes(call.args?.resource)).every(call=>call.shop==='hortimatic'&&call.args.product_ids[0]==='42'));
 wizard.restore(saved);assert.deepEqual(wizard.snapshot().copyPreferences,saved.copyPreferences);
});

test('price child reads remain GET-only and reject records from another product',async()=>{
 const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',endpoint:'https://example.com/api',secret:'test-only',auth_kind:'basic',enabled:true,revision:1,verified_revision:1,real_data_authorized:true};
 for(const resource of ['product_suppliers','specific_prices']){
  let target;const query={store:'hortimatic',resource,product_ids:['42'],page:0,page_size:20};
  await readPrestashopPage(connection,query,{resolve:async()=>['8.8.8.8'],request:async(url,init)=>{target=new URL(url);assert.equal(init.method,'GET');return Response.json({[resource]:[{id:'1',id_product:'42'}]});}});
  assert.equal(target.searchParams.get('filter[id_product]'),'[42]');
  await assert.rejects(()=>readPrestashopPage(connection,query,{resolve:async()=>['8.8.8.8'],request:async()=>Response.json({[resource]:[{id:'1',id_product:'43'}]})}),/ajeno/);
 }
});
