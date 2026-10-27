import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const fixture=await page.evaluate(async()=>{
  const db=window.__mockDb,shop=db.ops_stores.find(s=>db.ops_cash_drawers.filter(d=>d.store_id===s.id).length===1),drawer=db.ops_cash_drawers.find(d=>d.store_id===shop.id),date=new Date().toISOString().slice(0,10),id=crypto.randomUUID();
  const origin={kind:'closing_source_snapshot',drawers:[{name:drawer.name,opening:100,closing:150,al_fin:200,comment:'Prueba de origen'}],expected_drawers:1,cash_reconciliation:{version:1,scope:'store',status:'accepted',total:200},card_sales:100,withdrawals:50,bank_date:date};
  db.ops_business_settings[0].closed_through='2026-09-30';db.ops_business_settings[0].default_sales_vat_rate=10;
  db.ops_daily_closings.push({id,store_id:shop.id,business_date:date,entry_mode:'source_snapshot',status:'cerrado',reported_total_sales:200,source_ref:JSON.stringify(origin),include_in_income:true,opening_cash:100,cash_sales:100,card_sales:100,cash_withdrawals:50,actual_cash:150,updated_at:'2026-10-27T00:00:00Z'});
  db.team_members.push({id:crypto.randomUUID(),email:'worker@qa.invalid',full_name:'Usuario de prueba',role:'gerente',active:true});await(await import('../src/api.js')).loadCore();return {id,drawer:drawer.id,origin};
 });
 const nav=r=>page.locator('#nav [data-route="'+r+'"]').click();
 await nav('administracion');await page.locator('[data-action="user-permissions"][data-email="worker@qa.invalid"]').click();
 for(const module of ['equipo','tareas']){assert.equal(await page.locator('#perm_'+module+'_view').count(),1);await page.locator('#perm_'+module+'_create').uncheck();}
 await page.locator('[data-action="user-permissions-save"]').click();await page.waitForFunction(()=>window.__mockDb.ops_user_permissions.length===11);await page.getByText('Permisos actualizados.',{exact:true}).last().waitFor();
 await nav('cajas');await page.locator('[data-action="closing-edit"][data-id="'+fixture.id+'"]').click();await page.getByRole('button',{name:'Modificar cierre',exact:true}).click();
 assert.equal(await page.locator('#clReported').inputValue(),'200');assert.equal(await page.locator('#drOpen_'+fixture.drawer).inputValue(),'100');assert.equal(await page.locator('#drClose_'+fixture.drawer).inputValue(),'150');assert.equal(await page.locator('#drCard_'+fixture.drawer).inputValue(),'100');
 for(const key of ['Bizum','Online','Other','CashExpense','ExtraIn','ExtraOut'])await page.locator('#dr'+key+'_'+fixture.drawer).fill('0');
 await page.locator('[data-action="closing-save-close"]').click();await page.waitForFunction(id=>window.__mockDb.ops_daily_closings.find(x=>x.id===id).entry_mode==='manual',fixture.id);
 const saved=await page.evaluate(id=>window.__mockDb.ops_daily_closings.find(x=>x.id===id),fixture.id);assert.equal(saved.include_in_income,true);assert.deepEqual(JSON.parse(saved.source_ref),fixture.origin);assert.equal(Number(saved.reported_total_sales),200);assert.equal(await page.locator('[data-action="closing-reopen"]').count(),1);
 await nav('facturacion');await page.locator('[data-action="invoice-new"]').first().click();assert.equal(await page.locator('#ivVat_0').inputValue(),'10','New invoice proposes configured VAT');await page.locator('[data-action="invoice-line-add"]').click();assert.equal(await page.locator('#ivVat_1').inputValue(),'10');await page.locator('[data-action="invoice-back"]').first().click();await page.getByRole('button',{name:'Salir sin guardar',exact:true}).click();
 await nav('administracion');await page.locator('[data-action="admin-section"][data-section="log"]').click();await page.locator('[data-action="admin-log-refresh"]').click();
 await page.waitForFunction(()=>window.__mockDb.ops_audit_log.some(x=>x.action==='abrir_modulo'&&x.area==='cajas'));
 assert(await page.evaluate(()=>window.__mockDb.ops_audit_log.some(x=>x.action==='abrir_seccion'&&x.detail.referencia==='log')));
 await page.locator('[data-action="admin-section"][data-section="storage"]').click();await page.evaluate(async()=>{(await import('../src/api.js')).sb.functions.invoke=async()=>({error:{context:{json:async()=>({error:'Fallo ficticio de OneDrive'})}}});});await page.locator('[data-storage-detail="onedrive"] > summary').click();await page.locator('[data-action="onedrive-refresh"]').click();await page.getByText(/No se pudo actualizar su estado/).waitFor();
 const restricted=await browser.newPage();restricted.on('pageerror',e=>errors.push(e.message));
 await restricted.goto('http://127.0.0.1:4173/tests/app-mock.html?role=gerente',{waitUntil:'networkidle'});
 await restricted.evaluate(async()=>{window.__mockDb.ops_user_permissions=['equipo','tareas'].map(module=>({email:'qa@example.com',module,can_view:false,can_create:false,can_edit:false,can_delete:false,can_export:false}));await(await import('../src/api.js')).loadCore();});
 await restricted.locator('#nav [data-route="gastos"]').click();
 for(const module of ['equipo','tareas'])assert.equal(await restricted.locator('#nav [data-route="'+module+'"]').count(),0,'Denied module must disappear from navigation');
 for(const target of ['chat','tasks'])await restricted.locator('[data-header="'+target+'"]').waitFor({state:'hidden',timeout:2000});
 assert.equal(await restricted.locator('#nav [data-route="gastos"]').isVisible(),true,'Unrelated permitted module remains available');
 await restricted.locator('#nav [data-route="inicio"]').click();
 assert.equal(await restricted.locator('#tasksHomeSummary').innerText(),'Tu cuenta no tiene acceso al calendario de tareas.','Denied calendar must not remain in an endless loading state');
 assert.deepEqual(errors,[]);console.log('OPERATIONAL ADMIN BROWSER: 11 module controls, editable imported closing, preserved source and fiscal flag, configured invoice VAT, live navigation log and denied header buttons verified.');
}finally{await browser.close();}
