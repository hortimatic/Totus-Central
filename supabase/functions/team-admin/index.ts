import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const APP_URL='https://hortimatic.github.io/Totus-Central/'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const mailMessage=(msg:string)=>/rate limit/i.test(msg)?'Límite del servidor de correo de Supabase alcanzado. El correo NO se ha enviado.':msg

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return json({error:'Método no permitido'},405)
 try{
  const authHeader=req.headers.get('Authorization')||''
  const publishable=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||''
  const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
  const url=Deno.env.get('SUPABASE_URL')||''
  if(!url||!publishable||!secret)return json({error:'Configuración de Supabase incompleta'},500)
  const scoped=createClient(url,publishable,{global:{headers:{Authorization:authHeader}}})
  const publicAuth=createClient(url,publishable,{auth:{autoRefreshToken:false,persistSession:false}})
  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}})
  const token=authHeader.replace(/^Bearer\s+/i,'')
  const {data:authData,error:authError}=await scoped.auth.getUser(token)
  if(authError||!authData.user?.email)return json({error:'Sesión no válida'},401)
  const callerEmail=authData.user.email.toLowerCase()
  const {data:caller,error:callerError}=await admin.from('team_members').select('email,role,active').eq('email',callerEmail).maybeSingle()
  if(callerError)return json({error:callerError.message},500)
  if(!caller?.active||caller.role!=='admin')return json({error:'Solo el administrador puede gestionar usuarios'},403)

  const body=await req.json(),action=String(body?.action||'')
  const cleanEmail=(v:unknown)=>String(v||'').trim().toLowerCase(),cleanText=(v:unknown)=>String(v||'').trim();const validRole=async (r:string)=>{if(!/^[a-z][a-z0-9_]{2,31}$/.test(r))return false;const {data,error}=await admin.from('ops_roles').select('code').eq('code',r).maybeSingle();if(error)throw error;return !!data}
  const listAuthUsers=async()=>{const users=[];for(let page=1;;page++){const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});if(error)throw error;const batch=data.users||[];users.push(...batch);if(batch.length<1000)return users}}
  const findAuthUser=async(email:string)=>(await listAuthUsers()).find(u=>(u.email||'').toLowerCase()===email)||null
  const countActiveAdmins=async()=>{const {count,error}=await admin.from('team_members').select('*',{count:'exact',head:true}).eq('role','admin').eq('active',true);if(error)throw error;return count||0}
  const audit=async(target:string,act:string,status:'ok'|'failed',detail='')=>{await admin.from('team_user_audit_log').insert({actor_email:callerEmail,target_email:target,action:act,status,detail})}
  const logEmail=async(target:string,type:string,status:'sent'|'failed',detail='')=>{await admin.from('team_email_log').insert({recipient_email:target,email_type:type,status,detail,requested_by:callerEmail})}
  const ensureMember=async(email:string,fullName:string,role:string,active=true)=>{const {error}=await admin.from('team_members').upsert({email,full_name:fullName,role,active,phone:cleanText(body.phone)||null,job_title:cleanText(body.job_title)||null,store:cleanText(body.store)||null,employee_notes:cleanText(body.employee_notes)||null,updated_at:new Date().toISOString()},{onConflict:'email'});if(error)throw error}
  const lastAdminGuard=async(email:string,nextRole?:string,nextActive?:boolean,deleting=false)=>{const {data:current}=await admin.from('team_members').select('email,role,active').eq('email',email).maybeSingle();if(!current?.active||current.role!=='admin')return;const loses=deleting||nextActive===false||(nextRole&&nextRole!=='admin');if(loses&&(await countActiveAdmins())<=1)throw new Error('No puedes dejar el sistema sin ningún administrador activo.')}
  const sendRecovery=async(email:string,source:string)=>{
    const {error}=await publicAuth.auth.resetPasswordForEmail(email,{redirectTo:APP_URL})
    if(error)throw error
    await logEmail(email,'Restablecimiento de contraseña','sent',`Supabase aceptó el envío (${source})`)
    await audit(email,'password_reset_email','ok',`Solicitud de recuperación aceptada (${source})`)
  }

  if(action==='create_user'||action==='set_password'){
   const email=cleanEmail(body.email),fullName=cleanText(body.full_name),role=cleanText(body.role),password=String(body.password||'')
   if(!validEmail(email))return json({error:'Email no válido'},400)
   if(!fullName||!(await validRole(role)))return json({error:'Nombre y rol válidos son obligatorios'},400)
   if(password.length<12)return json({error:'La contraseña debe tener al menos 12 caracteres'},400)
   if(email===callerEmail&&action==='create_user')return json({error:'Ese usuario ya es tu cuenta de administrador.'},400)
   try{
    const existing=await findAuthUser(email)
    if(action==='create_user'&&existing)return json({error:'Ese email ya tiene una cuenta. Edita su ficha o asigna una nueva contraseña.'},409)
    if(existing){
     // Credential maintenance must not change roles or reactivate revoked access.
     const {data:member,error:memberError}=await admin.from('team_members').select('full_name,role,active').eq('email',email).maybeSingle();
     if(memberError)throw memberError;
     if(!member)return json({error:'La cuenta no tiene una ficha de equipo. Revisa su alta antes de asignar contraseña.'},409);
     const {error}=await admin.auth.admin.updateUserById(existing.id,{password,email_confirm:true,user_metadata:{full_name:member.full_name,role:member.role}});
     if(error)throw error;
     await audit(email,'password_assigned','ok','Contraseña actualizada; rol y estado de acceso conservados');
     return json({ok:true,message:'Contraseña actualizada. El rol y el estado de acceso no han cambiado.'});
    }
    if(action==='set_password')return json({error:'La cuenta no existe. Crea el usuario desde Nuevo usuario.'},404);
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,role}});if(error)throw error
    try{await ensureMember(email,fullName,role,true)}catch(e){if(data.user?.id)await admin.auth.admin.deleteUser(data.user.id);throw e}
    await audit(email,'user_created','ok','Cuenta creada directamente con contraseña')
    return json({ok:true,created:true,user_id:data.user?.id,message:'Usuario creado. Ya puede iniciar sesión.'})
   }catch(e){const msg=e instanceof Error?e.message:'Error creando usuario';await audit(email,action==='create_user'?'user_created':'password_assigned','failed',msg);return json({error:msg},400)}
  }

  if(action==='invite'||action==='resend_invite'){
   const email=cleanEmail(body.email),fullName=cleanText(body.full_name),role=cleanText(body.role)
   if(!validEmail(email))return json({error:'Email no válido'},400)
   if(!fullName||!(await validRole(role)))return json({error:'Nombre y rol válidos son obligatorios'},400)
   try{
    let existing=await findAuthUser(email)
    if(existing?.email_confirmed_at){
      await sendRecovery(email,action==='resend_invite'?'reenviar sobre cuenta confirmada':'invitar cuenta ya confirmada')
      await audit(email,action,'ok','Cuenta ya confirmada: se sustituyó invitación por recuperación de contraseña')
      return json({ok:true,converted_to_reset:true,message:'La cuenta ya estaba confirmada. Se ha enviado un correo para crear o restablecer su contraseña.'})
    }
    if(action==='resend_invite'&&existing){
      if(existing.last_sign_in_at){
        await sendRecovery(email,'reenviar sobre cuenta ya utilizada')
        return json({ok:true,converted_to_reset:true,message:'La cuenta ya se había utilizado. Se ha enviado un correo para restablecer la contraseña.'})
      }
      const {error}=await admin.auth.admin.deleteUser(existing.id);if(error)throw error;existing=null
    } else if(action==='invite'&&existing)return json({error:'Ya existe una invitación pendiente. Usa Reenviar invitación.'},409)
    const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:APP_URL,data:{full_name:fullName,role}});if(error)throw error
    await ensureMember(email,fullName,role,true)
    const label=action==='resend_invite'?'Reenvío de invitación':'Invitación'
    await logEmail(email,label,'sent','Supabase aceptó la solicitud de envío')
    await audit(email,action,'ok','Solicitud de email aceptada por Supabase')
    return json({ok:true,user_id:data.user?.id,message:action==='resend_invite'?'Invitación reenviada.':'Invitación enviada.'})
   }catch(e){const raw=e instanceof Error?e.message:'Error enviando invitación',msg=mailMessage(raw);await logEmail(email,action==='resend_invite'?'Reenvío de invitación':'Invitación','failed',raw);await audit(email,action,'failed',raw);return json({error:msg},400)}
  }

  if(action==='send_password_reset'){
   const email=cleanEmail(body.email);if(!validEmail(email))return json({error:'Email no válido'},400)
   try{
    const existing=await findAuthUser(email)
    if(!existing)return json({error:'Este email todavía no tiene una cuenta creada.'},404)
    await sendRecovery(email,'botón restablecimiento')
    return json({ok:true,message:'Correo de restablecimiento enviado.'})
   }catch(e){const raw=e instanceof Error?e.message:'Error enviando restablecimiento',msg=mailMessage(raw);await logEmail(email,'Restablecimiento de contraseña','failed',raw);await audit(email,'password_reset_email','failed',raw);return json({error:msg},400)}
  }

  if(action==='update_member'){
   const email=cleanEmail(body.email),fullName=cleanText(body.full_name),role=cleanText(body.role),active=body.active!==false
   if(!validEmail(email)||!fullName||!(await validRole(role)))return json({error:'Datos de usuario no válidos'},400)
   try{await lastAdminGuard(email,role,active,false);const payload={full_name:fullName,role,active,phone:cleanText(body.phone)||null,job_title:cleanText(body.job_title)||null,store:cleanText(body.store)||null,employee_notes:cleanText(body.employee_notes)||null,updated_at:new Date().toISOString()};const {error}=await admin.from('team_members').update(payload).eq('email',email);if(error)throw error;const existing=await findAuthUser(email);if(existing){const {error:aerr}=await admin.auth.admin.updateUserById(existing.id,{user_metadata:{full_name:fullName,role}});if(aerr)throw aerr}await audit(email,'member_updated','ok',`Rol: ${role}; activo: ${active}`);return json({ok:true,message:'Ficha de usuario actualizada.'})}catch(e){const msg=e instanceof Error?e.message:'Error actualizando usuario';await audit(email,'member_updated','failed',msg);return json({error:msg},400)}
  }

  if(action==='set_active'){
   const email=cleanEmail(body.email),active=!!body.active;if(!validEmail(email))return json({error:'Email no válido'},400);if(email===callerEmail&&!active)return json({error:'No puedes desactivar tu propia cuenta.'},400)
   try{await lastAdminGuard(email,undefined,active,false);const {error}=await admin.from('team_members').update({active,updated_at:new Date().toISOString()}).eq('email',email);if(error)throw error;await audit(email,active?'user_activated':'user_deactivated','ok',active?'Acceso activado':'Acceso desactivado');return json({ok:true,message:active?'Usuario activado.':'Usuario desactivado.'})}catch(e){const msg=e instanceof Error?e.message:'Error cambiando estado';await audit(email,active?'user_activated':'user_deactivated','failed',msg);return json({error:msg},400)}
  }

  if(action==='delete'||action==='hard_delete'){
   const email=cleanEmail(body.email);if(!validEmail(email))return json({error:'Email no válido'},400);if(email===callerEmail)return json({error:'No puedes eliminar tu propia cuenta de administrador.'},400)
   try{await lastAdminGuard(email,undefined,false,true);const existing=await findAuthUser(email);if(existing){const {error}=await admin.auth.admin.deleteUser(existing.id);if(error)throw error}if(action==='hard_delete'){const {error}=await admin.from('team_members').delete().eq('email',email);if(error)throw error;await audit(email,'user_deleted','ok','Cuenta Auth y ficha eliminadas definitivamente');return json({ok:true,message:'Usuario eliminado definitivamente.'})}const {error}=await admin.from('team_members').update({active:false,updated_at:new Date().toISOString()}).eq('email',email);if(error)throw error;await audit(email,'access_revoked','ok','Cuenta Auth eliminada; ficha conservada inactiva');return json({ok:true,message:'Acceso revocado. La ficha se conserva inactiva.'})}catch(e){const msg=e instanceof Error?e.message:'Error eliminando usuario';await audit(email,action==='hard_delete'?'user_deleted':'access_revoked','failed',msg);return json({error:msg},400)}
  }

  if(action==='list'){
   const {data,error}=await admin.from('team_members').select('email,full_name,role,active,created_at,phone,job_title,store,employee_notes,avatar_url,avatar_path,updated_at').order('full_name');if(error)return json({error:error.message},400)
   let users:any[]=[];try{users=await listAuthUsers()}catch(e){return json({error:e instanceof Error?e.message:'Error consultando autenticación'},400)}
   const result=(data||[]).map(m=>{const au=users.find(u=>(u.email||'').toLowerCase()===m.email.toLowerCase());return{...m,registered:!!au,confirmed:!!au?.email_confirmed_at,email_confirmed_at:au?.email_confirmed_at||null,last_sign_in_at:au?.last_sign_in_at||null,auth_created_at:au?.created_at||null}})
   return json({ok:true,users:result})
  }
  if(action==='email_log'){const {data,error}=await admin.from('team_email_log').select('id,created_at,recipient_email,email_type,status,detail,requested_by').order('created_at',{ascending:false}).limit(200);if(error)return json({error:error.message},400);return json({ok:true,emails:data||[]})}
  if(action==='audit_log'){const {data,error}=await admin.from('team_user_audit_log').select('id,created_at,actor_email,target_email,action,status,detail').order('created_at',{ascending:false}).limit(300);if(error)return json({error:error.message},400);return json({ok:true,actions:data||[]})}
  return json({error:'Acción desconocida'},400)
 }catch(e){return json({error:e instanceof Error?e.message:'Error interno'},500)}
})
