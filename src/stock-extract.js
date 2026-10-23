// Extractor local y gratuito de documentos de recepción.
// No hay llamadas a servidores de IA: el original se archiva por el circuito privado de Totus.
const MAX_CHARS=250000;
const MAX_PAGES=100;
const MAX_EXCEL_ROWS=3000;
const MAX_EXCEL_SHEETS=50;
export const STOCK_ACCEPT='.pdf,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.webp';

export function capStockText(raw,limit=MAX_CHARS){
 const value=String(raw??'');
 return {text:value.slice(0,limit),truncated:value.length>limit};
}
export function stockExtractionSummary({text='',truncated=false,unreadable=false,detail='',pages=null}={}){
 return {
  extracted_text:text,
  extraction_state:unreadable?'sin_texto':truncated?'parcial':text.trim()?'listo':'sin_texto',
  extraction_notes:detail,
  extracted_pages:pages
 };
}
function textDocument(file){
 return file.text().then(content=>stockExtractionSummary({...capStockText(content),detail:'Texto leído localmente del documento'}));
}
async function readExcel(file){
 if(!globalThis.window?.XLSX)throw new Error('No está disponible el lector Excel incluido en Totus Central.');
 const book=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
 const out=[];
 let limitHit=book.SheetNames.length>MAX_EXCEL_SHEETS;
 for(const sheet of book.SheetNames.slice(0,MAX_EXCEL_SHEETS)){
  const rows=window.XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,raw:false,defval:''});
  out.push('[HOJA: '+sheet+']');
  if(rows.length>MAX_EXCEL_ROWS)limitHit=true;
  for(let i=0;i<Math.min(rows.length,MAX_EXCEL_ROWS);i++){
   const cells=rows[i].map(value=>String(value??'').replace(/\s+/g,' ').trim());
   out.push('Fila '+(i+1)+': '+cells.join(' | '));
  }
 }
 const value=capStockText(out.join('\n'));
 return stockExtractionSummary({text:value.text,truncated:value.truncated||limitHit,
  detail:limitHit||value.truncated?'Libro demasiado extenso: se conserva el original y faltan líneas por extraer':'Excel leído localmente, hojas y filas indicadas'});
}
async function readPdf(file){
 const lib=await import('./vendor/pdfjs/pdf.mjs');
 lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
 const task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
 let doc;
 try{
  doc=await task.promise;
  const pages=[];
  const total=doc.numPages;
  const count=Math.min(MAX_PAGES,total);
  for(let p=1;p<=count;p++){
   const page=await doc.getPage(p);
   const items=(await page.getTextContent()).items||[];
   const lines=[], grouped=[];
   // Mantener página, orden y saltos básicos. No afirmar que recrea tablas complejas.
   let lastY=null;
   for(const item of items){
    if(typeof item.str!=='string')continue;
    const y=Number(item.transform?.[5]??0);
    if(lastY!==null&&Math.abs(lastY-y)>2&&grouped.length){lines.push(grouped.join(' '));grouped.length=0}
    grouped.push(item.str);lastY=y;
    if(item.hasEOL){lines.push(grouped.join(' '));grouped.length=0;lastY=null}
   }
   if(grouped.length)lines.push(grouped.join(' '));
   pages.push('[PÁGINA '+p+'/'+total+']\n'+lines.join('\n'));
   page.cleanup();
  }
  const result=capStockText(pages.join('\n\n'));
  return stockExtractionSummary({text:result.text,
   truncated:result.truncated||total>count,pages:count,
   detail:total>count?'Se han leído '+count+' de '+total+' páginas; documento incompleto':
   result.truncated?'El texto superó el límite; documento incompleto':
   result.text.trim()?'Texto PDF extraído en el navegador (verificar columnas y cantidades)':
   'PDF sin capa de texto reconocible: puede estar escaneado y necesitar lectura visual'});
 }finally{await task.destroy().catch(()=>{})}
}
export async function extractStockDocument(file){
 const extension=String(file?.name||'').split('.').pop().toLowerCase();
 try{
  if(['txt','csv','md'].includes(extension))return await textDocument(file);
  if(['xlsx','xls'].includes(extension))return await readExcel(file);
  if(extension==='pdf')return await readPdf(file);
  return stockExtractionSummary({unreadable:true,detail:'Imagen o formato sin extracción de texto local; original archivado pendiente de lectura'});
 }catch(error){
  return stockExtractionSummary({unreadable:true,detail:'No se pudo extraer texto en el navegador: '+String(error?.message||'Error desconocido').slice(0,250)});
 }
}
