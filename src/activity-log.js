// Only bounded operational metadata; no form values, filenames or document content.
export function createActivityLog({rpc,actor,onState=()=>{}}){
 let lastRoute='',lastOwner='',pending=[],running=false,lost=false;
 async function flush(){
  if(running)return false;running=true;
  try{
   while(pending.length){
    const event=pending[0];if(actor()!==event.owner){pending.shift();continue;}
    try{await rpc('totus_record_activity',event.args);}
    catch{if(actor()===event.owner)onState('Registro de actividad pendiente: '+pending.length+' '+(pending.length===1?'evento':'eventos')+'. No se ha confirmado el envío al historial de navegación. Se reintenta cada 30 segundos mientras la sesión está abierta; este aviso no confirma ni invalida el guardado de una ficha.');return false;}
    if(pending[0]===event)pending.shift();
   }
   if(!lost)onState('');return true;
  }finally{running=false;}
 }
 function record(area,action,reference=null){
  const owner=actor();if(!owner)return Promise.resolve(false);
  if(pending.length>=100){lost=true;onState('No se ha podido confirmar toda la actividad reciente. Revisa la conexión antes de continuar.');return Promise.resolve(false);}
  pending.push({owner,args:{p_area:area,p_action:action,p_reference:reference,p_expected_actor:owner,p_event:crypto.randomUUID()}});return flush();
 }
 return {record,retry:flush,navigate(area,section=''){
  const owner=actor(),key=area+':'+section;
  if(owner===lastOwner&&key===lastRoute)return;
  lastOwner=owner;lastRoute=key;return record(area,section?'abrir_seccion':'abrir_modulo',section||null);
 },reset(){lastRoute='';lastOwner='';pending=[];lost=false;}};
}
