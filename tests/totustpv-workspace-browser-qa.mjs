import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.getByRole('button',{name:'Probar con datos ficticios'}).click();
 await page.getByRole('button',{name:'Abrir caja de práctica',exact:true}).click();
 await page.locator('[data-tpv-view]').selectOption('list');
 assert.equal(await page.locator('.tpv-view-list').count(),1);
 await page.locator('[data-tpv-view]').selectOption('compact');
 assert.equal(await page.locator('.tpv-view-compact').count(),1);
 await page.locator('[data-tpv-view]').selectOption('grid');
 await page.getByRole('button',{name:/Artículo de práctica/}).click();
 await page.locator('[data-tpv-quantity]').fill('2');
 assert.match(await page.locator('.tpv-ticket-total').innerText(),/16,02/);
 await page.locator('[data-tpv-quantity]').fill('1');
 await page.getByRole('button',{name:'Preparar cobro de práctica'}).click();
 await page.locator('[name=received]').fill('10,00');
 await page.locator('[name=scenario]').selectOption('lost-response');
 await page.getByRole('button',{name:'Confirmar venta de práctica'}).click();
 await page.getByText('Respuesta pendiente de recuperar',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Probar con datos ficticios'}).click();
 await page.getByRole('button',{name:'Tickets de práctica',exact:true}).click();
 await page.getByRole('button',{name:'Recuperar',exact:true}).click();
 await page.getByText('Venta de práctica registrada',{exact:true}).waitFor();
 assert.match(await page.locator('[aria-label="Resultado de venta"]').innerText(),/1,99/);
 await page.getByRole('button',{name:'Nuevo ticket',exact:true}).click();
 await page.getByRole('button',{name:/Artículo con variante/}).click();
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:950});
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
   buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetWidth>0).map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))}));
  assert.ok(metrics.scroll<=metrics.width+1,`No horizontal overflow at ${width}`);
  assert.ok(metrics.buttons.every(b=>b.width>=32&&b.height>=32),`Usable targets at ${width}`);
 }
 await fs.mkdir('artifacts/totustpv-workspace',{recursive:true});
 await page.screenshot({path:'artifacts/totustpv-workspace/mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:950});await page.screenshot({path:'artifacts/totustpv-workspace/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Preparar cobro de práctica'}).click();
 await page.locator('[name=method]').selectOption('mixed');await page.locator('[name=cashPart]').fill('5,00');
 await page.locator('[name=received]').fill('5,00');await page.locator('[name=cardAccepted]').check();
 await page.getByRole('button',{name:'Confirmar venta de práctica'}).click();
 await page.getByText('Venta de práctica registrada',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Tickets de práctica',exact:true}).click();
 await page.locator('.tpv-history article').nth(1).getByRole('button',{name:'Devolver'}).click();
 await page.locator('[name="qty-demo-1"]').fill('0');
 await page.locator('[name="restock-demo-1"]').uncheck();
 await page.locator('[name=refundAccepted]').check();
 await page.getByRole('button',{name:'Registrar devolución de práctica'}).click();
 await page.getByRole('alert').filter({hasText:'Selecciona líneas'}).waitFor();
 assert.equal(await page.locator('[name="restock-demo-1"]').isChecked(),false,'Failed refund preserves defective-item choice');
 assert.equal(await page.locator('[name=refundAccepted]').isChecked(),true);
 await page.locator('[name="qty-demo-1"]').fill('1');
 await page.getByRole('button',{name:'Registrar devolución de práctica'}).click();
 await page.getByText(/Devolución de práctica registrada:/).waitFor();
 await page.getByRole('button',{name:'Caja',exact:true}).click();
 assert.match(await page.locator('.tpv-session').innerText(),/105,00/);
 await page.locator('[name=counted]').fill('no');
 await page.getByRole('button',{name:'Cerrar caja de práctica'}).click();
 await page.getByRole('alert').filter({hasText:'importe válido'}).waitFor();
 assert.equal(await page.locator('[name=counted]').inputValue(),'no');
 await page.locator('[name=counted]').fill('105,00');
 await page.getByRole('button',{name:'Cerrar caja de práctica'}).click();
 await page.getByRole('button',{name:'Abrir caja de práctica',exact:true}).waitFor();
 await page.getByRole('button',{name:'Abrir caja de práctica',exact:true}).click();
 await page.getByRole('button',{name:/Artículo de práctica/}).click();
 const staleLeave=await page.evaluate(async()=>{
  const leaving=window.fixture.workspace.requestLeave();
  window.fixture.setAccount({id:'third-operator',active:true});
  return leaving;
 });
 assert.equal(staleLeave,false,'A confirmation belonging to another account cannot release the current workspace');
 await page.getByRole('button',{name:'Probar con datos ficticios'}).waitFor();
 await page.evaluate(()=>window.fixture.setAccount({id:'other-operator',active:true}));
 await page.getByRole('button',{name:'Probar con datos ficticios'}).click();
 await page.getByRole('button',{name:'Abrir caja de práctica',exact:true}).waitFor();
 await page.evaluate(async()=>{
  window.fixture.workspace.dispose();const {createTpvWorkspace}=await import('../src/totustpv/workspace.js');
  const drawers=[{id:'a',name:'Caja A',storeId:'shop',connectionId:'connection',shopId:1,canSell:true,canOpen:true,canReconcile:true},{id:'b',name:'Caja B',storeId:'shop',connectionId:'connection',shopId:1,canSell:true,canOpen:true,canReconcile:true}];
  const saved=new Map([['a',{viewMode:'compact',initialCategoryId:2}],['b',{viewMode:'list',initialCategoryId:1}]]);
  window.settingsFixture={saved,reads:[],queries:[],selected:[],open:true};
  const w=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,autoOpen:true,
   createLiveAdapter:()=>({mode:'qa',context:async()=>({stores:[{id:'shop',name:'QA'}],drawers,sessions:settingsFixture.open?[{id:'session',storeId:'shop',drawerId:'a',status:'open'}]:[]}),
    selectSession:async()=>{},selectWorkstation:async s=>settingsFixture.selected.push(s),categories:async()=>[{id:1,label:'Aromas'},{id:2,label:'Varios'}],
    searchProducts:async q=>{settingsFixture.queries.push(q);if(settingsFixture.failNext){settingsFixture.failNext=false;throw Error('Fallo ficticio de lectura');}if(settingsFixture.deferNext){settingsFixture.deferNext=false;await new Promise(resolve=>settingsFixture.finishSearch=resolve);}return [{id:'1:0',name:'Artículo QA',reference:'QA1',stock:10,priceCents:150}];}}),
   workspacePreferences:async(drawer,value)=>{settingsFixture.reads.push(drawer.id);if(value)saved.set(drawer.id,value);return saved.get(drawer.id);}});
  window.settingsFixture.workspace=w;w.mount(document.querySelector('#tpv'));
 });
 await page.locator('.tpv-view-compact').waitFor();assert.equal(await page.locator('[data-tpv-category]').inputValue(),'2');
 assert.equal(await page.evaluate(()=>settingsFixture.queries.at(-1).categoryId),2);
 await page.getByText('Más acciones',{exact:true}).click();
 await page.getByRole('button',{name:'Configuración',exact:true}).click();
 for(const key of ['showAfterSale','printAfterSale','showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany'])await page.locator(`[name=receipt-${key}]`).check();
 assert.match(await page.locator('.tpv-receipt-preview').innerText(),/Cliente de ejemplo[\s\S]*cliente@ejemplo.invalid[\s\S]*Destinatario de ejemplo/);
 await page.locator('[name=layout]').selectOption('ticket');await page.locator('[name=returnToStart]').check();
 await page.locator('[name=viewMode]').selectOption('list');await page.locator('[name=initialCategoryId]').selectOption('1');
 await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>settingsFixture.saved.get('a')),{viewMode:'list',initialCategoryId:1,
  cash:{denominations:[50000,20000,10000,5000,2000,1000,500,200,100,50,20,10,5,2,1]},
  customerDisplay:{enabled:false,showPrices:true,showCustomer:false,color:'#1773c9',fontSize:23},
  display:{showPrices:true,showStock:true,showReferences:true,beepOnAdd:false,ticketNewestFirst:false,returnToStart:true,layout:'ticket'},
  receipt:{title:'Justificante de compra',footer:'',fontFamily:'arial',fontSize:11,dateFormat:'native',showLogo:true,showBarcode:false,showUnitPrice:false,showLineTax:false,showOperator:false,showWebsite:false,showAfterSale:true,printAfterSale:true,showOrderReference:true,numberLines:false,showCustomer:true,showCustomerPhone:true,showCustomerEmail:true,showAddressComment:true,showDeliveryAddress:true,showCustomerCompany:true,showReferences:true,showAddress:true,showPhone:true,showPayments:true,showDiscounts:true,showDate:true}});
 await page.evaluate(()=>settingsFixture.workspace.mount(document.querySelector('#tpv')));await page.locator('.tpv-view-list').waitFor();
 assert.equal(await page.evaluate(()=>settingsFixture.queries.at(-1).categoryId),1);
 assert.equal(await page.evaluate(()=>settingsFixture.workspace.hasDraft()),false,'Presentation filters are not an edited sale');
 assert.equal(await page.locator('.tpv-sale-grid').evaluate(grid=>grid.querySelector('.tpv-ticket').getBoundingClientRect().width>grid.querySelector('.tpv-catalogue').getBoundingClientRect().width),true,'The saved layout gives the ticket more desktop space');
 await page.locator('[data-tpv-category]').selectOption('2');await page.waitForFunction(()=>settingsFixture.queries.at(-1).categoryId===2);
 await page.locator('[data-tpv-add]').click();await page.waitForFunction(()=>settingsFixture.queries.at(-1).categoryId===1);
 assert.equal(await page.locator('.tpv-ticket-line').count(),1,'Returning to the initial category keeps the added article');
 await page.locator('[data-tpv-search]').fill('QA1');await page.locator('[data-tpv-search]').press('Enter');
 await page.waitForFunction(()=>document.querySelector('.tpv-ticket-line [data-tpv-quantity]')?.value==='2');
 assert.equal(await page.locator('[data-tpv-category]').inputValue(),'1','A keyboard scan also returns to the initial category');
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 assert.equal(await page.locator('[name=receipt-showCustomer]').isChecked(),true,'Customer presentation preference survives reopening');
 assert.equal(await page.locator('[name=receipt-printAfterSale]').isChecked(),true,'Automatic print preference survives reopening');
 for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-workspace/settings-${width}.png`,fullPage:true});}
 assert.ok(await page.locator('[data-tpv-body]').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop;})>0,'The configuration really scrolls before measuring the save action');
 const save=page.getByRole('button',{name:'Guardar mostrador',exact:true});
 assert.equal(await save.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Saving remains reachable at the bottom of the mobile configuration');
 await page.screenshot({path:'artifacts/totustpv-workspace/settings-390-bottom.png',fullPage:true});
 await page.getByRole('button',{name:'Venta',exact:true}).click();
 await page.evaluate(()=>settingsFixture.deferNext=true);await page.locator('[data-tpv-add]').click();
 await page.waitForFunction(()=>typeof settingsFixture.finishSearch==='function');
 await page.evaluate(()=>settingsFixture.workspace.mount(document.querySelector('#tpv')));await page.locator('.tpv-view-list [data-tpv-add]').waitFor();
 await page.evaluate(async()=>{settingsFixture.finishSearch();await new Promise(resolve=>setTimeout(resolve,0));});
 await page.getByRole('button',{name:'Venta',exact:true}).click();
 assert.equal(await page.locator('[data-tpv-add]').count(),1,'A late category response cannot clear the newly mounted catalogue');
 await page.evaluate(()=>settingsFixture.failNext=true);await page.locator('[data-tpv-add]').click();
 await page.getByRole('status').filter({hasText:'Artículo añadido. No se ha podido cargar la categoría inicial.'}).waitFor();
 assert.equal(await page.locator('.tpv-ticket-line [data-tpv-quantity]').inputValue(),'1','Failed catalogue refresh retains the article that was added');
 await page.locator('[data-tpv-category]').selectOption('1');await page.locator('[data-tpv-add]').waitFor();
 assert.equal(await page.locator('.tpv-ticket-line [data-tpv-quantity]').inputValue(),'1','Retrying the category only reads; it does not add the item twice');
 await page.evaluate(()=>{settingsFixture.open=false;settingsFixture.workspace.mount(document.querySelector('#tpv'));});
 await page.locator('[data-tpv-drawer]').waitFor();await page.locator('[data-tpv-drawer]').selectOption('b');
 await page.waitForFunction(()=>settingsFixture.reads.at(-1)==='b');
 assert.equal(await page.evaluate(()=>settingsFixture.selected.at(-1).drawerId),'b');
 assert.deepEqual(errors,[]);console.log('PASS TotusTPV workspace: cash/change, lost response, reload/recovery, mixed payment, refund without restocking, cash close, per-user isolation and four viewport sizes. Synthetic data only.');
}finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
