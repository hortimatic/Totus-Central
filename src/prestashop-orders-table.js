import {esc,csv,download} from './utils.js';
import {fieldHelp} from './components.js';
import {attachProductTableLayout} from './productos-table-layout.js';

export const ORDER_COLUMNS=Object.freeze([
 ['id','Pedido',110],['reference','Referencia',160],['images','Productos',150],
 ['customer','Cliente',140],['total','Total',125],['payment','Pago',150],
 ['state','Estado',150],['date','Fecha y hora',170],['invoice','Factura origen',135],
 ['employee','Atendido por',150],['time','Hora',100],['margin','Margen €',140],['shipping','Envío',120],['discount','Descuento',120]
]);
const defaults=['id','reference','images','customer','total','payment','state','date','employee','margin'];
const known=new Set(ORDER_COLUMNS.map(([key])=>key));
const validColumns=value=>{const list=Array.isArray(value)?[...new Set(value.filter(key=>known.has(key)))]:defaults;return list.includes('id')?list:['id',...list];};
export const orderDefaultWidth=key=>ORDER_COLUMNS.find(([id])=>id===key)?.[2]||120;
export function createOrdersTablePreferences(storage,owner){
 const key='totus-orders-table:'+owner;
 let saved={};try{saved=JSON.parse(storage.getItem(key)||'{}');}catch{}
 const state={density:saved.density==='compact'?'compact':'comfortable',pageSize:['10','20','50','100','all'].includes(saved.pageSize)?saved.pageSize:'20',viewName:typeof saved.viewName==='string'?saved.viewName:'',columns:validColumns(saved.columns),widths:{},sort:known.has(saved.sort)?saved.sort:'date',direction:saved.direction===1?1:-1,views:Array.isArray(saved.views)?saved.views.filter(v=>typeof v.name==='string').slice(0,20):[]};
 for(const [key,value]of Object.entries(saved.widths||{}))if(known.has(key)&&Number.isFinite(value)&&value>=80&&value<=640)state.widths[key]=Math.round(value);
 return {state,save(){try{storage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}};
}
export function orderSortValue(row,key){
 return ({customer:row.customer_name||row.id_customer,employee:row.employee_name||'',time:String(row.date_add||'').split(' ')[1]||'',margin:row.margin_value??'',total:Number(row.total_paid_tax_incl),state:row.current_state,date:row.date_add,invoice:row.invoice_number,shipping:Number(row.total_shipping_tax_incl),discount:Number(row.total_discounts_tax_incl)})[key]??row[key]??'';
}
export function sortOrderRows(rows,state){
 return [...rows].sort((a,b)=>{const left=orderSortValue(a,state.sort),right=orderSortValue(b,state.sort);return state.direction*(typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),'es',{numeric:true}));});
}
const action=(name,label,extra='')=>'<button type="button" data-ps-table-action="'+name+'" '+extra+'>'+esc(label)+'</button>';
export function renderOrdersTable({rows,layout,selected,opened,store,cell,detail,busy=false}){
 const columns=layout.columns,widths=columns.map(key=>layout.widths[key]||orderDefaultWidth(key)),title=key=>ORDER_COLUMNS.find(([id])=>id===key)[1];
 const settings='<details class="prd-columns ps-order-columns"><summary aria-label="Configurar columnas de pedidos">⚙ Columnas · '+columns.length+'</summary><div><label>Buscar columna<input type="search" data-ps-order-column-search placeholder="Nombre de columna"></label><p>Arrastra para ordenar o elige una posición. Ajusta el ancho desde la cabecera.</p>'+[...columns,...ORDER_COLUMNS.map(([key])=>key).filter(key=>!columns.includes(key))].map(key=>'<div class="prd-column-option" data-pr-column-option="'+key+'"><label><input type="checkbox" data-ps-order-column="'+key+'" '+(columns.includes(key)?'checked':'')+' '+(key==='id'?'disabled':'')+'>'+esc(title(key))+'</label>'+(columns.includes(key)?'<button type="button" class="prd-column-grip" draggable="true" data-pr-column-drag="'+key+'" aria-label="Mover '+esc(title(key))+'">⠿</button><select data-ps-order-position="'+key+'" data-pr-column-position="'+key+'" aria-label="Posición de '+esc(title(key))+'">'+columns.map((_,i)=>'<option value="'+i+'" '+(columns.indexOf(key)===i?'selected':'')+'>'+(i+1)+'</option>').join('')+'</select>':'')+'</div>').join('')+'<div class="ps-order-view-save"><label>Nombre de vista<input data-ps-order-view-name maxlength="60"></label><select data-ps-order-view aria-label="Vista de pedidos"><option value="">Personalizada</option>'+layout.views.map(v=>'<option '+(layout.viewName===v.name?'selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select>'+action('view-save','Guardar vista')+action('view-remove','Eliminar vista')+action('reset','Restablecer columnas')+'</div><p role="status" data-ps-order-layout-status>Configuración personal guardada automáticamente en este navegador.</p></div></details>';
 const table='<div class="ps-orders-table-navigation"><span>'+selected.size+' seleccionados</span>'+fieldHelp('Columnas de pedidos','Selecciona, ordena y ajusta anchos como en Productos. Los datos son de lectura; para emitir una factura utiliza Preparar factura.')+action('left','←','aria-label="Ver columnas anteriores de pedidos"')+action('right','→','aria-label="Ver columnas siguientes de pedidos"')+'</div><div class="ps-orders-table-viewport" tabindex="0" aria-label="Tabla de pedidos. Usa las flechas para recorrer celdas."><table class="prd-data-table ps-orders-table" style="width:'+(40+widths.reduce((a,b)=>a+b,0))+'px;min-width:'+(40+widths.reduce((a,b)=>a+b,0))+'px"><colgroup><col style="width:40px">'+columns.map((key,i)=>'<col data-pr-width-column="'+key+'" style="width:'+widths[i]+'px">').join('')+'</colgroup><thead><tr><th><input type="checkbox" data-ps-order-select-page aria-label="Seleccionar página de pedidos" '+(rows.length&&rows.every(row=>selected.has(String(row.id)))?'checked':'')+'></th>'+columns.map((key,i)=>'<th><button type="button" data-ps-table-action="sort" data-key="'+key+'" '+(key==='images'?'disabled':'')+'>'+esc(title(key))+(layout.sort===key?(layout.direction===1?' ↑':' ↓'):'')+'</button><span class="prd-column-resizer" tabindex="0" role="separator" aria-orientation="vertical" aria-label="Ancho de '+esc(title(key))+'" data-pr-resize-column="'+key+'" aria-valuemin="80" aria-valuemax="640" aria-valuenow="'+widths[i]+'"></span></th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr data-ps-order-row="'+esc(row.id)+'"><td><input type="checkbox" data-ps-order-select="'+esc(row.id)+'" aria-label="Seleccionar pedido '+esc(row.id)+'" '+(selected.has(String(row.id))?'checked':'')+'></td>'+columns.map(key=>'<td tabindex="0" data-label="'+esc(title(key))+'">'+(key==='id'?'<button type="button" data-ps-table-action="expand" data-id="'+esc(row.id)+'" aria-expanded="'+opened.has(store+'|'+row.id)+'" aria-label="Ver pedido '+esc(row.id)+'">'+(opened.has(store+'|'+row.id)?'⌄':'›')+' #'+esc(row.id)+'</button>':cell(row,key))+'</td>').join('')+'</tr>'+(opened.has(store+'|'+row.id)?'<tr class="ps-order-expanded" data-ps-order="'+esc(row.id)+'"><td colspan="'+(columns.length+1)+'">'+detail(row)+'</td></tr>':'')).join('')+'</tbody></table></div>';
 return '<section class="ps-orders-grid" aria-label="Pedidos consultados"><div class="ps-order-table-tools">'+settings+action('export','Exportar CSV',busy?'disabled':'')+action('clear-selection','Limpiar selección')+'</div>'+table+'</section>';
}
export function attachOrdersTable(root,{preferences,selected,rows,render,onExpand}){
 const abort=new AbortController(),{state,save}=preferences;
 const viewport=root.querySelector('.ps-orders-table-viewport');
 const navigation=()=>{if(!viewport)return;const max=viewport.scrollWidth-viewport.clientWidth;for(const [action,disabled]of [['left',viewport.scrollLeft<=1],['right',max<=1||viewport.scrollLeft>=max-1]]){const button=root.querySelector('[data-ps-table-action="'+action+'"]');if(button)button.disabled=disabled;}};
 const persist=()=>{const ok=save(),note=root.querySelector('[data-ps-order-layout-status]');if(note)note.textContent=ok?'Configuración personal guardada automáticamente.':'No se pudo guardar la configuración en este navegador.';};
 const move=(key,index)=>{const from=state.columns.indexOf(key);if(from<0)return;state.columns.splice(from,1);state.columns.splice(Math.max(0,Math.min(state.columns.length,index)),0,key);persist();render();};
 const cleanup=attachProductTableLayout(root,{defaultWidth:orderDefaultWidth,onWidth:(key,width)=>{if(width===null)delete state.widths[key];else state.widths[key]=width;persist();navigation();},onMove:move,onFinish:render});
 viewport?.addEventListener('scroll',navigation,{passive:true,signal:abort.signal});navigation();
 root.addEventListener('input',event=>{if(event.target.matches('[data-ps-order-column-search]'))for(const row of root.querySelectorAll('[data-pr-column-option]'))row.hidden=!row.textContent.toLocaleLowerCase('es').includes(event.target.value.toLocaleLowerCase('es'));},{signal:abort.signal});
 root.addEventListener('change',event=>{
  const el=event.target;
  if(el.hasAttribute('data-ps-order-column')){state.columns=validColumns(el.checked?[...state.columns,el.dataset.psOrderColumn]:state.columns.filter(key=>key!==el.dataset.psOrderColumn));persist();render();}
  if(el.hasAttribute('data-ps-order-position'))move(el.dataset.psOrderPosition,Number(el.value));
  if(el.hasAttribute('data-ps-order-select')){el.checked?selected.add(el.dataset.psOrderSelect):selected.delete(el.dataset.psOrderSelect);render();}
  if(el.hasAttribute('data-ps-order-select-page')){for(const row of root.querySelectorAll('[data-ps-order-select]'))el.checked?selected.add(row.dataset.psOrderSelect):selected.delete(row.dataset.psOrderSelect);render();}
  if(el.hasAttribute('data-ps-order-view')){const view=state.views.find(v=>v.name===el.value);if(view){state.viewName=view.name;state.columns=validColumns(view.columns);state.widths={...view.widths};persist();render();}}
 },{signal:abort.signal});
 root.addEventListener('click',event=>{
  const el=event.target.closest('[data-ps-table-action]');if(!el)return;
  const action=el.dataset.psTableAction;
  if(action==='sort'){state.direction=state.sort===el.dataset.key?-state.direction:1;state.sort=el.dataset.key;persist();render();}
  if(action==='expand')onExpand(el.dataset.id);
  if(action==='clear-selection'){selected.clear();render();}
  if(action==='left'||action==='right')root.querySelector('.ps-orders-table-viewport')?.scrollBy({left:(action==='left'?-1:1)*260,behavior:'smooth'});
  if(action==='reset'){state.columns=[...defaults];state.widths={};persist();render();}
  if(action==='view-save'){const name=root.querySelector('[data-ps-order-view-name]').value.trim().slice(0,60);if(!name)return;state.views=state.views.filter(v=>v.name!==name);state.viewName=name;state.views.push({name,columns:[...state.columns],widths:{...state.widths}});persist();render();}
  if(action==='view-remove'){const name=root.querySelector('[data-ps-order-view]').value;if(name){state.views=state.views.filter(v=>v.name!==name);state.viewName='';persist();render();}}
  if(action==='export'){const list=rows().filter(row=>!selected.size||selected.has(String(row.id)));download(new Blob(['\ufeff'+csv(list,state.columns.filter(key=>key!=='images').map(key=>({label:ORDER_COLUMNS.find(([id])=>id===key)[1],get:row=>orderSortValue(row,key)})))],{type:'text/csv;charset=utf-8'}),'pedidos-consultados.csv');}
 },{signal:abort.signal});
 root.addEventListener('keydown',event=>{if(event.target.tagName!=='TD'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;const cell=event.target,row=cell.parentElement,list=[...row.parentElement.querySelectorAll('tr[data-ps-order-row]')],direction=event.key;const target=direction==='ArrowLeft'?cell.previousElementSibling:direction==='ArrowRight'?cell.nextElementSibling:list[list.indexOf(row)+(direction==='ArrowUp'?-1:1)]?.children[cell.cellIndex];if(target){event.preventDefault();target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',inline:'nearest'});}},{signal:abort.signal});
 return ()=>{abort.abort();cleanup();};
}
