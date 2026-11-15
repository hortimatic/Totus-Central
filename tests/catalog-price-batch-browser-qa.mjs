import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage('pricing');
  const q=window.priceQA={calls:[],canEdit:true,stale:false,lose:false,items:[{id:'42',name:'Familia QA A',price:'10.000000',reference:'QA-A',active:'0',associations:{images:[],combinations:[]}},{id:'43',name:'Familia QA B',price:'20.000000',reference:'QA-B',active:'0',associations:{images:[],combinations:[]}}]};
  q.ui=createProductosUI({actor:()=> '11111111-1111-4111-8111-111111111111',allowed:()=>true,canEdit:()=>q.canEdit,rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),invoke:async body=>{
   q.calls.push(structuredClone(body));const out={ok:true,store:body.store,resource:body.resource,record_id:body.record_id,page:body.page,possibly_more:false};const item=q.items.find(row=>row.id===body.record_id);
   if(body.action==='prestashop_product_create_profile')return {...out,language_ids:['1']};
   if(body.action==='prestashop_read')return {...out,rows:body.resource==='products'?structuredClone(q.items):[]};
   if(body.action==='prestashop_item_read')return {...out,item:structuredClone(item)};
   if(body.action==='prestashop_product_prepare')return {...out,can_commit:true,fingerprint:'a'.repeat(64),changes:body.changes.map(change=>({...change,before:q.stale?'999':item[change.field],after:change.value,changed:item[change.field]!==change.value}))};
   if(body.action==='prestashop_product_commit'){for(const change of body.changes)item[change.field]=change.value;if(q.lose){q.lose=false;throw Error('Respuesta perdida QA');}return {...out,persisted:true,verified:true};}
   throw Error('Unexpected simulated action '+body.action);
  }});await q.ui.mount(document.querySelector('#productosRoot'));
 });
 const select=async()=>{await page.locator('[data-pr-catalog-all]').check();await page.getByRole('button',{name:'Ajustar precios seleccionados',exact:true}).click();await page.locator('dialog form').waitFor();};
 const review=async(value='20')=>{await page.locator('dialog select[name=mode]').selectOption('percent');await page.locator('dialog input[name=value]').fill(value);await page.getByRole('button',{name:'Revisar lote',exact:true}).click();};
 await select();await review();await page.getByText('Lote revisado sin escribir.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>priceQA.calls.filter(c=>c.action==='prestashop_product_commit').length),0);
 assert.match(await page.locator('[data-batch-review]').innerText(),/12\.000000/);assert.match(await page.locator('[data-batch-review]').innerText(),/24\.000000/);
 for(const width of [390,768,1440,1920]){await page.setViewportSize({width,height:1000});const bounds=await page.locator('dialog').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Price review fits '+width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
 await page.getByRole('button',{name:'Publicar precios revisados',exact:true}).click();await page.locator('dialog').waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>priceQA.items.map(row=>row.price)),['12.000000','24.000000']);
 await select();await page.evaluate(()=>priceQA.lose=true);await review('10');await page.getByText('Lote revisado sin escribir.',{exact:false}).waitFor();await page.getByRole('button',{name:'Publicar precios revisados',exact:true}).click();await page.getByText('No se ha continuado con el resto.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>priceQA.items[1].price),'24.000000','A lost response stops the remaining writes');
 const request=await page.evaluate(()=>priceQA.calls.filter(c=>c.action==='prestashop_product_commit').at(-1).request_id);assert(request);
 await page.getByRole('button',{name:'Cerrar ajuste de precios',exact:true}).click();await page.locator('dialog').waitFor({state:'detached'});
 await page.locator('[data-pr-action=table-open][data-pr-id="42"]').click();await page.locator('[data-quick-recover]').click();await page.locator('[data-quick-save]').click();await page.waitForFunction(()=>priceQA.calls.filter(c=>c.action==='prestashop_product_commit').length===4);
 assert.equal(await page.evaluate(()=>priceQA.calls.filter(c=>c.action==='prestashop_product_commit').at(-1).request_id),request,'Recovery retains the exact request');
 await page.locator('[data-pr-action=table-open][data-pr-id="43"]').click();await page.locator('[data-quick-discard]').click();await page.locator('[data-pr-catalog-all]').uncheck();
 await page.evaluate(()=>priceQA.stale=true);await select();await review();await page.getByText('ha cambiado en la tienda',{exact:false}).waitFor();assert.equal(await page.locator('[data-batch-save]').isVisible(),false);assert.equal(await page.evaluate(()=>priceQA.calls.filter(c=>c.action==='prestashop_product_commit').length),4);
 await page.getByRole('button',{name:'Cerrar ajuste de precios',exact:true}).click();await page.evaluate(async()=>{priceQA.canEdit=false;await priceQA.ui.mount(document.querySelector('#productosRoot'));});assert.equal(await page.getByRole('button',{name:'Ajustar precios seleccionados',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('CATALOG PRICE BATCH: review before writes, two-row native readback, four widths, stop on uncertain reply, same-request recovery, stale-price and permissions PASS; fictional API only.');
}finally{await browser.close();await server?.close();}
