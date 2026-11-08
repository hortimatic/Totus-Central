import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||'msedge'}),report=[];
try{for(const width of [390,680,1200]){
 const page=await browser.newPage({viewport:{width,height:660},hasTouch:true});
 await page.route('https://hortimatic.com/**/product.jpg',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=','base64')}));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/productos.css'});
 await page.evaluate(async()=>{document.querySelector('#chatHarness').innerHTML='<section id="productosRoot"><div class="prd-stitch"><img class="prd-thumb" src="https://hortimatic.com/14838-home_default/product.jpg" alt="Muestra de producto"></div></section>';const {attachProductPhotoPreviews}=await import('../src/productos-photo-preview.js');window.stopProductPhotos=attachProductPhotoPreviews(document.querySelector('#productosRoot'));});
 const button=page.getByRole('button',{name:'Ampliar imagen de Muestra de producto',exact:true});
 assert.equal(await button.locator('img').evaluate(n=>n.getBoundingClientRect().width),68);
 await button.hover();await page.getByRole('tooltip').waitFor();assert.equal(await page.locator('.prd-photo-peek img').getAttribute('src'),'https://hortimatic.com/14838-large_default/product.jpg');
 const r=await page.getByRole('tooltip').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=660);
 await page.mouse.move(width-1,659);assert.equal(await page.getByRole('tooltip').count(),0);
 await button.focus();await page.getByRole('tooltip').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);
 await button.tap();await page.getByRole('dialog',{name:'Muestra de producto',exact:true}).waitFor();assert.equal(await page.getByRole('tooltip').count(),0);
 await page.getByRole('button',{name:'Cerrar imagen',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('tooltip').count(),0);
 await page.evaluate(()=>stopProductPhotos());await button.hover();assert.equal(await page.getByRole('tooltip').count(),0);
 report.push({width,passed:['recognizable_photo_68px','hover_zoom','viewport_bounds','keyboard_focus_escape','touch_zoom_close','cleanup']});await page.close();
}}finally{await browser.close();await server?.close();await mkdir('qa-artifacts',{recursive:true});await writeFile('qa-artifacts/productos-photo-preview-report.json',JSON.stringify(report,null,2));}
console.log('Product photos: recognizable size, hover/focus zoom, Escape, touch dialog and cleanup at 390/680/1200 PASS; fixture images.');
