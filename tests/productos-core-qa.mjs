import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizedProduct,associationIds,matchExactReference,planSelectedFields,buildProductPlan,bulkVariantSelection} from '../src/productos-core.js';
import {readPrestashopProductItem} from '../supabase/functions/totus-connections/prestashop.js';

test('ficha completa identifica asociaciones sin confundir variantes',()=>{
 const p=normalizedProduct({id:'17',name:{language:[{id:'1',value:'Producto ES'}]},reference:'REF-17',associations:{combinations:[{id:'20'},{id:'21'}],categories:[{id:'3'}],images:[{id:'5'}]}});
 assert.equal(p.name,'Producto ES');
 assert.deepEqual(p.combinations,['20','21']);assert.deepEqual(p.categories,['3']);assert.deepEqual(p.images,['5']);
 assert.deepEqual(associationIds({associations:{product_option_values:{product_option_value:[{id:'6'},{id:'7'}]}}},'product_option_values'),['6','7']);
});
test('coincidencia solo por referencia única, no por nombre o ID',()=>{
 assert.equal(matchExactReference([{id:1,reference:' REf-1 '}],'ref-1').status,'matched');
 assert.equal(matchExactReference([{id:1,reference:'A'},{id:2,reference:'a'}],'a').status,'ambiguous');
 assert.equal(matchExactReference([{id:1,name:'Producto'}],'').status,'missing_reference');
});
test('cambia exclusivamente los campos elegidos',()=>{
 const source={name:'Nuevo',reference:'C',price:'19.95',description:'Texto'};
 const target={id:12,name:'Antiguo',reference:'C',price:'12.50',description:'No tocar'};
 const rows=planSelectedFields({source,target,fields:['name','price'],overrides:{price:'18.50'}});
 assert.deepEqual(rows.map(r=>r.field),['name','price']);
 assert.equal(rows[1].after,'18.50');
 assert.equal(target.description,'No tocar');
 assert.throws(()=>planSelectedFields({source,target,fields:['price'],overrides:{description:'Oculto'}}),/no seleccionados/);
 assert.throws(()=>planSelectedFields({source,target,fields:['not_a_field']}),/no permitidos/);
});
test('las variaciones se planifican individualmente y un alta no hereda sus IDs',()=>{
 const plan=buildProductPlan({store:'newoldsmok',source:{id:'6',name:'Origen',reference:'ABC'},target:{id:'80',name:'Destino'},fields:['name'],
 variants:[{source:{id:'35',reference:'ABC-10',price:'2',associations:{product_option_values:[{id:7}]}},target:{id:'101',reference:'ABC-10',price:'3'},fields:['price']},
 {source:{id:'36',reference:'ABC-20',price:'3',associations:{product_option_values:[{id:8}]}},target:null,fields:['price']}]});
 assert.equal(plan.operation,'update');assert.equal(plan.target_id,'80');
 assert.equal(plan.variants[0].target_id,'101');assert.equal(plan.variants[1].target_id,null);
 assert.equal(plan.variants[1].requires_attribute_mapping,true);
 assert.equal(plan.persisted,false);
 const fresh=buildProductPlan({store:'hortimatic',source:{id:null,name:'Borrador',reference:'N'},fields:['name'],
 variants:[{source:{draft_key:'draft-12345678901',reference:'V-1',price:'3'},fields:['reference','price']}]});
 assert.equal(fresh.operation,'create');assert.equal(fresh.source_id,null);
 assert.equal(fresh.variants[0].draft_key,'draft-12345678901');
});
test('bulk valida ID de variación, duplicados y campos permitidos',()=>{
 const variants=[{id:1,reference:'10 mg'},{id:2,reference:'20 mg'}];
 assert.deepEqual(bulkVariantSelection(variants,['2'],['price']).map(x=>x.id),['2']);
 assert.throws(()=>bulkVariantSelection(variants,['2','2'],['price']),/no es válida/);
 assert.throws(()=>bulkVariantSelection(variants,['9'],['price']),/Faltan/);
 assert.throws(()=>bulkVariantSelection(variants,['1'],['description']),/no permitidos/);
});
test('lectura de ficha API solo GET y autenticada para tienda exacta',async()=>{
 const calls=[];
 const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,real_data_authorized:true,verified_revision:4,revision:4,endpoint:'https://hortimatic.com/api',secret:'test-only'};
 const result=await readPrestashopProductItem(connection,{store:'hortimatic',resource:'products',record_id:'19'},{
  resolve:async()=>['8.8.8.8'],
  request:async(url,options)=>{
   calls.push({url,options});
   return new Response(JSON.stringify({product:{id:'19',name:'Producto'}}),{status:200,headers:{'content-type':'application/json'}});
  }
 });
 assert.equal(result.item.name,'Producto');assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'GET');assert.equal(new URL(calls[0].url).pathname,'/api/products/19');
 assert.ok(calls[0].options.headers.Authorization.startsWith('Basic '));
 assert.equal(new URL(calls[0].url).searchParams.get('output_format'),'JSON');
 await assert.rejects(()=>readPrestashopProductItem(connection,{store:'newoldsmok',resource:'products',record_id:'19'},{resolve:async()=>['8.8.8.8'],request:()=>{throw Error('No debe llamarse');}}),/distinta/);
 await assert.rejects(()=>readPrestashopProductItem(connection,{store:'hortimatic',resource:'orders',record_id:'19'},{resolve:async()=>['8.8.8.8'],request:()=>{throw Error('No debe llamarse');}}),/no válida/);
});

import {PRODUCT_SECTIONS as editableSections,VARIANT_FIELDS as editableVariantFields} from '../src/productos-core.js';
import {PRODUCT_WRITE_FIELDS} from '../src/productos-write-contract.js';
test('every generic fiche and bulk-edit field has a write contract; stock and default use their own actions',()=>{
 assert(Object.values(editableSections).flat().every(field=>PRODUCT_WRITE_FIELDS.products.includes(field)));
 assert(editableVariantFields.every(field=>PRODUCT_WRITE_FIELDS.combinations.includes(field)));
 assert(!editableVariantFields.includes('default_on'));assert(!Object.values(editableSections).flat().includes('quantity'));
});

import {productCopyRedirect} from '../src/productos-core.js';
test('copy all keeps ordinary fields reviewable without copying another shop redirect IDs',()=>{
 const fields=['name','price','redirect_type','id_type_redirected'];
 const empty=productCopyRedirect({fields,source:{redirect_type:'301-product',id_type_redirected:'0'},crossStore:true});
 assert.equal(empty.overrides.redirect_type,'404');assert.equal(empty.overrides.id_type_redirected,'0');assert(empty.fields.includes('price'));
 const linked=productCopyRedirect({fields,source:{redirect_type:'301-product',id_type_redirected:'72'},crossStore:true});
 assert.deepEqual(linked.fields,['name','price']);assert.match(linked.notice,/pendiente/);assert.equal(linked.overrides.id_type_redirected,undefined);
 const chosen=productCopyRedirect({fields,source:{redirect_type:'301-product',id_type_redirected:'72'},adapted:{id_type_redirected:'94'},crossStore:true});
 assert.equal(chosen.overrides.id_type_redirected,'94');assert.deepEqual(chosen.fields,fields);
});

import {matchVariantInStore} from '../src/productos-core.js';
test('variant copy matches verified group and value names across shop IDs without guessing',()=>{
 const source={reference:'ORIGIN',__attributes:[{group:'Color',value:'Negro leather'}]};
 const target={id:'94',reference:'OTHER',__attributes:[{group:'COLOR',value:'Negro leather'}]};
 assert.equal(matchVariantInStore(source,[target]).variant.id,'94');
 assert.equal(matchVariantInStore(source,[target,{...target,id:'95'}]).status,'ambiguous');
 assert.equal(matchVariantInStore(source,[{...target,__attributes:[{group:'Material',value:'Negro leather'}]}]).status,'missing');
 assert.equal(matchVariantInStore({...source,__attributes:[{value:'Negro leather'}]},[target]).status,'missing');
 assert.equal(matchVariantInStore(source,[{...target,reference:'ORIGIN'}]).status,'matched');
});

import {mapVariantAttributes} from '../src/productos-core.js';
test('new combination mapping uses destination IDs and requires unique group/value matches',()=>{
 const attrs=[{group:'Color',value:'Negro'}],groups=[{id:'90',name:'Color'}],values=[{id:'900',id_attribute_group:'90',name:'Negro'}];
 assert.deepEqual(mapVariantAttributes(attrs,groups,values),{ids:['900'],complete:true});
 assert.equal(mapVariantAttributes(attrs,groups,[...values,{...values[0],id:'901'}]).complete,false);
 assert.equal(mapVariantAttributes(attrs,[],values).complete,false);
});
