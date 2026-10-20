/** Localize numeric preview text; workbook values and formats stay untouched. */
export function workbookPreviewText(cell,formatCell,ssf){
 if(!cell)return '';
 if(cell.t!=='n'||!Number.isFinite(cell.v)||ssf.is_date(cell.z||''))return String(formatCell(cell));
 const formatted=String(ssf.format(cell.z||'General',cell.v));
 return formatted.replace(/\d[\d,]*(?:\.\d+)?/g,token=>token.replaceAll(',','\u0000').replaceAll('.',',').replaceAll('\u0000','.'));
}
