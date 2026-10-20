
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const origin='https://hortimatic.github.io';
const redirect=url+'/functions/v1/totus-onedrive/callback';
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
 let resolved=path;
 if(path!=='/me/drive/special/approot'){
  const c=await config();
  if(!c.app_folder_id)throw new Error('Falta la carpeta autorizada de la aplicación.');
  resolved='/me/drive/items/'+encodeURIComponent(c.app_folder_id)+path.slice('/me/drive/special/approot'.length);
 }
 const r=await fetch('https://graph.microsoft.com/v1.0'+resolved,{...options,headers:{Authorization:'Bearer '+access,...options.headers},signal:AbortSignal.timeout(20000),redirect:'manual'});
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
 return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OneDrive conectado</title><h1>OneDrive conectado</h1><p>Vuelve a TotusCentral → Administración → Almacenamiento y pulsa Actualizar conexión.</p><p>No se han trasladado documentos ni cambiado las copias actuales.</p></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}});
}
async function folder(access:string,name:string){
 const path='/me/drive/special/approot:/'+encodeURIComponent(name);
 let r=await graph(access,path);
 if(r.status===404)r=await graph(access,'/me/drive/special/approot/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});
 if(!r.ok){const detail=await r.json().catch(()=>({}));const code=String(detail?.error?.code||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);throw new Error('No se pudo preparar la carpeta de prueba (HTTP '+r.status+(code?' · '+code:'')+').');}
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

const fileHash=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
const cleanPart=(value:string)=>String(value||'').normalize('NFKC').replace(/[\\/:*?"<>|\x00-\x1f#%]/g,'-').replace(/\s+/g,' ').replace(/[. ]+$/g,'').trim().slice(0,90)||'Sin nombre';
const encodedPath=(parts:string[])=>parts.map(encodeURIComponent).join('/');
async function ensurePath(access:string,parts:string[],known:Set<string>){
 for(let i=1;i<=parts.length;i++){
  const key=parts.slice(0,i).join('/');
  if(known.has(key))continue;
  const itemPath='/me/drive/special/approot:/'+encodedPath(parts.slice(0,i));
  let r=await graph(access,itemPath);
  if(r.status===404){
   const parent=parts.slice(0,i-1);
   const children=parent.length?'/me/drive/special/approot:/'+encodedPath(parent)+':/children':'/me/drive/special/approot/children';
   r=await graph(access,children,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:parts[i-1],folder:{},'@microsoft.graph.conflictBehavior':'fail'})});
   if(r.status===409)r=await graph(access,itemPath);
  }
  if(!r.ok)throw new Error('No se pudo organizar la carpeta de documentos (HTTP '+r.status+').');
  const item=await r.json();if(!item.folder)throw new Error('Hay un archivo ocupando el nombre de una carpeta.');
  known.add(key);
 }
}
async function readContent(access:string,path:string){
 let r=await graph(access,path);
 if(r.status===302){
  const next=r.headers.get('Location');
  if(!next||new URL(next).protocol!=='https:')throw new Error('Descarga no segura de Microsoft.');
  r=await fetch(next,{signal:AbortSignal.timeout(20000),redirect:'error'});
 }
 if(!r.ok)throw new Error('No se pudo comprobar el documento copiado (HTTP '+r.status+').');
 return await r.arrayBuffer();
}

async function inventoryRows(table:string,columns:string,key:string){
 const rows:any[]=[];
 for(let offset=0;offset<100000;offset+=1000){
  const page=check(await admin.from(table).select(columns).order(key).range(offset,offset+999),'No se pudo consultar el inventario completo.');
  rows.push(...page);if(page.length<1000)return rows;
 }
 throw new Error('El inventario supera el límite de seguridad; no se mostrará incompleto.');
}

async function mirrorSummary(){
 const documents=await inventoryRows('ops_documents','id,storage_path,size_bytes,sha256','id');
 const copied=await inventoryRows('ops_onedrive_documents','document_id,source_path,size_bytes,sha256','document_id');
 
 const index=new Map(copied.map((r:any)=>[r.document_id,r]));
 const matches=(d:any)=>{const c:any=index.get(d.id);return !!c&&c.source_path===d.storage_path&&Number(c.size_bytes)===Number(d.size_bytes)&&(!d.sha256||d.sha256===c.sha256);};
 const pending=documents.filter((d:any)=>d.storage_path&&!matches(d));
 return {total:documents.filter((d:any)=>d.storage_path).length,verified:documents.filter((d:any)=>d.storage_path&&matches(d)).length,pending:pending.length,pending_ids:pending.map((d:any)=>d.id),verified_bytes:copied.filter((c:any)=>documents.some((d:any)=>d.id===c.document_id&&matches(d))).reduce((s:number,c:any)=>s+Number(c.size_bytes),0)};
}
async function mirrorDocuments(){
 const c=await config();if(!c.connected||!c.tested_at)throw new Error('Primero comprueba el guardado y lectura de OneDrive.');
 const access=await token();await root(access);
 const summary=await mirrorSummary();
 const ids=summary.pending_ids.slice(0,5);
 if(!ids.length)return {copied:0,total:summary.total,verified:summary.verified,pending:0};
 const documents=check(await admin.from('ops_documents').select('*').in('id',ids).order('id'),'No se pudieron leer los documentos pendientes.');
 const known=new Set<string>();let count=0;const deadline=Date.now()+80000;
 const types:Record<string,string>={factura_recibida:'Facturas de proveedores',factura_rectificativa:'Abonos y rectificativas',informe:'Informes',impuesto:'Impuestos',proforma:'Proformas',otro:'Otros documentos'};
 for(const doc of documents){
  if(count&&Date.now()>deadline)break;
  if(Number(doc.size_bytes)>20*1024*1024)throw new Error('Un documento supera el límite de copia por lote de 20 MB. Sus originales siguen en Supabase.');
  const source=check(await admin.storage.from('business-documents').download(doc.storage_path),'No se pudo leer un original de Supabase.');
  const bytes=await source.arrayBuffer(),digest=await fileHash(bytes);
  if(bytes.byteLength!==Number(doc.size_bytes))throw new Error('El tamaño del original no coincide con su ficha. No se ha retirado ningún archivo.');
  if(doc.sha256&&doc.sha256!==digest)throw new Error('La huella del original no coincide con su ficha.');
  const date=String(doc.document_date||'');
  const year=/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(0,4):'Sin fecha';
  const month=year==='Sin fecha'?'Sin mes':date.slice(5,7);
  const parts=['01 Documentos',year,types[doc.doc_type]||'Otros documentos',month];
  await ensurePath(access,parts,known);
  const name=cleanPart((date||'Sin fecha')+' '+(doc.supplier_or_customer||'Documento')+' '+(doc.invoice_number||''))+' - '+doc.id+' - '+cleanPart(doc.original_name||'archivo');
  const relative=[...parts,name],path='/me/drive/special/approot:/'+encodedPath(relative)+':/content';
  const write=await graph(access,path,{method:'PUT',headers:{'Content-Type':doc.mime_type||'application/octet-stream'},body:bytes});
  if(!write.ok)throw new Error('No se pudo copiar un documento en OneDrive (HTTP '+write.status+').');
  const item=await write.json(),actual=await readContent(access,path);
  if(actual.byteLength!==bytes.byteLength||await fileHash(actual)!==digest)throw new Error('La copia no coincide con el original. Se conserva el original.');
  const latest=check(await admin.from('ops_documents').select('storage_path,size_bytes,sha256').eq('id',doc.id).maybeSingle(),'No se pudo volver a comprobar el documento.');
  if(!latest||latest.storage_path!==doc.storage_path||Number(latest.size_bytes)!==bytes.byteLength||(latest.sha256&&latest.sha256!==digest))throw new Error('El documento cambió durante la copia; vuelve a comprobarlo.');
  check(await admin.from('ops_onedrive_documents').upsert({document_id:doc.id,source_path:doc.storage_path,onedrive_path:relative.join('/'),onedrive_item_id:item.id,size_bytes:bytes.byteLength,sha256:digest,verified_at:new Date().toISOString()},{onConflict:'document_id'}),'No se pudo registrar la copia verificada.');
  count++;
 }
 const after=await mirrorSummary();
 return {copied:count,total:after.total,verified:after.verified,pending:after.pending,verified_bytes:after.verified_bytes};
}


async function runDocumentMirror(){
 const at=new Date().toISOString(),lease=new Date(Date.now()+180000).toISOString();
 const claimed=check(await admin.from('ops_onedrive_config').update({mirror_lock_until:lease,mirror_last_attempt:at,mirror_last_error:null}).eq('id',1).or('mirror_lock_until.is.null,mirror_lock_until.lt.'+at).select('id').maybeSingle(),'No se pudo reservar el lote documental.');
 if(!claimed)throw new Error('Ya hay una copia de documentos en curso. Actualiza su estado en unos minutos.');
 try{
  const result=await mirrorDocuments();
  check(await admin.from('ops_onedrive_config').update({mirror_last_error:null}).eq('id',1),'No se pudo actualizar el resultado.');
  return result;
 }catch(error){
  await admin.from('ops_onedrive_config').update({mirror_last_error:error instanceof Error?error.message:'No se pudo copiar el lote.'}).eq('id',1);
  throw error;
 }finally{
  await admin.from('ops_onedrive_config').update({mirror_lock_until:null}).eq('id',1).eq('mirror_lock_until',lease);
 }
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  const requestUrl=new URL(req.url);
  if(requestUrl.pathname.endsWith('/callback')){
   if(req.method!=='POST')return json({error:'Método no permitido.'},405);
   return await callback(req);
  }
  if(req.method!=='POST')return json({error:'Método no permitido.'},405);
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return json({error:'Origen no autorizado.'},403);
  const body=await req.json().catch(()=>({})),action=String(body.action||'status');
  const jobKey=req.headers.get('x-totus-backup-job')||'';
  if(jobKey){
   const allowed=await admin.rpc('totus_backup_cron_authorized',{p_key:jobKey});
   if(allowed.error||allowed.data!==true||action!=='mirror-documents')throw new Error('Acceso denegado.');
   const result=await runDocumentMirror();
   if(result.copied)check(await admin.from('ops_audit_log').insert({user_id:null,user_email:'Tarea automática',area:'administracion',action:'onedrive_documentos_copiados',detail:{conexion:'OneDrive',copiados:result.copied,pendientes:result.pending}}),'No se pudo registrar el lote automático.');
   return json(result);
  }
  const user=await administrator(req);
  if(action==='status'){
   const c=await config(),configured=!!await secret('read_client');
   const {pending_ids,...mirror}=await mirrorSummary();
   return json({configured,connected:c.connected,folder_url:c.app_folder_url,tested_at:c.tested_at,test_sha256:c.test_sha256,client_id:c.client_id,redirect_uri:redirect,scope:scopes,mirror:{...mirror,last_error:c.mirror_last_error,last_attempt:c.mirror_last_attempt,running:!!c.mirror_lock_until&&new Date(c.mirror_lock_until).getTime()>Date.now()}});
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
  if(action==='mirror-documents'){const result=await runDocumentMirror();await audit(user.id,user.email||'','onedrive_documentos_copiados');return json(result);}
  if(action==='test'){const result=await test();await audit(user.id,user.email||'','onedrive_prueba_verificada');return json(result);}
  return json({error:'Acción no disponible.'},400);
 }catch(e){
  const message=e instanceof Error?e.message:'No se pudo completar la conexión.';
  return json({error:message},message==='Acceso denegado.'?403:400);
 }
});
