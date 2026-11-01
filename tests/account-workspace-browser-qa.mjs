import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {navigate} from './ui-navigation.mjs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const open=async section=>{await page.locator('[data-account-open]').click();await page.locator('[data-account-section="'+section+'"]').click();};
const close=async()=>{await page.locator('#modalHost .close-btn').click();const discard=page.locator('[data-confirm=accept]');if(await discard.isVisible())await discard.click();};
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
try{
 await fs.mkdir('artifacts/account-workspace',{recursive:true});
 await page.route('**/tests/mock-supabase.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  source=source.replace('window.__mockDb=db;',`window.__mockDb=db;
   db.profiles.push({id:'${other}',email:'other@example.invalid',role:'empleado',ui_preferences:{account:{revision:0,config:{display_name:'Perfil B',phone:'',photo:''}}}});
   db.team_members.push({id:'${other}',email:'other@example.invalid',full_name:'Persona B',role:'empleado',active:true});
   db.ops_documents.push({id:'own-doc',original_name:'Documento propio.pdf',document_date:new Date().toISOString().slice(0,10),uploaded_by:db.profiles[0].id});
   db.ops_documents.push({id:'other-doc',original_name:'Documento de otra cuenta.pdf',document_date:new Date().toISOString().slice(0,10),uploaded_by:'${other}'});
  `);
  source=source.replace('const rpc=async (name,args={})=>{',`const rpc=async (name,args={})=>{
   if(name==='totus_tasks_context')return {data:{rows:[{title:'Tarea propia '+args.p_from,assigned_email:'qa@example.com',scheduled_on:args.p_from,state:'pending'},{title:'Tarea B '+args.p_from,assigned_email:'other@example.invalid',scheduled_on:args.p_from,state:'pending'}]},error:null};
  `);
  await route.fulfill({response,body:source});
 });
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module=configuracion');
 await page.locator('[data-account-open]').waitFor();
 const originalName=await page.locator('.account-trigger-text b').textContent();
 const note='Nota persistente </textarea><img src=x onerror="window.__noteExecuted=1">';
 await open('notas');await page.locator('[name=notes]').fill(note);await page.getByRole('button',{name:'Guardar notas',exact:true}).click();await page.locator('[data-account-panel]').waitFor({state:'detached'});
 await open('notas');assert.equal(await page.locator('[name=notes]').inputValue(),note);assert.equal(await page.locator('[data-account-notes] img').count(),0);assert.equal(await page.evaluate(()=>window.__noteExecuted),undefined);await close();
 await open('documentos');await page.getByText('Documento propio.pdf',{exact:true}).waitFor();assert.equal(await page.getByText('Documento de otra cuenta.pdf',{exact:true}).count(),0,'Own document list excludes other accounts');await close();
 await open('tareas');await page.getByText(/^Tarea propia/).waitFor();assert.equal(await page.getByText(/^Tarea B /).count(),0);await page.locator('[data-account-month]').fill('2026-09');await page.locator('[data-account-month]').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('[data-account-tasks]')?.textContent.includes('Tarea propia 2026-09-01'));await close();
 await open('informes');await page.getByRole('button',{name:'Abrir informes y descargas',exact:true}).click();await page.locator('#nav [data-route=informes][aria-current=page]').waitFor();
 await navigate(page,'administracion');await page.locator('[data-action=user-edit][data-email="other@example.invalid"]').click();await page.locator('[data-action=user-profile]').click();
 assert.equal(await page.locator('[name=display_name]').inputValue(),'Perfil B');
 await page.locator('[name=display_name]').fill('Perfil B actualizado');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').fillRect(0,0,16,16);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('[data-account-photo]').setInputFiles({name:'avatar-qa.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>document.querySelector('[name=photo]').value.startsWith('data:image/'));
 await page.locator('[data-account-form] button[type=submit]').click();await page.locator('[data-account-panel]').waitFor({state:'detached'});
 const after=await page.evaluate(id=>({other:window.__mockDb.profiles.find(p=>p.id===id),own:window.__mockDb.profiles[0]}),other);
 assert.equal(after.other.ui_preferences.account.config.display_name,'Perfil B actualizado');assert(after.other.ui_preferences.account.config.photo.startsWith('data:image/'));assert.equal(after.other.role,'empleado');assert.equal(after.own.ui_preferences.account.config.notes,note);assert.equal(await page.locator('.account-trigger-text b').textContent(),originalName,'Editing another profile never changes administrator identity');
 await page.locator('[data-action=user-edit][data-email="other@example.invalid"]').click();await page.locator('[data-action=user-profile]').click();await page.locator('[data-account-tab=notas]').click();await page.locator('[name=notes]').fill('Notas del usuario B');await page.getByRole('button',{name:'Guardar notas',exact:true}).click();await page.locator('[data-account-panel]').waitFor({state:'detached'});
 assert.equal(await page.evaluate(id=>window.__mockDb.profiles.find(p=>p.id===id).ui_preferences.account.config.notes,other),'Notas del usuario B');
 await page.locator('[data-action=user-edit][data-email="other@example.invalid"]').click();await page.locator('[data-action=user-profile]').click();
 await page.evaluate(id=>window.__mockDb.profiles.find(p=>p.id===id).ui_preferences.account.revision++,other);
 await page.locator('[name=display_name]').fill('Cambio antiguo');await page.locator('[data-account-form] button[type=submit]').click();await page.locator('[data-account-status]').getByText(/cambió/).waitFor();
 assert.equal(await page.evaluate(id=>window.__mockDb.profiles.find(p=>p.id===id).ui_preferences.account.config.display_name,other),'Perfil B actualizado');await close();
 for(const width of [1440,831,390,320]){
  await page.setViewportSize({width,height:844});await open('notas');assert.equal(await page.locator('[name=notes]').inputValue(),note);
  const geometry=await page.locator('.modal-body').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(geometry.scroll<=geometry.client+2,'Personal workspace has no horizontal overflow at '+width);
  await page.screenshot({path:'artifacts/account-workspace/notes-'+width+'.png',fullPage:true});await close();
 }
 assert.deepEqual(errors,[]);
 console.log('PERSONAL WORKSPACE: own notes and escaping, fresh documents, task month/owner, report navigation, admin photo/notes, unchanged identity/roles, stale writes and four widths OK.');
}catch(error){await page.screenshot({path:'artifacts/account-workspace/failure.png',fullPage:true});throw error;}finally{await browser.close();}
