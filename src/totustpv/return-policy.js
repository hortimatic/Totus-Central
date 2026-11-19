export function returnPolicy(value){
 if(!value||typeof value.allowPartial!=='boolean'||Object.keys(value).some(key=>key!=='allowPartial'))throw Error('No se ha podido comprobar la configuración de devoluciones.');
 return {allowPartial:value.allowPartial};
}
export function returnPolicyHtml(value,canEdit,draft){
 const policy=returnPolicy(value),checked=draft?draft.allowPartial==='on':policy.allowPartial;
 return `<section class="tpv-return-policy"><h4>Devoluciones · esta caja</h4><form data-tpv-form="return-policy"><label class="tpv-check"><input name="allowPartial" type="checkbox" ${checked?'checked':''} ${canEdit?'':'disabled'}> Permitir devoluciones parciales</label><p class="small muted">Si se desactiva, hay que devolver todas las unidades pendientes del pedido. Se aplica a todos los operadores de esta caja. Las devoluciones ya enviadas se recuperan sin repetir el reintegro.</p>${canEdit?'<button class="btn primary" type="submit">Guardar devoluciones</button>':'<p class="small muted">Necesitas permiso para editar ventas para cambiar esta regla.</p>'}</form></section>`;
}
