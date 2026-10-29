import {modal,btn,confirmAction,toast} from './components.js';

export function cleanupRange(from,to,today){
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 if(!valid(to)||(from&&!valid(from))||(from&&from>to)||to>today)throw new Error('Indica fechas válidas, ordenadas y no futuras.');
 return {p_from:from||null,p_to:to};
}

export function createLogCleanup({rpc,owner,allowed,today,afterClean}){
 let preview=null,panel=null,pending=null;
 const field=id=>panel?.querySelector('#'+id);
 const range=()=>cleanupRange(field('logCleanupFrom')?.value||'',field('logCleanupTo')?.value||'',today());
 const current=(who,box)=>owner()===who&&allowed()&&panel===box&&box?.isConnected;
 function invalidate(){preview=null;if(field('logCleanupResult'))field('logCleanupResult').textContent='Consulta los registros del rango antes de eliminarlos.';const b=panel?.querySelector('[data-action="admin-log-cleanup-delete"]');if(b)b.disabled=true;}
 function open(){
  if(!allowed())throw new Error('Solo administración puede limpiar el Log.');
  preview=null;
  modal('Limpiar historial del Log',`<p>Elimina eventos de actividad, usuarios, chat y tareas. Los gastos, cajas, mensajes, documentos, copias y versiones de recepciones se conservan.</p>
   <div class="form-grid"><label>Desde (opcional)<input id="logCleanupFrom" type="date" max="${today()}"></label><label>Hasta (incluido)<input id="logCleanupTo" type="date" max="${today()}" required></label></div>
   <p class="small muted">Deja Desde vacío para eliminar todo el historial anterior hasta la fecha indicada. Este rango es independiente de los filtros de consulta del Log.</p>
   <div id="logCleanupResult" role="status" aria-live="polite">Consulta los registros del rango antes de eliminarlos.</div>
   <p class="small muted">Se conserva constancia de cada limpieza. El espacio queda disponible para reutilizarlo; el tamaño total de la base puede no bajar inmediatamente.</p>
   <div class="form-actions">${btn('Calcular registros','admin-log-cleanup-preview','secondary')}${btn('Eliminar registros','admin-log-cleanup-delete','danger','disabled')}</div>`);
  panel=document.querySelector('#modalHost .modal');
  for(const input of panel.querySelectorAll('input')){input.addEventListener('input',invalidate);input.addEventListener('change',invalidate);}
 }
 async function inspect(){
  if(pending?.box===panel)return;const args=range(),who=owner(),box=panel,ticket={box};
  if(!allowed())throw new Error('Solo administración puede limpiar el Log.');
  pending=ticket;preview=null;box.querySelector('[data-action="admin-log-cleanup-delete"]').disabled=true;field('logCleanupResult').textContent='Calculando registros…';
  try{
   const result=await rpc('totus_log_cleanup',{...args,p_execute:false});
   if(pending!==ticket||!current(who,box)||JSON.stringify(range())!==JSON.stringify(args))return;
   if(!Number.isSafeInteger(result?.count)||result.count<0||typeof result.fingerprint!=='string')throw new Error('No se ha podido verificar el recuento.');
   preview={...args,...result,who};
   const labels={ops_audit_log:'Actividad general',team_user_audit_log:'Cambios de usuarios',ops_chat_events:'Actividad del chat',ops_task_events:'Actividad de tareas'};
   field('logCleanupResult').innerHTML=`<p><b>${result.count} registros para eliminar</b></p>${Object.entries(labels).map(([key,label])=>`<div class="summary-row"><span>${label}</span><strong>${Number(result.counts?.[key]||0)}</strong></div>`).join('')}`;
   box.querySelector('[data-action="admin-log-cleanup-delete"]').disabled=result.count===0;
  }catch(error){if(current(who,box)){invalidate();field('logCleanupResult').textContent=error.message;}throw error;}
  finally{if(pending===ticket)pending=null;}
 }
 async function remove(){
  if(pending?.box===panel||!preview)return;const saved=preview,box=panel,ticket={box};
  if(!current(saved.who,box)||JSON.stringify(range())!==JSON.stringify({p_from:saved.p_from,p_to:saved.p_to})){invalidate();return;}
  pending=ticket;
  try{
   if(!await confirmAction(`Se eliminarán definitivamente ${saved.count} eventos del Log, desde ${saved.p_from||'el inicio'} hasta ${saved.p_to} (incluido). Esta acción no se puede deshacer desde el Log.`,{title:'Confirmar limpieza del historial',acceptLabel:'Eliminar '+saved.count+' eventos'}))return;
   if(owner()!==saved.who||!allowed())return;
   const result=await rpc('totus_log_cleanup',{p_from:saved.p_from,p_to:saved.p_to,p_execute:true,p_fingerprint:saved.fingerprint});
   preview=null;
   if(owner()!==saved.who||!allowed())return;
   if(result?.deleted!==saved.count)throw new Error('No se ha confirmado la limpieza. Actualiza el historial antes de reintentar.');
   const updated=await afterClean();toast(updated===false?'Limpieza completada. Pulsa Actualizar para volver a leer el historial.':'Historial limpiado.',updated===false?'warn':'ok');
  }catch(error){if(current(saved.who,box))invalidate();throw error;}
  finally{if(pending===ticket)pending=null;}
 }
 return {open,inspect,remove};
}
