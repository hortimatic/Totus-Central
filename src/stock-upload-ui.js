import {state} from './state.js';
import {esc} from './utils.js';
import {btn,table} from './components.js';
import {canUser} from './permissions.js';

export const canStockUpload=()=>canUser(state.user,'documentos','create',state.data.userPermissions||[]);
export const stockFilesFor=id=>(state.data.cotejoSources||[]).filter(s=>s.cotejo_id===id);
export const stockLinkedDocument=id=>(state.data.documents||[]).find(d=>d.id===id);

export function stockUploadForm(record=null){
 const stores=(state.data.stores||[]).filter(s=>/hortimatic|newoldsmok|new.old.smok/i.test(s.name)&&s.active!==false);
 const selected=record?stores.find(s=>s.name.toLowerCase().includes(record.shop.toLowerCase()))?.id:stores[0]?.id;
 const exists=!!record;
 const items=exists?stockFilesFor(record.id):[];
 const count=type=>items.filter(x=>x.source_kind===type).length;
 const selectOptions=stores.map(st=>'<option value="'+esc(st.id)+'" '+(st.id===selected?'selected':'')+'>'+esc(st.name)+'</option>').join('');
 return '<div class="page"><div class="record-toolbar">'+btn('← Volver','stock-back','secondary')+
 '<div><div class="eyebrow">Cotejos · '+(exists?'Completar lote':'Nueva recepción')+'</div><h2>'+
 (exists?'Añadir documentos al lote '+esc(record.reference||record.id):'Registrar recepción de mercancía')+'</h2></div></div>'+
 '<section class="card card-pad"><p>Guarda los documentos originales aquí. Después ChatGPT podrá analizar el contenido accesible desde Supabase, sin subir los archivos al chat.</p>'+
 '<div class="form-grid">'+
 '<label>Tienda<select id="stockStore" '+(exists?'disabled':'')+'>'+selectOptions+'</select></label>'+
 '<label>Fecha de recepción<input id="stockReceivedOn" type="date" value="'+esc(record?.received_on||new Date().toISOString().slice(0,10))+'" '+(exists?'disabled':'')+'></label>'+
 '<label>Proveedor<input id="stockSupplier" maxlength="200" value="'+esc(record?.supplier||'')+'" '+(exists?'disabled':'')+' placeholder="Proveedor"></label>'+
 '<label>Nº factura, albarán o referencia<input id="stockReference" maxlength="200" value="'+esc(record?.reference||'')+'" '+(exists?'disabled':'')+' placeholder="Identificador de la recepción"></label>'+
 '<label class="wide">Factura o albarán<input id="stockSupplierFiles" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.webp"><span class="small muted">'+
 (count('proveedor')?'Ya archivados: '+count('proveedor')+'. ':'')+'Puedes elegir varios documentos.</span></label>'+
 '<label class="wide">Entradas de stock de PrestaShop<input id="stockPrestashopFiles" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.webp"><span class="small muted">'+
 (count('prestashop')?'Ya archivadas: '+count('prestashop')+'. ':'')+'Puedes elegir varios movimientos del mismo lote. El recuento físico ya se realizó en la tienda.</span></label>'+
 '</div>'+
 '<p class="note">Se archiva el original y se intenta extraer su texto en el navegador. Los escaneos e imágenes se marcarán pendientes de lectura; no se inventarán datos.</p>'+
 '<div class="form-actions">'+btn(exists?'Añadir documentos':'Guardar recepción','stock-save','primary',exists?'data-id="'+esc(record.id)+'"':'')+
 btn('Cancelar','stock-back','secondary')+'</div></section></div>';
}
export function stockFilesHtml(record){
 const items=stockFilesFor(record.id);
 if(!items.length)return '<div class="card-pad"><p class="note warn">Todavía no hay documentos vinculados a esta recepción.</p></div>';
 const headers=[
  {label:'Origen',html:s=>esc(s.source_kind==='proveedor'?'Proveedor':'PrestaShop')},
  {label:'Documento original',html:s=>esc(stockLinkedDocument(s.document_id)?.original_name||s.document_id)},
  {label:'Texto para ChatGPT',html:s=>'<span class="badge '+(s.extraction_state==='listo'?'good':'warn')+'">'+
   esc(s.extraction_state==='listo'?'Disponible':s.extraction_state==='parcial'?'Incompleto':'Pendiente de lectura')+'</span><div class="small muted">'+esc(s.extraction_notes||'')+'</div>'},
  {label:'',html:s=>stockLinkedDocument(s.document_id)?btn('Abrir original','stock-doc-preview','secondary','data-id="'+esc(s.document_id)+'"'):'—'}
 ];
 return table(headers,items,{emptyTitle:'Sin documentos'});
}
