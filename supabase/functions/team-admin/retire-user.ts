const checked=(result:any)=>{if(result.error)throw Error(result.error.message||'No se pudo retirar el usuario.');return result.data;};
export async function retireUserAccess({scoped,admin,email,existing}:any){
 checked(await scoped.rpc('totus_retire_user',{p_email:email}));
 try{
  if(existing)checked(await admin.auth.admin.updateUserById(existing.id,{ban_duration:'876000h'}));
  checked(await admin.from('team_members').update({auth_cleanup_pending:false}).eq('email',email));
  return {ok:true,retired:true,history_preserved:true,message:'Usuario eliminado de la lista. Acceso bloqueado; documentos e historial conservados.'};
 }catch{
  return {ok:true,retired:true,history_preserved:true,auth_cleanup_pending:true,message:'Acceso retirado en Totus. Queda pendiente completar el bloqueo de autenticación; reintenta desde Usuarios eliminados.'};
 }
}
