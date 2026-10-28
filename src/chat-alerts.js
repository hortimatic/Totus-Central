// Browser-only delivery. No push subscription, API billing or local persistence.
let audio;
export async function prepareChatSound(){
 const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!Audio)throw Error('Este navegador no admite el sonido de aviso.');
 if(!audio||audio.state==='closed')audio=new Audio();
 await audio.resume();
 if(audio.state!=='running')throw Error('Pulsa Probar sonido para permitir el audio en este equipo.');
}
export async function playChatSound(){
 if(!audio||audio.state!=='running')return false;
 const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
 oscillator.type='sine';oscillator.frequency.setValueAtTime(740,now);oscillator.frequency.setValueAtTime(880,now+0.12);
 gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(0.12,now+0.02);gain.gain.linearRampToValueAtTime(0,now+0.3);
 oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+0.32);
 oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};return true;
}
export function chatDesktopStatus(){
 return !globalThis.Notification?'Este navegador no ofrece avisos de escritorio.':Notification.permission==='granted'?'Permiso de este navegador: permitido.':Notification.permission==='denied'?'Permiso bloqueado. Puedes cambiarlo en los permisos del sitio del navegador.':'Permiso pendiente: se pedirá al activar o probar el aviso.';
}
export async function requestChatDesktopPermission(){
 if(!globalThis.Notification)throw Error('Este navegador no admite avisos de escritorio.');
 const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
 if(permission!=='granted')throw Error('Avisos no autorizados. Revisa los permisos del sitio en el navegador.');
}
export function createChatNotifier({rpc,actor,can=()=>true,onCount,onOpen,isReading=()=>false,NotificationClass=globalThis.Notification,sound=playChatSound}){
 let timer=null,owner='',running=false,seen=new Set(),primed=false,preferences={},preferenceVersion=0,epoch=0,notes=new Map();
 const closeNotes=()=>{for(const note of notes.values())note.close();notes.clear();};
 const unlock=()=>{if(preferences.sound_enabled)prepareChatSound().catch(()=>{});};
 async function check(){
  if(!can()){onCount(0,[]);closeNotes();seen.clear();primed=false;return;}
  if(running||!actor())return;
  if(owner!==actor()){owner=actor();seen.clear();primed=false;closeNotes();}
  const checkOwner=owner,stamp=epoch,version=preferenceVersion;running=true;
  try{
   const [messages,context]=await Promise.all([rpc('totus_chat_inbox',{p_mentions:false}),rpc('totus_chat_context',{p_channel:null})]);
   if(stamp!==epoch||checkOwner!==actor()||!can()||!Array.isArray(messages))return;
   if(version===preferenceVersion)preferences=context?.layout||preferences;
   const visible=messages.filter(m=>m.channel_kind!=='assistant'),ids=new Set(visible.map(m=>m.id));
   for(const [id,note] of notes)if(!ids.has(id)||visible.some(m=>m.id===id&&isReading(m))){note.close();notes.delete(id);}
   // The inbox is a bounded preview (100 rows), not the total unread count.
   const channels=Array.isArray(context?.channels)?context.channels:null;
   const unread=channels?channels.filter(c=>c.channel_kind!=='assistant'&&c.member_role&&!c.muted&&!c.archived).reduce((n,c)=>n+Math.max(0,Number(c.notify_level==='mentions'?c.mentions||0:c.unread||0)||0),0):visible.length;
   onCount(unread,visible);
   const fresh=primed?visible.filter(m=>!seen.has(m.id)&&!isReading(m)):[];
   if(fresh.length&&preferences.sound_enabled)await sound().catch(()=>{});
   if(stamp!==epoch||checkOwner!==actor()||!can())return;
   if(NotificationClass?.permission==='granted')for(const message of fresh.filter(m=>preferences.desktop_enabled??m.desktop_enabled).slice(0,5)){
    try{
     const note=new NotificationClass('Totus Central · '+message.channel_name,{body:'Tienes un mensaje nuevo.',tag:'totus-'+message.id,icon:'favicon.svg',silent:true});
     notes.set(message.id,note);note.onclose=()=>notes.delete(message.id);
     note.onclick=()=>{note.close();if(stamp===epoch&&checkOwner===actor()&&can()){window.focus();onOpen(message);}};
    }catch{/* Unsupported delivery must not interrupt unread counts or other channels. */}
   }
   messages.forEach(m=>seen.add(m.id));if(seen.size>2000)seen=new Set(messages.map(m=>m.id));primed=true;
  }catch{if(stamp===epoch&&checkOwner===actor())onCount(null,[]);}finally{if(stamp===epoch)running=false;}
 }
 return {check,setPreferences(value){preferenceVersion++;preferences=value||{};if(preferences.desktop_enabled===false)closeNotes();},start(){clearInterval(timer);document.removeEventListener('pointerdown',unlock);document.addEventListener('pointerdown',unlock);check();timer=setInterval(check,30000);},stop(){epoch++;running=false;clearInterval(timer);document.removeEventListener('pointerdown',unlock);timer=null;owner='';seen.clear();primed=false;preferences={};closeNotes();if(audio){audio.close().catch(()=>{});audio=null;}}};
}
