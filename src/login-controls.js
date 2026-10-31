/** Password visibility is local to the form; it never stores or transmits a value. */
export function enhancePasswordVisibility(root){
 if(!root)return;
 for(const input of root.querySelectorAll('input[type="password"]')){
  if(input.closest('.password-control'))continue;
  const wrap=document.createElement('span');wrap.className='password-control';
  input.before(wrap);wrap.append(input);
  const button=document.createElement('button');button.type='button';button.className='password-toggle';
  button.disabled=input.disabled;
  if(input.id)button.setAttribute('aria-controls',input.id);
  button.setAttribute('aria-label','Mostrar contraseña');button.setAttribute('aria-pressed','false');
  button.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="m3 3 18 18"/></svg>';
  button.addEventListener('click',()=>{
   const visible=input.type==='password';input.type=visible?'text':'password';
   button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');
  });wrap.append(button);
 }
}
export function hidePasswords(root){
 for(const wrap of root?.querySelectorAll('.password-control')||[]){
  const input=wrap.querySelector('input'),button=wrap.querySelector('.password-toggle');
  if(!input||!button)continue;
  input.type='password';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Mostrar contraseña');
 }
}
