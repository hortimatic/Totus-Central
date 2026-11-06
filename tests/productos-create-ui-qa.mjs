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
  if(a==='prestashop_read')return {ok:true,store:s,resource:'categories',rows:[{id:'33',name:'Inicio'}],possibly_more:false};
  if(a==='prestashop_product_create_prepare')return {ok:true,store:s,resource:'products',reference:args.reference,fingerprint:'a'.repeat(64),persisted:false};
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
 assert.match(f.wizard.render(plan,source),/producto permanece inactivo/i);
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
test('nunca crea un producto con variantes seleccionadas que el servidor no ha mapeado',async()=>{
 const f=fixture(),withVariants={...plan,variants:[{changes:[{field:'reference',changed:true}]}]};
 await complete(f,withVariants);
 f.wizard.handleChange(confirmation(shop,'CREAR'));
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,withVariants,source),/variaciones aún sin correspondencia/);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_create_commit').length,0);
});
test('el usuario sin permiso de edición solo puede preparar, nunca crear',async()=>{
 const f=fixture({canEdit:false});await complete(f);
 f.wizard.handleChange(confirmation(shop,'CREAR'));
 assert.match(f.wizard.render(plan,source),/Crear en PrestaShop/);
 await assert.rejects(()=>f.wizard.perform('create-commit',shop,plan,source),/sin permiso/);
 assert.equal(f.calls.filter(x=>x.action==='prestashop_product_create_commit').length,0);
});
