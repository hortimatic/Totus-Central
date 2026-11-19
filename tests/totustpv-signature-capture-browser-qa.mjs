import assert from 'node:assert/strict';import {chromium} from 'playwright';import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{fixture.workspace.dispose();const {createSignatureCapture}=await import('/src/totustpv/signature-capture.js');window.inkFixture={capture:createSignatureCapture()};window.openInk=()=>{inkFixture.done=false;inkFixture.capture.capture({documentLabel:'Factura de prueba <b>123</b>',acceptanceText:'Recepción de prueba; sin efectos reales.'}).then(result=>{inkFixture.result=result;inkFixture.done=true;});};openInk();});
 assert.equal(await page.getByRole('heading',{name:'Firma del cliente',exact:true}).count(),1);
 assert.equal(await page.locator('[data-signature-document] b').count(),0);
 await page.getByRole('button',{name:'Aceptar firma',exact:true}).click();await page.getByRole('alert').filter({hasText:'Traza la firma'}).waitFor();assert.equal(await page.evaluate(()=>inkFixture.done),false);
 const canvas=page.locator('canvas'),rect=await canvas.boundingBox();
 const draw=async()=>{await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.3);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.55,rect.y+rect.height*.7,{steps:12});await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.2,{steps:10});await page.mouse.up();};
 await draw();await page.getByRole('button',{name:'Borrar firma',exact:true}).click();
 await page.getByRole('button',{name:'Aceptar firma',exact:true}).click();assert.equal(await page.evaluate(()=>inkFixture.done),false);
 await draw();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.getByRole('button',{name:'Aceptar firma',exact:true}).click();await page.waitForFunction(()=>inkFixture.done);
 const result=await page.evaluate(()=>inkFixture.result);assert.equal(result.width,1000);assert.equal(result.height,400);assert.equal(result.strokes.length,1);assert.ok(result.strokes[0].length>2);assert.equal(await page.locator('.tpv-signature-dialog').count(),0);
 await page.evaluate(()=>openInk());await page.keyboard.press('Escape');await page.waitForFunction(()=>inkFixture.done);assert.equal(await page.evaluate(()=>inkFixture.result),null);
 await page.evaluate(()=>openInk());await page.evaluate(()=>inkFixture.capture.cancel());await page.waitForFunction(()=>inkFixture.done);assert.equal(await page.evaluate(()=>inkFixture.result),null);
 assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS signature capture desktop/mobile: blank refusal, clear redraw, bounded real pointer ink, literal document title, accept, Escape and dispose cancellation; fictional signature only, no document or storage write.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
