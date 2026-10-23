// Imports only originals already copied into Totus's private application folder.
// Neither this module nor its caller receives the Microsoft refresh token.
export async function importStockDocument(body,{admin,check,token,root,graph,encodedPath,readContent,fileHash}){
 const path=String(body.path||''),itemId=String(body.item_id||''),name=String(body.name||'');
 if(!path.startsWith('01 Documentos/Recepciones/')||path.length>1024||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f]/.test(path)
  ||!/\.(pdf|xlsx|xls|csv|txt|md|jpg|jpeg|png|webp)$/i.test(name))throw new Error('Ruta de recepción no válida.');
 if(!['supplier','prestashop'].includes(body.kind)||typeof body.text!=='string'||body.text.length>250000)throw new Error('Datos de documento no válidos.');
 const receipt=check(await admin.from('ops_stock_receipts').select('id,revision').eq('id',body.receipt_id).single(),'Recepción no disponible.');
 if(receipt.revision!==body.revision)throw new Error('La recepción ha cambiado. Actualiza antes de importar.');
 const access=await token();await root(access);
 const response=await graph(access,'/me/drive/special/approot:/'+encodedPath(path.split('/')));
 if(!response.ok)throw new Error('El original aún no está en la carpeta de Totus. Espera a que termine la copia.');
 const metadata=await response.json();
 if(metadata.id!==itemId||metadata.name!==name||!metadata.file||!Number.isSafeInteger(metadata.size)||metadata.size<=0||metadata.size>20*1024*1024)throw new Error('El archivo no coincide con la copia elegida.');
 if(!body.quickxor||metadata.file.hashes?.quickXorHash!==body.quickxor)throw new Error('La copia no coincide con la huella del original.');
 const bytes=await readContent(access,'/me/drive/special/approot:/'+encodedPath(path.split('/'))+':/content');
 if(bytes.byteLength!==metadata.size)throw new Error('El tamaño del original ha cambiado durante la lectura.');
 const sha256=await fileHash(bytes);
 const result=await admin.rpc('totus_stock_register_cloud_document',{p_id:body.receipt_id,p_revision:body.revision,p_kind:body.kind,p_path:path,p_item:itemId,p_name:name,p_size:metadata.size,p_sha:sha256,p_text:body.text,p_extraction:body.extraction,p_actor_email:String(body.actor_email||'')});
 if(result.error)throw new Error(result.error.message||'No se pudo asociar el original verificado.');
 return {imported:true,receipt_id:body.receipt_id,revision:result.data.revision,status:result.data.status};
}
