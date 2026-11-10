import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';

const server=await startLocalServer(),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960},locale:'es-ES'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('.dashboard-page #homePrestashopSummary').waitFor({timeout:25000});
 const original=page.locator('.dashboard-page');
 assert.equal(await original.locator('.dashboard-hero').count(),1,'Cabecera original');
 assert.equal(await original.locator('.opening-panel').count(),1,'Cajas originales intactas');
 assert.equal(await original.locator('.home-period-kpis > .kpi').count(),4,'Cuatro KPIs originales intactos');
 assert.equal(await original.locator('.home-activity svg').count(),1,'Gráfica original intacta');
 assert((await original.locator('.home-zone').count())>=4,'Todos los grupos operativos originales');
 assert.equal(await original.locator('.dashboard-hero [data-action="closing-new"]').count(),1,'Nuevo cierre original intacto');
 assert.equal(await original.locator('.dashboard-hero [data-action="expense-new"]').count(),1,'Registrar gasto intacto');
 assert.equal(await original.locator('.dashboard-hero [data-action="invoice-new"]').count(),1,'Nueva factura intacta');
 assert.equal(await original.locator('.dashboard-hero [data-action="document-new"]').count(),1,'Subir documento intacto');
 assert.equal(await original.locator('.home-dashboard-toolbar').count(),0,'Editor y gran barra modular retirados');
 assert.equal(await original.locator('.home-widgets-drawer').count(),0,'Biblioteca modular retirada');
 assert.equal(await original.locator('[data-home-type="prestashop.summary"]').count(),2,'Resumen independiente por tienda');
 assert.equal(await original.locator('[data-home-type="prestashop.orders"]').count(),1,'Tabla de pedidos conservada');
 assert.equal(await original.locator('[data-home-type="prestashop.top"]').count(),1,'Más vendidos conservado');
 assert.equal(await original.locator('[data-home-type="prestashop.quality"]').count(),1,'Calidad del catálogo conservada');
 assert.equal(await original.locator('.home-prestashop-more').evaluate(el=>el.open),false,'Consultas extensas plegadas por defecto');
 assert.equal(await original.locator('.home-legacy-prestashop .home-widget-more:visible').count(),0,'Sin controles inútiles de edición');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Sin scroll horizontal de la página a '+width);
 }
 assert.deepEqual(errors,[],'Sin errores Javascript');
 console.log('INICIO ORIGINAL RESTORED PASS: cajas, KPIs, gráfica, acciones y PrestaShop conservados');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve))}
