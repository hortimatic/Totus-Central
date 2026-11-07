import {STITCH_HEADER,STITCH_VIEWS} from './productos-stitch-template.js';
import {PRODUCT_COLUMNS,productPhoto} from './productos-catalog.js';
import {PRODUCT_SECTIONS,VARIANT_FIELDS,textValue,associationIds} from './productos-core.js';
import {esc} from './utils.js';
import {fieldHelp} from './components.js';

// Original Stitch nodes are cloned, rather than approximated with a second layout.
// Demo handlers are removed by the extractor. All actions belong to Productos UI.
const modes=['catalogo','ficha','comparar','encargo','guardado'];
export function ensureStitchProductFonts(){
 for(const [id,href]of [
  ['totus-product-type','https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700&display=swap'],
  ['totus-product-symbols','https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200']
 ])if(!document.getElementById(id)){const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;document.head.append(link);}
}
function fragment(html){const t=document.createElement('template');t.innerHTML=html;return t.content;}
function action(node,name){node.type='button';node.dataset.prAction=name;return node;}
function setText(node,value){if(node)node.textContent=String(value??'');}
function serialize(node){const wrap=document.createElement('div');wrap.append(node);return wrap.innerHTML;}
function label(button,value){const spans=button.querySelectorAll('span');setText(spans[1]||button,value);}
export function stitchHeader({store,mode,status,count,product,pending,connected}){
 const f=fragment(STITCH_HEADER),select=f.querySelector('select');
 select.dataset.prStore='';
 for(const option of select.options)option.toggleAttribute('selected',option.value===store);
 const badges=f.querySelectorAll('.rounded-full');
 setText(badges[0],connected?'Conexión verificada':'Revisar conexión');
 const sandbox=f.querySelector('[title="Entorno Sandbox"]');
 if(sandbox){sandbox.removeAttribute('title');setText(sandbox,connected?'API conectada':'Sin verificar');}
 const tabs=[...f.querySelectorAll('.master-tab-btn')];
 tabs.forEach((b,i)=>{
  action(b,'mode');b.dataset.mode=modes[i];b.disabled=!!pending;
  const active=mode===modes[i]||modes[i]==='ficha'&&['variantes','bulk'].includes(mode);
  b.setAttribute('aria-selected',String(active));
  b.classList.toggle('bg-primary-container',active);b.classList.toggle('text-on-primary',active);
  b.classList.toggle('bg-surface-container',!active);b.classList.toggle('text-on-surface-variant',!active);
  if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  if(i===0)setText(b.querySelector('span:last-child'),count);
  if(i===1)setText(b.querySelector('span:last-child'),product||'Selecciona un producto');
  if(i===3)b.querySelector('span:last-child')?.remove();
  if(i===4)setText(b.querySelector('span:last-child'),product?'1 borrador':'Sin borrador');
 });
 f.querySelector('#master-tabs-bar')?.setAttribute('aria-label','Secciones de Productos');
 const live=document.createElement('p');live.className='font-body-sm text-body-sm text-on-surface-variant';live.setAttribute('role','status');live.textContent=status;
 f.querySelector('section').append(live);
 return serialize(f);
}

export function stitchCatalog({store,rows,columns,selected,query,filters,brands,categories,page,size,hasMore,pending,ready,value,photo,views=[],viewName='',rowKey=p=>String(p.id)}){
 const f=fragment(STITCH_VIEWS['tab-catalogo']),view=f.firstElementChild;
 view.classList.remove('hidden');view.classList.add('flex');
 const summary=view.firstElementChild.firstElementChild.firstElementChild;
 const summarySpans=summary.querySelectorAll('span');
 setText(summarySpans[1],hasMore?'Consulta parcial:':'Productos consultados:');
 setText(summarySpans[2],rows.length+' referencias');
 // No demo totals, fabricated latency or claims of live synchronisation.
 setText(summarySpans[3],'de');setText(summarySpans[4],store==='both'?'Ambas tiendas':store==='hortimatic'?'Hortimatic':'NewOldSmok');
 const connection=summary.lastElementChild;setText(connection,ready?'Conexión verificada':'Conexión pendiente');
 const search=f.querySelector('#catalogo-search-input');search.value=query;search.setAttribute('value',query);search.dataset.prSearch='';
 const fillSelect=(select,key,items,title,current)=>{
  select.replaceChildren();select.dataset.prFilter=key;
  for(const [id,text] of [['',title],...items]){const o=new Option(text,String(id));o.selected=String(id)===current;if(o.selected)o.setAttribute('selected','');select.append(o);}
 };
 fillSelect(f.querySelector('#catalogo-brand-filter'),'brand',brands,'Todas las marcas',filters.brand);
 fillSelect(f.querySelector('#catalogo-category-filter'),'category',categories,'Todas las categorías',filters.category);
 const selects=[...f.querySelectorAll('select')];
 const shop=selects[2];shop.dataset.prStore='';shop.replaceChildren(new Option('Hortimatic','hortimatic'),new Option('NewOldSmok','newoldsmok'),new Option('Ambas tiendas','both'));shop.value=store;shop.querySelector('[value="'+store+'"]')?.setAttribute('selected','');
 fillSelect(selects[3],'active',[['1','Activo'],['0','Inactivo']],'Todos los estados',filters.active);
 const tools=[...f.querySelectorAll('button')];
 const columnsButton=tools[0],details=document.createElement('details');details.className='prd-columns';
 const caption=document.createElement('summary');caption.className=columnsButton.className;caption.textContent='Configurar columnas ('+columns.length+')';details.append(caption);
 const options=document.createElement('div');
 for(const [key,text]of [...columns.map(k=>PRODUCT_COLUMNS.find(c=>c[0]===k)),...PRODUCT_COLUMNS.filter(c=>!columns.includes(c[0]))]){const l=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.prColumn=key;input.checked=columns.includes(key);if(input.checked)input.setAttribute('checked','');input.disabled=key==='name';l.append(input,document.createTextNode(text));if(columns.includes(key)){for(const [direction,symbol]of [[-1,'↑'],[1,'↓']]){const b=document.createElement('button');action(b,'catalog-column-move');b.dataset.prColumnKey=key;b.dataset.prDirection=String(direction);b.textContent=symbol;b.setAttribute('aria-label',(direction<0?'Adelantar ':'Retrasar ')+text);b.disabled=columns.indexOf(key)+(direction)<0||columns.indexOf(key)+(direction)>=columns.length;l.append(b);}}options.append(l);}
 const saved=document.createElement('div');saved.className='prd-column-views';
 saved.innerHTML='<label>Vista guardada<select data-pr-catalog-view><option value="">Personalizada</option>'+views.map(v=>'<option value="'+esc(v.name)+'" '+(viewName===v.name?'selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select></label><label>Nombre de vista<input data-pr-view-name maxlength="60" value="'+esc(viewName)+'" placeholder="Mi catálogo"></label><div><button type="button" data-pr-action="catalog-view-save">Guardar vista</button><button type="button" data-pr-action="catalog-view-delete" '+(!views.some(v=>v.name===viewName)?'disabled':'')+'>Eliminar vista</button><button type="button" data-pr-action="catalog-columns-reset">Restablecer columnas</button></div>';
 options.append(saved);details.append(options);columnsButton.replaceWith(details);
 action(tools[1],'catalog-export');label(tools[1],'Exportar CSV');tools[1].disabled=pending||!rows.length;
 action(tools[2],'catalog-copy');tools[2].disabled=pending||!selected.size;
 action(tools[3],'new-product');label(tools[3],'Nuevo producto');
 const full=f.querySelector('#check-full-catalog');full.dataset.prCatalogLoaded='';full.checked=rows.length>0&&rows.every(r=>selected.has(rowKey(r)));if(full.checked)full.setAttribute('checked','');
 setText(f.querySelector('label[for="check-full-catalog"]'),'Seleccionar todos los productos consultados');
 setText(full.parentElement.parentElement.querySelector('span'),'Seleccionados: '+selected.size);
 const filtered=rows.filter(r=>r.__visible!==false),pages=Math.max(1,Math.ceil(filtered.length/size));
 const visible=filtered.slice(page*size,(page+1)*size);
 const table=f.querySelector('table'),head=table.querySelector('thead tr'),originalCells=[...head.children],body=f.querySelector('tbody'),originalData=[...body.querySelector('tr').children];
 const indexes={image:1,reference:2,name:3,brand:4,category:5,store:6,cost:7,price:8,gross:8,margin:8,stock:9,active:10};
 const hc=k=>originalCells[indexes[k]??2]?.className||'p-space-sm';
 const dc=k=>originalData[indexes[k]??2]?.className||'p-space-sm';
 head.innerHTML='<th class="'+esc(originalCells[0].className)+'"><input type="checkbox" aria-label="Seleccionar página" data-pr-catalog-all '+(visible.length&&visible.every(p=>selected.has(rowKey(p)))?'checked':'')+'></th>'+columns.map(k=>'<th class="'+esc(hc(k))+'">'+esc(PRODUCT_COLUMNS.find(c=>c[0]===k)?.[1]||k)+'</th>').join('')+'<th class="'+esc(originalCells.at(-1).className)+'">Acciones</th>';
 body.innerHTML=visible.map(p=>'<tr><td class="'+esc(originalData[0].className)+'"><input type="checkbox" aria-label="Seleccionar producto '+esc(p.id)+'" data-pr-catalog-select="'+esc(rowKey(p))+'" '+(selected.has(rowKey(p))?'checked':'')+'></td>'+columns.map(k=>'<td class="'+esc(dc(k))+'" data-label="'+esc(PRODUCT_COLUMNS.find(c=>c[0]===k)?.[1]||k)+'">'+(k==='image'?photo(p):k==='name'?'<strong>'+esc(value(p,k))+'</strong><br><small>'+esc(p.reference||'')+'</small>':esc(value(p,k)))+'</td>').join('')+'<td class="'+esc(originalData.at(-1).className)+'"><button type="button" data-pr-action="open-product" data-id="'+esc(p.id)+'" data-pr-shop="'+esc(p.__store||store)+'" class="px-2 py-1 rounded bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">Abrir ficha</button></td></tr>').join('');
 table.parentElement.classList.add('prd-catalog-table');
 const footer=table.parentElement.nextElementSibling;
 if(footer){footer.innerHTML='<span>'+filtered.length+' resultados · página '+(page+1)+' de '+pages+'</span><div class="flex items-center gap-space-sm"><label>Mostrar <select data-pr-page-size>'+[20,50,100].map(n=>'<option '+(size===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label><button type="button" data-pr-action="catalog-prev" '+(page===0?'disabled':'')+'>Anterior</button><button type="button" data-pr-action="catalog-next" '+(page+1>=pages&&!hasMore?'disabled':'')+'>Siguiente</button></div>';}
 return serialize(f);
}

export const STITCH_FICHE_TABS=Object.freeze([
 ['general','sub-info'],['contenido','sub-desc'],['precios','sub-precios'],
 ['variaciones','sub-variaciones'],['imagenes','sub-imagenes'],['seo','sub-seo'],
 ['transporte','sub-envio'],['inventario','sub-stock'],['organizacion','sub-organizacion']
]);
const inputClass='bg-surface-container-low text-on-surface font-body-md text-body-md px-3 py-1.5 rounded shadow-sm focus:outline-none focus:bg-surface-container-lowest w-full';
const labelClass='font-label-md text-label-md text-on-surface-variant';
export function stitchFiche({record,store,section,overrides,variants,variantOverrides,metadata,fieldControl,priceHtml,rawHtml,amounts,brands=[],categories=[],stock=null}){
 const f=fragment(STITCH_VIEWS['tab-ficha']),view=f.firstElementChild;
 view.classList.remove('hidden');view.classList.add('flex');
 setText(f.querySelector('h2'),textValue(overrides.name??record.name)||'Nuevo producto');
 const heading=f.querySelector('h2').parentElement;
 const badges=heading.querySelectorAll('span');setText(badges[0],String(overrides.active??record.active)==='1'?'Activo en PrestaShop':'Inactivo en PrestaShop');setText(badges[1],record.id?'ID: '+record.id:'Borrador');
 setText(heading.nextElementSibling,(store==='hortimatic'?'Hortimatic':'NewOldSmok')+' · SKU: '+textValue(overrides.reference??record.reference)+' · EAN: '+textValue(overrides.ean13??record.ean13));
 for(const b of f.querySelectorAll('button')){
  if(/Guardar Borrador/i.test(b.textContent))action(b,'draft-save');
  if(/Validar|Sincronizar/i.test(b.textContent))action(b,'fiche-validate');
 }
 [...f.querySelectorAll('.subtab-btn')].forEach((b,i)=>{
  action(b,'editor-section');b.dataset.prSection=STITCH_FICHE_TABS[i][0];
  const active=section===STITCH_FICHE_TABS[i][0];
  b.classList.toggle('bg-primary',active);b.classList.toggle('text-on-primary',active);
  b.classList.toggle('bg-surface-container',!active);b.classList.toggle('text-on-surface-variant',!active);
  b.setAttribute('aria-current',active?'page':'false');
 });
 const groups={general:PRODUCT_SECTIONS.general.filter(k=>!['description','description_short'].includes(k)),contenido:['description'],precios:PRODUCT_SECTIONS.precios,seo:PRODUCT_SECTIONS.seo,transporte:PRODUCT_SECTIONS.transporte,inventario:PRODUCT_SECTIONS.inventario};
 const fields=keys=>'<div class="grid grid-cols-2 gap-space-md">'+keys.map(key=>{
  const value=Object.hasOwn(overrides,key)?overrides[key]:textValue(record[key]);
  const help=['price','wholesale_price','ecotax'].includes(key)?'Importe sin impuestos. El coste de PrestaShop es aproximado; los impuestos y el recargo se estudian por separado.':key==='weight'?'Peso en kilogramos; distingue el peso del dispositivo del embalaje.':['width','height','depth'].includes(key)?'Medida en centímetros. Introduce únicamente una medida acreditada.':'Dato de la ficha seleccionada. Se conserva como borrador y solo se envía tras revisar y validar los cambios.';
  return '<label class="flex flex-col gap-space-xs '+(['description','description_short','meta_description'].includes(key)?'col-span-2':'')+'"><span class="'+labelClass+'">'+esc(metadata[key]||key)+fieldHelp(metadata[key]||key,help)+'</span>'+fieldControl(key,value,'class="'+inputClass+'" data-pr-value="'+key+'"')+'</label>';
 }).join('')+'</div>';
 for(const [key,id]of STITCH_FICHE_TABS){
  const panel=f.querySelector('#'+id);panel.classList.toggle('hidden',key!==section);panel.classList.toggle('flex',key===section);
  if(groups[key]){
   const native={general:['name','reference','ean13',null,null,'description_short'],contenido:['description'],seo:['meta_title','meta_description','link_rewrite'],transporte:['weight','width','height','depth'],inventario:[null,'location','available_later']}[key];
   if(!native){
    if(key==='precios'){
     const cost=panel.querySelector('#calc-cost'),margin=panel.querySelector('#calc-margin'),tax=panel.querySelector('#calc-tax'),gross=panel.querySelector('#calc-pvp');
     cost.type='text';cost.inputMode='decimal';cost.value=String(overrides.wholesale_price??record.wholesale_price??'');cost.setAttribute('value',cost.value);cost.dataset.prValue='wholesale_price';cost.setAttribute('aria-label','Coste sin impuestos');
     margin.readOnly=true;margin.value=amounts?.marginPct==null?'':amounts.marginPct.toFixed(2);margin.setAttribute('value',margin.value);margin.setAttribute('aria-label','Margen aproximado calculado');margin.title='Margen calculado a partir del precio y coste; no es beneficio neto.';
     const rate=amounts?.rate;tax.replaceChildren(new Option(rate==null?'Impuesto sin verificar':rate+' % · regla de la tienda',String(rate??'')));tax.disabled=true;tax.setAttribute('aria-label','Impuesto verificado de la tienda');
     gross.type='text';gross.inputMode='decimal';gross.value=amounts?.gross==null?'':amounts.gross.toFixed(2);gross.setAttribute('value',gross.value);gross.dataset.prGross='';gross.step='0.01';gross.min='0';gross.readOnly=amounts?.gross==null;gross.setAttribute('aria-label','PVP base con IVA de España');
     const notices=[...panel.querySelectorAll('div,span')].filter(n=>!n.children.length);
     for(const n of notices){if(n.textContent.includes('Beneficio Neto Estimado')){n.textContent='Margen sin impuestos, aproximado:';setText(n.nextElementSibling,amounts?.margin==null?'Sin coste verificado':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(amounts.margin));}if(n.textContent.includes('PVP Base sin'))setText(n.nextElementSibling,textValue(overrides.price??record.price)||'—');if(n.textContent.includes('Regla de Redondeo'))setText(n.nextElementSibling,'Sin redondeo comercial automático');}
     const extra=document.createElement('details');extra.className='prd-native-extra';extra.innerHTML='<summary class="font-label-md text-label-md">Precio base y campos adicionales</summary>'+fields(groups[key].filter(k=>k!=='wholesale_price'))+priceHtml;panel.append(extra);
    }else panel.innerHTML=fields(groups[key]);continue;
   }
   const used=new Set(),controls=[...panel.querySelectorAll('input,select,textarea')];
   controls.forEach((control,i)=>{
    const field=native[i];
    if(field){const value=Object.hasOwn(overrides,field)?overrides[field]:textValue(record[field]);const replacement=fragment(fieldControl(field,value,'class="'+control.className+'" data-pr-value="'+field+'"')).firstElementChild;replacement.setAttribute('aria-label',metadata[field]||field);const caption=control.parentElement.querySelector(':scope > label');if(caption){caption.querySelectorAll('[title]').forEach(n=>n.remove());replacement.id='prd-fiche-'+field;caption.htmlFor=replacement.id;caption.append(fragment(fieldHelp(metadata[field]||field,field==='weight'?'Peso en kilogramos; distingue dispositivo y embalaje.':field==='description'?'Admite texto y HTML. La vista previa está aislada y no ejecuta scripts.':'Edita el borrador. Los cambios se revisan, validan y guardan antes de enviarlos a la tienda.')));}control.replaceWith(replacement);used.add(field);}
    else if(key==='general'){
     const value=i===3?textValue(brands.find(b=>String(b.id)===String(record.id_manufacturer))?.name)||'Sin marca asignada':variants.length?'Producto con combinaciones':'Producto simple';
     control.replaceChildren(new Option(value,value));control.disabled=true;
    }else if(key==='inventario'){
     const b=document.createElement('button');b.className=control.className;b.type='button';action(b,'stock-stages');b.textContent='Consultar y ajustar existencias';control.replaceWith(b);
    }
   });
   if(key==='contenido'){
    [...panel.querySelectorAll('button')].forEach((b,i)=>{action(b,'description-format');b.dataset.prFormat=['bold','list','plain'][i];});
    const preview=document.createElement('button');preview.className='px-space-md py-space-sm rounded bg-primary-container text-on-primary font-label-md text-label-md';action(preview,'description-preview');preview.textContent='Vista previa';panel.append(preview);
   }
   const extra=groups[key].filter(k=>!used.has(k));
   if(extra.length){const more=document.createElement('details');more.className='prd-native-extra';more.innerHTML='<summary class="font-label-md text-label-md">Más campos de '+esc(({general:'información',contenido:'contenido',seo:'SEO',transporte:'transporte',inventario:'disponibilidad'})[key])+'</summary>'+fields(extra);panel.append(more);}
  }
 }
 // Use the original matrix, populated only with the selected shop's real variants.
 const vPanel=f.querySelector('#sub-variaciones'),addVariant=vPanel.querySelector('button');action(addVariant,record.id?'variation-stages':'new-variant');
 const bulk=addVariant.cloneNode(true);action(bulk,'mode');bulk.dataset.mode='bulk';bulk.textContent='Cambios masivos';addVariant.after(bulk);
 const table=vPanel.querySelector('table'),sample=table.querySelector('tbody tr');
 const cellClass=sample?.querySelector('td')?.className||'p-space-sm';
 table.querySelector('thead tr').innerHTML=['Pred.','Color / Atributo','Referencia','EAN-13','Coste sin IVA','Impacto sin IVA','Peso (kg)','Existencias','Mínimo','Imagen','Borrar'].map(x=>'<th class="p-space-sm">'+esc(x)+'</th>').join('');
 table.querySelector('tbody').innerHTML=variants.map(v=>{
  const id=String(v.id||v.draft_key),values=variantOverrides.get(id)||{},selected=record.id?String(record.id_default_combination)===id:String(values.default_on??v.default_on)==='1';
  const input=key=>'<td class="'+esc(cellClass)+'"><input class="'+inputClass+'" aria-label="'+esc((metadata[key]||key)+' · '+(v.reference||id))+'" data-pr-vid="'+esc(id)+'" data-pr-vvalue="'+key+'" value="'+esc(Object.hasOwn(values,key)?values[key]:textValue(v[key]))+'"></td>';
  const imageId=associationIds(v,'images')[0],image=imageId?productPhoto({id_default_image:imageId},store):null;
  return '<tr><td class="'+esc(cellClass)+'"><input type="radio" name="prd-default-variation" aria-label="Usar como predeterminada '+esc(v.reference||id)+'" data-pr-action="variation-default" data-pr-vid="'+esc(id)+'" '+(selected?'checked':'')+'></td><td class="'+esc(cellClass)+'">'+esc((v.__attributeNames||[]).join(' · ')||'Atributos pendientes de comprobar')+'</td>'+['reference','ean13','wholesale_price','price','weight'].map(input).join('')+'<td class="'+esc(cellClass)+'"><button type="button" data-pr-action="stock-stages" data-pr-vid="'+esc(id)+'" aria-label="Ajustar existencias de '+esc(v.reference||id)+'">'+esc(v.__stock?.quantity??'Consultar')+'</button></td>'+input('minimal_quantity')+'<td class="'+esc(cellClass)+'">'+'<button type="button" data-pr-action="variation-images" data-pr-vid="'+esc(id)+'" aria-label="Elegir imágenes de '+esc(v.reference||id)+'">'+(image?'<img src="'+esc(image)+'" class="prd-variant-photo" alt="'+esc(v.reference||id)+'">':'<span class="material-symbols-outlined">add_photo_alternate</span>')+'</button>'+'</td><td class="'+esc(cellClass)+'"><button type="button" data-pr-action="variation-remove" data-pr-vid="'+esc(id)+'" aria-label="Eliminar combinación '+esc(v.reference||id)+'" class="material-symbols-outlined text-error">delete</button></td></tr>';
 }).join('');
 const calculationNotice=vPanel.querySelector('table').previousElementSibling;
 if(calculationNotice)setText(calculationNotice,'El impacto de precio de cada combinación se suma al precio base sin impuestos del producto.');
 // The design photo rail stays in place, but no supplier/demo picture is fabricated.
 const url=productPhoto(record,store),main=f.querySelector('#sticky-main-img'),thumb=f.querySelector('#sticky-header-thumb');
 const blank='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#eff4ff"/><text x="200" y="205" text-anchor="middle" fill="#6e7881" font-family="sans-serif" font-size="16">Sin imagen</text></svg>');
 if(main&&url){main.dataset.prAction='photo-zoom';main.dataset.prImage=String(record.id_default_image||associationIds(record,'images')[0]);main.tabIndex=0;main.setAttribute('role','button');main.setAttribute('aria-label','Ampliar imagen del producto');}
 for(const img of [main,thumb])if(img){img.removeAttribute('data-alt');img.alt=textValue(record.name)||'Producto';img.src=url||blank;}
 const thumbnailButtons=[...f.querySelectorAll('.sticky-thumb-btn')];
 const images=associationIds(record,'images');
 const gallery=f.querySelector('#sub-imagenes');
 gallery.innerHTML='<div class="flex items-center justify-between"><h3 class="font-headline-md text-headline-md">Galería & Fotos</h3><button type="button" data-pr-action="image-stages" class="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-label-md text-label-md">Añadir imagen</button></div><div class="grid grid-cols-3 gap-space-md">'+images.map(id=>'<figure class="bg-surface-container-low rounded-lg p-space-sm"><button type="button" class="prd-photo-open" data-pr-action="photo-zoom" data-pr-image="'+esc(id)+'" aria-label="Ampliar imagen '+esc(id)+'"><img class="w-full object-contain" src="'+esc(productPhoto({id_default_image:id},store))+'" alt="'+esc(textValue(record.name))+'"></button><figcaption class="font-body-sm text-body-sm">Imagen #'+esc(id)+'</figcaption><button type="button" data-pr-action="image-cover" data-pr-image="'+esc(id)+'" class="px-space-sm py-space-xs rounded bg-primary-fixed text-on-primary-fixed font-label-md text-label-md" '+(String(record.id_default_image)===id?'disabled':'')+'>'+(String(record.id_default_image)===id?'Portada actual':'Usar como portada')+'</button><button type="button" data-pr-action="image-remove" data-pr-image="'+esc(id)+'" class="material-symbols-outlined text-error" aria-label="Eliminar imagen '+esc(id)+'">delete</button></figure>').join('')+'</div>';
 thumbnailButtons.forEach((b,i)=>{if(!images[i]){b.remove();return;}action(b,'photo-view');b.dataset.prPhoto=images[i];const img=b.querySelector('img');if(img){img.src=productPhoto({id_default_image:images[i]},store);img.alt='Imagen '+(i+1);}});
 for(const n of [...f.querySelectorAll('span')])if(!n.children.length&&/Foto Activa/.test(n.textContent))setText(n,images.length?images.length+' imágenes verificadas':'Sin imágenes');
 for(const n of [...f.querySelectorAll('span')])if(!n.children.length&&n.textContent.trim()==='Proveedor Oficial')setText(n,store==='hortimatic'?'Hortimatic':'NewOldSmok');
 const price=f.querySelector('#sticky-pvp-display');setText(price,textValue(overrides.price??record.price)?new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(overrides.price??record.price)):'—');
 if(amounts?.gross!==null&&amounts?.gross!==undefined){setText(price,new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(amounts.gross));if(price?.previousElementSibling)setText(price.previousElementSibling,'PVP base IVA España:');}else if(price?.previousElementSibling)setText(price.previousElementSibling,'Precio base sin IVA:');
 setText(f.querySelector('#sticky-cost-display'),textValue(overrides.wholesale_price??record.wholesale_price)||'Sin coste');
 setText(f.querySelector('#sticky-margin-display'),amounts?.marginPct!==null&&amounts?.marginPct!==undefined?amounts.marginPct.toFixed(1)+' % aprox.':'Sin coste verificado');
 const stockText=[...f.querySelectorAll('div,span')].find(n=>n.children.length===0&&n.textContent.includes('Stock Global Sumado:'));if(stockText){setText(stockText,'Existencias:');setText(stockText.nextElementSibling,stock===null?'Sin consultar':String(stock)+' unidades');}
 // Native organisation is handled through the existing validated destination mapper.
 const org=f.querySelector('#sub-organizacion');
 org.innerHTML='<h3 class="font-headline-md text-headline-md">Categorías y organización</h3><p class="font-body-sm text-body-sm text-on-surface-variant">Relaciones actuales de '+(store==='hortimatic'?'Hortimatic':'NewOldSmok')+'. Los nombres e identificadores pertenecen a esta tienda.</p><div class="flex flex-col gap-space-sm">'+associationIds(record,'categories').map(id=>'<div class="bg-surface-container-low px-space-md py-space-sm rounded"><span class="font-label-md text-label-md">'+esc(textValue(categories.find(c=>String(c.id)===id)?.name)||'Categoría #'+id)+'</span> '+(String(record.id_category_default)===id?'<span class="font-label-sm text-label-sm text-primary">Principal</span>':'')+'</div>').join('')+'</div>'+rawHtml;
 return serialize(f);
}

export function stitchCopy({store,legacyHtml}){
 const f=fragment(STITCH_VIEWS['tab-copiar']),view=f.firstElementChild,actual=fragment(legacyHtml);
 view.classList.remove('hidden');view.classList.add('flex');
 const source=store==='hortimatic'?'Hortimatic':'NewOldSmok',target=store==='hortimatic'?'NewOldSmok':'Hortimatic';
 const swap=f.querySelector('#btn-swap-stores');action(swap,'copy-reverse');swap.setAttribute('aria-label','Intercambiar tiendas de origen y destino');
 const buttons=[...view.querySelectorAll('button')];
 const all=buttons.find(b=>b.textContent.includes('Seleccionar Todo')),none=buttons.find(b=>b.textContent.includes('Deseleccionar'));
 if(all)action(all,'fields-all');if(none)action(none,'fields-none');
 for(const b of buttons)if(/Copiar a Borrador|Revisar y Publicar/.test(b.textContent))action(b,'compare');
 const editors=[...actual.querySelectorAll('.prd-parallel-editors>fieldset')];
 for(const [i,id]of ['panel-store-source','panel-store-target'].entries()){
  const panel=f.querySelector('#'+id),editor=editors[i];
  panel.replaceChildren();
  const heading=document.createElement('h3');heading.className='font-headline-md text-headline-md text-on-surface';heading.textContent=(i?'DESTINO: ':'ORIGEN: ')+(i?target:source);panel.append(heading);
  if(editor){editor.classList.add('prd-stitch-copy-fields');editor.querySelector('legend')?.remove();panel.append(editor);}
 }
 // Remove design-only database prefixes and sample direction badges, not controls.
 for(const node of [...view.querySelectorAll('span,small,code')])if(!node.children.length&&/PS_PREFIX:|ps_nos_|ps_hort_|Hortimatic 1\.7\.8\.11|#10482/.test(node.textContent))node.remove();
 const nav=actual.querySelector('.prd-parallel-tabs');if(nav)view.firstElementChild.after(nav);
 const destinations=actual.querySelector('.prd-targets');if(destinations)view.firstElementChild.append(destinations);
 const preview=actual.querySelector('.prd-preview');if(preview)view.append(preview);
 return serialize(f);
}

function adoptDesignControls(scope){
 for(const node of scope.querySelectorAll('input:not([type="checkbox"]),select,textarea'))node.classList.add(...inputClass.split(' '));
 for(const node of scope.querySelectorAll('label'))node.classList.add('flex','flex-col','gap-space-xs',...labelClass.split(' '));
 for(const node of scope.querySelectorAll('button')){
  node.className='px-space-md py-space-sm rounded bg-primary-container text-on-primary font-label-md text-label-md shadow-sm';
 }
}
export function stitchRequest({legacyHtml,output}){
 const f=fragment(STITCH_VIEWS['tab-alta']),view=f.firstElementChild,actual=fragment(legacyHtml);
 view.classList.remove('hidden');view.classList.add('flex');
 const cards=[...view.children[1].children];
 const title=(node,text)=>{const h=document.createElement('h3');h.className='font-headline-md text-headline-md text-on-surface';h.textContent=text;node.replaceChildren(h);};
 title(cards[0],'1. Origen y destino');title(cards[1],'2. Encargo para ChatGPT');title(cards[2],'3. Datos propios y revisión');
 for(const key of ['operation','store','url']){const node=actual.querySelector('[data-pr-request="'+key+'"]')?.closest('label');if(node)cards[0].append(node);}
 const info=document.createElement('p');info.className='font-body-sm text-body-sm text-on-surface-variant';info.textContent='Completa los datos que conozcas. ChatGPT comprobará el proveedor y las dos tiendas; no se inventan datos ni se envía un alta al copiar el encargo.';cards[0].append(info);
 const build=actual.querySelector('[data-pr-action="request-build"]');if(build)cards[1].append(build);
 const prompt=actual.querySelector('textarea[readonly]')||document.createElement('textarea');prompt.readOnly=true;prompt.rows=14;prompt.textContent=output||'';prompt.setAttribute('aria-label','Encargo completo para ChatGPT');cards[1].append(prompt);
 let copy=actual.querySelector('[data-pr-action="request-copy"]');if(!copy){copy=document.createElement('button');copy.textContent='Copiar para ChatGPT';action(copy,'request-copy');}copy.disabled=!output;cards[1].append(copy);
 const fields=document.createElement('div');fields.className='grid grid-cols-2 gap-space-md';
 for(const node of [...actual.querySelectorAll('[data-pr-request]')]){const label=node.closest('label');if(label&&actual.contains(label))fields.append(label);}
 cards[2].append(fields);
 // The original demo pasted JSON and pretended to validate a product. The live
 // module prepares a documented human-readable request, never a fake API call.
 const steps=view.firstElementChild;steps.textContent='URL del proveedor → completar datos propios → preparar encargo → revisar en Productos';steps.classList.add('font-label-md','text-label-md');
 const last=view.children[2];last.replaceChildren();const notice=document.createElement('p');notice.className='font-body-sm text-body-sm text-on-surface-variant';notice.textContent='Las imágenes se toman de la URL autorizada o de archivos adjuntos. Preparar el encargo no crea el producto ni activa compras. El resultado se verifica en la ficha y sus etapas de guardado.';last.append(notice);
 adoptDesignControls(view);
 return serialize(f);
}

export function stitchSaved({record,legacyHtml,queue=[],drafts=[]}){
 const f=fragment(STITCH_VIEWS['tab-borradores']),view=f.firstElementChild;
 view.classList.remove('hidden');view.classList.add('flex');
 const toolbar=view.firstElementChild;toolbar.querySelector('button')?.remove();
 const title=toolbar.querySelector('h2,h3');if(title)setText(title,'Guardado, etapas y trazabilidad');
 const grid=view.children[1],card=grid.firstElementChild.cloneNode(false);grid.replaceChildren();
 const heading=document.createElement('h3');heading.className='font-headline-md text-headline-md text-on-surface';heading.textContent=record?textValue(record.name)||'Producto nuevo':'Sin borrador abierto';
 const text=document.createElement('p');text.className='font-body-sm text-body-sm text-on-surface-variant';text.textContent=record?'Se conservan los campos de esta cuenta y las solicitudes por tienda. Cada etapa necesita su resultado verificado.':'Abre una ficha o crea un producto para consultar su recorrido.';
 card.append(heading,text);
 if(record){const open=document.createElement('button');action(open,'mode');open.dataset.mode='ficha';open.textContent='Completar ficha';card.append(open);}
 grid.append(card);
 for(const draft of drafts){
  const row=card.cloneNode(false),heading=document.createElement('h3'),info=document.createElement('p'),open=document.createElement('button');
  heading.className='font-headline-md text-headline-md';heading.textContent=draft.name||'Producto sin nombre';
  info.className='font-body-sm text-body-sm text-on-surface-variant';info.textContent=draft.shop+' · '+(draft.reference||'Sin referencia')+' · '+draft.changes+' campos seleccionados';
  action(open,'draft-open');open.dataset.prDraftKey=draft.key;open.textContent='Recuperar ficha';
  row.append(heading,info,open);grid.append(row);
 }
 for(const item of queue){
  const row=card.cloneNode(false),h=document.createElement('h3'),p=document.createElement('p'),b=document.createElement('button');
  h.className=heading.className;h.textContent=item.name||item.reference||'Producto #'+item.id;
  p.className=text.className;p.textContent=(item.store==='hortimatic'?'Hortimatic':'NewOldSmok')+' · #'+item.id+' · '+(item.reference||'Sin referencia');
  action(b,'open-copy-item');b.dataset.id=item.id;b.dataset.prShop=item.store;b.textContent='Revisar copia';row.append(h,p,b);grid.append(row);
 }
 if(record&&legacyHtml){const actual=fragment(legacyHtml);const previews=actual.querySelector('.prd-preview');if(previews)view.append(previews);}
 adoptDesignControls(view);
 return serialize(f);
}
