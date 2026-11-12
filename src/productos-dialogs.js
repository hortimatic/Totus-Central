// Native modal focus trapping and Escape; one consistent close/return path.
export function showProductDialog(root,dialog,{label,trigger}={}){
 if(label)dialog.setAttribute('aria-label',label);
 dialog.setAttribute('aria-modal','true');
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
 });
 dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus({preventScroll:true});root.dispatchEvent(new Event('prd-dialog-close'));},{once:true});
 root.append(dialog);dialog.showModal();
}
const pendingDialogConfirmations=new WeakMap();
// Keep confirmations inside a native modal's top layer. A normal page overlay
// cannot receive focus or clicks while HTMLDialogElement.showModal is active.
export function confirmProductDialog(dialog,message,{acceptLabel='Continuar'}={}){
 if(pendingDialogConfirmations.has(dialog))return pendingDialogConfirmations.get(dialog);
 const promise=new Promise(resolve=>{const previous=document.activeElement,controls=[...dialog.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);for(const [el]of controls)el.disabled=true;
  const panel=document.createElement('section');panel.className='prd-dialog-confirm';panel.setAttribute('role','alertdialog');panel.setAttribute('aria-label','Confirmar acción');const text=document.createElement('p');text.textContent=message;const actions=document.createElement('div');actions.className='inline-actions';const cancel=document.createElement('button'),accept=document.createElement('button');for(const button of [cancel,accept]){button.type='button';button.className='btn secondary';}cancel.textContent='Cancelar';accept.textContent=acceptLabel;accept.className='btn primary';actions.append(cancel,accept);panel.append(text,actions);dialog.append(panel);
  let finished=false;const onCancel=event=>{event.preventDefault();event.stopImmediatePropagation();finish(false);};const onClose=()=>finish(false);function finish(result){if(finished)return;finished=true;dialog.removeEventListener('cancel',onCancel,true);dialog.removeEventListener('close',onClose);panel.remove();for(const [el,disabled]of controls)if(el.isConnected)el.disabled=disabled;pendingDialogConfirmations.delete(dialog);if(previous?.isConnected&&!previous.disabled)previous.focus({preventScroll:true});resolve(result);}
  cancel.onclick=event=>{event.stopPropagation();finish(false);};accept.onclick=event=>{event.stopPropagation();finish(true);};dialog.addEventListener('cancel',onCancel,true);dialog.addEventListener('close',onClose,{once:true});cancel.focus();
 });pendingDialogConfirmations.set(dialog,promise);return promise;
}
