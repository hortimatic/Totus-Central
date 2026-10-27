import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import {RECOVERY_TABLES,archiveHash} from '../src/recovery-core.js';
import {createPartitionedBackup} from '../supabase/functions/totus-backup-run/partitioned-job.js';
const objects=new Map(),id='11111111-1111-4111-8111-111111111111',root='automaticas/browser.totusbackup';
const database=Object.fromEntries(RECOVERY_TABLES.map(t=>[t,[]]));database.ops_documents=[{id:'test',storage_path:'docs/test.pdf'}];
const code=new JSZip();code.file('README.md','synthetic source');const codeBytes=await code.generateAsync({type:'uint8array'});
const engine=createPartitionedBackup({Zip:JSZip,hash:archiveHash,readOriginal:async()=>new Uint8Array([1,2,3]),readCode:async()=>({bytes:codeBytes,revision:'a'.repeat(40)}),writeComponent:async(p,b)=>objects.set(p,Uint8Array.from(b))});
let job=await engine.start({database,project_ref:'simulation',database_instance:id,schema_hash:'a'.repeat(64),revision:'b'.repeat(64),created_at:'2026-10-22T00:00Z',identities:[],storage:{'business-documents':['docs/test.pdf'],'business-assets':[]}},root),result;
do{result=await engine.advance(job);job=result.job;}while(!result.complete);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({acceptDownloads:true,locale:'es-ES',viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async({files,index,manifest,id,root})=>{
  const {sb}=await import('../src/api.js'),{state}=await import('../src/state.js'),previous=sb.functions.invoke;
  window.qaExpiry=new Date(Date.now()+15*86400000).toISOString().slice(0,10);
  sb.functions.invoke=async(name,opts)=>{
   if(name!=='totus-onedrive')return previous(name,opts);
   if(opts.body.action==='save-expiry'){window.qaExpiry=opts.body.expires_at;return {data:{saved:true},error:null};}
   if(['status','maintenance-status'].includes(opts.body.action))return {data:{configured:true,connected:true,credential_expires_at:window.qaExpiry,mirror:{total:0,verified:0,pending:0},backups:{verified:1,maximum:10},quota:{available:true,total:1073741824,used:100,remaining:1073741724}},error:null};
   throw Error('Unexpected action '+opts.body.action);
  };
  const download=sb.storage.from.bind(sb.storage),map=new Map(files.map(([p,b])=>[p,new Blob([Uint8Array.from(b)])]));
  sb.storage.from=bucket=>{const client=download(bucket);return {...client,download:async path=>map.has(path)?{data:map.get(path),error:null}:client.download(path)};};
  state.data.backupRuns=[{id,status:'success',storage_provider:'supabase',storage_path:root,archive_manifest:manifest,archive_sha256:index.sha256,size_bytes:index.size,started_at:new Date().toISOString()}];
  window.qaBusinessBefore=JSON.stringify({expenses:window.__mockDb.ops_expenses,documents:window.__mockDb.ops_documents,closings:window.__mockDb.ops_daily_closings});
 },{files:[...objects].map(([p,b])=>[p,Array.from(b)]),index:result.index,manifest:result.manifest,id,root});
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="storage"]').click();
 await page.locator('[data-credential-notice]').waitFor();
 assert((await page.locator('[data-credential-notice]').innerText()).includes('Renueva la clave'));
 await page.locator('details[data-storage-detail="credential-settings"] > summary').click();
 const expiry=new Date(Date.now()+180*86400000).toISOString().slice(0,10);
 await page.locator('#odCredentialExpiry').fill(expiry);
 await page.locator('[data-action="onedrive-expiry-save"]').click();
 await page.getByText('Primer aviso · 90 días antes',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Copias',exact:true}).click();
 await page.locator('[data-action="backup-history-download"][data-id="'+id+'"]').click();
 await page.getByRole('heading',{name:'Descargar juego de copia'}).waitFor();
 assert.equal(await page.locator('[data-action="backup-component-download"]').count(),result.index.parts.length+1);
 const event=page.waitForEvent('download');
 await page.locator('[data-action="backup-component-download"][data-part="-1"]').click();
 const downloaded=await event,received=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));assert.equal(received.sha256,result.index.sha256);
 await page.locator('button[data-action="close-modal"]').first().click();
 await page.getByRole('heading',{name:'Descargar juego de copia'}).waitFor({state:'hidden'});
 assert.equal(await page.locator('#backupFile').getAttribute('multiple'),'');
 await page.locator('#backupFile').setInputFiles([...objects].map(([p,b])=>({name:p.split('/').pop(),mimeType:p.endsWith('.zip')?'application/zip':'application/json',buffer:Buffer.from(b)})));
 await page.locator('[data-action="backup-verify"]').click();
 await page.getByRole('heading',{name:'Comprobación de copia',exact:true}).waitFor();
 assert((await page.locator('#modalHost').innerText()).includes('Integridad validada'));
 await page.locator('#modalHost button[data-action="close-modal"]').first().click();
 await page.route('https://backup-qa.invalid/**',async route=>{const path=decodeURIComponent(new URL(route.request().url()).pathname.slice(1));assert(objects.has(path),'Read only the exact fictitious backup inventory');await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from(objects.get(path))});});
 await page.evaluate(async({id,inventory})=>{
  const {state}=await import('../src/state.js'),{sb}=await import('../src/api.js'),previous=sb.functions.invoke;
  state.data.backupRuns.find(r=>r.id===id).storage_provider='onedrive';window.qaCloudInventoryCalls=0;
  sb.functions.invoke=async(name,opts)=>{
   if(name==='totus-onedrive'&&opts.body.action==='backup-file-urls'){window.qaCloudInventoryCalls++;return {data:{files:inventory},error:null};}
   if(name==='totus-onedrive'&&opts.body.action==='backup-file-url')throw Error('Must not request a separate private URL for each component');
   return previous(name,opts);
  };
 },{id,inventory:[...objects.keys()].map(path=>({path,url:'https://backup-qa.invalid/'+encodeURIComponent(path)}))});
 await page.locator('[data-action="backup-history-verify"][data-id="'+id+'"]').click();
 await page.getByRole('heading',{name:'Copia de seguridad verificada',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.qaCloudInventoryCalls),1,'The browser must prepare the OneDrive inventory once for the complete verification');
 assert.equal(await page.evaluate(()=>JSON.stringify({expenses:window.__mockDb.ops_expenses,documents:window.__mockDb.ops_documents,closings:window.__mockDb.ops_daily_closings})===window.qaBusinessBefore),true);
 assert.deepEqual(errors,[]);
 console.log('PARTITIONED BROWSER: credential deadline save, advance notice, component downloads, multiple-file verification and unchanged accounting OK');
}finally{await browser.close();}
