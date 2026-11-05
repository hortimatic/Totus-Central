import {navigate} from './ui-navigation.mjs';
import {startLocalServer} from './local-static-server.mjs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
import {mkdir} from 'node:fs/promises';
const server=await startLocalServer(),browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})}),errors=[];
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=configuracion',{waitUntil:'networkidle'});
  await page.locator('[data-config-section=appearance]').waitFor();
  assert.equal(await page.locator('[data-config-section]').count(),3,'Configuration has only Interface, Login and APIs');
  assert.equal(await page.locator('#prestashopRoot').count(),0,'No duplicate hidden PrestaShop workspace in Configuration');
  await navigate(page,'prestashop');await page.locator('#prestashopRoot').waitFor();
  assert.equal(await page.locator('[data-config-section]').count(),0,'Independent PrestaShop module remains separate');
  await navigate(page,'configuracion');await page.locator('[data-config-section=appearance]').waitFor();
  for(const [key,label] of [['appearance','Interfaz'],['login','Login'],['connections','APIs']]){
   const tab=page.locator('[data-config-section='+key+']');assert.equal(await tab.innerText(),label);await tab.click();assert.equal(await tab.getAttribute('aria-pressed'),'true');
  }
  const root=page.locator('#connectionsRoot');await root.locator('[data-api-status]').filter({hasText:'conexiones guardadas'}).waitFor();
  assert.equal(await root.locator('[data-api-manager]').count(),1);
  assert.equal(await root.locator('.ai-test-panel,[data-cloudflare-config],.connections-grid,.api-existing-connection').count(),0,'no obsolete duplicate panels');
  assert(!/Gemini|Google AI Studio|Pendiente de preparar/.test(await root.innerText()));
  assert.equal(await root.getByRole('button',{name:'+ Nueva conexión',exact:true}).count(),1);
  await root.getByRole('button',{name:'+ Nueva conexión',exact:true}).click();
  assert.equal(await root.locator('[name=protocol] option[value=gemini]').count(),0);
  for(const name of ['name','protocol','actor_email','endpoint','auth_kind','api_secret','daily_limit'])assert(await root.locator('[name='+name+']').isVisible(),name+' visible at '+width);
  assert.equal(await root.locator('[name=api_secret]').getAttribute('type'),'password');
  await root.locator('[name=api_preset]').selectOption('cohere');await root.locator('[data-provider-guide] a[href="https://docs.cohere.com/docs/compatibility-api"]').waitFor();await root.getByRole('button',{name:'Aplicar datos del proveedor',exact:true}).click();assert.equal(await root.locator('[name=endpoint]').inputValue(),'https://api.cohere.ai/compatibility/v1');assert.equal(await root.locator('[name=model]').inputValue(),'command-a-plus-05-2026');await root.locator('[name=api_preset]').selectOption('groq');await root.getByRole('button',{name:'Aplicar datos del proveedor',exact:true}).click();assert.equal(await root.locator('[name=protocol]').inputValue(),'openai_compatible');assert.equal(await root.locator('[name=endpoint]').inputValue(),'https://api.groq.com/openai/v1');assert.equal(await root.locator('[name=model]').inputValue(),'openai/gpt-oss-20b');await root.locator('[name=protocol]').selectOption('cloudflare');assert(await root.locator('[name=account_id]').isVisible());assert(await root.locator('[name=model]').isVisible());
  assert.equal(await page.locator('#content').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,'fits '+width);
  if(width<=390)assert((await root.getByRole('button',{name:'Guardar conexión',exact:true}).boundingBox()).height>=44,'touch target');
  await mkdir('artifacts/api-manager',{recursive:true});await page.screenshot({path:'artifacts/api-manager/settings-'+width+'.png',fullPage:true});await page.close();
 }
 assert.deepEqual(errors,[]);console.log('API SETTINGS: sole manager, three tabs, no Gemini/legacy panels, private key, provider fields and 320/390/768/1440 layout.');
}finally{await browser.close();await server?.close();}
