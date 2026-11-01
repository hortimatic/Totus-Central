export async function sha256(bytes: Uint8Array) {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))].map(b=>b.toString(16).padStart(2,'0')).join('')
}
const segment=(value:unknown)=>String(value||'General').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,100)||'General'
export async function attachChatExpenseDocument(client:any,payload:any,user:any,{authorize=async()=>{}}={}) {
 const {expense_id,file_id,request_id,expected_updated_at}=payload||{}
 for(const id of [expense_id,file_id,request_id])if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||''))throw new Error('Referencias de gasto, adjunto y solicitud obligatorias')
 if(!expected_updated_at)throw new Error('Relee el gasto antes de adjuntar')
 const check=(r:any,msg:string)=>{if(r.error)throw new Error(msg+': '+r.error.message);return r.data}
 const expense=check(await client.from('ops_expenses').select('*').eq('id',expense_id).single(),'No se pudo consultar el gasto')
 const file=check(await client.from('ops_chat_files').select('*').eq('id',file_id).maybeSingle(),'No se pudo comprobar el acceso al original')
 if(!file||file.deleted_at||file.status!=='ready'||!file.verified_at)throw new Error('El original no está disponible o tu cuenta no tiene acceso a su canal')
 if(file.mime_type!=='application/pdf'||!String(file.original_name).toLowerCase().endsWith('.pdf'))throw new Error('Esta operación admite el PDF original de la factura')
 if(!Number.isSafeInteger(Number(file.size_bytes))||Number(file.size_bytes)<5||Number(file.size_bytes)>20971520||!/^[0-9a-f]{64}$/.test(file.sha256||''))throw new Error('Metadatos del original no válidos')
 const store=expense.store_id?check(await client.from('ops_stores').select('name').eq('id',expense.store_id).maybeSingle(),'No se pudo consultar la tienda'):null
 const quarter='T'+(Math.floor((Number(expense.expense_date.slice(5,7))-1)/3)+1)
 const path=[expense.expense_date.slice(0,4),quarter,expense.expense_date.slice(5,7),segment(store?.name),expense.management_only?'otro':'factura_recibida',segment(expense.supplier_name),request_id+'_'+segment(file.original_name)].join('/')
 const doc=check(await client.from('ops_documents').select('*').eq('id',request_id).maybeSingle(),'No se pudo comprobar el documento existente')
 if(doc?.linked_entity_id&&doc.linked_entity_id!==expense_id)throw new Error('El documento ya está vinculado a otro registro')
 if(doc&&(doc.storage_path!==path||doc.sha256!==file.sha256||Number(doc.size_bytes)!==Number(file.size_bytes)||doc.uploaded_by!==user.id))throw new Error('La solicitud ya corresponde a otro documento')
 if(expense.document_id){
  if(expense.document_id!==request_id||!doc||doc.linked_entity_id!==expense_id)throw new Error('El gasto ya tiene un justificante. No se sustituye automáticamente')
 }else if(Date.parse(expense.updated_at)!==Date.parse(expected_updated_at))throw new Error('El gasto ha cambiado. Actualiza su ficha antes de adjuntar')
 const response=await client.functions.invoke('totus-onedrive',{body:{action:'chat-file-content',file_id}})
 const blob=check(response,'No se pudo leer y verificar el original')
 if(!(blob instanceof Blob))throw new Error('No se recibió un archivo original verificable')
 const bytes=new Uint8Array(await blob.arrayBuffer())
 if(bytes.byteLength!==Number(file.size_bytes)||await sha256(bytes)!==file.sha256||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('El PDF no coincide con el original del chat')
 const storage=client.storage.from('business-documents')
 if(!doc){
  await authorize();
  const uploaded=await storage.upload(path,bytes,{contentType:'application/pdf',upsert:false})
  if(uploaded.error){
   const previous=await storage.download(path)
   if(previous.error||!(previous.data instanceof Blob)||await sha256(new Uint8Array(await previous.data.arrayBuffer()))!==file.sha256)throw new Error('No se pudo guardar el archivo; comprueba el resultado antes de reintentar')
  }
 }
 let storageProvider='supabase'
 let stored=await storage.download(path)
 if(stored.error&&doc){
  const location=check(await client.functions.invoke('totus-onedrive',{body:{action:'document-file-url',path}}),'No se pudo localizar el documento archivado')
  if(location.provider!=='onedrive'||typeof location.url!=='string'||!location.url.startsWith('https://'))throw new Error('Ubicación documental no válida')
  const remote=await fetch(location.url,{signal:AbortSignal.timeout(30000)})
  if(!remote.ok)throw new Error('No se pudo releer el documento de OneDrive')
  stored={data:await remote.blob(),error:null}
  storageProvider='onedrive'
 }
 const proof=check(stored,'No se pudo releer el justificante guardado')
 if(!(proof instanceof Blob)||proof.size!==bytes.byteLength||await sha256(new Uint8Array(await proof.arrayBuffer()))!==file.sha256)throw new Error('El justificante guardado no supera la comprobación de integridad')
 let document=doc
 if(!document){
  await authorize();
  document=check(await client.from('ops_documents').insert({
   id:request_id,store_id:expense.store_id,doc_type:expense.management_only?'otro':'factura_recibida',
   document_date:expense.expense_date,supplier_or_customer:expense.supplier_name,tax_id:expense.supplier_tax_id||'',
   invoice_number:expense.invoice_number,category_code:expense.management_only?'control_interno':'gasto',status:'pendiente',
   storage_path:path,original_name:file.original_name,mime_type:'application/pdf',size_bytes:bytes.byteLength,sha256:file.sha256,
   linked_entity_type:'expense',linked_entity_id:null,uploaded_by:user.id,
   notes:'Adjunto incorporado desde el chat al gasto existente; revisión fiscal independiente. Archivo origen: '+file_id
  }).select('*').single(),'No se pudo registrar el documento; conserva la misma solicitud al reintentar')
 }
 let saved=expense
 if(!expense.document_id){
  await authorize();
  saved=check(await client.from('ops_expenses').update({document_id:document.id}).eq('id',expense_id).eq('updated_at',expected_updated_at).is('document_id',null).select('*').maybeSingle(),'No se pudo asociar el documento')
  if(!saved)throw new Error('El gasto ha cambiado. El documento se conserva para revisar; no se ha sustituido la ficha')
 }
 const linked=check(await client.from('ops_documents').select('*').eq('id',document.id).single(),'No se pudo verificar el vínculo documental')
 if(saved.document_id!==document.id||linked.linked_entity_id!==expense_id||linked.linked_entity_type!=='expense')throw new Error('Asociación pendiente de confirmar; consulta antes de reintentar')
 const ignored=new Set(['document_id','updated_at'])
 for(const key of Object.keys(expense))if(!ignored.has(key)&&JSON.stringify(saved[key])!==JSON.stringify(expense[key]))throw new Error('Comprueba el gasto: se detectó un cambio adicional concurrente')
 return {expense_id,document_id:document.id,expense:saved,document:linked,sha256_verified:true,bytes_verified:bytes.byteLength,
  fiscal_fields_preserved:true,source_chat_file_id:file_id,storage_provider:storageProvider,onedrive_mirror:storageProvider==='onedrive'?'verified':'scheduled',already_attached:!!expense.document_id}
}

export async function readExpenseContext(client:any,payload:any) {
 const id=payload?.expense_id
 if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('Referencia de gasto no válida')
 const check=(r:any,msg:string)=>{if(r.error)throw new Error(msg+': '+r.error.message);return r.data}
 const expense=check(await client.from('ops_expenses').select('*').eq('id',id).single(),'No se pudo consultar el gasto')
 const lines=check(await client.from('ops_expense_lines').select('*').eq('expense_id',id).order('sort_order'),'No se pudieron consultar los conceptos')
 const document=expense.document_id?check(await client.from('ops_documents').select('*').eq('id',expense.document_id).single(),'No se pudo consultar el justificante'):null
 const settings=check(await client.from('ops_business_settings').select('fiscal_regime,estimation_method,default_sales_vat_rate,purchase_re_rate').eq('id',1).maybeSingle(),'No se pudo consultar el régimen configurado')
 return {expense,lines,document,fiscal_settings:settings,
  review_states:{document_status:document?.status||'sin_adjunto',fiscal_reviewed:expense.fiscal_reviewed,payment_status:expense.paid_status},
  guidance:'Cotejar documento, revisar fiscalidad y comprobar pago son pasos independientes. No inventar datos que falten.'}
}
export async function reviewExpenseDocument(client:any,payload:any) {
 const {expense_id,document_id,expected_sha256,expected_status,status,reason}=payload||{}
 for(const id of [expense_id,document_id])if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('Referencias de gasto y documento obligatorias')
 if(!/^[0-9a-f]{64}$/.test(expected_sha256||''))throw new Error('Comprueba la huella del original antes de revisar')
 if(!['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].includes(status)||!expected_status)throw new Error('Estado documental no válido')
 if(typeof reason!=='string'||reason.trim().length<15||reason.length>2000)throw new Error('Describe el cotejo realizado y las salvedades')
 const check=(r:any,msg:string)=>{if(r.error)throw new Error(msg+': '+r.error.message);return r.data}
 const expense=check(await client.from('ops_expenses').select('*').eq('id',expense_id).single(),'No se pudo consultar el gasto')
 const doc=check(await client.from('ops_documents').select('*').eq('id',document_id).single(),'No se pudo consultar el documento')
 if(expense.document_id!==document_id||doc.linked_entity_type!=='expense'||doc.linked_entity_id!==expense_id||doc.sha256!==expected_sha256)throw new Error('El justificante o su vínculo ha cambiado')
 const note='[Revisión documental] '+reason.trim()
 if(doc.status===status&&String(doc.notes||'').split('\n').includes(note))return {document:doc,expense_id,already_reviewed:true,fiscal_reviewed:expense.fiscal_reviewed,payment_status:expense.paid_status}
 if(doc.status!==expected_status)throw new Error('El estado documental ha cambiado; vuelve a consultar')
 const notes=[doc.notes,note].filter(Boolean).join('\n')
 const saved=check(await client.from('ops_documents').update({status,notes}).eq('id',document_id).eq('sha256',expected_sha256).eq('status',expected_status).eq('notes',doc.notes||'').select('*').maybeSingle(),'No se pudo guardar la revisión documental')
 if(!saved)throw new Error('El documento ha cambiado; no se ha sobrescrito su revisión')
 return {document:saved,expense_id,already_reviewed:false,fiscal_reviewed:expense.fiscal_reviewed,payment_status:expense.paid_status,
  guidance:'Estado del documento actualizado. La revisión fiscal y el pago no se modifican con esta acción.'}
}
