import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{
  fixture.workspace.dispose();const {createTpvWorkspace}=await import('/src/totustpv/workspace.js');
  const row={operatorId:'employee',drawerId:'drawer',shopId:1,storeId:'store',operatorName:'Persona ficticia',drawerName:'Caja ficticia',storeName:'Tienda ficticia',operatorActive:true,drawerActive:true,active:true,revision:1,permissions:{sell:true,open:true,reconcile:true}};
  window.accessFixture={row,requests:[],lose:true};
  const configuration=()=>structuredClone({actorId:'manager',connectionId:'connection',revision:6,origin:'https://preproduccion.hortimatic.com',stores:[{id:'store',name:'Tienda ficticia'}],drawers:[{id:'drawer',store_id:'store',name:'Caja ficticia'}],operators:[{id:'employee',full_name:'Persona ficticia'}],accesses:[accessFixture.row]});
  const adapter={mode:'qa',context:async()=>({stores:[{id:'store',name:'Tienda ficticia'}],drawers:[{id:'drawer',storeId:'store',name:'Caja ficticia',connectionId:'connection',shopId:1,canSell:true,canOpen:true,canReconcile:true}],sessions:[{id:'session',storeId:'store',drawerId:'drawer',status:'open'}]}),selectSession:async()=>{},categories:async()=>[],searchProducts:async()=>[]};
  accessFixture.workspace=createTpvWorkspace({actor:()=>({id:'manager',active:true}),can:()=>true,canAssign:()=>true,drawerManagement:()=>'/tests/app-mock.html?module=administracion&section=negocio',createLiveAdapter:()=>adapter,readConfiguration:async()=>{if(accessFixture.failRead)throw Error('Consulta temporalmente no disponible.');return configuration();},
   configureWorkstation:async request=>{accessFixture.requests.push(structuredClone(request));
    if(accessFixture.lose){accessFixture.lose=false;throw Error('Respuesta perdida; reintenta la misma solicitud.');}
    accessFixture.row={...accessFixture.row,revision:2,permissions:request.permissions,active:request.active};
    if(accessFixture.failAfterSave)accessFixture.failRead=true;
    return {...accessFixture.row,connectionId:'connection'};
   }});
  accessFixture.workspace.mount(document.querySelector('#tpv'));
 });
 await page.getByText('Administrar tiendas y cajas',{exact:true}).click();
 await page.getByRole('button',{name:'Asignar tienda y caja',exact:true}).click();
 const management=page.getByRole('link',{name:'Crear y gestionar cajas ↗',exact:true});
 assert.equal(await management.getAttribute('target'),'_blank');assert.equal(await management.getAttribute('rel'),'noopener');
 const assignment=page.locator('[data-tpv-form=configure]');await assignment.locator('[name=shop]').fill('2');
 await assignment.locator('[name=bizum]').check();
 await page.getByRole('button',{name:'Actualizar tiendas y cajas',exact:true}).click();
 await page.getByText('Tiendas y cajas actualizadas. Revisa la selección antes de asignar el puesto.',{exact:true}).waitFor();
 assert.equal(await assignment.locator('[name=shop]').inputValue(),'2');assert.equal(await assignment.locator('[name=bizum]').isChecked(),true);
 assert.equal(await page.evaluate(()=>accessFixture.requests.length),0,'Refreshing the list does not assign or mutate any workstation');
 await page.evaluate(()=>accessFixture.failRead=true);
 await page.getByRole('button',{name:'Actualizar tiendas y cajas',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Consulta temporalmente'}).waitFor();
 assert.equal(await assignment.locator('[name=shop]').inputValue(),'2');
 await page.evaluate(()=>accessFixture.failRead=false);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByText('Administrar tiendas y cajas',{exact:true}).click();
 await page.getByRole('button',{name:'Asignar tienda y caja',exact:true}).click();
 await page.getByRole('button',{name:'Cambiar acceso',exact:true}).click();
 const form=page.locator('[data-tpv-access-form]');await form.locator('[name=role]').selectOption('view');
 await form.locator('[name=cash]').uncheck();await form.locator('[name=active]').uncheck();
 assert.equal(await page.evaluate(()=>accessFixture.workspace.hasDraft()),true);
 await page.getByRole('button',{name:'Guardar acceso',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Respuesta perdida'}).waitFor();
 await page.getByRole('button',{name:'Guardar acceso',exact:true}).click();
 await page.getByText('Acceso guardado. El historial y las cajas abiertas se conservan.',{exact:true}).waitFor();
 const requests=await page.evaluate(()=>accessFixture.requests);assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);
 assert.deepEqual(requests[0].permissions,{sell:false,open:false,reconcile:true});assert.equal(requests[0].active,false);
 assert.equal(await page.evaluate(()=>accessFixture.workspace.hasDraft()),false);
 await page.getByRole('button',{name:'Cambiar acceso',exact:true}).click();
 assert.equal(await form.locator('[name=role]').inputValue(),'view');assert.equal(await form.locator('[name=cash]').isChecked(),false);
 await page.screenshot({path:`artifacts/tpv-accesos-editor-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.locator('.tpv-access-list').waitFor();
 await page.evaluate(()=>{accessFixture.row.operatorId='manager';accessFixture.failAfterSave=true;});
 await page.getByRole('button',{name:'Entrar al mostrador',exact:true}).click();await page.locator('[data-tpv-store]').waitFor();
 await page.getByText('Más acciones',{exact:true}).click();await page.getByRole('button',{name:'Configuración',exact:true}).click();
 await page.getByRole('button',{name:'Configurar puesto y operadores',exact:true}).click();await page.getByRole('button',{name:'Cambiar acceso',exact:true}).click();
 await page.getByRole('button',{name:'Guardar acceso',exact:true}).click();await page.getByRole('alert').filter({hasText:'Consulta temporalmente'}).waitFor();
 assert.equal(await page.locator('[data-tpv-store]').count(),0,'Changing your own access drops the old cash context even if refreshing the access list fails');
 assert.equal(await page.getByRole('heading',{name:'Tu tienda, lista para trabajar',exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS workstation access manager screen desktop/mobile: independent sale/cash flags, reversible deactivation, same-request lost-response retry, refreshed state and no false dirty warning. Fictional adapter; server and SQL authorization verified separately.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
