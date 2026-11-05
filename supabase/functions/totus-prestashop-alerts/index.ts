import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {boundedJson} from '../totus-connections/transport.js';
import {readPrestashopPage} from '../totus-connections/prestashop.js';
import {storeConnection} from '../../../src/prestashop-readonly.js';
import {automationResult} from '../../../src/prestashop-automation-core.js';

const checked=(r:any)=>{if(r.error)throw Error(r.error.message||'Operación rechazada.');return r.data;};
export async function handle(req:Request,env=Deno.env,factory:any=createClient,request:any=fetch){
 const respond=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return respond({error:'Método no permitido.'},405);
 let client:any,job:any,claim:any,started=false;
 try{
  const body=await boundedJson(req,1024);
  if(!body||Object.keys(body).some(k=>!['job','ticket'].includes(k))||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(body.job||'')||!/^[a-f0-9]{64}$/.test(body.ticket||''))return respond({error:'Trabajo no autorizado.'},401);
  const key=JSON.parse(env.get('SUPABASE_SECRET_KEYS')||'{}').default||env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  client=factory(env.get('SUPABASE_URL')||'',key,{auth:{persistSession:false,autoRefreshToken:false}});
  claim=checked(await client.rpc('totus_prestashop_job_claim',{p_job:body.job,p_ticket:body.ticket}));job=claim.job;started=true;
  if(claim.rule.recipe==='reminder'){
   const text=String(claim.rule.message||'');if(text.length<3||text.length>4000)throw Error('Aviso no válido.');
   const sent=checked(await client.rpc('totus_prestashop_job_deliver',{p_job:job,p_store:'general',p_order:'report:'+claim.slot,p_body:claim.rule.name+'\n\n'+text}));
   checked(await client.rpc('totus_prestashop_job_finish',{p_job:job,p_status:'done',p_result:{notices:sent.duplicate?0:1,scanned:0}}));started=false;return respond({ok:true,job,notices:sent.duplicate?0:1});
  }
  const deadline=Date.now()+45000,stats:any={stores:[],scanned:0,notices:0};
  for(const store of claim.rule.stores){
   const profile=storeConnection(claim.connections,store);if(!profile)throw Error('Falta una conexión única y verificada para '+store+'.');
   const connection=checked(await client.rpc('totus_api_server',{p_id:profile.id,p_revision:profile.revision}));
   const read=async(resource:string,params:any)=>{
    if(Date.now()>deadline)throw Error('Tiempo de ejecución agotado; el siguiente intento conservará los avisos ya enviados.');
    const call=crypto.randomUUID();checked(await client.rpc('totus_api_call',{p_id:profile.id,p_revision:profile.revision,p_call:call}));
    try{
     const result=await readPrestashopPage(connection,{store,resource,...params},{request});
     checked(await client.rpc('totus_api_call',{p_id:profile.id,p_revision:profile.revision,p_call:call,p_result:{ok:true,store,resource,page:params.page,rows_count:result.rows.length}}));return result;
    }catch(e){await client.rpc('totus_api_call',{p_id:profile.id,p_revision:profile.revision,p_call:call,p_result:{ok:false}});throw e;}
   };
   const result=await automationResult(claim.rule,store,{from:claim.from,to:claim.to,report_from:claim.report_from},{read,seen:(claim.seen||[]).filter((s:any)=>s.store===store).map((s:any)=>s.id),onOrder:async(order:any,text:string)=>{const sent=checked(await client.rpc('totus_prestashop_job_deliver',{p_job:job,p_store:store,p_order:String(order.id),p_body:text}));if(!sent.duplicate)stats.notices++;}});
   if(result.body){const sent=checked(await client.rpc('totus_prestashop_job_deliver',{p_job:job,p_store:store,p_order:'report:'+claim.slot,p_body:result.body}));if(!sent.duplicate)stats.notices++;}
   stats.stores.push({store,count:result.count,unknown:result.unknown||0});stats.scanned+=result.scanned;
  }
  checked(await client.rpc('totus_prestashop_job_finish',{p_job:job,p_status:'done',p_result:stats}));started=false;
  return respond({ok:true,job,...stats});
 }catch(e){
  if(started&&client){await client.rpc('totus_prestashop_job_finish',{p_job:job,p_status:'partial',p_result:{retry:true},p_error:e instanceof Error?e.message:'Lectura pendiente.'});return respond({ok:false,job,retry:true},202);}
  return respond({error:'El trabajo no está autorizado o ya no está vigente.'},401);
 }
}
if(import.meta.main)Deno.serve(req=>handle(req));
