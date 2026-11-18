import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';import {clickModuleLink} from './ui-navigation.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),calls=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
 let populated=false;const connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66',saleId='00000000-0000-4000-8000-000000000012',sessionId='00000000-0000-4000-8000-000000000011';
 const source={connectionId:connection,connectionRevision:1,storeId:'00000000-0000-4000-8000-000000000002',shopId:1,storeName:'Laboratorio',currency:'EUR',drawers:[]};
 const report={sessionId,id:sessionId,status:'closed',environment:'qa',currency:'EUR',storeName:'Laboratorio',drawerName:'Mostrador',openedAt:'2026-11-18T09:00:00Z',recordedAt:'2026-11-18T09:00:00Z',openedByName:'Empleado',openingCents:10000,expectedCashCents:10801,countedCents:10801,differenceCents:0,payments:{cash:801},refunds:{},orderCount:1,refundCount:0,movementCount:0};
 await page.route('**/functions/v1/totus-tpv',async route=>{const request=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});const input=request.postDataJSON();calls.push(input);
  assert.equal(request.headers().authorization,'Bearer qa-sandbox');let result;
  if(!populated){assert.equal(input.action,'central-cash-context');result={sources:[]};}
  else if(['central-cash-context','billing-context'].includes(input.action))result={sources:[source]};
  else if(input.action==='central-cash-read')result=input.section==='session'?report:{items:input.section==='sessions'?[report]:[{id:saleId,saleId,orderId:123,status:'confirmed',totalCents:801,recordedAt:report.openedAt,actorName:'Empleado'}],hasMore:false,cursor:null};
  else if(input.action==='billing-list')result={items:[{id:saleId,orderId:123,createdAt:report.openedAt,totalCents:801,currency:'EUR',drawerName:'Mostrador',operatorName:'Empleado',refundCents:0,refunds:[]}],hasMore:false,cursor:null};
  else if(input.action==='billing-document'){assert.equal(input.operationId,saleId);result={sale:{id:saleId,drawerName:'Mostrador',operatorName:'Empleado',refunds:[]},document:{formatted_number:'LAB-123',order_id:123,order_reference:'REF123',issued_at:'2026-11-18 10:00:00',currency:'EUR',total_cents:801,total_tax_excl:'6.620000',lines:[{name:'Artículo de prueba',quantity:1,unit_tax_incl:'8.010000',line_tax_incl:'8.010000'}]}};}
  else throw Error('Unexpected write/action '+input.action);
  return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});await clickModuleLink(page,page.locator('#nav [data-route="cajas"]'));
 await page.getByRole('button',{name:'Sesiones del TPV',exact:true}).click();await page.getByRole('heading',{name:'Sesiones del TPV',exact:true}).waitFor();
 await page.getByRole('heading',{name:'No hay establecimientos preparados',exact:true}).waitFor();assert.equal(calls.length,1);
 assert.equal(await page.locator('[data-central-cash-root]').count(),1);
 await page.getByRole('button',{name:'Cierres del negocio',exact:true}).click();assert.equal(await page.locator('[data-central-cash-root]').count(),0);
 await page.getByRole('heading',{name:'Cierres de caja',exact:true}).waitFor();populated=true;
 // Keep the billing TPV tab selected, then navigate away and return through
 // the actual Cajas invoice link: the target must mount exactly once.
 await clickModuleLink(page,page.locator('#nav [data-route="facturacion"]'));await page.locator('[data-action="billing-section"][data-section="tpv"]').click();
 await page.getByRole('button',{name:'Ver factura',exact:true}).waitFor();const billingContexts=calls.filter(row=>row.action==='billing-context').length;
 await clickModuleLink(page,page.locator('#nav [data-route="cajas"]'));await page.getByRole('button',{name:'Sesiones del TPV',exact:true}).click();
 await page.getByRole('button',{name:'Consultar sesión',exact:true}).click();await page.getByRole('button',{name:'Ver factura',exact:true}).click();
 await page.getByRole('heading',{name:'LAB-123',exact:true}).waitFor();assert.equal(calls.filter(row=>row.action==='billing-context').length,billingContexts+1);
 assert.equal(calls.filter(row=>row.action==='billing-document').length,1);assert.deepEqual(errors,[]);await page.close();
}console.log('PASS Central Cajas application tab: ordinary session JWT, single mount, clean tab disposal and preserved business closings at desktop/mobile. API context fixture; no commercial/fiscal writes.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
