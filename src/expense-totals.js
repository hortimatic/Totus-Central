// PostgreSQL numeric rounds currency per line, including negative credit notes.
const currency=v=>Math.sign(v)*Math.round((Math.abs(v)+Number.EPSILON)*100)/100;
export function expenseLineAmounts(line){
 const base=currency(Number(line.base_amount||0));
 const vat=currency(base*Number(line.vat_rate||0)/100);
 const re=currency(base*Number(line.re_rate||0)/100);
 const withholding=currency(base*Number(line.withholding_rate||0)/100);
 return {base_amount:base,vat_amount:vat,re_amount:re,withholding_amount:withholding};
}
export function expenseTotals(lines){
 const result={base:0,vat:0,re:0,withholding:0};
 for(const row of lines){const l=expenseLineAmounts(row);result.base+=l.base_amount;result.vat+=l.vat_amount;result.re+=l.re_amount;result.withholding+=l.withholding_amount;}
 for(const key of Object.keys(result))result[key]=currency(result[key]);
 result.cost=currency(result.base+result.vat+result.re);
 result.total=currency(result.cost-result.withholding);
 return result;
}
