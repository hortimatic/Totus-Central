import {sb} from './api.js';
import {SUPABASE_URL,SUPABASE_KEY} from './config.js';
export async function requestChatFile(action,values={}){
 const session=(await sb.auth.getSession()).data.session;
 if(!session)throw new Error('Vuelve a iniciar sesión para trabajar con los adjuntos.');
 const response=await fetch(SUPABASE_URL+'/functions/v1/totus-onedrive',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action,...values}),signal:AbortSignal.timeout(90000)});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||'No se pudo completar el archivo del chat.');}
 if(response.headers.get('Content-Type')?.includes('application/json'))return response.json();
 return response.blob();
}
export function subscribeChat(channelId,onChange){
 if(!channelId||typeof sb.channel!=='function')return ()=>{};
 const channel=sb.channel('totus-chat-'+crypto.randomUUID());
 for(const table of ['ops_chat_messages','ops_chat_files','ops_chat_agent_requests','ops_chat_members'])
  channel.on('postgres_changes',{event:'*',schema:'public',table,filter:'channel_id=eq.'+channelId},onChange);
 channel.subscribe();
 return ()=>{sb.removeChannel(channel).catch(()=>{});};
}
export function createChatNotifier({rpc,actor,can=()=>true,onCount,onOpen,NotificationClass=globalThis.Notification}){
 let timer=null,owner='',running=false,seen=new Set(),primed=false;
 async function check(){
  if(!can()){onCount(0,[]);return;}
  if(running||!actor()||document.visibilityState!=='visible')return;
  if(owner!==actor()){owner=actor();seen.clear();primed=false;}
  const checkOwner=owner;running=true;
  try{
   const messages=await rpc('totus_chat_inbox',{p_mentions:false});
   if(checkOwner!==actor()||!Array.isArray(messages))return;
   onCount(messages.length,messages);
   if(primed&&NotificationClass?.permission==='granted'){
    for(const message of messages.filter(m=>m.desktop_enabled&&!seen.has(m.id)).slice(0,5)){
     const note=new NotificationClass('Totus Central · '+message.channel_name,{body:'Tienes un mensaje nuevo.',tag:'totus-'+message.id,icon:'favicon.svg'});
     note.onclick=()=>{window.focus();onOpen(message);note.close();};
    }
   }
   messages.forEach(m=>seen.add(m.id));if(seen.size>2000)seen=new Set(messages.map(m=>m.id));primed=true;
  }catch{onCount(null,[]);}finally{running=false;}
 }
 return {check,start(){clearInterval(timer);check();timer=setInterval(check,30000);},stop(){clearInterval(timer);timer=null;owner='';seen.clear();primed=false;}};
}
