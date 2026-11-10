import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
import {chromium} from 'playwright';
const server=await startLocalServer(),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'});
await mkdir('qa-artifacts',{recursive:true});
try{for(const width of [390,680,1017,1440,1920]){
 const page=await browser.newPage({viewport:{width,height:800}});
 await page.route('https://hortimatic.com/**',route=>{const portrait=route.request().url().includes('/91-');return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${portrait?100:300}" height="${portrait?300:160}"><rect x="2" y="2" width="98%" height="98%" fill="teal" stroke="red" stroke-width="4"/></svg>`});});
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.evaluate(async()=>{
  const {createProductosUI,productosWorkspacePage}=await import('../src/productos-ui.js');document.querySelector('#chatHarness').innerHTML=productosWorkspacePage();
  const product={id:'42',name:'Galería horizontal y vertical',reference:'QA-FIT',active:'0',price:'10',id_default_image:'90',associations:{images:[{id:'90'},{id:'91'}],combinations:[]}};
  const ui=createProductosUI({actor:()=> 'gallery-fit',allowed:()=>true,canEdit:()=>true,rpc:async()=>({connections:[{id:'1',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]}),invoke:async b=>{
   if(b.action==='prestashop_read')return {ok:true,store:b.store,resource:b.resource,page:b.page,possibly_more:false,rows:b.resource==='products'?[product]:[]};
   if(b.action==='prestashop_item_read')return {ok:true,store:b.store,resource:b.resource,record_id:b.record_id,item:product};
   if(b.action==='prestashop_product_create_profile')return {ok:true,persisted:false,store:b.store,resource:'products',language_ids:['1']};
   throw Error('Unexpected write in image-layout test: '+b.action);
  }});await ui.mount(document.querySelector('#productosRoot'));
 });
 await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();await page.locator('[data-pr-section="imagenes"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.prd-gallery-image')].every(i=>i.complete&&i.naturalWidth>0));
 for(const photo of await page.locator('.prd-gallery-card .prd-photo-open').all()){
  const {frame,image}=await photo.evaluate(button=>({frame:button.getBoundingClientRect().toJSON(),image:button.querySelector('img').getBoundingClientRect().toJSON()}));
  assert(frame&&image&&image.x>=frame.x-1&&image.y>=frame.y-1&&image.x+image.width<=frame.x+frame.width+1&&image.y+image.height<=frame.y+frame.height+1,'Whole image element fits its frame at '+width+' '+JSON.stringify({frame,image}));
  assert.equal(await photo.locator('img').evaluate(i=>getComputedStyle(i).objectFit),'contain');assert.equal(Math.round(frame.height),200);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
 await page.screenshot({path:'qa-artifacts/productos-gallery-fit-'+width+'.png',fullPage:true});await page.close();
}console.log('Gallery fit: full landscape/portrait images and responsive frames at 390/680/1017/1440/1920 PASS; no business writes.');}finally{await browser.close();await server?.close();}
