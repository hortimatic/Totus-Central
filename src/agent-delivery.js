import {chatFileMetadata,microsoftTransferUrl,chatFileHash} from './chat-files.js';
const checked=r=>{if(r.error)throw Error(r.error.message||'No se pudo leer el documento autorizado.');return r.data;};
export function createDeliveryQueue(){
 const files=[];let total=0;
 function stage(file){const meta=chatFileMetadata(file);const previous=files.find(f=>f.name===file.name);if(previous)throw Error('El archivo ya está preparado; no lo dupliques.');if(files.length>=4||total+meta.size>25*1024*1024)throw Error('La respuesta supera cuatro archivos o 25 MB. Divide la petición.');files.push(file);total+=meta.size;return {prepared:true,delivered:false,name:meta.name,size:meta.size,instruction:'Preparado para adjuntar a la respuesta; solo Totus confirmará su entrega después de subir y verificar.'};}
 return {files,stage};
}
export async function readAuthorizedDocument(client,doc,authorize,request=fetch){
 await authorize('documentos','view');
 if(!doc?.storage_path||!Number.isSafeInteger(doc.size_bytes)||doc.size_bytes<1||doc.size_bytes>20*1024*1024||!/^[a-f0-9]{64}$/.test(doc.sha256||''))throw Error('El documento necesita tamaño y huella verificados antes de enviarlo.');
 const location=checked(await client.functions.invoke('totus-onedrive',{body:{action:'document-file-url',path:doc.storage_path}}));let blob;
 if(location?.provider==='onedrive'){
  const response=await request(microsoftTransferUrl(location.url),{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('No se pudo descargar el original de OneDrive.');
  const reader=response.body?.getReader();if(!reader)throw Error('El original está vacío.');const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>doc.size_bytes)throw Error('El original supera el tamaño esperado.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  blob=new Blob(chunks,{type:doc.mime_type});
 }else if(location?.provider==='supabase')blob=checked(await client.storage.from('business-documents').download(doc.storage_path));
 else throw Error('Ubicación del original no reconocida.');
 if(!(blob instanceof Blob)||blob.size!==doc.size_bytes||await chatFileHash(blob)!==doc.sha256)throw Error('El original no coincide con la huella y tamaño registrados.');
 await authorize('documentos','view');return new File([blob],doc.original_name,{type:doc.mime_type});
}
const cell=v=>{const text=typeof v==='number'?String(v).replace('.',','):String(v??'');return '"'+(typeof v==='string'&&/^[=+@\-\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};
export function reportCsv(report){
 const rows=[['Informe Totus Central','EUR'],['Desde',report.from],['Hasta',report.to],['Tienda',report.store],['Ingresos',report.income],['Gastos registrados',report.recorded_expenses],['Gastos internos',report.internal_expenses],['Resultado antes de impuestos',report.result_before_taxes],...Object.entries(report.income_breakdown||{}).map(([k,v])=>['Ingresos · '+k,v]),['Nota',report.note]];
 return new File(['\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n')],'Informe_'+report.from+'_'+report.to+'.csv',{type:'text/csv'});
}
