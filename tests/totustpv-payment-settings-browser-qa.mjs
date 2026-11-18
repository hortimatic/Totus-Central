import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
  const actor=crypto.randomUUID(),connection=crypto.randomUUID(),store=crypto.randomUUID();
  window.paymentBoxes=[crypto.randomUUID(),crypto.randomUUID()];window.paymentSaved=[];window.paymentConfirm=false;window.paymentPrompts=[];
  const rows=paymentBoxes.map((id,index)=>({environment:'qa',connectionId:connection,connectionRevision:1,storeId:store,storeName:'Tienda ficticia',drawerId:id,drawerName:'Caja '+(index+1),shopId:1,session:null,canSell:true,canOpen:true,canReconcile:true}));
  const saved=Object.fromEntries(paymentBoxes.map((id,index)=>[id,{revision:0,options:{enabledMethods:['cash','card'],labels:{cash:'Efectivo caja '+(index+1),card:'Tarjeta'}}}]));
  window.paymentWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Operador ficticio'}),can:()=>true,canAssign:()=>true,autoOpen:true,
   confirm:async message=>{paymentPrompts.push(message);return paymentConfirm;},createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async input=>{
    if(input.action==='context')return {actorId:actor,workstations:rows};
    if(input.action==='categories')return {categories:[],has_more:false};
    if(input.action==='payment-options'){const id=input.selection.drawerId;if(input.settings){paymentSaved.push({id,settings:input.settings});saved[id]={revision:saved[id].revision+1,options:input.settings};}return structuredClone(saved[id]);}
    throw Error('Unexpected fixture action '+input.action);
   }})});paymentWorkspace.mount(document.querySelector('#tpv'));
 });
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 const form=page.locator('[data-tpv-form="payment-settings"]'),label=form.locator('[name="label:cash"]');
 await label.fill('Borrador solo caja uno');const boxes=await page.evaluate(()=>paymentBoxes);
 await page.locator('[data-tpv-drawer]').selectOption(boxes[1]);
 await page.waitForFunction(()=>paymentPrompts.length===1);
 assert.equal(await page.locator('[data-tpv-drawer]').inputValue(),boxes[0]);assert.equal(await label.inputValue(),'Borrador solo caja uno');
 await page.evaluate(()=>{paymentConfirm=true;});await page.locator('[data-tpv-drawer]').selectOption(boxes[1]);
 await page.waitForFunction(()=>document.querySelector('[name="label:cash"]')?.value==='Efectivo caja 2');
 assert.deepEqual(await page.evaluate(()=>paymentSaved),[]);
 await form.getByRole('button',{name:'Guardar medios de cobro'}).click();await page.getByText('Medios de cobro guardados para esta caja.',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>paymentSaved);assert.equal(saved.length,1);assert.equal(saved[0].id,boxes[1]);assert.equal(saved[0].settings.labels.cash,'Efectivo caja 2');
 await mkdir('artifacts/totustpv-payment-settings',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:950});await form.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await form.screenshot({path:`artifacts/totustpv-payment-settings/drawer-form-${width}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS drawer payment settings UI: cancelled switch retains draft and drawer; accepted switch discards only old drawer draft; save targets new drawer, desktop/mobile form. Synthetic fixtures only.');
}finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
