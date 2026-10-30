import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const admin=await browser.newPage();
 const errors=[];admin.on('pageerror',e=>errors.push(e.message));
 await admin.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__timingClipboard=value;}}}));
 await admin.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await admin.locator('#nav [data-route="administracion"]').click();
 await admin.locator('[data-action="admin-section"][data-section="log"]').click();
 const copy=admin.locator('[data-action="admin-log-timings"]');
 assert.equal(await copy.count(),1,'Admin must have one action in the existing Log toolbar');
 await copy.click();
 const report=await admin.evaluate(()=>window.__timingClipboard);
 assert.match(report,/Totus Central · REN-01/);
 for(const phase of ['Tipo: sesion_recuperada','sesion:','usuario_y_perfil:','carga_principal:','core:ops_expenses:','retiradas_documentales:','pintado_inicio:','arranque_completo:'])
  assert(report.includes(phase),'Missing timing: '+phase);
 for(const privateData of ['qa@example.com','qa-sandbox','00000000X','Calle Pruebas 1','https://'])
  assert(!report.includes(privateData),'Report contained user, financial or URL data');
 assert(!report.includes('documentos de prueba'),'No document contents in diagnostic');
 assert(!report.includes('auditoria:'),'The deferred Log history must not delay or enter initial startup timings');
 assert(!report.includes('almacenamiento:'),'Deferred Storage must not delay initial startup or appear as an awaited phase');
 assert.deepEqual(errors,[],'Instrumented boot must not cause browser errors');
 const manager=await browser.newPage();
 await manager.goto('http://127.0.0.1:4173/tests/app-mock.html?role=gerente',{waitUntil:'networkidle'});
 await manager.locator('#nav [data-route="administracion"]').click();
 await manager.locator('[data-action="admin-section"][data-section="log"]').click();
 assert.equal(await manager.locator('[data-action="admin-log-timings"]').count(),0,'Manager must not see admin-only report');
 const employee=await browser.newPage();
 await employee.goto('http://127.0.0.1:4173/tests/app-mock.html?role=encargado',{waitUntil:'networkidle'});
 assert.equal(await employee.locator('[data-action="admin-log-timings"]').count(),0,'Employee must not see diagnostics');
 // The UI must still show its original retry flow; only the timing status changes.
 const broken=await browser.newPage();
 await broken.addInitScript(()=>{window.__qaFailCore=true;});
 await broken.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();
  const source=(await response.text()).replace('const target=db[this.table];',
   "if(window.__qaFailCore&&this.table==='ops_business_settings'&&this.orderBy.length>0){window.__qaFailCore=false;return {data:null,error:{code:'08006',message:'Fallo ficticio de carga'}};}const target=db[this.table];");
  await route.fulfill({response,body:source});
 });
 await broken.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await broken.getByRole('heading',{name:'No se han podido cargar los datos',exact:true}).waitFor();
 const failedReport=await broken.evaluate(async()=>(await import('../src/startup-timing.js')).startupTimingReport());
 assert.match(failedReport,/carga_principal: [0-9.]+ ms \[error\]/);
 assert.match(failedReport,/arranque_completo: [0-9.]+ ms \[error\]/);
 assert(!failedReport.includes('Fallo ficticio de carga'),'Diagnostic must never expose error response bodies');
 await broken.locator('[data-action="retry-load"]').click();
 await broken.locator('#nav [data-route="inicio"]').waitFor();
 assert.equal(await broken.locator('#pageTitle').innerText(),'Inicio','Original retry functionality must remain intact');
 await broken.close();

 const optional=await browser.newPage();
 await optional.addInitScript(()=>{window.__mockStorageFailure=true;});
 await optional.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await optional.locator('#nav [data-route="inicio"]').waitFor();
 const optionalReport=await optional.evaluate(async()=>(await import('../src/startup-timing.js')).startupTimingReport());
 assert(!optionalReport.includes('almacenamiento:'),'Optional deferred Storage failure must not enter startup timings');
 assert.match(optionalReport,/arranque_completo: [0-9.]+ ms$/m,'Optional storage error must not mark whole boot failed');
 assert(!optionalReport.includes('Servicio Storage temporalmente'),'Do not export optional failure details');
 await optional.close();
 await employee.close();await manager.close();await admin.close();
 console.log('STARTUP TIMING BROWSER: boot phases, clipboard, admin-only visibility, no sensitive data, no page errors');
}finally{await browser.close();}
