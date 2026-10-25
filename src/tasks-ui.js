import {taskToday,taskRange,taskInput,taskVisibleRows,addTaskDays,TASK_STATES,TASK_PRIORITIES} from './tasks-core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt=(v,label,selected)=>'<option value="'+esc(v)+'" '+(String(v??'')===String(selected??'')?'selected':'')+'>'+esc(label)+'</option>';
const btn=(label,action,attrs='',kind='secondary')=>'<button type="button" class="btn '+kind+'" data-task="'+action+'" '+attrs+'>'+esc(label)+'</button>';
const display=d=>new Date(d+'T12:00:00Z').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
/** Operational controller. No accounting mutations or browser persistence. */
export function createTasks({rpc,actor,onError=()=>{},onSource=()=>{},confirm=async()=>false}){
 let host=null,dialog=null,busy=false,epoch=0,anchor=taskToday(),view='month',filter={store:'',person:'',status:'',query:''},data={rows:[],stores:[],people:[]},timer=null;
 const person=e=>data.people.find(p=>p.email===e)?.name||e||'Sin asignar';
 const store=id=>data.stores.find(s=>s.id===id)?.name||'General';
 const row=(id,d)=>data.rows.find(r=>r.task_id===id&&r.scheduled_on===d);
 const visible=()=>taskVisibleRows(data.rows,filter);
 const close=()=>{dialog?.close();dialog?.remove();dialog=null;};
 const error=e=>{onError(e.message);const box=dialog?.querySelector('[data-error]')||host?.querySelector('[data-error]');if(box){box.textContent=e.message;box.hidden=false;}};
 function modal(title,body,save){
  close();dialog=document.createElement('dialog');dialog.className='tasks-dialog';dialog.innerHTML='<form><header><h2>'+esc(title)+'</h2>'+btn('Cerrar','close')+'</header><div class="tasks-dialog-body">'+body+'<p role="alert" data-error hidden></p></div><footer>'+btn('Cancelar','close')+(save?'<button class="btn primary" type="submit">Guardar</button>':'')+'</footer></form>';document.body.append(dialog);dialog.showModal();
  dialog.querySelectorAll('[data-task="close"]').forEach(b=>b.onclick=()=>close());
  dialog.addEventListener('input',()=>dialog.dataset.dirty='true');const currentDialog=dialog;dialog.addEventListener('close',()=>currentDialog.remove(),{once:true});
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const form=e.currentTarget;form.querySelector('[type="submit"]').disabled=true;try{await save(form);close();await refresh();}catch(e){error(e);}finally{busy=false;if(form.isConnected)form.querySelector('[type="submit"]').disabled=false;}};
 }
 async function command(action,payload){return rpc('totus_task_command',{p_action:action,p_data:payload});}
 function card(r){
  const overdue=r.scheduled_on<taskToday()&&!['done','cancelled'].includes(r.state);
  return '<button type="button" class="task-chip '+esc(r.state)+(overdue?' overdue':'')+'" data-task="detail" data-id="'+esc(r.task_id)+'" data-date="'+r.scheduled_on+'"><strong>'+esc(r.title)+'</strong><small>'+esc(store(r.store_id))+' · '+esc(person(r.assigned_email))+'</small><span>'+esc(TASK_STATES[r.state])+(overdue?' · Vencida':'')+(r.priority==='high'?' · Prioridad alta':'')+'</span></button>';
 }
 function paint(){
  if(!host)return;const rows=visible(),range=taskRange(anchor,view);
  host.innerHTML='<section class="tasks-module"><div class="card card-pad"><div class="section-head"><div><h2>Tareas del equipo</h2><p>Qué hay que hacer, quién lo hace y para qué día.</p></div>'+btn('Nueva tarea','new','','primary')+'</div><div class="tasks-filters"><label>Tienda<select data-filter="store">'+opt('','Todas',filter.store)+data.stores.map(s=>opt(s.id,s.name,filter.store)).join('')+'</select></label><label>Responsable<select data-filter="person">'+opt('','Todos',filter.person)+data.people.map(p=>opt(p.email,p.name,filter.person)).join('')+'</select></label><label>Estado<select data-filter="status">'+opt('','Todos',filter.status)+Object.entries(TASK_STATES).map(([k,v])=>opt(k,v,filter.status)).join('')+'</select></label><label>Buscar<input data-filter="query" value="'+esc(filter.query)+'" placeholder="Título, descripción o persona" maxlength="200"></label>'+btn('Aplicar','filter')+btn('Mis tareas','mine')+btn('Limpiar','clear')+'</div><p data-error role="alert" hidden></p></div>'+
  '<div class="card card-pad"><div class="tasks-toolbar"><div class="inline-actions">'+btn('Anterior','prev')+btn('Hoy','today')+btn('Siguiente','next')+'</div><h3>'+esc(view==='week'?display(range.from)+' — '+display(range.to):new Date(anchor+'T12:00Z').toLocaleDateString('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}))+'</h3><div class="inline-actions">'+['month','week','list'].map((v,i)=>btn(['Mes','Semana','Lista'][i],'view','data-view="'+v+'" '+(view===v?'aria-pressed="true"':''),view===v?'primary':'secondary')).join('')+btn('Actualizar','refresh')+btn('Archivadas','archived')+'</div></div><p class="muted small">'+rows.length+' tareas en el periodo · '+rows.filter(r=>r.state==='done').length+' completadas</p>'+
  (view==='list'?'<div class="tasks-list">'+(rows.map(r=>'<div><h4>'+display(r.scheduled_on)+'</h4>'+card(r)+'</div>').join('')||'<div class="empty">No hay tareas con estos filtros.</div>')+'</div>':
  '<div class="tasks-calendar '+(view==='week'?'week':'')+'" role="region" aria-label="Calendario de tareas"><div class="tasks-weekdays">'+['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(x=>'<b>'+x+'</b>').join('')+'</div><div class="tasks-days">'+Array.from({length:Math.round((Date.parse(range.to)-Date.parse(range.from))/86400000)+1},(_,i)=>{const d=addTaskDays(range.from,i),items=rows.filter(r=>r.scheduled_on===d);return '<section class="task-day '+(d===taskToday()?'today ':'')+(d.slice(0,7)!==anchor.slice(0,7)?'outside':'')+'" aria-label="'+esc(display(d))+'"><header><time datetime="'+d+'">'+Number(d.slice(-2))+'</time>'+btn('+','day-new','data-date="'+d+'" aria-label="Crear tarea para '+esc(display(d))+'"')+'</header>'+items.map(card).join('')+'</section>';}).join('')+'</div></div>')+'</div></section>';
 }
 async function refresh(){const token=++epoch,who=actor(),range=taskRange(anchor,view);const next=await rpc('totus_tasks_context',{p_from:range.from,p_to:range.to});if(token!==epoch||who!==actor()||!host)return;data=next;paint();}
 function edit(r=null,source=null,date=null){
  const start=r?.scheduled_on||date||taskToday(),task=r||{},isNew=!r,client_id=crypto.randomUUID();
  modal(isNew?'Nueva tarea':'Editar tarea','<div class="tasks-form"><label>Título<input name="title" maxlength="160" required value="'+esc(task.title||source?.body?.slice(0,160)||'')+'"></label><label>Descripción<textarea name="description" maxlength="12000" rows="4">'+esc(task.description||source?.body||'')+'</textarea></label>'+
  (!isNew?'<label>Aplicar cambios<select name="scope"><option value="one">Solo esta ocasión (título y descripción)</option value="future">Esta y las siguientes</option></select></label>':'')+
  '<fieldset data-series><legend>Organización y repetición</legend><p class="small muted" data-scope-note'+(isNew?' hidden':'')+'>Para cambiar estos campos elige «Esta y las siguientes». El historial anterior se conserva.</p><div class="form-grid"><label>Tienda<select name="store_id">'+opt('','General',task.store_id||source?.store_id)+data.stores.map(s=>opt(s.id,s.name,task.store_id||source?.store_id)).join('')+'</select></label><label>Responsable<select name="assigned_email">'+opt('','Sin asignar',task.assigned_email)+data.people.map(p=>opt(p.email,p.name,task.assigned_email||actor())).join('')+'</select></label><label>Prioridad<select name="priority">'+Object.entries(TASK_PRIORITIES).map(([k,v])=>opt(k,v,task.priority||'normal')).join('')+'</select></label><label>Primera fecha<input name="starts_on" type="date" required '+(isNew?'':'readonly')+' value="'+start+'"></label><label>Repetir<select name="repeat_kind">'+[['once','Una sola vez'],['daily','Diaria'],['weekly','Semanal'],['monthly','Mensual']].map(([k,v])=>opt(k,v,task.repeat_kind||'once')).join('')+'</select></label><label>Cada cuántos días, semanas o meses<input name="repeat_every" type="number" min="1" max="365" value="'+(task.repeat_every||1)+'"></label><label>Último día (opcional)<input name="ends_on" type="date" value="'+esc(task.ends_on||'')+'"></label></div><div data-weekdays>'+['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((d,i)=>'<label class="task-check"><input type="checkbox" name="weekday" value="'+i+'" '+((task.weekdays||[new Date(start+'T12:00Z').getUTCDay()]).includes(i)?'checked':'')+'>'+d+'</label>').join('')+'</div><p class="small muted">Si el día mensual no existe (por ejemplo, el 31), se usa el último día de ese mes.</p><label>Pasos de comprobación (uno por línea)<textarea name="checklist" rows="4">'+esc((task.checklist||[]).join('\n'))+'</textarea></label></fieldset></div>',
  async form=>{const v=Object.fromEntries(new FormData(form));v.weekdays=[...form.querySelectorAll('[name="weekday"]:checked')].map(x=>Number(x.value));if(r&&v.scope==='one'){Object.assign(v,{...r,title:v.title,description:v.description});}
   const input=taskInput(v);await command('save',{client_id,task_id:r?.task_id||null,occurrence_version:r?.occurrence_version||null,task_version:r?.task_version||null,scheduled_on:r?.scheduled_on||null,scope:v.scope||'future',source_message_id:source?.id||null,task:input});
  });
  const update=()=>{const scope=dialog.querySelector('[name="scope"]')?.value||'future',disabled=scope==='one';dialog.querySelectorAll('[data-series] input,[data-series] select,[data-series] textarea').forEach(x=>x.disabled=disabled);const kind=dialog.querySelector('[name="repeat_kind"]').value;dialog.querySelector('[data-weekdays]').hidden=kind!=='weekly';};
  dialog.querySelector('[name="scope"]')?.addEventListener('change',update);dialog.querySelector('[name="repeat_kind"]').addEventListener('change',update);update();
 }
 function detail(r){
  const canWork=r.can_manage||r.assigned_email===actor();
  modal(r.title,'<p>'+esc(display(r.scheduled_on))+' · '+esc(store(r.store_id))+' · '+esc(person(r.assigned_email))+'</p><p class="tasks-description">'+esc(r.description)+'</p>'+
  '<div class="tasks-checklist">'+r.checklist.map((text,i)=>'<label class="task-check"><input type="checkbox" name="checked" value="'+i+'" '+(r.checked.includes(i)?'checked':'')+' '+(!canWork?'disabled':'')+'>'+esc(text)+'</label>').join('')+'</div><label>Estado<select name="state" '+(!canWork?'disabled':'')+'>'+Object.entries(TASK_STATES).map(([k,v])=>opt(k,v,r.state)).join('')+'</select></label><label>Resultado o notas<textarea name="result" maxlength="12000" rows="4" '+(!canWork?'readonly':'')+'>'+esc(r.result)+'</textarea></label><div class="inline-actions">'+(r.can_manage?btn('Editar configuración','edit')+btn('Archivar tarea','archive','','danger'):'')+(r.source?btn('Ver conversación y adjuntos','source'):'')+btn('Historial','history')+'</div>',
  canWork?async form=>{const v=Object.fromEntries(new FormData(form));await command('occurrence',{task_id:r.task_id,task_version:r.task_version,scheduled_on:r.scheduled_on,occurrence_version:r.occurrence_version,state:v.state,result:v.result,checked:[...form.querySelectorAll('[name="checked"]:checked')].map(x=>Number(x.value))});}:null);
  dialog.querySelector('[data-task="history"]')?.addEventListener('click',async()=>{try{const events=await rpc('totus_task_history',{p_task:r.task_id});modal('Historial de la tarea',events.length?events.map(e=>'<p><b>'+esc(({save:'Configuración guardada',occurrence:'Estado actualizado',archive:'Archivo actualizado'})[e.action]||e.action)+'</b> · '+esc(e.actor)+'<br><small>'+esc(new Date(e.created_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))+(e.scheduled_on?' · '+esc(display(e.scheduled_on)):'')+(e.detail?.state?' · '+esc(TASK_STATES[e.detail.state]||e.detail.state):'')+'</small></p>').join(''):'<p>Sin cambios registrados.</p>',null);}catch(e){error(e);}});
  dialog.querySelector('[data-task="edit"]')?.addEventListener('click',()=>edit(r));
  dialog.querySelector('[data-task="source"]')?.addEventListener('click',()=>{close();onSource(r.source);});
  dialog.querySelector('[data-task="archive"]')?.addEventListener('click',async()=>{if(busy)return;if(!await confirm('¿Archivar esta tarea y sus próximas ocasiones? El historial se conserva.'))return;busy=true;try{await command('archive',{task_id:r.task_id,task_version:r.task_version});close();await refresh();}catch(e){error(e);}finally{busy=false;}});
 }
 async function click(e){
  const b=e.target.closest('[data-task]');if(!b||busy)return;
  try{const action=b.dataset.task;
   if(action==='archived'){
    modal('Tareas archivadas',(data.archived_tasks||[]).length?(data.archived_tasks||[]).map(t=>'<div class="summary-row"><span>'+esc(t.title)+'</span>'+(t.can_manage?btn('Recuperar','restore','data-id="'+esc(t.task_id)+'"'):'')+'</div>').join(''):'<p>No hay tareas archivadas.</p>',null);
    dialog.querySelectorAll('[data-task="restore"]').forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;try{const t=data.archived_tasks.find(t=>t.task_id===b.dataset.id);await command('archive',{task_id:t.task_id,task_version:t.task_version,archived:false});close();await refresh();}catch(e){error(e);}finally{busy=false;}});return;
   }
   if(action==='new'||action==='day-new'){edit(null,null,b.dataset.date);return;}
   if(action==='detail'){const r=row(b.dataset.id,b.dataset.date);if(r)detail(r);return;}
   if(action==='view')view=b.dataset.view;
   else if(action==='today')anchor=taskToday();
   else if(action==='prev'||action==='next'){const n=action==='prev'?-1:1;if(view==='week')anchor=addTaskDays(anchor,n*7);else{const d=new Date(anchor.slice(0,7)+'-01T12:00Z');d.setUTCMonth(d.getUTCMonth()+n);anchor=d.toISOString().slice(0,10);}}
   else if(action==='mine')filter.person=actor();
   else if(action==='clear')filter={store:'',person:'',status:'',query:''};
   else if(action==='filter'){host.querySelectorAll('[data-filter]').forEach(x=>filter[x.dataset.filter]=x.value);paint();return;}
   busy=true;await refresh();
  }catch(e){error(e);}finally{busy=false;}
 }
 return {async mount(el){host=el;host.addEventListener('click',click);await refresh();timer=setInterval(()=>{if(host&&!busy&&!dialog&&document.visibilityState==='visible')refresh().catch(error);},30000);},
  dispose(){++epoch;clearInterval(timer);host?.removeEventListener('click',click);host=null;close();},
  reset(){this.dispose();anchor=taskToday();view='month';filter={store:'',person:'',status:'',query:''};data={rows:[],stores:[],people:[]};},
  async fromMessage(message){const existing=await rpc('totus_task_from_message',{p_message:message.id});if(existing){anchor=existing.scheduled_on;await refresh();const r=row(existing.task_id,existing.scheduled_on);if(r)detail(r);}else{if(!data.people.length)await refresh();edit(null,message);}},
  hasDraft(){return dialog?.dataset.dirty==='true';}
 };
}
