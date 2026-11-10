/* Totus Central — Inicio modular. Enhances existing home DOM, preserving forms,
 * accounting functions and delegated data-action/data-route handlers. */
import {HOME_WIDGET_CATALOG,createHomeDashboard,readHomeDashboard,addHomeWidget,duplicateHomeWidget,removeHomeWidget,setHomeWidgetConfig,reorderHomeWidget} from './home-widgets-core.js';
import {nextOpeningSummary} from './home-openings-view.js';
import {state,getFilters} from './state.js';
import {esc,money,isoToday} from './utils.js';
import {storeConnection,PRESTASHOP_STORES} from './prestashop-readonly.js';
import {prestashopReadiness} from './prestashop-ui.js';
import {sourceCents} from './prestashop-insights.js';
import {archiveAccepted} from './historical-acceptance.js';

const defaultSpecs=[
 ['cash.openings','opening',12],['home.income','income',3],['home.expenses','expense',3],
 ['home.result','result',3],['home.internal','internal',3],['home.gain','gain',3],
 ['cash.history','recent-closings',4],['home.shortcuts','quick-links',5],
 ['home.activity','activity',12],['prestashop.summary','shop-h',6,'hortimatic'],
 ['prestashop.summary','shop-n',6,'newoldsmok'],['prestashop.orders','orders',12,'all'],
 ['cash.store','store',12],['expenses.quarter','expense-quarter',6],
 ['home.alerts','alerts',6],['pricing.quick','price',6],['billing.pending','billing',6],
 ['documents.latest','documents',6],['fiscal.forecast','fiscal',6],
 ['reports.shortcut','reports',6],['system.status','system',6],['tasks.today','tasks',6]
];
// These panels own live form state or asynchronous DOM IDs and cannot safely be cloned.
const nonClonable=new Set(['pricing.quick','home.activity','tasks.today','system.status','home.alerts']);
const confirmDiscard=()=>typeof window==='undefined'||window.confirm('Hay cambios del Inicio sin guardar. ¿Descartarlos?');
const safeStore=key=>PRESTASHOP_STORES.some(s=>s.key===key)?key:'all';
const safeDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))?s:'';
const minusDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)};
const labelStore=k=>PRESTASHOP_STORES.find(s=>s.key===k)?.name||'Todas las tiendas';
const metric=(label,value)=>`<div class="home-ps-metric"><small>${esc(label)}</small><strong>${esc(String(value))}</strong></div>`;
const allowedWidths=w=>[3,4,5,6,7,8,9,10,11,12].filter(x=>x>=HOME_WIDGET_CATALOG[w.type].minWidth&&x<=HOME_WIDGET_CATALOG[w.type].maxWidth);
const dateRange=w=>{const today=isoToday();return {from:safeDate(w.filters.from)||minusDays(today,6),to:safeDate(w.filters.to)||today};};
const permitted=(w,can)=>w.type.startsWith('prestashop.')?can('prestashop','view'):
 w.type.startsWith('cash.')?can('cajas','view'):
 w.type.startsWith('expenses.')?can('gastos','view'):
 w.type.startsWith('billing.')?can('facturacion','view'):
 w.type.startsWith('pricing.')?can('pricing','view'):
 w.type.startsWith('documents.')?can('documentos','view'):
 w.type.startsWith('fiscal.')?can('fiscalidad','view'):
 w.type.startsWith('reports.')?can('informes','view'):
 w.type.startsWith('tasks.')?can('tareas','view'):
 w.type.startsWith('system.')?can('administracion','view'):
 w.type.startsWith('chat.')?can('equipo','view'):
 w.type.startsWith('receptions.')?can('documentos','view'):
 w.type.startsWith('products.')?can('productos','view'):true;
function createDefault(){
 let y=0;
 return createHomeDashboard(defaultSpecs.map(([type,id,width,store])=>({type,id,scope:{store:store||'all'},layout:{desktop:{x:0,y:y++,w:width,h:type==='prestashop.orders'?9:HOME_WIDGET_CATALOG[type].height},tablet:{order:y},mobile:{order:y}}})));
}
function collectExisting(root){
 const old=root.querySelector('.home-period-kpis');const kpis=[...(old?.children||[])];
 const zones=[...root.querySelectorAll('.home-zone')];
 const groups=zones.map(z=>[...z.querySelectorAll('.dashboard-grid > article')]);
 const nodes=new Map([
 ['opening',root.querySelector('.opening-panel')],['income',kpis[0]],['expense',kpis[1]],
 ['result',kpis[2]],['internal',kpis[3]],['activity',root.querySelector('.home-activity')],
 ['store',root.querySelector('.dashboard-store-grid')],['expense-quarter',groups[0]?.[0]],
 ['alerts',groups[0]?.[1]],['price',groups[1]?.[0]],['billing',groups[1]?.[1]],
 ['documents',groups[2]?.[0]],['fiscal',groups[2]?.[1]],
 ['reports',groups[3]?.[0]],['system',groups[3]?.[1]],['tasks',groups[3]?.[2]]
 ]);
 old?.remove();zones.forEach(z=>z.remove());
 return nodes;
}
function openingStatus(){
 const outcome=nextOpeningSummary(state.data,{today:isoToday()});
 const total=outcome.complete?`Total confirmado para abrir: ${money(outcome.total)}`:
 `Importes conocidos: ${money(outcome.partialKnown)} · ${outcome.missing} sin importe · ${outcome.stale} de cierre anterior. Total no confirmado.`;
 return `<div class="home-opening-summary"><span>${esc(total)}</span><small>${outcome.items.length} cajones activos · desglose por establecimiento y cajón</small></div>`;
}
function psPlaceholder(w){
 const shop=safeStore(w.scope.store);if(shop==='all'&&w.type==='prestashop.summary')return `<div class="home-ps-message">Selecciona una tienda para consultar su resumen.</div>`;
 return `<div class="home-ps-message" role="status">Sin consulta todavía. <button type="button" data-home-command="fetch" data-id="${esc(w.id)}">Consultar ${esc(labelStore(shop))}</button></div>`;
}
function fallbackContent(w){
 const dest={
 'cash.history':['Cierres recientes','cajas'],'cash.withdrawals':['Retiradas y efectivo','cajas'],
 'expenses.pending':['Pendientes de revisión','gastos'],'prestashop.top':['Productos más vendidos','prestashop'],
 'prestashop.quality':['Calidad de catálogo','prestashop'],'receptions.pending':['Recepciones y cotejos','documentos'],
 'products.pending':['Revisiones de productos','productos'],'chat.alerts':['Avisos del equipo','equipo'],
 'home.shortcuts':['Accesos rápidos','inicio']
 }[w.type];
 if(!dest)return `<p class="muted">No hay una lectura verificada para este widget.</p>`;
 const prestashopTab=w.type==='prestashop.quality'?'catalog':w.type==='receptions.pending'?'receipts':null;
 return `<div class="home-widget-empty"><p>Consulta la información de ${esc(dest[0])} desde su módulo. No se mostrarán cifras inventadas.</p><button class="btn secondary" ${prestashopTab?`data-home-command="open-prestashop-tab" data-tab="${prestashopTab}"`:`data-route="${dest[1]}"`}>Abrir ${esc(dest[0])}</button></div>`;
}
function verifiedCurrency(orders,currencies){return orders.length&&orders.every(row=>currencies.get(String(row.id_currency))==='EUR')}
const cents=value=>sourceCents(typeof value==='number'&&Number.isFinite(value)?value.toFixed(2):value);
function orderStats(rows,currencies,complete){
 const valid=rows.filter(row=>String(row.valid)==='1');
 const amountCents=valid.map(r=>currencies.get(String(r.id_currency))==='EUR'?cents(r.total_paid_tax_incl):null);
 const unknownStatus=rows.some(row=>!['0','1'].includes(String(row.valid)));
 const ok=complete&&!unknownStatus&&valid.length===amountCents.length&&amountCents.every(Number.isSafeInteger);
 const total=ok?amountCents.reduce((a,b)=>a+b,0):null;
 return {count:valid.length,total:total===null?null:total/100,ticket:total===null||!valid.length?null:total/100/valid.length,complete:ok};
}
function smallBars(rows){
 const totals=new Map();for(const row of rows){const day=String(row.date_add||'').slice(0,10);totals.set(day,(totals.get(day)||0)+1)}
 const values=[...totals].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([,n])=>n),max=Math.max(1,...values);
 return `<div class="home-sparkline" role="img" aria-label="Pedidos por día">${values.length?values.map(n=>`<span style="height:${Math.max(6,Math.round(n/max*100))}%"></span>`).join(''):'<span class="muted">Sin pedidos</span>'}</div>`;
}
function psSummary(w,data){
 const shop=safeStore(w.scope.store),r=data?.[shop];
 if(!r)return psPlaceholder(w);
 if(r.error)return `<div class="home-ps-message" role="alert">${esc(r.error)} <button data-home-command="fetch" data-id="${esc(w.id)}">Reintentar</button></div>`;
 const {count,total,ticket,complete}=orderStats(r.rows,r.currencies,r.complete);
 const countText=complete?count:'Parcial: '+count;
 return `<div class="home-ps-content"><div class="home-ps-metrics">${metric('Ventas',complete?money(total):'Sin total fiable')}${metric('Pedidos válidos',countText)}${metric('Ticket medio',ticket!==null?money(ticket):'—')}${metric('Catálogo','Abrir para revisar')}${metric('Margen comercial','No validado')}</div><p class="small muted">${esc(labelStore(shop))} · ${esc(r.from)} → ${esc(r.to)} · ${r.complete?'lectura completa':'lectura parcial'} · ${esc(r.checked||'')}</p><div class="home-ps-panels"><div><h4>Pedidos por día</h4>${smallBars(r.rows)}</div><div><h4>Productos más vendidos</h4>${r.top?.length?`<ol class="home-ps-top">${r.top.map(p=>`<li>${esc(p.name)} <b>${esc(String(p.qty))} uds</b></li>`).join('')}</ol>`:'<p class="small muted">Líneas no consultadas o cobertura incompleta. Abrir PrestaShop.</p>'}</div></div><div class="home-widget-actions"><button type="button" class="btn secondary" data-home-command="fetch" data-id="${esc(w.id)}">Actualizar</button><button type="button" class="btn secondary" data-route="prestashop">Abrir PrestaShop</button></div></div>`;
}
function psOrders(w,data){
 const store=safeStore(w.scope.store);const shops=store==='all'?PRESTASHOP_STORES.map(s=>s.key):[store];
 const responses=shops.map(s=>data?.[s]).filter(Boolean);const errors=responses.map(r=>r.error).filter(Boolean);
 if(!responses.length)return psPlaceholder(w);
 const allRows=responses.flatMap(r=>r.error?[]:r.rows.map(order=>({...order,_shop:r.shop,_currency:r.currencies.get(String(order.id_currency))||null})));
 const paymentOptions=[...new Set(allRows.map(r=>String(r.payment||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const rows=allRows
 .filter(r=>w.filters.status==='valid'?String(r.valid)==='1':w.filters.status==='invalid'?String(r.valid)!=='1':true)
 .filter(r=>{const q=String(w.filters.query||'').toLocaleLowerCase('es').trim();return !q||String(r.id||'').includes(q)||String(r.reference||'').toLocaleLowerCase('es').includes(q)})
 .filter(r=>!w.filters.payment||w.filters.payment==='all'||String(r.payment||'').trim()===w.filters.payment)
 .sort((a,b)=>{const d=String(b.date_add||'').localeCompare(String(a.date_add||''))||Number(b.id)-Number(a.id);return w.filters.sort==='oldest'?-d:d});
 const pageSize=[10,15,20].includes(Number(w.filters.pageSize))?Number(w.filters.pageSize):10;
 const pages=Math.max(1,Math.ceil(rows.length/pageSize)),page=Math.min(pages-1,Math.max(0,Number(w.filters.page)||0));
 const visible=rows.slice(page*pageSize,(page+1)*pageSize);
 const partial=shops.some(s=>!data?.[s]||!data[s].complete||data[s].error);
 return `<div class="home-order-toolbar"><label>Buscar <input type="search" data-home-filter="query" data-id="${esc(w.id)}" value="${esc(w.filters.query||'')}" placeholder="Nº o referencia" maxlength="80"></label><label>Estado <select data-home-filter="status" data-id="${esc(w.id)}"><option value="all">Todos</option><option value="valid" ${w.filters.status==='valid'?'selected':''}>Válidos</option><option value="invalid" ${w.filters.status==='invalid'?'selected':''}>No válidos</option></select></label><label>Pago <select data-home-filter="payment" data-id="${esc(w.id)}"><option value="all">Todos</option>${paymentOptions.map(p=>`<option value="${esc(p)}" ${w.filters.payment===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>Orden <select data-home-filter="sort" data-id="${esc(w.id)}"><option value="newest">Más recientes</option><option value="oldest" ${w.filters.sort==='oldest'?'selected':''}>Más antiguos</option></select></label><button type="button" data-home-command="fetch" data-id="${esc(w.id)}" class="btn secondary">Actualizar</button></div>
 ${errors.length?`<p class="home-error" role="alert">${esc(errors.join(' · '))}</p>`:''}${partial?'<p class="small muted">Consulta parcial o pendiente: el recuento no representa todas las ventas.</p>':''}
 <div class="home-orders-scroll" role="region" aria-label="Tabla de pedidos de PrestaShop; desplazamiento horizontal y vertical" tabindex="0" data-home-orders-viewport="${esc(w.id)}"><table class="data-table home-orders-table"><thead><tr><th>Pedido</th><th>Referencia</th><th>Tienda</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha y hora</th><th>Margen</th></tr></thead><tbody>${visible.map(row=>`<tr><td><button type="button" class="home-order-link" data-home-command="open-order" data-shop="${esc(row._shop)}" data-order="${esc(String(row.id))}" data-date="${esc(String(row.date_add||'').slice(0,10))}">#${esc(row.id)}</button></td><td>${esc(row.reference||'—')}</td><td>${esc(labelStore(row._shop))}</td><td>Consultar cliente</td><td>${row._currency==='EUR'&&cents(row.total_paid_tax_incl)!==null?money(cents(row.total_paid_tax_incl)/100):'Moneda sin verificar'}</td><td>${esc(row.payment||'—')}</td><td>${String(row.valid)==='1'?'Válido':'No válido'}</td><td>${esc(row.date_add||'')}</td><td>Sin validar</td></tr>`).join('')||'<tr><td colspan="9">No hay pedidos para estos filtros.</td></tr>'}</tbody></table></div>
 <div class="home-order-footer"><div class="home-order-scroll-actions"><button type="button" aria-label="Mover columnas a la izquierda" data-home-command="scroll-left" data-id="${esc(w.id)}">◀</button><button type="button" aria-label="Mover columnas a la derecha" data-home-command="scroll-right" data-id="${esc(w.id)}">▶</button></div><label>Filas <select data-home-filter="pageSize" data-id="${esc(w.id)}">${[10,15,20].map(n=>`<option value="${n}" ${pageSize===n?'selected':''}>${n}</option>`).join('')}</select></label><span>Página ${page+1} de ${pages}${partial?' · parcial':''}</span><button type="button" data-home-command="prev-page" data-id="${esc(w.id)}" ${page===0?'disabled':''}>‹</button><button type="button" data-home-command="next-page" data-id="${esc(w.id)}" ${page>=pages-1?'disabled':''}>›</button><button class="btn secondary" data-home-command="open-orders" data-id="${esc(w.id)}">Abrir pedidos</button></div>`;
}
export function createHomeWidgetsUI({rpc,invoke,can,notify=()=>{},onOpenOrders=()=>{},onOpenExpense=()=>{}}){
 let root=null,grid=null,model=null,original=null,sources=new Map(),edit=false,selected=null,owner=null,token=0,remoteReady=false,busy=false,connections=null,connectionsTask=null;
 const ordersData=new Map(),queries=new Map();let activeDrag=null,activeResize=null;
 const live=()=>root?.isConnected&&state.route==='inicio'&&state.user?.id===owner;
 const find=id=>model?.widgets.find(w=>w.id===id);
 const clones=new Map();
 const status=(message,warning=false)=>{const el=root?.querySelector('[data-home-status]');if(el){el.textContent=message;el.classList.toggle('home-error',warning)}};
 const layoutKey=w=>[safeStore(w.scope.store),...Object.values(dateRange(w))].join('|');
 const dataFor=w=>Object.fromEntries(PRESTA_SHOPS(w).map(k=>[k,ordersData.get(k+'|'+Object.values(dateRange(w)).join('|'))]));
 function PRESTA_SHOPS(w){return safeStore(w.scope.store)==='all'?PRESTASHOP_STORES.map(x=>x.key):[safeStore(w.scope.store)]}
 const freshWidget=(w)=>{
  if(w.type==='prestashop.summary')return psSummary(w,dataFor(w));
  if(w.type==='prestashop.orders')return psOrders(w,dataFor(w));
  if(w.type==='prestashop.top'){
   const data=dataFor(w),shops=PRESTA_SHOPS(w);
   return `<div class="home-ps-content">${shops.map(shop=>{
    const read=data[shop],top=read?.top;
    return `<section class="home-top-products"><h4>${esc(labelStore(shop))}</h4>${read?.error?`<p role="alert">${esc(read.error)}</p>`:Array.isArray(top)?(top.length?`<ol class="home-ps-top">${top.map(x=>`<li>${esc(x.name)} <b>${esc(String(x.qty))} uds</b></li>`).join('')}</ol>`:'<p>Sin unidades vendidas en los pedidos consultados.</p>'):'<p class="small muted">Sin clasificación completa: consulta los pedidos y sus líneas.</p>'}`}).join('')}<div class="home-widget-actions"><button type="button" class="btn secondary" data-home-command="fetch" data-id="${esc(w.id)}">Actualizar vendidos</button><button type="button" class="btn secondary" data-route="prestashop">Abrir PrestaShop</button></div></div>`;
  }
  if(w.type==='home.gain')return `<div class="home-gain-empty"><strong>Sin validar</strong><p>Ganancia comercial: ventas netas de producto menos su coste verificado en la fecha de venta. Los costes actuales de variaciones no acreditan la ganancia histórica.</p><button class="btn secondary" data-route="prestashop">Revisar costes y ventas</button></div>`;
  if(w.type==='expenses.pending'){
   // Fiscal-review queue: not the unpaid-invoice balance. The original Inicio
   // deliberately keeps payment status, document presence and fiscal review distinct.
   const chosen=safeStore(w.scope.store),selected=chosen==='all'?null:state.data.stores.find(store=>store.name?.toLowerCase()===chosen);
   const pending=(state.data.expenses||[]).filter(row=>
    !archiveAccepted(state.data.settings,row,'expense')&&row.management_only!==true&&row.fiscal_reviewed===false&&
    (chosen==='all'||row.store_id===selected?.id)
   ).sort((a,b)=>String(b.expense_date||'').localeCompare(String(a.expense_date||'')));
   return `<div class="home-pending-expenses"><p><strong>${pending.length} gastos con revisión fiscal pendiente</strong></p>
    <p class="small muted">Revisión fiscal pendiente no significa factura ausente ni pago pendiente. No se modifica ninguna deducción desde este widget.</p>
    <div class="stack">${pending.slice(0,6).map(row=>`<div class="summary-row"><span><strong>${esc(row.supplier_name||row.description||'Gasto')}</strong><small>${esc(row.expense_date||'Fecha sin confirmar')} · ${esc(state.data.stores.find(x=>x.id===row.store_id)?.name||'General')}</small></span><button type="button" class="btn secondary" data-home-command="open-expense" data-expense="${esc(row.id)}">Ver gasto</button></div>`).join('')||'<p class="small muted">No hay gastos pendientes de revisión fiscal en los registros cargados.</p>'}</div>
    <div class="home-widget-actions"><button class="btn secondary" data-route="gastos">Abrir Gastos</button></div></div>`;
  }
  if(w.type==='cash.withdrawals'){
   const chosen=safeStore(w.scope.store),shop=state.data.stores.find(store=>store.name?.toLowerCase()===chosen);
   const closings=(state.data.closings||[]).filter(row=>(chosen==='all'||row.store_id===shop?.id)&&row.cash_withdrawals!==null&&row.cash_withdrawals!==undefined).sort((a,b)=>String(b.business_date||'').localeCompare(String(a.business_date||''))).slice(0,6);
   return `<p class="small muted">Retiradas anotadas en los cierres. No son otra venta ni un gasto deducible por sí mismas. No se reparten entre cajones sin origen comprobado.</p><div class="stack">${closings.map(row=>{const v=Number(row.cash_withdrawals),label=Number.isFinite(v)&&v>=0?money(v):'Importe no verificado';return `<div class="summary-row"><span>${esc(row.business_date||'Sin fecha')} · ${esc(state.data.stores.find(store=>store.id===row.store_id)?.name||'Tienda')}</span><strong>${esc(label)}</strong></div>`}).join('')||'<p class="small muted">No constan retiradas en los cierres cargados.</p>'}</div><button class="btn secondary" data-route="cajas">Abrir Cajas</button>`;
  }
  if(w.type==='cash.history'){const chosen=safeStore(w.scope.store),shop=state.data.stores.find(store=>store.name?.toLowerCase()===chosen);const rows=state.data.closings.filter(row=>chosen==='all'||row.store_id===shop?.id).sort((a,b)=>String(b.business_date).localeCompare(String(a.business_date))).slice(0,5);return `<div class="stack">${rows.map(row=>`<div class="summary-row"><span>${esc(row.business_date)} · ${esc(state.data.stores.find(s=>s.id===row.store_id)?.name||'Tienda')}</span><b>${row.status==='cerrado'?esc(row.status):'Pendiente'}</b></div>`).join('')||'<p>Sin cierres</p>'}</div><button class="btn secondary" data-route="cajas">Abrir Cajas</button>`}
  if(w.type==='home.shortcuts')return `<div class="home-widget-actions"><button class="btn secondary" data-route="cajas">Cajas</button><button class="btn secondary" data-route="gastos">Gastos</button><button class="btn secondary" data-route="facturacion">Facturación</button><button class="btn secondary" data-route="documentos">Documentos</button></div>`;
  const source=sources.get(w.id)||sources.get(w.type);
  if(!source)return fallbackContent(w);
  let content=source;if(source.isConnected&&source.closest('[data-home-widget]'))content=source.cloneNode(true);
  if(content!==source){content.querySelectorAll('[id],[for]').forEach(el=>{el.removeAttribute('id');el.removeAttribute('for')});content.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true)}
  if(w.type==='cash.openings'){
   const summary=content.querySelector('.home-opening-summary');if(summary)summary.remove();content.insertAdjacentHTML('beforeend',openingStatus());
  }
  return content;
 };
 function visibleOrder(){return model.widgets.filter(w=>!w.hidden&&(w.id==='tasks'&&sources.has('tasks')||permitted(w,can)))}
 function draw(){
  if(!live())return;grid.replaceChildren();
  for(const w of visibleOrder()){
   const card=document.createElement('section');card.className='home-widget-frame';card.dataset.homeWidget=w.id;card.dataset.homeType=w.type;
   card.style.setProperty('--span',Math.min(12,w.layout.desktop.w));card.style.setProperty('--height',Math.max(2,w.layout.desktop.h));card.style.setProperty('--tablet-span',w.layout.tablet.w);card.style.setProperty('--tablet-height',w.layout.tablet.h);card.style.setProperty('--mobile-height',w.layout.mobile.h);
   if(edit&&selected===w.id)card.classList.add('home-widget-selected');
   const heading=document.createElement('header');heading.className='home-widget-header';
   heading.innerHTML=`<button class="home-move-handle" data-home-grip="${esc(w.id)}" ${edit?'draggable="true"':'disabled aria-hidden="true" tabindex="-1"'} aria-label="Mover ${esc(w.title)}" title="Arrastrar en modo edición">⠿</button><h3>${esc(w.title)}</h3><span class="home-widget-scope">${(w.type.startsWith('prestashop.')||['cash.withdrawals','cash.history','expenses.pending'].includes(w.type))?esc(labelStore(safeStore(w.scope.store))):''}</span><button type="button" class="home-widget-more" aria-label="Configurar ${esc(w.title)}" data-home-command="select" data-id="${esc(w.id)}">⋯</button>`;
   const body=document.createElement('div');body.className='home-widget-body';const content=freshWidget(w);
   if(typeof content==='string'){
    body.innerHTML=content;
    // Widget presentation filters never count as unsaved business forms.
    body.querySelectorAll('input,select,textarea').forEach(field=>field.setAttribute('data-draft-ignore',''));
   }else body.append(content);
   card.append(heading,body);if(edit)card.insertAdjacentHTML('beforeend',`<button type="button" class="home-resize-handle" data-home-resize="${esc(w.id)}" aria-label="Estirar o encoger ${esc(w.title)}" title="Arrastrar la esquina para cambiar tamaño">↘</button>`);grid.append(card);
  }
  root.classList.toggle('home-edit-mode',edit);
  root.classList.toggle('home-widgets-dirty',!!model&&!!original&&JSON.stringify(model.widgets)!==JSON.stringify(original.widgets));
  const toggle=root.querySelector('[data-home-command="edit"]');if(toggle)toggle.textContent=edit?'Salir de edición':'Personalizar inicio';
  renderDrawer();
 }
 function renderDrawer(){
  const drawer=root?.querySelector('[data-home-drawer]');if(!drawer)return;
  const w=find(selected),available=Object.values(HOME_WIDGET_CATALOG).filter(def=>permitted({type:def.type},can));
  const categories=[...new Set(available.map(def=>def.category))].sort((x,y)=>x.localeCompare(y,'es'));
  const activeCategory=categories.includes(drawer.dataset.category)?drawer.dataset.category:'all';
  drawer.hidden=!edit;
  if(!edit)return;
  const hiddenWidgets=model.widgets.filter(x=>x.hidden);
  drawer.innerHTML=`<div class="home-library-heading"><h3>Biblioteca de widgets</h3><button data-home-command="exit">✕</button></div><p class="small muted">Añade tantos paneles como necesites. Se guardan en tu cuenta.</p><label>Buscar widgets<input type="search" data-home-search placeholder="Buscar por módulo o nombre" value="${esc(drawer.dataset.search||'')}"></label><label>Módulo<select data-home-category><option value="all">Todos los módulos (${available.length})</option>${categories.map(category=>`<option value="${esc(category)}" ${activeCategory===category?'selected':''}>${esc(category)} (${available.filter(x=>x.category===category).length})</option>`).join('')}</select></label><div class="home-library-items">${available.filter(x=>(activeCategory==='all'||x.category===activeCategory)&&(x.title+' '+x.category).toLocaleLowerCase('es').includes(String(drawer.dataset.search||'').toLocaleLowerCase('es'))).map(x=>`<div class="home-library-item"><span><b>${esc(x.title)}</b><small>${esc(x.category)}</small></span><button aria-label="Añadir ${esc(x.title)}" data-home-command="add" data-type="${esc(x.type)}" ${nonClonable.has(x.type)&&model.widgets.some(w=>w.type===x.type)?'disabled title="Widget único: ya está en tu diseño"':''}>＋</button></div>`).join('')}</div>${hiddenWidgets.length?`<details class="home-hidden-widgets"><summary>Widgets ocultos (${hiddenWidgets.length})</summary>${hiddenWidgets.map(x=>`<div class="home-library-item"><b>${esc(x.title)}</b><button type="button" data-home-command="show" data-id="${esc(x.id)}">Mostrar</button></div>`).join('')}</details>`:''}${w?`<div class="home-widget-inspector"><h3>Configurar widget</h3><p class="small">${esc(w.title)}</p>${(w.type.startsWith('prestashop.')||['cash.withdrawals','cash.history','expenses.pending'].includes(w.type))?`<label>Tienda<select data-home-config="store" data-id="${esc(w.id)}"><option value="all" ${safeStore(w.scope.store)==='all'?'selected':''}>Todas las tiendas</option>${PRESTASHOP_STORES.map(s=>`<option value="${s.key}" ${s.key===w.scope.store?'selected':''}>${s.name}</option>`).join('')}</select></label>`:''}${w.type.startsWith('prestashop.')?`<label>Desde<input type="date" data-home-config="from" data-id="${esc(w.id)}" value="${dateRange(w).from}"></label><label>Hasta<input type="date" data-home-config="to" data-id="${esc(w.id)}" value="${dateRange(w).to}"></label>`:''}<label>Anchura<select data-home-config="width" data-id="${esc(w.id)}">${allowedWidths(w).map(x=>`<option value="${x}" ${x===w.layout.desktop.w?'selected':''}>${x} / 12 columnas</option>`).join('')}</select></label><label>Altura escritorio<select data-home-config="height" data-id="${esc(w.id)}">${[2,3,4,5,6,7,8,9,10,11,12].map(x=>`<option value="${x}" ${x===w.layout.desktop.h?'selected':''}>${x} unidades</option>`).join('')}</select></label><label>Anchura tablet<select data-home-config="tabletWidth" data-id="${esc(w.id)}">${[1,2,3,4,5,6].map(x=>`<option value="${x}" ${x===w.layout.tablet.w?'selected':''}>${x} / 6 columnas</option>`).join('')}</select></label><label>Altura tablet<select data-home-config="tabletHeight" data-id="${esc(w.id)}">${Array.from({length:15},(_,i)=>i+2).map(x=>`<option value="${x}" ${x===w.layout.tablet.h?'selected':''}>${x} unidades</option>`).join('')}</select></label><label>Altura móvil<select data-home-config="mobileHeight" data-id="${esc(w.id)}">${Array.from({length:17},(_,i)=>i+2).map(x=>`<option value="${x}" ${x===w.layout.mobile.h?'selected':''}>${x} unidades</option>`).join('')}</select></label><label>Mover a posición<select data-home-config="position" data-id="${esc(w.id)}">${model.widgets.map((v,i)=>`<option value="${i}" ${v.id===w.id?'selected':''}>${i+1}. ${esc(v.title)}</option>`).join('')}</select></label><div class="home-inspector-actions"><button data-home-command="up" data-id="${esc(w.id)}">↑ Subir</button><button data-home-command="down" data-id="${esc(w.id)}">↓ Bajar</button><button data-home-command="duplicate" data-id="${esc(w.id)}" ${nonClonable.has(w.type)?'disabled title="Formulario único: no se duplica"':''}>Duplicar</button><button data-home-command="hide" data-id="${esc(w.id)}">Ocultar</button></div></div>`:''}`;
  drawer.querySelectorAll('input,select,textarea').forEach(field=>field.setAttribute('data-draft-ignore',''));
 }
 const makeId=()=>`hw-${crypto.randomUUID()}`;
 const mutate=(fn,focusId=null)=>{if(!edit||busy)return;model=fn(model);selected=(focusId&&find(focusId)?.id)||find(selected)?.id||model.widgets.find(w=>!w.hidden)?.id||null;draw();status('Cambios pendientes de guardar.');};
 function command(action,id,el){
  if(action==='edit'){if(edit){if(JSON.stringify(model.widgets)!==JSON.stringify(original.widgets)&&!confirmDiscard())return;model=structuredClone(original);edit=false;selected=null}else{edit=true;selected=model.widgets[0]?.id||null}draw();return}
  if(action==='exit'){if(JSON.stringify(model.widgets)!==JSON.stringify(original.widgets)&&!confirmDiscard())return;edit=false;model=structuredClone(original);selected=null;draw();return}
  if(action==='select'){selected=id;edit=true;draw();return}
  if(action==='add'){const type=el.dataset.type;if(nonClonable.has(type)&&model.widgets.some(w=>w.type===type)){status('Ese widget contiene controles únicos y ya está añadido. Puedes moverlo o cambiar su tamaño.',true);return}const scope=type==='prestashop.summary'?{store:PRESTASHOP_STORES[0].key}:{store:'all'};const newId=makeId();mutate(m=>addHomeWidget(m,type,newId,{scope}),newId);return}
  if(action==='duplicate'){const w=find(id);if(!w||nonClonable.has(w.type))return;const newId=makeId();mutate(m=>duplicateHomeWidget(m,id,newId),newId);return}
  if(action==='hide'){mutate(m=>setHomeWidgetConfig(m,id,{hidden:true}),model.widgets.find(x=>x.id!==id&&!x.hidden)?.id);return}
  if(action==='show'){mutate(m=>setHomeWidgetConfig(m,id,{hidden:false}));selected=id;draw();return}
  if(action==='up'||action==='down'){mutate(m=>reorderHomeWidget(m,id,action));return}
  if(action==='reset'){if(!confirm('¿Restaurar la distribución inicial? Los cambios actuales quedarán pendientes de guardar y podrás descartarlos antes de confirmar.'))return;mutate(()=>createDefault());return}
  if(action==='fetch'){fetchFor(find(id),true);return}
  if(action==='open-expense'){const expenseId=el.dataset.expense;if(!expenseId||!state.data.expenses.some(row=>String(row.id)===expenseId))return;void onOpenExpense({id:expenseId});return}
  if(action==='open-orders'){void onOpenOrders({tab:'orders'});return}
  if(action==='open-prestashop-tab'){const tab=el.dataset.tab;if(['catalog','receipts'].includes(tab))void onOpenOrders({tab});return}
  if(action==='open-order'){const shop=el.dataset.shop,order=el.dataset.order,date=el.dataset.date;if(PRESTA_SHOPS({scope:{store:shop}}).length!==1||!/^\d{1,15}$/.test(order||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return;void onOpenOrders({tab:'orders',store:shop,order,date});return}
  if(action==='prev-page'||action==='next-page'){const w=find(id);if(!w)return;const current=Number(w.filters.page)||0;model=setHomeWidgetConfig(model,id,{filters:{page:Math.max(0,current+(action==='prev-page'?-1:1))}});draw();return}
  if(action==='scroll-left'||action==='scroll-right'){const viewport=root.querySelector(`[data-home-orders-viewport="${CSS.escape(id)}"]`);viewport?.scrollBy({left:action==='scroll-left'?-300:300,behavior:'smooth'});return}
  if(action==='save')void save();
 }
 async function load(){
  const own=owner;try{
   const saved=await rpc('totus_home_dashboard',{p_action:'read',p_layout:null,p_expected_revision:null});
   if(!live()||owner!==own)return;
   remoteReady=true;if(saved?.layout?.schemaVersion===1){if(JSON.stringify(model.widgets)!==JSON.stringify(original.widgets)){status('Se ha recibido el diseño guardado mientras editabas. Revisa los cambios antes de guardar.',true);model.revision=saved.revision==null?null:String(saved.revision);return;}model=readHomeDashboard(saved.layout);model.revision=saved.revision==null?null:String(saved.revision);original=structuredClone(model);draw();for(const w of model.widgets)if(w.type.startsWith('prestashop.'))void fetchFor(w);}
  }catch(error){if(live())status('Disposición local predeterminada. Guardado entre dispositivos no disponible hasta instalar la migración.',true)}
 }
 async function save(){if(busy||!live()||!model)return;
  if(JSON.stringify(model.widgets)===JSON.stringify(original.widgets)){status('No hay cambios del Inicio pendientes de guardar.');return}
  if(!remoteReady){status('No se puede guardar: falta el servicio de preferencias del Inicio.',true);return}
  const own=owner,expected=Number(model.revision||0),snapshot={schemaVersion:1,widgets:structuredClone(model.widgets)};
  busy=true;
  try{
   const result=await rpc('totus_home_dashboard',{p_action:'save',p_layout:snapshot,p_expected_revision:expected});
   if(!live()||owner!==own)return;
   if(!Number.isSafeInteger(Number(result?.revision))||Number(result.revision)!==expected+1)throw Error('La respuesta no acredita la revisión esperada.');
   const checked=await rpc('totus_home_dashboard',{p_action:'read',p_layout:null,p_expected_revision:null});
   if(!live()||owner!==own)return;
   const persisted=readHomeDashboard(checked?.layout);
   if(Number(checked.revision)!==Number(result.revision)||JSON.stringify(persisted.widgets)!==JSON.stringify(snapshot.widgets))throw Error('La relectura no coincide con el diseño guardado.');
   model.revision=String(checked.revision);
   original={...structuredClone(snapshot),revision:model.revision};
   if(JSON.stringify(model.widgets)!==JSON.stringify(snapshot.widgets)){
    status('Se verificó el guardado anterior, pero hay cambios nuevos pendientes de guardar.',true);
    return;
   }
   edit=false;selected=null;draw();status('Tu Inicio se ha guardado y verificado en tu cuenta.');notify('Inicio personalizado guardado.');
  }catch(error){
   if(live())status('Guardado sin confirmar: '+String(error.message||error)+'. Revisa el diseño antes de reintentar.',true);
  }finally{busy=false}
 }
 async function initConnections(){
  if(connections)return connections;
  if(connectionsTask)return connectionsTask;
  const owned=owner,epoch=token;
  const task=rpc('totus_prestashop_context',{}).then(result=>{
   if(!live()||token!==epoch||owner!==owned)return null;
   connections=(result.connections||[]).filter(x=>x.protocol==='prestashop');
   return connections;
  });
  connectionsTask=task;
  try{return await task}
  finally{if(owner===owned&&token===epoch&&connectionsTask===task)connectionsTask=null}
 }
 async function fetchFor(w,force=false){
  if(!w||!w.type.startsWith('prestashop.')||!can('prestashop','view')||!live())return;
  const {from,to}=dateRange(w);if(to<from){status('Fecha final anterior a la inicial.',true);return}
  const stores=PRESTA_SHOPS(w);for(const shop of stores){const key=shop+'|'+from+'|'+to;
   if(!force&&ordersData.has(key))continue;if(queries.has(key))continue;
   const owned=owner,requestToken=token;
   const task=(async()=>{try{
    const cs=await initConnections();if(!live()||token!==requestToken||owner!==owned)return;
    const c=storeConnection(cs,shop),ready=prestashopReadiness(c);if(!ready.ready)throw new Error(ready.reason);
    const rows=[],ids=new Set();let page=0,possiblyMore=false;
    do{
     const result=await invoke({action:'prestashop_read',store:shop,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),resource:'orders',page,page_size:100,from:from+' 00:00:00',to:to+' 23:59:59',sort:'newest'});
     if(!live()||token!==requestToken||owner!==owned)return;
     if(!result?.ok||result.store!==shop||result.resource!=='orders'||result.page!==page||!Array.isArray(result.rows))throw new Error('La respuesta de pedidos no corresponde a esta consulta.');
     for(const r of result.rows){if(ids.has(String(r.id)))throw new Error('Pedidos repetidos entre páginas; comprueba el origen.');ids.add(String(r.id));rows.push(r)}
     possiblyMore=result.possibly_more===true;page++;
    }while(possiblyMore&&page<20);
    const currencies=new Map();for(const id of [...new Set(rows.map(r=>String(r.id_currency||'')))] ){
     if(!/^\d{1,15}$/.test(id))continue;
     try{const r=await invoke({action:'prestashop_read',store:shop,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),resource:'currencies',page:0,page_size:1,record_id:id});if(r?.ok&&r.store===shop&&r.resource==='currencies'&&String(r.rows?.[0]?.id)===id)currencies.set(id,r.rows[0].iso_code);}catch{}
    }
    if(!live()||token!==requestToken||owner!==owned)return;
    // The top product list is calculated only when every requested order and its
    // detail lines have been read. A partial result is never advertised as Top.
    let top=null,detailsByOrder=null;
    if(!possiblyMore&&rows.length<=200){
     try{
      const ids=rows.filter(o=>String(o.valid)==='1').map(o=>String(o.id));
      const ranking=new Map(),details=new Map(),lineIds=new Set(),coveredOrders=new Set();let complete=true;
      for(let index=0;index<ids.length;index+=25){
       const batch=ids.slice(index,index+25);let detailPage=0,more=false;
       do{
        const detail=await invoke({action:'prestashop_read',store:shop,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),resource:'order_details',page:detailPage,page_size:100,order_ids:batch});
        if(!live()||token!==requestToken||owner!==owned)return;
        if(!detail?.ok||detail.store!==shop||detail.resource!=='order_details'||!Array.isArray(detail.rows)||detail.rows.some(l=>!batch.includes(String(l.id_order))))throw Error('Líneas de un pedido ajeno');
        for(const line of detail.rows){const id=String(line.product_id||''),lid=String(line.id||''),qty=Number(line.product_quantity),attribute=String(line.product_attribute_id??'0');if(!/^\d{1,15}$/.test(id)||!/^\d{1,15}$/.test(lid)||!/^\d{1,15}$/.test(attribute)||lineIds.has(lid)||!Number.isSafeInteger(qty)||qty<=0){complete=false;break}lineIds.add(lid);const orderId=String(line.id_order),name=String(line.product_name||'Producto #'+id),group=id+':'+attribute;coveredOrders.add(orderId);const prev=ranking.get(group)||{name,qty:0};prev.qty+=qty;ranking.set(group,prev);if(!details.has(orderId))details.set(orderId,[]);details.get(orderId).push({name,qty})}
        more=detail.possibly_more===true;detailPage++;
       }while(more&&detailPage<20);
       if(more||batch.some(id=>!coveredOrders.has(id))){complete=false;break}
      }
      if(complete){top=[...ranking.values()].filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty).slice(0,4);detailsByOrder=details}
     }catch{top=null}
    }
    ordersData.set(key,{shop,rows,currencies,from,to,complete:!possiblyMore,top,detailsByOrder,checked:new Date().toLocaleString('es-ES')});draw();
   }catch(e){if(!live()||token!==requestToken||owner!==owned)return;ordersData.set(key,{shop,rows:[],currencies:new Map(),from,to,complete:false,error:e.message||String(e)});draw()}
   })().finally(()=>queries.delete(key));queries.set(key,task);
  }
 }
 function mount(target){
  token++;root=target?.querySelector('.dashboard-page');grid=null;connections=null;connectionsTask=null;queries.clear();ordersData.clear();edit=false;selected=null;remoteReady=false;owner=state.user?.id;
  if(!root||!owner||!can('inicio','view'))return;
  sources=collectExisting(root);for(const [type,id] of defaultSpecs)if(sources.has(id)&&!sources.has(type))sources.set(type,sources.get(id));const hero=root.querySelector('.dashboard-hero');
  const toolbar=document.createElement('div');toolbar.className='home-dashboard-toolbar';toolbar.innerHTML=`<div><strong>Operativa de hoy · Inicio personalizado</strong><p>Organiza tus indicadores y consultas sin perder las funciones actuales.</p><small data-home-status role="status" aria-live="polite"></small></div><div class="home-toolbar-actions"><button class="btn primary" data-home-command="edit">Personalizar inicio</button><button class="btn secondary" data-home-command="save">Guardar cambios</button><button class="btn secondary" data-home-command="reset">Restaurar diseño</button></div>`;
  const shell=document.createElement('div');shell.className='home-widget-shell';grid=document.createElement('div');grid.className='home-widget-grid';const drawer=document.createElement('aside');drawer.className='home-widgets-drawer';drawer.dataset.homeDrawer='';drawer.hidden=true;shell.append(grid,drawer);
  hero?.after(toolbar,shell);if(!hero)root.append(toolbar,shell);
  model=createDefault();original=structuredClone(model);
  // Source nodes are moved, never reimplemented; original data-action handlers stay intact.
  root.addEventListener('click',e=>{const el=e.target.closest('[data-home-command]');if(!el||!root.contains(el))return;e.preventDefault();e.stopPropagation();command(el.dataset.homeCommand,el.dataset.id,el)},true);
  root.addEventListener('change',e=>{const el=e.target;if(el.hasAttribute('data-home-category')){root.querySelector('[data-home-drawer]').dataset.category=el.value;renderDrawer();return}if(!el.dataset.homeConfig&&!el.dataset.homeFilter)return;const w=find(el.dataset.id);if(!w)return;
   if(el.dataset.homeFilter){const filters={[el.dataset.homeFilter]:el.value,page:0};model=setHomeWidgetConfig(model,w.id,{filters});draw();status('Filtros de esta tabla aplicados; guarda tu diseño para conservarlos.');return}
   const key=el.dataset.homeConfig;
   if(key==='store'){mutate(m=>setHomeWidgetConfig(m,w.id,{scope:{store:safeStore(el.value)},filters:{page:0}}));void fetchFor(find(w.id));}
   if(key==='from'||key==='to'){mutate(m=>setHomeWidgetConfig(m,w.id,{filters:{[key]:el.value,page:0}}));if(dateRange(find(w.id)).from<=dateRange(find(w.id)).to)void fetchFor(find(w.id));}
   if(key==='width')mutate(m=>setHomeWidgetConfig(m,w.id,{layout:{desktop:{w:Number(el.value)}}}));
   if(key==='height')mutate(m=>setHomeWidgetConfig(m,w.id,{layout:{desktop:{h:Number(el.value)}}}));
   if(key==='tabletWidth')mutate(m=>setHomeWidgetConfig(m,w.id,{layout:{tablet:{w:Number(el.value)}}}));
   if(key==='tabletHeight')mutate(m=>setHomeWidgetConfig(m,w.id,{layout:{tablet:{h:Number(el.value)}}}));
   if(key==='mobileHeight')mutate(m=>setHomeWidgetConfig(m,w.id,{layout:{mobile:{h:Number(el.value)}}}));
   if(key==='position'){const prev=model.widgets.findIndex(x=>x.id===w.id),next=Number(el.value);if(Number.isSafeInteger(next)&&next>=0&&next<model.widgets.length){model.widgets.splice(prev,1);model.widgets.splice(next,0,w);draw();status('Cambios pendientes de guardar.')}}
  },true);
  let searchTimer;root.addEventListener('input',e=>{if(e.target.matches('[data-home-search]')){const d=root.querySelector('[data-home-drawer]');d.dataset.search=e.target.value;const start=e.target.selectionStart;renderDrawer();const current=root.querySelector('[data-home-search]');current?.focus();current?.setSelectionRange(start,start)}},true);
  // Resize only the active breakpoint. A phone must never accidentally modify
  // the desktop board; keyboard and pointer edits share the same constraints.
  const resizeMode=()=>innerWidth<=600?'mobile':innerWidth<=1400?'tablet':'desktop';
  const rangeFor=(mode,w)=>({desktop:{min:HOME_WIDGET_CATALOG[w.type].minWidth,max:HOME_WIDGET_CATALOG[w.type].maxWidth,limit:12},tablet:{min:1,max:6,limit:6},mobile:{min:1,max:1,limit:1}})[mode];
  const geometry=(p,e,w)=>{
   const bounds=rangeFor(p.mode,w),dw=Math.round((e.clientX-p.startX)/p.width),dh=Math.round((e.clientY-p.startY)/48);
   return {w:Math.max(bounds.min,Math.min(bounds.max,p.w+dw)),h:Math.max(2,Math.min(p.mode==='desktop'?12:p.mode==='tablet'?16:18,p.h+dh))};
  };
  const preview=(p,size)=>{
   if(p.mode==='desktop'){p.card.style.setProperty('--span',size.w);p.card.style.setProperty('--height',size.h)}
   if(p.mode==='tablet'){p.card.style.setProperty('--tablet-span',size.w);p.card.style.setProperty('--tablet-height',size.h)}
   if(p.mode==='mobile')p.card.style.setProperty('--mobile-height',size.h);
   p.card.dataset.resizePreview=p.mode==='mobile'?size.h+' unidades móvil':size.w+' columnas · '+size.h+' unidades';
  };
  root.addEventListener('pointerdown',e=>{
   const handle=e.target.closest('[data-home-resize]');if(!edit||busy||!handle)return;
   const w=find(handle.dataset.homeResize),card=handle.closest('[data-home-widget]');if(!w||!card)return;
   e.preventDefault();e.stopPropagation();
   const mode=resizeMode(),cols=rangeFor(mode,w).limit;
   const width=Math.max(25,(grid.getBoundingClientRect().width-14*(cols-1))/cols+14);
   activeResize={id:w.id,mode,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,w:mode==='mobile'?1:w.layout[mode].w,h:w.layout[mode].h,width,card,handle};
   handle.setPointerCapture?.(e.pointerId);
  },true);
  root.addEventListener('pointermove',e=>{
   const p=activeResize;if(!p||e.pointerId!==p.pointerId||!edit)return;
   const w=find(p.id);if(!w)return;e.preventDefault();preview(p,geometry(p,e,w));
  },true);
  root.addEventListener('pointerup',e=>{
   const p=activeResize;if(!p||p.pointerId!==e.pointerId)return;
   activeResize=null;try{p.handle.releasePointerCapture?.(e.pointerId)}catch{}
   const w=find(p.id);if(!w||!edit)return;
   const size=geometry(p,e,w);
   if(size.w!==p.w||size.h!==p.h){
    mutate(m=>setHomeWidgetConfig(m,p.id,{layout:{[p.mode]:p.mode==='mobile'?{h:size.h}:size}}));
   }else{preview(p,{w:p.w,h:p.h});delete p.card.dataset.resizePreview}
  },true);
  root.addEventListener('pointercancel',e=>{
   const p=activeResize;if(!p||p.pointerId!==e.pointerId)return;
   activeResize=null;preview(p,{w:p.w,h:p.h});delete p.card.dataset.resizePreview;
  },true);
  root.addEventListener('keydown',e=>{
   const handle=e.target.closest('[data-home-resize]');if(!handle||!edit||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
   const w=find(handle.dataset.homeResize);if(!w)return;e.preventDefault();
   const mode=resizeMode(),limits=rangeFor(mode,w),dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
   const newW=mode==='mobile'?1:Math.max(limits.min,Math.min(limits.max,w.layout[mode].w+dx));
   const newH=Math.max(2,Math.min(mode==='desktop'?12:mode==='tablet'?16:18,w.layout[mode].h+dy));
   mutate(m=>setHomeWidgetConfig(m,w.id,{layout:{[mode]:mode==='mobile'?{h:newH}:{w:newW,h:newH}}}));
   root.querySelector('[data-home-resize="'+CSS.escape(w.id)+'"]')?.focus();
  },true);
  // Touch grip: pointer-based reordering. Browser HTML5 drag events alone do
  // not work consistently on phones; do not trap ordinary page scrolling.
  let touchMove=null;
  const resetTouchTarget=()=>root?.querySelectorAll('.home-widget-drop-target').forEach(card=>card.classList.remove('home-widget-drop-target'));
  root.addEventListener('pointerdown',e=>{
   const grip=e.target.closest('[data-home-grip]');
   if(!edit||busy||!grip||e.pointerType!=='touch')return;
   touchMove={pointerId:e.pointerId,source:grip.dataset.homeGrip,startX:e.clientX,startY:e.clientY,target:null,active:false,grip};
   e.preventDefault();
   try{grip.setPointerCapture(e.pointerId)}catch{}
  },true);
  root.addEventListener('pointermove',e=>{
   const d=touchMove;if(!d||!edit||e.pointerId!==d.pointerId)return;
   if(!d.active&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<10)return;
   d.active=true;e.preventDefault();
   const card=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-home-widget]');
   resetTouchTarget();
   d.target=card?.dataset.homeWidget!==d.source?card?.dataset.homeWidget:null;
   if(d.target)card.classList.add('home-widget-drop-target');
  },true);
  root.addEventListener('pointerup',e=>{
   const d=touchMove;if(!d||e.pointerId!==d.pointerId)return;
   touchMove=null;resetTouchTarget();
   try{d.grip.releasePointerCapture(e.pointerId)}catch{}
   if(d.active&&d.target&&d.target!==d.source){
    const from=model.widgets.findIndex(w=>w.id===d.source),to=model.widgets.findIndex(w=>w.id===d.target);
    if(from>=0&&to>=0){const [entry]=model.widgets.splice(from,1);model.widgets.splice(to,0,entry);selected=d.source;draw();status('Posición cambiada. Guarda el diseño para conservarla.')}
   }else if(edit){selected=d.source;draw()}
  },true);
  root.addEventListener('pointercancel',e=>{if(touchMove?.pointerId===e.pointerId){touchMove=null;resetTouchTarget()}},true);
  // Native drag and drop; select/reorder controls also work with keyboard and touch.
  root.addEventListener('dragstart',e=>{const grip=e.target.closest('[data-home-grip]');if(!edit||!grip)return;activeDrag=grip.dataset.homeGrip;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',activeDrag)},true);
  root.addEventListener('dragover',e=>{if(edit&&activeDrag&&e.target.closest('[data-home-widget]'))e.preventDefault()},true);
  root.addEventListener('drop',e=>{const target=e.target.closest('[data-home-widget]');if(!edit||!target||!activeDrag)return;e.preventDefault();const from=model.widgets.findIndex(w=>w.id===activeDrag),to=model.widgets.findIndex(w=>w.id===target.dataset.homeWidget);if(from>=0&&to>=0&&from!==to){const [entry]=model.widgets.splice(from,1);model.widgets.splice(to,0,entry);selected=entry.id;draw();status('Cambios pendientes de guardar.')}activeDrag=null},true);
  root.addEventListener('dragend',()=>activeDrag=null,true);
  draw();void load();
  // PrestaShop is read with the existing authenticated service, without changing stock or accounting.
  for(const w of model.widgets)if(w.type.startsWith('prestashop.'))void fetchFor(w);
 }
 return {mount,dispose(){token++;root=null;grid=null;ordersData.clear();queries.clear();connections=null;connectionsTask=null;model=null;owner=null},hasUnsaved:()=>!!model&&JSON.stringify(model?.widgets)!==JSON.stringify(original?.widgets)};
}
