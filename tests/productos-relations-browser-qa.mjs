import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
const report=[];await mkdir('qa-artifacts',{recursive:true});
try{
 for(const [width,height] of [[390,700],[969,680],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://hortimatic.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="30" y="10" width="40" height="80" fill="navy"/></svg>'}));
  await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
  await page.evaluate(async()=>{
   const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');
   document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
   const q=window.existingActions={calls:[],attributeGroups:[{id:'9',name:'Color',public_name:'Color'}],attributeValues:[],features:[{id:'8',name:'Material'}],featureValues:[{id:'80',id_feature:'8',value:'Metal'}],variantAttributes:{},imageMetadata:{'91':{position:'1',legend:[{id:'1',value:'Texto anterior'}]}},variantImages:{'301':['91']},product:{id:'42',name:'Producto de prueba',reference:'REAL-42',price:'10',wholesale_price:'4',active:'0',available_for_order:'0',visibility:'none',id_default_image:'90',id_default_combination:'300',id_category_default:'4',id_manufacturer:'3',id_supplier:'0',id_tax_rules_group:'0',description:'Descripción original',description_short:'<p>Resumen original</p>',associations:{categories:[{id:'4'}],images:[{id:'90'},{id:'91'}],combinations:[{id:'300'},{id:'301'}]}}};
   q.ui=createProductosUI({actor:()=> 'existing-actions-'+innerWidth,allowed:()=>true,canEdit:()=>true,
    rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),
    invoke:async body=>{
     q.calls.push(structuredClone(body));const common={ok:true,store:body.store};
     if(body.action==='prestashop_read')return {...common,resource:body.resource,page:body.page,rows:body.resource==='products'?[structuredClone(q.product)]:body.resource==='image_types'?[{id:'1',name:'large_default',products:'1',width:'800',height:'800'}]:body.resource==='tax_rule_groups'?[{id:'7',name:'Grupo IVA',active:'1'}]:body.resource==='countries'?[{id:'1',iso_code:'ES',active:'1'}]:body.resource==='tax_rules'?[{id:'1',id_tax_rules_group:'7',id_country:'1',id_state:'0',zipcode_from:'0',zipcode_to:'0',id_tax:'1'}]:body.resource==='taxes'?[{id:'1',rate:'21',active:'1'}]:body.resource==='product_options'?q.attributeGroups:body.resource==='product_features'?q.features:body.resource==='product_feature_values'?q.featureValues:body.resource==='tags'?[{id:'81',id_lang:'1',name:'Accesorios'}]:body.resource==='product_option_values'?[{id:'3000',id_attribute_group:'9',name:'Azul'},{id:'3010',id_attribute_group:'9',name:'Gris'},...q.attributeValues]:body.resource==='stock_availables'?[{id:'900',id_product:'42',id_product_attribute:'300',id_shop:'1',quantity:'3',out_of_stock:'0',depends_on_stock:'0',location:'Estante A'},{id:'901',id_product:'42',id_product_attribute:'301',id_shop:'1',quantity:'7',out_of_stock:'0',depends_on_stock:'0',location:'Estante B'}]:body.resource==='categories'?[{id:'4',name:'Categoría principal'},...Array.from({length:61},(_,i)=>({id:String(i+5),id_parent:'4',name:'Categoría '+String(i+5).padStart(2,'0')}))]:body.resource==='manufacturers'?[{id:'3',name:'Marca actual'},{id:'6',name:'Marca elegida'}]:[],possibly_more:false};
     if(body.action==='prestashop_item_read')return {...common,resource:body.resource,record_id:body.record_id,item:body.resource==='products'?structuredClone(q.product):body.resource==='totus_product_images'?{id:body.record_id,id_product:'42',...q.imageMetadata[body.record_id]}:{id:body.record_id,id_product:'42',reference:'VAR-'+body.record_id,default_on:body.record_id===q.product.id_default_combination?'1':'0',associations:{product_option_values:(q.variantAttributes[body.record_id]||[body.record_id+'0']).map(id=>({id})),images:(q.variantImages[body.record_id]||[]).map(id=>({id}))}}};
     if(body.action==='prestashop_product_create_profile')return {...common,resource:'products',persisted:false,language_ids:['1']};
     if(body.action==='prestashop_product_step_prepare')return {...common,persisted:false,fingerprint:'a'.repeat(64),can_commit:true};
     if(body.action==='prestashop_product_step_commit'){if(['feature','feature_value','attribute_group','attribute_value'].includes(body.kind)){const record_id=body.kind==='attribute_group'?'95':'96',row={id:record_id,...structuredClone(body.fields)};if(body.kind==='attribute_group')q.attributeGroups.push(row);else if(body.kind==='feature')q.features.push(row);else if(body.kind==='feature_value')q.featureValues.push(row);else q.attributeValues.push(row);return {...common,record_id,persisted:true,verified:true};}if(body.kind==='image_replace')return {...common,record_id:body.record_id,persisted:true,verified:true,replaced:true};if(body.kind==='image_metadata'){q.imageMetadata[body.record_id]={...q.imageMetadata[body.record_id],...structuredClone(body.fields)};return {...common,record_id:body.record_id,persisted:true,verified:true};}if(['remove_image','remove_variation'].includes(body.kind)){const group=body.kind==='remove_image'?'images':'combinations';q.product.associations[group]=q.product.associations[group].filter(row=>String(row.id)!==String(body.record_id));return {...common,record_id:body.record_id,persisted:true,verified:true,deleted:true};}if(body.kind==='variation_edit'){q.variantImages[body.record_id]=[...body.associations.images];if(body.associations.product_option_values)q.variantAttributes[body.record_id]=[...body.associations.product_option_values];return {...common,record_id:body.record_id,persisted:true,verified:true};}Object.assign(q.product,structuredClone(body.fields));if(body.associations)for(const [key,ids]of Object.entries(body.associations))q.product.associations[key]=ids.map(id=>key==='product_features'?{id:id.feature_id,id_feature_value:id.value_id}:{id});return {...common,record_id:'42',persisted:true,verified:true};}
     throw Error('Unexpected operation '+body.action);
    }});await q.ui.mount(document.querySelector('#productosRoot'));
  });

  await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
  await page.locator('[data-pr-section="organizacion"]').click();
  await page.getByRole('button',{name:'Editar categorías, marca, proveedor e impuestos'}).click();
  assert.equal(await page.locator('[data-pr-category-row]').count(),20);
  await page.locator('[data-pr-category-search]').fill('Categoría 65');
  assert.equal(await page.locator('[data-pr-category-row]').count(),1,'Search sees categories outside the first page');
  await page.locator('[data-pr-org-category="65"]').check();
  await page.locator('[data-pr-org="id_category_default"][value="65"]').check();
  await page.getByRole('button',{name:'Crear característica',exact:true}).click();
  assert.equal(await page.locator('.prd-stage-row').count(),1,'One click creates exactly one operation');
  let step=page.locator('.prd-stage-row').last();
  await step.locator('[data-pr-stage-field="name"]').fill('Capacidad QA');
  await step.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await step.getByRole('button',{name:'Guardar y sincronizar',exact:true}).click();
  await page.waitForFunction(()=>existingActions.calls.some(c=>c.action.endsWith('_commit')&&c.kind==='feature'));
  await page.getByRole('button',{name:'Crear valor',exact:true}).click();
  step=page.locator('.prd-stage-row').last();
  await step.locator('[data-pr-stage-field="id_feature"]').selectOption('96');
  await step.locator('[data-pr-stage-field="value"]').fill('2 ml');
  await step.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await step.getByRole('button',{name:'Guardar y sincronizar',exact:true}).click();
  await page.locator('[data-pr-feature="96"] option[value="96"]').waitFor({state:'attached'});
  await page.locator('[data-pr-feature="96"]').selectOption('96');
  assert.equal(await page.locator('[data-pr-org-category="65"]').isChecked(),true,'Creating a feature preserves pending categories');
  await page.screenshot({path:'qa-artifacts/productos-organizacion-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Revisar y sincronizar organización',exact:true}).click();
  step=page.locator('.prd-stage-row').last();
  await step.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await step.getByRole('button',{name:'Guardar y sincronizar',exact:true}).click();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="variaciones"]').click();
  await page.locator('[data-pr-action="variation-attributes"][data-pr-vid="301"]').click();
  step=page.locator('.prd-stage-row').last();
  await step.locator('[data-pr-stage-attribute-group="9"]').selectOption('3000');
  await page.screenshot({path:'qa-artifacts/productos-atributos-'+width+'.png',fullPage:true});
  await step.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await step.getByRole('button',{name:'Guardar y sincronizar',exact:true}).click();
  await page.waitForFunction(()=>existingActions.calls.some(c=>c.action.endsWith('_commit')&&c.kind==='variation_edit'));
  const commits=await page.evaluate(()=>existingActions.calls.filter(c=>c.action.endsWith('_commit')));
  assert.equal(commits.length,4);assert.deepEqual(commits[2].associations.product_features,[{feature_id:'96',value_id:'96'}]);
  assert.deepEqual(commits[3].associations,{images:['91'],product_option_values:['3000']});
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'qa-artifacts/productos-relations-'+width+'.png',fullPage:true});
  report.push({width,height,result:'passed',operations:commits.map(c=>c.kind)});await page.close();
 }
 console.log(JSON.stringify(report));await writeFile('qa-artifacts/productos-relations.json',JSON.stringify(report,null,2));
}finally{await browser.close();await server?.close();}
