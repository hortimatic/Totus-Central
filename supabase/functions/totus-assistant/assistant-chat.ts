// Chat operations run exclusively as the assistant's own authenticated Supabase user.
// Reuse Totus' existing chat RPCs: no direct inserts, privileged fallback or membership changes.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkActor(context:any,user:any) {
 const actor=String(user?.email||'').toLowerCase();
 if(!['chatgpt@totuscentral.invalid','codex@totuscentral.invalid'].includes(actor)||context?.actor!==actor)throw new Error('Sesión de ChatGPT o Codex no válida para el chat');
 return actor;
}

export async function readTeamChat(client:any,payload:any,user:any) {
 const id=payload?.channel_id;
 if(id!==undefined&&id!==null&&!uuid.test(id))throw new Error('Canal no válido');
 const before=payload?.before;
 if(before!==undefined&&before!==null&&(!Number.isSafeInteger(before)||before<1))throw new Error('Paginación no válida');
 const query=payload?.query??'';
 if(typeof query!=='string'||query.length>200)throw new Error('Búsqueda no válida');
 const {data,error}=await client.rpc('totus_chat_context',{
  p_channel:id||null,p_before:before??null,p_query:query
 });
 if(error||!data)throw new Error('No se pudo consultar el chat con la sesión propia: '+(error?.message||'sin respuesta'));
 checkActor(data,user);
 if(id&&!data.channels?.some((c:any)=>c.id===id))throw new Error('El canal no está disponible');
 return {actor:data.actor,channels:data.channels,members:data.members,messages:data.messages};
}

export async function sendTeamChat(client:any,payload:any,user:any) {
 const {channel_id,client_id,body}=payload||{};
 if(!uuid.test(channel_id||'')||!uuid.test(client_id||''))throw new Error('Canal e identificador de envío obligatorios');
 if(typeof body!=='string'||!body.trim()||body.trim().length>12000)throw new Error('Mensaje no válido');
 const context=await readTeamChat(client,{channel_id},user);
 const channel=context.channels?.find((c:any)=>c.id===channel_id);
 const actor=checkActor(context,user);
 if(!channel||channel.archived||channel.deleted_at||!['direct','channel'].includes(channel.channel_kind))
  throw new Error('Solo se permite escribir en canales de equipo activos y conversaciones directas');
 if(!context.members?.some((m:any)=>m.email===actor))throw new Error((actor==='codex@totuscentral.invalid'?'Codex':'ChatGPT')+' no es miembro del canal');
 if(channel.channel_kind==='direct') {
  const target=String(payload.target_email||'').trim().toLowerCase();
  if(!target||target===actor||context.members.length!==2||
     !context.members.some((m:any)=>m.email===target))throw new Error('El destinatario no corresponde a esta conversación directa');
 } else if(payload.target_email)throw new Error('No indiques destinatario en un canal de equipo');
 const message=body.trim();
 const {data:sent,error}=await client.rpc('totus_chat_command',{
  p_action:'send',p_data:{channel_id,client_id,body:message,expected_files:0}
 });
 if(error||!sent?.id)throw new Error('Envío rechazado por Totus: '+(error?.message||'sin identificador'));
 const {data:confirmed,error:readError}=await client.from('ops_chat_messages')
  .select('id,channel_id,client_id,author_email,body').eq('id',sent.id).single();
 if(readError||!confirmed||confirmed.channel_id!==channel_id||confirmed.client_id!==client_id||
  confirmed.author_email!==actor||confirmed.body!==message)
  throw new Error('Envío posiblemente guardado: relee el mensaje antes de repetir con el mismo client_id');
 return {persisted:true,verified:true,message_id:confirmed.id,channel_id,client_id};
}
