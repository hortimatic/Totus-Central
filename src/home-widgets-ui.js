/* Totus Central — Inicio modular. Enhances existing home DOM, preserving forms,
 * accounting functions and delegated data-action/data-route handlers. */
import {HOME_WIDGET_CATALOG,createHomeDashboard,readHomeDashboard,addHomeWidget,duplicateHomeWidget,removeHomeWidget,setHomeWidgetConfig,reorderHomeWidget,homeCanvasSettings,HOME_ORDER_COLUMNS} from './home-widgets-core.js';
import {nextOpeningSummary} from './home-openings-view.js';
import {state,getFilters} from './state.js';
import {esc,money,isoToday} from './utils.js';
import {storeConnection,PRESTASHOP_STORES} from './prestashop-readonly.js';
import {prestashopReadiness} from './prestashop-ui.js';
import {sourceCents,catalogIssues} from './prestashop-insights.js';
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

const homePeriodBounds=(mode,anchor=isoToday())=>{
 const date=safeDate(anchor)||isoToday(),d=new Date(date+'T12:00:00Z');
 if(mode==='day')return {from:date,to:date};
 if(mode==='week'){const monday=minusDays(date,(d.getUTCDay()+6)%7);return {from:monday,to:minusDays(monday,-6)}}
 if(mode==='month'){const first=date.slice(0,7)+'-01',last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);return {from:first,to:last}}
 return {from:date,to:date};
};
const shiftedPeriod=(w,direction)=>{
 const mode=['day','week','month'].includes(w.filters.period)?w.filters.period:'day',date=safeDate(w.filters.to)||isoToday();
 if(mode==='month'){const d=new Date(date.slice(0,7)+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+direction);return homePeriodBounds('month',d.toISOString().slice(0,10))}
 return homePeriodBounds(mode,minusDays(date,-direction*(mode==='week'?7:1)));
};
function periodControls(w){
 const period=['day','week','month','custom'].includes(w.filters.period)?w.filters.period:'custom',dates=dateRange(w);
 const buttons=[['day','Día'],['week','Semana'],['month','Mes'],['custom','Personalizado']].map(([key,name])=>'<button type="button" data-home-command="period-'+key+'" data-id="'+esc(w.id)+'" aria-pressed="'+(key===period?'true':'false')+'">'+name+'</button>').join('');
 const storeOptions=(w.type==='prestashop.summary'?PRESTASHOP_STORES:PRESTASHOP_STORES).map(s=>'<option value="'+esc(s.key)+'" '+(safeStore(w.scope.store)===s.key?'selected':'')+'>'+esc(s.name)+'</option>').join('');
 const allOption=w.type==='prestashop.summary'?'':'<option value="all" '+(safeStore(w.scope.store)==='all'?'selected':'')+'>Todas las tiendas</option>';
 const storePicker='<label>Tienda <select data-home-filter="store" data-id="'+esc(w.id)+'" aria-label="Tienda de consulta">'+allOption+storeOptions+'</select></label>';
 const metricPicker=w.type==='prestashop.summary'?'<label>Gráfica <select data-home-filter="chartMetric" data-id="'+esc(w.id)+'" aria-label="Métrica de la gráfica"><option value="orders" '+(w.filters.chartMetric!=='sales'?'selected':'')+'>Pedidos válidos</option><option value="sales" '+(w.filters.chartMetric==='sales'?'selected':'')+'>Ventas EUR</option></select></label>':w.type==='prestashop.top'?'<label>Vista <select data-home-filter="productView" data-id="'+esc(w.id)+'"><option value="table" '+(w.filters.productView!=='bars'?'selected':'')+'>Tabla</option><option value="bars" '+(w.filters.productView==='bars'?'selected':'')+'>Barras</option></select></label>':'';
 const picker=period==='month'?'<label>Mes <input type="month" aria-label="Elegir mes" data-home-filter="periodMonth" data-id="'+esc(w.id)+'" value="'+esc(dates.to.slice(0,7))+'"></label>':
 period==='day'||period==='week'?'<label>Fecha <input type="date" aria-label="Elegir fecha" data-home-filter="periodDate" data-id="'+esc(w.id)+'" value="'+esc(dates.to)+'"></label>':
 '<label>Desde <input type="date" data-home-filter="from" data-id="'+esc(w.id)+'" value="'+esc(dates.from)+'"></label><label>Hasta <input type="date" data-home-filter="to" data-id="'+esc(w.id)+'" value="'+esc(dates.to)+'"></label>';
 return '<div class="home-period-controls" role="group" aria-label="Periodo de '+esc(w.title)+'"><div class="home-period-presets" aria-label="Seleccionar periodo">'+buttons+'</div>'+
 (period!=='custom'?'<div class="home-period-nav"><button type="button" data-home-command="period-prev" data-id="'+esc(w.id)+'" aria-label="Periodo anterior">‹</button><small>'+esc(dates.from)+' — '+esc(dates.to)+'</small><button type="button" data-home-command="period-next" data-id="'+esc(w.id)+'" aria-label="Periodo siguiente">›</button></div>':'')+
 '<div class="home-period-dates">'+storePicker+picker+metricPicker+'</div></div>';
}

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
function storeOpeningWidget(w){
 const name=labelStore(safeStore(w.scope.store)),store=state.data.stores.find(x=>String(x.name).toLocaleLowerCase('es')===name.toLocaleLowerCase('es'));
 const snapshot=nextOpeningSummary(state.data,{today:isoToday()}),items=snapshot.items.filter(x=>String(x.storeId)===String(store?.id));
 const complete=items.length>0&&items.every(x=>x.status==='verified');
 const known=items.reduce((sum,x)=>sum+(x.amount??0),0),missing=items.filter(x=>x.amount===null).length,stale=items.filter(x=>x.status==='stale').length;
 const title=complete?'Total confirmado para abrir '+money(known):'Sin total confirmado · importes conocidos '+money(known);
 return '<div class="home-store-opening"><div class="home-store-opening-heading"><div><strong>'+esc(name)+'</strong><small>Apertura prevista '+esc(snapshot.openingDate)+' · '+items.length+' cajones activos</small></div><b>'+esc(title)+'</b></div><div class="home-opening-grid">'+items.map(x=>'<div class="home-opening-drawer"><strong>'+esc(x.drawerName)+'</strong><b>'+(x.amount===null?'Por indicar':esc(money(x.amount)))+'</b><small>'+(x.status==='verified'?'Cierre del día acreditado':x.status==='stale'?'Saldo de cierre anterior, no confirmado':'Falta importe de cierre')+'</small><small>'+esc(x.closingDate||'Sin cierre acreditado')+'</small></div>').join('')+'</div>'+(complete?'':'<p class="small muted" role="status">'+missing+' sin importe · '+stale+' de cierre anterior. El total no se supone ni se completa con otras cajas.</p>')+'<div class="home-widget-actions"><button class="btn secondary" data-route="cajas">Abrir Cajas y cierres</button></div></div>';
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
function prestashopChart(w,read){
 const requested=['hours','days','off'].includes(w.filters.chartMode)?w.filters.chartMode:'hours';
 if(requested==='off')return '';
 const {from,to}=dateRange(w),period=w.filters.period||'custom';
 const startDate=new Date(from+'T12:00:00Z'),endDate=new Date(to+'T12:00:00Z');
 const days=Math.max(1,Math.round((endDate-startDate)/86400000)+1);
 const measured=w.filters.chartMetric==='sales'?'sales':'orders';
 const valid=read.rows.filter(row=>String(row.valid)==='1');
 if(measured==='sales'&&(!read.complete||valid.some(row=>read.currencies.get(String(row.id_currency))!=='EUR'||cents(row.total_paid_tax_incl)===null)))
  return '<p class="home-chart-unverified">Ventas EUR sin gráfica: falta completar la lectura o validar la moneda y los importes. No se estiman cifras.</p>';
 if(!read.complete)return '<p class="home-chart-unverified">La consulta es parcial. No se dibujan series que pudieran interpretarse como totales completos.</p>';
 const mode=period==='day'?'hours':period==='week'||period==='month'?'days':requested;
 const group=mode==='hours'?'hours':days<=45?'days':days<=180?'weeks':'months';
 const monday=date=>minusDays(date,(new Date(date+'T12:00:00Z').getUTCDay()+6)%7);
 const keyFor=date=>group==='hours'?date.slice(11,13):group==='days'?date.slice(0,10):group==='weeks'?monday(date.slice(0,10)):date.slice(0,7);
 const bins=new Map();
 for(const row of valid){
  const date=String(row.date_add||''),key=keyFor(date);
  if(group==='hours'&&!/^(0\d|1\d|2[0-3])$/.test(key))continue;
  if(group!=='hours'&&!/^\d{4}-\d{2}(-\d{2})?$/.test(key))continue;
  const amount=measured==='sales'?cents(row.total_paid_tax_incl):1;
  bins.set(key,(bins.get(key)||0)+amount);
 }
 const keys=[];
 if(group==='hours')for(let i=0;i<24;i++)keys.push(String(i).padStart(2,'0'));
 else if(group==='days'&&days<=45)for(let d=new Date(startDate);d<=endDate;d.setUTCDate(d.getUTCDate()+1))keys.push(d.toISOString().slice(0,10));
 else if(group==='weeks'){for(let d=new Date(startDate);d<=endDate;d.setUTCDate(d.getUTCDate()+7)){const k=monday(d.toISOString().slice(0,10));if(keys.at(-1)!==k)keys.push(k)}}
 else for(let d=new Date(Date.UTC(startDate.getUTCFullYear(),startDate.getUTCMonth(),1));d<=endDate;d.setUTCMonth(d.getUTCMonth()+1))keys.push(d.toISOString().slice(0,7));
 const values=keys.map(k=>bins.get(k)||0),max=Math.max(1,...values),total=values.reduce((sum,v)=>sum+v,0);
 const title=measured==='sales'?'Ventas válidas EUR':'Pedidos válidos';
 const typeLabel=group==='hours'?'horas':group==='days'?'días':group==='weeks'?'semanas':'meses';
 const series=keys.map((key,i)=>{
  const value=values[i],tip=measured==='sales'?money(value/100):value+' pedidos';
  const showLabel=keys.length<=8||i%Math.ceil(keys.length/7)===0||i===keys.length-1;
  const label=group==='hours'?key+'h':group==='months'?key.slice(5)+'/'+key.slice(2,4):key.slice(5);
  const clickDate=group==='days'?key:group==='hours'&&from===to?from:null;
  const click=clickDate?'<button type="button" class="home-chart-bar" style="height:'+Math.round(value/max*100)+'%" data-home-command="chart-slice" data-shop="'+esc(safeStore(w.scope.store))+'" data-date="'+esc(clickDate)+'" aria-label="'+esc('Abrir pedidos '+key+': '+tip)+'" title="'+esc(key+': '+tip)+'"></button>':
   '<span class="home-chart-bar" style="height:'+Math.round(value/max*100)+'%" title="'+esc(key+': '+tip)+'"></span>';
  return '<div class="home-chart-column"><div class="home-chart-track">'+click+'</div><small aria-hidden="true">'+(showLabel?esc(label):'')+'</small></div>';
 }).join('');
 return '<figure class="home-ps-chart" role="group" aria-label="'+esc(title+' por '+typeLabel+', desde '+from+' hasta '+to)+'"><figcaption><span>'+esc(title+' por '+typeLabel)+'</span><strong>'+esc(measured==='sales'?money(total/100):String(total))+'</strong></figcaption><div class="home-chart-plot"><div class="home-chart-columns">'+series+'</div></div><small class="muted">Periodo '+esc(from)+' — '+esc(to)+(group==='hours'&&days>1?' · perfil horario agregado del periodo':'')+'. Selecciona una barra diaria para abrir sus pedidos.</small></figure>';
}
function psSummary(w,data,catalog){
 const shop=safeStore(w.scope.store),r=data?.[shop];
 if(!r)return periodControls(w)+psPlaceholder(w);
 if(r.error)return periodControls(w)+'<div class="home-ps-message" role="alert">'+esc(r.error)+' <button data-home-command="fetch" data-id="'+esc(w.id)+'">Reintentar</button></div>';
 const {count,total,ticket,complete}=orderStats(r.rows,r.currencies,r.complete);
 const countText=complete?count:'Parcial: '+count;
 const showMetrics=w.filters.showMetrics!==false,showTop=w.filters.showTop!==false;
 const topLimit=[4,8,12].includes(Number(w.filters.topLimit))?Number(w.filters.topLimit):4;
 const metrics=showMetrics?'<div class="home-ps-metrics">'+metric('Ventas',complete?money(total):'Sin total fiable')+metric('Pedidos válidos',countText)+metric('Ticket medio',ticket!==null?money(ticket):'—')+metric('Catálogo',catalog?(catalog.complete?catalog.issues.filter(x=>x.issues.length).length+' avisos':'Parcial · '+catalog.issues.filter(x=>x.issues.length).length+' avisos'):'Sin consultar')+metric('Margen comercial','No validado')+'</div>':'';
 const chart=prestashopChart(w,r);
 const top=showTop?'<section class="home-ps-products"><h4>Productos más vendidos</h4>'+(r.top?.length?'<ol class="home-ps-top">'+r.top.slice(0,topLimit).map(p=>'<li>'+esc(p.name)+' <b>'+esc(String(p.qty))+' uds</b></li>').join('')+'</ol>':'<p class="small muted">Líneas sin cobertura completa. Abre PrestaShop para verificar.</p>')+'</section>':'';
 return '<div class="home-ps-content">'+periodControls(w)+metrics+'<p class="small muted">'+esc(labelStore(shop))+' · '+esc(r.from)+' → '+esc(r.to)+' · '+(r.complete?'lectura completa':'lectura parcial')+' · '+esc(r.checked||'')+'</p><div class="home-ps-panels '+(chart&&top?'has-chart-and-top':'')+'">'+chart+top+'</div><div class="home-widget-actions"><button type="button" class="btn secondary" data-home-command="fetch" data-id="'+esc(w.id)+'">Actualizar</button><button type="button" class="btn secondary" data-route="prestashop">Abrir PrestaShop</button></div></div>';
}
function prestashopProductsTable(w,data){
 const shop=safeStore(w.scope.store),shops=shop==='all'?PRESTASHOP_STORES.map(s=>s.key):[shop];
 const limit=[4,8,12].includes(Number(w.filters.topLimit))?Number(w.filters.topLimit):4;
 const chart=w.filters.productView==='bars';
 const sections=shops.map(key=>{
  const r=data?.[key];
  if(!r)return '<section class="home-top-products"><h4>'+esc(labelStore(key))+'</h4><p class="small muted">Sin consulta disponible. Actualiza el widget.</p></section>';
  if(r.error)return '<section class="home-top-products"><h4>'+esc(labelStore(key))+'</h4><p role="alert">'+esc(r.error)+'</p></section>';
  if(!Array.isArray(r.top)||!Number.isSafeInteger(r.totalUnits))return '<section class="home-top-products"><h4>'+esc(labelStore(key))+'</h4><p class="small muted">No se ha validado la cobertura de todas las líneas vendidas. No hay ranking completo.</p></section>';
  const rows=r.top.slice(0,limit),units=r.totalUnits,max=Math.max(1,...rows.map(item=>item.qty)),values=rows.map((item,index)=>{
   const share=units>0?Math.round(item.qty/units*1000)/10:null;
   const product=esc(item.name),variant=String(item.attributeId)==='0'?'Sin combinación':'Combinación #'+String(item.attributeId);
   if(chart)return '<li><div class="home-product-row"><b>#'+(index+1)+'</b><span>'+product+' <small>'+esc(variant)+'</small></span><strong>'+esc(String(item.qty))+' uds</strong></div><progress value="'+item.qty+'" max="'+max+'" aria-label="'+product+', '+item.qty+' unidades"></progress></li>';
   return '<tr><td data-label="Puesto">'+(index+1)+'</td><td data-label="Producto" class="home-product-title">'+product+'</td><td data-label="Variante">'+esc(variant)+'</td><td data-label="Referencia">'+esc(item.reference||'No informada')+'</td><td data-label="Unidades" class="number">'+esc(String(item.qty))+'</td><td data-label="Porcentaje" class="home-product-share">'+(share===null?'—':share.toLocaleString('es-ES')+' %')+(share===null?'':'<progress value="'+item.qty+'" max="'+units+'" aria-label="Porcentaje de unidades totales vendidas"></progress>')+'</td></tr>';
  }).join('');
  const body=chart?'<ol class="home-products-bars">'+values+'</ol>':
   '<div class="home-products-table-scroll" role="region" aria-label="Productos vendidos y variantes; desplazamiento horizontal" tabindex="0"><table class="data-table home-products-table"><thead><tr><th>#</th><th>Producto</th><th>Variante</th><th>Referencia</th><th>Unidades</th><th>% unidades</th></tr></thead><tbody>'+values+'</tbody></table></div>';
  return '<section class="home-top-products"><header><h4>'+esc(labelStore(key))+'</h4><span class="small muted">'+esc(String(units))+' uds verificadas · '+esc(r.from)+' → '+esc(r.to)+'</span></header>'+(rows.length?body:'<p class="small muted">No hay unidades válidas vendidas en este periodo.</p>')+'</section>';
 }).join('');
 return '<div class="home-products-widget">'+periodControls(w)+sections+'<div class="home-widget-actions"><button type="button" class="btn secondary" data-home-command="fetch" data-id="'+esc(w.id)+'">Actualizar productos vendidos</button><button type="button" class="btn secondary" data-home-command="open-orders" data-id="'+esc(w.id)+'">Abrir pedidos originales</button></div></div>';
}
function prestashopCatalogQuality(w,data){
 const scope=safeStore(w.scope.store),shops=scope==='all'?PRESTASHOP_STORES.map(x=>x.key):[scope];
 return '<div class="home-catalog-quality">'+shops.map(shop=>{
  const current=data.get(shop);
  if(!current)return '<section class="home-quality-shop"><h4>'+esc(labelStore(shop))+'</h4><p class="small muted">Sin consulta de catálogo. Pulsa Actualizar calidad.</p></section>';
  if(current.error)return '<section class="home-quality-shop"><h4>'+esc(labelStore(shop))+'</h4><p role="alert">'+esc(current.error)+'</p></section>';
  const issues=current.issues||[],rows=issues.filter(x=>x.issues.length>0);
  const complete=current.complete,counts=[['Sin referencia',rows.filter(x=>x.issues.includes('Sin referencia')).length],['EAN por revisar',rows.filter(x=>x.issues.some(y=>y.includes('EAN'))).length],['Peso pendiente',rows.filter(x=>x.issues.some(y=>y.includes('Peso'))).length]];
  const info=complete?'Catálogo consultado completo':'Consulta parcial: los totales no representan el catálogo completo';
  return '<section class="home-quality-shop"><h4>'+esc(labelStore(shop))+'</h4><p class="small muted">'+esc(info)+' · '+esc(String(current.rows.length))+' productos leídos</p><div class="home-quality-metrics">'+counts.map(([label,n])=>'<div><small>'+esc(label)+'</small><strong>'+esc(String(n))+(complete?'':' o más')+'</strong></div>').join('')+'</div><div class="home-quality-list">'+rows.slice(0,8).map(row=>'<div><span><b>'+esc(row.name||'Producto #'+row.id)+'</b><small>'+esc(row.reference||'Sin referencia')+'</small></span><small>'+esc(row.issues.join(' · '))+'</small></div>').join('')+(rows.length?'':'<p class="small muted">Sin incidencias en las fichas leídas.</p>')+'</div></section>';
 }).join('')+'<div class="home-widget-actions"><button type="button" class="btn secondary" data-home-command="fetch" data-id="'+esc(w.id)+'">Actualizar calidad</button><button type="button" class="btn secondary" data-home-command="open-prestashop-tab" data-tab="catalog">Abrir catálogo</button></div></div>';
}

function compactOrderCard(row){
 const total=row._currency==='EUR'&&cents(row.total_paid_tax_incl)!==null?money(cents(row.total_paid_tax_incl)/100):'Moneda sin verificar';
 const products=Array.isArray(row._products)&&row._products.length?row._products.map(p=>esc(p.name)+' · '+esc(String(p.qty))+' uds').join(' · '):'Consulta el pedido original para ver productos';
 const customer=/^\d{1,15}$/.test(String(row.id_customer||''))&&Number(row.id_customer)>0?'ID cliente #'+esc(String(row.id_customer)):'No informado';
 const valid=String(row.valid)==='1'?'Válido':'No válido';
 return '<article class="home-order-card"><div class="home-order-card-head"><div><b>Pedido #'+esc(String(row.id))+'</b><small class="home-order-shop">'+esc(labelStore(row._shop))+'</small></div><strong>'+esc(total)+'</strong></div>'+
 '<div class="home-order-card-meta"><span>'+esc(String(row.date_add||'Fecha no informada'))+'</span><span>'+valid+'</span><span>'+esc(row.reference||'Sin referencia')+'</span></div>'+
 '<details class="home-order-card-details"><summary>Ver datos y productos</summary><dl><dt>Productos</dt><dd>'+products+'</dd><dt>Cliente</dt><dd>'+customer+'</dd><dt>Pago</dt><dd>'+esc(row.payment||'No informado')+'</dd><dt>Atendido por</dt><dd>No informado por la tienda</dd><dt>Margen</dt><dd>Sin validar</dd></dl></details>'+
 '<div class="home-widget-actions"><button type="button" class="home-order-link" data-home-command="open-order" data-shop="'+esc(row._shop)+'" data-order="'+esc(String(row.id))+'" data-date="'+esc(String(row.date_add||'').slice(0,10))+'">Abrir pedido</button></div></article>';
}

function psOrders(w,data){
 const store=safeStore(w.scope.store);const shops=store==='all'?PRESTASHOP_STORES.map(s=>s.key):[store];
 const responses=shops.map(s=>data?.[s]).filter(Boolean);const errors=responses.map(r=>r.error).filter(Boolean);
 if(!responses.length)return periodControls(w)+psPlaceholder(w);
 const allRows=responses.flatMap(r=>r.error?[]:r.rows.map(order=>({...order,_shop:r.shop,_currency:r.currencies.get(String(order.id_currency))||null,_products:r.detailsByOrder?.get(String(order.id))||null})));
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
 return `${periodControls(w)}<div class="home-order-toolbar"><label>Buscar <input type="search" data-home-filter="query" data-id="${esc(w.id)}" value="${esc(w.filters.query||'')}" placeholder="Nº o referencia" maxlength="80"></label><label>Estado <select data-home-filter="status" data-id="${esc(w.id)}"><option value="all">Todos</option><option value="valid" ${w.filters.status==='valid'?'selected':''}>Válidos</option><option value="invalid" ${w.filters.status==='invalid'?'selected':''}>No válidos</option></select></label><label>Pago <select data-home-filter="payment" data-id="${esc(w.id)}"><option value="all">Todos</option>${paymentOptions.map(p=>`<option value="${esc(p)}" ${w.filters.payment===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>Orden <select data-home-filter="sort" data-id="${esc(w.id)}"><option value="newest">Más recientes</option><option value="oldest" ${w.filters.sort==='oldest'?'selected':''}>Más antiguos</option></select></label><button type="button" data-home-command="fetch" data-id="${esc(w.id)}" class="btn secondary">Actualizar</button></div>
 ${errors.length?`<p class="home-error" role="alert">${esc(errors.join(' · '))}</p>`:''}${partial?'<p class="small muted">Consulta parcial o pendiente: el recuento no representa todas las ventas.</p>':''}
 <div class="home-orders-scroll" role="region" aria-label="Tabla de pedidos de PrestaShop; desplazamiento horizontal y vertical" tabindex="0" data-home-orders-viewport="${esc(w.id)}"><table class="data-table home-orders-table"><thead><tr><th>Pedido</th><th>Referencia</th><th>Productos</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha y hora</th><th>Atendido por</th><th>Margen €</th></tr></thead><tbody>${visible.map(row=>`<tr><td><button type="button" class="home-order-link" data-home-command="open-order" data-shop="${esc(row._shop)}" data-order="${esc(String(row.id))}" data-date="${esc(String(row.date_add||'').slice(0,10))}">#${esc(row.id)}</button></td><td>${esc(row.reference||'—')}<small class="home-order-shop">${esc(labelStore(row._shop))}</small></td><td class="home-orders-products">${Array.isArray(row._products)&&row._products.length?row._products.slice(0,2).map(item=>`<span class="home-order-product-line" title="${esc(item.name)}">${esc(item.name)} · ${esc(String(item.qty))} uds</span>`).join('')+(row._products.length>2?`<small>+${row._products.length-2} líneas más</small>`:''):'<span class="small muted">Ver pedido para consultar productos</span>'}</td><td>${/^\d{1,15}$/.test(String(row.id_customer||''))&&Number(row.id_customer)>0?`ID cliente #${esc(String(row.id_customer))}`:'No informado'}</td><td>${row._currency==='EUR'&&cents(row.total_paid_tax_incl)!==null?money(cents(row.total_paid_tax_incl)/100):'Moneda sin verificar'}</td><td>${esc(row.payment||'—')}</td><td>${String(row.valid)==='1'?'Válido':'No válido'}</td><td>${esc(row.date_add||'')}</td><td>No informado por la tienda</td><td>Sin validar</td></tr>`).join('')||'<tr><td colspan="10">No hay pedidos para estos filtros.</td></tr>'}</tbody></table></div>
 <div class="home-orders-cards" role="list" aria-label="Pedidos en fichas adaptativas">${visible.map(compactOrderCard).join('')}</div>
 <div class="home-order-footer"><label>Filas <select data-home-filter="pageSize" data-id="${esc(w.id)}">${[10,15,20].map(n=>`<option value="${n}" ${pageSize===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Página <input class="home-page-select" type="number" min="1" max="${pages}" step="1" inputmode="numeric" aria-label="Ir a página de pedidos" data-home-filter="page" data-id="${esc(w.id)}" value="${page+1}"></label><span>de ${pages}${partial?' · parcial':''}</span><button type="button" data-home-command="prev-page" data-id="${esc(w.id)}" ${page===0?'disabled':''}>‹</button><button type="button" data-home-command="next-page" data-id="${esc(w.id)}" ${page>=pages-1?'disabled':''}>›</button><button class="btn secondary" data-home-command="open-orders" data-id="${esc(w.id)}">Abrir pedidos</button></div>`;
}
const orderColumnLabels={order:'Pedido',reference:'Referencia',products:'Productos',customer:'Cliente',total:'Total',payment:'Pago',status:'Estado',date:'Fecha y hora',employee:'Atendido por',margin:'Margen €'};
function selectedOrderColumns(w){const v=w.filters.columns;return Array.isArray(v)&&v.length>=2&&v.includes('order')?v:HOME_ORDER_COLUMNS.slice()}
function columnsInspector(w){
 const selected=selectedOrderColumns(w),all=[...selected,...HOME_ORDER_COLUMNS.filter(key=>!selected.includes(key))];
 return '<fieldset class="home-columns-inspector"><legend>Columnas de la tabla de pedidos</legend><p class="small muted">El pedido siempre queda visible para abrir su ficha. Puedes mostrar, ocultar y reordenar las demás columnas.</p>'+all.map(key=>{
  const active=selected.includes(key),position=selected.indexOf(key);
  return '<div class="home-column-item"><label><input type="checkbox" data-home-column="'+esc(key)+'" data-id="'+esc(w.id)+'" '+(active?'checked':'')+' '+(key==='order'?'disabled':'')+'><span>'+esc(orderColumnLabels[key])+'</span></label><button type="button" data-home-command="column-up" data-id="'+esc(w.id)+'" data-column="'+esc(key)+'" '+(!active||position<=1?'disabled':'')+' aria-label="Subir '+esc(orderColumnLabels[key])+'">↑</button><button type="button" data-home-command="column-down" data-id="'+esc(w.id)+'" data-column="'+esc(key)+'" '+(!active||position===selected.length-1||key==='order'?'disabled':'')+' aria-label="Bajar '+esc(orderColumnLabels[key])+'">↓</button></div>';
 }).join('')+'</fieldset>';
}
function prestashopInspector(w){
 const pick=(field,label,values,selected)=>'<label>'+esc(label)+'<select data-home-config="'+field+'" data-id="'+esc(w.id)+'">'+values.map(([value,name])=>'<option value="'+esc(value)+'" '+(String(selected)===String(value)?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>';
 let html='';
 if(w.type==='prestashop.summary'){
  html+='<fieldset class="home-ps-inspector"><legend>Resumen y gráficas</legend>';
  html+=pick('chartMode','Gráfica',[['hours','Por horas · 24 franjas'],['days','Por días · hasta 14'],['off','Ocultar gráfica']],w.filters.chartMode||'hours');
  html+=pick('chartMetric','Dato de la gráfica',[['orders','Pedidos válidos'],['sales','Ventas EUR verificadas']],w.filters.chartMetric||'orders');
  html+=pick('showMetrics','Indicadores',[['yes','Mostrar cinco indicadores'],['no','Ocultar indicadores']],w.filters.showMetrics===false?'no':'yes');
  html+=pick('showTop','Productos más vendidos',[['yes','Mostrar clasificación'],['no','Ocultar clasificación']],w.filters.showTop===false?'no':'yes');
 }
 if(w.type==='prestashop.top')html+=pick('productView','Presentación de productos',[['table','Tabla con todos los datos'],['bars','Gráfico de barras por unidades']],w.filters.productView||'table');
 if(['prestashop.summary','prestashop.top'].includes(w.type))html+=pick('topLimit','Productos en ranking',[['4','4 productos'],['8','8 productos'],['12','12 productos']],w.filters.topLimit||4);
 if(w.type==='prestashop.summary')html+='</fieldset>';
 if(w.type==='prestashop.orders'){html+=pick('tableDensity','Densidad de filas',[['compact','Compacta: más pedidos a la vista'],['normal','Normal: equilibrio'],['comfortable','Cómoda: más espacio']],w.filters.tableDensity||'normal');html+=columnsInspector(w)}
 return html;
}
function configureOrderColumns(host,w){
 const visible=selectedOrderColumns(w),table=host.querySelector('.home-orders-table');
 if(!table)return;
 for(const row of table.querySelectorAll('tr')){
  const cells=[...row.children];
  if(cells.length===1&&cells[0].hasAttribute('colspan')){cells[0].colSpan=visible.length;continue}
  if(cells.length!==HOME_ORDER_COLUMNS.length)continue;
  visible.forEach(key=>row.append(cells[HOME_ORDER_COLUMNS.indexOf(key)]));
  HOME_ORDER_COLUMNS.filter(key=>!visible.includes(key)).forEach(key=>cells[HOME_ORDER_COLUMNS.indexOf(key)].remove());
 }
}
export function createHomeWidgetsUI({rpc,invoke,can,notify=()=>{},onOpenOrders=()=>{},onOpenExpense=()=>{}}){
 let root=null,grid=null,model=null,original=null,sources=new Map(),edit=false,selected=null,panelView='closed',advancedOpen=false,styleItems=[],stylesBusy=false,stylesError='',owner=null,token=0,remoteReady=false,busy=false,connections=null,connectionsTask=null;
 const ordersData=new Map(),queries=new Map(),catalogData=new Map(),catalogQueries=new Map();let activeDrag=null,activeResize=null;
 const live=()=>root?.isConnected&&state.route==='inicio'&&state.user?.id===owner;
 const find=id=>model?.widgets.find(w=>w.id===id);
 const changed=()=>!!model&&!!original&&(JSON.stringify(model.widgets)!==JSON.stringify(original.widgets)||JSON.stringify(model.settings)!==JSON.stringify(original.settings));
 const clones=new Map();
 const status=(message,warning=false)=>{const el=root?.querySelector('[data-home-status]');if(el){el.textContent=message;el.classList.toggle('home-error',warning)}};
 const layoutKey=w=>[safeStore(w.scope.store),...Object.values(dateRange(w))].join('|');
 const dataFor=w=>Object.fromEntries(PRESTA_SHOPS(w).map(k=>[k,ordersData.get(k+'|'+Object.values(dateRange(w)).join('|'))]));
 function PRESTA_SHOPS(w){return safeStore(w.scope.store)==='all'?PRESTASHOP_STORES.map(x=>x.key):[safeStore(w.scope.store)]}
 const freshWidget=(w)=>{
  if(w.type==='cash.openings'&&safeStore(w.scope.store)!=='all')return storeOpeningWidget(w);
  if(w.type==='prestashop.summary')return psSummary(w,dataFor(w),catalogData.get(safeStore(w.scope.store)));
  if(w.type==='prestashop.quality')return prestashopCatalogQuality(w,catalogData);
  if(w.type==='prestashop.orders')return psOrders(w,dataFor(w));
  if(w.type==='prestashop.top')return prestashopProductsTable(w,dataFor(w));
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
   heading.innerHTML=`<button class="home-move-handle" data-home-grip="${esc(w.id)}" ${edit?'draggable="true"':'disabled aria-hidden="true" tabindex="-1"'} aria-label="Mover ${esc(w.title)}" title="Arrastrar en modo edición">⠿</button><h3>${esc(w.title)}</h3><span class="home-widget-scope">${(w.type.startsWith('prestashop.')||['cash.openings','cash.withdrawals','cash.history','expenses.pending'].includes(w.type))?esc(labelStore(safeStore(w.scope.store))):''}</span><button type="button" class="home-widget-more" aria-label="Configurar ${esc(w.title)}" data-home-command="select" data-id="${esc(w.id)}">⋯</button>`;
   const body=document.createElement('div');body.className='home-widget-body';const content=freshWidget(w);
   if(typeof content==='string'){
    body.innerHTML=content;
    if(w.type==='prestashop.orders'){configureOrderColumns(body,w);body.dataset.homeTableDensity=w.filters.tableDensity||'normal'}
    // Widget presentation filters never count as unsaved business forms.
    body.querySelectorAll('input,select,textarea').forEach(field=>field.setAttribute('data-draft-ignore',''));
   }else body.append(content);
   card.append(heading,body);if(edit)card.insertAdjacentHTML('beforeend',`<button type="button" class="home-resize-handle" data-home-resize="${esc(w.id)}" aria-label="Estirar o encoger ${esc(w.title)}" title="Arrastrar la esquina para cambiar tamaño">↘</button>`);grid.append(card);
  }
  root.classList.toggle('home-edit-mode',edit);
  root.classList.toggle('home-widgets-dirty',changed());
  const settings=homeCanvasSettings(model.settings);
  grid.style.gap=settings.gap==='inherit'?'var(--appearance-gap,14px)':settings.gap+'px';
  grid.style.maxWidth=settings.width==='fluid'?'none':settings.width+'px';
  grid.style.marginInline='auto';
  grid.style.setProperty('--home-card-padding',settings.density==='compact'?'9px':settings.density==='comfortable'?'18px':'var(--appearance-card-pad,12px)');
  root.dataset.homeCanvasBackground=settings.background;
  root.dataset.homeCanvasDensity=settings.density;
  const toggle=root.querySelector('[data-home-command="edit"]');if(toggle)toggle.textContent=edit?'Cancelar edición':'Personalizar inicio';
  renderDrawer();
 }
 function renderDrawer(){
  const drawer=root?.querySelector('[data-home-drawer]');if(!drawer)return;
  const w=find(selected),available=Object.values(HOME_WIDGET_CATALOG).filter(def=>permitted({type:def.type},can));
  const categories=[...new Set(available.map(def=>def.category))].sort((x,y)=>x.localeCompare(y,'es'));
  const activeCategory=categories.includes(drawer.dataset.category)?drawer.dataset.category:'all';
  const canvas=homeCanvasSettings(model.settings);
  drawer.hidden=!edit||panelView==='closed';
  if(drawer.hidden){drawer.replaceChildren();return;}
  const hiddenWidgets=model.widgets.filter(x=>x.hidden);
  drawer.innerHTML=`<div class="home-library-heading"><h3>Biblioteca de widgets</h3><button data-home-command="exit">✕</button></div><p class="small muted">Añade paneles por módulo y configura cada instancia. Los colores, bordes y efectos se heredan de Mi interfaz.</p><details class="home-board-settings" open><summary>⚙ Diseño general del tablero</summary><div class="home-board-settings-fields"><label>Separación entre widgets<select data-home-general="gap">${[['inherit','Heredar de Mi interfaz'],['8','Muy compacta · 8 px'],['12','Compacta · 12 px'],['16','Equilibrada · 16 px'],['20','Amplia · 20 px'],['24','Muy amplia · 24 px']].map(([value,label])=>`<option value="${value}" ${canvas.gap===value?'selected':''}>${label}</option>`).join('')}</select></label><label>Anchura del tablero<select data-home-general="width">${[['fluid','Todo el espacio disponible'],['1440','Máximo 1440 px'],['1600','Máximo 1600 px'],['1920','Máximo 1920 px']].map(([value,label])=>`<option value="${value}" ${canvas.width===value?'selected':''}>${label}</option>`).join('')}</select></label><label>Densidad interior<select data-home-general="density">${[['inherit','Heredar de Mi interfaz'],['compact','Compacta'],['comfortable','Cómoda']].map(([value,label])=>`<option value="${value}" ${canvas.density===value?'selected':''}>${label}</option>`).join('')}</select></label><label>Fondo de la zona<select data-home-general="background">${[['inherit','Mismo fondo que Inicio'],['soft','Zona suave, con separación visual']].map(([value,label])=>`<option value="${value}" ${canvas.background===value?'selected':''}>${label}</option>`).join('')}</select></label><p class="small muted">Se guarda para tu usuario; no cambia los colores ni las preferencias de tus compañeros.</p></div></details><label>Buscar widgets<input type="search" data-home-search placeholder="Buscar por módulo o nombre" value="${esc(drawer.dataset.search||'')}"></label><label>Módulo<select data-home-category><option value="all">Todos los módulos (${available.length})</option>${categories.map(category=>`<option value="${esc(category)}" ${activeCategory===category?'selected':''}>${esc(category)} (${available.filter(x=>x.category===category).length})</option>`).join('')}</select></label><div class="home-library-items">${available.filter(x=>(activeCategory==='all'||x.category===activeCategory)&&(x.title+' '+x.category).toLocaleLowerCase('es').includes(String(drawer.dataset.search||'').toLocaleLowerCase('es'))).map(x=>`<div class="home-library-item"><span><b>${esc(x.title)}</b><small>${esc(x.category)}</small></span><button aria-label="Añadir ${esc(x.title)}" data-home-command="add" data-type="${esc(x.type)}" ${nonClonable.has(x.type)&&model.widgets.some(w=>w.type===x.type)?'disabled title="Widget único: ya está en tu diseño"':''}>＋</button></div>`).join('')}</div>${hiddenWidgets.length?`<details class="home-hidden-widgets"><summary>Widgets ocultos (${hiddenWidgets.length})</summary>${hiddenWidgets.map(x=>`<div class="home-library-item"><b>${esc(x.title)}</b><button type="button" data-home-command="show" data-id="${esc(x.id)}">Mostrar</button></div>`).join('')}</details>`:''}${w?`<div class="home-widget-inspector"><h3>Configurar widget</h3><p class="small">${esc(w.title)}</p>${(w.type.startsWith('prestashop.')||['cash.openings','cash.withdrawals','cash.history','expenses.pending'].includes(w.type))?`<label>Tienda<select data-home-config="store" data-id="${esc(w.id)}"><option value="all" ${safeStore(w.scope.store)==='all'?'selected':''}>Todas las tiendas</option>${PRESTASHOP_STORES.map(s=>`<option value="${s.key}" ${s.key===w.scope.store?'selected':''}>${s.name}</option>`).join('')}</select></label>`:''}${['prestashop.summary','prestashop.orders','prestashop.top'].includes(w.type)?`<label>Desde<input type="date" data-home-config="from" data-id="${esc(w.id)}" value="${dateRange(w).from}"></label><label>Hasta<input type="date" data-home-config="to" data-id="${esc(w.id)}" value="${dateRange(w).to}"></label>`:''}${prestashopInspector(w)}<label>Anchura<select data-home-config="width" data-id="${esc(w.id)}">${allowedWidths(w).map(x=>`<option value="${x}" ${x===w.layout.desktop.w?'selected':''}>${x} / 12 columnas</option>`).join('')}</select></label><label>Altura escritorio<select data-home-config="height" data-id="${esc(w.id)}">${[2,3,4,5,6,7,8,9,10,11,12].map(x=>`<option value="${x}" ${x===w.layout.desktop.h?'selected':''}>${x} unidades</option>`).join('')}</select></label><label>Anchura tablet<select data-home-config="tabletWidth" data-id="${esc(w.id)}">${[1,2,3,4,5,6].map(x=>`<option value="${x}" ${x===w.layout.tablet.w?'selected':''}>${x} / 6 columnas</option>`).join('')}</select></label><label>Altura tablet<select data-home-config="tabletHeight" data-id="${esc(w.id)}">${Array.from({length:15},(_,i)=>i+2).map(x=>`<option value="${x}" ${x===w.layout.tablet.h?'selected':''}>${x} unidades</option>`).join('')}</select></label><label>Altura móvil<select data-home-config="mobileHeight" data-id="${esc(w.id)}">${Array.from({length:17},(_,i)=>i+2).map(x=>`<option value="${x}" ${x===w.layout.mobile.h?'selected':''}>${x} unidades</option>`).join('')}</select></label><label>Mover a posición<select data-home-config="position" data-id="${esc(w.id)}">${model.widgets.map((v,i)=>`<option value="${i}" ${v.id===w.id?'selected':''}>${i+1}. ${esc(v.title)}</option>`).join('')}</select></label><div class="home-inspector-actions"><button data-home-command="up" data-id="${esc(w.id)}">↑ Subir</button><button data-home-command="down" data-id="${esc(w.id)}">↓ Bajar</button><button data-home-command="duplicate" data-id="${esc(w.id)}" ${nonClonable.has(w.type)?'disabled title="Formulario único: no se duplica"':''}>Duplicar</button><button data-home-command="hide" data-id="${esc(w.id)}">Ocultar</button><button data-home-command="remove" data-id="${esc(w.id)}">Quitar instancia</button></div></div>`:''}`;
  drawer.querySelectorAll('input,select,textarea').forEach(field=>field.setAttribute('data-draft-ignore',''));
  organizeHomeEditor(drawer);
 }

 function organizeHomeEditor(drawer){
  const head=drawer.querySelector('.home-library-heading');
  const desc=head?.nextElementSibling;
  const board=drawer.querySelector('.home-board-settings');
  const search=drawer.querySelector('[data-home-search]')?.closest('label');
  const category=drawer.querySelector('[data-home-category]')?.closest('label');
  const items=drawer.querySelector('.home-library-items');
  const hidden=drawer.querySelector('.home-hidden-widgets');
  const inspector=drawer.querySelector('.home-widget-inspector');
  if(!head||!board||!items)return;
  const title=head.querySelector('h3'),close=head.querySelector('button');
  head.classList.add('home-editor-panel-head');
  if(title){title.textContent=panelView==='library'?'Añadir widgets':panelView==='board'?'Diseño general':panelView==='styles'?'Estilos compartidos':'Configurar widget';title.tabIndex=-1}
  if(close){close.dataset.homeCommand='close-panel';close.setAttribute('aria-label','Cerrar inspector sin descartar cambios');close.title='Cerrar inspector';close.textContent='✕'}
  if(desc)desc.remove();
  const tabs=document.createElement('nav');
  tabs.className='home-editor-tabs';tabs.setAttribute('aria-label','Herramientas del Inicio');
  tabs.innerHTML=[['library','＋ Añadir'],['widget','▣ Widget'],['board','⚙ Tablero'],['styles','☆ Estilos']].map(([key,label])=>'<button type="button" data-home-command="panel-'+key+'" aria-pressed="'+(panelView===key)+'" '+(panelView===key?'class="active"':'')+'>'+label+'</button>').join('');
  const library=document.createElement('section');library.className='home-editor-view';library.dataset.editorView='library';
  library.insertAdjacentHTML('afterbegin','<div class="home-panel-intro"><strong>Biblioteca de widgets</strong><p>Busca herramientas y añádelas al tablero. No afecta al trabajo de los demás usuarios.</p></div>');
  for(const el of [search,category,items,hidden])if(el)library.append(el);
  const boardView=document.createElement('section');boardView.className='home-editor-view';boardView.dataset.editorView='board';
  boardView.insertAdjacentHTML('afterbegin','<div class="home-panel-intro"><strong>Distribución del tablero</strong><p>Elige la separación, anchura y densidad que prefieras. Los colores siguen dependiendo de Mi interfaz.</p></div>');
  board.open=true;boardView.append(board);
  const widgetView=document.createElement('section');widgetView.className='home-editor-view';widgetView.dataset.editorView='widget';
  const w=find(selected);
  if(inspector&&w){
   const labels=[...inspector.querySelectorAll(':scope > label')];
   const fieldsets=[...inspector.querySelectorAll(':scope > fieldset')];
   const actions=inspector.querySelector('.home-inspector-actions');
   const first=inspector.querySelector('h3'),description=first?.nextElementSibling;
   const switcher=document.createElement('label');switcher.className='home-editor-widget-switcher';
   switcher.innerHTML='<span>Widget seleccionado</span><select data-home-switch-widget aria-label="Cambiar widget en el inspector">'+model.widgets.filter(x=>!x.hidden&&permitted(x,can)).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===w.id?'selected':'')+'>'+esc(x.title)+'</option>').join('')+'</select>';
   const intro=document.createElement('div');intro.className='home-panel-intro';
   intro.innerHTML='<strong>'+esc(w.title)+'</strong><p>'+esc(HOME_WIDGET_CATALOG[w.type]?.category||'Widget')+' · Selecciona tamaño y opciones sin modificar el módulo original.</p>';
   const presets=document.createElement('div');presets.className='home-editor-presets';
   const widths=allowedWidths(w),defaultWidth=HOME_WIDGET_CATALOG[w.type].width;
   const choices=[['compact','Compacto',widths[0]],['balanced','Estándar',defaultWidth],['wide','Ancho',widths.filter(x=>x<=9).at(-1)||widths.at(-1)],['full','Completo',widths.at(-1)]];
   presets.innerHTML='<span class="home-editor-label">Tamaño rápido</span><div class="home-size-presets" role="group" aria-label="Tamaño de '+esc(w.title)+'">'+choices.map(([key,label,width])=>'<button type="button" data-home-command="preset-size" data-id="'+esc(w.id)+'" data-size="'+key+'" aria-pressed="'+(width===w.layout.desktop.w)+'" title="'+esc(label)+'">'+label+'<small>'+width+'/12</small></button>').join('')+'</div>';
   const content=document.createElement('details');content.className='home-editor-section';content.open=true;
   content.innerHTML='<summary>Contenido y datos</summary>';
   const contentFields=document.createElement('div');contentFields.className='home-editor-fields';
   const layout=document.createElement('details');layout.className='home-editor-section';layout.open=true;
   layout.innerHTML='<summary>Posición y tamaño</summary>';
   const sizeFields=document.createElement('div');sizeFields.className='home-editor-fields';
   const advanced=document.createElement('details');advanced.className='home-editor-section home-editor-advanced';advanced.open=advancedOpen;advanced.innerHTML='<summary>Tableta, móvil y orden</summary>';
   const advancedFields=document.createElement('div');advancedFields.className='home-editor-fields';
   for(const label of labels){
    const key=label.querySelector('[data-home-config]')?.dataset.homeConfig;
    if(['width','height'].includes(key))sizeFields.append(label);
    else if(['tabletWidth','tabletHeight','mobileHeight','position'].includes(key))advancedFields.append(label);
    else contentFields.append(label);
   }
   for(const set of fieldsets)contentFields.append(set);
   content.append(contentFields);
   sizeFields.insertAdjacentHTML('beforeend','<p class="small muted">La altura se adapta al contenido: los datos nunca quedan recortados.</p>');
   layout.append(sizeFields);
   advanced.append(advancedFields);
   widgetView.append(switcher,intro,presets,content,layout,advanced);
   if(actions)widgetView.append(actions);
  }else widgetView.innerHTML='<div class="home-panel-intro"><strong>Selecciona un widget</strong><p>Pulsa el menú de una tarjeta para configurar sus opciones y tamaño.</p><button class="btn secondary" type="button" data-home-command="panel-library">Añadir widgets</button></div>';
  const stylesView=document.createElement('section');stylesView.className='home-editor-view';stylesView.dataset.editorView='styles';
  const rows=styleItems.map(t=>'<article class="home-style-row"><div><strong>'+esc(t.name)+'</strong><small>'+esc(t.author||'Equipo')+(t.mine?' · Mi estilo':'')+'</small></div><div class="home-style-row-actions"><button type="button" data-home-command="style-apply" data-id="'+esc(t.id)+'" '+(!can('inicio','edit')?'disabled title="Sin permiso de edición"':'')+'>Aplicar</button>'+(t.mine?'<button type="button" data-home-command="style-remove" data-id="'+esc(t.id)+'" aria-label="Retirar '+esc(t.name)+'">Retirar</button>':'')+'</div></article>').join('');
  stylesView.innerHTML='<div class="home-panel-intro"><strong>Estilos compartidos del equipo</strong><p>Guarda una distribución con nombre para que otros usuarios puedan aplicarla. No se comparten fechas, búsquedas personales, clientes ni datos comerciales; cada usuario conserva su diseño propio.</p></div>'+
  '<div class="home-style-publish"><label>Nombre del estilo<input type="text" data-home-style-name maxlength="60" placeholder="Ej. Apertura de tiendas"></label>'+
  '<button class="btn primary" type="button" data-home-command="style-publish" '+(stylesBusy||!can('inicio','edit')?'disabled':'')+'>Guardar y compartir</button>'+
  '<small>Guarda primero los cambios de tu Inicio. Publicar copia su disposición, nunca modifica otros perfiles.</small></div>'+
  '<div class="home-style-list-heading"><strong>Estilos disponibles ('+styleItems.length+')</strong><button type="button" data-home-command="style-refresh">Actualizar</button></div>'+
  (stylesError?'<p class="home-error" role="alert">'+esc(stylesError)+'</p>':'')+
  (stylesBusy?'<p class="small muted" role="status">Consultando estilos…</p>':rows||'<p class="small muted">No hay estilos compartidos disponibles.</p>');
  const body=document.createElement('div');body.className='home-editor-panel-body';
  body.append(library,widgetView,boardView,stylesView);
  for(const section of body.children)section.hidden=section.dataset.editorView!==panelView;
  drawer.replaceChildren(head,tabs,body);
  const inspectorActions=widgetView.querySelector('.home-inspector-actions');
  if(panelView==='widget'&&inspectorActions){
   const footer=document.createElement('div');footer.className='home-editor-footer';
   footer.append(inspectorActions);drawer.append(footer);
  }
  drawer.dataset.activePanel=panelView;
  drawer.setAttribute('aria-label','Personalización del Inicio');
  drawer.querySelectorAll('input,select,textarea').forEach(field=>field.setAttribute('data-draft-ignore',''));
 }


 async function loadStyles(){
  if(stylesBusy||!live()||!edit)return;
  stylesBusy=true;stylesError='';renderDrawer();
  const session=owner,epoch=token;
  try{
   const response=await rpc('totus_home_styles',{p_action:'list',p_template_id:null,p_name:null});
   if(!live()||session!==owner||epoch!==token)return;
   if(!Array.isArray(response?.items))throw new Error('La respuesta del catálogo no tiene el formato esperado.');
   styleItems=response.items.filter(t=>typeof t?.id==='string'&&typeof t?.name==='string').slice(0,100);
  }catch(error){
   if(live()&&session===owner&&epoch===token){
    styleItems=[];
    stylesError='Biblioteca de estilos no disponible: '+String(error?.message||error).slice(0,180)+'. El Inicio personal sigue funcionando.';
   }
  }finally{
   if(live()&&session===owner&&epoch===token){stylesBusy=false;if(panelView==='styles')renderDrawer()}
  }
 }
 async function publishStyle(){
  if(stylesBusy||!live()||!edit||!can('inicio','edit'))return;
  const name=root.querySelector('[data-home-style-name]')?.value?.trim()||'';
  if(name.length<3||name.length>60){status('Pon un nombre entre 3 y 60 caracteres.',true);return}
  if(changed()||!remoteReady){status('Guarda y verifica primero los cambios de tu propio Inicio antes de compartirlo.',true);return}
  stylesBusy=true;renderDrawer();
  const session=owner,epoch=token;
  try{
   const saved=await rpc('totus_home_styles',{p_action:'publish',p_template_id:null,p_name:name});
   if(!live()||session!==owner||epoch!==token)return;
   if(!/^[\da-f-]{36}$/i.test(String(saved?.id||''))||saved.published!==true)throw Error('Publicación no confirmada');
   status('Estilo «'+name+'» compartido con el equipo.');
  }catch(error){if(live())status('No se pudo publicar el estilo: '+String(error?.message||error).slice(0,180),true)}
  finally{if(live()&&session===owner&&epoch===token){stylesBusy=false;void loadStyles()}}
 }
 async function applyStyle(id){
  if(stylesBusy||!live()||!edit||!can('inicio','edit')||!styleItems.some(t=>t.id===id))return;
  if(!confirm('¿Aplicar este estilo a tu Inicio? No se guardará hasta que pulses «Guardar cambios». Puedes cancelar para recuperar tu distribución.'))return;
  stylesBusy=true;renderDrawer();
  const session=owner,epoch=token;
  try{
   const result=await rpc('totus_home_styles',{p_action:'read',p_template_id:id,p_name:null});
   if(!live()||session!==owner||epoch!==token)return;
   if(result?.id!==id)throw Error('La plantilla recibida no coincide con la seleccionada.');
   const next=readHomeDashboard(result.layout);
   model={...next,revision:model.revision};selected=null;panelView='closed';
   draw();status('Estilo «'+String(result.name||'compartido').slice(0,60)+'» aplicado de forma provisional. Guarda para conservarlo o cancela para recuperar tu Inicio.');
  }catch(error){if(live())status('No se pudo aplicar el estilo: '+String(error?.message||error).slice(0,180),true)}
  finally{if(live()&&session===owner&&epoch===token){stylesBusy=false;if(panelView==='styles')renderDrawer()}}
 }
 async function removeStyle(id){
  if(stylesBusy||!live()||!edit||!can('inicio','edit')||!styleItems.some(t=>t.id===id&&t.mine))return;
  if(!confirm('¿Retirar este estilo de la biblioteca compartida? No modifica los Inicios que ya lo hayan aplicado.'))return;
  stylesBusy=true;renderDrawer();
  const session=owner,epoch=token;
  try{
   const result=await rpc('totus_home_styles',{p_action:'remove',p_template_id:id,p_name:null});
   if(!live()||session!==owner||epoch!==token)return;
   if(result?.removed!==true||result?.id!==id)throw Error('Retirada no confirmada.');
   status('Estilo retirado de la biblioteca. Los demás diseños permanecen intactos.');
  }catch(error){if(live())status('No se pudo retirar el estilo: '+String(error?.message||error).slice(0,180),true)}
  finally{if(live()&&session===owner&&epoch===token){stylesBusy=false;void loadStyles()}}
 }

 const makeId=()=>`hw-${crypto.randomUUID()}`;
 const mutate=(fn,focusId=null)=>{if(!edit||busy)return;try{const next=fn(model);model=next;selected=(focusId&&find(focusId)?.id)||find(selected)?.id||model.widgets.find(w=>!w.hidden)?.id||null;draw();status('Cambios pendientes de guardar.');}catch(error){status('No se pudo aplicar el cambio: '+String(error?.message||error),true)}};
 function command(action,id,el){
  if(action==='style-refresh'){void loadStyles();return}
  if(action==='style-publish'){void publishStyle();return}
  if(action==='style-apply'){void applyStyle(id);return}
  if(action==='style-remove'){void removeStyle(id);return}

  if(['panel-library','panel-widget','panel-board','panel-styles'].includes(action)){if(!edit)return;panelView=action.slice(6);renderDrawer();if(panelView==='styles')void loadStyles();return}
   if(action==='close-panel'){panelView='closed';renderDrawer();return}
   if(action==='preset-size'){const w=find(id);if(!edit||!w)return;const widths=allowedWidths(w),def=HOME_WIDGET_CATALOG[w.type];const options={compact:widths[0],balanced:def.width,wide:widths.filter(x=>x<=9).at(-1)||widths.at(-1),full:widths.at(-1)};const width=options[el.dataset.size];if(!widths.includes(width))return;mutate(m=>setHomeWidgetConfig(m,id,{layout:{desktop:{w:width}}}),id);panelView='widget';return}

  if(action==='edit'){if(edit){if(changed()&&!confirmDiscard())return;model=structuredClone(original);edit=false;selected=null;panelView='closed'}else{edit=true;selected=null;panelView='closed'}draw();return}
  if(action==='exit'){if(changed()&&!confirmDiscard())return;edit=false;model=structuredClone(original);selected=null;panelView='closed';draw();return}
  if(action==='select'){selected=id;edit=true;panelView='widget';advancedOpen=false;draw();return}
  if(action==='add'){panelView='widget';const type=el.dataset.type;if(nonClonable.has(type)&&model.widgets.some(w=>w.type===type)){status('Ese widget contiene controles únicos y ya está añadido. Puedes moverlo o cambiar su tamaño.',true);return}const scope=type==='prestashop.summary'?{store:PRESTASHOP_STORES[0].key}:{store:'all'};const newId=makeId();mutate(m=>addHomeWidget(m,type,newId,{scope}),newId);if(type==='prestashop.quality')void fetchCatalog(find(newId));else if(type.startsWith('prestashop.'))void fetchFor(find(newId));return}
  if(action==='duplicate'){const w=find(id);if(!w||nonClonable.has(w.type))return;const newId=makeId();mutate(m=>duplicateHomeWidget(m,id,newId),newId);return}
  if(action==='hide'){mutate(m=>setHomeWidgetConfig(m,id,{hidden:true}),model.widgets.find(x=>x.id!==id&&!x.hidden)?.id);return}
  if(action==='show'){mutate(m=>setHomeWidgetConfig(m,id,{hidden:false}));selected=id;draw();return}
  if(action==='remove'){if(!confirm('¿Quitar este widget del Inicio? No se borrará ningún dato del módulo y podrás volver a añadirlo.'))return;mutate(m=>removeHomeWidget(m,id));return}
  if(action==='up'||action==='down'){mutate(m=>reorderHomeWidget(m,id,action));return}
  if(action==='reset'){if(!confirm('¿Restaurar la distribución inicial? Los cambios actuales quedarán pendientes de guardar y podrás descartarlos antes de confirmar.'))return;mutate(()=>createDefault());return}
  if(['period-day','period-week','period-month','period-custom','period-prev','period-next'].includes(action)){
   const w=find(id);if(!w||!['prestashop.summary','prestashop.orders','prestashop.top'].includes(w.type))return;
   const cmd=action.replace('period-',''),period=['prev','next'].includes(cmd)?(w.filters.period||'day'):cmd;
   const dates=cmd==='custom'?dateRange(w):['prev','next'].includes(cmd)?shiftedPeriod(w,cmd==='prev'?-1:1):homePeriodBounds(period);
   model=setHomeWidgetConfig(model,id,{filters:{...dates,period,page:0}});draw();
   if(period!=='custom')void fetchFor(find(id));
   status('Periodo de consulta: '+dates.from+' a '+dates.to);return;
  }
  if(action==='chart-slice'){
   const shop=el.dataset.shop,date=el.dataset.date;
   if(!PRESTASHOP_STORES.some(s=>s.key===shop)||!safeDate(date))return;
   void onOpenOrders({tab:'orders',store:shop,date});return;
  }
  if(action==='fetch'){const w=find(id);if(w?.type==='prestashop.quality')void fetchCatalog(w,true);else void fetchFor(w,true);return}
  if(action==='open-expense'){const expenseId=el.dataset.expense;if(!expenseId||!state.data.expenses.some(row=>String(row.id)===expenseId))return;void onOpenExpense({id:expenseId});return}
  if(action==='open-orders'){void onOpenOrders({tab:'orders'});return}
  if(action==='open-prestashop-tab'){const tab=el.dataset.tab;if(['catalog','receipts'].includes(tab))void onOpenOrders({tab});return}
  if(action==='open-order'){const shop=el.dataset.shop,order=el.dataset.order,date=el.dataset.date;if(PRESTA_SHOPS({scope:{store:shop}}).length!==1||!/^\d{1,15}$/.test(order||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return;void onOpenOrders({tab:'orders',store:shop,order,date});return}
  if(action==='prev-page'||action==='next-page'){const w=find(id);if(!w)return;const current=Number(w.filters.page)||0;model=setHomeWidgetConfig(model,id,{filters:{page:Math.max(0,current+(action==='prev-page'?-1:1))}});draw();return}
  if(action==='column-up'||action==='column-down'){const w=find(id),key=el.dataset.column;if(!edit||!w||w.type!=='prestashop.orders'||key==='order')return;const columns=selectedOrderColumns(w).slice(),index=columns.indexOf(key),dest=index+(action==='column-up'?-1:1);if(index<0||dest<1||dest>=columns.length)return;[columns[index],columns[dest]]=[columns[dest],columns[index]];mutate(m=>setHomeWidgetConfig(m,id,{filters:{columns}}));return}
  if(action==='scroll-left'||action==='scroll-right'){const viewport=root.querySelector(`[data-home-orders-viewport="${CSS.escape(id)}"]`);viewport?.scrollBy({left:action==='scroll-left'?-300:300,behavior:'smooth'});return}
  if(action==='save')void save();
 }
 async function load(){
  const own=owner;try{
   const saved=await rpc('totus_home_dashboard',{p_action:'read',p_layout:null,p_expected_revision:null});
   if(!live()||owner!==own)return;
   remoteReady=true;if(saved?.layout?.schemaVersion===1){if(changed()){status('Se ha recibido el diseño guardado mientras editabas. Revisa los cambios antes de guardar.',true);model.revision=saved.revision==null?null:String(saved.revision);return;}model=readHomeDashboard(saved.layout);model.revision=saved.revision==null?null:String(saved.revision);original=structuredClone(model);draw();for(const w of model.widgets)if(w.type.startsWith('prestashop.'))void fetchFor(w);}
  }catch(error){if(live()){const message=String(error?.message||error||'Error no identificado').slice(0,160);status('No se han podido cargar las preferencias: '+message+'. Revisa con Administración el estado del perfil y los permisos. No se ha modificado tu diseño.',true)}}
 }
 async function save(){if(busy||!live()||!model)return;
  if(!changed()){status('No hay cambios del Inicio pendientes de guardar.');return}
  if(!remoteReady){status('No se puede guardar: falta el servicio de preferencias del Inicio.',true);return}
  const own=owner,expected=Number(model.revision||0),snapshot={schemaVersion:1,settings:structuredClone(model.settings),widgets:structuredClone(model.widgets)};
  busy=true;
  try{
   const result=await rpc('totus_home_dashboard',{p_action:'save',p_layout:snapshot,p_expected_revision:expected});
   if(!live()||owner!==own)return;
   if(!Number.isSafeInteger(Number(result?.revision))||Number(result.revision)!==expected+1)throw Error('La respuesta no acredita la revisión esperada.');
   const checked=await rpc('totus_home_dashboard',{p_action:'read',p_layout:null,p_expected_revision:null});
   if(!live()||owner!==own)return;
   const persisted=readHomeDashboard(checked?.layout);
   if(Number(checked.revision)!==Number(result.revision)||JSON.stringify(persisted.widgets)!==JSON.stringify(snapshot.widgets)||JSON.stringify(persisted.settings)!==JSON.stringify(snapshot.settings))throw Error('La relectura no coincide con el diseño guardado.');
   model.revision=String(checked.revision);
   original={...structuredClone(snapshot),revision:model.revision};
   if(JSON.stringify(model.widgets)!==JSON.stringify(snapshot.widgets)||JSON.stringify(model.settings)!==JSON.stringify(snapshot.settings)){
    status('Se verificó el guardado anterior, pero hay cambios nuevos pendientes de guardar.',true);
    return;
   }
   edit=false;selected=null;panelView='closed';draw();status('Tu Inicio se ha guardado y verificado en tu cuenta.');notify('Inicio personalizado guardado.');
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
 async function fetchCatalog(w,force=false){
  if(!w||!can('prestashop','view')||!live())return;
  for(const shop of PRESTA_SHOPS(w)){
   if(!force&&catalogData.has(shop))continue;
   if(catalogQueries.has(shop))continue;
   const owned=owner,epoch=token;
   const task=(async()=>{try{
    const context=await initConnections();
    if(!live()||epoch!==token||owner!==owned)return;
    const connection=storeConnection(context,shop),ready=prestashopReadiness(connection);
    if(!ready.ready)throw Error(ready.reason);
    const rows=[],seen=new Set();let page=0,more=false;
    do{
     const result=await invoke({action:'prestashop_read',store:shop,id:connection.id,revision:connection.revision,call_id:crypto.randomUUID(),resource:'products',page,page_size:100});
     if(!live()||epoch!==token||owner!==owned)return;
     if(!result?.ok||result.store!==shop||result.resource!=='products'||result.page!==page||!Array.isArray(result.rows))throw Error('Respuesta de catálogo ajena o incompleta.');
     for(const row of result.rows){
      const id=String(row.id||'');if(!/^\d{1,15}$/.test(id)||seen.has(id))throw Error('ID de producto inválido o repetido');
      seen.add(id);rows.push(row);
     }
     more=result.possibly_more===true;page++;
    }while(more&&page<20);
    catalogData.set(shop,{rows,issues:catalogIssues(rows),complete:!more,checked:new Date().toLocaleString('es-ES')});
    draw();
   }catch(error){if(live()&&epoch===token&&owner===owned){catalogData.set(shop,{error:String(error.message||error),rows:[],issues:[],complete:false});draw()}}
   })().finally(()=>catalogQueries.delete(shop));
   catalogQueries.set(shop,task);
  }
 }
 async function fetchFor(w,force=false){
  if(w?.type==='prestashop.quality')return fetchCatalog(w,force);
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
    let top=null,detailsByOrder=null,totalUnits=null;
    if(!possiblyMore&&rows.length<=200){
     try{
      const ids=rows.filter(o=>String(o.valid)==='1').map(o=>String(o.id));
      const ranking=new Map(),details=new Map(),lineIds=new Set(),coveredOrders=new Set();let complete=true,totalSoldUnits=0;
      for(let index=0;index<ids.length;index+=25){
       const batch=ids.slice(index,index+25);let detailPage=0,more=false;
       do{
        const detail=await invoke({action:'prestashop_read',store:shop,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),resource:'order_details',page:detailPage,page_size:100,order_ids:batch});
        if(!live()||token!==requestToken||owner!==owned)return;
        if(!detail?.ok||detail.store!==shop||detail.resource!=='order_details'||!Array.isArray(detail.rows)||detail.rows.some(l=>!batch.includes(String(l.id_order))))throw Error('Líneas de un pedido ajeno');
        for(const line of detail.rows){const id=String(line.product_id||''),lid=String(line.id||''),qty=Number(line.product_quantity),attribute=String(line.product_attribute_id??'0');if(!/^\d{1,15}$/.test(id)||!/^\d{1,15}$/.test(lid)||!/^\d{1,15}$/.test(attribute)||lineIds.has(lid)||!Number.isSafeInteger(qty)||qty<=0){complete=false;break}lineIds.add(lid);const orderId=String(line.id_order),name=String(line.product_name||'Producto #'+id),group=id+':'+attribute;coveredOrders.add(orderId);const prev=ranking.get(group)||{name,qty:0,productId:id,attributeId:attribute,reference:String(line.product_reference||'').slice(0,80)};prev.qty+=qty;totalSoldUnits+=qty;ranking.set(group,prev);if(!details.has(orderId))details.set(orderId,[]);details.get(orderId).push({name,qty,attributeId:attribute,reference:String(line.product_reference||'').slice(0,80)})}
        more=detail.possibly_more===true;detailPage++;
       }while(more&&detailPage<20);
       if(more||batch.some(id=>!coveredOrders.has(id))){complete=false;break}
      }
      if(complete){top=[...ranking.values()].filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty).slice(0,12);detailsByOrder=details;totalUnits=totalSoldUnits}
     }catch{top=null}
    }
    ordersData.set(key,{shop,rows,currencies,from,to,complete:!possiblyMore,top,detailsByOrder,totalUnits,checked:new Date().toLocaleString('es-ES')});draw();
   }catch(e){if(!live()||token!==requestToken||owner!==owned)return;ordersData.set(key,{shop,rows:[],currencies:new Map(),from,to,complete:false,error:e.message||String(e)});draw()}
   })().finally(()=>queries.delete(key));queries.set(key,task);
  }
 }
 function mount(target){
  token++;root=target?.querySelector('.dashboard-page');grid=null;connections=null;connectionsTask=null;queries.clear();ordersData.clear();catalogData.clear();catalogQueries.clear();edit=false;selected=null;panelView='closed';styleItems=[];stylesError='';stylesBusy=false;remoteReady=false;owner=state.user?.id;
  if(!root||!owner||!can('inicio','view'))return;
  sources=collectExisting(root);for(const [type,id] of defaultSpecs)if(sources.has(id)&&!sources.has(type))sources.set(type,sources.get(id));const hero=root.querySelector('.dashboard-hero');
  const toolbar=document.createElement('div');toolbar.className='home-dashboard-toolbar';toolbar.innerHTML=`<div><strong>Operativa de hoy · Inicio personalizado</strong><p>Organiza tus indicadores y consultas sin perder las funciones actuales.</p><small data-home-status role="status" aria-live="polite"></small></div><div class="home-toolbar-actions"><button class="btn secondary home-edit-tool" data-home-command="panel-library">＋ Añadir widgets</button><button class="btn secondary home-edit-tool" data-home-command="panel-board">⚙ Diseño general</button><button class="btn secondary home-edit-tool" data-home-command="panel-styles">☆ Estilos compartidos</button><button class="btn primary home-edit-tool" data-home-command="save">Guardar cambios</button><button class="btn secondary home-edit-tool" data-home-command="reset">Restaurar diseño</button><button class="btn primary" data-home-command="edit">Personalizar inicio</button></div>`;
  const shell=document.createElement('div');shell.className='home-widget-shell';grid=document.createElement('div');grid.className='home-widget-grid';const drawer=document.createElement('aside');drawer.className='home-widgets-drawer';drawer.dataset.homeDrawer='';drawer.hidden=true;shell.append(grid,drawer);
  hero?.after(toolbar,shell);if(!hero)root.append(toolbar,shell);
  model=createDefault();original=structuredClone(model);
  // Source nodes are moved, never reimplemented; original data-action handlers stay intact.
  root.addEventListener('click',e=>{if(e.target.closest('.home-editor-advanced>summary'))advancedOpen=!advancedOpen;const el=e.target.closest('[data-home-command]');if(!el||!root.contains(el))return;e.preventDefault();e.stopPropagation();command(el.dataset.homeCommand,el.dataset.id,el)},true);
  root.addEventListener('change',e=>{const el=e.target;if(el.hasAttribute('data-home-category')){root.querySelector('[data-home-drawer]').dataset.category=el.value;renderDrawer();return}if(el.hasAttribute('data-home-switch-widget')){if(!edit||!model.widgets.some(w=>w.id===el.value&&!w.hidden&&permitted(w,can)))return;selected=el.value;panelView='widget';draw();return}if(el.hasAttribute('data-home-general')){const key=el.dataset.homeGeneral;model.settings=homeCanvasSettings({...model.settings,[key]:el.value});draw();status('Diseño general actualizado. Guarda los cambios para conservarlo en tu cuenta.');return}if(el.hasAttribute('data-home-column')){const w=find(el.dataset.id),column=el.dataset.homeColumn;if(!w||w.type!=='prestashop.orders'||!HOME_ORDER_COLUMNS.includes(column)||column==='order')return;const current=selectedOrderColumns(w),next=el.checked?[...current,column]:current.filter(x=>x!==column);if(next.length<2){status('El widget necesita al menos dos columnas visibles.',true);draw();return}mutate(m=>setHomeWidgetConfig(m,w.id,{filters:{columns:next}}));return}if(!el.dataset.homeConfig&&!el.dataset.homeFilter)return;const w=find(el.dataset.id);if(!w)return;
   if(el.dataset.homeFilter){const key=el.dataset.homeFilter;let filters;
    if(key==='store'){
     model=setHomeWidgetConfig(model,w.id,{scope:{store:safeStore(el.value)},filters:{page:0}});
     draw();void fetchFor(find(w.id));status('Tienda de consulta: '+labelStore(safeStore(el.value)));return;
    }
    if(key==='periodDate'||key==='periodMonth'){
     const mode=w.filters.period==='week'?'week':key==='periodMonth'?'month':'day';
     const value=key==='periodMonth'?el.value+'-01':el.value;
     if(!safeDate(value)){status('Fecha no válida',true);return}
     const dates=homePeriodBounds(mode,value);
     model=setHomeWidgetConfig(model,w.id,{filters:{...dates,period:mode,page:0}});draw();
     void fetchFor(find(w.id));status('Periodo de consulta: '+dates.from+' a '+dates.to);return;
    }if(key==='page'){const number=Number(el.value),limit=Number(el.max)||1;if(!Number.isSafeInteger(number)||number<1||number>limit){status('La página solicitada no existe.',true);return}filters={page:number-1}}else filters={[key]:el.value,page:0,...(['from','to'].includes(key)?{period:'custom'}:{})};const next=setHomeWidgetConfig(model,w.id,{filters});if((key==='from'||key==='to')&&dateRange(next.widgets.find(x=>x.id===w.id)).from>dateRange(next.widgets.find(x=>x.id===w.id)).to){status('La fecha final debe ser posterior o igual a la inicial.',true);return}model=next;draw();if(key==='from'||key==='to')void fetchFor(find(w.id));status('Filtros de consulta aplicados.');return}
   const key=el.dataset.homeConfig;
   if(key==='store'){mutate(m=>setHomeWidgetConfig(m,w.id,{scope:{store:safeStore(el.value)},filters:{page:0}}));void fetchFor(find(w.id));}
   if(key==='from'||key==='to'){mutate(m=>setHomeWidgetConfig(m,w.id,{filters:{[key]:el.value,page:0}}));if(dateRange(find(w.id)).from<=dateRange(find(w.id)).to)void fetchFor(find(w.id));}
   if(['chartMode','chartMetric','productView','topLimit','showMetrics','showTop','tableDensity'].includes(key)){const value=key==='topLimit'?Number(el.value):['showMetrics','showTop'].includes(key)?el.value==='yes':el.value;mutate(m=>setHomeWidgetConfig(m,w.id,{filters:{[key]:value}}));return}
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
 return {mount,dispose(){token++;root=null;grid=null;ordersData.clear();queries.clear();catalogData.clear();catalogQueries.clear();connections=null;connectionsTask=null;model=null;owner=null},hasUnsaved:()=>changed()};
}
