import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {testConnection,boundedJson} from './transport.js';
const headers={'Access-Control-Allow-Origin':'https://hortimatic.github.io','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const check=(r:any)=>{if(r.error)throw Error(r.error.message||'Operación rechazada.');return r.data;};
export async function handle(req:Request,env=Deno.env,factory:any=createClient,request:any=fetch){
 const respond=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});if(req.method==='OPTIONS')return respond({});if(req.method!=='POST')return respond({error:'Método no permitido'},405);
 let admin:any,input:any,started=false;
 try{
  input=await boundedJson(req,4096);
  if(input.action!=='test'||!/^[-a-f0-9]{36}$/i.test(input.id||'')||!/^[-a-f0-9]{36}$/i.test(input.call_id||'')||!Number.isSafeInteger(input.revision))throw Error('Solicitud no válida.');
  const url=env.get('SUPABASE_URL')||'',key=JSON.parse(env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||env.get('SUPABASE_ANON_KEY')||'',secret=JSON.parse(env.get('SUPABASE_SECRET_KEYS')||'{}').default||env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const bearer=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!bearer)return respond({error:'Inicia sesión para probar conexiones.'},401);
  const options={auth:{persistSession:false,autoRefreshToken:false}},auth=factory(url,key,options);const user=check(await auth.auth.getUser(bearer)).user;if(!user)return respond({error:'Sesión no válida.'},401);
  const scoped=factory(url,key,{...options,global:{headers:{Authorization:'Bearer '+bearer}}}),context=check(await scoped.rpc('totus_api_manager',{}));
  if(!context.connections?.some((c:any)=>c.id===input.id&&c.revision===input.revision))throw Error('Actualiza la conexión antes de probar.');
  admin=factory(url,secret,options);const connection=check(await admin.rpc('totus_api_server',{p_id:input.id,p_revision:input.revision}));
  check(await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id}));started=true;
  const result=await testConnection(connection,{request});
  check(await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id,p_result:result}));started=false;
  return respond(result);
 }catch(e){if(started&&admin){await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id,p_result:{ok:false}}).catch(()=>{});}return respond({error:e instanceof Error?e.message:'No se pudo probar la conexión.'},400);}
}
if(import.meta.main)Deno.serve(req=>handle(req));
