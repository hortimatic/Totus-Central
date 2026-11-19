const need=ok=>{if(!ok)throw Error('No se han podido verificar los códigos actuales para las etiquetas.');};
export function barcodeLabels(value,{field,shopId,targets}){
 need(value?.source==='native-barcode-labels'&&value.field===field&&value.shop_id===shopId&&Array.isArray(value.items)&&Array.isArray(value.skipped)&&Array.isArray(targets)&&targets.length>0&&targets.length<=50&&value.items.length+value.skipped.length===targets.length);
 const expected=new Set(targets.map(t=>t.productId+':'+t.attributeId)),seen=new Set();
 const identity=row=>{need(row&&Number.isSafeInteger(row.product_id)&&row.product_id>0&&Number.isSafeInteger(row.attribute_id)&&row.attribute_id>=0);const id=row.product_id+':'+row.attribute_id;need(expected.has(id)&&!seen.has(id));seen.add(id);};
 const items=value.items.map(row=>{
  identity(row);need(['name','variant_name','reference','code'].every(k=>typeof row[k]==='string')&&Array.from(row.name).length<=255&&Array.from(row.variant_name).length<=255&&Array.from(row.reference).length<=64&&row.code.length>0&&row.code.length<=64&&row.symbology===({ean13:'ean13',upc:'upca',reference:'code128'}[field])&&typeof row.modules==='string'&&/^[01]{20,4096}$/.test(row.modules)&&row.modules.includes('1'));
  return {productId:row.product_id,attributeId:row.attribute_id,name:row.name,variantName:row.variant_name,reference:row.reference,code:row.code,symbology:row.symbology,modules:row.modules};
 });
 const skipped=value.skipped.map(row=>{identity(row);need(['missing-code','invalid-code'].includes(row.reason));return {productId:row.product_id,attributeId:row.attribute_id,reason:row.reason};});
 return {field,items,skipped};
}
export function barcodeSvg(modules){
 need(typeof modules==='string'&&/^[01]{20,4096}$/.test(modules)&&modules.includes('1'));
 let rects='';for(let i=0;i<modules.length;){if(modules[i]==='0'){i++;continue;}let end=i+1;while(modules[end]==='1')end++;rects+=`<rect x="${i+11}" y="0" width="${end-i}" height="60"/>`;i=end;}
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules.length+22} 60" role="img" aria-label="Código de barras" style="background:white;shape-rendering:crispEdges" preserveAspectRatio="none"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects}</g></svg>`;
}
export const LABEL_PAPERS=Object.freeze({thermal58:{label:'Rollo de 58 mm',paper:58,width:48,height:50},thermal100:{label:'Rollo de 100 mm',paper:100,width:90,height:50},a4:{label:'Hoja A4',paper:210,width:200,height:297,sheet:true},a4landscape:{label:'Hoja A4 horizontal',paper:297,width:287,height:210,sheet:true}});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function labelSheetHtml(labels,{paper='thermal58',copies=1}={}){
 const profile=LABEL_PAPERS[paper];
 if(!profile||!Number.isInteger(copies)||copies<1||copies>20||!Array.isArray(labels?.items)||labels.items.length>50)throw Error('Revisa el papel y el número de copias de las etiquetas.');
 const rows=labels.items.flatMap(row=>{
  const width=(row.modules.length+22)*.264;
  if(width>profile.width)throw Error('Este código necesita una etiqueta más ancha. Elige un papel más ancho; para referencias largas puedes usar A4 horizontal.');
  const label=`<article class="tpv-barcode-label" style="width:${profile.width}mm"><strong>${esc(row.name)}</strong>${row.variantName?`<small>${esc(row.variantName)}</small>`:''}<div class="tpv-label-symbol" style="width:${width.toFixed(3)}mm;height:18.3mm">${barcodeSvg(row.modules)}</div><code>${esc(row.code)}</code></article>`;
  return Array(copies).fill(label);
 });
 return `<section class="tpv-label-sheet" data-label-paper="${paper}">${rows.join('')}</section>`;
}
export function labelPrintDocument(labels,options={}){
 const html=labelSheetHtml(labels,options),profile=LABEL_PAPERS[options.paper||'thermal58'];
 return `<!doctype html><html lang="es"><meta charset="utf-8"><title>TotusTPV · etiquetas</title><style>@page{size:${profile.paper}mm ${profile.height}mm;margin:5mm}*{box-sizing:border-box}body{margin:0;background:white;color:black;font:10px Arial,sans-serif}.tpv-barcode-label{height:${profile.sheet?45:profile.height-10}mm;break-inside:avoid;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden;${profile.sheet?'':'break-after:page;'}}.tpv-barcode-label:last-child{break-after:auto}.tpv-barcode-label strong{max-height:8mm;overflow:hidden;line-height:1.2;font-size:10px}.tpv-barcode-label small{max-height:5mm;overflow:hidden;font-size:9px}.tpv-label-symbol{margin:1mm auto;flex-shrink:0}.tpv-label-symbol svg{display:block;width:100%;height:100%}.tpv-barcode-label code{font:9px monospace;white-space:nowrap}</style><body>${html}</body></html>`;
}
export function printBarcodeLabels(labels,options,{current=()=>true}={}){
 const html=labelPrintDocument(labels,options);if(!current())return;
 const frame=document.createElement('iframe');frame.title='Imprimir etiquetas de artículos';frame.setAttribute('sandbox','allow-same-origin allow-modals');frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;border:0';
 frame.onload=async()=>{try{await frame.contentDocument.fonts?.ready;if(!current()||!frame.isConnected){frame.remove();return;}frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow.print();}catch{frame.remove();}};
 frame.srcdoc=html;document.body.append(frame);setTimeout(()=>frame.remove(),60000);
}
