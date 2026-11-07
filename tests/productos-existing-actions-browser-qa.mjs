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
   const q=window.existingActions={calls:[],product:{id:'42',name:'Producto de prueba',reference:'REAL-42',price:'10',active:'0',available_for_order:'0',visibility:'none',id_default_image:'90',id_default_combination:'300',description:'Descripción original',description_short:'Resumen original',associations:{images:[{id:'90'},{id:'91'}],combinations:[{id:'300'},{id:'301'}]}}};
   q.ui=createProductosUI({actor:()=> 'existing-actions-'+innerWidth,allowed:()=>true,canEdit:()=>true,
    rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),
    invoke:async body=>{
     q.calls.push(structuredClone(body));const common={ok:true,store:body.store};
     if(body.action==='prestashop_read')return {...common,resource:body.resource,page:body.page,rows:body.resource==='products'?[structuredClone(q.product)]:[],possibly_more:false};
     if(body.action==='prestashop_item_read')return {...common,resource:body.resource,record_id:body.record_id,item:body.resource==='products'?structuredClone(q.product):{id:body.record_id,id_product:'42',reference:'VAR-'+body.record_id,default_on:body.record_id===q.product.id_default_combination?'1':'0'}};
     if(body.action==='prestashop_product_create_profile')return {...common,resource:'products',persisted:false,language_ids:['1']};
     if(body.action==='prestashop_product_step_prepare')return {...common,persisted:false,fingerprint:'a'.repeat(64),can_commit:true};
     if(body.action==='prestashop_product_step_commit'){Object.assign(q.product,structuredClone(body.fields));return {...common,record_id:'42',persisted:true,verified:true};}
     throw Error('Unexpected operation '+body.action);
    }});await q.ui.mount(document.querySelector('#productosRoot'));
  });
  await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
  await page.locator('[data-pr-section="imagenes"]').click();
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
  await page.locator('[data-pr-action="variation-default"][data-pr-vid="301"]').click();
  const review=page.locator('.prd-stage-row').last();
  assert.equal(await review.locator('[data-pr-stage-field="id_default_combination"]').inputValue(),'301');
  await review.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await review.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Revisión y publicación guardado y verificado/).waitFor();
  await page.getByRole('tab',{name:/2. Ficha y Edición/}).click();
  await page.locator('[data-pr-section="variaciones"]').click();
  assert.equal(await page.locator('[data-pr-action="variation-default"][data-pr-vid="301"]').isChecked(),true);
  const writes=await page.evaluate(()=>existingActions.calls.filter(c=>c.action.endsWith('_commit')));
  assert.equal(writes.length,2);assert(writes.every(c=>c.existing_product===true&&c.kind==='finish'&&c.fields.active==='0'&&c.fields.available_for_order==='0'));
  assert.equal(writes[0].parent_request_id,writes[1].parent_request_id);
  assert.notEqual(writes[0].step_key,writes[1].step_key);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Existing product cover/default: explicit review, simulated commit, readback and preserved publication at 390/1440: PASS');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
