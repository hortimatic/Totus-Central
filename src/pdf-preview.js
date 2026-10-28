// PDF.js is bundled locally: invoice contents never go to an external viewer.
import {ensurePdfMapCompatibility} from './pdf-compat.js';
let library;
export async function renderPdfPreview(blob,host){
 host.innerHTML='<div class="pdf-controls"><button type="button" class="btn secondary" data-pdf-prev disabled>Anterior</button><span role="status" aria-live="polite">Cargando PDF…</span><button type="button" class="btn secondary" data-pdf-next disabled>Siguiente</button></div><canvas class="pdf-page" role="img"></canvas>';
 const status=host.querySelector('[role="status"]'),previous=host.querySelector('[data-pdf-prev]'),next=host.querySelector('[data-pdf-next]'),canvas=host.querySelector('canvas');
 let document,loading,observer,pageNumber=1,rendering=false;
 const dispose=()=>{observer?.disconnect();loading?.destroy().catch(()=>{})};
 try{
  ensurePdfMapCompatibility();
  library ||= import('./vendor/pdfjs/pdf.mjs');
  const pdfjs=await library;
  if(!host.isConnected)return;
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  loading=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  observer=new MutationObserver(()=>{if(!host.isConnected)dispose()});
  observer.observe(host.ownerDocument.body,{childList:true,subtree:true});
  document=await loading.promise;
  const render=async()=>{
   if(rendering||!host.isConnected)return;
   rendering=true;previous.disabled=true;next.disabled=true;
   try{
    const page=await document.getPage(pageNumber),original=page.getViewport({scale:1});
    const width=Math.max(160,Math.min(1000,host.clientWidth-24)),ratio=Math.min(window.devicePixelRatio||1,2);
    const viewport=page.getViewport({scale:width/original.width});
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]}).promise;
    canvas.setAttribute('aria-label',`Página ${pageNumber} de ${document.numPages}`);
    status.textContent=`Página ${pageNumber} de ${document.numPages}`;
    host.dataset.pdfRendered=String(pageNumber);page.cleanup();
   }finally{
    rendering=false;previous.disabled=pageNumber<=1;next.disabled=pageNumber>=document.numPages;
   }
  };
  const change=async(delta)=>{pageNumber+=delta;try{await render()}catch{status.textContent='No se pudo mostrar esta página. Puedes descargar el PDF original.'}};
  previous.addEventListener('click',()=>change(-1));next.addEventListener('click',()=>change(1));
  await render();
 }catch(error){
  if(host.isConnected){status.textContent='No se pudo mostrar el PDF. Puedes descargar el original.';canvas.hidden=true;console.warn('Vista PDF no disponible',error)}
  dispose();
 }
}
