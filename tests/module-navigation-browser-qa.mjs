import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:850}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/tests/mock-supabase.js',async route=>{
   const response=await route.fetch();let source=await response.text();
   const needle='then(ok,fail){return Promise.resolve(databaseResult(this.result())).then(ok,fail)}';assert(source.includes(needle));
   source=source.replace(needle,`then(ok,fail){
    if(this.table==='products'&&window.__navFailure)return Promise.resolve({data:null,error:{message:'Fallo de actualización ficticio'}}).then(ok,fail);
    if(this.table==='products'&&window.__navDelay)return window.__navGate.then(()=>Promise.resolve(databaseResult(this.result())).then(ok,fail));
    return Promise.resolve(databaseResult(this.result())).then(ok,fail);
   }`);await route.fulfill({response,body:source});
  });
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=cajas',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#pageTitle').innerText(),'Cajas');
  const nav=route=>page.locator('#nav [data-route="'+route+'"]');
  const href=await nav('gastos').getAttribute('href');assert.equal(new URL(href).searchParams.get('module'),'gastos');
  const other=await browser.newPage({viewport:{width,height:850}});await other.goto(href,{waitUntil:'networkidle'});assert.equal(await other.locator('#pageTitle').innerText(),'Gastos');assert.equal(await page.locator('#pageTitle').innerText(),'Cajas');await other.close();
  await page.evaluate(()=>{window.__mockDb.products.push({id:'nav-product-qa',name:'Actualizado desde otra sesión',type:'simple',active:true,updated_at:'2026-10-31T00:00:00Z'});});
  await nav('pricing').click();await page.getByText('Actualizado desde otra sesión',{exact:true}).waitFor();
  await page.locator('#pricingQuery').fill('Actualizado');await page.locator('#pricingQuery').press('Enter');
  await nav('cajas').click();await page.locator('#pageTitle').filter({hasText:'Cajas'}).waitFor();
  await nav('pricing').click();await page.locator('#pricingQuery').waitFor();assert.equal(await page.locator('#pricingQuery').inputValue(),'Actualizado');
  await nav('cajas').click();await page.locator('#pageTitle').filter({hasText:'Cajas'}).waitFor();
  await page.evaluate(()=>{window.__navDelay=true;window.__navGate=new Promise(resolve=>window.__navRelease=resolve);});
  await nav('pricing').click();await page.getByRole('status').filter({hasText:'Actualizando datos'}).waitFor();
  await nav('gastos').click();await page.locator('[data-action="expense-new"]').waitFor();
  await page.evaluate(()=>{window.__navDelay=false;window.__navRelease();});
  await page.waitForTimeout(100);assert.equal(await page.locator('#pageTitle').innerText(),'Gastos');
  await page.evaluate(()=>window.__navFailure=true);await nav('pricing').click();await page.getByRole('heading',{name:'No se han podido actualizar los datos',exact:true}).waitFor();
  await page.evaluate(()=>window.__navFailure=false);await page.locator('[data-action="retry-module"]').click();await page.locator('#pricingQuery').waitFor();
  assert.equal(await page.locator('#pricingQuery').inputValue(),'Actualizado');
  await nav('cajas').click();await page.locator('[data-action="closing-new"]').first().click();
  await page.locator('#clNotes').fill('Borrador que debe conservarse');
  await nav('gastos').click();await page.getByRole('heading',{name:'Cambios sin guardar',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await page.locator('#clNotes').inputValue(),'Borrador que debe conservarse');
  assert.equal(new URL(page.url()).searchParams.get('module'),'cajas');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Navigation layout must fit');
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('MODULE NAVIGATION BROWSER QA: desktop/mobile, parallel tabs, fresh data, filters, delayed response isolation and retry');
}finally{await browser.close();}
