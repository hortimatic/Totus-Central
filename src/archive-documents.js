// Fetch a bounded number of originals at once, keeping the archive index stable.
export async function collectArchiveDocuments(documents,readFile,{concurrency=4,onProgress=()=>{}}={}){
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw new Error('Concurrencia de archivo no válida.');
 if(new Set(documents.map(d=>d.id)).size!==documents.length)throw new Error('El índice contiene documentos duplicados.');
 const files=new Array(documents.length);let next=0,done=0,failure=null;
 async function worker(){
  while(!failure&&next<documents.length){
   const index=next++,document=documents[index];
   try{
    const blob=await readFile(document);
    if(!blob||blob.size===0)throw new Error('El archivo está vacío.');
    if(document.size_bytes!=null&&Number(document.size_bytes)!==blob.size)throw new Error('El tamaño no coincide con el original.');
    if(document.sha256){
     const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
     if(hash!==document.sha256.toLowerCase())throw new Error('El contenido no coincide con el original.');
    }
    files[index]=blob;onProgress(++done,documents.length);
   }catch(error){failure??=new Error('No se pudo incluir '+(document.original_name||'documento')+': '+error.message);}
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,documents.length)},worker));
 if(failure)throw failure;
 return files;
}
