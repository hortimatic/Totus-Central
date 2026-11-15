import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
import {clickModuleLink} from './ui-navigation.mjs';
const {chromium}=await import('playwright'),server=await startLocalServer(),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),original=sb.rpc.bind(sb);
  const q=window.connectedPriceQA={calls:[],items:[{id:'42',name:'Familia demo A',price:'10.000000',wholesale_price:'4.000000',reference:'QA-A',id_category_default:'10',active:'0',associations:{images:[],combinations:[],categories:[{id:'10'}]}},{id:'43',name:'Familia demo B',price:'20.000000',wholesale_price:'8.000000',reference:'QA-B',id_category_default:'10',active:'0',associations:{images:[],combinations:[],categories:[{id:'10'}]}}]};
  sb.rpc=async(name,args)=>name==='totus_products_context'?{data:{connections:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,configured:true,revision:1,verified_revision:1,real_data_authorized:true}]},error:null}:original(name,args);
  sb.functions.invoke=async(_name,{body})=>{
   q.calls.push(structuredClone(body));const out={ok:true,store:body.store,resource:body.resource,record_id:body.record_id,page:body.page,possibly_more:false};
   if(body.action==='prestashop_read')return {data:{...out,rows:body.resource==='products'?structuredClone(q.items):body.resource==='categories'?[{id:'10',name:'Familia demo'}]:[]},error:null};
   const item=q.items.find(i=>i.id===body.record_id);
   if(body.action==='prestashop_item_read')return {data:{...out,item:structuredClone(item)},error:null};
   if(body.action==='prestashop_product_prepare')return {data:{...out,can_commit:true,fingerprint:'a'.repeat(64),changes:body.changes.map(c=>({...c,before:item[c.field],after:c.value,changed:item[c.field]!==c.value}))},error:null};
   if(body.action==='prestashop_product_commit'){for(const c of body.changes)item[c.field]=c.value;return {data:{...out,persisted:true,verified:true},error:null};}
   throw Error('Unexpected fictional action '+body.action);
  };
 });
 await clickModuleLink(page,page.locator('#nav [data-route=pricing]'));
 await page.locator('[data-pr-catalog-select]').first().waitFor();assert.equal(await page.locator('[data-source=prestashop][data-action=pricing-source]').getAttribute('aria-pressed'),'true');
 assert.equal(new URL(page.url()).searchParams.get('module'),'precio');
 assert.equal(await page.locator('#master-tabs-bar').count(),0,'Precio does not embed the full product workspace');
 assert.equal(await page.locator('[data-pr-action=new-product],[data-pr-action=catalog-copy]').count(),0);
 assert.equal(await page.getByRole('button',{name:'Cambiar precio',exact:true}).count(),2);
 await page.locator('[data-pr-filter=category]').selectOption('10');await page.locator('[data-pr-catalog-all]').check();await page.getByRole('button',{name:'Ajustar precios seleccionados',exact:true}).click();await page.locator('dialog [name=value]').fill('15');await page.getByRole('button',{name:'Revisar lote',exact:true}).click();await page.getByText('Lote revisado sin escribir.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>connectedPriceQA.calls.filter(c=>c.action==='prestashop_product_commit').length),0);
 await page.getByRole('button',{name:'Publicar precios revisados',exact:true}).click();await page.locator('dialog').waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>connectedPriceQA.items.map(i=>i.price)),['15.000000','15.000000']);
 await page.locator('[data-pr-catalog-all]').check();await page.getByRole('button',{name:'Ajustar precios seleccionados',exact:true}).click();
 await page.locator('dialog select[name=field]').selectOption('wholesale_price');await page.locator('dialog select[name=mode]').selectOption('percent');await page.locator('dialog [name=value]').fill('25');await page.getByRole('button',{name:'Revisar lote',exact:true}).click();await page.getByText('Lote revisado sin escribir.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>connectedPriceQA.calls.filter(c=>c.action==='prestashop_product_commit').length),2,'Cost review performs no write');
 await page.getByRole('button',{name:'Publicar precios revisados',exact:true}).click();await page.locator('dialog').waitFor({state:'detached'});
 assert.deepEqual(await page.evaluate(()=>connectedPriceQA.items.map(i=>i.wholesale_price)),['5.000000','10.000000']);assert.deepEqual(await page.evaluate(()=>connectedPriceQA.items.map(i=>i.price)),['15.000000','15.000000'],'Cost batch preserves sale prices');
 assert(await page.evaluate(()=>connectedPriceQA.calls.filter(c=>c.action==='prestashop_product_commit').slice(2).every(c=>c.changes.every(change=>change.field==='wholesale_price'))));
 for(const width of [390,977,1440,1920]){await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.locator('.prd-columns>summary').click();const panel=page.locator('.prd-columns>div');await panel.waitFor({state:'visible'});const box=await panel.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);const geometry=await panel.locator('.tc-column-row').first().evaluate(row=>({width:row.scrollWidth-row.clientWidth,box:row.querySelector('[type=checkbox]').getBoundingClientRect().width,direction:getComputedStyle(row.querySelector('label')).flexDirection}));assert.equal(geometry.box,18);assert.equal(geometry.direction,'row');assert(geometry.width<=1);assert.equal(await panel.locator('.tc-settings-header').count(),1);await panel.screenshot({path:'artifacts/columns-catalog-'+width+'.png'});await page.locator('.prd-columns>summary').click();}
 await page.locator('[data-action=pricing-source][data-source=local]').click();await page.locator('#pricingQuery').waitFor();await page.getByRole('button',{name:'Nuevo estudio',exact:false}).waitFor();assert.equal(await page.locator('#productosRoot').count(),0);assert.deepEqual(errors,[]);console.log('CONNECTED PRICE: native catalog default, family filter, two-product native price write/readback, four widths, common columns and separate local studies PASS; fictional API only.');
}finally{await browser.close();await server?.close();}
