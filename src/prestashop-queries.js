export const PRESTASHOP_QUERY_RECIPES=Object.freeze([
 {id:'attributes',name:'Atributos y variaciones',group:'Catálogo',target:'catalog',resources:['products','combinations','product_options','product_option_values']},
 {id:'category_stock',name:'Stock por unidades y categorías',group:'Stock',target:'catalog',resources:['products','combinations','categories','stock_availables']},
 {id:'sales_window',name:'Ventas en un tramo horario diario',group:'Ventas',target:'orders',description:'Por ejemplo, de 20:00 a 20:30 cada día del periodo.'},
 {id:'variant_price',name:'Revisar precios de variaciones',group:'Catálogo',target:'catalog',resources:['products','combinations'],description:'Incremento cero de la variante; no significa que el producto sea gratis.'},
 {id:'variant_stock',name:'Diferencias de stock de variaciones',group:'Stock',target:'catalog',resources:['products','combinations','stock_availables']},
 {id:'inactive_categories',name:'Productos en categorías desactivadas',group:'Catálogo',target:'catalog',resources:['products','categories']},
 {id:'suspicious_names',name:'Nombres de copia, prueba o duplicado',group:'Calidad',target:'catalog'},
 {id:'product_variant_ean',name:'EAN del producto y sus variaciones',group:'Calidad',target:'catalog',resources:['products','combinations']},
 {id:'zero_price',name:'Productos con precio base cero',group:'Calidad',target:'catalog',description:'Revisar el precio base; las variantes y reglas de precio pueden cambiar el precio final.'},
 {id:'duplicate_ean',name:'EAN repetidos en productos',group:'Calidad',target:'catalog'},
 {id:'variant_ean',name:'EAN repetidos en variaciones',group:'Calidad',target:'catalog',resources:['products','combinations']},
 {id:'duplicate_name',name:'Nombres repetidos',group:'Calidad',target:'catalog'},
 {id:'inventory_tax_cost',name:'Valoración de inventario con IVA y RE',group:'Inventario',needs:'Costes fiables e impuestos reales por producto; la valoración actual es provisional'},
 {id:'inventory_cost',name:'Valoración de inventario a coste',group:'Inventario',needs:'Costes fiables de producto y variante; no se utiliza el coste redondeado como real'},
 {id:'missing_reference',name:'Productos sin referencia',group:'Calidad',target:'catalog'},
 {id:'missing_weight',name:'Revisar peso del producto',group:'Calidad',target:'catalog',description:'Aviso a nivel de producto; hay que contrastarlo con sus combinaciones.'},
 {id:'missing_image',name:'Revisar imagen principal',group:'Calidad',target:'catalog'},
 {id:'duplicate_reference',name:'Referencias repetidas',group:'Calidad',target:'catalog'},
 {id:'cash',name:'Cajas y cierres del TPV',group:'Cajas',needs:'Columnas y correspondencia del TPV antes de importar cierres'},
 {id:'product_count',name:'Productos consultados',group:'Inventario',target:'catalog',description:'Solo será el total del catálogo cuando se hayan recorrido todas las páginas.'}
]);
const normalized=s=>String(s||'').trim().toLocaleLowerCase('es');
export function recipeProducts(rows,recipe){
 const duplicates=field=>{const counts=new Map();for(const row of rows){const v=normalized(row[field]);if(v)counts.set(v,(counts.get(v)||0)+1);}return row=>!!normalized(row[field])&&counts.get(normalized(row[field]))>1;};
 const filter={zero_price:r=>r.price!=null&&r.price!==''&&Number(r.price)===0,missing_reference:r=>!normalized(r.reference),missing_weight:r=>r.weight==null||r.weight===''||!Number.isFinite(Number(r.weight))||Number(r.weight)<=0,missing_image:r=>!r.id_default_image||r.id_default_image==='0',duplicate_ean:duplicates('ean13'),duplicate_name:duplicates('name'),duplicate_reference:duplicates('reference'),suspicious_names:r=>/(copy of|copia de|copia|copy|test|prueba|duplicado)/i.test(r.name||'')}[recipe];
 return filter?rows.filter(filter):rows;
}
export function withinDailyWindow(timestamp,start,end){
 const t=String(timestamp||'').slice(11,19);
 if(!/^\d{2}:\d{2}:\d{2}$/.test(t))return false;
 return start<=end?t>=start&&t<=end:t>=start||t<=end;
}

// Structured diagnostics: join only the datasets explicitly read from the selected shop.
export function detailedRecipe(recipe,data){
 const products=data.products||[],variants=data.combinations||[],stock=data.stock_availables||[],categories=data.categories||[],values=data.product_option_values||[],options=data.product_options||[];
 const productMap=new Map(products.map(p=>[p.id,p])),categoryMap=new Map(categories.map(c=>[c.id,c])),valueMap=new Map(values.map(v=>[v.id,v])),optionMap=new Map(options.map(o=>[o.id,o]));
 const variantRows=product=>variants.filter(v=>v.id_product===product.id),quantity=product=>{const rows=stock.filter(s=>s.id_product===product.id),parts=variantRows(product),selected=parts.length?rows.filter(s=>s.id_product_attribute!=='0'):rows.filter(s=>s.id_product_attribute==='0');const ids=new Set(),shops=new Set();let total=0;for(const row of selected){if(ids.has(row.id_product_attribute)||!/^[-]?\d+$/.test(String(row.quantity??''))||!Number.isSafeInteger(Number(row.quantity)))return null;ids.add(row.id_product_attribute);shops.add(row.id_shop??'unknown');total+=Number(row.quantity);}return shops.size===1&&selected.length&&(!parts.length||parts.every(v=>ids.has(v.id)))?total:null;};
 const item=(p,detail,v=null)=>({id:v?.id||p.id,product_id:p.id,name:p.name,reference:v?.reference||p.reference,detail,image_id:v?.associations?.images?.[0]||p.id_default_image});
 if(recipe==='attributes')return variants.flatMap(v=>{const p=productMap.get(v.id_product);if(!p)return [];const attrs=(v.associations?.product_option_values||[]).map(id=>{const value=valueMap.get(id);return value?(optionMap.get(value.id_attribute_group)?.public_name||optionMap.get(value.id_attribute_group)?.name||'Atributo')+': '+value.name:'Valor #'+id;});return [item(p,attrs.join(' · ')||'Combinación #'+v.id,v)];});
 if(recipe==='variant_price')return variants.filter(v=>v.price!==null&&v.price!==''&&Number(v.price)===0).flatMap(v=>{const p=productMap.get(v.id_product);return p?[item(p,'Incremento de variante: 0 · precio base: '+(p.price??'no informado'),v)]:[];});
 if(recipe==='variant_ean'){const counts=new Map();for(const v of variants)if(v.ean13)counts.set(v.ean13,(counts.get(v.ean13)||0)+1);return variants.filter(v=>v.ean13&&counts.get(v.ean13)>1).flatMap(v=>{const p=productMap.get(v.id_product);return p?[item(p,'EAN de variante repetido: '+v.ean13,v)]:[];});}
 if(recipe==='product_variant_ean')return products.filter(p=>p.ean13&&variantRows(p).length).map(p=>item(p,'EAN producto: '+p.ean13+' · '+variantRows(p).map(v=>'#'+v.id+': '+(v.ean13||'sin EAN')).join(' · ')));
 if(recipe==='inactive_categories')return products.flatMap(p=>{const inactive=(p.associations?.categories||[]).map(id=>categoryMap.get(id)).filter(c=>c?.active==='0');return inactive.length?[item(p,'Categorías desactivadas: '+inactive.map(c=>c.name||'#'+c.id).join(', '))]:[];});
 if(recipe==='category_stock')return categories.map(c=>{const members=products.filter(p=>(p.associations?.categories||[]).includes(c.id)),known=members.map(quantity),unknown=known.filter(q=>q===null).length;return {id:c.id,product_id:null,name:c.name,reference:'Categoría #'+c.id,detail:members.length+' productos · '+known.reduce((n,q)=>n+(q??0),0)+' unidades conocidas'+(unknown?' · '+unknown+' sin stock unívoco por tienda':''),image_id:null};});
 if(recipe==='variant_stock')return products.flatMap(p=>{const parts=variantRows(p);if(!parts.length)return [];const base=stock.filter(s=>s.id_product===p.id&&s.id_product_attribute==='0'),sum=quantity(p);if(base.length!==1||sum===null)return [item(p,'Stock multitienda o incompleto: requiere contraste, no se compara como cero.')];return Number(base[0].quantity)!==sum?[item(p,'Stock base: '+base[0].quantity+' · suma de variantes: '+sum)]:[];});
 return null;
}
