// New records offer active entities; edits also retain the entities already linked.
export function editableReferences(rows,selected=[]){
 const ids=new Set((Array.isArray(selected)?selected:[selected]).filter(Boolean));
 return rows.filter(row=>row.active!==false||ids.has(row.id));
}
export function expenseStoreSelection(row,activeStores,taxRecord=false){
 return row?(row.store_id||''):(taxRecord?'':activeStores[0]?.id||'');
}
