import {productGallery} from './productos-gallery.js';
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
function serialize(node){for(const select of node.querySelectorAll('select'))for(const option of select.options)option.toggleAttribute('selected',option.selected);const wrap=document.createElement('div');wrap.append(node);return wrap.innerHTML;}
function label(button,value){const spans=button.querySelectorAll('span');setText(spans[1]||button,value);}
export function stitchHeader({store,mode,status,count,product,pending,connected,draftCount=0}){
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
  b.classList.toggle('hover:bg-surface-container-high',!active);b.classList.toggle('font-semibold',active);b.classList.toggle('shadow-sm',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  if(i===0)setText(b.querySelector('span:last-child'),count);
  if(i===1)setText(b.querySelector('span:last-child'),product||'Selecciona un producto');
  if(i===3)b.querySelector('span:last-child')?.remove();
  if(i===4)setText(b.querySelector('span:last-child'),draftCount?draftCount+' borrador'+(draftCount===1?'':'es'):'Sin borrador');
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
export function stitchFiche({galleryDraft={},record,store,section,overrides,variants,variantOverrides,metadata,fieldControl,priceHtml,rawHtml,amounts,brands=[],categories=[],stock=null,organization=null,taxGroups=[]}){
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
  b.setAttribute('aria-current',active?'page':'false');b.classList.toggle('hover:bg-surface-container-high',!active);b.classList.toggle('font-semibold',active);
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
   const native={general:['name','reference','ean13',null,null,'description_short'],contenido:['description'],seo:['meta_title','meta_description','link_rewrite'],transporte:['weight','width','height','depth'],inventario:[null,null,'available_later']}[key];
   if(!native){
    if(key==='precios'){
     const cost=panel.querySelector('#calc-cost'),margin=panel.querySelector('#calc-margin'),tax=panel.querySelector('#calc-tax'),gross=panel.querySelector('#calc-pvp');
     cost.type='text';cost.inputMode='decimal';cost.value=String(overrides.wholesale_price??record.wholesale_price??'');cost.setAttribute('value',cost.value);cost.dataset.prValue='wholesale_price';cost.setAttribute('aria-label','Coste sin impuestos');
     margin.type='text';margin.inputMode='decimal';margin.readOnly=!(amounts?.cost>0);margin.dataset.prMargin='';margin.value=amounts?.marginPct==null?'':amounts.marginPct.toFixed(2);margin.setAttribute('value',margin.value);margin.setAttribute('aria-label','Margen sobre venta aproximado');setText(margin.previousElementSibling,'Margen sobre venta (%) · aprox.');
     const rate=amounts?.rate,currentTax=String(record.id_tax_rules_group??'');tax.replaceChildren(...[{id:'0',name:'Sin grupo de impuestos'},...taxGroups].map(group=>new Option(textValue(group.name)+(String(group.id)===currentTax&&rate!==null?' · '+rate+' % verificado':''),String(group.id))));if(currentTax&&!Array.from(tax.options).some(o=>o.value===currentTax))tax.add(new Option('Grupo actual #'+currentTax,currentTax));tax.value=currentTax;tax.dataset.prTaxGroup='';tax.disabled=!record.id||!taxGroups.length;tax.setAttribute('aria-label','Grupo real de impuestos de la tienda');
     gross.type='text';gross.inputMode='decimal';gross.value=amounts?.gross==null?'':amounts.gross.toFixed(2);gross.setAttribute('value',gross.value);gross.dataset.prGross='';gross.step='0.01';gross.min='0';gross.readOnly=amounts?.gross==null;gross.setAttribute('aria-label','PVP base con IVA de España');
     for(const [control,help]of [[cost,'Coste de PrestaShop sin impuestos. Puede estar redondeado y se trata como aproximado.'],[margin,'Margen sobre el precio de venta sin impuestos: (venta − coste) / venta. Al cambiarlo se prepara el precio base; no se guarda hasta confirmar.'],[tax,'Grupo real de esta tienda. Cambiarlo abre una revisión antes de guardar; no sustituye el impuesto por un porcentaje inventado.'],[gross,'Precio base con la regla general de IVA de España verificada. No incluye descuentos, dirección especial, transporte ni ecotasa separada.']]){const caption=control.previousElementSibling;if(caption?.tagName==='LABEL'){caption.htmlFor=control.id;caption.append(fragment(fieldHelp(control.getAttribute('aria-label')||caption.textContent,help)));}}
     const notices=[...panel.querySelectorAll('div,span')].filter(n=>!n.children.length);
     for(const n of notices){if(n.textContent.includes('Beneficio Neto Estimado')){n.textContent='Margen sin impuestos, aproximado:';setText(n.nextElementSibling,amounts?.margin==null?'Sin coste verificado':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(amounts.margin));}if(n.textContent.includes('PVP Base sin'))setText(n.nextElementSibling,textValue(overrides.price??record.price)||'—');if(n.textContent.includes('Regla de Redondeo'))setText(n.nextElementSibling,'Sin redondeo comercial automático');}
     const extra=document.createElement('details');extra.className='prd-native-extra';extra.innerHTML='<summary class="font-label-md text-label-md">Precio base y campos adicionales</summary>'+fields(groups[key].filter(k=>k!=='wholesale_price'))+priceHtml;panel.append(extra);
    }else panel.innerHTML=fields(groups[key]);continue;
   }
   const used=new Set(),controls=[...panel.querySelectorAll('input,select,textarea')];
   controls.forEach((control,i)=>{
    const field=native[i];
    if(field){let value=Object.hasOwn(overrides,field)?overrides[field]:textValue(record[field]);if(key==='general'&&field==='description_short'){const plain=document.createElement('template');plain.innerHTML=String(value).replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|li)>/gi,'\n');value=plain.content.textContent.trim();}const replacement=fragment(fieldControl(field,value,'class="'+control.className+'" data-pr-value="'+field+'"')).firstElementChild;if(control.tagName==='TEXTAREA')replacement.rows=control.rows;replacement.setAttribute('aria-label',metadata[field]||field);const caption=control.parentElement.querySelector(':scope > label');if(caption){caption.querySelectorAll('[title]').forEach(n=>n.remove());replacement.id='prd-fiche-'+field;caption.htmlFor=replacement.id;caption.append(fragment(fieldHelp(metadata[field]||field,field==='weight'?'Peso en kilogramos; distingue dispositivo y embalaje.':field==='description'?'Admite texto y HTML. La vista previa está aislada y no ejecuta scripts.':'Edita el borrador. Los cambios se revisan, validan y guardan antes de enviarlos a la tienda.')));}control.replaceWith(replacement);used.add(field);}
    else if(key==='general'){
     if(i===3){control.replaceChildren(...[{id:'0',name:'Sin marca asignada'},...brands].map(brand=>new Option(textValue(brand.name),String(brand.id))));control.value=String(record.id_manufacturer||'0');control.dataset.prFicheOrganization='id_manufacturer';control.disabled=!record.id||!brands.length;control.setAttribute('aria-label','Marca de esta tienda');}
     else{const value=variants.length?'Producto con combinaciones':'Producto simple';control.replaceChildren(new Option(value,value));control.disabled=true;}
    }else if(key==='inventario'){
     const b=document.createElement('button');b.className=control.className;b.type='button';action(b,'stock-stages');b.textContent=i===1?'Consultar y ajustar ubicación':'Consultar y ajustar existencias';control.replaceWith(b);
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
 for(const [name,title]of [['attribute-group','Nuevo atributo'],['attribute-value','Nuevo valor']]){const b=addVariant.cloneNode(true);action(b,name);b.textContent=title;bulk.after(b);}
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
 for(const img of [main,thumb])if(img){img.removeAttribute('data-alt');img.alt=textValue(record.name)||'Producto';img.src=(img===main&&url?url.replace('-home_default/','-large_default/'):url)||blank;img.classList.replace('object-cover','object-contain');}
 const thumbnailButtons=[...f.querySelectorAll('.sticky-thumb-btn')];
 const localGallery=productGallery(associationIds(record,'images'),galleryDraft),images=localGallery.order;
 const gallery=f.querySelector('#sub-imagenes');
 const galleryGrid=gallery.querySelector('.grid'),imageCard=galleryGrid.firstElementChild.cloneNode(true),addCard=galleryGrid.lastElementChild.cloneNode(true);
 const upload=gallery.querySelector('button');action(upload,'image-stages');
 const galleryInfo=document.createElement('p');galleryInfo.className='font-body-sm text-body-sm text-on-surface-variant';galleryInfo.textContent='El orden y los textos se conservan en tu borrador de Totus. La API 1.7 no los modifica en la galería principal de la tienda.';gallery.append(galleryInfo);const descriptionGallery=document.createElement('button');action(descriptionGallery,'gallery-description');descriptionGallery.className='px-space-md py-space-sm rounded bg-primary-container text-on-primary font-label-md text-label-md';descriptionGallery.textContent='Añadir esta galería a la descripción';descriptionGallery.disabled=!images.length;gallery.append(descriptionGallery);
 galleryGrid.replaceChildren();
 images.forEach((id,index)=>{
  const card=imageCard.cloneNode(true),holder=card.querySelector('img').parentElement,picture=card.querySelector('img');
  picture.src=productPhoto({id_default_image:id},store);picture.alt=localGallery.captions[id]||textValue(record.name);picture.classList.replace('object-cover','object-contain');picture.removeAttribute('data-alt');
  const zoom=document.createElement('button');zoom.className=holder.className+' prd-photo-open';action(zoom,'photo-zoom');zoom.dataset.prImage=id;zoom.setAttribute('aria-label','Ampliar imagen '+id);holder.replaceWith(zoom);zoom.append(picture);
  const caption=card.querySelector('.font-label-sm'),cover=document.createElement('button');cover.className='px-1.5 py-0.2 rounded '+(String(record.id_default_image)===id?'bg-primary text-on-primary font-bold':'bg-primary-fixed text-on-primary-fixed');action(cover,'image-cover');cover.dataset.prImage=id;cover.disabled=String(record.id_default_image)===id;cover.textContent=cover.disabled?'Portada actual':'Usar como portada';caption.replaceChildren(cover);
  const menu=document.createElement('div');menu.className='flex items-center gap-space-xs flex-wrap';
  for(const [name,symbol,title,disabled,position]of [['image-position','arrow_back','Adelantar imagen '+id,index===0,index],['image-position','arrow_forward','Retrasar imagen '+id,index===images.length-1,index+2],['image-metadata','edit_note','Texto de imagen en Totus',false],['image-replace','swap_horiz','Sustituir foto',false],['image-remove','delete','Eliminar imagen '+id,false]]){const b=document.createElement('button');action(b,name);b.dataset.prImage=id;if(position!==undefined)b.dataset.prPosition=String(position);b.disabled=disabled;b.className='material-symbols-outlined text-[18px] p-1 rounded '+(name==='image-remove'?'text-error':'text-primary hover:bg-surface-container-high');b.textContent=symbol;b.setAttribute('aria-label',title);b.title=title;menu.append(b);}
  card.append(menu);galleryGrid.append(card);
 });
 addCard.setAttribute('role','button');addCard.tabIndex=0;addCard.dataset.prAction='image-stages';addCard.dataset.prImageDrop='';galleryGrid.append(addCard);

 const thumbnailRail=thumbnailButtons[0]?.parentElement,thumbnailTemplate=thumbnailButtons[0]?.cloneNode(true);
 if(thumbnailRail&&thumbnailTemplate){thumbnailRail.replaceChildren();thumbnailRail.classList.add('flex-wrap');for(const [index,id]of images.entries()){const b=thumbnailTemplate.cloneNode(true);action(b,'photo-view');b.dataset.prPhoto=id;b.setAttribute('aria-label','Ver foto '+(index+1));const active=String(record.id_default_image||images[0])===id;b.classList.toggle('ring-2',active);b.classList.toggle('ring-primary',active);b.setAttribute('aria-pressed',String(active));const img=b.querySelector('img');img.src=productPhoto({id_default_image:id},store);img.alt='Imagen '+(index+1);img.classList.replace('object-cover','object-contain');img.removeAttribute('data-alt');thumbnailRail.append(b);}}
 for(const n of [...f.querySelectorAll('span,div')])if(!n.children.length&&/Foto Activa/.test(n.textContent)){n.dataset.prPhotoLabel='';setText(n,images.length?'Foto '+(Math.max(0,images.indexOf(String(record.id_default_image)))+1)+' de '+images.length:'Sin imágenes');}
 for(const n of [...f.querySelectorAll('span')])if(!n.children.length&&n.textContent.trim()==='Proveedor Oficial')setText(n,store==='hortimatic'?'Hortimatic':'NewOldSmok');
 const price=f.querySelector('#sticky-pvp-display');setText(price,textValue(overrides.price??record.price)?new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(overrides.price??record.price)):'—');
 if(amounts?.gross!==null&&amounts?.gross!==undefined){setText(price,new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(amounts.gross));if(price?.previousElementSibling)setText(price.previousElementSibling,'PVP base IVA España:');}else if(price?.previousElementSibling)setText(price.previousElementSibling,'Precio base sin IVA:');
 const costText=textValue(overrides.wholesale_price??record.wholesale_price);setText(f.querySelector('#sticky-cost-display'),costText!==''&&Number.isFinite(Number(costText))?new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(costText)):'Sin coste');
 setText(f.querySelector('#sticky-margin-display'),amounts?.marginPct!==null&&amounts?.marginPct!==undefined?amounts.marginPct.toFixed(1)+' % aprox.':'Sin coste verificado');
 const stockText=[...f.querySelectorAll('div,span')].find(n=>n.children.length===0&&n.textContent.includes('Stock Global Sumado:'));if(stockText){setText(stockText,'Existencias:');setText(stockText.nextElementSibling,stock===null?'Sin consultar':String(stock)+' unidades');}
 // Native organisation is handled through the existing validated destination mapper.
 const org=f.querySelector('#sub-organizacion');
 const categoryContainer=org.querySelector('.bg-surface-container-low'),categoryTemplate=categoryContainer.firstElementChild.cloneNode(true);
 categoryContainer.replaceChildren();
 const currentOrganization=organization?.store===store&&organization?.id===String(record.id)?organization:null;
 const selectedCategories=currentOrganization?.categories||associationIds(record,'categories'),selectedMain=currentOrganization?.fields.id_category_default||String(record.id_category_default);
 const path=id=>{const names=[],seen=new Set();while(id&&id!=='0'&&!seen.has(id)){seen.add(id);const category=categories.find(c=>String(c.id)===id);names.unshift(textValue(category?.name)||'Categoría #'+id);id=category&&/^\d+$/.test(String(category.id_parent))?String(category.id_parent):'0';}return names.join(' > ');};
 for(const id of selectedCategories){const row=categoryTemplate.cloneNode(true),radio=row.querySelector('input');radio.checked=selectedMain===id;if(radio.checked)radio.setAttribute('checked','');else radio.removeAttribute('checked');radio.dataset.prAction='organization-primary';radio.dataset.prCategory=id;radio.name='prd-category-main';setText(row.querySelector('span'),path(id));categoryContainer.append(row);}
 if(!selectedCategories.length)setText(categoryContainer,'Sin categorías asociadas. Selecciona las de esta tienda antes de publicar.');
 org.insertAdjacentHTML('beforeend',rawHtml);

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
  setText(panel.querySelector(i?'#target-store-title':'#source-store-title'),(i?'DESTINO: ':'ORIGEN: ')+(i?target:source));
  const badge=panel.firstElementChild.lastElementChild,identity=panel.children[1],actualIdentity=editor?.querySelector('.prd-parallel-identity');
  setText(badge,i?'Revisar destino':'Ficha de origen');
  if(actualIdentity){const picture=actualIdentity.querySelector('img'),slot=identity.firstElementChild,description=identity.lastElementChild;slot.replaceChildren();if(picture){picture.className='w-full h-full object-contain';slot.append(picture);}else slot.textContent='Sin foto';description.replaceChildren();const name=document.createElement('strong');name.className='font-headline-sm text-headline-sm text-on-surface';name.textContent=actualIdentity.querySelector('strong')?.textContent||'Nueva ficha';const note=document.createElement('span');note.className='font-body-sm text-body-sm text-on-surface-variant';note.textContent=i?'Completa los datos y revisa las coincidencias antes de guardar.':'Selecciona los campos que quieres copiar.';description.append(name,note);}
  const fieldsPanel=panel.children[2],rowTemplate=fieldsPanel.children[1].cloneNode(true),heading=fieldsPanel.firstElementChild.cloneNode(true);fieldsPanel.replaceChildren(heading);
  if(editor){
   const variations=editor.querySelector('.prd-copy-variant-options');if(variations)fieldsPanel.append(variations);
   const idLabel=editor.querySelector(':scope>label.prd-field');if(idLabel){idLabel.className='flex flex-col gap-space-xs';idLabel.querySelector('input').className=inputClass;fieldsPanel.append(idLabel);}
   for(const field of editor.querySelectorAll('.prd-fields-grid>.prd-field')){
    const row=rowTemplate.cloneNode(true),check=field.querySelector('input[type="checkbox"]'),control=field.querySelector('[data-pr-value],[data-pr-target-field]'),caption=field.querySelector(':scope>span:has(b)')||document.createElement('span'),title=field.querySelector('b')?.textContent||'';
    const checkbox=row.querySelector('input[type="checkbox"]');if(checkbox){if(check){check.setAttribute('aria-label','Copiar '+title);checkbox.replaceWith(check);}else checkbox.remove();}
    const container=row.querySelector('.flex-col'),oldTitle=container?.firstElementChild;if(!container)continue;
    if(!caption.childNodes.length)caption.append(field.querySelector('b'));
    if(caption){caption.className='font-label-md text-label-md font-semibold text-on-surface';oldTitle.replaceWith(caption);}
    const preview=container.lastElementChild;if(preview!==caption)preview.remove();
    container.classList.add('w-full');
    if(control){control.className=inputClass+' prd-copy-control';control.setAttribute('aria-label',(i?'Destino · ':'Origen · ')+title);container.append(control);}
    for(const language of field.querySelectorAll('.prd-lang-label,[data-pr-lang-store],small'))container.append(language);
    // The prototype badge is an example, not proof of destination equality.
    if(i&&row.lastElementChild!==container)row.lastElementChild.remove();
    fieldsPanel.append(row);
   }
  }

 }
 const stockNote=[...view.querySelectorAll('span')].find(n=>n.textContent.trim().startsWith('Regla de Stock:'));if(stockNote)setText(stockNote,'Existencias: la copia de campos no traslada stock físico entre tiendas. Revisa las cantidades propias en la etapa de existencias.');
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
 const toolbar=view.firstElementChild;setText(toolbar.querySelector('h2,h3'),'Guardado, etapas y trazabilidad');setText(toolbar.querySelector('p'),drafts.length+' fichas conservadas en esta cuenta. Las operaciones de tienda se validan y comprueban por separado.');
 const purge=toolbar.querySelector('button');action(purge,'draft-purge');purge.textContent='Limpiar borradores antiguos (>30 días)';purge.disabled=!drafts.some(d=>d.canPurge);purge.title=purge.disabled?'No hay borradores de más de 30 días sin operaciones enviadas.':'Elimina solo borradores locales antiguos sin operaciones enviadas.';
 const grid=view.children[1],template=grid.firstElementChild.cloneNode(true);grid.replaceChildren();
 const card=({name,badge,detail,foot,button,actionName,key,shop,id})=>{const row=template.cloneNode(true),top=row.firstElementChild,footer=row.lastElementChild;setText(top.querySelector('.rounded-full'),badge);setText(top.querySelector('.font-data-mono'),shop||'');setText(top.querySelector('h4'),name);setText(top.querySelector('p'),detail);setText(footer.querySelector('span'),foot);const open=footer.querySelector('button');action(open,actionName);open.textContent=button;if(key)open.dataset.prDraftKey=key;if(shop)open.dataset.prShop=shop;if(id)open.dataset.id=id;if(actionName==='mode')open.dataset.mode='ficha';grid.append(row);};
 for(const draft of drafts)card({name:draft.name||'Producto sin nombre',badge:draft.sent?'Operaciones registradas':'Borrador local',detail:(draft.reference||'Sin referencia')+' · '+draft.changes+' campos seleccionados. '+draft.pendingSteps+' etapas pendientes y '+draft.doneSteps+' guardadas y verificadas.',foot:draft.canPurge?'Antiguo · sin operaciones':'Conservado en esta cuenta',button:'Recuperar ficha',actionName:'draft-open',key:draft.key,shop:draft.shop});
 for(const item of queue)card({name:item.name||item.reference||'Producto #'+item.id,badge:'Copia por revisar',detail:'Revisa los campos y la tienda de destino antes de guardar. No se traslada stock físico automáticamente.',foot:item.reference||'#'+item.id,button:'Revisar copia',actionName:'open-copy-item',shop:item.store,id:item.id});
 if(!drafts.length&&!queue.length){const empty=document.createElement('p');empty.className='font-body-sm text-body-sm text-on-surface-variant';empty.textContent='Sin borradores conservados. Abre una ficha o crea un producto para empezar.';grid.append(empty);}
 if(record&&legacyHtml){const actual=fragment(legacyHtml),previews=actual.querySelector('.prd-preview');if(previews)view.append(previews);}
 adoptDesignControls(view);return serialize(f);
}
