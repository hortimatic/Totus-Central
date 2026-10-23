// Vista sin motor de IA: ChatGPT guarda resultados estructurados en Supabase.
// Este módulo solo muestra los informes, sin modificar existencias de PrestaShop.
import {state,getView,getFilters} from './state.js';
import {esc,fmtDate} from './utils.js';
import {btn,table,kpi} from './components.js';

const STATES={
  pendiente:'Pendiente de revisión',
  con_diferencias:'Con diferencias',
  sin_diferencias:'Sin diferencias verificadas',
  incompleto:'Incompleto'
};
const numberValue=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const qty=value=>{
  const n=numberValue(value);
  return n===null?'—':new Intl.NumberFormat('es-ES',{maximumFractionDigits:6}).format(n);
};
export function cotejoLineStatus(row){
  const expected=numberValue(row?.expected),recorded=numberValue(row?.recorded);
  const adjustment=numberValue(row?.adjustment)??0;
  if(!row?.matchConfirmed||!row?.unit||expected===null||recorded===null)return {kind:'pending',received:null,difference:null};
  // Los ajustes externos solo se restan cuando sabemos que están incluidos en P.
  if(adjustment!==0&&!['yes','no'].includes(row.adjustmentIncluded))return {kind:'pending',received:null,difference:null};
  const received=recorded-(adjustment!==0&&row.adjustmentIncluded==='yes'?adjustment:0);
  const difference=Math.round((received-expected)*1e6)/1e6;
  return {kind:difference===0?'ok':'difference',received,difference};
}
export function cotejoSummary(rows=[]){
  const result={ok:0,difference:0,pending:0};
  for(const row of rows)result[cotejoLineStatus(row).kind]++;
  return result;
}
const labelStatus=kind=>kind==='ok'?'<span class="badge good">Correcto</span>':kind==='difference'?'<span class="badge bad">Diferencia</span>':'<span class="badge warn">Por confirmar</span>';
const storeName=shop=>shop==='NewOldSmok'?'NewOldSmok':shop==='Hortimatic'?'Hortimatic':String(shop||'Sin asignar');
const docNames=documents=>(Array.isArray(documents)?documents:[]).map(d=>esc(typeof d==='string'?d:d?.name||d?.file||'Archivo sin nombre')).join(' · ');
const rowLabel=row=>esc(row.supplierProduct||'Sin identificación')+' <span class="small muted">↔ '+esc(row.stockProduct||'Sin correspondencia')+'</span>';
const information=record=>{
  const rows=Array.isArray(record.rows)?record.rows:[];
  const totals=cotejoSummary(rows);
  return {rows,totals};
};

export function cotejos(){
  const records=Array.isArray(state.data.cotejos)?state.data.cotejos:[];
  const error=state.data.cotejosError||'';
  const view=getView('cotejos');
  const note='<p class="note">El análisis se realiza en el chat de ChatGPT. Adjunta allí la factura o albarán y las entradas de stock de PrestaShop, e indica tienda y lote. Esta pantalla solo presenta los cotejos guardados; no altera el stock.</p>';
  if(view.id){
    const r=records.find(item=>item.id===view.id);
    if(!r)return '<div class="page"><section class="card card-pad"><h2>Cotejo no encontrado</h2>'+btn('Volver','stock-back','secondary')+'</section></div>';
    const {rows,totals}=information(r);
    const headers=[
      {label:'Proveedor ↔ PrestaShop',html:row=>'<b>'+rowLabel(row)+'</b><div class="small muted">'+esc(row.evidence||'Sin evidencia de correspondencia')+'</div>'},
      {label:'Unidad',html:row=>esc(row.unit||'Sin verificar')},
      {label:'Facturado',num:true,html:row=>qty(row.expected)},
      {label:'Registrado',num:true,html:row=>qty(row.recorded)},
      {label:'Ajuste',num:true,html:row=>qty(row.adjustment??0)},
      {label:'Recepción',num:true,html:row=>qty(cotejoLineStatus(row).received)},
      {label:'Diferencia',num:true,html:row=>qty(cotejoLineStatus(row).difference)},
      {label:'Estado',html:row=>labelStatus(cotejoLineStatus(row).kind)},
      {label:'Acción y fuente',html:row=>'<div>'+esc(row.action||'—')+'</div><div class="small muted">'+esc([row.sourceSupplier,row.sourceStock].filter(Boolean).join(' · '))+'</div>'}
    ];
    return '<div class="page"><div class="record-toolbar"><div>'+btn('← Volver al historial','stock-back','secondary')+
      '<div class="eyebrow">Cotejo de mercancía</div><h2>'+esc(storeName(r.shop))+' · '+esc(r.supplier||'Proveedor sin identificar')+'</h2>'+
      '<p class="muted">'+esc(r.reference||'Sin referencia')+' · '+fmtDate(r.received_on||r.created_at)+'</p></div>'+
      '<span class="badge '+(r.status==='sin_diferencias'&&r.complete?'good':r.status==='con_diferencias'?'bad':'warn')+'">'+esc(STATES[r.status]||'Pendiente')+'</span></div>'+
      '<div class="kpis">'+kpi('Productos correctos',String(totals.ok))+kpi('Diferencias',String(totals.difference))+
      kpi('Pendientes',String(totals.pending))+kpi('Líneas revisadas',String(rows.length))+'</div>'+
      '<section class="card card-pad"><h3>Documentación y cobertura</h3><p>'+esc(r.coverage||'Cobertura no especificada')+'</p>'+
      (docNames(r.documents)?'<p class="small muted">'+docNames(r.documents)+'</p>':'')+
      (Array.isArray(r.warnings)&&r.warnings.length?'<div class="note warn">'+r.warnings.map(w=>'<p>'+esc(w)+'</p>').join('')+'</div>':'')+
      (r.complete?'':'<p class="note warn">Informe incompleto: no está verificada toda la documentación.</p>')+'</section>'+
      '<section class="card table-card"><div class="section-head card-pad"><div><h2>Detalle de productos</h2><p>Unidades comparadas solo cuando el producto y el formato están confirmados. Diferencia = entrada atribuible a recepción − cantidad del proveedor.</p></div></div>'+
      table(headers,rows,{emptyTitle:'No hay líneas analizadas',emptyText:'No se ha guardado el detalle de este cotejo.'})+'</section>'+
      '<section class="card card-pad"><h3>Continuar la revisión</h3>'+note+'<p>Para corregir una equivalencia o justificar una regularización, indícalo en el mismo chat del lote: conservaremos la evidencia y actualizaremos el resultado.</p></section></div>';
  }
  const f=getFilters('cotejos'),query=String(f.query||'').toLocaleLowerCase('es');
  const selected=records.filter(r=>(!f.shop||f.shop==='all'||r.shop===f.shop)&&(!f.status||f.status==='all'||r.status===f.status)&&
    (!query||[r.shop,r.supplier,r.reference,r.status,r.coverage].some(v=>String(v||'').toLocaleLowerCase('es').includes(query))));
  const pending=records.filter(r=>!r.complete||r.status==='incompleto'||r.status==='pendiente').length;
  const headings=[
    {label:'Lote',html:r=>'<b>'+esc(r.reference||'Sin número')+'</b><div class="small muted">'+fmtDate(r.received_on||r.created_at)+'</div>'},
    {label:'Tienda',html:r=>esc(storeName(r.shop))},
    {label:'Proveedor',html:r=>esc(r.supplier||'Sin identificar')},
    {label:'Productos',num:true,html:r=>String(information(r).rows.length)},
    {label:'Incidencias',num:true,html:r=>{const totals=information(r).totals;return totals.difference+' diferencias · '+totals.pending+' pendientes'}},
    {label:'Estado',html:r=>'<span class="badge '+(r.status==='sin_diferencias'&&r.complete?'good':r.status==='con_diferencias'?'bad':'warn')+'">'+esc(STATES[r.status]||'Pendiente')+'</span>'},
    {label:'',html:r=>btn('Ver cotejo','stock-open','secondary','data-id="'+esc(r.id)+'"')}
  ];
  return '<div class="page"><div class="kpis">'+kpi('Cotejos guardados',String(records.length))+
    kpi('Por revisar',String(pending))+kpi('Con diferencias',String(records.filter(r=>r.status==='con_diferencias').length))+'</div>'+
    '<section class="card card-pad"><h2>Cotejo de mercancía</h2>'+note+
    '<p class="small muted">La herramienta no necesita una API de IA. ChatGPT lee los documentos y guarda el informe en Supabase; este módulo lo muestra.</p></section>'+
    '<section class="card table-card"><div class="section-head card-pad"><div><h2>Historial de recepciones</h2><p>Selecciona un lote para consultar todas sus líneas, incidencias y fuentes.</p></div>'+
    btn('Actualizar','stock-refresh','secondary')+'</div>'+
    (error?'<div class="note warn" role="alert">No se pudieron consultar los cotejos: '+esc(error)+'. Las demás secciones de Totus Central siguen disponibles.</div>':'')+
    '<div class="document-filters"><div class="field"><label for="stockShopFilter">Tienda</label><select id="stockShopFilter">'+
    [['all','Ambas tiendas'],['NewOldSmok','NewOldSmok'],['Hortimatic','Hortimatic']].map(([v,l])=>'<option value="'+v+'" '+((f.shop||'all')===v?'selected':'')+'>'+l+'</option>').join('')+'</select></div>'+
    '<div class="field"><label for="stockStatusFilter">Estado</label><select id="stockStatusFilter">'+
    [['all','Todos'],...Object.entries(STATES)].map(([v,l])=>'<option value="'+v+'" '+((f.status||'all')===v?'selected':'')+'>'+esc(l)+'</option>').join('')+
    '</select></div><div class="field"><label for="stockQueryFilter">Buscar lote o proveedor</label><input id="stockQueryFilter" value="'+esc(f.query||'')+'" placeholder="Proveedor o número de factura"></div>'+
    btn('Buscar','stock-search','secondary')+'</div>'+
    table(headings,selected,{emptyTitle:'Sin cotejos',emptyText:error?'Comprueba el error de conexión.':'Pasa una factura y las entradas de PrestaShop a este chat. Los resultados guardados aparecerán aquí.'})+
    '</section></div>';
}
