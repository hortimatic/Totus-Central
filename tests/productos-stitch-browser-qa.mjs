import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'});
await mkdir('qa-artifacts',{recursive:true});
try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  const reference=await browser.newPage({viewport:{width,height:900}});await reference.goto('http://127.0.0.1:4173/design-reference/stitch-products/console.original.html');
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
  await page.evaluate(async()=>{
   const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');
   document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
   const q=window.stitchQA={calls:[]};
   q.ui=createProductosUI({actor:()=> 'stitch-test',allowed:()=>true,canEdit:()=>true,
    rpc:async()=>({connections:['Hortimatic','NewOldSmok'].map((name,i)=>({id:String(i+1),name:'PrestaShop · '+name,protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}))}),
    invoke:async b=>{q.calls.push(b);if(b.action==='prestashop_item_read')return {ok:true,store:b.store,resource:b.resource,record_id:b.record_id,item:{id:b.record_id,name:'Producto real de prueba',reference:'REAL-42',price:'10.90',description:'Descripción real',active:'1',associations:{images:[],combinations:[]}}};if(b.action!=='prestashop_read')throw Error('Unexpected mutation');return {ok:true,store:b.store,resource:b.resource,page:b.page,possibly_more:false,rows:b.resource==='products'?[{id:'42',name:'Producto real de prueba',reference:'REAL-42',ean13:'1234567890128',price:'10.90',active:'1'}]:[]};}
   });await q.ui.mount(document.querySelector('#productosRoot'));
  });
  const sourceCapture=async(id,name)=>{await reference.evaluate(id=>{document.querySelectorAll('.master-tab-view,.subtab-content').forEach(n=>n.style.removeProperty('display'));const buttons=[...document.querySelectorAll('.master-tab-btn')],ids=['tab-catalogo','tab-ficha','tab-copiar','tab-alta','tab-borradores'];window.totusOpenMasterTab(id,buttons[ids.indexOf(id)]);},id);await reference.screenshot({path:'qa-artifacts/stitch-original-'+name+'-'+width+'.png',fullPage:true});};
  assert.equal(await page.getByRole('tab').count(),5);
  await page.getByText('Producto real de prueba',{exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),1);
  assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/1\.428|VP-AG2|SANDBOX|Latencia:|12:44/);
  assert.equal(await page.locator('#productosRoot [onclick]').count(),0);
  await page.locator('.prd-columns summary').click();
  await page.locator('[data-pr-column="ean13"]').uncheck();
  await page.locator('[data-pr-column="ean13"]').check();
  await page.locator('[data-pr-column-key="image"][data-pr-direction="1"]').click();
  await page.locator('[data-pr-view-name]').fill('Revisión de catálogo');
  await page.locator('[data-pr-action="catalog-view-save"]').click();
  assert.equal(await page.locator('[data-pr-catalog-view]').inputValue(),'Revisión de catálogo');
  assert.equal(await page.locator('.prd-columns input[data-pr-column]').first().getAttribute('data-pr-column'),'id');
  await page.locator('.prd-columns summary').click();
  assert.equal(await page.locator('th').filter({hasText:'EAN'}).count(),1);
  await page.locator('[data-pr-catalog-all]').check();
  assert.equal(await page.locator('[data-pr-action="catalog-copy"]').isEnabled(),true);
  await page.screenshot({path:'qa-artifacts/productos-stitch-catalogo-'+width+'.png',fullPage:true});await sourceCapture('tab-catalogo','catalogo');
  await page.locator('#store-context-select').selectOption('both');
  await page.locator('tbody tr').nth(1).waitFor();
  assert.equal(await page.locator('tbody tr').count(),2,'Same numeric ID in two stores remains two distinct records');
  await page.locator('[data-pr-catalog-all]').check();
  await page.locator('[data-pr-action="catalog-copy"]').click();
  assert.equal(await page.locator('[data-pr-action="open-copy-item"]').count(),2);
  await page.locator('[data-pr-action="open-copy-item"][data-pr-shop="newoldsmok"]').click();
  await page.locator('[data-pr-action="mode"][data-mode="ficha"]').click();
  assert.equal(await page.locator('#store-context-select').inputValue(),'newoldsmok');
  assert.equal(await page.evaluate(()=>stitchQA.calls.filter(x=>x.action==='prestashop_item_read').at(-1).store),'newoldsmok');
  await page.locator('#subtabs-bar').waitFor().catch(async error=>{console.error(await page.locator('#productosRoot').innerText(),errors);throw error;});
  assert.equal(await page.locator('#subtabs-bar button').count(),9);
  const parity=[];
  for(const [current,original]of [['#sub-info [data-pr-value="name"]','#sub-info input:nth-of-type(1)'],['#sub-info [data-pr-value="reference"]','#sub-info input'],['#sub-desc [data-pr-value="description"]','#sub-desc textarea'],['#sub-seo [data-pr-value="meta_title"]','#sub-seo input'],['#sub-envio [data-pr-value="weight"]','#sub-envio input']]){
   const properties=['fontSize','fontFamily','lineHeight','backgroundColor','color','borderRadius','paddingTop','paddingBottom','paddingLeft','paddingRight'];
   const style=async(p,selector)=>p.locator(selector).first().evaluate((n,keys)=>Object.fromEntries(keys.map(k=>[k,getComputedStyle(n)[k]])),properties);
   const actual=await style(page,current),expected=await style(reference,original);parity.push({current,original,actual,expected});assert.deepEqual(actual,expected,'Native Stitch field styling '+current);
  }
  await writeFile('qa-artifacts/productos-stitch-style-parity-'+width+'.json',JSON.stringify(parity,null,2));
  assert.equal(await page.locator('#sub-info textarea').getAttribute('rows'),'2');assert.equal(await page.locator('#sub-desc textarea[data-pr-value="description"]').getAttribute('rows'),'6');assert.equal(await page.locator('#sub-seo textarea[data-pr-value="meta_description"]').getAttribute('rows'),'2');
  await page.locator('[data-pr-value="name"]').fill('Nombre editado seguro');
  await page.locator('[data-pr-value="name"]').blur();
  for(const section of ['contenido','precios','variaciones','imagenes','seo','transporte','inventario','organizacion','general']){
   await page.locator('[data-pr-action="editor-section"][data-pr-section="'+section+'"]').click();
   assert.deepEqual(await page.locator('#productosRoot button:visible:not([data-pr-action])').evaluateAll(ns=>ns.map(n=>n.textContent.trim())),[],'Every visible fiche button has a real action: '+section);
   await page.screenshot({path:'qa-artifacts/productos-stitch-'+section+'-'+width+'.png',fullPage:true});
   const ids={general:'sub-info',contenido:'sub-desc',precios:'sub-precios',variaciones:'sub-variaciones',imagenes:'sub-imagenes',seo:'sub-seo',transporte:'sub-envio',inventario:'sub-stock',organizacion:'sub-organizacion'};
   await reference.evaluate(id=>{document.querySelectorAll('.master-tab-view,.subtab-content').forEach(n=>n.style.removeProperty('display'));window.totusOpenMasterTab('tab-ficha',document.querySelectorAll('.master-tab-btn')[1]);const ids=['sub-info','sub-desc','sub-precios','sub-variaciones','sub-imagenes','sub-seo','sub-envio','sub-stock','sub-organizacion'];window.totusOpenSubTab(id,document.querySelectorAll('.subtab-btn')[ids.indexOf(id)]);},ids[section]);
   await reference.screenshot({path:'qa-artifacts/stitch-original-'+section+'-'+width+'.png',fullPage:true});
   const activeStyle=p=>p.locator('.subtab-btn[aria-current="page"],.subtab-btn.bg-primary').evaluateAll(ns=>{const c=getComputedStyle(ns[0]);return {background:c.backgroundColor,color:c.color,fontWeight:c.fontWeight};});assert.deepEqual(await activeStyle(page),await activeStyle(reference),'Active tab follows source styling '+section);
  }
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre editado seguro');
  await page.locator('[data-pr-section="contenido"]').click();
  const description=page.locator('#sub-desc [data-pr-value="description"]');
  await description.fill('Texto seguro');await description.press('ControlOrMeta+A');
  await page.locator('[data-pr-format="bold"]').click();
  assert.equal(await description.inputValue(),'<strong>Texto seguro</strong>');
  await page.getByRole('button',{name:'Vista previa',exact:true}).click();
  assert.equal(await page.locator('.prd-description-dialog iframe').getAttribute('sandbox'),'');
  await page.getByRole('button',{name:'Cerrar vista previa'}).click();
  await page.locator('[data-pr-section="general"]').click();

  assert.equal(await page.locator('#productosRoot [onclick]').count(),0);
  assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/VP-AG2|Voopoo Argus GT II|69,95|38 uds/);
  await page.screenshot({path:'qa-artifacts/productos-stitch-ficha-'+width+'.png',fullPage:true});
  await page.locator('#store-context-select').selectOption('hortimatic');
  await page.getByText('Producto real de prueba',{exact:true}).waitFor();
  await page.locator('#store-context-select').selectOption('newoldsmok');
  await page.locator('#subtabs-bar').waitFor().catch(async error=>{console.error(await page.locator('#productosRoot').innerText(),errors);throw error;});
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre editado seguro');
  await page.getByRole('tab',{name:/5\./}).click();
  await page.locator('[data-pr-action="draft-open"][data-pr-draft-key="newoldsmok|42"]').click();
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre editado seguro');
  await page.locator('[data-pr-action="mode"][data-mode="comparar"]').click();
  assert.equal(await page.locator('#panel-store-source [data-pr-value="name"]').inputValue(),'Nombre editado seguro');
  await page.locator('[data-pr-action="fields-all"]').click();
  assert.equal(await page.locator('[data-pr-field="name"]').isChecked(),true);
  await page.screenshot({path:'qa-artifacts/productos-stitch-copia-'+width+'.png',fullPage:true});await sourceCapture('tab-copiar','copia');
  assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/VP-AG2|VAP-XROS|38 uds|ps_nos_/);
  await page.locator('[data-pr-action="mode"][data-mode="encargo"]').click();
  await page.locator('[data-pr-request="url"]').fill('https://proveedor.example/producto');
  await page.locator('[data-pr-request="url"]').blur();
  await page.locator('[data-pr-request="sale"]').fill('38,49');
  await page.locator('[data-pr-request="sale"]').blur();
  await page.locator('[data-pr-action="request-build"]').click();
  assert.match(await page.locator('textarea[readonly]').inputValue(),/38,49/);
  assert.match(await page.locator('textarea[readonly]').inputValue(),/proveedor.example/);
  assert.equal(await page.locator('[data-pr-action="request-copy"]').isEnabled(),true);
  await page.screenshot({path:'qa-artifacts/productos-stitch-url-'+width+'.png',fullPage:true});await sourceCapture('tab-alta','url');
  await page.locator('[data-pr-action="mode"][data-mode="guardado"]').click();
  assert.equal(await page.locator('#tab-borradores').isVisible(),true);
  assert.equal(await page.locator('[data-pr-action="draft-purge"]').isDisabled(),true);
  await page.screenshot({path:'qa-artifacts/productos-stitch-guardado-'+width+'.png',fullPage:true});await sourceCapture('tab-borradores','guardado');
  assert.deepEqual(await page.locator('#productosRoot button:visible:not([data-pr-action])').evaluateAll(ns=>ns.map(n=>n.textContent.trim())),[],'Saved view buttons');
  assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/Voopoo|3 en cola|3 productos esperando|Hace 2 horas/);
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>stitchQA.calls.every(x=>['prestashop_read','prestashop_item_read'].includes(x.action))),true);
  await reference.close();await page.close();
 }
 console.log('Stitch original shell/catalog: 390/768/1440, real-data binding, columns, selection, no demo handlers: PASS');
}finally{await browser.close();await server?.close();}
