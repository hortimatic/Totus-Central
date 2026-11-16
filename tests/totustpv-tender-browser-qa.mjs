import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}});
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.getByRole('button',{name:'Practicar sin ventas reales'}).click();
 await page.getByRole('button',{name:'Abrir caja de práctica',exact:true}).click();
 await page.getByRole('button',{name:/Artículo de práctica/}).click();
 await page.getByRole('button',{name:'Preparar cobro de práctica'}).click();
 const status=page.getByRole('status',{name:'Cambio del cobro'}),confirm=page.getByRole('button',{name:'Confirmar venta de práctica'});
 await page.getByRole('button',{name:'Entregado 5 euros',exact:true}).click();
 assert.match(await status.innerText(),/Falta por entregar\s+3,01/);assert.equal(await confirm.isDisabled(),true);
 await page.getByRole('button',{name:'Entregado 10 euros',exact:true}).click();
 assert.equal(await page.locator('[name=received]').inputValue(),'10,00');
 assert.match(await status.innerText(),/Cambio a devolver\s+1,99/);assert.equal(await confirm.isEnabled(),true);
 await page.locator('[name=received]').fill('20,00');assert.match(await status.innerText(),/11,99/);
 await page.locator('[name=received]').fill('1e3');assert.equal(await confirm.isDisabled(),true);assert.match(await status.innerText(),/importe válido/);
 await page.getByRole('button',{name:'Importe exacto',exact:true}).click();assert.match(await status.innerText(),/Cambio a devolver\s+0,00/);
 await page.locator('[name=method]').selectOption('mixed');await page.locator('[name=cashPart]').fill('3,00');
 await page.getByRole('button',{name:'Entregado 10 euros',exact:true}).click();
 assert.match(await status.innerText(),/Cambio a devolver\s+7,00/);assert.match(await status.innerText(),/Importe de tarjeta\s+5,01/);
 assert.equal(await confirm.isDisabled(),true);await page.locator('[name=cardAccepted]').check();assert.equal(await confirm.isEnabled(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await confirm.click();await page.getByText('Venta de práctica registrada',{exact:true}).waitFor();
 assert.match(await page.locator('[aria-label="Resultado de venta"]').innerText(),/7,00/);
 await page.getByRole('button',{name:'Caja',exact:true}).click();assert.match(await page.locator('.tpv-session').innerText(),/103,00/);
 await page.close();
 }
 console.log('PASS tender at desktop/mobile: banknotes, live/manual/exact change, underpayment, mixed allocation, invalid input and physical cash after change. Practice only.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
