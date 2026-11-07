import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const localServer=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
  await page.evaluate(async()=>{
   const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');
   const root=document.querySelector('#chatHarness');
   root.innerHTML=productosWorkspacePage();
   const q=window.productosQA={actor:'admin-1',calls:[],slow:false,connections:['hortimatic','newoldsmok'].map((store,i)=>({id:String(i+1).padStart(8,'0')+'-1111-4111-8111-111111111111',name:'PrestaShop · '+(store==='hortimatic'?'Hortimatic':'NewOldSmok'),protocol:'prestashop',configured:true,enabled:true,revision:1,verified_revision:1,real_data_authorized:true}))};
   const fixture={
    'hortimatic|products|42':{id:'42',reference:'REF-42',name:'Producto <script>alert(1)</script>',description:'Origen',price:'12.90',meta_title:'SEO de origen',associations:{combinations:[{id:'100'},{id:'101'}],categories:[{id:'3'}]}},
    'newoldsmok|products|55':{id:'55',reference:'DESTINO-55',name:[{id:'1',value:'Destino antiguo'}],description:'Destino',price:'14.90',meta_title:'SEO propio',associations:{combinations:[{id:'200'}]}},
    'hortimatic|combinations|100':{id:'100',id_product:'42',reference:'REF-42-10',price:'1',minimal_quantity:'1',associations:{product_option_values:[{id:'10'}]}},
    'hortimatic|combinations|101':{id:'101',id_product:'42',reference:'REF-42-20',price:'2',minimal_quantity:'1',associations:{product_option_values:[{id:'20'}]}},
    'newoldsmok|combinations|200':{id:'200',id_product:'55',reference:'REF-42-10',price:'1.50',minimal_quantity:'1',associations:{product_option_values:[{id:'10'}]}}
   };
   q.ui=createProductosUI({rpc:async()=>({connections:q.connections}),actor:()=>q.actor,allowed:()=>true,canEdit:()=>true,invoke:async body=>{
    q.calls.push(structuredClone(body));
    if(q.slow)await new Promise(r=>setTimeout(r,200));
    if(body.action==='prestashop_product_create_profile')return {ok:true,store:body.store,resource:'products',language_ids:['1'],persisted:false};
    if(body.action==='prestashop_product_create_prepare')return {ok:true,store:body.store,resource:'products',reference:body.reference,fingerprint:'b'.repeat(64),persisted:false,can_commit:true};
    if(body.action==='prestashop_product_create_commit'&&q.allowWrites)return {ok:true,store:body.store,resource:'products',record_id:'701',persisted:true,verified:true,active:false};
    if(body.action==='prestashop_product_step_prepare'&&q.allowWrites)return {ok:true,store:body.store,fingerprint:'c'.repeat(64),persisted:false,can_commit:true};
    if(body.action==='prestashop_product_step_commit'&&q.allowWrites)return {ok:true,store:body.store,record_id:body.kind==='variation'?'801':body.kind==='image'?'901':body.kind==='finish'?'701':'1001',persisted:true,verified:true};
    if(body.action==='prestashop_product_prepare')return {ok:true,store:body.store,resource:body.resource,record_id:body.record_id,persisted:false,can_commit:q.allowWrites===true,fingerprint:'a'.repeat(64),changes:body.changes.map(c=>({...c,before:'original',changed:true}))};
    if(body.action==='prestashop_product_commit'&&q.allowWrites){
     const item=fixture[body.store+'|'+body.resource+'|'+body.record_id];
     for(const change of body.changes){if(change.language_id)item[change.field]=[{id:change.language_id,value:change.value}];else item[change.field]=change.value;}
     return {ok:true,store:body.store,resource:body.resource,record_id:body.record_id,persisted:true,verified:true};
    }
    if(body.action==='prestashop_item_read'){
     const item=fixture[body.store+'|'+body.resource+'|'+body.record_id];
     if(!item)throw Error('Ficha desconocida');
     return {ok:true,store:body.store,resource:body.resource,record_id:body.record_id,item};
    }
    if(body.action==='prestashop_read'){
     if(body.resource==='categories')return {ok:true,store:body.store,resource:'categories',page:body.page,rows:[{id:'33',name:'Inicio'}],possibly_more:false};
     const catalogs={product_options:[{id:'5',name:'Color',public_name:'Color'}],product_option_values:[{id:'10',id_attribute_group:'5',name:'Azul'}],suppliers:[{id:'2',name:'Proveedor de pruebas'}],currencies:[{id:'1',name:'Euro',iso_code:'EUR'}]};
     if(catalogs[body.resource])return {ok:true,store:body.store,resource:body.resource,rows:catalogs[body.resource],possibly_more:false};
     const rows=body.references?.length?body.store==='newoldsmok'?[]:[{id:'42',reference:'REF-42',name:'Origen'}]:body.store==='hortimatic'?[{id:'42',reference:'REF-42',name:'Producto <script>alert(1)</script>'}]:[];
     return {ok:true,store:body.store,resource:body.resource,page:body.page,rows,possibly_more:false};
    }
    throw Error('Se ha intentado escribir en PrestaShop');
   }});
   await q.ui.mount(document.querySelector('#productosRoot'));
  });
  await page.getByRole('button',{name:'Consultar catálogo'}).click();
  await page.getByRole('button',{name:'Abrir ficha'}).click();
  await page.getByText(/2 combinaciones leídas/).waitFor();
  assert.equal(await page.locator('#productosRoot script').count(),0);
  await page.locator('[data-pr-field="name"]').check();
  await page.locator('[data-pr-value="name"]').fill('Nombre personalizado');
  await page.locator('[data-pr-value="name"]').blur();
  await page.getByRole('button',{name:'Variaciones'}).click();
  await page.locator('.prd-variant').first().locator('summary').click();
  await page.locator('[data-pr-vid="100"][data-pr-vfield="price"]').check();
  await page.locator('[data-pr-vid="100"][data-pr-vvalue="price"]').fill('3.50');
  await page.locator('[data-pr-vid="100"][data-pr-vvalue="price"]').blur();
  await page.getByRole('button',{name:'Fichas paralelas'}).click();
  await page.locator('[data-pr-existing-id="newoldsmok"]').fill('55');
  await page.locator('[data-pr-existing-id="newoldsmok"]').blur();
  await page.getByRole('button',{name:'Buscar coincidencias y preparar cambios'}).click();
  await page.getByText(/Propuesta preparada para 1 tienda/).waitFor();
  assert.equal(await page.locator('.prd-plan').count(),1);
  assert.match(await page.locator('.prd-plan').innerText(),/Actualizar #55/);
  assert.match(await page.locator('.prd-plan').innerText(),/Nombre personalizado/);
  await page.getByRole('button',{name:'Validar variación'}).first().click();
  await page.getByText(/Variación #200 de newoldsmok comprobada/).waitFor();
  assert.equal(await page.evaluate(()=>productosQA.calls.find(c=>c.action==='prestashop_product_prepare'&&c.resource==='combinations')?.expected_product_id),'55');
  assert.equal(await page.getByRole('button',{name:'Guardar cambios en newoldsmok'}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>productosQA.calls.every(c=>['prestashop_read','prestashop_item_read','prestashop_product_prepare','prestashop_product_create_profile','prestashop_product_create_prepare'].includes(c.action))),true);
  await page.evaluate(()=>{productosQA.allowWrites=true;});
  assert.equal(await page.locator('.prd-parallel-editors > fieldset').count(),2,'Dos fichas paralelas');
  if(width===1440&&process.env.TOTUS_PRODUCTS_CAPTURE)await page.screenshot({path:process.env.TOTUS_PRODUCTS_CAPTURE,fullPage:false});
  await page.locator('[data-pr-lang-store="newoldsmok"][data-pr-lang-field="name"]').selectOption('1');
  await page.getByRole('button',{name:'Validar contra el XML de la tienda'}).click();
  await page.getByText(/XML del producto validado/).waitFor();
  await page.locator('[data-pr-edit-confirm="newoldsmok"]').fill('GUARDAR');
  await page.locator('[data-pr-edit-confirm="newoldsmok"]').blur();
  await page.getByRole('button',{name:'Guardar cambios en newoldsmok'}).click();
  await page.getByText(/Actualización guardada y releída/).waitFor();
  await page.getByRole('button',{name:'Validar variación'}).click();
  await page.getByText(/Variación #200 de newoldsmok comprobada/).waitFor();
  await page.locator('[data-pr-edit-confirm="newoldsmok|200"]').fill('GUARDAR');
  await page.locator('[data-pr-edit-confirm="newoldsmok|200"]').blur();
  await page.getByRole('button',{name:'Guardar combinación',exact:true}).click();
  await page.getByText(/Combinación #200 guardada y releída/).waitFor();
  assert.equal(await page.evaluate(()=>productosQA.calls.filter(c=>c.action==='prestashop_product_commit').length),2);
  await page.evaluate(()=>{productosQA.calls=[];productosQA.allowWrites=false;});
  await page.getByRole('button',{name:'Cambios masivos'}).click();
  await page.locator('[data-pr-bulk="101"]').check();
  await page.getByRole('button',{name:'Revisar selección'}).click();
  await page.getByText(/1 variaciones distintas/).waitFor();
  await page.getByRole('button',{name:'Catálogo',exact:true}).click();
  await page.getByRole('button',{name:'Crear borrador nuevo'}).click();
  for(const field of ['ean13','weight','width','height','depth','description_short','meta_description']){
   assert.equal(await page.locator('[data-pr-value="'+field+'"]').count(),1,'El borrador nuevo debe mostrar '+field);
  }
  await page.locator('[data-pr-value="name"]').fill('Pruebas');
  await page.locator('[data-pr-value="reference"]').fill('PRUEBAS-SIMULACION');
  await page.getByRole('button',{name:'Variaciones'}).click();
  await page.getByRole('button',{name:'Añadir variación de borrador'}).click();
  await page.getByText(/Variación de borrador añadida/).waitFor();
  await page.getByRole('button',{name:'Fichas paralelas'}).click();
  await page.locator('[data-pr-target="newoldsmok"]').check();
  await page.getByRole('button',{name:'Buscar coincidencias y preparar cambios'}).click();
  await page.getByText(/Propuesta preparada para 2 tienda/).waitFor();
  assert.equal(await page.locator('.prd-plan').count(),2);
  assert.equal(await page.locator('.prd-plan').filter({hasText:'Crear producto nuevo'}).count(),2);
  await page.getByRole('button',{name:'Consultar idiomas de la tienda'}).first().click();
  await page.getByText(/Idiomas y categorías consultados en hortimatic/).waitFor();
  await page.locator('[data-pr-create-store="hortimatic"][data-pr-create-field="category_id"]').selectOption('33');
  await page.locator('[data-pr-create-store="hortimatic"][data-pr-create-field="category_id"]').blur();
  await page.getByRole('button',{name:'Validar alta sin escribir'}).click();
  await page.getByText(/Prevalidación de hortimatic correcta/).waitFor();
  await page.locator('[data-pr-create-confirm="hortimatic"]').fill('CREAR');
  await page.locator('[data-pr-create-confirm="hortimatic"]').blur();
  assert.equal(await page.getByRole('button',{name:'Crear en PrestaShop (inactivo)'}).isEnabled(),true);
  assert.equal(await page.evaluate(()=>productosQA.calls.some(c=>c.action==='prestashop_product_create_commit')),false);
  assert.equal(await page.locator('[data-pr-action=edit-commit]').count(),0,'Un alta nueva no muestra un guardado sobre un producto existente');
  assert.equal(await page.evaluate(()=>productosQA.calls.every(c=>['prestashop_read','prestashop_item_read','prestashop_product_prepare','prestashop_product_create_profile','prestashop_product_create_prepare'].includes(c.action))),true);
  assert.ok(await page.evaluate(()=>productosQA.ui.hasDraft()));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Sin desbordamiento a '+width);
  // Explicitly switch this local harness to fictional writes. No network transport
  // is used: verify the complete user path rather than only the preflight controls.
  await page.evaluate(()=>{productosQA.allowWrites=true;});
  await page.getByRole('button',{name:'Crear en PrestaShop (inactivo)',exact:true}).click();
  await page.getByText('Base del producto guardada',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Consultar atributos, proveedores y monedas',exact:true}).click();
  await page.getByText(/Atributos, proveedores y monedas consultados/).waitFor();
  await page.locator('[data-pr-stage-field="reference"]').fill('PRUEBAS-AZUL');await page.locator('[data-pr-stage-field="reference"]').blur();
  await page.locator('[data-pr-stage-field="price"]').fill('0.50');await page.locator('[data-pr-stage-field="price"]').blur();
  await page.locator('[data-pr-stage-attributes]').selectOption(['10']);await page.locator('[data-pr-stage-attributes]').blur();
  await page.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await page.getByText('Etapa validada sin escribir.',{exact:true}).waitFor().catch(async error=>{console.error('STAGE UI DIAGNOSTIC',await page.locator('#productosRoot').innerText(),await page.evaluate(()=>productosQA.calls.slice(-3).map(c=>({action:c.action,kind:c.kind}))));throw error;});
  await page.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Combinaciones guardado y verificado/).waitFor();
  await page.getByRole('button',{name:'Existencias',exact:true}).click();
  await page.getByRole('button',{name:'Añadir existencias',exact:true}).click();
  await page.locator('[data-pr-stage-field="id_product_attribute"]').selectOption('801');await page.locator('[data-pr-stage-field="id_product_attribute"]').blur();
  await page.locator('[data-pr-stage-field="quantity"]').fill('7');await page.locator('[data-pr-stage-field="quantity"]').blur();
  await page.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await page.getByText('Etapa validada sin escribir.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Existencias guardado y verificado/).waitFor();
  await page.getByRole('button',{name:'Imágenes',exact:true}).click();
  await page.getByRole('button',{name:'Añadir imágenes',exact:true}).click();
  await page.locator('[data-pr-stage-file]').setInputFiles({name:'jardineria.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><path d="M40 35h65v65H40zM105 50l35-25-10 55h-25" fill="#16845a"/><circle cx="30" cy="55" r="20" fill="none" stroke="#16845a" stroke-width="9"/></svg>')});
  await page.getByText(/Imagen preparada con transparencia/).waitFor().catch(async error=>{console.error('IMAGE UI DIAGNOSTIC',await page.locator('.prd-status').innerText(),errors);throw error;});
  assert.equal(await page.locator('.prd-stage-image').count(),1);
  await page.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await page.getByText('Etapa validada sin escribir.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Imágenes guardado y verificado/).waitFor();
  await page.getByRole('button',{name:'Revisión y publicación',exact:true}).click();
  await page.getByRole('button',{name:'Añadir revisión y publicación',exact:true}).click();
  await page.getByRole('button',{name:'Preparar descripción visual con las imágenes guardadas',exact:true}).click();
  await page.locator('[data-pr-stage-field="active"]').selectOption('1');await page.locator('[data-pr-stage-field="active"]').blur();
  await page.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await page.getByText('Etapa validada sin escribir.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText(/Revisión y publicación guardado y verificado/).waitFor();
  const writes=await page.evaluate(()=>productosQA.calls.filter(c=>c.action==='prestashop_product_step_commit'));
  assert.deepEqual(writes.map(c=>c.kind),['variation','stock','image','finish']);
  assert.equal(writes.at(-1).fields.available_for_order,'0');assert(writes.at(-1).fields.description[0].value.includes('/901-large_default/'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Etapas sin desbordamiento a '+width);
  const planCountBefore=await page.locator('.prd-plan').count();
  await page.evaluate(async()=>{productosQA.calls=[];await productosQA.ui.mount(document.querySelector('#productosRoot'));});
  await page.getByText(/Borrador recuperado de esta cuenta/).waitFor();
  assert.equal(await page.locator('.prd-plan').count(),planCountBefore,'Recuperar las fichas con sus solicitudes estables');
  assert.equal(await page.evaluate(()=>productosQA.calls.some(c=>c.action.endsWith('_commit'))),false,'Recargar nunca repite un alta ni una etapa');
  await page.evaluate(async()=>{productosQA.actor='admin-2';await productosQA.ui.mount(document.querySelector('#productosRoot'));});
  assert.equal(await page.locator('.prd-plan').count(),0);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('PRODUCTOS UI: 390/768/1440, dos tiendas, creación completa simulada, variación, existencias, PNG transparente y descripción visual; sin escrituras reales.');
}finally{await browser.close();if(localServer)await new Promise(r=>localServer.close(r));}
