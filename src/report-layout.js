export const REPORT_BLOCKS=['income','internal','monthly','gestor','exports'];
export function normalizeReportOrder(value){const known=Array.isArray(value)?value.filter((x,i)=>REPORT_BLOCKS.includes(x)&&value.indexOf(x)===i):[];return [...known,...REPORT_BLOCKS.filter(x=>!known.includes(x))]}
export function moveReportBlock(value,id,direction){const order=normalizeReportOrder(value),index=order.indexOf(id),next=index+(direction==='up'?-1:direction==='down'?1:0);if(index<0||next<0||next>=order.length)return order;[order[index],order[next]]=[order[next],order[index]];return order}
