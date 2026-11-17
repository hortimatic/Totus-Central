import {columnSettingsRow,columnSettingsCaption,standardizeColumnPanel,positionColumnPanel} from '../column-settings.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number.isSafeInteger(value)?new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100):'—';
export const TPV_COLUMNS=Object.freeze({photo:{label:'Foto',width:64},name:{label:'Nombre',width:220,sort:'name'},
 reference:{label:'Referencia',width:150,sort:'reference'},barcode:{label:'Código de barras',width:150},
 stock:{label:'Existencias',width:100,sort:'stock'},price:{label:'PVP con IVA',width:110,sort:'price'},netPrice:{label:'Precio sin IVA',width:120},
 manufacturer:{label:'Marca',width:140,sort:'manufacturer'},supplier:{label:'Proveedor',width:140,sort:'supplier'},
 cost:{label:'Coste base del producto',width:150,sort:'cost'},id:{label:'ID',width:110,sort:'id'}});
export const DEFAULT_TPV_COLUMNS=Object.freeze(['photo','name','reference','stock','price']);
export function priceBuildHtml(progress){return `<section class="tpv-price-build" role="status"><strong>Ordenando el catálogo por precio</strong><p>Calculando precios de la tienda: ${progress.done} de ${progress.total} artículos.</p><progress max="${Math.max(1,progress.total)}" value="${progress.done}" aria-label="Preparando ordenación por precio"></progress><p class="small muted">Mostraremos el resultado cuando estén ordenados todos los artículos. Puedes cambiar la búsqueda mientras tanto.</p><button type="button" class="btn secondary" data-tpv-sort="name">Volver al orden por nombre</button></section>`;}
export function tpvColumns(value){const keys=Array.isArray(value)?[...new Set(value.filter(k=>Object.hasOwn(TPV_COLUMNS,k)))]:[...DEFAULT_TPV_COLUMNS];
 if(!keys.includes('name'))keys.unshift('name');return keys;}
export function createCatalogueTable({canReadCost=()=>false}={}){
 let columns=[...DEFAULT_TPV_COLUMNS],draft=[...columns],host=null,abort=null;
 function setColumns(value){columns=tpvColumns(value).filter(k=>k!=='cost'||canReadCost());draft=[...columns];}
 function panelHtml(){const choices=[...draft,...Object.keys(TPV_COLUMNS).filter(k=>!draft.includes(k))].filter(k=>k!=='cost'||canReadCost());return `<label>Buscar columnas<input type="search" data-tpv-column-search placeholder="Nombre de columna"></label><div>${choices.map(key=>columnSettingsRow({key,label:TPV_COLUMNS[key].label,selected:draft.includes(key),locked:key==='name',index:draft.indexOf(key),count:draft.length,
  check:{'data-tpv-column-check':key},position:{'data-tpv-column-position':key},grip:null})).join('')}</div><button type="button" class="btn secondary" data-tpv-columns-save>Guardar distribución</button><button type="button" class="btn secondary" data-tpv-columns-reset>Restablecer columnas</button>`;}
 function settingsHtml(){return `<details class="prd-columns tc-columns tpv-columns"><summary>${columnSettingsCaption(columns.length)}</summary><div data-tpv-columns-panel>${panelHtml()}</div></details>`;}
 function redrawPanel(){const panel=host?.querySelector('[data-tpv-columns-panel]');if(!panel)return;panel.innerHTML=panelHtml();standardizeColumnPanel(panel);positionColumnPanel(panel,panel.parentElement.querySelector('summary'));}
 function mount(root){abort?.abort();host=root;abort=new AbortController();const details=host.querySelector('.tpv-columns');if(!details)return;
  details.addEventListener('toggle',()=>{const panel=details.querySelector('[data-tpv-columns-panel]');if(details.open){draft=[...columns];redrawPanel();}
   else if(panel.matches(':popover-open'))panel.hidePopover();},{signal:abort.signal});
 }
 function dispose(){abort?.abort();host=null;}
 function cell(key,row){if(key==='photo')return row.imageUrl?`<img src="${esc(row.imageUrl)}" alt="" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'—';
  if(key==='price')return money(row.priceCents);if(key==='netPrice')return money(row.netPriceCents);if(key==='cost')return money(row.costCents);
  if(key==='stock'&&row.chooseVariant)return 'Por variante';
  return esc(({id:row.nativeProductId,name:row.name,reference:row.reference,barcode:row.barcode||row.upc,stock:row.stock,manufacturer:row.manufacturer,supplier:row.supplier})[key]??'—');}
 function tableHtml(items,{sortField='name',sortDirection='asc',canSelect=true,stock=false}={}){return `<div class="tpv-table-scroll"><table class="data-table tpv-catalogue-table" data-tc-columns-managed style="min-width:${columns.reduce((n,k)=>n+TPV_COLUMNS[k].width,0)+90}px"><colgroup>${columns.map(k=>`<col style="width:${TPV_COLUMNS[k].width}px">`).join('')}<col style="width:90px"></colgroup><thead><tr>${columns.map(key=>{const c=TPV_COLUMNS[key],active=c.sort===sortField;return `<th scope="col" ${c.sort?`aria-sort="${active?(sortDirection==='asc'?'ascending':'descending'):'none'}"`:''}>${c.sort?`<button type="button" data-tpv-sort="${c.sort}" title="Ordenar todos los resultados por ${esc(c.label)}">${esc(c.label)} ${active?(sortDirection==='asc'?'↑':'↓'):'↕'}</button>`:esc(c.label)}</th>`;}).join('')}<th scope="col">Acción</th></tr></thead><tbody>${items.map(row=>`<tr>${columns.map(k=>`<td data-tpv-column="${k}">${cell(k,row)}</td>`).join('')}<td><button type="button" class="btn secondary" ${stock?'data-tpv-stock':'data-tpv-add'}="${esc(row.id)}" ${!canSelect||!stock&&!row.chooseVariant&&row.stock<=0?'disabled':''}>${row.chooseVariant?'Variantes':'Añadir'}</button></td></tr>`).join('')||`<tr><td colspan="${columns.length+1}">No hay artículos con esta búsqueda.</td></tr>`}</tbody></table></div>`;}
 const html=(items,options)=>items.building?priceBuildHtml(items.building):tableHtml(items,options);
 return Object.freeze({setColumns,settingsHtml,html,mount,dispose,columns:()=>[...columns],draft:()=>[...draft],
  click(target){const row=target.closest('[data-column-key]');if(target.hasAttribute('data-tc-column-step')&&row){const key=row.dataset.columnKey,index=draft.indexOf(key),next=index+Number(target.dataset.tcColumnStep);if(index>=0&&next>=0&&next<draft.length){draft.splice(index,1);draft.splice(next,0,key);redrawPanel();}return true;}
   if(target.hasAttribute('data-tpv-columns-reset')){draft=[...DEFAULT_TPV_COLUMNS];redrawPanel();return true;}return false;},
  change(target){const key=target.dataset.tpvColumnCheck;if(key){if(target.checked&&!draft.includes(key))draft.push(key);else if(!target.checked&&key!=='name')draft=draft.filter(k=>k!==key);redrawPanel();return true;}
   const move=target.dataset.tpvColumnPosition;if(move){const index=draft.indexOf(move),next=Number(target.value);if(index>=0&&Number.isInteger(next)&&next>=0&&next<draft.length){draft.splice(index,1);draft.splice(next,0,move);redrawPanel();}return true;}return false;},
  input(target){if(!target.hasAttribute('data-tpv-column-search'))return false;const q=target.value.trim().toLocaleLowerCase('es');
   for(const row of host.querySelectorAll('[data-tpv-columns-panel] [data-column-key]'))row.hidden=!TPV_COLUMNS[row.dataset.columnKey].label.toLocaleLowerCase('es').includes(q);return true;}
 });
}
