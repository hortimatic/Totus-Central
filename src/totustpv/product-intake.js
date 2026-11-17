import {productIntakeDraft,productIntakeTaxPrice} from './product-intake-contract.js';
import {categoryCreationDraft} from '../category-create-contract.js';
import {normalizeProductImage} from '../productos-image-editor.js';
import {productCountryTaxRate,productDisplayAmounts} from '../productos-tax.js';
import {directoryText} from '../contact-directory-core.js';
import {enhanceSearchableSelects} from '../productos-controls.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={ready:'Lista para continuar',processing:'Comprobando resultado',attention:'Necesita comprobar el resultado',completed:'Alta terminada',cancelled:'Cancelada'};
const categoryStatus=status=>status==='completed'?'Categoría creada':statuses[status]||status;
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:6}).format(value);
const empty=()=>({name:'',reference:'',price:'',cost:'0',categoryId:'',manufacturerId:'0',supplierId:'0',taxRulesGroupId:'0',visibility:'none',quantity:0,ean13:'',supplierReference:'',description:'',images:[],variants:[]});
/** UI state belongs to the current workspace generation. The server owns every
 * reviewed workflow; no image or native credential is stored in localStorage. */
export function createProductIntakePanel({adapter,canCreate,canRead=canCreate,confirmDiscard=async()=>false,onProgress=()=>{}}){
 let shown=false,loaded=false,dirty=false,attempted=false,draft=empty(),catalogues={},active=null,history=[],revision=0,scroll=0,focusName='',grossText=null;
 let categoryEditor=false,categoryDraft={name:'',parentId:''},categoryActive=null,categoryAttempted=false,categoryHistory=[];
 const ensure=()=>{if(!canCreate())throw Error('No tienes permiso para crear productos en esta caja.');};
 const reset=()=>{revision++;shown=false;loaded=false;dirty=false;attempted=false;draft=empty();catalogues={};active=null;history=[];scroll=0;focusName='';grossText=null;
  categoryEditor=false;categoryDraft={name:'',parentId:''};categoryActive=null;categoryAttempted=false;categoryHistory=[];};
 const options=(resource,value,blank)=>`${blank?`<option value="${blank[0]}">${blank[1]}</option>`:''}${(catalogues[resource]||[]).map(row=>`<option value="${esc(row.id)}" ${String(row.id)===String(value)?'selected':''}>${esc(directoryText(row.name)||'#'+row.id)}</option>`).join('')}`;
 const field=(key,label,type='text',extra='')=>`<label>${label}<input data-tpv-product-field="${key}" name="${key}" type="${type}" value="${esc(draft[key])}" ${extra}></label>`;
 const select=(key,label,resource,blank)=>`<label>${label}<select name="${key}" aria-label="${esc(label)}" data-tpv-product-field="${key}">${options(resource,draft[key],blank)}</select></label>`;
 const rate=()=>productCountryTaxRate(draft.taxRulesGroupId,{countries:catalogues.countries,rules:catalogues.tax_rules,taxes:catalogues.taxes});
 const grossValue=()=>{if(grossText!==null)return grossText;try{return rate()===null?'':productIntakeTaxPrice(draft.price,String(rate())).replace(/0+$/,'').replace(/\.$/,'').replace('.',',');}catch{return '';}};
 const pricePreview=()=>{
  const rate=productCountryTaxRate(draft.taxRulesGroupId,{countries:catalogues.countries,rules:catalogues.tax_rules,taxes:catalogues.taxes});
  const amounts=productDisplayAmounts({price:draft.price.replace(',','.'),wholesale_price:draft.cost.replace(',','.')},rate);
  return amounts.gross===null?'El importe con impuestos se calculará en el ticket según la dirección del cliente.':
   `Precio orientativo con impuestos para España: ${money(amounts.gross)}${rate?' · '+rate+' %':''}. El ticket confirma el cálculo aplicable al cliente.`;
 };
 async function readAll(resource,run){
  const rows=[];
  for(let page=0;page<=1000;page++){
   const response=await adapter().productMetadata(resource,page);
   if(run!==revision)throw Error('La vista del alta ha cambiado.');
   if(!Array.isArray(response.rows)||typeof response.possibly_more!=='boolean')throw Error('No se ha podido comprobar el catálogo de '+resource+'.');
   rows.push(...response.rows);if(!response.possibly_more)return rows;
  }
  throw Error('El catálogo es demasiado grande para cargarlo completo. Pide al responsable que revise sus datos.');
 }
 async function refresh(){const run=revision,result=await adapter().productIntakes();if(run===revision)history=result;}
 async function open(){if(!canRead())throw Error('No tienes permiso para consultar productos de esta caja.');shown=true;const run=revision;
  if(adapter().categoryIntakes){categoryHistory=await adapter().categoryIntakes();if(run!==revision)return;}
  if(!categoryActive&&adapter().recoverCategoryPreparation){const recovered=await adapter().recoverCategoryPreparation();if(run!==revision)return;if(recovered){categoryActive=recovered;categoryEditor=true;}}
  if(!dirty&&!active&&adapter().recoverProductPreparation){const recovered=await adapter().recoverProductPreparation();if(run!==revision)return;if(recovered)active=recovered;}
  if(!canCreate()){await refresh();return;}
  if(!loaded){await adapter().productProfile();const data={};
   for(const resource of ['categories','manufacturers','suppliers','tax_rule_groups','product_options','product_option_values','countries','tax_rules'])data[resource]=await readAll(resource,run);
   data.taxes=[];
   for(const id of new Set(data.tax_rules.map(rule=>String(rule.id_tax)))){
    const response=await adapter().productMetadata('taxes',0,id);if(run!==revision)return;
    if(!Array.isArray(response.rows)||response.rows.length!==1||String(response.rows[0].id)!==id)throw Error('No se han podido comprobar los impuestos de esta tienda.');data.taxes.push(response.rows[0]);
   }
   if(run!==revision)return;
   for(const key of ['categories','manufacturers','suppliers','tax_rule_groups'])data[key]=data[key].filter(row=>String(row.active)==='1'&&String(row.deleted||'0')==='0');
   catalogues=data;loaded=true;
  }
  await refresh();
 }
 function html(error=''){if(!shown)return '';return `<dialog class="tpv-product-dialog" aria-labelledby="tpv-product-heading">
  <header class="tpv-product-heading"><div><span class="tpv-product-eyebrow">CATÁLOGO · ESTA TIENDA</span><h3 id="tpv-product-heading" tabindex="-1">${active?'Alta de producto':'Nuevo producto'}</h3><p>${active?'El progreso queda guardado. Puedes consultarlo de nuevo desde esta caja.':'Crea un artículo sin perder el ticket que estás preparando.'}</p></div><button type="button" class="btn secondary" data-tpv-product-action="close" aria-label="Cerrar alta de producto">Cerrar</button></header>
  <div class="tpv-product-content">${error?`<p class="note bad" role="alert">${esc(error)}</p>`:''}${categoryEditor?categoryHtml():active?reviewHtml():!canCreate()?'<p>Consulta las altas guardadas. Para crear o continuar un alta necesitas una caja abierta y permiso de creación de Productos.</p>':!loaded?'<p role="status">Consultando categorías y datos de la tienda…</p>':formHtml()}
  ${categoryHistory.length?`<details class="tpv-product-history"><summary>Categorías guardadas · ${categoryHistory.length}</summary>${categoryHistory.map(row=>`<button type="button" class="btn secondary tpv-product-history-item" data-tpv-category-id="${esc(row.id)}"><strong>${esc(row.name)}</strong><span>${esc(categoryStatus(row.status))}</span></button>`).join('')}</details>`:''}
  <details class="tpv-product-history"><summary>Altas guardadas en esta caja${history.length?' · '+history.length:''}</summary><button type="button" class="btn secondary" data-tpv-product-action="refresh">Actualizar altas</button>
  ${history.map(row=>`<button type="button" class="tpv-product-history-item btn secondary" data-tpv-product-id="${esc(row.id)}"><strong>${esc(row.name)}</strong><span>${esc(row.reference)} · ${esc(statuses[row.status]||row.status)}</span></button>`).join('')||'<p>Todavía no hay altas guardadas.</p>'}</details></div></dialog>`;}
 function formHtml(){return `<form data-tpv-product-form>${attempted?'<p class="note" role="alert">El envío está pendiente de comprobar. Conservamos la misma ficha; pulsa Comprobar envío para recuperar su resultado.</p>':''}<fieldset class="tpv-product-editor" ${attempted?'disabled':''}><div class="tpv-product-fields">
  ${field('name','Nombre del artículo','text','required maxlength="128" autocomplete="off"')}
  ${field('reference','Referencia','text','required minlength="3" maxlength="64" placeholder="Ej.: CAMISETA-AZUL" autocomplete="off"')}
  ${field('price','Precio de venta sin impuestos (€)','text','required inputmode="decimal" placeholder="0,00"')}
  <label>Precio de venta con impuestos (€)<input name="grossPrice" data-tpv-product-gross inputmode="decimal" value="${esc(grossValue())}" ${rate()===null?'disabled placeholder="Se calcula con la dirección del cliente"':'placeholder="0,00"'}></label>
  ${select('taxRulesGroupId','Impuestos','tax_rule_groups',['0','Sin impuestos'])}
  <p class="tpv-product-price-preview" data-tpv-product-price>${esc(pricePreview())}</p>
  ${field('cost','Precio de compra sin impuestos (€)','text','inputmode="decimal" required')}
  ${field('ean13','Código de barras EAN','text','inputmode="numeric" maxlength="13" placeholder="Opcional"')}
  ${select('categoryId','Categoría','categories',['','Selecciona categoría'])}
  ${adapter().prepareCategoryIntake?'<div class="inline-actions"><button type="button" class="btn secondary" data-tpv-product-action="category-new">+ Crear categoría</button></div>':''}
  ${select('manufacturerId','Marca','manufacturers',['0','Sin marca'])}
  ${select('supplierId','Proveedor','suppliers',['0','Sin proveedor'])}
  ${field('supplierReference','Referencia del proveedor','text','maxlength="64"')}
  ${draft.variants.length?'<p class="tpv-product-help">Las unidades se indican en cada combinación.</p>':field('quantity','Unidades disponibles','number','min="0" max="1000000000" step="1" required')}
  <label>Dónde se muestra<select name="visibility" data-tpv-product-field="visibility"><option value="none" ${draft.visibility==='none'?'selected':''}>Solo en el TPV</option><option value="both" ${draft.visibility==='both'?'selected':''}>TPV y tienda online</option></select></label>
  <label class="tpv-product-wide">Descripción<textarea name="description" data-tpv-product-field="description" maxlength="8000" rows="3">${esc(draft.description)}</textarea></label></div>
  <section class="tpv-product-images"><h4>Imágenes <small>Opcionales · hasta 6</small></h4><p>Elige una foto con fondo liso o un PNG sin fondo. La imagen se prepara en este dispositivo antes de enviarse.</p><div class="inline-actions"><label class="btn secondary">Elegir imágenes<input type="file" accept="image/*" multiple data-tpv-product-images></label><label class="btn secondary">Hacer foto<input type="file" accept="image/*" capture="environment" data-tpv-product-images></label></div>
  <div class="tpv-product-thumbnails">${draft.images.map((image,index)=>`<figure><img alt="Imagen ${index+1} preparada" src="data:image/png;base64,${image.base64}"><figcaption>${index===0?'Portada':'Imagen '+(index+1)}</figcaption><button type="button" class="btn secondary" data-tpv-product-remove-image="${index}">Quitar imagen ${index+1}</button></figure>`).join('')}</div></section>
  <section class="tpv-product-variants"><h4>Combinaciones <small>Tallas, colores u otras opciones</small></h4>
  ${draft.variants.map((variant,index)=>`<fieldset><legend>Combinación ${index+1}</legend><div class="tpv-product-fields"><label>Atributos<select name="variant-attributes-${index}" data-tpv-product-variant="${index}" data-tpv-product-property="attributeValueIds" multiple required>
  ${(catalogues.product_options||[]).map(group=>`<optgroup label="${esc(directoryText(group.public_name)||directoryText(group.name))}">${(catalogues.product_option_values||[]).filter(row=>String(row.id_attribute_group)===String(group.id)).map(row=>`<option value="${esc(row.id)}" ${variant.attributeValueIds.includes(String(row.id))?'selected':''}>${esc(directoryText(row.name))}</option>`).join('')}</optgroup>`).join('')}</select></label>
  ${[['reference','Referencia','text'],['price','Precio de venta sin impuestos (€)','text'],['cost','Precio de compra sin impuestos (€)','text'],['quantity','Unidades','number'],['ean13','EAN','text'],['supplierReference','Referencia del proveedor','text']].map(([key,label,type])=>`<label>${label}<input type="${type}" name="variant-${key}-${index}" data-tpv-product-variant="${index}" data-tpv-product-property="${key}" value="${esc(variant[key]??'')}" ${key==='quantity'?'min="0" max="1000000000" step="1" required':key==='price'||key==='cost'?'inputmode="decimal" placeholder="Igual que el producto"':key==='reference'?'placeholder="Se genera si lo dejas vacío" maxlength="64"':key==='ean13'?'maxlength="13"':'maxlength="64"'}></label>`).join('')}
  ${draft.images.length?`<label>Imágenes de esta combinación<select name="variant-images-${index}" data-tpv-product-variant="${index}" data-tpv-product-property="imageIndexes" multiple>${draft.images.map((_,i)=>`<option value="${i}" ${variant.imageIndexes.includes(i)?'selected':''}>Imagen ${i+1}${i===0?' · portada':''}</option>`).join('')}</select></label>`:''}</div><button type="button" class="btn secondary" data-tpv-product-remove-variant="${index}">Quitar combinación ${index+1}</button></fieldset>`).join('')}
  <button type="button" class="btn secondary" data-tpv-product-action="add-variant" ${draft.variants.length>=100?'disabled':''}>Añadir combinación</button></section>
  </fieldset><footer class="tpv-product-footer"><span>Revisa la ficha antes de crearla en la tienda.</span><button type="submit" class="btn primary">${attempted?'Comprobar envío':'Guardar ficha para revisar'}</button></footer></form>`;}
 function reviewHtml(){return `<section class="tpv-product-review"><span class="tpv-product-status" role="status">${esc(statuses[active.status]||active.status)}</span><h4>${esc(active.name)}</h4><p>${esc(active.reference)}${active.productId?' · Producto #'+esc(active.productId):''}</p>
  <ol>${active.steps.map((step,index)=>`<li class="${step.status==='verified'?'is-verified':index===active.currentStep?'is-current':''}"><span aria-hidden="true">${step.status==='verified'?'✓':index+1}</span><div><strong>${esc(step.label)}</strong><small>${step.status==='verified'?'Verificado en la tienda':index===active.currentStep?'Próximo paso':'Pendiente'}</small></div></li>`).join('')}</ol>
  ${active.status==='attention'?'<p class="note" role="alert">La tienda no ha confirmado una etapa. Comprueba y continúa esta misma alta; los pasos verificados se conservan.</p>':''}
  <div class="inline-actions">${canCreate()&&['ready','attention','processing'].includes(active.status)?`<button type="button" class="btn primary" data-tpv-product-action="run">${active.currentStep===0&&active.status==='ready'?'Confirmar y crear producto':'Comprobar y continuar alta'}</button>`:''}
  ${canCreate()&&active.currentStep===0&&['ready','attention'].includes(active.status)?'<button type="button" class="btn secondary" data-tpv-product-action="cancel">Cancelar alta sin crear</button>':''}
  ${canCreate()&&['completed','cancelled'].includes(active.status)?'<button type="button" class="btn secondary" data-tpv-product-action="new">Preparar otro artículo</button>':''}</div>
  ${active.status==='completed'?'<p class="note">Producto guardado y verificado. Cierra esta ventana para buscarlo y añadirlo al ticket.</p>':''}</section>`;}
 function categoryHtml(){return `<section class="tpv-product-category"><h4>Crear categoría</h4><p>Tu ficha de producto se conserva. La categoría se crea en esta tienda después de confirmar.</p>
  ${categoryActive?`<p role="status"><strong>${esc(categoryActive.name)}</strong> · ${esc(categoryStatus(categoryActive.status))}</p>
   ${categoryActive.recordId?`<p>Categoría verificada en la tienda · #${esc(categoryActive.recordId)}</p>`:''}
   ${categoryActive.status==='attention'?'<p class="note">No se ha confirmado la respuesta. Comprueba esta misma solicitud para evitar duplicados.</p>':''}
   <div class="inline-actions">${canCreate()&&['ready','attention','processing'].includes(categoryActive.status)?'<button type="button" class="btn primary" data-tpv-product-action="category-run">Confirmar y comprobar categoría</button>':''}
   ${canCreate()&&['ready','attention'].includes(categoryActive.status)?'<button type="button" class="btn secondary" data-tpv-product-action="category-cancel">Cancelar solicitud</button>':''}
   ${canCreate()&&!active&&!attempted&&categoryActive.status==='completed'?'<button type="button" class="btn primary" data-tpv-product-action="category-use">Usar en este producto</button>':''}
   ${canCreate()&&['completed','cancelled'].includes(categoryActive.status)?'<button type="button" class="btn secondary" data-tpv-product-action="category-another">Preparar otra categoría</button>':''}</div>`:
   `<form data-tpv-category-form><fieldset class="tpv-product-editor" ${categoryAttempted||!canCreate()?'disabled':''}><div class="tpv-product-fields"><label>Nombre de la categoría<input name="categoryName" data-tpv-category-field="name" required maxlength="128" value="${esc(categoryDraft.name)}"></label><label>Dentro de<select name="categoryParent" aria-label="Dentro de" data-tpv-category-field="parentId" required>${options('categories',categoryDraft.parentId,['','Selecciona categoría principal'])}</select></label></div></fieldset>
    ${categoryAttempted?'<p class="note" role="status">Comprueba el envío antes de cambiar los datos.</p>':''}
    ${canCreate()?`<button type="submit" class="btn primary">${categoryAttempted?'Comprobar envío':'Revisar categoría'}</button>`:''}</form>`}
  <button type="button" class="btn secondary" data-tpv-product-action="category-back">Volver al producto</button></section>`;}
 return Object.freeze({html,open,reset,isOpen:()=>shown,hasDraft:()=>dirty&&!active||!categoryActive&&(categoryAttempted||!!categoryDraft.name),
  snapshot:()=>structuredClone({shown,loaded,dirty,attempted,draft,active,history}),
  capture(root){const dialog=root.querySelector('.tpv-product-dialog');if(dialog){scroll=dialog.scrollTop;focusName=dialog.contains(document.activeElement)?document.activeElement.name||'':'';}},
  mount(root){const dialog=root.querySelector('.tpv-product-dialog');if(!dialog)return;
   if(!dialog.open)dialog.showModal();enhanceSearchableSelects(dialog);
   if(focusName)dialog.querySelector(`[name="${CSS.escape(focusName)}"]`)?.focus({preventScroll:true});dialog.scrollTop=scroll;
   dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.querySelector('[data-tpv-product-action="close"]').click();});
  },
  input(target){if(target.dataset.tpvCategoryField){ensure();if(categoryActive||categoryAttempted)throw Error('Comprueba el envío de la categoría antes de cambiar sus datos.');categoryDraft[target.dataset.tpvCategoryField]=target.value;return true;}
   if(!target.closest('[data-tpv-product-form]')||active||target.type==='file')return false;ensure();
   if(attempted)throw Error('Comprueba el resultado del alta con la misma ficha antes de cambiar sus datos.');
   const key=target.dataset.tpvProductField,index=target.dataset.tpvProductVariant,property=target.dataset.tpvProductProperty;
   if(target.hasAttribute('data-tpv-product-gross')){
    grossText=target.value;try{if(rate()===null)throw Error('El precio con estos impuestos necesita una dirección completa.');draft.price=grossText.trim()?productIntakeTaxPrice(grossText,String(rate()),{toNet:true}):'';target.setCustomValidity('');}
    catch(error){draft.price='';target.setCustomValidity(error.message);}
   }
   else if(key){draft[key]=key==='quantity'?Number(target.value):target.value;
    if(key==='price')grossText=null;
    if(key==='taxRulesGroupId'&&grossText!==null){try{if(rate()===null)grossText=null;else draft.price=productIntakeTaxPrice(grossText,String(rate()),{toNet:true});}catch{grossText=null;}}
   }
   else if(index!==undefined&&draft.variants[Number(index)])draft.variants[Number(index)][property]=['attributeValueIds','imageIndexes'].includes(property)?[...target.selectedOptions].map(option=>property==='imageIndexes'?Number(option.value):option.value):property==='quantity'?Number(target.value):target.value;
   else return false;dirty=true;
   const preview=target.form?.querySelector('[data-tpv-product-price]');if(preview)preview.textContent=pricePreview();
   const gross=target.form?.querySelector('[data-tpv-product-gross]');if(gross&&gross!==target){gross.disabled=rate()===null;gross.value=grossValue();gross.setCustomValidity('');}
   if(target.hasAttribute('data-tpv-product-gross')||key==='taxRulesGroupId'){const net=target.form?.querySelector('[name=price]');if(net)net.value=draft.price;}
   return true;
  },
  async images(files){ensure();if(active||attempted)throw Error('Termina o comprueba el alta antes de cambiar las imágenes.');const run=revision;
   if(draft.images.length+files.length>6)throw Error('Puedes añadir hasta seis imágenes por producto.');
   const prepared=[];for(const file of files)prepared.push(await normalizeProductImage(file));
   if(run!==revision)return;const candidate={...draft,images:[...draft.images,...prepared]};
   // Validate total size without requiring the rest of the unfinished form.
   productIntakeDraft({...candidate,name:candidate.name||'Imagen preparada',reference:candidate.reference||'IMAGEN-PREPARADA',price:candidate.price||'0',categoryId:candidate.categoryId||'1',variants:[]});
   draft.images=candidate.images;dirty=true;
  },
  async prepare(){ensure();const payload=productIntakeDraft(draft);attempted=true;
   try{active=await adapter().prepareProductIntake(payload);dirty=false;draft=empty();grossText=null;attempted=false;await refresh();}
   catch(error){if(['TPV_PRODUCT_ATTRIBUTE_GROUP_REPEATED','TPV_PRODUCT_METADATA_INVALID','TPV_PRODUCT_CURRENCY_INVALID','TPV_PRODUCT_WRITE_UNAVAILABLE'].includes(error.code))attempted=false;throw error;}},
  async prepareCategory(){ensure();const payload=categoryCreationDraft(categoryDraft);categoryAttempted=true;
   try{categoryActive=await adapter().prepareCategoryIntake(payload);categoryAttempted=false;categoryHistory=await adapter().categoryIntakes();}
   catch(error){if(error.code==='TPV_CATALOGUE_FIELDS_REJECTED'||error.code==='TPV_PRODUCT_WRITE_UNAVAILABLE')categoryAttempted=false;throw error;}},
  async click(target){const action=target.dataset.tpvProductAction;
   if(action==='close'){if((dirty&&!active||categoryEditor&&!categoryActive&&(categoryAttempted||categoryDraft.name))&&!await confirmDiscard(attempted||categoryAttempted?'El envío puede estar guardado. ¿Cerrar y consultar después las altas guardadas?':'¿Cerrar y descartar la ficha sin guardar?'))return;
    shown=false;if(!active&&!attempted){draft=empty();dirty=false;grossText=null;}return;}
   if(!canRead())throw Error('No tienes permiso para consultar estas altas.');
   if(target.dataset.tpvCategoryId){categoryActive=await adapter().getCategoryIntake(target.dataset.tpvCategoryId);categoryEditor=true;categoryAttempted=false;return;}
   if(action==='category-back'){categoryEditor=false;return;}
   if(action==='category-another'){ensure();if(!['completed','cancelled'].includes(categoryActive?.status))throw Error('Termina o comprueba esta categoría antes de preparar otra.');categoryActive=null;categoryAttempted=false;categoryDraft={name:'',parentId:draft.categoryId};return;}
   if(action==='category-new'){ensure();categoryEditor=true;if(!categoryActive&&!categoryAttempted)categoryDraft.parentId=draft.categoryId;return;}
   if(action==='category-run'||action==='category-cancel'||action==='category-use'){
    ensure();if(!categoryActive)throw Error('Selecciona una categoría guardada.');const run=revision;
    if(action==='category-run')categoryActive=await adapter().advanceCategoryIntake(categoryActive.id);
    if(action==='category-cancel')categoryActive=await adapter().cancelCategoryIntake(categoryActive.id);
    if(run!==revision)return;
    if(action==='category-use'){
     if(active||attempted)throw Error('Termina el alta de producto antes de cambiar su categoría.');
     categoryActive=await adapter().getCategoryIntake(categoryActive.id);if(categoryActive.status!=='completed'||!categoryActive.recordId)throw Error('Comprueba primero que la categoría se haya creado.');
     const rows=await readAll('categories',run);if(!rows.some(row=>String(row.id)===categoryActive.recordId))throw Error('La categoría todavía no aparece en el catálogo de esta tienda. Vuelve a comprobarla.');
     catalogues.categories=rows.filter(row=>String(row.active)==='1');draft.categoryId=categoryActive.recordId;dirty=true;categoryEditor=false;categoryActive=null;categoryDraft={name:'',parentId:''};
    }
    categoryHistory=await adapter().categoryIntakes();return;
   }
   if(action==='refresh'){await refresh();return;}
   if(target.dataset.tpvProductId){if(dirty&&!await confirmDiscard('¿Descartar la ficha sin guardar y consultar esta alta?'))return;
    active=await adapter().getProductIntake(target.dataset.tpvProductId);draft=empty();grossText=null;dirty=false;attempted=false;return;}
   ensure();
   if(action==='new'){active=null;draft=empty();grossText=null;dirty=false;attempted=false;return;}
   if(action==='run'){
    if(!active)throw Error('Selecciona un alta guardada.');const run=revision,id=active.id;
    active=await adapter().getProductIntake(id);
    for(let count=0;count<410&&['ready','attention','processing'].includes(active.status);count++){
     const before=active.currentStep;const result=await adapter().advanceProductIntake(id);if(run!==revision)return;active=result;onProgress();
     if(active.currentStep<=before||active.status==='attention'||active.busy)break;
    }
    await refresh();return;
   }
   if(action==='cancel'){if(active)active=await adapter().cancelProductIntake(active.id);await refresh();return;}
   if(active||attempted)throw Error('Comprueba o termina el alta antes de cambiar la ficha.');
   if(action==='add-variant'){
    if(draft.quantity>0&&!await confirmDiscard('Las unidades pasarán a indicarse por combinación. ¿Continuar y poner a cero las unidades generales?'))return;
    if(draft.variants.length>=100)throw Error('Puedes preparar hasta cien combinaciones.');draft.quantity=0;
    draft.variants.push({reference:'',attributeValueIds:[],price:'',cost:'',quantity:0,ean13:'',supplierReference:'',imageIndexes:[]});dirty=true;return;
   }
   if(target.dataset.tpvProductRemoveVariant!==undefined){draft.variants.splice(Number(target.dataset.tpvProductRemoveVariant),1);dirty=true;}
   if(target.dataset.tpvProductRemoveImage!==undefined){const index=Number(target.dataset.tpvProductRemoveImage);draft.images.splice(index,1);
    for(const variant of draft.variants)variant.imageIndexes=variant.imageIndexes.filter(i=>i!==index).map(i=>i>index?i-1:i);dirty=true;}
  }
 });
}
