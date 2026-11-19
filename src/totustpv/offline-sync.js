/** Delivery coordination only. The authenticated adapter must validate remote
 * financial evidence; a local ticket is never itself proof of a remote order.
 */
export function createOfflineSync({journal,adapter,isCurrent=()=>true,shouldSynchronize=()=>true}){
 for(const method of ['get','claim','settle'])if(typeof journal?.[method]!=='function')throw Error('Registro local no disponible.');
 for(const method of ['dispatch','recover'])if(typeof adapter?.[method]!=='function')throw Error('Sincronización no disponible.');
 const guard=()=>{if(!isCurrent())throw Error('El puesto ha cambiado. Vuelve a abrir sus ventas pendientes.');};
 async function synchronize(id){
  guard();let row=await journal.get(id);guard();
  if(!row)throw Error('No se encuentra esta venta pendiente.');
  if(['synced','conflict'].includes(row.status))return row;
  let dispatch=false;
  if(row.status==='queued'){
   const claimed=await journal.claim(row.id,row.revision);guard();
   // A concurrent worker owns the send. Never recover or dispatch for it here.
   if(!claimed.won)return claimed.record;
   row=claimed.record;dispatch=true;
  }
  if(!['dispatching','uncertain'].includes(row.status))throw Error('El estado de la venta requiere revisión.');
  let observed;
  try{
   observed=dispatch?await adapter.dispatch({operationId:row.id,ticket:structuredClone(row.ticket)}):await adapter.recover({operationId:row.id,ticket:structuredClone(row.ticket)});
  }catch(error){observed=error?.code==='TPV_ACTION_APPROVAL_REQUIRED'?{operationId:row.id,authorizationRequired:true}:null;}
  guard();
  const matches=observed?.operationId===row.id;
  const status=matches&&observed.status==='confirmed'&&observed.verified===true?'synced':
   matches&&observed.status==='conflict'&&observed.verified===true?'conflict':'uncertain';
  const saved=await journal.settle(row.id,row.revision,{status,remoteOperationId:row.id});guard();return observed?.authorizationRequired?{...saved.record,authorizationRequired:true}:saved.record;
 }
 // Manual and connection-restored triggers share a single sweep in this tab.
 // The journal's transactional claim still arbitrates between different tabs.
 let sweep=null;
 function synchronizePending(){
  if(sweep)return sweep;
  sweep=(async()=>{
   guard();if(typeof journal.list!=='function')throw Error('No se pueden consultar las ventas pendientes.');
   const summary={synced:0,conflict:0,pending:0};let after='';
   for(;;){
    guard();const rows=await journal.list({after,limit:100});guard();
    for(const row of rows){
     if(['synced','conflict'].includes(row.status)||!shouldSynchronize(row))continue;
     const result=await synchronize(row.id);guard();
     summary[result.status==='synced'?'synced':result.status==='conflict'?'conflict':'pending']++;
     if(result.authorizationRequired)summary.authorizationRequired=true;
     // An inconclusive delivery often means the connection is still down.
     // Stop here; the next sweep recovers this ID before attempting new work.
     if(!['synced','conflict'].includes(result.status))return summary;
    }
    if(rows.length<100)return summary;
    after=rows.at(-1).id;
   }
  })().finally(()=>{sweep=null;});
  return sweep;
 }
 return Object.freeze({synchronize,synchronizePending});
}
