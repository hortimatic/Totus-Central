import {productInputValue,textValue} from './productos-core.js';

export const PRODUCT_TABLE_FIELDS=Object.freeze({name:'name',reference:'reference',ean13:'ean13',cost:'wholesale_price',price:'price',weight:'weight',width:'width',height:'height',depth:'depth',active:'active',visibility:'visibility',available_for_order:'available_for_order'});
// Each row owns its native fingerprint and durable request ID. An uncertain PUT
// is checked with the same request, never silently repeated as a new operation.
export function createProductTableEditor({invoke,canEdit,onSaved=()=>{}}){
 const rows=new Map();
 const key=(shop,id)=>shop+'|'+id;
 const requireEdit=()=>{if(!canEdit())throw Error('No tienes permiso para editar productos.');};
 return {
  rows,
  restore(saved=[]){rows.clear();for(const [k,v] of saved)rows.set(k,v);},
  snapshot(){return structuredClone([...rows]);},
  open(shop,id,languages){requireEdit();const k=key(shop,id);if(!rows.has(k))rows.set(k,{shop,id:String(id),values:{},languages,language:languages[0]||'',prepared:null,request:null});return rows.get(k);},
  change(shop,id,field,value){requireEdit();const row=rows.get(key(shop,id));if(!row||row.request)throw Error('Comprueba primero la operación enviada.');if(!Object.values(PRODUCT_TABLE_FIELDS).includes(field))throw Error('Este dato se edita desde la ficha.');row.values[field]=value;row.prepared=null;},
  language(shop,id,value){const row=rows.get(key(shop,id));if(!row||row.request||!row.languages.includes(value))throw Error('Idioma no válido.');row.language=value;row.prepared=null;},
  discard(shop,id){const k=key(shop,id);if(rows.get(k)?.request)throw Error('Comprueba la escritura enviada antes de cerrar esta fila.');rows.delete(k);},
  async prepare(shop,id){requireEdit();const row=rows.get(key(shop,id));if(!row||row.request)throw Error('Comprueba la operación enviada.');const changes=Object.entries(row.values).map(([field,value])=>({field,value:productInputValue(field,value),...(field==='name'?{language_id:row.language}:{})}));if(!changes.length)throw Error('Edita al menos un dato de la fila.');const result=await invoke(shop,'prestashop_product_prepare',{resource:'products',record_id:String(id),changes});if(String(result.record_id)!==String(id)||result.resource!=='products'||!Array.isArray(result.changes)||!result.fingerprint)throw Error('Revisión de otra ficha.');row.prepared={...result,changes,review:result.changes};return result;},
  async reviewRecovery(shop,id){requireEdit();const row=rows.get(key(shop,id));if(!row?.request)throw Error('No hay una solicitud enviada para recuperar.');const {resource,record_id,changes}=row.request,result=await invoke(shop,'prestashop_product_prepare',{resource,record_id,changes});if(String(result.record_id)!==String(id)||result.resource!=='products'||!result.can_commit||!result.fingerprint||!Array.isArray(result.changes))throw Error('No se pudo revisar la misma ficha.');row.prepared={...result,changes,review:result.changes};row.request={...row.request,expected_fingerprint:result.fingerprint,recover_unchanged:true};return result;},
  async save(shop,id){requireEdit();const row=rows.get(key(shop,id));if(!row)throw Error('Abre la fila antes de guardar.');if(!row.request){if(!row.prepared?.can_commit)throw Error('Revisa los cambios antes de guardar.');row.request={resource:'products',record_id:String(id),changes:row.prepared.changes,expected_fingerprint:row.prepared.fingerprint,request_id:crypto.randomUUID(),confirmed:true};}const result=await invoke(shop,'prestashop_product_commit',row.request);if(!((result.persisted===true&&result.verified===true)||result.unchanged===true)||String(result.record_id)!==String(id))throw Error('Guardado pendiente de comprobar; conserva esta fila.');const actual=await invoke(shop,'prestashop_item_read',{resource:'products',record_id:String(id)});if(String(actual.item?.id)!==String(id)||actual.resource!=='products')throw Error('No se pudo releer el producto guardado.');await onSaved(shop,actual.item);rows.delete(key(shop,id));return result;}
 };
}
