/** Counter presentation and allowed methods. These options do not charge a
 * bank, change native payment proofs or turn a new method into a supported one.
 */
import {paymentReferencePolicy} from './payment-reference.js';
export const TPV_PAYMENT_NAMES=Object.freeze({cash:'Efectivo',card:'Tarjeta',bizum:'Bizum',transfer:'Transferencia'});
const need=ok=>{if(!ok)throw Error('Revisa los medios de cobro de esta caja. Activa al menos uno y utiliza nombres distintos.');};
export function paymentOptions(value,available=Object.keys(TPV_PAYMENT_NAMES)){
 need(Array.isArray(available)&&available.length>0&&available.length<=4&&new Set(available).size===available.length&&available.every(id=>Object.hasOwn(TPV_PAYMENT_NAMES,id)));
 if(value===undefined)value={};
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['enabledMethods','labels','referencePolicy'].includes(key)));
 const enabled=Object.hasOwn(value,'enabledMethods')?value.enabledMethods:available,labels=Object.hasOwn(value,'labels')?value.labels:{};
 need(Array.isArray(enabled)&&enabled.length>0&&enabled.length<=available.length&&new Set(enabled).size===enabled.length&&enabled.every(id=>available.includes(id)));
 need(labels&&typeof labels==='object'&&!Array.isArray(labels)&&Object.keys(labels).every(id=>available.includes(id)));
 const normalized=Object.fromEntries(available.map(id=>{
  const label=Object.hasOwn(labels,id)?labels[id]:TPV_PAYMENT_NAMES[id];need(typeof label==='string');const clean=label.trim().normalize('NFC');
  need(Array.from(clean).length>=1&&Array.from(clean).length<=40&&!/[\x00-\x1f\x7f<>]/.test(clean));return [id,clean];
 }));
 need(new Set(enabled.map(id=>normalized[id].toLocaleLowerCase('es'))).size===enabled.length);
 return {enabledMethods:[...enabled],labels:normalized,referencePolicy:paymentReferencePolicy(value.referencePolicy,available)};
}
export function paymentChoices(value,nativeLabels){
 need(nativeLabels&&typeof nativeLabels==='object'&&!Array.isArray(nativeLabels));
 const available=Object.keys(TPV_PAYMENT_NAMES).filter(id=>Object.hasOwn(nativeLabels,id));
 need(available.every(id=>typeof nativeLabels[id]==='string'&&Array.from(nativeLabels[id]).length>=1&&Array.from(nativeLabels[id]).length<=70));
 const options=paymentOptions(value,available);return options.enabledMethods.map(id=>({id,label:options.labels[id],nativeLabel:nativeLabels[id]}));
}

/** A prepared quote may only offer methods confirmed by its server policy.
 * Older quotes without a policy retain their native-label compatibility path.
 */
export function quotePaymentMethods(expected){
 const native=expected?.nativePaymentLabels??{cash:'',card:''};
 const available=Object.keys(TPV_PAYMENT_NAMES).filter(id=>Object.hasOwn(native,id));
 const policy=expected?.operatorPaymentPolicy;
 if(policy===undefined)return available;
 need(policy&&policy.enabled===true&&policy.modes&&typeof policy.modes==='object'&&!Array.isArray(policy.modes));
 const modes={cash:'cash-in-hand',card:'external-terminal',bizum:'external-receipt',transfer:'external-receipt'};
 const methods=policy.methodOrder??Object.keys(policy.modes);
 need(Array.isArray(methods)&&methods.length>0&&methods.length===Object.keys(policy.modes).length&&new Set(methods).size===methods.length&&methods.every(id=>available.includes(id)&&policy.modes[id]===modes[id]));
 return methods;
}

export function paymentFormMethods(methods=['cash','card']){
 need(Array.isArray(methods)&&methods.length>0&&new Set(methods).size===methods.length&&methods.every(id=>Object.hasOwn(TPV_PAYMENT_NAMES,id)));
 return [...methods,...(methods.includes('cash')&&methods.some(id=>id!=='cash')?['mixed']:[])];
}

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function referenceSettingsHtml(id,options,draft){
 if(id==='cash')return '';
 const selected=draft?.['reference:'+id]??options.referencePolicy[id];
 return `<label>Referencia del cobro<select name="reference:${id}">${[['hidden','No pedir'],['optional','Opcional'],['required','Obligatoria']].map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('')}</select></label>`;
}
export function paymentSettingsHtml(saved,editable,draft){
 if(!saved)return '';
 const options=paymentOptions(saved.options,Object.keys(saved.options.labels));
 const ids=[...options.enabledMethods,...Object.keys(options.labels).filter(id=>!options.enabledMethods.includes(id))];
 return `<section class="card card-pad tpv-settings"><h3>Cómo se cobra en esta caja</h3><p>Esta configuración se comparte con todos sus operadores. Marca los medios que utilizáis y el orden en que deben aparecer.</p><form data-tpv-form="payment-settings" class="tpv-payment-settings"><fieldset ${editable?'':'disabled'}>${ids.map((id,index)=>`<fieldset><legend>${esc(TPV_PAYMENT_NAMES[id])}</legend><label class="tpv-check"><input type="checkbox" name="enabled:${id}" ${(draft?draft['enabled:'+id]==='on':options.enabledMethods.includes(id))?'checked':''}> Disponible para cobrar</label><label>Nombre en el mostrador<input name="label:${id}" maxlength="40" required value="${esc(draft?.['label:'+id]??options.labels[id])}"></label><label>Posición<select name="position:${id}">${ids.map((_,n)=>`<option value="${n}" ${String(n)===String(draft?.['position:'+id]??index)?'selected':''}>${n+1}</option>`).join('')}</select></label>${referenceSettingsHtml(id,options,draft)}</fieldset>`).join('')}<button class="btn primary" type="submit">Guardar medios de cobro</button></fieldset><p class="small muted">El pago mixto aparece cuando hay efectivo y otro medio habilitados. Los nombres del pedido y de sus justificantes conservan su identificación original.</p>${editable?'':'<p>Solo una persona con permiso para editar la configuración puede cambiar estos medios.</p>'}</form></section>`;
}
export function paymentSettingsFromForm(fields,available){
 const enabled=available.filter(id=>fields.get('enabled:'+id)==='on');
 const positions=enabled.map(id=>Number(fields.get('position:'+id)));
 if(!positions.every(n=>Number.isInteger(n)&&n>=0&&n<available.length)||new Set(positions).size!==positions.length)throw Error('Elige una posición distinta para cada medio de cobro habilitado.');
 enabled.sort((a,b)=>Number(fields.get('position:'+a))-Number(fields.get('position:'+b)));
 return paymentOptions({enabledMethods:enabled,labels:Object.fromEntries(available.map(id=>[id,fields.get('label:'+id)])),referencePolicy:Object.fromEntries(available.filter(id=>id!=='cash').map(id=>[id,fields.get('reference:'+id)??'hidden']))},available);
}
