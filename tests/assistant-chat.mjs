import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const source=readFileSync(new URL('../supabase/functions/totus-assistant/assistant-chat.ts',import.meta.url),'utf8');
const {readTeamChat,sendTeamChat}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const agent={id:'agent-1',email:'chatgpt@totuscentral.invalid'};
const direct='11111111-1111-4111-8111-111111111111';
const group='22222222-2222-4222-8222-222222222222';
const clientId='33333333-3333-4333-8333-333333333333';

function fixture({denied=false,kind='direct',recipient='diego@example.test',member=true,archived=false}={}) {
 const events=[],messages=new Map();
 const channelId=kind==='direct'?direct:group;
 const members=member?[{email:agent.email},{email:recipient}]:[{email:recipient}];
 const channel={id:channelId,channel_kind:kind,archived,deleted_at:null};
 const ctx={actor:agent.email,channels:[channel],members,messages:[{body:'hola'}]};
 const client={
  rpc:async (name,args)=>{
   events.push([name,args]);
   if(name==='totus_chat_context')return denied?{error:{message:'No tienes acceso a este canal.'}}:{data:ctx};
   if(name==='totus_chat_command'){
    if(!member)return {error:{message:'No tienes acceso'}};
    const key=args.p_data.client_id;
    if(!messages.has(key))messages.set(key,{id:'44444444-4444-4444-8444-444444444444',channel_id:channelId,client_id:key,author_email:agent.email,body:args.p_data.body});
    return {data:messages.get(key)};
   }
   throw new Error('Unexpected RPC '+name);
  },
  from:(table)=>{
   assert.equal(table,'ops_chat_messages');
   const q={select(){return q},eq(){return q},single:async()=>({data:[...messages.values()][0]})};
   return q;
  }
 };
 return {client,events,messages,channelId};
}

test('authorized direct sends via normal chat RPC and independently rereads the saved message',async()=>{
 const f=fixture();
 const result=await sendTeamChat(f.client,{channel_id:direct,client_id:clientId,target_email:'diego@example.test',body:'Hola, Diego.'},agent);
 assert.equal(result.persisted,true);assert.equal(result.verified,true);
 assert.deepEqual(f.events.map(e=>e[0]),['totus_chat_context','totus_chat_command']);
 assert.equal(f.messages.size,1);
});

test('the same client_id is idempotent and does not produce two messages',async()=>{
 const f=fixture(),body='Hola, Diego.';
 const p={channel_id:direct,client_id:clientId,target_email:'diego@example.test',body};
 const first=await sendTeamChat(f.client,p,agent), second=await sendTeamChat(f.client,p,agent);
 assert.equal(first.message_id,second.message_id);assert.equal(f.messages.size,1);
});

test('invalid recipient blocks send before writing',async()=>{
 const f=fixture();
 await assert.rejects(sendTeamChat(f.client,{channel_id:direct,client_id:clientId,target_email:'someone@example.test',body:'Hola'},agent),/destinatario/);
 assert(!f.events.some(e=>e[0]==='totus_chat_command'));
});

test('private access denial prevents read and send',async()=>{
 const f=fixture({denied:true});
 await assert.rejects(readTeamChat(f.client,{channel_id:direct},agent),/No se pudo consultar/);
 await assert.rejects(sendTeamChat(f.client,{channel_id:direct,client_id:clientId,target_email:'diego@example.test',body:'Hola'},agent),/No se pudo consultar/);
 assert(!f.events.some(e=>e[0]==='totus_chat_command'));
});

test('not a member blocks chat send',async()=>{
 const f=fixture({member:false});
 await assert.rejects(sendTeamChat(f.client,{channel_id:direct,client_id:clientId,target_email:'diego@example.test',body:'Hola'},agent),/no es miembro/);
});

test('archived channel and assistant channel do not allow sends',async()=>{
 const f=fixture({archived:true});
 await assert.rejects(sendTeamChat(f.client,{channel_id:direct,client_id:clientId,target_email:'diego@example.test',body:'Hola'},agent),/canales de equipo activos/);
 const assistant=fixture({kind:'assistant'});
 await assert.rejects(sendTeamChat(assistant.client,{channel_id:group,client_id:clientId,body:'Hola'},agent),/canales de equipo activos/);
});

test('joined team channel can send, without a fake direct recipient',async()=>{
 const f=fixture({kind:'channel'});
 const result=await sendTeamChat(f.client,{channel_id:group,client_id:clientId,body:'Mensaje autorizado'},agent);
 assert.equal(result.verified,true);
 await assert.rejects(sendTeamChat(f.client,{channel_id:group,client_id:clientId,body:'Mensaje',target_email:'diego@example.test'},agent),/destinatario/);
});

test('non-agent user cannot use assistant chat bridge',async()=>{
 const f=fixture();
 await assert.rejects(readTeamChat(f.client,{channel_id:direct},{email:'other@example.test'}),/Sesión de ChatGPT/);
});

test('bad UUID or oversized text never sends',async()=>{
 const f=fixture();
 await assert.rejects(sendTeamChat(f.client,{channel_id:'wrong',client_id:clientId,body:'hola',target_email:'diego@example.test'},agent),/identificador/);
 await assert.rejects(sendTeamChat(f.client,{channel_id:direct,client_id:clientId,body:'x'.repeat(12001),target_email:'diego@example.test'},agent),/Mensaje no válido/);
 assert(!f.events.some(e=>e[0]==='totus_chat_command'));
});
