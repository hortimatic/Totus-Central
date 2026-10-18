// Two-level expense category hierarchy shared by forms, IRPF guards, and Excel.
const label=c=>String(c?.name||c?.code||'Sin nombre');
const cmp=(a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||label(a).localeCompare(label(b),'es');
export function expenseCategoryTree(rows=[]){
 const sorted=[...rows].sort(cmp);
 return sorted.filter(c=>!c.parent_id).map(category=>({category,children:sorted.filter(c=>String(c.parent_id||'')===String(category.id))}));
}
export function expenseCategoryOptions(rows=[],selectedId=''){
 const selected=String(selectedId||''),options=[];
 for(const {category,children} of expenseCategoryTree(rows)){
  const active=category.active!==false;
  if(active||String(category.id)===selected)options.push({value:category.id,label:label(category)+' · principal'+(active?'':' (inactiva)')});
  for(const c of children)if((active&&c.active!==false)||String(c.id)===selected)
   options.push({value:c.id,label:label(category)+' → '+label(c)+(c.active===false?' (inactiva)':'')});
 }
 return options;
}
export function expenseCategoryCode(rows=[],id){
 const c=rows.find(x=>String(x.id)===String(id));if(!c)return '';
 const own=String(c.code||'').toUpperCase();
 const parent=c.parent_id?rows.find(x=>String(x.id)===String(c.parent_id)):null;
 const base=String(parent?.code||'').toUpperCase();
 return base.startsWith('INTERNAL_')||['MERCH','PAYROLL','SOCIAL','RETA','FAMILY_COLLAB','TAX','OTHER'].includes(base)?base:own;
}
export const isInternalExpenseCategory=(rows,id)=>expenseCategoryCode(rows,id).startsWith('INTERNAL_');
export function validateExpenseCategoryHierarchy(rows,{id='',parent_id=null,active=true}){
 const p=String(parent_id||'');if(!p)return true;
 if(p===String(id))throw new Error('Una categoría no puede ser su propia subcategoría.');
 const parent=rows.find(c=>String(c.id)===p);
 if(!parent)throw new Error('La categoría principal no existe.');
 if(parent.parent_id)throw new Error('Solo se permite un nivel de subcategorías.');
 if(active&&parent.active===false)throw new Error('Una subcategoría activa necesita una categoría principal activa.');
 if(id&&rows.some(c=>String(c.parent_id||'')===String(id)))throw new Error('Una categoría que ya tiene subcategorías no puede convertirse en subcategoría.');
 return true;
}
