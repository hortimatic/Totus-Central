import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from '../local-static-server.mjs';
export async function exercisePaymentSettingsBrowser({handle,actor,preferences}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin==='http://127.0.0.1:4173')return route.continue();return route.abort('blockedbyclient');});
  await page.route('**/__payment_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__payment_fixture',async route=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:route.request().postData()}));return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  const mount=()=>page.evaluate(async actor=>{
   window.paymentWorkspace?.dispose();window.fixture?.workspace?.dispose();
   const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.paymentWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Operador de pruebas'}),can:()=>true,canAssign:()=>true,confirm:async()=>true,autoOpen:true,
    workspacePreferences:async(drawer,value)=>{const r=await fetch('/__payment_preferences',{method:'POST',body:JSON.stringify({drawer,value})});return r.json();},
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const r=await fetch('/__payment_fixture',{method:'POST',body:JSON.stringify(payload)}),result=await r.json();if(!r.ok||result.error)throw Error(result.error||'Fixture failed');return result;}})});
   paymentWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  const settings=async()=>{await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();await page.locator('[data-tpv-form="payment-settings"]').waitFor();};
  await mount();await settings();
  let form=page.locator('[data-tpv-form="payment-settings"]');
  await form.locator('[name="enabled:cash"]').check();await form.locator('[name="enabled:card"]').check();
  await form.locator('[name="label:cash"]').fill('Datáfono');await form.locator('[name="label:card"]').fill('Datáfono');
  await form.getByRole('button',{name:'Guardar medios de cobro'}).click();await page.getByRole('alert').filter({hasText:'Revisa los medios de cobro'}).waitFor();
  assert.equal(await form.locator('[name="label:cash"]').inputValue(),'Datáfono');
  assert.equal(await form.locator('[name="enabled:cash"]').isChecked(),true);
  await form.locator('[name="enabled:cash"]').uncheck();await form.locator('[name="label:cash"]').fill('Efectivo');
  await form.locator('[name="label:card"]').fill('Tarjeta del mostrador');
  await form.getByRole('button',{name:'Guardar medios de cobro'}).click();await page.getByText('Medios de cobro guardados para esta caja.',{exact:true}).waitFor();
  await mount();await settings();form=page.locator('[data-tpv-form="payment-settings"]');
  assert.equal(await form.locator('[name="enabled:cash"]').isChecked(),false);assert.equal(await form.locator('[name="label:card"]').inputValue(),'Tarjeta del mostrador');
  await mkdir('artifacts/totustpv-payment-settings',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:`artifacts/totustpv-payment-settings/native-${width}.png`,fullPage:true});}
  assert.deepEqual(errors,[]);console.log('PASS native payment settings browser: invalid save retains names/checks, card-only settings persist through remount, desktop/mobile without overflow.');
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
