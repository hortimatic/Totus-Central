import {esc} from './utils.js';

const shops=[['hortimatic','Hortimatic'],['newoldsmok','NewOldSmok']];
const offline=['tpvtienda','bo_order'];
export function headerWatchHtml(state,busy){
 if(!state)return '<p class="small muted">Comprobando detección automática…</p>';
 const watch=state.watch,active=watch?.enabled===true;
 return '<section class="header-watch"><strong>Detección automática · '+(active?'Activa':'Desactivada')+'</strong><p class="small">'+(active?'Consulta ambas tiendas en el servidor, incluso con Totus cerrado.':'Recibe los pedidos web aquí, sin elegir ningún chat.')+'</p>'+
 (watch?.last_error?'<p role="alert">'+esc(watch.last_error)+'</p>':'')+
 (watch?.last_success_at?'<small>Última comprobación: '+esc(new Date(watch.last_success_at).toLocaleString('es-ES'))+'</small>':'')+
 (state.can_configure?'<details data-watch-settings><summary>Configurar detección</summary><div class="header-order-options">'+shops.map(([id,name])=>'<label><input type="checkbox" data-watch-store="'+id+'" '+(!watch||watch.stores.includes(id)?'checked':'')+'>'+name+'</label>').join('')+'</div><label>Comprobar cada <select data-watch-minutes>'+[1,2,5,10,30,60,120].map(n=>'<option value="'+n+'" '+(n===(watch?.interval_minutes||2)?'selected':'')+'>'+n+' min</option>').join('')+'</select></label><p class="small muted">Se excluyen las ventas de TPV y los pedidos manuales. No se utiliza el medio de pago para distinguirlos.</p><details><summary>Orígenes de tienda física</summary>'+shops.map(([id,name])=>'<label>'+name+'<input data-watch-offline="'+id+'" value="'+esc((watch?.offline_modules?.[id]||offline).join(', '))+'"></label>').join('')+'</details><button type="button" data-online="watch-save" '+(busy?'disabled':'')+'>Guardar detección</button></details><div class="header-order-actions"><button type="button" data-online="watch-toggle" '+(busy?'disabled':'')+'>'+(active?'Pausar detección':'Activar avisos automáticos')+'</button>'+(active?'<button type="button" data-online="watch-run" '+(busy?'disabled':'')+'>Comprobar tiendas ahora</button>':'')+'</div>':'<p class="small muted">Administración configura la detección común de las tiendas.</p>')+'</section>';
}
export function headerWatchData(panel,state,{toggle=false,run=false}={}){
 const watch=state?.watch,stores=[...panel.querySelectorAll('[data-watch-store]:checked')].map(el=>el.dataset.watchStore);
 if(!stores.length)throw Error('Selecciona al menos una tienda para los avisos.');
 const offline_modules=Object.fromEntries(stores.map(store=>{
  const values=panel.querySelector('[data-watch-offline="'+store+'"]')?.value.split(',').map(v=>v.trim()).filter(Boolean)||offline;
  if(!values.length||values.some(v=>!/^[-a-zA-Z0-9_]{1,100}$/.test(v)))throw Error('Revisa los orígenes físicos de '+store+'.');
  return [store,[...new Set(values)]];
 }));
 return {enabled:toggle?!watch?.enabled:watch?.enabled===true,stores,offline_modules,interval_minutes:Number(panel.querySelector('[data-watch-minutes]')?.value||2),run_now:run};
}
