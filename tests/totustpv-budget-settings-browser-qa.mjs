import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true,port:0}),browser=await chromium.launch({headless:true});
try{await mkdir('qa-artifacts/budget-settings',{recursive:true});for(const width of [1440,1024,390,360]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/tests/totustpv-workspace.html`);
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{budgetOptions}=await import('/src/totustpv/budget-options.js');
  const f=window.budgetSettingsFixture={manager:true,rules:budgetOptions(),writes:[],lost:true};
  const drawer={id:'drawer',storeId:'store',connectionId:'connection',shopId:1,name:'Caja de consulta',canSell:false,canOpen:false,canReconcile:true};
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Establecimiento ficticio'}],drawers:[drawer],sessions:[]}),selectWorkstation:async()=>{},categories:async()=>[],searchProducts:async()=>[]};
  f.workspace=createTpvWorkspace({actor:()=>({id:'manager',active:true,full_name:'Responsable'}),can:action=>action==='view',canAssign:()=>f.manager,confirm:async()=>true,autoOpen:true,createLiveAdapter:()=>adapter,
   budgetSettingsStore:async(_drawer,intent)=>{if(!intent)return structuredClone(f.rules);if(!f.manager)throw Error('TPV_BUDGET_SETTINGS_FORBIDDEN');f.writes.push(structuredClone(intent));if(intent.expectedRevision!==f.rules.revision&&!(intent.prefix===f.rules.prefix&&intent.enabled===f.rules.enabled&&intent.hidePrices===f.rules.hidePrices&&intent.lastNumber===f.rules.lastNumber))throw Error('TPV_BUDGET_SETTINGS_STALE');f.rules={enabled:intent.enabled,prefix:intent.prefix,lastNumber:intent.lastNumber,hidePrices:intent.hidePrices,revision:1};if(f.lost){f.lost=false;throw Error('Lost fixture response');}return structuredClone(f.rules);}});
  f.workspace.mount(document.querySelector('#tpv'));
 });
 const open=async()=>{await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();};await page.locator('[data-tpv-action=session]').waitFor();await open();
 const nav=page.getByRole('navigation',{name:'Apartados de configuración'});if(width<=700)await nav.getByLabel('Ir a un apartado').selectOption({label:'Presupuestos · este establecimiento'});else await nav.getByRole('button',{name:'Presupuestos · este establecimiento',exact:true}).click();
 const form=page.locator('[data-tpv-form=budget-settings]');await form.locator('[name=budget-enabled]').check();await form.locator('[name=budget-prefix]').fill('PROP-');await form.locator('[name=budget-lastNumber]').fill('43');await form.locator('[name=budget-hidePrices]').check();
 await form.getByRole('button',{name:'Guardar presupuestos',exact:true}).click();await page.getByRole('alert').filter({hasText:'Tus cambios se conservan'}).waitFor();assert.equal(await form.locator('[name=budget-prefix]').inputValue(),'PROP-');await form.getByRole('button',{name:'Guardar presupuestos',exact:true}).click();await page.getByText('Presupuestos configurados para este establecimiento.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>budgetSettingsFixture.writes[0]),await page.evaluate(()=>budgetSettingsFixture.writes[1]));
 await page.evaluate(()=>budgetSettingsFixture.workspace.mount(document.querySelector('#tpv')));await open();assert.equal(await form.locator('[name=budget-hidePrices]').isChecked(),true);assert.equal(await form.locator('[name=budget-prefix]').inputValue(),'PROP-');assert.equal(await form.locator('[name=budget-lastNumber]').inputValue(),'43');
 if(width<=700)await nav.getByLabel('Ir a un apartado').selectOption({label:'Presupuestos · este establecimiento'});else await nav.getByRole('button',{name:'Presupuestos · este establecimiento',exact:true}).click();
 await page.screenshot({path:`qa-artifacts/budget-settings/settings-${width}.png`,fullPage:true});
 await page.evaluate(()=>budgetSettingsFixture.manager=false);await form.getByRole('button',{name:'Volver a consultar',exact:true}).click();await page.getByText('Configuración de presupuestos actualizada.',{exact:true}).waitFor();assert.equal(await form.locator('[name=budget-prefix]').isDisabled(),true);
 const writes=await page.evaluate(()=>budgetSettingsFixture.writes.length);await form.evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await page.getByRole('alert').filter({hasText:'No tienes permiso para configurar los presupuestos'}).waitFor();assert.equal(await page.evaluate(()=>budgetSettingsFixture.writes.length),writes);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS budget settings UI: four widths, common settings navigation, manager without sale permission, same-intent lost-reply retry, remount persistence, revoked edit permission and no financial action. Fictional settings transport.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
