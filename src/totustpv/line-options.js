export function lineOptions(value){
 if(value===undefined)return {allowPriceChanges:false};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>key!=='allowPriceChanges')||
  value.allowPriceChanges!==undefined&&typeof value.allowPriceChanges!=='boolean')throw Error('Revisa las opciones de precio del ticket.');
 return {allowPriceChanges:value.allowPriceChanges===true};
}
export const lineOptionsFromForm=fields=>({allowPriceChanges:fields.get('allowPriceChanges')==='on'});
export function lineOptionsHtml(value,canEdit){const options=lineOptions(value);return `<fieldset><legend>Precio del ticket</legend><label class="tpv-check"><input type="checkbox" name="allowPriceChanges" ${options.allowPriceChanges?'checked':''} ${canEdit?'':'disabled'}> Permitir fijar el precio de un artículo en este ticket</label><p class="small muted">Requiere permiso para editar ventas. El precio del catálogo y de la web se conserva; el cobro confirma el importe calculado en la tienda.</p></fieldset>`;}
export function lineAdjustment(value){
 if(value===undefined)return undefined;
 const valid=value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&Object.keys(value).every(key=>['kind','value'].includes(key))&&
  ['percent','amount','price'].includes(value.kind)&&Number.isSafeInteger(value.value)&&value.value>0&&value.value<=100000000000&&
  (value.kind!=='percent'||value.value<10000)&&(value.kind!=='price'||value.value<=999999999);
 if(!valid)throw Error('TPV_LINE_ADJUSTMENT_INVALID');return {kind:value.kind,value:value.value};
}
