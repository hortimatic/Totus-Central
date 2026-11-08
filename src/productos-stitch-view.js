import {PRODUCT_TABLE_FIELDS} from './productos-table-editor.js';
import {productGallery} from './productos-gallery.js';
import {STITCH_VIEWS} from './productos-stitch-template.js';
import {STITCH_V4_HEADER} from './productos-stitch-v4-template.js';
import {PRODUCT_COLUMNS,productPhoto,productWebUrl} from './productos-catalog.js';
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
function serialize(node){for(const panel of node.querySelectorAll('.rounded-xl'))if(!panel.parentElement?.closest('.rounded-xl'))panel.classList.add('prd-panel');for(const select of node.querySelectorAll('select'))for(const option of select.options)option.toggleAttribute('selected',option.selected);const wrap=document.createElement('div');wrap.append(node);return wrap.innerHTML;}
function label(button,value){const spans=button.querySelectorAll('span');setText(spans[1]||button,value);}
function webLink(record,store){const url=productWebUrl(record,store);return url?'<a class="prd-web-link prd-table-button" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" title="Abrir en '+(store==='hortimatic'?'Hortimatic':'NewOldSmok')+'. Un producto inactivo puede no estar disponible públicamente.">Ver en la web ↗</a>':'<span class="prd-web-unavailable">Sin enlace: producto aún no creado</span>';}
export function stitchHeader({store,mode,status,count,product,pending,connected,draftCount=0}){
 return compactStitchHeader({store,mode,status,count,product,pending,connected,draftCount});
}
function compactStitchHeader({store,mode,status,count,product,pending,connected,draftCount}){
 const f=fragment(STITCH_V4_HEADER),header=f.querySelector('header'),nav=f.querySelector('nav');
 header.className='prd-v4-header';nav.className='prd-v4-nav';nav.id='master-tabs-bar';nav.setAttribute('aria-label','Secciones de Productos');nav.setAttribute('role','tablist');
 const select=f.querySelector('#v4-store-context');select.id='store-context-select';select.dataset.prStore='';select.setAttribute('aria-label','Tienda de trabajo');
 select.innerHTML='<option value="both">Ambas tiendas</option><option value="hortimatic">Hortimatic</option><option value="newoldsmok">NewOldSmok</option>';select.value=store;
 for(const n of header.querySelectorAll('span'))if(n.textContent==='v4.0')n.remove();
 const connection=[...header.querySelectorAll('span')].find(n=>n.textContent.includes('Conexión lista'));if(connection)connection.parentElement.textContent=connected?'● API conectada':'○ Revisar conexión';
 for(const b of header.querySelectorAll('button')){if(b.title==='Sincronizar'){action(b,'catalog-load');b.setAttribute('aria-label','Actualizar catálogo');}else b.remove();}
 const names=['1. Catálogo General','2. Ficha y Edición','3. Copiar entre Tiendas','4. Alta Asistida & ChatGPT','5. Guardado, Etapas y Trazabilidad'];
 [...nav.querySelectorAll('.master-tab-btn')].forEach((b,i)=>{action(b,'mode');b.dataset.mode=modes[i];b.setAttribute('role','tab');b.setAttribute('aria-label',names[i]);b.title=names[i];b.disabled=!!pending;const active=mode===modes[i]||i===1&&['variantes','bulk'].includes(mode);b.setAttribute('aria-selected',String(active));if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');for(const extra of [...b.querySelectorAll('span')].slice(2))extra.remove();if(i===0)b.insertAdjacentHTML('beforeend','<span class="prd-tab-count">'+count+'</span>');});
 nav.lastElementChild?.remove();
 const live=document.createElement('p');live.className='prd-v4-status';live.setAttribute('role','status');live.textContent=status;f.append(live);
 return serialize(f);
}
export function stitchCatalog({canEdit=false,canDelete=canEdit,canCreate=canEdit,canExport=canEdit,tableEdits=new Map(),store,rows,columns,selected,query,filters,brands,categories,page,size,hasMore,pending,ready,value,photo,views=[],viewName='',rowKey=p=>String(p.id)}){
 const f=fragment(STITCH_VIEWS['tab-catalogo']),view=f.firstElementChild;
 view.classList.add('prd-catalog-view');
 view.classList.remove('hidden');view.classList.add('flex');
 const summary=view.firstElementChild.firstElementChild.firstElementChild;
 const summarySpans=summary.querySelectorAll('span');
 setText(summarySpans[1],hasMore?'Catálogo por páginas:':'Catálogo consultado:');
 setText(summarySpans[2],rows.length+' referencias');
 // No demo totals, fabricated latency or claims of live synchronisation.
 setText(summarySpans[3],'de');setText(summarySpans[4],store==='both'?'Ambas tiendas':store==='hortimatic'?'Hortimatic':'NewOldSmok');
 const connection=summary.lastElementChild;setText(connection,ready?'Conexión verificada':'Conexión pendiente');
 const search=f.querySelector('#catalogo-search-input');search.value=query;search.setAttribute('value',query);search.dataset.prSearch='';
 const fillSelect=(select,key,items,title,current)=>{
  select.replaceChildren();select.dataset.prFilter=key;select.setAttribute('aria-label',title);
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
 action(tools[1],'catalog-export');label(tools[1],'Exportar CSV');tools[1].disabled=pending||!rows.length||!canExport;
 action(tools[2],'catalog-copy');tools[2].disabled=pending||!selected.size;
 action(tools[3],'new-product');label(tools[3],'Nuevo producto');tools[3].disabled=pending||!canCreate;
 const filterControls=document.createElement('div');filterControls.className='prd-catalog-filters';
 for(const [control,title]of [[search,'Buscar en los productos cargados'],[f.querySelector('#catalogo-brand-filter'),'Marca'],[f.querySelector('#catalogo-category-filter'),'Categoría'],[shop,'Tienda'],[selects[3],'Estado']]){const label=document.createElement('label');label.append(document.createTextNode(title),control);filterControls.append(label);}
 const selectionBar=f.querySelector('#check-full-catalog').parentElement.parentElement;
 const toolbar=document.createElement('div');toolbar.className='prd-catalog-toolbar';toolbar.append(details,tools[1],tools[2],tools[3]);
 const controls=view.firstElementChild;controls.classList.add('prd-panel','prd-catalog-controls');controls.replaceChildren(filterControls,toolbar,selectionBar);
 const loading=document.createElement('div');loading.className='prd-catalog-loading';loading.innerHTML='<span>'+rows.length+' productos cargados'+(hasMore?' · quedan páginas por consultar':' · consulta completa')+'</span>'+fieldHelp('Alcance del catálogo','Los filtros se aplican a los productos cargados. Busca una referencia o ID exacto en la tienda, carga la siguiente página o consulta todo el catálogo. Nunca se presenta una lista parcial como el total real.')+'<button type="button" data-pr-action="catalog-find" '+(pending?'disabled':'')+'>Buscar ID / referencia en tienda</button><button type="button" data-pr-action="catalog-load" '+(pending?'disabled':'')+'>Actualizar</button>'+(hasMore?'<button type="button" data-pr-action="catalog-more" '+(pending?'disabled':'')+'>Cargar 100 más</button><button type="button" data-pr-action="catalog-complete" '+(pending?'disabled':'')+'>Consultar catálogo completo</button>':'');toolbar.after(loading);
 const full=f.querySelector('#check-full-catalog');full.dataset.prCatalogLoaded='';full.checked=rows.some(r=>r.__visible!==false)&&rows.filter(r=>r.__visible!==false).every(r=>selected.has(rowKey(r)));if(full.checked)full.setAttribute('checked','');
 setText(f.querySelector('label[for="check-full-catalog"]'),'Seleccionar todos los resultados del filtro');
 setText(full.parentElement.parentElement.querySelector('span'),'Seleccionados: '+selected.size);
 controls.append(full.parentElement.parentElement);
 const filtered=rows.filter(r=>r.__visible!==false),pages=Math.max(1,Math.ceil(filtered.length/size));
 const visible=filtered.slice(page*size,(page+1)*size);
 const table=f.querySelector('table'),head=table.querySelector('thead tr'),originalCells=[...head.children],body=f.querySelector('tbody'),originalData=[...body.querySelector('tr').children];
 const indexes={image:1,reference:2,name:3,brand:4,category:5,store:6,cost:7,price:8,gross:8,margin:8,stock:9,active:10};
 const hc=k=>originalCells[indexes[k]??2]?.className||'p-space-sm';
 const tableButton=(p,name,title)=>'<button type="button" data-pr-action="table-'+name+'" data-pr-shop="'+esc(p.__store||store)+'" data-pr-id="'+esc(p.id)+'" class="prd-table-button">'+esc(title)+'</button>';
 const editCell=(p,k)=>{const row=tableEdits.get(rowKey(p)),field=PRODUCT_TABLE_FIELDS[k];if(!row||!field||field==='name'&&!row.language)return null;const val=row.values[field]??textValue(p[field]),attrs='data-pr-table-field="'+field+'" data-pr-shop="'+esc(p.__store||store)+'" data-pr-id="'+esc(p.id)+'" aria-label="'+esc(PRODUCT_COLUMNS.find(c=>c[0]===k)?.[1]+' · '+p.id)+'" '+(row.request?'disabled':'');return field==='active'?'<select '+attrs+'><option value="0" '+(String(val)==='0'?'selected':'')+'>Inactivo</option><option value="1" '+(String(val)==='1'?'selected':'')+'>Activo</option></select>':'<input '+attrs+' value="'+esc(val)+'" '+(['price','wholesale_price','weight','width','height','depth'].includes(field)?'inputmode="decimal"':'')+'>';};
 const rowActions=p=>{
  const row=tableEdits.get(rowKey(p)),shop=esc(p.__store||store),id=esc(p.id);
  const extra=(a,title)=>'<button type="button" data-pr-action="'+a+'" data-pr-shop="'+shop+'" data-pr-id="'+id+'" class="prd-table-button">'+title+'</button>';
  if(!row)return webLink(p,p.__store||store)+(canEdit?tableButton(p,'open','Editar fila'):'')+'<details class="prd-row-menu"><summary aria-label="Más acciones de '+esc(p.reference||p.id)+'">⋯</summary><div>'+(canEdit?tableButton(p,'archive','Archivar (desactivar)'):'')+(canCreate?extra('product-duplicate','Duplicar producto'):'')+(canDelete?extra('product-remove','Eliminar producto'):'')+'</div></details>';
  return '<div class="prd-table-actions">'+(row.languages.length>1?'<label>Idioma<select data-pr-table-language data-pr-shop="'+shop+'" data-pr-id="'+id+'" '+(row.request?'disabled':'')+'>'+row.languages.map(id=>'<option value="'+esc(id)+'" '+(id===row.language?'selected':'')+'>#'+esc(id)+'</option>').join('')+'</select></label>':'')+(row.prepared?'<details class="prd-row-review"><summary>'+row.prepared.review.filter(c=>c.changed).length+' cambios revisados</summary>'+row.prepared.review.filter(c=>c.changed).map(c=>'<p><b>'+esc(c.field)+'</b>: '+esc(textValue(c.before))+' → '+esc(textValue(c.after??c.value))+'</p>').join('')+'</details>':'')+(!row.request?tableButton(p,'prepare','Revisar')+tableButton(p,'discard','Descartar'):'')+(row.request||row.prepared?.can_commit?tableButton(p,'save',row.request?'Comprobar guardado':'Guardar cambios'):'')+'</div>';
 };
 const dc=k=>originalData[indexes[k]??2]?.className||'p-space-sm';
 head.innerHTML='<th class="'+esc(originalCells[0].className)+'"><input type="checkbox" aria-label="Seleccionar página" data-pr-catalog-all '+(visible.length&&visible.every(p=>selected.has(rowKey(p)))?'checked':'')+'></th>'+columns.map(k=>'<th data-pr-column-heading="'+esc(k)+'" class="'+esc(hc(k))+'">'+esc(PRODUCT_COLUMNS.find(c=>c[0]===k)?.[1]||k)+'</th>').join('')+'<th class="'+esc(originalCells.at(-1).className)+'">Acciones</th>';
 body.innerHTML=visible.map(p=>'<tr><td class="'+esc(originalData[0].className)+'"><input type="checkbox" aria-label="Seleccionar producto '+esc(p.id)+'" data-pr-catalog-select="'+esc(rowKey(p))+'" '+(selected.has(rowKey(p))?'checked':'')+'></td>'+columns.map(k=>'<td class="'+esc(dc(k))+'" data-label="'+esc(PRODUCT_COLUMNS.find(c=>c[0]===k)?.[1]||k)+'">'+(editCell(p,k)??(k==='image'?photo(p):k==='name'?'<strong>'+esc(value(p,k))+'</strong><br><small>'+esc(p.reference||'')+'</small>':esc(value(p,k))))+'</td>').join('')+'<td class="'+esc(originalData.at(-1).className)+'"><button type="button" data-pr-action="open-product" data-id="'+esc(p.id)+'" data-pr-shop="'+esc(p.__store||store)+'" class="px-2 py-1 rounded bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">Abrir ficha</button>'+rowActions(p)+'</td></tr>').join('');
 table.parentElement.classList.add('prd-catalog-table');table.parentElement.tabIndex=0;table.parentElement.setAttribute('aria-label','Catálogo de productos. Usa las flechas en las celdas para recorrer filas y columnas.');
 table.classList.add('prd-data-table');table.closest('.rounded-xl')?.classList.add('prd-panel');
 for(const td of body.querySelectorAll('td:last-child'))td.classList.add('prd-row-actions');
 if(!visible.length){const empty=document.createElement('p');empty.className='prd-catalog-empty';empty.setAttribute('role','note');empty.textContent=rows.length?'No hay productos que coincidan con estos filtros. Limpia el buscador o cambia los filtros.':'No hay productos cargados. Comprueba la conexión y pulsa Actualizar.';table.parentElement.before(empty);}
 const arrows=document.createElement('div');arrows.className='prd-table-navigation';arrows.innerHTML='<span>Foto y producto fijos · flechas para recorrer columnas</span><button type="button" data-pr-action="catalog-scroll" data-direction="-1" aria-label="Ver columnas anteriores">←</button><button type="button" data-pr-action="catalog-scroll" data-direction="1" aria-label="Ver columnas siguientes">→</button>';table.parentElement.before(arrows);
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
 heading.parentElement.insertAdjacentHTML('beforeend',webLink(record,store));
 for(const b of f.querySelectorAll('button')){
  if(/Guardar Borrador/i.test(b.textContent)){action(b,'draft-save');label(b,'Guardar borrador en Totus');b.title='Conserva los cambios en Totus. No modifica PrestaShop.';}
  if(/Validar|Sincronizar/i.test(b.textContent)){action(b,'fiche-validate');label(b,'Revisar cambios en tienda');b.title='Muestra las diferencias y permite guardarlas en '+(store==='hortimatic'?'Hortimatic':'NewOldSmok')+'.';}
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
     const extra=document.createElement('section');extra.className='prd-native-extra';extra.innerHTML='<h3 class="font-label-md text-label-md">Precio base y campos adicionales</h3>'+fields(groups[key].filter(k=>k!=='wholesale_price'))+priceHtml;panel.append(extra);
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
   if(extra.length){const more=document.createElement('section');more.className='prd-native-extra';more.innerHTML='<h3 class="font-label-md text-label-md">Más campos de '+esc(({general:'información',contenido:'contenido',seo:'SEO',transporte:'transporte',inventario:'disponibilidad'})[key])+'</h3>'+fields(extra);panel.append(more);}
  }
 }
 // Use the original matrix, populated only with the selected shop's real variants.
 const vPanel=f.querySelector('#sub-variaciones'),addVariant=vPanel.querySelector('button');action(addVariant,record.id?'variation-stages':'new-variant');
 const variantNotice=[...vPanel.querySelectorAll('span')].find(p=>p.textContent.includes('Impacto Precio'));if(variantNotice)variantNotice.textContent='El impacto de precio sin IVA se suma al precio base sin IVA del producto. No introduzcas el precio total de venta en esta casilla.';
 const bulk=addVariant.cloneNode(true);action(bulk,'mode');bulk.dataset.mode='bulk';bulk.textContent='Cambios masivos';addVariant.after(bulk);
 for(const [name,title]of [['attribute-group','Nuevo atributo'],['attribute-value','Nuevo valor']]){const b=addVariant.cloneNode(true);action(b,name);b.textContent=title;bulk.after(b);}
 const table=vPanel.querySelector('table'),sample=table.querySelector('tbody tr'),calculationNotice=table.previousElementSibling;table.classList.add('prd-variation-table');table.parentElement.classList.add('prd-table-viewport');
 vPanel.firstElementChild.classList.add('prd-variation-toolbar');
 const nav=document.createElement('div');nav.className='prd-table-navigation';nav.innerHTML='<span>Tab recorre los campos · Alt + flechas cambia de columna</span>'+fieldHelp('Editar combinaciones','Los cambios de las celdas se preparan en el borrador. Pulsa Revisar cambios en tienda para comprobar y guardar las diferencias. Cada combinación conserva su propia verificación.')+'<button type="button" data-pr-action="variant-scroll" data-direction="-1" aria-label="Ver columnas anteriores de variantes">←</button><button type="button" data-pr-action="variant-scroll" data-direction="1" aria-label="Ver columnas siguientes de variantes">→</button>';table.parentElement.before(nav);
 const cellClass=sample?.querySelector('td')?.className||'p-space-sm';
 table.querySelector('thead tr').innerHTML=['Pred.','Color / Atributo','Referencia','EAN-13','Coste sin IVA','Impacto sin IVA','Peso (kg)','Existencias','Mínimo','Imagen','Borrar'].map(x=>'<th class="p-space-sm">'+esc(x)+'</th>').join('');
 table.querySelector('tbody').innerHTML=variants.map(v=>{
  const id=String(v.id||v.draft_key),values=variantOverrides.get(id)||{},selected=record.id?String(record.id_default_combination)===id:String(values.default_on??v.default_on)==='1';
  const input=key=>'<td class="'+esc(cellClass)+'"><input class="'+inputClass+'" aria-label="'+esc((metadata[key]||key)+' · '+(v.reference||id))+'" data-pr-vid="'+esc(id)+'" data-pr-vvalue="'+key+'" value="'+esc(Object.hasOwn(values,key)?values[key]:textValue(v[key]))+'"></td>';
  const imageId=associationIds(v,'images')[0],image=imageId?productPhoto({id_default_image:imageId},store):null;
  return '<tr><td class="'+esc(cellClass)+'"><input type="radio" name="prd-default-variation" aria-label="Usar como predeterminada '+esc(v.reference||id)+'" data-pr-action="variation-default" data-pr-vid="'+esc(id)+'" '+(selected?'checked':'')+'></td><td class="'+esc(cellClass)+'">'+esc((v.__attributeNames||[]).join(' · ')||'Atributos pendientes de comprobar')+'</td>'+['reference','ean13','wholesale_price','price','weight'].map(input).join('')+'<td class="'+esc(cellClass)+'"><button type="button" data-pr-action="stock-stages" data-pr-vid="'+esc(id)+'" aria-label="Ajustar existencias de '+esc(v.reference||id)+'">'+esc(v.__stock?.quantity??'Consultar')+'</button></td>'+input('minimal_quantity')+'<td class="'+esc(cellClass)+'">'+'<button type="button" data-pr-action="variation-images" data-pr-vid="'+esc(id)+'" aria-label="Elegir imágenes de '+esc(v.reference||id)+'">'+(image?'<img src="'+esc(image)+'" class="prd-variant-photo" alt="'+esc(v.reference||id)+'">':'<span class="material-symbols-outlined">add_photo_alternate</span>')+'</button>'+'</td><td class="'+esc(cellClass)+'"><button type="button" data-pr-action="variation-remove" data-pr-vid="'+esc(id)+'" aria-label="Eliminar combinación '+esc(v.reference||id)+'" class="material-symbols-outlined text-error">delete</button></td></tr>';
 }).join('');
 if(calculationNotice&&calculationNotice.tagName==='P')setText(calculationNotice,'El impacto de precio de cada combinación se suma al precio base sin impuestos del producto.');
 // The design photo rail stays in place, but no supplier/demo picture is fabricated.
 const url=productPhoto(record,store),main=f.querySelector('#sticky-main-img'),thumb=f.querySelector('#sticky-header-thumb');
 const photoFrame=main.parentElement,photoCard=photoFrame.parentElement,photoAside=photoCard.parentElement;
 photoFrame.classList.add('prd-fiche-photo-frame');photoCard.classList.add('prd-fiche-photo-card');photoAside.classList.add('prd-fiche-photo-aside');photoAside.parentElement.classList.add('prd-fiche-layout');
 photoFrame.nextElementSibling?.classList.add('prd-fiche-photo-rail');
 photoCard.querySelector('#sticky-pvp-display')?.parentElement.parentElement.classList.add('prd-fiche-facts');
 // Main save and draft actions stay together in the product header, not repeated below a large picture.
 photoCard.lastElementChild?.remove();
 thumb?.classList.add('prd-product-photo');thumb?.parentElement.classList.add('prd-fiche-header-photo');
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
  if(actualIdentity){const picture=actualIdentity.querySelector('img'),slot=identity.firstElementChild,description=identity.lastElementChild;slot.replaceChildren();if(picture){picture.className='prd-product-photo w-full h-full object-contain';slot.append(picture);}else slot.textContent='Sin foto';description.replaceChildren();const name=document.createElement('strong');name.className='font-headline-sm text-headline-sm text-on-surface';name.textContent=actualIdentity.querySelector('strong')?.textContent||'Nueva ficha';const note=document.createElement('span');note.className='font-body-sm text-body-sm text-on-surface-variant';note.textContent=i?'Completa los datos y revisa las coincidencias antes de guardar.':'Selecciona los campos que quieres copiar.';description.append(name,note);}
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
 const toolbar=view.firstElementChild;setText(toolbar.querySelector('h2,h3'),'Cambios y borradores');setText(toolbar.querySelector('p'),'Aquí revisas los cambios antes de enviarlos a cada tienda. Un borrador solo está en Totus; Guardar envía los datos a PrestaShop y verifica el resultado.');
 const purge=toolbar.querySelector('button');action(purge,'draft-purge');purge.textContent='Limpiar borradores antiguos (>30 días)';purge.disabled=!drafts.some(d=>d.canPurge);purge.title=purge.disabled?'No hay borradores de más de 30 días sin operaciones enviadas.':'Elimina solo borradores locales antiguos sin operaciones enviadas.';
 const grid=view.children[1],template=grid.firstElementChild.cloneNode(true);grid.replaceChildren();
 const card=({name,badge,detail,foot,button,actionName,key,shop,id})=>{const row=template.cloneNode(true),top=row.firstElementChild,footer=row.lastElementChild;setText(top.querySelector('.rounded-full'),badge);setText(top.querySelector('.font-data-mono'),shop||'');setText(top.querySelector('h4'),name);setText(top.querySelector('p'),detail);setText(footer.querySelector('span'),foot);const open=footer.querySelector('button');action(open,actionName);open.textContent=button;if(key)open.dataset.prDraftKey=key;if(shop)open.dataset.prShop=shop;if(id)open.dataset.id=id;if(actionName==='mode')open.dataset.mode='ficha';grid.append(row);};
 for(const draft of drafts)card({name:draft.name||'Producto sin nombre',badge:draft.sent?'Operaciones registradas':'Borrador local',detail:(draft.id?'Producto #'+draft.id+' · ':'')+(draft.reference||'Sin referencia')+' · '+draft.changes+' campos seleccionados. '+draft.pendingSteps+' etapas pendientes y '+draft.doneSteps+' guardadas y verificadas.',foot:draft.canPurge?'Antiguo · sin operaciones':'Conservado en esta cuenta',button:'Recuperar ficha',actionName:'draft-open',key:draft.key,shop:draft.shop});
 for(const item of queue)card({name:item.name||item.reference||'Producto #'+item.id,badge:'Copia por revisar',detail:'Revisa los campos y la tienda de destino antes de guardar. No se traslada stock físico automáticamente.',foot:item.reference||'#'+item.id,button:'Revisar copia',actionName:'open-copy-item',shop:item.store,id:item.id});
 if(!drafts.length&&!queue.length){const empty=document.createElement('p');empty.className='font-body-sm text-body-sm text-on-surface-variant';empty.textContent='Sin borradores conservados. Abre una ficha o crea un producto para empezar.';grid.append(empty);}
 if(record&&legacyHtml){const actual=fragment(legacyHtml),previews=actual.querySelector('.prd-preview');if(previews){previews.classList.add('prd-current-save');if(!previews.querySelector('.prd-plan'))previews.innerHTML='<section class="prd-save-start"><h3>'+esc(textValue(record.name)||'Producto seleccionado')+'</h3><p>Revisa los cambios de esta ficha antes de enviarlos a '+esc(record.__store||'la tienda seleccionada')+'. Si todavía no has editado nada, vuelve a Producto.</p><div class="inline-actions"><button type="button" class="btn primary" data-pr-action="fiche-validate">Revisar cambios de esta ficha</button><button type="button" class="btn secondary" data-pr-action="mode" data-mode="ficha">Volver al producto</button></div></section>';grid.before(previews);}}
 adoptDesignControls(view);return serialize(f);
}
