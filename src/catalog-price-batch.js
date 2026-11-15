import {esc} from './utils.js';
import {textValue} from './productos-core.js';
import {showProductDialog} from './productos-dialogs.js';

const decimal=(value,places,signed=false)=>{
 const raw=String(value??'').trim().replace(',','.');
 if(raw.length>32)throw Error('El importe es demasiado largo.');
 if(!(signed?/^-?\d+(?:\.\d+)?$/:/^\d+(?:\.\d+)?$/).test(raw))throw Error('Indica un importe decimal válido.');
 const [whole,fraction='']=raw.split('.');if(fraction.length>places)throw Error('Se admiten como máximo '+places+' decimales.');
 const sign=whole.startsWith('-')?-1n:1n;return sign*(BigInt(whole.replace('-',''))*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0')));
};
const amount=micros=>(micros/1000000n)+'.'+String(micros%1000000n).padStart(6,'0');
export function catalogPriceBatchPlan(rows,{mode,value}){
 if(!rows.length||rows.length>200)throw Error('Selecciona entre 1 y 200 productos para revisar un lote.');
 if(!['fixed','percent'].includes(mode))throw Error('Selecciona el tipo de ajuste.');
 const input=decimal(value,mode==='fixed'?6:4,mode==='percent');
 if(mode==='percent'&&(input< -1000000n||input>10000000n))throw Error('El porcentaje debe estar entre −100 y 1000.');
 const seen=new Set();return rows.map(row=>{
  const shop=row.__store,id=String(row.id),key=shop+'|'+id;
  if(!['hortimatic','newoldsmok'].includes(shop)||!/^\d{1,15}$/.test(id)||seen.has(key))throw Error('El lote contiene un origen o identificador inválido o repetido.');seen.add(key);
  const before=decimal(row.price,6),after=mode==='fixed'?input:(before*(1000000n+input)+500000n)/1000000n;
  if(after<0n||after>9999999999999n)throw Error('Precio fuera del intervalo permitido.');
  return {shop,id,key,name:textValue(row.name),before:amount(before),after:amount(after)};
 });
}

// Uses the existing per-row fingerprint, durable request and verified readback.
// No group write or new backend endpoint is introduced.
export function openCatalogPriceBatch({root,trigger,rows,editor,canEdit,current,persist,onDone,onState=()=>{},onClose=()=>{}}){
 if(!canEdit())throw Error('No tienes permiso para editar productos.');
 if(rows.some(row=>editor.rows.has(row.__store+'|'+row.id)))throw Error('Termina o descarta primero las filas abiertas de esta selección.');
 const dialog=document.createElement('dialog');dialog.className='prd-quick-edit';
 dialog.innerHTML='<form><header><div><h3>Ajustar precios seleccionados</h3><p>'+rows.length+' productos · precio base sin IVA</p></div><button type="button" class="btn secondary" data-batch-close aria-label="Cerrar ajuste de precios">×</button></header><p>Filtra el catálogo por marca y categoría y selecciona la familia que quieras ajustar. Este lote modifica únicamente el precio base de cada producto; conserva los impactos de combinaciones y las ofertas. Revisa esos importes en la ficha cuando proceda.</p><div class="form-grid"><label>Ajuste<select name="mode"><option value="fixed">Mismo precio base</option><option value="percent">Variación porcentual del precio base</option></select></label><label>Importe o porcentaje<input name="value" inputmode="decimal" required></label></div><p data-batch-status role="status"></p><div data-batch-review></div><footer><button type="button" class="btn secondary" data-batch-close>Cancelar</button><button type="submit" class="btn primary">Revisar lote</button><button type="button" class="btn primary" data-batch-save hidden>Publicar precios revisados</button></footer></form>';
 let busy=false,plan=[],owned=[],retain=false;
 const output=dialog.querySelector('[data-batch-status]'),review=dialog.querySelector('[data-batch-review]'),save=dialog.querySelector('[data-batch-save]'),form=dialog.querySelector('form');
 const clean=()=>{if(retain||!current())return;for(const item of owned)if(!editor.rows.get(item.key)?.request)editor.discard(item.shop,item.id);owned=[];};
 const lock=value=>{busy=value;onState(value);for(const el of dialog.querySelectorAll('button,input,select'))el.disabled=value;};
 const close=()=>{if(!busy)dialog.close();};
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('click',event=>{if(event.target===dialog&&busy){event.stopImmediatePropagation();return;}if(event.target.closest('[data-batch-close]'))close();},true);
 dialog.addEventListener('close',async()=>{if(!current())return;clean();onState(false);try{await persist();}catch(error){onDone('No se pudo conservar el borrador: '+error.message);}if(current())onClose();},{once:true});
 form.addEventListener('input',()=>{if(busy)return;clean();plan=[];review.replaceChildren();save.hidden=true;});
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;lock(true);save.hidden=true;try{
  if(!current()||!canEdit())throw Error('La cuenta o sus permisos han cambiado.');clean();plan=catalogPriceBatchPlan(rows,{mode:form.elements.mode.value,value:form.elements.value.value});
  for(const [index,item] of plan.entries()){
   if(!current()||!canEdit())throw Error('La vista o sus permisos han cambiado.');output.textContent='Revisando '+(index+1)+'/'+plan.length+'…';
   editor.open(item.shop,item.id,[]);owned.push(item);editor.change(item.shop,item.id,'price',item.after);
   const result=await editor.prepare(item.shop,item.id),change=result.changes?.find(c=>c.field==='price');
   if(!result.can_commit||!change||amount(decimal(change.before,6))!==item.before)throw Error('El precio de '+item.name+' ha cambiado en la tienda o no se puede publicar. Actualiza el catálogo y revisa de nuevo.');
  }
  await persist();if(!current())return;
  review.innerHTML='<div class="table-wrap"><table class="data-table"><thead><tr><th>Tienda</th><th>Producto</th><th>Base anterior</th><th>Base nueva</th></tr></thead><tbody>'+plan.map(item=>'<tr><td>'+esc(item.shop==='hortimatic'?'Hortimatic':'NewOldSmok')+'</td><td>'+esc(item.name)+' · #'+item.id+'</td><td>'+item.before+'</td><td>'+item.after+'</td></tr>').join('')+'</tbody></table></div>';
  output.textContent='Lote revisado sin escribir. Comprueba todos los precios antes de publicar.';save.hidden=false;
 }catch(error){plan=[];clean();review.replaceChildren();output.textContent=error.message;}finally{lock(false);}};
 save.onclick=async()=>{if(busy||!plan.length||!current()||!canEdit())return;lock(true);retain=true;let completed=0;try{
  for(const item of plan){if(!current()||!canEdit())throw Error('La vista o sus permisos han cambiado.');output.textContent='Publicando y releyendo '+(completed+1)+'/'+plan.length+'…';await editor.save(item.shop,item.id);completed++;await persist();}
  dialog.close();onDone(completed+' precios guardados y releídos en sus tiendas.');
 }catch(error){save.hidden=true;output.textContent=completed+'/'+plan.length+' guardados. '+error.message+' No se ha continuado con el resto. Las filas conservan sus solicitudes para comprobarlas sin duplicar escrituras.';await persist();}finally{lock(false);}};
 showProductDialog(root,dialog,{label:'Ajustar precios seleccionados',trigger});return dialog;
}
