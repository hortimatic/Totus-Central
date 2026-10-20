
import {state,isAdmin} from './state.js';
import {esc} from './utils.js';
import {btn,kpi} from './components.js';

let connectionStatus=null,connectionOwner='';
export function setOneDriveStatus(value){connectionStatus=value;connectionOwner=state.user?.email||'';}
export async function oneDriveRequest(action,values={}){
 if(!isAdmin())throw new Error('Solo administración puede configurar OneDrive.');
 const {sb}=await import('./api.js');
 const {data,error}=await sb.functions.invoke('totus-onedrive',{body:{action,...values}});
 if(error){
  let message='No se pudo contactar con la conexión de OneDrive.';
  try{message=(await error.context.json()).error||message;}catch{}
  throw new Error(message);
 }
 if(data?.error)throw new Error(data.error);
 if(!data||typeof data!=='object')throw new Error('Respuesta de OneDrive no válida.');
 return data;
}
const safeLink=value=>{
 try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='onedrive.live.com'||u.hostname.endsWith('.sharepoint.com'))?u.href:'';}catch{return '';}
};
export function oneDrivePanel(){
 if(!isAdmin())return '<section class="card card-pad"><h2>OneDrive</h2><p>Solo administración puede preparar esta conexión.</p></section>';
 const s=connectionOwner===(state.user?.email||'')?connectionStatus:null;
 const folder=safeLink(s?.folder_url);
 return `<div class="stack"><section class="card card-pad">
 <div class="section-head"><div><h2>OneDrive · documentos y copias</h2><p>Conexión del almacenamiento externo con TotusCentral.</p></div>${btn('Actualizar conexión','onedrive-refresh','secondary')}</div>
 ${!s?'<p class="note">Pulsa Actualizar conexión para consultar el estado.</p>':`<div class="kpis">${kpi('Conexión',s.connected?'Conectada':s.configured?'Pendiente de autorización':'Pendiente de preparar')}${kpi('Prueba de guardado y lectura',s.tested_at?'Comprobada':'Pendiente')}</div>
 ${s.connected?`<p>Microsoft ha autorizado la carpeta exclusiva de la aplicación.</p>${s.tested_at?'<p>Última comprobación: '+esc(new Date(s.tested_at).toLocaleString('es-ES'))+'.</p>':''}<div class="inline-actions">${btn('Guardar y comprobar archivo de prueba','onedrive-test','primary')}${btn('Volver a autorizar OneDrive','onedrive-begin','secondary')}${folder?'<a class="btn secondary" href="'+esc(folder)+'" target="_blank" rel="noopener noreferrer">Abrir carpeta de OneDrive</a>':''}</div>`:`<ol><li>En Microsoft, prepara la aplicación <b>TotusCentral Staging</b> con la dirección de retorno indicada abajo.</li><li>Crea tú la credencial de la aplicación y pega su <b>valor</b> aquí. Se guarda cifrada en Supabase; no se muestra de nuevo.</li><li>Autoriza el acceso a la carpeta de la aplicación y prueba la conexión.</li></ol>
 <div class="field"><label>Identificador de la aplicación</label><code style="overflow-wrap:anywhere">${esc(s.client_id||'')}</code></div>
 <div class="field"><label>Dirección de retorno en Microsoft · plataforma Web</label><code style="overflow-wrap:anywhere">${esc(s.redirect_uri||'')}</code></div>
 ${s.configured?'<p class="note">Credencial guardada. Falta tu autorización en Microsoft.</p>':`<div class="field"><label for="odClientSecret">Valor de la credencial de Microsoft</label><input id="odClientSecret" type="password" autocomplete="new-password" data-draft-ignore></div>${btn('Guardar credencial','onedrive-credential-save','primary')}`}
 <div class="inline-actions">${btn('Preparar autorización de Microsoft','onedrive-begin','secondary',s.configured?'':'disabled')}</div>`}
 `}
 ${s?.connected&&s?.mirror?`<div class="note"><b>Documentos con copia verificada: ${Number(s.mirror.verified)||0} de ${Number(s.mirror.total)||0}</b><p>${Number(s.mirror.pending)||0} pendientes. La copia por lotes se ejecuta en Supabase cada dos minutos y se detiene cuando no queda nada pendiente. Las vistas previas y descargas utilizan OneDrive cuando el documento está verificado. Las nuevas subidas siguen disponibles desde Supabase mientras se completa su traslado.</p><progress aria-label="Documentos copiados y comprobados en OneDrive" max="${Math.max(1,Number(s.mirror.total)||0)}" value="${Number(s.mirror.verified)||0}" style="width:100%"></progress></div>${s.mirror.last_error?'<p class="note warn">Último lote: '+esc(s.mirror.last_error)+'</p>':''}${s.mirror.running?'<p role="status">Copia en curso en el servidor.</p>':''}${btn('Copiar siguiente lote de documentos','onedrive-mirror','secondary',s.tested_at&&s.mirror.pending&&!s.mirror.running?'':'disabled')}`:''}
${s?.connected&&s?.backups?`<div class="note"><b>Copias completas verificadas en OneDrive: ${Number(s.backups.verified)||0} de 5 como máximo</b><p>${Number(s.backups.pending)||0} en preparación. La copia nocturna de las 00:35 se guarda y verifica directamente aquí. En Supabase solo queda su índice pequeño.</p>${s.backups.last_error?'<p class="warn-text">'+esc(s.backups.last_error)+'</p>':''}${s.backups.running?'<p role="status">Copiando la seguridad en el servidor.</p>':''}</div>${btn('Actualizar copia en OneDrive','onedrive-backup-mirror','secondary',s.tested_at&&!s.backups.running?'':'disabled')}`:''}
 ${s?.quota?.available?`<div class="note"><b>Espacio de tu cuenta OneDrive</b><p>${(Number(s.quota.used)/1073741824).toLocaleString('es-ES',{maximumFractionDigits:2})} GB usados · ${(Number(s.quota.remaining)/1073741824).toLocaleString('es-ES',{maximumFractionDigits:2})} GB libres · ${(Number(s.quota.total)/1073741824).toLocaleString('es-ES',{maximumFractionDigits:2})} GB de capacidad.</p><progress aria-label="Espacio ocupado de la cuenta OneDrive" max="${Number(s.quota.total)}" value="${Number(s.quota.used)}" style="width:100%"></progress></div>`:''}
 <p class="note">Solo se utiliza la carpeta exclusiva de TotusCentral. Los documentos sustituidos o retirados se conservan en «99 Archivo de documentos retirados». La contabilidad, los usuarios y los permisos permanecen en Supabase.</p>
 </section></div>`;
}
