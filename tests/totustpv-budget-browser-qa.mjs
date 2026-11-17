import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{await fs.mkdir('qa-artifacts',{recursive:true});for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');window.budgetFixture={saved:null,saves:[],opens:0,quotes:[]};
  const f=budgetFixture,product={id:'11:0',nativeProductId:11,name:'Artículo del presupuesto',stock:6,priceCents:801};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'store',name:'Caja ficticia',canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[product],abandonDraft:async()=>{},setCustomer:async()=>{},pendingBudget:()=>f.pending===true,recoverBudgetPreparation:async()=>{f.pending=false;return structuredClone(f.saved);},
   budgets:async()=>({items:f.saved?[structuredClone(f.saved)]:[],hasMore:false}),getBudget:async()=>structuredClone(f.saved),
   saveBudget:async intent=>{f.saves.push(structuredClone(intent));f.saved={id:'budget-1',reference:'P-000001',title:intent.title,publicNote:intent.publicNote,status:'saved',version:1,storeName:'Tienda ficticia',createdAt:'2026-11-17T10:00:00Z',validUntil:'2026-12-17T10:00:00Z',expired:false,snapshot:{currency:'EUR',totalCents:801,totalTaxExclCents:662,merchant:{name:'Comercio ficticio',address:'Calle de las Pruebas, 1'},customer:null,lines:[{name:product.name,qty:1,unitTaxInclMicros:8012100,lineTaxInclCents:801}]}};return structuredClone(f.saved);},
   openBudget:async()=>{f.opens++;f.saved.status='checkout';return {budget:structuredClone(f.saved),draft:{id:'budget-draft',version:1,label:'P-000001'},customer:null,lines:[{productId:product.id,name:product.name,qty:1,unitCents:0,pricePending:true,stock:6,minimumQty:1}]};},
   quote:async intent=>{f.quotes.push(structuredClone(intent));return {id:'budget-sale',currency:'EUR',totalCents:801,quoteExpiresAt:Date.now()+120000,paymentMethods:['cash']};}
  };
  f.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,confirm:async()=>true});f.workspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('[data-tpv-add="11:0"]').click();if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();
 await page.getByRole('button',{name:'Guardar presupuesto',exact:true}).click();const form=page.locator('[data-tpv-form="budget"]');await form.getByLabel('Título',{exact:true}).fill('Oferta para el cliente');await form.getByLabel('Vigencia en días').fill('30');await form.getByLabel('Texto para el cliente').fill('Recogida por la tarde');
 await form.getByRole('button',{name:'Calcular y guardar presupuesto'}).click();await page.getByRole('article',{name:'Documento del presupuesto'}).waitFor();
 assert.equal(await page.evaluate(()=>budgetFixture.saves.length),1);assert.equal(await page.evaluate(()=>budgetFixture.opens),0);assert.equal(await page.evaluate(()=>budgetFixture.quotes.length),0);assert.ok((await page.locator('.tpv-budget-document').innerText()).includes('Recogida por la tarde'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`qa-artifacts/tpv-budget-${width}.png`,fullPage:true});
 await page.evaluate(()=>budgetFixture.pending=true);await page.locator('.tpv-actions>summary').click();await page.getByRole('button',{name:'Presupuestos',exact:true}).click();await page.getByRole('button',{name:'Recuperar presupuesto pendiente',exact:true}).click();assert.equal(await page.evaluate(()=>budgetFixture.pending),false);assert.equal(await page.evaluate(()=>budgetFixture.saves.length),1);
 await page.getByRole('button',{name:'Abrir como ticket',exact:true}).click();await page.locator('.tpv-ticket-lines').waitFor();if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();assert.equal(await page.evaluate(()=>budgetFixture.opens),1);
 await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();assert.equal(await page.evaluate(()=>budgetFixture.quotes.length),1);assert.equal(await page.evaluate(()=>budgetFixture.quotes[0].lines[0].productId),'11:0');
 assert.deepEqual(errors,[]);await page.evaluate(()=>budgetFixture.workspace.dispose());await page.close();
 }console.log('PASS budget UI: desktop/mobile ticket → saved commercial document → explicit conversion → fresh checkout calculation, without an automatic charge. Synthetic service responses only.');
}finally{await browser.close();await server.close();}
