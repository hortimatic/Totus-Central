import { createClient } from 'npm:@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Método no permitido'},405)
  try{
    const authHeader=req.headers.get('Authorization')||''
    const token=authHeader.replace(/^Bearer\s+/i,'')
    if(!token)return json({error:'Sesión no válida'},401)

    const url=Deno.env.get('SUPABASE_URL')||''
    const publishable=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||''
    const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
    if(!url||!publishable||!secret)return json({error:'Configuración de Supabase incompleta'},500)

    const scoped=createClient(url,publishable,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}})
    const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:authData,error:authError}=await scoped.auth.getUser(token)
    if(authError||!authData.user?.email)return json({error:'Sesión no válida'},401)

    const email=authData.user.email.toLowerCase()
    const {data:member,error:memberError}=await service.from('team_members').select('email,role,active').eq('email',email).maybeSingle()
    if(memberError)return json({error:memberError.message},500)
    if(!member?.active||member.role!=='admin')return json({error:'Solo administración puede restaurar copias'},403)

    const body=await req.json().catch(()=>({}))
    const tables=body?.tables
    const reason=String(body?.reason||'').trim()
    if(!tables||typeof tables!=='object'||Array.isArray(tables))return json({error:'Backup no válido'},400)
    if(!reason)return json({error:'El motivo es obligatorio'},400)

    const {data,error}=await service.rpc('ops_restore_backup_data',{p_tables:tables,p_reason:reason})
    if(error)return json({error:error.message},400)
    return json({ok:true,...(data||{})})
  }catch(e){
    return json({error:e instanceof Error?e.message:'Error interno'},500)
  }
})