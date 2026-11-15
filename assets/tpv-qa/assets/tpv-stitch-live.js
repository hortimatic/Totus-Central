"use strict";
/* Stitch original: real PS8 catalogue + verified contextual prices, no invented sale.
   The cash register UI never claims success until the server supplies a verified order. */
(() => {
  const $ = selector => document.querySelector(selector);
  const catalog = $('[data-purpose="product-grid-container"] .grid');
  const ticket = $('#ticket-lines-container');
  const button = $('#btn-cobrar-finalizar');
  const status = $('#tpv-session-bar');
  const search = $('#product-search-input');
  if (!catalog || !ticket || !button || !status || !search) return;
  const money = cents => (cents / 100).toLocaleString('es-ES', {style: 'currency', currency: 'EUR'});
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const key = (pid, aid) => pid + ':' + aid;
  // No Vercel: static HTML on GitHub Pages; private API and Auth in Supabase.
  const SUPABASE="https://ltwfmhilbvpzqdgjhvjb.supabase.co";
  const PUBLISHABLE="sb_publishable_nmIr0nxYROarAfIWE-OwYQ_PGn63lRv";
  function endpoint(op,query={}){
    const u=new URL(SUPABASE+"/functions/v1/tpv-pages-api");
    u.searchParams.set("op",op);
    for(const [k,v] of Object.entries(query))u.searchParams.set(k,String(v));
    return u.toString();
  }
  function apiFetch(op,{method="GET",body=null,query={}}={}){
    return fetch(endpoint(op,query),{
      method,cache:"no-store",
      headers:{apikey:PUBLISHABLE,...(token?{Authorization:"Bearer "+token}:{}),
        ...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
  }
  const products = new Map(), basket = new Map();
  let page = 0, more = false, busy = false, token = null, authorized = false;
  let payment = null, drawerId = null, selectedStore = "hortimatic", checkoutReady = false;
  let independentQaCashEnabled=false;
  const controls = document.createElement("div");
  controls.setAttribute("data-purpose","tpv-store-controls");
  controls.style.cssText="display:flex;gap:12px;align-items:end;flex-wrap:wrap;padding:9px 14px;background:#f8fafc;border-bottom:1px solid #cbd5e1;font:13px system-ui";
  controls.innerHTML=[
    '<label style="font-weight:650">Tienda<select id="tpv-store-picker" style="display:block;margin-top:4px;padding:6px;border:1px solid #94a3b8;border-radius:7px"></select></label>',
    '<label style="font-weight:650">Caja<select id="tpv-drawer-picker" style="display:block;margin-top:4px;padding:6px;border:1px solid #94a3b8;border-radius:7px"></select></label>',
    '<label style="font-weight:650">Pago validado<select id="tpv-payment-picker" style="display:block;margin-top:4px;padding:6px;border:1px solid #94a3b8;border-radius:7px"></select></label>'
  ].join("");
  status.insertAdjacentElement("afterend",controls);
  const checkoutWarning=document.createElement("div");
  checkoutWarning.id="tpv-checkout-warning";
  checkoutWarning.hidden=true;
  checkoutWarning.setAttribute("role","alert");
  checkoutWarning.style.cssText="background:#fff1f2;color:#9f1239;border-bottom:1px solid #fda4af;padding:12px 15px;font-size:13px;font-weight:700";
  controls.insertAdjacentElement("afterend",checkoutWarning);
  const shopPicker=controls.querySelector("#tpv-store-picker");
  const drawerPicker=controls.querySelector("#tpv-drawer-picker");
  const paymentPicker=controls.querySelector("#tpv-payment-picker");
  const fillSelect=(element,items,placeholder)=>{
    element.replaceChildren(new Option(placeholder,""));
    for(const item of items){
      const opt=new Option(item.label,item.id);
      if(item.disabled===true)opt.setAttribute("disabled","");
      element.append(opt);
    }
    element.value="";
  };
  fillSelect(shopPicker,[],"Consultando tiendas…");
  fillSelect(drawerPicker,[],"Selecciona caja");
  fillSelect(paymentPicker,[],"Pago no verificado");
  let capabilities=null;
  async function loadStoreCapabilities(){
    try {
      const response=await apiFetch("status");
      const data=await response.json();
      if(!response.ok||data.schema!=="totus-tpv-multi-store-v1"||!Array.isArray(data.stores))
        throw Error("Las conexiones de tienda no están verificadas");
      capabilities=data;
      // This is the independent Totus TPV QA endpoint, not Stitch.
      // A missing or disabled endpoint never enables a checkout.
      independentQaCashEnabled=false;
      try{
        const qaResponse=await apiFetch("qa");
        const qa=await qaResponse.json();
        const target=data.stores.find(x=>x.id==="hortimatic");
        if(qaResponse.ok&&qa.qaEnabled===true&&
           qa.mode==="preproduction-only"&&
           qa.commercialSalesEnabled===false&&target?.connected===true&&
           Array.isArray(qa.paymentMethods)&&qa.paymentMethods.includes("cash")){
          independentQaCashEnabled=true;
          target.checkoutReady=true;
          target.paymentMethods=[{id:"cash",label:"Efectivo de prueba (solo preproducción)"}];
          target.reason="";
        }
      }catch{/* Cannot enable a checkout without a positive QA readiness response. */}
      fillSelect(shopPicker,data.stores.map(x=>({
        id:x.id,label:x.name+(x.connected?"":" (pendiente de conexión)"),
        disabled:x.connected!==true
      })),"Selecciona tienda");
      selectedStore="hortimatic";
      shopPicker.value=selectedStore;
      selectStore(selectedStore);
    }catch(error){checkoutReady=false;setStatus(String(error.message||error),true);renderTicket();}
  }
  function selectStore(id){
    const shop=capabilities?.stores?.find(x=>x.id===id);
    selectedStore=id;checkoutReady=shop?.checkoutReady===true;
    checkoutWarning.hidden=checkoutReady;
    checkoutWarning.textContent=checkoutReady?"":(
      shop?.reason==="NATIVE_WS_FORCES_PAID_INVOICED_STATUS"?
      "PEDIDO BLOQUEADO: PrestaShop Webservice convierte TODOS los pedidos API en estado pagado y factura. No se puede emitir un pedido pendiente como si estuviera cobrado.":
      "No se puede cobrar: "+String(shop?.reason||"Tienda y pago sin verificar")
    );
    fillSelect(drawerPicker,(shop?.drawers||[]).map(id=>({
      id,label:id==="h-vape"?"Vape":id==="h-head"?"Head":id
    })),"Selecciona caja");
    fillSelect(paymentPicker,(checkoutReady?shop?.paymentMethods:[]||[]).map(m=>({
      id:m.id,label:m.label
    })),"Selecciona pago");
    drawerId=null;payment=null;
    if(!shop?.connected)setStatus("Tienda pendiente de conexión. No se emitirá ningún pedido.",true);
    else if(!checkoutReady)setStatus(shop.reason==="NATIVE_WS_FORCES_PAID_INVOICED_STATUS"?"La API de PrestaShop fuerza pedidos como PAGADOS y facturados: cobro pendiente bloqueado.":"Pago de PrestaShop pendiente de verificación. No hay ventas simuladas.",true);
    else setStatus("Elige caja y medio de pago. PrestaShop registrará el pedido real.",false);
    renderTicket();
  }
  shopPicker.addEventListener("change",()=>{
    if(basket.size>0){shopPicker.value=selectedStore;setStatus("Vacía el carrito antes de cambiar de tienda.",true);return;}
    selectStore(shopPicker.value);
  });
  drawerPicker.addEventListener("change",()=>{drawerId=drawerPicker.value||null;renderTicket();});
  paymentPicker.addEventListener("change",()=>{payment=paymentPicker.value||null;renderTicket();});

  const setStatus = (msg, isError = false) => {
    status.textContent = msg;
    status.style.background = isError ? '#fee2e2' : '#ecfdf5';
    status.style.color = isError ? '#991b1b' : '#065f46';
  };
  // Remove the fixed prices, product examples and ticket printed in the Stitch mock.
  catalog.replaceChildren();
  ticket.replaceChildren();
  const payout = $('[data-purpose="checkout-button-bar"]');
  const paymentButtons = payout ? [...payout.querySelectorAll('button')].filter(b => b !== button) : [];
  const chooseMethod = (method, control) => {
    payment = method;
    for (const candidate of paymentButtons) candidate.style.outline = '';
    if (control) control.style.outline = '2px solid #059669';
    renderTicket();
  };
  // Stitch includes demonstration payment buttons. They cannot authorize money.
  // The real choices come from the verified module list provided by our server.
  for(const control of paymentButtons){
    control.disabled=true;
    control.title="Solo se habilitarán medios de pago activos y verificados en PrestaShop";
    control.style.opacity="0.5";
  }

  // Use the published Auth login flow, but never store credentials or session tokens.
  const authButton = document.createElement('button');
  authButton.type='button';authButton.textContent='Acceso operador';
  authButton.style.cssText='margin-left:12px;background:#103138;color:white;border:0;border-radius:7px;padding:6px 12px;font-weight:650;font-size:12px;';
  const head = document.querySelector('header');
  head?.append(authButton);
  const historyButton=document.createElement("button");
  historyButton.type="button";
  historyButton.textContent="Pedidos Totus TPV";
  historyButton.disabled=true;
  historyButton.title="Pedidos creados por este TPV, contrastados con PrestaShop";
  historyButton.style.cssText="margin-left:8px;border:1px solid #94a3b8;border-radius:7px;padding:7px 12px;font-size:12px;font-weight:650";
  head?.append(historyButton);
  async function showOrderHistory(){
    if(!authorized||!token)throw Error("Inicia sesión para consultar pedidos");
    const independent=independentQaCashEnabled;
    const r=await apiFetch("history");
    const body=await r.json();
    if(!r.ok||!Array.isArray(body.orders))
      throw Error(body.error||"Historial no disponible");
    const modal=document.createElement("dialog");
    modal.id="tpv-orders-history";
    modal.style.cssText="width:min(780px,95vw);max-height:80vh;overflow:auto;border:1px solid #94a3b8;border-radius:13px;padding:20px";
    const entries=body.orders.map(o=>{
      const lines=independent?
        (Array.isArray(o.lines)?o.lines.map(l=>
          l.productId+"/"+l.attributeId+" × "+l.qty).join(", "):"Sin líneas"):
        o.productId+"/"+o.variantId+" × "+o.qty;
      const stock=independent?
        (Array.isArray(o.stockAfter)?o.stockAfter.map(l=>
          l.quantity+" → "+l.quantityAfter).join(", "):"Sin verificación"):
        (o.stockBefore==null?"Sin prueba":o.stockBefore+" → "+(o.stockAfter??"?"));
      const exact=!independent&&o.prestashopVerified===true&&
        o.stockDeltaVerified===true;
      const statusText=exact?"Verificado en PrestaShop":
        independent&&o.status==="confirmed"?
          "Pedido validado al guardar (QA)":
        o.status==="uncertain"?"Pendiente de comprobación":
          "No verificado; revisar";
      return '<tr><td style="padding:8px;border-bottom:1px solid #ddd">'+
       (o.orderId?"#"+o.orderId:"Sin pedido")+'</td>'+
       '<td style="padding:8px;border-bottom:1px solid #ddd">'+
       escape(o.drawerId)+'</td>'+
       '<td style="padding:8px;border-bottom:1px solid #ddd">'+
       escape(lines)+'</td>'+
       '<td style="padding:8px;border-bottom:1px solid #ddd">'+
       (o.totalCents==null?"—":money(o.totalCents))+'</td>'+
       '<td style="padding:8px;border-bottom:1px solid #ddd">'+
       escape(stock)+'</td>'+
       '<td style="padding:8px;border-bottom:1px solid #ddd">'+
       escape(statusText)+'</td></tr>';
    }).join("");
    modal.innerHTML='<h2 style="font-size:19px;font-weight:800;margin-bottom:6px">Pedidos Totus TPV</h2>'+
      '<p style="color:#475569;margin-bottom:13px">'+
      (independent?'Pedidos QA guardados por la API independiente. Los pedidos confirmados se verificaron al crearse; el historial no los vuelve a consultar en PrestaShop.':
      'Hortimatic 8.2.8 de preproducción. Datos comparados con PrestaShop.')+
      '</p><div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px;width:100%;text-align:left">'+
      '<thead><tr><th>Pedido</th><th>Caja</th><th>Productos</th><th>Total</th><th>Stock</th><th>Estado</th></tr></thead>'+
      '<tbody>'+(entries||'<tr><td colspan="6" style="padding:16px">Todavía no hay pedidos QA.</td></tr>')+
      '</tbody></table></div><form method="dialog" style="text-align:right;margin-top:14px">'+
      '<button style="border:1px solid #64748b;padding:8px 14px;border-radius:7px">Cerrar</button></form>';
    document.body.append(modal);
    modal.addEventListener("close",()=>modal.remove(),{once:true});
    modal.showModal();
  }
  historyButton.addEventListener("click",()=>{
    void showOrderHistory().catch(e=>setStatus(String(e.message||e),true));
  });
  authButton.addEventListener('click', async () => {
    if (authorized) {
      token = null; authorized = false; authButton.textContent='Acceso operador';historyButton.disabled=true;
      products.clear();basket.clear();checkoutReady=false;independentQaCashEnabled=false;
      catalog.replaceChildren();
      setStatus('Sesión cerrada. Sin capacidad de emitir pedidos.');
      renderTicket();return;
    }
    // Login happens in the application's secure dialog. No browser prompt or secrets in chat.
    // The password must only be entered into the secure application, never by chat.
    const modal = document.createElement('dialog');
    modal.style.cssText='padding:22px;max-width:410px;width:94%;border-radius:12px;border:1px solid #cbd5e1;';
    modal.innerHTML='<form method="dialog"><h2 style="font-weight:800;margin-bottom:14px">Acceso Totus TPV</h2><label style="display:block;margin-bottom:10px">Correo<input type="email" name="email" autocomplete="username" placeholder="Correo de operador" required style="display:block;padding:10px;border:1px solid #94a3b8;width:100%;border-radius:8px"></label><label style="display:block">Contraseña<input type="password" name="password" autocomplete="current-password" placeholder="Contraseña" required style="display:block;padding:10px;border:1px solid #94a3b8;width:100%;border-radius:8px"></label><div style="display:flex;gap:10px;margin-top:14px"><button value="cancel">Cancelar</button><button value="login" style="background:#059669;color:white;border-radius:7px;padding:8px 12px">Entrar</button></div></form>';
    document.body.append(modal);
    modal.showModal();
    modal.addEventListener('close',async()=>{
      const email = modal.querySelector('input[name=email]')?.value || '';
      const pass = modal.querySelector('input[name=password]')?.value || '';
      const accepted = modal.returnValue === 'login';modal.remove();
      if (!accepted || !pass || !email) return;
      try {
        const keyValue = 'sb_publishable_nmIr0nxYROarAfIWE-OwYQ_PGn63lRv';
        const response = await fetch('https://ltwfmhilbvpzqdgjhvjb.supabase.co/auth/v1/token?grant_type=password',{
          method:'POST',headers:{'Content-Type':'application/json','apikey':keyValue},
          body:JSON.stringify({email:email.trim().toLowerCase(),password:pass}),cache:'no-store'
        });
        const body = await response.json();
        if (!response.ok || !body.access_token) throw Error('Login rechazado por Supabase');
        const permission = await fetch(endpoint('operator'),{
          method:'POST',headers:{Authorization:'Bearer '+body.access_token,
            apikey:PUBLISHABLE,'Content-Type':'application/json'},
          body:'{}',cache:'no-store'
        });
        const grant = await permission.json();
        if (!permission.ok || grant.authorized !== true) throw Error('Sin permiso para operar en Hortimatic');
        token = body.access_token;authorized=true;historyButton.disabled=false;
        authButton.textContent='Cerrar sesión';
        setStatus('Operador autorizado. Solo se registra una venta cuando PrestaShop confirme el pedido.');
        renderTicket();
        // Load private catalog only after the verified operator has logged in.
        void loadStoreCapabilities();
        void load(0);
      } catch(e) { token=null;authorized=false;setStatus(String(e.message || 'Autenticación no verificada'),true); }
    },{once:true});
  });

  const getQuote = async (productId, attributeId, quantity) => {
    const response=await apiFetch("price",{query:{productId,variantId,quantity}});
    const quote=await response.json();
    if (!response.ok || quote.source!=='PS8_NATIVE_PRICE_CALCULATION' ||
        quote.productId!==productId || quote.variantId!==attributeId ||
        quote.quantity!==quantity || !Number.isFinite(quote.unitTaxIncl))
      throw Error('Precio del producto no comprobado');
    return quote;
  };
  async function add(pid,aid) {
    const product=products.get(key(pid,aid));if(!product || product.stock<=0)return;
    const previous=basket.get(key(pid,aid));
    const qty=(previous?.quantity||0)+1;
    if(qty>product.stock)return setStatus('No hay existencias para esa cantidad',true);
    const item={...product,quantity:qty,quoted:false,quotedPriceCents:null};
    basket.set(key(pid,aid),item);renderTicket();
    try {
      const quote=await getQuote(pid,aid,qty);
      if(basket.get(key(pid,aid))!==item)return;
      item.quoted=true;item.quotedPriceCents=Math.round(quote.unitTaxIncl*100);
      // A per-item price is only indicative: full cart fiscal verification belongs on server.
      item.fiscalContextComplete=quote.safeToSell===true;
      renderTicket();
    } catch(e) {
      if(basket.get(key(pid,aid))===item){item.error='Sin precio contrastado';renderTicket();}
    }
  }
  function renderProducts(){
    const term=search.value.trim().toLowerCase();
    catalog.innerHTML=[...products.values()].filter(p=>
      (p.name+' '+p.ref+' '+p.ean).toLowerCase().includes(term))
      .map(p=>'<button type="button" data-key="'+p.pid+':'+p.aid+'" '+
        (p.stock<=0?'disabled ':'')+
        'class="bg-white border border-slate-200 rounded-xl p-3 text-left hover:bg-emerald-50" style="min-height:142px">'+
        '<div style="font-weight:800">'+escape(p.name)+'</div><div style="font-size:12px;color:#64748b">'+escape(p.ref)+'</div>'+
        '<div style="font-size:12px;margin-top:8px">Variante #'+p.aid+'</div>'+
        '<div style="margin-top:9px;color:'+(p.stock>0?'#047857':'#b91c1c')+';font-weight:700">Stock: '+p.stock+'</div>'+
        '<div style="font-size:11px;color:#64748b">Precio exacto al seleccionar</div></button>').join('') ||
      '<p style="padding:15px;color:#475569">No hay resultados disponibles.</p>';
  }
  function renderTicket(){
    const items=[...basket.values()];
    const valid=items.length>0&&items.every(i=>i.quoted&&Number.isSafeInteger(i.quotedPriceCents));
    const total=items.reduce((sum,i)=>sum+(i.quotedPriceCents||0)*i.quantity,0);
    ticket.innerHTML=items.map(i=>
      '<div style="padding:12px 10px;border-bottom:1px solid #e2e8f0">'+
      '<div style="font-weight:750">'+escape(i.name)+'</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:9px;margin-top:7px">'+
      '<span>'+escape(i.ref)+' · Variante '+i.aid+'</span>'+
      '<span><button data-remove="'+i.pid+':'+i.aid+'" style="padding:4px 8px">−</button> '+
      i.quantity+' <button data-add="'+i.pid+':'+i.aid+'" style="padding:4px 8px">+</button></span></div>'+
      '<div style="text-align:right;font-weight:750">'+(i.quoted?money(i.quotedPriceCents*i.quantity):(i.error||'Calculando precio real…'))+'</div>'+
      '</div>').join('') || '<p style="padding:16px;color:#64748b">Selecciona un producto real para empezar.</p>';
    $('#display-total-amount').textContent=money(total);
    button.querySelector('span')?.replaceChildren(document.createTextNode(items.length ? 'CREAR PEDIDO QA ('+money(total)+')' : 'SELECCIONA UN PRODUCTO'));
    // Clickable only when the real operator is known. The server alone decides acceptance.
    button.disabled=busy||!authorized||!valid||!checkoutReady||
      selectedStore!=="hortimatic"||!drawerId||!payment;
    button.setAttribute('aria-disabled',String(button.disabled));
    button.title=busy?"Procesando":!authorized?"Primero inicia sesión como operador autorizado":
      !checkoutReady?"Bloqueado: "+(capabilities?.stores?.find(x=>x.id===selectedStore)?.reason||"Pago no verificado"):
      !drawerId?"Selecciona caja":!payment?"Selecciona el pago real":
      !valid?"Hay líneas sin precio verificado":"Finalizar pedido";
  }
  catalog.addEventListener('click',e=>{
    const b=e.target.closest('button[data-key]');if(!b||b.disabled)return;
    const [pid,aid]=b.dataset.key.split(':').map(Number);void add(pid,aid);
  });
  ticket.addEventListener('click',e=>{
    const remove=e.target.closest('button[data-remove]');
    if(remove){
      const k=remove.dataset.remove,i=basket.get(k);
      if(!i)return;
      if(i.quantity<=1){basket.delete(k);renderTicket();return;}
      const next={...i,quantity:i.quantity-1,quoted:false,quotedPriceCents:null,error:null};
      basket.set(k,next);renderTicket();
      void getQuote(next.pid,next.aid,next.quantity).then(quote=>{
        if(basket.get(k)!==next)return;
        next.quoted=true;next.quotedPriceCents=Math.round(quote.unitTaxIncl*100);
        renderTicket();
      }).catch(()=>{
        if(basket.get(k)!==next)return;
        next.error="Sin precio contrastado";renderTicket();
      });return;
    }
    const plus=e.target.closest('button[data-add]');
    if(plus){const [pid,aid]=plus.dataset.add.split(':').map(Number);void add(pid,aid);}
  });
  search.addEventListener('input',renderProducts);
  search.focus();

  async function confirmIndependentQaOrder(totalCents){
    const dialog=document.createElement("dialog");
    dialog.style.cssText="border:1px solid #94a3b8;border-radius:14px;padding:23px;max-width:440px;width:92%;box-shadow:0 14px 45px #0003;";
    dialog.innerHTML='<form method="dialog"><h2 style="font-weight:800;font-size:19px;margin-bottom:12px">Pedido API de prueba</h2>'+
      '<p style="margin-bottom:12px">Importe '+money(totalCents)+
      '. Recogida gratuita en Hortimatic 8.2.8 de PREPRODUCCIÓN.</p>'+
      '<p style="color:#9f1239;font-size:13px;margin-bottom:15px">ATENCIÓN: se intentará crear un pedido nativo marcado como pagado en una tienda de pruebas. No constituye una venta comercial ni un cobro real. Si el resultado es incierto, no vuelvas a pulsar con otra solicitud.</p>'+
      '<label style="display:flex;align-items:center;gap:8px;margin-bottom:15px"><input type="checkbox" name="understood" required> Comprendo que es una prueba aislada y autorizo un único pedido QA.</label>'+
      '<div style="display:flex;gap:12px;justify-content:end"><button value="cancel" style="padding:10px">Cancelar</button>'+
      '<button value="yes" style="background:#047857;color:white;border-radius:8px;padding:10px 15px;font-weight:750">Crear pedido QA</button></div></form>';
    document.body.append(dialog);
    const accepted=new Promise(resolve=>dialog.addEventListener("close",()=>{
      const ok=dialog.returnValue==="yes"&&dialog.querySelector('input[name="understood"]').checked;
      dialog.remove();resolve(ok);
    },{once:true}));
    dialog.showModal();
    return accepted;
  }
  async function confirmPendingOrder(totalCents){
    const dialog=document.createElement("dialog");
    dialog.style.cssText="border:1px solid #94a3b8;border-radius:14px;padding:23px;max-width:420px;width:92%;box-shadow:0 14px 45px #0003;";
    dialog.innerHTML='<form method="dialog"><h2 style="font-weight:800;font-size:19px;margin-bottom:12px">Confirmación de cobro</h2>'+
      '<p style="margin-bottom:12px">Se creará un pedido de prueba por <strong>'+money(totalCents)+
      '</strong>, con método <strong>'+escape(paymentPicker.selectedOptions[0]?.textContent||payment)+
      '</strong>. El pago quedará pendiente; no afirmamos haber cobrado efectivo ni tarjeta.</p>'+
      '<p style="color:#475569;font-size:13px;margin-bottom:15px">PrestaShop creará el pedido en '+escape(selectedStore)+
      ' con recogida en tienda y portes 0,00 €.</p>'+
      '<div style="display:flex;gap:12px;justify-content:end"><button value="cancel" style="padding:10px">Cancelar</button>'+
      '<button value="yes" style="background:#047857;color:white;border-radius:8px;padding:10px 15px;font-weight:750">Crear pedido sin cobrar</button></div></form>';
    document.body.append(dialog);
    const accepted=new Promise(resolve=>dialog.addEventListener("close",()=>{
      const confirmed=dialog.returnValue==="yes";
      dialog.remove();resolve(confirmed);
    },{once:true}));
    dialog.showModal();
    return accepted;
  }
  // Single sale request. Same request_id persists after any uncertain response; never
  // silently generate a second ID or assert success from an HTTP 200 alone.
  let pendingRequest=null;
  button.addEventListener('click',async()=>{
    if(button.disabled||busy||!authorized||!token)return;
    busy=true;renderTicket();
    try {
      const items=[...basket.values()];
      const amountCents=items.reduce((sum,i)=>sum+(i.quotedPriceCents||0)*i.quantity,0);
      const independentCash=payment==="cash"&&independentQaCashEnabled===true;
      if(independentCash){
        if(!await confirmIndependentQaOrder(amountCents))return;
      }else if(!["cod","bank"].includes(payment)||
               !await confirmPendingOrder(amountCents))return;
      if (!pendingRequest) pendingRequest=crypto.randomUUID();
      const lines=items.map(({pid,aid,quantity})=>({
        productId:pid,attributeId:aid,qty:quantity}));
      const payload=independentCash?{
        requestId:pendingRequest,store:selectedStore,drawerId,
        environment:"preproduccion",carrierId:5,paymentMethod:"cash",
        cashConfirmed:true,cashTenderedCents:amountCents,
        totalCents:amountCents,lines
      }:{
        requestId:pendingRequest,store:selectedStore,drawerId,
        environment:"preproduccion",paymentMethod:payment,
        cashConfirmed:false,lines
      };
      const response=await apiFetch("checkout",{method:"POST",body:payload});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.status!=="verified"||
         !Number.isSafeInteger(result.orderId))
        throw Error(result.message||result.reason||
          "Pedido no confirmado. No repetir con otra solicitud.");
      if(independentCash){
        if(result.qaOnly!==true||result.store!==selectedStore||
           result.shippingCents!==0||result.totalCents!==amountCents||
           !Array.isArray(result.stockAfter)||
           result.stockAfter.length!==items.length||
           result.stockAfter.some(line=>line.quantityAfter!==line.quantity-line.requested))
          throw Error("Pedido QA no coincide con stock, tienda o importes. No repetir.");
        setStatus("Pedido de prueba #"+result.orderId+
          " confirmado en PrestaShop PREPRODUCCIÓN; stock contrastado. No es venta comercial.");
      }else{
        if(result.shop!==selectedStore||result.shippingCents!==0||
           result.stockAfter!==result.stockBefore-1)
          throw Error("La confirmación no coincide con la tienda, los portes o el stock. No repetir.");
        setStatus("Pedido #"+result.orderId+" registrado en "+selectedStore+
          ". Recogida en tienda, portes 0,00 €, stock descontado. Pago pendiente.");
        void showOrderHistory().catch(e=>setStatus(String(e.message||e),true));
      }
      pendingRequest=null;basket.clear();renderTicket();
    } catch(e){
      setStatus(String(e.message||'El resultado del pedido es incierto. Consultar antes de reintentar.'),true);
    } finally {busy=false;renderTicket();}
  });

  async function load(next){
    setStatus('Consultando catálogo real de Hortimatic 8.2.8…');
    try{
      const response=await apiFetch("catalog",{query:{page:next}});
      const data=await response.json();
      if(!response.ok||data.source!=='REAL_PS8_READ_ONLY'||!Array.isArray(data.items))
        throw Error('Catálogo de PrestaShop no verificable');
      for(const product of data.items)for(const variant of product.variants||[]){
        const pid=Number(product.id_product),aid=Number(variant.id_product_attribute);
        if(!product.active||!Number.isSafeInteger(pid)||!Number.isSafeInteger(aid)||variant.stock_row_unique!==true)continue;
        products.set(key(pid,aid),{pid,aid,name:product.name,ref:variant.reference||product.reference,
          ean:variant.ean13,stock:Number(variant.stock_quantity)||0});
      }
      page=next;more=data.hasMore===true&&!data.resourceLimitExceeded;renderProducts();
      setStatus('Catálogo real: '+products.size+' variantes verificadas. Preproducción · sin ventas ficticias.');
      if(more && next<15)void load(next+1);
    }catch(e){setStatus(String(e.message||e),true);}
  }
  renderTicket();
  setStatus("Inicia sesión en Totus TPV para consultar el catálogo de PrestaShop.",false);
})();