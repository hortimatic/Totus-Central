import {chat,normalizeChatResponse} from './cloudflare.js';
import {safeEndpoint,connectionTarget,connectionHeaders,boundedJson,connectionOutputLimit} from '../totus-connections/transport.js';
export function providerValidationHint(data){
 const e=data?.error||data,allowed=new Set(['tool_use_failed','invalid_request_error','invalid_request','model_not_found','context_length_exceeded','unsupported_value','tool_choice','max_tokens','max_completion_tokens','messages','tools','model','temperature','reasoning_effort','tool_calls','tool_call_id','name','content','arguments','role','body','missing','string_type','list_type','extra_forbidden','literal_error']);
 const hints=[e?.code,e?.param,e?.type].filter(v=>allowed.has(v));
 for(const item of (Array.isArray(data?.detail)?data.detail:[]).slice(0,4)){if(allowed.has(item.type))hints.push(item.type);for(const part of item.loc||[])if(allowed.has(part))hints.push(part);}
 const message=typeof e==='string'?e:typeof e?.message==='string'?e.message:typeof data?.detail==='string'?data.detail:'';
 if(/tool[ _-]?call[\s\S]{0,100}(?:id|identifier)[\s\S]{0,100}(?:invalid|length|character|match|found)|(?:invalid|missing)[\s\S]{0,60}tool[ _-]?call[ _-]?id/i.test(message))hints.push('tool_call_identifier');
 if(/(?:content|message)[\s\S]{0,70}(?:null|empty|non.empty|at least)/i.test(message))hints.push('message_content_validation');
 if(/(?:too many|maximum|limit)[\s\S]{0,60}(?:tool calls|messages)/i.test(message))hints.push('conversation_shape');
 if(/tool[\s\S]{0,100}(?:valid|schema|argument)|(?:valid|schema)[\s\S]{0,100}tool/i.test(message))hints.push('tool_argument_validation');
 if(/context[\s\S]{0,60}(?:length|size|limit)|(?:input|prompt)[\s\S]{0,60}tokens[\s\S]{0,60}(?:maximum|limit|exceed)/i.test(message))hints.push('context_size');
 if(/tokens per minute|\bTPM\b/i.test(message))hints.push('tokens por minuto');
 if(/tokens per day|\bTPD\b/i.test(message))hints.push('tokens por día');
 if(/requests per minute|\bRPM\b/i.test(message))hints.push('peticiones por minuto');
 if(/requests per day|\bRPD\b/i.test(message))hints.push('peticiones por día');
 return [...new Set(hints)].join(' / ');
}
function anthropicMessages(messages){const output=[];for(const m of messages){if(m.role==='system')continue;const role=m.role==='assistant'?'assistant':'user';let content=[];if(m.role==='tool')content.push({type:'tool_result',tool_use_id:m.tool_call_id,content:m.content});else{if(m.content)content.push({type:'text',text:String(m.content)});for(const call of m.tool_calls||[])content.push({type:'tool_use',id:call.id,name:call.function.name,input:JSON.parse(call.function.arguments)});}if(!content.length)continue;if(output.at(-1)?.role===role)output.at(-1).content.push(...content);else output.push({role,content});}return output;}
export async function providerChat(connection,{messages,tools,toolChoice,request=fetch,resolve=undefined}){
 const c=connection;if(!c.enabled||!c.free_confirmed||!c.real_data_authorized||c.verified_revision!==c.revision)throw Error('El proveedor no está activado y verificado para datos de trabajo.');
 if(c.protocol==='cloudflare')return chat({account:c.account_id,token:c.secret,model:c.model,maxTokens:connectionOutputLimit(c),messages,tools,toolChoice,request});
 if(!['openai_compatible','anthropic'].includes(c.protocol))throw Error('Este tipo de conexión no ejecuta las acciones de Totus IA.');
 const endpoint=await safeEndpoint(connectionTarget(c),resolve),headers={...connectionHeaders(c),'Content-Type':'application/json'};
 const body=c.protocol==='anthropic'?{model:c.model,max_tokens:connectionOutputLimit(c),system:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),messages:anthropicMessages(messages),tools:tools.map(t=>({name:t.function.name,description:t.function.description,input_schema:t.function.parameters})),tool_choice:typeof toolChoice==='object'?{type:'tool',name:toolChoice.function.name}:{type:'auto'}}:{model:c.model,messages,tools,tool_choice:toolChoice,max_tokens:connectionOutputLimit(c),temperature:0,stream:false};
 if(c.protocol==='openai_compatible'&&endpoint.hostname==='api.cohere.ai'){
  const names=new Map(messages.flatMap(m=>(m.tool_calls||[]).map(call=>[call.id,call.function?.name])));
  body.messages=messages.map(m=>{if(m.role!=='tool')return m;const name=names.get(m.tool_call_id);if(!name)throw Error('Resultado de herramienta sin llamada original.');return {...m,name};});
 }
 if(c.protocol==='openai_compatible'&&endpoint.hostname==='api.groq.com'){
  // These turns return tool arguments or a short chat answer, never the document bytes.
  body.max_tokens=connectionOutputLimit(c);
  if(c.model.startsWith('openai/gpt-oss-'))Object.assign(body,{reasoning_effort:'low'});
 }
 const response=await request(endpoint.href,{method:'POST',headers,body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!response.ok){let info='',generationRejected=false;if([400,413,422,429].includes(response.status)){try{const data=await boundedJson(response,16384),hint=providerValidationHint(data);generationRejected=response.status===400&&data?.error?.code==='tool_use_failed';if(hint)info=' · '+hint;}catch{}}else await response.body?.cancel();const retry=Number(response.headers.get('retry-after'));if(response.status===429&&Number.isFinite(retry)&&retry>0&&retry<=86400)info+=' · reintento indicado por el proveedor: '+Math.ceil(retry)+' segundos';throw Object.assign(Error(response.status===429?'Cuota o capacidad del proveedor limitada'+info+'. No se cambiará a un servicio de pago.':'El proveedor rechazó la petición (HTTP '+response.status+')'+info+'.'),generationRejected?{code:'invalid_tool_generation'}:{});}
 const data=await boundedJson(response);
 if(c.protocol==='anthropic')return normalizeChatResponse({usage:{prompt_tokens:data.usage?.input_tokens,completion_tokens:data.usage?.output_tokens},choices:[{finish_reason:data.stop_reason==='max_tokens'?'length':'stop',message:{content:data.content?.filter(x=>x.type==='text').map(x=>x.text).join('')||null,tool_calls:data.content?.filter(x=>x.type==='tool_use').map(x=>({id:x.id,type:'function',function:{name:x.name,arguments:JSON.stringify(x.input)}}))}}]});
 return normalizeChatResponse(data);
}
