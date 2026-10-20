import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'es-ES'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{const {state}=await import('../src/state.js');state.data.settings.storage_provider_reference={plan:'Free',checked_at:'2026-10-20T00:00:00Z',database_limit_bytes:500*1024*1024,files_limit_bytes:1024*1024*1024,planning_sample_months:9,planning_sample_through:'2026-09-30',planning_sample_files_bytes:3*1024*1024,planning_sample_full_backup_bytes:2*1024*1024};});
 const before=await page.evaluate(()=>JSON.stringify({expenses:window.__mockDb.ops_expenses,documents:window.__mockDb.ops_documents,closings:window.__mockDb.ops_daily_closings}));
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="storage"]').first().click();
 await page.locator('.storage-provider-card').first().waitFor();
 assert.equal(await page.locator('details[data-storage-detail="capacity"]').getAttribute('open'),null);
 assert.equal(await page.locator('details[data-storage-detail="forecast"]').getAttribute('open'),null);
 assert(await page.locator('.storage-backup-strip').isVisible());
 assert.equal(await page.locator('.storage-capacity-row').count(),4);
 assert((await page.locator('details[data-storage-detail="capacity"]').textContent()).includes('La base de datos tiene capacidad propia.'));
 assert.equal(await page.locator('.storage-provider-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1,'Service summaries must be compact full-width rows');
 assert.equal(await page.locator('.storage-provider-card').count(),3);
 const details=page.locator('details[data-storage-detail="technical"]');
 await details.locator('summary').first().click();
 await page.locator('[data-action="storage-refresh"]').click();
 await page.waitForTimeout(150);
 assert.notEqual(await details.getAttribute('open'),null,'Refresh must preserve opened details');
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.locator('#content').evaluate(el=>el.scrollWidth>el.clientWidth+2),false,'Page overflows at '+width);
  const overflow=await page.locator('.storage-provider-card').evaluateAll(cards=>cards.some(el=>el.scrollWidth>el.clientWidth+2));
  assert.equal(overflow,false,'Provider cards overflow at '+width);
  await page.screenshot({path:'artifacts/ui_storage_organized_'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-action="admin-section"][data-section="backups"]').first().click();
 const input=page.locator('#backupRetention');
 assert.equal(await input.getAttribute('readonly'),null);
 assert.equal(await input.getAttribute('max'),'10');
 await page.locator('#backupEnabled').check();
 for(const keep of [10,7]){
  await input.fill(String(keep));
  await page.locator('[data-action="backup-settings-save"]').click();
  await page.locator('[data-confirm="accept"]').click();
  await page.waitForTimeout(200);
  assert.equal(await input.inputValue(),String(keep),'Saved retention must survive refresh');
  assert.equal(await page.evaluate(()=>window.__mockDb.ops_backup_config[0].retention_days),keep,'The submitted value must reach the saved configuration');
 }
 await input.fill('11');
 await page.locator('[data-action="backup-settings-save"]').click();
 await page.waitForTimeout(100);
 assert((await page.locator('#toastHost').innerText()).includes('entre 1 y 10'));
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_backup_config[0].retention_days),7,'Invalid value must not overwrite the configuration');
 assert.equal(await page.evaluate(()=>JSON.stringify({expenses:window.__mockDb.ops_expenses,documents:window.__mockDb.ops_documents,closings:window.__mockDb.ops_daily_closings})),before,'No financial information may change');
 assert.deepEqual(errors,[]);
 console.log('STORAGE ORGANIZATION QA: three providers, responsive cards, preserved details, editable persisted retention, validation and unchanged accounting');
}finally{await browser.close();}
