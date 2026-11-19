const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel=status=>({pending:'Preparada',processing:'En curso',verified:'Verificada',uncertain:'Pendiente de recuperar',dispatched:'Consultando resultado',cancelled:'Cancelada'}[status]||status);
export function createStockIntake({adapter,canEdit=()=>false}){
 let rows=[],reason='',receipts=[],active=null;
 const hasDraft=()=>rows.length>0||reason.trim()!=='';
 const pending=()=>receipts.some(row=>['pending','processing'].includes(row.status));
 function reset(){rows=[];reason='';receipts=[];active=null;}
 function add(product){
  if(!canEdit())throw Error('No tienes permiso para registrar mercancía.');
  if(product.chooseVariant)throw Error('Elige la variante del artículo.');
  const row=rows.find(row=>row.productId===product.id);
  if(row&&row.quantity>=10000)throw Error('Una línea admite hasta 10.000 unidades.');
  if(row)row.quantity++;else{if(rows.length>=200)throw Error('Una entrada admite hasta 200 artículos distintos.');rows.push({productId:product.id,name:product.name,quantity:1});}
 }
 function html(){return `<section class="tpv-stock-intake"><h4>Mercancía recibida</h4><p>Escanea cada unidad o elige un artículo. Si repites un código, se suma una unidad a su línea.</p>
  <form data-tpv-form="stock-batch"><label>Albarán o motivo<input name="reason" data-tpv-stock-reason maxlength="500" required value="${esc(reason)}" placeholder="Ej.: Albarán del proveedor 1582"></label>
  <div class="tpv-stock-rows">${rows.map(row=>`<div class="tpv-stock-row"><strong>${esc(row.name)}</strong><label>Unidades recibidas<input data-tpv-stock-quantity="${esc(row.productId)}" type="number" min="1" max="10000" step="1" required value="${row.quantity}"></label><button class="btn secondary" type="button" data-tpv-stock-remove="${esc(row.productId)}" aria-label="Quitar ${esc(row.name)}">×</button></div>`).join('')||'<p class="tpv-empty">Todavía no has añadido artículos a esta entrada.</p>'}</div>
  <p><b>${rows.length}</b> artículos · <b>${rows.reduce((n,row)=>n+row.quantity,0)}</b> unidades</p><button class="btn primary" type="submit" ${!rows.length||!canEdit()?'disabled':''}>Guardar entrada para revisar</button></form>
  ${active?`<section class="tpv-stock-review"><h4>${esc(active.reason)} · ${esc(statusLabel(active.status))}</h4><p>La entrada ya está guardada en Central. Cada línea conserva su resultado aunque cierres el navegador.</p>
  ${active.lines.map(line=>`<div class="tpv-stock-result"><span>${esc(line.label)} · ${line.quantity} ud.</span><strong>${esc(statusLabel(line.status))}</strong>${line.result?`<small>Existencias: ${line.result.before} → ${line.result.after}</small>`:''}</div>`).join('')}
  <div class="inline-actions">${['pending','processing'].includes(active.status)?`<button type="button" class="btn primary" data-tpv-stock-run="${esc(active.id)}">${active.status==='pending'?'Confirmar y registrar mercancía':'Recuperar y continuar entrada'}</button>`:''}${active.status==='pending'?`<button type="button" class="btn secondary" data-tpv-stock-cancel="${esc(active.id)}">Cancelar entrada sin registrar</button>`:''}</div></section>`:''}
  <details class="tpv-stock-history" ${pending()?'open':''}><summary>Entradas guardadas · esta caja</summary><button class="btn secondary" type="button" data-tpv-stock-refresh>Actualizar entradas</button>${receipts.map(row=>`<button class="btn secondary" type="button" data-tpv-stock-receipt="${esc(row.id)}">${esc(row.reason)} · ${esc(statusLabel(row.status))}</button>`).join('')||'<p>No hay entradas guardadas en esta sesión.</p>'}</details></section>`;}
 async function load(){receipts=await adapter().stockReceipts();if(active)active=receipts.find(row=>row.id===active.id)||active;}
 async function save(){
  if(!canEdit()||!rows.length||!reason.trim())throw Error('Añade artículos e indica el albarán o motivo.');
  if(rows.some(row=>!Number.isSafeInteger(row.quantity)||row.quantity<1||row.quantity>10000))throw Error('Indica unidades enteras entre 1 y 10.000.');
  active=await adapter().createStockReceipt({reason:reason.trim(),lines:structuredClone(rows)});rows=[];reason='';await load();
 }
 async function run(id){
  if(!canEdit())throw Error('No tienes permiso para registrar mercancía.');
  active=await adapter().getStockReceipt(id);
  for(let step=0;step<200&&['pending','processing'].includes(active.status);step++){
   const before=active.lines.filter(line=>line.status==='verified').length;
   active=await adapter().advanceStockReceipt(id);
   if(active.lines.filter(line=>line.status==='verified').length<=before)break;
  }
  await load();
  if(['pending','processing'].includes(active.status))throw Error('Hay una línea pendiente de recuperar. Pulsa Recuperar y continuar entrada; las líneas verificadas se conservan.');
 }
 return Object.freeze({html,add,reset,hasDraft,pending,load,save,run,
  snapshot:()=>structuredClone({rows,reason,receipts,active}),
  input(target){if(target.hasAttribute('data-tpv-stock-reason')){reason=target.value;return true;}
   if(target.hasAttribute('data-tpv-stock-quantity')){const row=rows.find(row=>row.productId===target.dataset.tpvStockQuantity);if(row)row.quantity=Number(target.value);return true;}return false;},
  remove(id){rows=rows.filter(row=>row.productId!==id);},
  async select(id){active=await adapter().getStockReceipt(id);},
  async cancel(id){active=await adapter().cancelStockReceipt(id);await load();}
 });
}
