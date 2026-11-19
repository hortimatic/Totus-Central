import {esc,csv,download} from '../utils.js';
import {printTpvMarkup} from './documents.js';
const money=(value,currency='EUR')=>new Intl.NumberFormat('es-ES',{style:'currency',currency}).format(value/100);
const recordedMoney=(value,currency)=>Number.isSafeInteger(value)?money(value,currency):'Sin dato';
const date=value=>value?new Date(value).toLocaleString('es-ES'):'—';
const method=key=>({cash:'Efectivo',card:'Tarjeta',bizum:'Bizum',transfer:'Transferencia'}[key]||key);
const paymentMethods=report=>{const keys=new Set([...Object.keys(report.payments||{}),...Object.keys(report.refunds||{})]);return [...['cash','card','bizum','transfer'].filter(key=>keys.has(key)),...[...keys].filter(key=>!['cash','card','bizum','transfer'].includes(key))];};
const state=(value,refund=false)=>({confirmed:refund?'Devuelta':'Cobrado',ready:refund?'Preparada, sin devolver':'Preparado, sin cobrar',dispatched:'Pendiente de verificar',uncertain:'Revisar resultado',cancelled:'Anulado',open:'Abierta',closed:'Cerrada'}[value]||value);
export function centralCashSummaryHtml(report){
 if(!report||report.environment!=='qa'||!['open','closed'].includes(report.status)||!/^[A-Z]{3}$/.test(report.currency||'')||
  !['openingCents','expectedCashCents'].every(key=>Number.isSafeInteger(report[key])))throw Error('El resumen de caja no es válido. Actualiza la consulta.');
 for(const values of [report.payments??{},report.refunds??{}])if(typeof values!=='object'||Array.isArray(values)||
  Object.values(values).some(value=>!Number.isSafeInteger(value)||value<0))throw Error('Los importes de la caja no son válidos. Actualiza la consulta.');
 const methods=paymentMethods(report);
 return '<article class="tpv-central-cash-summary"><header><div class="eyebrow">'+esc(state(report.status))+' · pruebas</div><h3>'+esc(report.drawerName)+'</h3><p>'+esc(report.storeName)+'</p><p class="small muted">Apertura: '+esc(date(report.openedAt))+' · '+esc(report.openedByName)+'</p>'+
  (report.closedAt?'<p class="small muted">Cierre: '+esc(date(report.closedAt))+' · '+esc(report.closedByName)+'</p>':'')+'</header>'+
  '<div class="metric-list"><div class="metric-box"><span>Fondo inicial</span><b>'+esc(money(report.openingCents,report.currency))+'</b></div><div class="metric-box"><span>Efectivo esperado</span><b>'+esc(money(report.expectedCashCents,report.currency))+'</b></div>'+
  (report.status==='closed'?'<div class="metric-box"><span>Efectivo contado</span><b>'+esc(recordedMoney(report.countedCents,report.currency))+'</b></div><div class="metric-box"><span>Diferencia</span><b class="'+(!Number.isSafeInteger(report.differenceCents)?'':report.differenceCents?'danger-text':'good-text')+'">'+esc(recordedMoney(report.differenceCents,report.currency))+'</b></div>':'')+
  (Number.isSafeInteger(report.cashInCents)&&Number.isSafeInteger(report.cashOutCents)?'<div class="metric-box"><span>Entradas extra de efectivo</span><b>'+esc(money(report.cashInCents,report.currency))+'</b></div><div class="metric-box"><span>Retiradas de efectivo</span><b>'+esc(money(report.cashOutCents,report.currency))+'</b></div>':'')+'</div>'+
  '<div class="table-wrap"><table><thead><tr><th>Medio de pago</th><th>Cobros</th><th>Devuelto</th><th>Neto</th></tr></thead><tbody>'+methods.map(key=>'<tr><td>'+esc(method(key))+'</td><td>'+esc(money(report.payments?.[key]||0,report.currency))+'</td><td>'+esc(money(report.refunds?.[key]||0,report.currency))+'</td><td>'+esc(money((report.payments?.[key]||0)-(report.refunds?.[key]||0),report.currency))+'</td></tr>').join('')+'</tbody></table></div>'+
  '<p class="small">'+esc(report.orderCount)+' ventas confirmadas · '+esc(report.refundCount)+' devoluciones confirmadas · '+esc(report.movementCount)+' movimientos de efectivo.</p>'+
  (report.reservedCashCents?'<p class="note">Hay '+esc(money(report.reservedCashCents,report.currency))+' reservados para devoluciones pendientes.</p>':'')+
  (report.unresolvedSales||report.pendingRefunds?'<p class="note warn">Hay '+esc(report.unresolvedSales||0)+' cobros y '+esc(report.pendingRefunds||0)+' devoluciones pendientes de revisar en el TPV.</p>':'')+
  (report.note?'<p class="note">'+esc(report.note)+'</p>':'')+'</article>';
}

export function centralCashPrintHtml(report){
 centralCashSummaryHtml(report);
 const rows=[['Fondo inicial',recordedMoney(report.openingCents,report.currency)],['Efectivo esperado',recordedMoney(report.expectedCashCents,report.currency)],
  ...(report.status==='closed'?[['Efectivo contado',recordedMoney(report.countedCents,report.currency)],['Diferencia',recordedMoney(report.differenceCents,report.currency)]]:[])];
 if(Number.isSafeInteger(report.cashInCents))rows.push(['Entradas extra',money(report.cashInCents,report.currency)]);
 if(Number.isSafeInteger(report.cashOutCents))rows.push(['Retiradas',money(report.cashOutCents,report.currency)]);
 for(const key of paymentMethods(report)){rows.push([method(key)+' · cobros',money(report.payments?.[key]||0,report.currency)],
  [method(key)+' · devoluciones',money(report.refunds?.[key]||0,report.currency)]);}
 return '<h3>Resumen de caja · pruebas</h3><p><b>'+esc(report.storeName)+' · '+esc(report.drawerName)+'</b></p><p>'+esc(state(report.status))+'<br>Apertura: '+esc(date(report.openedAt))+' · '+esc(report.openedByName)+
  (report.closedAt?'<br>Cierre: '+esc(date(report.closedAt))+' · '+esc(report.closedByName):'')+'</p><dl>'+rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>'+
  '<p>'+esc(report.orderCount)+' ventas confirmadas · '+esc(report.refundCount)+' devoluciones confirmadas · '+esc(report.movementCount)+' movimientos de efectivo.</p>'+
  (report.unresolvedSales||report.pendingRefunds?'<p><b>Pendiente de revisar en el TPV:</b> '+esc(report.unresolvedSales||0)+' cobros y '+esc(report.pendingRefunds||0)+' devoluciones.</p>':'')+
  (report.note?'<p>'+esc(report.note)+'</p>':'')+'<p>Pruebas: importes excluidos de los cierres fiscales del negocio.</p>';
}

/** Central Cajas reads the same session/payment/refund journals as the TPV.
 * No order, closing, cash movement or fiscal document write exists here. */
export function createCentralCashUI({actor,client,canExport=()=>false,canBilling=()=>false,onBilling=null}){
 let root=null,owner=null,generation=0,call=null,sources=[],source=null,busy=false,message='',report=null,pane='sales',detailSearch='';
 let filters={drawer:'',status:'all',from:'',to:'',search:''},page={items:[],hasMore:false,cursor:null},previous=[],detailPage={items:[],hasMore:false,cursor:null},detailPrevious=[];
 const valid=stamp=>root?.isConnected&&owner===actor()&&stamp===generation;
 const selection=()=>({connectionId:source.connectionId,connectionRevision:source.connectionRevision,shopId:source.shopId,storeId:source.storeId,...(filters.drawer?{drawerId:filters.drawer}:{})});
 const listQuery=()=>({status:filters.status,search:filters.search,...(filters.from?{from:filters.from}:{}),...(filters.to?{to:filters.to}:{})});
 async function read(stamp,section,query={},sessionId=null){
  if(!valid(stamp))throw Error('La vista ha cambiado.');const invoke=call,picked={...selection(),...(sessionId?{sessionId}:{})};
  const value=await invoke({action:'central-cash-read',selection:picked,section,query});if(!valid(stamp))throw Error('La vista ha cambiado.');
  if(section!=='session'&&(!Array.isArray(value?.items)||value.items.length>(query.limit||20)||typeof value.hasMore!=='boolean'||
   value.hasMore&&(!value.cursor||typeof value.cursor.id!=='string'||typeof value.cursor.recordedAt!=='string')))
   throw Error('La consulta no está completa. Actualiza antes de continuar.');return value;
 }
 async function load(stamp,cursor=null){page=await read(stamp,'sessions',{...listQuery(),limit:20,...(cursor?{cursor}:{})});}
 async function loadDetails(stamp,cursor=null){detailPage=await read(stamp,pane,{search:detailSearch,limit:20,...(cursor?{cursor}:{})},report.sessionId);}
 async function open(stamp,id){const value=await read(stamp,'session',{},id);
  if(value?.sessionId!==id||value.currency!==source.currency)throw Error('El resumen no corresponde a la sesión seleccionada.');
  centralCashSummaryHtml(value);report=value;pane='sales';detailSearch='';detailPrevious=[];detailPage={items:[],hasMore:false,cursor:null};await loadDetails(stamp);}
 async function run(work){if(busy||!valid(generation))return;const stamp=generation;busy=true;message='';render();
  try{await work(stamp);}catch(error){if(valid(stamp))message=error.message||'No se ha podido consultar la caja.';}
  finally{if(valid(stamp)){busy=false;render();}}
 }
 function controls(){return '<form data-central-cash-filter><fieldset class="tpv-central-cash-filters" '+(busy?'disabled':'')+'><label>Establecimiento<select data-central-cash-source data-draft-ignore '+(busy?'disabled':'')+'>'+sources.map((row,index)=>'<option value="'+index+'" '+(row===source?'selected':'')+'>'+esc(row.storeName)+(row.storeActive===false?' · inactivo':'')+'</option>').join('')+'</select></label>'+
  '<label>Caja<select name="drawer" data-draft-ignore><option value="">Todas las cajas</option>'+(source?.drawers||[]).map(row=>'<option value="'+esc(row.id)+'" '+(row.id===filters.drawer?'selected':'')+'>'+esc(row.name)+(row.active?'':' · inactiva')+'</option>').join('')+'</select></label>'+
  '<label>Estado<select name="status" data-draft-ignore>'+[['all','Todas'],['open','Abiertas'],['closed','Cerradas']].map(([value,label])=>'<option value="'+value+'" '+(filters.status===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
  '<label>Apertura desde<input type="date" name="from" value="'+esc(filters.from)+'" data-draft-ignore></label><label>Hasta<input type="date" name="to" value="'+esc(filters.to)+'" data-draft-ignore></label>'+
  '<label>Buscar<input name="search" value="'+esc(filters.search)+'" maxlength="100" placeholder="Caja o empleado" data-draft-ignore></label><button class="btn primary" '+(busy||!source?'disabled':'')+'>Aplicar filtros</button><button type="button" class="btn secondary" data-central-cash-reset '+(busy?'disabled':'')+'>Limpiar</button></fieldset></form>';}
 function pages(detail=false){const view=detail?detailPage:page,history=detail?detailPrevious:previous;return '<div class="pagination"><button class="btn secondary" type="button" data-central-cash-prev '+(busy||!history.length?'disabled':'')+'>Anterior</button><span>Página '+(history.length+1)+'</span><button class="btn secondary" type="button" data-central-cash-next '+(busy||!view.hasMore?'disabled':'')+'>Siguiente</button></div>';}
 function sessionsHtml(){return controls()+(page.items.length?'<div class="tpv-central-cash-cards">'+page.items.map(row=>'<article class="tpv-central-cash-session"><div><span class="badge '+(row.status==='closed'?'good':'info')+'">'+esc(state(row.status))+'</span><h3>'+esc(row.drawerName)+'</h3><p class="small muted">'+esc(date(row.openedAt))+' · '+esc(row.openedByName)+'</p></div><div class="tpv-central-cash-balance"><span>Efectivo esperado</span><strong>'+esc(money(row.expectedCashCents,row.currency))+'</strong>'+
  (row.status==='closed'?'<span>Diferencia: '+esc(recordedMoney(row.differenceCents,row.currency))+'</span>':'')+'</div><button type="button" class="btn primary" data-central-cash-open="'+esc(row.sessionId)+'" '+(busy?'disabled':'')+'>Consultar sesión</button></article>').join('')+'</div>'+pages():busy?'':'<div class="empty"><h3>No hay sesiones para esta consulta</h3><p>Revisa la caja y las fechas de apertura seleccionadas.</p></div>');}
 function detailsHtml(){
  const columns=pane==='movements'?['Movimiento','Importe','Motivo','Empleado']:['Pedido','Estado','Importe','Empleado',''];
  return '<div class="inline-actions"><button class="btn secondary" type="button" data-central-cash-back '+(busy?'disabled':'')+'>← Volver a las sesiones</button><button class="btn secondary" type="button" data-central-cash-print '+(busy?'disabled':'')+'>Imprimir resumen</button></div>'+centralCashSummaryHtml(report)+
   '<div class="tabs" aria-label="Detalle de la sesión">'+[['sales','Ventas'],['refunds','Devoluciones'],['movements','Movimientos de efectivo']].map(([value,label])=>'<button class="tab '+(pane===value?'active':'')+'" type="button" data-central-cash-pane="'+value+'" '+(busy?'disabled':'')+'>'+label+'</button>').join('')+'</div>'+
   '<form data-central-cash-detail-search class="filters"><label class="field">'+(pane==='movements'?'Buscar motivo':'Buscar número de pedido')+'<input name="detailSearch" value="'+esc(detailSearch)+'" maxlength="100" data-draft-ignore '+(busy?'disabled':'')+'></label><button class="btn secondary" '+(busy?'disabled':'')+'>Buscar</button></form>'+
   (detailSearch?'<p class="small muted">El filtro del detalle no modifica los totales de la sesión.</p>':'')+
   (canExport()?'<button type="button" class="btn secondary" data-central-cash-export '+(busy?'disabled':'')+'>Exportar '+(pane==='sales'?'ventas':pane==='refunds'?'devoluciones':'movimientos')+'</button>':'')+
   '<div class="table-wrap"><table><thead><tr>'+columns.map(value=>'<th>'+value+'</th>').join('')+'</tr></thead><tbody>'+detailPage.items.map(row=>pane==='movements'?'<tr><td>'+esc(row.kind==='cash-in'?'Entrada':'Retirada')+'<div class="small muted">'+esc(date(row.recordedAt))+'</div></td><td>'+esc(money(row.amountCents,report.currency))+'</td><td>'+esc(row.reason)+'</td><td>'+esc(row.actorName)+'</td></tr>':
    '<tr><td>'+(row.orderId?'#'+esc(row.orderId):'Sin pedido confirmado')+'<div class="small muted">'+esc(date(row.recordedAt))+'</div></td><td>'+esc(state(row.status,pane==='refunds'))+'</td><td>'+esc(money(row.totalCents,report.currency))+'</td><td>'+esc(row.actorName)+'</td><td>'+(row.status==='confirmed'&&row.orderId&&onBilling&&canBilling()?'<button type="button" class="btn secondary" data-central-cash-billing="'+esc(row.saleId)+'" '+(busy?'disabled':'')+'>Ver factura</button>':'')+'</td></tr>').join('')+'</tbody></table></div>'+
   (!detailPage.items.length?'<p class="empty">Sin registros en esta sección.</p>':'')+(pane!=='movements'?'<p class="small muted">Las operaciones sin confirmar no se suman a los cobros o devoluciones registrados.</p>':'')+pages(true);
 }
 function render(){if(!valid(generation))return;root.innerHTML='<section class="card tpv-central-cash"><header class="section-head card-pad"><div><h2>Sesiones del TPV</h2><p>El dinero y los movimientos de cada caja, registrados al operar con TotusTPV.</p></div><span class="badge info">Pruebas</span></header><div class="card-pad"><p class="note">Estas sesiones pertenecen al entorno de pruebas. Sus importes quedan fuera de los cierres fiscales del negocio.</p><p role="status" aria-live="polite">'+esc(message||(busy?'Consultando las cajas…':''))+'</p>'+
  (source?(report?detailsHtml():sessionsHtml()):busy?'':'<div class="empty"><h3>No hay establecimientos preparados</h3><p>El responsable debe preparar la conexión del TPV para consultar sus sesiones.</p></div>')+'</div></section>';}
 async function exportRows(stamp){
  if(!canExport())throw Error('Necesitas permiso de exportación de Cajas.');const rows=[],seen=new Set();let cursor=null;
  do{const value=await read(stamp,pane,{search:detailSearch,limit:50,...(cursor?{cursor}:{})},report.sessionId);rows.push(...value.items);cursor=value.hasMore?value.cursor:null;
   if(cursor){const key=JSON.stringify(cursor);if(seen.has(key))throw Error('La consulta ha cambiado. Actualiza antes de exportar.');seen.add(key);}
  }while(cursor);
  if(!valid(stamp)||!canExport())return;const currency=report.currency;
  const headers=pane==='movements'?[{label:'Fecha',get:r=>r.recordedAt},{label:'Movimiento',get:r=>r.kind==='cash-in'?'Entrada':'Retirada'},{label:'Importe',get:r=>r.amountCents/100},{label:'Efecto en efectivo',get:r=>(r.kind==='cash-in'?r.amountCents:-r.amountCents)/100},{label:'Motivo',get:r=>r.reason},{label:'Empleado',get:r=>r.actorName}]:
   [{label:'Fecha',get:r=>r.recordedAt},{label:'Pedido',get:r=>r.orderId||''},{label:'Estado',get:r=>state(r.status,pane==='refunds')},{label:'Importe de la operación',get:r=>r.totalCents/100},{label:'Importe confirmado',get:r=>r.status==='confirmed'?r.totalCents/100:0},{label:'Empleado',get:r=>r.actorName}];
  const context=[{label:'Establecimiento',get:()=>report.storeName},{label:'Caja',get:()=>report.drawerName},{label:'Apertura de sesión',get:()=>report.openedAt}];
  download(new Blob(['\ufeff'+csv(rows,[...context,...headers,{label:'Moneda',get:()=>currency}],{decimalComma:true})],{type:'text/csv;charset=utf-8'}),'TPV-'+pane+'-pruebas.csv');message='Exportados '+rows.length+' registros de esta sesión.';
 }
 async function mount(target,initial=null){
  dispose();root=target;if(!root)return;owner=actor();call=client(owner);const stamp=generation;
  root.onsubmit=event=>{
   if(event.target.matches('[data-central-cash-detail-search]')){event.preventDefault();const value=new FormData(event.target).get('detailSearch')?.trim()||'';
    void run(async token=>{detailSearch=value;detailPrevious=[];detailPage={items:[],hasMore:false,cursor:null};await loadDetails(token);});return;}
   if(!event.target.matches('[data-central-cash-filter]'))return;event.preventDefault();const values=Object.fromEntries(new FormData(event.target));void run(async token=>{filters={...filters,...values};previous=[];page={items:[],hasMore:false,cursor:null};await load(token);});};
  root.onchange=event=>{if(event.target.matches('[data-central-cash-source]')){const value=sources[Number(event.target.value)];if(!value)return;void run(async token=>{source=value;filters={drawer:'',status:'all',from:'',to:'',search:''};page={items:[],hasMore:false,cursor:null};previous=[];await load(token);});}};
  root.onclick=event=>{const button=event.target.closest('button');if(!button||busy)return;
   if(button.dataset.centralCashOpen)void run(token=>open(token,button.dataset.centralCashOpen));
   if(button.hasAttribute('data-central-cash-back')){report=null;detailPage={items:[],hasMore:false,cursor:null};render();}
   if(button.hasAttribute('data-central-cash-reset'))void run(async token=>{filters={drawer:'',status:'all',from:'',to:'',search:''};previous=[];page={items:[],hasMore:false,cursor:null};await load(token);});
   if(button.dataset.centralCashPane)void run(async token=>{pane=button.dataset.centralCashPane;detailSearch='';detailPrevious=[];detailPage={items:[],hasMore:false,cursor:null};await loadDetails(token);});
   if(button.hasAttribute('data-central-cash-next')){const cursor=(report?detailPage:page).cursor;if(cursor)void run(async token=>{if(report){await loadDetails(token,cursor);detailPrevious.push(cursor);}else{await load(token,cursor);previous.push(cursor);}});}
   if(button.hasAttribute('data-central-cash-prev')){const history=report?detailPrevious:previous,cursor=history.length>1?history[history.length-2]:null;if(history.length)void run(async token=>{if(report){await loadDetails(token,cursor);detailPrevious.pop();}else{await load(token,cursor);previous.pop();}});}
   if(button.hasAttribute('data-central-cash-print')&&report){const token=generation;printTpvMarkup(centralCashPrintHtml(report),'TotusTPV · resumen de caja',{current:()=>valid(token)});}
   if(button.hasAttribute('data-central-cash-export')&&report)void run(exportRows);
   if(button.dataset.centralCashBilling&&onBilling&&canBilling())void run(()=>onBilling({saleId:button.dataset.centralCashBilling,connectionId:source.connectionId,shopId:source.shopId}));
  };
  busy=true;render();try{const ctx=await call({action:'central-cash-context'});if(!valid(stamp))return;sources=ctx.sources;
   source=initial?sources.find(row=>row.connectionId===initial.connectionId&&row.shopId===initial.shopId)??null:sources[0]??null;
   if(initial&&!source)throw Error('El establecimiento de esta sesión no está disponible para tu cuenta.');
   if(source){await load(stamp);if(initial?.sessionId&&valid(stamp))await open(stamp,initial.sessionId);}
  }catch(error){if(valid(stamp))message=error.message;}finally{if(valid(stamp)){busy=false;render();}}
 }
 function dispose(){generation++;if(root)root.onclick=root.onsubmit=root.onchange=null;root=null;owner=null;call=null;sources=[];source=null;busy=false;message='';report=null;pane='sales';detailSearch='';filters={drawer:'',status:'all',from:'',to:'',search:''};page={items:[],hasMore:false,cursor:null};previous=[];detailPage={items:[],hasMore:false,cursor:null};detailPrevious=[];}
 return {mount,dispose};
}
