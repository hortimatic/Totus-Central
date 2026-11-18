/** Persist the full prepared sale before attempting its existing checkout. */
export async function submitWithLocalReceipt({journal,operationId,ticket,submit,isCurrent,isOnline=()=>globalThis.navigator?.onLine!==false}){
 const guard=()=>{if(!isCurrent())throw Error('La sesión ha cambiado. Revisa las ventas pendientes antes de continuar.');};
 guard();const saved=await journal.capture({id:operationId,ticket});guard();
 if(!isOnline()){
  if(saved.status!=='queued')throw Error('Esta venta ya se intentó enviar. Recupera su resultado sin volver a cobrar.');
  return {id:operationId,status:'uncertain',localQueued:true,reference:'Ticket '+operationId.slice(0,8),totalCents:ticket.totalCents,
   changeCents:ticket.payments.filter(row=>row.method==='cash').reduce((sum,row)=>sum+(row.receivedCents??row.amountCents)-row.amountCents,0)};
 }
 const claimed=await journal.claim(operationId,saved.revision);guard();
 if(!claimed.won)throw Error('Esta venta ya está guardada. Recupera su resultado desde las ventas pendientes; no vuelvas a cobrarla.');
 let result;
 try{result=await submit();}catch{
  await journal.settle(operationId,claimed.record.revision,{status:'uncertain',remoteOperationId:operationId});
  guard();
  // The request may already have created an order. Leave the payment form and
  // recover this exact operation instead of inviting a second confirmation.
  return {id:operationId,status:'uncertain',reference:'Ticket '+operationId.slice(0,8),totalCents:ticket.totalCents};
 }
 // Retain the record even if the operator left while the network was in flight.
 const confirmed=result?.id===operationId&&result.status==='confirmed'&&result.totalCents===ticket.totalCents;
 const status=confirmed?'synced':'uncertain';
 await journal.settle(operationId,claimed.record.revision,{status,remoteOperationId:operationId});
 guard();
 if(confirmed||result?.id===operationId&&result.status==='uncertain')return result;
 return {id:operationId,status:'uncertain',reference:'Ticket '+operationId.slice(0,8),totalCents:ticket.totalCents};
}
