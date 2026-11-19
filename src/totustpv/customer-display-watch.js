// Runs in the public-facing window's realm, without authentication or storage.
// If the cashier tab stops updating, remove every item and amount promptly.
window.opener=null;
document.addEventListener('click',event=>{if(event.target.closest('[data-display-fullscreen]'))void document.documentElement.requestFullscreen?.().catch(()=>{});});
setInterval(()=>{const last=Number(document.body?.dataset.tpvHeartbeat);
 if(!last||Date.now()-last>10000){
  document.querySelector('[data-display-lines]')?.replaceChildren();
  const customer=document.querySelector('[data-display-customer]');if(customer)customer.textContent='';
  const total=document.querySelector('[data-display-total]');if(total)total.hidden=true;
  const amount=document.querySelector('[data-display-amount]');if(amount)amount.textContent='';
  const discount=document.querySelector('[data-display-discount]');if(discount)discount.textContent='';
  const title=document.querySelector('[data-display-title]');if(title)title.textContent='Pantalla en espera';
  const message=document.querySelector('[data-display-message]');if(message)message.textContent='La persona que te atiende reconectará el mostrador.';
 }
},1000);
