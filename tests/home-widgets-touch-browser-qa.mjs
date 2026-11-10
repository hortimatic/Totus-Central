import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';

const server=await startLocalServer();
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({
 viewport:{width:390,height:1000},isMobile:true,hasTouch:true,
 deviceScaleFactor:1,locale:'es-ES'
});
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
try{
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.locator('[data-home-widget="income"]').waitFor({timeout:25000});
 await page.locator('[data-home-command="edit"]').click();
 const from=page.locator('[data-home-grip="income"]'),
       to=page.locator('[data-home-widget="expense"]');
 await page.evaluate(()=>{const card=document.querySelector('[data-home-widget="income"]');window.scrollTo(0,window.scrollY+card.getBoundingClientRect().top-140)});
 await page.waitForTimeout(100);
 const before=await page.locator('.home-widget-grid > [data-home-widget]').evaluateAll(els=>els.map(x=>x.dataset.homeWidget));
 assert(before.indexOf('income')>=0&&before.indexOf('expense')>=0);
 const a=await from.boundingBox(),b=await to.boundingBox();
 assert(a&&b,'Dos widgets deben existir y estar dispuestos en la pantalla táctil');
 assert(a.y>=0&&b.y+b.height<1000,'Los widgets deben entrar en el viewport táctil de prueba');
 const source={x:a.x+a.width/2,y:a.y+a.height/2},
       target={x:b.x+Math.min(40,b.width/2),y:b.y+Math.min(50,b.height/2)};
 const cdp=await ctx.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[source]});
 for(let t=1;t<=6;t++){
  const k=t/6;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{
   x:source.x+(target.x-source.x)*k,y:source.y+(target.y-source.y)*k
  }]});
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(100);
 const after=await page.locator('.home-widget-grid > [data-home-widget]').evaluateAll(els=>els.map(x=>x.dataset.homeWidget));
 assert(after.indexOf('income')!==before.indexOf('income'),'El tirador táctil mueve el widget realmente');
 assert.equal(after.indexOf('income'),before.indexOf('expense'),'El widget se coloca sobre la posición elegida');
 await page.locator('[data-home-widget="income"] [data-home-resize]').scrollIntoViewIfNeeded();
 const handle=page.locator('[data-home-widget="income"] [data-home-resize]');
 const preHeight=await page.locator('[data-home-widget="income"]').getAttribute('style');
 const hb=await handle.boundingBox();
 assert(hb,'El tirador de tamaño está visible en móvil');
 const first={x:hb.x+hb.width/2,y:hb.y+hb.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});
 for(let t=1;t<=5;t++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:first.x,y:first.y+70*t/5}]});
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const postHeight=await page.locator('[data-home-widget="income"]').getAttribute('style');
 assert.notEqual(preHeight,postHeight,'El tirador móvil ajusta la altura del widget');
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),'La edición táctil no crea desplazamiento horizontal');
 assert.deepEqual(errors,[],'No aparecen excepciones JavaScript');
 console.log('INICIO TACTIL PASS: arrastre y cambio de altura con gestos touch reales; sin desbordamiento.');
}finally{
 await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
}