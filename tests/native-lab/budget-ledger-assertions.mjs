/** Real isolated PostgreSQL; native command receipts below are explicit fixtures. */
import {nativeQuoteFingerprint} from '../../src/totustpv/server/quote-contract.js';
import {commercialFromNativeQuote} from '../../src/totustpv/server/commercial-quote-contract.js';
export async function exerciseBudgetLedger({db,scope,id,check,denied}){
 const cashScope={...scope};
 scope={...scope,sessionId:id(9699)}; // A quotation identity, deliberately not an open cash session.
 await db.exec('begin;reset role;set role service_role');
 try{
  const reject=async(fn,pattern)=>{await db.exec('savepoint budget_rejection');await denied(fn,pattern);await db.exec('rollback to budget_rejection');};
  const now=Date.now(),cart=9600,cartId=id(9601),quoteId=id(9602),budgetId=id(9603),nativeLine={product_id:101,attribute_id:0,quantity:2,catalogue_name:'Artículo del presupuesto',unit_tax_incl:'8.012100',unit_tax_excl:'6.621570',line_tax_incl:'16.020000',line_tax_excl:'13.240000'};
  const nativeQuote={commercial_only:true,cart_id:cart,shop_id:scope.shopId,currency:scope.currency,customer_id:501,invoice_address_id:601,delivery_address_id:601,currency_id:1,language_id:1,carrier_id:5,round_mode:2,round_type:2,lines:[nativeLine],total_cents:1602,total_tax_incl:'16.020000',total_tax_excl:'13.240000',products_tax_incl:'16.020000',products_tax_excl:'13.240000',shipping_tax_incl:'0.000000',discounts_tax_incl:'0.000000'};
  const result={verified:true,native_reference:cart,quoted_at:now,quote:nativeQuote,quote_fingerprint:await nativeQuoteFingerprint(nativeQuote)},cartPayload={session_id:scope.sessionId,drawer_id:scope.drawerId,customer_id:501,invoice_address_id:601,delivery_address_id:601,commercial_only:true,lines:[{product_id:101,attribute_id:0,quantity:2}]};
  const commercial=await commercialFromNativeQuote({scope,ownedCart:{...scope,commercialOnly:true,cartId:cart,customerId:501,invoiceAddressId:601,deliveryAddressId:601,currencyId:1,languageId:1,carrierId:5},profile:{...scope,verified:true,nativeVersion:'8.2.8',quoteLifetimeMs:120000},response:result,now});
  const native=async(action,operation,data)=>(await db.query('select public.totus_tpv_native_command($1,$2,$3,$4) result',[action,operation,JSON.stringify(scope),JSON.stringify(data)])).rows[0].result;
  await reject(()=>native('claim',id(9698),{command:'cart.prepare',payload:{...cartPayload,commercial_only:false}}),/SESSION|FORBIDDEN/);
  for(const [commandId,command,payload,receipt]of [[cartId,'cart.prepare',cartPayload,{verified:true,native_reference:cart,cart_id:cart,commercial_only:true}],[quoteId,'cart.quote',{cart_id:cart,commercial_only:true},result]]){check((await native('claim',commandId,{command,payload})).won,true);check((await native('complete',commandId,{result:receipt})).status,'verified');}
  const request={intentHash:'f'.repeat(64),payload:{lines:[{productId:101,attributeId:0,qty:2,label:'Artículo del presupuesto'}]},snapshot:commercial.snapshot,cartOperationId:cartId,quoteOperationId:quoteId,calculationExpiresAt:commercial.calculationExpiresAt,validDays:30,title:'Presupuesto de prueba',publicNote:'Preparación y recogida en tienda.'};
  const call=async(action,budget,data={},selected=scope)=>(await db.query('select public.totus_tpv_budgets($1,$2::jsonb,$3::uuid,$4::jsonb) result',[action,JSON.stringify(selected),budget,JSON.stringify(data)])).rows[0].result;
  const money=async()=>(await db.query('select (select count(*) from private.totus_tpv_operations)::integer sales,(select count(*) from private.totus_tpv_payment_events)::integer payments')).rows[0];
  check(await call('recover',budgetId,{intentHash:request.intentHash}),null);
  const before=await money(),saved=await call('create',budgetId,request);check(saved.status,'saved');check(saved.totalCents,1602);check(saved.snapshot.nativeCartId,undefined);check(saved.snapshot.nativeQuoteFingerprint,undefined);check(saved.payload.customerId,501);check(saved.reference.startsWith('P-'),true);
  check(await call('create',budgetId,request),saved);check(await call('get',budgetId),saved);check(await money(),before);
  const list=await call('list',null,{limit:1,search:'prueba'});check(list.items.length,1);check(list.hasMore,false);check(list.items[0].payload,undefined);check(list.items[0].snapshot,undefined);
  check(await call('recover',budgetId,{intentHash:request.intentHash}),saved);await reject(()=>call('recover',budgetId,{intentHash:'a'.repeat(64)}),/ALREADY_BOUND/);
  await reject(()=>call('create',budgetId,{...request,validDays:31}),/ALREADY_BOUND/);
  await reject(()=>call('create',id(9604),{...request,snapshot:{...request.snapshot,totalCents:1}}),/NATIVE_PROOF_REQUIRED/);
  await reject(()=>call('create',id(9604),{...request,payload:{lines:[{...request.payload.lines[0],qty:3}]}}),/SNAPSHOT_INVALID/);
  await reject(()=>call('create',id(9604),{...request,snapshot:{...request.snapshot,lines:[{...request.snapshot.lines[0],unitTaxInclMicros:1}]}}),/SNAPSHOT_INVALID/);
  await reject(()=>call('get',budgetId,{}, {...scope,storeId:id(22)}),/FORBIDDEN|INVALID/);
  const checkout=async(action,version,selected=cashScope)=>(await db.query('select public.totus_tpv_budget_checkout($1::jsonb,$2,$3,$4) result',[JSON.stringify(selected),budgetId,version,action])).rows[0].result;
  await reject(()=>checkout('open',saved.version,scope),/SESSION|FORBIDDEN/);
  await db.exec('savepoint budget_conversion');
  const opened=await checkout('open',saved.version);check(opened.budget.status,'checkout');check(opened.draft.status,'claimed');check(opened.draft.mine,true);check(opened.draft.sessionId,cashScope.sessionId);check(opened.draft.payload,saved.payload);
  check(opened.draft.expiresAt,opened.budget.validUntil);check(await checkout('open',saved.version),opened);check(await money(),before);
  await db.query('select public.totus_tpv_drafts($1,$2,$3,$4::jsonb,$5::jsonb)',['archive',opened.draft.id,id(9610),JSON.stringify(cashScope),JSON.stringify({version:opened.draft.version})]);
  const released=await call('get',budgetId);check(released.status,'saved');check(released.draftId,null);check(released.snapshot,saved.snapshot);
  await reject(()=>checkout('open',saved.version),/STALE/);
  const reopened=await checkout('open',released.version);check(reopened.draft.id!==opened.draft.id,true);check(reopened.draft.payload,saved.payload);
  const cancelled=await checkout('cancel',reopened.budget.version);check(cancelled.budget.status,'cancelled');check(await checkout('cancel',reopened.budget.version),cancelled);
  await reject(()=>checkout('open',cancelled.budget.version),/CLOSED/);check(await money(),before);
  await db.exec('rollback to budget_conversion');
  await db.exec('savepoint budget_expiry');
  await db.query("update private.totus_tpv_budgets set created_at=clock_timestamp()-interval '2 days',valid_until=clock_timestamp()-interval '1 day' where id=$1",[budgetId]);
  await reject(()=>checkout('open',saved.version),/EXPIRED/);check((await call('get',budgetId)).expired,true);
  await db.exec('rollback to budget_expiry');
  await db.query("update private.totus_tpv_native_commands set result=jsonb_set(result,'{quoted_at}',to_jsonb($1::bigint)) where id=$2",[now-121000,quoteId]);
  check(await call('create',budgetId,request),saved); // Previously saved document recovers; its deadline does not restart.
  await reject(()=>call('create',id(9604),request),/QUOTE_EXPIRED/);
  await db.exec('reset role;set role authenticated');await reject(()=>call('get',budgetId),/permission denied/);
  console.log('PASS commercial budget SQL: verified commercial snapshot, idempotent save, native proof and scope refusal, immutable prices/deadline, search, direct-browser denial and no financial journal/payment change. Native commands are seeded receipts here.');
 }finally{await db.exec('rollback');}
}
