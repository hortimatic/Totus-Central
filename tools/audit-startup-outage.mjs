// Fault injection only: no production session or requests leave the local browser.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.AUDIT_PLAYWRIGHT||'playwright');
const port=4188,server=spawn(process.execPath,['tools/audit-server.mjs'],{env:{...process.env,AUDIT_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.once('data',resolve);server.stderr.once('data',x=>reject(Error(String(x))))});
const browser=await chromium.launch({headless:true,...(process.env.AUDIT_BROWSER_CHANNEL?{channel:process.env.AUDIT_BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage(),errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));
 const html=(await fs.readFile('index.html','utf8')).replace('<head>','<head><base href="/">');
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){blocked.push(u.origin);return route.abort();}if(u.pathname==='/tests/audit-startup.html')return route.fulfill({contentType:'text/html',body:html});if(u.pathname==='/build-info.json')return route.fulfill({contentType:'application/json',body:'{"environment":"production","commit":"audit"}'});return route.continue();});
 await page.goto('http://127.0.0.1:'+port+'/tests/audit-startup.html',{waitUntil:'networkidle'});
 const result=await page.evaluate(()=>({checking:document.body.innerText.includes('Comprobando tu acceso'),visibleAlert:!!document.querySelector('[role=alert]')?.textContent,retry:[...document.querySelectorAll('button')].some(x=>/reintentar|volver a intentar/i.test(x.textContent))}));
 console.log(JSON.stringify({scenario:'Supabase browser SDK CDN unavailable',externalRequestsSent:false,blockedOrigins:[...new Set(blocked)],errors,...result,finding:errors.some(x=>x.includes('createClient'))&&result.checking?'Startup remains checking without a recoverable dependency error':'Inspect result'},null,2));
}finally{await browser.close();server.kill();}
