import {esc} from './utils.js';
import {readStockRuleSource,stockRuleQuantity,stockRuleResult} from './stock-rules.js';
import {STOCK_STATES,stockLineResult} from './stock-core.js';
import {fieldHelp} from './components.js';
const qty=v=>v==null?'Pendiente':Number(v).toLocaleString('es-ES',{maximumFractionDigits:6});
// All work remains in this receipt-scoped editor until its explicit save.
export function mountStockRuleEditor(host,context,{save,preview,valid=()=>true}){
 const objectUrls=new Set(),release=()=>{for(const url of objectUrls)URL.revokeObjectURL(url);objectUrls.clear();};
 const observer=new MutationObserver(()=>{if(!host.isConnected){release();observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
 const docs=context.sources.map(s=>({source:s,source_id:s.id,included:true,reviewed:false,note:'',...readStockRuleSource(s)}));
 docs.forEach(d=>d.rows.forEach(row=>row.original=Object.fromEntries(['name','reference','ean','variant','quantity','unit'].map(k=>[k,row[k]]))));
 let proposal=null,saving=false;
 const hints={quantity:'Cantidad que figura en este documento. Conserva los packs originales; su conversión se indica en Unidades por pack.',factor:'Una caja de cinco unidades se indica con factor 5. Requiere evidencia escrita o una equivalencia previamente confirmada.',conversionNote:'Explica dónde has comprobado el contenido del pack. No se deduce una conversión para hacer desaparecer una diferencia.',ean:'Se compara el identificador exacto. Si los EAN de ambos lados se contradicen, la correspondencia queda pendiente.'};
 const field=(key,value,label,type='text')=>'<label><span class="field-caption">'+esc(label)+(hints[key]?fieldHelp(label,hints[key]):'')+'</span><input data-rule-field="'+key+'" type="'+type+'" value="'+esc(value??'')+'" '+(type==='number'?'step="any"':'')+'></label>';
 function lineHtml(row,index){
  return '<article class="stock-rule-line" data-rule-line="'+index+'"><header><b>'+esc(row.locator)+'</b><button type="button" class="btn secondary" data-rule-remove="'+index+'">Retirar línea</button></header><div class="stock-rule-fields">'+field('name',row.name,'Producto')+field('quantity',row.quantity,'Cantidad','number')+'<label>Formato<select data-rule-field="unit"><option value="">Por confirmar</option><option value="ud" '+(row.unit==='ud'?'selected':'')+'>Unidades</option><option value="pack" '+(row.unit==='pack'?'selected':'')+'>Cajas / packs</option></select></label></div><details class="stock-rule-advanced"><summary>Referencia, variante y conversión de packs</summary><div class="stock-rule-fields">'+field('reference',row.reference,'Referencia')+field('ean',row.ean,'EAN')+field('variant',row.variant,'Variante')+field('factor',row.factor,'Unidades por pack (si procede)','number')+field('conversionNote',row.conversionNote,'Evidencia de la conversión')+'</div></details></article>';
 }
 function render(){
  release();
  host.innerHTML='<div class="stock-rule-intro"><span class="badge good">Sin IA · cálculo local</span><h3>Factura y entrada, con evidencia</h3><p>Revisa las líneas reconocidas y sus unidades. No se adivinan equivalencias ni se sustituyen cantidades desconocidas por cero. Puedes consultar el original sin descargarlo.</p><p>Si hay factura y albarán del mismo suministro, incluye solo uno y justifica la exclusión del duplicado. Los documentos y los resultados anteriores se conservan en su historial.</p></div><div class="stock-rule-documents">'+docs.map((d,i)=>'<section class="stock-rule-document" data-rule-document="'+i+'"><div class="section-head"><div><span class="badge">'+(d.source.source_kind==='supplier'?'Factura / albarán':'Entrada de PrestaShop')+'</span><h4>'+esc(d.source.document?.original_name||'Documento')+'</h4><small>'+d.rows.length+' líneas propuestas · '+esc(d.parser==='unrecognized'?'Formato no reconocido: introduce las líneas verificadas':'Revisar contra el original')+'</small></div><button type="button" class="btn secondary" data-rule-preview="'+i+'">Ver original</button></div><label class="stock-rule-check"><input type="checkbox" data-rule-include '+(d.included?'checked':'')+'> Incluir este documento en la comparación</label><details><summary>Texto y líneas no reconocidas</summary><pre class="stock-text">'+esc(d.source.extracted_text||'Sin texto extraído: consulta el original.')+'</pre>'+(d.unread?.length?'<p>'+d.unread.length+' fragmentos sin interpretación tabular. Confirma que no falten productos.</p>':'')+'</details><div class="stock-rule-lines">'+d.rows.map(lineHtml).join('')+'</div><button type="button" class="btn secondary" data-rule-add="'+i+'">Añadir línea verificada</button><label>Comprobación de lectura / motivo de exclusión<textarea data-rule-note rows="2" placeholder="He contrastado todas las líneas y unidades con el original…">'+esc(d.note)+'</textarea></label><label class="stock-rule-check"><input type="checkbox" data-rule-reviewed '+(d.reviewed?'checked':'')+'> He revisado el documento completo y las líneas incluidas o su exclusión</label></section>').join('')+'</div><p class="note warn">Una coincidencia por nombre no resuelve un pack ni una variante desconocida. Las correspondencias ambiguas se guardan como pendientes y pueden asignarse después con justificación.</p><div role="alert" data-rule-error></div><div class="form-actions"><button type="button" class="btn primary" data-rule-compare>Comparar documentos sin IA</button></div><div data-rule-result></div>';
 }
 function read(){
  for(const section of host.querySelectorAll('[data-rule-document]')){
   const d=docs[Number(section.dataset.ruleDocument)];d.included=section.querySelector('[data-rule-include]').checked;d.reviewed=section.querySelector('[data-rule-reviewed]').checked;d.note=section.querySelector('[data-rule-note]').value;
   for(const rowEl of section.querySelectorAll('[data-rule-line]')){const row=d.rows[Number(rowEl.dataset.ruleLine)];for(const input of rowEl.querySelectorAll('[data-rule-field]'))row[input.dataset.ruleField]=['quantity','factor'].includes(input.dataset.ruleField)?stockRuleQuantity(input.value):input.value.trim();}
  }
 }
 function error(message){host.querySelector('[data-rule-error]').textContent=message;host.querySelector('[data-rule-error]').scrollIntoView({block:'nearest'});}
 host.addEventListener('input',()=>{proposal=null;host.querySelector('[data-rule-result]').replaceChildren();});
 host.addEventListener('change',()=>{proposal=null;host.querySelector('[data-rule-result]').replaceChildren();});
 host.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b||saving)return;
  try{
   if(!valid())throw Error('La sesión o la recepción ha cambiado. Vuelve a abrir el cotejo.');
   if(b.hasAttribute('data-rule-preview')){
    const d=docs[Number(b.dataset.rulePreview)],section=b.closest('[data-rule-document]');let viewer=section.querySelector('[data-rule-viewer]');
    if(viewer){if(viewer.dataset.url)URL.revokeObjectURL(viewer.dataset.url);viewer.remove();return;}
    b.disabled=true;try{const blob=await preview(d.source.document);if(!valid()||!host.isConnected)return;viewer=document.createElement('div');viewer.dataset.ruleViewer='';
     if(/\.pdf$/i.test(d.source.document?.original_name||'')){const url=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));objectUrls.add(url);viewer.dataset.url=url;const frame=document.createElement('iframe');frame.title='Original de '+d.source.document.original_name;frame.src=url;viewer.append(frame);}
     else{const pre=document.createElement('pre');pre.className='stock-text';pre.textContent=d.source.extracted_text||'Consulta este formato desde Documentos.';viewer.append(pre);}
     b.after(viewer);
    }finally{b.disabled=false;}return;
   }
   if(b.hasAttribute('data-rule-add')){read();const d=docs[Number(b.dataset.ruleAdd)],id=crypto.randomUUID();d.rows.push({id:d.source_id+':manual:'+id,source_id:d.source_id,line_id:'manual-'+id,locator:'Línea añadida y verificada por el usuario',name:'',reference:'',ean:'',variant:'',quantity:null,unit:''});render();return;}
   if(b.hasAttribute('data-rule-remove')){read();const section=b.closest('[data-rule-document]'),d=docs[Number(section.dataset.ruleDocument)];d.rows.splice(Number(b.dataset.ruleRemove),1);d.reviewed=false;proposal=null;render();return;}
   if(b.hasAttribute('data-rule-compare')){
    read();proposal=stockRuleResult(context,docs);const s=proposal.summary;
    host.querySelector('[data-rule-error]').textContent='';host.querySelector('[data-rule-result]').innerHTML='<section class="stock-rule-proposal"><div class="section-head"><h3>Vista previa · '+esc(STOCK_STATES[s.status])+'</h3><span>'+s.rows.length+' líneas · '+s.differences+' diferencias</span></div><div class="stock-rule-results">'+proposal.result.rows.map(r=>{const x=stockLineResult(r);return '<article><b>'+esc(r.supplier_name||r.prestashop_name)+'</b><small>'+esc(r.match_note)+'</small><dl><div><dt>Esperadas</dt><dd>'+qty(x.expected)+'</dd></div><div><dt>Entrada</dt><dd>'+qty(x.received)+'</dd></div><div><dt>Diferencia</dt><dd>'+qty(x.difference)+'</dd></div></dl><p>'+esc(x.reasons.join(' · ')||STOCK_STATES[x.status])+'</p></article>';}).join('')+'</div><p>Guardar crea una revisión de esta recepción. No cambia existencias, facturas, gastos ni documentos originales.</p><button type="button" class="btn primary" data-rule-save>Guardar cotejo sin IA</button></section>';host.querySelector('[data-rule-result]').scrollIntoView({block:'start'});return;
   }
   if(b.hasAttribute('data-rule-save')){
    if(!proposal)throw Error('Compara de nuevo tras modificar las líneas.');saving=true;b.disabled=true;b.textContent='Guardando revisión…';await save(proposal.result);
   }
  }catch(e){error(e.message||String(e));}finally{saving=false;if(b.isConnected&&b.hasAttribute('data-rule-save')){b.disabled=false;b.textContent='Guardar cotejo sin IA';}}
 });
 render();
}
