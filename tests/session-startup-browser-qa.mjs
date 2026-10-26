import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const mode of ['saved','absent','error']){
  const page=await browser.newPage();let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/tests/mock-supabase.js',async route=>{
   const response=await route.fetch();let text=await response.text();
   const result=mode==='saved'?'return {data:{session},error:null}':mode==='absent'?'return {data:{session:null},error:null}':"throw new Error('Conexión de ensayo no disponible')";
   text=text.replace('getSession:async()=>({data:{session},error:null})','getSession:async()=>{await window.__qaSessionGate();'+result+'}');
   await route.fulfill({response,body:text});
  });
  await page.exposeFunction('__qaSessionGate',()=>gate);
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#loginEmail').isVisible(),false,'Must not ask for credentials while checking a saved session');
  assert.match(await page.locator('#loginMessage').innerText(),/Comprobando tu acceso/);
  release();
  if(mode==='saved')await page.locator('#userCard').waitFor({state:'visible'});
  else{
   await page.locator('#loginEmail').waitFor({state:'visible'});
   assert.equal(await page.locator('#app').isVisible(),false);
   if(mode==='error')assert.match(await page.locator('#loginMessage').innerText(),/Conexión de ensayo/);
  }
  await page.close();
 }
 const page=await browser.newPage();let releaseLogin;
 const loginGate=new Promise(resolve=>releaseLogin=resolve);
 await page.exposeFunction('__qaLoginGate',()=>loginGate);
 await page.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();let text=await response.text();
  text=text.replace('getSession:async()=>({data:{session},error:null})','getSession:async()=>({data:{session:window.__qaSignedIn?session:null},error:null})');
  text=text.replace('signInWithPassword:async()=>({data:{session},error:null})','signInWithPassword:async()=>{window.__qaLoginCount=(window.__qaLoginCount||0)+1;await window.__qaLoginGate();window.__qaSignedIn=true;return {data:{session},error:null}}');
  await route.fulfill({response,body:text});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#loginEmail').waitFor({state:'visible',timeout:5000}).catch(async error=>{console.error(await page.evaluate(()=>({login:document.getElementById('login').className,app:document.getElementById('app').className,message:document.getElementById('loginMessage').textContent,signed:window.__qaSignedIn,getSession:window.supabase.createClient().auth.getSession.toString()})));throw error;});
 await page.locator('#loginEmail').fill('qa@example.com');await page.locator('#loginPassword').fill('Ficticia-solo-simulacion');
 await page.locator('#loginForm button[type="submit"]').click();
 assert.equal(await page.locator('#loginForm button[type="submit"]').isDisabled(),true);
 await page.evaluate(()=>document.querySelector('#loginForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(await page.evaluate(()=>window.__qaLoginCount),1,'Repeated submission must not start a second sign-in');
 releaseLogin();await page.locator('#userCard').waitFor({state:'visible'});
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="user-edit"][data-email="qa@example.com"]').click();
 await page.locator('#usName').waitFor();
 await page.evaluate(async()=>{const {sb}=await import('../src/api.js');await sb.auth.signOut();});
 assert.equal(await page.locator('#app').isVisible(),false);
 assert.equal(await page.locator('#modalHost').locator(':scope > *').count(),0,'Expired/signed-out sessions must close open business dialogs');
 assert.equal(await page.evaluate(async()=>{const {state}=await import('../src/state.js');return state.data.team.length;}),0,'Session termination must clear the old account data');
 await page.close();
 const previewPage=await browser.newPage();
 await previewPage.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await previewPage.evaluate(async()=>{
  const api=await import('../src/api.js'),{isoToday}=await import('../src/utils.js'),blob=new Blob(['Documento ficticio de la sesión anterior'],{type:'text/plain'});
  await api.upload('business-documents','qa-only/session-preview.txt',blob);
  window.__mockDb.ops_documents.push({id:'session-preview-qa',original_name:'Vista ficticia.txt',storage_path:'qa-only/session-preview.txt',mime_type:'text/plain',document_date:isoToday(),created_at:new Date().toISOString(),doc_type:'otro',status:'pendiente',size_bytes:blob.size});
  await api.loadCore();const text=Blob.prototype.text;
  Blob.prototype.text=async function(){window.previewTextStarted=true;await new Promise(resolve=>window.releasePreviewText=resolve);return text.call(this);};
 });
 await previewPage.locator('#nav [data-route="documentos"]').click();
 await previewPage.locator('[data-action="document-preview"][data-id="session-preview-qa"]').click();
 await previewPage.waitForFunction(()=>window.previewTextStarted===true);
 await previewPage.evaluate(async()=>{await (await import('../src/api.js')).sb.auth.signOut();});
 assert.equal(await previewPage.locator('#modalHost').locator(':scope > *').count(),0);
 await previewPage.evaluate(()=>window.releasePreviewText());await previewPage.waitForTimeout(100);
 assert.equal(await previewPage.locator('#modalHost').locator(':scope > *').count(),0,'A delayed preview must not reopen a document after sign-out');
 await previewPage.close();
 const switchPage=await browser.newPage();
 await switchPage.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();const text=(await response.text()).replace('events=fn;return','window.__qaAuthCallback=fn;events=fn;return');
  await route.fulfill({response,body:text});
 });
 await switchPage.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await switchPage.locator('#nav [data-route="administracion"]').click();await switchPage.locator('[data-action="user-edit"][data-email="qa@example.com"]').click();
 const cleared=await switchPage.evaluate(async()=>{
  const {sb}=await import('../src/api.js'),{state}=await import('../src/state.js'),id=crypto.randomUUID();
  const next={user:{id,email:'new-account@example.invalid'},access_token:'fake-new-session'};window.__qaNextSession=next;
  window.__mockDb.team_members.push({id,email:next.user.email,full_name:'Nueva cuenta ficticia',role:'gerente',active:true});
  window.__mockDb.profiles.push({id,email:next.user.email});
  sb.auth.getSession=async()=>({data:{session:next},error:null});
  window.__qaAuthCallback('SIGNED_IN',next);
  return {user:state.user,dialogs:document.getElementById('modalHost').children.length,oldData:state.data.team.length};
 });
 assert.deepEqual(cleared,{user:null,dialogs:0,oldData:0});
 await switchPage.locator('#userCard').getByText('Nueva cuenta ficticia',{exact:true}).waitFor();
 await switchPage.locator('#nav [data-route="gastos"]').click();await switchPage.locator('[data-action="expense-new"]').click();await switchPage.locator('#exSupplier').fill('Texto sin guardar al renovar sesión');
 await switchPage.evaluate(()=>window.__qaAuthCallback('TOKEN_REFRESHED',{...window.__qaNextSession,access_token:'fake-refreshed-session'}));
 assert.equal(await switchPage.locator('#exSupplier').inputValue(),'Texto sin guardar al renovar sesión','Refreshing the same account token must preserve its draft');
 await switchPage.close();
 console.log('SESSION STARTUP BROWSER QA: delayed saved/absent/error sessions and one-at-a-time sign-in resolve correctly');
}finally{await browser.close()}
