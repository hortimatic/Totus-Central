/** Existing Central identities and RLS only; no local shop/user master. */
export function createTpvConfigurationReader({actor,rpc,readDrawers,readOperators}){
 return async()=>{const owner=actor()?.id;if(!owner)throw Error('Vuelve a entrar en tu cuenta.');
  const [manager,context,drawers,operators]=await Promise.all([rpc('totus_api_manager',{}),rpc('totus_sales_context',{}),readDrawers(),readOperators()]);
  if(actor()?.id!==owner)throw Error('La sesión ha cambiado.');
  const website=context.websites?.find(row=>row.origin==='https://preproduccion.hortimatic.com'&&row.status==='active'),
   connection=manager.connections?.find(row=>row.id===website?.connection_id);
  if(!connection?.id||!Number.isSafeInteger(connection.revision))throw Error('Verifica la conexión de preproducción en APIs antes de configurar el puesto.');
  const sorted=rows=>[...rows].sort((a,b)=>(a.name||a.full_name||a.id).localeCompare(b.name||b.full_name||b.id,'es',{numeric:true}));
  return {connectionId:connection.id,revision:connection.revision,origin:website.origin,stores:sorted(context.businesses),
   drawers:sorted(drawers.filter(row=>row.active)),operators:sorted(operators.filter(row=>row.active)),actorId:owner};
 };
}
