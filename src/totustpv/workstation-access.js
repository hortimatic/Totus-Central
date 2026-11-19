const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=row=>[row.operatorId,row.drawerId,row.shopId].join(':');
const values=row=>({role:row.permissions.sell?'sell':'view',cash:row.permissions.open,active:row.active});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
/** Administrative access only. No till, order or native-store mutation is made
 * by this panel. The server rechecks the manager and assignment revision. */
export function createWorkstationAccessPanel({canManage,invoke,uuid=()=>crypto.randomUUID()}){
 let configuration=null,rows=[],editing=null,draft=null,dirty=false,pending=false,request=null,epoch=0;
 function reset(){epoch++;configuration=null;rows=[];editing=null;draft=null;dirty=false;pending=false;request=null;}
 function load(value){reset();configuration=value;rows=value.accesses||[];}
 function capture(form){if(!editing)throw Error('Selecciona primero un acceso.');const fields=new FormData(form),role=fields.get('role');
  if(!['sell','view'].includes(role))throw Error('Selecciona cómo puede usar el mostrador esta persona.');
  draft={role,cash:fields.get('cash')==='on',active:fields.get('active')==='on'};dirty=!same(draft,values(editing));
 }
 function edit(index){if(!canManage()||!rows[index])throw Error('No se puede consultar ese acceso. Actualiza la lista.');
  editing=structuredClone(rows[index]);draft=values(editing);dirty=false;pending=false;request=null;}
 function cancel(){editing=null;draft=null;dirty=false;pending=false;request=null;}
 function html(){if(!configuration||configuration.accesses==null||!canManage())return '';
  if(editing)return `<section class="tpv-access-panel"><h4>Acceso de ${esc(editing.operatorName)}</h4>
   <p>${esc(editing.storeName)} · ${esc(editing.drawerName)}</p><form data-tpv-access-form>
   <label>Uso del mostrador<select name="role"><option value="sell" ${draft.role==='sell'?'selected':''}>Vender y consultar pedidos</option><option value="view" ${draft.role==='view'?'selected':''}>Consultar pedidos</option></select></label>
   <label class="tpv-check"><input type="checkbox" name="cash" ${draft.cash?'checked':''}> Gestionar caja: abrir, registrar entradas o retiradas y cerrar</label>
   <label class="tpv-check"><input type="checkbox" name="active" ${draft.active?'checked':''}> Acceso activo a esta caja</label>
   ${!editing.operatorActive||!editing.drawerActive?'<p class="note">La persona o la caja está desactivada. Puedes retirar el acceso; para activarlo, revisa antes su ficha.</p>':''}
   <p class="small muted">La consulta permite revisar pedidos y documentos de esta tienda. Retirar el acceso conserva el historial y no cierra la caja. Los permisos generales de la cuenta siguen aplicándose.</p>
   <div class="inline-actions"><button class="btn primary" type="submit">Guardar acceso</button><button class="btn secondary" type="button" data-tpv-access-cancel>Cancelar</button><button class="btn secondary" type="button" data-tpv-access-refresh>Actualizar accesos</button></div>
   ${pending?'<p class="note">El resultado de esta solicitud todavía no está confirmado. Reintenta los mismos cambios o actualiza los accesos para comprobar cómo han quedado.</p>':''}</form></section>`;
  return `<section class="tpv-access-panel"><h4>Accesos a las cajas</h4><p>Elige quién puede vender, consultar o gestionar el efectivo en cada caja.</p>
   <div class="tpv-access-list">${rows.map((row,index)=>`<article><div><strong>${esc(row.operatorName)}</strong><small>${esc(row.storeName)} · ${esc(row.drawerName)}</small><small>${row.permissions.sell?'Vende y consulta':'Consulta'}${row.permissions.open?' · Gestiona caja':''}</small></div><span>${row.active?'Activo':'Sin acceso'}</span><button class="btn secondary" type="button" data-tpv-access-edit="${index}">Cambiar acceso</button></article>`).join('')||'<p>No hay accesos asignados. Prepara el primer puesto con el formulario de esta pantalla.</p>'}</div>
   <div class="inline-actions"><button class="btn secondary" type="button" data-tpv-access-batch-open>Gestionar por tienda o empleado</button><button class="btn secondary" type="button" data-tpv-access-refresh>Actualizar accesos</button></div></section>`;
 }
 async function save(){if(!canManage()||!configuration||!editing||!draft)throw Error('No tienes permiso para gestionar este acceso.');
  const run=epoch,source=structuredClone(editing),intent={action:'update-workstation-access',revision:configuration.revision,
   selection:{connectionId:configuration.connectionId,shopId:source.shopId,drawerId:source.drawerId},operatorId:source.operatorId,
   assignmentRevision:source.revision,permissions:{sell:draft.role==='sell',open:draft.cash,reconcile:true},active:draft.active};
  const fingerprint=JSON.stringify(intent);if(request?.fingerprint!==fingerprint)request={fingerprint,id:uuid()};pending=true;
  const reply=await invoke({...intent,operationId:request.id});
  if(run!==epoch||!canManage())throw Error('La vista ha cambiado. Actualiza los accesos.');
  if(reply?.connectionId!==intent.selection.connectionId||reply.operatorId!==source.operatorId||reply.drawerId!==source.drawerId||reply.shopId!==source.shopId||
   !Number.isSafeInteger(reply.revision)||reply.revision<source.revision||reply.active!==intent.active||
   !reply.permissions||['sell','open','reconcile'].some(name=>reply.permissions[name]!==intent.permissions[name]))
   throw Error('No se ha podido comprobar el acceso guardado. Actualiza la lista antes de continuar.');
  const result={...source,active:reply.active,permissions:reply.permissions,revision:reply.revision};
  rows=rows.map(row=>key(row)===key(source)?result:row);cancel();return result;
 }
 return {load,reset,html,edit,cancel,capture,save,input:target=>{const form=target.closest('[data-tpv-access-form]');if(!form)return false;capture(form);return true;},
  isEditing:()=>!!editing,hasDraft:()=>dirty||pending};
}
