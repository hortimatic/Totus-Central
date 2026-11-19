import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from '../local-static-server.mjs';
/** UI and native document evidence share the real handler and migrated local
 * ledger. Only authentication and HTTPS-to-loopback delivery are fixtures. */
export async function exerciseNativeBillingBrowser({handle,actor,selection,saleId,orderId,posts}){
 const before=posts(),server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:950},acceptDownloads:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('nativeBillingCall',async body=>{
   const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));
   const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
  });
  await page.goto('http://127.0.0.1:4173/tests/totustpv-billing.html');
  await page.evaluate(async args=>{
   const {createTpvBillingUI}=await import('/src/totustpv/billing-ui.js');window.billing=createTpvBillingUI({actor:()=>args.actor,client:()=>nativeBillingCall});
   await billing.mount(document.querySelector('#billing'),{connectionId:args.selection.connectionId,shopId:args.selection.shopId,saleId:args.saleId});
  },{actor,selection,saleId});
  await page.getByRole('button',{name:'Descargar factura',exact:true}).waitFor();
  await page.getByText('Pedido #'+orderId+' ·',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`qa-artifacts/tpv-native-billing-${width}.png`,fullPage:true});
  for(const button of [page.getByRole('button',{name:'Descargar factura',exact:true}),page.getByRole('button',{name:/^Abono 1 ·/})]){
   const downloadPromise=page.waitForEvent('download');await button.click();const download=await downloadPromise;
   const bytes=await fs.readFile(await download.path());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
   await page.getByText('Documento preparado para descargar.',{exact:true}).waitFor();
  }
  assert.deepEqual(errors,[]);await page.evaluate(()=>billing.dispose());await page.close();
 }assert.equal(posts(),before);console.log('PASS Facturación desktop/mobile → real Central handler → scoped SQL journal → native invoice and credit-note PDF downloads; deep-linked sale, no overflow and no native POST. Local only.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
