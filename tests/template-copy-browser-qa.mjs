import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const id=await page.evaluate(async()=>{const t=window.__mockDb.ops_document_templates[0];t.code='A'.repeat(50);await (await import('../src/api.js')).loadCore();return t.id;});
 await clickModuleLink(page,page.locator('#nav [data-route="facturacion"]'));
 await page.locator('[data-action="billing-section"][data-section="plantillas"]').click();
 for(let n=2;n<=3;n++){
  await page.locator('[data-action="template-edit"][data-id="'+id+'"]').click();
  await page.locator('[data-action="template-duplicate"][data-id="'+id+'"]').click();
  await page.waitForFunction(n=>window.__mockDb.ops_document_templates.length===n,n,{timeout:3000}).catch(async e=>{console.error(await page.locator('#toastHost').innerText());console.error(await page.evaluate(()=>window.__mockDb.ops_document_templates.map(t=>({id:t.id,code:t.code}))));throw e;});
 }
 const templates=await page.evaluate(()=>window.__mockDb.ops_document_templates);
 assert.equal(new Set(templates.map(t=>t.code)).size,3);
 for(const t of templates.slice(1)){assert(t.code.length<=50);assert.equal(t.default_invoice,false);assert.equal(t.default_proforma,false);}
 assert.equal(templates[0].default_invoice,true);
 console.log('TEMPLATE COPY BROWSER QA: long code duplicates twice without freezing or replacing defaults');
}finally{await browser.close()}
