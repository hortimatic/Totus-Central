import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'});
await mkdir('qa-artifacts',{recursive:true});
try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
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
  assert.equal(await page.getByRole('tab').count(),5);
  await page.getByText('Producto real de prueba',{exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),1);
  assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/1\.428|VP-AG2|SANDBOX|Latencia:|12:44/);
  assert.equal(await page.locator('#productosRoot [onclick]').count(),0);
  await page.locator('.prd-columns summary').click();
  await page.locator('[data-pr-column="ean13"]').uncheck();
  await page.locator('[data-pr-column="ean13"]').check();
  await page.locator('.prd-columns summary').click();
  assert.equal(await page.locator('th').filter({hasText:'EAN'}).count(),1);
  await page.locator('[data-pr-catalog-all]').check();
  assert.equal(await page.locator('[data-pr-action="catalog-copy"]').isEnabled(),true);
  await page.screenshot({path:'qa-artifacts/productos-stitch-catalogo-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
  await page.locator('#subtabs-bar').waitFor();
  assert.equal(await page.locator('#subtabs-bar button').count(),9);
  await page.locator('[data-pr-value="name"]').fill('Nombre editado seguro');
  await page.locator('[data-pr-value="name"]').blur();
  for(const section of ['contenido','precios','variaciones','imagenes','seo','transporte','inventario','organizacion','general']){
   await page.locator('[data-pr-action="editor-section"][data-pr-section="'+section+'"]').click();
  }
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre editado seguro');
  assert.equal(await page.locator('#productosRoot [onclick]').count(),0);
  assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/VP-AG2|Voopoo Argus GT II|69,95|38 uds/);
  await page.screenshot({path:'qa-artifacts/productos-stitch-ficha-'+width+'.png',fullPage:true});
  await page.locator('#store-context-select').selectOption('newoldsmok');
  await page.getByText('Producto real de prueba',{exact:true}).waitFor();
  await page.locator('#store-context-select').selectOption('hortimatic');
  await page.locator('#subtabs-bar').waitFor();
  assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Nombre editado seguro');
  await page.locator('[data-pr-action="mode"][data-mode="comparar"]').click();
  assert.equal(await page.locator('#panel-store-source [data-pr-value="name"]').inputValue(),'Nombre editado seguro');
  await page.locator('[data-pr-action="fields-all"]').click();
  assert.equal(await page.locator('[data-pr-field="name"]').isChecked(),true);
  await page.screenshot({path:'qa-artifacts/productos-stitch-copia-'+width+'.png',fullPage:true});
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
  await page.screenshot({path:'qa-artifacts/productos-stitch-url-'+width+'.png',fullPage:true});
  await page.locator('[data-pr-action="mode"][data-mode="guardado"]').click();
  assert.equal(await page.locator('#tab-borradores').isVisible(),true);
  assert.doesNotMatch(await page.locator('#productosRoot').innerText(),/Voopoo|3 en cola|Purgar Antiguos/);
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>stitchQA.calls.every(x=>['prestashop_read','prestashop_item_read'].includes(x.action))),true);
  await page.close();
 }
 console.log('Stitch original shell/catalog: 390/768/1440, real-data binding, columns, selection, no demo handlers: PASS');
}finally{await browser.close();await server?.close();}
