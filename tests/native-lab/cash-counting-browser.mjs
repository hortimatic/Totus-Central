import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from '../local-static-server.mjs';
export async function exerciseNativeCashCountBrowser({handle,actor,preferences,db,session}){
 const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[],closes=[];
 let loseClose=true;page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',async route=>{const url=new URL(route.request().url());
   if(url.origin==='http://127.0.0.1:4173')return route.continue();
   if(url.origin==='https://preproduccion.hortimatic.com'&&url.pathname.startsWith('/img/')){
    const response=await fetch('http://127.0.0.1:8772'+url.pathname,{redirect:'error'});return route.fulfill({status:response.status,body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')||'image/jpeg'});
   }return route.abort('blockedbyclient');
  });
  await page.route('**/__cash_preferences',async route=>{const {drawer,value}=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await preferences(drawer,value))});});
  await page.route('**/__cash_fixture',async route=>{const payload=JSON.parse(route.request().postData()),response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(payload)})),body=await response.text();
   if(payload.action==='close'){closes.push(payload);if(response.status===200&&loseClose){loseClose=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'TPV_STORAGE_UNAVAILABLE'})});}}
   return route.fulfill({status:response.status,contentType:'application/json',body});
  });
  await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
  await page.evaluate(async actor=>{
   fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js'),{createCentralTpvAdapter}=await import('/src/totustpv/central-adapter.js');
   window.cashWorkspace=createTpvWorkspace({actor:()=>({id:actor,active:true,full_name:'Cajero del laboratorio'}),can:()=>true,confirm:async()=>true,autoOpen:true,
    workspacePreferences:async(drawer,value)=>{const response=await fetch('/__cash_preferences',{method:'POST',body:JSON.stringify({drawer,value})});return response.json();},
    createLiveAdapter:()=>createCentralTpvAdapter({actorId:actor,storage:localStorage,invoke:async payload=>{const response=await fetch('/__cash_fixture',{method:'POST',body:JSON.stringify(payload)}),result=await response.json();
     if(!response.ok||result.error){const error=Error(result.error||'Cash fixture failed');error.code=result.error;throw error;}return result;}})});cashWorkspace.mount(document.querySelector('#tpv'));
  },actor);
  await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
  await page.getByLabel('Billetes y monedas',{exact:true}).selectOption(['2000','500','100','1']);await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();
  await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();
  await db.exec('reset role');const pref=(await db.query('select cash_options from private.totus_tpv_workspace_preferences where actor_id=$1',[actor])).rows[0];assert.deepEqual(pref.cash_options.denominations,[2000,500,100,1]);
  await page.getByRole('button',{name:'Caja',exact:true}).click();const close=page.locator('[data-tpv-form="close"]');await close.locator('[data-tpv-count="counted"] summary').click();
  for(const [face,count]of [[2000,5],[500,1],[100,3],[1,1]])await close.locator(`[name=countedCoin${face}]`).fill(String(count));
  assert.equal(await close.locator('[name=counted]').inputValue(),'108,01');
  await mkdir('artifacts/totustpv-cash-counting',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/totustpv-cash-counting/native-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
  await close.getByRole('button',{name:'Cerrar caja',exact:true}).click();await page.getByRole('alert').filter({hasText:'TPV_STORAGE_UNAVAILABLE'}).waitFor();
  assert.equal(await close.locator('[name=countedCoin2000]').inputValue(),'5');await close.getByRole('button',{name:'Cerrar caja',exact:true}).click();
  await page.getByText('Caja cerrada. Diferencia:',{exact:false}).waitFor();assert.equal(closes.length,2);assert.equal(closes[0].operationId,closes[1].operationId);assert.equal(closes[1].countedCents,10801);
  await db.exec('reset role');const record=(await db.query('select status,counted_cents,closed_by,closing_request_id from private.totus_tpv_sessions where id=$1',[session])).rows[0];
  assert.equal(record.status,'closed');assert.equal(Number(record.counted_cents),10801);assert.equal(record.closed_by,actor);assert.equal(record.closing_request_id,closes[0].operationId);assert.deepEqual(errors,[]);
  console.log('PASS native cash counting: browser settings persisted through authenticated RPC, actual native cash sale 8.01, integer denomination count 108.01, SQL close, lost-close reply and recovery of the same request after cash session disappeared, desktop/mobile. Local fixtures only; no physical cash or remote QA certification.');
 }finally{await page.close();await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
