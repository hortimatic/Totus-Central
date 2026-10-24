// Pure chat rules. A message is never an accounting entry.
export const CHAT_GROUPS=['Equipo','Hortimatic','NewOldSmok','Totuscode'];
export const CHAT_REACTIONS=['👍','✅','👀','❤️'];
export const CHAT_TASK_STATES={pending:'Pendiente',working:'En curso',done:'Terminado'};
export function chatText(value,max=12000){
 const text=String(value??'').replace(/\r\n?/g,'\n').trim();
 if(!text||text.length>max)throw new Error('Escribe un texto de entre 1 y '+max+' caracteres.');
 return text;
}
export function chatChannelInput(input){
 const name=chatText(input.name,80),group=chatText(input.group_name||'Equipo',80);
 return {name,group_name:group,description:String(input.description||'').trim().slice(0,500),is_private:input.is_private===true,store_id:input.store_id||null};
}
export function chatDateRange(from='',to=''){
 for(const date of [from,to])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))throw new Error('Fecha no válida.');
 if(from&&to&&from>to)throw new Error('La fecha inicial debe ser anterior a la final.');
 return {from,to};
}
export function chatMessageMatches(message,{query='',from='',to='',pinned=false,tasks=false}={}){
 const day=String(message.created_at||'').slice(0,10);
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 return (!from||day>=from)&&(!to||day<=to)&&(!pinned||message.pinned)&&(!tasks||message.task_state)&&(!query||norm(message.body+' '+message.author_email).includes(norm(query)));
}
export function chatGroups(channels){
 return [...new Set([...CHAT_GROUPS,...channels.map(c=>c.group_name)])].map(name=>({name,channels:channels.filter(c=>c.group_name===name).sort((a,b)=>a.name.localeCompare(b.name,'es'))})).filter(g=>g.channels.length);
}
export function chatTaskPrompt(channel,message){
 return 'Trabaja con Totus Central desde sus conexiones autorizadas.\nCanal: '+channel.name+'\nIdentificador del canal: '+channel.id+'\nMensaje: '+message.id+'\nEncargo:\n'+message.body+'\n\nConsulta el contexto y los documentos con sus permisos. Comprueba duplicados. No conviertas este mensaje directamente en contabilidad ni inventes datos. Usa los procedimientos de guardado existentes. Deja el resultado y los enlaces a los registros afectados; solo entonces marca la tarea terminada. No hay un asistente automático activo en este canal.';
}
