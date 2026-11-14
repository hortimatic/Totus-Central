import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startLocalServer} from './local-static-server.mjs';
import {chromium} from 'playwright';
const server=await startLocalServer(),browser=await chromium.launch({headless:true,...(process.env.TOTUS_BROWSER_CHANNEL?{channel:process.env.TOTUS_BROWSER_CHANNEL}:{})});
const html=await readFile('index.html','utf8'),script=html.split('/* Identificar el código cargado')[1].split('</script>')[0];
try{
 for(const width of [390,1920]){
 const page=await browser.newPage({viewport:{width,height:800}}),old='a'.repeat(40),fresh='b'.repeat(40);let calls=0;
 await page.route('**/build-info.json?fresh=*',async route=>{calls++;await route.fulfill({json:{environment:'production',commit:fresh}})});
 await page.goto('http://127.0.0.1:4173/tests/prestashop-harness.html');
 await page.evaluate(old=>{document.body.innerHTML='<span class="app-build"></span><input id="draft" value="edición pendiente">';const tag=document.createElement('script');tag.type='module';tag.src='src/bootstrap.js?v='+old;tag.type='module';tag.setAttribute('src','src/bootstrap.js?v='+old);document.body.append(tag)},old);
 await page.addScriptTag({content:'/* Identificar el código cargado'+script});
 await page.getByRole('link',{name:'Actualizar Totus',exact:true}).waitFor();assert.equal(await page.locator('#draft').inputValue(),'edición pendiente');assert((await page.getByRole('link',{name:'Actualizar Totus',exact:true}).getAttribute('href')).includes('release='+fresh));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.getByRole('button',{name:'Más tarde',exact:true}).click();assert.equal(await page.locator('#releaseNotice').count(),0);
 await page.evaluate(()=>{const now=Date.now;Date.now=()=>now()+31000;window.dispatchEvent(new Event('totus:module-changed'))});await page.waitForFunction(()=>!document.querySelector('#releaseNotice'));assert.equal(await page.locator('[data-release-link]').count(),1);assert.equal(await page.locator('#draft').inputValue(),'edición pendiente');await page.close();
 }
 console.log('Release notice: safe update link, dismissal, no draft reload, one link and responsive widths PASS');
}finally{await browser.close();await server?.close()}
