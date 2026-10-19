import {captureFormDraft} from './form-drafts.js';
import {esc,fmtDate,money,statusClass} from './utils.js';

// Contextual help follows the viewport. A MutationObserver runs at the
// open-attribute microtask, avoiding the delayed native <details> toggle event.
function positionOpenHelp(el){
 if(!el?.matches?.('details.field-help'))return;
 el.classList.remove('flip-up','align-right');
 if(!el.open||window.innerWidth<=700)return;
 const popup=el.querySelector('[role="note"]'),trigger=el.querySelector('summary');
 if(!popup||!trigger)return;
 const note=popup.getBoundingClientRect(),anchor=trigger.getBoundingClientRect();
 if(note.bottom>window.innerHeight-8&&anchor.top>=note.height+32)el.classList.add('flip-up');
 if(popup.getBoundingClientRect().right>window.innerWidth-8)el.classList.add('align-right');
}
if(typeof document!=='undefined'){
 const helpObserver=new MutationObserver(changes=>{
  for(const change of changes)
   if(change.type==='attributes'&&change.attributeName==='open')positionOpenHelp(change.target);
 });
 helpObserver.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('toggle',event=>positionOpenHelp(event.target),true);
}

export function setHeader(eyebrow,title,actions=''){
 document.getElementById('pageEyebrow').textContent=eyebrow||'';
 document.getElementById('pageTitle').textContent=title||'';
 document.getElementById('topActions').innerHTML=actions||'';
}
export const btn=(label,action,kind='secondary',attrs='')=>`<button class="btn ${kind}" data-action="${esc(action)}" ${attrs}>${esc(label)}</button>`;
export const badge=(text,kind='info')=>`<span class="badge ${kind}">${esc(text)}</span>`;
export const dateFilters=({from,to,store='all',stores=[],query=''},prefix='filter',extraFields='')=>`
 <div class="filters" data-filter-prefix="${prefix}">
  <div class="field"><label for="${prefix}From">Desde</label><input type="date" id="${prefix}From" value="${esc(from)}"></div>
  <div class="field"><label for="${prefix}To">Hasta</label><input type="date" id="${prefix}To" value="${esc(to)}"></div>
  <div class="field"><label for="${prefix}Store">Tienda</label><select id="${prefix}Store"><option value="all">Todas</option>${stores.map(s=>`<option value="${s.id}" ${store===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
  <div class="field search" ${prefix==='fiscal'?'hidden':''}><label for="${prefix}Query">Buscar</label><input id="${prefix}Query" value="${esc(query||'')}" placeholder="Buscar por texto"></div>
  ${extraFields}
  ${btn('Aplicar',prefix+'-apply','primary')}
  ${btn('Este mes',prefix+'-month','secondary')}
   ${btn('Limpiar',prefix+'-clear','secondary')}
  <div class="date-selected-hint" role="status" aria-live="polite">Periodo aplicado: <strong>${esc(fmtDate(from))}</strong> a <strong>${esc(fmtDate(to))}</strong> · Formato español DD/MM/AAAA</div>
 </div>`;
export const empty=(title='Sin datos',text='Todavía no hay registros.')=>`<div class="empty"><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
export const kpi=(label,value,sub='')=>`<div class="kpi"><span>${esc(label)}</span><strong>${value}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
export const table=(headers,rows,{emptyTitle='Sin datos',emptyText='Todavía no hay registros.'}={})=>{
 if(!rows.length)return empty(emptyTitle,emptyText);
 return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th class="${h.num?'num':''}">${esc(h.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td class="${h.num?'num':''}">${h.html?h.html(r):esc(h.get?r[h.get]:h.value?.(r)??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
};
const FIELD_HELP={
 'Apertura efectivo':'Importe en metálico recibido de la caja anterior. Comprueba el cierre previo.',
 'Efectivo final':'Dinero contado físicamente al finalizar la jornada.',
 'Tarjeta':'Cobros por terminal bancario, sin sumar efectivo.',
 'Bizum':'Cobros recibidos mediante Bizum.',
 'Pedidos online':'Ingresos de pedidos online imputados a este cierre.',
 'Salidas de efectivo':'Retiradas de metálico de la caja.',
 'Gastos pagados en caja':'Pagos realizados con el efectivo de la caja.',
 'Base':'Importe antes de impuestos y retenciones.',
 'IVA (%)':'Porcentaje de IVA aplicable a esta línea.',
 'Recargo (%)':'Recargo de equivalencia de esta línea, cuando corresponda.',
 'Retención (%)':'Porcentaje retenido cuando el documento esté sujeto a IRPF.',
 '% deducible':'Porcentaje del gasto que se admite para el cálculo de deducibilidad.',
 'Fecha de pago':'Fecha efectiva del pago, no necesariamente la de factura.',
 'Importe pagado':'Cantidad abonada hasta la fecha. Un pago parcial no equivale al total de factura.',
 'Nº factura / justificante':'Número exacto del documento del proveedor, usado para detectar duplicados.',
 'Proveedor':'Emisor del gasto o documento.',
 'Estado de pago':'Indica si está pendiente, pagado o abonado parcialmente.',
 'Forma de pago':'Método empleado para efectuar el pago.',
 'Fecha emisión':'Fecha que figura en la factura o documento.',
 'Fecha vencimiento':'Fecha límite acordada para realizar el pago.',
 'Recargo equivalencia compra (%)':'Porcentaje de recargo de equivalencia aplicable en compras de la actividad.'
};
Object.assign(FIELD_HELP,{
 "Tienda":"Establecimiento al que pertenece este registro; se usa para separar cierres, gastos, impuestos e informes.",
 "Fecha":"Día de la operación. Los filtros y los informes utilizan esta fecha; no cambies un registro histórico sin comprobarlo.",
 "Tipo":"Clasificación del registro para búsquedas, informes y tratamiento contable.",
 "Estado":"Situación actual; algunos estados bloquean edición o determinan qué aparece en los informes.",
 "Proveedor / cliente":"Persona o empresa relacionada con el documento. Reutiliza sus datos para evitar duplicados.",
 "NIF/CIF":"Identificación fiscal del emisor. Comprueba que coincida con el documento original.",
 "Nº documento":"Número que aparece en el documento, útil para búsqueda, conciliación y duplicados.",
 "Código / categoría":"Código interno coherente con el resto de la contabilidad.",
 "Nombre / razón fiscal":"Titular que aparecerá en los documentos emitidos.",
 "NIF":"Identificación fiscal del titular; aparece en facturas y exportaciones.",
 "Dirección":"Domicilio que debe aparecer en la ficha o documento asociado.",
 "Email":"Correo utilizado para comunicación y, en usuarios, para iniciar sesión.",
 "Teléfono":"Teléfono de contacto, sin afectar a cálculos fiscales.",
 "IVA venta (%)":"Tipo de IVA de las ventas; normalmente 21 %, pero debes usar el que corresponda al producto.",
 "Pago fraccionado IRPF (%)":"Porcentaje orientativo para previsiones; no sustituye el modelo presentado por la gestoría.",
 "Difícil justificación (%)":"Porcentaje estimado según el régimen fiscal correspondiente y sus límites.",
 "Tope anual difícil justificación":"Límite anual usado únicamente en las simulaciones fiscales.",
 "Consulta / producto":"Nombre o referencia con el que podrás encontrar esta consulta en el histórico.",
 "Coste neto":"Coste de compra antes de IVA y recargo; no añadas de nuevo impuestos especiales ya incluidos en la factura.",
 "PVP":"Precio final de venta al público, incluido el IVA que corresponda.",
 "Competencia":"Precio final observado en otro comercio, comparable con tu PVP.",
 "Descuento (%)":"Porcentaje de descuento aplicado sobre el PVP antes de calcular el margen.",
 "Otros ingresos":"Entradas adicionales de dinero que correspondan a esta jornada; no dupliques cobros ya declarados.",
 "Entradas extraordinarias":"Efectivo introducido en caja sin proceder de las ventas de la jornada.",
 "Salidas extraordinarias":"Efectivo retirado por motivos distintos a los cobros y gastos habituales.",
 "Total TPV / control":"Total indicado por el sistema de venta para contrastar con los cobros desglosados.",
 "Categoría":"Agrupa el gasto para control e informes. Las categorías internas no deben computar como gasto fiscal.",
 "Descripción":"Describe qué se compra o factura. Quedará visible en fichas e informes.",
 "Modelo":"Modelo tributario asociado a una retención, si existe. No lo selecciones si no corresponde.",
 "Años amortización":"Plazo estimado de amortización para compras que deban tratarse como inmovilizado.",
 "Proveedor guardado":"Recupera datos fiscales y condiciones habituales de un proveedor registrado.",
 "Tipo documento":"Clase de justificante que se archivará y aparecerá en los informes.",
 "Tipo interno":"Detalle de gastos solo de control interno, como horas extra o el pago de almacén.",
 "Cantidad":"Unidades vendidas o facturadas; comprueba si se permite una rectificación negativa.",
 "Precio sin IVA":"Precio por unidad antes de IVA; el sistema calcula el importe de la línea.",
 "Serie":"Secuencia de numeración asignada al tipo de documento y ejercicio.",
 "Fecha operación":"Día en que se entregó o prestó el bien o servicio, si difiere de la fecha de emisión.",
 "Número externo":"Número de factura de otro sistema; no debe confundirse con la numeración propia.",
 "Referencia pedido":"Referencia de pedido de origen para facilitar conciliación y trazabilidad.",
 "Cliente guardado":"Recupera los datos del cliente sin volver a introducirlos.",
 "Cliente":"Destinatario de la factura, con sus datos fiscales correctos.",
 "Concepto general":"Descripción de la operación que aparecerá en la factura.",
 "Estado de cobro":"Distingue pendiente, parcial y cobrado para los informes de tesorería.",
 "Fecha de cobro":"Fecha efectiva de recepción del dinero.",
 "Importe cobrado":"Importe realmente recibido, que puede ser inferior al total de la factura.",
 "Plantilla":"Diseño que se aplicará al documento, sin alterar sus importes.",
 "Referencia / SKU":"Código interno del producto; permite identificarlo y evitar registros duplicados.",
 "Familia":"Grupo al que pertenece el producto, útil para clasificación y búsqueda.",
 "PVP actual":"Precio final que se utiliza actualmente.",
 "PVP propuesto":"Nuevo precio que se estudia o propone; compáralo con costes y competencia.",
 "Unidades/mes":"Previsión de unidades mensuales, utilizada únicamente para estimaciones.",
 "Ciudad":"Localidad asociada al domicilio fiscal o postal.",
 "Código postal":"Código postal de la dirección del proveedor o cliente.",
 "Provincia":"Provincia a la que corresponde el domicilio.",
 "Categoría por defecto":"Categoría que se propone al seleccionar este proveedor; puedes cambiarla en cada gasto.",
 "Pago por defecto":"Forma de pago que se preselecciona al usar este proveedor.",
 "Documento por defecto":"Tipo habitual de justificante del proveedor.",
 "Modelo retención":"Modelo tributario que podría corresponder a la retención del proveedor.",
 "Marca":"Fabricante o marca comercial del producto.",
 "Margen objetivo (%)":"Margen esperado sobre el precio neto de venta.",
 "Coste proveedor":"Precio sin impuestos ofrecido por este proveedor.",
 "Descuento proveedor (%)":"Descuento que el proveedor aplica a su tarifa.",
 "Transporte por unidad":"Coste de transporte imputado a cada unidad.",
 "Pedido mínimo":"Cantidad o importe mínimo exigido para comprar a este proveedor.",
 "Stock / plazo":"Disponibilidad prevista o plazo habitual de entrega.",
 "Origen compra":"Proveedor o canal desde el que se adquiere el producto.",
 "Competidor":"Comercio cuya oferta se toma como comparación.",
 "Precio":"Importe que corresponda a este registro, verificando si incluye impuestos.",
 "Envío":"Coste adicional por envío, si se conoce.",
 "Stock":"Disponibilidad del producto en el proveedor o competidor.",
 "Promoción":"Descuento o ventaja temporal de la oferta analizada.",
 "URL":"Dirección de referencia, si procede; comprueba que lleva a la página correcta.",
 "Nombre variante":"Nombre distintivo de esta combinación o variante.",
 "Nicotina mg/ml":"Concentración de nicotina por mililitro; puede afectar a impuestos especiales.",
 "Volumen ml":"Contenido neto del envase en mililitros.",
 "Impuesto €/ml (informativo)":"Importe unitario del impuesto especial como referencia. No lo sumes de nuevo al coste si ya viene incluido.",
 "Impuesto total (informativo)":"Referencia del impuesto especial total por envase, sin volver a añadirlo al coste pagado.",
 "Coste neto final":"Coste final de adquisición que usarás para analizar el margen.",
 "Nombre producto":"Nombre comercial con el que se guardará y buscará el artículo.",
 "Proveedor opcional":"Proveedor vinculado a esta referencia; puede añadirse más adelante.",
 "Nombre / razón social":"Nombre fiscal de la empresa o profesional.",
 "Código":"Identificador breve y único utilizado en la configuración.",
 "Estilo":"Diseño de la factura; revisa siempre la vista previa antes de emitir.",
 "Color principal":"Color principal usado en los documentos y plantillas.",
 "Color secundario":"Color complementario del diseño.",
 "Color de texto":"Color de textos en los documentos generados.",
 "Tipografía":"Familia de letra aplicada a la plantilla.",
 "Posición logo":"Ubicación del logotipo en la cabecera.",
 "Ancho logo (mm)":"Anchura de impresión del logotipo, expresada en milímetros.",
 "Título factura":"Texto de cabecera para facturas.",
 "Título proforma":"Texto de cabecera para documentos proforma.",
 "Año":"Ejercicio al que se aplicará esta serie o informe.",
 "Prefijo":"Texto que antecede al número correlativo de una serie.",
 "Documento":"Tipo de documento asociado a esta serie o configuración.",
 "Tipo de serie":"Uso de la secuencia numérica: factura, proforma u otro documento.",
 "Dígitos":"Longitud mínima del número mediante ceros a la izquierda.",
 "Siguiente número":"Próximo correlativo; no lo cambies si hay documentos ya emitidos.",
 "Grupo AEAT":"Agrupación fiscal orientativa para clasificar gastos.",
 "Código gestor":"Código de categoría utilizado en los libros de tu gestoría.",
 "Orden":"Orden de aparición de este elemento en listas y formularios.",
 "Nombre de caja":"Denominación que verán los empleados al registrar cierres.",
 "Nombre completo":"Nombre de la persona que utilizará esta cuenta.",
 "Rol":"Conjunto de permisos iniciales del usuario. Admin es completo; Gerente y Encargado se configuran en Roles y permisos.",
 "Puesto":"Función laboral o responsabilidad de la persona.",
 "Tienda / centro":"Establecimiento habitual asociado al empleado.",
 "Nueva contraseña (opcional)":"Solo se modificará si introduces una contraseña nueva válida.",
 "Contraseña inicial":"Contraseña temporal del nuevo usuario, que debería cambiar después.",
 "Trimestre":"Periodo de tres meses utilizado para declaraciones y previsiones.",
 "Importe":"Cantidad monetaria en euros, admite coma o punto decimal."
});
// Plain visible language, with the original field identifiers and stored values
// unchanged. Exported accountant templates retain their original column names.
const DISPLAY_LABELS={
 'Base':'Importe sin impuestos',
 'Recargo (%)':'Recargo de equivalencia (%)',
 'Retención (%)':'IRPF retenido (%)',
 '% deducible':'Parte del gasto que reduce el IRPF (%)',
 'Modelo':'Modelo de Hacienda',
 'Modelo retención':'Modelo de la retención',
 'Años amortización':'Años para repartir el gasto',
 'Coste neto':'Coste sin impuestos',
 'Coste neto final':'Coste final sin impuestos',
 'Pago fraccionado IRPF (%)':'Porcentaje del anticipo de IRPF (%)',
 'Difícil justificación (%)':'Deducción adicional de pequeños gastos (%)',
 'Tope anual difícil justificación':'Límite anual de esa deducción (€)',
 'Serie':'Numeración del documento',
 'Tipo de serie':'Tipo de numeración',
 'Dígitos':'Cifras del número',
 'Prefijo':'Texto antes del número',
 'Tarjeta':'Ventas cobradas con tarjeta',
 'Bizum':'Ventas cobradas por Bizum',
 'Pedidos online':'Ventas cobradas por internet',
 'Salidas de efectivo':'Dinero que retiras de esta caja',
 'Entradas extraordinarias':'Dinero añadido que no es una venta',
 'Salidas extraordinarias':'Otras salidas de dinero',
 'Otros ingresos':'Otros cobros por ventas'
};
Object.assign(FIELD_HELP,{
 'Dinero que quedó del cierre anterior':'Cuenta lo que hay en esta caja antes de empezar. Es el dinero dejado en esta misma caja al terminar el día anterior; no son ventas de hoy.',
 'Dinero que dejas para el próximo día':'Cuenta el efectivo que queda después de las retiradas y los gastos. Será la apertura de esta misma caja el siguiente día trabajado.',
 'Ventas del programa de caja':'Total de ventas que muestra tu programa de caja. Sirve para compararlo con este cierre; no es el efectivo que dejas para mañana.',
 'Ventas comprobadas del día':'Total de ventas verificado al revisar el registro anterior. No copies automáticamente un importe antiguo que incluya el dinero dejado en caja.',
 'Entradas extraordinarias':'Dinero añadido para cambio o fondo de caja, sin proceder de una venta. No lo vuelvas a anotar como ingreso.',
 'Salidas extraordinarias':'Otras salidas que no hayas anotado ya en retiradas ni en gastos pagados con esta caja.',
 'Otros ingresos':'Otros cobros de ventas no incluidos en efectivo, tarjeta, Bizum ni internet. No anotes aquí el fondo de caja.',
 '% deducible':'Parte del gasto que la gestoría admite para reducir tu IRPF. Copia el porcentaje que corresponda a la factura; no cambies el importe pagado.',
 'Años amortización':'Plazo durante el que la gestoría reparte el coste de un equipo o inversión entre varios ejercicios.',
 'Modelo':'Modelo de Hacienda en el que se declara este importe. En las retenciones: 111 para nóminas o profesionales y 115 para alquiler de local.',
 'Recargo (%)':'Impuesto adicional que aparece en algunas facturas de compra. Copia el porcentaje del documento.'
});
const fieldHelp=label=>{
 const help=FIELD_HELP[label]||'Introduce el dato correspondiente a este campo y comprueba que coincide con su justificante o configuración antes de guardar.';
 return ` <details class="field-help"><summary aria-label="${esc('Información sobre '+(DISPLAY_LABELS[label]||label))}" title="${esc('Información sobre '+(DISPLAY_LABELS[label]||label))}"><svg class="field-help-icon" viewBox="0 0 24 24" role="presentation" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 11v5"/><circle cx="12" cy="7.5" r="1.1" class="field-help-dot"/></svg></summary><span role="note">${esc(help)}</span></details>`;
};

export const formField=(label,id,value='',type='text',extra='')=>{const decimal=type==='number'&&/step=["']0\.\d+/.test(extra);return `<label><span class="field-caption">${esc(DISPLAY_LABELS[label]||label)}${fieldHelp(label)}</span><input id="${esc(id)}" type="${decimal?'text':esc(type)}" ${decimal?'inputmode="decimal" data-decimal="true"':''} value="${esc(value??'')}" ${extra}></label>`;};
export const selectField=(label,id,options,value='',extra='')=>`<label><span class="field-caption">${esc(DISPLAY_LABELS[label]||label)}${fieldHelp(label)}</span><select id="${esc(id)}" ${extra}>${options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`;
export function modal(title,body,{small=false}={}){
 const host=document.getElementById('modalHost');
 host.innerHTML=`<div class="modal-backdrop" data-action="close-modal"><section class="modal ${small?'small-modal':''}" data-modal-content="true"><div class="modal-head"><h2>${esc(title)}</h2><button class="close-btn" data-action="close-modal">×</button></div><div class="modal-body">${body}</div></section></div>`;
 const panel=host.querySelector('[data-modal-content]');queueMicrotask(()=>{if(panel?.isConnected)captureFormDraft(panel)});
}
export function closeModal(){document.getElementById('modalHost').innerHTML=''}
export function confirmAction(message,{phrase='',title='Confirmar eliminación',acceptLabel='Eliminar definitivamente'}={}){
 return new Promise(resolve=>{
  modal(title,`<p>${esc(message)}</p>${phrase?formField('Escribe '+phrase,'confirmPhrase'):''}<div class="form-actions"><button class="btn secondary" data-confirm="cancel">Cancelar</button><button class="btn danger" data-confirm="accept" ${phrase?'disabled':''}>${esc(acceptLabel)}</button></div>`,{small:true});
  const host=document.getElementById('modalHost'),panel=host.firstElementChild,accept=panel.querySelector('[data-confirm="accept"]'),field=panel.querySelector('#confirmPhrase');
  const finish=result=>{observer.disconnect();host.removeEventListener('click',click);closeModal();resolve(result)};
  const click=e=>{
   const action=e.target.closest('[data-confirm]')?.dataset.confirm;
   if(action==='accept'&&(!phrase||field.value===phrase)){e.stopPropagation();finish(true)}
   else if(action==='cancel'){e.stopPropagation();finish(false)}
  };
  const observer=new MutationObserver(()=>{if(!host.contains(panel)){observer.disconnect();host.removeEventListener('click',click);resolve(false)}});
  host.addEventListener('click',click);observer.observe(host,{childList:true});
  if(field){field.addEventListener('input',()=>{accept.disabled=field.value!==phrase});field.focus()}else accept.focus();
 });
}
export function toast(message,type=''){const host=document.getElementById('toastHost'),el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;host.appendChild(el);setTimeout(()=>el.remove(),3500)}
export const moneyCell=v=>`<span class="money">${money(v)}</span>`;
export const dateCell=v=>`<span class="date-display">${fmtDate(v)}</span>`;
export const stateBadge=s=>badge(s||'—',statusClass(s));
