import {canUser} from './permissions.js';
import {state} from './state.js';
import {esc,fmtDate,isoToday} from './utils.js';
import {btn,table,formField,selectField,modal,closeModal,toast,confirmAction} from './components.js';
import {STOCK_STATES,stockLineResult,stockSummary,stockChatPrompt} from './stock-core.js';
const view={loaded:false,receipts:[],context:null,history:[],mode:'list',query:'',store:'all',error:''};
const storeName=id=>state.data.stores.find(s=>s.id===id)?.name||'Tienda';
const label=code=>STOCK_STATES[code]||code;
const badge=code=>'<span class="badge '+(code==='matched'?'good':code==='differences'?'bad':'warn')+'">'+esc(label(code))+'</span>';
const action=(label,name,attrs='')=>btn(label,name,'secondary',attrs);
const quantity=value=>value==null?'Pendiente':Number(value).toLocaleString('es-ES',{maximumFractionDigits:6});
function sourceCard(source){
 const d=source.document||{},kind=source.source_kind==='supplier'?'Proveedor':'Entrada de PrestaShop';
 const status=source.extraction?.state==='ready'?'Texto disponible':source.extraction?.state==='partial'?'Lectura parcial':'Necesita leer el original';
 return '<article class="stock-source"><div><b>'+esc(d.original_name||'Documento')+'</b><small>'+kind+' · '+status+'</small></div><div class="inline-actions">'+action('Ver original','stock-preview','data-id="'+esc(d.id)+'"')+action('Ver texto','stock-text','data-id="'+esc(source.id)+'"')+action('Retirar asociación','stock-source-remove','data-id="'+esc(source.id)+'"')+'</div></article>';
}
function receiptForm(){
 const stores=state.data.stores.filter(s=>s.active!==false).map(s=>({value:s.id,label:s.name}));
 return '<section class="card card-pad"><div class="section-head"><div><h2>Nueva recepción</h2><p>Primero identifica el pedido. Después añade los documentos de ambos lados.</p></div>'+action('Volver','stock-back')+'</div><div class="form-grid">'+selectField('Tienda','stockStore',stores,stores[0]?.value)+formField('Proveedor','stockSupplier','','text','maxlength="200" required')+formField('Pedido o referencia','stockReference','','text','maxlength="200"')+formField('Fecha de recepción','stockDate',isoToday(),'date','required max="'+isoToday()+'"')+'<label class="wide">Notas<textarea id="stockNotes" rows="3" maxlength="5000"></textarea></label></div><div class="inline-actions">'+btn('Crear recepción','stock-create-save','primary')+'</div></section>';
}
function resultTable(receipt){
 const rows=receipt.result?.rows||[];
 if(!rows.length)return '<div class="note">Todavía no hay un resultado. Añade los documentos y entrega a ChatGPT la instrucción del paso 2.</div>';
 const summary=stockSummary(receipt.result,view.context?.sources||[]);
 return (summary.issues.length?'<div class="note warn">'+esc(summary.issues.map(issue=>(view.context?.sources||[]).reduce((text,source)=>text.replaceAll(source.id,source.document?.original_name||'Documento'),issue)).join(' · '))+'</div>':'')+table([
 {label:'Producto del proveedor',html:r=>esc(r.supplier_name||'Sin identificar')+'<small>'+esc([r.variant,r.unit].filter(Boolean).join(' · '))+'</small>'},
 {label:'Producto de PrestaShop',html:r=>esc(r.prestashop_name||'Sin identificar')},
 {label:'Unidades del proveedor',html:r=>quantity(stockLineResult(r).expected)},
 {label:'Entrada sin ajustes externos',html:r=>quantity(stockLineResult(r).received)},
 {label:'Diferencia',html:r=>quantity(stockLineResult(r).difference)},
 {label:'Revisión y origen',html:r=>{const calculated=stockLineResult(r);return badge(calculated.status)+(calculated.reasons.length?'<small>'+esc(calculated.reasons.join(' · '))+'</small>':'')+'<details><summary>Ver origen y ajustes</summary>'+(r.source_refs||[]).map(ref=>'<p>'+esc(view.context.sources.find(s=>s.id===ref.source_id)?.document?.original_name||ref.source_id)+' · '+esc(ref.locator)+'</p>').join('')+'<p>Cantidad en el documento del proveedor: '+quantity(r.supplier_qty)+' · Unidades por referencia: '+quantity(r.unit_factor)+'</p>'+(r.conversion_reason?'<p>'+esc(r.conversion_reason)+'</p>':'')+'<p>Ajuste externo: '+quantity(r.adjustment_qty)+' · '+esc(r.adjustment_reason||'Sin ajuste indicado')+'</p></details>';}}
 ],rows);
}
function receiptDetail(){
 const c=view.context,r=c?.receipt;if(!r)return '<section class="card card-pad" role="status">Cargando recepción…</section>';
 const sources=c.sources||[],canAdd=canUser(state.user,'documentos','edit',state.data.userPermissions||[]);
 const options=state.data.documents.filter(d=>!sources.some(s=>s.document_id===d.id)&&(!d.store_id||d.store_id===r.store_id))
 .map(d=>({value:d.id,label:[d.original_name,d.supplier_or_customer,d.invoice_number].filter(Boolean).join(' · ')}));
 return '<div class="stack"><section class="card card-pad"><div class="section-head"><div><h2>'+esc(r.supplier)+' · '+esc(r.reference||'Sin referencia')+'</h2><p>'+esc(storeName(r.store_id))+' · '+esc(fmtDate(r.received_on))+' · Revisión '+r.revision+'</p></div><div class="inline-actions">'+badge(r.status)+action('Editar datos','stock-edit')+action('Actualizar','stock-refresh')+action('Volver','stock-back')+'</div></div>'+(r.notes?'<p>'+esc(r.notes)+'</p>':'')+'</section>'+
 '<section class="card card-pad"><h3>1. Documentos del pedido</h3><p>La entrada de PrestaShop es el recuento realizado por el equipo. Estos adjuntos no crean gastos ni cambian existencias.</p>'+
 sources.map(sourceCard).join('')+(sources.length?'':'<div class="note">Añade la factura o albarán y la entrada de PrestaShop del mismo pedido.</div>')+
 (canAdd?'<div class="stock-upload form-grid">'+selectField('Estos documentos son de','stockKind',[{value:'supplier',label:'Proveedor · factura o albarán'},{value:'prestashop',label:'PrestaShop · entrada de mercancía'}],'supplier')+
 '<label>Subir archivos<input id="stockFiles" type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.webp" multiple></label><div>'+btn('Añadir archivos','stock-upload-save','primary')+'</div></div><details><summary>Usar un documento ya guardado</summary><div class="form-grid">'+selectField('Documento','stockExisting',[{value:'',label:'Selecciona un documento'},...options],'')+'<div>'+action('Asociar documento','stock-existing-save')+'</div></div></details>':'')+'</section>'+
 '<section class="card card-pad"><h3>2. Cotejar con ChatGPT</h3><p>Copia la instrucción y pégala en vuestro chat habitual. Leerá los documentos de esta recepción y guardará aquí el resultado. Después pulsa Actualizar.</p><div class="inline-actions">'+btn('Copiar instrucción para ChatGPT','stock-prompt','primary')+action('Ver instrucción','stock-prompt-view')+'</div></section>'+
 '<section class="card card-pad"><div class="section-head"><h3>3. Resultado del cotejo</h3>'+badge(r.status)+'</div>'+resultTable(r)+
 '<details><summary>Cómo se calcula</summary><p>Se compara lo facturado con las unidades introducidas en PrestaShop. Si una entrada incluye un ajuste externo, se descuenta ese ajuste para comparar solo la mercancía recibida. Una cantidad desconocida o una equivalencia sin confirmar mantiene la revisión pendiente.</p></details>'+
 '<details><summary>Historial de revisiones ('+view.history.length+')</summary>'+view.history.map(h=>'<div class="stock-history"><b>Revisión '+h.revision+'</b> · '+esc(fmtDate(h.created_at))+' · '+esc(h.actor_email)+'<small>'+esc(({created:'Recepción creada',source_added:'Documento asociado',source_removed:'Asociación retirada',result_saved:'Resultado guardado',edited:'Datos modificados; cotejo pendiente'})[h.action]||h.action)+'</small></div>').join('')+'</details></section></div>';
}
export function stockPage(){
 if(view.mode==='new')return receiptForm();
 if(view.mode==='detail')return receiptDetail();
 const q=view.query.trim().toLocaleLowerCase('es');
 const rows=view.receipts.filter(r=>(view.store==='all'||r.store_id===view.store)&&(!q||[r.supplier,r.reference,storeName(r.store_id),label(r.status)].join(' ').toLocaleLowerCase('es').includes(q)));
 return '<section class="card card-pad"><div class="section-head"><div><h2>Recepciones de mercancía</h2><p>Facturas o albaranes del proveedor frente a las entradas de PrestaShop.</p></div><div class="inline-actions">'+action('Actualizar','stock-refresh')+btn('Nueva recepción','stock-new','primary')+'</div></div>'+
 '<div class="filters">'+selectField('Tienda','stockFilterStore',[{value:'all',label:'Todas'},...state.data.stores.map(s=>({value:s.id,label:s.name}))],view.store,'data-draft-ignore')+formField('Buscar','stockQuery',view.query,'text','data-draft-ignore')+action('Buscar','stock-search')+'</div>'+
 (view.error?'<div class="note bad" role="alert">'+esc(view.error)+'</div>':'')+
 (!view.loaded?'<div class="note">Pulsa Actualizar para consultar las recepciones.</div>':table([{label:'Fecha',html:r=>esc(fmtDate(r.received_on))},{label:'Tienda',html:r=>esc(storeName(r.store_id))},{label:'Proveedor',html:r=>esc(r.supplier)},{label:'Referencia',html:r=>esc(r.reference||'—')},{label:'Estado',html:r=>badge(r.status)},{label:'Acciones',html:r=>action('Ver recepción','stock-open','data-id="'+esc(r.id)+'"')}],rows,{emptyTitle:'Sin recepciones',emptyText:'Crea una recepción para empezar a cotejar.'}))+'</section>';
}
export async function stockAction(a,el,{render,createStoredDocument,previewDocument,fileSha256}){
 const {sb,rpc,downloadFile}=await import('./api.js');
 const {extractStockText}=await import('./stock-extract.js');
 const value=id=>document.getElementById(id)?.value||'';
 const list=async(table,columns,filter)=>{
  const rows=[];
  for(let offset=0;offset<100000;offset+=1000){
   let q=sb.from(table).select(columns);if(filter)q=filter(q);
   const response=await q.order(table==='ops_stock_receipts'?'received_on':'revision',{ascending:false}).order('id',{ascending:true}).range(offset,offset+999);
   if(response.error)throw new Error(response.error.message);
   rows.push(...(response.data||[]));if((response.data||[]).length<1000)return rows;
  }
  throw new Error('El listado supera 100.000 registros. No se mostrarán datos incompletos.');
 };
 const context=async id=>{
  view.context=await rpc('totus_stock_context',{p_id:id});
  view.history=await list('ops_stock_revisions','id,receipt_id,revision,action,actor_email,created_at',q=>q.eq('receipt_id',id));
 };
 const refresh=async()=>{
  if(view.mode==='detail'&&view.context)await context(view.context.receipt.id);
  else{view.receipts=await list('ops_stock_receipts','id,store_id,supplier,reference,received_on,status,revision,updated_at');view.loaded=true;}
  view.error='';render();
 };
 const attach=async(doc,kind,file)=>{
  let extracted;try{extracted=await extractStockText(file)}catch(error){extracted={text:'',extraction:{state:'unread',warnings:[String(error.message||error)],reader:'failed'}}}
  const r=view.context.receipt;
  await rpc('totus_stock_add_source',{p_id:r.id,p_revision:r.revision,p_document:doc.id,p_kind:kind,p_text:extracted.text,p_extraction:extracted.extraction});
  if(!state.data.documents.some(d=>d.id===doc.id))state.data.documents.push(doc);
  await context(r.id);
 };
 if(a==='stock-edit'){
  const r=view.context.receipt;
  modal('Editar recepción','<p>Al cambiar sus datos se conservará el historial y el cotejo volverá a quedar pendiente.</p><div class="form-grid">'+selectField('Tienda','stockEditStore',state.data.stores.filter(s=>s.active!==false).map(s=>({value:s.id,label:s.name})),r.store_id)+formField('Proveedor','stockEditSupplier',r.supplier,'text','maxlength="200"')+formField('Pedido o referencia','stockEditReference',r.reference,'text','maxlength="200"')+formField('Fecha','stockEditDate',r.received_on,'date','max="'+isoToday()+'"')+'<label class="wide">Notas<textarea id="stockEditNotes" rows="3" maxlength="5000">'+esc(r.notes)+'</textarea></label></div>'+btn('Guardar cambios','stock-edit-save','primary'));
  return;
 }
 if(a==='stock-edit-save'){
  const r=view.context.receipt;
  await rpc('totus_stock_edit',{p_id:r.id,p_revision:r.revision,p_store:value('stockEditStore'),p_supplier:value('stockEditSupplier').trim(),p_reference:value('stockEditReference').trim(),p_date:value('stockEditDate'),p_notes:value('stockEditNotes').trim()});
  closeModal();await context(r.id);render();toast('Recepción actualizada. Revisa el cotejo.');return;
 }
 if(a==='stock-new'){view.mode='new';render();return;}
 if(a==='stock-back'){view.mode='list';view.context=null;await refresh();return;}
 if(a==='stock-search'){view.query=value('stockQuery');view.store=value('stockFilterStore')||'all';render();return;}
 if(a==='stock-refresh'){await refresh();return;}
 if(a==='stock-create-save'){
  const r=await rpc('totus_stock_create',{p_store:value('stockStore'),p_supplier:value('stockSupplier').trim(),p_reference:value('stockReference').trim(),p_date:value('stockDate'),p_notes:value('stockNotes').trim()});
  await context(r.id);view.mode='detail';render();toast('Recepción creada. Añade los documentos.');return;
 }
 if(a==='stock-open'){await context(el.dataset.id);view.mode='detail';render();return;}
 if(a==='stock-preview'){await previewDocument(el.dataset.id);return;}
 if(a==='stock-text'){
  const source=view.context.sources.find(s=>s.id===el.dataset.id);if(!source)throw new Error('Documento no encontrado.');
  modal('Texto disponible del documento','<p>Revisa el original si faltan páginas o las columnas no se interpretan bien.</p><pre class="stock-text">'+esc(source.extracted_text||'No se ha extraído texto. ChatGPT debe leer el archivo original.')+'</pre>');return;
 }
 if(a==='stock-prompt-view'){modal('Instrucción para ChatGPT','<textarea readonly rows="9" class="full">'+esc(stockChatPrompt(view.context.receipt))+'</textarea>');return;}
 if(a==='stock-prompt'){
  try{await navigator.clipboard.writeText(stockChatPrompt(view.context.receipt));toast('Instrucción copiada. Pégala en vuestro chat habitual.');}
  catch{modal('Copia esta instrucción','<textarea readonly rows="9" class="full">'+esc(stockChatPrompt(view.context.receipt))+'</textarea>');}return;
 }
 if(a==='stock-source-remove'){
  const source=view.context.sources.find(s=>s.id===el.dataset.id);if(!source)throw new Error('Asociación no encontrada.');
  if(!await confirmAction('Se retirará este documento del cotejo y su resultado volverá a quedar pendiente. El original se conserva en Documentos.',{title:'Retirar asociación',acceptLabel:'Retirar asociación'}))return;
  const r=view.context.receipt;await rpc('totus_stock_remove_source',{p_id:r.id,p_revision:r.revision,p_source:source.id,p_reason:'Asociación retirada desde la ficha por el usuario'});
  await context(r.id);render();return;
 }
 if(a==='stock-existing-save'){
  const doc=state.data.documents.find(d=>d.id===value('stockExisting'));if(!doc)throw new Error('Selecciona un documento.');
  const blob=await downloadFile('business-documents',doc.storage_path,doc);
  await attach(doc,value('stockKind'),new File([blob],doc.original_name,{type:doc.mime_type}));render();toast('Documento asociado.');return;
 }
 if(a==='stock-upload-save'){
  const files=[...(document.getElementById('stockFiles')?.files||[])],kind=value('stockKind');
  if(!files.length)throw new Error('Selecciona los archivos.');if(files.length>20)throw new Error('Añade como máximo 20 archivos por lote.');
  const r=view.context.receipt;let saved=0;
  try{
   for(const file of files){
    const hash=await fileSha256(file);
    let doc=state.data.documents.find(d=>d.sha256===hash&&(!d.store_id||d.store_id===r.store_id));
    doc||=await createStoredDocument(file,{storeId:r.store_id,date:r.received_on,docType:'otro',status:'pendiente',party:r.supplier,number:r.reference,category:'recepcion_mercancia',notes:'Documento de recepción de mercancía. No crea un gasto.',linkedType:'stock_receipt',linkedId:r.id});
    await attach(doc,kind,file);saved++;
   }
  }catch(error){render();throw new Error(saved+' archivo(s) asociados. El resto queda pendiente: '+error.message);}
  render();toast(saved+' archivo(s) asociados.');return;
 }
 throw new Error('Acción de recepción desconocida.');
}
