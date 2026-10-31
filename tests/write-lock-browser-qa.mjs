import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await clickModuleLink(page,page.locator('#nav [data-route="facturacion"]'));
 await page.locator('[data-action="billing-section"][data-section="plantillas"]').click();
 await page.locator('[data-action="template-edit"]').first().click();
 await page.evaluate(async()=>{
  const api=await import('../src/api.js'),original=api.sb.from.bind(api.sb);
  window.__qaStarted=0;
  window.__qaGate=new Promise(resolve=>window.__qaRelease=resolve);
  api.sb.from=table=>{
   const q=original(table),single=q.single.bind(q);
   q.single=async()=>{
    if(table==='ops_document_templates'&&q.mode==='insert'){
     window.__qaStarted++;await window.__qaGate;
    }
    return single();
   };return q;
  };
  const button=document.querySelector('[data-action="template-duplicate"]');
  button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 });
 await page.waitForFunction(()=>window.__qaStarted>0);
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.__qaStarted),1,'One rapid double click must start exactly one duplicate operation');
 await page.evaluate(()=>window.__qaRelease());
 await page.getByText('Plantilla duplicada.',{exact:true}).waitFor();
 const templates=await page.evaluate(()=>window.__mockDb.ops_document_templates);
 assert.equal(templates.length,2);
 assert.equal(templates.filter(t=>t.default_invoice).length,1);
 console.log('WRITE LOCK BROWSER QA: concurrent clicks create one copy and preserve invoice defaults');
}finally{await browser.close()}
