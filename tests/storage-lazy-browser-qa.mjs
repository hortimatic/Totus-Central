import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const errors=[];
async function mockPage(role='admin'){
 const page=await browser.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.__qaStorageBlocked=true;window.__qaStorageQueue=[];window.__qaStorageRequests=0;
  window.__qaStoragePercentOverride=85;
 });
 await page.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();
  let source=await response.text();
  const needle='const response=await rpc(name,executable);';
  assert(source.includes(needle));
  source=source.replace(needle,`const response=await rpc(name,executable);
   if(name==='totus_storage_usage'){
    window.__qaStorageRequests++;
    const pct=window.__qaStoragePercentOverride;
    if(response.data?.status==='ok'&&pct!=null){
     response.data.limit_bytes=100;response.data.total_bytes=pct;
     response.data.documents_bytes=pct;response.data.assets_bytes=0;
     response.data.all_buckets_bytes=pct;response.data.usage_percent=pct;
    }
    if(window.__qaStorageBlocked)await new Promise(resolve=>window.__qaStorageQueue.push(resolve));
   }`);
  await route.fulfill({response,body:source});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?role='+role,{waitUntil:'networkidle'});
 return page;
}
async function usage(page){return page.evaluate(async()=>structuredClone((await import('../src/state.js')).state.data.storageUsage));}
async function release(page,index=0){await page.evaluate(i=>{const fn=window.__qaStorageQueue.splice(i,1)[0];if(!fn)throw Error('Missing held Storage response');fn();},index);}
try{
 const page=await mockPage();
 await page.locator('#homePriceQuery').waitFor();
 await page.waitForFunction(()=>window.__qaStorageQueue.length===1);
 assert.equal((await usage(page)).status,'pending','First render must not invent zero usage');
 await page.locator('#homePriceQuery').fill('Borrador que no debe perderse');
 assert((await page.locator('#homeStorageMetrics').innerText()).includes('Consultando'),'Home must identify pending usage');
 assert((await page.locator('#homeStorageMetrics').innerText()).includes('Sin medir'),'No artificial quota while the RPC waits');
 await page.evaluate(()=>window.__qaStorageBlocked=false);
 await release(page);
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return state.data.storageUsage.status==='ok'&&document.querySelector('#homeStorageMetrics')?.textContent.includes('85,0 %');});
 assert.equal(await page.locator('#homePriceQuery').inputValue(),'Borrador que no debe perderse','Metrics update must not rerender Home or lose draft');
 await page.locator('#homePriceQuery').fill(''); // Clear the intentionally dirty form before navigating.
 assert((await page.locator('#homeStorageAlert').innerText()).includes('85,0 %'),'85 percent warning must remain visible');
 await page.evaluate(()=>window.__qaStoragePercentOverride=95);
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="storage"]').click();
 await page.locator('#storageMeasuredAt').waitFor();
 await page.locator('#nav [data-route="inicio"]').click();
 assert((await page.locator('#homeStorageAlert').innerText()).includes('95,0 %'),'95 percent critical warning must remain visible');
 assert((await page.locator('#homeStorageAlert .bad').count())===1,'95 percent alert must be critical');

 // An in-flight old measurement cannot overwrite a later success or failure.
 await page.evaluate(async()=>{window.__qaStorageBlocked=true;window.__qaStoragePercentOverride=88;window.__qaOld=(await import('../src/api.js')).reloadStorageUsage();});
 await page.waitForFunction(()=>window.__qaStorageQueue.length===1);
 await page.evaluate(async()=>{window.__qaStoragePercentOverride=97;window.__qaNew=(await import('../src/api.js')).reloadStorageUsage();});
 await page.waitForFunction(()=>window.__qaStorageQueue.length===2);
 await release(page,1);
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return state.data.storageUsage.status==='ok'&&state.data.storageUsage.total_bytes===97;});
 await release(page,0);
 await page.evaluate(()=>Promise.all([window.__qaOld,window.__qaNew]));
 assert.equal((await usage(page)).total_bytes,97,'Older success must not replace the newer Storage result');
 // On a failed refresh, previous figures must cease to be current.
 await page.evaluate(()=>{window.__qaStorageBlocked=false;window.__mockStorageFailure=true;});
 const failed=await page.evaluate(async()=>(await import('../src/api.js')).reloadStorageUsage());
 assert.equal(failed.status,'error');
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="storage"]').click();
 await page.getByText('Datos no disponibles',{exact:false}).first().waitFor();
 assert(!(await page.locator('#content').innerText()).includes('97,00 MB usados'),'Old figures must not masquerade as current');
 await page.locator('[data-action="storage-refresh"]').click();
 assert((await usage(page)).status==='error','Failure must stay visible and be retryable');
 await page.evaluate(()=>{window.__mockStorageFailure=false;window.__qaStoragePercentOverride=45;});
 await page.locator('[data-action="storage-refresh"]').click();
 await page.locator('#storageMeasuredAt').waitFor();
 assert.equal((await usage(page)).status,'ok','Retry must restore a valid measurement');

 // Upload always fetches a fresh value and must fail closed, even with a valid snapshot.
 await page.evaluate(()=>{window.__mockStorageFailure=true;});
 const before=await page.evaluate(()=>window.__mockUploads.size);
 const validation=await page.evaluate(async()=>{
  const {state}=await import('../src/state.js');
  const {reloadStorageUsage}=await import('../src/api.js');
  const result=await reloadStorageUsage();
  return {status:result.status,initial:state.data.storageUsage.status};
 });
 assert.equal(validation.status,'error');
 assert.equal(await page.evaluate(()=>window.__mockUploads.size),before,'No file should be uploaded when quota cannot be measured');
 await page.evaluate(()=>{window.__mockStorageFailure=false;window.__qaStoragePercentOverride=30;});
 const apiResult=await page.evaluate(async()=>{
  const api=await import('../src/api.js');
  await api.reloadStorageUsage();
  await api.upload('business-assets','qa-storage-invalidate.png',new File(['PNG'],'qa-storage-invalidate.png',{type:'image/png'}));
  return (await import('../src/state.js')).state.data.storageUsage.status;
 });
 assert.equal(apiResult,'stale','Successful file upload must invalidate the previous Storage measurement');
 assert((await page.locator('#nav [data-route="inicio"]').count())===1);
 await page.locator('#nav [data-route="inicio"]').click();
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return state.data.storageUsage.status==='ok';});
 await page.evaluate(async()=>{const api=await import('../src/api.js');await api.removeFile('business-assets','qa-storage-invalidate.png');});
 assert.equal((await usage(page)).status,'stale','Verified removal must also invalidate measurement');

 // Same-account logout invalidates both the pending API result and panel in-flight guard.
 await page.evaluate(async()=>{
  const api=await import('../src/api.js');
  window.__qaStorageBlocked=true;window.__qaStoragePercentOverride=20;
  window.__qaSessionOld=api.reloadStorageUsage();
 });
 await page.waitForFunction(()=>window.__qaStorageQueue.length===1);
 await page.evaluate(async()=>(await import('../src/api.js')).sb.auth.signOut());
 assert.equal((await usage(page)).status,'pending','New session must not retain previous measurements');
 await page.locator('#loginEmail').fill('qa@example.com');
 await page.locator('#loginPassword').fill('SandboxPasswordOnly');
 await page.locator('#loginForm button[type="submit"]').click();
 await page.waitForFunction(()=>window.__qaStorageQueue.length>=2);
 await page.evaluate(()=>{window.__qaStoragePercentOverride=65;window.__qaStorageBlocked=false;});
 await release(page,1);
 await page.waitForFunction(async()=>{const {state}=await import('../src/state.js');return state.data.storageUsage.status==='ok';});
 const newUsage=await usage(page);
 await release(page,0);
 await page.evaluate(()=>window.__qaSessionOld);
 assert.deepEqual(await usage(page),newUsage,'Late result of previous same-account session cannot change new snapshot');
 assert.equal(errors.length,0,'No browser errors');
 await page.close();

 const restricted=await mockPage('encargado');
 await restricted.locator('#homePriceQuery').waitFor();
 assert.equal(await restricted.locator('#nav [data-route="administracion"]').count(),0,'Non-managers must not access Storage administration');
 await restricted.close();
 console.log('LAZY STORAGE BROWSER QA: nonblocking boot, 85/95 alerts, forms, panel, failure/retry, out-of-order results, upload/remove invalidation and same-user session');
}finally{await browser.close();}
