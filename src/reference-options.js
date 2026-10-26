// New records offer active entities; edits also retain the entities already linked.
export function editableReferences(rows,selected=[]){
 const ids=new Set((Array.isArray(selected)?selected:[selected]).filter(Boolean));
 return rows.filter(row=>row.active!==false||ids.has(row.id));
}
export function expenseStoreSelection(row,activeStores,taxRecord=false){
 return row?(row.store_id||''):(taxRecord?'':activeStores[0]?.id||'');
}
export function reportDiaryStores(stores,expenses){
 return expenses.some(x=>x.store_id==null)?[...stores,{id:null,name:'Común al autónomo'}]:stores;
}
export function reportDiaryStore(stores,id){
 return id==='__common__'?{id:null,name:'Común al autónomo'}:stores.find(x=>x.id===id);
}
