import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  const q=window.offerQA={calls:[],canEdit:true,stale:false,lose:false,items:[{id:'42',name:'Familia QA A',price:'10.000000',reference:'QA-A',active:'0',associations:{images:[],combinations:[]}},{id:'43',name:'Familia QA B',price:'20.000000',reference:'QA-B',active:'0',associations:{images:[],combinations:[]}}]};
  q.ui=createProductosUI({actor:()=> '11111111-1111-4111-8111-111111111111',allowed:()=>true,canEdit:()=>q.canEdit,rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),invoke:async body=>{
   q.calls.push(structuredClone(body));q.writes??=new Map();const out={ok:true,store:body.store,resource:body.resource,record_id:body.record_id,page:body.page,possibly_more:false};const item=q.items.find(row=>row.id===body.record_id);
   if(body.action==='prestashop_product_create_profile')return {...out,language_ids:['1']};
   if(body.action==='prestashop_read')return {...out,rows:body.resource==='products'?structuredClone(q.items):[]};
   if(body.action==='prestashop_item_read')return {...out,item:structuredClone(item)};
   if(body.action==='prestashop_product_step_prepare')return {...out,persisted:false,can_commit:true,fingerprint:'a'.repeat(64)};
   if(body.action==='prestashop_product_step_commit'){const key=body.parent_request_id+'|'+body.step_key;if(!q.writes.has(key))q.writes.set(key,{persisted:true,verified:true,record_id:String(100+q.writes.size)});if(q.lose){q.lose=false;throw Error('Respuesta perdida QA');}return {...out,...q.writes.get(key)};}
   if(body.action==='prestashop_product_prepare')return {...out,can_commit:true,fingerprint:'a'.repeat(64),changes:body.changes.map(change=>({...change,before:q.stale?'999':item[change.field],after:change.value,changed:item[change.field]!==change.value}))};
   if(body.action==='prestashop_product_commit'){for(const change of body.changes)item[change.field]=change.value;if(q.lose){q.lose=false;throw Error('Respuesta perdida QA');}return {...out,persisted:true,verified:true};}
   throw Error('Unexpected simulated action '+body.action);
  }});await q.ui.mount(document.querySelector('#productosRoot'));
 });

 const select=async()=>{await page.locator('[data-pr-catalog-all]').check();await page.getByRole('button',{name:'Aplicar ofertas seleccionadas',exact:true}).click();};
 const review=async()=>{await page.locator('dialog input[name=percent]').fill('20');await page.locator('dialog input[name=from]').fill('2026-12-01T09:00');await page.locator('dialog input[name=to]').fill('2026-12-10T20:00');await page.getByRole('button',{name:'Revisar ofertas',exact:true}).click();await page.getByText('Ofertas revisadas sin escribir.',{exact:false}).waitFor();};
 await select();await review();assert.equal(await page.evaluate(()=>offerQA.writes.size),0);
 assert.match(await page.locator('[data-offer-review]').innerText(),/20 %/);
 for(const width of [390,977,1440,1920]){await page.setViewportSize({width,height:900});const box=await page.locator('dialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
 await page.getByRole('button',{name:'Publicar ofertas revisadas',exact:true}).click();await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>offerQA.writes.size),2);assert.deepEqual(await page.evaluate(()=>offerQA.items.map(i=>i.price)),['10.000000','20.000000']);
 await select();await review();await page.evaluate(()=>offerQA.lose=true);await page.getByRole('button',{name:'Publicar ofertas revisadas',exact:true}).click();await page.getByText('El lote se ha detenido',{exact:false}).waitFor();const original=await page.evaluate(()=>offerQA.calls.filter(c=>c.action==='prestashop_product_step_commit').at(-1));assert.equal(await page.evaluate(()=>offerQA.writes.size),3);
 await page.getByRole('button',{name:'Cerrar ofertas',exact:true}).click();await page.evaluate(async()=>{offerQA.ui.dispose();await offerQA.ui.mount(document.querySelector('#productosRoot'));});await page.getByRole('button',{name:'Retomar ofertas pendientes',exact:true}).click();await page.getByRole('button',{name:'Comprobar y continuar',exact:true}).click();await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>offerQA.writes.size),4);
 const replay=await page.evaluate(()=>offerQA.calls.filter(c=>c.action==='prestashop_product_step_commit').slice(-2)[0]);assert.equal(replay.parent_request_id,original.parent_request_id);assert.equal(replay.step_key,original.step_key);
 await page.evaluate(async()=>{offerQA.canEdit=false;await offerQA.ui.mount(document.querySelector('#productosRoot'));});assert.equal(await page.getByRole('button',{name:'Aplicar ofertas seleccionadas',exact:true}).count(),0);assert.deepEqual(errors,[]);console.log('CATALOG OFFERS: review, two products, unchanged base prices, four widths, uncertain response, durable remount and exact-request recovery PASS; fictional native API only.');
}finally{await browser.close();await server?.close();}
