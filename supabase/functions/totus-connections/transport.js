import {managementApiPreset} from '../../../src/api-presets.js';
const bad4=ip=>{const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true;return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&(p[1]===168||p[1]===0))||(p[0]===198&&(p[1]===18||p[1]===19||p[1]===51))||(p[0]===203&&p[1]===0&&p[2]===113);};
export function publicAddress(ip){if(ip.includes(':'))return /^[23][0-9a-f]{0,3}:/i.test(ip)&&!/^2001:(?:db8|0|10):/i.test(ip)&&!/^2002:/i.test(ip);return !bad4(ip);}
export async function safeEndpoint(value,resolve=async(host,type)=>Deno.resolveDns(host,type)){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||(u.port&&u.port!=='443'))throw Error('Usa HTTPS en el puerto 443, sin credenciales en la dirección.');
 if([...u.searchParams.keys()].some(k=>/^(key|api_key|apikey|token|access_token|authorization|client_secret|password|secret)$/i.test(k)))throw Error('Guarda la clave en su campo privado, no en la dirección.');
 const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();if(host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.localhost'))throw Error('No se permiten direcciones locales.');
 const literal=host.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(host);
 const addresses=literal?[host]:(await Promise.allSettled(['A','AAAA'].map(t=>resolve(host,t)))).flatMap(r=>r.status==='fulfilled'?r.value:[]);
 if(!addresses.length||addresses.some(ip=>!publicAddress(ip)))throw Error('El destino debe resolver únicamente a direcciones públicas.');return u;
}
export async function boundedJson(response,max=2097152){if(Number(response.headers.get('content-length'))>max)throw Error('La respuesta supera el límite permitido.');const reader=response.body?.getReader();if(!reader)throw Error('Respuesta vacía.');let total=0,parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw Error('La respuesta supera el límite permitido.');}parts.push(value);}}finally{reader.releaseLock();}const all=new Uint8Array(total);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length;}try{return JSON.parse(new TextDecoder().decode(all));}catch{throw Error('Respuesta JSON no válida del proveedor.');}}
export function connectionTarget(c){
 if(c.protocol==='cloudflare'){if(!/^[a-f0-9]{32}$/.test(c.account_id||''))throw Error('Cuenta no válida.');return 'https://api.cloudflare.com/client/v4/accounts/'+c.account_id+'/ai/v1/chat/completions';}
 if(c.protocol==='github')return 'https://api.github.com/user';
 if(c.protocol==='anthropic')return 'https://api.anthropic.com/v1/messages';
 if(c.protocol==='gemini'){if(!/^[A-Za-z0-9._-]+$/.test(c.model||''))throw Error('Modelo no válido.');return 'https://generativelanguage.googleapis.com/v1beta/models/'+c.model+':generateContent';}
 const u=new URL(c.endpoint);if(c.protocol==='openai_compatible')u.pathname=u.pathname.replace(/\/$/,'')+'/chat/completions';if(c.protocol==='prestashop'){u.pathname=u.pathname.replace(/\/$/,'')+'/';u.searchParams.set('output_format','JSON');}return u.href;
}
export function connectionHeaders(c){
 const h={'Accept':'application/json'};if((c.auth_kind!=='none'||['cloudflare','anthropic','gemini','prestashop','github'].includes(c.protocol))&&!c.secret)throw Error('Falta la clave privada.');
 if(c.protocol==='cloudflare'||c.auth_kind==='bearer')h.Authorization='Bearer '+c.secret;
 if(c.protocol==='prestashop'||c.auth_kind==='basic')h.Authorization='Basic '+btoa(String.fromCharCode(...new TextEncoder().encode(c.protocol==='prestashop'?c.secret+':':c.secret)));
 if(c.auth_kind==='header'){if(!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(c.auth_header)||/^(host|content-length|cookie|connection|forwarded|x-forwarded-for)$/i.test(c.auth_header))throw Error('Cabecera no permitida.');h[c.auth_header]=c.secret;}
 if(c.protocol==='anthropic'){delete h.Authorization;h['x-api-key']=c.secret;h['anthropic-version']='2023-06-01';}
 if(c.protocol==='gemini'){delete h.Authorization;h['x-goog-api-key']=c.secret;}
 if(c.protocol==='github')h['X-GitHub-Api-Version']='2022-11-28';return h;
}
export async function testConnection(c,{request=fetch,resolve}={}){
 if(!c.free_confirmed)throw Error('Confirma el plan gratuito antes de probar.');
 const destination=connectionTarget(c);const consolePreset=managementApiPreset(destination);if(consolePreset)throw Error('Esa dirección es la consola de '+consolePreset.label+', no su API. En Configurar aplica el acceso de '+consolePreset.label+' y comprueba su modelo.');const target=await safeEndpoint(destination,resolve),headers=connectionHeaders(c),ai=['cloudflare','openai_compatible','anthropic','gemini'].includes(c.protocol);let body;
 if(ai){headers['Content-Type']='application/json';body=c.protocol==='gemini'?{contents:[{parts:[{text:'Prueba ficticia: responde exclusivamente 10.'}]}],generationConfig:{maxOutputTokens:64,temperature:0}}:c.protocol==='anthropic'?{model:c.model,max_tokens:64,system:'Prueba ficticia: eres una calculadora. Responde exclusivamente con el resultado numérico, sin palabras.',messages:[{role:'user',content:'4 + 6'}]}:{model:c.model,messages:[{role:'system',content:'Prueba ficticia: eres una calculadora. Responde exclusivamente con el resultado numérico, sin palabras.'},{role:'user',content:'4 + 6'}],max_tokens:c.model?.includes('gpt-oss')?512:64,temperature:0,stream:false};}
 const start=Date.now(),response=await request(target.href,{method:ai?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error(response.status===429?'Cuota o capacidad del proveedor agotada.':'El proveedor rechazó la prueba (HTTP '+response.status+').');}
 if(!ai){if(/(?:text\/html|application\/xhtml)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('El destino devuelve una página web, no una respuesta de API. Revisa el tipo de conexión y su dirección.');}if(['prestashop','github'].includes(c.protocol)){const result=await boundedJson(response,131072);if(c.protocol==='github'?!(Number.isSafeInteger(result.id)&&typeof result.login==='string'):(!result||typeof result!=='object'||Array.isArray(result)||!Object.keys(result).length))throw Error('El servicio respondió, pero no devolvió el formato esperado.');}else await response.body?.cancel();return {ok:true,status:response.status,latency_ms:Date.now()-start};}
 const data=await boundedJson(response,131072),text=c.protocol==='gemini'?data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(''):c.protocol==='anthropic'?data.content?.filter(p=>p.type==='text').map(p=>p.text).join(''):data.choices?.[0]?.message?.content;
 if(String(text||'').trim()!=='10')throw Error('El proveedor respondió, pero no completó la prueba ficticia esperada.');
 const usage=data.usage||data.usageMetadata||{},integer=(...values)=>values.find(v=>Number.isSafeInteger(v)&&v>=0)??null;
 return {ok:true,status:response.status,latency_ms:Date.now()-start,input_tokens:integer(usage.prompt_tokens,usage.input_tokens,usage.promptTokenCount),output_tokens:integer(usage.completion_tokens,usage.output_tokens,usage.candidatesTokenCount)};
}
