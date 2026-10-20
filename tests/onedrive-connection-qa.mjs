
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},locale:'es-ES'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {sb}=await import('../src/api.js');
  const before=sb.functions.invoke;
  window.odCalls=[];
  window.odState={configured:false,connected:false,mirror:{total:1,verified:0,pending:1,verified_bytes:0},client_id:'test-client',redirect_uri:'https://example.supabase.co/functions/v1/totus-onedrive/callback'};
  sb.functions.invoke=async(name,options)=>{
   if(name!=='totus-onedrive')return before(name,options);
   const b=options.body;window.odCalls.push(b.action);
   if(b.action==='status')return {data:{...window.odState},error:null};
   if(b.action==='configure'){window.odState.configured=true;return {data:{configured:true},error:null};}
   if(b.action==='begin')return {data:{authorization_url:'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?scope=Files.ReadWrite.AppFolder%20offline_access'},error:null};
   if(b.action==='mirror-documents'){window.odState.mirror={total:1,verified:1,pending:0,verified_bytes:20};return {data:{copied:1,...window.odState.mirror},error:null};}
   if(b.action==='test'){
    window.odState.tested_at='2026-10-20T00:00:00Z';
    return {data:{verified:true,tested_at:window.odState.tested_at},error:null};
   }
   throw Error('Unexpected test action');
  };
  window.odBusinessBefore=JSON.stringify({expenses:window.__mockDb.ops_expenses,documents:window.__mockDb.ops_documents,closings:window.__mockDb.ops_daily_closings});
 });
 await page.locator('#nav [data-route="administracion"]').click();
 await page.locator('[data-action="admin-section"][data-section="storage"]').click();
 assert.equal(await page.locator('[data-action="admin-section"][data-section="onedrive"]').count(),0,'OneDrive debe estar integrado en Almacenamiento');
 await page.getByText('Almacenamiento · Supabase',{exact:true}).waitFor();
 await page.getByLabel('Valor de la credencial de Microsoft').waitFor();
 assert((await page.locator('#content').innerText()).includes('Pendiente de preparar'));
 assert.equal(await page.locator('#odClientSecret').getAttribute('type'),'password');
 assert.equal(await page.locator('#odClientSecret').getAttribute('data-draft-ignore'),'');
 await page.locator('#odClientSecret').fill('EXCLUSIVAMENTE-CREDENCIAL-FICTICIA-QA');
 await page.locator('[data-action="onedrive-credential-save"]').click();
 await page.getByText('Credencial guardada. Falta tu autorización en Microsoft.',{exact:true}).waitFor();
 assert.equal(await page.locator('#odClientSecret').count(),0,'La credencial no debe volver a mostrarse');
 assert(!(await page.content()).includes('EXCLUSIVAMENTE-CREDENCIAL-FICTICIA-QA'));
 assert(!(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).includes('EXCLUSIVAMENTE-CREDENCIAL-FICTICIA-QA'));
 await page.locator('[data-action="onedrive-begin"]').click();
 const authorize=page.getByRole('link',{name:'Continuar en Microsoft',exact:true});
 assert((await authorize.getAttribute('href')).startsWith('https://login.microsoftonline.com/consumers/'));
 await page.locator('button[data-action="close-modal"]').first().click();
 await page.evaluate(()=>{window.odState.connected=true;window.odState.folder_url='https://onedrive.live.com/?test=1';});
 await page.locator('[data-action="onedrive-refresh"]').click();
 await page.locator('[data-action="onedrive-test"]').waitFor();
 await page.locator('[data-action="onedrive-test"]').click();
 await page.getByText('Comprobada',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Copiar siguiente lote de documentos',exact:true}).click();
 await page.getByText('Documentos con copia verificada: 1 de 1',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Copiar siguiente lote de documentos',exact:true}).isEnabled(),false);
 assert.equal(await page.getByRole('progressbar',{name:'Documentos copiados y comprobados en OneDrive'}).getAttribute('value'),'1');
 assert.equal(await page.evaluate(()=>JSON.stringify({expenses:window.__mockDb.ops_expenses,documents:window.__mockDb.ops_documents,closings:window.__mockDb.ops_daily_closings})===window.odBusinessBefore),true,'La prueba alteró datos contables');
 const rejection=await page.evaluate(async()=>{
  const {state}=await import('../src/state.js'),{oneDriveRequest}=await import('../src/onedrive-connection.js');
  const previous=state.user;state.user={...previous,role:'gerente'};
  try{await oneDriveRequest('test');return false;}catch{return true;}finally{state.user=previous;}
 });
 assert(rejection,'Un usuario no administrador pudo solicitar una operación de OneDrive');
 assert.equal(errors.length,0,errors.join('; '));
 console.log('ONEDRIVE CONNECTION QA: admin-only, explicit consent, hidden ephemeral credential, isolated test and unchanged business data OK');
}finally{await browser.close();}
