import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('#nav [data-route=administracion]').click();
 await page.locator('[data-action=admin-section][data-section=backups]').click();
 await page.evaluate(async()=>{const {applyInterfaceAppearance}=await import('../src/appearance-ui.js');applyInterfaceAppearance({fontSize:16,borderWidth:3,cardGlow:10,buttonFinish:'gloss',sidebarWidth:330});});
 for(const width of [320,390,768,816,1024,1440,1920]){
  await page.setViewportSize({width,height:950});
  for(const [frequency,weekly,monthly] of [['daily',false,false],['weekly',true,false],['monthly',false,true]]){
   await page.locator('#backupFrequency').selectOption(frequency);
   assert.equal(await page.locator('#backupWeekdayWrapper').isVisible(),weekly,'Weekly control '+width+' '+frequency);
   assert.equal(await page.locator('#backupMonthdayWrapper').isVisible(),monthly,'Monthly control '+width+' '+frequency);
   for(const name of ['Guardar programación','Crear copia privada ahora','Actualizar historial'])assert(await page.getByRole('button',{name,exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Button text remains within control '+name+' '+width);
   assert(await page.locator('.backup-control-actions').evaluate(el=>{const c=el.getBoundingClientRect(),next=el.nextElementSibling.getBoundingClientRect();return next.top-c.bottom>=15&&parseFloat(getComputedStyle(el).paddingTop)>=16;}),'Actions retain top and bottom breathing room');
   assert(await page.locator('.backup-schedule-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Schedule stays within card '+width);
  }
 }
 assert.deepEqual(errors,[]);console.log('BACKUP SCHEDULE: daily/weekly/monthly visibility, actual app and seven widths, personalized styles and unclipped action labels OK');
}finally{await browser.close();}
