
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const origin='https://hortimatic.github.io';
const redirect=url+'/functions/v1/totus-onedrive?callback=1';
const scopes='Files.ReadWrite.AppFolder offline_access';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
const check=(r:any,label:string)=>{if(r.error)throw new Error(label);return r.data;};
const encode=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function config(){return check(await admin.from('ops_onedrive_config').select('*').eq('id',1).single(),'No hay configuración de OneDrive.');}
async function secret(action:string,value:string|null=null){return check(await admin.rpc('totus_onedrive_secret',{p_action:action,p_value:value}),'No se pudo acceder a la conexión cifrada.');}
async function administrator(req:Request){
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 if(!jwt)throw new Error('Acceso denegado.');
 const r=await admin.auth.getUser(jwt);
 if(r.error||!r.data.user?.email)throw new Error('Acceso denegado.');
 const staff=check(await admin.from('team_members').select('role,active').ilike('email',r.data.user.email).maybeSingle(),'Acceso denegado.');
 if(staff?.role!=='admin'||staff?.active!==true)throw new Error('Acceso denegado.');
 return r.data.user;
}
async function audit(userId:string,email:string,action:string){
 check(await admin.from('ops_audit_log').insert({user_id:userId,user_email:email,area:'administracion',action,detail:{conexion:'OneDrive',entorno:'staging'}}),'No se pudo registrar la operación de conexión.');
}
async function exchange(values:Record<string,string>){
 const c=await config(),clientSecret=await secret('read_client');
 if(!clientSecret)throw new Error('Falta la credencial de Microsoft.');
 const response=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...values,client_id:c.client_id,client_secret:clientSecret,scope:scopes}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Microsoft no ha autorizado la conexión (HTTP '+response.status+').');
 const t=await response.json();
 if(typeof t.access_token!=='string'||!String(t.scope||'').toLowerCase().includes('files.readwrite.appfolder'))throw new Error('Microsoft no ha confirmado el permiso de la carpeta de aplicación.');
 return t;
}
async function token(){
 const raw=await secret('read_tokens');
 if(!raw)throw new Error('OneDrive no está conectado.');
 const saved=JSON.parse(raw);
 if(saved.expires_at>Date.now()+120000)return saved.access_token;
 if(!saved.refresh_token)throw new Error('Vuelve a autorizar la conexión con Microsoft.');
 const t=await exchange({grant_type:'refresh_token',refresh_token:saved.refresh_token});
 await secret('write_tokens',JSON.stringify({access_token:t.access_token,refresh_token:t.refresh_token||saved.refresh_token,expires_at:Date.now()+Number(t.expires_in)*1000}));
 return t.access_token;
}
async function graph(access:string,path:string,options:RequestInit={}){
 if(!path.startsWith('/me/drive/special/approot'))throw new Error('Operación fuera de la carpeta de aplicación.');
 const r=await fetch('https://graph.microsoft.com/v1.0'+path,{...options,headers:{Authorization:'Bearer '+access,...options.headers},signal:AbortSignal.timeout(20000),redirect:'manual'});
 return r;
}
async function root(access:string){
 const r=await graph(access,'/me/drive/special/approot');
 if(!r.ok)throw new Error('No se puede acceder a la carpeta privada de TotusCentral (HTTP '+r.status+').');
 const folder=await r.json(),c=await config();
 if(!folder.folder||!folder.id||String(folder.parentReference?.driveId||'').toLowerCase()!==c.expected_drive_id.toLowerCase())throw new Error('La cuenta autorizada no coincide con el OneDrive comprobado.');
 return folder;
}
async function callback(req:Request){
 const form=await req.formData();
 const state=String(form.get('state')||'');
 if(!/^[A-Za-z0-9_-]{40,64}$/.test(state))throw new Error('Solicitud de conexión no válida.');
 const stateHash=await hash(state);
 const pending=check(await admin.from('ops_onedrive_oauth_states').delete().eq('state_hash',stateHash).gt('expires_at',new Date().toISOString()).select('*').maybeSingle(),'No se pudo comprobar la conexión.');
 if(!pending)throw new Error('La solicitud ha caducado o ya se utilizó. Inicia de nuevo la conexión.');
 if(form.get('error'))throw new Error('No se ha autorizado OneDrive. Los datos actuales siguen en Supabase.');
 const code=String(form.get('code')||'');if(!code||code.length>10000)throw new Error('Falta la autorización de Microsoft.');
 const t=await exchange({grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:pending.code_verifier});
 const folder=await root(t.access_token);
 if(!t.refresh_token)throw new Error('Microsoft no ha autorizado el acceso automático.');
 await secret('write_tokens',JSON.stringify({access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+Number(t.expires_in)*1000}));
 check(await admin.from('ops_onedrive_config').update({connected:true,drive_id:folder.parentReference.driveId,app_folder_id:folder.id,app_folder_url:folder.webUrl,updated_at:new Date().toISOString()}).eq('id',1),'No se pudo guardar la conexión.');
 await audit(pending.administrator_id,'','onedrive_conectado');
 return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OneDrive conectado</title><h1>OneDrive conectado</h1><p>Vuelve a TotusCentral → Administración → OneDrive y pulsa Actualizar conexión.</p><p>No se han trasladado documentos ni cambiado las copias actuales.</p></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}});
}
async function folder(access:string,name:string){
 const path='/me/drive/special/approot:/'+encodeURIComponent(name);
 let r=await graph(access,path);
 if(r.status===404)r=await graph(access,'/me/drive/special/approot/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});
 if(!r.ok)throw new Error('No se pudo preparar la carpeta de prueba (HTTP '+r.status+').');
 const value=await r.json();if(!value.folder)throw new Error('El nombre de la carpeta de prueba ya lo utiliza un archivo.');
}
async function test(){
 const access=await token(),base=await root(access);
 await folder(access,'90 Pruebas de conexion');
 const path='/me/drive/special/approot:/'+encodeURIComponent('90 Pruebas de conexion')+'/comprobacion-servidor.txt:/content';
 const text='PRUEBA DE CONEXION TOTUSCENTRAL\nSin datos contables ni personales.\nGenerada en el servidor: '+new Date().toISOString()+'\n';
 const write=await graph(access,path,{method:'PUT',headers:{'Content-Type':'text/plain; charset=utf-8'},body:text});
 if(!write.ok)throw new Error('No se pudo guardar la prueba en OneDrive (HTTP '+write.status+').');
 const item=await write.json();
 const download=await graph(access,path);
 let read=download;
 if(download.status===302){
  const location=download.headers.get('Location');
  if(!location||new URL(location).protocol!=='https:')throw new Error('Microsoft no devolvió una descarga segura.');
  read=await fetch(location,{signal:AbortSignal.timeout(20000),redirect:'error'});
 }
 if(!read.ok)throw new Error('No se pudo volver a leer el archivo de prueba.');
 const actual=await read.text();
 if(actual!==text)throw new Error('El archivo leído no coincide con el enviado.');
 const digest=await hash(text),at=new Date().toISOString();
 check(await admin.from('ops_onedrive_config').update({tested_at:at,test_sha256:digest,app_folder_url:base.webUrl,updated_at:at}).eq('id',1),'No se pudo guardar el resultado de la prueba.');
 return {verified:true,tested_at:at,bytes:new TextEncoder().encode(text).length,sha256:digest,file_url:item.webUrl};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  const requestUrl=new URL(req.url);
  if(requestUrl.searchParams.get('callback')==='1'){
   if(req.method!=='POST')return json({error:'Método no permitido.'},405);
   return await callback(req);
  }
  if(req.method!=='POST')return json({error:'Método no permitido.'},405);
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return json({error:'Origen no autorizado.'},403);
  const user=await administrator(req);
  const body=await req.json().catch(()=>({})),action=String(body.action||'status');
  if(action==='status'){
   const c=await config(),configured=!!await secret('read_client');
   return json({configured,connected:c.connected,folder_url:c.app_folder_url,tested_at:c.tested_at,test_sha256:c.test_sha256,client_id:c.client_id,redirect_uri:redirect,scope:scopes});
  }
  if(action==='configure'){
   const value=String(body.client_secret||'');
   if(value.length<16||value.length>4096||/\s/.test(value))throw new Error('Introduce el valor completo de la credencial de Microsoft.');
   if((await config()).connected)throw new Error('La conexión ya está activa; no se modifica su credencial desde esta prueba.');
   await secret('write_client',value);
   await audit(user.id,user.email||'','onedrive_credencial_guardada');
   return json({configured:true});
  }
  if(action==='begin'){
   const c=await config();if(!await secret('read_client'))throw new Error('Primero falta guardar la credencial de Microsoft.');
   const verifier=random(),state=random();
   check(await admin.from('ops_onedrive_oauth_states').delete().lt('expires_at',new Date().toISOString()),'No se pudieron retirar solicitudes caducadas.');
   check(await admin.from('ops_onedrive_oauth_states').insert({state_hash:await hash(state),administrator_id:user.id,code_verifier:verifier,expires_at:new Date(Date.now()+600000).toISOString()}),'No se pudo preparar la solicitud.');
   const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   const auth=new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize');
   auth.search=new URLSearchParams({client_id:c.client_id,response_type:'code',redirect_uri:redirect,response_mode:'form_post',scope:scopes,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'consent'}).toString();
   return json({authorization_url:auth.toString()});
  }
  if(action==='test'){const result=await test();await audit(user.id,user.email||'','onedrive_prueba_verificada');return json(result);}
  return json({error:'Acción no disponible.'},400);
 }catch(e){
  const message=e instanceof Error?e.message:'No se pudo completar la conexión.';
  return json({error:message},message==='Acceso denegado.'?403:400);
 }
});
