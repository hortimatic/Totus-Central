/** Existing Central identities and RLS only; no local shop/user master. */
export function createTpvConfigurationReader({actor,rpc,readDrawers,readOperators,readAssignments}){
 return async()=>{const owner=actor()?.id;if(!owner)throw Error('Vuelve a entrar en tu cuenta.');
  const [manager,context,drawers,operators]=await Promise.all([rpc('totus_api_manager',{}),rpc('totus_sales_context',{}),readDrawers(),readOperators()]);
  if(actor()?.id!==owner)throw Error('La sesión ha cambiado.');
  const website=context.websites?.find(row=>row.origin==='https://preproduccion.hortimatic.com'&&row.status==='active'),
   connection=manager.connections?.find(row=>row.id===website?.connection_id);
  if(!connection?.id||!Number.isSafeInteger(connection.revision))throw Error('Verifica la conexión de preproducción en APIs antes de configurar el puesto.');
  let accesses=null;
  if(readAssignments){const data=await readAssignments({connectionId:connection.id,revision:connection.revision});
   if(actor()?.id!==owner)throw Error('La sesión ha cambiado.');
   if(data?.connectionId!==connection.id||data.revision!==connection.revision||!Array.isArray(data.items)||data.items.length>2000)
    throw Error('No se han podido comprobar todos los accesos de caja. Actualiza la configuración.');
   accesses=data.items.map(row=>{
    if(!row||!['operatorId','drawerId','storeId','operatorName','drawerName','storeName'].every(key=>typeof row[key]==='string')||
     !Number.isSafeInteger(row.shopId)||row.shopId<=0||!Number.isSafeInteger(row.revision)||row.revision<=0||
     !['active','operatorActive','drawerActive'].every(key=>typeof row[key]==='boolean')||
     !['sell','open','reconcile'].every(key=>typeof row.permissions?.[key]==='boolean'))throw Error('Un acceso no se ha podido comprobar. Actualiza la configuración.');
    return Object.fromEntries(['operatorId','drawerId','storeId','operatorName','drawerName','storeName','shopId','revision','active','operatorActive','drawerActive','permissions'].map(key=>[key,
     key==='permissions'?Object.fromEntries(['sell','open','reconcile'].map(name=>[name,row.permissions[name]])):row[key]]));
   });
  }
  const sorted=rows=>[...rows].sort((a,b)=>(a.name||a.full_name||a.id).localeCompare(b.name||b.full_name||b.id,'es',{numeric:true}));
  return {connectionId:connection.id,revision:connection.revision,origin:website.origin,stores:sorted(context.businesses),
   drawers:sorted(drawers.filter(row=>row.active)),operators:sorted(operators.filter(row=>row.active)),actorId:owner,accesses};
 };
}
