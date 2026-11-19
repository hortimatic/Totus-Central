import {esc,download} from '../utils.js';
const amount=(cents,currency='EUR')=>new Intl.NumberFormat('es-ES',{style:'currency',currency}).format(cents/100);
const date=value=>new Date(value).toLocaleString('es-ES');
/** Existing native documents, through the same authenticated Central session.
 * This view has no issue/save/payment/recovery commands. */
export function createTpvBillingUI({actor,client}){
 let root=null,owner=null,generation=0,call=null,sources=[],selected=null,items=[],cursor=null,previous=[],query='',detail=null,busy=false,message='';
 const valid=stamp=>root?.isConnected&&owner===actor()&&stamp===generation;
 const selection=()=>({connectionId:selected.connectionId,shopId:selected.shopId});
 function render(){
  if(!valid(generation))return;
  root.innerHTML='<section class="card tpv-billing"><header class="section-head card-pad"><div><h2>Facturas del TPV</h2><p>Documentos emitidos en las ventas de mostrador.</p></div><span class="badge info">Pruebas</span></header>'+
   '<div class="card-pad"><p class="note">Estos documentos pertenecen al entorno de pruebas. Se conservan su factura y sus abonos originales; sus importes quedan fuera de los ingresos del negocio.</p>'+
   '<form data-billing-search class="filters"><label class="field">Establecimiento<select data-billing-source '+(busy?'disabled':'')+'>'+sources.map((row,index)=>'<option value="'+index+'" '+(row===selected?'selected':'')+'>'+esc(row.storeName)+' · pruebas</option>').join('')+'</select></label>'+
   '<label class="field">Buscar venta<input data-billing-query value="'+esc(query)+'" placeholder="Número de pedido, caja o vendedor" '+(busy?'disabled':'')+'></label><button class="btn secondary" '+(busy||!selected?'disabled':'')+'>Buscar</button></form>'+
   '<p role="status" aria-live="polite">'+esc(message||(busy?'Consultando documentos…':''))+'</p>'+
   (detail?detailHtml():listHtml())+'</div></section>';
 }
 function listHtml(){
  if(!selected)return '<div class="empty"><h3>No hay establecimientos preparados</h3><p>El responsable debe preparar la conexión del TPV para consultar sus documentos.</p></div>';
  if(!items.length)return busy?'':'<div class="empty"><h3>No hay ventas para esta consulta</h3><p>Prueba con otro número de pedido o consulta otro establecimiento.</p></div>';
  return '<div class="stack">'+items.map(row=>'<article class="tpv-billing-sale" data-billing-sale="'+esc(row.id)+'"><div><b>Pedido #'+esc(row.orderId)+'</b><p class="small muted">'+esc(date(row.createdAt))+' · '+esc(row.drawerName)+'</p><p class="small">'+esc(row.operatorName)+'</p></div><div><strong>'+esc(amount(row.totalCents,row.currency))+'</strong>'+
   (row.refundCents?'<p class="small">Abonado: '+esc(amount(row.refundCents,row.currency))+'</p>':'')+'</div><button class="btn primary" type="button" data-billing-open="'+esc(row.id)+'" '+(busy?'disabled':'')+'>Ver factura</button></article>').join('')+
   '</div><div class="pagination"><button class="btn secondary" type="button" data-billing-prev '+(busy||!previous.length?'disabled':'')+'>Anterior</button><span>Página '+(previous.length+1)+'</span><button class="btn secondary" type="button" data-billing-next '+(busy||!cursor?'disabled':'')+'>Siguiente</button></div>';
 }
 function detailHtml(){
  const {document:doc,sale}=detail;
  const discount=Math.round(Number(doc.discount_tax_incl||0)*100),shipping=Math.round(Number(doc.shipping_tax_incl||0)*100);
  return '<button type="button" class="btn secondary" data-billing-back '+(busy?'disabled':'')+'>← Volver a las ventas</button><header class="section-head card-pad"><div><div class="eyebrow">Factura original</div><h3>'+esc(doc.formatted_number)+'</h3><p>Pedido #'+esc(doc.order_id)+' · '+esc(doc.order_reference)+'</p><p class="small">'+esc(doc.issued_at)+' · '+esc(sale.drawerName)+' · '+esc(sale.operatorName)+'</p></div><strong>'+esc(amount(doc.total_cents,doc.currency))+'</strong></header>'+
   '<div class="inline-actions"><button type="button" class="btn secondary" data-billing-signature '+(busy?'disabled':'')+'>Factura firmada</button><button type="button" class="btn primary" data-billing-pdf="invoice" '+(busy?'disabled':'')+'>Descargar factura</button>'+sale.refunds.map((row,index)=>'<button type="button" class="btn secondary" data-billing-pdf="credit-note" data-billing-refund="'+esc(row.id)+'" '+(busy?'disabled':'')+'>Abono '+(index+1)+' · '+esc(amount(row.totalCents,doc.currency))+'</button>').join('')+'</div>'+
   '<div class="table-wrap"><table><thead><tr><th>Artículo</th><th>Cantidad</th><th>Precio con IVA</th><th>Total</th></tr></thead><tbody>'+doc.lines.map(row=>'<tr><td>'+esc(row.name)+'</td><td>'+esc(row.quantity)+'</td><td>'+esc(new Intl.NumberFormat('es-ES',{style:'currency',currency:doc.currency,maximumFractionDigits:6}).format(Number(row.unit_tax_incl)))+'</td><td>'+esc(amount(Math.round(Number(row.line_tax_incl)*100),doc.currency))+'</td></tr>').join('')+'</tbody></table></div>'+
   '<div class="metric-list">'+(discount?'<div class="metric-box"><span>Descuento general</span><b>−'+esc(amount(discount,doc.currency))+'</b></div>':'')+
   (shipping?'<div class="metric-box"><span>Transporte incluido</span><b>'+esc(amount(shipping,doc.currency))+'</b></div>':'')+
   '<div class="metric-box"><span>Base imponible</span><b>'+esc(amount(Math.round(Number(doc.total_tax_excl)*100),doc.currency))+'</b></div><div class="metric-box"><span>IVA</span><b>'+esc(amount(doc.total_cents-Math.round(Number(doc.total_tax_excl)*100),doc.currency))+'</b></div></div>'+
   (discount?'<p class="small muted">El descuento general se aplica al total de la factura.</p>':'');
 }
 async function run(work){
  if(busy||!valid(generation))return;const stamp=generation;busy=true;message='';render();
  try{await work(stamp);}catch(error){if(valid(stamp))message=error.message||'No se han podido consultar los documentos.';}
  finally{if(valid(stamp)){busy=false;render();}}
 }
 async function load(stamp,before=null){
  const result=await call({action:'billing-list',selection:selection(),query:{search:query,limit:20,...(before?{cursor:before}:{})}});
  if(!valid(stamp))return;items=result.items;cursor=result.hasMore?result.cursor:null;detail=null;
 }
 async function mount(target,initial=null){
  dispose();root=target;if(!root)return;owner=actor();call=client(owner);const stamp=generation;
  root.onsubmit=event=>{if(!event.target.matches('[data-billing-search]'))return;event.preventDefault();const value=root.querySelector('[data-billing-query]').value.trim();
   void run(async token=>{query=value;previous=[];await load(token);});};
  root.onchange=event=>{if(event.target.matches('[data-billing-source]')){const row=sources[Number(event.target.value)];if(!row)return;void run(async token=>{selected=row;query='';previous=[];items=[];cursor=null;detail=null;await load(token);});}};
  root.onclick=event=>{const button=event.target.closest('button');if(!button||busy)return;
   if(button.hasAttribute('data-billing-open'))void run(async token=>{const value=await call({action:'billing-document',selection:selection(),operationId:button.dataset.billingOpen,kind:'billing'});if(valid(token))detail=value;});
   if(button.hasAttribute('data-billing-back')){detail=null;render();}
   if(button.hasAttribute('data-billing-next')&&cursor){const next=cursor;void run(async token=>{await load(token,next);if(valid(token))previous.push(next);});}
   if(button.hasAttribute('data-billing-prev')&&previous.length){const back=previous.length>1?previous[previous.length-2]:null;void run(async token=>{await load(token,back);if(valid(token))previous.pop();});}
   if(button.hasAttribute('data-billing-signature')&&detail){const saleId=detail.sale.id;void run(async token=>{
    const doc=await call({action:'billing-signature',selection:selection(),operationId:saleId});if(!valid(token))return;
    if(doc.available===false){message='Esta factura todavía no tiene una copia firmada guardada en Central.';return;}
    if(doc.available!==true||doc.orderId!==detail.sale.orderId||doc.mime!=='application/pdf'||doc.filename!=='totus-invoice-'+doc.orderId+'-firmada.pdf')throw Error('No se ha podido comprobar la factura firmada.');
    const bytes=Uint8Array.from(atob(doc.base64),c=>c.charCodeAt(0));download(new Blob([bytes],{type:'application/pdf'}),doc.filename);message='Factura firmada preparada para descargar.';});}
   if(button.hasAttribute('data-billing-pdf')&&detail){const saleId=detail.sale.id,kind=button.dataset.billingPdf,refundId=button.dataset.billingRefund;
    void run(async token=>{const doc=await call({action:'billing-document',selection:selection(),operationId:saleId,kind,...(refundId?{refundId}:{})});if(!valid(token))return;
     const bytes=Uint8Array.from(atob(doc.base64),c=>c.charCodeAt(0));
     download(new Blob([bytes],{type:'application/pdf'}),(kind==='invoice'?'Factura':'Abono')+'-pedido-'+doc.orderId+'.pdf');message='Documento preparado para descargar.';});}
  };
  busy=true;render();try{const ctx=await call({action:'billing-context'});if(!valid(stamp))return;sources=ctx.sources;
   selected=initial?sources.find(row=>row.connectionId===initial.connectionId&&row.shopId===initial.shopId)??null:sources[0]??null;
   if(initial&&!selected)throw Error('La factura pertenece a un establecimiento que no está disponible para tu cuenta.');
   if(selected){await load(stamp);if(initial?.saleId&&valid(stamp)){
    const value=await call({action:'billing-document',selection:selection(),operationId:initial.saleId,kind:'billing'});if(valid(stamp))detail=value;
   }}}
  catch(error){if(valid(stamp))message=error.message;}finally{if(valid(stamp)){busy=false;render();}}
 }
 function dispose(){generation++;if(root)root.onclick=root.onchange=root.onsubmit=null;root=null;owner=null;call=null;sources=[];selected=null;items=[];cursor=null;previous=[];query='';detail=null;busy=false;message='';}
 return {mount,dispose};
}
