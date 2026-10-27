import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 const modules=await page.evaluate(async()=>{
  window.__mockDb.team_members.push({id:crypto.randomUUID(),email:'qa-worker@example.invalid',full_name:'Usuario ficticio permisos',role:'gerente',active:true});
  await (await import('../src/api.js')).loadCore();
  return (await import('../src/permissions.js')).PERMISSION_MODULES.length;
 });
 await page.locator('#nav [data-route="administracion"]').click();
 const open=()=>page.locator('[data-action="user-permissions"][data-email="qa-worker@example.invalid"]').click();
 await open();await page.locator('#perm_gastos_edit').uncheck();await page.locator('#perm_gastos_delete').uncheck();
 await page.locator('[data-action="user-permissions-save"]').click();
 await page.getByText('Permisos actualizados.',{exact:true}).last().waitFor();
 const rows=await page.evaluate(()=>window.__mockDb.ops_user_permissions);
 assert.equal(rows.length,modules);assert(rows.every(r=>r.email==='qa-worker@example.invalid'));
 assert.equal(rows.find(r=>r.module==='gastos').can_edit,false);assert.equal(rows.find(r=>r.module==='gastos').can_delete,false);
 await open();assert.equal(await page.locator('#perm_gastos_edit').isChecked(),false);assert.equal(await page.locator('#perm_gastos_delete').isChecked(),false);
 await page.locator('[data-action="user-permissions-reset"]').click();
 await page.getByText('Permisos del rol restablecidos.',{exact:true}).last().waitFor();
 assert.equal(await page.evaluate(()=>window.__mockDb.ops_user_permissions.length),0);
 await open();assert.equal(await page.locator('#perm_gastos_edit').isChecked(),true);
 await page.locator('[data-action="close-modal"]').filter({visible:true}).last().click();
 const edit=()=>page.locator('[data-action="user-edit"][data-email="qa-worker@example.invalid"]').click();
 await edit();await page.evaluate(()=>window.confirm=()=>false);await page.locator('[data-action="user-toggle"]').click();
 assert.equal(await page.evaluate(()=>window.__mockDb.team_members.find(u=>u.email==='qa-worker@example.invalid').active),true,'Cancelled disable changed the member');
 await page.evaluate(()=>window.confirm=()=>true);await page.locator('[data-action="user-toggle"]').click();
 await page.waitForFunction(()=>window.__mockDb.team_members.find(u=>u.email==='qa-worker@example.invalid').active===false);
 await page.getByText('Estado del usuario actualizado.',{exact:true}).last().waitFor();
 await edit();await page.locator('[data-action="user-toggle"]').click();
 await page.waitForFunction(()=>window.__mockDb.team_members.find(u=>u.email==='qa-worker@example.invalid').active===true);
 await page.getByText('Estado del usuario actualizado.',{exact:true}).last().waitFor();
 await page.evaluate(async()=>{
  const api=await import('../src/api.js');window.__qaResetRequests=[];
  api.sb.auth.resetPasswordForEmail=async(email,options)=>{window.__qaResetRequests.push({email,options});return {data:{},error:null};};
 });
 await edit();await page.locator('[data-action="user-reset"]').click();
 await page.getByText('Correo de recuperación solicitado.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__qaResetRequests),[{email:'qa-worker@example.invalid',options:{redirectTo:'http://127.0.0.1:4173/tests/app-mock.html'}}]);
 assert.equal(await page.evaluate(()=>window.__mockDb.team_members.find(u=>u.email==='qa-worker@example.invalid').role),'gerente');
 assert.deepEqual(errors,[]);
 console.log('USER PERMISSIONS UI: per-module overrides saved and reopened; reset removes only that user overrides and restores role defaults');
}finally{await browser.close()}
