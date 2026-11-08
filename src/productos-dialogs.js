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
