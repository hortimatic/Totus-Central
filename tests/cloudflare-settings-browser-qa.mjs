import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=configuracion',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'APIs y conexiones',exact:true}).click();const panel=page.locator('[data-cloudflare-config]');await panel.locator('form').waitFor({state:'visible'});
 await panel.locator('[name=account_id]').fill('a'.repeat(32));await panel.locator('[name=token]').fill('fictional-private-token-12345');await panel.locator('[name=free_plan_confirmed]').check();await panel.getByRole('button',{name:'Guardar conexión privada',exact:true}).click();await panel.locator('[data-cf-state]').filter({hasText:'guardada'}).waitFor();assert.equal(await panel.locator('[name=token]').inputValue(),'');await panel.getByRole('button',{name:'Probar conexión ficticia'}).click();await panel.locator('[data-cf-state]').filter({hasText:'comprobada'}).waitFor();
 await page.getByRole('button',{name:'Interfaz y Login',exact:true}).click();await page.getByRole('button',{name:'APIs y conexiones',exact:true}).click();assert.equal(await panel.locator('[name=account_id]').inputValue(),'a'.repeat(32));assert.equal(await panel.locator('[name=token]').inputValue(),'');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.locator('#content').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,'fits '+width);}
 assert.deepEqual(errors,[]);console.log('Cloudflare settings: save, test, private-key clearing, remount persistence, responsive sizes, no page errors.');
}finally{await browser.close();}
