import {printTpvMarkup} from './documents.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
const date=value=>value?new Date(value).toLocaleString('es-ES'):'—';
const label=method=>({cash:'Efectivo',card:'Tarjeta',bizum:'Bizum',transfer:'Transferencia'}[method]||method);
export function cashReportHtml(report){
 if(!report||report.currency!=='EUR'||report.environment!=='qa'||!['open','closed'].includes(report.status)||
  !Number.isSafeInteger(report.expectedCashCents))throw Error('Informe de caja no válido.');
 const methods=[...new Set([...Object.keys(report.payments||{}),...Object.keys(report.refunds||{})])];
 return `<article class="tpv-cash-report"><h4>${report.status==='closed'?'Cierre de caja':'Informe de caja abierta'}</h4>
  <p><strong>${esc(report.storeName)} · ${esc(report.drawerName)}</strong><br>Apertura: ${esc(date(report.openedAt))} · ${esc(report.openedByName)}<br>Cierre: ${esc(date(report.closedAt))}${report.closedAt?' · '+esc(report.closedByName):''}</p>
  <small>Preproducción · ${esc(report.sessionId)}<br>Consultado: ${esc(date(report.generatedAt))}</small><dl>
   <div><dt>Fondo inicial</dt><dd>${money(report.openingCents)}</dd></div>
   ${methods.map(method=>`<div><dt>${esc(label(method))} · cobros / reintegros</dt><dd>${money(report.payments?.[method]||0)} / ${money(report.refunds?.[method]||0)}</dd></div>`).join('')}
   <div><dt>Pedidos / devoluciones</dt><dd>${report.orderCount} / ${report.refundCount}</dd></div>
   <div><dt>Efectivo esperado</dt><dd>${money(report.expectedCashCents)}</dd></div>
   ${report.status==='closed'?`<div><dt>Efectivo contado</dt><dd>${money(report.countedCents)}</dd></div><div><dt>Diferencia</dt><dd>${money(report.differenceCents)}</dd></div>`:''}</dl>
  ${report.note?`<p>Observaciones: ${esc(report.note)}</p>`:''}
  ${report.unresolvedSales||report.pendingRefunds?'<p>Hay operaciones pendientes de recuperar. Este informe no es un cierre definitivo.</p>':''}
  <h4>Movimientos de efectivo</h4>${(report.movements||[]).map(row=>`<p><strong>${row.kind==='cash-in'?'Entrada':'Retirada'} · ${money(row.amountCents)}</strong><br>${esc(row.reason)}<small>${esc(date(row.recordedAt))}</small></p>`).join('')||'<p>Sin movimientos de efectivo.</p>'}
  ${report.movementCount>(report.movements?.length||0)?'<p>Se muestran los últimos 200 movimientos. El resumen incluye todos.</p>':''}</article>`;
}
export function createCashReportsPanel({adapter,capturePrintContext=()=>()=>true}){
 let visible=false,rows=[],report=null;
 const reset=()=>{visible=false;rows=[];report=null;};
 async function select(id){const data=await adapter().cashReports({sessionId:id});if(data.length!==1)throw Error('No se encuentra este informe en el establecimiento seleccionado.');report=data[0];}
 return {reset,isOpen:()=>visible,
  async open(){visible=true;rows=await adapter().cashReports();report=null;if(rows.length)await select(rows[0].sessionId);},
  html(){if(!visible)return '';return `<section class="card card-pad tpv-cash-reports" aria-label="Informes de caja"><header class="inline-actions"><h3>Informes de caja · últimas 30 sesiones</h3><button type="button" class="btn secondary" data-tpv-report-action="close">Cerrar informes</button></header>
   ${rows.length?`<label>Sesión de caja<select data-tpv-report-id>${rows.map(row=>`<option value="${esc(row.sessionId)}" ${row.sessionId===report?.sessionId?'selected':''}>${esc(date(row.openedAt))} · ${esc(row.drawerName)} · ${row.status==='closed'?'cerrada':'abierta'}</option>`).join('')}</select></label>`:'<p>Todavía no hay sesiones de caja en este establecimiento.</p>'}
   ${report?cashReportHtml(report)+'<div class="inline-actions"><button type="button" class="btn secondary" data-tpv-report-action="print">Imprimir informe</button></div>':''}</section>`;},
  async change(target){if(!target.hasAttribute('data-tpv-report-id'))return false;await select(target.value);return true;},
  click(target){if(!target.dataset.tpvReportAction)return false;
   if(target.dataset.tpvReportAction==='close')reset();else if(target.dataset.tpvReportAction==='print'&&report)printTpvMarkup(cashReportHtml(report),'TotusTPV · informe de caja',{current:capturePrintContext()});return true;}
 };
}
