import {PRESTASHOP_VERSION,PRESTASHOP_STORES,PRESTASHOP_RESOURCES,linkedPrestashop} from './prestashop-core.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=value=>value?new Date(value).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}):'—';
export const prestashopHtml=()=>'<section id="prestashopRoot" hidden aria-label="Conexión PrestaShop"><div class="card card-pad"><h2>PrestaShop · Hortimatic y NewOldSmok</h2><p>Versión comunicada por el titular: '+PRESTASHOP_VERSION+' (pendiente de verificar con cada tienda).</p><p>Consulta de solo lectura a las tiendas. Las claves permanecen en Configuración → APIs. No modifica cajas, contabilidad, existencias ni precios.</p></div><div data-prestashop-content role="status">Consultando las conexiones…</div></section>';
export function createPrestashopUI({rpc,invoke,actor,allowed,onOpenApis=()=>{}}){
 let root=null,owner=null,epoch=0,busy=new Set(),profiles=[],events=[],pages={};
 const active=stamp=>root?.isConnected&&actor()===owner&&stamp===epoch;
 const addEvent=(store,type,status)=>{events.unshift({store,type,status,at:new Date().toISOString()});events=events.slice(0,15);};
 const connectionState=c=>!c?'Sin conexión vinculada':!c.configured?'Falta la clave privada':!c.enabled?'Desactivada':c.verified_revision!==c.revision?'Prueba pendiente':'Conexión probada';
 function paint(){
  if(!root)return;
  const host=root.querySelector('[data-prestashop-content]');
  if(!allowed()){host.innerHTML='<p role="alert">No tienes permiso para consultar esta configuración.</p>';return;}
  host.innerHTML=PRESTASHOP_STORES.map(store=>{
   const {connection:c,ambiguous}=linkedPrestashop(profiles,store.id);
   const state=ambiguous?'Existen conexiones duplicadas con el mismo nombre':connectionState(c);
   const working=busy.has(store.id),last=events.find(e=>e.store===store.id),page=pages[store.id];
   const resourceButtons=Object.entries(PRESTASHOP_RESOURCES).map(([key,item])=>'<button type="button" class="btn secondary" data-ps-read="'+key+'" data-ps-store="'+store.id+'" '+(!c||working||!c.enabled||c.verified_revision!==c.revision||!c.real_data_authorized?'disabled':'')+'>'+esc(item.label)+'</button>').join('');
   const keys=page?.rows?.length?Object.keys(page.rows[0]):[];
   const table=page?'<div class="table-wrap"><table class="data-table"><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+page.rows.map(r=>'<tr>'+keys.map(k=>'<td>'+esc(r[k]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="small">Consulta manual · '+page.rows.length+' filas · inicio '+page.offset+' · '+esc(formatDate(page.read_at))+'</p>'+(page.possibly_more?'<button type="button" class="btn secondary" data-ps-next="'+page.resource+'" data-ps-store="'+store.id+'" '+(working?'disabled':'')+'>Página siguiente</button>':''):'<p class="small muted">Todavía no se han leído datos de este establecimiento en esta sesión.</p>';
   return '<section class="card card-pad" data-prestashop-store="'+store.id+'"><div class="section-head"><div><h3>'+esc(store.label)+' · '+esc(store.location)+'</h3><p>Cajas: '+esc(store.drawers)+'</p></div><span class="pill">'+esc(state)+'</span></div><dl><dt>Perfil vinculado</dt><dd>'+esc(c?.name||store.connectionName)+' · '+esc(c?'ID '+c.id:'crear en APIs')+'</dd><dt>Última prueba de conexión</dt><dd>'+esc(formatDate(c?.verified_at))+'</dd><dt>Sincronización automática</dt><dd>No configurada. Solo lectura manual en esta fase.</dd><dt>Cierres y retiradas TPV</dt><dd>Pendiente: versión y estructura real del módulo TPV no verificadas</dd></dl><div class="inline-actions"><button type="button" class="btn secondary" data-ps-apis="'+store.id+'">Abrir APIs</button><button type="button" class="btn secondary" data-ps-test="'+store.id+'" '+(!c||working?'disabled':'')+'>Probar conexión</button>'+resourceButtons+'</div><p class="small muted">Recursos estándar de PrestaShop 1.7.8.11: pendientes de comprobar en esta conexión. El stock disponible no prueba una entrada de mercancía; los movimientos no equivalen por sí solos a una recepción. No se escriben cierres en Totus.</p>'+(last?'<p class="note" role="status">'+esc(formatDate(last.at))+' · '+esc(last.type)+': '+esc(last.status)+'</p>':'')+table+'</section>';
  }).join('')+'<section class="card card-pad"><h3>Diagnóstico e historial de esta sesión</h3><p class="small muted">Los intentos se contabilizan en el gestor de APIs. Los mensajes detallados de error de este panel no se conservan entre sesiones; el historial persistente es una ampliación pendiente.</p>'+(events.length?'<div class="stack">'+events.map(e=>'<p class="small">'+esc(formatDate(e.at))+' · '+esc(e.store)+' · '+esc(e.type)+' · '+esc(e.status)+'</p>').join('')+'</div>':'<p>Sin operaciones realizadas desde este panel.</p>')+'</section>';
 }
 async function run(storeId,type,resource=null,next=false){
  if(!allowed()||busy.has(storeId))return;
  const {connection:c}=linkedPrestashop(profiles,storeId);if(!c)return;
  const stamp=epoch;busy.add(storeId);paint();
  try{
   const data=await invoke({action:type==='test'?'test':'prestashop_read',id:c.id,revision:c.revision,call_id:crypto.randomUUID(),...(type==='read'?{store:storeId,resource,offset:next?(pages[storeId]?.offset??0)+(pages[storeId]?.rows?.length??0):0,limit:50}:{})});
   if(!active(stamp))return;
   if(type==='read'){if(data.store!==storeId||data.resource!==resource||!Array.isArray(data.rows))throw Error('La respuesta no corresponde a la tienda y recurso solicitados.');pages[storeId]=data;}
   addEvent(storeId,type==='test'?'Prueba de API':PRESTASHOP_RESOURCES[resource].label,'Correcto'+(type==='read'?' · '+data.rows.length+' filas':''));
  }catch(error){if(active(stamp))addEvent(storeId,type==='test'?'Prueba de API':'Lectura',String(error?.message||'Error de conexión').slice(0,200));}
  finally{if(active(stamp)){busy.delete(storeId);paint();}}
 }
 async function load(){
  const stamp=epoch;try{const data=await rpc('totus_api_manager',{});if(!active(stamp))return;profiles=data.connections||[];paint();}
  catch(error){if(active(stamp))root.querySelector('[data-prestashop-content]').innerHTML='<p role="alert">No se pudieron leer las conexiones: '+esc(error.message)+'</p>';}
 }
 return {
  mount(element){root=element;owner=actor();epoch++;busy.clear();pages={};events=[];root.onclick=event=>{
   const button=event.target.closest('button');if(!button||!root.contains(button))return;
   if(button.dataset.psApis){onOpenApis();return;}
   if(button.dataset.psTest){void run(button.dataset.psTest,'test');return;}
   if(button.dataset.psRead){void run(button.dataset.psStore,'read',button.dataset.psRead);return;}
   if(button.dataset.psNext){void run(button.dataset.psStore,'read',button.dataset.psNext,true);}
  };void load();
  },
  dispose(){epoch++;root=null;owner=null;busy.clear();}
 };
}
