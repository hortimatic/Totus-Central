import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route=administracion]').click();
 await page.locator('[data-action=admin-section][data-section=backups]').click();
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:950});
  for(const [frequency,weekly,monthly] of [['daily',false,false],['weekly',true,false],['monthly',false,true]]){
   await page.locator('#backupFrequency').selectOption(frequency);
   assert.equal(await page.locator('#backupWeekdayWrapper').isVisible(),weekly,'Weekly control '+width+' '+frequency);
   assert.equal(await page.locator('#backupMonthdayWrapper').isVisible(),monthly,'Monthly control '+width+' '+frequency);
   assert(await page.locator('.backup-schedule-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Schedule stays within card '+width);
  }
 }
 assert.deepEqual(errors,[]);console.log('BACKUP SCHEDULE: daily/weekly/monthly visibility, actual app and six widths OK');
}finally{await browser.close();}
