// Static, local-only visual laboratory. Every row, action and document is fictitious.
const rows={
 inicio:[['Ventas de ejemplo','1.245,80 €','Completado'],['Pedidos ficticios','18','Pendiente'],['Cierre simulado','Caja Vape','Revisado']],
 cajas:[['Apertura · Vape','150,00 €','Abierta'],['Cierre · Head','245,20 €','Revisado'],['Retirada simulada','40,00 €','Pendiente']],
 gastos:[['Alquiler · ejemplo','720,00 €','Justificado'],['Suministros ficticios','85,40 €','Pendiente'],['Factura simulada','38,90 €','Revisado']],
 facturacion:[['Factura de muestra','235,00 €','Emitida'],['Borrador de ejemplo','125,00 €','Pendiente'],['Rectificativa ficticia','35,00 €','Revisado']],
 productos:[['Producto de muestra A','12,50 €','Activo'],['Producto de muestra B','8,90 €','Sin stock'],['Variante simulada','15,00 €','Revisado']],
 tareas:[['Revisar documentos','Hoy','Pendiente'],['Cotejar proveedor','Mañana','En curso'],['Revisar precios','Semana','Completado']],
 informes:[['Ventas · muestra','12.450,00 €','Revisado'],['Gastos · muestra','3.245,00 €','Pendiente'],['Resultado ficticio','9.205,00 €','Calculado']],
 configuracion:[['Interfaz personal','Mi cuenta','Activo'],['Navegación','Mi cuenta','Revisado'],['Login','Compartido','Sin cambios']]
};
const moduleNames={inicio:'Inicio',cajas:'Cajas',gastos:'Gastos',facturacion:'Facturación',productos:'Productos',tareas:'Tareas',informes:'Informes',configuracion:'Configuración'};
export const APPEARANCE_PREVIEW_MODULES=Object.entries(moduleNames);
export const APPEARANCE_PREVIEW_TABS=[['resumen','Resumen'],['detalle','Formulario'],['documentos','Documentos']];
const safe=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function table(module){
 return '<div class="table-wrap appearance-demo-table"><table class="data-table"><thead><tr><th>Concepto</th><th>Importe / dato</th><th>Estado</th></tr></thead><tbody>'+
 rows[module].map(([title,amount,status],i)=>'<tr data-demo-table-row="'+i+'"><td>'+safe(title)+'</td><td>'+safe(amount)+'</td><td>'+safe(status)+'</td></tr>').join('')+'</tbody></table></div>';
}
function overview(module){
 const entries=rows[module];
 return '<div class="appearance-demo-cards">'+entries.slice(0,2).map(([name,value])=>'<div class="card card-pad"><small class="muted">'+safe(name)+' · muestra</small><strong>'+safe(value)+'</strong><small>Dato ficticio</small></div>').join('')+'</div>'+
 '<div class="card card-pad appearance-demo-content-card"><h4>'+moduleNames[module]+' · Área de trabajo</h4><p class="muted">Comprueba títulos, textos, tarjetas y botones.</p><div class="appearance-demo-actions"><button class="btn primary" type="button" data-demo-open-dialog>Crear · simulación</button><button class="btn secondary" type="button" data-demo-filter>Filtrar datos ficticios</button></div></div>'+table(module);
}
function detail(module){
 return '<div class="card card-pad appearance-demo-content-card"><h4>Ficha de ejemplo · '+moduleNames[module]+'</h4><p class="muted">Comprueba el aspecto de un formulario sin editar registros.</p><div class="appearance-demo-fields"><label>Nombre<input readonly value="Registro simulado"></label><label>Estado<select disabled><option>En revisión</option></select></label><label>Importe<input readonly value="125,00 €"></label><label>Fecha<input readonly value="11/11/2026"></label></div><div class="appearance-demo-actions"><button class="btn primary" type="button" data-demo-open-dialog>Abrir ventana</button><button class="btn secondary" type="button" data-demo-filter>Alternar filtro</button></div></div>'+table(module);
}
function documents(module){
 return '<div class="card card-pad appearance-demo-content-card"><h4>Documentos · '+moduleNames[module]+'</h4><p class="muted">Lista ilustrativa; no se consultan documentos reales.</p><div class="appearance-demo-document"><span>▤ Documento ficticio.pdf</span><span>PDF · ejemplo</span></div><div class="appearance-demo-document"><span>▤ Informe de muestra.pdf</span><span>Simulación</span></div><div class="note">Aviso informativo: no hay adjuntos reales.</div></div>';
}
export function renderAppearancePreview(){
 return '<div class="appearance-demo"><aside><div class="appearance-demo-brand"><img data-brand-logo alt="" width="38" height="38"><div><b data-brand-name></b><small data-brand-subtitle></small></div></div><small class="appearance-demo-section">MÓDULOS DE MUESTRA</small>'+
 APPEARANCE_PREVIEW_MODULES.map(([id,label])=>'<button type="button" class="appearance-demo-nav" data-demo-module="'+id+'" aria-pressed="false">'+safe(label)+'</button>').join('')+'</aside>'+
 '<div class="appearance-demo-main"><header><span data-demo-heading></span><span class="appearance-demo-user">Cuenta simulada · Vista de ejemplo</span></header><section>'+
 '<nav class="appearance-demo-tabs" aria-label="Tipos de pantalla de ejemplo">'+APPEARANCE_PREVIEW_TABS.map(([id,label])=>'<button class="appearance-demo-tab" type="button" data-demo-tab="'+id+'" aria-pressed="false">'+label+'</button>').join('')+'</nav>'+
 APPEARANCE_PREVIEW_MODULES.map(([id])=>'<div class="appearance-demo-content" data-demo-view="'+id+'" hidden>'+
 '<div data-demo-panel="resumen">'+overview(id)+'</div><div data-demo-panel="detalle" hidden>'+detail(id)+'</div><div data-demo-panel="documentos" hidden>'+documents(id)+'</div></div>').join('')+
 '<div class="appearance-demo-samples"><div class="filters">Filtros · fondo configurable</div><div class="note">Aviso de información · texto y fondo propios</div><div class="appearance-demo-modal-sample">Ventana · color de superficie</div></div>'+
 '</section></div><div class="appearance-demo-dialog" data-demo-dialog hidden role="dialog" aria-modal="false" aria-label="Ventana simulada"><div class="appearance-demo-dialog-content"><h4>Ventana de ejemplo</h4><p>Esta ventana no guarda ni crea ningún registro.</p><div class="appearance-demo-fields"><label>Descripción<input value="Documento ficticio" readonly></label></div><button class="btn secondary" type="button" data-demo-close-dialog>Cerrar simulación</button></div></div></div>';
}
export function updateAppearancePreview(pane,{module='inicio',tab='resumen'}={}){
 if(!rows[module])module='inicio';
 if(!APPEARANCE_PREVIEW_TABS.some(([id])=>id===tab))tab='resumen';
 pane.querySelector('[data-demo-heading]').textContent=moduleNames[module];
 pane.querySelectorAll('[data-demo-module]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.demoModule===module)));
 pane.querySelectorAll('[data-demo-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.demoTab===tab)));
 pane.querySelectorAll('[data-demo-view]').forEach(view=>{
  view.hidden=view.dataset.demoView!==module;
  view.querySelectorAll('[data-demo-panel]').forEach(panel=>panel.hidden=panel.dataset.demoPanel!==tab);
 });
}
