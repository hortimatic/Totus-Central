import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer(),browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:1000},isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'es-ES'});
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('.opening-panel').waitFor({timeout:25000});
 await page.locator('[data-home-widget="shop-h"]').waitFor({timeout:25000});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.locator('.home-period-kpis > .kpi').count(),4,'Mantiene los KPIs originales en móvil');
  assert.equal(await page.locator('.home-activity svg').count(),1,'Mantiene gráfica del periodo');
  assert.equal(await page.locator('.home-dashboard-toolbar').count(),0,'No existe editor modular');
  assert.equal(await page.locator('.home-prestashop-overview [data-home-type="prestashop.summary"]').count(),2,'Ambas tiendas disponibles');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Sin scroll horizontal general a '+width);
 }
 await page.locator('.home-prestashop-more > summary').click();
 assert.equal(await page.locator('.home-prestashop-more').evaluate(el=>el.open),true,'Detalles accesibles con tacto');
 assert.equal(await page.locator('[data-home-type="prestashop.orders"]').count(),1,'Consulta de pedidos accesible');
 assert.equal(await page.locator('[data-home-type="prestashop.top"]').count(),1,'Más vendidos accesible');
 assert.equal(await page.locator('[data-home-type="prestashop.quality"]').count(),1,'Calidad accesible');
 assert.deepEqual(errors,[],'Sin errores Javascript en teléfono táctil');
 console.log('INICIO ORIGINAL MOBILE PASS: toda la operativa y PrestaShop sin drag ni editor');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve))}
