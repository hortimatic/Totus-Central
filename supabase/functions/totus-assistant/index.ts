import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {attachChatExpenseDocument,readExpenseContext,reviewExpenseDocument} from './assistant-attachments.ts'
import {readTeamChat,sendTeamChat} from './assistant-chat.ts'
import {runOperation} from './assistant-operations.ts'

// This endpoint never receives user credentials. A short-lived, single-use
// server ticket authorizes exactly one queued operation from the SQL connector.
export async function handle(req: Request, env = Deno.env, clientFactory = createClient) {
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
 if(req.method!=='POST')return respond({error:'Método no permitido'},405)
 let job:string|undefined; let claimed=false; let admin:any; let scoped:any
 try {
  if(Number(req.headers.get('content-length')||0)>1024)return respond({error:'Solicitud demasiado grande'},413)
  const raw=await req.text()
  if(raw.length>1024)return respond({error:'Solicitud demasiado grande'},413)
  const body=JSON.parse(raw)
  if(!/^[0-9a-f-]{36}$/i.test(body.job||'')||!/^[0-9a-f]{64}$/i.test(body.ticket||''))return respond({error:'Solicitud no autorizada'},401)
  job=body.job
  const url=env.get('SUPABASE_URL')||''
  const secret=JSON.parse(env.get('SUPABASE_SECRET_KEYS')||'{}').default||env.get('SUPABASE_SERVICE_ROLE_KEY')||''
  const key=JSON.parse(env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||env.get('SUPABASE_ANON_KEY')||''
  if(!url||!secret||!key)throw new Error('Configuración incompleta')
  const opts={auth:{autoRefreshToken:false,persistSession:false}}
  admin=clientFactory(url,secret,opts)
  const {data:work,error:claimError}=await admin.rpc('totus_assistant_claim',{p_job:job,p_ticket:body.ticket})
  if(claimError||!work)return respond({error:'Solicitud no autorizada, ya utilizada o caducada'},401)
  claimed=true
  const {email,password}=work.credentials
  const codexAction=typeof work.action==='string'&&work.action.startsWith('codex_')
  const action=codexAction?work.action.slice(6):work.action
  if(email!==(codexAction?'codex@totuscentral.invalid':'chatgpt@totuscentral.invalid')||typeof password!=='string'||password.length<48)throw new Error('Cuenta técnica incorrecta')
  if(!['session_check','expense_context','validate_expense','save_expense','attach_chat_file','review_document','chat_read','chat_send','operation','chat_direct',...(codexAction?['setup','grant_chatgpt_admin']:[])].includes(action))throw new Error('Acción no admitida')
  if(work.action==='codex_setup'){
   // The one-use server ticket is issued exclusively by the administrative connector.
   // Do not reset, reactivate or take over an existing account on retry.
   let existing=null;
   for(let page=1;;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error)throw new Error('No se pudo comprobar la cuenta de Codex');
    existing=data.users.find((u:any)=>u.email===email)||existing;
    if(existing||data.users.length<1000)break;
   }
   if(existing){
    if(existing.app_metadata?.totus_codex!==true)throw new Error('La cuenta ya existe y no es la identidad técnica de Codex');
    const {data:member,error}=await admin.from('team_members').select('role,active').eq('email',email).maybeSingle();
    if(error||!member?.active||member.role!=='admin')throw new Error('Revisa el acceso de Codex en administración; no se reactivará automáticamente');
   }else{
    const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{totus_codex:true},user_metadata:{full_name:'Codex'}});
    if(error||!created?.user)throw new Error('No se pudo crear la identidad de Codex');
    const {error:memberError}=await admin.from('team_members').insert({email,full_name:'Codex',role:'admin',active:true,job_title:'Coordinación técnica'});
    if(memberError){await admin.auth.admin.deleteUser(created.user.id);throw new Error('No se pudo registrar Codex en el equipo')}
    const {error:auditError}=await admin.from('team_user_audit_log').insert({actor_email:email,target_email:email,action:'technical_account_created',status:'ok',detail:'Alta de Codex autorizada por Diego; acceso administrativo propio solicitado por Diego'});
    if(auditError)throw new Error('Cuenta creada; no se pudo registrar el alta. Revisa antes de repetir.');
   }
  }
  scoped=clientFactory(url,key,opts)
  const {data:session,error:loginError}=await scoped.auth.signInWithPassword({email,password})
  if(loginError||!session.session||(codexAction?session.user?.app_metadata?.totus_codex:session.user?.app_metadata?.totus_assistant)!==true)throw new Error('No se pudo autenticar la cuenta propia')
  const {data:confirmed,error:userError}=await scoped.auth.getUser()
  if(userError||confirmed.user?.id!==session.user.id)throw new Error('No se pudo verificar la sesión')
  const {data:member,error:memberError}=await admin.from('team_members').select('active,role').eq('email',email).maybeSingle()
  if(memberError||!member?.active)throw new Error('Cuenta del asistente desactivada')
  let result:any={authenticated:true,user_id:confirmed.user.id,email,role:member.role,session_verified:true}
  if(action==='grant_chatgpt_admin'){
   if(!codexAction||member.role!=='admin')throw new Error('Administración de Codex requerida');
   const {data:target,error:targetError}=await scoped.from('team_members').select('email,full_name,phone,job_title,store,employee_notes,active').eq('email','chatgpt@totuscentral.invalid').single();
   if(targetError||!target?.active)throw new Error('ChatGPT debe existir y estar activo; no se reactivará automáticamente');
   const {data:updated,error:updateError}=await scoped.functions.invoke('team-admin',{body:{action:'update_member',...target,role:'admin'}});
   if(updateError||!updated?.ok)throw new Error(updated?.error||updateError?.message||'No se pudo actualizar el rol');
   const {data:proof,error:proofError}=await scoped.from('team_members').select('email,role,active').eq('email',target.email).single();
   if(proofError||proof?.role!=='admin'||proof?.active!==true)throw new Error('Actualización enviada; relectura pendiente');
   result={...result,target:proof,verified:true};
  } else if(action==='operation')result={...result,...await runOperation(scoped,work.payload,confirmed.user)}
  else
  if(['save_expense','validate_expense'].includes(action)){
   const {expense,lines}=work.payload||{}
   if(!expense||!Array.isArray(lines)||!expense.request_id)throw new Error('Gasto, líneas y request_id obligatorios')
   if(expense.fiscal_reviewed!==undefined&&typeof expense.fiscal_reviewed!=='boolean')throw new Error('Revisión fiscal no válida')
   if(expense.id&&!Object.hasOwn(expense,'expected_updated_at'))throw new Error('Relee la ficha antes de editarla')
   const rpc=action==='save_expense'?'totus_save_expense':'totus_assistant_validate_expense'
   const {data:saved,error:saveError}=await scoped.rpc(rpc,{p_expense:expense,p_lines:lines})
   if(saveError)throw new Error(saveError.message)
   if(action==='validate_expense')result={...result,...saved,simulation:true,persisted:false}
   else {
    const {data:expenseRow,error:readError}=await scoped.from('ops_expenses').select('*').eq('id',saved).single()
    const {data:lineRows,error:lineError}=await scoped.from('ops_expense_lines').select('*').eq('expense_id',saved).order('sort_order')
    if(readError||lineError||expenseRow.created_by!==confirmed.user.id&&!expense.id)throw new Error('Guardado realizado; relectura pendiente. Consulta antes de reintentar.')
    result={...result,expense_id:saved,expense:expenseRow,lines:lineRows,persisted:true}
   }
  } else if(action==='attach_chat_file')result={...result,...await attachChatExpenseDocument(scoped,work.payload,confirmed.user)}
  else if(action==='expense_context')result={...result,...await readExpenseContext(scoped,work.payload)}
  else if(action==='review_document')result={...result,...await reviewExpenseDocument(scoped,work.payload)}
  else if(action==='chat_read')result={...result,...await readTeamChat(scoped,work.payload,confirmed.user)}
  else if(action==='chat_send')result={...result,...await sendTeamChat(scoped,work.payload,confirmed.user)}
  else if(action==='chat_direct'){
   const target=String(work.payload?.target_email||'').trim().toLowerCase();
   if(!target||target===email)throw new Error('Destinatario no válido');
   const {data:direct,error}=await scoped.rpc('totus_chat_command',{p_action:'create_direct',p_data:{email:target}});
   if(error||!direct?.id)throw new Error('No se pudo abrir el chat directo: '+(error?.message||'sin respuesta'));
   result={...result,channel_id:direct.id};
  }
  else if(!['session_check','codex_session_check','codex_setup'].includes(work.action))throw new Error('Acción no admitida')
  const {error:finishError}=await admin.rpc('totus_assistant_complete',{p_job:job,p_result:result,p_error:null})
  if(finishError)throw new Error('Operación ejecutada; no se pudo guardar su resultado. Consulta antes de reintentar.')
  return respond({job_id:job,status:'completed'})
 } catch(e) {
  const message=e instanceof Error?e.message:'Error de operación'
  if(claimed&&admin&&job)await admin.rpc('totus_assistant_complete',{p_job:job,p_result:null,p_error:message})
  return respond({job_id:job,error:claimed?message:'Solicitud no autorizada'},claimed?400:401)
 } finally {
  if(scoped)await scoped.auth.signOut({scope:'local'}).catch(()=>{})
 }
}

if(import.meta.main)Deno.serve(req=>handle(req))
