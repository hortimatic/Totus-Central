// Versions belong to the rendered form, not the latest background refresh.
// WeakMap also preserves the original version when a real form node is held
// while asking whether to discard its unsaved fields and selected files.
const versions=new WeakMap();
export function rememberWriteVersion(root,row){
 if(!root)return;
 if(row?.id&&Object.hasOwn(row,'updated_at'))versions.set(root,{id:row.id,updated_at:row.updated_at??null});
 else versions.delete(root);
}
export function expectedWriteVersion(root,id){
 const snapshot=root&&versions.get(root);
 return snapshot&&snapshot.id===id?{expected_updated_at:snapshot.updated_at}:{};
}
// Advance after a field-only save only if no unrelated server field changed.
export function advanceWriteVersion(root,before,after,{ignore=[]}={}){
 const snapshot=versions.get(root);
 if(!snapshot||snapshot.id!==before?.id||after?.id!==before.id||snapshot.updated_at!==(before.updated_at??null))return false;
 const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>k!=='updated_at'&&!ignore.includes(k));
 if(keys.some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])))return false;
 rememberWriteVersion(root,after);return true;
}
