import {credentialLifetime} from './connection-maintenance.js';
import {backupRetentionCount} from './backup-retention.js';

import {state,isAdmin} from './state.js';
import {esc} from './utils.js';
import {btn,kpi} from './components.js';

let connectionStatus=null,connectionOwner='',maintenanceStatus=null,maintenanceOwner='';
export function setOneDriveMaintenance(value){maintenanceStatus=value;maintenanceOwner=state.user?.email||'';}
export function setOneDriveStatus(value){connectionStatus=value;connectionOwner=state.user?.email||'';if(value&&Object.hasOwn(value,'credential_expires_at'))setOneDriveMaintenance(value);}
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
export function oneDriveCredentialNotice({compact=false}={}){
 if(!isAdmin())return '';
 const s=connectionOwner===(state.user?.email||'')?connectionStatus:null,info=maintenanceOwner===(state.user?.email||'')?maintenanceStatus:null;
 if(!s&&!info)return '';
 const value={...s,...info},life=credentialLifetime(value.credential_expires_at,new Date(),value);
 const fmt=date=>new Date(date+'T12:00:00Z').toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'});
 if(compact&&(!life.known||life.level==='ok'))return '';
 const headline=!life.known?'Registra la caducidad de la clave de Microsoft':life.expired?'La clave de Microsoft ha caducado':life.level==='urgent'?'Renueva la clave de Microsoft cuanto antes':life.level==='warning'?'Ya puedes renovar la clave de Microsoft':'Clave de conexión con Microsoft';
 if(compact)return '<aside class="note warn" role="alert" data-credential-notice><b>'+headline+'</b><p>'+life.days+' días restantes · caduca el '+fmt(life.date)+'.</p><button class="btn secondary" data-route="administracion" data-maintenance-storage>Abrir Almacenamiento</button></aside>';
 return '<section class="credential-card" data-level="'+life.level+'" data-credential-notice aria-label="Caducidad de la clave de Microsoft"><div class="credential-card-head"><div><h3>'+headline+'</h3><p>Esta clave permite subir documentos y hacer copias en OneDrive.</p></div><b class="credential-days">'+(life.known?(life.expired?'Caducada':life.days+' días'):'Sin fecha')+'<small>para renovar la conexión</small></b></div>'+
 (life.known?'<div class="credential-timeline"><div><span>Primer aviso · '+life.warningDays+' días antes</span><b>'+fmt(life.renewBy)+'</b></div><div><span>Aviso urgente · '+life.urgentDays+' días antes</span><b>'+fmt(life.urgentBy)+'</b></div><div><span>Caducidad de la clave</span><b>'+fmt(life.date)+'</b></div></div>':'<p>Introduce la fecha que aparece en Microsoft.</p>')+
 '<p class="small muted">Los avisos aparecen en Totus Central para el administrador. No son correos ni avisos de falta de espacio; tus archivos no caducan con esta clave.</p><details data-storage-detail="credential-settings"><summary>Configurar avisos y fecha</summary><div class="form-grid"><div class="field"><label for="odCredentialExpiry">Caducidad indicada por Microsoft</label><input id="odCredentialExpiry" type="date" value="'+esc(String(value.credential_expires_at||'').slice(0,10))+'"></div><div class="field"><label for="odWarningDays">Primer aviso · días antes</label><input id="odWarningDays" type="number" min="2" max="365" step="1" value="'+(value.warning_days??90)+'"></div><div class="field"><label for="odUrgentDays">Aviso urgente · días antes</label><input id="odUrgentDays" type="number" min="1" max="364" step="1" value="'+(value.urgent_days??30)+'"></div></div>'+btn('Guardar avisos','onedrive-expiry-save','primary')+'<p class="small muted">Guardar la fecha no renueva la clave. Usa las instrucciones siguientes para cambiarla.</p></details>'+
 '<details data-storage-detail="credential-renewal"><summary>Cómo renovar la clave de Microsoft</summary><ol><li>Entra en <a href="https://entra.microsoft.com/" target="_blank" rel="noopener noreferrer">Microsoft Entra</a> con la cuenta propietaria. Abre Registros de aplicaciones y selecciona Totus Central.</li><li>En Certificados y secretos, crea un nuevo secreto de cliente. Conserva el antiguo hasta terminar la prueba.</li><li>Copia el <b>Valor</b> del secreto nuevo, no su identificador. Pégalo solo en el campo protegido de abajo; nunca en el chat.</li><li>Indica su fecha real de caducidad y pulsa Comprobar y actualizar clave. Totus probará la nueva con Microsoft antes de guardarla.</li><li>Comprueba la conexión con el botón de prueba de OneDrive. Cuando funcione, puedes retirar la clave anterior en Microsoft.</li></ol><div class="form-grid"><div class="field"><label for="odRenewSecret">Valor de la nueva clave</label><input id="odRenewSecret" type="password" autocomplete="new-password" data-draft-ignore></div><div class="field"><label for="odRenewExpiry">Caducidad de la nueva clave</label><input id="odRenewExpiry" type="date" data-draft-ignore></div></div>'+btn('Comprobar y actualizar clave','onedrive-key-renew-save','primary')+'</details></section>';
}
export function oneDrivePanel(){
 if(!isAdmin())return '<section class="card card-pad"><h2>OneDrive</h2><p>Solo administración puede preparar esta conexión.</p></section>';
 const s=isAdmin()&&connectionOwner===(state.user?.email||'')?connectionStatus:null;
 const folder=safeLink(s?.folder_url);
 return `<div class="stack"><section class="card card-pad">
 <div class="section-head"><div><h2>OneDrive · documentos y copias</h2><p>Conexión del almacenamiento externo con TotusCentral.</p></div>${btn('Actualizar conexión','onedrive-refresh','secondary')}</div>
 ${!s?'<p class="note">Pulsa Actualizar conexión para consultar el estado.</p>':`<div class="kpis">${kpi('Conexión',s.connected?'Conectada':s.configured?'Pendiente de autorización':'Pendiente de preparar')}${kpi('Prueba de guardado y lectura',s.tested_at?'Comprobada':'Pendiente')}</div>
 ${s.connected?`<p>Microsoft ha autorizado la carpeta exclusiva de la aplicación.</p>${s.tested_at?'<p>Última comprobación: '+esc(new Date(s.tested_at).toLocaleString('es-ES'))+'.</p>':''}<div class="inline-actions">${btn('Guardar y comprobar archivo de prueba','onedrive-test','primary')}${btn('Volver a autorizar OneDrive','onedrive-begin','secondary')}${folder?'<a class="btn secondary" href="'+esc(folder)+'" target="_blank" rel="noopener noreferrer">Abrir carpeta de OneDrive</a>':''}</div>`:`<ol><li>En Microsoft, prepara la aplicación <b>Totus Central</b> con la dirección de retorno indicada abajo.</li><li>Crea tú la credencial de la aplicación y pega su <b>valor</b> aquí. Se guarda cifrada en Supabase; no se muestra de nuevo.</li><li>Autoriza el acceso a la carpeta de la aplicación y prueba la conexión.</li></ol>
 <div class="field"><label>Identificador de la aplicación</label><code style="overflow-wrap:anywhere">${esc(s.client_id||'')}</code></div>
 <div class="field"><label>Dirección de retorno en Microsoft · plataforma Web</label><code style="overflow-wrap:anywhere">${esc(s.redirect_uri||'')}</code></div>
 ${s.configured?'<p class="note">Credencial guardada. Falta tu autorización en Microsoft.</p>':`<div class="field"><label for="odClientSecret">Valor de la credencial de Microsoft</label><input id="odClientSecret" type="password" autocomplete="new-password" data-draft-ignore></div>${btn('Guardar credencial','onedrive-credential-save','primary')}`}
 <div class="inline-actions">${btn('Preparar autorización de Microsoft','onedrive-begin','secondary',s.configured?'':'disabled')}</div>`}
 `}
 ${s?.connected&&s?.mirror?`<div class="note"><b>Documentos con copia verificada: ${Number(s.mirror.verified)||0} de ${Number(s.mirror.total)||0}</b><p>${Number(s.mirror.pending)||0} pendientes. La copia por lotes se ejecuta en Supabase cada dos minutos y se detiene cuando no queda nada pendiente. Las vistas previas y descargas utilizan OneDrive cuando el documento está verificado. Las nuevas subidas siguen disponibles desde Supabase mientras se completa su traslado.</p><progress aria-label="Documentos copiados y comprobados en OneDrive" max="${Math.max(1,Number(s.mirror.total)||0)}" value="${Number(s.mirror.verified)||0}" style="width:100%"></progress></div>${s.mirror.last_error?'<p class="note warn">Último lote: '+esc(s.mirror.last_error)+'</p>':''}${s.mirror.running?'<p role="status">Copia en curso en el servidor.</p>':''}${btn('Copiar siguiente lote de documentos','onedrive-mirror','secondary',s.tested_at&&s.mirror.pending&&!s.mirror.running?'':'disabled')}`:''}
${s?.connected&&s?.backups?`<div class="note"><b>Copias completas verificadas en OneDrive: ${Number(s.backups.verified)||0} de ${Number(s.backups.maximum)||backupRetentionCount(state.data.backupConfig?.retention_days)} como máximo</b><p>${Number(s.backups.pending)||0} en preparación. La copia nocturna de las 00:35 se guarda y verifica directamente aquí. En Supabase solo queda su índice pequeño.</p>${s.backups.last_error?'<p class="warn-text">'+esc(s.backups.last_error)+'</p>':''}${s.backups.running?'<p role="status">Copiando la seguridad en el servidor.</p>':''}</div>${btn('Actualizar copia en OneDrive','onedrive-backup-mirror','secondary',s.tested_at&&!s.backups.running?'':'disabled')}`:''}
 ${s?.quota?.available?`<div class="note"><b>Espacio de tu cuenta OneDrive</b><p>${(Number(s.quota.used)/1073741824).toLocaleString('es-ES',{maximumFractionDigits:2})} GB usados · ${(Number(s.quota.remaining)/1073741824).toLocaleString('es-ES',{maximumFractionDigits:2})} GB libres · ${(Number(s.quota.total)/1073741824).toLocaleString('es-ES',{maximumFractionDigits:2})} GB de capacidad.</p></div>`:''}
 <p class="note">Solo se utiliza la carpeta exclusiva de TotusCentral. Los documentos sustituidos o retirados se conservan en «99 Archivo de documentos retirados». La contabilidad, los usuarios y los permisos permanecen en Supabase.</p>
 </section></div>`;
}

export function oneDriveStorageCard(monthlyGrowth=0){
 const s=isAdmin()&&connectionOwner===(state.user?.email||'')?connectionStatus:null;
 const size=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?(n/1048576).toLocaleString('es-ES',{maximumFractionDigits:2})+' MB':'Sin medición';};
 const keep=backupRetentionCount(state.data.backupConfig?.retention_days),q=s?.quota;
 const known=q?.available&&[q.used,q.total,q.remaining].every(v=>Number.isFinite(Number(v))&&Number(v)>=0)&&Number(q.total)>0;
 const gb=v=>(Number(v)/1073741824).toLocaleString('es-ES',{maximumFractionDigits:1})+' GB';
 const years=known&&monthlyGrowth>0?Number(q.remaining)/(monthlyGrowth*(keep+1)*12):null;
 return `<article class="storage-provider-card storage-provider-onedrive"><header class="storage-service-heading"><h3>OneDrive</h3><p>Facturas, documentos y copias de seguridad</p></header>
 <div class="storage-capacity-row"><div class="storage-capacity-label"><b>Cuenta completa</b><span>${known?gb(q.used)+' de '+gb(q.total):'Capacidad pendiente de consultar'}</span></div><div class="storage-capacity-meter">${known?'<progress aria-label="Espacio ocupado de la cuenta OneDrive" max="'+Number(q.total)+'" value="'+Number(q.used)+'"></progress><span><b>'+gb(q.remaining)+'</b> libres</span>':'<span>'+(!s?'Consultando conexión…':s.connected?'Microsoft no ha facilitado la capacidad.':'Conexión pendiente')+'</span>'}</div><div class="storage-capacity-duration"><span>Duración estimada para Totus</span><b>${years!==null?(years>10?'Más de 10 años':years.toLocaleString('es-ES',{maximumFractionDigits:1})+' años'):'Sin estimación'}</b></div></div>
 <p class="storage-service-footnote">${s?.mirror?'Totus: '+size(s.mirror.verified_bytes)+' en documentos':'Documentos: consultando…'} · ${s?.backups?size(s.backups.bytes)+' en copias':'copias: consultando…'}. La barra incluye tus otros archivos. Estimación con ${keep} copias y 9 meses de actividad de Totus, sin prever otros usos de la cuenta.</p>
 <span class="storage-connection-label">${s?.connected?'Conectado':s?'Conexión pendiente':'Consultando…'}${s?.mirror?' · '+Number(s.mirror.verified||0)+' documentos verificados':''}</span></article>`;
}
