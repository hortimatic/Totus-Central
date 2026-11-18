import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-barcode-panel.html');
 await page.getByRole('button',{name:'Preparar lista',exact:true}).click();
 await page.getByRole('heading',{name:'Lista para revisar'}).waitFor();assert.equal(await page.locator('tbody tr').count(),50);
 assert.equal(await page.locator('tbody img').count(),0);assert.equal(await page.getByRole('button',{name:'Generar códigos',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),25);
 await page.getByRole('button',{name:'Anterior',exact:true}).click();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`artifacts/barcode-review-${width}.png`,fullPage:true});
 }
 await page.locator('[data-tpv-barcode-accepted]').check();await page.getByRole('button',{name:'Generar códigos',exact:true}).click();
 await page.getByText('Hay resultados pendientes de comprobar.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Pausar',exact:true}).click();await page.getByRole('heading',{name:'En pausa'}).waitFor();
 await page.getByRole('button',{name:'Cancelar trabajo',exact:true}).click();await page.getByRole('heading',{name:'Cancelado'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS barcode panel: 75-target review/pagination, explicit confirmation, uncertain recovery wording, pause/cancel, escaping and no page overflow at1440/390; synthetic fixture.');
}finally{await browser.close();await server.close();}
