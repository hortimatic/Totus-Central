// Deterministic table extraction from PDF text coordinates. No OCR or model calls.
const clean=v=>String(v??'').normalize('NFKC').replace(/[\u0000\u200b]/g,'').replace(/\s+/g,' ').trim();
const key=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const number=v=>/^[-+]?\d+(?:[.,]\d+)?$/.test(clean(v))?Number(clean(v).replace(',','.')):null;
const line=(items,y)=>items.filter(i=>Math.abs(i.y-y)<2.5).sort((a,b)=>a.x-b.x);
export function stockPdfTable(pages){
 const all=pages.flatMap(p=>p.items.map(i=>({...i,text:clean(i.text),page:p.page}))).filter(i=>i.text);
 const first=pages[0]?.items||[],header=label=>first.find(i=>key(i.text)===label),rows=[],excluded=[];
 const nameHeader=header('nombre'),refHeader=header('ref'),employee=header('empleado'),type=header('tipo');
 if(nameHeader&&refHeader&&employee&&type){
  const anchors=all.filter(i=>/^(añadido|anadido)$/i.test(i.text)).sort((a,b)=>a.page-b.page||b.y-a.y);
  if(!anchors.length)return null;
  const candidates=anchors.map(a=>line(pages.find(p=>p.page===a.page).items,a.y).filter(i=>i.x<employee.x-2)).find(a=>a.length>=2);
  if(!candidates)return null;
  const refX=candidates[candidates.length-1].x,nameX=candidates[0].x,qtyHeader=first.find(i=>/^cantidad\(/i.test(i.text));
  if(!qtyHeader||refX<=nameX)return null;
  for(let n=0;n<anchors.length;n++){
   const a=anchors[n],next=anchors[n+1];
   const band=all.filter(i=>(i.page>a.page||i.page===a.page&&i.y<=a.y+2.5)&&(!next||i.page<next.page||i.page===next.page&&i.y>next.y+2.5));
   const names=band.filter(i=>i.x>=nameX-2&&i.x<refX-2&&!/^(Stock\s*[•·]|Nombre$|completo$)/i.test(i.text));
   const ref=band.filter(i=>i.x>=refX-2&&i.x<employee.x-2&&!/^(Ref|Empleado)$/.test(i.text));
   const quantities=line(pages.find(p=>p.page===a.page).items,a.y).filter(i=>Math.abs(i.x-qtyHeader.x)<22&&number(i.text)!==null);
   rows.push({name:names.map(i=>i.text).join(' ').replace(/(\p{L})-\s+(\p{L})/gu,'$1-$2'),reference:ref.map(i=>i.text).join(' '),ean:'',quantity:quantities.length===1?number(quantities[0].text):null,unit:'ud',page:a.page,locator:'Página '+a.page+' · movimiento '+(n+1)});
  }
  return {parser:'pdf-prestashop-columns-v2',rows,excluded,needsReview:true};
 }
 const description=header('descripcion')||first.find(i=>/^descripcion articulo$/i.test(key(i.text))),quantity=header('cantidad')||header('uds.'),price=header('tarifa')||header('precio');
 if(!description||!quantity||!price)return null;
 const sku=header('sku'),reference=header('referencia');
 const nameX=sku?Math.min(...first.filter(i=>i.x>sku.x+20&&i.x<quantity.x&&i.y<description.y&&/^EAN:/.test(i.text)).map(i=>i.x)):description.x;
 const nameEnd=reference?price.x-2:quantity.x-3,quantityEnd=reference?description.x-2:price.x-2;
 if(!Number.isFinite(nameX))return null;
 const anchors=all.filter(i=>i.x>=quantity.x-3&&i.x<quantityEnd&&number(i.text)!==null).filter(i=>{
  const page=pages.find(p=>p.page===i.page),at=line(page.items,i.y);
  const pageHeader=page.items.find(x=>key(x.text)===key(description.text));
  return at.some(x=>x.x>=price.x-3&&/\d[.,]\d/.test(x.text))&&at.some(x=>x.x>=nameX-2&&x.x<nameEnd)&&(!pageHeader||i.y<pageHeader.y-2);
 }).sort((a,b)=>a.page-b.page||b.y-a.y);
 for(let n=0;n<anchors.length;n++){
  const a=anchors[n],next=anchors[n+1],page=pages.find(p=>p.page===a.page);
  const band=all.filter(i=>(i.page>a.page||i.page===a.page&&i.y<=a.y+2.5)&&(!next||i.page<next.page||i.page===next.page&&i.y>next.y+2.5));
  let names=band.filter(i=>i.x>=nameX-2&&i.x<nameEnd&&!/^EAN:/.test(i.text)&&!/^[-—]+$/.test(i.text));
  const stop=names.findIndex(i=>/^(Telefono:|Internet Inteligente|VAPERALIA|Subtotal|Impuestos|Total\b|Impuesto\b|Pagina:|Nº RII)/i.test(key(i.text)));
  if(stop>=0)names=names.slice(0,stop);
  names=names.filter(i=>!/^Factura\b|^Distribuciones Murshe/i.test(i.text));
  names.sort((a,b)=>a.page-b.page||b.y-a.y||a.x-b.x);
  const name=names.map(i=>i.text).join(' '),ean=band.map(i=>i.text.match(/^EAN:\s*(\d{8,14})/i)?.[1]).find(Boolean)||'';
  const refs=line(page.items,a.y).filter(i=>i.x<(reference?quantity.x-3:nameX-2)&&/^[A-Z0-9][A-Z0-9._/-]*$/i.test(i.text));
  if(!name)continue;
  const row={name,reference:sku||reference?refs.map(i=>i.text).join(' '):'',ean,quantity:number(a.text),unit:/\b(?:pack\s*\d+|\d+\s*pcs|caja de)\b/i.test(name)?'pack':'ud',page:a.page,locator:'Página '+a.page+' · línea '+(n+1)};
  if(/^(descuento\b|gastos de envio\b|agencia de paqueteria\b)/i.test(key(name))){excluded.push({...row,name:name.split(/\bTipo Importe\b/i)[0].trim(),reason:'Descuento o servicio: no representa una entrada de producto.'});continue;}
  rows.push(row);
 }
 return anchors.length?{parser:'pdf-invoice-columns-v2',rows,excluded,needsReview:true}:null;
}
