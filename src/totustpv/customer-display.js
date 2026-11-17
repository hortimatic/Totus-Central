const clean=(value,max=160)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
const amount=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000000000?value:null;
export const CUSTOMER_DISPLAY_DEFAULTS=Object.freeze({enabled:false,showPrices:true,showCustomer:false,color:'#1773c9',fontSize:23});
export function customerDisplayOptions(value){return {
 enabled:typeof value?.enabled==='boolean'?value.enabled:false,
 showPrices:typeof value?.showPrices==='boolean'?value.showPrices:true,
 showCustomer:typeof value?.showCustomer==='boolean'?value.showCustomer:false,
 color:typeof value?.color==='string'&&/^#[a-f0-9]{6}$/i.test(value.color)?value.color.toLowerCase():CUSTOMER_DISPLAY_DEFAULTS.color,
 fontSize:Number.isInteger(value?.fontSize)&&value.fontSize>=14&&value.fontSize<=40?value.fontSize:23
};}
/** A deliberately small public-facing projection. Never pass IDs, addresses,
 * credentials, card details or a whole customer/order record to this window. */
export function customerDisplayView(value,options,{canShowCustomer=false}={}){
 const o=customerDisplayOptions(options),phase=['estimate','verified','confirmed','uncertain'].includes(value?.phase)?value.phase:'idle';
 const lines=phase==='idle'?[]:(Array.isArray(value?.lines)?value.lines:[]).slice(0,100).filter(row=>
  clean(row?.name)&&Number.isFinite(row.quantity)&&row.quantity>0&&row.quantity<=1000000).map(row=>({name:clean(row.name),quantity:row.quantity,
   cents:o.showPrices?amount(row.cents):null}));
 return {storeName:clean(value?.storeName)||'Tu establecimiento',environment:value?.environment==='practice'?'Práctica':value?.environment==='production'?'':'Tienda de pruebas',
  phase,lines,totalCents:o.showPrices&&phase!=='idle'?amount(value?.totalCents):null,discountCents:o.showPrices&&phase!=='idle'?amount(value?.discountCents):null,
  customerName:o.showCustomer&&canShowCustomer===true&&['estimate','verified'].includes(phase)&&lines.length?clean(value?.customerName):'',
  color:o.color,fontSize:o.fontSize};
}
export function customerDisplayOptionsFromForm(fields){return customerDisplayOptions({enabled:fields.get('customer-display-enabled')==='on',showPrices:fields.get('customer-display-showPrices')==='on',
 showCustomer:fields.get('customer-display-showCustomer')==='on',color:fields.get('customer-display-color'),fontSize:Number(fields.get('customer-display-fontSize'))});}
export function customerDisplayOptionsHtml(value){const o=customerDisplayOptions(value);return `<fieldset class="tpv-customer-display-settings"><legend>Pantalla para el cliente</legend>
 <label class="tpv-check"><input type="checkbox" name="customer-display-enabled" ${o.enabled?'checked':''}> Habilitar pantalla para el cliente</label>
 <label class="tpv-check"><input type="checkbox" name="customer-display-showPrices" ${o.showPrices?'checked':''}> Mostrar precios y total</label>
 <label class="tpv-check"><input type="checkbox" name="customer-display-showCustomer" ${o.showCustomer?'checked':''}> Mostrar el nombre del cliente durante la compra</label>
 <label>Color principal<input type="color" name="customer-display-color" value="${o.color}"></label>
 <label>Tamaño de letra<select name="customer-display-fontSize">${Array.from({length:27},(_,i)=>i+14).map(n=>`<option value="${n}" ${n===o.fontSize?'selected':''}>${n}</option>`).join('')}</select></label>
 <p class="small muted">Se abre en otra ventana para colocarla en el segundo monitor. Solo muestra el nombre si tu cuenta tiene acceso a Clientes. No muestra teléfono, dirección, correo ni datos de pago. Al salir se borra y se cierra.</p></fieldset>`;}
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
export function createCustomerDisplay({getState,getOptions,allowed,canShowCustomer=()=>false,openWindow=(...args)=>window.open(...args),onClose=()=>{},clock=()=>Date.now()}){
 let screen=null,timer=null,body=null,signature='',confirmedSince=0;
 const element=(doc,tag,text,className)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 function close(){if(timer)clearInterval(timer);timer=null;const previous=screen;screen=null;body=null;signature='';confirmedSince=0;
  if(previous)try{previous.document.body.replaceChildren();previous.close();}catch{}onClose();}
 function sync(){if(!screen)return;
  try{if(screen.closed||!allowed()||!customerDisplayOptions(getOptions()).enabled){close();return;}
   const doc=screen.document;if(doc.body!==body){close();return;}
   let view=customerDisplayView(getState(),getOptions(),{canShowCustomer:canShowCustomer()});
   const current=JSON.stringify(view);
   if(view.phase==='confirmed'){if(signature!==current)confirmedSince=clock();else if(clock()-confirmedSince>=15000)view={...view,phase:'idle',lines:[],totalCents:null,discountCents:null,customerName:''};}
   else confirmedSince=0;signature=current;
   body.dataset.tpvHeartbeat=String(clock());body.style.setProperty('--display-accent',view.color);body.style.setProperty('--display-font',view.fontSize+'px');
   const rgb=[1,3,5].map(start=>parseInt(view.color.slice(start,start+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
   const light=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179;
   body.style.setProperty('--display-on-accent',light?'#000000':'#ffffff');body.style.setProperty('--display-brand',light?'#152b42':view.color);
   doc.querySelector('[data-display-store]').textContent=view.storeName;doc.querySelector('[data-display-environment]').textContent=view.environment;
   const title={idle:'Bienvenido',estimate:'Tu compra',verified:'Todo listo para pagar',confirmed:'Gracias por tu compra',uncertain:'Estamos comprobando tu compra'}[view.phase];
   doc.querySelector('[data-display-title]').textContent=title;doc.querySelector('[data-display-customer]').textContent=view.customerName?'Hola, '+view.customerName:'';
   const list=doc.querySelector('[data-display-lines]');list.replaceChildren(...view.lines.map(line=>{
    const row=element(doc,'li',undefined,'display-line'),text=element(doc,'div');text.append(element(doc,'strong',line.name),element(doc,'small',line.quantity+' ud.'));
    row.append(text);if(line.cents!==null)row.append(element(doc,'b',money(line.cents)));return row;
   }));
   const total=doc.querySelector('[data-display-total]');total.hidden=view.totalCents===null;
   doc.querySelector('[data-display-total-label]').textContent=view.phase==='estimate'?'Estimación antes de descuentos':'Total';
   doc.querySelector('[data-display-amount]').textContent=view.totalCents===null?'':money(view.totalCents);
   doc.querySelector('[data-display-discount]').textContent=view.discountCents>0?'Descuento del ticket: −'+money(view.discountCents):'';
   doc.querySelector('[data-display-message]').textContent={idle:'Estamos aquí para ayudarte.',estimate:'El importe se comprueba antes de cobrar.',verified:'Revisa tu compra con la persona que te atiende.',confirmed:'Esperamos verte pronto.',uncertain:'Espera a que la persona que te atiende confirme el resultado.'}[view.phase];
  }catch{close();}
 }
 function open(){if(!allowed())throw Error('Vuelve a entrar en una caja autorizada para abrir la pantalla del cliente.');
  if(!customerDisplayOptions(getOptions()).enabled)throw Error('Activa primero la pantalla para el cliente en Configuración.');
  if(screen&&!screen.closed){sync();if(screen){screen.focus();return;}}
  close();
  const child=openWindow('about:blank','_blank','popup,width=1100,height=760');if(!child)throw Error('El navegador ha bloqueado la ventana. Permite las ventanas emergentes de Central y vuelve a intentarlo.');
  screen=child;child.opener=null;const doc=child.document;
  doc.open();doc.write('<!doctype html><html lang="es"><head></head><body></body></html>');doc.close();
  doc.title='TotusTPV · Pantalla para el cliente';doc.head.replaceChildren();doc.body.replaceChildren();body=doc.body;
  const meta=element(doc,'meta');meta.name='viewport';meta.content='width=device-width,initial-scale=1';
  const css=element(doc,'link');css.rel='stylesheet';css.href=new URL('./customer-display.css',import.meta.url).href;
  const watcher=element(doc,'script');watcher.type='module';watcher.src=new URL('./customer-display-watch.js',import.meta.url).href;doc.head.append(meta,css,watcher);
  const header=element(doc,'header'),brand=element(doc,'div',undefined,'display-brand');brand.append(element(doc,'span','TOTUS','display-wordmark'));
  const store=element(doc,'strong');store.dataset.displayStore='';brand.append(store);const environment=element(doc,'span',undefined,'display-environment');environment.dataset.displayEnvironment='';
  const fullscreen=element(doc,'button','Pantalla completa');fullscreen.type='button';fullscreen.dataset.displayFullscreen='';header.append(brand,environment,fullscreen);
  const main=element(doc,'main'),content=element(doc,'section',undefined,'display-content'),heading=element(doc,'h1');heading.dataset.displayTitle='';
  const customer=element(doc,'p',undefined,'display-customer');customer.dataset.displayCustomer='';const list=element(doc,'ol');list.dataset.displayLines='';content.append(heading,customer,list);
  const summary=element(doc,'aside',undefined,'display-summary'),total=element(doc,'div');total.dataset.displayTotal='';const label=element(doc,'span');label.dataset.displayTotalLabel='';const value=element(doc,'strong');value.dataset.displayAmount='';total.append(label,value);
  const discount=element(doc,'p');discount.dataset.displayDiscount='';total.append(discount);
  const message=element(doc,'p');message.dataset.displayMessage='';summary.append(total,message);main.append(content,summary);body.append(header,main);
  sync();timer=setInterval(sync,3000);child.focus();
 }
 return {open,sync,close,isOpen:()=>!!screen&&!screen.closed};
}
