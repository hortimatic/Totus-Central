import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
import {chromium} from 'playwright';
const server=await startLocalServer(),browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})}),report=[];
await mkdir('qa-artifacts/home-commercial-calendar',{recursive:true});
try{for(const width of [390,768,1017,1440,1920]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');await page.addStyleTag({url:'http://127.0.0.1:4173/src/home-widgets.css'});
 await page.evaluate(async()=>{
  const {createHomeTaskCalendar}=await import('../src/home-task-calendar.js'),{commercialMarginWidget}=await import('../src/home-current-margin.js');
  document.querySelector('#chatHarness').innerHTML='<div class="home-widget-body"><div id="calendar"></div><div id="margin"></div></div>';
  const q=window.calendarQA={owner:'A',calls:[],opened:[],error:false,hold:false,release:null};
  q.ui=createHomeTaskCalendar({actor:()=>q.owner,can:()=>true,onOpen:date=>q.opened.push(date),rpc:async(name,args)=>{
   q.calls.push({name,...args});if(q.error)throw Error('Red simulada no disponible');
   const response={rows:[{task_id:'1',title:'Revisar pedido <img onerror=alert(1)>',scheduled_on:args.p_from,state:'pending'},{task_id:'2',title:'Tarea completada',scheduled_on:args.p_from,state:'done'}]};
   if(q.hold)return new Promise(resolve=>{q.release=()=>resolve(response);});return response;
  }});q.ui.mount(document.querySelector('#calendar'));
  document.querySelector('#margin').innerHTML=commercialMarginWidget({hortimatic:{complete:true,rows:[{id:'1',valid:'1',currency_code:'EUR',margin_value:-3.25,date_add:'2026-11-12 12:00:00'}]},newoldsmok:{complete:true,rows:[{id:'1',valid:'1',currency_code:'EUR',margin_value:5.50,date_add:'2026-11-12 13:00:00'}]}},{id:'gain',from:'2026-11-11',to:'2026-11-12'});
 });
 const idle=()=>page.waitForFunction(()=>document.querySelector('[data-ht-action=refresh]')?.disabled===false);
 await idle();assert((await page.locator('[data-ht-action=date]').count())>=28);
 await page.getByRole('button',{name:'Día',exact:true}).click();await idle();assert.equal(await page.locator('[data-ht-action=date]').count(),1);
 await page.locator('[data-ht-date]').fill('2026-11-12');await page.locator('[data-ht-date]').blur();await idle();
 await page.getByText('Tarea completada',{exact:true}).waitFor();assert.equal(await page.locator('#calendar img').count(),0,'Task text is escaped');
 await page.getByRole('button',{name:'Abrir Tareas',exact:true}).click();assert.deepEqual(await page.evaluate(()=>calendarQA.opened),['2026-11-12']);
 await page.getByRole('button',{name:'Semana',exact:true}).click();await idle();assert.equal(await page.locator('[data-ht-action=date]').count(),7);
 await page.getByRole('button',{name:'Mes',exact:true}).click();await idle();await page.locator('[data-ht-date]').fill('2024-01-31');await page.locator('[data-ht-date]').blur();await idle();await page.getByRole('button',{name:'Periodo siguiente',exact:true}).click();await idle();assert.equal(await page.locator('[data-ht-date]').inputValue(),'2024-02-29');
 await page.evaluate(()=>{calendarQA.error=true;});await page.getByRole('button',{name:'Actualizar',exact:true}).click();await idle();await page.getByRole('status').filter({hasText:'Red simulada no disponible'}).waitFor();
 await page.evaluate(()=>{calendarQA.error=false;calendarQA.hold=true;});await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.waitForFunction(()=>typeof calendarQA.release==='function');
 await page.evaluate(()=>{calendarQA.owner='B';calendarQA.hold=false;calendarQA.ui.mount(document.querySelector('#calendar'));});await idle();const date=await page.locator('[data-ht-date]').inputValue();await page.evaluate(async()=>{calendarQA.release();await new Promise(r=>setTimeout(r,0));});assert.equal(await page.locator('[data-ht-date]').inputValue(),date,'A late response cannot restore previous-account date/data');
 assert.match(await page.locator('.home-commercial-total').innerText(),/2,25/);assert.equal(await page.locator('.home-commercial-chart svg').count(),1);assert.equal(await page.locator('.home-commercial-shops>div').count(),2);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await page.screenshot({path:'qa-artifacts/home-commercial-calendar/'+width+'.png',fullPage:true});report.push({width,api:'simulated',passed:['day_week_month','leap_year','open_date','escaped_task_text','network_error','late_account_response','two_store_margin','negative_margin_chart','no_overflow']});await page.close();
}console.log('Home calendar and commercial margin: five widths, periods, date navigation, failures and account isolation PASS; simulated API.');}
finally{await browser.close();await server?.close();await writeFile('qa-artifacts/home-commercial-calendar/report.json',JSON.stringify(report,null,2));}
