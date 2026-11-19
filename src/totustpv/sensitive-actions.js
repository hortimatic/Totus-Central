const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sensitiveSettings(value={requireRefund:false,requirePrice:false,revision:0}){
 if(!value||typeof value.requireRefund!=='boolean'||typeof value.requirePrice!=='boolean'||!Number.isSafeInteger(value.revision)||value.revision<0||Object.keys(value).some(k=>!['requireRefund','requirePrice','revision'].includes(k)))throw Error('No se han podido comprobar las confirmaciones de cuenta.');
 return {...value};
}
export function sensitiveSettingsHtml(value,canEdit,draft){const rules=sensitiveSettings(value);return `<section class="tpv-sensitive-settings"><h4>Confirmación de cuenta · esta caja</h4><form data-tpv-form="sensitive-settings"><label class="tpv-check"><input type="checkbox" name="requireRefund" ${(draft?draft.requireRefund==='on':rules.requireRefund)?'checked':''} ${canEdit?'':'disabled'}> Pedir mi contraseña antes de confirmar una devolución</label><label class="tpv-check"><input type="checkbox" name="requirePrice" ${(draft?draft.requirePrice==='on':rules.requirePrice)?'checked':''} ${canEdit?'':'disabled'}> Pedir mi contraseña al cobrar un ticket con precio modificado</label><p class="small muted">Usa tu cuenta de Central. La confirmación corresponde sólo a esa operación y no concede permisos adicionales. El ticket se conserva si cancelas.</p><div class="inline-actions">${canEdit?'<button type="submit" class="btn primary">Guardar confirmaciones</button>':''}<button type="button" class="btn secondary" data-tpv-action="refresh-sensitive-settings">Volver a consultar</button></div></form></section>`;}
export function createPasswordPrompt(){let active=null;
 function cancel(){active?.finish(null);}
 function request({account,purpose,confirm,isCurrent=()=>true,disposeResult=async()=>{},description='Cancelar conserva el ticket. Esta confirmación no realiza un cobro.'}){
  if(active)throw Error('Termina primero la confirmación de cuenta.');
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');let settled=false,busy=false;const entry={finish};active=entry;
   function finish(value){if(settled)return;settled=true;if(active===entry)active=null;dialog.querySelector('input').value='';if(dialog.open)dialog.close();dialog.remove();resolve(value);}
   dialog.className='tpv-quantity-dialog';dialog.setAttribute('aria-labelledby','tpvPasswordTitle');
   dialog.innerHTML=`<form><p class="small muted">Confirmación de cuenta</p><h3 id="tpvPasswordTitle">Autorizar ${esc(purpose)}</h3><p>Cuenta: <strong>${esc(account)}</strong></p><label class="field">Tu contraseña de Central<input name="password" type="password" autocomplete="current-password" required maxlength="4096"></label><label class="tpv-check"><input type="checkbox" data-show-password> Mostrar contraseña</label><p role="alert" hidden></p><p class="small muted">${esc(description)}</p><footer><button type="button" class="btn secondary" data-password-cancel>Cancelar</button><button type="submit" class="btn primary">Confirmar mi cuenta</button></footer></form>`;
   dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));
   dialog.querySelector('[data-password-cancel]').onclick=()=>finish(null);
   const input=dialog.querySelector('[name=password]'),submit=dialog.querySelector('[type=submit]'),alert=dialog.querySelector('[role=alert]');
   dialog.querySelector('[data-show-password]').onchange=e=>{input.type=e.target.checked?'text':'password';};
   dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy||settled)return;if(!isCurrent()){finish(null);return;}busy=true;submit.disabled=true;alert.hidden=true;let password=input.value;input.value='';
    try{const value=await confirm(password);if(!settled&&isCurrent())finish(value);else {await disposeResult(value);finish(null);}}catch(error){if(!settled){if(!isCurrent()){finish(null);return;}alert.textContent=error?.message||'No se ha podido confirmar tu cuenta.';alert.hidden=false;input.focus();}}finally{password='';busy=false;if(!settled)submit.disabled=false;}
   };
   document.body.append(dialog);dialog.showModal();input.focus();
  });
 }
 return {request,cancel};
}
