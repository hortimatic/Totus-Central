import {apiManagerHtml} from './api-manager.js';
import {prestashopHtml} from './prestashop-ui.js';
export function connectionsHtml(){return '<section id="connectionsRoot" hidden aria-label="APIs y conexiones">'+apiManagerHtml()+'</section>'+prestashopHtml();}

export function mountConnectionsTabs(page,{appearance,connections,prestashop,guard,disposeTest,mountTest,disposePrestashop=()=>{},mountPrestashop=()=>{},selectAppearance=()=>{}}){
 const tabs=document.createElement('nav');tabs.className='tabs configuration-sections';tabs.setAttribute('aria-label','Secciones de Configuración');
 tabs.innerHTML='<button type="button" class="tab active" data-config-section="appearance" aria-pressed="true">Interfaz</button><button type="button" class="tab" data-config-section="login" aria-pressed="false">Login</button><button type="button" class="tab" data-config-section="connections" aria-pressed="false">APIs</button><button type="button" class="tab" data-config-section="prestashop" aria-pressed="false">PrestaShop</button>';
 appearance.classList.add('appearance-external-tabs');appearance.before(tabs);let active='appearance',pending=false;
 tabs.onclick=async event=>{
  const button=event.target.closest('[data-config-section]');if(!button||pending||button.dataset.configSection===active)return;
  pending=true;try{
   if(!await guard()||!page.isConnected)return;
   disposeTest();disposePrestashop();active=button.dataset.configSection;appearance.hidden=active==='connections'||active==='prestashop';connections.hidden=active!=='connections';prestashop.hidden=active!=='prestashop';if(active!=='connections')selectAppearance(active==='login'?'login':'interfaz');
   tabs.querySelectorAll('button').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
   if(active==='connections')mountTest();if(active==='prestashop')mountPrestashop();
  }finally{pending=false;}
 };
}
