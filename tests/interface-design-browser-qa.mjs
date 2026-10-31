import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html');
 await page.locator('[data-account-open]').waitFor();
 await page.locator('[data-account-open]').click();
 await page.locator('[name=display_name]').fill('Perfil de prueba');
 await page.locator('[data-account-tab=avisos]').click();
 await page.locator('[data-confirm=cancel]').click();
 assert.equal(await page.locator('[name=display_name]').inputValue(),'Perfil de prueba');
 await page.locator('[data-account-form] button[type=submit]').click();
 await page.locator('[data-account-panel]').waitFor({state:'detached'});
 await page.locator('.toast').waitFor({state:'detached'});
 assert.equal(await page.locator('.account-trigger-text b').textContent(),'Perfil de prueba');
 await page.locator('[data-account-open]').click();
 assert.equal(await page.locator('[name=display_name]').inputValue(),'Perfil de prueba');
 await page.locator('.close-btn').click();
 await page.evaluate(()=>{
  const db=window.__mockDb,store=db.ops_stores[0],id=crypto.randomUUID(),date=new Date().toISOString().slice(0,10);
  db.ops_daily_closings.push({id,store_id:store.id,business_date:date,status:'cerrado',opening_cash:250,actual_cash:250,card_sales:2450,cash_sales:1140.5,cash_withdrawals:1140.5,cash_expenses_declared:0,bizum_sales:0,online_sales:0,other_income:0,difference:0,reported_total_sales:3590.5,notes:'Cierre ficticio para diseño'});
  for(const [index,drawer] of db.ops_cash_drawers.filter(d=>d.store_id===store.id).entries())db.ops_daily_closing_drawers.push({id:crypto.randomUUID(),closing_id:id,drawer_id:drawer.id,opening_cash:index?100:150,closing_cash:index?100:150,card_sales:index?800:1650,cash_withdrawals:index?290.5:850,cash_expenses_declared:0,cash_extra_in:0,cash_extra_out:0});
 });
 await page.locator('#nav [data-route=cajas]').click();
 await fs.mkdir('artifacts/interface-design',{recursive:true});
 for(const width of [1920,1440,1024,768,430,390,320]){
  await page.setViewportSize({width,height:950});
  if(width<=800){
   assert.equal(await page.locator('.sidebar').evaluate(el=>el.inert),true);
   await page.locator('[data-action=toggle-menu]').click();
   assert.equal(await page.locator('[data-action=toggle-menu]').getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('#nav [data-route]').count(),13,'All existing modules remain accessible');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.sidebar').evaluate(el=>el.inert),true);
  }
  if(width<=700){
   assert.equal(await page.locator('.mobile-card-table td[data-label]').count(),6,'All six original columns remain available');
   await page.locator('[data-action=toggle-closing-breakdown]').click();
   assert.equal(await page.locator('td[data-label="Dinero de cada caja"]').isVisible(),true);
   await page.locator('[data-action=toggle-closing-breakdown]').click();
   assert.equal(await page.locator('td[data-label="Dinero de cada caja"]').isVisible(),false);
   assert.equal(await page.locator('#closingFilters').isVisible(),false);
   await page.locator('[data-action=toggle-mobile-filters]').click();
   assert.equal(await page.locator('#closingFilters').isVisible(),true);
   assert.equal(await page.locator('#cajasFrom').isVisible(),true);
   await page.locator('[data-action=toggle-mobile-filters]').click();
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  if(overflow){console.log('Overflow',width,await page.locator('body *').evaluateAll(elements=>elements.filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(el).visibility!=='hidden';}).slice(0,12).map(el=>({tag:el.tagName,classes:el.className,right:el.getBoundingClientRect().right}))));await page.screenshot({path:'artifacts/interface-design/overflow-'+width+'.png',fullPage:true});}
  assert.equal(overflow,false,'Page overflow at '+width);
  await page.screenshot({path:'artifacts/interface-design/cajas-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-account-open]').click();
 assert.equal(await page.locator('[name=display_name]').inputValue(),'Perfil de prueba');
 assert.equal(await page.locator('[name=phone]').isVisible(),true);
 await page.screenshot({path:'artifacts/interface-design/cuenta-390.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Interfaz: perfil, protección de borrador, reapertura, navegación completa, filtros y siete anchuras OK.');
}finally{await browser.close();}
