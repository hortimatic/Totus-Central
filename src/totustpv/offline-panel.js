import {createOfflineJournal} from './offline-journal.js';
import {createOfflineSync} from './offline-sync.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
import {offlineDevice} from './offline-device.js';
export {offlineDevice} from './offline-device.js';
export function createOfflinePanel({getScope,getAdapter,isCurrent,storage}){
 let rows=[],journal=null,sync=null,scope=null,version=0;
 const current=()=>scope&&isCurrent()&&JSON.stringify(getScope())===JSON.stringify(scope);
 async function refresh(){
  const run=version;
  if(!current())throw Error('La caja ha cambiado. Vuelve a abrir las ventas pendientes.');
  const all=[];let after='';
  for(;;){const page=await journal.list({after,limit:100});if(run!==version||!current())throw Error('La sesión ha cambiado.');all.push(...page);if(page.length<100)break;after=page.at(-1).id;}
  rows=all;
 }
 return {async open(){
   const run=++version;scope=structuredClone(getScope());if(!scope?.cashSessionId)throw Error('Abre la caja para consultar sus ventas pendientes.');
   const deviceId=offlineDevice(storage);journal=createOfflineJournal({scope:{...scope,deviceId}});
   const delivery=await getAdapter().offlineDelivery({deviceId});
   if(run!==version||!current())throw Error('La sesión ha cambiado.');
   const boundScope=scope,boundJournal=journal;
   // Other cash sessions are visible but must never be sent through this one.
   const scopedJournal={...journal,get:async id=>{const row=await boundJournal.get(id);if(row&&row.ticket.cashSessionId!==boundScope.cashSessionId)throw Error('Esta venta pertenece a otra sesión de caja.');return row;},list:async options=>(await journal.list(options))};
   sync=createOfflineSync({journal:scopedJournal,adapter:delivery,isCurrent:()=>run===version&&current(),shouldSynchronize:row=>row.ticket.cashSessionId===boundScope.cashSessionId});await refresh();
  },async synchronize(){
   if(!current())throw Error('La caja ha cambiado.');
   if(globalThis.navigator?.onLine===false)throw Error('Las ventas siguen guardadas. Conecta para sincronizarlas.');
   await sync.synchronizePending();await refresh();
  },
  async recheck(id){
   if(!current())throw Error('La caja ha cambiado.');
   if(globalThis.navigator?.onLine===false)throw Error('Conecta para volver a comprobar esta venta.');
   const row=rows.find(row=>row.id===id),run=version;
   if(!row||row.status!=='conflict'||row.ticket.cashSessionId!==scope.cashSessionId)throw Error('Selecciona una incidencia de esta sesión de caja.');
   const changed=await journal.recheck(id,row.revision);
   if(run!==version||!current())throw Error('La caja ha cambiado.');
   if(changed.updated)await sync.synchronize(id);
   await refresh();
  },
  reset(){version++;scope=null;rows=[];journal=null;sync=null;},
  html(){return `<section class="card card-pad"><h3>Ventas guardadas en este dispositivo</h3><p>Los tickets pendientes se conservan aquí hasta comprobar su registro en la tienda.</p><button type="button" class="btn primary" data-tpv-action="offline-sync">Sincronizar ahora</button><div class="tpv-history">${rows.map(row=>`<article><div><b>Ticket ${esc(row.id.slice(0,8))}</b><small>${esc({queued:'Pendiente de sincronizar',dispatching:'Comprobando registro',uncertain:'Pendiente de comprobar',synced:'Sincronizado',conflict:'Necesita revisión del cálculo o de los datos'}[row.status])}${row.ticket.cashSessionId!==scope?.cashSessionId?' · Otra sesión de caja':''}</small></div><strong>${money(row.ticket.totalCents)}</strong>${row.status==='conflict'&&row.ticket.cashSessionId===scope?.cashSessionId?`<button type="button" class="btn secondary" data-tpv-action="offline-recheck" data-tpv-offline-id="${esc(row.id)}">Comprobar de nuevo</button>`:''}</article>`).join('')||'<p>No hay ventas guardadas en este dispositivo para esta caja.</p>'}</div></section>`;}
 };
}
