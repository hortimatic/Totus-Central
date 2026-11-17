import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  window.variantFixture={queries:[],fail:true};
  const parent={id:'12:0',nativeProductId:12,name:'Camiseta ficticia',chooseVariant:true,stock:2,priceCents:1000};
  const variants=[{id:'12:1',nativeProductId:12,name:'Camiseta roja',stock:2,priceCents:1000,variantAttributes:[{id:1,groupId:3,name:'Rojo',groupName:'Color'}]},
   {id:'12:2',nativeProductId:12,name:'Camiseta amarilla',stock:0,priceCents:1200,variantAttributes:[{id:2,groupId:3,name:'Amarillo',groupName:'Color'}]}];
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'store',name:'Caja ficticia',canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],
   searchProducts:async query=>{variantFixture.queries.push(structuredClone(query));if(query.productId&&variantFixture.fail){variantFixture.fail=false;throw Error('No se han podido consultar las variantes. Vuelve a intentarlo.');}
    const rows=structuredClone(query.productId?variants:[parent]);Object.defineProperties(rows,{hasMore:{value:false},totalCount:{value:rows.length},variantGroups:{value:query.productId?[{id:3,name:'Color'}]:[]}});return rows;}};
  variantFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,workspacePreferences:async()=>({display:{variantOrder:'stock:desc'}})});variantFixture.workspace.mount(document.querySelector('#tpv'));
 });
 const parent=page.locator('[data-tpv-add="12:0"]'),dialog=page.locator('.tpv-variant-dialog');await parent.waitFor();await parent.click();
 await dialog.getByRole('alert').filter({hasText:'No se han podido consultar las variantes'}).waitFor();
 assert.equal(await dialog.locator('[data-tpv-add]').count(),0,'A failed query never presents a parent as a selectable combination');
 await dialog.getByRole('button',{name:'Volver a productos',exact:true}).click();await parent.waitFor();await parent.click();
 await dialog.locator('[data-tpv-add="12:1"]').waitFor();assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
 assert.equal(await dialog.locator('[data-tpv-view]').inputValue(),width===390?'grid':'table');
 assert.equal(await dialog.locator('[data-tpv-variant-order]').inputValue(),'stock:desc');
 await dialog.locator('[data-tpv-variant-group]').selectOption('3');
 await page.waitForFunction(()=>variantFixture.queries.at(-1).variantGroupId===3&&!document.querySelector('[data-tpv-variant-group]').disabled);
 await dialog.locator('[data-tpv-variant-order]').selectOption('stock:desc');
 await page.waitForFunction(()=>variantFixture.queries.at(-1).sortField==='stock'&&!document.querySelector('[data-tpv-variant-order]').disabled);
 assert.equal(await dialog.locator('[data-tpv-add="12:2"]').isDisabled(),true);
 await dialog.locator('[data-tpv-add="12:1"]').click();await dialog.waitFor({state:'hidden'});
 assert.equal(await page.locator('.tpv-ticket-line').count(),1);await parent.click();await dialog.locator('[data-tpv-add="12:1"]').waitFor();
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('.tpv-ticket-line').count(),1);
 const last=await page.evaluate(()=>variantFixture.queries.at(-1));assert.equal(last.productId,0);assert.equal(last.variantGroupId,0);assert.equal(last.sortField,'name');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS variant selector desktop/mobile: failed read has no false combinations, modal focus boundary, native group/sort parameters, unavailable rows disabled, add closes, Escape preserves ticket and catalogue order. Fictional adapter; native paging tested separately.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
