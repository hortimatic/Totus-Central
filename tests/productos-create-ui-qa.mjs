import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWizard} from '../src/productos-create-ui.js';

const shop='hortimatic',source={name:'Pruebas',reference:'PRUEBAS-DEMO',price:'0.00'};
const plan={store:shop,operation:'create',target_id:null,changes:[{field:'name',after:'Pruebas'},
 {field:'reference',after:'PRUEBAS-DEMO'},{field:'price',after:'0.00'}],variants:[]};
const field=(store,key,value)=>({dataset:{prCreateStore:store,prCreateField:key},value});
const lang=(store,id,property,value)=>({dataset:{prCreateStore:store,prCreateLanguage:id,prCreateProperty:property},value});
const confirmation=(store,value)=>({dataset:{prCreateConfirm:store},value});
const fixture=(opts={})=>{
 const calls=[];
 const wizard=createProductWizard({canEdit:()=>opts.canEdit??true,
 invoke:async(s,a,args)=>{
  calls.push({shop:s,action:a,args});
  if(a==='prestashop_product_create_profile')return {ok:true,resource:'products',store:s,language_ids:['1','2'],persisted:false};
  if(a==='prestashop_read')return {ok:true,store:s,resource:args.resource,rows:args.resource==='categories'?[{id:'33',name:'Inicio'}]:opts.catalogs?.[args.resource]||[],possibly_more:false};
  if(a==='prestashop_product_create_prepare')return {ok:true,store:s,resource:'products',reference:args.reference,fingerprint:'a'.repeat(64),persisted:false,can_commit:opts.canCommit!==false};
  if(a==='prestashop_product_create_commit'){
   if(opts.networkError)throw Error('Respuesta incierta');
   return {ok:true,store:s,resource:'products',record_id:'701',persisted:true,verified:true,active:false};
  }
  throw Error('Acción inesperada '+a);
 }});
 return {wizard,calls};
};
const complete=async(f,p=plan)=>{
 await f.wizard.perform('create-load',shop,p,source);
 f.wizard.render(p,source); // The real browser renders the form immediately after loading its profile.
 assert(f.wizard.handleChange(field(shop,'category_id','33')));
 assert(f.wizard.handleChange(lang(shop,'1','name','Pruebas')));
 assert(f.wizard.handleChange(lang(shop,'1','link_rewrite','pruebas')));
 assert(f.wizard.handleChange(lang(shop,'2','name','Tests')));
 assert(f.wizard.handleChange(lang(shop,'2','link_rewrite','tests')));
 return f.wizard.perform('create-prepare',shop,p,source);
};

test('marca, proveedor, impuestos y materiales se seleccionan en los catálogos del destino',async()=>{
 const f=fixture({catalogs:{manufacturers:[{id:'2',name:'Marca local'}],suppliers:[{id:'3',name:'Proveedor local'}],tax_rule_groups:[{id:'1',name:'IVA 21%'}],product_features:[{id:'4',name:'Material'}],product_feature_values:[{id:'5',id_feature:'4',value:'Aluminio'}]}});
 await f.wizard.perform('create-load',shop,plan,source);f.wizard.render(plan,source);
 f.wizard.handleChange(field(shop,'category_id','33'));
 await f.wizard.perform('create-load-relations',shop,plan,source);
 const html=f.wizard.render(plan,source);assert.match(html,/Marca local/);assert.match(html,/Material/);assert.match(html,/Aluminio/);
 f.wizard.handleChange({dataset:{prCreateStore:shop,prCreateRelation:'manufacturer_id'},value:'2'});
 f.wizard.handleChange({dataset:{prCreateStore:shop,prCreateFeatures:'true'},selectedOptions:[{value:'4:5'}]});
 await f.wizard.perform('create-prepare',shop,plan,source);
 assert.deepEqual(f.calls.at(-1).args.relations,{category_ids:['33'],manufacturer_id:'2',features:[{feature_id:'4',value_id:'5'}]});
});
test('prepara una alta de producto inactivo sin usar un ID de otro PrestaShop',async()=>{
 const f=fixture();
 assert.match(f.wizard.render(plan,source),/Consultar idiomas de la tienda/);
 await complete(f);
 const calls=f.calls.map(c=>c.action);
 assert.deepEqual(calls,['prestashop_product_create_profile','prestashop_read','prestashop_product_create_prepare']);
 const args=f.calls.at(-1).args;
 assert.equal(args.category_id,'33');assert.equal(args.price,'0.00');assert.equal(args.reference,'PRUEBAS-DEMO');
 assert.deepEqual(args.translations.map(t=>t.language_id),['1','2']);
 assert.match(f.wizard.render(plan,source),/Esquema, idiomas, categoría y duplicados validados/);
});
test('confirma CREAR, respeta el permiso y solo envía un POST lógico con request_id estable',async()=>{
 const f=fixture();await complete(f);
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/Escribe CREAR/);
 f.wizard.handleChange(confirmation(shop,'CREAR'));
 const msg=await f.wizard.perform('create-commit',shop,plan,source);
 assert.match(msg,/ID 701/);
 const calls=f.calls.filter(x=>x.action==='prestashop_product_create_commit');
 assert.equal(calls.length,1);
 assert.equal(calls[0].args.confirmed,true);assert.match(calls[0].args.request_id,/^[a-f0-9-]{36}$/);
 assert.match(f.wizard.render(plan,source),/permanece inactiva/i);
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/no se repetirá/);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_create_commit').length,1);
});
test('error de red deja el alta bloqueada: nunca se genera otro request_id automáticamente',async()=>{
 const f=fixture({networkError:true});await complete(f);
 f.wizard.handleChange(confirmation(shop,'CREAR'));
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/Respuesta incierta/);
 assert(f.wizard.hasAttempted(shop));
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/no se repetirá/);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_create_commit').length,1);
});
test('la base inactiva conserva las variaciones planificadas como etapas pendientes, sin publicarlas',async()=>{
 const f=fixture(),withVariants={...plan,variants:[{changes:[{field:'reference',after:'PRUEBAS-AZUL',changed:true}]}]};
 await complete(f,withVariants);
 f.wizard.handleChange(confirmation(shop,'CREAR'));
 await f.wizard.perform('create-commit',shop,withVariants,source);
 const html=f.wizard.render(withVariants,source);assert.match(html,/PRUEBAS-AZUL/);assert.match(html,/pendiente/);assert.match(html,/permanece inactiva/);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_create_commit').length,1);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_step_commit').length,0);
});
test('el usuario sin permiso de edición solo puede preparar, nunca crear',async()=>{
 const f=fixture({canEdit:false});await complete(f);
 f.wizard.handleChange(confirmation(shop,'CREAR'));
 assert.match(f.wizard.render(plan,source),/Crear en PrestaShop/);
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/no tiene permiso/);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_create_commit').length,0);
});


test('alta deshabilitada en servidor: muestra bloqueo y no envía POST ni consume request_id',async()=>{
 const f=fixture({canCommit:false});await complete(f);
 const html=f.wizard.render(plan,source);
 assert.match(html,/POST aún no está habilitada/);
 assert.doesNotMatch(html,/data-pr-action="create-commit"/);
 f.wizard.handleChange(confirmation(shop,'CREAR'));
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/sigue deshabilitada/);
 assert.equal(f.wizard.hasAttempted(shop),false);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_create_commit').length,0);
});
test('los campos preparados no desaparecen del alta y los no implementados se explican',async()=>{
 const extra={...plan,changes:[...plan.changes,{field:'description',after:'Descripción',changed:true},{field:'wholesale_price',after:'3.90',changed:true}]};
 const f=fixture();await complete(f,extra);
 const values=f.calls.at(-1).args;
 assert.equal(values.translations[0].description,'Descripción');assert.equal(values.translations[1].description,'Descripción');
 assert.deepEqual(values.fields,[{field:'wholesale_price',value:'3.90'}]);
 const units=fixture();await complete(units,{...plan,changes:[...plan.changes,{field:'unit_price',after:'10',changed:true}]});assert.deepEqual(units.calls.at(-1).args.fields,[{field:'unit_price',value:'10'}]);
 const bad=fixture();await assert.rejects(()=>complete(bad,{...plan,changes:[...plan.changes,{field:'redirect_type',after:'301-product',changed:true}]}),/sin contrato/);
});
test('comprobar resultado reutiliza el identificador de una solicitud incierta',async()=>{
 const options={networkError:true},f=fixture(options);await complete(f);f.wizard.handleChange(confirmation(shop,'CREAR'));
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/incierta/);
 const original=f.calls.at(-1).args.request_id;assert.match(f.wizard.render(plan,source),new RegExp(original));
 options.networkError=false;await f.wizard.perform('create-verify',shop,plan,source);
 assert.equal(f.calls.at(-1).args.request_id,original);assert.match(f.wizard.render(plan,source),/Base del producto guardada/);
});
