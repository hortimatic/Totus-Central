import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true,port:0}),browser=await chromium.launch({headless:true});
try{
 await mkdir('qa-artifacts/budget-presentation',{recursive:true});
 for(const width of [1440,390,360]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/totustpv-workspace.html`);
  await page.evaluate(async()=>{
   fixture.workspace.dispose();const {budgetDocumentHtml}=await import('/src/totustpv/budget-document.js');
   window.savedBudget={reference:'PROP-000043',title:'Propuesta para el cliente',status:'saved',storeName:'Comercio de prueba',createdAt:'2026-11-19T10:00:00Z',validUntil:'2026-12-19T10:00:00Z',publicNote:'Recogida en tienda.\nConfirma la disponibilidad antes de venir.',snapshot:{currency:'EUR',totalCents:12345,totalTaxExclCents:10202,shippingCents:789,discountCents:456,merchant:{name:'Comercio de prueba',address:'Calle del Ejemplo, 43',phone:'900000000'},customer:{name:'Cliente <ejemplo>',address:'Dirección de prueba'},lines:[{name:'Producto con un nombre largo y una variante de color para comprobar la distribución',qty:3,unitTaxInclMicros:12345678,lineTaxInclCents:3704}]} };
   window.savedBudgetBefore=JSON.stringify(savedBudget);window.renderBudget=hidePrices=>document.querySelector('#tpv').innerHTML='<section class="card card-pad tpv-budget-detail">'+budgetDocumentHtml({...savedBudget,presentation:{hidePrices}})+'</section>';
   renderBudget(true);
  });
  const document=page.getByRole('article',{name:'Documento del presupuesto'});
  assert.equal(await document.getByRole('columnheader',{name:'Cantidad',exact:true}).count(),1);
  const hidden=await document.innerText();assert.ok(hidden.includes('PROP-000043'));assert.ok(hidden.includes('Cliente <ejemplo>'));assert.ok(hidden.includes('Documento presentado sin precios.'));
  for(const value of ['123,45','102,02','21,43','7,89','4,56','12,345678','37,04','€'])assert.equal(hidden.includes(value),false,value);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(savedBudget)===savedBudgetBefore),true);
  await page.screenshot({path:`qa-artifacts/budget-presentation/hidden-${width}.png`,fullPage:true});
  await page.emulateMedia({media:'print'});assert.equal((await document.innerText()).includes('€'),false);await page.screenshot({path:`qa-artifacts/budget-presentation/print-hidden-${width}.png`,fullPage:true});
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>renderBudget(false));assert.ok((await document.innerText()).includes('123,45'));assert.equal(await page.evaluate(()=>JSON.stringify(savedBudget)===savedBudgetBefore),true);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS budget presentation browser: three widths, saved quantity/reference/contact text retained and escaped, monetary fields absent in screen and simulated print, no horizontal overflow, visible-price legacy document restored without changing saved data. No persistence or numbering backend certified.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
