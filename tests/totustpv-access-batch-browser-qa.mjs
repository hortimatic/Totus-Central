import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true,port:0}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,1024,390,360]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/totustpv-workspace.html`);
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const row={operatorId:id(4),drawerId:id(3),shopId:1,storeId:id(5),operatorName:'Persona ficticia',drawerName:'Caja principal',storeName:'Tienda ficticia',operatorActive:true,drawerActive:true,active:true,revision:1,permissions:{sell:true,open:true,reconcile:true}};
  const rows=[row,{...row,operatorId:id(7),operatorName:'Segunda persona'},{...row,drawerId:id(8),drawerName:'Segunda caja'}];
  window.batchFixture={requests:[],receipt:null,lose:true,rows};
  const configuration=()=>structuredClone({actorId:id(1),connectionId:id(2),revision:6,origin:'https://preproduccion.hortimatic.com',stores:[{id:id(5),name:'Tienda ficticia'}],drawers:[{id:id(3),store_id:id(5),name:'Caja principal'}],operators:[{id:id(4),full_name:'Persona ficticia'}],accesses:rows});
  batchFixture.workspace=createTpvWorkspace({actor:()=>({id:id(1),active:true}),can:()=>true,canAssign:()=>true,readConfiguration:async()=>configuration(),configureWorkstation:async request=>{
   batchFixture.requests.push(structuredClone(request));if(request.action==='access-batch-get')return batchFixture.receipt;
   batchFixture.receipt={id:request.operationId,connectionId:id(2),confirmed:true,group:request.group,items:request.targets.map(t=>{const r=rows.find(r=>r.operatorId===t.operatorId&&r.drawerId===t.drawerId);Object.assign(r,{permissions:request.permissions,active:request.active,revision:r.revision+1});return structuredClone(r);})};
   if(batchFixture.lose){batchFixture.lose=false;throw Error('Respuesta perdida del bloque.');}return batchFixture.receipt;
  }});batchFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.getByText('Administrar tiendas y cajas',{exact:true}).click();await page.getByRole('button',{name:'Asignar tienda y caja',exact:true}).click();
 await page.getByRole('button',{name:'Gestionar por tienda o empleado',exact:true}).click();
 const form=page.locator('[data-tpv-access-batch-form]');assert.equal(await form.locator('[name=target]').count(),3);
 await form.locator('[name=batch-kind]').selectOption('operator');assert.equal(await form.locator('[name=target]').count(),2);
 assert.equal(await page.evaluate(()=>batchFixture.workspace.hasDraft()),false,'Grouping and selecting do not edit permissions');
 await form.locator('[name=target]').first().check();assert.equal(await page.evaluate(()=>batchFixture.workspace.hasDraft()),false);
 await form.locator('[name=role]').selectOption('sell');await form.locator('[name=cash]').check();
 await page.getByRole('button',{name:'Revisar bloque',exact:true}).click();assert.equal(await page.evaluate(()=>batchFixture.requests.length),0);
 assert.equal(await page.locator('.tpv-access-batch .tpv-access-list article').count(),1);
 await page.getByRole('button',{name:'Confirmar y guardar el bloque',exact:true}).click();await page.getByRole('alert').filter({hasText:'Respuesta perdida del bloque'}).waitFor();
 assert.equal(await page.evaluate(()=>batchFixture.workspace.hasDraft()),true);
 await page.evaluate(()=>batchFixture.workspace.mount(document.querySelector('#tpv')));
 await page.getByText('Administrar tiendas y cajas',{exact:true}).click();await page.getByRole('button',{name:'Asignar tienda y caja',exact:true}).click();await page.getByRole('button',{name:'Gestionar por tienda o empleado',exact:true}).click();
 await page.getByRole('button',{name:'Recuperar resultado del bloque',exact:true}).click();await page.getByText('Bloque de accesos guardado y comprobado.',{exact:true}).waitFor();
 const calls=await page.evaluate(()=>batchFixture.requests);assert.equal(calls.length,2);assert.equal(calls[1].action,'access-batch-get');assert.equal(calls[1].operationId,calls[0].operationId);assert.equal(calls[0].targets.length,1);assert.equal(calls[0].group.kind,'operator');
 assert.equal(await page.evaluate(()=>batchFixture.workspace.hasDraft()),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
 await page.screenshot({path:`artifacts/tpv-accesos-bloque-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Volver a los accesos',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Cambiar acceso',exact:true}).count(),3);await page.close();
 }console.log('PASS grouped access workspace: four widths, explicit subset, operator grouping, read-only filters, review before write, lost response recovered without duplicate and preserved individual editor. Fictional endpoint.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
