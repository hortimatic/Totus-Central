// Local, deterministic documentary reconciliation. Never calls an AI or changes stock.
import {stockLineResult,stockSummary} from './stock-core.js';
const text=v=>String(v??'').trim();
export const stockRuleName=v=>text(v).normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const code=v=>text(v).normalize('NFKC').toUpperCase();
export function stockRuleQuantity(value){
 if(typeof value==='number')return Number.isFinite(value)&&Math.abs(value)<=1000000?value:null;
 let s=text(value).replace(/\s/g,'');
 if(!s||!/^[-+]?\d+(?:[.,]\d+)*$/.test(s))return null;
 if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 else s=s.replace(',','.');
 const n=Number(s);return Number.isFinite(n)&&Math.abs(n)<=1000000?n:null;
}
export function stockRuleUnit(value){
 const s=stockRuleName(value).replace(/\./g,'');
 if(/^(ud|uds|unidad|unidades|unit|units|pcs|pieza|piezas)$/.test(s))return 'ud';
 if(/^(caja|cajas|pack|packs|paquete|paquetes|blister)$/.test(s))return 'pack';
 return s;
}
const aliases={reference:['referencia','ref','sku','codigo','reference'],ean:['ean','ean13','codigo ean','barcode'],name:['producto','descripcion','descripcion articulo','articulo','nombre','nombre completo','product'],quantity:['cantidad','uds','unidades','qty','quantity','recibido'],variant:['variante','variacion','combinacion','variant'],unit:['unidad','formato','unit']};
const cleanHeader=v=>stockRuleName(v).replace(/[.:]/g,'').replace(/\([^)]*\)/g,'').trim();
function splitRecord(line,delimiter){
 const cells=[];let cell='',quoted=false;
 for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){cells.push(cell.trim());cell='';}else cell+=c;}
 if(quoted)throw Error('Una fila contiene comillas sin cerrar. Revisa la tabla del documento.');cells.push(cell.trim());return cells;
}
export function stockRuleTable(raw,sourceId){
 const lines=text(raw).split(/\r?\n/),rows=[],unread=[];let map=null,delimiter=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line||/^\[(Pagina|Página|Hoja) /.test(line))continue;
  const candidate=['\t',';','|',','].filter(d=>line.includes(d)).map(d=>{try{return {d,c:splitRecord(line,d)}}catch{return {d,c:[]}}}).find(({c})=>c.some(x=>aliases.quantity.includes(cleanHeader(x)))&&c.some(x=>aliases.name.includes(cleanHeader(x))));
  if(candidate){delimiter=candidate.d;map=Object.fromEntries(Object.entries(aliases).map(([k,names])=>[k,candidate.c.findIndex(c=>names.includes(cleanHeader(c)))]));continue;}
  if(!map){unread.push({line:i+1,text:line});continue;}
  const cells=splitRecord(line,delimiter),get=k=>map[k]>=0?cells[map[k]]||'':'';
  if(!text(get('name'))){unread.push({line:i+1,text:line});continue;}
  rows.push({id:sourceId+':line:'+String(i+1),source_id:sourceId,line_id:'line-'+String(i+1),locator:'Línea '+(i+1),name:get('name'),reference:get('reference'),ean:get('ean'),variant:get('variant'),quantity:stockRuleQuantity(get('quantity')),unit:stockRuleUnit(get('unit')),raw:line});
 }
 return {rows,unread,parser:map?'table-v1':'unrecognized',needsReview:true};
}
// Known printable layouts are proposals only: coverage is confirmed against the original.
export function readStockRuleSource(source){
 const raw=text(source.extracted_text),id=source.id;
 const table=stockRuleTable(raw,id);if(table.rows.length)return table;
 const lines=raw.split(/\r?\n/).map(s=>s.trim()),rows=[];
 const push=(i,name,qty,reference='',ean='',locator='')=>{
  if(!text(name))return;
  rows.push({id:id+':line:'+String(i+1),source_id:id,line_id:'line-'+String(i+1),locator:locator||'Línea '+(i+1),name:text(name),reference,ean,variant:'',quantity:stockRuleQuantity(qty),unit:/\b(?:pack\s*\d+|\d+\s*pcs|caja de)\b/i.test(name)?'pack':'',raw:lines[i]});
 };
 if(source.source_kind==='supplier'&&/Referencia\s+Cantidad\s+Descripci[oó]n/i.test(raw)){
  for(let i=0;i<lines.length;i++){const m=lines[i].match(/^([A-Z0-9][A-Z0-9._/-]*)\s+(-?\d+(?:[.,]\d+)?)\s+(.+?)\s+\d+[.,]\d{2}(?:\s|$)/i);if(m)push(i,m[3],m[2],m[1]);}
  return {rows,unread:[],parser:'reference-quantity-description-v1',needsReview:true};
 }
 if(source.source_kind==='supplier'&&/SKU\s+Descripci[oó]n\s+Uds/i.test(raw)){
  for(let i=0;i<lines.length;i++){const m=lines[i].match(/^(\d{5,})\s+(.+)/);if(!m)continue;let ean='',qty=null;
   for(let j=i+1;j<Math.min(i+5,lines.length);j++){const e=lines[j].match(/^EAN:\s*(\d+)/i);if(e)ean=e[1];const q=lines[j].match(/^(-?\d+(?:[.,]\d+)?)\s+[-\d.,]+\s*€/);if(q){qty=q[1];break;}}
   push(i,m[2],qty,m[1],ean);
  }
  return {rows,unread:[],parser:'sku-ean-invoice-v1',needsReview:true};
 }
 if(source.source_kind==='supplier'&&/Descripci[oó]n Cantidad Tarifa IEV/i.test(raw)){
  let active=false,buffer=[],first=0;
  for(let i=0;i<lines.length;i++){
   let s=lines[i];if(/^Descripci[oó]n Cantidad Tarifa IEV/i.test(s)){active=true;buffer=[];continue;}
   if(/^P[aá]gina:\s*\d+\s*\/\s*\d+/.test(s)){active=true;buffer=[];s=s.replace(/^P[aá]gina:\s*\d+\s*\/\s*\d+/,'');}
   if(!active||!s||/^(Precio|unitario Subtotal)$/.test(s))continue;
   if(/^(Internet Inteligente|VAPERALIA|Subtotal|Impuestos|Total |Impuesto Base|Fecha factura|Tel[eé]fono:)/i.test(s)){active=false;buffer=[];continue;}
   const m=s.match(/^(.*?)\s*(-?\d+(?:[.,]\d+)?)\s+-?\d+[.,]\d+\s+-?\d+(?:[.,]\d+)?\s+-?\d+[.,]\d+\s+-?\d+[.,]\d+\s*€$/);
   if(m){push(first||i,[...buffer,m[1]].filter(Boolean).join(' '),m[2],'','','Líneas '+((first||i)+1)+'–'+(i+1));buffer=[];first=0;}
   else{if(!buffer.length)first=i;buffer.push(s);}
  }
  return {rows,unread:[],parser:'description-tariff-invoice-v1',needsReview:true};
 }
 if(source.source_kind==='prestashop'&&/Nombre\s+completo[\s\S]*Ref\s+Empleado/i.test(raw)){
  let start=0;
  for(let i=0;i<lines.length;i++){
   if(/^Ref\s+Empleado/.test(lines[i])){start=i+1;continue;}
   const m=lines[i].match(/^A[ñn]adido\s+(\d+(?:[.,]\d+)?)(?:\s|$)/i);if(!m)continue;
   const block=lines.slice(start,i),refAt=block.findIndex(s=>/\S+\s+(?:Hortimatic|NewOldSmok),?$/i.test(s));
   if(refAt>=0){const ref=block[refAt].replace(/\s+(?:Hortimatic|NewOldSmok),?$/i,'');push(start,block.slice(0,refAt).filter(s=>!/^\d{2}:|^Stock [•·]|^Nombre|^completo/.test(s)).join(' '),m[1],ref,'','Líneas '+(start+1)+'–'+(i+1));}
   start=i+1;
  }
  return {rows,unread:[],parser:'prestashop-added-report-v1',needsReview:true};
 }
 return table;
}
function variantCompatible(a,b){
 if(text(a.variant)&&text(b.variant)&&stockRuleName(a.variant)!==stockRuleName(b.variant))return false;
 // An exact SKU must not conceal contradictory nicotine, volume or coil ratings.
 const measures=l=>{const out=new Map();for(const m of (text(l.name)+' '+text(l.variant)).matchAll(/(\d+(?:[.,]\d+)?)\s*(mg|ml|ohm|Ω)\b/gi)){const unit=m[2].toLowerCase().replace('ω','ohm');if(!out.has(unit))out.set(unit,new Set());out.get(unit).add(Number(m[1].replace(',','.')));}return out;};
 const x=measures(a),y=measures(b);for(const [unit,values]of x)if(y.has(unit)&&![...values].some(v=>y.get(unit).has(v)))return false;
 return true;
}
function identifiersConflict(a,b){return !!(text(a.ean)&&text(b.ean)&&code(a.ean)!==code(b.ean));}
function equivalenceFor(a,b,receipt,equivalences){
 const matches=equivalences.filter(e=>e.store_id===receipt.store_id&&stockRuleName(e.supplier)===stockRuleName(receipt.supplier)&&stockRuleName(e.supplier_name)===stockRuleName(a.name)&&stockRuleName(e.prestashop_name)===stockRuleName(b.name)&&(!text(a.variant)||stockRuleName(e.variant)===stockRuleName(a.variant))&&(!text(b.variant)||stockRuleName(e.variant)===stockRuleName(b.variant))&&Number(e.unit_factor)>0&&text(e.evidence));
 return matches.length===1?matches[0]:null;
}
function identity(a,b,receipt,equivalences){
 if(!variantCompatible(a,b)||identifiersConflict(a,b))return null;
 const e=equivalenceFor(a,b,receipt,equivalences);
 if(text(a.ean)&&text(b.ean)&&code(a.ean)===code(b.ean))return {method:'EAN exacto',equivalence:e};
 if(text(a.reference)&&text(b.reference)&&code(a.reference)===code(b.reference))return {method:'Referencia exacta',equivalence:e};
 if(e)return {method:'Equivalencia confirmada',equivalence:e};
 if(stockRuleName(a.name)&&stockRuleName(a.name)===stockRuleName(b.name)&&stockRuleName(a.variant)===stockRuleName(b.variant))return {method:'Nombre y variante exactos'};
 return null;
}
export function compareStockRuleLines({receipt,supplier=[],prestashop=[],equivalences=[]}){
 const all=[...supplier,...prestashop],ids=new Set();
 for(const l of all){if(!l.id||ids.has(l.id)||!l.source_id||!l.line_id||!l.locator||!text(l.name))throw Error('Falta el origen de una línea o está duplicada.');ids.add(l.id);if(l.quantity!==null&&stockRuleQuantity(l.quantity)===null)throw Error('Cantidad no válida.');}
 const edges=supplier.map(a=>prestashop.map((b,index)=>({index,...identity(a,b,receipt,equivalences)})).filter(e=>e.method));
 const claims=new Map();for(const e of edges)for(const m of e)claims.set(m.index,(claims.get(m.index)||0)+1);
 const used=new Set(),rows=[];
 const ref=l=>({source_id:l.source_id,line_id:l.line_id,locator:l.locator});
 const build=(a,b,match)=>{
  const e=match?.equivalence,unitA=stockRuleUnit(a?.unit),unitB=stockRuleUnit(b?.unit);
  const explicitFactor=stockRuleQuantity(a?.factor),explicitConversion=unitB==='ud'&&explicitFactor>0&&text(a?.conversionNote).length>=20;
  const units=!!e||explicitConversion||(unitA==='ud'&&unitB==='ud');
  const positive=(a?.quantity??0)>=0&&(b?.quantity??0)>=0;
  const row={id:'rules-'+String(rows.length+1),supplier_name:a?.name||'',prestashop_name:b?.name||'',supplier_qty:a?a.quantity:0,prestashop_qty:b?b.quantity:0,variant:a?.variant||b?.variant||'',unit:e?.unit||unitA||unitB||'',unit_factor:e?Number(e.unit_factor):explicitConversion?explicitFactor:units?1:null,unit_confirmed:units&&positive,match_confirmed:!!match&&positive,adjustment_qty:0,adjustment_included:'no',conversion_reason:e?.evidence||(explicitConversion?text(a.conversionNote):''),adjustment_reason:'',match_note:match?match.method:'Sin correspondencia única. Revisa referencias, variantes o la biblioteca.',source_refs:[a,b].filter(Boolean).map(ref),rule_evidence:{method:match?.method||'unmatched',supplier_reference:a?.reference||'',prestashop_reference:b?.reference||'',ean:a?.ean||b?.ean||'',equivalence_id:e?.id||null}};
  row.rule_evidence.input_edits=[a,b].filter(Boolean).filter(l=>l.original&&Object.entries(l.original).some(([key,value])=>l[key]!==value)).map(l=>({source_id:l.source_id,line_id:l.line_id,original:l.original,revised:Object.fromEntries(Object.keys(l.original).map(k=>[k,l[k]]))}));
  rows.push(row);
 };
 supplier.forEach((a,i)=>{const matches=edges[i];if(matches.length===1&&claims.get(matches[0].index)===1){const m=matches[0];used.add(m.index);build(a,prestashop[m.index],m);}else build(a,null,null);});
 prestashop.forEach((b,i)=>{if(!used.has(i))build(null,b,null);});
 return rows;
}
export function stockRuleResult(context,documents){
 if(documents.length!==context.sources.length||new Set(documents.map(d=>d.source_id)).size!==documents.length)throw Error('Revisa todos los documentos asociados.');
 const supplier=[],prestashop=[],coverage=[];
 for(const source of context.sources){
  const d=documents.find(d=>d.source_id===source.id);if(!d||!d.reviewed||text(d.note).length<20)throw Error('Confirma la lectura de cada documento y explica la comprobación (20 caracteres como mínimo).');
  if(d.included){if(!d.rows?.length)throw Error('El documento seleccionado no tiene líneas.');for(const row of d.rows){if(row.source_id!==source.id)throw Error('Una línea pertenece a otro documento.');(source.source_kind==='supplier'?supplier:prestashop).push(row);}}
  coverage.push({source_id:source.id,complete:true,explanation:d.included?'Líneas revisadas mediante cotejo por reglas. '+text(d.note):'Documento excluido para evitar duplicidad o por no pertenecer al cotejo: '+text(d.note),manually_verified:true,reading_note:text(d.note)});
 }
 if(!supplier.length||!prestashop.length)throw Error('Selecciona una factura o albarán y una entrada de PrestaShop con líneas.');
 const rows=compareStockRuleLines({receipt:context.receipt,supplier,prestashop,equivalences:context.equivalences||[]});
 const result={rows,coverage,complete:true,engine:{name:'totus-documentary-rules',version:1,uses_ai:false}};
 return {result,summary:stockSummary(result,context.sources),details:rows.map(stockLineResult)};
}
