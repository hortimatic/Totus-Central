import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {clickModuleLink} from './ui-navigation.mjs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],calls=[];
page.on('pageerror',e=>errors.push(e.message));let mode='ok',release=null,delayStarted=null;
try{
 await page.route('https://generativelanguage.googleapis.com/**',async route=>{
  const request=route.request();if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});return;}
  const body=request.postDataJSON();calls.push(body);
  assert.equal(request.headers()['x-goog-api-key'],'fiction-only-key');assert(!request.url().includes('fiction-only-key'));
  assert.deepEqual(Object.keys(body).sort(),['contents','generationConfig']);assert.equal(body.generationConfig.maxOutputTokens,128);
  assert.match(body.contents[0].parts[0].text,/fictici/);
  if(mode==='delay'){delayStarted?.();await new Promise(resolve=>release=resolve);}
  const text=mode==='html'?'<img src=x onerror=alert(1)>':body.contents[0].parts[0].text.includes('suma')?'10':'CONEXION_TOTUS_OK';
  await route.fulfill({status:mode==='quota'?429:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text}]}}]})}).catch(()=>{});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=configuracion',{waitUntil:'networkidle'});
 await page.locator('.ai-test-panel > summary').click();
 const key=page.locator('[name=aiTestKey]'),button=page.getByRole('button',{name:'Probar Gemini',exact:true}),status=page.locator('[data-ai-test-status]');
 await key.fill('fiction-only-key');await button.click();assert.equal(calls.length,0,'Consent to free tier must be explicit');
 await page.locator('[name=aiTestFree]').check();await button.click();await status.filter({hasText:'Conexión y respuesta comprobadas'}).waitFor();
 assert.equal(await key.inputValue(),'');assert.equal(calls.length,1);
 await page.locator('[name=aiTestTrial]').selectOption('sum');await key.fill('fiction-only-key');await button.click();await page.locator('[data-ai-test-output]').filter({hasText:'10'}).waitFor();assert.equal(calls.length,2);
 mode='quota';await key.fill('fiction-only-key');await button.click();await status.filter({hasText:'Cuota gratuita agotada'}).waitFor();assert.equal(calls.length,3);assert.equal(await key.inputValue(),'');
 mode='html';await key.fill('fiction-only-key');await button.click();await status.filter({hasText:'no coincide'}).waitFor();assert.equal(await page.locator('[data-ai-test-output] img').count(),0);
 mode='delay';const started=new Promise(resolve=>delayStarted=resolve);await key.fill('fiction-only-key');await button.click();await started;
 await page.locator('[data-ai-test-form]').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(calls.length,5,'Pending requests must not duplicate');
 await clickModuleLink(page,page.locator('#nav [data-route=pricing]'));release?.();
 await clickModuleLink(page,page.locator('#nav [data-route=configuracion]'));assert.equal(await key.inputValue(),'');assert.equal(await page.locator('[data-ai-test-output]').isVisible(),false,'Cancelled response must not reach a new screen');
 await page.locator('.ai-test-panel > summary').click();
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.locator('#content').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,'Connection panel must fit at '+width);}
 const manager=await browser.newPage();await manager.goto('http://127.0.0.1:4173/tests/app-mock.html?role=gerente&module=configuracion',{waitUntil:'networkidle'});assert.equal(await manager.locator('.ai-test-panel').count(),0);await manager.close();
 await fs.mkdir('artifacts/interface-design',{recursive:true});await page.screenshot({path:'artifacts/interface-design/gemini-test-panel.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('GEMINI TEST QA: synthetic fixed messages only, ephemeral key, explicit free-tier confirmation, no duplicate/retry, quota/errors, HTML escaping, navigation isolation, permissions and responsive layout.');
}finally{release?.();await browser.close();}
