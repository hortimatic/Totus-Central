import {createTeamChatFiles} from './team-chat-files.js';
import {createDocumentRemovalWorker} from './document-removal-worker.js';
import {importStockDocument} from './stock-import.js';
import {credentialAlertSettings} from '../../../src/connection-maintenance.js';
import {renewMicrosoftCredential} from './credential-renewal.js';
import {createBackupDocumentLinks} from './backup-source-links.js';
import {backupRetentionCount} from '../../../src/backup-retention.js';
import {createDirectBackupTransfer} from './backup-transfer.js';
import {validateBackupIndex} from '../../../src/backup-index.js';

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
 check(await admin.from('ops_audit_log').insert({user_id:userId,user_email:email,area:'administracion',action,detail:{conexion:'OneDrive',entorno:'production'}}),'No se pudo registrar la operación de conexión.');
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
 // Test reversible movement using this synthetic file only, then return it
 // to its original location. No business document is moved by this check.
 await ensurePath(access,['90 Pruebas de conexion','Archivo de pruebas'],new Set<string>());
 const testFolderResponse=await graph(access,'/me/drive/special/approot:/'+encodedPath(['90 Pruebas de conexion','Archivo de pruebas']));
 if(!testFolderResponse.ok)throw new Error('No se pudo preparar la prueba de archivo recuperable.');
 const testFolder=await testFolderResponse.json();
 const movedName='comprobacion-'+Date.now()+'.txt';
 const originalItemPath=path.replace(/:\/content$/,'');
 const moved=await graph(access,originalItemPath,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:movedName,parentReference:{id:testFolder.id},'@microsoft.graph.conflictBehavior':'fail'})});
 if(!moved.ok||(await moved.json()).id!==item.id)throw new Error('No se pudo comprobar el traslado recuperable del archivo de prueba.');
 const movedPath='/me/drive/special/approot:/'+encodedPath(['90 Pruebas de conexion','Archivo de pruebas',movedName]);
 const archivedBytes=await readContent(access,movedPath+':/content');
 if(new TextDecoder().decode(archivedBytes)!==text)throw new Error('La prueba de archivo recuperable no conserva el contenido.');
 const originalFolderResponse=await graph(access,'/me/drive/special/approot:/'+encodedPath(['90 Pruebas de conexion']));
 if(!originalFolderResponse.ok)throw new Error('No se pudo volver a abrir la carpeta de pruebas.');
 const originalFolder=await originalFolderResponse.json();
 const restored=await graph(access,movedPath,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'comprobacion-servidor.txt',parentReference:{id:originalFolder.id},'@microsoft.graph.conflictBehavior':'fail'})});
 if(!restored.ok||(await restored.json()).id!==item.id)throw new Error('La prueba se conserva archivada; no se pudo devolver a su carpeta de pruebas.');
 if(new TextDecoder().decode(await readContent(access,path))!==text)throw new Error('No se pudo comprobar la lectura final de la prueba.');
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
 const removals=check(await admin.rpc('totus_pending_document_removals'),'No se pudieron comprobar las retiradas documentales.');
 if(!Array.isArray(removals))throw new Error('Estado de retiradas documentales no válido.');
 const retiring=new Set(removals.map((row:any)=>row.id));
 const documents=(await inventoryRows('ops_documents','id,storage_path,size_bytes,sha256','id')).filter((row:any)=>!retiring.has(row.id));
 const copied=await inventoryRows('ops_onedrive_documents','document_id,source_path,size_bytes,sha256','document_id');
 
 const index=new Map(copied.map((r:any)=>[r.document_id,r]));
 const matches=(d:any)=>{const c:any=index.get(d.id);return !!c&&c.source_path===d.storage_path&&Number(c.size_bytes)===Number(d.size_bytes)&&(!d.sha256||d.sha256===c.sha256);};
 const pending=documents.filter((d:any)=>d.storage_path&&!matches(d));
 return {total:documents.filter((d:any)=>d.storage_path).length,verified:documents.filter((d:any)=>d.storage_path&&matches(d)).length,pending:pending.length,pending_ids:pending.map((d:any)=>d.id),verified_bytes:copied.filter((c:any)=>documents.some((d:any)=>d.id===c.document_id&&matches(d))).reduce((s:number,c:any)=>s+Number(c.size_bytes),0)};
}
async function mirrorOneDocument(access:string,doc:any,known:Set<string>){
 const types:Record<string,string>={factura_recibida:'Facturas de proveedores',factura_rectificativa:'Abonos y rectificativas',informe:'Informes',impuesto:'Impuestos',proforma:'Proformas',otro:'Otros documentos'};
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
}

async function mirrorDocuments(){
 const c=await config();if(!c.connected||!c.tested_at)throw new Error('Primero comprueba el guardado y lectura de OneDrive.');
 const access=await token();await root(access);
 const summary=await mirrorSummary();
 const ids=summary.pending_ids.slice(0,5);
 if(!ids.length)return {copied:0,total:summary.total,verified:summary.verified,pending:0};
 const documents=check(await admin.from('ops_documents').select('*').in('id',ids).order('id'),'No se pudieron leer los documentos pendientes.');
 const known=new Set<string>();let count=0;const deadline=Date.now()+80000;
 for(const doc of documents){
  if(count&&Date.now()>deadline)break;
  await mirrorOneDocument(access,doc,known);
  count++;
 }
 const after=await mirrorSummary();
 return {copied:count,total:after.total,verified:after.verified,pending:after.pending,verified_bytes:after.verified_bytes};
}



async function verifyDocumentRemovalArchive(requested:any){
 const doc=check(await admin.from('ops_documents').select('*').eq('id',requested.id).maybeSingle(),'No se pudo comprobar el documento que se retira.');
 if(!doc)return {id:requested.id,status:'already_removed'};
 if(doc.storage_path!==requested.storage_path||(doc.sha256||'')!==(requested.sha256||''))throw new Error('El original cambió; no se ha retirado otro archivo.');
 const c=await config();if(!c.connected||!c.tested_at)throw new Error('Conecta y comprueba OneDrive antes de retirar el documento.');
 const access=await token();await root(access);
 let mirrored=check(await admin.from('ops_onedrive_documents').select('*').eq('document_id',doc.id).maybeSingle(),'No se pudo comprobar el original recuperable.');
 if(!mirrored?.verified_at||mirrored.source_path!==doc.storage_path||Number(mirrored.size_bytes)!==Number(doc.size_bytes)||(doc.sha256&&mirrored.sha256!==doc.sha256)){
  await mirrorOneDocument(access,doc,new Set<string>());
  mirrored=check(await admin.from('ops_onedrive_documents').select('*').eq('document_id',doc.id).maybeSingle(),'No se pudo registrar el original recuperable.');
 }
 if(!mirrored?.onedrive_path||!mirrored.onedrive_item_id||!/^[a-f0-9]{64}$/.test(mirrored.sha256||''))throw new Error('No existe un original recuperable verificado.');
 const path='/me/drive/special/approot:/'+encodedPath(mirrored.onedrive_path.split('/'));
 const response=await graph(access,path);
 if(!response.ok||(await response.json()).id!==mirrored.onedrive_item_id)throw new Error('El archivo de OneDrive no coincide con su registro. No se ha completado la retirada.');
 const bytes=await readContent(access,path+':/content'),digest=await fileHash(bytes);
 if(bytes.byteLength!==Number(doc.size_bytes)||digest!==mirrored.sha256||(doc.sha256&&digest!==doc.sha256))throw new Error('El archivo recuperable está dañado. No se ha retirado el original.');
 return check(await admin.rpc('totus_verify_document_removal_archive',{p_id:doc.id,p_path:doc.storage_path,p_sha256:doc.sha256||'',p_archive_item_id:mirrored.onedrive_item_id,p_archive_sha256:digest}),'No se pudo confirmar el archivo recuperable.');
}
async function cleanupPendingDocumentRemovals(){
 const worker=createDocumentRemovalWorker({
  rpc:async(name:string,args:Record<string,unknown>)=>check(await admin.rpc(name,args).abortSignal(AbortSignal.timeout(15000)),'No se pudo completar la retirada documental.'),
  verifyArchive:verifyDocumentRemovalArchive,
  removeFile:async(bucket:string,path:string)=>{
   const files=admin.storage.from(bucket);
   check(await files.remove([path]),'No se pudo retirar el archivo de Supabase.');
   const slash=path.lastIndexOf('/'),folder=slash<0?'':path.slice(0,slash),name=path.slice(slash+1);
   const remaining=check(await files.list(folder,{search:name,limit:100,offset:0}),'No se pudo comprobar la retirada del archivo.');
   if(!Array.isArray(remaining)||remaining.length>=100||remaining.some((file:any)=>file.name===name))throw new Error('El archivo sigue en Supabase. Se conserva su ficha para reintentar.');
  }
 });
 return await worker();
}
async function cleanupRetiredDocuments(){
 const rows=check(await admin.from('ops_onedrive_cleanup').select('*').is('archived_at',null).order('created_at').limit(5),'No se pudo leer el archivo de documentos retirados.');
 if(!rows.length)return {archived:0,kept:0,failed:0};
 const access=await token();await root(access);
 const folderName='99 Archivo de documentos retirados';
 await ensurePath(access,[folderName],new Set<string>());
 const folderResponse=await graph(access,'/me/drive/special/approot:/'+encodedPath([folderName]));
 if(!folderResponse.ok)throw new Error('No se pudo abrir el archivo de documentos retirados.');
 const folder=await folderResponse.json();
 let archived=0,kept=0,failed=0;
 for(const row of rows){
  try{
   const current=check(await admin.from('ops_onedrive_documents').select('document_id').eq('onedrive_path',row.onedrive_path).limit(1),'No se pudo comprobar si el archivo sigue en uso.');
   let destination=row.onedrive_path,resolution='preserved_in_use';
   if(current?.length){kept++;}
   else{
    const name=cleanPart(row.id+' - '+row.onedrive_path.split('/').pop());
    destination=folderName+'/'+name;
    const archivedPath='/me/drive/special/approot:/'+encodedPath(destination.split('/'));
    let itemResponse=await graph(access,archivedPath);
    if(itemResponse.status===404){
     const originalPath='/me/drive/special/approot:/'+encodedPath(row.onedrive_path.split('/'));
     const originalResponse=await graph(access,originalPath);
     if(!originalResponse.ok||(await originalResponse.json()).id!==row.onedrive_item_id)throw new Error('El archivo retirado no coincide con su registro. No se ha movido otro archivo.');
     itemResponse=await graph(access,originalPath,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,parentReference:{id:folder.id},'@microsoft.graph.conflictBehavior':'fail'})});
    }
    if(!itemResponse.ok||(await itemResponse.json()).id!==row.onedrive_item_id)throw new Error('OneDrive no confirmó el archivo recuperable.');
    if(row.sha256){
     const bytes=await readContent(access,archivedPath+':/content');
     if(bytes.byteLength!==Number(row.size_bytes)||await fileHash(bytes)!==row.sha256)throw new Error('El archivo conservado no supera la comprobación de integridad.');
    }
    resolution='archived';archived++;
   }
   check(await admin.from('ops_onedrive_cleanup').update({archived_at:new Date().toISOString(),archived_path:destination,resolution,last_error:null}).eq('id',row.id),'No se pudo registrar el archivo recuperable.');
  }catch(error){
   failed++;
   await admin.from('ops_onedrive_cleanup').update({attempts:Number(row.attempts||0)+1,last_error:error instanceof Error?error.message:'No se pudo archivar el documento.'}).eq('id',row.id);
  }
 }
 return {archived,kept,failed};
}

async function runDocumentMirror(removalsOnly=false){
 const at=new Date().toISOString(),lease=new Date(Date.now()+180000).toISOString();
 const claimed=check(await admin.from('ops_onedrive_config').update({mirror_lock_until:lease,mirror_last_attempt:at,mirror_last_error:null}).eq('id',1).or('mirror_lock_until.is.null,mirror_lock_until.lt.'+at).select('id').maybeSingle(),'No se pudo reservar el lote documental.');
 if(!claimed)throw new Error('Ya hay una copia de documentos en curso. Actualiza su estado en unos minutos.');
 try{
  const removals=await cleanupPendingDocumentRemovals();
  const cleanup=await cleanupRetiredDocuments();
  const result={...(removalsOnly?{copied:0}:await mirrorDocuments()),cleanup,removals};
  check(await admin.from('ops_onedrive_config').update({mirror_last_error:cleanup.failed||removals.failed?'Hay retiradas pendientes de completar. Se reintentarán automáticamente.':null}).eq('id',1),'No se pudo actualizar el resultado.');
  return result;
 }catch(error){
  await admin.from('ops_onedrive_config').update({mirror_last_error:error instanceof Error?error.message:'No se pudo copiar el lote.'}).eq('id',1);
  throw error;
 }finally{
  await admin.from('ops_onedrive_config').update({mirror_lock_until:null}).eq('id',1).eq('mirror_lock_until',lease);
 }
}



async function driveQuota(){
 try{
  const access=await token();
  const response=await fetch('https://graph.microsoft.com/v1.0/me/drive?$select=quota',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)return {available:false};
  const value=(await response.json()).quota;
  if(!value||!Number.isSafeInteger(value.total)||value.total<=0||!Number.isSafeInteger(value.used)||!Number.isSafeInteger(value.remaining))return {available:false};
  return {available:true,total:value.total,used:value.used,remaining:value.remaining,measured_at:new Date().toISOString()};
 }catch{return {available:false};}
}

async function savedBackupMaximum(){
 const c=check(await admin.from('ops_backup_config').select('retention_days').eq('id',1).single(),'No se pudo consultar el número de copias.');
 return backupRetentionCount(c.retention_days);
}
async function backupMirrorSummary(){
 const rows=check(await admin.from('ops_onedrive_backups').select('run_id,archive_size,total_files,verified_at,created_at,ops_backup_runs(status)').order('created_at',{ascending:false}),'No se pudo consultar la copia de seguridad en OneDrive.');
 return {maximum:await savedBackupMaximum(),verified:rows.filter((r:any)=>r.verified_at&&r.ops_backup_runs?.status==='success').length,pending:rows.filter((r:any)=>!r.verified_at&&['running','success'].includes(r.ops_backup_runs?.status)).length,bytes:rows.filter((r:any)=>r.verified_at&&r.ops_backup_runs?.status==='success').reduce((n:number,r:any)=>n+Number(r.archive_size),0)};
}
async function storedBytes(bucket:string,path:string,maximum:number){
 const blob=check(await admin.storage.from(bucket).download(path),'No se pudo leer un archivo de la copia original.');
 if(blob.size>maximum)throw new Error('La copia antigua no está dividida en fragmentos seguros. Crea una copia completa actual antes de trasladarla.');
 return await blob.arrayBuffer();
}
async function uploadAndVerify(access:string,relative:string[],bytes:ArrayBuffer,expected:string){
 const path='/me/drive/special/approot:/'+encodedPath(relative)+':/content';
 const write=await graph(access,path,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});
 if(!write.ok)throw new Error('No se pudo guardar un fragmento de la copia (HTTP '+write.status+').');
 const item=await write.json(),actual=await readContent(access,path);
 if(actual.byteLength!==bytes.byteLength||await fileHash(actual)!==expected)throw new Error('Un fragmento de OneDrive no coincide con la copia original.');
 return item;
}

async function pruneMirroredBackups(access:string){
 const keep=await savedBackupMaximum();
 const copies=check(await admin.from('ops_onedrive_backups').select('run_id,source_path,folder_path,verified_at,created_at,ops_backup_runs(started_at,status,storage_path)'),'No se pudo comprobar la conservación en OneDrive.');
 const jobs=check(await admin.from('ops_recovery_jobs').select('checkpoint_path,source_path'),'No se pudieron comprobar las copias protegidas.');
 const protectedPaths=new Set(jobs.flatMap((j:any)=>[j.checkpoint_path,j.source_path]).filter(Boolean));
 copies.sort((a:any,b:any)=>String(b.ops_backup_runs?.started_at||'').localeCompare(String(a.ops_backup_runs?.started_at||'')));
 const active=copies.filter((c:any)=>c.verified_at&&c.ops_backup_runs?.status==='success');
 const kept=new Set(active.slice(0,keep).map((c:any)=>c.run_id));
 for(const old of copies){
  const state=old.ops_backup_runs?.status;
  if(state==='running'||!['success','expired','failed'].includes(state))continue;
  if(!old.verified_at&&(state==='success'||Date.now()-Date.parse(old.created_at)<15*60*1000))continue;
  if(kept.has(old.run_id)||protectedPaths.has(old.source_path||old.ops_backup_runs?.storage_path))continue;
  if(!active.some((c:any)=>c.run_id!==old.run_id&&kept.has(c.run_id)))continue; // Keep at least one verified active cloud copy.
  if(!old.folder_path.startsWith('02 Copias de seguridad/'))throw new Error('Ruta de copia no válida para conservación.');
  const path='/me/drive/special/approot:/'+encodedPath(old.folder_path.split('/'));
  if(state==='success')check(await admin.from('ops_backup_runs').update({status:'expired',storage_path:null}).eq('id',old.run_id).eq('status','success'),'No se pudo retirar la referencia antigua; se conserva el archivo.');
  const removed=await graph(access,path,{method:'DELETE'});
  if(!removed.ok&&removed.status!==404)throw new Error('No se pudo retirar una copia antigua de OneDrive.');
  check(await admin.from('ops_onedrive_backups').delete().eq('run_id',old.run_id),'No se pudo actualizar la conservación en OneDrive.');
 }
}

async function mirrorBackups(){
 const keep=await savedBackupMaximum();
 const c=await config();if(!c.connected||!c.tested_at)throw new Error('Comprueba primero la conexión de OneDrive.');
 const runs=check(await admin.from('ops_backup_runs').select('id,storage_path,size_bytes,archive_sha256,archive_manifest,started_at').eq('status','success').not('storage_path','is',null).not('archive_sha256','is',null).order('started_at',{ascending:false}).limit(keep),'No se pudieron consultar las copias completas.');
 let run:any=null;
 for(const candidate of runs){
  if(candidate.archive_manifest?.version!==3)continue;
  const saved=check(await admin.from('ops_onedrive_backups').select('verified_at,archive_sha256').eq('run_id',candidate.id).maybeSingle(),'No se pudo comprobar el estado de la copia.');
  if(!saved?.verified_at||saved.archive_sha256!==candidate.archive_sha256){run=candidate;break;}
 }
 if(!run){await pruneMirroredBackups(await token());return {copied:0,complete:true,...await backupMirrorSummary()};}
 const indexBytes=await storedBytes('business-backups',run.storage_path,8*1024*1024);
 let parts:any[]=[];
 const segmented=new Uint8Array(indexBytes)[0]===123;
 if(segmented){
  if(indexBytes.byteLength>16384)throw new Error('Índice de copia demasiado grande.');
  const index=validateBackupIndex(run.storage_path,JSON.parse(new TextDecoder().decode(indexBytes)));
  if(index.sha256!==run.archive_sha256||index.size!==Number(run.size_bytes))throw new Error('El índice no coincide con la copia registrada.');
  parts=index.parts;
 }else{
  if(indexBytes.byteLength!==Number(run.size_bytes)||await fileHash(indexBytes)!==run.archive_sha256)throw new Error('La copia original no coincide con su huella registrada.');
 }
 const folderPath='02 Copias de seguridad/'+String(run.started_at).slice(0,10)+' - '+run.id;
 const previous=check(await admin.from('ops_onedrive_backups').select('*').eq('run_id',run.id).maybeSingle(),'No se pudo revisar el inventario de OneDrive.');
 if(previous&&previous.archive_sha256!==run.archive_sha256)throw new Error('La copia registrada cambió; no se sobrescribe una copia verificada.');
 if(!previous)check(await admin.from('ops_onedrive_backups').insert({run_id:run.id,source_path:run.storage_path,folder_path:folderPath,archive_sha256:run.archive_sha256,archive_size:run.size_bytes,total_files:parts.length+1}),'No se pudo preparar la copia en OneDrive.');
 const access=await token();await root(access);const known=new Set<string>();
 const savedFiles=check(await admin.from('ops_onedrive_backup_files').select('source_path,sha256,size_bytes').eq('run_id',run.id),'No se pudo comprobar el progreso de la copia.');
 const saved=new Map(savedFiles.map((f:any)=>[f.source_path,f]));
 let count=0;const deadline=Date.now()+80000;
 for(const part of parts){
  const prior:any=saved.get(part.path);if(prior?.sha256===part.sha256&&Number(prior.size_bytes)===part.size)continue;
  if(count>=3||count&&Date.now()>deadline)break;
  const bytes=await storedBytes('business-backups',part.path,8*1024*1024);
  if(bytes.byteLength!==part.size||await fileHash(bytes)!==part.sha256)throw new Error('Un fragmento de Supabase no coincide con el índice de la copia.');
  const relative=[...folderPath.split('/'),...part.path.split('/')];await ensurePath(access,relative.slice(0,-1),known);
  const item=await uploadAndVerify(access,relative,bytes,part.sha256);
  check(await admin.from('ops_onedrive_backup_files').upsert({run_id:run.id,source_path:part.path,item_id:item.id,size_bytes:part.size,sha256:part.sha256,verified_at:new Date().toISOString()},{onConflict:'run_id,source_path'}),'No se pudo registrar el fragmento verificado.');
  saved.set(part.path,{sha256:part.sha256,size_bytes:part.size});count++;
 }
 const ready=parts.every((part:any)=>{const f:any=saved.get(part.path);return f?.sha256===part.sha256&&Number(f.size_bytes)===part.size;});
 if(ready){
  const relative=[...folderPath.split('/'),...run.storage_path.split('/')];await ensurePath(access,relative.slice(0,-1),known);
  const digest=await fileHash(indexBytes),item=await uploadAndVerify(access,relative,indexBytes,digest);
  check(await admin.from('ops_onedrive_backup_files').upsert({run_id:run.id,source_path:run.storage_path,item_id:item.id,size_bytes:indexBytes.byteLength,sha256:digest,verified_at:new Date().toISOString()},{onConflict:'run_id,source_path'}),'No se pudo registrar el índice de la copia.');
  check(await admin.from('ops_onedrive_backups').update({verified_at:new Date().toISOString()}).eq('run_id',run.id),'No se pudo confirmar la copia completa.');
 }
 if(ready)await pruneMirroredBackups(access);
 return {copied:count,complete:ready,...await backupMirrorSummary()};
}
async function runBackupMirror(){
 const at=new Date().toISOString(),lease=new Date(Date.now()+180000).toISOString();
 const claimed=check(await admin.from('ops_onedrive_config').update({backup_mirror_lock_until:lease,backup_mirror_last_attempt:at,backup_mirror_last_error:null}).eq('id',1).or('backup_mirror_lock_until.is.null,backup_mirror_lock_until.lt.'+at).select('id').maybeSingle(),'No se pudo reservar el lote de copias.');
 if(!claimed)throw new Error('Ya se están copiando archivos de seguridad.');
 try{return await mirrorBackups();}
 catch(error){await admin.from('ops_onedrive_config').update({backup_mirror_last_error:error instanceof Error?error.message:'No se pudo copiar el lote de seguridad.'}).eq('id',1);throw error;}
 finally{await admin.from('ops_onedrive_config').update({backup_mirror_lock_until:null}).eq('id',1).eq('backup_mirror_lock_until',lease);}
}




// Resolve only a document visible through the caller's existing database policies.
// Scheduled backup workers have already passed their dedicated Vault-key check.
async function completeDocumentRemoval(body:any,req:Request){
 const authorization=req.headers.get('Authorization')||'';
 if(!/^Bearer\s+\S+/i.test(authorization))throw new Error('Acceso denegado.');
 const id=String(body.id||''),path=String(body.path||''),sha256=String(body.sha256||'');
 const scoped=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const begun=check(await scoped.rpc('totus_begin_document_removal',{p_id:id,p_path:path,p_sha256:sha256}),'No se pudo comprobar la autorización de la retirada.');
 if(begun?.id!==id||!['pending','already_removed'].includes(begun?.status))throw new Error('La autorización de la retirada no es válida.');
 if(begun.status==='already_removed')return begun;
 const result=await runDocumentMirror(true);
 const current=check(await admin.from('ops_documents').select('id').eq('id',id).maybeSingle(),'No se pudo comprobar el resultado de la retirada.');
 if(!current)return {id,status:'removed'};
 const failure=result.removals.errors.find((error:any)=>error.id===id);
 throw new Error((failure?.message||'La retirada continúa pendiente y se reintentará automáticamente.')+' La ficha se conserva y no se ha completado la retirada.');
}
async function documentFileUrl(path:string,req:Request,job=false){
 if(!path||path.length>1024||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f]/.test(path))throw new Error('Ruta de documento no válida.');
 let doc:any;
 if(job){
  doc=check(await admin.from('ops_documents').select('id,storage_path,size_bytes,sha256').eq('storage_path',path).maybeSingle(),'No se pudo localizar el documento.');
 }else{
  const authorization=req.headers.get('Authorization')||'';
  const jwt=authorization.replace(/^Bearer\s+/i,'');
  if(!jwt)throw new Error('Acceso denegado.');
  const identity=await admin.auth.getUser(jwt);
  if(identity.error||!identity.data.user)throw new Error('Acceso denegado.');
  const scoped=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const result=await scoped.from('ops_documents').select('id,storage_path,size_bytes,sha256').eq('storage_path',path).maybeSingle();
  if(result.error||!result.data)throw new Error('Acceso denegado.');
  doc=result.data;
 }
 if(!doc){const chat=await chatFiles.resolvePath(path,req,job);if(chat)return chat;throw new Error('Documento no disponible.');}
 const mapped=check(await admin.from('ops_onedrive_documents').select('source_path,onedrive_path,size_bytes,sha256,verified_at').eq('document_id',doc.id).maybeSingle(),'No se pudo comprobar la ubicación del documento.');
 if(!mapped||mapped.source_path!==doc.storage_path)return {provider:'supabase'};
 if(!mapped.verified_at||mapped.source_path!==doc.storage_path||Number(mapped.size_bytes)!==Number(doc.size_bytes)||!doc.sha256||mapped.sha256!==doc.sha256)throw new Error('La copia de OneDrive no coincide con el documento. No se ha abierto otro archivo.');
 const response=await graph(await token(),'/me/drive/special/approot:/'+encodedPath(mapped.onedrive_path.split('/'))+':/content');
 const location=response.headers.get('Location');
 if(response.status!==302||!location||new URL(location).protocol!=='https:')throw new Error('No se pudo abrir el documento de OneDrive.');
 return {provider:'onedrive',url:location,size_bytes:Number(mapped.size_bytes),sha256:mapped.sha256};
}


async function syncOnlineManuals(revision:string){
 if(!/^[a-f0-9]{40}$/.test(revision))throw new Error('La revisión de documentación no es válida.');
 const access=await token();await root(access);
 const folderName='04 Manuales y funcionamiento';
 await ensurePath(access,[folderName],new Set<string>());
 const files=[
  ['docs/MANUAL_CHATGPT_ONLINE.md','MANUAL_CHATGPT_ONLINE.md'],
  ['docs/COPIAS_POR_COMPONENTES.md','COPIAS_POR_COMPONENTES.md'],
  ['docs/GUIA_TRABAJO_DIARIO_CHATGPT.md','GUIA_TRABAJO_DIARIO_CHATGPT.md'],
  ['docs/COTEJOS_CHATGPT.md','COTEJOS_CHATGPT.md'],
  ['RELEVO_CHATGPT_ONLINE.md','RELEVO_CHATGPT_ONLINE.md'],
  ['docs/auditorias/PETICIONES_Y_CIERRE_2026-10-20.md','PETICIONES_Y_ESTADO.md'],
  ['docs/auditorias/REVISION_PRODUCCION_2026-10-21.md','INFORME_REVISION.md']
 ];
 for(const [source,name] of files){
  const response=await fetch('https://raw.githubusercontent.com/hortimatic/Totus-Central/'+revision+'/'+source,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw new Error('No se pudo leer la documentación publicada de GitHub.');
  let text=await response.text();
  if(name==='GUIA_TRABAJO_DIARIO_CHATGPT.md'){
   const stores=check(await admin.from('ops_stores').select('id,name'),'No se pudieron documentar las tiendas');
   const drawers=check(await admin.from('ops_cash_drawers').select('store_id,name'),'No se pudieron documentar las cajas');
   text='> Configuración actual de esta instalación: '+stores.map((store:any)=>store.name+' ('+drawers.filter((drawer:any)=>drawer.store_id===store.id).map((drawer:any)=>drawer.name).join(', ')+')').join('; ')+'. Verifica estos nombres en la aplicación antes de trabajar.\n\n'+text;
  }
  if(name==='MANUAL_CHATGPT_ONLINE.md'){
   text=text.replace(/El formato admite 120 MiB[^\n]*/,'Las copias por componentes (juegos v4) separan datos contables, documentos en ZIP numerados y código. Se preparan por lotes reanudables y no tienen el límite conjunto de 120 MiB del formato anterior. Las copias v3 antiguas y las descargas locales tradicionales conservan sus límites originales. Para descargar o recuperar un juego nuevo consulta COPIAS_POR_COMPONENTES.md; conserva siempre el índice y todos sus ZIP.');
   text=text.replace(/La credencial actual caduca el [^;]+; renovarla antes de esa fecha[^.]*\./,'La fecha vigente de la credencial está registrada en Administración → Almacenamiento; los avisos usan los umbrales configurados en ese panel (por defecto 90 días antes y aviso urgente 30 días antes). Guardar la fecha no renueva la credencial: la clave debe sustituirse mediante Microsoft antes de que caduque.');
   text='> Guía de operativa vigente: GUIA_TRABAJO_DIARIO_CHATGPT.md. Para restaurar una copia guardada usa Restaurar esta copia en su fila. COPIAS_POR_COMPONENTES.md explica los juegos v4. Las referencias al ZIP único se mantienen para copias anteriores y archivos externos.\n\n'+text;
  }
  if(new TextEncoder().encode(text).byteLength>1024*1024)throw new Error('La documentación supera el tamaño permitido.');
  const bytes=new TextEncoder().encode('<!-- Fuente: GitHub hortimatic/Totus-Central; revision '+revision+' -->\n'+text);
  const path='/me/drive/special/approot:/'+encodedPath([folderName,name])+':/content';
  const write=await graph(access,path,{method:'PUT',headers:{'Content-Type':'text/markdown; charset=utf-8'},body:bytes});
  if(!write.ok)throw new Error('No se pudo guardar el manual en OneDrive.');
  const read=await readContent(access,path);
  if(read.byteLength!==bytes.byteLength||await fileHash(read)!==await fileHash(bytes.buffer))throw new Error('El manual guardado no coincide con GitHub.');
 }
 return {verified:true,files:files.length,source_revision:revision};
}

async function backupFileUrl(runId:string,path:string){
 if(!/^[0-9a-f-]{36}$/i.test(runId)||!path)throw new Error('Referencia de copia no válida.');
 const backup=check(await admin.from('ops_onedrive_backups').select('folder_path,verified_at').eq('run_id',runId).maybeSingle(),'No se pudo comprobar la copia en OneDrive.');
 if(!backup?.verified_at)throw new Error('La copia de OneDrive todavía no está completa.');
 const file=check(await admin.from('ops_onedrive_backup_files').select('source_path').eq('run_id',runId).eq('source_path',path).maybeSingle(),'No se pudo comprobar el archivo de copia.');
 if(!file)throw new Error('Archivo fuera del inventario de la copia.');
 const response=await graph(await token(),'/me/drive/special/approot:/'+encodedPath([...backup.folder_path.split('/'),...path.split('/')])+':/content');
 const location=response.headers.get('Location');
 if(response.status!==302||!location||new URL(location).protocol!=='https:')throw new Error('No se pudo preparar una descarga segura de OneDrive.');
 return {url:location};
}

async function copyBackupBatches(full:boolean){
 let result=await runBackupMirror();const deadline=Date.now()+90000;
 while(full&&!result.complete&&Date.now()<deadline)result=await runBackupMirror();
 return result;
}

async function backupFileUrls(runId:string){
 if(!/^[a-f0-9-]{36}$/i.test(runId))throw new Error('Referencia de copia no válida.');
 const backup=check(await admin.from('ops_onedrive_backups').select('folder_path,verified_at').eq('run_id',runId).maybeSingle(),'No se pudo comprobar la copia.');
 if(!backup?.verified_at)throw new Error('La copia de OneDrive no está completa.');
 const files=check(await admin.from('ops_onedrive_backup_files').select('source_path').eq('run_id',runId),'No se pudo comprobar el inventario.');
 if(!files.length||files.length>4097)throw new Error('Inventario de copia no compatible.');
 const access=await token(),result:any[]=[];let next=0;
 const worker=async()=>{while(next<files.length){
  const file=files[next++];
  const response=await graph(access,'/me/drive/special/approot:/'+encodedPath([...backup.folder_path.split('/'),...file.source_path.split('/')])+':/content');
  const location=response.headers.get('Location');
  if(response.status!==302||!location||new URL(location).protocol!=='https:')throw new Error('No se pudo preparar la lectura privada de la copia.');
  result.push({path:file.source_path,url:location});
 }};
 await Promise.all(Array.from({length:Math.min(3,files.length)},worker));
 return {files:result};
}

async function chatScoped(req:Request){
 const authorization=req.headers.get('Authorization')||'';
 const identity=await admin.auth.getUser(authorization.replace(/^Bearer\s+/i,''));
 if(identity.error||!identity.data.user)throw new Error('Acceso denegado.');
 const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 return {client,user:identity.data.user};
}
const chatFiles=createTeamChatFiles({admin,scoped:chatScoped,check,token,root,ensurePath,graph,encodedPath,fileHash,headers});
const backupDocumentLinks=createBackupDocumentLinks({admin,check,config,token,root,resolveExtra:(path:string)=>chatFiles.resolvePath(path,new Request(url),true)});
const directBackup=createDirectBackupTransfer({admin,check,config,token,root,ensurePath,graph,encodedPath,fileHash});
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
   if(allowed.error||allowed.data!==true||!['backup-document-urls','mirror-documents','mirror-backups','backup-file-url','document-file-url','sync-manuals','prune-backups','backup-file-urls','prepare-backup-upload','verify-backup-file','staged-backup-file-url','import-stock-document'].includes(action))throw new Error('Acceso denegado.');
   if(action==='import-stock-document')return json(await importStockDocument(body,{admin,check,token,root,graph,encodedPath,readContent,fileHash}));
   if(action==='backup-document-urls')return json(await backupDocumentLinks(body.paths));
   if(action==='prune-backups'){await pruneMirroredBackups(await token());return json({pruned:true});}
   if(action==='backup-file-urls')return json(await backupFileUrls(String(body.run_id||'')));
   if(action==='prepare-backup-upload')return json(await directBackup.prepare(String(body.run_id||''),body.paths||null));
   if(action==='verify-backup-file')return json(await directBackup.verify(String(body.run_id||''),String(body.path||''),Number(body.size),String(body.sha256||'')));
   if(action==='staged-backup-file-url')return json(await directBackup.stagedUrl(String(body.run_id||''),String(body.path||'')));
   if(action==='sync-manuals')return json(await syncOnlineManuals(String(body.revision||'')));
   if(action==='document-file-url')return json(await documentFileUrl(String(body.path||''),req,true));
   if(action==='backup-file-url')return json(await backupFileUrl(String(body.run_id||''),String(body.path||'')));
   const result=action==='mirror-backups'?await copyBackupBatches(body.full===true):await runDocumentMirror();
   if(action==='mirror-documents')await chatFiles.reconcilePending();
   if(result.copied||result.cleanup?.archived)check(await admin.from('ops_audit_log').insert({user_id:null,user_email:'Tarea automática',area:'administracion',action:action==='mirror-backups'?'onedrive_copia_seguridad_copiada':'onedrive_documentos_copiados',detail:{conexion:'OneDrive',copiados:result.copied,pendientes:result.pending,retirados:result.cleanup?.archived||0}}),'No se pudo registrar el lote automático.');
   return json(result);
  }
  if(action.startsWith('chat-file-'))return await chatFiles.handle(req,body);
  if(action==='document-file-url')return json(await documentFileUrl(String(body.path||''),req));
  if(action==='complete-document-removal')return json(await completeDocumentRemoval(body,req));
  const user=await administrator(req);
  if(action==='import-stock-document')return json(await importStockDocument({...body,actor_email:user.email},{admin,check,token,root,graph,encodedPath,readContent,fileHash}));
  if(action==='backup-document-urls')return json(await backupDocumentLinks(body.paths));
  if(action==='backup-file-urls')return json(await backupFileUrls(String(body.run_id||'')));
  if(action==='prepare-backup-upload')return json(await directBackup.prepare(String(body.run_id||''),body.paths||null));
  if(action==='verify-backup-file')return json(await directBackup.verify(String(body.run_id||''),String(body.path||''),Number(body.size),String(body.sha256||'')));
  if(action==='staged-backup-file-url')return json(await directBackup.stagedUrl(String(body.run_id||''),String(body.path||'')));

  if(action==='sync-manuals'){const result=await syncOnlineManuals(String(body.revision||''));await audit(user.id,user.email||'','manuales_online_actualizados');return json(result);}
  if(action==='prune-backups'){await pruneMirroredBackups(await token());return json({pruned:true});}
  if(action==='backup-file-url')return json(await backupFileUrl(String(body.run_id||''),String(body.path||'')));
  if(action==='maintenance-status'){
   const c=await config();return json({credential_expires_at:c.credential_expires_at||null,warning_days:c.warning_days??90,urgent_days:c.urgent_days??30,connected:c.connected});
  }
  if(action==='status'){
   const c=await config(),configured=!!await secret('read_client');
   const {pending_ids,...mirror}=await mirrorSummary();
   const backups=await backupMirrorSummary();
   return json({configured,credential_expires_at:c.credential_expires_at||null,warning_days:c.warning_days??90,urgent_days:c.urgent_days??30,connected:c.connected,folder_url:c.app_folder_url,tested_at:c.tested_at,test_sha256:c.test_sha256,client_id:c.client_id,redirect_uri:redirect,scope:scopes,quota:c.connected?await driveQuota():{available:false},backups:{...backups,last_error:c.backup_mirror_last_error,running:!!c.backup_mirror_lock_until&&new Date(c.backup_mirror_lock_until).getTime()>Date.now()},mirror:{...mirror,last_error:c.mirror_last_error,last_attempt:c.mirror_last_attempt,running:!!c.mirror_lock_until&&new Date(c.mirror_lock_until).getTime()>Date.now()}});
  }
  if(action==='save-expiry'){
   const expires=String(body.expires_at||'');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||!Number.isFinite(Date.parse(expires+'T00:00:00Z'))||new Date(expires+'T00:00:00Z').toISOString().slice(0,10)!==expires)throw new Error('Indica una fecha válida.');
   const previous=await config(),alerts=credentialAlertSettings({warning_days:body.warning_days??previous.warning_days,urgent_days:body.urgent_days??previous.urgent_days});
   check(await admin.from('ops_onedrive_config').update({credential_expires_at:expires,warning_days:alerts.warningDays,urgent_days:alerts.urgentDays,updated_at:new Date().toISOString()}).eq('id',1),'No se pudo guardar la fecha de caducidad.');
   await audit(user.id,user.email||'','onedrive_caducidad_actualizada');return json({saved:true,credential_expires_at:expires});
  }
  if(action==='renew-key'){
   const result=await renewMicrosoftCredential({config,secret,root,saveExpiry:async(expires:string)=>{check(await admin.from('ops_onedrive_config').update({credential_expires_at:expires,updated_at:new Date().toISOString()}).eq('id',1),'La clave funciona, pero falta guardar su fecha.');}},String(body.client_secret||''),String(body.expires_at||''));
   await audit(user.id,user.email||'','onedrive_clave_renovada');return json(result);
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
  if(action==='mirror-backups'){const result=await copyBackupBatches(body.full===true);await audit(user.id,user.email||'','onedrive_copia_seguridad_copiada');return json(result);}
  if(action==='mirror-documents'){const result=await runDocumentMirror();await audit(user.id,user.email||'','onedrive_documentos_copiados');return json(result);}
  if(action==='test'){const result=await test();await audit(user.id,user.email||'','onedrive_prueba_verificada');return json(result);}
  return json({error:'Acción no disponible.'},400);
 }catch(e){
  const message=e instanceof Error?e.message:'No se pudo completar la conexión.';
  return json({error:message},message==='Acceso denegado.'?403:400);
 }
});
