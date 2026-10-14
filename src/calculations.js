export function parseDecimal(value){
 let s=String(value??'').trim().replace(/\s/g,'');
 if(!s)return 0;
 if(s.includes(',')&&s.includes('.')){
  if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');
  else s=s.replace(/,/g,'');
 }else s=s.replace(',','.');
 const n=Number.parseFloat(s);
 return Number.isFinite(n)?n:0;
}

export function quickPriceStudy({cost=0,pvp=0,competitor=0,discount=0,vat=21,re=5.2}={}){
 cost=parseDecimal(cost);pvp=parseDecimal(pvp);competitor=parseDecimal(competitor);
 discount=Math.min(100,Math.max(0,parseDecimal(discount)));
 vat=parseDecimal(vat);re=parseDecimal(re);
 const finalSale=pvp*(1-discount/100);
 const saleNet=finalSale/(1+vat/100);
 const costReal=cost*(1+vat/100+re/100);
 const margin=saleNet-cost;
 const marginPct=saleNet>0?margin/saleNet*100:0;
 const competitorDiff=competitor>0?finalSale-competitor:null;
 return {cost,pvp,competitor,discount,vat,re,finalSale,saleNet,costReal,margin,marginPct,competitorDiff};
}

/** Validates a received invoice payment before allowing a database write. */
export function validateExpensePayment(total,amountPaid,status){
 const invoice=Number(total),paid=Number(amountPaid);
 if(!Number.isFinite(invoice)||!Number.isFinite(paid)||invoice<0||paid<0)throw new Error('Introduce importes válidos, sin valores negativos.');
 if(paid>invoice+0.02)throw new Error('El importe pagado no puede superar el total de la factura.');
 if(status==='pagado'&&Math.abs(paid-invoice)>0.02)throw new Error('Si el gasto está pagado, el importe pagado debe coincidir con el total.');
 if(status==='pendiente'&&paid>0.02)throw new Error('Un gasto pendiente no puede tener importe pagado.');
 if(status==='parcial'&&(paid<=0||paid>=invoice-0.02))throw new Error('Un pago parcial debe ser mayor que cero e inferior al total de la factura.');
 return true;
}
