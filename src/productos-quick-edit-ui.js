import {esc} from './utils.js';
import {textValue} from './productos-core.js';
import {showProductDialog} from './productos-dialogs.js';

const fields=[['name','Nombre'],['reference','Referencia'],['ean13','EAN'],['wholesale_price','Coste sin IVA'],['price','Precio sin IVA'],['weight','Peso (kg)'],['width','Ancho (cm)'],['height','Alto (cm)'],['depth','Fondo (cm)'],['active','Estado'],['visibility','Visibilidad'],['available_for_order','Permitir compras']];
const choices={active:[['0','Inactivo'],['1','Activo']],visibility:[['none','Oculto'],['both','Catálogo y búsqueda'],['catalog','Solo catálogo'],['search','Solo búsqueda']],available_for_order:[['0','No'],['1','Sí']]};

// Keep the native review, fingerprint and request recovery; only the presentation changes.
export function openProductQuickEdit({root,trigger,editor,product,shop,id,focusField,onChange=()=>{},onSaved=()=>{}}){
 const row=editor.rows.get(shop+'|'+id);if(!row)throw Error('Abre primero la edición de este producto.');
 const dialog=document.createElement('dialog');dialog.className='prd-photo-dialog prd-quick-edit';let busy=false,message='';
 const value=field=>row.values[field]??(field==='name'&&Array.isArray(product[field])?textValue(product[field].find(t=>String(t.id??t.language_id)===row.language)?.value):textValue(product[field]));
 function draw(){
  dialog.innerHTML='<header><div><h3>Edición rápida</h3><p>'+esc(shop==='hortimatic'?'Hortimatic':'NewOldSmok')+' · #'+esc(id)+' · '+esc(textValue(product.name))+'</p></div><button type="button" data-quick-close aria-label="Cerrar edición rápida">×</button></header><p>Modifica los datos, revisa las diferencias y confirma el guardado en esta tienda. No cambia otras fichas.</p>'+(row.languages.length>1?'<label>Idioma del nombre<select data-quick-language>'+row.languages.map(l=>'<option value="'+esc(l)+'" '+(l===row.language?'selected':'')+'>Idioma #'+esc(l)+'</option>').join('')+'</select></label>':'')+'<div class="prd-quick-fields">'+fields.map(([key,label])=>'<label>'+esc(label)+(choices[key]?'<select data-quick-field="'+key+'" '+(row.request||busy?'disabled':'')+'>'+choices[key].map(([v,n])=>'<option value="'+v+'" '+(String(value(key))===v?'selected':'')+'>'+n+'</option>').join('')+'</select>':'<input data-quick-field="'+key+'" value="'+esc(value(key))+'" '+(row.request||busy||key==='name'&&!row.language?'disabled':'')+'>')+'</label>').join('')+'</div>'+(row.prepared?'<section class="prd-quick-review"><h4>Diferencias revisadas</h4>'+row.prepared.review.filter(c=>c.changed).map(c=>'<p><b>'+esc(fields.find(f=>f[0]===c.field)?.[1]||c.field)+'</b>: '+esc(textValue(c.before))+' → '+esc(textValue(c.after??c.value))+'</p>').join('')+'</section>':'')+'<p role="status">'+esc(message)+'</p><footer>'+(!row.request?'<button type="button" data-quick-discard>Descartar y cerrar</button><button type="button" data-quick-review>Revisar cambios</button>':'<button type="button" data-quick-recover>Revisar recuperación</button>')+'<button type="button" class="prd-primary-action" data-quick-save '+(busy||!row.request&&!row.prepared?.can_commit?'disabled':'')+'>'+(row.request?'Comprobar guardado':'Guardar en PrestaShop')+'</button></footer>';
  for(const b of dialog.querySelectorAll('button,select'))if(busy)b.disabled=true;
 }
 dialog.onchange=e=>{try{if(e.target.matches('[data-quick-field]'))editor.change(shop,id,e.target.dataset.quickField,e.target.value);else if(e.target.matches('[data-quick-language]'))editor.language(shop,id,e.target.value);else return;message='Cambios sin enviar.';onChange();draw();}catch(error){message=error.message;draw();}};
 dialog.onclick=async e=>{const b=e.target.closest('button');if(!b||busy)return;
  if(b.hasAttribute('data-quick-close')){dialog.close();return;}
  if(b.hasAttribute('data-quick-discard')){editor.discard(shop,id);onChange();dialog.close();return;}
  busy=true;draw();try{if(b.hasAttribute('data-quick-review')){await editor.prepare(shop,id);message='Comprueba las diferencias antes de guardar.';}else if(b.hasAttribute('data-quick-recover')){await editor.reviewRecovery(shop,id);message='Solicitud original revisada. Comprueba el resultado antes de reintentar.';}else if(b.hasAttribute('data-quick-save')){await editor.save(shop,id);dialog.close();onSaved();return;}onChange();}catch(error){message=error.message;onChange();}finally{busy=false;if(dialog.open)draw();}
 };
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',onChange,{once:true});draw();showProductDialog(root,dialog,{label:'Edición rápida del producto',trigger});
 if(focusField)dialog.querySelector('[data-quick-field="'+focusField+'"]')?.focus();
 return dialog;
}
