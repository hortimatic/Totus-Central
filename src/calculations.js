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

// paid_amount is always a positive magnitude: receipts on positive invoices,
// refunds on negative rectifying invoices. Never subtract a refund from receivables.
export const isInvoiceRefund=row=>row?.invoice_kind==='rectifying'&&Number(row.total_amount)<0;
export const invoiceOutstanding=row=>Math.max(0,Math.abs(Number(row?.total_amount||0))-Number(row?.paid_amount||0));
export function validateInvoiceSettlement(total,amount,status,date,today){
 if(!Number.isFinite(total)||!Number.isFinite(amount)||amount<0)throw new Error('Introduce un importe liquidado válido, igual o superior a cero.');
 if(!['pendiente','pagada','parcial'].includes(status))throw new Error('Estado de liquidación no válido.');
 if(date&&date>today)throw new Error('La fecha de liquidación no puede ser futura.');
 if(amount>Math.abs(total)+0.02)throw new Error('El importe liquidado no puede superar el total del documento.');
 if(status==='pendiente'&&amount!==0)throw new Error('Un documento pendiente no puede tener importe liquidado.');
 if(status==='pagada'&&(!date||Math.abs(amount-Math.abs(total))>0.02))throw new Error('Un documento saldado debe tener fecha y el importe total liquidado.');
 if(status==='parcial'&&(!date||amount<=0||amount>=Math.abs(total)-0.02))throw new Error('Una liquidación parcial necesita fecha e importe mayor que cero e inferior al total.');
 return true;
}

export function quickPriceStudy({cost=0,pvp=0,competitor=0,discount=0,vat=21,re=5.2}={}){
 cost=parseDecimal(cost);pvp=parseDecimal(pvp);competitor=parseDecimal(competitor);
 discount=Math.min(100,Math.max(0,parseDecimal(discount)));
 vat=parseDecimal(vat);re=parseDecimal(re);
 const finalSale=pvp*(1-discount/100);
 const saleNet=finalSale/(1+vat/100);
 const costReal=cost*(1+vat/100+re/100);
 // Recargo de equivalencia: purchase VAT and RE are not recoverable.
 // Economic margin is the gross amount collected minus the actual purchase outflow.
 const margin=finalSale-costReal;
 const marginPct=finalSale>0?margin/finalSale*100:0;
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

/** Rejects invalid invoice line amounts instead of silently replacing negatives with zero. */
export function validateExpenseLineAmounts({base,vat,re,withholding,deductiblePct}){
 const fields=[['Base imponible',base,false],['IVA',vat,true],['Recargo de equivalencia',re,true],['Retención',withholding,true],['Porcentaje deducible',deductiblePct,true]];
 for(const [label,value,isPercent] of fields){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||(isPercent&&value>100)){
   throw new Error(label+': introduce '+(isPercent?'un porcentaje entre 0 y 100':'un importe igual o superior a cero')+'.');
  }
 }
 return {base,vat,re,withholding,deductiblePct};
}

/** Internal-only costs (overtime, warehouse) must never leak into fiscal expense data. */
export function validateExpenseClassification(lines,categories,managementOnly){
 const internalIds=new Set(categories.filter(c=>String(c.code||'').startsWith('INTERNAL_')).map(c=>String(c.id)));
 const internalLines=lines.filter(l=>internalIds.has(String(l.category_id||'')));
 if(!internalLines.length)return true;
 if(!managementOnly)throw new Error('Este concepto es solo de control interno. Activa «Solo control interno» antes de guardar.');
 if(lines.some(l=>l.category_id&&!internalIds.has(String(l.category_id))))throw new Error('No mezcles conceptos internos y fiscales en una misma factura. Regístralos por separado.');
 if(internalLines.some(l=>l.deductible_irpf!==false||Number(l.deductible_pct||0)>0))throw new Error('Un concepto interno no puede marcarse como deducible en IRPF.');
 return true;
}

/** One accumulated model 130 estimate for both screen and gestor workbook. */
export function computeModel130Accumulated({
 income=0,deductible=0,extraDeductible=0,reductions=0,previousPayments=0,
 withholdings=0,rate=20,difficultRate=5,difficultAnnualCap=2000,difficultEnabled=true
}={}){
 const valid=(v,k)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error('Modelo 130: valor inválido '+k);return n};
 income=valid(income,'ingresos');deductible=valid(deductible,'gastos');
 extraDeductible=valid(extraDeductible,'ajustes');reductions=valid(reductions,'reducciones');
 previousPayments=valid(previousPayments,'pagos anteriores');withholdings=valid(withholdings,'retenciones');
 rate=valid(rate,'porcentaje IRPF');difficultRate=valid(difficultRate,'difícil justificación');
 difficultAnnualCap=valid(difficultAnnualCap,'tope anual');
 const beforeDifficult=Math.max(0,income-deductible-extraDeductible-reductions);
 const difficult=difficultEnabled?Math.min(beforeDifficult*difficultRate/100,difficultAnnualCap):0;
 const base=Math.max(0,beforeDifficult-difficult);
 const gross=base*rate/100;
 return {beforeDifficult,difficult,base,gross,due:Math.max(0,gross-previousPayments-withholdings)};
}

/** The same deductible expense total for Inicio, Fiscalidad and exported Modelo 130. */
export function deductibleExpenseTotal(expenses=[],lines=[]){
 const eligible=expenses.filter(x=>!x.management_only&&x.fiscal_reviewed!==false);
 const ids=new Set(eligible.map(x=>String(x.id)));
 const withLines=new Set();
 let total=0;
 for(const line of lines){
  const id=String(line.expense_id||'');if(!ids.has(id))continue;
  withLines.add(id);
  if(line.deductible_irpf===false)continue;
  const amount=Number(line.irpf_imputable??0);
  if(!Number.isFinite(amount))throw new Error('Importe imputable a IRPF no numérico.');
  total+=amount;
 }
 for(const expense of eligible){
  if(withLines.has(String(expense.id))||expense.deductible_irpf===false)continue;
  const amount=Number(expense.accounting_amount??expense.gross_expense??expense.amount_paid??0);
  const pct=Number(expense.deductible_pct??100);
  if(!Number.isFinite(amount)||!Number.isFinite(pct)||pct<0||pct>100)throw new Error('Gasto o porcentaje deducible inválido.');
  total+=amount*pct/100;
 }
 return total;
}
/** A bank payment awaiting an invoice match is evidence, not another operating cost. */
export function isUnreconciledPayment(expense){
 if(!expense?.management_only)return false;
 try{const source=JSON.parse(expense.source_ref);return source?.kind==='bank_payment_source'&&source.requires_invoice_reconciliation===true}catch{return false;}
}
export function expenseCostAmount(expense){
 return isUnreconciledPayment(expense)?0:Number(expense.gross_expense??expense.accounting_amount??expense.amount_paid??0);
}
export function issuedDocumentFileLocked(id,invoices=[]){
 return !!id&&invoices.some(i=>i.status!=='borrador'&&[i.source_document_id,i.generated_document_id].includes(id));
}
