import {BARCODE_FIELDS,barcodeOptions,barcodeOptionsHtml,barcodeOptionsFromForm} from './barcode-options.js';
import {LABEL_PAPERS,labelSheetHtml,printBarcodeLabels} from './barcode-labels.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={preparing:'Preparando la lista',review:'Lista para revisar',processing:'Generando códigos',paused:'En pausa',completed:'Finalizado',cancelled:'Cancelado',pending:'Pendiente',generated:'Código generado','already-set':'Código conservado',unavailable:'Artículo no disponible',uncertain:'Pendiente de comprobar',dispatched:'Comprobando resultado'};
const button=(action,label,disabled=false,primary=false)=>`<button type="button" class="btn ${primary?'primary':'secondary'}" data-tpv-barcode="${action}" ${disabled?'disabled':''}>${label}</button>`;

export function createBarcodePanel({adapter,canRead,canEdit,onProgress=()=>{},confirm=async()=>false}){
 let options=barcodeOptions(),jobs=[],active=null,after=0,epoch=0,running=false,stop='',failure='',accepted=false;
 let labelData=null,labelPaper='thermal58',labelCopies=1;
 const changed=()=>onProgress();
 function reset(){epoch++;running=false;stop='';failure='';accepted=false;jobs=[];active=null;after=0;options=barcodeOptions();labelData=null;}
 async function current(task){const born=epoch,result=await task();if(born!==epoch)throw Error('La vista ha cambiado.');if(!canRead())throw Error('Ya no tienes acceso a los códigos de esta tienda.');return result;}
 async function refresh(){jobs=await current(()=>adapter().barcodeJobs());if(active)active=await current(()=>adapter().getBarcodeJob(active.id,{after,pageSize:50}));}
 async function load(){if(!canRead())throw Error('No tienes permiso para consultar los códigos.');options=barcodeOptions(await current(()=>adapter().barcodeOptions()));await refresh();}
 async function run(){
  const born=epoch;
  while(born===epoch&&active&&['preparing','processing'].includes(active.status)){
   if(stop){const requested=stop;stop='';active=await current(()=>adapter()[requested==='pause'?'pauseBarcodeJob':'cancelBarcodeJob'](active.id));break;}
   if(!canEdit())throw Error('Necesitas permiso para editar productos.');
   active=await current(()=>adapter()[active.status==='preparing'?'captureBarcodeJob':'advanceBarcodeJob'](active.id));after=0;changed();
   if(active.uncertainCount>0&&!stop)break;
  }
 }
 async function perform(task){if(running)return;const born=epoch;running=true;failure='';changed();try{await task();}catch(error){if(born===epoch)failure=error.message||'No se ha podido completar la operación. Puedes consultar su estado de nuevo.';}finally{if(born===epoch){running=false;stop='';changed();}}}
 function html(){
  if(!canRead())return '';
  const done=active?(active.generatedCount||0)+(active.keptCount||0)+(active.unavailableCount||0):0,total=active?.capturedCount||0;
  const existing=jobs.some(row=>row.field===options.field&&!['completed','cancelled'].includes(row.status));
  let preview='';if(labelData?.items.length)try{preview=labelSheetHtml({...labelData,items:labelData.items.slice(0,1)},{paper:labelPaper});}catch(error){preview=`<p class="note">${esc(error.message)}</p>`;}
  return `<section class="card card-pad tpv-barcode-panel" aria-labelledby="tpv-barcode-heading"><header><div><p class="small muted">Catálogo · identificación de artículos</p><h3 id="tpv-barcode-heading">Códigos de barras</h3><p>Completa los códigos que faltan en tus artículos y variantes. Los códigos existentes se conservan.</p></div>${button('refresh','Actualizar',running)}</header>
   ${failure?`<p class="note bad" role="alert">${esc(failure)}</p>`:''}
   <details class="tpv-barcode-settings"><summary>Configuración de códigos</summary><form data-tpv-barcode-form>${barcodeOptionsHtml(options,canEdit()&&!running)}<button class="btn secondary" type="submit" ${!canEdit()||running?'disabled':''}>Guardar configuración</button></form></details>
   <section class="tpv-barcode-start"><div><h4>Generar códigos faltantes</h4><p>${existing?'Ya tienes un trabajo en curso para este campo. Selecciónalo en Trabajos guardados para continuar.':'Primero prepararemos la lista completa. Podrás revisarla antes de autorizar la generación.'}</p></div>${button('create','Preparar lista',running||!canEdit()||!options.generatorEnabled||existing,true)}</section>
   ${active?`<section class="tpv-barcode-review" aria-label="Trabajo seleccionado"><header><div><h4>${esc(labels[active.status]||'Estado pendiente de consultar')}</h4><p>${esc(BARCODE_FIELDS[active.field]?.label)} · ${total} artículos y variantes</p></div><span class="tpv-barcode-badge">${done} de ${total} resueltos</span></header>
    ${active.captureComplete?`<progress max="${Math.max(1,total)}" value="${done}" aria-label="Artículos resueltos"></progress><div class="tpv-barcode-counts"><span><b>${active.generatedCount||0}</b> generados</span><span><b>${active.keptCount||0}</b> conservados</span><span><b>${active.pendingCount||0}</b> pendientes</span><span><b>${active.unavailableCount||0}</b> no disponibles</span></div>`:'<p role="status">Buscando los artículos sin código. Puedes pausar y continuar más tarde.</p>'}
    ${active.uncertainCount?'<p class="note" role="status">Hay resultados pendientes de comprobar. Se consultarán antes de continuar; no se repetirá la asignación.</p>':''}
    <div class="tpv-barcode-table"><table><thead><tr><th>Artículo y variante</th><th>Referencia</th><th>Código</th><th>Estado</th></tr></thead><tbody>${(active.items||[]).map(row=>`<tr><td><strong>${esc(row.name)}</strong>${row.variantName?`<small>${esc(row.variantName)}</small>`:''}</td><td>${esc(row.reference)||'—'}</td><td><code>${esc(row.code)||'—'}</code></td><td>${esc(labels[row.status]||'Pendiente')}</td></tr>`).join('')||'<tr><td colspan="4">Todavía no hay artículos en esta lista.</td></tr>'}</tbody></table></div>
    <div class="inline-actions">${button('previous','Anterior',running||after===0)}<span>Artículos ${total?after+1:0}–${Math.min(after+(active.items?.length||0),total)} de ${total}</span>${button('next','Siguiente',running||!active.hasMore)}</div>
    ${active.status==='review'?`<label class="tpv-check"><input type="checkbox" data-tpv-barcode-accepted ${accepted?'checked':''} ${running?'disabled':''}> He revisado la lista de ${total} artículos y autorizo generar sus códigos internos.</label>${button('confirm','Generar códigos',running||!canEdit()||!accepted,true)}`:''}
    <div class="inline-actions">${active.uncertainCount&&['paused','cancelled'].includes(active.status)?button('recover','Comprobar operaciones enviadas',running):''}${['preparing','processing','paused'].includes(active.status)?button('continue',active.uncertainCount?'Comprobar resultado y continuar':'Continuar',running||!canEdit(),true):''}${['preparing','processing'].includes(active.status)?button('pause',stop==='pause'?'Pausando…':'Pausar',!canEdit()||!!stop):''}${!['completed','cancelled'].includes(active.status)?button('cancel',stop==='cancel'?'Cancelando…':'Cancelar trabajo',!canEdit()||!!stop):''}</div>
    <p class="small muted">Pausar o cancelar detiene los siguientes artículos. Los códigos ya generados se conservan y las operaciones enviadas se comprueban.</p>
    <section class="tpv-barcode-print"><h4>Etiquetas de esta página</h4><p>Consulta los códigos actuales antes de imprimir. Los artículos sin un código válido se excluyen.</p><div class="inline-actions"><label>Papel<select data-tpv-barcode-paper ${running?'disabled':''}>${Object.entries(LABEL_PAPERS).map(([id,p])=>`<option value="${id}" ${id===labelPaper?'selected':''}>${esc(p.label)}</option>`).join('')}</select></label><label>Copias por artículo<input type="number" min="1" max="20" step="1" value="${labelCopies}" data-tpv-barcode-copies ${running?'disabled':''}></label></div><div class="inline-actions">${button('labels','Preparar etiquetas',running||!active.items?.length)}${labelData?button('print-labels','Imprimir etiquetas',running||!labelData.items.length,true):''}</div>${labelData?`<p role="status">${labelData.items.length} artículos con código · ${labelData.skipped.length} excluidos · ${labelData.items.length*labelCopies} etiquetas</p><div class="tpv-barcode-label-preview" aria-label="Primera etiqueta de ejemplo">${preview}</div><p class="small muted">Vista previa de la primera etiqueta. Imprime al 100 % de tamaño, sin ajustar a la página.</p>`:''}</section></section>`:''}
   <section><h4>Trabajos guardados</h4><div class="tpv-barcode-history">${jobs.map(row=>button('select:'+row.id,`${esc(BARCODE_FIELDS[row.field]?.label)} · ${row.capturedCount} artículos · ${esc(labels[row.status]||'Consultar')}`,running)).join('')||'<p class="muted">Aún no hay trabajos guardados en esta caja.</p>'}</div></section></section>`;
 }
 async function click(target){
  const action=target.dataset.tpvBarcode;if(!action)return;
  if(['pause','cancel'].includes(action)&&running){if(action==='cancel'&&!await confirm('¿Cancelar este trabajo? Los códigos ya generados se conservarán.'))return;stop=action;changed();return;}
  return perform(async()=>{
   if(action==='refresh'){await load();return;}
   if(action.startsWith('select:')){after=0;accepted=false;labelData=null;active=await current(()=>adapter().getBarcodeJob(action.slice(7)));return;}
   if(action==='create'){active=await current(()=>adapter().createBarcodeJob());after=0;accepted=false;await run();await refresh();return;}
   if(!active)throw Error('Selecciona un trabajo guardado.');
   if(action==='previous'||action==='next'){labelData=null;after=action==='previous'?Math.max(0,after-50):active.nextAfter;active=await current(()=>adapter().getBarcodeJob(active.id,{after,pageSize:50}));return;}
   if(action==='labels'||action==='print-labels'){
    const born=epoch;labelData=await current(()=>adapter().barcodeLabels(active.id,{after,pageSize:50}));
    if(action==='print-labels'&&labelData.items.length)printBarcodeLabels(labelData,{paper:labelPaper,copies:labelCopies},{current:()=>born===epoch&&canRead()});return;
   }
   if(action==='confirm'){if(!accepted)throw Error('Revisa la lista y marca la confirmación.');active=await current(()=>adapter().confirmBarcodeJob(active.id,true));accepted=false;await run();}
   if(action==='continue'){if(active.status==='paused')active=await current(()=>adapter().resumeBarcodeJob(active.id));await run();}
   if(action==='recover')active=await current(()=>adapter().advanceBarcodeJob(active.id));
   if(action==='pause')active=await current(()=>adapter().pauseBarcodeJob(active.id));
   if(action==='cancel'&&await confirm('¿Cancelar este trabajo? Los códigos ya generados se conservarán.'))active=await current(()=>adapter().cancelBarcodeJob(active.id));
   await refresh();
  });
 }
 async function submit(form){return perform(async()=>{if(!canEdit())throw Error('Necesitas permiso para editar productos.');const value=barcodeOptionsFromForm(new FormData(form));options=barcodeOptions(await current(()=>adapter().barcodeOptions(value)));});}
 function input(target){
  if(target.hasAttribute('data-tpv-barcode-paper')){if(Object.hasOwn(LABEL_PAPERS,target.value))labelPaper=target.value;changed();return true;}
  if(target.hasAttribute('data-tpv-barcode-copies')){labelCopies=Number(target.value);return true;}
  if(!target.hasAttribute('data-tpv-barcode-accepted'))return false;accepted=target.checked;changed();return true;
 }
 return {html,load,click,submit,input,reset,isRunning:()=>running};
}
