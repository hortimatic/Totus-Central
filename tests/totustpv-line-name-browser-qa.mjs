import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{fixture.workspace.dispose();const {createLineNameEditor}=await import('/src/totustpv/line-name.js');window.editor=createLineNameEditor();window.openName=options=>{window.result='pending';editor.choose(options).then(value=>window.result=value);};});
 await page.evaluate(()=>openName({name:'Artículo "especial"',originalName:'Original <img src=x onerror=alert(1)>'}));
 const dialog=page.getByRole('dialog'),input=dialog.getByRole('textbox');await dialog.waitFor();assert.equal(await input.inputValue(),'Artículo "especial"');assert.equal(await dialog.locator('img').count(),0);
 await input.fill('Nombre <no válido>');await dialog.getByRole('button',{name:'Guardar nombre',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>result),'pending');
 await input.fill('Preparado del cliente 🙂');await dialog.getByRole('button',{name:'Guardar nombre',exact:true}).click();assert.equal(await page.evaluate(()=>result),'Preparado del cliente 🙂');assert.equal(await dialog.count(),0);
 await page.evaluate(()=>openName({name:'Personalizado',originalName:'Catálogo'}));await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>result),null);
 await page.evaluate(()=>openName({name:'Personalizado',originalName:'Catálogo',canRename:false}));assert.equal(await dialog.getByRole('button',{name:'Guardar nombre',exact:true}).isDisabled(),true);assert.equal(await input.getAttribute('readonly'),'');
 const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Dialog must fit the mobile viewport');
 await dialog.getByRole('button',{name:'Usar nombre del catálogo',exact:true}).click();assert.equal(await page.evaluate(()=>result),'');
 await page.evaluate(()=>{openName({name:'Personalizado',originalName:'Catálogo'});editor.cancel();});assert.equal(await page.evaluate(()=>result),null);
 await page.evaluate(async()=>{
  const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');window.namesFixture={preferences:{lineOptions:{allowNameChanges:true}},quotes:[]};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'store',name:'Caja ficticia',canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[{id:'11:0',nativeProductId:11,name:'Artículo original',stock:6,priceCents:801,temporaryLineNames:true}],quote:async payload=>{namesFixture.quotes.push(structuredClone(payload));return {id:'name-quote',currency:'EUR',totalCents:801,quoteExpiresAt:Date.now()+120000,paymentMethods:['cash']};}};
  namesFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,workspacePreferences:async(drawer,value)=>{if(value)namesFixture.preferences=structuredClone(value);return structuredClone(namesFixture.preferences);}});namesFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('[data-tpv-add="11:0"]').click();if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();
 const ticket=page.locator('.tpv-ticket-lines');await page.locator('[data-tpv-line-name="11:0"]').click();await dialog.getByRole('textbox').fill('Preparado especial 🙂');await dialog.getByRole('button',{name:'Guardar nombre',exact:true}).click();assert.ok((await ticket.innerText()).includes('Preparado especial 🙂'));
 await page.locator('[data-tpv-line-name="11:0"]').click();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.ok((await ticket.innerText()).includes('Preparado especial 🙂'));
 await page.locator('[data-tpv-line-name="11:0"]').click();await dialog.getByRole('button',{name:'Usar nombre del catálogo',exact:true}).click();assert.ok((await ticket.innerText()).includes('Artículo original'));assert.equal((await ticket.innerText()).includes('Preparado especial 🙂'),false);
 await page.evaluate(()=>namesFixture.workspace.dispose());assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS temporary-name dialog: desktop/mobile, escaping, validation, save, Escape, read-only restoration and cancellation on workspace cleanup.');
}finally{await browser.close();await server.close();}
