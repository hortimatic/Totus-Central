import assert from 'node:assert/strict';import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{for(const touch of [false,true]){
 const context=await browser.newContext({viewport:{width:touch?390:1440,height:900},isMobile:touch,hasTouch:touch}),page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/tests/chat-harness.html');
 await page.evaluate(async()=>{const {fieldHelp}=await import('../src/components.js');document.body.innerHTML='<div style="padding:30px"><label style="display:grid;width:85vw">Campo de conexión'+fieldHelp('Campo de conexión','Ayuda comprobada, solo sobre el icono.')+'<input aria-label="Campo de conexión"></label><button id="outside">Fuera de la ayuda</button></div>';});
 const help=page.locator('details.field-help'),trigger=help.locator('summary'),outside=page.locator('#outside');
 const box=await trigger.boundingBox();assert(box.width<=26);
 if(!touch){await page.mouse.move(box.x+250,box.y+12);assert.equal(await help.evaluate(e=>e.open),false,'hovering the label line cannot open help');await trigger.hover();assert.equal(await help.evaluate(e=>e.open),true);await trigger.click();assert.equal(await help.evaluate(e=>e.open),false,'click closes a hovered help');await trigger.click();}
 else await trigger.tap();
 assert.equal(await help.evaluate(e=>e.open),true);if(touch)await outside.tap();else await outside.click();assert.equal(await help.evaluate(e=>e.open),false,'outside interaction closes pinned help');
 if(!touch){await trigger.hover();await page.keyboard.press('Escape');assert.equal(await help.evaluate(e=>e.open),false);}
 await context.close();
}console.log('HELP INTERACTION: icon-only hover, click/touch toggle, outside and Escape close.');}finally{await browser.close();}
