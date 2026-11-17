import {websiteKey} from './website-registry.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function categoryCreationDraft(input){
 need(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(key=>['name','parentId'].includes(key)),'Revisa los datos de la categoría.');
 need(typeof input.name==='string'&&Array.from(input.name.trim()).length>=1&&Array.from(input.name.trim()).length<=128&&!/[\x00-\x1f\x7f<>;=#{}]/.test(input.name),'Escribe un nombre de categoría de 1 a 128 caracteres, sin caracteres especiales de marcado.');
 need(typeof input.parentId==='string'&&/^[1-9][0-9]{0,14}$/.test(input.parentId),'Selecciona la categoría donde guardar la nueva.');
 return {name:input.name.trim(),parentId:input.parentId};
}
/** Server-only adapter to the common directory creator. The native shop comes
 * from the verified workstation, never from the browser's category payload. */
export function categoryCreateRequest(input,nativeShopId){
 need(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(key=>['action','id','call_id','revision','store','request_id','payload','fingerprint','confirmed'].includes(key)),'Solicitud de categoría no válida.');
 need(['prestashop_directory_prepare','prestashop_directory_commit'].includes(input.action)&&uuid(input.id)&&uuid(input.call_id)&&uuid(input.request_id)&&
  Number.isSafeInteger(input.revision)&&input.revision>0&&websiteKey(input.store)&&Number.isSafeInteger(nativeShopId)&&nativeShopId>0,'Identidad de categoría no válida.');
 const draft=categoryCreationDraft(input.payload),slug=draft.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,128)||'categoria';
 if(input.action==='prestashop_directory_commit')need(input.confirmed===true&&/^[a-f0-9]{64}$/.test(input.fingerprint||''),'Revisa la categoría antes de guardarla.');
 return {action:input.action,id:input.id,call_id:input.call_id,revision:input.revision,store:input.store,request_id:input.request_id,
  kind:'categorias',resource:'categories',operation:'create',fields:{name:draft.name,id_parent:draft.parentId,link_rewrite:slug,active:'1',is_root_category:'0',id_shop_default:String(nativeShopId)},
  ...(input.fingerprint?{fingerprint:input.fingerprint}:{}),...(input.confirmed===true?{confirmed:true}:{})};
}
