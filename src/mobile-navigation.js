/** Responsive navigation only; does not reorder or authorize routes. */
export function createMobileNavigation(){
 const sidebar=document.querySelector('.sidebar'),trigger=document.querySelector('[data-action="toggle-menu"]'),media=matchMedia('(max-width:800px)');
 const shade=document.createElement('button');shade.type='button';shade.className='mobile-nav-shade';shade.setAttribute('aria-label','Cerrar menú');shade.hidden=true;document.body.append(shade);
 const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='mobile-nav-close';dismiss.textContent='Cerrar menú ×';sidebar.prepend(dismiss);
 sidebar.id='moduleNavigation';trigger.setAttribute('aria-controls',sidebar.id);trigger.setAttribute('aria-expanded','false');
 let expanded=false;
 const sync=()=>{
  const opened=media.matches&&expanded;document.body.classList.toggle('menu-open',opened);shade.hidden=!opened;sidebar.inert=media.matches&&!opened;
  trigger.setAttribute('aria-expanded',String(opened));
  if(opened){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','Módulos de Totus Central');}
  else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');sidebar.removeAttribute('aria-label');}
 };
 const close=(focus=true)=>{expanded=false;sync();if(focus&&media.matches)trigger.focus();};
 shade.onclick=()=>close();dismiss.onclick=()=>close();
 document.addEventListener('keydown',event=>{
  if(!media.matches||!expanded)return;
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Tab'){
   const elements=[...sidebar.querySelectorAll('button,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length),first=elements[0],last=elements.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!sidebar.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!sidebar.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
 });
 media.addEventListener('change',()=>{expanded=false;sync();});sync();
 return {toggle(){if(!media.matches)return;expanded=!expanded;sync();if(expanded)dismiss.focus();else trigger.focus();},close};
}
