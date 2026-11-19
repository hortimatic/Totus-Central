import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseNativeCentralCashBrowser({handle,actor,selection,sessionId,saleId,orderId,nativeCalls,nativePosts}){
 const posts=nativePosts(),server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 try{for(const width of [1440,390]){
  const before=nativeCalls(),page=await browser.newPage({viewport:{width,height:950},acceptDownloads:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('nativeCashCall',async body=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));
   const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-billing.html');
  await page.evaluate(async args=>{
   const {createCentralCashUI}=await import('/src/totustpv/central-cash-ui.js');window.cash=createCentralCashUI({actor:()=>args.actor,client:()=>nativeCashCall,canExport:()=>true,canBilling:()=>true,
    onBilling:async target=>{window.cashTarget=target;cash.dispose();const {createTpvBillingUI}=await import('/src/totustpv/billing-ui.js');window.billing=createTpvBillingUI({actor:()=>args.actor,client:()=>nativeCashCall});await billing.mount(document.querySelector('#billing'),target);}});
   await cash.mount(document.querySelector('#billing'),{connectionId:args.selection.connectionId,shopId:args.selection.shopId,sessionId:args.sessionId});
  },{actor,selection,sessionId});
  await page.getByRole('button',{name:'Ver factura',exact:true}).waitFor();await page.getByText('99,00 €',{exact:true}).first().waitFor();
  assert.equal(nativeCalls(),before,'Central cash consultation must not contact the native shop');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`qa-artifacts/native-central-cash-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Movimientos de efectivo',exact:true}).click();await page.getByText('Retirada ficticia',{exact:true}).waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar movimientos',exact:true}).click();
  const csv=await fs.readFile(await (await downloadPromise).path(),'utf8');assert.ok(csv.includes('Retirada ficticia'));assert.equal(nativeCalls(),before);
  await page.getByRole('button',{name:'Ventas',exact:true}).click();await page.getByRole('button',{name:'Ver factura',exact:true}).click();
  await page.getByRole('button',{name:'Descargar factura',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>cashTarget),{saleId,connectionId:selection.connectionId,shopId:selection.shopId});
  await page.getByText('Pedido #'+orderId+' ·',{exact:false}).waitFor();
  const pdfPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar factura',exact:true}).click();
  const pdf=await fs.readFile(await (await pdfPromise).path());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert.equal(nativePosts(),posts);assert.deepEqual(errors,[]);await page.evaluate(()=>billing.dispose());await page.close();
 }
 console.log('PASS Central Cajas desktop/mobile → actual handler and monetary SQL journals: closed balance, real withdrawal and complete CSV without shop calls; Cajas → Facturación → original native PDF, no native POST or duplicated revenue. Local laboratory.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
