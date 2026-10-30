// Keep personal background bytes out of repeated conversation refreshes.
// Cache belongs to an authenticated session, never localStorage.
export function createChatPreferenceTransport({rpc,actor}){
 let owner='',generation=0,sequence=0,cache={hash:'',image:''};
 function reset(){owner='';generation++;cache={hash:'',image:''};}
 return {reset,async rpc(name,args){
  if(name!=='totus_chat_context')return rpc(name,args);
  const current=actor();if(!current)throw Error('Vuelve a iniciar sesión.');
  if(owner!==current){reset();owner=current;}
  const stamp=generation,request=++sequence,snapshot={...cache};
  const result=await rpc('totus_chat_personalized_context',{p_args:args,p_background_hash:snapshot.hash});
  if(stamp!==generation||owner!==actor())throw Object.assign(Error('La sesión ha cambiado.'),{contextChanged:true});
  const image=result.background_unchanged?snapshot.image:result.layout?.chat_background_image||'';
  if(request===sequence)cache={hash:result.background_hash||'',image};
  return {...result,layout:{...result.layout,chat_background_image:image}};
 }};
}
