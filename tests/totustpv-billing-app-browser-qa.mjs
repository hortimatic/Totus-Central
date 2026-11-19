import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';import {clickModuleLink} from './ui-navigation.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),calls=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/functions/v1/totus-tpv',async route=>{
  const request=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const input=request.postDataJSON();calls.push(input);assert.equal(request.headers().authorization,'Bearer qa-sandbox');
  assert.equal(input.action,'billing-context');return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({sources:[]})});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="facturacion"]'));
 await page.locator('[data-action="billing-section"][data-section="tpv"]').click();
 await page.getByRole('heading',{name:'Facturas del TPV',exact:true}).waitFor();
 await page.getByRole('heading',{name:'No hay establecimientos preparados',exact:true}).waitFor();
 assert.equal(calls.length,1);assert.ok(calls.every(call=>call.action==='billing-context'));
 assert.equal(await page.locator('[data-tpv-billing-root]').count(),1);
 await page.locator('[data-action="billing-section"][data-section="documentos"]').click();
 assert.equal(await page.locator('[data-tpv-billing-root]').count(),0);await page.getByRole('heading',{name:'Facturación',exact:true}).last().waitFor();
 assert.deepEqual(errors,[]);await page.close();
}console.log('PASS Central Facturación tab: application mount/dispose and ordinary account JWT on desktop/mobile, no cashier/cash setup or fiscal creation. API context fixture.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
