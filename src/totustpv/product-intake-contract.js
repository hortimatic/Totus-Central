function requireValue(ok,message){if(!ok)throw Error(message);}
function object(value,keys){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key)),'Revisa los campos de la ficha del producto.');}
function text(value,max,label,{empty=true,multiline=false}={}){
 requireValue(typeof value==='string'&&value.length<=max&&!(multiline?/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value),'Revisa '+label+'.');
 const result=value.trim();requireValue(empty||result.length>0,'Completa '+label+'.');return result;
}
function nativeId(value,label,optional=false){requireValue(typeof value==='string'&&(optional&&value==='0'||/^[1-9][0-9]{0,14}$/.test(value)),'Selecciona '+label+' de esta tienda.');return value;}
export function productIntakePrice(value){
 requireValue(typeof value==='string'&&value.length<=32,'Escribe un precio válido.');const match=value.trim().replace(',','.').match(/^([0-9]+)(?:\.([0-9]{1,6}))?$/);
 requireValue(match,'Escribe el importe con un máximo de seis decimales.');
 const micros=BigInt(match[1])*1000000n+BigInt((match[2]||'').padEnd(6,'0'));
 requireValue(micros<=999999999999999n,'El precio supera el intervalo admitido.');return micros;
}
export function productIntakeDecimal(micros){const negative=micros<0n,value=negative?-micros:micros;return (negative?'-':'')+String(value/1000000n)+'.'+String(value%1000000n).padStart(6,'0');}
// Editing aid for a verified simple tax rate, never the native checkout total.
// Round only once, to PrestaShop's six decimal places, with integer arithmetic.
export function productIntakeTaxPrice(value,rate,{toNet=false}={}){
 const amount=productIntakePrice(value),tax=productIntakePrice(rate),base=100000000n;
 requireValue(tax<=100000000n,'El impuesto debe estar entre 0 y 100 %.');
 const numerator=toNet?amount*base:amount*(base+tax),denominator=toNet?base+tax:base;
 const result=productIntakeDecimal((numerator+denominator/2n)/denominator);productIntakePrice(result);return result;
}
const price=value=>productIntakeDecimal(productIntakePrice(value));
function reference(value,label){const result=text(value,64,label,{empty:false});requireValue(/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(result),'Usa una referencia de 3 a 64 letras, números, puntos, guiones o guiones bajos.');return result;}
function quantity(value){requireValue(Number.isSafeInteger(value)&&value>=0&&value<=1000000000,'Indica unidades enteras entre 0 y 1.000.000.000.');return value;}
function barcode(value){const result=text(value,13,'el código EAN');requireValue(result===''||/^[0-9]{8}$|^[0-9]{13}$/.test(result),'Escribe un EAN de 8 o 13 dígitos, o déjalo vacío.');return result;}
export function productIntakeDraft(value){
 object(value,['name','reference','price','cost','ean13','supplierReference','categoryId','manufacturerId','supplierId','taxRulesGroupId','visibility','quantity','description','variants','images']);
 const name=text(value.name,128,'el nombre',{empty:false});requireValue(!/[<>={}]/.test(name),'El nombre no admite < > = { }.');
 const ref=reference(value.reference,'la referencia');
 const result={name,reference:ref,price:price(value.price),cost:price(value.cost??'0'),ean13:barcode(value.ean13??''),supplierReference:text(value.supplierReference??'',64,'la referencia del proveedor'),
  categoryId:nativeId(value.categoryId,'una categoría'),manufacturerId:nativeId(value.manufacturerId??'0','una marca',true),supplierId:nativeId(value.supplierId??'0','un proveedor',true),
  taxRulesGroupId:nativeId(value.taxRulesGroupId??'0','un grupo de impuestos',true),visibility:value.visibility??'none',quantity:quantity(value.quantity??0),description:text(value.description??'',8000,'la descripción',{multiline:true}),variants:[],images:[]};
 requireValue(['none','both'].includes(result.visibility),'Elige si el producto se muestra también en la tienda online.');
 requireValue(!result.supplierReference||result.supplierId!=='0','Selecciona el proveedor de esta referencia.');
 const images=value.images??[];requireValue(Array.isArray(images)&&images.length<=6,'Puedes preparar hasta seis imágenes por alta.');let imageBytes=0;
 for(const image of images){object(image,['name','mime','base64']);
  const filename=text(image.name,120,'el nombre de imagen',{empty:false});
  requireValue(!/[/\\]/.test(filename)&&/\.png$/i.test(filename)&&image.mime==='image/png'&&typeof image.base64==='string'&&image.base64.length<=5592408&&
   image.base64.startsWith('iVBORw0KGgo')&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.base64),'Prepara una imagen PNG válida antes de continuar.');
  imageBytes+=image.base64.length/4*3-(image.base64.endsWith('==')?2:image.base64.endsWith('=')?1:0);
  requireValue(imageBytes<=4194304,'Las imágenes preparadas no pueden superar 4 MB en total.');result.images.push({name:filename,mime:'image/png',base64:image.base64});
 }
 const variants=value.variants??[];requireValue(Array.isArray(variants)&&variants.length<=100,'Prepara como máximo cien combinaciones por alta.');
 requireValue(!variants.length||result.quantity===0,'Con combinaciones, indica las unidades en cada combinación.');
 const references=new Set([ref.toLowerCase()]),combinations=new Set();
 for(const [index,variant] of variants.entries()){
  object(variant,['reference','attributeValueIds','price','cost','quantity','ean13','supplierReference','imageIndexes']);
  const selected=variant.attributeValueIds;requireValue(Array.isArray(selected)&&selected.length>=1&&selected.length<=10,'Selecciona los atributos de cada combinación.');
  const ids=selected.map(id=>nativeId(id,'un atributo'));requireValue(new Set(ids).size===ids.length,'Una combinación tiene atributos repetidos.');ids.sort();
  const key=ids.join(':');requireValue(!combinations.has(key),'Hay combinaciones con los mismos atributos.');combinations.add(key);
  const variantReference=reference(variant.reference||ref.slice(0,60)+'-'+(index+1),'la referencia de combinación');
  requireValue(!references.has(variantReference.toLowerCase()),'Cada producto y combinación necesita una referencia distinta.');references.add(variantReference.toLowerCase());
  const chosen=variant.imageIndexes??[];requireValue(Array.isArray(chosen)&&chosen.length<=images.length&&chosen.every(i=>Number.isSafeInteger(i)&&i>=0&&i<images.length)&&new Set(chosen).size===chosen.length,'Selecciona imágenes de esta ficha para la combinación.');
  const supplierReference=text(variant.supplierReference??'',64,'la referencia de proveedor de la combinación');requireValue(!supplierReference||result.supplierId!=='0','Selecciona el proveedor de las combinaciones.');
  result.variants.push({reference:variantReference,attributeValueIds:ids,price:price(variant.price==null||variant.price===''?result.price:variant.price),cost:price(variant.cost==null||variant.cost===''?result.cost:variant.cost),
   quantity:quantity(variant.quantity??0),ean13:barcode(variant.ean13??''),supplierReference,imageIndexes:[...chosen].sort((a,b)=>a-b)});
 }
 return result;
}
const html=value=>'<p>'+value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\r?\n/g,'<br>')+'</p>';
export function productIntakeBase(draft,languageIds){
 requireValue(Array.isArray(languageIds)&&languageIds.length>=1&&languageIds.length<=12&&new Set(languageIds).size===languageIds.length,'No se han podido comprobar los idiomas de esta tienda.');
 const slug=draft.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,128)||'producto';
 const relations={category_ids:[draft.categoryId]};
 for(const [field,key] of [['manufacturer_id','manufacturerId'],['supplier_id','supplierId'],['tax_rules_group_id','taxRulesGroupId']])if(draft[key]!=='0')relations[field]=draft[key];
 return {reference:draft.reference,price:draft.price,category_id:draft.categoryId,
  translations:languageIds.map(id=>({language_id:nativeId(id,'un idioma'),name:draft.name,link_rewrite:slug,...(draft.description?{description:html(draft.description)}:{})})),relations,
  fields:[{field:'wholesale_price',value:draft.cost},{field:'visibility',value:'none'},{field:'available_for_order',value:'0'},{field:'show_price',value:'1'},...(draft.ean13?[{field:'ean13',value:draft.ean13}]:[])]};
}
export function productIntakePlan(draft){
 const plan=[{key:'base',kind:'base',label:'Ficha del producto'}];
 draft.images.forEach((_,index)=>plan.push({key:'photo-'+index,kind:'image',index,label:'Imagen '+(index+1)}));
 draft.variants.forEach((_,index)=>plan.push({key:'variant-'+index,kind:'variation',index,label:'Combinación '+(index+1)}));
 if(draft.variants.length)draft.variants.forEach((_,index)=>plan.push({key:'stock-'+index,kind:'stock',index,label:'Unidades de combinación '+(index+1)}));
 else plan.push({key:'stock-main',kind:'stock',index:null,label:'Unidades del producto'});
 if(draft.supplierId!=='0'){
  plan.push({key:'supplier-main',kind:'supplier_price',index:null,label:'Datos del proveedor'});
  draft.variants.forEach((_,index)=>plan.push({key:'supplier-'+index,kind:'supplier_price',index,label:'Proveedor de combinación '+(index+1)}));
 }
 plan.push({key:'finish',kind:'finish',label:'Disponibilidad del producto'});return plan;
}
export function productIntakeStage(draft,step,verified,currencyId){
 const record=key=>{const value=verified.find(row=>row.key===key&&row.status==='verified')?.recordId;return nativeId(value,'el resultado verificado de '+key);};
 if(step.kind==='image')return {kind:'image',step_key:step.key,image:draft.images[step.index]};
 if(step.kind==='variation'){const variant=draft.variants[step.index];return {kind:'variation',step_key:step.key,
  fields:{reference:variant.reference,ean13:variant.ean13,price:productIntakeDecimal(productIntakePrice(variant.price)-productIntakePrice(draft.price)),wholesale_price:variant.cost,minimal_quantity:'1',default_on:step.index===0?'1':'0'},
  associations:{product_option_values:variant.attributeValueIds,images:variant.imageIndexes.map(index=>record('photo-'+index))}};}
 if(step.kind==='stock'){const item=step.index===null?draft:draft.variants[step.index];return {kind:'stock',step_key:step.key,fields:{id_product_attribute:step.index===null?'0':record('variant-'+step.index),quantity:String(item.quantity),out_of_stock:'0',depends_on_stock:'0'}};}
 if(step.kind==='supplier_price'){const item=step.index===null?draft:draft.variants[step.index];return {kind:'supplier_price',step_key:step.key,
  fields:{id_product_attribute:step.index===null?'0':record('variant-'+step.index),id_supplier:draft.supplierId,id_currency:nativeId(currencyId,'la moneda de la tienda'),product_supplier_reference:item.supplierReference,product_supplier_price_te:item.cost}};}
 if(step.kind==='finish')return {kind:'finish',step_key:step.key,fields:{active:'1',available_for_order:'1',visibility:draft.visibility,
  ...(draft.images.length?{id_default_image:record('photo-0')}:{ }),...(draft.variants.length?{id_default_combination:record('variant-0')}:{})}};
 throw Error('Etapa de producto no admitida.');
}
