import {textValue} from './productos-core.js';
export const MOVEMENT_COLUMNS=Object.freeze({date:'Fecha y hora',kind:'Movimiento',quantity:'Unidades',reference:'Referencia',variant:'Variación',employee:'Empleado',order:'Pedido',reason:'Motivo',cost:'Coste unit.',id:'ID'});
export const DEFAULT_MOVEMENT_COLUMNS=Object.freeze(['date','kind','quantity','reference','variant','employee','order','id']);
const id=value=>/^[1-9]\d{0,14}$/.test(String(value));
export function movementRow(row,{product,stocks,reasons=[],variants=[]}){
 const stock=stocks.find(s=>String(s.id)===String(row.id_stock));
 if(!stock||String(stock.id_product)!==String(product.id)||!id(row.id))throw Error('Movimiento ajeno al producto seleccionado.');
 const quantity=Number(row.physical_quantity),sign=Number(row.sign);
 if(!Number.isSafeInteger(quantity)||quantity<0||![1,-1].includes(sign))throw Error('El movimiento no contiene una cantidad firmada válida.');
 const variant=variants.find(v=>String(v.id)===String(stock.id_product_attribute)),reason=reasons.find(r=>String(r.id)===String(row.id_stock_mvt_reason));
 return {id:String(row.id),date:String(row.date_add||''),kind:sign>0?'Entrada':'Salida',quantity:sign*quantity,reference:textValue(variant?.reference||product.reference),variant:variant?textValue(variant.reference)||'#'+variant.id:String(stock.id_product_attribute)==='0'?'Producto simple':'#'+stock.id_product_attribute,employee:[row.employee_firstname,row.employee_lastname].filter(Boolean).join(' ')|| (id(row.id_employee)?'Empleado #'+row.id_employee:'Automático / no informado'),order:id(row.id_order)?String(row.id_order):'—',reason:textValue(reason?.name)||'Motivo #'+row.id_stock_mvt_reason,cost:row.price_te==null?'—':String(row.price_te),stock_id:String(stock.id)};
}
export function movementLayout(input={}){
 const columns=Array.isArray(input.columns)?[...new Set(input.columns.filter(k=>MOVEMENT_COLUMNS[k]))]:[...DEFAULT_MOVEMENT_COLUMNS];
 if(!columns.includes('id'))columns.push('id');
 return {columns,widths:Object.fromEntries(Object.entries(input.widths||{}).filter(([key,value])=>MOVEMENT_COLUMNS[key]&&Number.isFinite(value)&&value>=80&&value<=700)),size:['10','20','50','100','all'].includes(String(input.size))?String(input.size):'20'};
}
// Native StockMvt exposes id_stock, not id_product. Resolve StockAvailable first.
// Each stock batch has its own cursor. Never scan an entire shop or infer receipts.
export function createMovementReader(invoke){
 let generation=0,scope=null,groups=[],seen=new Set();
 const valid=stamp=>{if(stamp!==generation)throw Error('La consulta de movimientos pertenece a otra ficha.');};
 return {
  cancel(){generation++;scope=null;groups=[];seen.clear();},
  async open({store,product,variants=[],from='',to=''}){
   const stamp=++generation;scope={store,product,variants,stocks:[],reasons:[]};groups=[];seen=new Set();
   if(!id(product?.id))throw Error('Guarda el producto antes de consultar movimientos.');
   for(let page=0;;page++){
    const result=await invoke(store,'prestashop_read',{resource:'stock_availables',product_ids:[String(product.id)],page,page_size:100,sort:'newest'});valid(stamp);
    if(!Array.isArray(result.rows)||result.rows.some(row=>!id(row.id)||String(row.id_product)!==String(product.id)))throw Error('Existencias de otro producto.');
    if(result.rows.some(row=>String(row.depends_on_stock)==='1'))throw Error('Este producto usa almacén avanzado. Sus movimientos requieren un perfil de almacén; no se mezclan con las existencias normales.');
    scope.stocks.push(...result.rows);if(!result.possibly_more)break;if(!result.rows.length||page>=1000)throw Error('No se pudo completar el catálogo de existencias.');
   }
   if(new Set(scope.stocks.map(row=>String(row.id))).size!==scope.stocks.length)throw Error('Existencias duplicadas en la respuesta.');
   const stockIds=scope.stocks.map(row=>String(row.id));
   for(let i=0;i<stockIds.length;i+=100)groups.push({ids:stockIds.slice(i,i+100),page:0,more:true,buffer:[],period:from&&to?{from:from+' 00:00:00',to:to+' 23:59:59'}:{}});
   // Reason labels are optional metadata; the native ID remains visible if denied.
   try{for(let page=0;;page++){const result=await invoke(store,'prestashop_read',{resource:'stock_movement_reasons',page,page_size:100});valid(stamp);scope.reasons.push(...result.rows);if(!result.possibly_more)break;if(!result.rows.length||page>=1000)break;}}catch(error){valid(stamp);scope.reasonWarning='Nombres de motivos no disponibles; se muestran sus IDs.';}
   return {stocks:scope.stocks.length,warning:scope.reasonWarning||''};
  },
  async next(count=20){
   if(!scope)throw Error('Consulta primero los movimientos de esta ficha.');
   if(!Number.isSafeInteger(count)||count<1||count>100)throw Error('Tamaño de página no válido.');
   const stamp=generation,rows=[];
   while(rows.length<count){
    await Promise.all(groups.filter(group=>!group.buffer.length&&group.more).map(async group=>{
     const result=await invoke(scope.store,'prestashop_read',{resource:'stock_movements',stock_ids:group.ids,page:group.page,page_size:100,sort:'newest',...group.period});valid(stamp);
     if(!Array.isArray(result.rows))throw Error('La API no ha devuelto movimientos verificables.');
     group.buffer=result.rows.map(row=>movementRow(row,scope));group.more=result.possibly_more;group.page++;
     if(group.more&&!group.buffer.length)throw Error('La paginación de movimientos no avanza.');
    }));valid(stamp);
    const candidates=groups.filter(group=>group.buffer.length);if(!candidates.length)break;
    const group=candidates.sort((a,b)=>Number(b.buffer[0].id)-Number(a.buffer[0].id))[0],row=group.buffer.shift();
    if(seen.has(row.id))throw Error('La API repitió un movimiento entre páginas. Actualiza la consulta.');seen.add(row.id);rows.push(row);
   }
   return {rows,possibly_more:groups.some(group=>group.more||group.buffer.length)};
  }
 };
}
