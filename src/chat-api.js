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
export {createChatNotifier} from './chat-alerts.js';
