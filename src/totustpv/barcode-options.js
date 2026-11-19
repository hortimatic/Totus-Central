const fields=Object.freeze({ean13:{label:'EAN-13 interno',scheme:'rcn13-04',symbology:'ean13'},upc:{label:'UPC-A interno',scheme:'rcn12-4',symbology:'upca'},reference:{label:'Referencia interna',scheme:'totus-reference',symbology:'code128'}});
export const BARCODE_FIELDS=fields;
const need=(ok)=>{if(!ok)throw Error('Revisa la configuración de los códigos de barras.');};
export function barcodeOptions(value){
 if(value===undefined)return {field:'ean13',generatorEnabled:false};
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['field','generatorEnabled'].includes(key)));
 need(value.field===undefined||typeof value.field==='string'&&Object.hasOwn(fields,value.field));
 need(value.generatorEnabled===undefined||typeof value.generatorEnabled==='boolean');
 return {field:value.field??'ean13',generatorEnabled:value.generatorEnabled===true};
}
export const barcodeOptionsFromForm=fields=>barcodeOptions({field:fields.get('barcodeField'),generatorEnabled:fields.get('barcodeGeneratorEnabled')==='on'});
export function checkDigit(body){
 need(typeof body==='string'&&/^\d{11,12}$/.test(body));let sum=0;for(let i=body.length-1,weight=3;i>=0;i--,weight=4-weight)sum+=Number(body[i])*weight;return String((10-sum%10)%10);
}
export function barcodeKey(code){need(typeof code==='string');const value=code.trim().toUpperCase();return /^\d{1,14}$/.test(value)?value.padStart(14,'0'):value;}
export function internalBarcode(field,productId,attributeId=0,attempt=0){
 need(Object.hasOwn(fields,field)&&Number.isSafeInteger(productId)&&productId>0&&productId<=2147483647&&Number.isSafeInteger(attributeId)&&attributeId>=0&&attributeId<=2147483647&&Number.isInteger(attempt)&&attempt>=0&&attempt<=2147483647);
 if(field==='reference')return 'TTPV-'+(attributeId?'V':'P')+String(attributeId||productId).padStart(10,'0')+(attempt?'-'+attempt:'');
 const sequence=(attributeId?attributeId*2+1:productId*2)+attempt*2,body=(field==='ean13'?'04':'4')+String(sequence).padStart(10,'0');return body+checkDigit(body);
}
export function barcodePlan(value){
 need(value&&value.source==='native-missing-barcodes-plan'&&value.plan_version===1&&value.capability&&typeof value.capability.can_execute==='boolean'&&value.capability.reason===(value.capability.can_execute?'ready':'native_hooks_need_review')&&Object.hasOwn(fields,value.field)&&value.scheme===fields[value.field].scheme&&Number.isSafeInteger(value.shop_id)&&value.shop_id>0&&Array.isArray(value.items)&&value.items.length<=50&&typeof value.has_more==='boolean'&&Number.isSafeInteger(value.skipped_shared)&&value.skipped_shared>=0&&typeof value.plan_fingerprint==='string'&&/^[a-f0-9]{64}$/.test(value.plan_fingerprint));
 const identities=new Set(),codes=new Set();const items=value.items.map(item=>{
  need(item&&Number.isSafeInteger(item.product_id)&&item.product_id>0&&item.product_id<=2147483647&&Number.isSafeInteger(item.attribute_id)&&item.attribute_id>=0&&item.attribute_id<=2147483647&&typeof item.name==='string'&&Array.from(item.name).length<=255&&typeof item.variant_name==='string'&&Array.from(item.variant_name).length<=255&&typeof item.reference==='string'&&Array.from(item.reference).length<=64&&typeof item.code==='string'&&typeof item.snapshot_fingerprint==='string'&&/^[a-f0-9]{64}$/.test(item.snapshot_fingerprint));
  const identity=item.product_id+':'+item.attribute_id,key=barcodeKey(item.code);need(!identities.has(identity)&&!codes.has(key));identities.add(identity);codes.add(key);
  need(value.field==='reference'?/^TTPV-[PV]\d{10}(?:-[1-9]\d{0,9})?$/.test(item.code):value.field==='ean13'?/^04\d{11}$/.test(item.code)&&checkDigit(item.code.slice(0,-1))===item.code.at(-1):/^4\d{11}$/.test(item.code)&&checkDigit(item.code.slice(0,-1))===item.code.at(-1));
  return {product_id:item.product_id,attribute_id:item.attribute_id,name:item.name,variant_name:item.variant_name,reference:item.reference,code:item.code,snapshot_fingerprint:item.snapshot_fingerprint};
 });
 const skipped=value.skipped_targets===undefined?undefined:(need(Array.isArray(value.skipped_targets)&&value.skipped_targets.length+items.length<=50),value.skipped_targets.map(row=>{
  need(row&&Number.isSafeInteger(row.product_id)&&row.product_id>0&&row.product_id<=2147483647&&Number.isSafeInteger(row.attribute_id)&&row.attribute_id>=0&&row.attribute_id<=2147483647&&['already-set','unavailable'].includes(row.reason)&&
   (row.reason==='unavailable'?row.code===null:typeof row.code==='string'&&row.code.length>0&&Array.from(row.code).length<=64));
  const identity=row.product_id+':'+row.attribute_id;need(!identities.has(identity));identities.add(identity);return {product_id:row.product_id,attribute_id:row.attribute_id,reason:row.reason,code:row.code};
 }));
 return {...(skipped===undefined?{}:{skipped_targets:skipped}),source:value.source,plan_version:1,capability:{can_execute:value.capability.can_execute,reason:value.capability.reason},field:value.field,scheme:value.scheme,shop_id:value.shop_id,items,has_more:value.has_more,skipped_shared:value.skipped_shared,plan_fingerprint:value.plan_fingerprint};
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function barcodeOptionsHtml(value,canEdit){const options=barcodeOptions(value);return `<fieldset><legend>Códigos de barras</legend><label>Campo usado para los códigos<select name="barcodeField" ${canEdit?'':'disabled'}>${Object.entries(fields).map(([id,field])=>`<option value="${id}" ${options.field===id?'selected':''}>${esc(field.label)}</option>`).join('')}</select></label><label class="tpv-check"><input type="checkbox" name="barcodeGeneratorEnabled" ${options.generatorEnabled?'checked':''} ${canEdit?'':'disabled'}> Activar generación de códigos faltantes</label><p class="small muted">Los códigos nuevos son internos de esta empresa. Los códigos existentes se conservan. Antes de escribir revisarás los artículos y variantes que no tienen código.</p></fieldset>`;}

export function barcodeTargetPage(value,{field,shopId,cursor=[0,0],bounds}={}){
 const id=value=>Number.isSafeInteger(value)&&value>=0&&value<=2147483647;
 const pair=value=>Array.isArray(value)&&value.length===2&&value.every(id);
 const compare=(a,b)=>a[0]-b[0]||a[1]-b[1];
 need(value&&value.source==='native-missing-barcode-targets'&&value.plan_version===1&&Object.hasOwn(fields,value.field)&&Number.isSafeInteger(value.shop_id)&&value.shop_id>0&&typeof value.has_more==='boolean'&&Array.isArray(value.items)&&value.items.length<=50&&pair(value.cursor)&&pair(cursor)&&
  value.bounds&&typeof value.bounds==='object'&&!Array.isArray(value.bounds)&&Object.keys(value.bounds).length===2&&id(value.bounds.product)&&id(value.bounds.attribute)&&
  (field===undefined||field===value.field)&&(shopId===undefined||shopId===value.shop_id)&&(bounds===undefined||bounds.product===value.bounds.product&&bounds.attribute===value.bounds.attribute)&&
  value.cursor[0]<=value.bounds.product&&value.cursor[1]<=value.bounds.attribute&&compare(value.cursor,cursor)>=0&&(!value.has_more||compare(value.cursor,cursor)>0));
 let last=cursor;const items=value.items.map(row=>{
  need(row&&id(row.product_id)&&row.product_id>0&&id(row.attribute_id)&&typeof row.name==='string'&&Array.from(row.name).length<=255&&typeof row.variant_name==='string'&&Array.from(row.variant_name).length<=255&&typeof row.reference==='string'&&Array.from(row.reference).length<=64&&row.product_id<=value.bounds.product&&row.attribute_id<=value.bounds.attribute);
  const key=[row.product_id,row.attribute_id];need(compare(key,last)>0&&compare(key,value.cursor)<=0);last=key;
  return {product_id:row.product_id,attribute_id:row.attribute_id,name:row.name,variant_name:row.variant_name,reference:row.reference};
 });
 return {source:value.source,plan_version:1,field:value.field,shop_id:value.shop_id,items,has_more:value.has_more,cursor:[...value.cursor],bounds:{product:value.bounds.product,attribute:value.bounds.attribute}};
}
