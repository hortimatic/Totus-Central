import {esc} from './utils.js';
import {textValue,productInputValue,associationIds,mapVariantAttributes} from './productos-core.js';
import {fieldHelp} from './components.js';
import {normalizeProductImage} from './productos-image-editor.js';
import {prestashopStore} from './prestashop-readonly.js';
import {buildVisualProductDescription} from './productos-description.js';
const h=v=>esc(String(v??''));
const titles={remove_product:'Eliminar producto',attribute_group:'Nuevo atributo',attribute_value:'Nuevo valor de atributo',image_replace:'Sustituir imagen',image_metadata:'Orden y textos de imagen',remove_variation:'Eliminar combinación',remove_image:'Eliminar imagen',variation_edit:'Fotos por combinación',variation:'Combinaciones',stock:'Existencias',supplier_price:'Precios de proveedor',special_price:'Ofertas y precios especiales',image:'Imágenes',finish:'Revisión y publicación'};
const labels={id_attribute_group:'Grupo de atributo',group_type:'Representación',color:'Color (#RRGGBB)',position:'Posición en la galería',id_category_default:'Categoría principal',id_manufacturer:'Marca',id_tax_rules_group:'Grupo de impuestos',reference:'Referencia',ean13:'EAN-13',upc:'UPC',isbn:'ISBN',mpn:'Referencia fabricante',supplier_reference:'Referencia proveedor',price:'Precio / impacto sin impuestos',wholesale_price:'Coste sin impuestos',weight:'Impacto de peso',ecotax:'Ecotasa',unit_price_impact:'Impacto de precio por unidad',minimal_quantity:'Cantidad mínima de venta',low_stock_threshold:'Umbral de pocas existencias',low_stock_alert:'Aviso de pocas existencias',default_on:'Combinación predeterminada',available_date:'Fecha de disponibilidad',id_product_attribute:'Producto o combinación',quantity:'Unidades',out_of_stock:'Pedidos sin existencias',depends_on_stock:'Gestión avanzada de existencias',location:'Ubicación',id_supplier:'Proveedor',id_currency:'Moneda',product_supplier_reference:'Referencia del proveedor',product_supplier_price_te:'Precio del proveedor sin impuestos',from_quantity:'Desde esta cantidad',reduction:'Reducción (importe o fracción)',reduction_tax:'Reducción con impuestos',reduction_type:'Tipo de reducción',from:'Inicio (AAAA-MM-DD HH:MM:SS)',to:'Fin (AAAA-MM-DD HH:MM:SS)',active:'Producto activo',available_for_order:'Se permite comprar',visibility:'Visibilidad',id_default_image:'Imagen de portada',id_default_combination:'Combinación predeterminada',id_shop:'Tienda (0: todas)',id_shop_group:'Grupo de tiendas (0: todos)',id_country:'País (0: todos)',id_group:'Grupo de clientes (0: todos)',id_customer:'Cliente concreto (0: todos)',id_cart:'Carrito concreto (0: todos)'};
const defaults={attribute_group:{group_type:'select'},attribute_value:{id_attribute_group:'',color:''},image_metadata:{position:'1'},
 remove_product:{},remove_variation:{},remove_image:{},variation_edit:{},
 variation:{reference:'',ean13:'',upc:'',isbn:'',mpn:'',supplier_reference:'',price:'0',wholesale_price:'0',weight:'0',ecotax:'0',unit_price_impact:'0',minimal_quantity:'1',low_stock_threshold:'1',low_stock_alert:'0',default_on:'0',available_date:''},
 stock:{id_product_attribute:'0',quantity:'0',out_of_stock:'0',depends_on_stock:'0',location:''},
 supplier_price:{id_product_attribute:'0',id_supplier:'',id_currency:'',product_supplier_reference:'',product_supplier_price_te:'0'},
 special_price:{id_product_attribute:'0',id_shop:'0',id_shop_group:'0',id_currency:'0',id_country:'0',id_group:'0',id_customer:'0',id_cart:'0',price:'-1',from_quantity:'1',reduction:'0.10',reduction_tax:'1',reduction_type:'percentage',from:'0000-00-00 00:00:00',to:'0000-00-00 00:00:00'},
 finish:{active:'0',available_for_order:'0',visibility:'none',id_default_image:'',id_default_combination:''}
};
export function createProductStagesUI({invoke,canEdit=()=>false}){
 const sessions=new Map(),rows=new Map();
 function session(shop,result,plan,source,profile,catalogs){
  const key=shop+'|'+result.request_id;let state=sessions.get(key);
  if(!state){state={shop,result,source,profile,catalogs:catalogs||{},tab:'image',rows:[]};sessions.set(key,state);
   for(const variant of plan.variants||[]){const row=add(state,'variation');row.sourceAttributes=variant.source_attributes||[];row.sourceDefault=variant.source_default_on===true;for(const change of variant.changes||[])row.fields[change.field]=textValue(change.after);}
   if(state.rows.length){state.tab='variation';const defaults=state.rows.filter(row=>row.sourceDefault);const preferred=defaults.length===1?defaults[0]:state.rows[0];for(const row of state.rows)row.fields.default_on=row===preferred?'1':'0';}
   const active=(plan.changes||[]).find(c=>c.field==='active'&&c.changed);if(!result.existing_product&&active?.after==='1'){const row=add(state,'finish');row.fields.active='1';row.fields.available_for_order=String((plan.changes||[]).find(c=>c.field==='available_for_order')?.after??'0');}
  }
  state.source=source;state.profile=profile;state.catalogs={...state.catalogs,...catalogs};return state;
 }
 function add(state,kind){
  const row={id:crypto.randomUUID().replaceAll('-',''),kind,fields:{...defaults[kind]},attributes:[],imageIds:[],image:null,removeBackground:true};
  state.rows.push(row);rows.set(row.id,{state,row});return row;
 }
 const button=(state,row,label,action,disabled=false,extra='')=>'<button type="button" class="btn secondary" data-pr-action="create-stage-'+action+'" data-pr-dest="'+h(state.shop)+'" '+(row?'data-pr-stage-row="'+row.id+'" ':'')+extra+(disabled?' disabled':'')+'>'+h(label)+'</button>';
 function input(state,row,key){
  const value=row.fields[key],locked=row.attempted||row.done;
  const data='data-pr-stage-field="'+h(key)+'" data-pr-stage-row="'+row.id+'" '+(locked||row.kind==='stock'&&key==='quantity'&&row.aggregate?'disabled':'');
  const combinationRows=[...new Map([
   ...associationIds(state.source,'combinations').map(id=>[id,{id,name:'Combinación #'+id}]),
   ...state.rows.filter(r=>r.kind==='variation'&&r.done).map(r=>[String(r.done.record_id),{id:String(r.done.record_id),name:r.fields.reference}])
  ]).values()];
  let options=null;
  if(key==='id_attribute_group')options=state.catalogs.product_options||[];
  if(key==='id_product_attribute')options=[{id:'0',name:'Producto base / todas'},...combinationRows];
  if(key==='id_default_combination')options=combinationRows;
  if(key==='id_supplier')options=state.catalogs.suppliers||[];
  if(key==='id_currency')options=[...(row.kind==='special_price'?[{id:'0',name:'Todas las monedas'}]:[]),...(state.catalogs.currencies||[]).map(r=>({...r,name:textValue(r.name)+' · '+r.iso_code}))];
  if(key==='id_category_default')options=(state.catalogs.categories||[]);
  if(key==='id_manufacturer')options=(state.catalogs.manufacturers||[]);
  if(key==='id_tax_rules_group')options=(state.catalogs.tax_rule_groups||[]);
  if(key==='id_default_image')options=[...associationIds(state.source,'images').map(id=>({id,name:'Imagen existente #'+id})),...state.rows.filter(r=>r.kind==='image'&&r.done).map((r,i)=>({id:r.done.record_id,name:'Imagen '+(i+1)+' · '+r.image.name}))];
  const enums={group_type:[['select','Lista desplegable'],['radio','Botones de selección'],['color','Color']],active:[['0','Inactivo'],['1','Activo']],available_for_order:[['0','No comprable'],['1','Comprable']],visibility:[['none','Oculto'],['both','Catálogo y búsqueda'],['catalog','Catálogo'],['search','Búsqueda']],out_of_stock:[['0','Denegar'],['1','Permitir'],['2','Preferencia de la tienda']],depends_on_stock:[['0','Existencias normales']],default_on:[['0','No'],['1','Sí']],low_stock_alert:[['0','No'],['1','Sí']],reduction_tax:[['0','Sin impuestos'],['1','Con impuestos']],reduction_type:[['percentage','Porcentaje: 0,10 equivale al 10 %'],['amount','Importe fijo']]};
  if(row.kind==='finish'&&['id_manufacturer','id_supplier','id_tax_rules_group'].includes(key))options=[{id:'0',name:key==='id_tax_rules_group'?'Sin impuestos':'Sin asignar'},...(options||[])];
  if(enums[key])options=enums[key].map(([id,name])=>({id,name}));
  return '<label class="prd-field"><b>'+h(labels[key]||key)+'</b>'+fieldHelp(labels[key]||key,key==='reduction'?'En porcentaje usa una fracción: 0,10 significa el 10 %. En importe fijo indica el descuento monetario.':key==='price'?'En una variación es el impacto sobre el precio base, sin impuestos. En un precio especial, -1 conserva el precio normal.':'Este dato se guarda en la tienda seleccionada y se comprueba por relectura. Los importes aceptan coma o punto decimal.')+(options?'<select '+data+'><option value="">Seleccionar</option>'+options.map(option=>'<option value="'+h(option.id)+'" '+(String(option.id)===String(value)?'selected':'')+'>'+h(textValue(option.name))+'</option>').join('')+'</select>':'<input '+data+' value="'+h(value)+'" '+(key.includes('price')||key==='reduction'?'inputmode="decimal"':'')+'>')+'</label>';
 }
 function rowForm(state,row){
  const locked=row.attempted||row.done;
  let content='';
  if(['image','image_replace'].includes(row.kind))content='<label class="prd-field"><b>Archivo de producto</b><input type="file" accept="image/*" data-pr-stage-file="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'></label><label class="prd-stage-check"><input type="checkbox" data-pr-stage-remove-background="true" data-pr-stage-row="'+row.id+'" '+(row.removeBackground?'checked':'')+' '+(locked?'disabled':'')+'> Quitar fondo uniforme al cargar</label><p>El lienzo usa un tipo de imagen de esta tienda; se conserva el producto completo. Se comprueba transparencia real. PrestaShop puede convertir sus copias a otro formato. No se envía la foto a servicios externos.</p>'+(row.image?'<p>'+h(row.imageSize?.name||'')+' · '+h(row.imageSize?.width||'')+' × '+h(row.imageSize?.height||'')+' px</p><img class="prd-stage-image" src="data:image/png;base64,'+row.image.base64+'" alt="Vista previa de '+h(row.image.name)+'">':'');
  else{
   content='<div class="prd-fields-grid">'+Object.keys(row.fields).filter(k=>!Array.isArray(row.fields[k])).map(key=>input(state,row,key)).join('')+'</div>';
   if(['attribute_group','attribute_value'].includes(row.kind)){content+='<p>Se crea un atributo compartido por el catálogo de esta tienda; no modifica otras tiendas ni cambia combinaciones existentes.</p>';for(const key of row.kind==='attribute_group'?['name','public_name']:['name'])for(const t of row.fields[key]||[])content+='<label class="prd-field"><b>'+h(key==='public_name'?'Nombre público':'Nombre')+' · idioma '+h(t.language_id)+'</b><input maxlength="'+(key==='public_name'?64:128)+'" data-pr-stage-field="'+key+'" data-pr-stage-language="'+h(t.language_id)+'" data-pr-stage-row="'+row.id+'" value="'+h(t.value)+'" '+(locked?'disabled':'')+'></label>';}
   if(row.kind==='variation')content+='<label class="prd-field"><b>Atributos de esta combinación</b><select multiple size="5" data-pr-stage-attributes="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+((state.catalogs.product_options||[]).map(group=>'<optgroup label="'+h(textValue(group.public_name)||textValue(group.name))+'">'+(state.catalogs.product_option_values||[]).filter(v=>String(v.id_attribute_group)===String(group.id)).map(value=>'<option value="'+h(value.id)+'" '+(row.attributes.includes(String(value.id))?'selected':'')+'>'+h(textValue(value.name))+'</option>').join('')+'</optgroup>').join(''))+'</select><small>Elige un valor de cada atributo. El servidor verifica la pertenencia a sus grupos.</small></label><label class="prd-field"><b>Imágenes de esta combinación</b><select multiple size="3" data-pr-stage-images="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+[...associationIds(state.source,'images').map(id=>({id,name:'Imagen existente #'+id})),...state.rows.filter(r=>r.kind==='image'&&r.done).map(r=>({id:String(r.done.record_id),name:r.image.name}))].filter((image,index,all)=>all.findIndex(x=>x.id===image.id)===index).map(image=>'<option value="'+h(image.id)+'" '+(row.imageIds.includes(String(image.id))?'selected':'')+'>'+h(image.name)+'</option>').join('')+'</select><small>Guarda primero las imágenes que quieras asociar. Si no eliges ninguna se usa la galería general.</small></label>';
   if(row.stockError)content+='<p class="prd-warning">'+h(row.stockError)+'</p>';
   if(row.kind==='stock'&&row.aggregate)content+='<p>La cantidad total se calcula desde las combinaciones. Ajusta sus unidades desde cada combinación; aquí se conservan al cambiar ubicación o disponibilidad.</p>';
   if(row.kind==='image_metadata')content+='<p>Imagen #'+h(row.recordId)+'. El orden se ajusta con el método nativo de PrestaShop; no cambia la portada ni la asociación con el producto.</p>'+((row.fields.legend||[]).map(t=>'<label class="prd-field"><b>Texto alternativo · idioma '+h(t.language_id)+'</b><input maxlength="128" data-pr-stage-field="legend" data-pr-stage-language="'+h(t.language_id)+'" data-pr-stage-row="'+row.id+'" value="'+h(t.value)+'" '+(locked?'disabled':'')+'></label>').join(''));
   if(row.kind.startsWith('remove_'))content+='<p class="prd-warning">Se eliminará definitivamente '+(row.kind==='remove_product'?'el producto completo, sus combinaciones y galería':row.kind==='remove_image'?'la imagen':'la combinación')+' #'+h(row.recordId||'sin seleccionar')+' de este producto en '+h(state.shop)+'. No elimina el producto ni sus documentos. Revisa la selección antes de confirmar.</p><label class="prd-field"><b>Escribe ELIMINAR '+h(row.recordId||'')+'</b><input data-pr-stage-remove-confirm="true" data-pr-stage-row="'+row.id+'" value="'+h(row.removeConfirm||'')+'" '+(locked?'disabled':'')+'></label>';
   if(row.kind==='variation_edit')content+='<label class="prd-field"><b>Combinación de este producto</b><select data-pr-stage-variant-record="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'><option value="">Seleccionar combinación</option>'+associationIds(state.source,'combinations').map(id=>'<option value="'+h(id)+'" '+(row.recordId===id?'selected':'')+'>Combinación #'+h(id)+'</option>').join('')+'</select></label><label class="prd-field"><b>Imágenes asociadas a la combinación</b><select multiple size="5" data-pr-stage-images="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+associationIds(state.source,'images').map(id=>'<option value="'+h(id)+'" '+(row.imageIds.includes(id)?'selected':'')+'>Imagen #'+h(id)+'</option>').join('')+'</select><small>La selección sustituye solo las asociaciones de imagen de esta combinación. Sin selección usará la galería general.</small></label>';
   if(row.kind==='finish'){
    if(row.organization){const label=(resource,id)=>textValue(state.catalogs[resource]?.find(row=>String(row.id)===String(id))?.name)||'#'+id;content+='<dl class="prd-organization-review"><dt>Categorías</dt><dd>'+h((row.organization.categories||[]).map(id=>label('categories',id)).join(' · ')||'Ninguna')+'</dd><dt>Etiquetas</dt><dd>'+h((row.organization.tags||[]).map(id=>label('tags',id)).join(' · ')||'Ninguna')+'</dd><dt>Relacionados</dt><dd>'+h((row.organization.accessories||[]).map(id=>label('related_products',id)).join(' · ')||'Ninguno')+'</dd><dt>Características y materiales</dt><dd>'+h((row.organization.product_features||[]).map(feature=>label('product_features',feature.feature_id)+': '+(textValue(state.catalogs.product_feature_values?.find(v=>String(v.id)===feature.value_id)?.value)||'#'+feature.value_id)).join(' · ')||'Ninguna')+'</dd></dl>';}
    if(!row.metadataOnly){content+='<p>La ficha permanece inactiva hasta esta revisión. Puedes activarla y dejar «Se permite comprar» en No para revisar una muestra sin vender existencias ficticias.</p><fieldset class="prd-relationships"><legend>Constructor de descripción visual</legend><div class="prd-fields-grid">'+[['title','Título'],['intro','Introducción / resumen'],['detailTitle','Título del bloque de detalles'],['detailText','Detalles y ventajas'],['specifications','Especificaciones (campo: valor, una por línea)'],['box','Contenido y cuidados'],['notice','Aviso o información final']].map(([key,label])=>'<label class="prd-field"><b>'+h(label)+'</b><textarea rows="3" data-pr-stage-presentation="'+key+'" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+h(row.presentation?.[key]||'')+'</textarea></label>').join('')+'</div>'+button(state,row,'Preparar descripción visual con las imágenes guardadas','description',!!locked)+'</fieldset><details><summary>Editar el HTML por idioma (avanzado)</summary>';
    for(const field of ['description_short','description'])for(const translation of row.fields[field]||[])content+='<label class="prd-field"><b>'+h(field==='description'?'Descripción completa':'Resumen')+' · idioma '+h(translation.language_id)+'</b><textarea rows="6" data-pr-stage-field="'+field+'" data-pr-stage-language="'+h(translation.language_id)+'" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+h(translation.value)+'</textarea></label>';
    content+='</details>';}
   }
  }
  const otherPending=state.rows.some(r=>r!==row&&!r.done);
  const lacksImage=!(state.result.existing_product&&associationIds(state.source,'images').length)&&!state.rows.some(r=>r.kind==='image'&&r.done);
  const activating=row.kind==='finish'&&row.fields.active==='1'&&(!state.result.existing_product||textValue(state.source.active)!=='1');
  const incompleteNotice=activating&&(otherPending||lacksImage);
  return '<article class="prd-stage-row" data-pr-save-state="'+(row.done?'saved':row.attempted?'checking':'pending')+'"><header><h5>'+h(titles[row.kind])+' '+(row.done?'· guardado y verificado':'· pendiente')+'</h5>'+(row.done?'<span>#'+h(row.done.record_id)+'</span>':'')+'</header>'+(row.sourceError?'<p class="prd-warning">'+h(row.sourceError)+'</p>':'')+(row.mappingNotice?'<p>'+h(row.mappingNotice)+'</p>':'')+content+(['image','image_replace'].includes(row.kind)&&row.image?'<div class="inline-actions"><a class="btn secondary" download="'+h(row.image.name)+'" href="data:image/png;base64,'+row.image.base64+'">Descargar PNG original</a>'+(row.done?'<a class="btn secondary" target="_blank" rel="noopener" href="'+prestashopStore(state.shop).origin+'/'+h(row.done.record_id)+'-large_default/product.jpg">Ver copia guardada en la tienda</a>':'')+'</div>':'')+(incompleteNotice?'<p class="prd-warning">La ficha tiene etapas pendientes o no tiene fotos. Puedes activarla ahora y completarla después.</p>':'')+'<div class="inline-actions">'+(!row.done?button(state,row,row.attempted?'Comprobar resultado sin repetir':'Guardar esta etapa',row.attempted?'verify':'commit',!canEdit()||!!locked&&!row.attempted)+button(state,row,'Validar esta etapa','prepare',!!locked)+(!row.attempted?button(state,row,'Descartar esta etapa','discard'): ''):'')+'</div>'+(row.prepared&&!row.prepared.can_commit?'<p>Etapa validada para consulta. '+(row.prepared?.missing_permissions?.length?'Faltan permisos de la conexión: '+h(row.prepared.missing_permissions.join(', '))+'.':'Su escritura todavía no está habilitada en el servidor.')+'</p>':'')+'</article>';
 }
 function render(shop,result,plan,source,profile,catalogs){
  const state=session(shop,result,plan,source,profile,catalogs),visible=state.rows.filter(row=>row.kind===state.tab);
  const main=['variation','image','stock','supplier_price','special_price','finish'];
  const tabButton=([key,title])=>button(state,null,title,'tab',false,'data-pr-stage-tab="'+key+'" aria-pressed="'+(state.tab===key)+'" ');
  const available=Object.entries(titles).filter(([key])=>key!=='image_metadata'&&(state.result.existing_product||!['remove_product','remove_image','remove_variation','variation_edit','image_replace'].includes(key)));
  const pending=state.rows.filter(r=>!r.done).length,done=state.rows.length-pending;
  const progress='<div class="prd-save-summary"><span><b>'+h(state.shop==='hortimatic'?'Hortimatic':'NewOldSmok')+'</b> · producto #'+h(result.record_id)+'</span><span>'+pending+' cambios pendientes · '+done+' guardados</span></div>';
  return '<section class="prd-stages">'+progress+'<h5>Cambios en el producto #'+h(result.record_id)+'</h5><p>Elige lo que quieres modificar, completa sus datos y pulsa Guardar. Totus valida el cambio y comprueba la respuesta de la tienda automáticamente. Lo guardado se identifica en verde; lo pendiente todavía no se ha enviado.</p><nav class="prd-stage-tabs" aria-label="Etapas del producto">'+available.filter(([key])=>main.includes(key)).sort(([a],[b])=>main.indexOf(a)-main.indexOf(b)).map(tabButton).join('')+'</nav><details class="prd-stage-advanced" '+(!main.includes(state.tab)?'open':'')+'><summary>Más acciones: atributos, fotos por combinación y eliminación</summary><nav class="prd-stage-tabs">'+available.filter(([key])=>!main.includes(key)).map(tabButton).join('')+'</nav></details>'+button(state,null,'Consultar atributos, proveedores y monedas','load')+(!Object.keys(state.catalogs).length?'<p>Consulta primero los catálogos de la tienda para seleccionar registros por su nombre.</p>':'')+(state.tab==='image'&&source.__sourceStore&&String(source.id)!==String(result.record_id)&&associationIds(source,'images').length?button(state,null,'Copiar galería de origen a revisión','import-images',false)+'<p>Prepara las fotos de origen como etapas locales. Revisa cada imagen antes de guardarla; no copia existencias ni publica el producto.</p>':'')+'<div class="prd-stage-rows">'+(visible.length?visible.map(row=>rowForm(state,row)).join(''):'<p class="prd-stage-empty">No hay cambios de '+h(titles[state.tab].toLocaleLowerCase('es'))+' preparados. Usa Añadir para empezar. Los datos existentes se consultan en la ficha del producto.</p>')+'</div>'+((state.tab.startsWith('remove_')||['image_metadata','image_replace'].includes(state.tab))?'<p>Selecciona la imagen o combinación desde su ficha para preparar esta acción.</p>':button(state,null,'Añadir '+titles[state.tab].toLocaleLowerCase('es'),'add',state.tab==='finish'&&visible.some(row=>!row.done),'data-pr-stage-kind="'+state.tab+'" '))+'</section>';
 }
 function handleChange(el){
  const found=rows.get(el?.dataset?.prStageRow);if(!found)return false;
  const {row}=found;if(row.attempted||row.done)return true;
  const field=el.dataset.prStageField;
  if(field){if(el.dataset.prStageLanguage){const translation=row.fields[field]?.find(t=>t.language_id===el.dataset.prStageLanguage);if(translation)translation.value=el.value;}else if(Object.hasOwn(row.fields,field)){row.fields[field]=el.value;if(row.kind==='stock'&&field==='id_product_attribute'){const matches=(found.state.catalogs.productStock||[]).filter(s=>String(s.id_product_attribute)===el.value);if(matches.length!==1){row.stockError='Consulta las existencias actuales antes de elegir este registro.';row.fields.quantity='';delete row.prepared;return true;}row.stockError=null;for(const key of ['quantity','out_of_stock','depends_on_stock','location'])row.fields[key]=String(matches[0][key]??(key==='location'?'':'0'));row.aggregate=el.value==='0'&&(associationIds(found.state.source,'combinations').length>0||found.state.rows.some(r=>r.kind==='variation'&&r.done));}}}
  else if(el.dataset.prStageAttributes){row.attributes=Array.from(el.selectedOptions).map(o=>o.value);row.attributesChosen=true;}
  else if(el.dataset.prStageRemoveConfirm){row.removeConfirm=el.value;return true;}
  else if(el.dataset.prStageVariantRecord)row.recordId=el.value;
  else if(el.dataset.prStageImages)row.imageIds=Array.from(el.selectedOptions).map(o=>o.value);
  else if(el.dataset.prStageRemoveBackground)row.removeBackground=el.checked;
  else if(el.dataset.prStagePresentation){row.presentation??={};row.presentation[el.dataset.prStagePresentation]=el.value;}
  else return false;
  delete row.prepared;return true;
 }
 async function handleFile(el){
  const found=rows.get(el.dataset.prStageRow),file=el.files?.[0];if(!found||!file)return 'No se ha seleccionado una imagen.';
  if(found.row.attempted||found.row.done)throw Error('No se cambia una imagen con carga iniciada.');
  if(!found.state.catalogs.image_types){const all=[];for(let page=0;;page++){const response=await invoke(found.state.shop,'prestashop_read',{resource:'image_types',page,page_size:100});if(!Array.isArray(response.rows))throw Error('No se pudieron consultar los tamaños de imagen de la tienda.');all.push(...response.rows);if(!response.possibly_more)break;if(!response.rows.length||page>=1000)throw Error('Tamaños de imagen incompletos.');}found.state.catalogs.image_types=all;}
 const types=found.state.catalogs.image_types.filter(t=>String(t.products)==='1'&&Number.isSafeInteger(Number(t.width))&&Number.isSafeInteger(Number(t.height))&&Number(t.width)>0&&Number(t.height)>0&&Number(t.width)*Number(t.height)<=4194304).sort((a,b)=>Number(b.width)*Number(b.height)-Number(a.width)*Number(a.height));
 const type=types.find(t=>t.name==='large_default')||types[0];if(!type)throw Error('La tienda no ofrece un tamaño de producto verificable de hasta 4 megapíxeles. Revisa sus tipos de imagen.');
 delete found.row.sourceError;found.row.image=await normalizeProductImage(file,{removeBackground:found.row.removeBackground,canvasSize:{width:Number(type.width),height:Number(type.height)}});found.row.image.name=found.state.shop+'-'+found.row.image.name.replace(/\.png$/i,'').slice(0,100)+'.png';found.row.imageSize={name:textValue(type.name),width:Number(type.width),height:Number(type.height)};delete found.row.prepared;
  return 'Imagen preparada con transparencia. Valida y guarda la carga.';
 }
 function values(state,row){
  const base={parent_request_id:state.result.request_id,product_id:state.result.record_id,kind:row.kind,step_key:row.id,...(['variation_edit','remove_product','remove_variation','remove_image','image_metadata','image_replace'].includes(row.kind)?{record_id:row.recordId}:{}),...(state.result.existing_product?{existing_product:true}:{})};
  if(['image','image_replace'].includes(row.kind)){if(!row.image)throw Error('Carga una imagen sin fondo.');return {...base,image:row.image};}
  return {...base,fields:Object.fromEntries(Object.entries(row.fields).filter(([key,value])=>!(['available_date','id_default_image','id_default_combination'].includes(key)&&value==='')).map(([key,value])=>[key,Array.isArray(value)?value:productInputValue(key,value)])),...(row.kind==='variation_edit'?{associations:{images:row.imageIds}}:{}),...(row.kind==='finish'&&row.organization?{associations:row.organization}:{}),...(row.kind==='variation'?{associations:{product_option_values:row.attributes,...(row.imageIds.length?{images:row.imageIds}:{})}}:{})};
 }
 async function perform(action,shop,result,plan,source,profile,catalogs,detail={}){
  const state=session(shop,result,plan,source,profile,catalogs);
  if(action==='stage-tab'){if(Object.hasOwn(titles,detail.tab))state.tab=detail.tab;return 'Etapa: '+titles[state.tab]+'.';}
  if(action==='stage-import-images'){
   const sourceStore=source.__sourceStore;if(!['hortimatic','newoldsmok'].includes(sourceStore))throw Error('Selecciona una tienda de origen válida.');if(String(source.id)===String(result.record_id)&&sourceStore===shop)throw Error('Elige otro producto para copiar sus fotos.');state.tab='image';let imported=0;
   for(const id of associationIds(source,'images')){
    const key=sourceStore+'|'+source.id+'|'+id;let row=state.rows.find(r=>r.sourceImageKey===key);if(row?.image||row?.attempted||row?.done)continue;
    if(!row){row=add(state,'image');row.sourceImageKey=key;}
    try{const response=await invoke(sourceStore,'prestashop_item_read',{resource:'images',record_id:id,product_id:String(source.id)}),photo=response.item;if(String(photo?.id)!==id||String(photo.id_product)!==String(source.id)||!['image/png','image/jpeg','image/webp','image/gif'].includes(photo.mime)||typeof photo.base64!=='string'||photo.base64.length>11184812)throw Error('Imagen de origen no verificable.');
     const bytes=Uint8Array.from(atob(photo.base64),c=>c.charCodeAt(0)),file=new File([bytes],'producto-'+source.id+'-'+id,{type:photo.mime});await handleFile({dataset:{prStageRow:row.id},files:[file]});delete row.sourceError;imported++;
    }catch(error){row.sourceError=String(error.message||error);throw Error('Foto #'+id+': '+row.sourceError+' Las etapas ya preparadas se conservan; no se ha subido ninguna foto.');}
   }
   return imported+' fotos preparadas desde '+sourceStore+'. Revisa y guarda cada etapa en '+shop+'.';
  }
  if(action==='stage-add'){
   const kind=detail.kind;if(!Object.hasOwn(titles,kind))throw Error('Etapa desconocida.');
   if(detail.finishFields||detail.finishAssociations){
    if(kind!=='finish'||!state.result.existing_product||Object.keys(detail.finishFields||{}).some(key=>!['id_default_image','id_default_combination','id_category_default','id_manufacturer','id_supplier','id_tax_rules_group'].includes(key)))throw Error('Selección de portada o combinación no válida.');
    for(const [key,value]of Object.entries(detail.finishFields||{}))if(['id_default_image','id_default_combination'].includes(key)&&!associationIds(source,key==='id_default_image'?'images':'combinations').includes(String(value)))throw Error('La selección no pertenece a este producto.');
    const pending=state.rows.find(row=>row.kind==='finish'&&!row.attempted&&!row.done);
    if(pending){Object.assign(pending.fields,detail.finishFields);if(detail.finishAssociations)pending.organization=structuredClone(detail.finishAssociations);delete pending.prepared;return 'Selección añadida a la revisión pendiente. Valida y guarda para aplicarla.';}
   }
   if(kind.startsWith('remove_')&&kind!=='remove_product'&&!associationIds(source,kind==='remove_image'?'images':'combinations').includes(String(detail.record_id)))throw Error('Selecciona un registro perteneciente a este producto.');
   if(['image_metadata','image_replace'].includes(kind)&&!associationIds(source,'images').includes(String(detail.record_id)))throw Error('La imagen no pertenece a este producto.');
   const row=add(state,kind);if(kind==='image_replace')row.recordId=String(detail.record_id);
   if(['attribute_group','attribute_value'].includes(kind))for(const key of kind==='attribute_group'?['name','public_name']:['name'])row.fields[key]=(profile.language_ids||[]).map(language_id=>({language_id,value:''}));
   if(kind==='variation'){row.fields.wholesale_price=textValue(source.wholesale_price)||'0';if(!state.result.existing_product&&!state.rows.some(r=>r!==row&&r.kind==='variation'))row.fields.default_on='1';}
   if(kind==='remove_product'){if(String(detail.record_id)!==String(source.id))throw Error('Selecciona este mismo producto.');row.recordId=String(detail.record_id);}
   if(kind.startsWith('remove_')&&kind!=='remove_product'){const members=associationIds(source,kind==='remove_image'?'images':'combinations');if(!members.includes(String(detail.record_id)))throw Error('Selecciona un registro perteneciente a este producto.');row.recordId=String(detail.record_id);}
   if(kind==='image_metadata'){if(!associationIds(source,'images').includes(String(detail.record_id)))throw Error('La imagen no pertenece al producto.');row.recordId=String(detail.record_id);row.fields.position=String(detail.position);if(detail.editLegend){const languages=profile.language_ids||[];if(!Array.isArray(detail.legend)&&languages.length!==1)throw Error('No se pudieron verificar todos los idiomas de la imagen.');row.fields.legend=languages.map(language_id=>{const value=Array.isArray(detail.legend)?detail.legend.find(t=>String(t.id??t.language_id)===language_id)?.value:detail.legend;if(value===undefined)throw Error('Falta la leyenda del idioma '+language_id+'.');return {language_id,value:textValue(value)};});}}
   if(kind==='variation_edit'){if(detail.variant_id&&!associationIds(source,'combinations').includes(String(detail.variant_id)))throw Error('La combinación no pertenece a este producto.');row.recordId=detail.variant_id||'';row.imageIds=detail.imageIds||[];}
   if(kind==='stock'){
    const stock=[];for(let page=0;;page++){const response=await invoke(shop,'prestashop_read',{resource:'stock_availables',product_ids:[String(result.record_id)],page,page_size:100});if(!Array.isArray(response.rows)||response.rows.some(r=>String(r.id_product)!==String(result.record_id)))throw Error('Existencias no verificables para este producto.');stock.push(...response.rows);if(!response.possibly_more)break;if(!response.rows.length||page>=1000)throw Error('Existencias incompletas.');}
    state.catalogs.productStock=stock.filter(r=>!source.id_shop_default||['0',String(source.id_shop_default)].includes(String(r.id_shop)));
    const selected=String(detail.stockFields?.id_product_attribute||'0');if(!['0',...associationIds(source,'combinations')].includes(selected)&&!state.rows.some(r=>r.kind==='variation'&&String(r.done?.record_id)===selected))throw Error('Las existencias no pertenecen a este producto.');
    const matches=state.catalogs.productStock.filter(r=>String(r.id_product_attribute)===selected);if(matches.length!==1)throw Error('No se ha encontrado un registro único de existencias de esta tienda.');
    row.fields.id_product_attribute=selected;for(const key of ['quantity','out_of_stock','depends_on_stock','location'])row.fields[key]=String(matches[0][key]??(key==='location'?'':'0'));
    row.aggregate=selected==='0'&&(associationIds(source,'combinations').length>0||state.rows.some(r=>r.kind==='variation'&&r.done));
   }
   if(kind==='supplier_price'){row.fields.id_supplier=String(catalogs?.selected_supplier_id||'');row.fields.id_currency=String(state.catalogs.currencies?.[0]?.id||'');}
   if(kind==='finish'&&(detail.finishFields||detail.finishAssociations)){row.metadataOnly=true;row.fields={...(detail.finishFields||{})};if(detail.finishAssociations)row.organization=structuredClone(detail.finishAssociations);}
   else if(kind==='finish'){
    if(state.result.existing_product){for(const field of ['active','available_for_order','visibility'])row.fields[field]=textValue(source[field]);row.fields.id_default_combination=textValue(source.id_default_combination);}
    for(const field of ['description','description_short'])row.fields[field]=(profile.language_ids||[]).map(language_id=>({language_id,value:Array.isArray(source[field])?textValue(source[field].find(t=>String(t.id??t.language_id)===String(language_id))?.value):textValue(source[field])}));
    row.presentation={title:textValue(source.name)||'Producto',intro:textValue(source.description_short).replace(/<[^>]+>/g,' ').trim()||'',detailTitle:'Diseño y detalles',detailText:'',specifications:['reference','weight','width','height','depth','ean13'].filter(key=>textValue(source[key])).map(key=>(labels[key]||key)+': '+textValue(source[key])).join('\n'),box:'',notice:''};
    if(detail.finishFields)Object.assign(row.fields,detail.finishFields);if(detail.finishAssociations)row.organization=structuredClone(detail.finishAssociations);
   }
   return 'Etapa añadida. Completa sus datos y valida antes de guardar.';
  }
  if(action==='stage-load'){
   for(const resource of ['product_options','product_option_values','suppliers','currencies']){
    if(state.catalogs[resource])continue;const all=[],seen=new Set();let page=0;
    while(true){const response=await invoke(shop,'prestashop_read',{resource,page,page_size:100,sort:'oldest'});if(response.resource!==resource||!Array.isArray(response.rows))throw Error('Catálogo de '+resource+' no verificable.');for(const row of response.rows){if(seen.has(String(row.id)))throw Error('El catálogo devuelve filas repetidas.');seen.add(String(row.id));all.push(row);}if(!response.possibly_more)break;if(!response.rows.length||++page>1000)throw Error('Catálogo incompleto.');}
    state.catalogs[resource]=all;
   }
   for(const row of state.rows)if(row.kind==='variation'&&row.sourceAttributes?.length&&!row.attributesChosen&&!row.attempted&&!row.done){const mapped=mapVariantAttributes(row.sourceAttributes,state.catalogs.product_options||[],state.catalogs.product_option_values||[]);row.attributes=mapped.ids;row.mappingNotice=mapped.complete?'Atributos de destino preparados por nombre de grupo y valor.':'Revisa los atributos: falta una correspondencia única en esta tienda.';}
   return 'Atributos, proveedores y monedas consultados en '+shop+'.';
  }
  const found=rows.get(detail.row);if(!found||found.state!==state)throw Error('La etapa no corresponde a este producto.');const row=found.row;
  if(action==='stage-discard'){if(row.attempted||row.done)throw Error('Conserva esta etapa para comprobar su resultado en la tienda.');state.rows=state.rows.filter(r=>r!==row);rows.delete(row.id);return 'Etapa sin enviar descartada. La tienda no se ha modificado.';}
  if(action==='stage-description'){
   const pictures=state.rows.filter(r=>r.kind==='image'&&r.done).map(image=>({id:image.done.record_id,alt:row.presentation?.title||textValue(source.name)}));
   const built=buildVisualProductDescription({store:shop,...row.presentation,images:pictures});
   for(const field of ['description','description_short'])row.fields[field]=(profile.language_ids||[]).map(language_id=>({language_id,value:built[field]}));
   delete row.prepared;return 'Descripción y resumen visuales preparados. Puedes editar el texto antes de validarlos.';
  }
  if(action==='stage-prepare'){if(row.stockError)throw Error(row.stockError);
   if(row.attempted)throw Error('Comprueba el resultado de la etapa iniciada; no cambies sus datos.');
   const args=values(state,row),response=await invoke(shop,'prestashop_product_step_prepare',args);
   if(response.persisted!==false||!/^[a-f0-9]{64}$/.test(response.fingerprint||''))throw Error('Validación de etapa no verificable.');row.prepared={...response,values:structuredClone(args)};return 'Etapa validada sin escribir.';
  }
  if(['stage-commit','stage-verify'].includes(action)){
   if(!canEdit()||row.done)throw Error('No puedes guardar este cambio.');
   if(!row.prepared&&!row.attempted)await perform('stage-prepare',shop,result,plan,source,profile,catalogs,{...detail,row:row.id});
   if(!row.prepared?.can_commit)throw Error('La conexión no permite guardar este cambio. Revisa sus permisos.');
   if(row.kind.startsWith('remove_')&&row.removeConfirm!=='ELIMINAR '+row.recordId)throw Error('Escribe ELIMINAR '+row.recordId+' para confirmar este borrado definitivo.');
   row.attempted=true;const response=await invoke(shop,'prestashop_product_step_commit',{...row.prepared.values,expected_fingerprint:row.prepared.fingerprint,confirmed:true});
   if(response.persisted!==true||response.verified!==true||!/^[1-9]\d{0,14}$/.test(String(response.record_id)))throw Error('Resultado de etapa no verificado.');row.done=response;
   if(row.kind==='finish'&&Object.hasOwn(row.fields,'active'))state.result.active=row.fields.active==='1';
   if(['attribute_group','attribute_value'].includes(row.kind)){const resource=row.kind==='attribute_group'?'product_options':'product_option_values';delete state.catalogs[resource];try{await perform('stage-load',shop,result,plan,source,profile,state.catalogs);}catch{return titles[row.kind]+' guardado y verificado. Pulsa Consultar atributos para actualizar los selectores.';}}
   return titles[row.kind]+' guardado y verificado en '+shop+' · #'+response.record_id+'.'+(response.native_html_normalized?' La tienda ha adaptado el formato HTML anterior; textos e imágenes comprobados.':'');
  }
  throw Error('Acción de etapa desconocida.');
 }
 return {removed:shop=>[...sessions.values()].some(s=>s.shop===shop&&s.rows.some(r=>r.kind==='remove_product'&&r.done?.deleted===true)),render,perform,handleChange,handleFile,snapshot:()=>[...sessions],restore:data=>{sessions.clear();rows.clear();for(const [key,state] of data||[]){sessions.set(key,state);for(const row of state.rows)rows.set(row.id,{state,row});}},reset:()=>{sessions.clear();rows.clear();}};
}
