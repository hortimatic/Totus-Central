import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const {folder}=JSON.parse(fs.readFileSync('artifacts/published-graph-location.json','utf8'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4173/'+folder+'/mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route="inicio"]').waitFor();
 assert.equal(await page.evaluate(()=>window.__supabaseCreateCount),1,'Boot and OneDrive maintenance must share one client');
 await page.locator('#nav [data-route="cotejos"]').click();
 await page.locator('[data-action="stock-new"]').waitFor();
 assert.equal(await page.evaluate(()=>window.__supabaseCreateCount),1,'Lazy Recepciones must reuse the existing API client');
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="backups"]').click();
 assert.equal(await page.locator('[data-action="backup-history-restore"]').count(),0);
 await page.evaluate(()=>window.__mockDb.ops_backup_runs.push({id:crypto.randomUUID(),status:'success',mode:'manual',started_at:'2026-10-24T12:00:00Z',finished_at:'2026-10-24T12:01:00Z',storage_path:'qa/graph.totusbackup',storage_provider:'onedrive',size_bytes:100,archive_manifest:{version:4,file_count:1}}));
 await page.getByRole('button',{name:'Actualizar historial',exact:true}).click();
 await page.locator('[data-action="backup-history-restore"]').waitFor();
 assert.equal(await page.locator('[data-action="backup-history-restore"]').count(),1,'Refresh must show the backup completed on the server');
 assert.equal(await page.evaluate(()=>window.__supabaseCreateCount),1);
 assert.deepEqual(errors,[]);
 console.log('PUBLISHED BROWSER QA: boot, lazy OneDrive/Recepciones and backup refresh use one client and one state graph');
}finally{await browser.close()}
