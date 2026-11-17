export const PARKING_DURATIONS=Object.freeze({0:'Siempre',1:'1 día',7:'7 días',15:'15 días',30:'30 días',90:'90 días',365:'1 año'});
const need=(ok,message)=>{if(!ok)throw Error(message);};
export function parkingOptions(value){
 if(value===undefined)return {enabled:true,ttlDays:0};
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['enabled','ttlDays'].includes(key)), 'Revisa la configuración de tickets aparcados.');
 need(value.enabled===undefined||typeof value.enabled==='boolean','Revisa si se permite aparcar tickets.');
 need(value.ttlDays===undefined||Number.isSafeInteger(value.ttlDays)&&Object.hasOwn(PARKING_DURATIONS,value.ttlDays),'Elige una caducidad disponible para los tickets.');
 return {enabled:value.enabled??true,ttlDays:value.ttlDays??0};
}
export function parkingOptionsFromForm(fields){
 const raw=fields.get('parkingTtlDays');need(typeof raw==='string'&&/^(0|1|7|15|30|90|365)$/.test(raw),'Elige una caducidad disponible para los tickets.');
 return parkingOptions({enabled:fields.get('parkingEnabled')==='on',ttlDays:Number(raw)});
}
export function parkingOptionsHtml(value,canEdit){const options=parkingOptions(value);return `<fieldset class="tpv-parking-options" ${canEdit?'':'disabled'}><legend>Tickets aparcados</legend><label class="tpv-check"><input type="checkbox" name="parkingEnabled" ${options.enabled?'checked':''}> Permitir aparcar tickets</label><label>Validez desde el último aparcado<select name="parkingTtlDays">${Object.entries(PARKING_DURATIONS).map(([days,label])=>`<option value="${days}" ${Number(days)===options.ttlDays?'selected':''}>${label}</option>`).join('')}</select></label><p class="small muted">Desactivar el aparcado conserva los tickets anteriores. La validez se fija al guardar cada ticket; cambiarla no altera los ya guardados. Al recuperar y volver a aparcar un ticket, su plazo empieza de nuevo. Un ticket caducado se conserva para consulta y archivo, pero no se recupera para cobrar.</p></fieldset>`;}
/** The server decides expiry. An old response without these fields remains compatible. */
export function parkingExpiry(value){
 need(value&&typeof value==='object'&&!Array.isArray(value),'No se ha podido comprobar la validez del ticket.');
 const expiresAt=value.expiresAt??null,expired=value.expired===undefined?false:value.expired;
 need(expiresAt===null||typeof expiresAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(expiresAt)&&Number.isFinite(Date.parse(expiresAt)),'No se ha podido comprobar la fecha de caducidad del ticket.');
 need(typeof expired==='boolean'&&(!expired||expiresAt!==null),'No se ha podido comprobar la validez del ticket.');
 return {expiresAt,expired};
}
