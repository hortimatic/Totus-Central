// An approval callback must bind this proof to a
// server-side operation before the actual action may be dispatched.
const message='No se ha podido confirmar tu cuenta. Revisa la contraseña e inténtalo de nuevo.';
export function createPasswordConfirmation({createClient,url,key,primaryAuth,currentActor,uuid=()=>crypto.randomUUID()}){
 if(typeof createClient!=='function'||typeof primaryAuth?.getUser!=='function'||typeof currentActor!=='function')throw Error(message);
 const readUser=async()=>{try{return await primaryAuth.getUser();}catch{throw Error(message);}};
 return async function confirmPassword({password,approve}){
  let ephemeral;
  const actorId=currentActor();
  try{
   if(typeof password!=='string'||password.length===0||password.length>4096||typeof approve!=='function'||!actorId)throw Error(message);
   const initial=await readUser(),user=initial?.data?.user;
   if(initial?.error||user?.id!==actorId||typeof user.email!=='string'||!user.email.includes('@'))throw Error(message);
   try{ephemeral=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'totus-tpv-confirm-'+uuid()}});}catch{throw Error(message);}
   let response;
   try{response=await ephemeral.auth.signInWithPassword({email:user.email,password});}catch{throw Error(message);}finally{password='';}
   const session=response?.data?.session;
   if(response?.error||session?.user?.id!==actorId||typeof session.access_token!=='string'||session.access_token.length===0)throw Error(message);
   const fresh=await readUser();
   if(fresh?.error||fresh?.data?.user?.id!==actorId||currentActor()!==actorId)throw Error(message);
   return await approve(session.access_token);
  }finally{
   password='';
   // Only the disposable session is closed. Never use global sign-out, which
   // would close the main Central account and other workstations.
   if(ephemeral)try{await ephemeral.auth.signOut({scope:'local'});}catch{}
  }
 };
}
