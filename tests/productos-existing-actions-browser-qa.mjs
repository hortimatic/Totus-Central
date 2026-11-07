import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://hortimatic.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="30" y="10" width="40" height="80" fill="navy"/></svg>'}));
  await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
  await page.evaluate(async()=>{
   const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');
   document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
   const q=window.existingActions={calls:[],variantImages:{},product:{id:'42',name:'Producto de prueba',reference:'REAL-42',price:'10',active:'0',available_for_order:'0',visibility:'none',id_default_image:'90',id_default_combination:'300',id_category_default:'4',id_manufacturer:'3',id_supplier:'0',id_tax_rules_group:'0',description:'Descripción original',description_short:'Resumen original',associations:{categories:[{id:'4'}],images:[{id:'90'},{id:'91'}],combinations:[{id:'300'},{id:'301'}]}}};
   q.ui=createProductosUI({actor:()=> 'existing-actions-'+innerWidth,allowed:()=>true,canEdit:()=>true,
    rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),
    invoke:async body=>{
     q.calls.push(structuredClone(body));const common={ok:true,store:body.store};
     if(body.action==='prestashop_read')return {...common,resource:body.resource,page:body.page,rows:body.resource==='products'?[structuredClone(q.product)]:body.resource==='product_features'?[{id:'8',name:'Material'}]:body.resource==='product_feature_values'?[{id:'80',id_feature:'8',value:'Metal'}]:body.resource==='tags'?[{id:'81',id_lang:'1',name:'Accesorios'}]:body.resource==='product_option_values'?[{id:'3000',name:'Azul'},{id:'3010',name:'Gris'}]:body.resource==='stock_availables'?[{id:'900',id_product:'42',id_product_attribute:'300',id_shop:'1',quantity:'3',out_of_stock:'0',depends_on_stock:'0',location:'Estante A'},{id:'901',id_product:'42',id_product_attribute:'301',id_shop:'1',quantity:'7',out_of_stock:'0',depends_on_stock:'0',location:'Estante B'}]:body.resource==='categories'?[{id:'4',name:'Categoría principal'},{id:'5',name:'Categoría adicional'}]:body.resource==='manufacturers'?[{id:'3',name:'Marca actual'},{id:'6',name:'Marca elegida'}]:[],possibly_more:false};
     if(body.action==='prestashop_item_read')return {...common,resource:body.resource,record_id:body.record_id,item:body.resource==='products'?structuredClone(q.product):{id:body.record_id,id_product:'42',reference:'VAR-'+body.record_id,default_on:body.record_id===q.product.id_default_combination?'1':'0',associations:{product_option_values:[{id:body.record_id+'0'}],images:(q.variantImages[body.record_id]||[]).map(id=>({id}))}}};
     if(body.action==='prestashop_product_create_profile')return {...common,resource:'products',persisted:false,language_ids:['1']};
     if(body.action==='prestashop_product_step_prepare')return {...common,persisted:false,fingerprint:'a'.repeat(64),can_commit:true};
     if(body.action==='prestashop_product_step_commit'){if(['remove_image','remove_variation'].includes(body.kind)){const group=body.kind==='remove_image'?'images':'combinations';q.product.associations[group]=q.product.associations[group].filter(row=>String(row.id)!==String(body.record_id));return {...common,record_id:body.record_id,persisted:true,verified:true,deleted:true};}if(body.kind==='variation_edit'){q.variantImages[body.record_id]=[...body.associations.images];return {...common,record_id:body.record_id,persisted:true,verified:true};}Object.assign(q.product,structuredClone(body.fields));if(body.associations)for(const [key,ids]of Object.entries(body.associations))q.product.associations[key]=ids.map(id=>key==='product_features'?{id:id.feature_id,id_feature_value:id.value_id}:{id});return {...common,record_id:'42',persisted:true,verified:true};}
     throw Error('Unexpected operation '+body.action);
    }});await q.ui.mount(document.querySelector('#productosRoot'));
  });
  await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
  await page.locator('[data-pr-section="imagenes"]').click();
  await page.locator('[data-pr-action="photo-zoom"][data-pr-image="91"]').click();
  assert.match(await page.locator('.prd-photo-dialog img').getAttribute('src'),/91-large_default/);
  await page.getByRole('button',{name:'Cerrar imagen',exact:true}).click();

  await page.locator('[data-pr-action="image-cover"][data-pr-image="91"]').click();
  await page.locator('#tab-borradores').waitFor();
  assert.equal(await page.locator('[data-pr-stage-field="id_default_image"]').inputValue(),'91');
  assert.equal(await page.evaluate(()=>existingActions.calls.some(c=>c.action.endsWith('_commit'))),false);
  await page.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await page.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Revisión y publicación guardado y verificado/).waitFor();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="imagenes"]').click();
  assert.equal(await page.locator('[data-pr-action="image-cover"][data-pr-image="91"]').isDisabled(),true);
  await page.locator('[data-pr-section="variaciones"]').click();
  assert.match(await page.locator('#sub-variaciones').innerText(),/Azul/);assert.match(await page.locator('#sub-variaciones').innerText(),/Gris/);await page.screenshot({path:'qa-artifacts/productos-stitch-variaciones-'+width+'.png',fullPage:true});
  await page.locator('[data-pr-action="variation-default"][data-pr-vid="301"]').click();
  const review=page.locator('.prd-stage-row').last();
  assert.equal(await review.locator('[data-pr-stage-field="id_default_combination"]').inputValue(),'301');
  await review.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await review.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Revisión y publicación guardado y verificado/).waitFor();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="variaciones"]').click();
  assert.equal(await page.locator('[data-pr-action="variation-default"][data-pr-vid="301"]').isChecked(),true);
  await page.locator('[data-pr-section="organizacion"]').click();
  await page.getByRole('button',{name:'Editar categorías, marca, proveedor e impuestos'}).click();
  await page.locator('[data-pr-org="id_manufacturer"]').selectOption('6');
  await page.locator('[data-pr-org-category="5"]').check();await page.locator('[data-pr-org-list="tags"]').selectOption(['81']);await page.locator('[data-pr-org-features]').selectOption(['8:80']);
  await page.getByRole('button',{name:'Revisar cambios de organización'}).click();
  const organization=page.locator('.prd-stage-row').last();
  await organization.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await organization.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Revisión y publicación guardado y verificado/).waitFor();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="variaciones"]').click();
  await page.locator('[data-pr-action="variation-images"][data-pr-vid="301"]').click();
  const photos=page.locator('.prd-stage-row').last();
  await photos.locator('[data-pr-stage-images]').selectOption(['91']);
  await photos.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await photos.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Fotos por combinación guardado y verificado/).waitFor();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="variaciones"]').click();
  assert.match(await page.locator('[data-pr-action="variation-images"][data-pr-vid="301"] img').getAttribute('src'),/91-home_default/);
  await page.locator('[data-pr-action="variation-remove"][data-pr-vid="300"]').click();
  const removal=page.locator('.prd-stage-row').last();
  await removal.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await removal.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Escribe ELIMINAR 300 para confirmar/).waitFor();
  assert.equal(await page.evaluate(()=>existingActions.calls.filter(c=>c.action.endsWith('_commit')).length),4,'No delete without explicit confirmation');
  await removal.locator('[data-pr-stage-remove-confirm]').fill('ELIMINAR 300');
  await removal.locator('[data-pr-stage-remove-confirm]').blur();
  await removal.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Eliminar combinación guardado y verificado/).waitFor();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="variaciones"]').click();
  assert.equal(await page.locator('[data-pr-action="variation-remove"][data-pr-vid="300"]').count(),0);
  await page.locator('[data-pr-section="imagenes"]').click();
  await page.locator('[data-pr-action="image-remove"][data-pr-image="90"]').click();
  const imageRemoval=page.locator('.prd-stage-row').last();
  await imageRemoval.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await imageRemoval.locator('[data-pr-stage-remove-confirm]').fill('ELIMINAR 90');await imageRemoval.locator('[data-pr-stage-remove-confirm]').blur();
  await imageRemoval.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Eliminar imagen guardado y verificado/).waitFor();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="imagenes"]').click();
  assert.equal(await page.locator('[data-pr-action="image-remove"][data-pr-image="90"]').count(),0);
  const writes=await page.evaluate(()=>existingActions.calls.filter(c=>c.action.endsWith('_commit')));
  assert.equal(writes.length,6);assert(writes.slice(0,3).every(c=>c.existing_product===true&&c.kind==='finish'&&c.fields.active==='0'&&c.fields.available_for_order==='0'));
  assert.equal(writes[0].parent_request_id,writes[1].parent_request_id);
  assert.notEqual(writes[0].step_key,writes[1].step_key);assert.deepEqual(writes[2].associations,{categories:['4','5'],tags:['81'],accessories:[],product_features:[{feature_id:'8',value_id:'80'}]});assert.equal(writes[2].fields.id_manufacturer,'6');assert.equal(writes[3].kind,'variation_edit');assert.equal(writes[3].record_id,'301');assert.deepEqual(writes[3].associations,{images:['91']});assert.equal(writes[4].kind,'remove_variation');assert.equal(writes[5].kind,'remove_image');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Existing product cover/default: explicit review, simulated commit, readback and preserved publication at 390/1440: PASS');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
