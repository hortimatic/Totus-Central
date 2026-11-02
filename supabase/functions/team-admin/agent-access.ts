const check=(r:any)=>{if(r.error)throw Error(r.error.message||'No se pudo preparar el acceso de IA.');return r.data;};
export async function configureAgentAccess({admin,loginClient,email,password,legacy,caller,findUser}:any){
 if(email===caller.email?.toLowerCase())throw Error('Selecciona la cuenta propia de la IA, no tu cuenta personal.');
 const member=check(await admin.from('team_members').select('email,active,deleted_at,purged_at').eq('email',email).maybeSingle());
 if(!member?.active||member.deleted_at||member.purged_at)throw Error('La cuenta de IA debe estar activa.');
 const target=await findUser(email);if(!target)throw Error('Crea primero la cuenta de la IA en Usuarios.');
 let credentials={email,password};
 if(!password)credentials=check(await admin.rpc('totus_agent_managed_credentials',{p_user:target.id}));
 if(credentials?.email!==email||typeof credentials.password!=='string'||!credentials.password||credentials.password.length>1024)throw Error('Introduce la contraseña actual de esta cuenta en el campo privado.');
 try{
  const result=await loginClient.auth.signInWithPassword(credentials);
  if(result.error||!result.data?.session||result.data.user?.id!==target.id)throw Error('No se pudo verificar la contraseña de la cuenta seleccionada.');
  const verified=await loginClient.auth.getUser();if(verified.error||verified.data?.user?.id!==target.id)throw Error('No se pudo comprobar la sesión propia.');
  check(await admin.auth.admin.updateUserById(target.id,{app_metadata:{...target.app_metadata,totus_agent:true,totus_assistant:true}}));
  return check(await admin.rpc('totus_agent_bind_account',{p_user:target.id,p_password:credentials.password,p_legacy_chatgpt:legacy===true,p_admin:caller.id}));
 }finally{await loginClient.auth.signOut({scope:'local'}).catch(()=>{});}
}
