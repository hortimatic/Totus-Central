import {enhanceSearchableSelects} from '../productos-controls.js';
export const EURO_CASH_FACES=Object.freeze([50000,20000,10000,5000,2000,1000,500,200,100,50,20,10,5,2,1]);
const money=cents=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(cents/100);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowed=new Set(EURO_CASH_FACES);
function faces(value){
 if(!Array.isArray(value)||!value.length||value.length>15||value.some(n=>!Number.isSafeInteger(n)||!allowed.has(n))||new Set(value).size!==value.length)
  throw Error('Selecciona al menos un billete o moneda válido, sin repetir valores.');
 return [...value].sort((a,b)=>b-a);
}
export function cashOptions(value){try{return {denominations:faces(value?.denominations)};}catch{return {denominations:[...EURO_CASH_FACES]};}}
export function cashOptionsFromForm(fields){const stored=fields.get('cashDenominations'),selected=typeof fields.getAll==='function'?fields.getAll('cashDenominations'):Array.isArray(stored)?stored:stored==null?[]:[stored];
 return {denominations:faces(selected.map(value=>Number(value)))};}
export function cashCountTotal(counts){
 if(!counts||typeof counts!=='object'||Array.isArray(counts))throw Error('Revisa el recuento de efectivo.');let sum=0;
 for(const [face,value]of Object.entries(counts)){
  const denomination=Number(face);if(!/^[1-9][0-9]*$/.test(face)||!allowed.has(denomination))throw Error('Ese billete o moneda no corresponde al euro.');
  const raw=String(value).trim();if(raw&&!/^[0-9]{1,7}$/.test(raw))throw Error('Indica cantidades enteras de billetes y monedas.');
  const quantity=raw===''?0:Number(raw);if(quantity>1000000)throw Error('El recuento admite hasta un millón de unidades por valor.');
  sum+=denomination*quantity;if(!Number.isSafeInteger(sum)||sum>999999999)throw Error('El efectivo contado supera el importe admitido.');
 }
 return sum;
}
export function cashOptionsHtml(value){const options=Array.isArray(value?.denominations)&&value.denominations.length===0?value:cashOptions(value);return `<fieldset data-tpv-cash-settings><legend>Efectivo · billetes y monedas</legend><label>Valores que utilizas<select name="cashDenominations" aria-label="Billetes y monedas" multiple size="5">${EURO_CASH_FACES.map(face=>`<option value="${face}" ${options.denominations.includes(face)?'selected':''}>${money(face)}</option>`).join('')}</select></label><p class="small muted">Se utilizan en el contador de efectivo y en los accesos rápidos del cobro. El importe final sigue siendo editable.</p></fieldset>`;}
export function cashCountHtml(target,value,formValues={}){
 if(!['opening','received','counted'].includes(target))throw Error('Recuento no admitido.');const options=cashOptions(value),counts=Object.fromEntries(options.denominations.map(face=>[face,formValues[target+'Coin'+face]??'']));
 let total;try{total=money(cashCountTotal(counts));}catch{total='Revisa las cantidades';}
 return `<details class="tpv-cash-counter" data-tpv-count="${target}" ${target==='received'?'data-tpv-received':''}><summary>Contar billetes y monedas</summary><div class="tpv-cash-faces">${options.denominations.map(face=>`<label class="tpv-cash-face"><span>${money(face)}</span><input type="number" min="0" max="1000000" step="1" inputmode="numeric" placeholder="0" name="${target}Coin${face}" value="${esc(counts[face])}" aria-label="Cantidad de ${money(face)}" data-tpv-count-face="${face}" data-tpv-count-target="${target}"></label>`).join('')}</div><output data-tpv-count-total="${target}" role="status">Total contado: ${esc(total)}</output><p class="small muted">Se aplica al importe del formulario. El registro conserva el importe total.</p></details>`;
}
export function updateCashCount(target){
 const form=target.form;if(!form||!target.hasAttribute('data-tpv-count-face'))return false;
 const name=target.dataset.tpvCountTarget;if(!['opening','received','counted'].includes(name))throw Error('Recuento no admitido.');
 const counts=Object.fromEntries([...form.querySelectorAll(`[data-tpv-count-target="${name}"]`)].map(input=>[input.dataset.tpvCountFace,input.value]));
 const output=form.querySelector(`[data-tpv-count-total="${name}"]`),field=form.elements.namedItem(name);
 try{const total=cashCountTotal(counts);for(const input of form.querySelectorAll(`[data-tpv-count-target="${name}"]`))input.setCustomValidity('');field.value=(total/100).toFixed(2).replace('.',',');if(output)output.textContent='Total contado: '+money(total);}
 catch(error){target.setCustomValidity(error.message);if(output)output.textContent=error.message;}
 return true;
}
export function clearCashCount(form,name){if(!form)return;
 for(const input of form.querySelectorAll(`[data-tpv-count-target="${name}"]`)){input.value='';input.setCustomValidity('');}
 const output=form.querySelector(`[data-tpv-count-total="${name}"]`);if(output)output.textContent='Total contado: '+money(0);
}
export function mountCashOptions(root){const settings=root.querySelector('[data-tpv-cash-settings]');if(settings)enhanceSearchableSelects(settings);}
