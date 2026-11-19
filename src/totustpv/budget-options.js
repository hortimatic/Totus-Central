const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['enabled','prefix','lastNumber','hidePrices','revision'];
export function budgetOptions(value={enabled:false,prefix:'P-',lastNumber:0,hidePrices:false,revision:0}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k))||typeof value.enabled!=='boolean'||typeof value.hidePrices!=='boolean'||typeof value.prefix!=='string'||!/^[A-Za-z0-9/_-]{0,12}$/.test(value.prefix)||!Number.isSafeInteger(value.lastNumber)||value.lastNumber<0||value.lastNumber>999999999||!Number.isSafeInteger(value.revision)||value.revision<0)throw Error('Revisa la numeración y la presentación de los presupuestos.');
 return Object.fromEntries(keys.map(k=>[k,value[k]]));
}
export function budgetOptionsFromForm(fields,current){
 const previous=budgetOptions(current),number=fields.get('budget-lastNumber'),prefix=fields.get('budget-prefix');
 if(typeof number!=='string'||!/^(0|[1-9][0-9]{0,8})$/.test(number))throw Error('Escribe el último número como un entero entre 0 y 999999999.');
 const value=budgetOptions({...previous,enabled:fields.get('budget-enabled')==='on',prefix,lastNumber:Number(number),hidePrices:fields.get('budget-hidePrices')==='on'});
 if(value.lastNumber<previous.lastNumber)throw Error('La numeración de presupuestos no puede retroceder. Vuelve a consultar el último número.');
 return {enabled:value.enabled,prefix:value.prefix,lastNumber:value.lastNumber,hidePrices:value.hidePrices,expectedRevision:previous.revision};
}
export function budgetOptionsHtml(value,canEdit,draft=null){
 const s=budgetOptions(value),disabled=canEdit?'':'disabled',field=k=>draft?.['budget-'+k]??s[k],checked=k=>draft?draft['budget-'+k]==='on':s[k];
 return `<section class="card card-pad tpv-budget-settings"><h4>Presupuestos · este establecimiento</h4><form data-tpv-form="budget-settings"><label class="tpv-check"><input type="checkbox" name="budget-enabled" ${checked('enabled')?'checked':''} ${disabled}> Usar una numeración propia para presupuestos</label><label>Prefijo<input name="budget-prefix" value="${esc(field('prefix'))}" maxlength="12" ${disabled}></label><label>Último número asignado<input name="budget-lastNumber" inputmode="numeric" value="${esc(field('lastNumber'))}" ${disabled}></label><label class="tpv-check"><input type="checkbox" name="budget-hidePrices" ${checked('hidePrices')?'checked':''} ${disabled}> Preparar el documento sin mostrar precios</label><p class="small muted">La numeración se comparte entre las cajas del establecimiento. Los presupuestos anteriores conservan su referencia. Ocultar precios en el documento conserva sus importes para consultarlos y convertirlos en venta.</p><div class="inline-actions">${canEdit?'<button type="submit" class="btn primary">Guardar presupuestos</button>':''}<button type="button" class="btn secondary" data-tpv-action="refresh-budget-settings">Volver a consultar</button></div></form></section>`;
}

export function budgetSettingsError(error){const code=error?.code||error?.message;return Error({
 TPV_BUDGET_SETTINGS_FORBIDDEN:'No tienes permiso para configurar los presupuestos de este establecimiento.',
 TPV_BUDGET_SETTINGS_STALE:'La configuración de presupuestos ha cambiado. Vuelve a consultarla antes de guardar.',
 TPV_BUDGET_SETTINGS_INVALID:'Revisa el prefijo, la numeración y la presentación de los presupuestos.',
 TPV_BUDGET_COUNTER_DECREASE_FORBIDDEN:'El contador de presupuestos ha avanzado. Vuelve a consultar el último número antes de guardar.',
 TPV_BUDGET_COUNTER_EXHAUSTED:'La numeración de presupuestos ha alcanzado su límite. El responsable debe revisarla.'
 }[code]||'No se ha podido consultar o guardar la configuración de presupuestos. Tus cambios se conservan; vuelve a intentarlo.');}
