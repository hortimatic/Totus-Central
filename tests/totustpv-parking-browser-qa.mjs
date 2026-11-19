import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  window.parkingFixture={preferences:{parking:{enabled:true,ttlDays:7},lineOptions:{allowPriceChanges:true}},writes:[],claims:[],parks:[],archives:[],seller:true,omitReadback:false,
   rows:[{id:'expired',version:1,status:'parked',label:'Ticket caducado',lineCount:1,expiresAt:'2000-01-01T10:00:00Z',expired:true},
    {id:'valid',version:1,status:'parked',label:'Ticket vigente según servidor',lineCount:1,expiresAt:'2000-01-01T10:00:00Z',expired:false},
    {id:'legacy',version:1,status:'parked',label:'Ticket anterior sin plazo',lineCount:1},
    {id:'dispatched',version:2,status:'checkout',mine:true,sessionId:'session',checkoutId:'operation',label:'Cobro enviado pendiente',lineCount:1,expiresAt:'2000-01-01T10:00:00Z',expired:true}]};
  const f=parkingFixture,products=[{id:'11:0',nativeProductId:11,name:'Artículo ficticio',stock:6,priceCents:801,unitPriceOverride:true}];
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'store',name:'Caja ficticia',canSell:f.seller,canOpen:false,canReconcile:true}],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>structuredClone(products),setCustomer:async()=>{},drafts:async()=>structuredClone(f.rows),
   abandonDraft:async()=>{},archiveDraft:async({draftId})=>{f.archives.push(draftId);f.rows=f.rows.filter(row=>row.id!==draftId);return {status:'archived'};},
   claimDraft:async({draftId})=>{f.claims.push(draftId);return {draft:{...f.rows.find(row=>row.id===draftId),status:'claimed',mine:true},customer:null,lines:[{productId:'11:0',name:'Artículo ficticio',qty:1,unitCents:801,stock:6,minimumQty:1,discountKind:'price',discountValue:'7,25'}]};},
   park:async data=>{f.parks.push(structuredClone(data));return {id:'renewed',version:3,status:'parked',expiresAt:'2099-01-01T10:00:00Z',expired:false};}};
  f.workspace=createTpvWorkspace({actor:()=>({id:'operator',active:true}),can:()=>true,confirm:async()=>true,autoOpen:true,createLiveAdapter:()=>adapter,
   workspacePreferences:async(drawer,value)=>{if(value){f.writes.push(structuredClone(value));f.preferences={...f.preferences,...structuredClone(value)};}const result=structuredClone(f.preferences);if(f.omitReadback)delete result.parking;return result;}});
  f.workspace.mount(document.querySelector('#tpv'));
 });
 await page.locator('[data-tpv-add="11:0"]').waitFor();
 const settings=async()=>{await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();};
 const save=async()=>{await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();await page.getByText('Mostrador guardado en tu cuenta.',{exact:true}).waitFor();};
 await settings();assert.equal(await page.locator('[name=parkingEnabled]').isChecked(),true);assert.equal(await page.locator('[name=parkingTtlDays]').inputValue(),'7');
 await page.locator('[name=parkingTtlDays]').selectOption('30');await page.locator('[name=parkingEnabled]').uncheck();await save();
 assert.deepEqual(await page.evaluate(()=>parkingFixture.writes.at(-1).parking),{enabled:false,ttlDays:30});
 await page.getByRole('button',{name:'Venta',exact:true}).click();await page.locator('[data-tpv-add="11:0"]').click();if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Aparcar ticket',exact:true}).isDisabled(),true);await page.getByText(/Los tickets anteriores siguen en Más acciones/).waitFor();
 // Clearing a working ticket does not remove any server-side parked document.
 await page.getByRole('button',{name:'Vaciar ticket',exact:true}).click();
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Tickets aparcados',exact:true}).click();
 assert.equal(await page.locator('[data-tpv-draft-id=expired]').isDisabled(),true);
 assert.equal(await page.locator('[data-tpv-draft-id=valid]').isDisabled(),false,'A past timestamp alone cannot override the server expiry flag');
 assert.equal(await page.locator('[data-tpv-draft-id=legacy]').isDisabled(),false);await page.getByText('Sin caducidad',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Consultar cobro pendiente',exact:true}).waitFor();
 await page.locator('[data-tpv-archive-draft=expired]').click();assert.deepEqual(await page.evaluate(()=>parkingFixture.archives),['expired']);
 await page.locator('[data-tpv-draft-id=valid]').click();await page.getByText('Ticket recuperado. Revisa el cálculo nativo antes de cobrar.',{exact:true}).waitFor().catch(async error=>{console.error(await page.locator('#tpv').innerText());throw error;});
 assert.deepEqual(await page.evaluate(()=>parkingFixture.claims),['valid']);
 await settings();await page.locator('[name=parkingEnabled]').check();await page.locator('[name=parkingTtlDays]').selectOption('1');await save();
 await page.getByRole('button',{name:'Venta',exact:true}).click();if(width===390)await page.getByRole('button',{name:'Ver ticket',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Aparcar ticket',exact:true}).isDisabled(),false);await page.getByRole('button',{name:'Aparcar ticket',exact:true}).click();
 await page.getByText('Ticket aparcado. No se ha creado una venta ni reservado existencias.',{exact:true}).waitFor();
 assert.deepEqual((await page.evaluate(()=>parkingFixture.parks.at(-1))).lines[0].discount,{kind:'price',value:725});
 // Configuration readback must confirm the chosen policy before local state changes.
 await settings();await page.locator('[name=parkingTtlDays]').selectOption('7');await page.evaluate(()=>{parkingFixture.omitReadback=true;});await page.getByRole('button',{name:'Guardar mostrador',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'No se ha confirmado la configuración de tickets aparcados'}).waitFor();
 await page.evaluate(()=>{parkingFixture.workspace.dispose();parkingFixture.seller=false;parkingFixture.omitReadback=false;parkingFixture.workspace.mount(document.querySelector('#tpv'));});
 await page.getByText('Acceso de consulta.',{exact:false}).waitFor();await settings();assert.equal(await page.locator('[name=parkingEnabled]').isDisabled(),true);assert.equal(await page.locator('[name=parkingTtlDays]').isDisabled(),true);await save();
 assert.equal(await page.evaluate(()=>Object.hasOwn(parkingFixture.writes.at(-1),'parking')),false,'Readonly account must omit the financial parking policy');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
 await page.evaluate(()=>parkingFixture.workspace.dispose());await page.close();
 }console.log('PASS parking browser: scoped saved policy, disabled new parking with prior-ticket access, server-only expiry flags, archive, recovery, price payload, confirmed readback, readonly omission and desktop/mobile. Fictional API; no financial write.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
