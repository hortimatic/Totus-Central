import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer(),{chromium}=await import('playwright'),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  const q=window.pickerQA={calls:[],items:[{id:'42',reference:'REF-A',name:'Bandeja A',price:'10',id_tax_rules_group:'0',associations:{}},{id:'43',reference:'REF-B',name:'Bandeja B',price:'20',id_tax_rules_group:'0',associations:{}}]};
  q.ui=createProductosUI({actor:()=> 'picker-test',allowed:()=>true,canEdit:()=>true,rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,real_data_authorized:true,revision:1,verified_revision:1}]}),invoke:async b=>{q.calls.push(structuredClone(b));if(b.action==='prestashop_product_create_profile')return {ok:true,store:b.store,resource:'products',language_ids:['1'],persisted:false};if(b.action==='prestashop_item_read')return {ok:true,store:b.store,resource:b.resource,record_id:b.record_id,item:structuredClone(q.items.find(p=>p.id===b.record_id))};if(b.action==='prestashop_read')return {ok:true,store:b.store,resource:b.resource,page:b.page,rows:b.resource==='products'?structuredClone(q.items):[],possibly_more:false};throw Error('Unexpected write or request '+b.action);}});await q.ui.mount(document.querySelector('#productosRoot'));
 });
 await page.getByRole('checkbox',{name:'Seleccionar producto 42',exact:true}).check();await page.getByRole('status').filter({hasText:'Producto de trabajo: Bandeja A'}).waitFor({timeout:5000}).catch(async e=>{console.error(await page.locator('[role=status]').allTextContents());throw e;});
 assert.equal(await page.getByRole('tab',{name:/1. Catálogo/}).getAttribute('aria-selected'),'true');
 await page.getByRole('tab',{name:/2. Ficha/}).click();assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Bandeja A');
 await page.locator('[data-pr-value="name"]').fill('Bandeja A editada');await page.locator('[data-pr-value="name"]').blur();
 await page.locator('[data-pr-action="picker-open"][data-id="43"]').click();await page.waitForFunction(()=>document.querySelector('[data-pr-value="reference"]')?.value==='REF-B');
 await page.getByRole('tab',{name:/3. Copiar/}).click();assert.equal(await page.locator('#panel-store-source strong').first().innerText(),'Bandeja B');
 await page.getByRole('tab',{name:/5. Guardado/}).click();await page.getByRole('tab',{name:/2. Ficha/}).click();assert.equal(await page.locator('[data-pr-value="name"]').inputValue(),'Bandeja B');
 await page.locator('[data-pr-action="picker-open"][data-id="42"]').click();await page.waitForFunction(()=>document.querySelector('[data-pr-value="name"]')?.value==='Bandeja A editada');
 await page.getByRole('searchbox',{name:'Buscar otro producto',exact:true}).fill('Bandeja B');assert.equal(await page.locator('[data-pr-action="picker-open"]').count(),1);
 await page.getByRole('button',{name:'Ver catálogo',exact:true}).click();await page.locator('[data-pr-action="catalog-activate"][data-id="43"]').click();await page.getByRole('status').filter({hasText:'Producto de trabajo: Bandeja B'}).waitFor();await page.getByRole('tab',{name:/2. Ficha/}).click();assert.equal(await page.locator('[data-pr-value="reference"]').inputValue(),'REF-B');
 assert.equal(await page.evaluate(()=>pickerQA.calls.some(c=>c.action.endsWith('_commit'))),false);assert.equal(await page.evaluate(()=>pickerQA.items[0].name),'Bandeja A');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.close();
}console.log('Shared product selection and visual picker: automatic checkbox/name activation, all tabs, preserved unsaved draft, no writes, responsive PASS');}finally{await browser.close();await server?.close();}


