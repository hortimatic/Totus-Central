import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {navigate} from './ui-navigation.mjs';
const browser=await chromium.launch({headless:true}),errors=[];
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=proveedores',{waitUntil:'networkidle'});
  await page.locator('#pageTitle').filter({hasText:'Proveedores'}).waitFor();
  for(const [route,title] of [['clientes','Clientes'],['marcas','Marcas'],['proveedores','Proveedores']]){
   await navigate(page,route);await page.locator('#pageTitle').filter({hasText:title}).waitFor();
   assert.equal(await page.locator('#content').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,route+' fits '+width);
  }
  await navigate(page,'configuracion');
  for(const [key,label] of [['appearance','Interfaz'],['login','Login'],['connections','APIs']]){
   const tab=page.locator('[data-config-section='+key+']');assert.equal(await tab.innerText(),label);await tab.click();
   assert.equal(await tab.getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#appearanceRoot').isVisible(),key!=='connections');
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('CONTACTS SETTINGS QA: three shared directory routes, 390/1440 layout, three settings tabs.');
}finally{await browser.close();}
