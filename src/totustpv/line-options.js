export function lineOptions(value){
 if(value===undefined)return {allowPriceChanges:false,requireSaleNote:false,allowNameChanges:false};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['allowPriceChanges','requireSaleNote','allowNameChanges'].includes(key))||
  Object.values(value).some(item=>typeof item!=='boolean'))throw Error('Revisa las opciones del ticket.');
 return {allowPriceChanges:value.allowPriceChanges===true,requireSaleNote:value.requireSaleNote===true,allowNameChanges:value.allowNameChanges===true};
}
export const lineOptionsFromForm=fields=>({allowPriceChanges:fields.get('allowPriceChanges')==='on',requireSaleNote:fields.get('requireSaleNote')==='on',allowNameChanges:fields.get('allowNameChanges')==='on'});
export function lineOptionsHtml(value,canEdit){const options=lineOptions(value);return `<fieldset><legend>Opciones del ticket</legend><label class="tpv-check"><input type="checkbox" name="allowPriceChanges" ${options.allowPriceChanges?'checked':''} ${canEdit?'':'disabled'}> Permitir fijar el precio de un artículo en este ticket</label><p class="small muted">Requiere permiso para editar ventas. El precio del catálogo y de la web se conserva; el cobro confirma el importe calculado en la tienda.</p><label class="tpv-check"><input type="checkbox" name="allowNameChanges" ${options.allowNameChanges?'checked':''} ${canEdit?'':'disabled'}> Permitir cambiar el nombre de un artículo en esta venta</label><p class="small muted">Requiere permiso para editar ventas. El nombre del catálogo se conserva.</p><label class="tpv-check"><input type="checkbox" name="requireSaleNote" ${options.requireSaleNote?'checked':''} ${canEdit?'':'disabled'}> Pedir una nota interna antes de cobrar</label><p class="small muted">La nota se guarda de forma privada en el pedido. No aparece en el ticket ni en la pantalla del cliente.</p></fieldset>`;}
export function lineAdjustment(value){
 if(value===undefined)return undefined;
 const valid=value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&Object.keys(value).every(key=>['kind','value'].includes(key))&&
  ['percent','amount','price'].includes(value.kind)&&Number.isSafeInteger(value.value)&&value.value>0&&value.value<=100000000000&&
  (value.kind!=='percent'||value.value<10000)&&(value.kind!=='price'||value.value<=999999999);
 if(!valid)throw Error('TPV_LINE_ADJUSTMENT_INVALID');return {kind:value.kind,value:value.value};
}
