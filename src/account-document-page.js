// Bounded metadata only, through the existing authenticated client and RLS.
export async function readAccountDocumentPage(client,target,{page=1,size=20,query=''}={}){
 if(!target||!Number.isSafeInteger(page)||page<1||![10,20,50].includes(size))throw Error('Página de documentos no válida');
 const offset=(page-1)*size;if(!Number.isSafeInteger(offset))throw Error('Página fuera de rango');
 let request=client.from('ops_documents').select('*').eq('uploaded_by',target).order('document_date',{ascending:false}).order('id',{ascending:true});
 const term=String(query).trim().slice(0,160);if(term)request=request.ilike('original_name','%'+term.replace(/[\\%_]/g,c=>'\\'+c)+'%');
 request=request.range(offset,offset+size);if(typeof request.abortSignal==='function')request=request.abortSignal(AbortSignal.timeout(20000));
 const result=await request;
 if(result.error)throw Error(result.error.message||'No se pudieron leer los documentos');
 if(!Array.isArray(result.data)||result.data.length>size+1||result.data.some(d=>d.uploaded_by!==target))throw Error('Respuesta de documentos no válida');
 return {rows:result.data.slice(0,size),hasMore:result.data.length>size};
}
