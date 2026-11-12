import {esc} from './utils.js';

// Header consumes the scheduler's confirmed online deliveries. No additional
// catalogue polling and no classification based on the payment description.
export function createOnlineOrderBell({rpc,actor,can,onNavigate,onOpenOrder}){
 let host=null,button=null,panel=null,owner='',epoch=0,timer=null,busy=false,data=null,error='',seenCount=null;
 const valid=(who,n)=>host?.isConnected&&actor()===who&&owner===who&&epoch===n;
 const key=row=>row.store+':'+row.order_id;
 const filtered=()=>data?.config?.enabled===false?[]:(data?.rows||[]).filter(row=>(data.config.stores||[]).includes(row.store));
 function render(){
  if(!host)return;
  const rows=filtered(),seen=new Set(data?.config?.seen||[]),unread=rows.filter(r=>!seen.has(key(r))).length;
  button.hidden=!can('ventas');button.setAttribute('aria-label','Pedidos online: '+(data?unread+' sin leer':'consulta pendiente'));button.title=error||button.getAttribute('aria-label');
  button.innerHTML='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="header-count '+(unread?'has-alert':'')+'">'+(data?(unread>99?'99+':unread):'—')+'</span>';
  if(seenCount!==null&&unread>seenCount)button.classList.add('has-new-order');seenCount=unread;
  panel.innerHTML='<header><strong>Pedidos online</strong><button type="button" data-online="close" aria-label="Cerrar pedidos online">×</button></header><p class="small muted">Avisos de los orígenes web confirmados en Automatizaciones. Cada regla decide las tiendas y la frecuencia; el TPV no se identifica por el medio de pago.</p>'+
   (error?'<p role="alert">'+esc(error)+'</p>':'')+'<div class="header-order-options"><label><input type="checkbox" data-online-config="enabled" '+(data?.config?.enabled!==false?'checked':'')+'> Mostrar avisos</label>'+[['hortimatic','Hortimatic'],['newoldsmok','NewOldSmok']].map(([id,name])=>'<label><input type="checkbox" data-online-store="'+id+'" '+(data?.config?.stores?.includes(id)?'checked':'')+'>'+name+'</label>').join('')+'</div><div class="header-order-actions"><button type="button" data-online="refresh" '+(busy?'disabled':'')+'>Actualizar</button><button type="button" data-online="seen" '+(!data||busy?'disabled':'')+'>Marcar leídos</button>'+(can('automatizaciones')?'<button type="button" data-online="rules">Configurar reglas y horarios</button>':'')+'</div><p class="small" role="status">'+esc(busy?'Consultando avisos…':!data?'Consulta pendiente.':data.active_rules===0?'No hay reglas online activas disponibles para tu cuenta. Configura los orígenes y destinatarios para recibir pedidos.':data.active_rules+' reglas activas · '+unread+' sin leer · últimos 7 días')+'</p><div class="header-order-list">'+rows.map(row=>{
    const match=String(row.body||'').match(/Fecha: (\d{4}-\d{2}-\d{2})/),date=match?.[1]||'';
    return '<article class="header-order-notice '+(!seen.has(key(row))?'is-unread':'')+'"><strong>'+esc(row.store==='hortimatic'?'Hortimatic':'NewOldSmok')+' · Pedido #'+esc(row.order_id)+'</strong><pre>'+esc(row.body)+'</pre><button type="button" data-online="order" data-store="'+esc(row.store)+'" data-order="'+esc(row.order_id)+'" data-date="'+esc(date)+'" '+(!date?'disabled':'')+'>Ver pedido, datos e imágenes</button></article>';
   }).join('')+(data&&!rows.length?'<p>No hay avisos para las tiendas seleccionadas.</p>':'')+'</div>';
 }
 async function refresh(){
  if(busy||!host||!can('ventas')||document.visibilityState==='hidden')return;
  const who=owner,n=epoch;busy=true;render();
  try{const next=await rpc('totus_header_online_orders',{p_action:'read',p_data:{}});if(!valid(who,n))return;if(!Array.isArray(next?.rows)||!Array.isArray(next.config?.seen)||!Array.isArray(next.config?.stores))throw Error('Respuesta de avisos incompleta.');if(next.rows.some(r=>!['hortimatic','newoldsmok'].includes(r.store)||!/^\d{1,15}$/.test(r.order_id)||typeof r.body!=='string'))throw Error('Aviso sin identidad verificable.');data=next;error='';}
  catch(e){if(valid(who,n)){data=null;error='No se pudieron actualizar los avisos: '+(e.message||'revisa la conexión.');}}
  finally{if(valid(who,n)){busy=false;render();}}
 }
 async function save(config){
  if(busy||!data)return;const who=owner,n=epoch;busy=true;render();
  try{const next=await rpc('totus_header_online_orders',{p_action:'save',p_data:config});if(!valid(who,n))return;if(!next?.config||!Array.isArray(next.rows))throw Error('No se confirmó el guardado.');data=next;error='';}
  catch(e){if(valid(who,n))error='No se guardó la configuración: '+e.message;}
  finally{if(valid(who,n)){busy=false;render();}}
 }
 const close=()=>{if(panel){panel.hidden=true;button.setAttribute('aria-expanded','false');}};
 const outside=e=>{if(host&&!e.composedPath().includes(host))close();};
 const keyboard=e=>{if(e.key==='Escape'&&panel&&!panel.hidden){close();button.focus();}};
 return {start(container){this.stop();owner=actor();if(!owner||!can('ventas'))return;host=container;button=document.createElement('button');button.type='button';button.className='header-online-bell';button.setAttribute('aria-expanded','false');panel=document.createElement('div');panel.className='header-online-orders';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Avisos de pedidos online');host.append(button,panel);
   button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));button.classList.remove('has-new-order');if(!panel.hidden)void refresh();};
   panel.onclick=e=>{const b=e.target.closest('[data-online]');if(!b||b.disabled)return;const action=b.dataset.online;if(action==='close'){close();return;}if(action==='refresh'){void refresh();return;}if(action==='seen'){void save({...data.config,seen:[...new Set([...(data.config.seen||[]),...filtered().map(key)])].slice(-500)});return;}if(action==='rules'){close();void onNavigate('automatizaciones');return;}if(action==='order'&&['hortimatic','newoldsmok'].includes(b.dataset.store)&&/^\d{1,15}$/.test(b.dataset.order)&&/^\d{4}-\d{2}-\d{2}$/.test(b.dataset.date)){close();void onOpenOrder({store:b.dataset.store,order:b.dataset.order,date:b.dataset.date});}};
   panel.onchange=e=>{if(!data||busy)return;if(e.target.matches('[data-online-config],[data-online-store]'))void save({...data.config,enabled:panel.querySelector('[data-online-config]').checked,stores:[...panel.querySelectorAll('[data-online-store]:checked')].map(el=>el.dataset.onlineStore)});};
   document.addEventListener('click',outside);document.addEventListener('keydown',keyboard);render();void refresh();timer=setInterval(()=>void refresh(),60000);
  },refresh,refreshAccess(){if(!can('ventas')){data=null;if(button)button.hidden=true;close();}else if(host){button.hidden=false;void refresh();}},stop(){epoch++;clearInterval(timer);timer=null;document.removeEventListener('click',outside);document.removeEventListener('keydown',keyboard);button?.remove();panel?.remove();host=button=panel=null;owner='';data=null;error='';busy=false;seenCount=null;}};
}
