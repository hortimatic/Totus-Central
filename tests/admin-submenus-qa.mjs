import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true,locale:'es-ES'});
const errors=[],steps=[];
page.on('pageerror',err=>errors.push('JS '+err.message));
page.on('dialog',dialog=>dialog.accept());
const section=async id=>{
 await page.locator('[data-action="admin-section"][data-section="'+id+'"]').first().click();
 await page.waitForTimeout(50);
 assert.equal(await page.locator('[data-action="admin-section"][data-section="'+id+'"]').first().getAttribute('class').then(x=>x.includes('active')),true,'Subpestaña no activada '+id);
 steps.push('submenu:'+id);
};
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="administracion"]').click();
 for(const id of ['usuarios','roles','negocio','fiscal','storage','backups','log']){
  await section(id);
  assert((await page.locator('#content').innerText()).trim().length>50,'Submenú vacío '+id);
 }
 // Fiscal settings must reject invalid text, preserving the persisted VAT rate.
 await section('fiscal');
 const originalVat=await page.evaluate(()=>window.__mockDb.ops_business_settings[0].default_sales_vat_rate);
 await page.locator('#cfgVat').fill('no-es-un-numero');
 await page.locator('[data-action="config-save"]').click();
 await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_business_settings[0].default_sales_vat_rate),originalVat,
  'Texto no numérico cambió silenciosamente el IVA en configuración');
 assert(/(importe no válido|número válido)/.test(await page.locator('#toastHost').innerText()),
  'La configuración no explica el rechazo de un valor no numérico');
 assert.equal(await page.locator('#cfgVat').inputValue(),'no-es-un-numero',
  'Perdió el texto escrito tras un error de validación');
 await page.locator('#cfgVat').fill('21,5');
 await page.locator('[data-action="config-save"]').click();
 await page.waitForTimeout(75);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_business_settings[0].default_sales_vat_rate),21.5,
  'La configuración no admite decimales con coma');
 await page.locator('#cfgVat').fill(String(originalVat));
 await page.locator('[data-action="config-save"]').click();
 await page.waitForTimeout(75);
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_business_settings[0].default_sales_vat_rate),originalVat,
  'No se restauró el valor previo de prueba');
 steps.push('fiscal:invalid-number-rejected/comma-accepted/restored');

 await section('fiscal');
 await page.locator('[data-action="expense-category-new"]').click();
 await page.locator('#ecCode').fill('QA_MERCH');
 await page.locator('#ecName').fill('Mercancía QA');
 await page.locator('[data-action="expense-category-save"]').click();
 await page.waitForTimeout(70);
 const parent=await page.evaluate(()=>window.__mockDb.ops_expense_categories.find(c=>c.code==='QA_MERCH'));
 assert(parent&&!parent.parent_id,'Categoría principal no guardada');
 await page.locator('[data-action="expense-category-new"]').click();
 await page.locator('#ecCode').fill('QA_MERCH_SALES');
 await page.locator('#ecName').fill('Sales de prueba');
 await page.locator('#ecParent').selectOption(parent.id);
 await page.locator('[data-action="expense-category-save"]').click();
 await page.waitForTimeout(70);
 const sub=await page.evaluate(()=>window.__mockDb.ops_expense_categories.find(c=>c.code==='QA_MERCH_SALES'));
 assert(sub?.parent_id===parent.id,'Subcategoría no enlazada con su principal');
 assert(await page.locator('.expense-category-group',{hasText:'Mercancía QA'}).locator('.expense-category-child').count()===1,'Subcategoría no se muestra debajo de la principal');
 assert(await page.locator('.expense-category-group',{hasText:'Mercancía QA'}).locator('.expense-category-parent').count()===1,'No aparece bloque de categoría principal');
 assert(await page.locator('.expense-category-group',{hasText:'Mercancía QA'}).locator('.expense-category-parent [data-action="expense-category-delete"]').count()===0,'Permite eliminar principal con hijos');
 await page.locator('[data-action="expense-category-edit"][data-id="'+sub.id+'"]').click();
 assert.equal(await page.locator('#ecParent').inputValue(),parent.id,'Edición no recupera la categoría padre');
 await page.locator('#ecName').fill('Resistencias QA');
 await page.locator('[data-action="expense-category-save"]').click();
 await page.waitForTimeout(70);
 assert((await page.locator('#content').innerText()).includes('Resistencias QA'),'La edición de subcategoría no actualiza la lista');
 await page.locator('#nav [data-route="gastos"]').click();
 await page.locator('[data-action="expense-new"]').first().click();
 const selectValues=await page.locator('#exLineCategory_0 option').allTextContents();
 assert(selectValues.some(v=>v.includes('Mercancía QA → Resistencias QA')),'Gastos no muestra la jerarquía de categorías');
 await page.locator('#nav [data-route="administracion"]').click();
 await section('fiscal');
 steps.push('categorias:crear-principal/crear-subcategoria/editar/mostrar-en-gasto/proteger-borrado');

 await section('backups');
 assert(await page.locator('#backupEnabled').count()===1,'El programador no se muestra');
 assert(!(await page.locator('#backupEnabled').isChecked()),'El programador no debe activarse solo');
 await page.locator('#backupFrequency').selectOption('weekly');
 assert(await page.locator('#backupWeekdayWrapper').isVisible(),'Frecuencia semanal sin selector de día');
 assert(!(await page.locator('#backupMonthdayWrapper').isVisible()),'Día mensual visible en semanal');
 await page.locator('#backupTime').fill('09:35');
 await page.locator('#backupWeekday').selectOption('5');
 await page.locator('#backupRetention').fill('15');
 await page.locator('#backupFolder').fill('copia_semanal');
 await page.locator('[data-action="backup-settings-save"]').click();
 await page.waitForTimeout(70);
 let config=await page.evaluate(()=>window.__mockDb.ops_backup_config[0]);
 assert.equal(config.frequency,'weekly');
 assert.equal(config.run_hour,9);
 assert.equal(config.run_minute,35);
 assert.equal(config.weekday,5);
 assert.equal(config.retention_days,15);
 assert.equal(config.destination_folder,'copia_semanal');
 assert.equal(config.enabled,false);
 steps.push('backup:weekly/schedule/destination/retention/save');
 await page.locator('#backupFrequency').selectOption('monthly');
 assert(await page.locator('#backupMonthdayWrapper').isVisible(),'Frecuencia mensual sin día');
 await page.locator('#backupMonthday').selectOption('12');
 await page.locator('#backupRetention').fill('5');
 await page.locator('[data-action="backup-settings-save"]').click();
 config=await page.evaluate(()=>window.__mockDb.ops_backup_config[0]);
 assert.equal(config.month_day,12);assert.equal(config.retention_days,5);
 steps.push('backup:monthly');
 await page.locator('#backupFrequency').selectOption('daily');
 await page.locator('#backupEnabled').check();
 await page.locator('#backupRetention').fill('10');
 await page.locator('[data-action="backup-settings-save"]').click();
 config=await page.evaluate(()=>window.__mockDb.ops_backup_config[0]);
 assert.equal(config.enabled,true);assert.equal(config.frequency,'daily');assert.equal(config.retention_days,10);
 steps.push('backup:daily+enabled');
 await page.locator('#backupEnabled').uncheck();
 await page.locator('[data-action="backup-settings-save"]').click();
 assert.equal((await page.evaluate(()=>window.__mockDb.ops_backup_config[0].enabled)),false);
 steps.push('backup:disabled');
 await page.evaluate(()=>{
  const old={id:'old-qa-archive',mode:'scheduled',status:'success',started_at:new Date(Date.now()-16*86400000).toISOString(),storage_path:'automaticas/antigua.totusbackup',size_bytes:42,rows_count:1,files_count:0};
  window.__mockDb.ops_backup_runs.push(old);
  window.__mockUploads.set('business-backups/'+old.storage_path,new Blob(['COPIA ANTIGUA DE ENSAYO']));
 });
 await page.locator('[data-action="backup-run-now"]').click();
 await page.waitForTimeout(140);
 const snap=await page.evaluate(()=>window.__mockDb.ops_backup_runs[0]);
 assert.equal(snap?.status,'success','La copia privada no se ha guardado');
 const rotation=await page.evaluate(()=>({
  old:window.__mockDb.ops_backup_runs.find(x=>x.id==='old-qa-archive'),
  leftover:window.__mockUploads.has('business-backups/automaticas/antigua.totusbackup')
 }));
 assert.equal(rotation.old?.status,'expired','La copia con más de 10 días no se ha rotado');
 assert.equal(rotation.leftover,false,'La rotación dejó ocupando espacio la copia anterior');
 steps.push('backup:rotation-retention-10-days');
 assert(snap.storage_path.endsWith('.totusbackup'));
 assert(await page.locator('[data-action="backup-history-download"]').count()===1,'La copia no es descargable');
 steps.push('backup:server-created');
 const dl=page.waitForEvent('download',{timeout:10000});
 await page.locator('[data-action="backup-history-download"]').click();
 const filename=(await dl).suggestedFilename();
 assert(filename.endsWith('.totusbackup'),'Formato de descarga incorrecto');
 steps.push('backup:server-download');
 await page.locator('[data-action="backup-history-verify"]').click();
 await page.locator('#modalHost').getByText('Integridad SHA-256 comprobada.',{exact:false}).waitFor({state:'visible'});
 assert((await page.locator('#modalHost').innerText()).includes('Registros'));
 await page.locator('#modalHost .close-btn').click();
 steps.push('backup:server-verified');
 // A local copy is still independently downloadable.
 const local=page.waitForEvent('download',{timeout:10000});
 await page.locator('[data-action="backup-create"]').click();
 assert((await local).suggestedFilename().endsWith('.totusbackup'));
 steps.push('backup:local-download');
 await page.evaluate(async()=>{
  const when=new Date('2026-10-14T11:00:00Z').toISOString();
  const events=[
   {id:'l1',created_at:when,user_email:'ana@example.com',area:'gastos',action:'crear',detail:{invoice:'F-1'}},
   {id:'l2',created_at:'2026-09-01T10:00:00Z',user_email:'oscar@example.com',area:'cajas',action:'cierre',detail:{drawer:'Vape'}},
   {id:'l3',created_at:'2026-10-15T09:00:00Z',user_email:'ana@example.com',area:'gastos',action:'editar',detail:{invoice:'F-2'}}
  ];
  window.__mockDb.ops_audit_log.splice(0,window.__mockDb.ops_audit_log.length,...events);
  const state=(await import('../src/state.js')).state;
  state.data.audit=events;
 });
 await section('log');
 assert(await page.locator('#logFrom').count()===1,'Faltan filtros de fecha');
 await page.locator('#logFrom').fill('2026-10-01');
 await page.locator('#logTo').fill('2026-10-31');
 await page.locator('#logArea').selectOption('gastos');
 await page.locator('#logActor').fill('ana@');
 await page.locator('#logQuery').fill('F-1');
 await page.locator('[data-action="admin-log-filter"]').click();
 assert(await page.locator('#content .data-table tbody tr').count()===1,'Filtros de Log no coinciden');
 await page.locator('[data-action="admin-log-detail"]').click();
 assert((await page.locator('#modalHost').innerText()).includes('F-1'),'Falta el detalle de evento');
 await page.locator('#modalHost .close-btn').click();
 steps.push('log:date/user/area/query/detail');
 const exportReady=page.waitForEvent('download',{timeout:10000});
 await page.locator('[data-action="admin-log-export"]').click();
 const actual=await exportReady;
 const csv=await fs.readFile(await actual.path(),'utf8');
 assert(csv.includes('F-1')&&!csv.includes('F-2'),'Export Log no respeta filtros');
 assert(csv.startsWith('\uFEFF'),'Export Log sin BOM Excel');
 steps.push('log:CSV-filtered');
 await page.locator('[data-action="admin-log-clear"]').click();
 assert(await page.locator('#content .data-table tbody tr').count()===3,'No se limpiaron filtros');
 await page.locator('[data-action="admin-log-refresh"]').click();
 assert(await page.locator('#content .data-table tbody tr').count()===3,'Actualizar Log perdió registros');
 steps.push('log:clear+refresh');
 assert(!errors.length,'Errores JavaScript: '+errors.join('; '));
 console.log('ADMIN SUBMENUS QA: '+steps.join(', ')+' OK');
}finally{await browser.close()}
