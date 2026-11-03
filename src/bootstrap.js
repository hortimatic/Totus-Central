// Load the pinned, same-origin SDK before evaluating modules that create the client.
// A dependency failure must never leave the access screen checking indefinitely.
async function loadClient(){
 if(typeof window.supabase?.createClient==='function')return;
 await new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timer=setTimeout(()=>finish(Error('Tiempo de carga agotado')),15000);
  let settled=false;
  function finish(error){
   if(settled)return;settled=true;clearTimeout(timer);
   script.onload=null;script.onerror=null;
   if(error){script.remove();reject(error);}else resolve();
  }
  script.src=new URL('./vendor/supabase/supabase.js',import.meta.url).href;
  script.onload=()=>finish(typeof window.supabase?.createClient==='function'?null:Error('Cliente no disponible'));
  script.onerror=()=>finish(Error('No se pudo cargar el cliente'));
  document.head.append(script);
 });
}
try{
 await loadClient();
 await import('./app.js');
}catch{
 const message=document.getElementById('loginMessage');
 if(message){
  message.replaceChildren();message.setAttribute('role','alert');
  const text=document.createElement('p');
  text.textContent='No se ha podido iniciar Totus Central. Comprueba la conexión y vuelve a intentarlo. Tu sesión guardada se conserva.';
  const retry=document.createElement('button');retry.type='button';retry.className='btn primary';retry.textContent='Volver a intentar';
  // Reload also clears failed module imports cached by the browser; never clear Auth storage.
  retry.addEventListener('click',()=>location.reload());
  message.append(text,retry);
 }
}
