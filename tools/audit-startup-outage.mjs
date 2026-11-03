// Fault injection only: no production session or requests leave the local browser.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.AUDIT_PLAYWRIGHT||'playwright');
const port=4188,server=spawn(process.execPath,['tools/audit-server.mjs'],{env:{...process.env,AUDIT_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.once('data',resolve);server.stderr.once('data',x=>reject(Error(String(x))))});
const browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_CHANNEL?{channel:process.env.AUDIT_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage(),errors=[],blocked=[];
 let failSdk=false;
 page.on('pageerror',e=>errors.push(e.message));
 const html=(await fs.readFile('index.html','utf8')).replace('<head>','<head><base href="/">');
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){blocked.push(u.origin);return route.abort();}if(failSdk&&u.pathname.endsWith('/vendor/supabase/supabase.js'))return route.abort();if(u.pathname==='/tests/audit-startup.html')return route.fulfill({contentType:'text/html',body:html});if(u.pathname==='/build-info.json')return route.fulfill({contentType:'application/json',body:'{"environment":"production","commit":"audit"}'});return route.continue();});
 await page.goto('http://127.0.0.1:'+port+'/tests/audit-startup.html',{waitUntil:'networkidle'});
 const result=await page.evaluate(()=>({checking:document.body.innerText.includes('Comprobando tu acceso'),visibleAlert:!!document.querySelector('[role=alert]')?.textContent,retry:[...document.querySelectorAll('button')].some(x=>/reintentar|volver a intentar/i.test(x.textContent))}));
 assert.equal(result.checking,false);assert.deepEqual(errors,[]);
 assert(!blocked.some(origin=>/jsdelivr/.test(origin)),'No SDK CDN request is needed');
 console.log('PASS: access initializes without a CDN or external requests');
 await page.evaluate(()=>localStorage.setItem('audit-session-preservation','keep'));
 failSdk=true;await page.reload({waitUntil:'networkidle'});
 await page.getByRole('alert').waitFor();
 assert.equal(await page.getByRole('button',{name:'Volver a intentar'}).count(),1);
 assert(!(await page.locator('#loginMessage').innerText()).includes('Comprobando'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('audit-session-preservation')),'keep');
 console.log('PASS: failed local SDK shows a recoverable error and preserves storage');
 failSdk=false;
 await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.getByRole('button',{name:'Volver a intentar'}).click()]);
 assert.equal(await page.getByRole('alert').count(),0);
 assert.equal(await page.evaluate(()=>typeof window.supabase?.createClient),'function');
 assert.equal(await page.evaluate(()=>localStorage.getItem('audit-session-preservation')),'keep');
 assert.deepEqual(errors,[]);
 console.log('PASS: retry reloads the SDK and restores the access screen without clearing storage');
}finally{await browser.close();server.kill();}
