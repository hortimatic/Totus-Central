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
