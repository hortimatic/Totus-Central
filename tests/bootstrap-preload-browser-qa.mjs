import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 const context=await browser.newContext();await context.route('**/index.html*',async route=>route.fulfill({contentType:'text/html',body:await fs.readFile('index.html','utf8')}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let release;const sdkGate=new Promise(resolve=>release=resolve);
 await page.route('**/src/vendor/supabase/supabase.js',async route=>{await sdkGate;await route.fulfill({contentType:'text/javascript',body:(await fs.readFile('tests/mock-supabase.js','utf8')).replace('createClient:()=>client','createClient:()=>{window.__supabaseCreateCount=(window.__supabaseCreateCount||0)+1;return client;}')});});
 const moduleRequested=page.waitForRequest(request=>new URL(request.url()).pathname==='/src/app.js');
 await page.goto('http://127.0.0.1:4173/index.html?module=productos',{waitUntil:'commit'});
 await moduleRequested;
 assert.equal(await page.evaluate(()=>window.__supabaseCreateCount||0),0,'Preloading must not evaluate the application before the SDK is ready');
 release();await page.locator('[data-account-open]').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>window.__supabaseCreateCount),1,'One SDK client after parallel downloads');assert.deepEqual(errors,[]);
 const failed=await context.newPage();await failed.addInitScript(()=>localStorage.setItem('qa-preserved-session','keep'));
 await failed.route('**/src/vendor/supabase/supabase.js',route=>route.abort());
 await failed.goto('http://127.0.0.1:4173/index.html');
 await failed.getByRole('button',{name:'Volver a intentar',exact:true}).waitFor();
 assert.equal(await failed.evaluate(()=>localStorage.getItem('qa-preserved-session')),'keep');
 console.log('BOOTSTRAP PRELOAD QA: module fetch overlaps SDK download, evaluates only after SDK, one client, failed SDK restores retry and preserves session');
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
