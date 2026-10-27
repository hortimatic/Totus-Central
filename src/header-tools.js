import {esc} from './utils.js';

export function calendarDays(year,month){
 const first=new Date(Date.UTC(year,month,1)),offset=(first.getUTCDay()+6)%7;
 const length=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return {offset,days:Array.from({length},(_,i)=>`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)};
}

/** Read-only header controls. Existing navigation handles drafts and permissions. */
export function createHeaderTools({rpc,actor,can=()=>true,onNavigate,now=()=>new Date()}){
 let host=null,clockTimer=null,taskTimer=null,owner='',generation=0,running=false,chat=0,tasks=null;
 let month=now().toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'}).slice(0,7),taskError='';
 const today=()=>now().toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'});
 const button=(label,action,body)=>`<button type="button" data-header="${action}" aria-label="${label}" title="${label}">${body}</button>`;
 function badges(){
  if(!host)return;
  const c=host.querySelector('[data-chat-count]'),t=host.querySelector('[data-task-count]');
  host.querySelector('[data-header="chat"]').hidden=!can('equipo');host.querySelector('[data-header="tasks"]').hidden=!can('tareas');
  c.textContent=chat>99?'99+':String(chat);c.classList.toggle('has-alert',chat>0);
  t.textContent=tasks===null?'—':tasks>99?'99+':String(tasks);t.classList.toggle('has-alert',tasks>0);
  host.querySelector('[data-header="chat"]').setAttribute('aria-label',`Chat: ${chat} mensajes sin leer`);
  const label=taskError||`Tareas para hoy pendientes: ${tasks===null?'consultando':tasks}`;
  const target=host.querySelector('[data-header="tasks"]');target.title=label;target.setAttribute('aria-label',label);
 }
 function tick(){
  if(!host)return;
  const date=now();host.querySelector('[data-clock]').textContent=date.toLocaleTimeString('es-ES',{timeZone:'Europe/Madrid',hour12:false});
  host.querySelector('[data-clock-date]').textContent=date.toLocaleDateString('es-ES',{timeZone:'Europe/Madrid',weekday:'short',day:'numeric',month:'short'});
 }
 function calendar(){
  if(!host)return;
  const [year,m]=month.split('-').map(Number),{offset,days}=calendarDays(year,m-1),panel=host.querySelector('[data-calendar]');
  const caption=new Date(Date.UTC(year,m-1,1)).toLocaleDateString('es-ES',{timeZone:'UTC',month:'long',year:'numeric'});
  panel.innerHTML=`<div class="header-calendar-nav">${button('Mes anterior','prev','‹')}<strong>${esc(caption)}</strong>${button('Mes siguiente','next','›')}</div><div class="header-calendar-grid">${['L','M','X','J','V','S','D'].map(d=>`<b aria-hidden="true">${d}</b>`).join('')}${'<span></span>'.repeat(offset)}${days.map(d=>`<button type="button" data-header="day" data-date="${d}" ${d===today()?'aria-current="date"':''} aria-label="Ver tareas del ${d.split('-').reverse().join('/')}">${Number(d.slice(-2))}</button>`).join('')}</div><div class="header-calendar-footer">${button('Ir a hoy','today','Hoy')}<small>Hora de Madrid · pulsa un día para ver sus tareas.</small></div>`;
 }
 function close(focus=false){if(!host)return;host.querySelector('[data-calendar]').hidden=true;const b=host.querySelector('[data-header="calendar"]');b.setAttribute('aria-expanded','false');if(focus)b.focus();}
 async function check(){
  if(!can('tareas')){tasks=0;taskError='';badges();return;}
  const who=actor();if(running||!who||document.visibilityState==='hidden')return;
  const token=generation;running=true;
  try{
   const result=await rpc('totus_tasks_context',{p_from:today(),p_to:today()});
   if(token!==generation||actor()!==who)return;
   if(!Array.isArray(result?.rows))throw new Error('Respuesta de tareas no disponible');
   tasks=result.rows.filter(r=>!['done','cancelled'].includes(r.state)&&(!r.assigned_email||r.assigned_email.toLowerCase()===who.toLowerCase())).length;taskError='';
  }catch{if(token===generation){tasks=null;taskError='No se pudieron actualizar las tareas. Pulsa para abrir el calendario.';}}
  finally{if(token===generation){running=false;badges();}}
 }
 function click(event){
  const b=event.target.closest('[data-header]');if(!b)return;
  const action=b.dataset.header;
  if(action==='calendar'){const panel=host.querySelector('[data-calendar]');panel.hidden=!panel.hidden;b.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)calendar();return;}
  if(action==='prev'||action==='next'){const [y,m]=month.split('-').map(Number);month=new Date(Date.UTC(y,m-1+(action==='next'?1:-1),1)).toISOString().slice(0,7);calendar();return;}
  if(action==='today'){month=today().slice(0,7);calendar();return;}
  close();Promise.resolve(onNavigate(action==='chat'?'equipo':'tareas',action==='day'?b.dataset.date:today())).catch(()=>{});
 }
 const outside=e=>{if(host&&!e.composedPath().includes(host))close();};
 const key=e=>{if(e.key==='Escape'&&host&&!host.querySelector('[data-calendar]').hidden){e.preventDefault();close(true);}};
 const visible=()=>{if(document.visibilityState==='visible'){tick();check();}};
 return {
  setChatUnread(value){if(value!==null)chat=Math.max(0,Number(value)||0);badges();},
  start(){
   if(owner===actor()&&clockTimer){tick();return;}
   this.stop();owner=actor();if(!owner)return;
   host=document.createElement('div');host.id='headerTools';host.className='header-tools';
   host.innerHTML=button('Abrir calendario','calendar','<span class="header-clock"><b data-clock></b><small data-clock-date></small></span><span aria-hidden="true">▦</span>')+button('Chat: mensajes sin leer','chat','<span aria-hidden="true">☏</span><span data-chat-count class="header-count">0</span>')+button('Tareas para hoy pendientes','tasks','<span aria-hidden="true">☑</span><span data-task-count class="header-count">—</span>')+'<div data-calendar class="header-calendar" role="dialog" aria-label="Calendario" hidden></div>';
   host.querySelector('[data-header="calendar"]').setAttribute('aria-expanded','false');
   document.querySelector('.topbar').insertBefore(host,document.getElementById('topActions'));
   host.addEventListener('click',click);document.addEventListener('click',outside);document.addEventListener('keydown',key);document.addEventListener('visibilitychange',visible);
   tick();badges();check();clockTimer=setInterval(()=>{if(document.visibilityState==='visible')tick();},1000);taskTimer=setInterval(check,30000);
  },
  stop(){generation++;running=false;clearInterval(clockTimer);clearInterval(taskTimer);clockTimer=taskTimer=null;host?.remove();host=null;owner='';chat=0;tasks=null;taskError='';document.removeEventListener('click',outside);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visible);}
 };
}
