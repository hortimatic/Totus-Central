import {directoryXmlField,sha256Text} from '../../../src/productos-write-contract.js';

export async function deleteDirectoryRecord({q,commit,signature,previous,journal,xml,list,send,url}){
 const target=url(q.resource,q.record_id),original=await xml(target,{missing:true});
 const fingerprint=await sha256Text(original||'absent');
 const receipt=extra=>({ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),verified:true,deleted:true,request_id:q.request_id,...extra});
 if(original===null){
  if(previous&&previous.status!=='completed')await journal.complete(signature,String(q.record_id));
  if(previous)return receipt({persisted:true,replayed:true});
  if(!commit)return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),can_commit:true,persisted:false,fingerprint,already_absent:true};
  if(q.fingerprint!==fingerprint)throw Error('La ficha cambió desde la revisión.');return receipt({persisted:false,unchanged:true});
 }
 if(directoryXmlField(original,q.resource,'id')!==String(q.record_id))throw Error('La tienda devolvió otro registro.');
 if(q.resource==='addresses'){
  const field={clientes:'id_customer',proveedores:'id_supplier',marcas:'id_manufacturer'}[q.kind];
  if(!/^[1-9]\d*$/.test(directoryXmlField(original,q.resource,field)))throw Error('La dirección pertenece a otro directorio.');
  if(directoryXmlField(original,q.resource,'deleted')==='1'){
   if(previous&&previous.status!=='completed')await journal.complete(signature,String(q.record_id));
   if(previous)return receipt({persisted:true,replayed:true,archived:true});
   if(!commit)return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),can_commit:true,persisted:false,fingerprint,already_archived:true};
   return receipt({persisted:false,unchanged:true,archived:true});
  }
 }
 if(previous)throw Error('La eliminación anterior aún no está verificada. Actualiza esta misma solicitud antes de repetirla.');
 const directChecks={customers:[['orders','id_customer']],suppliers:[['products','id_supplier'],['product_suppliers','id_supplier']],manufacturers:[['products','id_manufacturer']]};
 for(const [resource,field]of directChecks[q.resource]||[]){const related=await list(resource,{['filter['+field+']']:'['+q.record_id+']'});if(related.length)throw Error('No se elimina porque tiene '+({orders:'pedidos',products:'productos',product_suppliers:'referencias de proveedor en productos'}[resource]||'registros')+' asociados. Puedes archivarlo conservando su historial.');}
 if(['product_options','product_option_values','product_features','product_feature_values'].includes(q.resource)){
  const combinations=q.resource.startsWith('product_option'),resource=combinations?'combinations':'products',group=combinations?'product_option_values':'product_features',targets=new Set([String(q.record_id)]);
  if(q.resource==='product_options'){targets.clear();let ended=false;for(let page=0;page<=1000;page++){const children=await list('product_option_values',{'filter[id_attribute_group]':'['+q.record_id+']'},page);for(const child of children)targets.add(String(child.id));if(children.length<100){ended=true;break;}}if(!ended)throw Error('No se pudo terminar de comprobar los valores del atributo.');}
  const seen=new Set();let complete=false;
  for(let page=0;page<=1000;page++){
   const rows=await list(resource,{display:'[id,'+group+'[id'+(combinations?'':',id_feature_value')+']]'},page);
   for(const row of rows){if(seen.has(String(row.id)))throw Error('La consulta de relaciones repitió una página.');seen.add(String(row.id));const values=row.associations?.[group]||[];if(!Array.isArray(values))throw Error('Relaciones del catálogo incompletas.');if(values.some(v=>!(/^[1-9]\d{0,14}$/).test(String(v.id))||!combinations&&!(/^[1-9]\d{0,14}$/).test(String(v.id_feature_value))))throw Error('El producto o variación '+row.id+' tiene asociaciones incompletas. Revisa su ficha.');if(values.some(v=>targets.has(String(combinations?v.id:q.resource==='product_features'?v.id:v.id_feature_value))))throw Error('El valor se utiliza en productos o variaciones. Retira esas asociaciones antes de eliminarlo.');}
   if(rows.length<100){complete=true;break;}
  }
  if(!complete)throw Error('No se pudo terminar de comprobar los productos asociados.');
 }
 if(!commit)return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(q.record_id),fingerprint,can_commit:true,persisted:false};
 if(q.fingerprint!==fingerprint||await sha256Text(await xml(target))!==fingerprint)throw Error('El registro cambió durante la revisión. No se ha eliminado.');
 if((await journal.claim(signature,String(q.record_id)))?.status!=='claimed')throw Error('Esta eliminación ya está en curso.');
 let status=null;
 try{const response=await send(target,'DELETE');status=response.status;await response.body?.cancel();}catch{}
 try{
  if(status!==null&&status>=400&&status!==500)throw Error('La tienda rechazó la eliminación.');
  const after=await xml(target,{missing:true});
  const archived=after!==null&&q.resource==='addresses'&&directoryXmlField(after,q.resource,'id')===String(q.record_id)&&directoryXmlField(after,q.resource,'deleted')==='1';
  if(after!==null&&!archived)throw Error('El registro sigue presente.');
  await journal.complete(signature,String(q.record_id));return receipt({persisted:true,...(archived?{archived:true}:{}),...(status===null||status===500?{reconciled:true}:{})});
 }catch{await journal.uncertain(signature,String(q.record_id));throw Error('No se pudo verificar la eliminación'+(status?' (HTTP '+status+')':'')+'. Actualiza antes de reintentar.');}
}
