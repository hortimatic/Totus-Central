import {canUser} from './permissions.js';
import {state} from './state.js';
import {esc,fmtDate,isoToday,download} from './utils.js';
import {btn,table,formField,selectField,modal,closeModal,toast,confirmAction} from './components.js';
import {STOCK_STATES,stockLineResult,stockCorrectedLineResult,stockSummary,stockChatPrompt} from './stock-core.js';
import {filterStockReceipts,sameStockEquivalence,stockIdentity,stockExportRows,stockReportHtml,stockChatEvidence} from './stock-workflow.js';
const initialView=()=>({loaded:false,receipts:[],context:null,history:[],mode:'list',query:'',store:'all',from:'',to:'',status:'all',error:'',pendingUploads:[],equivalences:[],libraryQuery:'',libraryStore:'all'});
const view=initialView();let owner='',navigationEpoch=0;
const actorKey=()=>String(state.user?.email||'').toLowerCase();
function syncOwner(){if(owner!==actorKey()){owner=actorKey();navigationEpoch++;Object.assign(view,initialView());}}
const readScope=()=>JSON.stringify([actorKey(),state.route,navigationEpoch]);
const currentRead=scope=>scope===readScope();
const storeName=id=>state.data.stores.find(s=>s.id===id)?.name||'Tienda';
const label=code=>STOCK_STATES[code]||code;
const badge=code=>'<span class="badge '+((code==='matched'||code==='reviewed')?'good':code==='differences'?'bad':'warn')+'">'+esc(label(code))+'</span>';
const action=(label,name,attrs='')=>btn(label,name,'secondary',attrs);
const quantity=value=>value==null?'Pendiente':Number(value).toLocaleString('es-ES',{maximumFractionDigits:6});
const canEdit=()=>canUser(state.user,'documentos','edit',state.data.userPermissions||[]);
const canManage=()=>['admin','gerente'].includes(state.user?.role)&&canEdit();
const canCreateSupplier=()=>canUser(state.user,'gastos','create',state.data.userPermissions||[]);
const stockModal=(title,body,options)=>modal(title,'<div class="stock-modal">'+body+'</div>',options);
const back=()=>'<div class="record-toolbar"><div>'+btn('← Volver a recepciones','stock-back','link')+'</div></div>';
function supplierField(id,current=''){
 const suppliers=(state.data.suppliers||[]).filter(s=>s.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const options=[{value:'',label:'Selecciona un proveedor'},...suppliers.map(s=>({value:s.name,label:s.name}))];
 if(current&&!suppliers.some(s=>s.name===current))options.push({value:current,label:current});
 return '<div class="stock-supplier-field">'+selectField('Proveedor',id,options,current,'required')+
 (canCreateSupplier()?action('+ Nuevo proveedor','stock-supplier-new','data-target="'+id+'"'):'')+'</div>';
}
const uploadInput=(label,id)=>'<label class="stock-file-field">'+label+'<input id="'+id+'" type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.webp" multiple></label>';
function sourceCard(source){
 const d=source.document||{},kind=source.source_kind==='supplier'?'Proveedor':'Entrada de PrestaShop';
 const status=source.extraction?.state==='ready'?'Texto disponible':source.extraction?.state==='partial'?'Lectura parcial':'Necesita leer el original';
 return '<article class="stock-source"><div><b>'+esc(d.original_name||'Documento')+'</b><small>'+kind+' · '+status+'</small></div><div class="inline-actions">'+action('Ver original','stock-preview','data-id="'+esc(d.id)+'"')+action('Ver texto','stock-text','data-id="'+esc(source.id)+'"')+(canEdit()?action('Quitar del pedido','stock-source-remove','data-id="'+esc(source.id)+'"'):'')+'</div></article>';
}
function receiptForm(){
 const stores=state.data.stores.filter(s=>s.active!==false).map(s=>({value:s.id,label:s.name}));
 return back()+'<section class="card card-pad stock-page"><div class="section-head"><div><h2>Nueva recepción</h2><p>Identifica el pedido y añade sus documentos en un solo paso.</p></div></div><div class="form-grid">'+selectField('Tienda','stockStore',stores,stores[0]?.value)+supplierField('stockSupplier')+formField('Pedido o referencia','stockReference','','text','maxlength="200"')+formField('Fecha de recepción','stockDate',isoToday(),'date','required max="'+isoToday()+'"')+'<label class="wide">Notas<textarea id="stockNotes" rows="3" maxlength="5000"></textarea></label></div>'+
 (canEdit()?'<fieldset class="stock-upload-box"><legend>Documentos del pedido · opcionales</legend><p>Puedes seleccionar varios archivos en cada lado y añadir más después.</p><div class="form-grid">'+uploadInput('Proveedor · factura o albarán','stockNewSupplierFiles')+uploadInput('PrestaShop · entrada de mercancía','stockNewPrestashopFiles')+'</div></fieldset>':'<p>Guarda la recepción. Para asociar archivos necesitas permiso de edición en Documentos.</p>')+
 '<div id="stockProgress" role="status" aria-live="polite"></div><div class="form-actions">'+btn('Guardar recepción y documentos','stock-create-save','primary')+'</div></section>';
}
function resultTable(receipt){
 const rows=receipt.result?.rows||[];
 if(!rows.length)return '<div class="note">Todavía no hay un resultado. Añade los documentos y entrega a ChatGPT la instrucción del paso 2.</div>';
 const summary=stockSummary(receipt.result,view.context?.sources||[]);
 return (summary.issues.length?'<div class="note warn">'+esc(summary.issues.map(issue=>(view.context?.sources||[]).reduce((text,source)=>text.replaceAll(source.id,source.document?.original_name||'Documento'),issue)).join(' · '))+'</div>':'')+table([
 {label:'Producto del proveedor',html:r=>esc(r.supplier_name||'Sin identificar')+'<small>'+esc([r.variant,r.unit].filter(Boolean).join(' · '))+'</small>'},
 {label:'Producto de PrestaShop',html:r=>esc(r.prestashop_name||'Sin identificar')},
 {label:'Unidades esperadas',num:true,html:r=>{const x=stockCorrectedLineResult(r);return quantity(x.expected)+(x.hasCorrection?'<small>Factura original: '+quantity(x.originalExpected)+'</small>':'');}},
 {label:'Unidades recibidas del pedido',num:true,html:r=>{const x=stockCorrectedLineResult(r);return quantity(x.received)+(x.hasCorrection?'<small>Entrada original: '+quantity(x.originalReceived)+'</small>':'');}},
 {label:'Diferencia',num:true,html:r=>{const x=stockCorrectedLineResult(r);return quantity(x.difference)+(x.hasCorrection?'<small>Diferencia documental: '+quantity(x.originalDifference)+'</small>':'');}},
 {label:'Revisión y origen',html:r=>{const calculated=stockLineResult(r),saved=(view.context.equivalences||[]).find(e=>sameStockEquivalence(e,r,receipt)&&Number(e.unit_factor)===Number(r.unit_factor));
 return badge(calculated.status)+(r.unit_correction?.reason?'<small><b>Corrección justificada:</b> '+esc(r.unit_correction.reason)+' · '+esc(r.unit_correction.corrected_by||'')+'</small>':'')+(calculated.reasons.length?'<small>'+esc(calculated.reasons.join(' · '))+'</small>':'')+'<details><summary>Ver origen y ajustes</summary>'+(r.source_refs||[]).map(ref=>'<p>'+esc(view.context.sources.find(s=>s.id===ref.source_id)?.document?.original_name||ref.source_id)+' · '+esc(ref.locator)+'</p>').join('')+'<p>Cantidad en factura: '+quantity(r.supplier_qty)+' · Unidades por paquete: '+quantity(r.unit_factor)+'</p>'+(r.conversion_reason?'<p>'+esc(r.conversion_reason)+'</p>':'')+'<p>Ajuste externo: '+quantity(r.adjustment_qty)+' · '+esc(r.adjustment_reason||'Sin ajuste indicado')+'</p></details>'+
 (saved?'<small>En la biblioteca de productos</small>':canManage()&&!calculated.reasons.length?action('Guardar equivalencia','stock-equivalence-new','data-line="'+esc(r.id)+'"'):'')+(canManage()&&stockLineResult(r).expected!==null&&stockLineResult(r).received!==null?action('Corregir unidades','stock-units-new','data-line="'+esc(r.id)+'"'):'');}}
 ],rows);
}
function receiptDetail(){
 const c=view.context,r=c?.receipt;if(!r)return '<section class="card card-pad" role="status">Cargando recepción…</section>';
 const sources=c.sources||[];
 const options=state.data.documents.filter(d=>!state.data.documentRemovals?.some(p=>p.id===d.id)&&!sources.some(s=>s.document_id===d.id)&&(!d.store_id||d.store_id===r.store_id))
 .map(d=>({value:d.id,label:[d.original_name,d.supplier_or_customer,d.invoice_number].filter(Boolean).join(' · ')}));
 const review=r.status==='reviewed'?r.result?.review:null;
 const reviewPanel=review?'<div class="note"><b>Revisado</b> · '+esc(review.reviewed_by||'')+' · '+esc(review.reviewed_at||'')+'<p><b>Justificación de la revisión:</b> '+esc(review.note||'')+'</p><small>Revisión cerrada y justificada. Las diferencias originales permanecen visibles y no implican una entrega adicional. Si cambia el cotejo o sus documentos habrá que revisarlo de nuevo.</small></div>':'';
 const reviewButton=canManage()&&['needs_review','differences'].includes(r.status)&&r.result?.rows?.length?action('Marcar como revisado','stock-review-new'):'';
 return back()+'<div class="stack stock-page">'+(view.error?'<div class="note warn" role="alert">'+esc(view.error)+'</div>':'')+
 '<section class="card card-pad"><div class="section-head"><div><h2>'+esc(r.supplier)+' · '+esc(r.reference||'Sin referencia')+'</h2><p>'+esc(storeName(r.store_id))+' · '+esc(fmtDate(r.received_on))+' · Revisión '+r.revision+'</p></div><div class="inline-actions">'+badge(r.status)+(canEdit()?action('Editar datos','stock-edit'):'')+action('Actualizar','stock-refresh')+'</div></div>'+(r.notes?'<p>'+esc(r.notes)+'</p>':'')+'</section>'+
 '<section class="card card-pad stock-step"><h3>1. Documentos del pedido</h3><p>La entrada de PrestaShop es el recuento realizado por el equipo. Estos adjuntos no crean gastos ni cambian existencias.</p>'+
 sources.map(sourceCard).join('')+(sources.length?'':'<div class="note">Añade la factura o albarán y la entrada de PrestaShop del mismo pedido.</div>')+
 (view.pendingUploads.length?'<div class="note warn"><b>'+view.pendingUploads.length+' archivo(s) pendientes de asociar</b><ul>'+view.pendingUploads.map(p=>'<li>'+esc(p.file.name)+' · '+(p.kind==='supplier'?'Proveedor':'PrestaShop')+'</li>').join('')+'</ul><div class="inline-actions">'+action('Reintentar archivos pendientes','stock-upload-retry-save')+action('Quitar archivos pendientes','stock-upload-discard')+'</div></div>':'')+
 (canEdit()?'<div class="stock-upload form-grid">'+selectField('Estos documentos son de','stockKind',[{value:'supplier',label:'Proveedor · factura o albarán'},{value:'prestashop',label:'PrestaShop · entrada de mercancía'}],'supplier')+
 uploadInput('Subir archivos','stockFiles')+'<div>'+btn('Añadir archivos','stock-upload-save','primary')+'</div></div><details><summary>Usar un documento ya guardado</summary><div class="form-grid">'+selectField('Documento','stockExisting',[{value:'',label:'Selecciona un documento'},...options],'')+'<div>'+action('Asociar documento','stock-existing-save')+'</div></div></details><small>Quitar del pedido conserva el original en Documentos y devuelve el cotejo a pendiente.</small>':'')+'<div id="stockProgress" role="status" aria-live="polite"></div></section>'+
 '<section class="card card-pad stock-step"><h3>2. Cotejar con ChatGPT</h3><p>Copia la instrucción y pégala en vuestro chat habitual con Supabase conectado. Después pulsa Actualizar para ver el resultado.</p><div class="inline-actions">'+btn('Copiar instrucción para ChatGPT','stock-prompt','primary')+action('Ver instrucción','stock-prompt-view')+action('Texto para ChatGPT','stock-evidence')+'</div><small>Los textos disponibles también se pueden consultar en Supabase. Si no hay texto o faltan páginas, ChatGPT debe leer el original antes de aceptar el cotejo.</small></section>'+
 '<section class="card card-pad stock-step"><div class="section-head"><h3>3. Resultado del cotejo</h3><div class="inline-actions">'+badge(r.status)+((r.result?.rows||[]).length?action('Descargar Excel','stock-export-xlsx')+action('Descargar informe','stock-export-html'):'')+reviewButton+'</div></div>'+reviewPanel+resultTable(r)+
 '<details><summary>Cómo se calcula</summary><p>Se comparan las unidades de la factura con las registradas en PrestaShop. Los paquetes se convierten a unidades cuando su tamaño está confirmado. Si la entrada incluye un ajuste ajeno al pedido, se descuenta para comparar solo la mercancía recibida. Una cantidad desconocida o una equivalencia sin confirmar queda pendiente.</p></details>'+
 '<details><summary>Historial de revisiones ('+view.history.length+')</summary>'+view.history.map(h=>'<div class="stock-history"><b>Revisión '+h.revision+'</b> · '+esc(fmtDate(h.created_at))+' · '+esc(h.actor_email)+'<small>'+esc(({created:'Recepción creada',source_added:'Documento asociado',source_removed:'Asociación retirada',result_saved:'Resultado guardado',units_corrected:'Unidades corregidas con justificación',reviewed:'Revisado con justificación',edited:'Datos modificados; cotejo pendiente'})[h.action]||h.action)+'</small>'+(h.action==='reviewed'&&h.review?.note?'<p><b>Justificación guardada:</b> '+esc(h.review.note)+'</p>':'')+(h.action==='units_corrected'&&h.unit_change?.reason?'<p><b>Corrección de unidades: </b>'+esc(h.unit_change.line_id||'')+' · '+esc(h.unit_change.previous_expected)+' / '+esc(h.unit_change.previous_received)+' → '+esc(h.unit_change.corrected_expected)+' / '+esc(h.unit_change.corrected_received)+'<br><b>Motivo:</b> '+esc(h.unit_change.reason)+'</p>':'')+'</div>').join('')+'</details></section></div>';
}
function libraryPage(){
 const q=stockIdentity(view.libraryQuery),rows=view.equivalences.filter(e=>(view.libraryStore==='all'||e.store_id===view.libraryStore)&&(!q||stockIdentity([e.supplier,e.supplier_name,e.prestashop_name,e.variant,e.unit].join(' ')).includes(q)));
 return back()+'<section class="card card-pad stock-page"><div class="section-head"><div><h2>Biblioteca de productos</h2><p>Equivalencias confirmadas para reutilizar al cotejar. Se conservan por tienda, proveedor, variante y unidad.</p></div>'+action('Actualizar biblioteca','stock-library-refresh')+'</div><div class="filters stock-filters">'+selectField('Tienda','stockLibraryStore',[{value:'all',label:'Todas'},...state.data.stores.map(s=>({value:s.id,label:s.name}))],view.libraryStore,'data-draft-ignore')+formField('Buscar producto o proveedor','stockLibraryQuery',view.libraryQuery,'text','data-draft-ignore')+action('Buscar','stock-library-search')+'</div><p>'+rows.length+' equivalencia(s). Para añadir una, abre un cotejo y pulsa Guardar equivalencia en su línea. Gerencia confirma cuándo puede reutilizarse.</p>'+table([
 {label:'Tienda / proveedor',html:e=>esc(storeName(e.store_id))+'<small>'+esc(e.supplier)+'</small>'},
 {label:'Nombre en proveedor',html:e=>esc(e.supplier_name)},
 {label:'Nombre en PrestaShop',html:e=>esc(e.prestashop_name)},
 {label:'Variante y unidad',html:e=>esc(e.variant||'Sin variante indicada')+'<small>'+esc(e.unit)+'</small>'},
 {label:'Unidades por paquete',num:true,html:e=>quantity(e.unit_factor)},
 {label:'Confirmación',html:e=>esc(fmtDate(e.confirmed_at))+'<details><summary>Ver motivo</summary><p>'+esc(e.evidence)+'</p></details>'}
 ],rows,{emptyTitle:'Sin equivalencias',emptyText:'Las coincidencias de un pedido no se guardan como regla permanente sin confirmarlas.'})+'</section>';
}
export function stockPage(){
 syncOwner();
 if(view.mode==='new')return receiptForm();
 if(view.mode==='detail')return receiptDetail();
 if(view.mode==='library')return libraryPage();
 const rows=filterStockReceipts(view.receipts,view,storeName);
 return '<section class="card card-pad stock-page"><div class="section-head"><div><h2>Recepciones de mercancía</h2><p>Facturas o albaranes del proveedor frente a las entradas de PrestaShop.</p></div><div class="inline-actions">'+action('Biblioteca de productos','stock-library')+action('Actualizar','stock-refresh')+btn('Nueva recepción','stock-new','primary')+'</div></div>'+
 '<div class="filters stock-filters">'+formField('Desde','stockFrom',view.from,'date','data-draft-ignore')+formField('Hasta','stockTo',view.to,'date','data-draft-ignore')+selectField('Tienda','stockFilterStore',[{value:'all',label:'Todas'},...state.data.stores.map(s=>({value:s.id,label:s.name}))],view.store,'data-draft-ignore')+selectField('Estado','stockStatus',[{value:'all',label:'Todos'},...Object.entries(STOCK_STATES).map(([value,label])=>({value,label}))],view.status,'data-draft-ignore')+formField('Buscar','stockQuery',view.query,'text','data-draft-ignore')+btn('Aplicar filtros','stock-search','primary')+action('Limpiar','stock-filter-clear')+'</div>'+
 '<p class="stock-filter-note">'+(view.from||view.to?'Periodo: '+(view.from?esc(fmtDate(view.from)):'desde el inicio')+' → '+(view.to?esc(fmtDate(view.to)):'hasta el último registro'):'Todas las fechas')+' · '+rows.length+' recepción(es)</p>'+
 (view.error?'<div class="note bad" role="alert">'+esc(view.error)+'</div>':'')+
 (!view.loaded?'<div class="note">Cargando recepciones…</div>':table([{label:'Fecha',html:r=>esc(fmtDate(r.received_on))},{label:'Tienda',html:r=>esc(storeName(r.store_id))},{label:'Proveedor',html:r=>esc(r.supplier)},{label:'Referencia',html:r=>esc(r.reference||'—')},{label:'Estado',html:r=>badge(r.status)},{label:'Acciones',html:r=>action('Ver recepción','stock-open','data-id="'+esc(r.id)+'"')}],rows,{emptyTitle:'Sin recepciones',emptyText:'No hay pedidos con estos filtros. Puedes limpiar el rango o crear una recepción.'}))+'</section>';
}
export async function stockAction(a,el,{render,createStoredDocument,previewDocument,fileSha256}){
 syncOwner();
 if(['stock-new','stock-back','stock-open','stock-library','stock-library-refresh','stock-refresh'].includes(a))navigationEpoch++;
 const actionScope=readScope();
 const {sb,rpc,downloadFile,insert,select}=await import('./api.js');
 const {validateDocumentFile}=await import('./file-utils.js');
 const {extractStockText}=await import('./stock-extract.js');
 const value=id=>document.getElementById(id)?.value||'';
 const list=async(table,columns,filter)=>{
  const rows=[];
  for(let offset=0;offset<100000;offset+=1000){
   let q=sb.from(table).select(columns);if(filter)q=filter(q);
   const response=await q.order(table==='ops_stock_receipts'?'received_on':table==='ops_stock_equivalences'?'confirmed_at':'revision',{ascending:false}).order('id',{ascending:true}).range(offset,offset+999);
   if(response.error)throw new Error(response.error.message);
   rows.push(...(response.data||[]));if((response.data||[]).length<1000)return rows;
  }
  throw new Error('El listado supera 100.000 registros. No se mostrarán datos incompletos.');
 };
 const context=async id=>{
  const scope=readScope(),next=await rpc('totus_stock_context',{p_id:id});
  const history=await list('ops_stock_revisions','id,receipt_id,revision,action,actor_email,created_at,review:snapshot->receipt->result->review,unit_change:snapshot->unit_change',q=>q.eq('receipt_id',id));
  if(!currentRead(scope))return false;
  view.context=next;view.history=history;return true;
 };
 const loadLibrary=async()=>{
  const scope=readScope(),rows=await list('ops_stock_equivalences','*');
  if(!currentRead(scope))return false;
  view.equivalences=rows;return true;
 };
 const retainLibrarySearch=()=>{
  const query=document.getElementById('stockLibraryQuery'),store=document.getElementById('stockLibraryStore');
  if(query)view.libraryQuery=query.value;if(store)view.libraryStore=store.value||'all';
  const active=document.activeElement,id=[query?.id,store?.id].includes(active?.id)?active?.id:null;
  const start=active?.selectionStart,end=active?.selectionEnd;
  return ()=>{const field=id?document.getElementById(id):null;if(!field)return;field.focus({preventScroll:true});if(Number.isInteger(start)&&Number.isInteger(end)&&typeof field.setSelectionRange==='function')field.setSelectionRange(start,end);};
 };
 const refresh=async()=>{
  const scope=readScope();
  let restoreFocus=()=>{};
  if(view.mode==='library'){if(!await loadLibrary())return;restoreFocus=retainLibrarySearch();}
  else if(view.mode==='detail'&&view.context){if(!await context(view.context.receipt.id))return;}
  else{const rows=await list('ops_stock_receipts','id,store_id,supplier,reference,received_on,status,revision,updated_at');if(!currentRead(scope))return;view.receipts=rows;view.loaded=true;}
  view.error='';render();restoreFocus();
 };
 const attach=async(doc,kind,file)=>{
  let extracted;try{extracted=await extractStockText(file)}catch(error){extracted={text:'',extraction:{state:'unread',warnings:[String(error.message||error)],reader:'failed'}}}
  const r=view.context.receipt;
  await rpc('totus_stock_add_source',{p_id:r.id,p_revision:r.revision,p_document:doc.id,p_kind:kind,p_text:extracted.text,p_extraction:extracted.extraction});
  if(!state.data.documents.some(d=>d.id===doc.id))state.data.documents.push(doc);
  await context(r.id);
 };
 const preflight=async queue=>{
  if(queue.length>20)throw new Error('Añade como máximo 20 archivos por lote.');
  if(queue.length&&!canEdit())throw new Error('Necesitas permiso de edición en Documentos para asociar archivos.');
  const seen=new Map();
  for(const item of queue){
   validateDocumentFile(item.file,{maxBytes:Number(state.data.settings?.document_max_bytes||20*1024*1024),limitBytes:Infinity});
   item.hash=await fileSha256(item.file);
   if(seen.has(item.hash)&&seen.get(item.hash)!==item.kind)throw new Error('El mismo archivo está seleccionado en Proveedor y PrestaShop. Revisa los documentos antes de guardar.');
   seen.set(item.hash,item.kind);
  }
 };
 const processUploads=async()=>{
  let saved=0;
  try{
   while(view.pendingUploads.length){
    const item=view.pendingUploads[0],r=view.context.receipt,hash=item.hash||await fileSha256(item.file);
    const progress=document.getElementById('stockProgress');if(progress)progress.textContent='Guardando '+item.file.name+' · '+view.pendingUploads.length+' pendiente(s)…';
    let doc=state.data.documents.find(d=>!state.data.documentRemovals?.some(p=>p.id===d.id)&&d.sha256===hash&&(!d.store_id||d.store_id===r.store_id));
    const linked=doc&&view.context.sources.find(s=>s.document_id===doc.id);
    if(linked){
     if(linked.source_kind!==item.kind)throw new Error('Este documento ya está asociado al otro lado del pedido.');
     view.pendingUploads.shift();continue;
    }
    doc||=await createStoredDocument(item.file,{storeId:r.store_id,date:r.received_on,docType:'otro',status:'pendiente',party:r.supplier,number:r.reference,category:'recepcion_mercancia',notes:'Documento de recepción de mercancía. No crea un gasto.',linkedType:'stock_receipt',linkedId:r.id});
    if(!state.data.documents.some(d=>d.id===doc.id))state.data.documents.push(doc);
    await attach(doc,item.kind,item.file);
    view.pendingUploads.shift();saved++;
   }
   view.error='';render();toast(saved+' archivo(s) asociados.');return saved;
  }catch(error){
   view.error='La recepción está guardada. '+view.pendingUploads.length+' archivo(s) siguen pendientes: '+error.message;
   render();toast(view.error,'bad');return null;
  }
 };
 if(a==='stock-supplier-new'){
  stockModal('Crear proveedor','<p>Se añadirá a la lista común de proveedores y quedará seleccionado. Los documentos elegidos se conservan.</p><div class="form-grid">'+formField('Nombre del proveedor','stockSupplierName','','text','maxlength="200" required')+formField('NIF/CIF · opcional','stockSupplierTax','','text','maxlength="30"')+'</div>'+btn('Crear y seleccionar','stock-supplier-save','primary','data-target="'+esc(el.dataset.target||'stockSupplier')+'"'));
  return;
 }
 if(a==='stock-supplier-save'){
  const name=value('stockSupplierName').trim(),tax=value('stockSupplierTax').trim();if(!name)throw new Error('Escribe el nombre del proveedor.');
  const suppliers=await select('ops_suppliers',{order:'name',ascending:true});
  let supplier=suppliers.find(s=>stockIdentity(s.name)===stockIdentity(name)||(tax&&stockIdentity(s.tax_id)===stockIdentity(tax)));
  if(supplier?.active===false)throw new Error('Ese proveedor está inactivo. Revísalo en Gastos → Proveedores.');
  if(!supplier)supplier=await insert('ops_suppliers',{name,tax_id:tax,active:true,source:'manual',created_by:state.user?.id||null});
  state.data.suppliers=suppliers.some(s=>s.id===supplier.id)?suppliers:[...suppliers,supplier];
  const target=document.getElementById(el.dataset.target||'stockSupplier');
  if(target){
   target.innerHTML='<option value="">Selecciona un proveedor</option>'+state.data.suppliers.filter(s=>s.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'es')).map(s=>'<option value="'+esc(s.name)+'">'+esc(s.name)+'</option>').join('');
   target.value=supplier.name;
  }
  closeModal();toast('Proveedor seleccionado. Puedes continuar con los documentos.');return;
 }
 if(a==='stock-filter-clear'){Object.assign(view,{from:'',to:'',query:'',store:'all',status:'all'});render();return;}
 if(a==='stock-library'||a==='stock-library-refresh'){if(!await loadLibrary())return;const restoreFocus=retainLibrarySearch();view.mode='library';render();restoreFocus();return;}
 if(a==='stock-library-search'){const restoreFocus=retainLibrarySearch();render();restoreFocus();return;}
 if(a==='stock-units-new'){
  if(!canManage())throw new Error('Solo gerencia puede corregir unidades.');
  const r=view.context?.receipt,row=r?.result?.rows?.find(x=>x.id===el.dataset.line);
  if(!r||!row||!['needs_review','differences','reviewed'].includes(r.status))throw new Error('Necesitas una recepción cotejada para corregir unidades.');
  const x=stockCorrectedLineResult(row);
  if(x.originalExpected===null||x.originalReceived===null)throw new Error('Falta comprobar las cantidades de los documentos originales.');
  stockModal('Corregir unidades justificadamente',
   '<p><b>'+esc(row.supplier_name||'Producto')+'</b> · '+esc(row.variant||'')+'</p>'+
   '<p>Factura original: '+quantity(x.originalExpected)+' unidades; entrada PrestaShop original: '+quantity(x.originalReceived)+'. Esos datos NO se modifican. Esta corrección solo afecta al cotejo interno.</p>'+
   '<div class="form-grid"><label>Unidades esperadas corregidas<input id="stockUnitsExpected" type="number" step="any" min="0" max="1000000" value="'+esc(x.expected)+'"></label>'+
   '<label>Unidades recibidas corregidas<input id="stockUnitsReceived" type="number" step="any" min="0" max="1000000" value="'+esc(x.received)+'"></label></div>'+
   '<label>Motivo y comprobación (obligatorio)<textarea id="stockUnitsReason" rows="4" maxlength="5000" placeholder="Indica las unidades verificadas, dónde se comprobaron y la causa de la corrección."></textarea></label>'+
   '<small>Restablecer ambos números a sus valores documentales elimina la corrección vigente, dejando constancia en el historial. Si la recepción estaba Revisada, deberá volver a revisarse.</small>'+
   btn('Guardar unidades justificadas','stock-units-save','primary','data-line="'+esc(row.id)+'"'));
  return;
 }
 if(a==='stock-units-save'){
  if(!canManage())throw new Error('Solo gerencia puede corregir unidades.');
  const r=view.context?.receipt,row=r?.result?.rows?.find(x=>x.id===el.dataset.line);
  const rawExpected=value('stockUnitsExpected'),rawReceived=value('stockUnitsReceived'),reason=value('stockUnitsReason').trim();
  if(!r||!row)throw new Error('La línea ya no está disponible. Actualiza la recepción.');
  if(!rawExpected.trim()||!rawReceived.trim())throw new Error('Debes indicar las dos cantidades verificadas.');
  const expected=Number(rawExpected),received=Number(rawReceived);
  if(!Number.isFinite(expected)||!Number.isFinite(received)||expected<0||received<0||expected>1000000||received>1000000)
   throw new Error('Las unidades deben ser números válidos entre 0 y 1.000.000.');
  if(reason.length<20||reason.length>5000)throw new Error('Escribe un motivo de 20 a 5000 caracteres.');
  await rpc('totus_stock_correct_units',{p_id:r.id,p_revision:r.revision,p_line_id:row.id,p_expected:expected,p_received:received,p_reason:reason});
  closeModal();await context(r.id);render();toast('Unidades corregidas con justificación y registro en historial.');return;
 }
 if(a==='stock-review-new'){
  if(!canManage())throw new Error('Solo gerencia puede cerrar una revisión.');
  const r=view.context?.receipt;
  if(!r||!['needs_review','differences'].includes(r.status)||!r.result?.rows?.length)throw new Error('Esta recepción no tiene incidencias cotejadas pendientes de cierre.');
  stockModal('Marcar recepción como revisada','<p>Describe cómo se ha comprobado y resuelto o justificado cada incidencia. La recepción quedará como Revisado (verde), pero se conservarán todos los faltantes, diferencias y correspondencias sin confirmar. No modifica existencias ni contabilidad.</p><label>Justificación de la revisión (obligatoria)<textarea id="stockReviewNote" rows="5" maxlength="5000" placeholder="Qué se ha comprobado, cómo se ha resuelto o justificado cada incidencia y qué acciones corresponden al equipo"></textarea></label><label class="check-field"><input id="stockReviewConfirmed" type="checkbox"> Confirmo que he comprobado todas las incidencias y que la nota recoge su resolución o justificación.</label>'+btn('Guardar revisión justificada','stock-review-save','primary'));
  return;
 }
 if(a==='stock-review-save'){
  if(!canManage())throw new Error('Solo gerencia puede cerrar una revisión.');
  const r=view.context?.receipt,note=value('stockReviewNote').trim();
  if(!r||!['needs_review','differences'].includes(r.status))throw new Error('Actualiza la recepción antes de revisarla.');
  if(note.length<20||note.length>5000)throw new Error('La justificación debe tener entre 20 y 5000 caracteres.');
  if(!document.getElementById('stockReviewConfirmed')?.checked)throw new Error('Confirma que has revisado y justificado todas las incidencias.');
  await rpc('totus_stock_mark_reviewed',{p_id:r.id,p_revision:r.revision,p_note:note});
  closeModal();await context(r.id);render();toast('Revisión guardada con justificación e historial.');return;
 }
 if(a==='stock-equivalence-new'){
  if(!canManage())throw new Error('Solo gerencia puede confirmar equivalencias.');
  const row=view.context.receipt.result.rows.find(r=>r.id===el.dataset.line);
  if(!row||stockLineResult(row).reasons.length)throw new Error('Primero completa y confirma esta línea.');
  stockModal('Guardar equivalencia en la biblioteca','<p>Se reutilizará solo para esta tienda, proveedor, nombres, variante y unidad. Una coincidencia válida solo para este pedido no debe guardarse como regla.</p><div class="stock-equivalence-summary"><b>'+esc(row.supplier_name)+'</b><p>PrestaShop: '+esc(row.prestashop_name)+'</p><p>Variante: '+esc(row.variant||'Sin variante indicada')+' · '+esc(row.unit)+' · '+quantity(row.unit_factor)+' unidad(es) por paquete</p></div><label>Motivo de la confirmación<textarea id="stockEquivalenceEvidence" rows="3" maxlength="5000"></textarea></label><label class="check-field"><input id="stockEquivalenceConfirmed" type="checkbox"> Confirmo que puede reutilizarse en futuros pedidos de esta misma variante.</label>'+btn('Guardar equivalencia','stock-equivalence-save','primary','data-line="'+esc(row.id)+'"'));
  return;
 }
 if(a==='stock-equivalence-save'){
  if(!canManage())throw new Error('Solo gerencia puede confirmar equivalencias.');
  const r=view.context.receipt,row=r.result.rows.find(x=>x.id===el.dataset.line),evidence=value('stockEquivalenceEvidence').trim();
  if(!row||stockLineResult(row).reasons.length)throw new Error('La línea necesita revisión.');
  if(!document.getElementById('stockEquivalenceConfirmed')?.checked||!evidence)throw new Error('Confirma la reutilización e indica el motivo.');
  try{await rpc('totus_stock_confirm_equivalence',{p_store:r.store_id,p_supplier:r.supplier,p_supplier_name:row.supplier_name,p_prestashop_name:row.prestashop_name,p_variant:row.variant||'',p_unit:row.unit,p_factor:row.unit_factor,p_evidence:evidence});}
  catch(error){if(/unique|duplicate/i.test(error.message))throw new Error('La equivalencia ya existe. Consulta la biblioteca antes de crear otra.');throw error;}
  closeModal();await context(r.id);render();toast('Equivalencia guardada para futuros cotejos.');return;
 }
 if(a==='stock-evidence'){
  stockModal('Texto para ChatGPT','<p>Este paquete contiene los textos ya disponibles y su cobertura. Puedes copiarlo al chat si su lector de OneDrive no admite un archivo. No sustituye las páginas pendientes del original.</p><textarea class="full stock-text" readonly rows="14">'+esc(stockChatEvidence(view.context))+'</textarea>');
  return;
 }
 if(a==='stock-export-html'||a==='stock-export-xlsx'){
  const r=view.context.receipt;if(!r.result?.rows?.length)throw new Error('Todavía no hay un cotejo para descargar.');
  const stem='Cotejo_'+r.received_on+'_'+String(r.reference||r.id).replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,80);
  if(a==='stock-export-html'){download(new Blob([stockReportHtml(view.context,storeName(r.store_id))],{type:'text/html;charset=utf-8'}),stem+'.html');return;}
  const xlsx=globalThis.XLSX;if(!xlsx)throw new Error('No está disponible el lector de Excel.');
  const rows=stockExportRows(view.context,storeName(r.store_id)),sheet=xlsx.utils.json_to_sheet(rows),book=xlsx.utils.book_new();
  sheet['!cols']=Object.keys(rows[0]).map(k=>({wch:/Producto|origen|Motivo|Conversión/.test(k)?42:22}));
  sheet['!autofilter']={ref:sheet['!ref']};
  for(const [cell,value] of Object.entries(sheet)){
   if(cell.startsWith('!'))continue;
   value.s={alignment:{vertical:'top',wrapText:true},...(cell.replace(/\D/g,'')==='1'?{font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'244867'}}}:{})};
  }
  xlsx.utils.book_append_sheet(book,sheet,'Cotejo');
  const docs=xlsx.utils.json_to_sheet((view.context.sources||[]).map(s=>({Documento:s.document?.original_name||'',Tipo:s.source_kind==='supplier'?'Proveedor':'PrestaShop','Estado de lectura':s.extraction?.state||'unread','Texto completo disponible':s.extraction?.state==='ready'?'Sí':'Revisar original'})));
  docs['!cols']=[{wch:50},{wch:20},{wch:22},{wch:28}];xlsx.utils.book_append_sheet(book,docs,'Documentos');
  download(new Blob([xlsx.write(book,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),stem+'.xlsx');return;
 }
 if(a==='stock-upload-discard'){
  if(!await confirmAction('Se quitará la lista de archivos pendientes de asociar. Los documentos ya guardados se conservan en Documentos.',{title:'Quitar archivos pendientes',acceptLabel:'Quitar pendientes'}))return;
  view.pendingUploads=[];view.error='';render();return;
 }
 if(a==='stock-upload-retry-save'){await context(view.context.receipt.id);await processUploads();return;}
 if(a==='stock-edit'){
  const r=view.context.receipt;
  stockModal('Editar recepción','<p>Al cambiar sus datos se conservará el historial y el cotejo volverá a quedar pendiente.</p><div class="form-grid">'+selectField('Tienda','stockEditStore',state.data.stores.filter(s=>s.active!==false).map(s=>({value:s.id,label:s.name})),r.store_id)+supplierField('stockEditSupplier',r.supplier)+formField('Pedido o referencia','stockEditReference',r.reference,'text','maxlength="200"')+formField('Fecha','stockEditDate',r.received_on,'date','max="'+isoToday()+'"')+'<label class="wide">Notas<textarea id="stockEditNotes" rows="3" maxlength="5000">'+esc(r.notes)+'</textarea></label></div>'+btn('Guardar cambios','stock-edit-save','primary'));
  return;
 }
 if(a==='stock-edit-save'){
  const r=view.context.receipt;
  await rpc('totus_stock_edit',{p_id:r.id,p_revision:r.revision,p_store:value('stockEditStore'),p_supplier:value('stockEditSupplier').trim(),p_reference:value('stockEditReference').trim(),p_date:value('stockEditDate'),p_notes:value('stockEditNotes').trim()});
  closeModal();await context(r.id);render();toast('Recepción actualizada. Revisa el cotejo.');return;
 }
 if(a==='stock-new'){view.error='';view.mode='new';render();return;}
 if(a==='stock-back'){
  if(view.pendingUploads.length&&!await confirmAction('Hay archivos pendientes de subir. Al volver se quitarán de la cola; los documentos ya guardados se conservan.',{title:'Volver a recepciones',acceptLabel:'Volver'}))return;
  view.pendingUploads=[];view.mode='list';view.context=null;await refresh();return;
 }
 if(a==='stock-search'){
  const filters={query:value('stockQuery'),store:value('stockFilterStore')||'all',from:value('stockFrom'),to:value('stockTo'),status:value('stockStatus')||'all'};
  filterStockReceipts([],filters);Object.assign(view,filters);render();return;
 }
 if(a==='stock-refresh'){await refresh();return;}
 if(a==='stock-create-save'){
  const supplier=value('stockSupplier').trim(),date=value('stockDate'),store=value('stockStore');
  if(!supplier||!store||!date)throw new Error('Selecciona tienda, proveedor y fecha.');
  const queue=[...[...(document.getElementById('stockNewSupplierFiles')?.files||[])].map(file=>({file,kind:'supplier'})),...[...(document.getElementById('stockNewPrestashopFiles')?.files||[])].map(file=>({file,kind:'prestashop'}))];
  await preflight(queue);
  const r=await rpc('totus_stock_create',{p_store:store,p_supplier:supplier,p_reference:value('stockReference').trim(),p_date:date,p_notes:value('stockNotes').trim()});
  if(!currentRead(actionScope))return;
  view.context={receipt:r,sources:[],equivalences:[]};view.history=[];view.pendingUploads=queue;view.mode='detail';view.error='';
  try{await context(r.id);}catch(error){view.error='La recepción se ha guardado. Actualiza antes de continuar: '+error.message;render();return;}
  if(queue.length)await processUploads();else{render();toast('Recepción creada. Añade los documentos.');}
  return;
 }
 if(a==='stock-open'){if(!await context(el.dataset.id))return;view.pendingUploads=[];view.error='';view.mode='detail';render();return;}
 if(a==='stock-preview'){await previewDocument(el.dataset.id);return;}
 if(a==='stock-text'){
  const source=view.context.sources.find(s=>s.id===el.dataset.id);if(!source)throw new Error('Documento no encontrado.');
  stockModal('Texto disponible del documento','<p>Revisa el original si faltan páginas o las columnas no se interpretan bien.</p><pre class="stock-text">'+esc(source.extracted_text||'No se ha extraído texto. ChatGPT debe leer el archivo original.')+'</pre>');return;
 }
 if(a==='stock-prompt-view'){stockModal('Instrucción para ChatGPT','<textarea readonly rows="9" class="full">'+esc(stockChatPrompt(view.context.receipt))+'</textarea>');return;}
 if(a==='stock-prompt'){
  try{await navigator.clipboard.writeText(stockChatPrompt(view.context.receipt));toast('Instrucción copiada. Pégala en vuestro chat habitual.');}
  catch{stockModal('Copia esta instrucción','<textarea readonly rows="9" class="full">'+esc(stockChatPrompt(view.context.receipt))+'</textarea>');}return;
 }
 if(a==='stock-source-remove'){
  const source=view.context.sources.find(s=>s.id===el.dataset.id);if(!source)throw new Error('Asociación no encontrada.');
  if(!await confirmAction('Se retirará este documento del cotejo y su resultado volverá a quedar pendiente. El original se conserva en Documentos.',{title:'Quitar documento del pedido',acceptLabel:'Quitar del pedido'}))return;
  const r=view.context.receipt;await rpc('totus_stock_remove_source',{p_id:r.id,p_revision:r.revision,p_source:source.id,p_reason:'Asociación retirada desde la ficha por el usuario'});
  await context(r.id);render();return;
 }
 if(a==='stock-existing-save'){
  const doc=state.data.documents.find(d=>d.id===value('stockExisting'));if(!doc)throw new Error('Selecciona un documento.');
  const blob=await downloadFile('business-documents',doc.storage_path,doc);
  await attach(doc,value('stockKind'),new File([blob],doc.original_name,{type:doc.mime_type}));render();toast('Documento asociado.');return;
 }
 if(a==='stock-upload-save'){
  if(view.pendingUploads.length)throw new Error('Reintenta o quita primero los archivos pendientes.');
  const files=[...(document.getElementById('stockFiles')?.files||[])],kind=value('stockKind');
  if(!files.length)throw new Error('Selecciona los archivos.');
  const queue=files.map(file=>({file,kind}));await preflight(queue);view.pendingUploads=queue;await processUploads();return;
 }
 throw new Error('Acción de recepción desconocida.');
}
