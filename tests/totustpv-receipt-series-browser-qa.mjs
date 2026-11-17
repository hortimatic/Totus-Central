import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
import {mkdir} from 'node:fs/promises';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
await mkdir('artifacts/receipt-series',{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');window.seriesFixture={value:{enabled:false,salePrefix:'V',returnPrefix:'D',lastSaleNumber:40,lastReturnNumber:8},writes:[]};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'store',name:'Caja ficticia',canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[]};
  seriesFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,workspacePreferences:async()=>({}),receiptNumbering:async(drawer,value)=>{if(value){seriesFixture.writes.push(structuredClone(value));seriesFixture.value=structuredClone(value);}return structuredClone(seriesFixture.value);}});seriesFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 const form=page.locator('[data-tpv-form="receipt-series"]');await form.waitFor();assert.equal(await form.locator('[name=series-lastSaleNumber]').inputValue(),'40');
 await form.locator('[name=series-enabled]').check();await form.locator('[name=series-salePrefix]').fill('<bad>');await form.locator('[name=series-lastSaleNumber]').fill('100');await form.getByRole('button',{name:'Guardar numeración',exact:true}).click();await page.getByText('Usa un prefijo de hasta 12 letras, números o símbolos / _ -.',{exact:true}).waitFor();
 assert.equal(await form.locator('[name=series-salePrefix]').inputValue(),'<bad>');assert.equal(await form.locator('[name=series-enabled]').isChecked(),true);assert.equal(await page.evaluate(()=>seriesFixture.writes.length),0);
 await form.locator('[name=series-enabled]').check();await form.locator('[name=series-salePrefix]').fill('V-');await form.locator('[name=series-lastSaleNumber]').fill('100');await form.getByRole('button',{name:'Guardar numeración',exact:true}).click();await page.getByText('Numeración guardada para este establecimiento.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>seriesFixture.writes),[{enabled:true,salePrefix:'V-',returnPrefix:'D',lastSaleNumber:100,lastReturnNumber:8}]);assert.equal(await form.locator('[name=series-lastSaleNumber]').inputValue(),'100');
 await page.getByRole('button',{name:'Venta',exact:true}).click();await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();assert.equal(await form.locator('[name=series-salePrefix]').inputValue(),'V-');
 await form.screenshot({path:`artifacts/receipt-series/settings-${width}.png`});
 assert.deepEqual(errors,[]);await page.evaluate(()=>seriesFixture.workspace.dispose());await page.close();
 }console.log('PASS receipt numbering settings: desktop/mobile, shared-station DTO, explicit save, typed counters and settings reentry. Synthetic server only.');
}finally{await browser.close();await server.close();}
