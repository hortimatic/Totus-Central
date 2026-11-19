const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function selectedQuantity(value,min,max){
 if(typeof value!=='string'||!/^\d{1,5}$/.test(value)||!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max>10000||max<min)throw Error('Revisa las unidades que quieres añadir.');
 const quantity=Number(value);if(quantity<min||quantity>max)throw Error(`Elige entre ${min} y ${max} unidades.`);return quantity;
}
/** One explicit choice. It never writes a ticket or sends a native request. */
export function createQuantityPicker(){
 let active=null;
 function cancel(){active?.finish(null);}
 async function choose({name,min=1,max=10000}){
  if(active)throw Error('Termina primero la selección de cantidad.');selectedQuantity(String(min),min,max);
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog'),entry={finish};let settled=false;active=entry;
   function finish(value){if(settled)return;settled=true;if(active===entry)active=null;if(dialog.open)dialog.close();dialog.remove();resolve(value);}
   dialog.className='tpv-quantity-dialog';dialog.setAttribute('aria-labelledby','tpvQuantityTitle');
   dialog.innerHTML=`<form><p class="small muted">Añadir al ticket</p><h3 id="tpvQuantityTitle">¿Cuántas unidades?</h3><p class="tpv-quantity-name">${esc(name)}</p><label>Unidades que añadir<input name="quantity" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" required value="${min}" autocomplete="off"></label><p class="small muted">Entre ${min} y ${max} unidades. Se suman a las que ya tenga el ticket.</p><p role="alert" hidden></p><footer><button type="button" class="btn secondary" data-quantity-cancel>Cancelar</button><button class="btn primary" type="submit">Añadir al ticket</button></footer></form>`;
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));
   dialog.querySelector('[data-quantity-cancel]').onclick=()=>finish(null);
   dialog.querySelector('form').onsubmit=event=>{event.preventDefault();const input=dialog.querySelector('input');try{finish(selectedQuantity(input.value,min,max));}catch(error){const message=dialog.querySelector('[role=alert]');message.textContent=error.message;message.hidden=false;input.focus();}};
   document.body.append(dialog);dialog.showModal();dialog.querySelector('input').focus();dialog.querySelector('input').select();
  });
 }
 return {choose,cancel};
}
