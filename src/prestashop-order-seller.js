// Attribute the native registration, never a later status change or a time-based guess.
export function orderRegistrationEmployee(order,history){
 const rows=history.filter(row=>String(row.id_order)===String(order.id)).sort((a,b)=>Number(a.id)-Number(b.id));
 const first=rows[0];
 if(!first||!order.date_add||first.date_add!==order.date_add||!/^0*[1-9]\d*$/.test(String(first.id_employee||'')))return null;
 const atCreation=rows.filter(row=>row.date_add===order.date_add&&Number(row.id_employee)>0);
 if(new Set(atCreation.map(row=>String(Number(row.id_employee)))).size!==1)return null;
 return String(Number(first.id_employee));
}

export async function loadOrderSellers({orders,store,invoke,current=()=>true,employees=new Map()}){
 const ids=orders.map(order=>String(order.id)),history=[],seen=new Set();
 if(!ids.length)return new Map();
 for(let page=0;;page++){
  if(!current())return null;
  const result=await invoke({resource:'order_histories',order_ids:ids,page,page_size:100,sort:'oldest'});
  if(!current())return null;
  if(!result?.ok||result.store!==store||result.resource!=='order_histories'||result.page!==page||!Array.isArray(result.rows)||result.rows.some(row=>!ids.includes(String(row.id_order))))throw Error('El historial no corresponde a los pedidos consultados.');
  for(const row of result.rows){if(seen.has(String(row.id)))throw Error('El historial cambió entre páginas. Vuelve a consultar.');seen.add(String(row.id));history.push(row);}
  if(!result.possibly_more)break;
  if(!result.rows.length)throw Error('El historial no permite completar la lectura.');
 }
 const result=new Map();
 for(const order of orders){
  const id=orderRegistrationEmployee(order,history);if(!id)continue;
  if(!employees.has(id)){
   const response=await invoke({resource:'employees',record_id:id,page:0,page_size:2});
   if(!current())return null;
   const employee=response?.rows?.[0];
   if(!response?.ok||response.store!==store||response.resource!=='employees'||response.possibly_more||response.rows?.length!==1||String(employee?.id)!==id)throw Error('No se pudo comprobar el empleado del registro.');
   const name=[employee.firstname,employee.lastname].filter(Boolean).join(' ').trim();
   if(name)employees.set(id,name);
  }
  if(employees.has(id))result.set(String(order.id),{id,name:employees.get(id),source:'Empleado del registro inicial en PrestaShop. No identifica necesariamente a la persona física si comparten cuenta.'});
 }
 return result;
}
