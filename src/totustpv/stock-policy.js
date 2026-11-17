const need=(ok,message)=>{if(!ok)throw Error(message);};
export function stockPolicy(value){
 if(value===undefined)return {allowOutOfStock:false};
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>key==='allowOutOfStock')&&
  (value.allowOutOfStock===undefined||typeof value.allowOutOfStock==='boolean'),'Revisa la política de existencias.');
 return {allowOutOfStock:value.allowOutOfStock===true};
}
export function canExceedStock(product,policy){return policy?.allowOutOfStock===true&&product?.allowOutOfStock===true;}
export function stockPolicyFromForm(fields){return {allowOutOfStock:fields.get('allowOutOfStock')==='on'};}
export function stockPolicyHtml(value,canEdit){const policy=stockPolicy(value);return `<fieldset class="tpv-stock-policy"><legend>Ventas y existencias</legend><label class="tpv-check"><input type="checkbox" name="allowOutOfStock" ${policy.allowOutOfStock?'checked':''} ${canEdit?'':'disabled'}> Permitir vender con existencias insuficientes</label><p class="small muted">Se aplica solo a este mostrador, sin cambiar la venta online de los artículos. Las unidades vendidas y el stock resultante quedan registrados en el pedido.</p></fieldset>`;}
