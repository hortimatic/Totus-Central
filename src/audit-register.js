import {matchesText} from './report-period.js';

const ACTION_LABELS={perfil_personal_guardado:'Actualizar mi perfil y mis notas',perfil_usuario_guardado:'Actualizar perfil de usuario',consultar_estado:'Actualizar estado del servicio',abrir_modulo:'Acceder al módulo',abrir_seccion:'Abrir pestaña',consultar_documento:'Consultar documento',descarga_preparada:'Preparar descarga',aplicar_filtros:'Aplicar filtros',error_operacion:'Operación con error',acceso_denegado:'Acceso denegado',crear:'Crear registro',actualizar:'Actualizar registro',eliminar:'Eliminar registro',
 send:'Enviar mensaje',message_sent:'Enviar mensaje',read:'Leer conversación',create_channel:'Crear canal',create_direct:'Crear conversación directa',create_assistant:'Crear canal de ChatGPT',channel_update:'Actualizar canal',member_save:'Actualizar participante',agent_request:'Solicitar ayuda a ChatGPT',assistant_reply:'Respuesta de ChatGPT',file_reserved:'Preparar adjunto',file_verified:'Verificar adjunto',file_detached:'Desvincular adjunto',files_cancel:'Cancelar adjuntos',
 created:'Crear tarea',updated:'Actualizar tarea',occurrence:'Actualizar tarea del día',completed:'Completar tarea',done:'Completar tarea',archived:'Archivar tarea',
 copia_iniciada:'Copia iniciada',copia_success:'Copia completada',copia_failed:'Copia fallida',copia_error:'Error en la copia',copia_cancelled:'Copia cancelada',copia_expired:'Copia retirada por rotación',
 recepcion_created:'Crear recepción',recepcion_edited:'Editar recepción',recepcion_source_added:'Añadir documento a recepción',recepcion_source_removed:'Quitar documento de recepción',recepcion_result_saved:'Guardar cotejo de recepción'};
ACTION_LABELS.limpiar_historial='Limpiar historial del Log';
export const auditActionLabel=action=>ACTION_LABELS[action]||String(action||'—');
export function mergeAuditRows(previous=[],incoming=[]){
 const rows=new Map(previous.map(r=>[String(r.id),r]));
 for(const row of incoming)rows.set(String(row.id),row);
 return [...rows.values()];
}

// Keep original events intact. Other module histories remain subject to their RLS.
export function combineAuditEvents({events=[],users=[],chat=[],tasks=[],stock=[],backups=[],people=[]}={}){
 const actor=id=>people.find(p=>p.id===id)?.email||('Usuario '+id);
 const rows=[...events,
  ...users.map(r=>({id:'team:'+r.id,created_at:r.created_at,user_email:r.actor_email,area:'usuarios',action:r.action,detail:{usuario:r.target_email,resultado:r.status,detalle:r.detail}})),
  ...chat.map(r=>({id:'chat:'+r.id,created_at:r.created_at,user_email:r.actor_email,area:'chat',action:r.action,entity_id:r.entity_id,detail:{...r.detail,canal:r.channel_id,origen:'Historial del chat'}})),
  ...tasks.map(r=>({id:'task:'+r.id,created_at:r.created_at,user_email:actor(r.actor_id),area:'tareas',action:r.action,entity_id:r.task_id,detail:{...r.detail,tarea:r.task_id,fecha_tarea:r.scheduled_on,origen:'Historial de tareas'}})),
  ...stock.map(r=>({id:'stock:'+r.id,created_at:r.created_at,user_email:r.actor_email,area:'recepciones',action:'recepcion_'+r.action,entity_id:r.receipt_id,detail:{recepcion:r.receipt_id,revision:r.revision,accion_original:r.action,origen:'Historial de recepciones'}})),
  ...backups.flatMap(r=>[
   {id:'backup:'+r.id+':start',created_at:r.started_at,user_email:'Sistema de copias · autor no registrado',area:'copias',action:'copia_iniciada',entity_id:r.id,detail:{modo:r.mode,copia:r.id,estado_actual:r.status,fin_registrado:r.finished_at||null}},
   ...(r.finished_at?[{id:'backup:'+r.id+':finish',created_at:r.finished_at,user_email:'Sistema de copias · autor no registrado',area:'copias',action:'copia_'+r.status,entity_id:r.id,detail:{modo:r.mode,copia:r.id,archivos:r.files_count,filas:r.rows_count,error:r.error_message||null}}]:[])
  ])];
 return rows.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(a.id).localeCompare(String(b.id)));
}

export function filterAuditEvents(rows,filters={}){
 const {from,to,area,action,actor,query}=filters;
 return rows.filter(r=>{
  const day=r.created_at?new Date(r.created_at).toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'}):'';
  return (!from||day>=from)&&(!to||day<=to)&&(!area||r.area===area)&&(!action||r.action===action)
   &&(!actor||matchesText(actor,r.user_email))
   &&(!query||matchesText(query,r.area,r.action,auditActionLabel(r.action),r.user_email,JSON.stringify(r.detail||{})));
 });
}
