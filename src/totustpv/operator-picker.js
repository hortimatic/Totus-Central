const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
export function operatorChoices(value,owner){
 if(value?.actorId!==owner||!Array.isArray(value.items)||value.items.length>2000||value.items.some(r=>!uuid(r?.operatorId)||typeof r.name!=='string'||!r.name.trim()||r.name.length>200||/[\x00-\x1f\x7f]/.test(r.name)||typeof r.loginEmail!=='string'||r.loginEmail.length>254||!/^([^\s@]+)@([^\s@]+)$/.test(r.loginEmail))||new Set(value.items.map(r=>r.operatorId)).size!==value.items.length)throw Error('No se han podido comprobar los operadores de este puesto.');
 return value.items.map(r=>({operatorId:r.operatorId,name:r.name,loginEmail:r.loginEmail})).sort((a,b)=>a.name.localeCompare(b.name,'es')||a.operatorId.localeCompare(b.operatorId));
}
export function createOperatorPicker(){let active=null;
 function cancel(){active?.finish(null);}
 async function choose({items=[],unavailable=false}={}){
  if(active)throw Error('Termina primero el cambio de operador.');
  const names=new Map();for(const row of items)names.set(row.name,(names.get(row.name)||0)+1);
  return new Promise(resolve=>{const dialog=document.createElement('dialog');let settled=false;const entry={finish};active=entry;
   function finish(value){if(settled)return;settled=true;if(active===entry)active=null;if(dialog.open)dialog.close();dialog.remove();resolve(value);}
   dialog.className='tpv-quantity-dialog tpv-operator-dialog';dialog.setAttribute('aria-labelledby','tpvOperatorTitle');dialog.innerHTML=`<form><p class="small muted">Cambio de operador</p><h3 id="tpvOperatorTitle">¿Quién va a continuar?</h3><p>Se cerrará tu sesión de Central en este equipo. La caja seguirá abierta. La siguiente persona tendrá que entrar con su cuenta y sus permisos.</p>${unavailable?'<p role="status">No se ha podido consultar la lista del puesto. Puedes acceder con otra cuenta de Central.</p>':''}<label class="field">Operador<select name="operator" required><option value="" selected disabled>Elige una persona</option>${items.map(r=>`<option value="${esc(r.operatorId)}">${esc(r.name)}${names.get(r.name)>1?' · '+esc(r.loginEmail):''}</option>`).join('')}<option value="other">Otra cuenta de Central</option></select></label><p class="small muted">La selección prepara el acceso. No registra ventas ni cambia los permisos de ninguna cuenta.</p><footer><button type="button" class="btn secondary" data-operator-cancel>Cancelar cambio</button><button class="btn primary" type="submit">Cerrar sesión y acceder</button></footer></form>`;
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));dialog.querySelector('[data-operator-cancel]').onclick=()=>finish(null);
   dialog.querySelector('form').onsubmit=event=>{event.preventDefault();const selected=dialog.querySelector('select').value;if(selected==='other')finish({loginEmail:'',name:''});else{const row=items.find(r=>r.operatorId===selected);if(row)finish({...row});}};
   document.body.append(dialog);dialog.showModal();dialog.querySelector('select').focus();
  });
 }
 return {choose,cancel};
}
