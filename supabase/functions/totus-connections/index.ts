import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {testConnection,boundedJson} from './transport.js';
const headers={'Access-Control-Allow-Origin':'https://hortimatic.github.io','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const check=(r:any)=>{if(r.error)throw Error(r.error.message||'Operación rechazada.');return r.data;};
export async function handle(req:Request,env=Deno.env,factory:any=createClient,request:any=fetch){
 const respond=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});if(req.method==='OPTIONS')return respond({});if(req.method!=='POST')return respond({error:'Método no permitido'},405);
 let admin:any,input:any,started=false;
 try{
  input=await boundedJson(req,4096);
  const uuid=(v:any)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);if(!['test','create_actor'].includes(input.action)||input.action==='test'&&(!uuid(input.id)||!uuid(input.call_id)||!Number.isSafeInteger(input.revision))||input.action==='create_actor'&&(!uuid(input.request_id)||typeof input.name!=='string'||typeof input.role!=='string'))throw Error('Solicitud no válida.');
  const url=env.get('SUPABASE_URL')||'',key=JSON.parse(env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||env.get('SUPABASE_ANON_KEY')||'',secret=JSON.parse(env.get('SUPABASE_SECRET_KEYS')||'{}').default||env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const bearer=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!bearer)return respond({error:'Inicia sesión para probar conexiones.'},401);
  const options={auth:{persistSession:false,autoRefreshToken:false}},auth=factory(url,key,options);const user=check(await auth.auth.getUser(bearer)).user;if(!user)return respond({error:'Sesión no válida.'},401);
  const scoped=factory(url,key,{...options,global:{headers:{Authorization:'Bearer '+bearer}}}),context=check(await scoped.rpc('totus_api_manager',{}));
  if(input.action==='create_actor'){
   admin=factory(url,secret,options);const password=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');const prepared=check(await admin.rpc('totus_api_prepare_actor',{p_id:input.request_id,p_owner:user.id,p_name:input.name,p_role:input.role,p_password:password}));if(prepared.complete)return respond({ok:true,actor:prepared.actor});
   const credentials=prepared.credentials;await admin.auth.admin.createUser({email:credentials.email,password:credentials.password,email_confirm:true,app_metadata:{totus_integration:true,totus_provision_id:input.request_id},user_metadata:{full_name:prepared.name}});
   const actor=check(await admin.rpc('totus_api_finish_actor',{p_id:input.request_id,p_owner:user.id}));return respond({ok:true,actor});
  }
  if(!context.connections?.some((c:any)=>c.id===input.id&&c.revision===input.revision))throw Error('Actualiza la conexión antes de probar.');
  admin=factory(url,secret,options);const connection=check(await admin.rpc('totus_api_server',{p_id:input.id,p_revision:input.revision}));
  check(await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id}));started=true;
  const result=await testConnection(connection,{request});
  check(await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id,p_result:result}));started=false;
  return respond(result);
 }catch(e){if(started&&admin){try{await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id,p_result:{ok:false,verification_failed:true}});}catch{}}return respond({error:e instanceof Error?e.message:'No se pudo probar la conexión.'},400);}
}
if(import.meta.main)Deno.serve(req=>handle(req));
