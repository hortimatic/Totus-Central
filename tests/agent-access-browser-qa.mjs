import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/api.js',r=>r.fulfill({contentType:'text/javascript',body:`export async function invokeTeam(p){if(p.action==='agent_access_status')return {configured:false};if(window.failSave)throw Error('Temporary service failure');window.submitted={email:p.email,legacy:p.legacy_chatgpt,hasPassword:!!p.password};return {configured:true};}`}));
  await page.route('**/tests/agent-access-fixture.html',r=>r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/styles.css"><div id="modalHost"></div>'}));
  await page.goto('http://127.0.0.1:4173/tests/agent-access-fixture.html');
  await page.evaluate(async()=>{document.body.innerHTML='<div id="modalHost"></div>';window.access=await import('/src/agent-access-ui.js');await window.access.openAgentAccess({email:'fictional-agent@example.invalid',full_name:'Fictional AI',role:'gerente',active:true});});
  const input=page.locator('#agentAccessPassword');assert.equal(await input.getAttribute('type'),'password');
  await input.fill('synthetic-test-secret');
  await page.evaluate(()=>{window.failSave=true;});
  assert.match(await page.evaluate(()=>window.access.saveAgentAccess('fictional-agent@example.invalid').catch(e=>e.message)),/Temporary/);
  assert(await input.isVisible());assert.equal(await input.inputValue(),'synthetic-test-secret');
  assert(!(await page.evaluate(()=>JSON.stringify({...localStorage}))).includes('synthetic-test-secret'));
  assert.equal(await page.locator('#modalHost').evaluate(e=>e.scrollWidth>innerWidth+2),false);
  await mkdir('artifacts/agent-access',{recursive:true});await input.fill('');await page.screenshot({path:'artifacts/agent-access/'+width+'.png',fullPage:true});
  await input.fill('synthetic-test-secret');await page.evaluate(async()=>{window.failSave=false;await window.access.saveAgentAccess('fictional-agent@example.invalid');});
  assert.equal(await page.locator('#agentAccessPassword').count(),0);assert.deepEqual(await page.evaluate(()=>window.submitted),{email:'fictional-agent@example.invalid',legacy:false,hasPassword:true});assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Agent access UI: private entry, retry, no draft leakage, success close, mobile and PC.');
}finally{await browser.close();}
