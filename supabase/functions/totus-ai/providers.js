import {chat,normalizeChatResponse} from './cloudflare.js';
import {safeEndpoint,connectionTarget,connectionHeaders,boundedJson,connectionOutputLimit} from '../totus-connections/transport.js';
function anthropicMessages(messages){const output=[];for(const m of messages){if(m.role==='system')continue;const role=m.role==='assistant'?'assistant':'user';let content=[];if(m.role==='tool')content.push({type:'tool_result',tool_use_id:m.tool_call_id,content:m.content});else{if(m.content)content.push({type:'text',text:String(m.content)});for(const call of m.tool_calls||[])content.push({type:'tool_use',id:call.id,name:call.function.name,input:JSON.parse(call.function.arguments)});}if(!content.length)continue;if(output.at(-1)?.role===role)output.at(-1).content.push(...content);else output.push({role,content});}return output;}
export async function providerChat(connection,{messages,tools,toolChoice,request=fetch,resolve=undefined}){
 const c=connection;if(!c.enabled||!c.free_confirmed||!c.real_data_authorized||c.verified_revision!==c.revision)throw Error('El proveedor no está activado y verificado para datos de trabajo.');
 if(c.protocol==='cloudflare')return chat({account:c.account_id,token:c.secret,model:c.model,maxTokens:connectionOutputLimit(c),messages,tools,toolChoice,request});
 if(!['openai_compatible','anthropic'].includes(c.protocol))throw Error('Este tipo de conexión no ejecuta las acciones de Totus IA.');
 const endpoint=await safeEndpoint(connectionTarget(c),resolve),headers={...connectionHeaders(c),'Content-Type':'application/json'};
 const body=c.protocol==='anthropic'?{model:c.model,max_tokens:connectionOutputLimit(c),system:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),messages:anthropicMessages(messages),tools:tools.map(t=>({name:t.function.name,description:t.function.description,input_schema:t.function.parameters})),tool_choice:typeof toolChoice==='object'?{type:'tool',name:toolChoice.function.name}:{type:'auto'}}:{model:c.model,messages,tools,tool_choice:toolChoice,max_tokens:connectionOutputLimit(c),temperature:0,stream:false};
 if(c.protocol==='openai_compatible'&&endpoint.hostname==='api.groq.com'){
  // These turns return tool arguments or a short chat answer, never the document bytes.
  body.max_tokens=connectionOutputLimit(c);
  if(c.model.startsWith('openai/gpt-oss-'))Object.assign(body,{reasoning_effort:'low'});
 }
 const response=await request(endpoint.href,{method:'POST',headers,body:JSON.stringify(body),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!response.ok){let info='';if(response.status===400){try{const error=(await boundedJson(response,16384))?.error;const parts=[error?.code,error?.param].filter(v=>['tool_use_failed','invalid_request_error','invalid_request','model_not_found','context_length_exceeded','unsupported_value','tool_choice','max_tokens','max_completion_tokens','messages','tools','model','temperature','reasoning_effort'].includes(v));if(parts.length)info=' · '+parts.join(' / ');}catch{}}else await response.body?.cancel();throw Error(response.status===429?'Cuota o capacidad del proveedor agotada. No se cambiará a un servicio de pago.':'El proveedor rechazó la petición (HTTP '+response.status+')'+info+'.');}
 const data=await boundedJson(response);
 if(c.protocol==='anthropic')return normalizeChatResponse({usage:{prompt_tokens:data.usage?.input_tokens,completion_tokens:data.usage?.output_tokens},choices:[{finish_reason:data.stop_reason==='max_tokens'?'length':'stop',message:{content:data.content?.filter(x=>x.type==='text').map(x=>x.text).join('')||null,tool_calls:data.content?.filter(x=>x.type==='tool_use').map(x=>({id:x.id,type:'function',function:{name:x.name,arguments:JSON.stringify(x.input)}}))}}]});
 return normalizeChatResponse(data);
}
