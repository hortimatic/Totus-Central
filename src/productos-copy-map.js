import {associationIds,textValue} from './productos-core.js';
const fold=v=>textValue(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const id=v=>String(v??'');
export function mapCopyRelations(product,source,destination){
 const categoryMap={},unresolved=[],relations={category_ids:[],tag_ids:[],related_product_ids:[],features:[]};
 const match=(resource,sourceId,label)=>{
  if(!sourceId||String(sourceId)==='0')return null;
  const row=(source[resource]||[]).find(r=>id(r.id)===id(sourceId));
  if(!row){unresolved.push(label+' de origen no consultado');return null;}
  const name=fold(row.name??row.value),matches=(destination[resource]||[]).filter(r=>fold(r.name??r.value)===name);
  if(!name||matches.length!==1){unresolved.push(label+': '+textValue(row.name??row.value)+' · '+(matches.length?'coincidencia ambigua':'sin correspondencia'));return null;}
  return id(matches[0].id);
 };
 for(const [field,resource,key,label]of [['id_manufacturer','manufacturers','manufacturer_id','Marca'],['id_supplier','suppliers','supplier_id','Proveedor'],['id_tax_rules_group','tax_rule_groups','tax_rules_group_id','Impuestos']]){const mapped=match(resource,product[field],label);if(mapped)relations[key]=mapped;}
 const categoryPath=(rows,category)=>{const names=[],seen=new Set();let current=id(category);while(current&&current!=='0'&&!seen.has(current)){seen.add(current);const row=rows.find(r=>id(r.id)===current);if(!row)return '';names.unshift(fold(row.name));current=id(row.id_parent);}return names.join(' / ');};
 let categoryId='';
 for(const sourceId of associationIds(product,'categories')){
  const path=categoryPath(source.categories||[],sourceId),exact=(destination.categories||[]).filter(r=>categoryPath(destination.categories||[],r.id)===path&&path);
  const mapped=exact.length===1?id(exact[0].id):match('categories',sourceId,'Categoría');
  if(mapped){categoryMap[sourceId]=mapped;relations.category_ids.push(mapped);if(id(product.id_category_default)===sourceId)categoryId=mapped;}
 }
 if(!categoryId&&product.id_category_default)categoryId=match('categories',product.id_category_default,'Categoría principal')||'';
 if(categoryId&&!relations.category_ids.includes(categoryId))relations.category_ids.push(categoryId);
 for(const sourceId of associationIds(product,'tags')){const mapped=match('tags',sourceId,'Etiqueta');if(mapped)relations.tag_ids.push(mapped);}
 for(const pair of product.associations?.product_features||[]){
  const feature=match('product_features',pair.id,'Característica');
  const from=(source.product_feature_values||[]).find(r=>id(r.id)===id(pair.id_feature_value));
  const values=feature&&from?(destination.product_feature_values||[]).filter(r=>id(r.id_feature)===feature&&fold(r.value)===fold(from.value)):[];
  if(values.length===1)relations.features.push({feature_id:feature,value_id:id(values[0].id)});else unresolved.push('Valor de característica: '+textValue(from?.value||pair.id_feature_value)+' · sin correspondencia única');
 }
 for(const sourceId of associationIds(product,'accessories')){
  const row=(source.related_products||[]).find(r=>id(r.id)===sourceId),reference=textValue(row?.reference);
  const matches=reference?(destination.related_products||[]).filter(r=>textValue(r.reference)===reference):[];
  if(matches.length===1)relations.related_product_ids.push(id(matches[0].id));else unresolved.push('Relacionado '+(reference||sourceId)+' · sin referencia única en destino');
 }
 return {relations,categoryId,categoryMap,unresolved};
}
