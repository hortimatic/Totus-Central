export function cashVisibility(value){
 if(!value||typeof value.hideSummary!=='boolean'||Object.keys(value).some(key=>key!=='hideSummary'))throw Error('No se ha podido comprobar la visibilidad de los importes de caja.');
 return {hideSummary:value.hideSummary};
}
export function cashVisibilityHtml(value,canEdit,draft){const rules=cashVisibility(value);return `<section class="tpv-cash-visibility"><h4>Visibilidad de importes · esta caja</h4><form data-tpv-form="cash-visibility"><label class="tpv-check"><input type="checkbox" name="hideSummary" ${(draft?draft.hideSummary==='on':rules.hideSummary)?'checked':''} ${canEdit?'':'disabled'}> Ocultar los importes del resumen y hacer el arqueo sin saldo esperado</label><p class="small muted">Se aplica a los operadores que no tienen permiso para configurar el puesto. Introducirán su propio recuento; el TPV conservará los importes reales y el cierre. Las personas autorizadas para configurar el puesto siguen viendo el resumen. Cajas de Central conserva sus permisos propios.</p>${canEdit?'<button type="submit" class="btn primary">Guardar visibilidad de caja</button>':'<p class="small muted">Solo una persona con permiso para configurar el puesto puede cambiar esta regla.</p>'}</form></section>`;}
/** A hidden summary must never acquire invented zeros or a computed difference. */
export function cashSummaryPresentation(row){
 if(!row||row.cashSummaryHidden!==undefined&&typeof row.cashSummaryHidden!=='boolean')throw Error('No se ha podido comprobar el resumen de caja.');
 const unresolved=(row.unresolvedSales||row.pendingSales||0)+(row.pendingRefunds||0);
 if(row.cashSummaryHidden===true){const keys=['sessionId','status','closedAt','closingRequestId','currency','environment','storeName','drawerName','openedAt','openedByName','closedByName','generatedAt','unresolvedSales','pendingSales','pendingRefunds'];return {...Object.fromEntries(keys.filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]])),cashSummaryHidden:true,unresolved};}
 return {...row,salesCents:Object.values(row.payments||{}).reduce((n,v)=>n+v,0),cashCents:row.payments?.cash||0,refundCashCents:row.refunds?.cash||row.refundPayments?.cash||0,unresolved,differenceCents:row.countedCents==null?null:row.countedCents-row.expectedCashCents};
}
