const checked=(result:any)=>{if(result.error)throw Error(result.error.message||'No se pudo eliminar definitivamente el usuario.');return result.data;};
export async function purgeUserAccess({scoped,admin,email}:any){
 const prepared=checked(await scoped.rpc('totus_prepare_user_purge',{p_email:email}));
 if(prepared.auth_id){
  const result=await admin.auth.admin.getUserById(prepared.auth_id);
  if(result.error&&result.error.status!==404)throw result.error;
  // Auth's irreversible soft deletion removes credentials and sessions while
  // retaining the UUID referenced by existing messages, tasks and documents.
  if(result.data?.user&&!result.data.user.deleted_at)checked(await admin.auth.admin.deleteUser(prepared.auth_id,true));
 }
 checked(await scoped.rpc('totus_finish_user_purge',{p_email:email}));
 return {ok:true,purged:true,history_preserved:true,message:'Cuenta eliminada definitivamente. Documentos y movimientos conservados; el usuario ya no se puede recuperar.'};
}
