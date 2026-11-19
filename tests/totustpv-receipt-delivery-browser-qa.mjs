import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390])for(const scenario of ['confirmed','uncertain','document-failure','document-account-change']){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async scenario=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  window.deliveryFixture={reads:0,submits:0,recoveries:0,prints:0,catalogueReads:0,actor:{id:'operator',active:true}};
  // Observe the real print iframe without opening a system dialog. This is a
  // browser print request, never evidence that a physical printer produced paper.
  document.addEventListener('load',event=>{const frame=event.target;
   if(frame instanceof HTMLIFrameElement&&frame.title==='Impresión de TotusTPV')frame.contentWindow.print=()=>deliveryFixture.prints++;
  },true);
  const confirmed={id:'sale-fixture',status:'confirmed',orderId:42,reference:'Pedido #42',totalCents:150};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'shop',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'shop',name:'Caja ficticia',connectionId:'connection',shopId:1,canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'shop',drawerId:'drawer',status:'open'}]}),
   selectSession:async()=>{},setCustomer:async()=>{},categories:async()=>[],searchProducts:async()=>{deliveryFixture.catalogueReads++;return [{id:'1:0',name:'Artículo ficticio',reference:'QA',stock:deliveryFixture.submits?9:10,priceCents:150}];},
   quote:async()=>({id:'sale-fixture',totalCents:150,currency:'EUR',lines:[],paymentMethods:['cash']}),
   submit:async()=>{deliveryFixture.submits++;return scenario==='uncertain'?{...confirmed,status:'uncertain'}:confirmed;},
   recover:async()=>{deliveryFixture.recoveries++;return confirmed;},
   document:async()=>{deliveryFixture.reads++;if(scenario==='document-failure')throw Error('Documento no disponible');
    if(scenario==='document-account-change')await new Promise(resolve=>deliveryFixture.releaseDocument=resolve);
    return {kind:'receipt',existing_document:true,currency:'EUR',order_id:42,reference:'QA-42',created_at:'2026-11-17 12:00:00',merchant:{name:'Tienda ficticia'},lines:[{name:'Artículo ficticio',quantity:1,line_cents:150}],payments:{cash:150},total_cents:150};}};
  deliveryFixture.workspace=createTpvWorkspace({actor:()=>deliveryFixture.actor,can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,
   workspacePreferences:async()=>({receipt:{showAfterSale:true,printAfterSale:true}})});
  deliveryFixture.workspace.mount(document.querySelector('#tpv'));
 },scenario);
 await page.locator('[data-tpv-add="1:0"]').click();
 if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();
 if(scenario==='uncertain'){await page.getByText('Opciones del ticket',{exact:true}).click();await page.locator('[name=draftLabel]').fill('Ticket pendiente de recuperar');}
 await page.getByRole('button',{name:'Calcular y cobrar',exact:true}).click();
 await page.getByRole('button',{name:'Importe exacto',exact:true}).click();
 const catalogueBefore=await page.evaluate(()=>deliveryFixture.catalogueReads);
 await page.getByRole('button',{name:'Confirmar cobro y crear pedido',exact:true}).click();
 if(scenario==='confirmed'){
  await page.getByRole('heading',{name:'Justificante de compra',exact:true}).waitFor();
  await page.waitForFunction(()=>deliveryFixture.prints===1);
  assert.deepEqual(await page.evaluate(()=>[deliveryFixture.submits,deliveryFixture.reads,deliveryFixture.prints]),[1,1,1]);
  await page.getByRole('button',{name:'Cerrar documento',exact:true}).click();
  await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>deliveryFixture.catalogueReads),catalogueBefore,'Confirmation does not wait for an invisible catalogue refresh');
  await page.getByRole('button',{name:'Nuevo ticket',exact:true}).click();
  await page.locator('[data-tpv-add="1:0"]').waitFor();
  assert.equal(await page.evaluate(()=>deliveryFixture.catalogueReads),catalogueBefore+1,'A new ticket reads fresh stock');
  assert.match(await page.locator('[data-tpv-add="1:0"]').innerText(),/9 disponibles/);
  assert.equal(await page.locator('[data-tpv-add="1:0"]').isVisible(),true,'A new mobile ticket returns to the catalogue');
  await page.evaluate(()=>deliveryFixture.workspace.mount(document.querySelector('#tpv')));
  await page.locator('[data-tpv-add="1:0"]').waitFor();
  assert.equal(await page.evaluate(()=>deliveryFixture.prints),1,'Reopening the workspace cannot print an old confirmation again');
 }else if(scenario==='uncertain'){
  await page.getByRole('heading',{name:'Respuesta pendiente de recuperar',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>[deliveryFixture.reads,deliveryFixture.prints]),[0,0]);
  await page.getByRole('button',{name:'Recuperar resultado',exact:true}).click();
  await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>[deliveryFixture.submits,deliveryFixture.recoveries,deliveryFixture.reads,deliveryFixture.prints]),[1,1,0,0]);
  assert.equal(await page.evaluate(()=>deliveryFixture.workspace.hasDraft()),false,'A recovered confirmed ticket is not an unsaved sale');
  await page.locator('.tpv-document-actions>summary').click();await page.getByRole('button',{name:'Ticket',exact:true}).click();
  await page.getByRole('heading',{name:'Justificante de compra',exact:true}).waitFor();await page.getByRole('button',{name:'Imprimir',exact:true}).click();
  await page.waitForFunction(()=>deliveryFixture.prints===1);
 }else if(scenario==='document-account-change'){
  await page.waitForFunction(()=>typeof deliveryFixture.releaseDocument==='function');
  await page.evaluate(()=>{deliveryFixture.actor.id='another-account';deliveryFixture.releaseDocument();});
  await page.getByRole('alert').filter({hasText:'La sesión ha cambiado'}).waitFor();
  assert.equal(await page.locator('.tpv-document,.tpv-receipt').count(),0,'Late account changes cannot expose the old sale or document');
  assert.equal(await page.evaluate(()=>deliveryFixture.prints),0);
 }else{
  await page.getByRole('heading',{name:'Pedido verificado en PrestaShop',exact:true}).waitFor();
  await page.getByText('Pedido confirmado. No se ha podido preparar el justificante. Ábrelo desde Documentos.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>[deliveryFixture.submits,deliveryFixture.reads,deliveryFixture.prints]),[1,1,0]);
  await page.evaluate(async()=>{const {printTpvMarkup}=await import('/src/totustpv/documents.js');let current=true;
   printTpvMarkup('<p>Documento ficticio</p>','Prueba de contexto',{current:()=>current});current=false;});
  await page.waitForFunction(()=>document.querySelectorAll('iframe[title="Impresión de TotusTPV"]').length===0);
  assert.equal(await page.evaluate(()=>deliveryFixture.prints),0,'A context change before iframe load cancels the print request');
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.deepEqual(errors,[]);await page.close();
}
 console.log('PASS automatic receipt desktop/mobile: confirmed-only preview and one browser print request, uncertain/recovered manual path, and document failure retains the confirmed sale. Financial adapter and printer dialog are explicit fixtures; no physical printing.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
