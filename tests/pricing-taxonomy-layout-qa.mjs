import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1536,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const db=window.__mockDb;
  db.brands=[{id:'qa-brand-1',name:'DEMO Sales'},{id:'qa-brand-2',name:'OXVA'},{id:'qa-brand-3',name:'Marca de prueba con un nombre especialmente largo para comprobar el ajuste'}];
  db.families=[{id:'qa-family-1',brand_id:'qa-brand-1',name:'Sales 10 ml',category:'General',default_margin:35},{id:'qa-family-2',brand_id:'qa-brand-2',name:'XLIM',category:'General',default_margin:35},{id:'qa-family-3',brand_id:'qa-brand-3',name:'Familia con un nombre largo que debe ajustarse sin pisar las acciones',category:'General',default_margin:35}];
  const {loadCore}=await import('../src/api.js');await loadCore();
 });
 await page.locator('#nav [data-route="pricing"]').click();
 const open=()=>page.locator('[data-action="families-manage"]').click();
 await open();
 for(const width of [1920,1536,1280,1024,900,800,768,390,320]){
  await page.setViewportSize({width,height:1000});
  const geometry=await page.locator('.pricing-taxonomy').evaluate(el=>{
   const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,width:r.width,height:r.height}};
   const panels=[...el.children].map(box),modal=el.closest('.modal');
   return {panels,modal:box(modal),overflow:modal.scrollWidth-modal.clientWidth,
    buttons:[...el.querySelectorAll('button')].map(b=>({text:b.textContent,box:box(b),overflow:b.scrollWidth-b.clientWidth,wrap:getComputedStyle(b).whiteSpace})),
    rows:[...el.querySelectorAll('.summary-row')].map(row=>({label:box(row.firstElementChild),actions:box(row.querySelector('.inline-actions'))}))};
  });
  assert(geometry.modal.left>=0&&geometry.modal.right<=width+1,'Dialog stays inside viewport '+width);
  assert(geometry.overflow<=1,'No horizontal dialog overflow '+width);
  if(width>800){
   assert(Math.abs(geometry.panels[0].width-geometry.panels[1].width)<2,'Balanced columns '+width);
   assert(Math.abs(geometry.panels[0].top-geometry.panels[1].top)<2);
  }else assert(geometry.panels[1].top>geometry.panels[0].top,'Stack sections on small screens '+width);
  for(const b of geometry.buttons){assert(b.overflow<=1,'No clipped '+b.text+' at '+width);assert.equal(b.wrap,'nowrap');assert(b.box.height<45,'Compact one-line button at '+width)}
  for(const row of geometry.rows)assert(row.label.right<=row.actions.left+1||row.label.top+row.label.height<=row.actions.top+1,'Names and actions never overlap '+width);
  if(width===1536||width===390)await page.screenshot({path:'artifacts/review_pricing_taxonomy_'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1536,height:1000});
 await page.locator('.pricing-taxonomy [data-action="brand-edit"]').first().click();await page.locator('#brName').waitFor();
 await page.locator('#modalHost .close-btn').click();await open();
 await page.locator('.pricing-taxonomy [data-action="family-edit"]').first().click();await page.locator('#fmName').waitFor();
 await page.locator('#modalHost .close-btn').click();await open();
 await page.locator('[data-action="brand-new"]').click();await page.locator('#brName').waitFor();
 await page.locator('#modalHost .close-btn').click();await open();
 await page.locator('[data-action="family-new"]').click();await page.locator('#fmName').waitFor();
 assert.deepEqual(await page.evaluate(()=>[window.__mockDb.brands.length,window.__mockDb.families.length]),[3,3],'No data changed by visual review');
 assert.deepEqual(errors,[]);
 console.log('PRICING TAXONOMY: balanced columns, nonwrapping compact buttons, long names, stacked mobile layout and unchanged edit/create controls across nine widths.');
}finally{await browser.close()}
