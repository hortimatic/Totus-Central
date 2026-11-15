import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {clickModuleLink} from './ui-navigation.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:977,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(()=>{for(const key of ['products','families','product_variants','product_provider_prices','product_competitor_prices','consultations'])window.__mockDb[key]=[];});
 await clickModuleLink(page,page.locator('#nav [data-route=pricing]'));await page.locator('[data-action=pricing-source][data-source=local]').click();
 await page.getByRole('button',{name:'Nuevo estudio',exact:false}).click();
 try{await page.locator('#prName').waitFor({timeout:4000});}catch(error){throw Error(error.message+'; browser='+JSON.stringify(errors)+'; notices='+await page.locator('.toast').allTextContents());}
 await page.locator('#prName').fill('Estudio QA sin familias');await page.locator('#prSku').fill('QA-EMPTY');await page.locator('#prPvp').fill('10');await page.locator('#prInitialProviderName').fill('Proveedor QA');await page.locator('#prInitialCost').fill('4');
 await page.locator('[data-action=product-save]').click();await page.getByText('Producto guardado.',{exact:true}).last().waitFor();
 assert.equal(await page.evaluate(()=>window.__mockDb.products.length),1);assert.equal(await page.evaluate(()=>window.__mockDb.families.length),0);assert.deepEqual(errors,[]);
 console.log('PRICE EMPTY: new study, no families or products, save and persisted readback PASS; fictional database only.');
}finally{await browser.close();}
