// Enrichment requires an exact, unique reference from this store's live catalogue.
// It never replaces an EAN printed on the original document.
const ref=v=>String(v??'').normalize('NFKC').trim().toUpperCase();
export async function readStockCatalog(references,read,valid=()=>true){
 const refs=[...new Set(references.map(r=>String(r||'').trim()).filter(Boolean))],result={products:[],combinations:[]};
 for(let offset=0;offset<refs.length;offset+=35){
  for(const resource of ['products','combinations']){
   const seen=new Set();let complete=false;
   for(let page=0;page<=1000;page++){
    if(!valid())throw Error('La sesión o la recepción ha cambiado.');
    const response=await read({resource,references:refs.slice(offset,offset+35),page,page_size:100});
    if(!valid())throw Error('La sesión o la recepción ha cambiado.');
    if(!Array.isArray(response?.rows))throw Error('El catálogo no devolvió filas verificables.');
    for(const row of response.rows){if(seen.has(String(row.id)))throw Error('El catálogo repitió una página: no se utilizará una lectura incompleta.');seen.add(String(row.id));result[resource].push(row);}
    if(response.possibly_more===false){complete=true;break;}
   }
   if(!complete)throw Error('La lectura del catálogo no se completó. No se asignarán EAN automáticamente.');
  }
 }
 return result;
}
export function enrichStockCatalog(lines,{products=[],combinations=[]}={},checkedAt=''){
 const records=[...products.map(p=>({...p,kind:'product',product_id:String(p.id)})),...combinations.map(p=>({...p,kind:'combination',product_id:String(p.id_product)}))];
 return lines.map(line=>{
  if(line.ean||!ref(line.reference))return {...line};
  const matches=records.filter(p=>ref(p.reference)===ref(line.reference)&&/^\d{8,14}$/.test(String(p.ean13||'')));
  const eans=new Set(matches.map(p=>String(p.ean13))),products=new Set(matches.map(p=>p.product_id));
  if(eans.size!==1||products.size!==1)return {...line};
  return {...line,ean:[...eans][0],catalog_evidence:{reference:line.reference,ean:[...eans][0],product_id:[...products][0],records:matches.map(p=>({kind:p.kind,id:String(p.id)})),checked_at:checkedAt}};
 });
}
