import {prestashopCapabilities} from './prestashop.js';
import {sha256Text} from '../../../src/productos-write-contract.js';
import {inspectTransparentProductPng} from '../../../src/productos-png.js';
async function imageHash(response){
 if(!/^image\/(?:jpeg|png|gif|webp)(?:;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La tienda no devolvió una imagen verificable.');}
 const reader=response.body?.getReader();if(!reader)throw Error('Imagen vacía.');const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8388608){await reader.cancel();throw Error('Imagen de tienda demasiado grande para verificar.');}chunks.push(value);}}finally{reader.releaseLock();}
 if(!size)throw Error('Imagen vacía.');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
}
// Fixed native image route only; called after actor and parent ownership validation.
export async function runProductImageReplacement(op,{root,xml,json,call,journal,env}){
 const target=op.record_id,path='images/products/'+op.product_id+'/'+target;
 const snapshot=async()=>{const data=await json('products/'+op.product_id,{display:'[id,id_default_image,images[id]]'}),p=data.product||data.products?.[0];if(String(p?.id)!==op.product_id||!Array.isArray(p.associations?.images)||!p.associations.images.some(i=>String(i.id)===target))throw Error('La imagen no pertenece a este producto.');return JSON.stringify({cover:p.id_default_image,images:p.associations.images.map(i=>String(i.id))});};
 const image=await inspectTransparentProductPng(op.image.base64),signature=await sha256Text(JSON.stringify({kind:op.kind,product_id:op.product_id,record_id:target,image:op.image.base64}));
 const membership=await snapshot(),result=()=>({ok:true,store:op.store,kind:op.kind,resource:'images',record_id:target,persisted:true,verified:true,replaced:true,store_may_convert_format:true});
 const prior=op.commit?await journal.lookup(op):null;
 if(prior){if(prior.signature!==signature)throw Error('La sustitución está vinculada a otra imagen.');if(prior.status!=='completed')throw Error('Sustitución incierta: revisa la foto de la tienda. No se repetirá automáticamente.');await imageHash(await call(path));return {...result(),reused:true};}
 const before=await imageHash(await call(path)),fingerprint=await sha256Text(signature+'|'+root+'|'+membership+'|'+before);
 const advertised=prestashopCapabilities(await xml('')).resources.find(r=>r.name==='images'),missing_permissions=['GET','PUT'].filter(m=>advertised?.permissions?.[m]!==true);
 const enabled=!missing_permissions.length&&env.get('TOTUS_PRESTASHOP_PRODUCT_WRITE_ENABLED')==='1'&&env.get('TOTUS_PRESTASHOP_PRODUCT_STAGES_ENABLED')==='1';
 if(!op.commit)return {ok:true,store:op.store,kind:op.kind,resource:'images',record_id:target,persisted:false,can_commit:enabled,missing_permissions,fingerprint};
 if(!enabled)throw Error('La conexión necesita edición de imágenes y permisos GET/PUT.');
 if(op.expected_fingerprint!==fingerprint)throw Error('La imagen cambió. Valida de nuevo antes de sustituirla.');
 if((await journal.claim(op,signature))?.status!=='claimed')throw Error('La sustitución ya está en curso.');
 try{
  const form=new FormData();form.append('image',new Blob([image.bytes],{type:'image/png'}),op.image.name);
  // Native documented method override lets PHP parse multipart files for a PUT.
  const written=await imageHash(await call(path,{method:'POST',body:form},{ps_method:'PUT'}));
  if(await imageHash(await call(path))!==written||await snapshot()!==membership)throw Error('No se confirma la misma imagen guardada o se modificó su galería.');
 }catch(error){await journal.uncertain(op,signature);throw Error('Sustitución incierta; no se repetirá automáticamente. '+String(error?.message||error));}
 await journal.complete(op,signature,target);return result();
}
