export async function exercisePaymentReferenceLedger({db,id,scope,expected,check,denied}){
 const operation=id(8800),hiddenOperation=id(8801),unsupportedOperation=id(8802),sql=async(action,op,data={})=>(await db.query('select public.totus_tpv_journal($1,$2,$3::jsonb,$4::jsonb) result',[action,op,JSON.stringify(scope),JSON.stringify(data)])).rows[0].result;
 const required={...expected(18800),supportsPaymentReferences:true,operatorPaymentPolicy:{referencePolicy:{card:'required'}}};
 const card={id:'card',method:'card',status:'settled',amountCents:required.totalCents};
 try{
  for(const [reference,valid] of [['OP-0042',true],['BANK/2026:18',true],['4111 1111 1111 1111',false],['CARD-5555-5555-5555-4444',false],['x\n',false],[' x',false],['<x>',false]])check((await db.query('select private.totus_tpv_valid_payment_reference($1) value',[reference])).rows[0].value,valid);
  await sql('prepare',operation,{expected:required,quoteExpiresAt:Date.now()+60000});
  const claim=payments=>sql('claim',operation,{revision:1,expected:required,payments});
  await denied(()=>claim([card]),/REFERENCE_REQUIRED/);
  for(const reference of [null,123,'4111111111111111','<x>','x'.repeat(65),' OP-0042'])await denied(()=>claim([{...card,reference}]),/REFERENCE_INVALID/);
  await denied(()=>claim([{...card,method:'cash',receivedCents:card.amountCents,reference:'OP-0042'}]),/CASH_REFERENCE_FORBIDDEN/);
  const accepted=[{...card,reference:'OP-0042'}];check((await claim(accepted)).won,true);
  check((await sql('get',operation)).payments,accepted);
  check((await claim([{...card,reference:'CHANGED'}])).won,false);
  check((await sql('get',operation)).payments,accepted);
  const hidden={...expected(18801),supportsPaymentReferences:true,operatorPaymentPolicy:{referencePolicy:{card:'hidden'}}};
  await sql('prepare',hiddenOperation,{expected:hidden,quoteExpiresAt:Date.now()+60000});
  await denied(()=>sql('claim',hiddenOperation,{revision:1,expected:hidden,payments:[{...card,reference:'OP-0042'}]}),/REFERENCE_FORBIDDEN/);
  await denied(()=>sql('claim',hiddenOperation,{revision:1,expected:hidden,payments:[{...card,providerVerified:true}]}),/PAYMENT_INVALID/);
  check((await sql('get',hiddenOperation)).status,'ready');
  const unsupported={...expected(18802),operatorPaymentPolicy:{referencePolicy:{card:'optional'}}};
  await sql('prepare',unsupportedOperation,{expected:unsupported,quoteExpiresAt:Date.now()+60000});
  await denied(()=>sql('claim',unsupportedOperation,{revision:1,expected:unsupported,payments:[{...card,reference:'OP-0042'}]}),/REFERENCE_UNAVAILABLE/);
  console.log('PASS payment reference SQL: required/hidden modes, cash/PAN/invalid rejection, exact persisted reference, changed retry cannot mutate the claimed allocation; no native request or confirmed payment.');
 }finally{await db.exec('reset role');await db.query('delete from private.totus_tpv_operations where id=any($1::uuid[])',[[operation,hiddenOperation,unsupportedOperation]]);await db.exec('set role service_role');}
}
