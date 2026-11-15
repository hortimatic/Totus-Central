import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer();
const browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
try{
 // The removal-status read shares the four slots instead of waiting for every table.
 const gated=await browser.newPage();
 await gated.route('**/tests/mock-supabase.js',async request=>{
  const response=await request.fetch();let source=await response.text();
  const needle='then(ok,fail){return Promise.resolve(databaseResult(this.result())).then(ok,fail)}';assert(source.includes(needle));
  source=source.replace(needle,"then(ok,fail){if(this.table==='ops_cash_drawers')return new Promise(resolve=>window.__coreRelease=()=>resolve(databaseResult(this.result()))).then(ok,fail);return Promise.resolve(databaseResult(this.result())).then(ok,fail)}");
  source=source.replace('const rpc=async (name,args={})=>{',"const rpc=async (name,args={})=>{if(name==='totus_pending_document_removals')window.__removalStarted=true;");
  await request.fulfill({response,body:source});
 });
 await gated.goto('http://127.0.0.1:4173/tests/app-mock.html?module=productos',{waitUntil:'domcontentloaded'});
 await gated.waitForFunction(()=>window.__removalStarted&&typeof window.__coreRelease==='function');
 await gated.evaluate(()=>window.__coreRelease());await gated.locator('#nav .active').first().waitFor();await gated.close();
 const counts={};
 for(const route of ['productos-baseline','productos','ventas','equipo','gastos','inicio']){
  const baseline=route==='productos-baseline',target=baseline?'productos':route;
  const page=await browser.newPage();if(baseline)await page.route('**/src/app.js',async request=>{const response=await request.fetch(),code=await response.text();assert(code.includes("await refresh('',{route:state.route,initialProfile:profile});"));await request.fulfill({response,body:code.replace("await refresh('',{route:state.route,initialProfile:profile});",'await refresh();')});});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/tests/mock-supabase.js',async request=>{
   const response=await request.fetch();let source=await response.text();
   const needle='then(ok,fail){return Promise.resolve(databaseResult(this.result())).then(ok,fail)}';
   assert(source.includes(needle));
   source=source.replace(needle,"then(ok,fail){(window.__startupTables??=[]).push(this.table);return Promise.resolve(databaseResult(this.result())).then(ok,fail)}");
   await request.fulfill({response,body:source});
  });
  await page.goto('http://127.0.0.1:4173/tests/app-mock.html?module='+target,{waitUntil:'networkidle'});
  await page.locator('#nav .active').first().waitFor();
  const tables=await page.evaluate(()=>window.__startupTables||[]);
  assert(tables.includes('team_members'),'Membership remains checked: '+route);
  counts[route]=new Set(tables).size;
  if(baseline){assert(tables.includes('products'),'Baseline reproduces eager local pricing read');await page.close();continue;}
  assert(!tables.includes('products'),'Local pricing catalog must not block startup: '+route);
  if(['productos','ventas','equipo'].includes(route))for(const table of ['ops_expenses','ops_invoices','ops_closings'])assert(!tables.includes(table),route+' fetched unrelated '+table);
  else assert(tables.includes('ops_expenses'),'Financial screen keeps expense data: '+route);
  assert.deepEqual(errors,[],route+' browser errors');
  console.log('STARTUP SCOPED QA: '+route+' '+new Set(tables).size+' distinct tables');await page.close();
 }
 assert(counts.productos<counts['productos-baseline']/2,'Targeted startup must remove at least half of unrelated reads');
 console.log('STARTUP READ COMPARISON: '+JSON.stringify(counts));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
