/** Accepted store totals retain drawer balances without inventing a payment split. */
export function sourceClosingReconciled(closing){
 if(closing?.entry_mode!=='source_snapshot'||closing.status!=='cerrado'||closing.include_in_income!==true)return false;
 let source;try{source=JSON.parse(closing.source_ref||'{}')}catch{return false;}
 const approval=source.cash_reconciliation,drawers=source.daily_drawers??source.drawers;
 if(approval?.version!==1||approval?.scope!=='store'||approval?.status!=='accepted'||!Array.isArray(drawers)||!drawers.length)return false;
 const valid=v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v));
 const cents=v=>Math.round(Number(v)*100);
 if(!['opening_cash','actual_cash','cash_sales','card_sales','cash_withdrawals'].every(k=>valid(closing[k])))return false;
 const sourceWithdrawals=source.withdrawals==null&&approval.blank_withdrawals_as_zero===true?0:source.withdrawals;
 if(!valid(source.card_sales)||!valid(sourceWithdrawals)||!valid(approval.total))return false;
 if(!drawers.every(d=>valid(d.opening)&&valid(d.closing)))return false;
 if(cents(drawers.reduce((s,d)=>s+Number(d.opening),0))!==cents(closing.opening_cash)||cents(drawers.reduce((s,d)=>s+Number(d.closing),0))!==cents(closing.actual_cash))return false;
 if(cents(source.card_sales)!==cents(closing.card_sales)||cents(sourceWithdrawals)!==cents(closing.cash_withdrawals))return false;
 const cash=Number(closing.actual_cash)+Number(closing.cash_withdrawals)+Number(closing.cash_expenses_declared||0)+Number(closing.cash_extra_out||0)-Number(closing.cash_extra_in||0)-Number(closing.opening_cash);
 const total=cash+['card_sales','bizum_sales','online_sales','other_income'].reduce((s,k)=>s+Number(closing[k]||0),0);
 return cents(cash)>=0&&cents(cash)===cents(closing.cash_sales)&&cents(total)===cents(approval.total);
}
/** A raw register snapshot may contain carried cash; it is not a verified sale. */
export function closingIncomeAmount(closing){
 if(!closing||closing.include_in_income===false)return 0;
 if(closing.entry_mode==='source_snapshot'&&!sourceClosingReconciled(closing)){
  throw new Error('El dato «al fin» del origen no es una venta verificada. Concilia el cierre y conserva la referencia fiscal del mes.');
 }
 return ['cash_sales','card_sales','bizum_sales','online_sales','other_income'].reduce((total,key)=>total+Number(closing[key]||0),0);
}
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
export function validateExpensePayment(total,amountPaid,status,documentKind='factura'){
 const signedInvoice=Number(total),signedPaid=Number(amountPaid),credit=documentKind==='rectificativa'&&signedInvoice<0;
 if(!Number.isFinite(signedInvoice)||!Number.isFinite(signedPaid)||(!credit&&(signedInvoice<0||signedPaid<0)))throw new Error('Introduce importes válidos, sin valores negativos.');
 if(credit&&signedPaid>0)throw new Error('En un abono, indica el importe devuelto con signo negativo.');
 const invoice=Math.abs(signedInvoice),paid=Math.abs(signedPaid);
 if(paid>invoice+0.02)throw new Error('El importe pagado no puede superar el total de la factura.');
 if(status==='pagado'&&Math.abs(paid-invoice)>0.02)throw new Error('Si el gasto está pagado, el importe pagado debe coincidir con el total.');
 if(status==='pendiente'&&paid>0.02)throw new Error('Un gasto pendiente no puede tener importe pagado.');
 if(status==='parcial'&&(paid<=0||paid>=invoice-0.02))throw new Error('Un pago parcial debe ser mayor que cero e inferior al total de la factura.');
 return true;
}

/** Rejects invalid invoice line amounts instead of silently replacing negatives with zero. */
export function validateExpenseLineAmounts({base,vat,re,withholding,deductiblePct,documentKind='factura'}){
 const fields=[['Base imponible',base,false],['IVA',vat,true],['Recargo de equivalencia',re,true],['Retención',withholding,true],['Porcentaje deducible',deductiblePct,true]];
 for(const [label,value,isPercent] of fields){
  if(typeof value!=='number'||!Number.isFinite(value)||(value<0&&(isPercent||documentKind!=='rectificativa'))||(isPercent&&value>100)){
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

/** Use the same reviewed/non-internal scope for all tax forecasts. */
export const isReviewedFiscalExpense=expense=>!!expense&&!expense.management_only&&expense.fiscal_reviewed!==false;

/** The same deductible expense total for Inicio, Fiscalidad and exported Modelo 130. */
export function deductibleExpenseTotal(expenses=[],lines=[]){
 const eligible=expenses.filter(isReviewedFiscalExpense);
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

/** Planning baseline: recorded settlements, or our own prior-quarter estimates.
 * A comparison figure (status previsto) must never drive the forecast.
 */
export function estimatePriorModel130(data,year,quarter,store='all'){
 const inPeriod=(date,from,to)=>String(date||'')>=from&&String(date||'')<=to;
 const storeOk=row=>store==='all'||row.store_id===store;
 const sum=(rows,amount)=>rows.reduce((n,row)=>n+Number(amount(row)||0),0);
 const settings=data.settings||{};let total=0,recorded=0,estimated=0;
 for(let q=1;q<quarter;q++){
  const paid=(data.taxPayments||[]).find(x=>x.tax_type==='130'&&Number(x.fiscal_year)===year&&Number(x.quarter)===q&&['pagado','compensado'].includes(x.status));
  if(paid){total+=Number(paid.amount||0);recorded+=Number(paid.amount||0);continue;}
  const from=`${year}-01-01`,to=`${year}-${String(q*3).padStart(2,'0')}-${new Date(year,q*3,0).getDate()}`;
  const filter=(rows,key)=>(rows||[]).filter(x=>storeOk(x)&&inPeriod(x[key],from,to));
  const adjustments=filter(data.fiscalAdjustments,'adjustment_date');
  const extra=kinds=>sum(adjustments.filter(x=>kinds.includes(x.kind)),x=>x.amount);
  const income=sum(filter(data.closings,'business_date').filter(x=>x.include_in_income!==false),closingIncomeAmount)
   +sum(filter(data.invoices,'issue_date').filter(x=>x.document_type==='factura'&&x.status==='emitida'&&x.include_in_income===true),x=>x.total_amount)
   +sum(filter(data.incomeAdjustments,'income_date'),x=>x.amount)+extra(['ingreso_extra']);
  const result=computeModel130Accumulated({income,deductible:deductibleExpenseTotal(filter(data.expenses,'expense_date'),data.expenseLines||[]),
   extraDeductible:extra(['gasto_deducible_extra','amortizacion']),reductions:extra(['reduccion']),withholdings:extra(['retencion_soportada']),previousPayments:total,
   rate:settings.irpf_prepayment_rate??20,difficultRate:settings.difficult_expense_pct??5,difficultAnnualCap:settings.difficult_expense_annual_cap??2000,difficultEnabled:settings.difficult_expense_enabled!==false});
  const amount=Math.round((result.due+Number.EPSILON)*100)/100;total+=amount;estimated+=amount;
 }
 return {total,recorded,estimated};
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
