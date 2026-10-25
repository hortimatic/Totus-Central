// Dates are civil dates in Madrid; recurrence never depends on the device timezone.
export const TASK_STATES={pending:'Pendiente',working:'En curso',done:'Completada',cancelled:'Cancelada'};
export const TASK_PRIORITIES={normal:'Normal',high:'Alta',low:'Baja'};
export function taskToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());}
export function taskDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new Error('Fecha no válida.');return value;}
export function addTaskDays(date,n){const d=new Date(taskDate(date)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function taskRange(anchor,view='month'){
 taskDate(anchor);const d=new Date(anchor+'T12:00:00Z');
 if(view==='week'){const from=addTaskDays(anchor,-((d.getUTCDay()+6)%7));return {from,to:addTaskDays(from,6)};}
 const first=anchor.slice(0,7)+'-01',from=addTaskDays(first,-((new Date(first+'T12:00:00Z').getUTCDay()+6)%7));
 d.setUTCMonth(d.getUTCMonth()+1,0);const last=d.toISOString().slice(0,10);
 return {from,to:addTaskDays(last,6-((d.getUTCDay()+6)%7))};
}
export function taskMatches(task,date){
 taskDate(date);if(date<task.starts_on||(task.ends_on&&date>task.ends_on))return false;
 const days=Math.round((Date.parse(date+'T12:00Z')-Date.parse(task.starts_on+'T12:00Z'))/86400000),every=Number(task.repeat_every)||1;
 if(task.repeat_kind==='once')return days===0;
 if(task.repeat_kind==='daily')return days%every===0;
 if(task.repeat_kind==='weekly')return Math.floor(days/7)%every===0&&(task.weekdays||[]).includes(new Date(date+'T12:00Z').getUTCDay());
 if(task.repeat_kind==='monthly'){const a=task.starts_on.split('-').map(Number),b=date.split('-').map(Number),months=(b[0]-a[0])*12+b[1]-a[1];return months%every===0&&b[2]===Math.min(task.month_day||a[2],new Date(Date.UTC(b[0],b[1],0)).getUTCDate());}
 return false;
}
export function taskInput(v){
 const title=String(v.title||'').trim(),description=String(v.description||'').trim(),starts_on=taskDate(v.starts_on),ends_on=v.ends_on?taskDate(v.ends_on):null;
 if(!title||title.length>160||description.length>12000)throw new Error('Revisa el título y la descripción.');
 if(ends_on&&ends_on<starts_on)throw new Error('La fecha de fin debe ser posterior al inicio.');
 const repeat_kind=v.repeat_kind||'once',repeat_every=Number(v.repeat_every||1);
 if(!['once','daily','weekly','monthly'].includes(repeat_kind)||!Number.isInteger(repeat_every)||repeat_every<1||repeat_every>365)throw new Error('Repetición no válida.');
 const weekdays=[...new Set((v.weekdays||[]).map(Number))].sort();
 if(repeat_kind==='weekly'&&(!weekdays.length||weekdays.some(x=>!Number.isInteger(x)||x<0||x>6)))throw new Error('Elige los días de la semana.');
 const checklist=Array.isArray(v.checklist)?v.checklist:String(v.checklist||'').split('\n').map(x=>x.trim()).filter(Boolean);
 if(checklist.length>30||checklist.some(x=>typeof x!=='string'||!x.trim()||x.length>300))throw new Error('Máximo 30 pasos de 300 caracteres.');
 if(repeat_kind==='weekly'&&ends_on&&!Array.from({length:7},(_,i)=>addTaskDays(starts_on,i)).some(d=>d<=ends_on&&weekdays.includes(new Date(d+'T12:00Z').getUTCDay())))throw new Error('No hay ningún día de tarea entre las fechas elegidas.');
 return {title,description,starts_on,ends_on,repeat_kind,repeat_every,weekdays,checklist,priority:v.priority||'normal',store_id:v.store_id||null,assigned_email:String(v.assigned_email||'').trim().toLowerCase()||null};
}
export function taskVisibleRows(rows,{store='',person='',status='',query=''}={}){
 const q=query.trim().toLocaleLowerCase('es');return rows.filter(r=>(!store||r.store_id===store)&&(!person||r.assigned_email===person)&&(!status||r.state===status)&&(!q||(r.title+' '+r.description+' '+(r.assigned_email||'')).toLocaleLowerCase('es').includes(q)));
}
