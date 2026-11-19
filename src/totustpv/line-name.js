export function lineName(value){
 if(value===undefined)return undefined;
 if(typeof value!=='string')throw Error('TPV_LINE_NAME_INVALID');
 const name=value.replace(/^ +| +$/g,'');
 if(Array.from(name).length>255||/[\u0000-\u001f\u007f\uD800-\uDFFF<>={}]/u.test(name))throw Error('TPV_LINE_NAME_INVALID');
 return name||undefined;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
/** Local choice only; cancellation never changes a ticket or calls a server. */
export function createLineNameEditor(){
 let active=null;
 const cancel=()=>active?.finish(null);
 function choose({name,originalName,canRename=true}){
  if(active)throw Error('Termina primero la edición del nombre.');
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');let settled=false;
   function finish(value){if(settled)return;settled=true;active=null;if(dialog.open)dialog.close();dialog.remove();resolve(value);}
   active={finish};dialog.className='tpv-quantity-dialog';dialog.setAttribute('aria-labelledby','tpvLineNameTitle');
   dialog.innerHTML=`<form><p class="small muted">Artículo de esta venta</p><h3 id="tpvLineNameTitle">Nombre en el ticket</h3><label>Nombre<input name="lineName" value="${esc(name)}" autocomplete="off" ${canRename?'':'readonly'}></label><p class="small muted">Solo cambia esta venta. El nombre del catálogo se conserva. Hasta 255 caracteres.</p><p class="small muted">Nombre del catálogo: ${esc(originalName)}</p><p role="alert" hidden></p><button type="button" class="btn secondary" data-line-name-restore>Usar nombre del catálogo</button><footer><button type="button" class="btn secondary" data-line-name-cancel>Cancelar</button><button type="submit" class="btn primary" ${canRename?'':'disabled'}>Guardar nombre</button></footer></form>`;
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));
   dialog.querySelector('[data-line-name-cancel]').onclick=()=>finish(null);dialog.querySelector('[data-line-name-restore]').onclick=()=>finish('');
   dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(!canRename)return;try{const value=lineName(dialog.querySelector('input').value);if(value===undefined)throw Error('Escribe un nombre o usa el nombre del catálogo.');finish(value);}catch{const message=dialog.querySelector('[role=alert]');message.textContent='Escribe un nombre de hasta 255 caracteres, sin saltos de línea ni símbolos < > = { }.';message.hidden=false;dialog.querySelector('input').focus();}};
   document.body.append(dialog);dialog.showModal();dialog.querySelector('input').focus();dialog.querySelector('input').select();
  });
 }
 return {choose,cancel};
}
