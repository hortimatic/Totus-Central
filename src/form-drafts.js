// Ephemeral DOM baselines only: no form values or attachments are persisted.
const baselines=new WeakMap();
function fields(root){
 return [...root.querySelectorAll('input,select,textarea')]
  .filter(el=>!el.disabled&&!el.readOnly&&!el.hasAttribute('data-draft-ignore')&&!['button','submit','hidden'].includes(el.type)&&!el.closest('[data-filter-prefix]'))
  .map((el,index)=>({key:el.id||el.name||String(index),value:el.type==='file'
   ?[...el.files].map(f=>[f.name,f.size,f.lastModified,f.type])
   :['checkbox','radio'].includes(el.type)?el.checked:el.multiple?[...el.selectedOptions].map(o=>o.value):el.value}));
}
export function captureFormDraft(root){
 if(!root)return;
 const editable=[...root.querySelectorAll('[data-action]')].some(el=>/-save(?:$|-)/.test(el.dataset.action));
 if(editable)baselines.set(root,fields(root));else baselines.delete(root);
}
export function hasFormDraft(root,ignore=[]){
 if(!root||!baselines.has(root))return false;
 const select=rows=>rows.filter(row=>!ignore.includes(row.key));
 return JSON.stringify(select(fields(root)))!==JSON.stringify(select(baselines.get(root)));
}
export function originalFormValue(root,key){return baselines.get(root)?.find(row=>row.key===key)?.value}
export function setPristineFormValue(root,key,value){
 const baseline=baselines.get(root)?.find(row=>row.key===key);
 const field=[...(root?.querySelectorAll('input,select,textarea')||[])].find(el=>el.id===key);
 if(!baseline||!field||field.value!==baseline.value)return false;
 field.value=String(value??'');baseline.value=field.value;return true;
}
