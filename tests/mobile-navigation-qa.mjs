import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({locale:'es-ES',viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const nav=async route=>page.locator('#nav [data-route="'+route+'"]').click();
const checkActiveTab=async section=>{
 const navBar=page.locator('#content .module-tabs');
 const active=navBar.locator('.tab.active');
 const visible=await active.evaluate(el=>{
  const t=el.getBoundingClientRect(),b=el.closest('.module-tabs').getBoundingClientRect();
  return {left:t.left,right:t.right,barLeft:b.left,barRight:b.right};
 });
 assert(visible.left>=visible.barLeft-3&&visible.right<=visible.barRight+3,
  'Subpestaña '+section+' activa pero oculta tras render: '+JSON.stringify(visible));
 assert(await page.locator('#content .tab-scroll-hint').isVisible(),'Falta la indicación de desplazamiento entre subpestañas');
};
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await nav('facturacion');
 await page.locator('[data-action="billing-section"][data-section="series"]').click();
 await checkActiveTab('series');
 await page.screenshot({path:'artifacts/layout_mobile_series_selected.png'});
 await page.locator('[data-action="billing-section"][data-section="clientes"]').click();
 await checkActiveTab('clientes');
 await nav('administracion');
 await page.locator('[data-action="admin-section"][data-section="backups"]').click();
 await checkActiveTab('backups');
 await page.screenshot({path:'artifacts/layout_mobile_backups_selected.png'});
 await page.locator('[data-action="admin-section"][data-section="log"]').click();
 await checkActiveTab('log');
 await nav('fiscalidad');
 await page.locator('#fiscalFrom').fill('2026-10-01');
 await page.locator('#fiscalTo').fill('2026-10-31');
 await page.locator('[data-action="fiscal-apply"]').click();
 const text=await page.locator('#content .date-selected-hint').innerText();
 assert(text.includes('01/10/2026')&&text.includes('31/10/2026'),'No se visualizan las fechas en formato español: '+text);
 assert(!errors.length,errors.join(' ; '));
 console.log('MOBILE NAV QA: activos Series, Clientes, Copias y Log visibles; formato fechas DD/MM/AAAA OK');
}finally{await browser.close()}
