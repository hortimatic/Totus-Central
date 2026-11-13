import {WEBSITE_CHOICES} from './website-registry.js';
// Product photos stay recognizable in the grid, with one preview per workspace.
export function attachProductPhotoPreviews(root){
 let preview=null,current=null,dialog=null,suppressFocus=false;
 const controller=new AbortController(),signal=controller.signal;
 const largeSource=img=>{try{const url=new URL(img.currentSrc||img.src);if(!WEBSITE_CHOICES.some(s=>new URL(s.origin).hostname===url.hostname)||!/^\/\d+-[a-z_]+\/product\.jpg$/.test(url.pathname))return null;url.pathname=url.pathname.replace(/-home_default\//,'-large_default/');return url.href;}catch{return null;}};
 const hide=()=>{preview?.remove();preview=null;current?.removeAttribute('aria-describedby');current=null;};
 const show=(img,anchor)=>{
  const src=largeSource(img);if(!src)return;hide();current=anchor;
  preview=document.createElement('aside');preview.className='prd-photo-peek';preview.id='prd-photo-preview';preview.setAttribute('role','tooltip');
  const photo=document.createElement('img'),caption=document.createElement('span');photo.src=src;photo.alt=img.alt||'Producto';caption.textContent=img.alt||'Producto';preview.append(photo,caption);root.append(preview);anchor.setAttribute('aria-describedby',preview.id);
  const r=anchor.getBoundingClientRect(),width=Math.min(280,innerWidth-24),height=Math.min(320,innerHeight-24);
  Object.assign(preview.style,{width:width+'px',maxHeight:height+'px',left:(r.right+12+width<=innerWidth-12?r.right+12:Math.max(12,r.left-width-12))+'px',top:Math.max(12,Math.min(r.top,innerHeight-height-12))+'px'});
 };
 const zoom=(img,anchor)=>{
  const src=largeSource(img);if(!src)return;hide();suppressFocus=true;dialog?.close();const modal=document.createElement('dialog');dialog=modal;dialog.className='prd-product-photo-dialog';dialog.setAttribute('aria-label',img.alt||'Imagen del producto');
  const close=document.createElement('button'),photo=document.createElement('img'),caption=document.createElement('p');close.type='button';close.textContent='Cerrar imagen';photo.src=src;photo.alt=img.alt||'Producto';caption.textContent=photo.alt;dialog.append(close,photo,caption);close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{modal.remove();if(dialog===modal)dialog=null;if(anchor.isConnected)anchor.focus({preventScroll:true});hide();queueMicrotask(()=>{suppressFocus=false;});},{once:true});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});root.append(dialog);dialog.showModal();
 };
 for(const img of root.querySelectorAll('.prd-thumb[src],.prd-product-photo[src],.prd-variant-photo[src],.prd-photo-open img[src],.sticky-thumb-btn img[src],#sticky-main-img[src]')){
  if(!largeSource(img))continue;
  let anchor=img.closest('button,[role="button"]');
  if(!anchor){anchor=document.createElement('button');anchor.type='button';anchor.className='prd-photo-trigger';anchor.dataset.prPhotoPreview=largeSource(img);anchor.setAttribute('aria-label','Ampliar imagen de '+(img.alt||'producto'));img.before(anchor);anchor.append(img);anchor.addEventListener('click',()=>zoom(img,anchor),{signal});}
  anchor.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')show(img,anchor);},{signal});anchor.addEventListener('pointerleave',hide,{signal});anchor.addEventListener('focus',()=>{if(!suppressFocus)show(img,anchor);},{signal});anchor.addEventListener('blur',hide,{signal});
 }
 root.addEventListener('prd-dialog-close',hide,{signal});document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},{signal});document.addEventListener('scroll',hide,{signal,capture:true});window.addEventListener('resize',hide,{signal});
 return ()=>{controller.abort();hide();dialog?.remove();dialog=null;};
}
