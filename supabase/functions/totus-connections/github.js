import {boundedJson,connectionHeaders} from './transport.js';
export function githubRepository(connection){
 const u=new URL(connection.endpoint||'https://api.github.com');
 if(u.origin!=='https://api.github.com'||u.search||u.hash||u.username||u.password||!/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(u.pathname))throw Error('Configura el repositorio autorizado: https://api.github.com/repos/organizacion/repositorio.');
 return u.origin+u.pathname.replace(/\/$/,'');
}
export async function readGithubFile(connection,input,request=fetch){
 if(connection.protocol!=='github'||!connection.enabled||connection.verified_revision!==connection.revision||!connection.free_confirmed||!connection.real_data_authorized)throw Error('La conexión GitHub debe estar probada, activada y autorizada.');
 const path=String(input.path||''),ref=String(input.ref||'');
 if(!/^[A-Za-z0-9_./-]{1,240}$/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||/\.(env|pem|key|pfx|zip|pdf|xlsx|csv)$/i.test(path)||!(/^(src|tests|docs|supabase\/functions|supabase\/review_patches)\//.test(path)||['index.html','README.md'].includes(path)))throw Error('Ruta de código no admitida. No se leen credenciales ni documentos contables.');
 if(ref&&!/^[A-Za-z0-9_./-]{1,120}$/.test(ref))throw Error('Revisión de GitHub no válida.');
 const endpoint=githubRepository(connection)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+(ref?'?ref='+encodeURIComponent(ref):'');
 const response=await request(endpoint,{headers:connectionHeaders(connection),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('GitHub rechazó la lectura (HTTP '+response.status+').');}
 const data=await boundedJson(response,393216);
 if(data.type!=='file'||data.path!==path||data.encoding!=='base64'||typeof data.content!=='string'||!Number.isSafeInteger(data.size)||data.size>262144||!/^[a-f0-9]{40}$/.test(data.sha||''))throw Error('GitHub no devolvió un archivo de código completo.');
 const bytes=Uint8Array.from(atob(data.content.replace(/\s/g,'')),c=>c.charCodeAt(0));if(bytes.length!==data.size)throw Error('El contenido de GitHub está incompleto.');
 return {repository:githubRepository(connection).split('/repos/')[1],path,ref:ref||'default',sha:data.sha,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),read_only:true};
}
