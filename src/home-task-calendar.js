import {esc} from './utils.js';
import {taskToday,taskDate,taskRange,addTaskDays,TASK_STATES} from './tasks-core.js';

export function calendarRange(anchor,view){return view==='day'?{from:taskDate(anchor),to:anchor}:taskRange(anchor,view);}
export function calendarShift(anchor,view,step){
 if(view!=='month')return addTaskDays(anchor,step*(view==='week'?7:1));
 const d=new Date(anchor.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+step);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 return d.toISOString().slice(0,7)+'-'+String(Math.min(last,Number(anchor.slice(-2)))).padStart(2,'0');
}
export function createHomeTaskCalendar({rpc,actor,can,onOpen=()=>{}}){
 let host=null,owner=null,generation=0,view='month',anchor=taskToday(),data=null,key='',error='',busy=false,selectedUser='',followToday=true;
 const current=(el,n,who)=>host===el&&el.isConnected&&generation===n&&actor()===who;
 function render(){
  if(!host?.isConnected)return;
  if(!can()){host.innerHTML='<p id="tasksHomeSummary">Tu cuenta no tiene acceso al calendario de tareas.</p>';return;}
  const range=calendarRange(anchor,view),rows=(data?.rows||[]).filter(row=>!selectedUser||String(row.assigned_email||row.created_email||'').toLowerCase()===selectedUser),count=Math.round((Date.parse(range.to)-Date.parse(range.from))/86400000)+1;
  const items=rows.filter(r=>r.scheduled_on===anchor),finished=items.filter(r=>r.state==='done').length;
  host.innerHTML='<section class="home-task-calendar" aria-label="Calendario de tareas"><div class="home-task-owner"><strong>'+esc(data?.can_select_users?(selectedUser?'Tareas de '+(data.people?.find(p=>p.email===selectedUser)?.name||selectedUser):'Tareas de todo el equipo'):'Mis tareas · '+(data?.people?.find(p=>p.email===owner)?.name||owner||''))+'</strong>'+(data?.can_select_users?'<label>Usuario<select data-ht-user><option value="">Todo el equipo</option>'+(data.people||[]).map(p=>'<option value="'+esc(p.email)+'" '+(selectedUser===p.email?'selected':'')+'>'+esc(p.name||p.email)+'</option>').join('')+'</select></label>':'')+'</div><div class="home-task-toolbar"><div role="group" aria-label="Vista del calendario">'+[['day','Día'],['week','Semana'],['month','Mes']].map(([v,label])=>'<button type="button" data-ht-action="view" data-view="'+v+'" aria-pressed="'+(view===v)+'">'+label+'</button>').join('')+'</div><div><button type="button" data-ht-action="previous" aria-label="Periodo anterior">‹</button><button type="button" data-ht-action="today">Hoy</button><button type="button" data-ht-action="next" aria-label="Periodo siguiente">›</button></div></div><label class="home-task-date">Fecha<input type="date" data-ht-date value="'+anchor+'" data-draft-ignore></label><p class="small muted" role="status">'+esc(busy?'Consultando calendario…':error||((data?.checked?'Leído '+data.checked+' · ':'')+range.from+' — '+range.to))+'</p><div class="home-task-days '+(view==='day'?'is-day':'')+'">'+(view!=='day'?['L','M','X','J','V','S','D'].map(s=>'<small aria-hidden="true">'+s+'</small>').join(''):'')+Array.from({length:count},(_,i)=>{const date=addTaskDays(range.from,i),dayTasks=rows.filter(r=>r.scheduled_on===date&&r.state!=='cancelled'),n=dayTasks.length;return '<button type="button" data-ht-action="date" data-date="'+date+'" aria-pressed="'+(date===anchor)+'" '+(date===taskToday()?'aria-current="date"':'')+' aria-label="'+date+' · '+n+' tareas"><span>'+Number(date.slice(-2))+'</span>'+(n?'<small>'+n+' tareas</small><span class="home-task-cell-titles">'+dayTasks.slice(0,2).map(t=>'<span>'+esc(t.title)+'</span>').join('')+(n>2?'<span>+'+(n-2)+' más</span>':'')+'</span>':'')+'</button>';}).join('')+'</div><div class="home-task-agenda"><strong>'+anchor+' · '+finished+'/'+items.length+' completadas</strong>'+(items.length?'<ul>'+items.map(r=>'<li><span>'+esc(r.title)+'</span><small>'+esc(TASK_STATES[r.state]||'Sin estado')+'</small></li>').join('')+'</ul>':'<p class="small muted">'+(data?'No hay tareas para este día.':'Pendiente de consulta.')+'</p>')+'</div><div class="home-task-toolbar"><button type="button" data-ht-action="refresh" '+(busy?'disabled':'')+'>Actualizar</button><button type="button" data-ht-action="open">Abrir Tareas</button></div></section>';
 }
 async function refresh(force=false){
  if(!host?.isConnected||!can())return;
  const range=calendarRange(anchor,view),nextKey=owner+'|'+range.from+'|'+range.to;
  if(!force&&data&&key===nextKey){render();return;}
  const el=host,n=++generation,who=owner;key=nextKey;data=null;busy=true;error='';render();
  try{
   const result=await rpc('totus_home_tasks_context',{p_from:range.from,p_to:range.to});
   if(!current(el,n,who))return;
   if(!Array.isArray(result?.rows))throw Error('Respuesta de calendario incompleta.');
   const seen=new Set();for(const row of result.rows){const id=String(row.task_id||'')+'|'+row.scheduled_on;if(!row.task_id||row.scheduled_on<range.from||row.scheduled_on>range.to||seen.has(id))throw Error('Respuesta de tareas ajena o duplicada.');taskDate(row.scheduled_on);seen.add(id);}
   data={rows:result.rows,people:result.people||[],can_select_users:result.can_select_users===true,checked:new Date().toLocaleTimeString('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit'})};
  }catch(e){if(current(el,n,who))error=e.message||'No se pudo consultar el calendario.';}
  finally{if(current(el,n,who)){busy=false;render();}}
 }
 const visible=()=>{if(document.visibilityState==='visible'&&host&&followToday&&anchor!==taskToday()){anchor=taskToday();void refresh(true);}};
 function mount(el){
  dispose();host=el;if(owner!==actor()){owner=actor();anchor=taskToday();view='month';data=null;key='';selectedUser='';followToday=true;}
  if(followToday)anchor=taskToday();document.addEventListener('visibilitychange',visible);
  host.onclick=e=>{const b=e.target.closest('[data-ht-action]');if(!b||b.disabled||!can())return;e.stopPropagation();const action=b.dataset.htAction;if(action==='open'){onOpen(anchor);return;}if(action==='refresh'){void refresh(true);return;}if(action==='view'){if(!['day','week','month'].includes(b.dataset.view))return;view=b.dataset.view;}if(action==='today'){followToday=true;anchor=taskToday();}if(action==='previous'||action==='next'){followToday=false;anchor=calendarShift(anchor,view,action==='previous'?-1:1);}if(action==='date'){followToday=false;anchor=taskDate(b.dataset.date);}void refresh();};
  host.onchange=e=>{if(e.target.matches('[data-ht-user]')&&data?.can_select_users){selectedUser=e.target.value;render();return;}if(e.target.matches('[data-ht-date]')){try{followToday=false;anchor=taskDate(e.target.value);void refresh();}catch{error='Fecha no válida.';render();}}};
  render();void refresh();
 }
 function dispose(){document.removeEventListener('visibilitychange',visible);generation++;if(host){host.onclick=null;host.onchange=null;}host=null;busy=false;}
 return {mount,dispose,reset(){dispose();data=null;key='';owner=null;}};
}
