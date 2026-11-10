/* A gate over independently verified, normalized PrestaShop order-product lines.
   NO prices/costs are read or estimated in this module. The real adapter must
   prove the ex-tax bases, discounts, refunds, currency and historical cost. */
const validCents=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1_000_000_000_000;
export function verifiedProductMargin(lines,{currency='EUR'}={}){
 if(!Array.isArray(lines))throw new Error('Se requiere una lista de líneas');
 const totals={saleCents:0,costCents:0,marginCents:0,eligibleLines:0,verifiedLines:0,unverifiedLines:0,verifiedSaleCents:0};
 const failures=new Set();
 for(const line of lines){
   if(!line||!['product','return'].includes(line.kind)||line.excluded===true)continue;
   totals.eligibleLines++;
   const signed=line.kind==='return'?-1:1;
   const sourceCurrency=line.currency;
   const isValid=line.costVerified===true&&line.saleVerified===true&&line.costAtSaleVerified===true&&line.taxBasis==='ex-tax'&&sourceCurrency===currency&&validCents(line.saleCents)&&validCents(line.costCents)&&line.saleCents>=0&&line.costCents>=0;
   if(!isValid){totals.unverifiedLines++;failures.add(sourceCurrency!==currency?'moneda sin verificar':'coste, venta o descuentos sin verificar');continue;}
   totals.verifiedLines++;
   totals.saleCents+=signed*line.saleCents;
   totals.costCents+=signed*line.costCents;
   totals.verifiedSaleCents+=signed*line.saleCents;
 }
 totals.marginCents=totals.saleCents-totals.costCents;
 const status=totals.eligibleLines===0?'empty':totals.verifiedLines===0?'unavailable':totals.unverifiedLines?'partial':'verified';
 return {...totals,status,currency,marginPct:status==='verified'&&totals.saleCents!==0?100*totals.marginCents/totals.saleCents:null,
   displayTotal:status==='verified'?totals.marginCents:null,warnings:[...failures]};
}
