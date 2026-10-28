import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {attachChatExpenseDocument,readExpenseContext,reviewExpenseDocument} from './assistant-attachments.ts'
import {readTeamChat,sendTeamChat} from './assistant-chat.ts'

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
  if(email!=='chatgpt@totuscentral.invalid'||typeof password!=='string'||password.length<48)throw new Error('Cuenta técnica incorrecta')
  if(!['session_check','expense_context','validate_expense','save_expense','attach_chat_file','review_document','chat_read','chat_send'].includes(work.action))throw new Error('Acción no admitida')
  scoped=clientFactory(url,key,opts)
  const {data:session,error:loginError}=await scoped.auth.signInWithPassword({email,password})
  if(loginError||!session.session||session.user?.app_metadata?.totus_assistant!==true)throw new Error('No se pudo autenticar la cuenta propia')
  const {data:confirmed,error:userError}=await scoped.auth.getUser()
  if(userError||confirmed.user?.id!==session.user.id)throw new Error('No se pudo verificar la sesión')
  const {data:member,error:memberError}=await admin.from('team_members').select('active').eq('email',email).maybeSingle()
  if(memberError||!member?.active)throw new Error('Cuenta del asistente desactivada')
  let result:any={authenticated:true,user_id:confirmed.user.id,email,session_verified:true}
  if(['save_expense','validate_expense'].includes(work.action)){
   const {expense,lines}=work.payload||{}
   if(!expense||!Array.isArray(lines)||!expense.request_id)throw new Error('Gasto, líneas y request_id obligatorios')
   if(expense.fiscal_reviewed!==undefined&&typeof expense.fiscal_reviewed!=='boolean')throw new Error('Revisión fiscal no válida')
   if(expense.id&&!Object.hasOwn(expense,'expected_updated_at'))throw new Error('Relee la ficha antes de editarla')
   const rpc=work.action==='save_expense'?'totus_save_expense':'totus_assistant_validate_expense'
   const {data:saved,error:saveError}=await scoped.rpc(rpc,{p_expense:expense,p_lines:lines})
   if(saveError)throw new Error(saveError.message)
   if(work.action==='validate_expense')result={...result,...saved,simulation:true,persisted:false}
   else {
    const {data:expenseRow,error:readError}=await scoped.from('ops_expenses').select('*').eq('id',saved).single()
    const {data:lineRows,error:lineError}=await scoped.from('ops_expense_lines').select('*').eq('expense_id',saved).order('sort_order')
    if(readError||lineError||expenseRow.created_by!==confirmed.user.id&&!expense.id)throw new Error('Guardado realizado; relectura pendiente. Consulta antes de reintentar.')
    result={...result,expense_id:saved,expense:expenseRow,lines:lineRows,persisted:true}
   }
  } else if(work.action==='attach_chat_file')result={...result,...await attachChatExpenseDocument(scoped,work.payload,confirmed.user)}
  else if(work.action==='expense_context')result={...result,...await readExpenseContext(scoped,work.payload)}
  else if(work.action==='review_document')result={...result,...await reviewExpenseDocument(scoped,work.payload)}
  else if(work.action==='chat_read')result={...result,...await readTeamChat(scoped,work.payload,confirmed.user)}
  else if(work.action==='chat_send')result={...result,...await sendTeamChat(scoped,work.payload,confirmed.user)}
  else if(work.action!=='session_check')throw new Error('Acción no admitida')
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
