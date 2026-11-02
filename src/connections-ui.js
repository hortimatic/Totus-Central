import {apiManagerHtml} from './api-manager.js';
import {aiConnectionTestHtml} from './ai-connection-test.js';
import {esc} from './utils.js';
import {cloudflareConnectionHtml} from './cloudflare-connection.js';

export function connectionsHtml({gemini=null}={}){
 return '<section id="connectionsRoot" hidden aria-label="APIs y conexiones"><header class="card card-pad"><h2>APIs y conexiones</h2><p>Proveedores externos e identidades de la herramienta. Preparar una conexión no activa consumo ni autoriza operaciones contables.</p></header>'+apiManagerHtml()+'<details class="card card-pad api-existing-connection"><summary>Conexión actual de Totus IA · Cloudflare</summary>'+cloudflareConnectionHtml()+'</details>'+'<div class="connections-grid"><article class="card card-pad"><h3>Gemini · Google AI Studio</h3><span class="pill">Pruebas ficticias</span><p>Comprueba la clave con un mensaje de ensayo. No envía facturas ni ejecuta acciones. La clave no se guarda en este navegador ni en la configuración.</p><p><b>Usuario:</b> '+esc(gemini?.full_name||'Gemini')+' · '+esc(gemini?.email||'Pendiente de preparar')+'</p><p class="small muted">'+(gemini?(gemini.active?'Cuenta habilitada; proveedor todavía sin activar.':'Cuenta preparada y desactivada hasta conectar el proveedor.'):'El usuario aún no está registrado.')+' Su existencia no conecta automáticamente el proveedor.</p></article><article class="card card-pad"><h3>Tipos de conexión</h3><p>En Mis conexiones puedes configurar APIs HTTP, PrestaShop, GitHub y los proveedores de IA compatibles. Solo los adaptadores de IA pueden atender peticiones de Chat.</p><p class="small muted">Probar una API comprueba su conexión; no incorpora por sí solo nuevas funciones. Cada proveedor necesita sus condiciones, cuota y permisos.</p></article><article class="card card-pad"><h3>Servicios de Totus Central</h3><p>GitHub aloja el código; Supabase gestiona datos, usuarios y permisos; OneDrive conserva los documentos y las copias.</p><p>El estado y las credenciales de OneDrive se gestionan en Administración → Almacenamiento. Los permisos de los usuarios se gestionan en Administración → Usuarios.</p></article></div>'+aiConnectionTestHtml()+'</section>';
}

export function mountConnectionsTabs(page,{appearance,connections,guard,disposeTest,mountTest,selectAppearance=()=>{}}){
 const tabs=document.createElement('nav');tabs.className='tabs configuration-sections';tabs.setAttribute('aria-label','Secciones de Configuración');
 tabs.innerHTML='<button type="button" class="tab active" data-config-section="appearance" aria-pressed="true">Interfaz</button><button type="button" class="tab" data-config-section="login" aria-pressed="false">Login</button><button type="button" class="tab" data-config-section="connections" aria-pressed="false">APIs</button>';
 appearance.classList.add('appearance-external-tabs');appearance.before(tabs);let active='appearance',pending=false;
 tabs.onclick=async event=>{
  const button=event.target.closest('[data-config-section]');if(!button||pending||button.dataset.configSection===active)return;
  pending=true;try{
   if(!await guard()||!page.isConnected)return;
   disposeTest();active=button.dataset.configSection;appearance.hidden=active==='connections';connections.hidden=active!=='connections';if(active!=='connections')selectAppearance(active==='login'?'login':'interfaz');
   tabs.querySelectorAll('button').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
   if(active==='connections')mountTest();
  }finally{pending=false;}
 };
}
