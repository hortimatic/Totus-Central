// REN-01: ephemeral browser-only timings. Never record query arguments, responses, URLs or users.
const entries=[];
const ALLOWED=/^(?:sesion|usuario_y_perfil|carga_principal|arranque_completo|retiradas_documentales|almacenamiento|auditoria|pintado_inicio|login_manual|core:[a-z_]+|audit:[a-z_]+)$/;
let active=false,ready=false,origin=0,kind='';

const tick=()=>performance.now();
const ms=value=>Math.round(Math.max(0,Number.isFinite(value)?value:0)*10)/10;
function add(phase,duration,status='ok'){
 if(!ALLOWED.test(phase)||entries.length>=100)return;
 entries.push({phase,ms:ms(duration),status:status==='error'?'error':'ok'});
}

export function beginStartupTiming(mode='sesion_recuperada'){
 entries.length=0;active=true;ready=false;origin=tick();
 kind=mode==='login_manual'?'login_manual':'sesion_recuperada';
 if(kind==='sesion_recuperada'){
  const navigation=performance.getEntriesByType?.('navigation')?.[0];
  if(navigation)add('documento_html',navigation.responseEnd-navigation.startTime);
  // Time until boot begins includes blocking libraries and the static ES module graph.
  // Do not infer which resource consumed it without Resource Timing.
  entries.push({phase:'documento_a_inicio_js',ms:ms(origin),status:'ok'});
  const resources=performance.getEntriesByType?.('resource')||[];
  const known=[
   ['biblioteca_supabase',/\/npm\/@supabase\/supabase-js@/],
   ['biblioteca_excel',/\/npm\/xlsx-js-style@/],
   ['biblioteca_zip',/\/npm\/jszip@/],
   ['modulo_app',/\/src\/app\.js(?:\?|$)/]
  ];
  for(const [label,match] of known){
   const resource=resources.find(entry=>match.test(entry.name||''));
   if(resource)entries.push({phase:label,ms:ms(resource.duration),status:'ok'});
  }
 }
}
export async function timedStartup(phase,operation){
 if(!active)return operation();
 const start=tick();let status='ok';
 try{
  const value=await operation();
  if(phase==='almacenamiento'&&value?.status==='error')status='error';
  return value;
 }catch(error){status='error';throw error}
 finally{if(active)add(phase,tick()-start,status)}
}
export function finishStartupTiming(status='ok'){
 if(!active)return;
 add('arranque_completo',tick()-origin,status);
 // Completed data only; never export partial timings from a different session.
 active=false;ready=true;
}
export function clearStartupTiming(){active=false;ready=false;kind='';entries.length=0;}
export function startupTimingReport(){
 if(!ready)return '';
 // Only labels, duration and status. No timestamps, account details, response bodies or resource names.
 return ['Totus Central · REN-01','Tipo: '+kind,'Duraciones en ms (fases paralelas pueden solaparse)',
  ...entries.map(item=>item.phase+': '+item.ms.toFixed(1)+' ms'+(item.status==='error'?' [error]':''))
 ].join('\n');
}
