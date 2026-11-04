export const PRESTASHOP_QUERY_RECIPES=Object.freeze([
 {id:'attributes',name:'Atributos y variaciones',group:'Catálogo',needs:'Detalle de combinaciones y atributos'},
 {id:'category_stock',name:'Stock por unidades y categorías',group:'Stock',needs:'Categorías y stock por tienda'},
 {id:'sales_window',name:'Ventas en un tramo horario diario',group:'Ventas',target:'orders',description:'Por ejemplo, de 20:00 a 20:30 cada día del periodo.'},
 {id:'variant_price',name:'Revisar precios de variaciones',group:'Catálogo',needs:'Precio base más incremento de cada combinación; un incremento cero no es un producto gratis'},
 {id:'variant_stock',name:'Diferencias de stock de variaciones',group:'Stock',needs:'Correspondencia de stock, tienda y combinaciones'},
 {id:'inactive_categories',name:'Productos en categorías desactivadas',group:'Catálogo',needs:'Categorías y asociación de productos'},
 {id:'suspicious_names',name:'Nombres de copia, prueba o duplicado',group:'Calidad',target:'catalog'},
 {id:'product_variant_ean',name:'EAN del producto y sus variaciones',group:'Calidad',needs:'Comparación de producto y combinaciones'},
 {id:'zero_price',name:'Productos con precio final cero',group:'Calidad',needs:'Precio base, combinaciones, impuestos y reglas de precio'},
 {id:'duplicate_ean',name:'EAN repetidos en productos',group:'Calidad',target:'catalog'},
 {id:'variant_ean',name:'EAN repetidos en variaciones',group:'Calidad',needs:'Lectura de combinaciones por tienda'},
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
 const filter={missing_reference:r=>!normalized(r.reference),missing_weight:r=>r.weight==null||r.weight===''||!Number.isFinite(Number(r.weight))||Number(r.weight)<=0,missing_image:r=>!r.id_default_image||r.id_default_image==='0',duplicate_ean:duplicates('ean13'),duplicate_name:duplicates('name'),duplicate_reference:duplicates('reference'),suspicious_names:r=>/(copy of|copia de|copia|copy|test|prueba|duplicado)/i.test(r.name||'')}[recipe];
 return filter?rows.filter(filter):rows;
}
export function withinDailyWindow(timestamp,start,end){
 const t=String(timestamp||'').slice(11,19);
 if(!/^\d{2}:\d{2}:\d{2}$/.test(t))return false;
 return start<=end?t>=start&&t<=end:t>=start||t<=end;
}
