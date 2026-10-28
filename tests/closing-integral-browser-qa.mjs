import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import XLSX from 'xlsx-js-style';
const browser=await chromium.launch({headless:true}),results=[];
const attempt=async(name,run)=>{try{await run();results.push({name,ok:true})}catch(error){results.push({name,ok:false,error:error.message})}};
async function fresh(){const p=await browser.newPage({viewport:{width:1440,height:950}});p.setDefaultTimeout(6000);p.on('dialog',dialog=>dialog.accept());await p.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});await p.locator('#nav [data-route="cajas"]').click();await p.locator('[data-action="closing-new"]').click();return p}
async function drawers(p,values=[{Open:10,Close:20,Card:30},{Open:10,Close:20,Card:30}]){const ids=await p.locator('.drawer-entry').evaluateAll(es=>es.sort((a,b)=>Number(b.querySelector('h3').textContent.includes('Vape'))-Number(a.querySelector('h3').textContent.includes('Vape'))).map(e=>e.dataset.drawerId));for(let i=0;i<ids.length;i++)for(const field of ['Open','Close','Card','Bizum','Online','Other','Withdraw','CashExpense','ExtraIn','ExtraOut'])await p.locator('#dr'+field+'_'+ids[i]).fill(String(values[i]?.[field]??0));return ids}
try{
 await attempt('a partial draft preserves unknown closing cash after reopening',async()=>{const p=await fresh();try{const ids=await drawers(p);await p.locator('#drClose_'+ids[0]).fill('');await p.locator('[data-action="closing-save-draft"]').click();await p.getByText('Borrador guardado.',{exact:true}).waitFor();assert.equal(await p.locator('#drClose_'+ids[0]).inputValue(),'','Unknown cash became a recorded zero');assert.match(await p.locator('#clCalcTotal').innerText(),/completar/i)}finally{await p.close()}});
 await attempt('negative cash in one till cannot be offset by the other till',async()=>{const p=await fresh();try{await drawers(p,[{Open:100,Close:50},{Open:0,Close:100}]);await p.locator('#clReported').fill('50');await p.locator('[data-action="closing-save-close"]').click();assert.equal(await p.evaluate(()=>window.__mockDb.ops_daily_closings.filter(c=>c.status==='cerrado').length),0,'Two tills hid an impossible negative cash sale')}finally{await p.close()}});
 await attempt('invalid amounts cannot keep a plausible sales preview',async()=>{const p=await fresh();try{const ids=await drawers(p);await p.locator('#drCard_'+ids[0]).fill('abc');assert.equal(await p.locator('#clCalcTotal').innerText(),'—','Invalid money was replaced with zero');await p.locator('#drCard_'+ids[0]).fill('30,00');assert.match(await p.locator('#clCalcTotal').innerText(),/80,00/)}finally{await p.close()}});
 await attempt('changing store in a saved draft reloads its own tills',async()=>{const p=await fresh();try{await drawers(p);await p.locator('[data-action="closing-save-draft"]').click();await p.getByText('Borrador guardado.',{exact:true}).waitFor();const other=await p.evaluate(()=>window.__mockDb.ops_stores[1].id);await p.locator('#clStore').selectOption(other);const confirm=p.locator('[data-confirm="accept"]');if(await confirm.isVisible())await confirm.click();assert.equal(await p.locator('.drawer-entry').count(),1,'The previous store tills remain in the editor')}finally{await p.close()}});
 await attempt('exported reconciliation label matches the accepted screen',async()=>{const p=await fresh();try{await drawers(p);await p.locator('#clReported').fill('80');await p.locator('[data-action="closing-save-close"]').click();await p.getByText('Cierre cerrado y cuadrado.',{exact:true}).last().waitFor();await p.locator('[data-action="closing-back"]').click();await p.evaluate(()=>{window.XLSX.writeFile=wb=>{window.__closingExport=window.XLSX.utils.sheet_to_json(wb.Sheets.Cierres,{header:1})}});await p.locator('[data-action="export-closings-current"]').click();const rows=await p.evaluate(()=>window.__closingExport);assert.equal(rows[4][9],'Conciliado y aceptado','Export reports a different reconciliation state')}finally{await p.close()}});
 await attempt('movements, fiscal inclusion, reopening and next-day cash stay coherent',async()=>{const p=await fresh();try{
  const ids=await drawers(p,[{Open:100,Close:120,Card:200,Withdraw:50,CashExpense:10,ExtraIn:5,ExtraOut:2},{Open:20,Close:30,Card:40,Bizum:5,Online:3,Other:2,Withdraw:15}]);
  await p.locator('#clReported').fill('352');
  await p.locator('[data-action="closing-save-close"]').click();await p.getByText('Cierre cerrado y cuadrado.',{exact:true}).last().waitFor();
  const check=()=>p.evaluate(async()=>{const db=window.__mockDb,{closingIncomeAmount}=await import('/src/calculations.js');return {income:db.ops_daily_closings.reduce((s,c)=>s+closingIncomeAmount(c),0),row:db.ops_daily_closings[0]}});
  let c=await check();assert.equal(c.income,352);assert.equal(c.row.cash_sales,102);assert.equal(c.row.cash_withdrawals,65);
  await p.locator('[data-action="closing-reopen"]').click();await p.getByText('Cierre reabierto.',{exact:true}).waitFor();assert.equal((await check()).income,0,'Draft reappeared in fiscal income');
  await p.locator('[data-action="closing-save-close"]').click();await p.getByText('Cierre cerrado y cuadrado.',{exact:true}).last().waitFor();assert.equal((await check()).income,352,'Reclosing duplicated income');
  const balance=await p.evaluate(async ids=>{const {lastDrawerBalance}=await import('/src/historical-acceptance.js'),db=window.__mockDb;return ids.map(id=>lastDrawerBalance({closings:db.ops_daily_closings,closingDrawers:db.ops_daily_closing_drawers,storeId:db.ops_stores[0].id,drawer:db.ops_cash_drawers.find(d=>d.id===id),before:'2099-01-01'})?.amount)},ids);
  assert.deepEqual(balance,[120,30]);
 }finally{await p.close()}});
 await attempt('incomplete draft export leaves unknown figures blank and retains known movements',async()=>{const p=await fresh();try{
  const ids=await drawers(p);await p.locator('#drOpen_'+ids[0]).fill('');await p.locator('#drClose_'+ids[0]).fill('');await p.locator('[data-action="closing-save-draft"]').click();await p.getByText('Borrador guardado.',{exact:true}).waitFor();
  assert.equal(await p.locator('#drOpen_'+ids[0]).inputValue(),'');await p.locator('[data-action="closing-back"]').click();
  await p.evaluate(()=>window.XLSX.writeFile=wb=>{window.__qaExport=Object.fromEntries(wb.SheetNames.map(k=>[k,window.XLSX.utils.sheet_to_json(wb.Sheets[k],{header:1,defval:''})]))});
  await p.locator('[data-action="export-closings-current"]').click();const wb=await p.evaluate(()=>window.__qaExport);
  const detail=wb['Detalle por caja'].find(row=>row[2]==='Caja Vape');
  assert.equal(wb.Cierres[4][7],'');assert.equal(detail[3],'');assert.equal(detail[4],'');assert.equal(detail[13],'');assert.equal(detail[5],30);
 }finally{await p.close()}});
 await attempt('downloaded Excel contains the actual saved totals and both till balances',async()=>{const p=await fresh();try{
  await drawers(p,[{Open:100,Close:120,Card:200,Withdraw:50},{Open:20,Close:30,Card:40,Withdraw:15}]);
  await p.locator('#clReported').fill('335');await p.locator('[data-action="closing-save-close"]').click();await p.getByText('Cierre cerrado y cuadrado.',{exact:true}).last().waitFor();
  await p.locator('[data-action="closing-back"]').click();const event=p.waitForEvent('download');await p.locator('[data-action="export-closings-current"]').click();
  const file=await event;assert.match(file.suggestedFilename(),/^cierres_.*\.xlsx$/);
  const wb=XLSX.read(await readFile(await file.path()),{type:'buffer'}),rows=XLSX.utils.sheet_to_json(wb.Sheets.Cierres,{header:1}),detail=XLSX.utils.sheet_to_json(wb.Sheets['Detalle por caja']);
  assert.equal(rows[4][7],335);assert.equal(wb.Sheets.Cierres.H6.v,335);assert.equal(rows[4][9],'Conciliado y aceptado');
  assert.equal(detail.find(r=>r.Caja==='Caja Vape').Cierre,120);assert.equal(detail.find(r=>r.Caja==='Caja Head').Cierre,30);assert.equal(detail.reduce((s,r)=>s+r.Salidas,0),65);
 }finally{await p.close()}});
 await attempt('verified historical sales stay visible in Excel without duplicating monthly fiscal income',async()=>{const p=await fresh();try{
  await drawers(p);await p.locator('#clReported').fill('80');await p.locator('[data-action="closing-save-close"]').click();await p.getByText('Cierre cerrado y cuadrado.',{exact:true}).last().waitFor();
  const income=await p.evaluate(async()=>{const db=window.__mockDb;db.ops_daily_closings[0].include_in_income=false;await(await import('/src/api.js')).loadCore();return (await import('/src/calculations.js')).closingIncomeAmount(db.ops_daily_closings[0])});assert.equal(income,0);
  await p.locator('[data-action="closing-back"]').click();await p.evaluate(()=>window.XLSX.writeFile=wb=>window.__qaHistorical=window.XLSX.utils.sheet_to_json(wb.Sheets.Cierres,{header:1}));
  await p.locator('[data-action="export-closings-current"]').click();assert.equal((await p.evaluate(()=>window.__qaHistorical))[4][7],80,'Fiscal exclusion incorrectly hid operational sales');
 }finally{await p.close()}});
 await attempt('desktop and mobile list and editor have no horizontal page overflow',async()=>{const p=await fresh();try{
  await drawers(p);await p.locator('#clReported').fill('80');await p.locator('[data-action="closing-save-close"]').click();await p.getByText('Cierre cerrado y cuadrado.',{exact:true}).last().waitFor();
  for(const width of [320,360,375,390,414,480,600,700,768,820,900,1024,1100,1280,1440,1920,2560]){
   await p.setViewportSize({width,height:900});await p.waitForTimeout(180);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Editor overflows at '+width);
  }
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(4200);await p.screenshot({path:'artifacts/closing_mobile_detail.png'});
  await p.locator('[data-action="closing-back"]').click();
  for(const width of [320,390,768,1024,1440,1920]){await p.setViewportSize({width,height:950});await p.waitForTimeout(180);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'List overflows at '+width)}
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'artifacts/closing_desktop_list.png'});
 }finally{await p.close()}});
}finally{await mkdir('artifacts',{recursive:true});await writeFile('artifacts/closing-integral.json',JSON.stringify(results,null,2));await browser.close()}
for(const r of results)console.log((r.ok?'PASS ':'FAIL ')+r.name+(r.error?' — '+r.error:''));assert.equal(results.filter(x=>!x.ok).length,0);
