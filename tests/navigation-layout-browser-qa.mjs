import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
const localServer=await startLocalServer();
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 for(const width of [390,1017]){
  const page=await browser.newPage({viewport:{width,height:850}});await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
  await page.evaluate(async()=>{
   const {createAppearanceUI}=await import('../src/appearance-ui.js');document.querySelector('#chatHarness').innerHTML='<div id="appearanceRoot"></div>';
   const q=window.navQA={actor:'one',config:{},revision:0,saves:[]};q.panel=createAppearanceUI({actor:()=>q.actor,canEdit:()=>true,confirm:async()=>true,settings:()=>({appearance_config:q.config,appearance_revision:q.revision}),save:async(section,config,revision)=>{if(revision!==q.revision)throw Error('Cambio concurrente');q.config=structuredClone(config);q.revision++;q.saves.push(config);}});q.panel.mount(document.querySelector('#appearanceRoot'));
  });
  await page.locator('[data-nav-row=cajas] [data-nav-move="-1"]').click();
  assert.match(await page.locator('[name=navigationOrder]').inputValue(),/cajas,pricing/);
  await page.locator('[data-nav-row=cajas] [data-nav-edge=last]').click();
  const endOfGroup=await page.locator('[data-nav-row][data-nav-group="Operaciones tienda"]').last().getAttribute('data-nav-row');
  assert.equal(endOfGroup,'cajas','One-click move to end remains inside section');
  await page.locator('[data-nav-row=cajas] [data-nav-edge=first]').click();
  const startOfGroup=await page.locator('[data-nav-row][data-nav-group="Operaciones tienda"]').first().getAttribute('data-nav-row');
  assert.equal(startOfGroup,'cajas','One-click move to start remains inside section');
  await page.locator('[data-nav-collapsed=operations]').check();await page.locator('[name=navigationBackground]').fill('#102030');
  await page.getByRole('button',{name:'Aplicar y guardar mi interfaz',exact:true}).click();await page.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>navQA.config.navigationCollapsed),'operations');assert.equal(await page.evaluate(()=>navQA.config.navigationBackground),'#102030');
  await page.evaluate(()=>navQA.panel.mount(document.querySelector('#appearanceRoot')));assert.equal(await page.locator('[data-nav-collapsed=operations]').isChecked(),true);assert.match(await page.locator('[name=navigationOrder]').inputValue(),/cajas,pricing/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.close();
 }
 console.log('Personal navigation: reorder, collapse, colors, save/reload on 390/1017px passed');
}finally{await browser.close();if(localServer)await new Promise(r=>localServer.close(r));}
