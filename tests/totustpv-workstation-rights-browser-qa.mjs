import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390])for(const role of ['observer','cash-manager','seller']){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async role=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  window.rightsFixture={role,open:true,movements:0,orders:0,documents:0};
  const record={id:'sale',status:'confirmed',reference:'Pedido #42',totalCents:150,refunds:[]};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'shop',name:'Tienda ficticia'}],
   drawers:[{id:'drawer',storeId:'shop',name:'Caja ficticia',connectionId:'connection',shopId:1,
    canSell:role==='seller',canOpen:role==='cash-manager',canReconcile:true}],
   sessions:rightsFixture.open?[{id:'session',storeId:'shop',drawerId:'drawer',status:'open'}]:[]}),
   selectSession:async()=>{},selectWorkstation:async()=>{},categories:async()=>[],
   searchProducts:async()=>[{id:'1:0',name:'Artículo ficticio',stock:5,priceCents:150}],
   history:async()=>[record],orders:async()=>{rightsFixture.orders++;return [record];},
   sessionSummary:async()=>({openingCents:1000,salesCents:0,cashCents:0,expectedCashCents:1000,unresolved:0}),
   cashMovement:async()=>{rightsFixture.movements++;return {openingCents:1000,salesCents:0,cashCents:0,expectedCashCents:1100};},
   document:async()=>{rightsFixture.documents++;return {kind:'receipt',existing_document:true,currency:'EUR',order_id:42,
    reference:'FICTICIO',merchant:{name:'Tienda ficticia'},lines:[],payments:{cash:150},total_cents:150};}};
  rightsFixture.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,canStock:()=>true,canCustomer:()=>true,
   autoOpen:true,createLiveAdapter:()=>adapter});rightsFixture.workspace.mount(document.querySelector('#tpv'));
 },role);
 await page.locator('[data-tpv-add]').waitFor();assert.equal(await page.locator('[data-tpv-add]').isEnabled(),role==='seller');
 await page.getByText('Más acciones',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Entrada de stock',exact:true}).count(),role==='seller'?1:0);
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Caja',exact:true}).click();
 await page.locator('.tpv-session').waitFor();assert.equal(await page.locator('[data-tpv-form=movement]').count(),role==='cash-manager'?1:0);
 assert.equal(await page.getByRole('button',{name:'Cerrar caja',exact:true}).isEnabled(),role==='cash-manager');
 if(role==='cash-manager'){
  await page.locator('[data-tpv-form=movement] [name=amount]').fill('1');await page.locator('[data-tpv-form=movement] [name=reason]').fill('Movimiento ficticio');
  await page.getByRole('button',{name:'Registrar movimiento',exact:true}).click();await page.waitForFunction(()=>rightsFixture.movements===1);
 }
 await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Devolver',exact:true}).isEnabled(),role==='seller');
 await page.evaluate(()=>{rightsFixture.open=false;rightsFixture.workspace.mount(document.querySelector('#tpv'));});
 await page.getByRole('button',{name:'Actualizar cajas',exact:true}).waitFor({state:role==='cash-manager'?'hidden':'visible'});
 assert.equal(await page.getByRole('button',{name:'Abrir caja',exact:true}).count(),role==='cash-manager'?1:0);
 await page.getByRole('button',{name:'Pedidos y devoluciones',exact:true}).click();
 await page.locator('.tpv-history article').waitFor();assert.equal(await page.evaluate(()=>rightsFixture.orders),1,'History is available without opening a cash session');
 assert.equal(await page.getByRole('button',{name:'Devolver',exact:true}).isDisabled(),true,'Returns still require an open authorized cash session');
 await page.locator('.tpv-document-actions>summary').click();await page.getByRole('button',{name:'Ticket',exact:true}).click();
 await page.getByRole('heading',{name:'Justificante de compra',exact:true}).waitFor();assert.equal(await page.evaluate(()=>rightsFixture.documents),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS workstation rights desktop/mobile: distinct consultation/sale/cash controls, no stock entry for observers, read-only closed-cash history and document retrieval. Explicit adapters; SQL denial is tested separately.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
