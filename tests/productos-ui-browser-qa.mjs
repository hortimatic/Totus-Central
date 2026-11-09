import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('qa-artifacts',{recursive:true});
import {startLocalServer} from './local-static-server.mjs';
const localServer=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://hortimatic.com/91-**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect x="10" y="10" width="60" height="60" fill="green"/></svg>'}));
  await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
  await page.evaluate(async()=>{
   const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');
   const root=document.querySelector('#chatHarness');
   root.innerHTML=productosWorkspacePage();
   const q=window.productosQA={actor:'admin-1',calls:[],slow:false,connections:['hortimatic','newoldsmok'].map((store,i)=>({id:String(i+1).padStart(8,'0')+'-1111-4111-8111-111111111111',name:'PrestaShop · '+(store==='hortimatic'?'Hortimatic':'NewOldSmok'),protocol:'prestashop',configured:true,enabled:true,revision:1,verified_revision:1,real_data_authorized:true}))};
   const fixture={
    'hortimatic|products|42':{id:'42',reference:'REF-42',name:'Producto <script>alert(1)</script>',description:'Origen',price:'12.90',meta_title:'SEO de origen',associations:{images:[{id:'91'}],combinations:[{id:'100'},{id:'101'}],categories:[{id:'3'}]}},
    'newoldsmok|products|55':{id:'55',reference:'DESTINO-55',name:[{id:'1',value:'Destino antiguo'}],description:'Destino',price:'14.90',meta_title:'SEO propio',associations:{combinations:[{id:'200'}]}},
    'hortimatic|combinations|100':{id:'100',id_product:'42',reference:'REF-42-10',price:'1',minimal_quantity:'1',associations:{product_option_values:[{id:'10'}]}},
    'hortimatic|combinations|101':{id:'101',id_product:'42',reference:'REF-42-20',price:'2',minimal_quantity:'1',associations:{product_option_values:[{id:'20'}]}},
    'newoldsmok|combinations|200':{id:'200',id_product:'55',reference:'REF-42-10',price:'1.50',minimal_quantity:'1',associations:{product_option_values:[{id:'10'}]}}
   };
   q.fixture=fixture;
   q.ui=createProductosUI({rpc:async()=>({connections:q.connections}),actor:()=>q.actor,allowed:()=>true,canEdit:()=>true,invoke:async body=>{
    q.calls.push(structuredClone(body));
    if(q.slow)await new Promise(r=>setTimeout(r,200));
    if(body.action==='prestashop_product_create_profile')return {ok:true,store:body.store,resource:'products',language_ids:['1','2'],persisted:false};
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
     if(body.resource==='stock_availables')return {ok:true,store:body.store,resource:body.resource,page:body.page,possibly_more:false,rows:(body.product_ids||[]).flatMap(id=>[{id:'1001',id_product:id,id_product_attribute:'0',id_shop:'1',quantity:'0',out_of_stock:'0',depends_on_stock:'0',location:''},{id:'1002',id_product:id,id_product_attribute:'801',id_shop:'1',quantity:'0',out_of_stock:'0',depends_on_stock:'0',location:''}])};
     if(body.resource==='categories')return {ok:true,store:body.store,resource:'categories',page:body.page,rows:[{id:'33',name:'Inicio'}],possibly_more:false};
     const catalogs={image_types:[{id:'1',name:'large_default',products:'1',width:'800',height:'800'}],product_options:[{id:'5',name:'Color',public_name:'Color'}],product_option_values:[{id:'10',id_attribute_group:'5',name:'Azul'}],suppliers:[{id:'2',name:'Proveedor de pruebas'}],currencies:[{id:'1',name:'Euro',iso_code:'EUR'}]};
     if(catalogs[body.resource])return {ok:true,store:body.store,resource:body.resource,rows:catalogs[body.resource],possibly_more:false};
     const rows=body.references?.length?body.store==='newoldsmok'?[]:[{id:'42',reference:'REF-42',name:'Origen'}]:body.store==='hortimatic'?[{id:'42',reference:'REF-42',name:'Producto <script>alert(1)</script>'}]:[];
     return {ok:true,store:body.store,resource:body.resource,page:body.page,rows,possibly_more:false};
    }
    throw Error('Se ha intentado escribir en PrestaShop');
   }});
   await q.ui.mount(document.querySelector('#productosRoot'));
  });
  await page.locator('[data-pr-action="mode"][data-mode="encargo"]').click();
  await page.locator('[data-pr-request="url"]').fill('https://proveedor.example/producto');
  await page.locator('[data-pr-request="url"]').blur();
  await page.locator('[data-pr-request="sale"]').fill('19,90');
  await page.locator('[data-pr-request="sale"]').blur();
  await page.getByRole('button',{name:'Preparar encargo',exact:true}).click();
  assert.match(await page.locator('textarea[readonly]').inputValue(),/19,90/);
  assert.match(await page.locator('textarea[readonly]').inputValue(),/state=1/);
    await page.locator('[data-pr-request=operation]').selectOption('copy');await page.locator('[data-pr-request=store]').selectOption('newoldsmok');await page.locator('[data-pr-request=source_store]').selectOption('hortimatic');assert.equal(await page.locator('[data-pr-request-origin] [data-pr-request=source_store]').count(),1);assert.equal(await page.locator('[data-pr-request-origin] [data-pr-request=product_id]').count(),1);await page.locator('[data-pr-request=product_id]').fill('42');await page.locator('[data-pr-request=product_id]').blur();await page.getByRole('button',{name:'Preparar encargo',exact:true}).click();assert.match(await page.locator('textarea[readonly]').inputValue(),/Origen: Hortimatic/);assert.match(await page.locator('textarea[readonly]').inputValue(),/imágenes y combinaciones/);
  await page.locator('[data-pr-request=operation]').selectOption('edit');await page.locator('[data-pr-request=notes]').fill('Cambiar descripción y precio');await page.locator('[data-pr-request=notes]').blur();await page.getByRole('button',{name:'Preparar encargo',exact:true}).click();assert.match(await page.locator('textarea[readonly]').inputValue(),/Modifica únicamente/);
  await page.locator('[data-pr-request=operation]').selectOption('url');await page.locator('[data-pr-request=store]').selectOption('hortimatic');
  assert.equal(await page.evaluate(()=>window.productosQA.calls.some(c=>c.action.includes('commit'))),false);
  if(await page.evaluate(()=>document.querySelector('#productosRoot').scrollWidth>window.innerWidth+2))console.log('OVERFLOW',await page.evaluate(()=>[...document.querySelectorAll('#productosRoot *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,18).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,w:e.getBoundingClientRect().width}))));
  assert(await page.evaluate(()=>document.querySelector('#productosRoot').scrollWidth<=window.innerWidth+2));
  await page.locator('[data-pr-action="mode"][data-mode="catalogo"]').click();
  assert.equal(await page.locator('.prd-catalog-table tbody tr').count(),1);
  assert.equal(await page.evaluate(()=>{const r=document.querySelector('.prd-catalog-filters').getBoundingClientRect();return [...document.querySelectorAll('.prd-catalog-filters label')].every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;});}),true,'Filters fit the available module width');
  if(width===390)assert.equal(await page.evaluate(()=>{const v=document.querySelector('.prd-catalog-table');return [...v.querySelectorAll('th,td')].every(c=>getComputedStyle(c).position!=='sticky');}),true,'No frozen columns reserve screen space');
  const position=page.locator('[data-pr-table-position]');
  await position.focus();await position.press('End');
  await page.waitForFunction(()=>{const v=document.querySelector('.prd-catalog-table');return v.scrollLeft>=v.scrollWidth-v.clientWidth-2;});
  await position.press('Home');
  await page.waitForFunction(()=>document.querySelector('.prd-catalog-table').scrollLeft<2);

  await page.locator('[data-pr-search]').fill('NO-EXISTE-EN-PRUEBA');assert.equal(await page.locator('.prd-catalog-table tbody tr').count(),0);await page.getByRole('button',{name:'Limpiar búsqueda y filtros',exact:true}).click();assert.equal(await page.locator('.prd-catalog-table tbody tr').count(),1);
  await page.locator('.prd-columns summary').click();
  await page.locator('[data-pr-column="ean13"]').check();
  await page.locator('.prd-columns summary').click();
  assert.equal(await page.locator('.prd-catalog-table th').filter({hasText:'EAN'}).count(),1);
  await page.locator('[data-pr-catalog-all]').check();
  assert.equal(await page.locator('[data-pr-action="catalog-copy"]').isEnabled(),true);
  await page.screenshot({path:'qa-artifacts/productos-catalogo-'+width+'.png',fullPage:true});

  await page.getByRole('button',{name:'Abrir ficha'}).click();
  await page.getByText(/2 combinaciones (?:leídas|releídas)/).waitFor();
  assert.equal(await page.locator('#productosRoot script').count(),0);
  await page.locator('[data-pr-action="mode"][data-mode="comparar"]').click();
  await page.locator('[data-pr-action="fields-none"]').click();
  assert.equal(await page.locator('.prd-copy-image-choice input').isChecked(),false);
  await page.locator('[data-pr-action="fields-all"]').click();
  assert.equal(await page.locator('.prd-copy-image-choice input').isChecked(),true,'Select all includes images');
  assert.equal(await page.locator('#panel-store-target img').count(),2,'Destination shows selected main photo and gallery before upload');
  assert.match(await page.locator('#panel-store-target').innerText(),/Vista previa.*pendiente de copiar/);
  assert.match(await page.locator('#panel-store-target img').first().getAttribute('src'),/hortimatic.com\/91-/,'Preview keeps source image ID and is not claimed as native destination');
  await page.waitForFunction(()=>[...document.querySelectorAll('#panel-store-target img')].every(i=>i.complete&&i.naturalWidth>0));
  const copyMetrics=await page.evaluate(()=>{const a=document.querySelector('#panel-store-source [data-pr-copy-field="name"]').getBoundingClientRect(),b=document.querySelector('#panel-store-target [data-pr-copy-field="name"]').getBoundingClientRect();return {source:{width:a.width,height:a.height},target:{width:b.width,height:b.height}};});
  assert.equal(copyMetrics.source.height,34);assert.equal(copyMetrics.target.height,34);assert(Math.abs(copyMetrics.source.width-copyMetrics.target.width)<2,'Parallel cards share the same input width');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Copy workspace fits the viewport');
  await page.screenshot({path:'qa-artifacts/productos-copia-homogenea-'+width+'.png',fullPage:true});

  await page.locator('[data-pr-field="name"]').check();
  await page.locator('[data-pr-value="name"]').fill('Nombre personalizado');
  await page.locator('[data-pr-value="name"]').blur();
  await page.locator('[data-pr-action="mode"][data-mode="ficha"]').click();
  await page.locator('[data-pr-action="editor-section"][data-pr-section="variaciones"]').click();
  await page.locator('[data-pr-vid="100"][data-pr-vvalue="price"]').fill('3.50');
  await page.locator('[data-pr-vid="100"][data-pr-vvalue="price"]').blur();
  const writesBeforeTabs=await page.evaluate(()=>productosQA.calls.filter(call=>/commit$/.test(call.action)).length);
  for(const mode of ['comparar','encargo','guardado','catalogo','ficha'])await page.locator('[data-pr-action="mode"][data-mode="'+mode+'"]').click();
  await page.locator('[data-pr-section="general"]').click();
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre personalizado','Every main tab preserves unsaved product text');
  await page.locator('[data-pr-section="variaciones"]').click();
  assert.equal(await page.locator('[data-pr-vid="100"][data-pr-vvalue="price"]').inputValue(),'3.50','Every main tab preserves the edited combination');
  assert.equal(await page.evaluate(()=>productosQA.calls.filter(call=>/commit$/.test(call.action)).length),writesBeforeTabs,'Navigation never sends a write');

  await page.locator('[data-pr-action="mode"][data-mode="catalogo"]').click();
  await page.evaluate(()=>{const p=productosQA.fixture['hortimatic|products|42'];p.description='Contenido actualizado por otro operador';p.associations.images=[{id:'99'}];productosQA.fixture['hortimatic|combinations|100'].associations.images=[{id:'99'}];});
  await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
  await page.locator('[data-pr-section="variaciones"]').waitFor();
  await page.locator('[data-pr-section="general"]').click();
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre personalizado','Reopening keeps unsaved text');
  await page.locator('[data-pr-section="variaciones"]').click();
  assert.equal(await page.locator('[data-pr-vid="100"][data-pr-vvalue="price"]').inputValue(),'3.50','Reopening keeps unsaved variant price');
  assert.match(await page.locator('[data-pr-action="variation-images"][data-pr-vid="100"] img').getAttribute('src'),/99-home_default/,'Reopening reloads images from the shop');

  await page.locator('[data-pr-action="mode"][data-mode="comparar"]').click();
  await page.locator('[data-pr-action="fields-all"]').click();
  assert.equal(await page.locator('[data-pr-field="name"]').isChecked(),true);
  assert.equal(await page.locator('[data-pr-copy-variant]:checked').count(),2,'Select all includes the combinations');
  await page.locator('[data-pr-action="parallel-section"][data-pr-section="seo"]').click();
  assert.equal(await page.locator('[data-pr-field="meta_title"]').isChecked(),true);
  await page.locator('[data-pr-action="parallel-section"][data-pr-section="general"]').click();
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre personalizado');
  await page.screenshot({path:'qa-artifacts/productos-copia-'+width+'.png',fullPage:true});

  await page.locator('[data-pr-action="fields-none"]').click();
  assert.equal(await page.locator('.prd-copy-variant-options').getAttribute('open'),'','Selected combinations are visible by default');await page.locator('[data-pr-copy-variant="100"]').check();
  await page.locator('[data-pr-field="name"]').check();
  await page.locator('[data-pr-value="name"]').fill('Nombre personalizado');
  await page.locator('[data-pr-value="name"]').blur();
  await page.locator('[data-pr-existing-id="newoldsmok"]').fill('55');
  await page.locator('[data-pr-existing-id="newoldsmok"]').blur();
  await page.locator('[data-pr-action="compare"]').first().click();
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
  assert.equal(await page.locator('#panel-store-source,#panel-store-target').count(),2,'Dos fichas paralelas');
  if(width===1440&&process.env.TOTUS_PRODUCTS_CAPTURE){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:process.env.TOTUS_PRODUCTS_CAPTURE,fullPage:false});}
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
  await page.locator('[data-pr-action="mode"][data-mode="ficha"]').click();
  await page.locator('[data-pr-action="editor-section"][data-pr-section="variaciones"]').click();
  await page.locator('[data-pr-action="mode"][data-mode="bulk"]').click();
  await page.locator('[data-pr-bulk="100"]').check();
  await page.locator('[data-pr-bulk-value]').fill('4,25');await page.locator('[data-pr-bulk-value]').blur();
  await page.getByRole('button',{name:'Preparar y validar el lote'}).click();
  await page.getByText(/Lote validado sin escribir: 1 combinaciones/).waitFor();
  await page.locator('[data-pr-bulk-confirm]').fill('GUARDAR LOTE');await page.locator('[data-pr-bulk-confirm]').blur();
  await page.getByRole('button',{name:'Guardar lote seleccionado'}).click();
  await page.getByText(/Lote terminado: 1 combinaciones guardadas y releídas/).waitFor();
  assert.equal(await page.evaluate(()=>productosQA.calls.filter(c=>c.action==='prestashop_product_commit').length),3);
  assert.equal(await page.evaluate(()=>productosQA.calls.filter(c=>c.action==='prestashop_product_commit').at(-1).changes[0].value),'4.25');
  await page.locator('[data-pr-bulk="100"]').uncheck();
  await page.evaluate(()=>{productosQA.calls=[];productosQA.allowWrites=false;});
  await page.locator('[data-pr-action="mode"][data-mode="ficha"]').click();
  await page.locator('[data-pr-action="editor-section"][data-pr-section="variaciones"]').click();
  await page.locator('[data-pr-action="mode"][data-mode="bulk"]').click();
  await page.locator('[data-pr-bulk="101"]').check();
  await page.getByRole('button',{name:'Revisar selección'}).click();
  await page.getByText(/1 variaciones distintas/).waitFor();
  await page.locator('[data-pr-action="mode"][data-mode="catalogo"]').click();
  await page.locator('[data-pr-action="new-product"]').click();
  for(const [section,fields] of [['general',['ean13']],['contenido',['description_short']],['transporte',['weight','width','height','depth']],['seo',['meta_description']]]){
   await page.locator('[data-pr-action="editor-section"][data-pr-section="'+section+'"]').click();
   for(const field of fields)assert.equal(await page.locator('[data-pr-value="'+field+'"]').count(),1,'La pestaña debe mostrar '+field);
  }
  await page.locator('[data-pr-action="editor-section"][data-pr-section="general"]').click();
  await page.locator('[data-pr-value="name"]').fill('Pruebas');
  await page.locator('[data-pr-value="reference"]').fill('PRUEBAS-SIMULACION');
  await page.locator('[data-pr-action="mode"][data-mode="ficha"]').click();
  await page.locator('[data-pr-action="editor-section"][data-pr-section="variaciones"]').click();
  await page.locator('[data-pr-action="new-variant"]').click();
  await page.getByText(/Variación de borrador añadida/).waitFor();
  await page.locator('[data-pr-action="mode"][data-mode="comparar"]').click();
  await page.locator('[data-pr-target="newoldsmok"]').check();
  await page.locator('[data-pr-action="compare"]').first().click();
  await page.getByText(/Propuesta preparada para 2 tienda/).waitFor();
  assert.equal(await page.locator('.prd-plan').count(),2);
  assert.equal(await page.locator('.prd-plan').filter({hasText:'Crear producto nuevo'}).count(),2);
  await page.getByRole('button',{name:'Consultar idiomas de la tienda'}).first().click();
  await page.getByText(/Idiomas y categorías consultados en hortimatic/).waitFor();
  await page.locator('[data-pr-create-store="hortimatic"][data-pr-create-field="category_id"]').selectOption('33');
  await page.locator('[data-pr-create-store="hortimatic"][data-pr-create-field="category_id"]').blur();
  await page.locator('[data-pr-create-store="hortimatic"][data-pr-create-field="reference"]').fill('NEW-REF-UI');
  await page.locator('[data-pr-create-store="hortimatic"][data-pr-create-language="2"][data-pr-create-property="description"]').fill('<p>Descripción de destino dos</p>');
  await page.getByRole('button',{name:'Validar alta sin escribir'}).click();
  await page.getByText(/Prevalidación de hortimatic correcta/).waitFor();
  assert.equal(await page.evaluate(()=>productosQA.calls.filter(c=>c.action==='prestashop_product_create_prepare').at(-1).translations.find(t=>t.language_id==='2').description),'<p>Descripción de destino dos</p>','Second-language edits reach validation without a separate blur');
  await page.locator('[data-pr-create-confirm="hortimatic"]').fill('CREAR');
  assert.equal(await page.locator('[data-pr-create-confirm="hortimatic"]').evaluate(el=>document.activeElement===el),true,'Confirmation stays focused and save enables while typing');
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
  await page.getByText(/Imagen preparada con transparencia/).waitFor().catch(async error=>{console.error('IMAGE UI DIAGNOSTIC',await page.locator('[role="status"]').innerText(),errors);throw error;});
  assert.equal(await page.locator('.prd-stage-image').count(),1);
  await page.getByRole('button',{name:'Validar esta etapa',exact:true}).click();
  await page.getByText('Etapa validada sin escribir.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Guardar esta etapa',exact:true}).click();
  await page.getByText('large_default · 800 × 800 px',{exact:false}).waitFor();
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
  assert.equal(await page.evaluate(()=>localStorage.getItem('totus-products-columns:admin-2')),null);
  await page.locator('[data-pr-action="mode"][data-mode="encargo"]').click();
  assert.equal(await page.locator('[data-pr-request="url"]').inputValue(),'','Otro usuario no hereda el encargo');
  assert.equal(await page.locator('textarea[readonly]').inputValue(),'');
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('PRODUCTOS UI: 390/768/1440, dos tiendas, creación completa simulada, variación, existencias, PNG transparente y descripción visual; sin escrituras reales.');
}finally{await browser.close();if(localServer)await new Promise(r=>localServer.close(r));}
