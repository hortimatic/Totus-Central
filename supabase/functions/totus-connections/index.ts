import {websiteKey} from '../../../src/website-registry.js';
import {readGithubFile} from './github.js';
import {readPrestashopPage,discoverPrestashop,readPrestashopProductItem} from './prestashop.js';
import {directoryQuery,directoryMutation} from '../../../src/contact-directory-contract.js';
import {prestashopQuery,PRESTASHOP_RESOURCES} from '../../../src/prestashop-readonly.js';
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {testConnection,boundedJson} from './transport.js';
const headers={'Access-Control-Allow-Origin':'https://hortimatic.github.io','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const check=(r:any)=>{if(r.error)throw Error(r.error.message||'Operación rechazada.');return r.data;};
export async function handle(req:Request,env=Deno.env,factory:any=createClient,request:any=fetch){
 const respond=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});if(req.method==='OPTIONS')return respond({});if(req.method!=='POST')return respond({error:'Método no permitido'},405);
 let admin:any,input:any,started=false;
 try{
  input=await boundedJson(req,6291456);
  const salesRead=input?.action==='prestashop_sales_read';
  if(salesRead){if(!['orders','order_details','products','combinations','currencies','customers','addresses','order_histories','employees','order_states','taxes','tax_rules','countries','languages'].includes(input.resource))throw Error('Recurso no disponible en Ventas.');input={...input,action:'prestashop_read'};}
  if(!['prestashop_directory_prepare','prestashop_directory_commit','prestashop_product_prepare','prestashop_product_commit','prestashop_product_create_prepare','prestashop_product_create_commit','prestashop_product_step_prepare','prestashop_product_step_commit'].includes(input?.action)&&JSON.stringify(input).length>4096)throw Error('Solicitud demasiado grande.');
  const uuid=(v:any)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);if(!['prestashop_directory_read','prestashop_directory_prepare','prestashop_directory_commit','test','create_actor','github_read','prestashop_read','prestashop_discover','prestashop_item_read','prestashop_product_prepare','prestashop_product_commit','prestashop_product_create_prepare','prestashop_product_create_commit','prestashop_product_create_profile','prestashop_product_step_prepare','prestashop_product_step_commit'].includes(input.action)||input.action==='test'&&(!uuid(input.id)||!uuid(input.call_id)||!Number.isSafeInteger(input.revision))||input.action==='create_actor'&&(!uuid(input.request_id)||typeof input.name!=='string'||typeof input.role!=='string')||input.action==='prestashop_read'&&(!uuid(input.id)||!uuid(input.call_id)||!Number.isSafeInteger(input.revision)||!websiteKey(input.store)||!Object.prototype.hasOwnProperty.call(PRESTASHOP_RESOURCES,input.resource)||!Number.isSafeInteger(input.page)||input.page<0||input.page>1000||!Number.isSafeInteger(input.page_size)||input.page_size<1||input.page_size>100||Object.keys(input).some(k=>!['action','id','call_id','revision','store','resource','page','page_size','sort','from','to','order_id','record_id','order_ids','product_ids','references','search','search_field'].includes(k))))throw Error('Solicitud no válida.');
  if(input.action==='prestashop_discover'&&(!uuid(input.id)||!uuid(input.call_id)||!Number.isSafeInteger(input.revision)||!websiteKey(input.store)||Object.keys(input).some(k=>!['action','id','call_id','revision','store'].includes(k))))throw Error('Solicitud no válida.');
  if(input.action==='prestashop_item_read'&&(!uuid(input.id)||!uuid(input.call_id)||!Number.isSafeInteger(input.revision)||!websiteKey(input.store)||!['products','combinations','manufacturers','suppliers','product_options','product_option_values','product_features','product_feature_values','totus_product_images','images'].includes(input.resource)||!/^[1-9]\d{0,14}$/.test(String(input.record_id||''))||Object.keys(input).some(k=>!['action','id','call_id','revision','store','resource','record_id',...(input.resource==='images'?['product_id']:[])].includes(k))))throw Error('Solicitud de producto no válida.');
  if(input.action==='prestashop_item_read'&&input.resource==='images'&&!/^[1-9]\d{0,14}$/.test(String(input.product_id||'')))throw Error('Selecciona el producto de la imagen.');
  if(input.action==='prestashop_product_create_profile'&&(!uuid(input.id)||!uuid(input.call_id)||!Number.isSafeInteger(input.revision)||!websiteKey(input.store)||Object.keys(input).some(k=>!['action','id','call_id','revision','store'].includes(k))))throw Error('Solicitud de idiomas no válida.');
  if(['prestashop_product_prepare','prestashop_product_commit'].includes(input.action))(await import('./prestashop-write.js')).validateProductWriteRequest(input);
  if(['prestashop_product_create_prepare','prestashop_product_create_commit'].includes(input.action))(await import('./prestashop-create.js')).validateProductCreateRequest(input);
  if(['prestashop_product_step_prepare','prestashop_product_step_commit'].includes(input.action))(await import('./prestashop-product-stage.js')).validateProductStage(input);
  if(input.action==='prestashop_read')prestashopQuery(input);
  if(input.action==='prestashop_directory_read')directoryQuery(input);
  if(['prestashop_directory_prepare','prestashop_directory_commit'].includes(input.action))directoryMutation(input);
  const url=env.get('SUPABASE_URL')||'',key=JSON.parse(env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||env.get('SUPABASE_ANON_KEY')||'',secret=JSON.parse(env.get('SUPABASE_SECRET_KEYS')||'{}').default||env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const bearer=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!bearer)return respond({error:'Inicia sesión para probar conexiones.'},401);
  const options={auth:{persistSession:false,autoRefreshToken:false}},auth=factory(url,key,options);const user=check(await auth.auth.getUser(bearer)).user;if(!user)return respond({error:'Sesión no válida.'},401);
  const scoped=factory(url,key,{...options,global:{headers:{Authorization:'Bearer '+bearer}}});
  const productAction=input.action.startsWith('prestashop_product_')||input.action==='prestashop_item_read';
  const productPermission=input.action.includes('_create_')&&input.action!=='prestashop_product_create_profile'?'create':input.action.includes('_step_')?(String(input.kind).startsWith('remove_')?'delete':input.existing_product!==true||['variation','attribute_group','attribute_value','feature','feature_value','manufacturer','supplier'].includes(input.kind)?'create':'edit'):['prestashop_product_prepare','prestashop_product_commit'].includes(input.action)?'edit':'view';
  let context:any;
  const directoryAction=input.action.startsWith('prestashop_directory_');
  const directoryPermission=input.action==='prestashop_directory_read'?'view':({create:'create',update:'edit',delete:'delete'} as Record<string,string>)[input.operation];
  if(directoryAction)context=check(await scoped.rpc('totus_directory_context',{p_kind:input.kind,p_action:directoryPermission}));
  else if(salesRead){context=check(await scoped.rpc('totus_sales_context',{}));}
  else if(input.action==='prestashop_read'){
   const normal=await scoped.rpc('totus_prestashop_context',{});
   const productResources=['products','combinations','product_options','product_option_values','stock_availables','categories','manufacturers','suppliers','tax_rule_groups','tax_rules','taxes','countries','currencies','image_types','tags','product_features','product_feature_values','languages','product_suppliers','specific_prices'];
   context=normal.error&&productResources.includes(input.resource)?check(await scoped.rpc('totus_products_context',{p_action:'view'})):check(normal);
  }else context=check(await scoped.rpc(productAction?'totus_products_context':input.action==='prestashop_discover'?'totus_prestashop_context':'totus_api_manager',productAction?{p_action:productPermission}:{}));
  if(input.action==='create_actor'){
   admin=factory(url,secret,options);const password=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');const prepared=check(await admin.rpc('totus_api_prepare_actor',{p_id:input.request_id,p_owner:user.id,p_name:input.name,p_role:input.role,p_password:password}));if(prepared.complete)return respond({ok:true,actor:prepared.actor});
   const credentials=prepared.credentials;await admin.auth.admin.createUser({email:credentials.email,password:credentials.password,email_confirm:true,app_metadata:{totus_integration:true,totus_provision_id:input.request_id},user_metadata:{full_name:prepared.name}});
   const actor=check(await admin.rpc('totus_api_finish_actor',{p_id:input.request_id,p_owner:user.id}));return respond({ok:true,actor});
  }
  if(!context.connections?.some((c:any)=>c.id===input.id&&c.revision===input.revision))throw Error('Actualiza la conexión antes de probar.');
  admin=factory(url,secret,options);const connection=check(await admin.rpc('totus_api_server',{p_id:input.id,p_revision:input.revision}));
  if(input.store&&Array.isArray(context.websites)){const website=context.websites.find((w:any)=>w.key===input.store&&w.connection_id===connection.id&&w.status==='active');if(!website)throw Error('Tienda no registrada o desactivada.');Object.assign(connection,{store_key:website.key,website_origin:website.origin,website_name:website.name});}
  if(input.action==='github_read'&&(connection.actor_email!==user.email||!uuid(input.call_id)))throw Error('La conexión no está asignada a tu propia identidad.');
  check(await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id}));started=true;
  // Journal is callable exclusively by the short-lived server client after normal
  // authenticated-user and admin checks. The browser never gets service privileges.
  const productCreateJournal=input.action==='prestashop_product_create_commit'?(()=>{
   const shared={actor_id:user.id,connection_id:input.id,revision:input.revision};
   const journalCall=async(action:string,request_id:string,extra:any={})=>
    check(await admin.rpc('totus_prestashop_product_create_journal',{
     p_action:action,p_request_id:request_id,p_data:{...shared,...extra}
    }));
   return {
    lookup:(request_id:string)=>journalCall('lookup',request_id),
    claim:(op:any)=>journalCall('claim',op.request_id,{store:op.store,reference:op.reference,signature:op.signature}),
    retryAbsent:async(op:any)=>check(await admin.rpc('totus_prestashop_product_retry_absent',{p_request_id:op.request_id,p_data:{...shared,store:op.store,reference:op.reference,signature:op.signature,previous_signature:op.previous_signature}})),
    complete:(op:any)=>journalCall('complete',op.request_id,{signature:op.signature,product_id:op.product_id}),
    uncertain:(op:any)=>journalCall('uncertain',op.request_id,{signature:op.signature,product_id:op.product_id})
   };
  })():null;
  const productStageJournal=['prestashop_product_step_prepare','prestashop_product_step_commit'].includes(input.action)?(()=>{
   const shared={actor_id:user.id,connection_id:input.id,revision:input.revision,product_id:input.product_id,...(input.existing_product===true?{store:input.store}:{})};
   const stageCall=(action:string,op:any,signature?:string,record_id?:string)=>checkResult(admin.rpc(input.existing_product===true?'totus_prestashop_existing_product_step':'totus_prestashop_product_step',{p_action:action,p_request_id:input.parent_request_id,p_stage:op.stage,p_data:{...shared,...(signature?{signature}:{}),...(record_id?{record_id}:{})}}));
   const checkResult=async(promise:any)=>check(await promise);
   return {parent:(request_id:string)=>input.existing_product===true?Promise.resolve({status:'completed',store:input.store,product_id:input.product_id}):checkResult(admin.rpc('totus_prestashop_product_create_journal',{p_action:'lookup',p_request_id:request_id,p_data:shared})),
    lookup:(op:any)=>stageCall('lookup',op),claim:(op:any,signature:string)=>stageCall('claim',op,signature),complete:(op:any,signature:string,id:string)=>stageCall('complete',op,signature,id),uncertain:(op:any,signature:string)=>stageCall('uncertain',op,signature)};
  })():null;
  const productEditJournal=input.action==='prestashop_product_commit'?(()=>{
   const call=(action:string,signature:string,evidence_fingerprint?:string)=>checkResult(admin.rpc('totus_prestashop_product_edit',{p_action:action,p_request_id:input.request_id,p_data:{actor_id:user.id,connection_id:input.id,revision:input.revision,signature,...(evidence_fingerprint?{evidence_fingerprint}:{})}}));
   const checkResult=async(promise:any)=>check(await promise);
   return {lookup:(signature:string)=>call('lookup',signature),claim:(signature:string)=>call('claim',signature),recover:(signature:string,fingerprint:string)=>call('recover_claim',signature,fingerprint),complete:(signature:string)=>call('complete',signature),uncertain:(signature:string)=>call('uncertain',signature)};
  })():null;
  const directoryJournal=['prestashop_directory_prepare','prestashop_directory_commit'].includes(input.action)?(()=>{
   const call=(action:string,signature:string,record_id?:string,metadata:any={})=>checkResult(admin.rpc('totus_directory_operation',{p_action:action,p_request_id:input.request_id,p_data:{actor_id:user.id,connection_id:input.id,revision:input.revision,resource:input.resource,operation:input.operation,signature,...metadata,...(record_id?{record_id}:{})}}));
   const checkResult=async(promise:any)=>check(await promise);
   return {lookup:(signature:string)=>call('lookup',signature),claim:(signature:string,record_id?:string,metadata:any={})=>call('claim',signature,record_id,metadata),complete:(signature:string,record_id:string)=>call('complete',signature,record_id),uncertain:(signature:string,record_id?:string)=>call('uncertain',signature,record_id)};
  })():null;
  const result=input.action==='prestashop_directory_read'?await (await import('./contact-directory.js')).readContactDirectory(connection,input,{request}):directoryAction?await (await import('./contact-directory-write.js')).writeContactDirectory(connection,input,{request,journal:directoryJournal}):input.action==='github_read'?{ok:true,file:await readGithubFile(connection,input,request)}:input.action==='prestashop_read'?await readPrestashopPage(connection,input,{request}):input.action==='prestashop_discover'?await discoverPrestashop(connection,input,{request}):input.action==='prestashop_item_read'?await readPrestashopProductItem(connection,input,{request}):input.action==='prestashop_product_create_profile'?await (await import('./prestashop-create.js')).readPrestashopProductCreateProfile(connection,input,{request}):['prestashop_product_prepare','prestashop_product_commit'].includes(input.action)?await (await import('./prestashop-write.js')).runPrestashopProductWrite(connection,input,{request,env,journal:productEditJournal}):['prestashop_product_create_prepare','prestashop_product_create_commit'].includes(input.action)?await (await import('./prestashop-create.js')).runPrestashopProductCreate(connection,input,{request,env,journal:productCreateJournal}):['prestashop_product_step_prepare','prestashop_product_step_commit'].includes(input.action)?await (await import('./prestashop-product-stage.js')).runPrestashopProductStage(connection,input,{request,env,journal:productStageJournal}):await testConnection(connection,{request});
  const auditResult:any=directoryAction?{ok:true,store:input.store,resource:input.resource,operation:input.action,persisted:'persisted' in result?result.persisted:false,record_id:'record_id' in result?result.record_id:null,...('rows' in result?{rows_count:result.rows.length}:{})}:['prestashop_product_create_prepare','prestashop_product_create_commit'].includes(input.action)&&'reference' in result?{ok:true,store:input.store,resource:'products',operation:input.action,persisted:'persisted' in result?result.persisted:false,record_id:'record_id' in result?result.record_id:null}:['prestashop_product_prepare','prestashop_product_commit'].includes(input.action)&&'changes' in result?{ok:true,store:input.store,resource:input.resource,record_id:input.record_id,operation:input.action,persisted:'persisted' in result?result.persisted:false,changed_count:Array.isArray(result.changes)?result.changes.filter((x:any)=>x.changed).length:0}:input.action==='prestashop_item_read'&&'item' in result?{ok:true,store:result.store,resource:result.resource,record_id:result.record_id}:'store' in result&&'resource' in result&&'page' in result&&'rows' in result?{ok:true,store:result.store,resource:result.resource,page:result.page,rows_count:result.rows.length}:result;
  check(await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id,p_result:auditResult}));started=false;
  return respond(result);
 }catch(e){if(started&&admin){try{await admin.rpc('totus_api_call',{p_id:input.id,p_revision:input.revision,p_call:input.call_id,p_result:{ok:false,verification_failed:input.action==='test'}});}catch{}}return respond({error:e instanceof Error?e.message:'No se pudo probar la conexión.'},400);}
}
if(import.meta.main)Deno.serve(req=>handle(req));
