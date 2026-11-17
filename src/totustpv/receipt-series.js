const keys=['enabled','salePrefix','returnPrefix','lastSaleNumber','lastReturnNumber'];
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function receiptSeries(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))||typeof value.enabled!=='boolean'||
  !['salePrefix','returnPrefix'].every(key=>typeof value[key]==='string'&&/^[A-Za-z0-9/_-]{0,12}$/.test(value[key]))||
  !['lastSaleNumber','lastReturnNumber'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=999999999))throw Error('TPV_RECEIPT_SERIES_INVALID');
 return Object.fromEntries(keys.map(key=>[key,value[key]]));
}
export function receiptSeriesFromForm(fields){
 for(const key of ['series-salePrefix','series-returnPrefix'])if(typeof fields.get(key)!=='string'||!/^[A-Za-z0-9/_-]{0,12}$/.test(fields.get(key)))throw Error('Usa un prefijo de hasta 12 letras, números o símbolos / _ -.');
 const number=key=>{const value=fields.get(key);if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,8})$/.test(value))throw Error('Escribe un número entero entre 0 y 999999999.');return Number(value);};
 return receiptSeries({enabled:fields.get('series-enabled')==='on',salePrefix:fields.get('series-salePrefix'),returnPrefix:fields.get('series-returnPrefix'),lastSaleNumber:number('series-lastSaleNumber'),lastReturnNumber:number('series-lastReturnNumber')});
}
export function receiptSeriesError(error){const code=error?.code||error?.message;return new Error({
 TPV_RECEIPT_COUNTER_DECREASE_FORBIDDEN:'El contador no puede retroceder. Consulta el último número y guarda un número igual o superior.',
 TPV_RECEIPT_COUNTER_EXHAUSTED:'El contador ha alcanzado su límite. El responsable debe revisar la numeración antes de continuar.',
 TPV_RECEIPT_SERIES_FORBIDDEN:'No tienes permiso para cambiar la numeración de este establecimiento.',
 TPV_RECEIPT_SERIES_INVALID:'Revisa los prefijos y los números de la numeración.'
 }[code]||error?.message||'No se pudo guardar la numeración.');}
export function receiptSeriesHtml(value,canEdit,draft=null){const s=receiptSeries(value),disabled=canEdit?'':'disabled',fields=canEdit&&draft?draft:null,valueFor=key=>fields?.['series-'+key]??s[key],enabled=fields?fields['series-enabled']==='on':s.enabled;
 return `<section class="card card-pad tpv-receipt-series"><h4>Numeración de tickets · este establecimiento</h4><p>Compartida por sus cajas y operadores. Las facturas y abonos conservan la numeración de la tienda.</p><form data-tpv-form="receipt-series"><label class="tpv-check"><input name="series-enabled" type="checkbox" ${enabled?'checked':''} ${disabled}> Numeración independiente y automática</label><label>Prefijo de venta<input name="series-salePrefix" value="${esc(valueFor('salePrefix'))}" maxlength="12" ${disabled}></label><label>Prefijo de devolución<input name="series-returnPrefix" value="${esc(valueFor('returnPrefix'))}" maxlength="12" ${disabled}></label><label>Último número de venta<input name="series-lastSaleNumber" inputmode="numeric" value="${esc(valueFor('lastSaleNumber'))}" ${disabled}></label><label>Último número de devolución<input name="series-lastReturnNumber" inputmode="numeric" value="${esc(valueFor('lastReturnNumber'))}" ${disabled}></label><p class="small muted">El siguiente ticket usa el número siguiente. Puedes adelantar los contadores; no pueden retroceder. Los tickets anteriores conservan su número y prefijo.</p>${canEdit?'<button class="btn primary" type="submit">Guardar numeración</button>':''}</form></section>`;
}
export function receiptNumber(value){
 if(value===null||value===undefined)return null;
 if(!value||!['sale','return'].includes(value.kind)||!Number.isSafeInteger(value.number)||value.number<1||value.number>999999999||typeof value.prefix!=='string'||!/^[A-Za-z0-9/_-]{0,12}$/.test(value.prefix)||value.label!==value.prefix+value.number)throw Error('TPV_RECEIPT_NUMBER_INVALID');
 return {kind:value.kind,number:value.number,prefix:value.prefix,label:value.label};
}
