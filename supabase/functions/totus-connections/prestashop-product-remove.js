import {prestashopCapabilities} from './prestashop.js';
import {sha256Text,inspectProductAssociationIds,parsePrestashopResourceId,readPrestashopCombinationXml} from '../../../src/productos-write-contract.js';
// Called only after the shared stage contract, account and parent ownership checks.
export async function runProductRemoval(op,{root,xml,json,call,journal,env}){
 const group=op.kind==='remove_variation'?'combinations':'images',target=String(op.record_id);
 const snapshot=async()=>{const response=await json('products/'+op.product_id,{display:'[id,'+group+'[id]]'}),product=response.product||response.products?.[0],rows=product?.associations?.[group];if(String(product?.id)!==op.product_id)throw Error('No se ha podido verificar la pertenencia del registro.');if(!Array.isArray(rows))return inspectProductAssociationIds(await xml('products/'+op.product_id,{display:'[id,'+group+'[id]]'}),op.product_id,group);if(rows.some(row=>!/^\d+$/.test(String(row.id))))throw Error('No se ha podido verificar la pertenencia del registro.');return rows.map(row=>String(row.id));};
 const signature=await sha256Text(JSON.stringify({kind:op.kind,product_id:op.product_id,record_id:target}));
 const result=()=>({ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:target,persisted:true,verified:true,deleted:true});
 const prior=op.commit?await journal.lookup(op):null;
 if(prior){if(prior.signature!==signature||prior.record_id&&String(prior.record_id)!==target)throw Error('La eliminación está vinculada a otro registro.');if((await snapshot()).includes(target))throw Error('El registro sigue presente. No se repite una eliminación incierta; revisa el resultado.');if(prior.status!=='completed')await journal.complete(op,signature,target);return {...result(),reused:true};}
 const members=await snapshot();if(!members.includes(target))throw Error('El registro no pertenece a este producto o ya fue eliminado.');
 let original='';
 if(group==='combinations'){original=await xml('combinations/'+target);const variant=readPrestashopCombinationXml(original,target);if(String(variant?.id)!==target||String(variant.id_product)!==op.product_id)throw Error('La combinación pertenece a otro producto.');}
 const fingerprint=await sha256Text(signature+'|'+root+'|'+original+'|'+JSON.stringify(members));
 const advertised=prestashopCapabilities(await xml('')).resources.find(resource=>resource.name===group);const missing_permissions=['GET','DELETE'].filter(method=>advertised?.permissions?.[method]!==true);
 const enabled=!missing_permissions.length&&env.get('TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED')==='1'&&env.get('TOTUS_PRESTASHOP_PRODUCT_STAGES_ENABLED')==='1';
 if(!op.commit)return {ok:true,store:op.store,kind:op.kind,resource:op.resource,record_id:target,persisted:false,fingerprint,can_commit:enabled,missing_permissions};
 if(!enabled)throw Error(missing_permissions.length?'La conexión necesita '+group+': '+missing_permissions.join(', ')+'.':'La edición de productos no está habilitada.');
 if(op.expected_fingerprint!==fingerprint)throw Error('El destino cambió. Revisa y valida de nuevo la eliminación.');
 if((await journal.claim(op,signature))?.status!=='claimed')throw Error('La eliminación ya está en curso. Comprueba su resultado.');
 try{const response=await call(group==='images'?'images/products/'+op.product_id+'/'+target:'combinations/'+target,{method:'DELETE'});await response.body?.cancel();if((await snapshot()).includes(target))throw Error('El registro todavía aparece en el producto.');}
 catch(error){try{if(!(await snapshot()).includes(target)){await journal.complete(op,signature,target);return {...result(),reconciled:true};}}catch{}await journal.uncertain(op,signature);throw Error('Eliminación incierta; no se repetirá automáticamente. '+String(error?.message||error));}
 await journal.complete(op,signature,target);return result();
}

// Whole-product removal is separate from child membership deletion. Only a
// verified HTTP 404 counts as absence; connection failures never do.
export async function runWholeProductRemoval(op,{xml,call,journal,env}){
 const path='products/'+op.product_id,signature=await sha256Text(JSON.stringify({kind:op.kind,product_id:op.product_id}));
 const read=async()=>{try{const raw=await xml(path,{display:'[id,reference,active,combinations[id],images[id]]'});if(parsePrestashopResourceId(raw,'product')!==op.product_id)throw Error('Producto no verificable.');return raw;}catch(error){if(/\(HTTP 404\)/.test(String(error.message)))return null;throw error;}};
 const result=()=>({ok:true,store:op.store,kind:op.kind,resource:'products',record_id:op.product_id,persisted:true,verified:true,deleted:true});
 const prior=op.commit?await journal.lookup(op):null,original=await read();
 if(prior){if(prior.signature!==signature)throw Error('El borrado pertenece a otra operación.');if(original!==null)throw Error('El producto sigue presente. Comprueba el borrado sin repetirlo.');if(prior.status!=='completed')await journal.complete(op,signature,op.product_id);return {...result(),reused:true};}
 if(original===null)throw Error('El producto ya no existe.');
 const fingerprint=await sha256Text(signature+'|'+original),cap=prestashopCapabilities(await xml('')).resources.find(r=>r.name==='products'),missing_permissions=['GET','DELETE'].filter(m=>cap?.permissions?.[m]!==true),enabled=!missing_permissions.length&&env.get('TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED')==='1'&&env.get('TOTUS_PRESTASHOP_PRODUCT_STAGES_ENABLED')==='1';
 if(!op.commit)return {ok:true,store:op.store,kind:op.kind,resource:'products',record_id:op.product_id,persisted:false,fingerprint,can_commit:enabled,missing_permissions};
 if(!enabled||op.expected_fingerprint!==fingerprint)throw Error('Revisa la ficha actual y los permisos antes de eliminar.');
 if((await journal.claim(op,signature))?.status!=='claimed')throw Error('El borrado ya está en curso.');
 try{const response=await call(path,{method:'DELETE'});await response.body?.cancel();if(await read()!==null)throw Error('El producto sigue presente.');}catch(error){try{if(await read()===null){await journal.complete(op,signature,op.product_id);return {...result(),reconciled:true};}}catch{}await journal.uncertain(op,signature);throw Error('Borrado pendiente de comprobar. No se repetirá automáticamente.');}
 await journal.complete(op,signature,op.product_id);return result();
}
