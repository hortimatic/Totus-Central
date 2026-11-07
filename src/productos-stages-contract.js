const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=/^[1-9]\d{0,14}$/;
const unsigned=/^\d{1,15}$/;
const decimal=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,6})?$/;
const signed=/^-?(?:0|[1-9]\d{0,10})(?:\.\d{1,6})?$/;
export const PRODUCT_STAGE_RESOURCES=Object.freeze({variation:'combinations',stock:'stock_availables',supplier_price:'product_suppliers',special_price:'specific_prices',image:'images',finish:'products'});
const fields=Object.freeze({
 variation:['reference','ean13','upc','isbn','mpn','supplier_reference','price','wholesale_price','weight','ecotax','unit_price_impact','minimal_quantity','low_stock_threshold','low_stock_alert','default_on','available_date'],
 stock:['id_product_attribute','quantity','out_of_stock','depends_on_stock','location'],
 supplier_price:['id_product_attribute','id_supplier','id_currency','product_supplier_reference','product_supplier_price_te'],
 special_price:['id_product_attribute','id_shop','id_shop_group','id_currency','id_country','id_group','id_customer','id_cart','price','from_quantity','reduction','reduction_tax','reduction_type','from','to'],
 finish:['active','available_for_order','visibility','id_default_image','id_default_combination','description','description_short']
});
const required=Object.freeze({variation:['reference','minimal_quantity','default_on'],stock:['id_product_attribute','quantity','out_of_stock','depends_on_stock'],supplier_price:['id_product_attribute','id_supplier','id_currency','product_supplier_reference','product_supplier_price_te'],special_price:['id_product_attribute','id_shop','id_shop_group','id_currency','id_country','id_group','id_customer','id_cart','price','from_quantity','reduction','reduction_tax','reduction_type','from','to'],finish:['active','available_for_order']});
function fail(message){throw Error(message);}
export function validateProductStage(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['action','id','call_id','revision','store','parent_request_id','product_id','kind','step_key','fields','associations','image','record_id','expected_fingerprint','confirmed'].includes(k)))fail('Solicitud de etapa no válida.');
 if(!['prestashop_product_step_prepare','prestashop_product_step_commit'].includes(input.action)||!uuid.test(input.id)||!uuid.test(input.call_id)||!uuid.test(input.parent_request_id)||!['hortimatic','newoldsmok'].includes(input.store)||!id.test(String(input.product_id))||!Number.isSafeInteger(input.revision)||input.revision<1||!Object.hasOwn(PRODUCT_STAGE_RESOURCES,input.kind)||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(input.step_key||''))fail('Identidad de etapa no válida.');
 const out={store:input.store,kind:input.kind,resource:PRODUCT_STAGE_RESOURCES[input.kind],product_id:String(input.product_id),parent_request_id:input.parent_request_id,stage:input.kind+'_'+input.step_key,fields:{},associations:{},commit:input.action.endsWith('_commit')};
 if(input.record_id!==undefined){if(!id.test(String(input.record_id))||!['stock','finish'].includes(input.kind))fail('Registro de etapa no admitido.');out.record_id=String(input.record_id);}
 if(out.commit&&(!/^[a-f0-9]{64}$/.test(input.expected_fingerprint||'')||input.confirmed!==true))fail('La etapa exige validación previa y confirmación.');
 if(!out.commit&&(input.expected_fingerprint!==undefined||input.confirmed!==undefined))fail('La preparación no escribe ni acepta confirmaciones.');
 if(out.commit)out.expected_fingerprint=input.expected_fingerprint;
 if(input.kind==='image'){
  const image=input.image;
  if(!image||typeof image!=='object'||Object.keys(image).some(k=>!['name','mime','base64'].includes(k))||image.mime!=='image/png'||typeof image.name!=='string'||!image.name.toLowerCase().endsWith('.png')||image.name.length>120||/[\x00-\x1f/\\]/.test(image.name)||typeof image.base64!=='string'||image.base64.length>5592408||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.base64))fail('Carga una imagen PNG transparente válida, de hasta 4 MB.');
  if(input.fields!==undefined||input.associations!==undefined)fail('La imagen no acepta campos adicionales.');
  out.image={...image};return out;
 }
 if(!input.fields||typeof input.fields!=='object'||Array.isArray(input.fields)||Object.keys(input.fields).some(k=>!fields[input.kind].includes(k))||required[input.kind].some(k=>!Object.hasOwn(input.fields,k)))fail('Completa los campos obligatorios de esta etapa.');
 for(const [field,value] of Object.entries(input.fields)){
  if(['description','description_short'].includes(field)){
   if(!Array.isArray(value)||!value.length||value.some(t=>!t||Object.keys(t).some(k=>!['language_id','value'].includes(k))||!id.test(String(t.language_id))||typeof t.value!=='string'||t.value.length>250000)||new Set(value.map(t=>String(t.language_id))).size!==value.length)fail('Traducciones de etapa no válidas.');
   out.fields[field]=value.map(t=>({language_id:String(t.language_id),value:t.value}));continue;
  }
  if(typeof value!=='string'||value.length>255||/[\x00-\x1f]/.test(value))fail('Valor incorrecto para '+field+'.');
  if(field.startsWith('id_')&&!unsigned.test(value))fail('Identificador incorrecto para '+field+'.');
  if(['id_supplier','id_currency','id_default_image','id_default_combination'].includes(field)&&input.kind!=='special_price'&&!id.test(value))fail('Selecciona un registro real para '+field+'.');
  if(['active','available_for_order','low_stock_alert','default_on','reduction_tax','depends_on_stock'].includes(field)&&!['0','1'].includes(value))fail('Indicador incorrecto para '+field+'.');
  if(field==='depends_on_stock'&&value!=='0')fail('El alta utiliza existencias normales; no activa gestión avanzada.');
  if(field==='out_of_stock'&&!['0','1','2'].includes(value))fail('Preferencia de disponibilidad incorrecta.');
  if(field==='quantity'&&!/^\d{1,10}$/.test(value))fail('Cantidad no válida.');
  if(['minimal_quantity','from_quantity'].includes(field)&&!id.test(value))fail('La cantidad mínima debe ser mayor que cero.');
  if(['price','weight','unit_price_impact'].includes(field)&&!(input.kind==='special_price'&&field==='price'&&value==='-1')&&!(input.kind==='variation'?signed:decimal).test(value))fail('Importe o impacto incorrecto para '+field+'.');
  if(['wholesale_price','product_supplier_price_te','reduction','ecotax'].includes(field)&&!decimal.test(value))fail('Importe incorrecto para '+field+'.');
  if(field==='reference'&&!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(value))fail('Referencia de variación no válida.');
  if(field==='ean13'&&value!==''&&!/^\d{13}$/.test(value))fail('EAN incorrecto.');
  if(field==='upc'&&value!==''&&!/^\d{12}$/.test(value))fail('UPC incorrecto.');
  if(field==='visibility'&&!['both','catalog','search','none'].includes(value))fail('Visibilidad incorrecta.');
  if(field==='reduction_type'&&!['amount','percentage'].includes(value))fail('Tipo de descuento incorrecto.');
  if(['from','to'].includes(field)&&value!=='0000-00-00 00:00:00'&&(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)||Number.isNaN(Date.parse(value.replace(' ','T')+'Z'))))fail('Periodo de precio especial incorrecto.');
  if(field==='available_date'&&value!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))))fail('Fecha de disponibilidad incorrecta.');
  out.fields[field]=value;
 }
 if(input.kind==='special_price'&&input.fields.reduction_type==='percentage'&&Number(input.fields.reduction)>1)fail('El descuento porcentual se expresa entre 0 y 1.');
 const associations=input.associations??{};
 if(typeof associations!=='object'||Array.isArray(associations)||Object.keys(associations).some(k=>input.kind!=='variation'||!['product_option_values','images'].includes(k)))fail('Relaciones de etapa no admitidas.');
 for(const [key,values] of Object.entries(associations)){
  if(!Array.isArray(values)||values.some(v=>!id.test(String(v)))||new Set(values.map(String)).size!==values.length)fail('Selecciona atributos e imágenes válidos.');
  out.associations[key]=values.map(String);
 }
 if(input.kind==='variation'&&!out.associations.product_option_values?.length)fail('La variación necesita valores de atributos del destino.');
 return out;
}
