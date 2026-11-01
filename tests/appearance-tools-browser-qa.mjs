import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await fs.mkdir('artifacts/appearance-tools',{recursive:true});
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href='../src/appearance.css';document.head.append(link);
  const {appearancePage,createAppearanceUI}=await import('../src/appearance-ui.js');
  const q=window.toolsQA={owner:'a',editable:true,row:{appearance_revision:0,appearance_config:{brandName:'Marca propia'},login_appearance:{loginBrandName:'Marca compartida',loginLogoMode:'text'}},saves:[]};
  document.querySelector('#chatHarness').innerHTML=appearancePage();
  q.ui=createAppearanceUI({settings:()=>q.row,actor:()=>q.owner,canEdit:()=>q.editable,confirm:async()=>true,save:async(section,config)=>{q.saves.push({section,config});q.row={...q.row,appearance_revision:q.row.appearance_revision+1,[section==='login'?'login_appearance':'appearance_config']:config};}});
  q.ui.mount(document.querySelector('#appearanceRoot'));
 });
 await page.locator('[data-settings-search]').fill('navegacion');
 assert.equal(await page.locator('[data-appearance-group]:visible').count(),1);
 assert.equal(await page.evaluate(()=>toolsQA.ui.hasDraft()),false,'Search does not change preferences');
 assert.equal(await page.evaluate(()=>new FormData(document.querySelector('.appearance-grid')).get('brandName')),'Marca propia','Filtered controls retain their values');
 await page.locator('[name=startModule]').selectOption('equipo');
 await page.locator('[data-settings-search]').fill('');assert.equal(await page.locator('[name=startModule]').inputValue(),'equipo');
 await page.locator('[data-settings-fold]').click();assert.equal(await page.locator('[data-appearance-group][open]').count(),0);
 await page.locator('[data-settings-expand]').click();assert.equal(await page.locator('[data-appearance-group][open]').count(),6);assert.equal(await page.evaluate(()=>toolsQA.saves.length),0);
 await page.locator('[data-appearance-tab=login]').click();
 await page.locator('[data-login-preset]').selectOption('night');await page.locator('[data-login-style]').click();
 assert.equal(await page.locator('[name=loginCardPreset]').inputValue(),'dark');assert.equal(await page.locator('[name=loginBrandName]').inputValue(),'Marca compartida');assert.equal(await page.locator('[data-login-preset]').inputValue(),'night');
 assert.equal(await page.evaluate(()=>toolsQA.row.login_appearance.loginCardPreset),undefined,'Preset remains a preview before save');
 await page.locator('.appearance-grid button[type=submit]').click();await page.getByText('Configuración guardada y aplicada.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>toolsQA.row.login_appearance.loginCardPreset),'dark');assert.equal(await page.evaluate(()=>toolsQA.row.login_appearance.loginBrandName),'Marca compartida');
 for(const width of [1440,831,390,320]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Appearance toolbar has no page overflow at '+width);
  await page.screenshot({path:'artifacts/appearance-tools/login-'+width+'.png',fullPage:true});
 }
 await page.evaluate(()=>{toolsQA.ui.dispose();toolsQA.owner='b';toolsQA.editable=false;toolsQA.ui.mount(document.querySelector('#appearanceRoot'));});
 assert.equal(await page.locator('[data-settings-search]').inputValue(),'');assert.equal(await page.locator('[data-login-style]').isDisabled(),true);assert.equal(await page.locator('[data-settings-expand]').isDisabled(),false);
 await page.locator('[data-settings-search]').fill('fondo');assert((await page.locator('[data-appearance-group]:visible').count())>0);assert.equal(await page.evaluate(()=>toolsQA.saves.length),1,'Read-only search cannot save shared Login');
 assert.deepEqual(errors,[]);console.log('APPEARANCE TOOLS: search/folding without value loss, preset preview and save, branding, read-only permissions, account isolation and four widths OK.');
}catch(error){await page.screenshot({path:'artifacts/appearance-tools/failure.png',fullPage:true});throw error;}finally{await browser.close();}
