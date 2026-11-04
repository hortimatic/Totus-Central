// Shared configuration and notification rules. No model calls or arbitrary actions.
import {PRESTASHOP_QUERY_RECIPES,recipeProducts,detailedRecipe,withinDailyWindow} from './prestashop-queries.js';
import {sourceCents} from './prestashop-insights.js';
export const AUTOMATION_RECIPES=[{id:'online_orders',name:'Nuevos pedidos online',target:'orders'},{id:'sales_summary',name:'Resumen de ventas del periodo',target:'orders'},{id:'missing_ean',name:'Productos sin código EAN',target:'catalog'},...PRESTASHOP_QUERY_RECIPES.filter(r=>r.target)];
export const PRESTA_AUTOMATION_STORES=['hortimatic','newoldsmok'];
const string=v=>String(v??'').trim();
export function validatePrestaAutomation(raw){
 const name=string(raw.name),stores=Array.isArray(raw.stores)?[...new Set(raw.stores)]:[],modules={};
 if(name.length<3||name.length>100||!stores.length||stores.some(s=>!PRESTA_AUTOMATION_STORES.includes(s)))throw Error('Indica el nombre y al menos una tienda.');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(string(raw.channel_id)))throw Error('Elige un canal de avisos.');
 if(![1,2,3,4,6,8,12,24].includes(Number(raw.interval_hours)))throw Error('Elige cada cuántas horas se comprueban los pedidos.');
 const recipe=raw.recipe||'online_orders';if(!AUTOMATION_RECIPES.some(r=>r.id===recipe))throw Error('Elige una consulta disponible.');
 if(recipe==='online_orders')for(const store of stores){const values=raw.online_modules?.[store];if(!Array.isArray(values)||!values.length||values.length>50||values.some(v=>!/^[-a-zA-Z0-9_]{1,100}$/.test(v)))throw Error('Confirma los orígenes online de '+store+' utilizando los pedidos de muestra.');modules[store]=[...new Set(values)].sort();}
 const min_count=Number(raw.min_count??1),period_days=Number(raw.period_days??1),start=raw.daily_start||'00:00',end=raw.daily_end||'23:59';
 const frequency=raw.frequency||'interval',at_time=raw.at_time||'09:00',weekdays=Array.isArray(raw.weekdays)?[...new Set(raw.weekdays.map(Number))]:[1,2,3,4,5];
 if(!['interval','daily','weekly'].includes(frequency)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(at_time)||!weekdays.length||weekdays.some(n=>!Number.isInteger(n)||n<0||n>6))throw Error('Revisa la frecuencia, hora y días de ejecución.');
 if(!Number.isSafeInteger(min_count)||min_count<0||min_count>1000000||!Number.isSafeInteger(period_days)||period_days<1||period_days>365)throw Error('Revisa el umbral y los días de consulta.');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end))throw Error('Revisa el tramo horario.');
 return {name,recipe,min_count,period_days,daily_start:start,daily_end:end,frequency,at_time,weekdays,stores,channel_id:string(raw.channel_id),interval_hours:Number(raw.interval_hours),online_modules:modules,enabled:raw.enabled===true,sharing_confirmed:raw.sharing_confirmed===true};
}
export function onlineOrder(order,modules){
 return Array.isArray(modules)&&typeof order?.module==='string'&&modules.includes(order.module);
}
export function orderOriginSamples(store,rows){
 const groups=new Map();for(const row of rows){const module=string(row.module);if(!module)continue;let g=groups.get(module);if(!g)groups.set(module,g={store,module,payments:[],count:0,examples:[]});g.count++;if(row.payment&&!g.payments.includes(row.payment))g.payments.push(row.payment);if(g.examples.length<3)g.examples.push({id:string(row.id),reference:string(row.reference),date:string(row.date_add),total:string(row.total_paid_tax_incl)});}
 return [...groups.values()].sort((a,b)=>b.count-a.count);
}
const clean=v=>string(v).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/@\{/g,'＠{');
export function prestashopNotice({store,order,lines=[],customer={},address={},currency='',stateName=''}){
 if(!PRESTA_AUTOMATION_STORES.includes(store)||!/^\d{1,15}$/.test(string(order.id))||!order.module)throw Error('Pedido sin identidad u origen verificable.');
 const cents=sourceCents(order.total_paid_tax_incl),amount=cents===null?null:cents/100;if(amount===null||!currency||!/^[A-Z]{3}$/.test(currency))throw Error('Importe o moneda del pedido sin verificar.');
 if(!lines.length||lines.some(l=>String(l.id_order)!==String(order.id)))throw Error('Las líneas del pedido no están completas o pertenecen a otro pedido.');
 const person=[customer.firstname,customer.lastname].map(clean).filter(Boolean).join(' ')||[address.firstname,address.lastname].map(clean).filter(Boolean).join(' ');
 const money=new Intl.NumberFormat('es-ES',{style:'currency',currency}).format(amount);
 const productText=lines.map(l=>{const n=Number(l.product_quantity);if(!Number.isFinite(n)||n<0)throw Error('Cantidad de producto no verificable.');return '• '+n+' × '+clean(l.product_name)+(l.product_reference?' · '+clean(l.product_reference):'');}).join('\n');
 const link=new URL('https://hortimatic.github.io/Totus-Central/');link.searchParams.set('module','prestashop');link.searchParams.set('ps_store',store);link.searchParams.set('ps_order',String(order.id));link.searchParams.set('ps_date',String(order.date_add).slice(0,10));
 const header='PEDIDO ONLINE · '+(store==='hortimatic'?'Hortimatic':'NewOldSmok')+'\nReferencia: '+clean(order.reference||order.id)+' · #'+order.id+'\nFecha: '+clean(order.date_add)+' · Estado: '+clean(stateName||'#'+order.current_state)+'\nTotal: '+money+' · Pago: '+clean(order.payment||order.module)+'\nCliente: '+(person||'Sin nombre informado')+(customer.email?' · '+clean(customer.email):'')+'\nEntrega: '+[address.address1,address.address2,address.postcode,address.city].map(clean).filter(Boolean).join(' · ')+(address.phone_mobile||address.phone?'\nContacto: '+clean(address.phone_mobile||address.phone):'')+'\n\n';
 const footer='\n\nAbrir pedido: '+link.href+'\nAviso automático · solo lectura · no confirma preparación ni modifica el pedido.';
 const max=12000-header.length-footer.length;if(max<200)throw Error('Datos del pedido demasiado extensos.');
 return header+(productText.length>max?productText.slice(0,max-80)+'\n…Consulta el pedido para ver todas sus líneas.':productText)+footer;
}

export async function automationResult(rule,store,window,{read,onOrder=async()=>{},seen=[]}){
 const recipe=AUTOMATION_RECIPES.find(r=>r.id===rule.recipe);if(!recipe)throw Error('Consulta no disponible.');
 const scan=async(resource,extra={})=>{const rows=[],ids=new Set();for(let page=0;page<=1000;page++){const result=await read(resource,{page,page_size:100,...extra});if(!result?.ok||result.store!==store||result.resource!==resource||result.page!==page||!Array.isArray(result.rows))throw Error('Respuesta incompleta o de otra tienda.');for(const row of result.rows){if(ids.has(String(row.id)))throw Error('La paginación ha repetido registros; no se da la consulta por completa.');ids.add(String(row.id));rows.push(row);}if(!result.possibly_more)return rows;}throw Error('Consulta pendiente: continúa en la siguiente ejecución.');};
 const detail=async(resource,id)=>{if(!/^\d{1,15}$/.test(String(id||'')))return {};const r=await read(resource,{page:0,page_size:1,record_id:String(id)});if(!r?.ok||r.store!==store||r.resource!==resource||!Array.isArray(r.rows)||r.rows.some(x=>String(x.id)!==String(id)))throw Error('Detalle de otro registro o tienda.');return r.rows[0]||{};};
 if(rule.recipe==='online_orders'){
  const orders=await scan('orders',{from:window.from,to:window.to,sort:'oldest'});let delivered=0,unknown=0;
  for(const order of orders){if(!order.module){unknown++;continue;}if(!onlineOrder(order,rule.online_modules?.[store])||seen.includes(String(order.id)))continue;
   const lines=await scan('order_details',{order_id:String(order.id)}),customer=await detail('customers',order.id_customer),address=await detail('addresses',order.id_address_delivery),currency=await detail('currencies',order.id_currency),state=await detail('order_states',order.current_state);
   await onOrder(order,prestashopNotice({store,order,lines,customer,address,currency:currency.iso_code,stateName:state.name}));delivered++;
  }
  return {count:delivered,scanned:orders.length,unknown,body:null};
 }
 const data={};for(const resource of recipe.resources||[recipe.target==='orders'?'orders':'products'])data[resource]=await scan(resource,resource==='orders'?{from:window.report_from||window.from,to:window.to}:{});
 let rows,summary='';
 if(recipe.target==='orders'){
  rows=data.orders.filter(r=>rule.recipe!=='sales_window'||withinDailyWindow(r.date_add,rule.daily_start+':00',rule.daily_end+':59'));const totals=new Map();let unverified=0;
  for(const row of rows){if(row.valid!=='1'){unverified++;continue;}const c=await detail('currencies',row.id_currency),n=sourceCents(row.total_paid_tax_incl);if(!/^[A-Z]{3}$/.test(c.iso_code||'')||n===null){unverified++;continue;}totals.set(c.iso_code,(totals.get(c.iso_code)||0)+n);}
  summary=[...totals].map(([code,n])=>new Intl.NumberFormat('es-ES',{style:'currency',currency:code}).format(n/100)).join(' · ')+'\nPedidos no válidos o sin importe/moneda verificados: '+unverified;
 }else rows=rule.recipe==='missing_ean'?data.products.filter(p=>!String(p.ean13||'').trim()):detailedRecipe(rule.recipe,data)||recipeProducts(data.products,rule.recipe);
 const header=clean(rule.name)+' · '+store+'\n'+recipe.name+'\nPeriodo: '+(window.report_from||window.from)+' — '+window.to+'\nResultados: '+rows.length+'\n'+summary;
 const body=(header+'\n\n'+rows.slice(0,100).map(r=>'• '+clean(r.name||r.reference||'#'+r.id)+(r.detail?' · '+clean(r.detail):'')).join('\n')+(rows.length>100?'\nVista resumida: consulta el módulo para el listado completo.':'')+'\n\nAviso automático · consulta completa · sin cambios de stock ni contabilidad.').slice(0,12000);
 return {count:rows.length,scanned:Object.values(data).reduce((n,r)=>n+r.length,0),body:rows.length>=rule.min_count?body:null};
}
