import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{await fs.mkdir('qa-artifacts',{recursive:true});for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950},acceptDownloads:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-billing.html');
 await page.evaluate(async()=>{
  const {createCentralCashUI}=await import('/src/totustpv/central-cash-ui.js');window.cashFixture={actor:'account',calls:[],billing:[],canExport:true,wait:false,fail:false};const f=cashFixture;
  const base={id:'session-a',sessionId:'session-a',status:'closed',environment:'qa',currency:'EUR',drawerName:'Mostrador',storeName:'Tienda de pruebas',
   openedAt:'2026-11-18T09:00:00Z',recordedAt:'2026-11-18T09:00:00Z',openedByName:'Empleado de pruebas',closedAt:'2026-11-18T10:00:00Z',closedByName:'Responsable',openingCents:10000,
   expectedCashCents:10400,countedCents:10350,differenceCents:-50,payments:{cash:801,card:1500},refunds:{cash:401},cashInCents:0,cashOutCents:0,orderCount:1,refundCount:1,movementCount:2,note:'Revisar <img src=x onerror=alert(1)>'};
  f.report=base;f.ui=createCentralCashUI({actor:()=>f.actor,canExport:()=>f.canExport,canBilling:()=>true,onBilling:async value=>f.billing.push(value),client:()=>async body=>{
   f.calls.push(body);if(f.wait){await new Promise(resolve=>f.resolve=resolve);f.wait=false;}
   if(body.action==='central-cash-context')return {sources:[{connectionId:'connection',connectionRevision:3,storeId:'store',shopId:1,storeName:'Tienda de pruebas',currency:'EUR',drawers:[{id:'drawer-a',name:'Mostrador',active:true},{id:'drawer-b',name:'Otra caja',active:false}]}]};
   if(f.fail)throw Error('Consulta simulada no disponible');
   if(body.section==='session')return structuredClone(base);
   if(body.section==='sessions')return {items:[{...base,...(body.query.cursor?{id:'session-b',sessionId:'session-b',drawerName:'Otra caja'}:{})}],hasMore:!body.query.cursor,cursor:body.query.cursor?null:{id:'session-a',recordedAt:base.recordedAt}};
   if(body.section==='sales')return {items:body.query.search&&!String(4901).includes(body.query.search)?[]:[{id:'sale',saleId:'sale',orderId:4901,status:'confirmed',totalCents:801,recordedAt:base.recordedAt,actorName:'Empleado de pruebas'}],hasMore:false,cursor:null};
   if(body.section==='refunds')return {items:[{id:'refund',saleId:'sale',orderId:4901,status:'confirmed',totalCents:401,recordedAt:base.recordedAt,actorName:'Responsable'}],hasMore:false,cursor:null};
   const next=!!body.query.cursor;return {items:[{id:next?'movement-b':'movement-a',kind:next?'cash-out':'cash-in',amountCents:105,reason:next?'Segundo movimiento':'=2+2 <img src=x onerror=alert(1)>',actorName:'Empleado',recordedAt:base.recordedAt}],hasMore:!next,cursor:next?null:{id:'movement-a',recordedAt:base.recordedAt}};
  }});await f.ui.mount(document.querySelector('#billing'));
 });
 await page.getByRole('button',{name:'Consultar sesión',exact:true}).waitFor();
 await page.screenshot({path:`qa-artifacts/central-cash-list-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByRole('heading',{name:'Otra caja',exact:true}).waitFor();
 await page.getByRole('button',{name:'Anterior',exact:true}).click();await page.getByRole('heading',{name:'Mostrador',exact:true}).waitFor();
 await page.getByRole('button',{name:'Consultar sesión',exact:true}).click();await page.getByRole('button',{name:'Ver factura',exact:true}).waitFor();
 assert.equal(await page.locator('#billing img').count(),0);await page.getByRole('button',{name:'Ver factura',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>cashFixture.billing),[{saleId:'sale',connectionId:'connection',shopId:1}]);
 await page.getByRole('button',{name:'Devoluciones',exact:true}).click();await page.getByText('Devuelta',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Movimientos de efectivo',exact:true}).click();await page.getByText('=2+2 <img src=x onerror=alert(1)>',{exact:true}).waitFor();
 assert.equal(await page.locator('#billing img').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:`qa-artifacts/central-cash-detail-${width}.png`,fullPage:true});
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar movimientos',exact:true}).click();
 const exported=await downloadPromise,content=await fs.readFile(await exported.path(),'utf8');assert.ok(content.includes('Segundo movimiento'));assert.ok(content.includes("'=2+2"));
 assert.ok(content.includes('"-1,05"'));assert.ok(!content.includes('"\'-1,05"'));assert.ok(content.includes('Establecimiento'));assert.ok(content.includes('Tienda de pruebas'));
 await page.getByText('Exportados 2 registros de esta sesión.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Ventas',exact:true}).click();
 await page.locator('[name="detailSearch"]').fill('999');await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.getByText('Sin registros en esta sección.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Ver factura',exact:true}).count(),0);
 await page.locator('[name="detailSearch"]').fill('4901');await page.getByRole('button',{name:'Buscar',exact:true}).click();
 await page.getByRole('button',{name:'Ver factura',exact:true}).waitFor();
 const filteredDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar ventas',exact:true}).click();
 const filteredContent=await fs.readFile(await (await filteredDownload).path(),'utf8');assert.ok(filteredContent.includes('4901'));assert.ok(filteredContent.includes('8,01'));
 assert.equal(await page.evaluate(()=>cashFixture.calls.filter(row=>row.section==='sales').at(-1).query.search),'4901');
 await page.getByRole('button',{name:'← Volver a las sesiones',exact:true}).click();await page.evaluate(()=>{cashFixture.fail=true;});
 await page.locator('[name="search"]').fill('Filtro nuevo');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
 await page.getByText('Consulta simulada no disponible',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Consultar sesión',exact:true}).count(),0);
 await page.evaluate(()=>{cashFixture.fail=false;});await page.getByRole('button',{name:'Limpiar',exact:true}).click();await page.getByRole('button',{name:'Consultar sesión',exact:true}).waitFor();
 await page.evaluate(()=>{cashFixture.wait=true;});await page.getByRole('button',{name:'Consultar sesión',exact:true}).click();
 assert.equal(await page.locator('[name="search"]').isDisabled(),true);
 await page.evaluate(()=>{cashFixture.actor='other-account';cashFixture.resolve();});assert.equal(await page.getByRole('button',{name:'Imprimir resumen',exact:true}).count(),0);
 assert.ok((await page.evaluate(()=>cashFixture.calls)).every(row=>['central-cash-context','central-cash-read'].includes(row.action)));
 await page.evaluate(async()=>{
  cashFixture.ui.dispose();cashFixture.cashTargets=[];const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Pruebas'}],drawers:[{id:'drawer-a',storeId:'store',name:'Mostrador',connectionId:'connection',shopId:1,canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'current-session',storeId:'store',drawerId:'drawer-a',status:'open'}]}),
   selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[],cashReports:async()=>[cashFixture.report]};
  cashFixture.workspace=createTpvWorkspace({actor:()=>({id:'account',active:true}),can:()=>true,autoOpen:true,createLiveAdapter:()=>adapter,
   canCentralCash:()=>true,onCash:async target=>cashFixture.cashTargets.push(target)});cashFixture.workspace.mount(document.querySelector('#billing'));
 });
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Informes de caja',exact:true}).click();
 await page.getByRole('button',{name:'Ver en Cajas de Central',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>cashFixture.cashTargets),[{connectionId:'connection',shopId:1,sessionId:'session-a'}]);
 assert.equal(await page.locator('body').innerText().then(text=>text.includes('session-a')),false);
 assert.deepEqual(errors,[]);await page.evaluate(()=>cashFixture.workspace.dispose());await page.close();
}console.log('PASS Central Cajas desktop/mobile: sessions/cursors, recorded summary, sales/refunds/movements, invoice link, complete paged CSV with formula protection, escaped names, no overflow, failed-filter clearing and account-switch rejection. Synthetic read service.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
