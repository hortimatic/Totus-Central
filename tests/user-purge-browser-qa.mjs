import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';import {clickModuleLink} from './ui-navigation.mjs';
const browser=await chromium.launch({headless:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/functions/v1/team-admin',async route=>{const input=route.request().postDataJSON();calls.push(input);if(input.action==='purge_user')await page.evaluate(email=>{const r=__mockDb.team_members.find(x=>x.email===email);r.purged_at='2026-01-01';},input.email);await route.fulfill({json:{ok:true,message:'Cuenta eliminada definitivamente.'}});});
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{const {state}=await import('../src/state.js');for(const row of [{email:'retired@example.invalid',full_name:'Cuenta retirada',role:'staff',active:false,deleted_at:'2026-01-01'},{email:'purged@example.invalid',full_name:'Cuenta purgada',role:'staff',active:false,deleted_at:'2026-01-01',purged_at:'2026-01-02'}]){__mockDb.team_members.push(row);state.data.team.push({...row});}});
 await clickModuleLink(page,page.locator('#nav [data-route="administracion"]'));
 await page.locator('[data-action=user-show-deleted]').click();
 assert.equal(await page.getByText('Cuenta purgada',{exact:true}).count(),0);
 const button=page.locator('[data-action=user-purge][data-email="retired@example.invalid"]');await button.click();
 assert.equal(calls.filter(c=>c.action==='purge_user').length,0,'no deletion before explicit confirmation');
 const dialog=page.locator('#modalHost');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert(await button.isVisible());
 await button.click();await dialog.locator('input').fill('BORRAR DEFINITIVAMENTE');await dialog.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();
 await page.getByText('Cuenta eliminada definitivamente.',{exact:false}).waitFor();assert.equal(calls.filter(c=>c.action==='purge_user').length,1);assert.equal(await page.locator('[data-action=user-purge][data-email="retired@example.invalid"]').count(),0);
 assert.deepEqual(errors,[]);await mkdir('artifacts/user-purge',{recursive:true});await page.screenshot({path:'artifacts/user-purge/users-'+width+'.png',fullPage:true});await page.close();
}console.log('USER PURGE UI: retired only, irreversible confirmation, cancellation, successful refresh, 390/1440.');}finally{await browser.close();}
