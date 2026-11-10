import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'es-ES'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
function luminance(css){
 const rgb=String(css).match(/[\d.]+/g)?.slice(0,3).map(Number)||[0,0,0];
 return rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
}
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('[data-home-widget="opening"]').waitFor({timeout:30000});
 await page.evaluate(async()=>{
  const [{applyInterfaceAppearance},{APPEARANCE_PRESETS}]=await Promise.all([
   import('../src/appearance-ui.js'),import('../src/appearance-core.js')
  ]);
  applyInterfaceAppearance(APPEARANCE_PRESETS.newoldsmok);
 });
 const colors=await page.locator('[data-home-widget="income"]').evaluate(el=>{
  const style=getComputedStyle(el),heading=el.querySelector('.home-widget-header h3');
  return {bg:style.backgroundColor,ink:getComputedStyle(heading).color};
 });
 const a=luminance(colors.bg),b=luminance(colors.ink),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 assert(contrast>=4.5,'Las etiquetas mantienen contraste AA en Mi interfaz oscuro: '+contrast);
 assert.equal(await page.locator('html').getAttribute('data-appearance'),'dark','El Inicio hereda el tema oscuro real');
 fs.mkdirSync('qa-artifacts/inicio',{recursive:true});
 await page.screenshot({path:'qa-artifacts/inicio/mi-interfaz-oscuro-1440.png',fullPage:true});
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Tema oscuro sin overflow a '+width+' px');
  if(width===390)await page.screenshot({path:'qa-artifacts/inicio/mi-interfaz-oscuro-movil-390.png',fullPage:true});
 }
 assert.deepEqual(errors,[],'Sin errores JS al cambiar Mi interfaz en Inicio');
 console.log('INICIO APARIENCIA PASS: tema oscuro real, contraste texto, 3 anchos y capturas');
}finally{
 await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
}