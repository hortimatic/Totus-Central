import {PRESTASHOP_STORES,storeConnection,prestashopPage,PRESTASHOP_RESOURCES} from './prestashop-readonly.js';
import {esc} from './utils.js';

export function prestashopPanelHtml(){
 return '<section id="prestashopRoot" hidden aria-label="PrestaShop"><article class="card card-pad"><h2>PrestaShop · dos tiendas independientes</h2><p>Las claves y las pruebas de conexión se gestionan exclusivamente en APIs. Este espacio realiza consultas estándar de solo lectura; no sincroniza cierres, pagos ni existencias con Totus.</p><div class="inline-actions"><button type="button" class="btn secondary" data-prestashop-action="refresh">Actualizar diagnóstico</button><button type="button" class="btn secondary" data-prestashop-action="open-apis">Gestionar conexiones en APIs</button></div><p role="status" data-prestashop-status>Sin consulta realizada.</p><div data-prestashop-stores></div><h3>Limitaciones verificables</h3><p>Versión declarada para ambas tiendas: 1.7.8.11 (pendiente de lectura en su instalación). TPV, cierres, retiradas, recursos y tablas del módulo: pendientes de comprobación. La API estándar no ejecuta SQL arbitrario.</p><p>El historial de errores mostrado aquí corresponde a esta sesión. Un registro persistente y la sincronización con Cajas y Recepciones requieren un tramo posterior.</p><div data-prestashop-errors role="status">Sin errores registrados en esta sesión.</div></article></section>';
}

export function prestashopReadiness(connection){
 if(!connection)return {ready:false,reason:'Sin conexión vinculada en APIs.'};
 if(!connection.configured)return {ready:false,reason:'Falta la clave configurada en el gestor privado.'};
 if(connection.enabled!==true)return {ready:false,reason:'Conexión desactivada.'};
 if(connection.verified_revision!==connection.revision)return {ready:false,reason:'Prueba de conexión pendiente o caducada.'};
 if(connection.real_data_authorized!==true)return {ready:false,reason:'Falta autorizar expresamente la lectura de datos reales en APIs.'};
 return {ready:true,reason:'Conexión preparada; los recursos de negocio aún no están comprobados.'};
}

export function createPrestashopUI({rpc,invoke,actor,allowed,onManage=()=>{}}){
 let root=null,generation=0,connections=[],errors=[],inflight=false;
 const pages=new Map(),lastResults=new Map();
 const current=(node,epoch,owner)=>root===node&&generation===epoch&&node.isConnected&&allowed()&&actor()===owner;
 function render(){
  if(!root)return;
  const list=root.querySelector('[data-prestashop-stores]');
  list.innerHTML=PRESTASHOP_STORES.map(store=>{
   const c=storeConnection(connections,store.key),status=prestashopReadiness(c),resource='orders',result=lastResults.get(store.key),page=pages.get(store.key+'|'+(result?.resource||resource))||0;
   const summary=result?'<p>Lectura real: '+esc(result.resource)+' · página '+(result.page+1)+' · '+result.rows.length+' filas. No se han guardado en Cajas ni Recepciones.</p>':'<p>Última lectura de negocio: ninguna en esta sesión.</p>';
   const fields=result?PRESTASHOP_RESOURCES[result.resource]:null;
   const preview=result?'<div class="table-scroll"><table><thead><tr>'+fields.map(f=>'<th>'+esc(f)+'</th>').join('')+'</tr></thead><tbody>'+result.rows.map(row=>'<tr>'+fields.map(f=>'<td>'+esc(row[f]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'';
   return '<section class="card card-pad" data-prestashop-store="'+store.key+'"><h3>'+esc(store.name)+'</h3><p>Conexión: '+esc(c?.name||store.connectionName)+' · '+esc(status.reason)+'</p><p>Prueba: '+esc(c?.verified_at||'No registrada')+' · Sincronización automática: no habilitada.</p><div class="inline-actions"><button type="button" class="btn secondary" data-prestashop-action="read" data-store="'+store.key+'" data-resource="orders" '+(!status.ready||inflight?'disabled':'')+'>Leer pedidos</button><button type="button" class="btn secondary" data-prestashop-action="read" data-store="'+store.key+'" data-resource="stock_availables" '+(!status.ready||inflight?'disabled':'')+'>Leer existencias</button></div>'+summary+preview+(result?'<div class="inline-actions"><button type="button" class="btn secondary" data-prestashop-action="page" data-store="'+store.key+'" data-direction="-1" '+(inflight||page===0?'disabled':'')+'>Anterior</button><button type="button" class="btn secondary" data-prestashop-action="page" data-store="'+store.key+'" data-direction="1" '+(inflight||!result.possibly_more?'disabled':'')+'>Siguiente</button></div>':'')+'</section>';
  }).join('');
  root.querySelector('[data-prestashop-errors]').innerHTML=errors.length?'<ul>'+errors.slice(0,10).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'Sin errores registrados en esta sesión.';
 }
 function dispose(){generation++;root=null;inflight=false;connections=[];pages.clear();lastResults.clear();errors=[];}
 async function mount(element){
  dispose();if(!element||!allowed())return;
  root=element;const epoch=generation,owner=actor(),active=()=>current(element,epoch,owner),status=element.querySelector('[data-prestashop-status]');
  const recordError=(message)=>{if(!active())return;errors.unshift(new Date().toLocaleString('es-ES',{timeZone:'Europe/Madrid'})+' · '+String(message));status.textContent=String(message);};
  async function refresh(){
   const result=await rpc('totus_api_manager',{});
   if(!active())return;
   connections=(result?.connections||[]).filter(c=>c.protocol==='prestashop');
   status.textContent=connections.length+' conexiones PrestaShop guardadas. Una prueba de API no valida cierres del TPV.';
   render();
  }
  element.onclick=async event=>{
   const button=event.target.closest('[data-prestashop-action]');if(!button||inflight||!active())return;
   const action=button.dataset.prestashopAction;
   if(action==='open-apis'){onManage();return;}
   inflight=true;render();
   try{
    if(action==='refresh'){await refresh();return;}
    const store=button.dataset.store,previous=lastResults.get(store);
    const resource=action==='page'?previous?.resource:button.dataset.resource;
    const c=storeConnection(connections,store);
    if(!prestashopReadiness(c).ready)throw Error('No hay conexión autorizada para '+store+'.');
    const prior=pages.get(store+'|'+resource)||0;
    const page=action==='page'?prior+Number(button.dataset.direction):0;
    const selected=prestashopPage(resource,page,25);
    const result=await invoke({action:'prestashop_read',store,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),resource,page:selected.page,page_size:selected.pageSize});
    if(!active())return;
    if(!result?.ok||result.store!==store||result.resource!==resource||result.page!==page||!Array.isArray(result.rows))throw Error('Respuesta de lectura no verificable.');
    pages.set(store+'|'+resource,page);lastResults.set(store,result);
    status.textContent='Lectura completada. Los registros siguen siendo datos de origen de PrestaShop, sin escritura contable.';
   }catch(e){recordError(e?.message||String(e));}finally{if(active()){inflight=false;render();}}
  };
  try{await refresh();}catch(e){recordError(e?.message||String(e));render();}
 }
 return {mount,dispose};
}
