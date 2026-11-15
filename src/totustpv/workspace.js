import {createTpvPracticeAdapter} from './practice-adapter.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
export function inputCents(value) {
 const match=String(value).trim().match(/^(0|[1-9][0-9]{0,6})(?:[,.]([0-9]{1,2}))?$/);
 if(!match)throw new Error('Escribe un importe válido, con un máximo de dos decimales.');
 return Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
}
const button=(action,label,kind='secondary',disabled=false)=>`<button type="button" class="btn ${kind}" data-tpv-action="${action}" ${disabled?'disabled':''}>${label}</button>`;

/** Shared Central workspace. Practice is deliberately explicit and isolated.
 * No code in this browser module can import the privileged checkout adapters.
 */
export function createTpvWorkspace({actor,can,storage,confirm=async()=>false,
 onConfigure=null,canConfigure=()=>false}={}) {
 let host=null,adapter=null,context=null,session=null,products=[],lines=[],search='',tab='sale',notice='',failure='',
  busy=false,payment=null,receipt=null,history=[],summary=null,generation=0,searchTimer=null,abort=null,
  returnForm=null,paymentValues={},formValues={},formDirty=false,selectedStore='',selectedDrawer='',searchRevision=0;
 function allowed(){return actor()?.active!==false&&!!actor()?.id&&can('view');}
 function identity(){return `${actor()?.id||''}`;}
 let mountedActor='';
 function bindPractice(){let practiceStorage=storage;
  try{practiceStorage??=globalThis.localStorage;}catch{throw new Error('Este navegador no permite guardar la práctica. Revisa sus permisos de almacenamiento.');}
  const born=generation,raw=createTpvPracticeAdapter({actorId:identity(),storage:practiceStorage});
  return Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,typeof value!=='function'?value:
   async(...args)=>{if(born!==generation)throw new Error('La vista ha cambiado.');guard();
    const result=await value(...args);if(born!==generation)throw new Error('La vista ha cambiado.');guard();return result;}]));}
 const guard=()=>{if(!host||!allowed()||mountedActor!==identity())throw new Error('La sesión ha cambiado. Vuelve a entrar en TotusTPV.');};
 function contextBar(){const storeId=session?.storeId||selectedStore||context.stores[0]?.id;
  const drawers=context.drawers.filter(d=>d.storeId===storeId);
  return `<div class="tpv-context"><label>Tienda<select data-tpv-store ${session?'disabled':''}>
  ${context.stores.map(s=>`<option value="${esc(s.id)}" ${s.id===storeId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
  <label>Caja<select data-tpv-drawer ${session?'disabled':''}>${drawers.map(d=>`<option value="${esc(d.id)}" ${d.id===(session?.drawerId||selectedDrawer||drawers[0]?.id)?'selected':''}>${esc(d.name)}</option>`).join('')||'<option value="">Sin cajas disponibles</option>'}</select></label>
  <span><b>${esc(actor()?.full_name||'Operador de práctica')}</b><small>${session?'Caja de práctica abierta':'Caja sin abrir'}</small></span>
  </div>`;}
 function render() {
  if(!host)return;
  if(!adapter||!context){host.innerHTML=`<section class="card card-pad tpv-activation"><h3>Preparar TotusTPV</h3>
   <p>Las ventas reales todavía no están habilitadas. La conexión de venta debe verificar cálculo, pago, pedido y existencias antes de activar el cobro.</p>
   <div class="inline-actions">${button('practice','Practicar sin ventas reales','primary')}${onConfigure&&canConfigure()?button('configure','Conexiones de tienda'):''}</div>
   <p class="muted">Usa artículos y cajas ficticios para aprender el recorrido. No modifica las tiendas ni los cierres de caja.</p>${failure?`<p role="alert">${esc(failure)}</p>`:''}</section>`;return;}
  const status=failure?`<p class="note bad" role="alert">${esc(failure)}</p>`:notice?`<p class="note" role="status">${esc(notice)}</p>`:'';
  host.innerHTML=`<div class="tpv-practice-banner"><strong>Modo práctica</strong><span>Datos ficticios · sin cobros ni pedidos en PrestaShop</span>${button('exit','Salir de práctica')}</div>
   ${contextBar()}<nav class="module-tabs" aria-label="TotusTPV"><button type="button" class="tab ${tab==='sale'?'active':''}" data-tpv-action="sale">Venta</button>
   <button type="button" class="tab ${tab==='history'?'active':''}" data-tpv-action="history">Tickets de práctica</button>
   <button type="button" class="tab ${tab==='session'?'active':''}" data-tpv-action="session">Caja</button></nav>${status}
   <div data-tpv-body>${!session?openingHtml():tab==='history'?historyHtml():tab==='session'?sessionHtml():receipt?receiptHtml():saleHtml()}</div>`;
  host.querySelectorAll('label').forEach(el=>el.classList.add('field'));
  reflectPaymentMethod();
  host.querySelectorAll('button,select,input').forEach(el=>{if(busy)el.disabled=true;});
 }
 function openingHtml(){return `<section class="card card-pad tpv-opening"><h3>Abrir caja de práctica</h3><p>Indica el efectivo ficticio con el que empieza la sesión.</p>
  <form data-tpv-form="open"><label>Fondo inicial · €<input name="opening" inputmode="decimal" value="${esc(formValues.open?.opening??'100,00')}" required></label>
  <button class="btn primary" type="submit" ${can('create')?'':'disabled'}>Abrir caja de práctica</button></form></section>`;}
 function saleHtml(){return `<div class="tpv-sale-grid"><section class="card card-pad tpv-catalogue" aria-label="Artículos">
  <label>Buscar artículo o referencia<input type="search" data-tpv-search placeholder="Nombre o referencia" value="${esc(search)}" autocomplete="off"></label>
  <div class="tpv-product-list">${products.map(p=>`<button type="button" class="tpv-product" data-tpv-add="${esc(p.id)}" ${p.stock<=0||!can('create')||payment?'disabled':''}>
   <span><strong>${esc(p.name)}</strong><small>${esc(p.reference)} · ${p.stock} disponibles</small></span><b>${money(p.priceCents)}</b></button>`).join('')||'<p class="tpv-empty">No hay artículos con esa búsqueda.</p>'}</div></section>
  <section class="card card-pad tpv-ticket" aria-label="Ticket actual"><header><h3>Ticket de práctica</h3><span>Cliente de mostrador ficticio</span></header>
  <div class="tpv-ticket-lines">${lines.map(l=>`<div class="tpv-ticket-line"><div><strong>${esc(l.name)}</strong><small>${money(l.unitCents)} / ud.</small></div>
   <label class="tpv-quantity">Unidades<input type="number" min="1" max="100" step="1" data-tpv-quantity="${esc(l.productId)}" value="${l.qty}" ${payment||!can('create')?'disabled':''}></label>
   <b>${money(l.unitCents*l.qty)}</b><button type="button" class="btn secondary" aria-label="Quitar ${esc(l.name)}" data-tpv-remove="${esc(l.productId)}" ${payment||!can('create')?'disabled':''}>×</button></div>`).join('')||'<p class="tpv-empty">Selecciona un artículo para empezar.</p>'}</div>
  <div class="tpv-ticket-total"><span>Total antes de descuentos</span><strong>${money(lines.reduce((n,l)=>n+l.qty*l.unitCents,0))}</strong></div>
  ${!payment?`<div class="inline-actions">${button('clear','Vaciar ticket','secondary',!lines.length||!can('create'))}${button('payment','Preparar cobro de práctica','primary',!lines.length||!can('create'))}</div>`:''}
  ${payment?paymentHtml():''}</section></div>`;}
 function paymentHtml(){return `<form data-tpv-form="pay" class="tpv-payment"><h4>Cobro de práctica</h4><p class="tpv-payment-amount">Total <strong>${money(payment.totalCents)}</strong></p>
  <label>Forma de pago<select name="method" data-tpv-method>${[['cash','Efectivo'],['card','Tarjeta simulada'],['mixed','Efectivo y tarjeta simulada']].map(([key,label])=>`<option value="${key}" ${paymentValues.method===key?'selected':''}>${label}</option>`).join('')}</select></label>
  <label data-tpv-cash-part hidden>Parte en efectivo · €<input name="cashPart" inputmode="decimal" value="${esc(paymentValues.cashPart??'0,00')}"></label>
  <label data-tpv-received>Efectivo recibido · €<input name="received" inputmode="decimal" value="${esc(paymentValues.received??(payment.totalCents/100).toFixed(2).replace('.',','))}"></label>
  <label class="tpv-check" data-tpv-card-accept hidden><input type="checkbox" name="cardAccepted" ${paymentValues.cardAccepted==='on'?'checked':''}> Acepto el pago de tarjeta ficticio</label>
  <label>Simular resultado<select name="scenario">${[['normal','Venta correcta'],['lost-response','Respuesta perdida: recuperar sin repetir'],['rejected','Pago rechazado']].map(([key,label])=>`<option value="${key}" ${paymentValues.scenario===key?'selected':''}>${label}</option>`).join('')}</select></label>
  <div class="inline-actions">${button('cancel-payment','Volver al ticket')}<button class="btn primary" type="submit">Confirmar venta de práctica</button></div></form>`;}
 function receiptHtml(){const uncertain=receipt.status==='uncertain';return `<section class="card card-pad tpv-receipt" aria-label="Resultado de práctica"><h3>${uncertain?'Respuesta pendiente de recuperar':'Venta de práctica registrada'}</h3>
  <p><b>${esc(receipt.reference)}</b> · ${money(receipt.totalCents)}</p><p>${uncertain?'No confirmes otro ticket para repetir esta venta. Recupera el resultado de la misma operación.':'Cambio de práctica: '+money(receipt.changeCents||0)}</p>
  <small>Simulación: no existe pedido ni pago real en PrestaShop.</small><div class="inline-actions">${uncertain?button('recover','Recuperar resultado','primary'):button('next','Nuevo ticket','primary')}</div></section>`;}
 function historyHtml(){return `<section class="card card-pad"><h3>Tickets de esta sesión de práctica</h3><div class="tpv-history">${history.map(op=>`<article><div><b>${esc(op.reference)}</b><small>${op.status==='confirmed'?'Registrado en práctica':'Pendiente de recuperar'}</small></div><strong>${money(op.totalCents)}</strong>
   ${op.status==='uncertain'?`<button type="button" class="btn secondary" data-tpv-recover="${esc(op.id)}">Recuperar</button>`:`<button type="button" class="btn secondary" data-tpv-return="${esc(op.id)}" ${!can('create')?'disabled':''}>Devolver</button>`}</article>`).join('')||'<p class="tpv-empty">Todavía no hay tickets en esta sesión.</p>'}</div>${returnForm?returnHtml():''}</section>`;}
 function returnHtml(){return `<form data-tpv-form="refund" class="tpv-payment"><h4>Devolución de práctica · ${esc(returnForm.reference)}</h4><p>El reintegro ficticio usa los medios de pago de la venta original.</p>
  ${returnForm.lines.map(line=>`<div class="tpv-return-line"><strong>${esc(line.name)}</strong><label>Cantidad a devolver (máx. ${line.remainingQty})<input name="qty-${esc(line.productId)}" type="number" min="0" max="${line.remainingQty}" step="1" value="${esc(formValues.refund?.['qty-'+line.productId]??'0')}"></label>
   <label class="tpv-check"><input name="restock-${esc(line.productId)}" type="checkbox" ${!formValues.refund||formValues.refund['restock-'+line.productId]==='on'?'checked':''}> Reponer existencias de práctica</label></div>`).join('')}
  <label class="tpv-check"><input type="checkbox" name="refundAccepted" required ${formValues.refund?.refundAccepted==='on'?'checked':''}> Confirmo el reintegro ficticio; no se devuelve dinero real</label>
  <div class="inline-actions">${button('cancel-return','Cancelar devolución')}<button type="submit" class="btn primary">Registrar devolución de práctica</button></div></form>`;}
 function sessionHtml(){return `<section class="card card-pad tpv-session"><h3>Caja de práctica</h3>${summary?`<dl><div><dt>Fondo inicial</dt><dd>${money(summary.openingCents)}</dd></div><div><dt>Ventas de práctica</dt><dd>${money(summary.salesCents)}</dd></div>
  <div><dt>Ventas en efectivo</dt><dd>${money(summary.cashCents)}</dd></div><div><dt>Reintegros en efectivo</dt><dd>${money(summary.refundCashCents||0)}</dd></div><div><dt>Efectivo esperado</dt><dd>${money(summary.expectedCashCents)}</dd></div></dl>
  ${summary.unresolved?'<p role="status">Recupera los tickets pendientes antes de cerrar.</p>':''}<form data-tpv-form="close"><label>Efectivo contado · €<input name="counted" inputmode="decimal" required value="${esc(formValues.close?.counted??(summary.expectedCashCents/100).toFixed(2).replace('.',','))}"></label><button class="btn primary" type="submit" ${summary.unresolved||!can('create')?'disabled':''}>Cerrar caja de práctica</button></form>`:''}</section>`;}
 function rememberForm(target){const form=target.closest('[data-tpv-form]');if(!form||!host?.contains(form))return;
  const values=Object.fromEntries(new FormData(form));formValues[form.dataset.tpvForm]=values;
  if(form.dataset.tpvForm==='pay')paymentValues=values;formDirty=true;}
 const hasDraft=()=>!!host&&(lines.length>0||!!payment||!!returnForm||formDirty||receipt?.status==='uncertain');
 async function askCurrent(message){const run=generation,owner=identity();const accepted=await confirm(message);
  return accepted===true&&run===generation&&owner===identity()&&!!host;}
 async function requestLeave(){if(busy)return false;if(!hasDraft())return true;
  return askCurrent('¿Salir de TotusTPV? Los cambios sin confirmar se perderán. Los tickets de práctica pendientes seguirán en su historial.');}
 async function reloadProducts(){products=await adapter.searchProducts({sessionId:session.id,search});}
 async function work(fn){if(busy)return;guard();busy=true;failure='';const run=generation;render();try{await fn();}catch(error){if(run===generation)failure=error.message||'No se pudo completar la operación.';}finally{if(run===generation){busy=false;render();}}}
 async function changeTab(next){tab=next;if(session&&next==='history')history=await adapter.history({sessionId:session.id});if(session&&next==='session')summary=await adapter.sessionSummary({sessionId:session.id});}
 async function recover(operationId){receipt=await adapter.recover({operationId});lines=[];payment=null;tab='sale';await reloadProducts();}
 async function click(event){
  const target=event.target.closest('button');if(!target||!host?.contains(target)||busy)return;
  if(!allowed()||mountedActor!==identity()){const root=host;dispose();root.innerHTML='<p role="alert">La sesión ha cambiado. Vuelve a entrar en TotusTPV.</p>';return;}
  const action=target.dataset.tpvAction;
  if(target.dataset.tpvAdd){if(!can('create')||payment||receipt)return;const p=products.find(p=>p.id===target.dataset.tpvAdd);
   if(!p)return;const existing=lines.find(l=>l.productId===p.id);if(existing){if(existing.qty<p.stock)existing.qty++;}else lines.push({productId:p.id,name:p.name,qty:1,unitCents:p.priceCents});render();return;}
  if(target.dataset.tpvRemove){if(payment||!can('create'))return;lines=lines.filter(l=>l.productId!==target.dataset.tpvRemove);render();return;}
  if(target.dataset.tpvRecover)return work(()=>recover(target.dataset.tpvRecover));
  if(target.dataset.tpvReturn)return work(async()=>{if(!can('create'))throw new Error('No tienes permiso para devolver.');
   returnForm={...await adapter.returnable({sessionId:session.id,saleId:target.dataset.tpvReturn}),operationId:crypto.randomUUID()};delete formValues.refund;});
  if(action==='cancel-return'){returnForm=null;delete formValues.refund;formDirty=Object.keys(formValues).length>0;render();return;}
  if(action==='configure'&&onConfigure&&canConfigure())return work(()=>onConfigure());
  if(action==='practice')return work(async()=>{
   adapter=bindPractice();context=await adapter.context();context.stores.sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));context.drawers.sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));
   session=context.sessions.find(s=>s.status==='open')||null;if(session)await reloadProducts();
  });
  if(action==='exit'){if(!await requestLeave())return;adapter=null;context=null;session=null;lines=[];payment=null;receipt=null;returnForm=null;formValues={};formDirty=false;render();return;}
  if(['sale','history','session'].includes(action))return work(()=>changeTab(action));
  if(action==='payment')return work(async()=>{if(!can('create'))throw new Error('No tienes permiso para crear ventas.');
   payment=await adapter.quote({sessionId:session.id,lines:copyLines()});paymentValues={};});
  if(action==='cancel-payment'){payment=null;paymentValues={};delete formValues.pay;formDirty=Object.keys(formValues).length>0;render();return;}
  if(action==='clear'){if(!can('create')||lines.length&&!await askCurrent('¿Vaciar el ticket de práctica?'))return;lines=[];payment=null;render();return;}
  if(action==='recover')return work(()=>recover(receipt.id));
  if(action==='next'){receipt=null;lines=[];payment=null;render();}
 }
 const copyLines=()=>lines.map(({productId,qty})=>({productId,qty}));
 async function submit(event){
  const form=event.target.closest('[data-tpv-form]');if(!form||!host.contains(form))return;event.preventDefault();
  if(busy||!can('create'))return;
  // Capture form values before work() redraws and disables controls.
  const fields=new FormData(form),kind=form.dataset.tpvForm,storeId=host.querySelector('[data-tpv-store]')?.value,
   drawerId=host.querySelector('[data-tpv-drawer]')?.value;
  rememberForm(form);
  return work(async()=>{
   if(kind==='open'){
    const drawer=context.drawers.find(d=>d.storeId===storeId&&d.id===drawerId);if(!drawer)throw new Error('Selecciona una caja de esta tienda.');
    session=await adapter.openSession({storeId,drawerId:drawer.id,openingCents:inputCents(fields.get('opening'))});
    tab='sale';receipt=null;lines=[];await reloadProducts();notice='';
   } else if(kind==='pay'){
    const method=fields.get('method'),cash=method==='cash'?payment.totalCents:method==='mixed'?inputCents(fields.get('cashPart')):0;
    if(cash>payment.totalCents||method==='mixed'&&(cash===0||cash===payment.totalCents))throw new Error('El pago mixto necesita una parte de efectivo y otra de tarjeta.');
    const payments=[];if(cash>0)payments.push({method:'cash',amountCents:cash,receivedCents:inputCents(fields.get('received'))});
    if(method!=='cash')payments.push({method:'card',amountCents:payment.totalCents-cash,simulatedAccepted:fields.get('cardAccepted')==='on'});
    receipt=await adapter.submit({operationId:payment.id,payments,scenario:fields.get('scenario')});
    if(receipt.status==='confirmed'){payment=null;lines=[];await reloadProducts();}
   } else if(kind==='refund'){
    const items=returnForm.lines.map(line=>({productId:line.productId,qty:Number(fields.get('qty-'+line.productId)),
     restock:fields.get('restock-'+line.productId)==='on'})).filter(line=>line.qty>0);
    const result=await adapter.refund({operationId:returnForm.operationId,sessionId:session.id,saleId:returnForm.saleId,items,
     refundConfirmed:fields.get('refundAccepted')==='on'});
    notice=`Devolución de práctica registrada: ${result.reference} · ${money(result.totalCents)}. Sin reintegro real.`;
    returnForm=null;history=await adapter.history({sessionId:session.id});await reloadProducts();
   } else if(kind==='close'){
    if(lines.length||payment||returnForm)throw new Error('Termina o descarta el ticket o la devolución pendientes antes de cerrar la caja.');
    const closed=await adapter.closeSession({sessionId:session.id,countedCents:inputCents(fields.get('counted'))});
    notice='Caja de práctica cerrada. Diferencia: '+money(closed.differenceCents);session=null;receipt=null;payment=null;lines=[];tab='sale';formValues={};
   }
   delete formValues[kind];formDirty=Object.keys(formValues).length>0;
  });
 }
 function reflectPaymentMethod(){const form=host?.querySelector('[data-tpv-form="pay"]');if(!form)return;
  const method=form.querySelector('[data-tpv-method]').value;
  form.querySelector('[data-tpv-cash-part]').hidden=method!=='mixed';form.querySelector('[data-tpv-received]').hidden=method==='card';
  form.querySelector('[data-tpv-card-accept]').hidden=method==='cash';}
 function change(event){
  if(!host||busy||!allowed()||mountedActor!==identity())return;
  rememberForm(event.target);
  if(event.target.matches('[data-tpv-store]')&&!session){selectedStore=event.target.value;selectedDrawer='';render();return;}
  if(event.target.matches('[data-tpv-drawer]')&&!session){selectedDrawer=event.target.value;return;}
  if(event.target.matches('[data-tpv-method]')){
   reflectPaymentMethod();return;
  }
  if(event.target.dataset.tpvQuantity&&!payment&&can('create')){const line=lines.find(l=>l.productId===event.target.dataset.tpvQuantity),value=Number(event.target.value),
   available=products.find(p=>p.id===line?.productId)?.stock;
   if(line&&Number.isSafeInteger(value)&&value>0&&value<=100&&value<=available){line.qty=value;failure='';}
   else failure='La cantidad debe ser entera y no superar las existencias disponibles.';render();}
 }
 function input(event){if(!host||busy||!allowed()||mountedActor!==identity())return;
  if(!event.target.matches('[data-tpv-search]')){rememberForm(event.target);return;}search=event.target.value;clearTimeout(searchTimer);
  const run=generation,request=++searchRevision,query=search;searchTimer=setTimeout(async()=>{try{const found=await adapter.searchProducts({sessionId:session.id,search:query});
   if(run!==generation||request!==searchRevision||busy||tab!=='sale')return;
   products=found;const focus=host.querySelector('[data-tpv-search]');if(!focus)return;const start=focus.selectionStart;
   const wasFocused=document.activeElement===focus;render();const next=host.querySelector('[data-tpv-search]');
   if(next&&wasFocused){next.focus();next.setSelectionRange(start,start);}
  }catch(error){if(run===generation&&request===searchRevision){failure=error.message;render();}}},150);}
 function dispose(){generation++;searchRevision++;clearTimeout(searchTimer);abort?.abort();host=null;busy=false;}
 return {mount(root){dispose();host=root;mountedActor=identity();
   adapter=null;context=null;session=null;lines=[];receipt=null;payment=null;notice='';failure='';tab='sale';returnForm=null;paymentValues={};
   formValues={};formDirty=false;selectedStore='';selectedDrawer='';search='';products=[];history=[];summary=null;
   if(!allowed()){host.innerHTML='<p role="alert">Necesitas acceso a Ventas y Cajas para usar TotusTPV.</p>';return;}
   abort=new AbortController();for(const [type,handler] of [['click',click],['submit',submit],['change',change],['input',input]])
    host.addEventListener(type,handler,{signal:abort.signal});render();},dispose,
   hasDraft,requestLeave};
}
