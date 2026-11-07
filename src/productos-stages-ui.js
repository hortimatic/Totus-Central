import {esc} from './utils.js';
import {textValue,productInputValue,associationIds} from './productos-core.js';
import {fieldHelp} from './components.js';
import {normalizeProductImage} from './productos-image-editor.js';
import {prestashopStore} from './prestashop-readonly.js';
import {buildVisualProductDescription} from './productos-description.js';
const h=v=>esc(String(v??''));
const titles={variation:'Combinaciones',stock:'Existencias',supplier_price:'Precios de proveedor',special_price:'Ofertas y precios especiales',image:'Imágenes',finish:'Revisión y publicación'};
const labels={reference:'Referencia',ean13:'EAN-13',upc:'UPC',isbn:'ISBN',mpn:'Referencia fabricante',supplier_reference:'Referencia proveedor',price:'Precio / impacto sin impuestos',wholesale_price:'Coste sin impuestos',weight:'Impacto de peso',ecotax:'Ecotasa',unit_price_impact:'Impacto de precio por unidad',minimal_quantity:'Cantidad mínima de venta',low_stock_threshold:'Umbral de pocas existencias',low_stock_alert:'Aviso de pocas existencias',default_on:'Combinación predeterminada',available_date:'Fecha de disponibilidad',id_product_attribute:'Producto o combinación',quantity:'Unidades',out_of_stock:'Pedidos sin existencias',depends_on_stock:'Gestión avanzada de existencias',location:'Ubicación',id_supplier:'Proveedor',id_currency:'Moneda',product_supplier_reference:'Referencia del proveedor',product_supplier_price_te:'Precio del proveedor sin impuestos',from_quantity:'Desde esta cantidad',reduction:'Reducción (importe o fracción)',reduction_tax:'Reducción con impuestos',reduction_type:'Tipo de reducción',from:'Inicio (AAAA-MM-DD HH:MM:SS)',to:'Fin (AAAA-MM-DD HH:MM:SS)',active:'Producto activo',available_for_order:'Se permite comprar',visibility:'Visibilidad',id_default_image:'Imagen de portada',id_default_combination:'Combinación predeterminada',id_shop:'Tienda (0: todas)',id_shop_group:'Grupo de tiendas (0: todos)',id_country:'País (0: todos)',id_group:'Grupo de clientes (0: todos)',id_customer:'Cliente concreto (0: todos)',id_cart:'Carrito concreto (0: todos)'};
const defaults={
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
   for(const variant of plan.variants||[]){const row=add(state,'variation');for(const change of variant.changes||[])row.fields[change.field]=textValue(change.after);}
   if(state.rows.length){state.tab='variation';state.rows[0].fields.default_on='1';}
  }
  state.profile=profile;state.catalogs={...state.catalogs,...catalogs};return state;
 }
 function add(state,kind){
  const row={id:crypto.randomUUID().replaceAll('-',''),kind,fields:{...defaults[kind]},attributes:[],imageIds:[],image:null,removeBackground:true};
  state.rows.push(row);rows.set(row.id,{state,row});return row;
 }
 const button=(state,row,label,action,disabled=false,extra='')=>'<button type="button" class="btn secondary" data-pr-action="create-stage-'+action+'" data-pr-dest="'+h(state.shop)+'" '+(row?'data-pr-stage-row="'+row.id+'" ':'')+extra+(disabled?' disabled':'')+'>'+h(label)+'</button>';
 function input(state,row,key){
  const value=row.fields[key],locked=row.attempted||row.done;
  const data='data-pr-stage-field="'+h(key)+'" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'');
  const combinationRows=[...new Map([
   ...associationIds(state.source,'combinations').map(id=>[id,{id,name:'Combinación #'+id}]),
   ...state.rows.filter(r=>r.kind==='variation'&&r.done).map(r=>[String(r.done.record_id),{id:String(r.done.record_id),name:r.fields.reference}])
  ]).values()];
  let options=null;
  if(key==='id_product_attribute')options=[{id:'0',name:'Producto base / todas'},...combinationRows];
  if(key==='id_default_combination')options=combinationRows;
  if(key==='id_supplier')options=state.catalogs.suppliers||[];
  if(key==='id_currency')options=[...(row.kind==='special_price'?[{id:'0',name:'Todas las monedas'}]:[]),...(state.catalogs.currencies||[]).map(r=>({...r,name:textValue(r.name)+' · '+r.iso_code}))];
  if(key==='id_default_image')options=[...associationIds(state.source,'images').map(id=>({id,name:'Imagen existente #'+id})),...state.rows.filter(r=>r.kind==='image'&&r.done).map((r,i)=>({id:r.done.record_id,name:'Imagen '+(i+1)+' · '+r.image.name}))];
  const enums={active:[['0','Inactivo'],['1','Activo']],available_for_order:[['0','No comprable'],['1','Comprable']],visibility:[['none','Oculto'],['both','Catálogo y búsqueda'],['catalog','Catálogo'],['search','Búsqueda']],out_of_stock:[['0','Denegar'],['1','Permitir'],['2','Preferencia de la tienda']],depends_on_stock:[['0','Existencias normales']],default_on:[['0','No'],['1','Sí']],low_stock_alert:[['0','No'],['1','Sí']],reduction_tax:[['0','Sin impuestos'],['1','Con impuestos']],reduction_type:[['percentage','Porcentaje: 0,10 equivale al 10 %'],['amount','Importe fijo']]};
  if(enums[key])options=enums[key].map(([id,name])=>({id,name}));
  return '<label class="prd-field"><b>'+h(labels[key]||key)+'</b>'+fieldHelp(labels[key]||key,key==='reduction'?'En porcentaje usa una fracción: 0,10 significa el 10 %. En importe fijo indica el descuento monetario.':key==='price'?'En una variación es el impacto sobre el precio base, sin impuestos. En un precio especial, -1 conserva el precio normal.':'Este dato se guarda en la tienda seleccionada y se comprueba por relectura. Los importes aceptan coma o punto decimal.')+(options?'<select '+data+'><option value="">Seleccionar</option>'+options.map(option=>'<option value="'+h(option.id)+'" '+(String(option.id)===String(value)?'selected':'')+'>'+h(textValue(option.name))+'</option>').join('')+'</select>':'<input '+data+' value="'+h(value)+'" '+(key.includes('price')||key==='reduction'?'inputmode="decimal"':'')+'>')+'</label>';
 }
 function rowForm(state,row){
  const locked=row.attempted||row.done;
  let content='';
  if(row.kind==='image')content='<label class="prd-field"><b>Archivo de producto</b><input type="file" accept="image/*" data-pr-stage-file="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'></label><label class="prd-stage-check"><input type="checkbox" data-pr-stage-remove-background="true" data-pr-stage-row="'+row.id+'" '+(row.removeBackground?'checked':'')+' '+(locked?'disabled':'')+'> Quitar fondo uniforme al cargar</label><p>Se comprueba transparencia real. PrestaShop puede convertir sus copias a otro formato. No se envía la foto a servicios externos.</p>'+(row.image?'<img class="prd-stage-image" src="data:image/png;base64,'+row.image.base64+'" alt="Vista previa de '+h(row.image.name)+'">':'');
  else{
   content='<div class="prd-fields-grid">'+Object.keys(row.fields).filter(k=>!['description','description_short'].includes(k)).map(key=>input(state,row,key)).join('')+'</div>';
   if(row.kind==='variation')content+='<label class="prd-field"><b>Atributos de esta combinación</b><select multiple size="5" data-pr-stage-attributes="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+((state.catalogs.product_options||[]).map(group=>'<optgroup label="'+h(textValue(group.public_name)||textValue(group.name))+'">'+(state.catalogs.product_option_values||[]).filter(v=>String(v.id_attribute_group)===String(group.id)).map(value=>'<option value="'+h(value.id)+'" '+(row.attributes.includes(String(value.id))?'selected':'')+'>'+h(textValue(value.name))+'</option>').join('')+'</optgroup>').join(''))+'</select><small>Elige un valor de cada atributo. El servidor verifica la pertenencia a sus grupos.</small></label><label class="prd-field"><b>Imágenes de esta combinación</b><select multiple size="3" data-pr-stage-images="true" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+state.rows.filter(r=>r.kind==='image'&&r.done).map(image=>'<option value="'+h(image.done.record_id)+'" '+(row.imageIds.includes(String(image.done.record_id))?'selected':'')+'>'+h(image.image.name)+'</option>').join('')+'</select><small>Guarda primero las imágenes que quieras asociar. Si no eliges ninguna se usa la galería general.</small></label>';
   if(row.kind==='finish'){
    content+='<p>La ficha permanece inactiva hasta esta revisión. Puedes activarla y dejar «Se permite comprar» en No para revisar una muestra sin vender existencias ficticias.</p><fieldset class="prd-relationships"><legend>Constructor de descripción visual</legend><div class="prd-fields-grid">'+[['title','Título'],['intro','Introducción / resumen'],['detailTitle','Título del bloque de detalles'],['detailText','Detalles y ventajas'],['specifications','Especificaciones (campo: valor, una por línea)'],['box','Contenido y cuidados'],['notice','Aviso o información final']].map(([key,label])=>'<label class="prd-field"><b>'+h(label)+'</b><textarea rows="3" data-pr-stage-presentation="'+key+'" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+h(row.presentation?.[key]||'')+'</textarea></label>').join('')+'</div>'+button(state,row,'Preparar descripción visual con las imágenes guardadas','description',!!locked)+'</fieldset><details><summary>Editar el HTML por idioma (avanzado)</summary>';
    for(const field of ['description_short','description'])for(const translation of row.fields[field]||[])content+='<label class="prd-field"><b>'+h(field==='description'?'Descripción completa':'Resumen')+' · idioma '+h(translation.language_id)+'</b><textarea rows="6" data-pr-stage-field="'+field+'" data-pr-stage-language="'+h(translation.language_id)+'" data-pr-stage-row="'+row.id+'" '+(locked?'disabled':'')+'>'+h(translation.value)+'</textarea></label>';
    content+='</details>';
   }
  }
  const otherPending=state.rows.some(r=>r!==row&&!r.done);
  const lacksImage=!(state.result.existing_product&&associationIds(state.source,'images').length)&&!state.rows.some(r=>r.kind==='image'&&r.done);
  const activating=row.kind==='finish'&&row.fields.active==='1'&&(!state.result.existing_product||textValue(state.source.active)!=='1');
  const publishBlocked=activating&&(otherPending||lacksImage);
  return '<article class="prd-stage-row"><header><h5>'+h(titles[row.kind])+' '+(row.done?'· guardado y verificado':'· pendiente')+'</h5>'+(row.done?'<span>#'+h(row.done.record_id)+'</span>':'')+'</header>'+content+(row.kind==='image'&&row.image?'<div class="inline-actions"><a class="btn secondary" download="'+h(row.image.name)+'" href="data:image/png;base64,'+row.image.base64+'">Descargar PNG original</a>'+(row.done?'<a class="btn secondary" target="_blank" rel="noopener" href="'+prestashopStore(state.shop).origin+'/'+h(row.done.record_id)+'-large_default/product.jpg">Ver copia guardada en la tienda</a>':'')+'</div>':'')+(publishBlocked?'<p class="prd-warning">Completa las etapas pendientes y guarda al menos una imagen antes de activar el producto.</p>':'')+'<div class="inline-actions">'+(!row.done?button(state,row,'Validar esta etapa','prepare',!!locked)+button(state,row,row.attempted?'Comprobar resultado sin repetir':'Guardar esta etapa',row.attempted?'verify':'commit',!canEdit()||!row.prepared?.can_commit||publishBlocked):'')+'</div>'+(row.prepared&&!row.prepared.can_commit?'<p>Etapa validada para consulta. Su escritura todavía no está habilitada en el servidor.</p>':'')+'</article>';
 }
 function render(shop,result,plan,source,profile,catalogs){
  const state=session(shop,result,plan,source,profile,catalogs),visible=state.rows.filter(row=>row.kind===state.tab);
  return '<section class="prd-stages"><h5>Completar el producto #'+h(result.record_id)+'</h5><p>La base está guardada. Cada etapa siguiente se guarda y se comprueba en la tienda, sin repetir creaciones cuando se pierde una respuesta.</p><nav class="prd-stage-tabs" aria-label="Etapas del producto">'+Object.entries(titles).map(([key,title])=>button(state,null,title,'tab',false,'data-pr-stage-tab="'+key+'" aria-pressed="'+(state.tab===key)+'" ')).join('')+'</nav>'+button(state,null,'Consultar atributos, proveedores y monedas','load')+(!Object.keys(state.catalogs).length?'<p>Consulta primero los catálogos de la tienda para seleccionar registros por su nombre.</p>':'')+'<div class="prd-stage-rows">'+visible.map(row=>rowForm(state,row)).join('')+'</div>'+button(state,null,'Añadir '+titles[state.tab].toLocaleLowerCase('es'),'add',state.tab==='finish'&&visible.length>0,'data-pr-stage-kind="'+state.tab+'" ')+'</section>';
 }
 function handleChange(el){
  const found=rows.get(el?.dataset?.prStageRow);if(!found)return false;
  const {row}=found;if(row.attempted||row.done)return true;
  const field=el.dataset.prStageField;
  if(field){if(el.dataset.prStageLanguage){const translation=row.fields[field]?.find(t=>t.language_id===el.dataset.prStageLanguage);if(translation)translation.value=el.value;}else if(Object.hasOwn(row.fields,field))row.fields[field]=el.value;}
  else if(el.dataset.prStageAttributes)row.attributes=Array.from(el.selectedOptions).map(o=>o.value);
  else if(el.dataset.prStageImages)row.imageIds=Array.from(el.selectedOptions).map(o=>o.value);
  else if(el.dataset.prStageRemoveBackground)row.removeBackground=el.checked;
  else if(el.dataset.prStagePresentation){row.presentation??={};row.presentation[el.dataset.prStagePresentation]=el.value;}
  else return false;
  delete row.prepared;return true;
 }
 async function handleFile(el){
  const found=rows.get(el.dataset.prStageRow),file=el.files?.[0];if(!found||!file)return 'No se ha seleccionado una imagen.';
  if(found.row.attempted||found.row.done)throw Error('No se cambia una imagen con carga iniciada.');
  found.row.image=await normalizeProductImage(file,{removeBackground:found.row.removeBackground});delete found.row.prepared;
  return 'Imagen preparada con transparencia. Valida y guarda la carga.';
 }
 function values(state,row){
  const base={parent_request_id:state.result.request_id,product_id:state.result.record_id,kind:row.kind,step_key:row.id,...(state.result.existing_product?{existing_product:true}:{})};
  if(row.kind==='image'){if(!row.image)throw Error('Carga una imagen sin fondo.');return {...base,image:row.image};}
  return {...base,fields:Object.fromEntries(Object.entries(row.fields).filter(([key,value])=>!(['available_date','id_default_image','id_default_combination'].includes(key)&&value==='')).map(([key,value])=>[key,Array.isArray(value)?value:productInputValue(key,value)])),...(row.kind==='variation'?{associations:{product_option_values:row.attributes,...(row.imageIds.length?{images:row.imageIds}:{})}}:{})};
 }
 async function perform(action,shop,result,plan,source,profile,catalogs,detail={}){
  const state=session(shop,result,plan,source,profile,catalogs);
  if(action==='stage-tab'){if(Object.hasOwn(titles,detail.tab))state.tab=detail.tab;return 'Etapa: '+titles[state.tab]+'.';}
  if(action==='stage-add'){
   const kind=detail.kind;if(!Object.hasOwn(titles,kind))throw Error('Etapa desconocida.');
   if(detail.finishFields){
    if(kind!=='finish'||!state.result.existing_product||Object.keys(detail.finishFields).some(key=>!['id_default_image','id_default_combination'].includes(key)))throw Error('Selección de portada o combinación no válida.');
    for(const [key,value]of Object.entries(detail.finishFields))if(!associationIds(source,key==='id_default_image'?'images':'combinations').includes(String(value)))throw Error('La selección no pertenece a este producto.');
    const pending=state.rows.find(row=>row.kind==='finish'&&!row.attempted&&!row.done);
    if(pending){Object.assign(pending.fields,detail.finishFields);delete pending.prepared;return 'Selección añadida a la revisión pendiente. Valida y guarda para aplicarla.';}
   }
   const row=add(state,kind);
   if(kind==='variation'){row.fields.wholesale_price=textValue(source.wholesale_price)||'0';if(!state.result.existing_product&&!state.rows.some(r=>r!==row&&r.kind==='variation'))row.fields.default_on='1';}
   if(kind==='supplier_price'){row.fields.id_supplier=String(catalogs?.selected_supplier_id||'');row.fields.id_currency=String(state.catalogs.currencies?.[0]?.id||'');}
   if(kind==='finish'){
    if(state.result.existing_product){for(const field of ['active','available_for_order','visibility'])row.fields[field]=textValue(source[field]);row.fields.id_default_combination=textValue(source.id_default_combination);}
    for(const field of ['description','description_short'])row.fields[field]=(profile.language_ids||[]).map(language_id=>({language_id,value:Array.isArray(source[field])?textValue(source[field].find(t=>String(t.id??t.language_id)===String(language_id))?.value):textValue(source[field])}));
    row.presentation={title:textValue(source.name)||'Producto',intro:textValue(source.description_short).replace(/<[^>]+>/g,' ').trim()||'',detailTitle:'Diseño y detalles',detailText:'',specifications:['reference','weight','width','height','depth','ean13'].filter(key=>textValue(source[key])).map(key=>(labels[key]||key)+': '+textValue(source[key])).join('\n'),box:'',notice:''};
    if(detail.finishFields)Object.assign(row.fields,detail.finishFields);
   }
   return 'Etapa añadida. Completa sus datos y valida antes de guardar.';
  }
  if(action==='stage-load'){
   for(const resource of ['product_options','product_option_values','suppliers','currencies']){
    if(state.catalogs[resource])continue;const all=[],seen=new Set();let page=0;
    while(true){const response=await invoke(shop,'prestashop_read',{resource,page,page_size:100,sort:'oldest'});if(response.resource!==resource||!Array.isArray(response.rows))throw Error('Catálogo de '+resource+' no verificable.');for(const row of response.rows){if(seen.has(String(row.id)))throw Error('El catálogo devuelve filas repetidas.');seen.add(String(row.id));all.push(row);}if(!response.possibly_more)break;if(!response.rows.length||++page>1000)throw Error('Catálogo incompleto.');}
    state.catalogs[resource]=all;
   }
   return 'Atributos, proveedores y monedas consultados en '+shop+'.';
  }
  const found=rows.get(detail.row);if(!found||found.state!==state)throw Error('La etapa no corresponde a este producto.');const row=found.row;
  if(action==='stage-description'){
   const pictures=state.rows.filter(r=>r.kind==='image'&&r.done).map(image=>({id:image.done.record_id,alt:row.presentation?.title||textValue(source.name)}));
   const built=buildVisualProductDescription({store:shop,...row.presentation,images:pictures});
   for(const field of ['description','description_short'])row.fields[field]=(profile.language_ids||[]).map(language_id=>({language_id,value:built[field]}));
   delete row.prepared;return 'Descripción y resumen visuales preparados. Puedes editar el texto antes de validarlos.';
  }
  if(action==='stage-prepare'){
   if(row.attempted)throw Error('Comprueba el resultado de la etapa iniciada; no cambies sus datos.');
   const args=values(state,row),response=await invoke(shop,'prestashop_product_step_prepare',args);
   if(response.persisted!==false||!/^[a-f0-9]{64}$/.test(response.fingerprint||''))throw Error('Validación de etapa no verificable.');row.prepared={...response,values:structuredClone(args)};return 'Etapa validada sin escribir.';
  }
  if(['stage-commit','stage-verify'].includes(action)){
   if(!canEdit()||!row.prepared?.can_commit||row.done)throw Error('La etapa no tiene una validación vigente para guardar.');
   if(row.kind==='finish'&&row.fields.active==='1'&&(!state.result.existing_product||textValue(state.source.active)!=='1')&&(state.rows.some(r=>r!==row&&!r.done)||!(state.result.existing_product&&associationIds(state.source,'images').length)&&!state.rows.some(r=>r.kind==='image'&&r.done)))throw Error('Completa las etapas e imágenes antes de activar el producto.');
   row.attempted=true;const response=await invoke(shop,'prestashop_product_step_commit',{...row.prepared.values,expected_fingerprint:row.prepared.fingerprint,confirmed:true});
   if(response.persisted!==true||response.verified!==true||!/^[1-9]\d{0,14}$/.test(String(response.record_id)))throw Error('Resultado de etapa no verificado.');row.done=response;
   if(row.kind==='finish')state.result.active=row.fields.active==='1';
   return titles[row.kind]+' guardado y verificado en '+shop+' · #'+response.record_id+'.'+(response.native_html_normalized?' La tienda ha adaptado el formato HTML anterior; textos e imágenes comprobados.':'');
  }
  throw Error('Acción de etapa desconocida.');
 }
 return {render,perform,handleChange,handleFile,snapshot:()=>[...sessions],restore:data=>{sessions.clear();rows.clear();for(const [key,state] of data||[]){sessions.set(key,state);for(const row of state.rows)rows.set(row.id,{state,row});}},reset:()=>{sessions.clear();rows.clear();}};
}
