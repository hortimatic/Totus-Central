
(function(){
'use strict';

const O=window.TotusGestion={
  loaded:false,loading:false,tab:'resumen',
  year:new Date().getFullYear(),quarter:Math.floor(new Date().getMonth()/3)+1,storeId:'all',
  settings:null,stores:[],categories:[],suppliers:[],personnel:[],documents:[],expenses:[],expenseLines:[],
  closings:[],drawers:[],closingDrawers:[],series:[],invoices:[],invoiceLines:[],
  taxPayments:[],retaBrackets:[],fiscalAdjustments:[],incomeAdjustments:[],gestorQuarterSummary:[],reconciliationNotes:[],
  closeDraft:null,closeView:'list',closeSearch:'',closeStatus:'all',expenseDraft:null,expenseDraftLines:[],expenseSelected:[],expenseView:'list',expenseSearch:'',expenseMode:'all',invoiceDraft:null,invoiceDraftLines:[],
  docFilter:{from:'',to:'',store:'all',status:'all',type:'all',q:''},
  reportFrom:'',reportTo:'',plannedSpend:'',
  saving:false
};

function n(v){ return parseNum(v); }
function h(v){ return esc(v); }
function isoToday(){ return new Date().toISOString().slice(0,10); }
function dmy(v){ if(!v)return '—'; const [y,m,d]=String(v).slice(0,10).split('-'); return d+'/'+m+'/'+y; }
function qtrFromDate(v){ const m=+(String(v).slice(5,7)||1); return Math.floor((m-1)/3)+1; }
function focusPeriodForDate(v){
 const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return;
 O.year=Number(s.slice(0,4));O.quarter=qtrFromDate(s);
}
function safeSegment(v){
 return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,120);
}
function periodBounds(year,quarter,accumulated=false){
  const start=accumulated?`${year}-01-01`:`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`;
  const endMonth=quarter*3;
  const end=new Date(year,endMonth,0);
  const endS=`${year}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
  return {start,end:endS};
}
function inRange(date,from,to){ return !!date && date>=from && date<=to; }
function storeName(id){ return O.stores.find(x=>x.id===id)?.name || 'General'; }
function category(id){ return O.categories.find(x=>x.id===id); }
function sum(arr,fn=x=>x){ return arr.reduce((a,x)=>a+(Number(fn(x))||0),0); }
function dlBlob(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200);
}
function downloadCsvRows(name,rows){
  const csv=(rows||[]).map(row=>(row||[]).map(v=>{const s=String(v??'');return /[;"\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}).join(';')).join('\r\n');
  dlBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),name);
}
function statusBadge(v){
  const good=['pagado','pagada','entregada_gestor','archivada','emitida','cerrado','revisada','aceptada','convertida'];
  const bad=['anulada','rechazada','fallido'];
  return `<span class="badge ${good.includes(v)?'ok':bad.includes(v)?'badb':'warnb'}">${h(String(v||'').replaceAll('_',' '))}</span>`;
}
async function selectAll(table,orderCol=null,asc=false){
  const out=[]; let from=0;
  while(true){
    let req=sb.from(table).select('*');
    if(orderCol)req=req.order(orderCol,{ascending:asc});
    req=req.range(from,from+999);
    const {data,error}=await req;
    if(error)throw new Error(table+': '+error.message);
    out.push(...(data||[]));
    if(!data||data.length<1000)break;
    from+=1000;
  }
  return out;
}
async function audit(area,action,entityId=null,detail={}){
  try{ await sb.from('ops_audit_log').insert({user_id:authSession?.user?.id||null,user_email:authSession?.user?.email||'',area,action,entity_id:entityId,detail}); }catch(e){console.warn(e)}
}
function manager(){ return ['admin','gerente'].includes(currentRole()); }
function adminOnly(){ return currentRole()==='admin'; }

const OPS_HELP={
 resumen:['Resumen','Vista general del negocio: ingresos, gastos, resultado, previsión fiscal y almacenamiento. Los importes internos se muestran separados de los fiscales.'],
 cajas:['Cajas','Cada caja física se abre y cierra por separado. La apertura se arrastra del último cierre de esa caja. Totus reconstruye el efectivo vendido con apertura, metálico final, retiradas, gastos y movimientos extraordinarios, y después suma tarjeta, Bizum, online y otros cobros.'],
 'cajas.cuadre':['Comprobación del cierre','Introduce el total de ventas que te da el TPV o el cierre diario. Totus lo compara con la suma reconstruida de todas las cajas. Si no coincide, el día no se puede cerrar: revisa efectivo, tarjeta y movimientos extraordinarios. Puedes guardar un borrador y continuar después.'],
 gastos:['Gastos','Registra facturas y pagos, incluido IVA, recargo, retenciones y justificantes. Los gastos de control interno no pasan a fiscalidad ni al paquete de gestoría.'],
 'gastos.proveedor':['Maestro de proveedores','Guarda una vez los datos de proveedores, distribuidores y empresas de servicios. Totus reutiliza NIF, contacto, forma de pago, tipo de documento, categoría, IVA, recargo, retención y deducibilidad habitual al crear gastos futuros. Puedes corregir cualquier valor en el gasto concreto sin modificar el maestro.'],
 facturas:['Facturación','Crea facturas, rectificativas y proformas. La numeración se asigna al emitir. Plantillas, logo, clientes y series pertenecen a este módulo.'],
 documentos:['Documentos','Archivo digital de justificantes. Puedes filtrar, revisar, descargar y preparar ZIP. Los documentos ligados a facturación quedan protegidos.'],
 fiscal:['Fiscalidad','Previsión de IRPF, retenciones y RETA. Es una herramienta de control y planificación; no sustituye la liquidación de la gestoría.'],
 'fiscal.conciliacion':['Conciliación de fuentes','Muestra diferencias detectadas entre Excel diarios, documentos de gestoría y trimestre natural. Totus conserva la fuente original y deja escrito qué criterio se aplicó; no corrige importes históricos a escondidas.'],
 informes:['Informes','Exporta gastos, ingresos, diarios, resumen fiscal y paquete de gestoría con la estructura documental acordada.'],
 config:['Configuración','Solo parámetros generales de empresa, fiscalidad, RETA y almacenamiento. Facturación, plantillas, logo, clientes y series se gestionan dentro de Facturación para evitar duplicidades.'],
 'config.empresa':['Datos generales de empresa','Nombre, NIF/CIF, dirección, email y teléfono usados en informes y documentos. La imagen corporativa no se configura aquí.'],
 'config.fiscal':['Parámetros fiscales globales','Controlan las previsiones internas de IRPF, IVA y difícil justificación. Los valores oficiales presentados por la gestoría prevalecen sobre cualquier estimación.'],
 'config.reta':['Referencias RETA','Valores usados para orientar la proyección de cuota y tramo. No sustituyen la regularización oficial de Seguridad Social.'],
 'config.storage':['Almacenamiento documental','Define el espacio total reservado y el tamaño máximo de cada archivo. El uso actual se muestra en tiempo real.'],
 'facturas.series':['Series de numeración','Cada serie pertenece a un año, establecimiento y tipo de documento. Al emitir, Totus asigna el siguiente número y evita retrocesos o cruces de año/tienda.'],
 'facturas.includeIncome':['Sumar a ingresos','Actívalo únicamente cuando esa venta no esté ya incluida en los cierres diarios. Evita duplicar ingresos en informes y previsiones.'],
 'facturas.external':['Documento externo','Úsalo cuando la factura ya se emitió fuera de Totus. Debes indicar el número utilizado y adjuntar el original; Totus lo registra sin renumerarlo.'],
 'facturas.clientes':['Clientes reutilizables','Guarda una vez los datos fiscales, contacto, dirección y forma de pago habitual. Al seleccionar el cliente en una factura o proforma, Totus reutiliza esos datos y puedes ajustar el documento concreto sin perder la ficha maestra.'],
 'facturas.template.style':['Estilo de plantilla','Limpia: diseño sobrio. Corporativa: cabecera con mayor presencia de marca. Compacta: reduce espacios para documentos con muchas líneas. Los colores y la tipografía se pueden personalizar después.'],
 'facturas.template.logo':['Logo corporativo','El logo se gestiona únicamente aquí, por plantilla. Puedes subirlo, ocultarlo sin borrarlo, cambiar tamaño y posición, o retirarlo de la plantilla.'],
 'facturas.template.copy':['Textos del documento','Configura títulos, cabecera, condiciones de pago, datos bancarios y pie. Estos valores se aplican por defecto y pueden ajustarse en cada factura antes de emitir.'],
 'gastos.internal':['Solo control interno','Afecta al resultado real del negocio, pero se excluye de cálculos fiscales, IRPF y exportación para gestoría.'],
 'documentos.estado':['Estado documental','Sirve para saber si un justificante está pendiente, revisado, preparado o ya entregado a gestoría. No modifica el gasto o factura original.'],
 'informes.gestor':['Paquete gestoría','Genera una estructura estable con ingresos, gastos, diarios, resumen y documentos. Los gastos internos quedan fuera.'],
 'fiscal.130':['Modelo 130','Estimación acumulada del pago fraccionado de IRPF. Parte de ingresos y gastos deducibles, aplica difícil justificación, resta pagos anteriores y retenciones soportadas. Es orientativa hasta contrastar con gestoría.'],
 'fiscal.pagos':['Modelos y pagos reales','Registra los modelos realmente presentados o pagados, junto con su justificante. Estos importes alimentan el histórico y permiten que la previsión descuente correctamente pagos anteriores.'],
 'fiscal.tiendas':['Resultado operativo por tienda','Compara ventas, gastos registrados y resultado de cada establecimiento. Esta vista sirve para gestión del negocio. No fuerza un reparto fiscal de gastos comunes que la gestoría no identifica por tienda.'],
 'fiscal.iva_re':['IVA y recargo soportados','En recargo de equivalencia no presentas una liquidación periódica de IVA como un negocio en régimen general. Totus muestra el IVA y el recargo que soportas en compras para que sepas cuánto impuesto forma parte de tu coste.'],
 'fiscal.diff':['Difícil justificación','Porcentaje aplicado sobre el rendimiento previo, limitado por el máximo anual configurado. Totus lo muestra separado para que puedas ver su impacto.'],
 'fiscal.simulator':['Simulador fiscal','Permite probar un gasto deducible adicional sin guardarlo. Solo modifica temporalmente la estimación para ayudarte a decidir antes del cierre.'],
 'fiscal.reta':['RETA orientativo','Proyecta el rendimiento neto mensual y lo compara con los tramos/base configurados para el año. No sustituye la regularización oficial de Seguridad Social.'],
 'admin.roles':['Roles de Totus','Admin: control total. Gerente: operación avanzada, facturación, plantillas y revisión. Encargado: trabajo diario de cajas/gastos/documentos y consulta de facturación, sin administración sensible.']
};
let __opsModal=null;
function closeOpsModal(){
 if(!__opsModal)return;
 const url=__opsModal.dataset.objectUrl;if(url)URL.revokeObjectURL(url);
 __opsModal.remove();__opsModal=null;
}
function openOpsModal(title,html,{wide=false}={}){
 closeOpsModal();
 const wrap=document.createElement('div');wrap.className='ops-modal-backdrop';
 wrap.innerHTML=`<section class="ops-modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="ops_modal_title"><div class="ops-modal-head"><div><div class="eyebrow">Ayuda / vista</div><h3 id="ops_modal_title">${h(title)}</h3></div><button type="button" class="ops-modal-close" aria-label="Cerrar ventana">×</button></div><div class="ops-modal-body">${html}</div></section>`;
 wrap.querySelector('.ops-modal-close').onclick=closeOpsModal;
 wrap.addEventListener('click',e=>{if(e.target===wrap)closeOpsModal()});
 document.body.appendChild(wrap);__opsModal=wrap;return wrap;
}
window.opsCloseModal=closeOpsModal;
function closeOpsHelp(){
 const p=document.querySelector('.ops-help-popover');if(p)p.remove();
 if(window.__opsHelpOutside){document.removeEventListener('pointerdown',window.__opsHelpOutside,true);window.__opsHelpOutside=null}
 if(window.__opsHelpEsc){document.removeEventListener('keydown',window.__opsHelpEsc);window.__opsHelpEsc=null}
}
function openOpsHelp(title,copy,anchor){
 closeOpsHelp();
 const p=document.createElement('aside');p.className='ops-help-popover';p.setAttribute('role','dialog');p.setAttribute('aria-modal','false');p.setAttribute('aria-labelledby','ops_help_title');
 p.innerHTML=`<div class="ops-help-head"><div><div class="eyebrow">Información</div><h3 id="ops_help_title">${h(title)}</h3></div><button type="button" class="ops-help-close" aria-label="Cerrar información">×</button></div><div class="ops-help-body">${h(copy)}</div>`;
 document.body.appendChild(p);
 const r=anchor?.getBoundingClientRect?.(),gap=8,margin=10,w=Math.min(390,window.innerWidth-margin*2);
 let left=r?Math.min(window.innerWidth-w-margin,Math.max(margin,r.right-w)):window.innerWidth-w-margin;
 let top=r?Math.min(window.innerHeight-p.offsetHeight-margin,Math.max(margin,r.bottom+gap)):78;
 if(r&&top<r.bottom&&r.top-p.offsetHeight-gap>=margin)top=r.top-p.offsetHeight-gap;
 p.style.width=w+'px';p.style.left=left+'px';p.style.top=Math.max(margin,top)+'px';
 p.querySelector('.ops-help-close').onclick=closeOpsHelp;
 setTimeout(()=>{
  window.__opsHelpOutside=e=>{if(!p.contains(e.target)&&e.target!==anchor)closeOpsHelp()};
  window.__opsHelpEsc=e=>{if(e.key==='Escape')closeOpsHelp()};
  document.addEventListener('pointerdown',window.__opsHelpOutside,true);
  document.addEventListener('keydown',window.__opsHelpEsc);
 },0);
 return p;
}
window.opsInfo=function(key,anchor){
 const item=OPS_HELP[key]||OPS_HELP[String(key).split('.')[0]]||['Información','Sin información adicional disponible.'];
 openOpsHelp(item[0],item[1],anchor);
};
function askReason(title,message,actionLabel='Confirmar'){
 return new Promise(resolve=>{
  const modal=openOpsModal(title,`<div class="ops-help-copy">${h(message)}</div><div class="ops-form" style="margin-top:14px"><div class="span4"><label>Motivo obligatorio</label><textarea id="ops_reason_text" aria-label="Motivo obligatorio" rows="3" placeholder="Explica por qué se realiza esta acción"></textarea></div></div><div class="ops-preview-actions"><button type="button" class="danger" id="ops_reason_ok">${h(actionLabel)}</button><button type="button" class="ghost" id="ops_reason_cancel">Cancelar</button></div>`);
  const done=v=>{closeOpsModal();resolve(v)};
  modal.querySelector('#ops_reason_cancel').onclick=()=>done(null);
  modal.querySelector('#ops_reason_ok').onclick=()=>{const v=modal.querySelector('#ops_reason_text').value.trim();if(!v){modal.querySelector('#ops_reason_text').focus();return}done(v)};
  setTimeout(()=>modal.querySelector('#ops_reason_text')?.focus(),0);
 });
}
function infoButton(key,label='Más información'){return `<button type="button" class="ops-info-btn" aria-label="${h(label)}" title="${h(label)}" onclick="opsInfo('${h(key)}',this)"><span aria-hidden="true">i</span></button>`}

O.core={n,h,isoToday,dmy,periodBounds,inRange,storeName,category,sum,dlBlob,statusBadge,selectAll,audit,manager,adminOnly,infoButton,openOpsModal,closeOpsModal,askReason,uploadDoc,validateDocFile};

async function load(force=false){
  if(O.loading)return;
  if(O.loaded&&!force)return;
  O.loading=true;
  try{
    const [settings,stores,categories,suppliers,personnel,documents,expenses,expenseLines,closings,drawers,closingDrawers,series,invoices,invoiceLines,taxPayments,retaBrackets,fiscalAdjustments,incomeAdjustments,gestorQuarterSummary,reconciliationNotes]=await Promise.all([
      selectAll('ops_business_settings'),
      selectAll('ops_stores','sort_order',true),
      selectAll('ops_expense_categories','sort_order',true),
      selectAll('ops_suppliers','name',true),
      selectAll('ops_personnel','full_name',true),
      selectAll('ops_documents','created_at',false),
      selectAll('ops_expenses','expense_date',false),
      selectAll('ops_expense_lines','sort_order',true),
      selectAll('ops_daily_closings','business_date',false),
      selectAll('ops_cash_drawers','sort_order',true),
      selectAll('ops_daily_closing_drawers'),
      selectAll('ops_invoice_series','year',false),
      selectAll('ops_sales_invoices','issue_date',false),
      selectAll('ops_sales_invoice_lines','sort_order',true),
      selectAll('ops_tax_payments','created_at',false),
      selectAll('ops_reta_brackets','bracket_order',true),
      selectAll('ops_fiscal_adjustments','adjustment_date',false),
      selectAll('ops_income_adjustments','income_date',false),
      selectAll('ops_gestor_quarter_summary','quarter',true),
      selectAll('ops_reconciliation_notes','created_at',false)
    ]);
    O.settings=settings[0]||{};
    O.stores=stores.filter(x=>x.active!==false);
    O.categories=categories.filter(x=>x.active!==false);
    O.suppliers=suppliers; O.personnel=personnel;
    O.documents=documents; O.expenses=expenses; O.expenseLines=expenseLines;
    O.closings=closings; O.drawers=drawers.filter(x=>x.active!==false); O.closingDrawers=closingDrawers;
    O.series=series; O.invoices=invoices; O.invoiceLines=invoiceLines; O.taxPayments=taxPayments;
    O.retaBrackets=retaBrackets; O.fiscalAdjustments=fiscalAdjustments; O.incomeAdjustments=incomeAdjustments; O.gestorQuarterSummary=gestorQuarterSummary; O.reconciliationNotes=reconciliationNotes.filter(x=>x.active!==false);
    if(!O.year)O.year=O.settings.current_year||new Date().getFullYear();
    if(!O.reportFrom)O.reportFrom=`${O.year}-01-01`;
    if(!O.reportTo)O.reportTo=`${O.year}-12-31`;
    O.loaded=true;
  }finally{O.loading=false}
}
window.opsLoadData=load;

function filteredClosings(from,to,store='all'){
 return O.closings.filter(x=>inRange(x.business_date,from,to)&&(store==='all'||x.store_id===store));
}
function closingCsvRows(from,to){
 return [['Fecha','Establecimiento','Apertura','Efectivo vendido','Tarjeta','Bizum','Online','Otros cobros','Retirada de caja','Gastos pagados desde caja','Entrada extra a caja','Salida extra de caja','Metálico final','Ventas calculadas','Total control','Diferencia','Estado','Notas'],
  ...filteredClosings(from,to,O.storeId).sort((a,b)=>a.business_date.localeCompare(b.business_date)).map(c=>[
   c.business_date,storeName(c.store_id),c.opening_cash,c.cash_sales,c.card_sales,c.bizum_sales,c.online_sales,c.other_income,
   c.cash_withdrawals,c.cash_expenses_declared,c.cash_extra_in||0,c.cash_extra_out||0,c.actual_cash,
   n(c.cash_sales)+n(c.card_sales)+n(c.bizum_sales)+n(c.online_sales)+n(c.other_income),
   c.reported_total_sales??'',c.reported_total_sales==null?'':c.difference,c.status||'',c.notes||''
  ])];
}
window.opsExportClosings=function(){
 const p=periodBounds(O.year,O.quarter,false);
 downloadCsvRows(`cierres_${p.start}_${p.end}.csv`,closingCsvRows(p.start,p.end));
};
function expenseCsvRows(from,to){
 const lineMap=new Map();O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
 const rows=[['Fecha','Establecimiento','Proveedor','NIF/CIF','Factura','Concepto','Base','IVA %','IVA','RE %','RE','Retención %','Retención','Imputable IRPF','Pagado','Interno']];
 O.expenses.filter(e=>inRange(e.expense_date,from,to)&&(O.storeId==='all'||e.store_id===O.storeId)).sort((a,b)=>a.expense_date.localeCompare(b.expense_date)).forEach(e=>{
  const ls=lineMap.get(e.id)||[];
  if(!ls.length)rows.push([e.expense_date,storeName(e.store_id),e.supplier_name,e.supplier_tax_id||'',e.invoice_number||'',e.description||'',e.base_amount||0,0,e.vat_amount||0,0,e.re_amount||0,0,e.withholding_amount||0,e.deductible_irpf===false?0:(e.accounting_amount||e.gross_expense||0),e.amount_paid||0,e.management_only?'Sí':'No']);
  else ls.forEach(l=>rows.push([e.expense_date,storeName(e.store_id),e.supplier_name,e.supplier_tax_id||'',e.invoice_number||'',l.description||category(l.category_id)?.name||'',l.base_amount||0,l.vat_rate||0,l.vat_amount||0,l.re_rate||0,l.re_amount||0,l.withholding_rate||0,l.withholding_amount||0,l.irpf_imputable||0,e.amount_paid||0,e.management_only?'Sí':'No']));
 });
 return rows;
}
window.opsExportExpenses=function(){
 const p=periodBounds(O.year,O.quarter,false);
 downloadCsvRows(`gastos_${p.start}_${p.end}.csv`,expenseCsvRows(p.start,p.end));
};

function sectionMeta(tab=O.tab){
 return ({
  resumen:['Resumen','Visión global','Ventas, gastos, resultado, fiscalidad y servidor.'],
  cajas:['Cajas','Trabajo diario','Aperturas y cierres de Hortimatic y NewOldSmok.'],
  gastos:['Gastos','Compras y pagos','Compras, proveedores, servicios y gastos internos o fiscales.'],
  facturas:['Facturación','Ventas documentadas','Facturas, proformas, series, plantillas, logo y PDF.'],
  documentos:['Documentos','Archivo digital','Facturas y documentos ordenados, localizables y descargables.'],
  fiscal:['Fiscalidad','Control trimestral','IRPF, retenciones, previsiones y tramo RETA.'],
  informes:['Informes','Descargas','Informes por fechas y paquete preparado para gestoría.'],
  config:['Configuración','Administración','Empresa, criterios fiscales, RETA y almacenamiento.'],
  log:['Log','Administración','Historial de actividad y revisiones administrativas.'],
  backup:['Backup','Administración','Copias portátiles, validación y recuperación.']
 })[tab]||['Gestión','',''];
}
function headerHtml(){
 const m=sectionMeta(),showYear=['resumen','cajas','gastos','facturas','fiscal'].includes(O.tab),showQuarter=['resumen','cajas','gastos','fiscal'].includes(O.tab),showStore=['resumen','cajas','gastos','facturas'].includes(O.tab);
 const filters=(showYear||showQuarter||showStore)?`<div class="ops-filters">${showYear?`<div><label>Año</label><select onchange="opsSetYear(this.value)">${[2025,2026,2027,2028].map(y=>`<option ${O.year==y?'selected':''}>${y}</option>`).join('')}</select></div>`:''}${showQuarter?`<div><label>Trimestre</label><select onchange="opsSetQuarter(this.value)">${[1,2,3,4].map(q=>`<option value="${q}" ${O.quarter==q?'selected':''}>T${q}</option>`).join('')}</select></div>`:''}${showStore?`<div><label>Establecimiento</label><select onchange="opsSetStore(this.value)"><option value="all">Ambos</option>${O.stores.map(s=>`<option value="${s.id}" ${O.storeId===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></div>`:''}</div>`:'';
 return `<div class="head"><div><div class="eyebrow">${m[1]}</div><div class="ops-title-line"><h1>${m[0]}</h1>${infoButton(O.tab,'Información sobre '+m[0])}</div><p>${m[2]}</p></div>${filters}</div>`;
}
function managementHtml(){
 if(!O.loaded)return `<div class="head"><div><div class="eyebrow">${sectionMeta()[1]}</div><h1>Preparando ${sectionMeta()[0].toLowerCase()}…</h1><p>Un momento.</p></div></div><div class="ops-card">Cargando los datos necesarios…</div>`;
 const moduleBody=window.TotusGestionFeatures?.body?.(O.tab);
 let body=moduleBody??'';
 if(moduleBody==null){
  if(O.tab==='cajas')body=closingsHtml();
  else if(O.tab==='gastos')body=expensesHtml();
  else body='<div class="ops-card">Cargando módulo de gestión…</div>';
 }
 return `<div class="ops-wrap">${headerHtml()}${body}</div>`;
}

function newClosingDraft(){
  const sid=O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'');
  return {id:null,storeId:sid,date:isoToday(),notes:'',status:'borrador',controlTotal:'',drawers:{},legacyAllocation:false};
}
function previousClosedForDrawer(draft,drawer){
  const previous=O.closings
    .filter(c=>c.store_id===draft.storeId&&c.status==='cerrado'&&c.business_date<draft.date)
    .sort((a,b)=>b.business_date.localeCompare(a.business_date));
  for(const closing of previous){
    const row=O.closingDrawers.find(x=>x.closing_id===closing.id&&x.drawer_id===drawer.id);
    if(row)return {closing,row};
  }
  return null;
}
function closingDrawerState(draft,drawer){
  if(draft.drawers[drawer.id])return draft.drawers[drawer.id];
  const prev=previousClosedForDrawer(draft,drawer);
  const opening=prev?n(prev.row.closing_cash):0;
  return draft.drawers[drawer.id]={
    opening:String(opening||''),closing:'',
    card:'',bizum:'',online:'',other:'',withdrawals:'',cashExpenses:'',extraIn:'',extraOut:''
  };
}
function closingHasUserInput(draft=O.closeDraft){
  if(!draft)return false;
  if(String(draft.controlTotal??'').trim()||String(draft.notes??'').trim())return true;
  return Object.values(draft.drawers||{}).some(x=>
    ['closing','card','bizum','online','other','withdrawals','cashExpenses','extraIn','extraOut']
      .some(k=>String(x?.[k]??'').trim()!=='')
  );
}
function drawerCalc(draft,drawer){
  const x=closingDrawerState(draft,drawer);
  const opening=n(x.opening),closing=n(x.closing),withdrawals=n(x.withdrawals),cashExpenses=n(x.cashExpenses),extraIn=n(x.extraIn),extraOut=n(x.extraOut);
  const cashSales=closing+withdrawals+cashExpenses+extraOut-opening-extraIn;
  const card=n(x.card),bizum=n(x.bizum),online=n(x.online),other=n(x.other);
  const total=cashSales+card+bizum+online+other;
  return {opening,closing,withdrawals,cashExpenses,extraIn,extraOut,cashSales,card,bizum,online,other,total};
}
function closeCalc(){
  const d=O.closeDraft||newClosingDraft(),ds=O.drawers.filter(x=>x.store_id===d.storeId);
  const t={opening:0,closing:0,withdrawals:0,cashExpenses:0,extraIn:0,extraOut:0,cashSales:0,card:0,bizum:0,online:0,other:0,total:0};
  ds.forEach(dr=>{const x=drawerCalc(d,dr);Object.keys(t).forEach(k=>t[k]+=n(x[k]))});
  t.control=String(d.controlTotal??'').trim()===''?null:n(d.controlTotal);
  t.diff=t.control==null?null:Math.round((t.total-t.control)*100)/100;
  return t;
}
function drawerClosingHtml(d,dr,dis,index=0){
  const x=closingDrawerState(d,dr),c=drawerCalc(d,dr),prev=previousClosedForDrawer(d,dr);
  const openingNote=prev
    ? `Apertura heredada del ${dmy(prev.closing.business_date)} · ${eur(prev.row.closing_cash)}`
    : 'Sin cierre anterior: revisa la apertura inicial';
  const hasValues=['closing','card','bizum','online','other','withdrawals','cashExpenses','extraIn','extraOut'].some(k=>String(x[k]??'').trim()!=='');
  const mobile=window.matchMedia?.('(max-width:760px)').matches;
  const open=!mobile||index===0||hasValues;
  return `<details class="ops-drawer-card" aria-label="${h(dr.name)}" ${open?'open':''}>
   <summary class="ops-drawer-head">
    <div><div class="eyebrow">Caja física</div><h4>${h(dr.name)}</h4><div class="ops-opening-source">${h(openingNote)}</div></div>
    <div class="ops-drawer-total"><small>Ventas de esta caja</small><b id="ops_drawer_total_${dr.id}">${eur(c.total)}</b></div>
   </summary>
   <div class="ops-drawer-body">
    <div class="ops-drawer-section">
     <div class="ops-drawer-section-title">Efectivo</div>
     <div class="ops-drawer-fields">
      <div><label>Apertura</label><input aria-label="Apertura" inputmode="decimal" value="${h(x.opening)}" oninput="opsDrawerField('${dr.id}','opening',this.value)" ${dis}></div>
      <div><label>Queda en caja</label><input aria-label="Queda en caja" inputmode="decimal" value="${h(x.closing)}" oninput="opsDrawerField('${dr.id}','closing',this.value)" ${dis}></div>
      <div><label>Salida / retirada</label><input aria-label="Salida / retirada" inputmode="decimal" value="${h(x.withdrawals)}" oninput="opsDrawerField('${dr.id}','withdrawals',this.value)" ${dis}></div>
      <div><label>Gastos pagados desde caja</label><input aria-label="Gastos pagados desde caja" inputmode="decimal" value="${h(x.cashExpenses)}" oninput="opsDrawerField('${dr.id}','cashExpenses',this.value)" ${dis}></div>
     </div>
    </div>
    <div class="ops-drawer-section">
     <div class="ops-drawer-section-title">Cobros no efectivos</div>
     <div class="ops-drawer-fields">
      <div><label>Tarjeta</label><input aria-label="Tarjeta" inputmode="decimal" value="${h(x.card)}" oninput="opsDrawerField('${dr.id}','card',this.value)" ${dis}></div>
      <div><label>Bizum</label><input aria-label="Bizum" inputmode="decimal" value="${h(x.bizum)}" oninput="opsDrawerField('${dr.id}','bizum',this.value)" ${dis}></div>
      <div><label>Pedidos online</label><input aria-label="Pedidos online" inputmode="decimal" value="${h(x.online)}" oninput="opsDrawerField('${dr.id}','online',this.value)" ${dis}></div>
      <div><label>Otros cobros</label><input aria-label="Otros cobros" inputmode="decimal" value="${h(x.other)}" oninput="opsDrawerField('${dr.id}','other',this.value)" ${dis}></div>
     </div>
    </div>
    <details class="ops-drawer-advanced" ${(String(x.extraIn).trim()||String(x.extraOut).trim())?'open':''}>
     <summary>Movimientos extraordinarios <span>solo si existen</span></summary>
     <div class="ops-drawer-fields">
      <div><label>Entrada extra a caja</label><input aria-label="Entrada extra a caja" inputmode="decimal" value="${h(x.extraIn)}" oninput="opsDrawerField('${dr.id}','extraIn',this.value)" ${dis}></div>
      <div><label>Salida extra de caja</label><input aria-label="Salida extra de caja" inputmode="decimal" value="${h(x.extraOut)}" oninput="opsDrawerField('${dr.id}','extraOut',this.value)" ${dis}></div>
     </div>
    </details>
    <div class="ops-close-summary compact">
     <div><small>Efectivo vendido</small><b id="ops_drawer_cash_${dr.id}">${eur(c.cashSales)}</b></div>
     <div><small>Tarjeta</small><b id="ops_drawer_card_${dr.id}">${eur(c.card)}</b></div>
     <div><small>Otros cobros</small><b id="ops_drawer_other_${dr.id}">${eur(c.bizum+c.online+c.other)}</b></div>
     <div><small>Metálico final</small><b id="ops_drawer_close_${dr.id}">${eur(c.closing)}</b></div>
    </div>
   </div>
  </details>`;
}
function closingFormHtml(){
  if(!O.closeDraft)O.closeDraft=newClosingDraft();
  const d=O.closeDraft,c=closeCalc(),drawers=O.drawers.filter(x=>x.store_id===d.storeId);
  const pb=periodBounds(O.year,O.quarter,false),rows=filteredClosings(pb.start,pb.end,O.storeId).slice(0,100);
  const locked=!!(d.id&&d.status==='cerrado'&&!manager()),dis=locked?'disabled':'';
  const stateLabel=d.id?(d.status==='cerrado'?'Cerrado':'Borrador'):'Nuevo';
  const diffClass=c.diff==null?'neutral':Math.abs(c.diff)<=.01?'ok':'bad';
  const diffText=c.diff==null?'Pendiente de comprobar':Math.abs(c.diff)<=.01?'CUADRA · '+eur(c.diff):'NO CUADRA · '+eur(c.diff);
  return `<div class="closing-shell">
   <section class="closing-command">
    <div class="closing-command-copy">
     <div class="eyebrow">${d.id?'Cierre registrado':'Trabajo diario'}</div>
     <div class="ops-title-line"><h2>Cierre de caja</h2>${infoButton('cajas','Cómo funciona el cierre de cajas')}</div>
     <p>Introduce únicamente lo ocurrido hoy. Totus hereda la apertura, calcula el efectivo vendido y comprueba el total contra tu cierre/TPV.</p>
    </div>
    <div class="closing-command-actions">
     <span class="ops-status-chip ${d.status==='cerrado'?'closed':'draft'}">${stateLabel}</span>
     ${d.id?'<button class="ghost" onclick="opsNewClosing()">Nuevo</button>':''}
     ${manager()&&d.id&&d.status==='cerrado'?'<button class="ghost" onclick="opsReopenClosing()">Reabrir</button>':''}
     <button class="secondary" onclick="opsSaveClosing('borrador')" ${dis}>Guardar borrador</button>
     <button class="primary" onclick="opsSaveClosing('cerrado')" ${dis}>${d.id?'Guardar cierre':'Cerrar día'}</button>
    </div>
   </section>

   ${locked?'<div class="ops-note warn">Este cierre está cerrado. Puedes consultarlo; administración o gerencia pueden reabrirlo con trazabilidad.</div>':''}
   ${d.legacyAllocation?'<div class="ops-note warn"><b>Cierre histórico anterior al desglose por caja.</b> Los cobros no efectivos se conservan asignados a la primera caja para mantener el total original.</div>':''}

   <div class="closing-workspace">
    <main class="closing-editor">
     <section class="closing-context-card">
      <div class="closing-section-head">
       <div><span>Contexto</span><h3>¿Qué día y qué tienda estás cerrando?</h3></div>
       <small>Cambiar cualquiera de estos datos reinicia los importes introducidos.</small>
      </div>
      <div class="ops-form closing-context-form">
       <div><label>Establecimiento</label><select aria-label="Establecimiento del cierre" onchange="opsCloseContextField('storeId',this.value)" ${dis}>${O.stores.map(st=>`<option value="${st.id}" ${d.storeId===st.id?'selected':''}>${h(st.name)}</option>`).join('')}</select></div>
       <div><label>Fecha</label><input aria-label="Fecha del cierre" type="date" max="${isoToday()}" value="${h(d.date)}" onchange="opsCloseContextField('date',this.value)" ${dis}></div>
      </div>
     </section>

     <section class="closing-drawers-section">
      <div class="closing-section-head">
       <div><span>Cajas físicas</span><h3>${h(storeName(d.storeId))}</h3></div>
       <small>${drawers.length} ${drawers.length===1?'caja configurada':'cajas configuradas'}</small>
      </div>
      ${drawers.length?`<div class="ops-drawers-grid">${drawers.map((dr,i)=>drawerClosingHtml(d,dr,dis,i)).join('')}</div>`:'<div class="ops-note bad">Este establecimiento no tiene ninguna caja física configurada. Un administrador debe crearla antes de cerrar el día.</div>'}
     </section>

     <section class="closing-notes-card">
      <div class="closing-section-head"><div><span>Observaciones</span><h3>Incidencias del día</h3></div><small>Opcional</small></div>
      <textarea aria-label="Observaciones del cierre" placeholder="Solo si necesitas dejar constancia de una incidencia o aclaración" oninput="opsCloseField('notes',this.value)" ${dis}>${h(d.notes)}</textarea>
     </section>
    </main>

    <aside class="closing-review">
     <div class="closing-review-card">
      <div class="closing-review-head">
       <div><span>Resumen en vivo</span><h3>Ventas calculadas</h3></div>
       <strong id="ops_close_total">${eur(c.total)}</strong>
      </div>
      <div class="closing-review-grid">
       <div><span>Efectivo vendido</span><b id="ops_close_cashsales">${eur(c.cashSales)}</b></div>
       <div><span>Tarjeta</span><b id="ops_close_card">${eur(c.card)}</b></div>
       <div><span>Bizum</span><b id="ops_close_bizum">${eur(c.bizum)}</b></div>
       <div><span>Online</span><b id="ops_close_online">${eur(c.online)}</b></div>
       <div><span>Otros</span><b id="ops_close_other">${eur(c.other)}</b></div>
       <div><span>Metálico final</span><b id="ops_close_end">${eur(c.closing)}</b></div>
      </div>
      <details class="closing-review-detail">
       <summary>Ver movimientos de efectivo</summary>
       <div class="closing-review-grid compact">
        <div><span>Apertura</span><b id="ops_close_open">${eur(c.opening)}</b></div>
        <div><span>Retiradas</span><b id="ops_close_withdrawals">${eur(c.withdrawals)}</b></div>
        <div><span>Gastos caja</span><b id="ops_close_cash_expenses">${eur(c.cashExpenses)}</b></div>
        <div><span>Entradas extra</span><b id="ops_close_extra_in">${eur(c.extraIn)}</b></div>
        <div><span>Salidas extra</span><b id="ops_close_extra_out">${eur(c.extraOut)}</b></div>
       </div>
      </details>
     </div>

     <div class="closing-check-card ${diffClass}">
      <div class="closing-section-head">
       <div><span>Comprobación final</span><h3>¿Cuadra el día?</h3></div>
       ${infoButton('cajas.cuadre','Cómo comprobar que el cierre cuadra')}
      </div>
      <label>Total ventas según TPV / cierre</label>
      <input aria-label="Total ventas según TPV / cierre" inputmode="decimal" value="${h(d.controlTotal??'')}" oninput="opsCloseField('controlTotal',this.value)" ${dis}>
      <div class="closing-check-comparison">
       <div><span>Totus calcula</span><strong id="ops_close_control_total">${eur(c.total)}</strong></div>
       <div><span>Diferencia</span><strong class="${diffClass}" id="ops_close_diff">${diffText}</strong></div>
      </div>
      <div class="closing-check-help">${c.diff==null?'Introduce el total del TPV para comprobar el cierre.':Math.abs(c.diff)<=.01?'Todo correcto. Ya puedes cerrar el día.':'Revisa efectivo, tarjeta y movimientos antes de cerrar. Puedes guardar como borrador y continuar después.'}</div>
     </div>

     <div class="closing-formula-card">
      <b>Cómo calcula el efectivo vendido</b>
      <span>Metálico final + retiradas + gastos pagados desde caja + salidas extra − apertura − entradas extra.</span>
     </div>
    </aside>
   </div>

   
  </div>`;
}
function closingListHtml(){
 const pb=periodBounds(O.year,O.quarter,false);
 const q=String(O.closeSearch||'').trim().toLowerCase(),status=O.closeStatus||'all';
 const all=filteredClosings(pb.start,pb.end,O.storeId);
 const rows=all.filter(x=>(status==='all'||x.status===status)&&(!q||[storeName(x.store_id),x.business_date,x.status].join(' ').toLowerCase().includes(q))).slice(0,200);
 const total=sum(all,x=>n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income));
 const open=all.filter(x=>x.status!=='cerrado').length;
 const bad=all.filter(x=>x.reported_total_sales!=null&&Math.abs(n(x.difference))>.01).length;
 return `<div class="closing-list-shell">
  <section class="ops-list-summary">
   <article><span>Cierres</span><strong>${all.length}</strong><small>en el periodo</small></article>
   <article><span>Ventas registradas</span><strong>${eur(total)}</strong><small>suma de cierres</small></article>
   <article><span>Borradores</span><strong>${open}</strong><small>pendientes de cerrar</small></article>
   <article class="${bad?'bad':''}"><span>Descuadres</span><strong>${bad}</strong><small>${bad?'requieren revisión':'todo correcto'}</small></article>
  </section>
  <section class="ops-list-card">
   <div class="ops-list-toolbar">
    <div class="ops-list-search"><span>⌕</span><input aria-label="Buscar cierres" placeholder="Buscar tienda, fecha o estado…" value="${h(O.closeSearch||'')}" oninput="opsCloseSearch(this.value)"></div>
    <select aria-label="Filtrar cierres por estado" onchange="opsCloseStatus(this.value)"><option value="all">Todos los estados</option><option value="cerrado" ${status==='cerrado'?'selected':''}>Cerrados</option><option value="borrador" ${status==='borrador'?'selected':''}>Borradores</option></select>
    <button class="secondary" onclick="opsExportClosings()">Exportar CSV</button>
    <button class="primary" onclick="opsNewClosing()">+ Nuevo cierre</button>
   </div>
   ${rows.length?`<div class="ops-table-wrap"><table class="ops-table closing-list-table"><thead><tr><th>Fecha</th><th>Establecimiento</th><th>Total</th><th>Metálico final</th><th>Cuadre</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(row=>{const t=n(row.cash_sales)+n(row.card_sales)+n(row.bizum_sales)+n(row.online_sales)+n(row.other_income),ok=row.reported_total_sales!=null&&Math.abs(n(row.difference))<=.01;return`<tr>
 <td><b>${dmy(row.business_date)}</b><div class="ops-tiny">Apertura ${eur(row.opening_cash)}</div></td>
 <td><b>${h(storeName(row.store_id))}</b><div class="ops-tiny">${row.notes?h(row.notes):'Sin observaciones'}</div></td>
 <td class="num"><b>${eur(t)}</b><div class="ops-tiny">Efectivo ${eur(row.cash_sales)} · Tarjeta ${eur(row.card_sales)}</div><div class="ops-tiny">Bizum ${eur(row.bizum_sales)} · Online ${eur(row.online_sales)} · Otros ${eur(row.other_income)}</div></td>
 <td class="num"><b>${eur(row.actual_cash)}</b><div class="ops-tiny">Ret. ${eur(row.cash_withdrawals)} · Gastos ${eur(row.cash_expenses_declared)}</div><div class="ops-tiny">Extra +${eur(row.cash_extra_in||0)} / −${eur(row.cash_extra_out||0)}</div></td>
 <td>${row.reported_total_sales==null?'<span class="badge warnb">Sin comprobar</span>':ok?'<span class="badge ok">Cuadra</span>':'<span class="badge badb">Dif. '+eur(row.difference)+'</span>'}${row.reported_total_sales!=null?'<div class="ops-tiny">TPV '+eur(row.reported_total_sales)+'</div>':''}</td>
 <td>${statusBadge(row.status)}</td>
 <td><button class="ghost" onclick="opsEditClosing('${row.id}')">${row.status==='cerrado'&&!manager()?'Ver':'Abrir'}</button></td>
</tr>`}).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay cierres que coincidan con los filtros.</div>'}
  </section>
 </div>`;
}
function closingsHtml(){
 if(O.closeView==='form')return `<div class="ops-record-view"><div class="ops-record-back"><button class="ghost" onclick="opsCloseCancel()">← Volver a cierres</button></div>${closingFormHtml()}</div>`;
 return closingListHtml();
}
window.opsCloseSearch=function(v){O.closeSearch=v;render()};
window.opsCloseStatus=function(v){O.closeStatus=v;render()};
window.opsCloseCancel=function(){
 if(closingHasUserInput()&&!confirm('Hay datos sin guardar. ¿Salir del cierre y descartarlos?'))return;
 O.closeDraft=newClosingDraft();O.closeView='list';render();
};
window.opsCloseField=function(k,v){
  if(!O.closeDraft)O.closeDraft=newClosingDraft();
  O.closeDraft[k]=v;
  updateCloseSummary();
};
window.opsCloseContextField=function(k,v){
  if(!O.closeDraft)O.closeDraft=newClosingDraft();
  const d=O.closeDraft,old=d[k];
  if(old===v)return;
  if(closingHasUserInput(d)&&!confirm('Cambiar '+(k==='storeId'?'el establecimiento':'la fecha')+' reiniciará los importes introducidos en este cierre. ¿Continuar?')){
    render();
    return;
  }
  d[k]=v;d.drawers={};d.controlTotal='';d.notes='';d.legacyAllocation=false;
  render();
};
window.opsDrawerField=function(id,k,v){
  if(!O.closeDraft)O.closeDraft=newClosingDraft();
  const dr=O.drawers.find(x=>x.id===id);if(!dr)return;
  const x=closingDrawerState(O.closeDraft,dr);x[k]=v;
  updateCloseSummary();
};
function updateCloseSummary(){
  const c=closeCalc();
  [['ops_close_open',c.opening],['ops_close_cashsales',c.cashSales],['ops_close_card',c.card],['ops_close_bizum',c.bizum],['ops_close_online',c.online],['ops_close_other',c.other],['ops_close_withdrawals',c.withdrawals],['ops_close_cash_expenses',c.cashExpenses],['ops_close_extra_in',c.extraIn],['ops_close_extra_out',c.extraOut],['ops_close_end',c.closing],['ops_close_total',c.total],['ops_close_control_total',c.total]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=eur(v)});
  const diff=document.getElementById('ops_close_diff');if(diff){diff.className='ops-control-result '+(c.diff==null?'neutral':Math.abs(c.diff)<=.01?'ok':'bad');diff.textContent=c.diff==null?'Pendiente de comprobar':Math.abs(c.diff)<=.01?'CUADRA · '+eur(c.diff):'NO CUADRA · '+eur(c.diff)}
  O.drawers.filter(x=>x.store_id===O.closeDraft?.storeId).forEach(dr=>{const x=drawerCalc(O.closeDraft,dr);[['ops_drawer_total_'+dr.id,x.total],['ops_drawer_cash_'+dr.id,x.cashSales],['ops_drawer_card_'+dr.id,x.card],['ops_drawer_other_'+dr.id,x.bizum+x.online+x.other],['ops_drawer_close_'+dr.id,x.closing]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=eur(v)})});
}
window.opsNewClosing=function(){
  if(closingHasUserInput()&&!confirm('Hay datos sin guardar en el cierre actual. ¿Crear un cierre nuevo y descartarlos?'))return;
  O.closeDraft=newClosingDraft();O.closeView='form';render();
};
window.opsEditClosing=function(id){
  const c=O.closings.find(x=>x.id===id);if(!c)return;
  if(closingHasUserInput()&&O.closeDraft?.id!==id&&!confirm('Hay datos sin guardar en el cierre actual. ¿Abrir otro cierre y descartarlos?'))return;
  const rows=O.closingDrawers.filter(x=>x.closing_id===id),drawers={};
  let hasBreakdown=false;
  rows.forEach(x=>{
    const broken=[x.card_sales,x.bizum_sales,x.online_sales,x.other_income,x.cash_withdrawals,x.cash_expenses_declared].some(v=>v!==null&&v!==undefined);
    if(broken)hasBreakdown=true;
    drawers[x.drawer_id]={
      opening:String(x.opening_cash??''),closing:String(x.closing_cash??''),
      card:String(x.card_sales??''),bizum:String(x.bizum_sales??''),online:String(x.online_sales??''),other:String(x.other_income??''),
      withdrawals:String(x.cash_withdrawals??''),cashExpenses:String(x.cash_expenses_declared??''),
      extraIn:String(x.cash_extra_in??''),extraOut:String(x.cash_extra_out??'')
    };
  });
  let legacyAllocation=false;
  if(rows.length&&!hasBreakdown){
    const first=drawers[rows[0].drawer_id];
    if(first){
      first.card=String(c.card_sales||'');first.bizum=String(c.bizum_sales||'');first.online=String(c.online_sales||'');first.other=String(c.other_income||'');
      first.withdrawals=String(c.cash_withdrawals||'');first.cashExpenses=String(c.cash_expenses_declared||'');
      first.extraIn=String(c.cash_extra_in||'');first.extraOut=String(c.cash_extra_out||'');
      legacyAllocation=!!(n(c.card_sales)+n(c.bizum_sales)+n(c.online_sales)+n(c.other_income)+n(c.cash_withdrawals)+n(c.cash_expenses_declared)+n(c.cash_extra_in)+n(c.cash_extra_out));
    }
  }
  O.closeDraft={id:c.id,storeId:c.store_id,date:c.business_date,notes:c.notes||'',status:c.status,controlTotal:c.reported_total_sales==null?'':String(c.reported_total_sales),drawers,legacyAllocation};O.closeView='form';render();window.scrollTo({top:0,behavior:'smooth'});
};
window.opsReopenClosing=async function(){const d=O.closeDraft;if(!manager()||!d?.id)return;const reason=await askReason('Reabrir cierre','El cierre volverá a borrador para poder corregirlo.','Reabrir');if(!reason)return;const {error}=await sb.rpc('ops_set_closing_status_controlled',{p_closing_id:d.id,p_status:'borrador',p_reason:reason});if(error)return alert(error.message);await load(true);window.opsEditClosing(d.id)};
window.opsDeleteClosing=async function(){const d=O.closeDraft;if(!manager()||!d?.id)return;const reason=await askReason('Eliminar cierre',`Eliminarás el cierre de ${storeName(d.storeId)} del ${dmy(d.date)}. Se conservará snapshot administrativo.`,'Eliminar cierre');if(!reason)return;const {error}=await sb.rpc('ops_delete_closing_controlled',{p_closing_id:d.id,p_reason:reason});if(error)return alert(error.message);await load(true);O.closeDraft=newClosingDraft();O.closeView='list';render()};
window.opsSaveClosing=async function(status='cerrado'){
  if(O.saving)return;
  const d=O.closeDraft,c=closeCalc();
  if(!d.storeId||!d.date)return alert('Tienda y fecha son obligatorias.');
  if(d.date>isoToday())return alert('No puedes registrar un cierre con una fecha futura.');
  if(O.closings.some(x=>x.id!==d.id&&x.store_id===d.storeId&&x.business_date===d.date))return alert('Ya existe un cierre para esa tienda y fecha. Ábrelo desde el histórico.');
  const ds=O.drawers.filter(x=>x.store_id===d.storeId);if(!ds.length)return alert('Esta tienda no tiene cajas configuradas.');
  const moneyKeys=['opening','closing','card','bizum','online','other','withdrawals','cashExpenses','extraIn','extraOut'];
  for(const dr of ds){
    const x=closingDrawerState(d,dr);
    if(moneyKeys.some(k=>String(x[k]??'').trim()!==''&&n(x[k])<0))return alert('No se admiten importes negativos en '+dr.name+'. Corrige el valor o utiliza el movimiento correspondiente.');
  }
  if(status==='cerrado'){
    if(ds.some(dr=>String(closingDrawerState(d,dr).closing).trim()===''))return alert('Indica cuánto queda en cada caja antes de cerrar el día.');
    if(ds.some(dr=>drawerCalc(d,dr).cashSales<-.01))return alert('El efectivo vendido no puede ser negativo. Revisa apertura, metálico final, retiradas y movimientos extraordinarios.');
    if(String(d.controlTotal??'').trim()==='')return alert('Indica el total de ventas según TPV/cierre para comprobar el cuadre antes de cerrar el día.');
    if(n(d.controlTotal)<0)return alert('El total de ventas del TPV no puede ser negativo.');
    if(c.diff==null||Math.abs(c.diff)>.01)return alert('El cierre NO CUADRA. Revisa efectivo, tarjeta y movimientos de caja. Si necesitas parar, guárdalo como borrador.');
  }
  O.saving=true;
  try{
    const payload={id:d.id||null,store_id:d.storeId,business_date:d.date,notes:d.notes||'',status,entry_mode:'physical',reported_total_sales:String(d.controlTotal??'').trim()===''?null:n(d.controlTotal)};
    const drawerRows=ds.map(dr=>{const x=closingDrawerState(d,dr);return{
      drawer_id:dr.id,opening_cash:n(x.opening),closing_cash:n(x.closing),
      card_sales:n(x.card),bizum_sales:n(x.bizum),online_sales:n(x.online),other_income:n(x.other),
      cash_withdrawals:n(x.withdrawals),cash_expenses_declared:n(x.cashExpenses),
      cash_extra_in:n(x.extraIn),cash_extra_out:n(x.extraOut),notes:''
    }});
    const {data:id,error}=await sb.rpc('ops_save_closing',{p_closing:payload,p_drawers:drawerRows});if(error)throw error;
    await audit('cajas',d.id?'actualizar':'crear',id,{fecha:d.date,tienda:storeName(d.storeId),ventas:c.total,control:c.control,diferencia:c.diff,cajas:drawerRows.length,estado:status});
    focusPeriodForDate(d.date);await load(true);
    if(status==='borrador')window.opsEditClosing(id);
    else{O.closeDraft=newClosingDraft();O.closeView='list';render()}
  }catch(e){alert('No se pudo guardar el cierre: '+e.message)}finally{O.saving=false}
};

function defaultExpenseLine(){
 const cat=O.categories.find(c=>c.code==='MERCH')||O.categories[0];
 return {id:null,categoryId:cat?.id||'',description:'',base:'',vat:'21',re:cat?.code==='MERCH'?'5,2':'0',withholding:'0',model:'',deductible:true,deductiblePct:'100',fixed:false};
}
function newExpenseDraft(){
 const sid=O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'');
 return {id:null,storeId:sid,date:isoToday(),supplierId:'',supplier:'',taxId:'',invoice:'',documentKind:'factura',payment:'transferencia',paidStatus:'pagado',paidDate:isoToday(),amountPaid:'',notes:'',fiscalReviewed:false,managementOnly:false};
}
function expenseHasUserInput(d=O.expenseDraft){
 if(!d)return false;
 if(d.id)return false;
 if([d.supplier,d.taxId,d.invoice,d.amountPaid,d.notes].some(v=>String(v??'').trim()))return true;
 if(d.managementOnly||d.documentKind!=='factura'||d.payment!=='transferencia'||d.paidStatus!=='pagado')return true;
 return (O.expenseDraftLines||[]).some(l=>String(l.base??'').trim()||String(l.description??'').trim());
}
function expenseLineCalc(l){
 const base=n(l.base),vatRate=n(l.vat),reRate=n(l.re),wRate=n(l.withholding);
 const vat=base*vatRate/100,re=base*reRate/100,withholding=base*wRate/100;
 const accounting=base+vat+re,payable=accounting-withholding;
 const pct=Math.min(100,Math.max(0,n(l.deductiblePct??100)));const imputable=(l.deductible&&!l.fixed)?accounting*pct/100:0;
 return {base,vatRate,reRate,wRate,vat,re,withholding,accounting,payable,imputable};
}
function draftExpenseTotals(){
 let accounting=0,payable=0,withholding=0;
 O.expenseDraftLines.forEach(l=>{const x=expenseLineCalc(l);accounting+=x.accounting;payable+=x.payable;withholding+=x.withholding});
 return {accounting,payable,withholding};
}
function expenseFormHtml(){
 if(!O.expenseDraft){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()]}
 const d=O.expenseDraft,t=draftExpenseTotals(),pb=periodBounds(O.year,O.quarter,false);
 const rows=O.expenses.filter(e=>inRange(e.expense_date,pb.start,pb.end)&&(O.storeId==='all'||e.store_id===O.storeId)).slice(0,120);
 const currentRecord=d.id?O.expenses.find(x=>x.id===d.id):null,attached=currentRecord?.document_id||null;
 const importedNeedsReview=currentRecord?.source==='importacion_excel'&&!d.managementOnly;
 const fiscalLabel=d.managementOnly?'Solo control interno':'Gasto fiscal';
 const paidShown=d.paidStatus==='pendiente'?0:(d.amountPaid!==''?n(d.amountPaid):t.payable);
 return `<div class="expense-shell">
  <section class="expense-command">
   <div class="expense-command-copy">
    <div class="eyebrow">${d.id?'Gasto registrado':'Compras y pagos'}</div>
    <div class="ops-title-line"><h2>${d.id?'Editar gasto':'Registrar gasto'}</h2>${infoButton('gastos','Cómo registrar correctamente un gasto')}</div>
    <p>Registra proveedor, factura y conceptos en un único recorrido. Totus calcula impuestos, deducibilidad y pago sin repetir datos.</p>
   </div>
   <div class="expense-command-actions">
    <span class="ops-status-chip ${d.managementOnly?'internal':'fiscal'}">${fiscalLabel}</span>
    ${d.id?'<button class="ghost" onclick="opsNewExpense()">Nuevo</button>':''}
    <button class="primary" onclick="opsSaveExpense()">Guardar gasto</button>
   </div>
  </section>

  <div class="expense-workspace">
   <main class="expense-editor">
    <section class="expense-main-card">
     <div class="expense-block expense-document-card">
      <div class="expense-section-head">
       <div><span>1 · Documento</span><h3>Proveedor y factura</h3><p>Selecciona un proveedor guardado o escribe uno nuevo. Sus valores habituales se reutilizan automáticamente.</p></div>
      </div>
      <div class="ops-form expense-document-form">
       <div><label>Fecha</label><input aria-label="Fecha del gasto" type="date" max="${isoToday()}" value="${h(d.date)}" oninput="opsExpenseField('date',this.value)"></div>
       <div><label>Establecimiento</label><select aria-label="Establecimiento del gasto" oninput="opsExpenseField('storeId',this.value)"><option value="">General / común</option>${O.stores.map(st=>`<option value="${st.id}" ${d.storeId===st.id?'selected':''}>${h(st.name)}</option>`).join('')}</select></div>
       <div class="span2"><label>Proveedor / distribuidor</label><div class="ops-inline-field ops-supplier-picker"><select aria-label="Proveedor del gasto" onchange="opsSelectSupplier(this.value)"><option value="">— Escribir manualmente —</option>${O.suppliers.filter(x=>x.active!==false).map(x=>`<option value="${x.id}" ${d.supplierId===x.id?'selected':''}>${h(x.name)}${x.tax_id?' · '+h(x.tax_id):''}</option>`).join('')}</select><button type="button" class="ghost" onclick="opsOpenSupplierEditor()">+ Nuevo</button><button type="button" class="ghost" onclick="opsOpenSupplierManager()">Gestionar</button></div><input aria-label="Nombre manual del proveedor" class="ops-supplier-manual" value="${h(d.supplier)}" placeholder="Nombre del proveedor" oninput="opsExpenseManualSupplier(this.value)"></div>
       <div><label>NIF / CIF proveedor</label><input value="${h(d.taxId)}" oninput="opsExpenseField('taxId',this.value)"></div>
       <div><label>Nº factura proveedor</label><input value="${h(d.invoice)}" placeholder="${['factura','rectificativa'].includes(d.documentKind)?'Obligatorio':'Opcional'}" oninput="opsExpenseField('invoice',this.value)"></div>
       <div><label>Tipo de documento</label><select aria-label="Tipo de documento del gasto" onchange="opsExpenseField('documentKind',this.value,true)">${[['factura','Factura'],['rectificativa','Rectificativa / abono'],['ticket','Ticket'],['nomina','Nómina'],['seguridad_social','Seguridad Social'],['recibo','Recibo'],['otro','Otro']].map(x=>`<option value="${x[0]}" ${d.documentKind===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
       <div class="span2 expense-file-box"><div><label>Factura / documento adjunto</label><div class="ops-file-state">${attached?'<span class="badge ok">Documento guardado</span><span>Puedes sustituirlo seleccionando un archivo nuevo.</span>':'<span class="badge warnb">Sin documento</span><span>PDF, imagen, Excel o CSV.</span>'}</div></div><input id="ops_exp_file" aria-label="Factura o documento adjunto del gasto" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"><div class="ops-actions"><button type="button" class="ghost" onclick="opsPreviewSelectedFile('ops_exp_file')">Vista previa seleccionada</button>${attached?`<button type="button" class="ghost" onclick="opsPreviewDoc('${attached}')">Vista previa guardada</button><button type="button" class="ghost" onclick="opsDownloadDoc('${attached}')">Descargar</button>${manager()?`<button type="button" class="danger" onclick="opsRemoveExpenseDocument('${attached}')">Quitar factura</button>`:''}`:''}</div></div>
      </div>
     </div>

     <div class="expense-block expense-lines-card">
      <div class="expense-section-head expense-lines-heading">
       <div><span>2 · Conceptos</span><h3>${d.managementOnly?'Desglose interno':'Desglose fiscal'}</h3><p>${d.managementOnly?'Este gasto queda fuera de fiscalidad.':'Añade otra línea solo si cambian categoría, IVA, RE o retención.'}</p></div>
       <button class="secondary" onclick="opsAddExpenseLine()">+ Añadir línea</button>
      </div>
      <div class="ops-lines expense-lines">${O.expenseDraftLines.map((l,i)=>expenseLineHtml(l,i)).join('')}</div>
     </div>

     <div class="expense-block expense-notes-card">
      <div class="expense-section-head"><div><span>3 · Observaciones</span><h3>Notas internas</h3></div><small>Opcional</small></div>
      <textarea aria-label="Observaciones del gasto" placeholder="Incidencias, aclaraciones o información que necesites conservar" oninput="opsExpenseField('notes',this.value)">${h(d.notes)}</textarea>
     </div>
    </section>
   </main>

   <aside class="expense-review">
    <section class="expense-review-card ${d.managementOnly?'internal':''}">
     <div class="expense-summary-card">
      <div class="expense-summary-head"><div><span>Total contabilizado</span><strong>${eur(t.accounting)}</strong></div><span class="ops-status-chip ${d.managementOnly?'internal':'fiscal'}">${fiscalLabel}</span></div>
      <div class="expense-summary-grid">
       <div><span>Retenciones</span><b>${eur(t.withholding)}</b></div>
       <div><span>A pagar proveedor</span><b>${eur(t.payable)}</b></div>
       <div><span>Pagado indicado</span><b>${eur(paidShown)}</b></div>
      </div>
     </div>

     <div class="expense-review-section expense-treatment-card">
      <div class="expense-section-head"><div><span>Tratamiento</span><div class="ops-title-line"><h3>Fiscal o interno</h3>${infoButton('gastos.internal','Diferencia entre gasto fiscal e interno')}</div></div></div>
      <label class="expense-mode-toggle"><input id="ops_management_only" type="checkbox" ${d.managementOnly?'checked':''} onchange="opsExpenseField('managementOnly',this.checked,true)"><span><b>Solo control interno</b><small>No va a gestoría ni al cálculo fiscal; sí afecta al resultado real.</small></span></label>
      <div class="expense-shortcuts"><span>Atajos internos</span><button class="ghost" onclick="opsQuickInternal('warehouse')">Almacén · 300 €</button><button class="ghost" onclick="opsQuickInternal('overtime')">Horas extra</button></div>
      ${importedNeedsReview?`<div class="ops-note warn"><div class="checkline"><input id="ops_fiscal_reviewed" type="checkbox" ${d.fiscalReviewed?'checked':''} onchange="opsExpenseField('fiscalReviewed',this.checked)"><label for="ops_fiscal_reviewed">Importación revisada y válida para fiscalidad</label></div><div class="small">Hasta confirmarlo, no entra como gasto fiscal validado.</div></div>`:''}
     </div>

     <div class="expense-review-section expense-payment-card">
      <div class="expense-section-head"><div><span>Pago</span><h3>Estado del proveedor</h3></div></div>
      <div class="ops-form expense-payment-form">
       <div><label>Forma de pago</label><select aria-label="Forma de pago del gasto" oninput="opsExpenseField('payment',this.value)">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div>
       <div><label>Estado</label><select aria-label="Estado de pago del gasto" onchange="opsExpenseField('paidStatus',this.value,true)">${[['pagado','Pagado'],['pendiente','Pendiente'],['parcial','Pago parcial']].map(x=>`<option value="${x[0]}" ${d.paidStatus===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
       <div><label>Fecha pago</label><input aria-label="Fecha de pago del gasto" type="date" max="${isoToday()}" value="${h(d.paidDate)}" oninput="opsExpenseField('paidDate',this.value)" ${d.paidStatus==='pendiente'?'disabled':''}></div>
       <div><label>Importe pagado</label><input inputmode="decimal" placeholder="${String(t.payable.toFixed(2)).replace('.',',')}" value="${h(d.amountPaid)}" oninput="opsExpenseField('amountPaid',this.value)" ${d.paidStatus==='pendiente'?'disabled':''}></div>
      </div>
     </div>
    </section>
   </aside>
  </div>

 </div>`;
}
function expenseListHtml(){
 const pb=periodBounds(O.year,O.quarter,false),mode=O.expenseMode||'all',q=String(O.expenseSearch||'').trim().toLowerCase();
 const all=O.expenses.filter(e=>inRange(e.expense_date,pb.start,pb.end)&&(O.storeId==='all'||e.store_id===O.storeId));
 const filtered=all.filter(e=>{
   if(mode==='fiscal'&&e.management_only)return false;
   if(mode==='internal'&&!e.management_only)return false;
   const hay=[e.supplier_name,e.supplier_tax_id,e.invoice_number,storeName(e.store_id),e.document_kind,e.description,e.notes].join(' ').toLowerCase();
   return !q||hay.includes(q);
 });
 const rows=filtered.slice(0,250);
 const total=sum(all,e=>n(e.accounting_amount||e.gross_expense));
 const fiscal=sum(all.filter(e=>!e.management_only),e=>n(e.accounting_amount||e.gross_expense));
 const internal=sum(all.filter(e=>e.management_only),e=>n(e.accounting_amount||e.gross_expense));
 const pending=all.filter(e=>e.paid_status==='pendiente'||e.paid_status==='parcial').length;
 return `<div class="expense-list-shell">
  <section class="ops-list-summary expense-list-summary">
   <article><span>Total registrado</span><strong>${eur(total)}</strong><small>${all.length} gastos</small></article>
   <article><span>Fiscal</span><strong>${eur(fiscal)}</strong><small>entra en control fiscal</small></article>
   <article><span>Solo interno</span><strong>${eur(internal)}</strong><small>fuera de gestoría</small></article>
   <article class="${pending?'warn':''}"><span>Pendientes de pago</span><strong>${pending}</strong><small>${pending?'requieren seguimiento':'ninguno'}</small></article>
  </section>
  <section class="ops-list-card">
   <div class="ops-list-toolbar expense-list-toolbar">
    <div class="ops-list-search"><span>⌕</span><input aria-label="Buscar gastos registrados" placeholder="Proveedor, NIF, factura, tienda…" value="${h(O.expenseSearch||'')}" oninput="opsExpenseHistorySearch(this.value)"></div>
    <select aria-label="Filtrar gastos por tratamiento" onchange="opsExpenseHistoryMode(this.value)"><option value="all" ${mode==='all'?'selected':''}>Todos</option><option value="fiscal" ${mode==='fiscal'?'selected':''}>Solo fiscales</option><option value="internal" ${mode==='internal'?'selected':''}>Solo internos</option></select>
    <button class="secondary" onclick="opsExportExpenses()">Exportar CSV</button>
    <button class="secondary" onclick="opsNewInternalExpense()">+ Gasto interno</button>
    <button class="primary" onclick="opsNewExpense()">+ Nuevo gasto</button>
   </div>
   <div class="ops-list-selection">
    <span class="badge" id="ops_exp_selected_count">${O.expenseSelected.length} seleccionados</span>
    <div class="ops-actions"><button class="ghost" onclick="opsExpenseClearSelection()" ${O.expenseSelected.length?'':'disabled'}>Limpiar</button><button class="secondary" id="ops_exp_download_selected" onclick="opsDownloadSelectedExpenses()" ${O.expenseSelected.length?'':'disabled'}>Descargar facturas</button>${manager()?`<button class="danger" id="ops_exp_delete_selected" onclick="opsDeleteSelectedExpenses()" ${O.expenseSelected.length?'':'disabled'}>Eliminar selección</button>`:''}</div>
   </div>
   ${rows.length?`<div class="ops-table-wrap"><table class="ops-table expense-history-table"><thead><tr><th><input type="checkbox" aria-label="Seleccionar todos los gastos visibles" onchange='opsExpenseSelectAll(${JSON.stringify(rows.map(x=>x.id))},this.checked)'></th><th>Fecha</th><th>Tienda</th><th>Proveedor</th><th>Factura</th><th>Tipo</th><th>Contable</th><th>Pagado</th><th>Documento</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td><input type="checkbox" aria-label="Seleccionar gasto ${h(e.supplier_name)}" ${O.expenseSelected.includes(e.id)?'checked':''} onchange="opsExpenseSelect('${e.id}',this.checked)"></td><td><b>${dmy(e.expense_date)}</b></td><td>${h(storeName(e.store_id))}</td><td><b>${h(e.supplier_name)}</b><div class="ops-tiny">${h(e.supplier_tax_id||'')}</div></td><td>${h(e.invoice_number||'—')}</td><td>${h(e.document_kind||'factura')}${e.management_only?'<div><span class="badge warnb">Interno</span></div>':''}${e.source!=='manual'?'<div><span class="badge">Importado</span></div>':''}${e.source==='importacion_excel'&&!e.fiscal_reviewed&&!e.management_only?'<div><span class="badge warnb">Fiscal pendiente</span></div>':''}</td><td class="num"><b>${eur(e.accounting_amount||e.gross_expense)}</b></td><td class="num">${eur(e.amount_paid)}<div class="ops-tiny">${h(e.paid_status||'')}</div></td><td>${e.document_id?'<span class="badge ok">Adjunta</span>':'<span class="badge warnb">Sin archivo</span>'}</td><td><div class="ops-actions">${e.document_id?`<button class="ghost" onclick="opsPreviewDoc('${e.document_id}')">Vista previa</button>`:''}<button class="ghost" onclick="opsEditExpense('${e.id}')">Abrir</button>${manager()?`<button class="danger" onclick="opsDeleteExpense('${e.id}')">Eliminar</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay gastos que coincidan con los filtros.</div>'}
  </section>
 </div>`;
}
function expensesHtml(){
 if(O.expenseView==='form')return `<div class="ops-record-view"><div class="ops-record-back"><button class="ghost" onclick="opsExpenseCancel()">← Volver a gastos</button></div>${expenseFormHtml()}</div>`;
 return expenseListHtml();
}
window.opsExpenseCancel=function(){
 if(expenseHasUserInput()&&!confirm('Hay datos sin guardar. ¿Salir del gasto y descartarlos?'))return;
 O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()];O.expenseView='list';render();
};
window.opsExpenseHistorySearch=function(v){O.expenseSearch=v;render()};
window.opsExpenseHistoryMode=function(v){O.expenseMode=v;render()};

function expenseLineHtml(l,i){
 const x=expenseLineCalc(l),cat=category(l.categoryId),pct=Math.min(100,Math.max(0,n(l.deductiblePct??100)));
 const treatment=l.fixed?'fixed':!l.deductible?'none':pct<100?'partial':'full';
 return `<div class="ops-line">
  <div><label>Concepto / categoría</label><select aria-label="Categoría de la línea ${i+1}" onchange="opsExpenseLineField(${i},'categoryId',this.value,true)">${O.categories.map(c=>`<option value="${c.id}" ${l.categoryId===c.id?'selected':''}>${h(c.manager_code?c.manager_code+' · '+c.name:c.name)}</option>`).join('')}</select><input aria-label="Detalle de la línea ${i+1}" style="margin-top:6px" placeholder="Detalle opcional" value="${h(l.description)}" oninput="opsExpenseLineField(${i},'description',this.value)"></div>
  <div><label>Base</label><input aria-label="Base de la línea ${i+1}" inputmode="decimal" value="${h(l.base)}" oninput="opsExpenseLineField(${i},'base',this.value,true)"></div>
  <div><label>IVA %</label><input aria-label="IVA % de la línea ${i+1}" inputmode="decimal" value="${h(l.vat)}" oninput="opsExpenseLineField(${i},'vat',this.value,true)"></div>
  <div><label>RE %</label><input aria-label="RE % de la línea ${i+1}" inputmode="decimal" value="${h(l.re)}" oninput="opsExpenseLineField(${i},'re',this.value,true)"></div>
  <div><label>Retención %</label><input aria-label="Retención % de la línea ${i+1}" inputmode="decimal" value="${h(l.withholding)}" oninput="opsExpenseLineField(${i},'withholding',this.value,true)"><select aria-label="Modelo de retención" style="margin-top:5px" onchange="opsExpenseLineField(${i},'model',this.value)"><option value="">Sin modelo</option><option value="111" ${l.model==='111'?'selected':''}>111</option><option value="115" ${l.model==='115'?'selected':''}>115</option></select></div>
  <div><label>Tratamiento IRPF ${infoButton('gastos','Ayuda sobre deducibilidad')}</label><select aria-label="Tratamiento IRPF de la línea ${i+1}" onchange="opsExpenseTreatment(${i},this.value)"><option value="full" ${treatment==='full'?'selected':''}>Deducible 100 %</option><option value="partial" ${treatment==='partial'?'selected':''}>Deducible parcial</option><option value="none" ${treatment==='none'?'selected':''}>No deducible</option><option value="fixed" ${treatment==='fixed'?'selected':''}>Inmovilizado / amortizable</option></select>${treatment==='partial'?`<input aria-label="Porcentaje deducible de la línea ${i+1}" style="margin-top:5px" inputmode="decimal" value="${h(l.deductiblePct??100)}" oninput="opsExpenseLineField(${i},'deductiblePct',this.value,true)" placeholder="% deducible">`:''}</div>
  <button class="ghost" aria-label="Eliminar línea ${i+1}" onclick="opsRemoveExpenseLine(${i})" ${O.expenseDraftLines.length===1?'disabled':''}>×</button>
  <div style="grid-column:1/-1" class="small">${h(cat?.aeat_group||'')} · Base ${eur(x.base)} · IVA ${eur(x.vat)} · RE ${eur(x.re)} · Ret. ${eur(x.withholding)} · <b>Imputable IRPF ${eur(x.imputable)}</b>${treatment==='partial'?` (${pct.toFixed(2).replace('.',',')} %)`:''}</div>
 </div>`;
}
window.opsExpenseManualSupplier=function(v){
 const d=O.expenseDraft||(O.expenseDraft=newExpenseDraft());
 d.supplier=v;d.supplierId='';
};
window.opsSelectSupplier=function(id){
 const d=O.expenseDraft||(O.expenseDraft=newExpenseDraft());d.supplierId=id||'';
 const p=O.suppliers.find(x=>x.id===id);if(!p){render();return}
 d.supplier=p.name||'';d.taxId=p.tax_id||'';d.payment=p.default_payment_method||'transferencia';d.documentKind=p.default_document_kind||'factura';
 if(O.expenseDraftLines.length===1){
  const l=O.expenseDraftLines[0];
  if(p.default_category_id)l.categoryId=p.default_category_id;
  l.vat=String(p.default_vat_rate??21).replace('.',',');l.re=String(p.default_re_rate??0).replace('.',',');
  l.withholding=String(p.default_withholding_rate??0).replace('.',',');l.model=p.default_withholding_model||'';
  l.deductible=p.default_deductible_irpf!==false;l.deductiblePct=String(p.default_deductible_pct??100).replace('.',',');
 }
 render();
};
function supplierEditorHtml(p={}){
 const catOpts=O.categories.map(c=>`<option value="${c.id}" ${p.default_category_id===c.id?'selected':''}>${h(c.manager_code?c.manager_code+' · '+c.name:c.name)}</option>`).join('');
 return `<div class="supplier-editor-sections">
  <section class="template-group"><div class="template-group-head"><div><div class="eyebrow">Identificación</div><h4>Empresa / profesional</h4></div></div><div class="ops-form">
   <div class="span2"><label>Nombre / razón social</label><input id="ops_sup_name" aria-label="Nombre / razón social" value="${h(p.name||'')}"></div>
   <div><label>NIF/CIF</label><input id="ops_sup_tax" aria-label="NIF/CIF" value="${h(p.tax_id||'')}"></div>
   <div><label>Email</label><input id="ops_sup_email" type="email" aria-label="Email" value="${h(p.email||'')}"></div>
   <div><label>Teléfono</label><input id="ops_sup_phone" aria-label="Teléfono" value="${h(p.phone||'')}"></div>
   <div class="span2"><label>Dirección</label><input id="ops_sup_address" aria-label="Dirección" value="${h(p.address||'')}"></div>
   <div><label>Código postal</label><input id="ops_sup_postal" aria-label="Código postal" value="${h(p.postal_code||'')}"></div>
   <div><label>Ciudad</label><input id="ops_sup_city" aria-label="Ciudad" value="${h(p.city||'')}"></div>
   <div><label>Provincia</label><input id="ops_sup_province" aria-label="Provincia" value="${h(p.province||'')}"></div>
   <div><label>País</label><input id="ops_sup_country" aria-label="País" value="${h(p.country||'España')}"></div>
  </div></section>
  <section class="template-group"><div class="template-group-head"><div><div class="eyebrow">Valores por defecto</div><h4>Cómo suele facturarnos</h4></div>${infoButton('gastos.proveedor','Datos que Totus reutiliza al crear un gasto')}</div><div class="ops-form">
   <div><label>Forma de pago habitual</label><select id="ops_sup_payment" aria-label="Forma de pago habitual">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${(p.default_payment_method||'transferencia')===x?'selected':''}>${x}</option>`).join('')}</select></div>
   <div><label>Documento habitual</label><select id="ops_sup_doc_kind" aria-label="Documento habitual">${[['factura','Factura'],['rectificativa','Rectificativa / abono'],['ticket','Ticket'],['recibo','Recibo'],['otro','Otro']].map(x=>`<option value="${x[0]}" ${(p.default_document_kind||'factura')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
   <div class="span2"><label>Categoría habitual</label><select id="ops_sup_category" aria-label="Categoría habitual"><option value="">Sin predeterminar</option>${catOpts}</select></div>
   <div><label>IVA habitual %</label><input id="ops_sup_vat" aria-label="IVA habitual %" inputmode="decimal" value="${h(p.default_vat_rate??21)}"></div>
   <div><label>RE habitual %</label><input id="ops_sup_re" aria-label="RE habitual %" inputmode="decimal" value="${h(p.default_re_rate??0)}"></div>
   <div><label>Retención habitual %</label><input id="ops_sup_wh" aria-label="Retención habitual %" inputmode="decimal" value="${h(p.default_withholding_rate??0)}"></div>
   <div><label>Modelo retención</label><select id="ops_sup_wh_model" aria-label="Modelo retención"><option value="" ${!p.default_withholding_model?'selected':''}>Sin modelo</option><option value="111" ${p.default_withholding_model==='111'?'selected':''}>111</option><option value="115" ${p.default_withholding_model==='115'?'selected':''}>115</option></select></div>
   <div class="checkline"><input id="ops_sup_deductible" type="checkbox" ${p.default_deductible_irpf!==false?'checked':''}><label for="ops_sup_deductible">Deducible IRPF por defecto</label></div>
   <div><label>Porcentaje deducible habitual %</label><input id="ops_sup_deduct_pct" aria-label="Porcentaje deducible habitual %" inputmode="decimal" value="${h(p.default_deductible_pct??100)}"></div>
  </div></section>
  <section class="template-group"><div class="template-group-head"><div><div class="eyebrow">Interno</div><h4>Notas</h4></div></div><label>Notas</label><textarea id="ops_sup_notes" aria-label="Notas">${h(p.notes||'')}</textarea></section>
 </div><div class="ops-preview-actions"><button class="primary" id="ops_sup_save">Guardar proveedor</button><button class="ghost" id="ops_sup_cancel">Cancelar</button></div>`;
}
window.opsOpenSupplierEditor=function(id=''){
 const p=O.suppliers.find(x=>x.id===id)||{};
 const m=openOpsModal(id?'Editar proveedor':'Nuevo proveedor',supplierEditorHtml(p));
 m.querySelector('#ops_sup_cancel').onclick=closeOpsModal;
 m.querySelector('#ops_sup_save').onclick=async()=>{
  const row={name:m.querySelector('#ops_sup_name').value.trim(),tax_id:m.querySelector('#ops_sup_tax').value.trim(),email:m.querySelector('#ops_sup_email').value.trim(),phone:m.querySelector('#ops_sup_phone').value.trim(),address:m.querySelector('#ops_sup_address').value.trim(),postal_code:m.querySelector('#ops_sup_postal').value.trim(),city:m.querySelector('#ops_sup_city').value.trim(),province:m.querySelector('#ops_sup_province').value.trim(),country:m.querySelector('#ops_sup_country').value.trim()||'España',default_payment_method:m.querySelector('#ops_sup_payment').value,default_document_kind:m.querySelector('#ops_sup_doc_kind').value,default_category_id:m.querySelector('#ops_sup_category').value||null,default_vat_rate:n(m.querySelector('#ops_sup_vat').value),default_re_rate:n(m.querySelector('#ops_sup_re').value),default_withholding_rate:n(m.querySelector('#ops_sup_wh').value),default_withholding_model:m.querySelector('#ops_sup_wh_model').value||null,default_deductible_irpf:m.querySelector('#ops_sup_deductible').checked,default_deductible_pct:n(m.querySelector('#ops_sup_deduct_pct').value),notes:m.querySelector('#ops_sup_notes').value,active:true,updated_at:new Date().toISOString()};
  if(!row.name)return m.querySelector('#ops_sup_name').focus();
  const duplicateTax=row.tax_id&&O.suppliers.find(x=>x.id!==id&&String(x.tax_id||'').trim().toLowerCase()===row.tax_id.toLowerCase());
  if(duplicateTax)return alert('Ya existe un proveedor con ese NIF/CIF: '+duplicateTax.name+'.');
  const fromDocuments=O.tab==='documentos';
  const res=id?await sb.from('ops_suppliers').update(row).eq('id',id).select().single():await sb.from('ops_suppliers').insert({...row,source:'manual',created_by:authSession?.user?.id||null}).select().single();
  if(res.error){alert('No se pudo guardar el proveedor: '+res.error.message);return}
  closeOpsModal();await load(true);
  if(fromDocuments){
   const party=document.getElementById('ops_doc_party'),tax=document.getElementById('ops_doc_tax');
   if(party)party.value=res.data.name||'';if(tax)tax.value=res.data.tax_id||'';
   return;
  }
  window.opsSelectSupplier(res.data.id);
 };
};
window.opsOpenSupplierManager=function(){
 const rows=O.suppliers.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 const m=openOpsModal('Proveedores y distribuidores',`<div class="ops-actions" style="margin-bottom:12px"><button class="primary" onclick="opsCloseModal();opsOpenSupplierEditor()">+ Nuevo proveedor</button></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Proveedor</th><th>NIF/CIF</th><th>Pago</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td><b>${h(p.name)}</b></td><td>${h(p.tax_id||'—')}</td><td>${h(p.default_payment_method||'—')}</td><td>${p.active!==false?'<span class="badge ok">Activo</span>':'<span class="badge warnb">Archivado</span>'}</td><td><div class="ops-actions"><button class="ghost" onclick="opsCloseModal();opsOpenSupplierEditor('${p.id}')">Editar</button><button class="ghost" onclick="opsToggleSupplier('${p.id}',${p.active===false?'true':'false'})">${p.active===false?'Reactivar':'Archivar'}</button>${manager()?`<button class="danger" onclick="opsDeleteSupplier('${p.id}')">Eliminar</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`,{wide:true});
};
window.opsToggleSupplier=async function(id,active){const {error}=await sb.from('ops_suppliers').update({active,updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await load(true);opsOpenSupplierManager()};
window.opsDeleteSupplier=async function(id){const p=O.suppliers.find(x=>x.id===id);if(!p)return;const reason=await askReason('Eliminar proveedor',`Se eliminará "${p.name}" del maestro. Los gastos históricos conservarán sus datos; solo perderán el vínculo al maestro.`,'Eliminar proveedor');if(!reason)return;const {error}=await sb.rpc('ops_delete_supplier_controlled',{p_supplier_id:id,p_reason:reason});if(error)return alert(error.message);await load(true);opsOpenSupplierManager()};

window.opsExpenseSelect=function(id,on){const set=new Set(O.expenseSelected||[]);on?set.add(id):set.delete(id);O.expenseSelected=[...set];const count=document.getElementById('ops_exp_selected_count');if(count)count.textContent=O.expenseSelected.length+' seleccionados';const dl=document.getElementById('ops_exp_download_selected');if(dl)dl.disabled=!O.expenseSelected.length;const del=document.getElementById('ops_exp_delete_selected');if(del)del.disabled=!O.expenseSelected.length};
window.opsExpenseSelectAll=function(ids,on){const set=new Set(O.expenseSelected||[]);ids.forEach(id=>on?set.add(id):set.delete(id));O.expenseSelected=[...set];render()};
window.opsExpenseClearSelection=function(){O.expenseSelected=[];render()};
window.opsDownloadSelectedExpenses=async function(){
 const selected=O.expenses.filter(e=>(O.expenseSelected||[]).includes(e.id));if(!selected.length)return alert('Selecciona al menos un gasto.');
 if(!window.JSZip)return alert('ZIP no disponible.');
 const z=new JSZip(),missing=[];let added=0;
 for(const e of selected){
  const d=O.documents.find(x=>x.id===e.document_id);
  if(!d){missing.push(`${e.expense_date} · ${e.supplier_name} · ${e.invoice_number||'sin nº factura'}`);continue}
  const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);
  if(error){missing.push(`${e.expense_date} · ${e.supplier_name} · ${e.invoice_number||'sin nº factura'} · ERROR DESCARGA`);continue}
  z.file(`${safeSegment(e.supplier_name)}_${safeSegment(e.invoice_number||e.expense_date)}_${safeSegment(d.original_name)}`,data);added++;
 }
 if(missing.length)z.file('FALTAN_FACTURAS.txt','Faltan o no se pudieron descargar estos justificantes:\n\n'+missing.join('\n'));
 if(!added&&!missing.length)return alert('La selección no contiene facturas adjuntas.');
 dlBlob(await z.generateAsync({type:'blob'}),`Totus_facturas_gastos_${isoToday()}.zip`);
};
window.opsDeleteSelectedExpenses=async function(){
 if(!manager())return;const selected=O.expenses.filter(e=>(O.expenseSelected||[]).includes(e.id));if(!selected.length)return alert('Selecciona al menos un gasto.');
 const reason=await askReason('Eliminar gastos seleccionados',`Vas a eliminar ${selected.length} gastos. Se guardará snapshot individual de cada registro.`,'Eliminar selección');if(!reason)return;
 for(const e of selected){const {data,error}=await sb.rpc('ops_delete_expense_controlled',{p_expense_id:e.id,p_reason:reason});if(error)return alert('No se pudo eliminar '+e.supplier_name+': '+error.message);for(const path of (data?.storage_paths||[]))await sb.storage.from('business-documents').remove([path])}
 O.expenseSelected=[];await load(true);render();
};

function applyExpenseCategoryDefaults(l,c){
 l.deductible=c?.deductible_default!==false;l.deductiblePct=l.deductible?'100':'0';
 if(c?.code==='MERCH'){l.vat='21';l.re='5,2';l.withholding='0';l.model=''}
 else if(c?.code==='RENT'){l.vat='21';l.re='0';l.withholding='19';l.model='115'}
 else if(['BANK','INSURANCE','RETA','PAYROLL','SOCIAL','INTERNAL_OVERTIME','INTERNAL_WAREHOUSE'].includes(c?.code)){l.vat='0';l.re='0';l.withholding='0';l.model=''}
 l.fixed=!!c?.fixed_asset_default;
}
window.opsExpenseField=(k,v,rer=false)=>{
 const d=O.expenseDraft;if(!d)return;d[k]=v;
 if(k==='managementOnly'){
  if(v){
   O.expenseDraftLines.forEach(l=>{l.deductible=false;l.deductiblePct='0';l.fixed=false;l.vat='0';l.re='0';l.withholding='0';l.model=''})
  }else{
   O.expenseDraftLines.forEach(l=>applyExpenseCategoryDefaults(l,category(l.categoryId)));
  }
 }
 if(k==='paidStatus'){
  if(v==='pendiente'){d.amountPaid='';d.paidDate=''}
  else if(!d.paidDate)d.paidDate=d.date||isoToday();
 }
 if(rer)render();
};
window.opsExpenseLineField=function(i,k,v,recalc=false){
 const l=O.expenseDraftLines[i]; if(!l)return;l[k]=v;
 if(k==='categoryId'){
  const c=category(v);
  applyExpenseCategoryDefaults(l,c);
  if(['INTERNAL_OVERTIME','INTERNAL_WAREHOUSE'].includes(c?.code)){
   O.expenseDraft.managementOnly=true;
   O.expenseDraftLines.forEach(x=>{x.deductible=false;x.deductiblePct='0';x.fixed=false;x.vat='0';x.re='0';x.withholding='0';x.model=''});
  }
 }
 if(recalc)render();
};
window.opsExpenseTreatment=function(i,v){
 const l=O.expenseDraftLines[i];if(!l)return;
 if(v==='full'){l.deductible=true;l.deductiblePct='100';l.fixed=false}
 if(v==='partial'){l.deductible=true;l.deductiblePct=(n(l.deductiblePct)>0&&n(l.deductiblePct)<100)?l.deductiblePct:'50';l.fixed=false}
 if(v==='none'){l.deductible=false;l.deductiblePct='0';l.fixed=false}
 if(v==='fixed'){l.deductible=false;l.deductiblePct='0';l.fixed=true}
 render();
};
window.opsAddExpenseLine=function(){O.expenseDraftLines.push(defaultExpenseLine());render()};
window.opsRemoveExpenseLine=function(i){if(O.expenseDraftLines.length>1){O.expenseDraftLines.splice(i,1);render()}};
window.opsQuickInternal=function(kind){
 const d=O.expenseDraft||(O.expenseDraft=newExpenseDraft());
 const code=kind==='warehouse'?'INTERNAL_WAREHOUSE':'INTERNAL_OVERTIME';
 const c=O.categories.find(x=>x.code===code);
 d.managementOnly=true;d.documentKind='otro';d.supplierId='';d.taxId='';d.invoice='';d.fiscalReviewed=false;d.paidStatus='pagado';d.paidDate=d.date||isoToday();
 d.supplier=kind==='warehouse'?'Almacén':'Horas extra empleados';
 O.expenseDraftLines=[{id:null,categoryId:c?.id||'',description:kind==='warehouse'?'Pago interno de almacén':'Horas extra / pago interno de personal',base:kind==='warehouse'?'300':'',vat:'0',re:'0',withholding:'0',model:'',deductible:false,deductiblePct:'0',fixed:false}];
 d.amountPaid=kind==='warehouse'?'300':'';
 render();
};
window.opsNewExpense=function(){if(expenseHasUserInput()&&!confirm('Hay datos sin guardar en el gasto actual. ¿Crear un gasto nuevo y descartarlos?'))return;O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()];O.expenseView='form';render()};
window.opsNewInternalExpense=function(){if(expenseHasUserInput()&&!confirm('Hay datos sin guardar en el gasto actual. ¿Crear un gasto interno nuevo y descartarlos?'))return;O.expenseDraft=newExpenseDraft();O.expenseDraft.managementOnly=true;O.expenseDraft.documentKind='otro';O.expenseDraft.fiscalReviewed=false;O.expenseDraftLines=[defaultExpenseLine()];O.expenseView='form';render();};
window.opsEditExpense=function(id){
 const e=O.expenses.find(x=>x.id===id);if(!e)return;
 if(expenseHasUserInput()&&!confirm('Hay datos sin guardar en el gasto actual. ¿Abrir otro gasto y descartarlos?'))return;
 O.expenseDraft={id:e.id,storeId:e.store_id||'',date:e.expense_date,supplierId:e.supplier_id||'',supplier:e.supplier_name||'',taxId:e.supplier_tax_id||'',invoice:e.invoice_number||'',documentKind:e.document_kind||'factura',payment:e.payment_method||'transferencia',paidStatus:e.paid_status||'pagado',paidDate:e.paid_date||'',amountPaid:String(e.amount_paid??''),notes:e.notes||'',fiscalReviewed:!!e.fiscal_reviewed,managementOnly:!!e.management_only};
 const lines=O.expenseLines.filter(x=>x.expense_id===id);O.expenseDraftLines=lines.length?lines.map(l=>({id:l.id,categoryId:l.category_id||'',description:l.description||'',base:String(l.base_amount??''),vat:String(l.vat_rate??0).replace('.',','),re:String(l.re_rate??0).replace('.',','),withholding:String(l.withholding_rate??0).replace('.',','),model:l.withholding_model||'',deductible:l.deductible_irpf!==false,deductiblePct:String(l.deductible_pct??(l.deductible_irpf!==false?100:0)).replace('.',','),fixed:!!l.fixed_asset})): [defaultExpenseLine()];
 O.expenseView='form';render();window.scrollTo({top:0,behavior:'smooth'});
};
async function fileSha256(file){
 const buf=await file.arrayBuffer(); const hash=await crypto.subtle.digest('SHA-256',buf);
 return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function validateDocFile(file){
 if(!file)return true;
 const max=n(O.settings?.document_max_bytes||20971520);
 const ext='.'+String(file.name||'').split('.').pop().toLowerCase();
 const allowedExt=new Set(['.pdf','.jpg','.jpeg','.png','.webp','.xlsx','.xls','.csv']);
 const allowedMime=new Set(['application/pdf','image/jpeg','image/png','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel']);
 if(file.size<=0)throw new Error('El archivo está vacío.');
 if(file.size>max)throw new Error('El archivo supera el límite de '+Math.round(max/1048576)+' MB.');
 if(!allowedExt.has(ext))throw new Error('Tipo de archivo no permitido. Usa PDF, JPG/JPEG, PNG, WEBP, XLS/XLSX o CSV.');
 if(file.type&&!allowedMime.has(file.type))throw new Error('El contenido del archivo no coincide con un formato permitido.');
 return true;
}
window.__opsValidateDocumentFile=validateDocFile;
async function uploadDoc(file,meta,linkedType='',linkedId=null){
 if(!file)return null;
 validateDocFile(file);
 const storageLimit=n(O.settings?.storage_limit_bytes||1073741824),used=n(O.storageUsage?.total_bytes||sum(O.documents,d=>n(d.size_bytes)));
 if(storageLimit&&used+file.size>storageLimit)throw new Error('El archivo supera el espacio total disponible. Libera espacio o aumenta el límite antes de subirlo.');
 const sha=await fileSha256(file);
 const dup=O.documents.find(d=>d.sha256&&d.sha256===sha);
 if(dup&&!confirm('Este archivo ya existe como "'+dup.original_name+'". ¿Quieres guardar otra copia vinculada a este registro?'))return null;
 const dt=meta.document_date||isoToday(),year=dt.slice(0,4),month=dt.slice(5,7),q='T'+qtrFromDate(dt),sc=meta.store_id?(O.stores.find(s=>s.id===meta.store_id)?.code||'TIENDA'):'GENERAL';
 const kind=safeSegment(meta.doc_type||'otro')||'otro',party=safeSegment(meta.supplier_or_customer||'SIN_PROVEEDOR')||'SIN_PROVEEDOR';
 const path=[year,q,month,sc,kind,party,crypto.randomUUID()+'_'+safeSegment(file.name)].join('/');
 const {error:upErr}=await sb.storage.from('business-documents').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(upErr)throw upErr;
 const row={store_id:meta.store_id||null,doc_type:meta.doc_type||'factura_recibida',document_date:dt,supplier_or_customer:meta.supplier_or_customer||'',tax_id:meta.tax_id||'',invoice_number:meta.invoice_number||'',category_code:meta.category_code||'',status:meta.status||'pendiente',storage_path:path,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:sha,linked_entity_type:linkedType,linked_entity_id:linkedId,notes:meta.notes||'',uploaded_by:authSession.user.id};
 const {data,error}=await sb.from('ops_documents').insert(row).select('id').single();if(error){await sb.storage.from('business-documents').remove([path]);throw error}
 return data.id;
}
window.opsDeleteExpense=async function(id){
 if(!manager())return alert('Solo administración o gerencia puede eliminar gastos.');
 const e=O.expenses.find(x=>x.id===id);if(!e)return;
 const origin=e.source==='manual'?'manual':'importado ('+e.source+')';
 const reason=await askReason('Eliminar gasto',`Vas a eliminar el gasto de ${e.supplier_name} del ${dmy(e.expense_date)} · ${origin}. Se conservará una copia completa en el historial administrativo.`,'Eliminar definitivamente');
 if(!reason)return;
 try{
  const {data,error}=await sb.rpc('ops_delete_expense_controlled',{p_expense_id:id,p_reason:reason});if(error)throw error;
  for(const path of (data?.storage_paths||[])){const rm=await sb.storage.from('business-documents').remove([path]);if(rm.error)console.warn('Archivo físico pendiente de limpieza:',rm.error.message)}
  await load(true);O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()];O.expenseView='list';render();
 }catch(err){alert('No se pudo eliminar el gasto: '+err.message)}
};
window.opsRemoveExpenseDocument=async function(docId){
 if(!manager())return alert('Solo administración o gerencia puede quitar adjuntos.');
 const d=O.documents.find(x=>x.id===docId);if(!d)return;
 const reason=await askReason('Quitar factura adjunta',`Se desvinculará y eliminará del archivo de Totus "${d.original_name}". El gasto seguirá existiendo.`,'Quitar factura');
 if(!reason)return;
 try{
  const {data,error}=await sb.rpc('ops_delete_document_controlled',{p_document_id:docId,p_reason:reason});if(error)throw error;
  if(data?.storage_path){const rm=await sb.storage.from('business-documents').remove([data.storage_path]);if(rm.error)console.warn('Archivo físico pendiente de limpieza:',rm.error.message)}
  await load(true);render();
 }catch(err){alert('No se pudo quitar el adjunto: '+err.message)}
};

window.opsSaveExpense=async function(){
 if(O.saving)return;const d=O.expenseDraft;if(!d.date||!d.supplier.trim()){alert('Fecha y proveedor son obligatorios.');return}
 if(d.date>isoToday()){alert('No puedes registrar un gasto con fecha futura.');return}
 if(d.paidDate&&d.paidDate>isoToday()){alert('La fecha de pago no puede estar en el futuro.');return}
 if(['factura','rectificativa'].includes(d.documentKind)&&!d.invoice.trim()){alert('Indica el número de la '+(d.documentKind==='rectificativa'?'rectificativa / abono':'factura')+'.');return}
 if(!O.expenseDraftLines.length||O.expenseDraftLines.every(l=>String(l.base).trim()==='')){alert('Añade al menos una línea con base.');return}
 for(const [i,l] of O.expenseDraftLines.entries()){
  if(String(l.base).trim()==='')continue;
  const base=n(l.base),rates=[['IVA',n(l.vat)],['RE',n(l.re)],['Retención',n(l.withholding)]];
  if(d.documentKind!=='rectificativa'&&base<=0){alert('La base de la línea '+(i+1)+' debe ser mayor que cero. Para abonos usa tipo Rectificativa / abono.');return}
  if(d.documentKind==='rectificativa'&&base===0){alert('La base de la línea '+(i+1)+' no puede ser cero.');return}
  const bad=rates.find(([,v])=>v<0||v>100);if(bad){alert(bad[0]+' de la línea '+(i+1)+' debe estar entre 0 y 100 %.');return}
 }
 const previewTotals=draftExpenseTotals(),paid=d.amountPaid===''?null:n(d.amountPaid);
 if(d.documentKind!=='rectificativa'){
  if(d.paidStatus==='pendiente'&&paid!=null&&Math.abs(paid)>.001){alert('Un gasto pendiente no puede tener importe pagado.');return}
  if(d.paidStatus==='parcial'&&(paid==null||paid<=0||paid>=previewTotals.payable)){alert('En pago parcial, el importe pagado debe ser mayor que 0 y menor que el total a pagar.');return}
  if(d.paidStatus==='pagado'&&paid!=null&&paid<0){alert('El importe pagado no puede ser negativo.');return}
  if(d.paidStatus==='pagado'&&paid!=null&&paid>previewTotals.payable+.01){alert('El importe pagado no puede superar el total a pagar.');return}
 }
 if(d.invoice){
  const dup=O.expenses.find(e=>e.id!==d.id&&e.invoice_number.trim().toLowerCase()===d.invoice.trim().toLowerCase()&&(
   (d.supplierId&&e.supplier_id===d.supplierId)||
   (d.taxId&&e.supplier_tax_id&&e.supplier_tax_id.trim().toLowerCase()===d.taxId.trim().toLowerCase())||
   (!d.supplierId&&!d.taxId&&e.supplier_name.trim().toLowerCase()===d.supplier.trim().toLowerCase())
 ));
  if(dup&&!confirm('Ya existe una factura con ese proveedor y número ('+dmy(dup.expense_date)+'). ¿Continuar de todos modos?'))return;
 }
 O.saving=true;
 try{
   const file=document.getElementById('ops_exp_file')?.files?.[0];
   validateDocFile(file);
   const totals=draftExpenseTotals();
   const payload={id:d.id||null,store_id:d.storeId||null,supplier_id:d.supplierId||null,expense_date:d.date,supplier_name:d.supplier.trim(),supplier_tax_id:d.taxId.trim(),invoice_number:d.invoice.trim(),description:O.expenseDraftLines.map(l=>l.description).filter(Boolean).join(' · '),payment_method:d.payment,paid_status:d.paidStatus,paid_date:d.paidStatus==='pendiente'?null:(d.paidDate||d.date),amount_paid:d.paidStatus==='pendiente'?0:(d.amountPaid!==''?n(d.amountPaid):totals.payable),notes:d.notes||'',document_kind:d.documentKind,fiscal_reviewed:d.managementOnly?false:!!d.fiscalReviewed,management_only:!!d.managementOnly};
   const lines=O.expenseDraftLines.map((l,i)=>({sort_order:(i+1)*10,category_id:l.categoryId||null,description:l.description||category(l.categoryId)?.name||'',base_amount:n(l.base),vat_rate:n(l.vat),re_rate:n(l.re),withholding_rate:n(l.withholding),withholding_model:d.managementOnly?null:(l.model||null),deductible_irpf:d.managementOnly?false:l.deductible!==false,deductible_pct:d.managementOnly?0:Math.min(100,Math.max(0,n(l.deductiblePct??100))),fixed_asset:!!l.fixed,notes:''}));
   const {data:id,error}=await sb.rpc('ops_save_expense',{p_expense:payload,p_lines:lines});if(error)throw error;
   if(file){
     try{
      const cat=category(O.expenseDraftLines[0]?.categoryId);
      const previousDocId=d.id?O.expenses.find(x=>x.id===d.id)?.document_id:null;
      const docId=await uploadDoc(file,{store_id:d.storeId||null,doc_type:'factura_recibida',document_date:d.date,supplier_or_customer:d.supplier,tax_id:d.taxId,invoice_number:d.invoice,category_code:cat?.manager_code||'',status:d.paidStatus==='pagado'?'pagada':'pendiente',notes:d.notes},'expense',id);
      if(docId){
       const link=await sb.rpc('ops_link_expense_document',{p_expense_id:id,p_document_id:docId});if(link.error)throw link.error;
       if(previousDocId&&previousDocId!==docId&&manager()){
        const oldDoc=O.documents.find(x=>x.id===previousDocId);
        const rmDb=await sb.rpc('ops_delete_document_controlled',{p_document_id:previousDocId,p_reason:'Sustituido por un nuevo adjunto desde la ficha de gasto.'});
        if(!rmDb.error&&oldDoc?.storage_path)await sb.storage.from('business-documents').remove([oldDoc.storage_path]);
       }
      }
     }catch(uploadError){
      await audit('gastos',d.id?'actualizar':'crear',id,{fecha:d.date,proveedor:d.supplier,total:totals.accounting,adjunto:'fallido'});
      focusPeriodForDate(d.date);await load(true);O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()];O.expenseView='list';render();
      alert('El gasto se ha guardado, pero el archivo adjunto no pudo subirse: '+uploadError.message+'\nPuedes abrir el gasto y adjuntarlo de nuevo.');
      return;
     }
   }
   await audit('gastos',d.id?'actualizar':'crear',id,{fecha:d.date,proveedor:d.supplier,total:totals.accounting});
   focusPeriodForDate(d.date);await load(true);O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()];O.expenseView='list';render();
 }catch(e){alert('No se pudo guardar el gasto: '+e.message)}finally{O.saving=false}
};

function docMatches(d){
 const f=O.docFilter;
 return (!f.from||d.document_date>=f.from)&&(!f.to||d.document_date<=f.to)&&(f.store==='all'||d.store_id===f.store)&&(f.status==='all'||d.status===f.status)&&(f.type==='all'||d.doc_type===f.type)&&(!f.q||[d.supplier_or_customer,d.tax_id,d.invoice_number,d.original_name,d.notes,d.doc_type,d.category_code].join(' ').toLowerCase().includes(f.q.toLowerCase()));
}
window.opsDocFilter=function(k,v,soft=false){
 const prev=O.docFilter[k];O.docFilter[k]=v;
 if(O.docFilter.from&&O.docFilter.to&&O.docFilter.from>O.docFilter.to){O.docFilter[k]=prev;alert('La fecha "Desde" no puede ser posterior a "Hasta".');return render()}
 if(!soft)render();else{clearTimeout(window.__opsDocTimer);window.__opsDocTimer=setTimeout(render,200)}
};
window.opsResetDocFilters=function(){O.docFilter={from:'',to:'',store:'all',status:'all',type:'all',q:''};O.docSelected=[];render()};
window.opsUploadStandaloneDoc=async function(){
 const file=document.getElementById('ops_doc_file')?.files?.[0];if(!file){alert('Selecciona un archivo.');return}
 const date=document.getElementById('ops_doc_date')?.value||isoToday(),type=document.getElementById('ops_doc_type')?.value||'otro',party=document.getElementById('ops_doc_party')?.value?.trim()||'',number=document.getElementById('ops_doc_invoice')?.value?.trim()||'';
 if(date>isoToday())return alert('No puedes archivar un documento con fecha futura.');
 if(['factura_recibida','factura_emitida','factura_rectificativa','proforma'].includes(type)&&!party)return alert('Indica el proveedor o cliente del documento.');
 if(['factura_recibida','factura_emitida','factura_rectificativa','proforma'].includes(type)&&!number)return alert('Indica el número del documento.');
 const duplicateMeta=party&&number&&O.documents.find(d=>String(d.supplier_or_customer||'').trim().toLowerCase()===party.toLowerCase()&&String(d.invoice_number||'').trim().toLowerCase()===number.toLowerCase());
 if(duplicateMeta&&!confirm('Ya existe un documento de "'+duplicateMeta.supplier_or_customer+'" con el número "'+duplicateMeta.invoice_number+'". ¿Quieres archivarlo igualmente?'))return;
 try{
  const id=await uploadDoc(file,{store_id:document.getElementById('ops_doc_store').value||null,doc_type:type,document_date:date,supplier_or_customer:party,tax_id:document.getElementById('ops_doc_tax').value.trim(),invoice_number:number,status:document.getElementById('ops_doc_status').value,notes:document.getElementById('ops_doc_notes')?.value?.trim()||''},'standalone',null);
  if(!id)return;
  await audit('documentos','subir',id,{archivo:file.name,tipo:type,fecha:date});await load(true);render();
 }catch(e){const msg=String(e?.message||e);alert(/espacio total disponible/i.test(msg)?msg:'No se pudo subir: '+msg)}
};
window.opsDownloadDoc=async function(id){
 const d=O.documents.find(x=>x.id===id);if(!d)return;const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);if(error){alert(error.message);return}dlBlob(data,d.original_name);
};
window.opsSetDocStatus=async function(id,status){if(!manager())return alert('Solo administración o gerencia puede cambiar el estado documental.');const d=O.documents.find(x=>x.id===id),previous=d?.status||'pendiente';const {error}=await sb.from('ops_documents').update({status}).eq('id',id);if(error){if(d)d.status=previous;render();alert('No se pudo cambiar el estado: '+error.message);return}if(d)d.status=status;await audit('documentos','estado',id,{status});};

window.opsPlannedSpend=function(v){O.plannedSpend=v;if(typeof window.__opsUpdateFiscalSimulation==='function')window.__opsUpdateFiscalSimulation()};
function docArchiveFolder(d,root='04_DOCUMENTOS'){
 const dt=d.document_date||'sin_fecha',year=dt.slice(0,4)||'SIN_ANO',month=dt.slice(5,7)||'SIN_MES';
 const q=dt&&dt.length>=7?'T'+qtrFromDate(dt):'SIN_TRIMESTRE';
 const store=d.store_id?(O.stores.find(s=>s.id===d.store_id)?.code||'TIENDA'):'GENERAL';
 const type=safeSegment(d.doc_type||'otro')||'otro';
 const party=safeSegment(d.supplier_or_customer||'SIN_PROVEEDOR')||'SIN_PROVEEDOR';
 return [root,year,q,month,store,type,party].join('/');
}
async function zipDocs(docs,zip,root='04_DOCUMENTOS'){
 let done=0;
 const sorted=[...docs].sort((a,b)=>String(a.document_date||'').localeCompare(String(b.document_date||''))||String(a.supplier_or_customer||'').localeCompare(String(b.supplier_or_customer||'')));
 for(const d of sorted){
  const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);if(error)continue;
  const inv=safeSegment(d.invoice_number||'SIN_NUMERO')||'SIN_NUMERO';
  const original=safeSegment(d.original_name||'documento')||'documento';
  const name=`${d.document_date||'sin_fecha'}_${inv}_${original}`;
  zip.file(docArchiveFolder(d,root)+'/'+name,data);done++;
 }
 return done;
}
window.opsZipFilteredDocs=async function(){
 if(!window.JSZip){alert('ZIP no disponible.');return}
 const docs=O.documents.filter(docMatches);if(!docs.length){alert('No hay documentos con esos filtros.');return}
 const z=new JSZip();
 const done=await zipDocs(docs,z,'DOCUMENTOS');
 if(done!==docs.length)return alert(`No se pudieron recuperar ${docs.length-done} documentos. No se ha generado un ZIP incompleto.`);
 dlBlob(await z.generateAsync({type:'blob'}),`documentos_filtrados_${isoToday()}.zip`);
};
window.opsZipReportDocs=async function(){
 if(!window.JSZip)return alert('ZIP no disponible.');
 const docs=O.documents.filter(d=>inRange(d.document_date,O.reportFrom,O.reportTo));
 if(!docs.length)return alert('No hay documentos en esa franja.');
 const z=new JSZip();
 const done=await zipDocs(docs,z,'DOCUMENTOS');
 if(done!==docs.length)return alert(`No se pudieron recuperar ${docs.length-done} documentos. No se ha generado un ZIP incompleto.`);
 dlBlob(await z.generateAsync({type:'blob'}),`documentos_${O.reportFrom}_${O.reportTo}.zip`);
};
window.opsSaveSettings=async function(){
 if(!adminOnly())return;
 const get=id=>document.getElementById(id),email=(get('ops_set_email')?.value||'').trim();
 const row={
  business_name:(get('ops_set_name')?.value||'').trim(),business_address:(get('ops_set_address')?.value||'').trim(),business_email:email,business_phone:(get('ops_set_phone')?.value||'').trim(),tax_id:(get('ops_set_tax')?.value||'').trim(),
  fiscal_regime:get('ops_set_regime')?.value||O.settings.fiscal_regime,estimation_method:get('ops_set_estimation')?.value||O.settings.estimation_method,
  irpf_prepayment_rate:n(get('ops_set_irpf')?.value),difficult_expense_enabled:!!get('ops_set_diff_enabled')?.checked,
  difficult_expense_pct:n(get('ops_set_diff_pct')?.value),difficult_expense_annual_cap:n(get('ops_set_diff_cap')?.value),
  default_sales_vat_rate:n(get('ops_set_vat')?.value),reta_generic_deduction_pct:n(get('ops_set_reta_ded')?.value),
  reta_total_rate:n(get('ops_set_reta_rate')?.value),actual_reta_monthly:n(get('ops_set_reta')?.value)||null,previous_year_net_income:n(get('ops_set_prevnet')?.value)||null,
  target_operating_margin_pct:n(get('ops_set_target_margin')?.value),
  storage_limit_bytes:Math.round(n(get('ops_set_storage_mb')?.value)*1048576),
  document_max_bytes:Math.round(n(get('ops_set_doc_mb')?.value)*1048576),
  fiscal_notes:get('ops_set_fiscal_notes')?.value||'',current_year:O.year
 };
 if(!row.business_name||!row.tax_id)return alert('Nombre/titular y NIF/CIF son obligatorios.');
 if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return alert('El email de empresa no tiene un formato válido.');
 const pctFields=[['Pago fraccionado IRPF',row.irpf_prepayment_rate],['IVA ventas',row.default_sales_vat_rate],['Difícil justificación',row.difficult_expense_pct],['Deducción RETA',row.reta_generic_deduction_pct],['Tipo RETA',row.reta_total_rate],['Margen objetivo',row.target_operating_margin_pct]];
 if(pctFields.some(([,v])=>v<0||v>100))return alert('Los porcentajes deben estar entre 0 y 100.');
 if(row.difficult_expense_annual_cap<0)return alert('El tope anual no puede ser negativo.');
 if(row.storage_limit_bytes<=0||row.document_max_bytes<=0)return alert('Los límites de almacenamiento deben ser mayores que cero.');
 if(row.document_max_bytes>row.storage_limit_bytes)return alert('El tamaño máximo por documento no puede superar el límite total de almacenamiento.');
 const settingsId=O.settings?.id??1;const {error}=await sb.from('ops_business_settings').update(row).eq('id',settingsId);if(error){alert(error.message);return}
 await audit('config','actualizar',null,{campos:Object.keys(row)});await load(true);render();alert('Configuración guardada.');
};

function documentUploadHasUserInput(){
 if(O.tab!=='documentos')return false;
 const file=document.getElementById('ops_doc_file')?.files?.[0];
 const val=id=>document.getElementById(id)?.value||'';
 return !!file||val('ops_doc_date')&&val('ops_doc_date')!==isoToday()||!!val('ops_doc_store')||val('ops_doc_type')&&val('ops_doc_type')!=='factura_recibida'||val('ops_doc_status')&&val('ops_doc_status')!=='pendiente'||['ops_doc_party','ops_doc_tax','ops_doc_invoice','ops_doc_notes'].some(id=>String(val(id)).trim());
}
function confirmDiscardPreparedDocument(action='continuar'){
 return !documentUploadHasUserInput()||confirm('Hay un documento preparado para subir. ¿'+action+' y descartar esos datos?');
}
window.opsTab=function(tab){if(tab!==O.tab&&!confirmDiscardPreparedDocument('Cambiar de pestaña'))return;O.tab=tab;if(tab==='cajas'&&!O.closeDraft)O.closeDraft=newClosingDraft();if(tab==='gastos'&&!O.expenseDraft){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()]}render();window.scrollTo({top:0,behavior:'smooth'})};
window.opsSetYear=function(v){if(!confirmDiscardPreparedDocument('Cambiar de año'))return;O.year=+v;O.reportFrom=`${O.year}-01-01`;O.reportTo=`${O.year}-12-31`;O.invoiceDraft=null;render()};
window.opsSetQuarter=function(v){if(!confirmDiscardPreparedDocument('Cambiar de trimestre'))return;O.quarter=+v;render()};
window.opsSetStore=function(v){if(!confirmDiscardPreparedDocument('Cambiar de establecimiento'))return;O.storeId=v;O.closeDraft=null;O.expenseDraft=null;O.invoiceDraft=null;render()};

window.opsEnsurePortalData=async function(){
 if(O.loaded||O.loading)return;
 try{
  await load();
  await window.TotusGestionFeatures?.load?.();
  if(state.page==='portal')render();
 }catch(e){console.warn('Inicio operativo:',e?.message||e)}
};

window.goOps=async function(tab='resumen'){
 if((tab||'resumen')!==O.tab&&!confirmDiscardPreparedDocument('Cambiar de módulo'))return;
 O.tab=tab||'resumen';
 state.page='management';state.familyId=null;state.productId=null;state.dirty=false;
 render();
 try{
   await load();
   await window.TotusGestionFeatures?.load?.();
   if(O.tab==='cajas'&&(!O.closeDraft?.storeId||!O.stores.some(s=>s.id===O.closeDraft.storeId)))O.closeDraft=newClosingDraft();
   if(O.tab==='gastos'&&(!O.expenseDraft?.storeId||!O.stores.some(s=>s.id===O.expenseDraft.storeId))){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()]}
   render();
 }catch(e){document.getElementById('main').innerHTML=`<div class="head"><div><div class="eyebrow">${sectionMeta()[1]}</div><h1>No se pudo cargar ${sectionMeta()[0].toLowerCase()}</h1><p>${h(e.message)}</p></div></div>`}
};

if(state.page==='portal')setTimeout(()=>window.opsEnsurePortalData?.(),0);

function enhanceResponsiveTables(root=document){
 root.querySelectorAll('.ops-table').forEach(table=>{
   table.classList.add('ops-responsive-table');
   const headers=[...table.querySelectorAll('thead th')].map((th,i)=>th.textContent.trim()||(i===0?'Seleccionar':''));
   table.querySelectorAll('tbody tr').forEach(tr=>{
     [...tr.children].forEach((td,i)=>{if(!td.dataset.label)td.dataset.label=headers[i]||''});
   });
 });
}
const pricingRender=render;
render=function(){
 if(state.page==='management'){
   document.querySelectorAll('.nav button').forEach(b=>{
     const active=b.dataset.opsTab===O.tab || (b.dataset.page==='admin'&&O.tab==='config');
     b.classList.toggle('active',active);
   });
   document.querySelector('.search')?.classList.add('hidden');
   document.getElementById('savebar')?.classList.add('hidden');
   const m=document.getElementById('main');if(m){m.innerHTML=managementHtml();enhanceResponsiveTables(m)}
   return;
 }
 pricingRender();
 const m=document.getElementById('main');if(m)enhanceResponsiveTables(m);
};

})();