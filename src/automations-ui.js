import {createPrestashopAutomations} from './prestashop-automations-ui.js';
import {storeConnection} from './prestashop-readonly.js';
export const automationsPage=()=>'<div class="page automations-page"><section id="automationsRoot" class="ps-workspace" aria-label="Automatizaciones"><div class="card card-pad" role="status"><h2>Automatizaciones y avisos</h2><p>Preparando las reglas, sus horarios y el historial disponible para tu cuenta…</p></div></section></div>';
export function createAutomationsUI({rpc,actor,can,canReadStores,invoke}){
 let connections=[],owner=null;
 const rules=createPrestashopAutomations({rpc,actor,can,read:async(store,resource,params)=>{
  if(owner!==actor()||!canReadStores())throw Error('Necesitas permiso de consulta de PrestaShop para esta regla.');
  if(!connections.length){const result=await rpc('totus_prestashop_context',{});if(owner!==actor())throw Error('La sesión ha cambiado.');connections=result?.connections||[];}
  const connection=storeConnection(connections,store);if(!connection)throw Error('Configura una conexión única para esta tienda.');
  return invoke({action:'prestashop_read',store,id:connection.id,revision:connection.revision,call_id:crypto.randomUUID(),resource,...params});
 }});
 return {hasDraft:rules.hasDraft,discardDraft:rules.discardDraft,dispose(){rules.dispose();connections=[];owner=null;},async mount(root){if(owner!==actor())connections=[];owner=actor();await rules.mount(root);}};
}
