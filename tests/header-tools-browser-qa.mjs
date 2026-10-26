import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/header-tools-fixture.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-clock]').innerText(),'13:00:00');
  assert.equal(await page.locator('[data-chat-count]').innerText(),'3');assert.equal(await page.locator('[data-task-count]').innerText(),'2');
  await page.locator('[data-header="calendar"]').click();assert.equal(await page.locator('[data-header="day"]').count(),31);
  assert.equal(await page.locator('[aria-current="date"]').getAttribute('data-date'),'2026-10-26');
  assert(await page.evaluate(()=>document.querySelector('#headerTools').getBoundingClientRect().left>document.querySelector('.topbar h1').getBoundingClientRect().left),'Controls belong on the right');
  assert(await page.evaluate(()=>document.querySelector('[data-calendar]').getBoundingClientRect().right<=innerWidth),'Calendar must fit on mobile');
  await page.locator('[data-header="next"]').click();assert.equal(await page.locator('[data-header="day"]').count(),30);
  await page.locator('[data-header="prev"]').click();assert.equal(await page.locator('[data-header="day"]').count(),31);
  await page.locator('[data-header="today"]').click();assert.equal(await page.locator('[aria-current="date"]').getAttribute('data-date'),'2026-10-26');
  await page.locator('[data-header="next"]').click();
  await page.locator('[data-date="2026-11-03"]').click();
  assert.deepEqual(await page.evaluate(()=>window.headerCalls[0]),['tareas','2026-11-03']);
  await page.locator('[data-header="chat"]').click();assert.equal((await page.evaluate(()=>window.headerCalls[1]))[0],'equipo');
  await page.locator('[data-header="calendar"]').click();await page.keyboard.press('Escape');assert.equal(await page.locator('[data-calendar]').isVisible(),false);
  await page.evaluate(()=>{window.header.stop();window.header.start();});assert.equal(await page.locator('#headerTools').count(),1);
  await page.evaluate(()=>window.header.stop());assert.equal(await page.locator('#headerTools').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('HEADER TOOLS: Madrid clock, pending tasks, unread chat, right alignment, month lengths, date navigation, Escape and lifecycle verified at desktop/mobile');
}finally{await browser.close()}
