// Hold an incoming account only in memory until its workstation access has
// been checked. Failed or cancelled handoffs never sign out the current user.
const denied=()=>Error('No se ha podido iniciar la cuenta seleccionada. Tu sesión sigue abierta.');
export function createOperatorLogin({createClient,url,key,primaryAuth,currentActor,uuid=()=>crypto.randomUUID()}){
 return async function prepare({target,password,verify,isCurrent=()=>true}){
  const owner=currentActor();let client,retained=false;
  const close=async()=>{if(client)try{await client.auth.signOut({scope:'local'});}catch{}};
  const current=async()=>{
   if(!owner||currentActor()!==owner||!isCurrent())throw denied();
   let result;try{result=await primaryAuth.getUser();}catch{throw denied();}
   if(result?.error||result?.data?.user?.id!==owner||currentActor()!==owner||!isCurrent())throw denied();
  };
  try{
   if(!target?.operatorId||target.operatorId===owner||typeof target.loginEmail!=='string'||!target.loginEmail.includes('@')||typeof password!=='string'||!password||password.length>4096||typeof verify!=='function')throw denied();
   await current();
   try{client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'totus-tpv-incoming-'+uuid()}});}catch{throw denied();}
   let response;try{response=await client.auth.signInWithPassword({email:target.loginEmail,password});}catch{throw denied();}finally{password='';}
   const session=response?.data?.session;
   if(response?.error||session?.user?.id!==target.operatorId||typeof session.access_token!=='string'||!session.access_token||typeof session.refresh_token!=='string'||!session.refresh_token)throw denied();
   await current();
   const verification=await verify(session.access_token);
   await current();
   if(verification?.verified!==true||verification?.target?.operatorId!==target.operatorId)throw denied();
   let state='prepared';
   const transfer=Object.freeze({verification,
    async cancel(){if(!['prepared','checking'].includes(state))return;state='cancelled';await close();},
    async adopt(){
     if(state!=='prepared')throw denied();
     state='checking';
     try{
      await current();if(state!=='checking')throw denied();state='adopting';
      // setSession emits the real account transition. The application clears
      // the previous user's data and reloads the incoming user's permissions.
      const result=await primaryAuth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
      if(result?.error||result?.data?.session?.user?.id!==target.operatorId)throw denied();
      state='adopted';return verification;
     }catch{if(state!=='cancelled'){state='failed';await close();}throw denied();}
    }
   });
   retained=true;return transfer;
  }finally{password='';if(!retained)await close();}
 };
}
