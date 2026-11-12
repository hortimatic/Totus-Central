import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
const {chromium}=await import(process.env.TOTUS_PLAYWRIGHT_MODULE||'playwright');
const server=await startLocalServer(),browser=await chromium.launch({headless:true,channel:process.env.TOTUS_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)}),report=[];
await mkdir('qa-artifacts/header-online-orders',{recursive:true});
try{for(const width of [320,390,768,1440,1920,2560]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/header-tools-fixture.html');
 await page.addStyleTag({url:'http://127.0.0.1:4173/src/home-widgets.css'});await page.addStyleTag({url:'http://127.0.0.1:4173/src/prestashop.css'});
 await page.evaluate(async()=>{
  header.stop();const {createHeaderTools}=await import('../src/header-tools.js');
  const q=window.onlineQA={owner:'A',allowed:true,calls:[],saved:[],opened:[],hold:false};
  const rows=['hortimatic','newoldsmok'].map((store,i)=>({store,order_id:String(i+1),body:'PEDIDO ONLINE · '+store+'\nFecha: 2026-11-13 12:00:00\nCliente: Persona QA\n1 × Producto QA <img src=x onerror=alert(1)>',created_at:'2026-11-13T12:00:00Z'}));
  const configs=new Map();q.ui=createHeaderTools({actor:()=>q.owner,can:module=>module==='ventas'?q.allowed:true,onNavigate:(...args)=>q.opened.push(args),onOpenOrder:args=>q.opened.push(args),rpc:async(name,args)=>{
   q.calls.push(name);if(name==='totus_home_tasks_context')return {rows:[{state:'pending',assigned_email:q.owner,title:'Preparar pedido QA'}]};
   if(name!=='totus_header_online_orders')throw Error(name);if(q.hold)return new Promise(resolve=>q.release=()=>resolve({rows,config:{enabled:true,stores:['hortimatic','newoldsmok'],seen:[]},active_rules:1}));
   if(args.p_action==='save'){configs.set(q.owner,structuredClone(args.p_data));q.saved.push(args.p_data);}
   return {rows,config:configs.get(q.owner)||{enabled:true,stores:['hortimatic','newoldsmok'],seen:[]},active_rules:1};
  }});q.ui.start();
  const {activityChartHtml}=await import('../src/dashboard-activity.js');document.querySelector('main').innerHTML=activityChartHtml({monthly:false,points:[{key:'2026-11-13',sales:100,fiscal:20,internal:5}]});
 });
 const bell=page.getByRole('button',{name:'Pedidos online: 2 sin leer',exact:true});await bell.waitFor();await bell.click();
 const panel=page.getByRole('dialog',{name:'Avisos de pedidos online',exact:true});await panel.getByRole('button',{name:'Ver pedido, datos e imágenes'}).first().waitFor();
 assert((await panel.innerText()).includes('Persona QA'));assert.equal(await panel.locator('img').count(),0,'Notice content is escaped');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Header fits '+width);
 await panel.getByRole('button',{name:'Marcar leídos',exact:true}).click();await page.getByRole('button',{name:'Pedidos online: 0 sin leer',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>onlineQA.saved.at(-1).seen.length),2);
 await panel.locator('[data-online-store=newoldsmok]').uncheck();await page.waitForFunction(()=>onlineQA.saved.at(-1).stores.length===1);
 assert.equal(await panel.locator('.header-order-notice').count(),1);
 await panel.getByRole('button',{name:'Ver pedido, datos e imágenes'}).click();assert.deepEqual(await page.evaluate(()=>onlineQA.opened.at(-1)),{store:'hortimatic',order:'1',date:'2026-11-13'});
 await page.locator('[data-header=calendar]').click();assert((await page.locator('.header-calendar-agenda').innerText()).includes('Preparar pedido QA'));await page.getByRole('button',{name:'Personalizar reloj y calendario',exact:true}).click();assert.deepEqual(await page.evaluate(()=>onlineQA.opened.at(-1)),['configuracion','clock']);
 await page.locator('[data-activity-toggle=balance]').uncheck();assert.equal(await page.locator('[data-activity-series=balance]').evaluate(el=>getComputedStyle(el).display),'none');await page.locator('[data-activity-toggle=balance]').check();assert.notEqual(await page.locator('[data-activity-series=balance]').evaluate(el=>getComputedStyle(el).display),'none');
 await page.evaluate(()=>{onlineQA.owner='B';onlineQA.ui.stop();onlineQA.ui.start();});await page.getByRole('button',{name:'Pedidos online: 2 sin leer',exact:true}).waitFor();
 await page.evaluate(()=>{onlineQA.allowed=false;onlineQA.ui.refreshAccess();});assert.equal(await page.locator('.header-online-bell').isVisible(),false,'Permission revocation clears header access');
 await page.screenshot({path:'qa-artifacts/header-online-orders/'+width+'.png',fullPage:true});assert.deepEqual(errors,[]);report.push({width,api:'simulated',passed:['notice_details','store_filter','durable_seen','owner_isolation','permission_revocation','clock_settings','task_titles','chart_series','no_overflow']});await page.close();
}console.log('Header online orders, settings, task titles and selectable economic series: six widths PASS; simulated API.');}
finally{await browser.close();await server?.close();await writeFile('qa-artifacts/header-online-orders/report.json',JSON.stringify(report,null,2));}
