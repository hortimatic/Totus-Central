import {clickModuleLink} from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),failures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 // Match the stylesheet set in the production entrypoint; the generic mock omits module styles.
 await page.addStyleTag({url:'http://127.0.0.1:4173/src/team-chat.css'});
 await page.addStyleTag({url:'http://127.0.0.1:4173/src/tasks.css'});
 const routes=await page.locator('#nav [data-route]').evaluateAll(nodes=>nodes.map(n=>n.dataset.route));
 for(const preset of ['totus','newoldsmok']){
  await page.evaluate(async preset=>{const {APPEARANCE_PRESETS}=await import('../src/appearance-core.js');const {applyInterfaceAppearance}=await import('../src/appearance-ui.js');applyInterfaceAppearance({...APPEARANCE_PRESETS[preset],fontSize:16,sidebarWidth:330,borderWidth:3,cardGlow:15,buttonGlow:23});},preset);
  for(const route of routes){
   await clickModuleLink(page,page.locator('#nav [data-route="'+route+'"]'));
   for(const width of [320,390,768,816,1024,1440,1920]){
    await page.setViewportSize({width,height:950});
    const size=await page.locator('#content').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
    if(size.scroll>size.client+2)failures.push({preset,route,width,...size});
   }
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[],'Personalized module pages must not overflow at narrow desktop content widths');
 console.log('PERSONAL LAYOUT SWEEP: '+routes.length+' modules, light/dark, largest font/sidebar/borders and seven screen widths OK');
}finally{await browser.close();}
