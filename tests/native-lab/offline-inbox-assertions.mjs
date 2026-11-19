import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export async function exerciseOfflineInbox({db,id,scope,expected,check,denied}){
 const call=async(action,operation,data={},selected=scope)=>(await db.query('select public.totus_tpv_offline_inbox($1,$2::uuid,$3::jsonb,$4::jsonb) result',[action,operation,JSON.stringify(selected),JSON.stringify(data)])).rows[0].result;
 const op=id(8900),data={deviceId:id(8901),ticket:{currency:'EUR',totalCents:801,payments:[{method:'cash',amountCents:801,receivedCents:801}],lines:[{productId:101,qty:1}]}};
 const before=(await db.query('select count(*) n from private.totus_tpv_operations')).rows[0].n;
 await denied(()=>call('receive',id(8990),{...data,ticket:{...data.ticket,cashSessionId:id(8991)}}),/TPV_OFFLINE_SCOPE_MISMATCH/);
 for(const mismatch of [false,true]){
  const modifierId=id(8980),discount={kind:'percent',value:500},adjustment={kind:'amount',value:50};
  const ticket={...data.ticket,adjustment,coupon:'PROMO_5',lines:[{productId:101,qty:1,discount,displayName:'Artículo preparado'}]};
  check((await call('receive',modifierId,{...data,ticket})).ticket,ticket);
  const modifiers={adjustment,coupon:mismatch?'OTHER':'PROMO_5',lines:[{productId:101,attributeId:0,discount,displayName:'Artículo preparado'}]};
  await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb)',['prepare',modifierId,JSON.stringify(scope),JSON.stringify({expected:{...expected(908980),saleModifiers:modifiers},quoteExpiresAt:Date.now()+60000})]);
  if(mismatch)await denied(()=>call('bind',modifierId),/TPV_OFFLINE_CHECKOUT_MISMATCH/);else check((await call('bind',modifierId)).checkoutId,modifierId);
  await db.exec('reset role');await db.query('delete from private.totus_tpv_offline_inbox where id=$1',[modifierId]);await db.query('delete from private.totus_tpv_operations where id=$1',[modifierId]);await db.exec('set role service_role');
 }
 for(const mismatch of [false,true]){
  const note='Reservar para recogida\nLlamar antes',noteId=id(8970),ticket={...data.ticket,note};
  check((await call('receive',noteId,{...data,ticket})).ticket.note,note);
  const noteHash=createHash('sha256').update(mismatch?'Otra nota':note).digest('hex');
  await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb)',['prepare',noteId,JSON.stringify(scope),JSON.stringify({expected:{...expected(908970),saleNoteHash:noteHash,hasSaleNote:true},quoteExpiresAt:Date.now()+60000})]);
  if(mismatch)await denied(()=>call('bind',noteId),/TPV_OFFLINE_CHECKOUT_MISMATCH/);else check((await call('bind',noteId)).checkoutId,noteId);
  await db.exec('reset role');await db.query('delete from private.totus_tpv_offline_inbox where id=$1',[noteId]);await db.query('delete from private.totus_tpv_operations where id=$1',[noteId]);await db.exec('set role service_role');
 }
 for(const note of ['',null,' padded ','<b>bad</b>','bad\rnote'])await denied(()=>call('receive',id(8971),{...data,ticket:{...data.ticket,note}}),/TPV_OFFLINE_TICKET_INVALID/);
 check(await call('get',op),null);const saved=await call('receive',op,data);check(saved.status,'received');check(saved.ticket,data.ticket);
 check(await call('receive',op,data),saved);
 for(const reference of ['BIZUM-2026/42','CARD-A:19']){
  const referenceId=id(8960),referenceData={...data,ticket:{...data.ticket,payments:[{method:'card',amountCents:801,reference}]}};
  check((await call('receive',referenceId,referenceData)).ticket.payments,referenceData.ticket.payments);
  await db.exec('reset role');await db.query('delete from private.totus_tpv_offline_inbox where id=$1',[referenceId]);await db.exec('set role service_role');
 }
 for(const payment of [{method:'cash',amountCents:801,reference:'CASH-1'},...['4111111111111111','',null,' PADDED '].map(reference=>({method:'card',amountCents:801,reference}))])await denied(()=>call('receive',id(8961),{...data,ticket:{...data.ticket,payments:[payment]}}),/TPV_OFFLINE_TICKET_INVALID/);
 await denied(()=>call('receive',op,{...data,ticket:{...data.ticket,totalCents:802,payments:[{method:'cash',amountCents:802,receivedCents:802}]}}),/TPV_OFFLINE_INTENT_CHANGED/);
 await denied(()=>call('receive',op,{...data,deviceId:id(8902)}),/TPV_OFFLINE_INTENT_CHANGED/);
 await denied(()=>call('receive',id(8903),{...data,confirmed:true}),/TPV_OFFLINE_REQUEST_INVALID/);
 await denied(()=>call('get',op,{}, {...scope,environment:'production'}),/TPV_ENVIRONMENT_FORBIDDEN/);
 for(const ticket of [{...data.ticket,payments:[{method:'card',amountCents:801,receivedCents:801}]},{...data.ticket,secret:'never-store'},{...data.ticket,lines:[{productId:101,qty:1,password:'secret'}]},{...data.ticket,payments:[{method:'cash',amountCents:800}]},{...data.ticket,lines:[...data.ticket.lines,...data.ticket.lines]}])await denied(()=>call('receive',id(8910),{...data,ticket}),/TPV_OFFLINE_TICKET_INVALID/);
 await db.exec('set role authenticated');await denied(()=>call('get',op),/permission denied/);await denied(()=>db.query('select * from private.totus_tpv_offline_inbox'),/permission denied/);await db.exec('set role service_role');
 check((await db.query('select count(*) n from private.totus_tpv_operations')).rows[0].n,before);
 assert.equal((await call('get',op)).ticket.totalCents,801);
 await denied(()=>call('bind',op),/TPV_OFFLINE_CHECKOUT_MISMATCH/);
 await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb)', ['prepare',op,JSON.stringify(scope),JSON.stringify({expected:expected(908900),quoteExpiresAt:Date.now()+60000})]);
 check((await call('bind',op)).checkoutId,op);check((await call('bind',op)).checkoutId,op);
 for(const [offset,mutate] of [[20,x=>({...x,totalCents:802})],[21,x=>({...x,lines:x.lines.map(line=>({...line,qty:2}))})]]){
  const mismatchId=id(8900+offset);await call('receive',mismatchId,data);
  const quote=mutate(expected(908900+offset));await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb)',['prepare',mismatchId,JSON.stringify(scope),JSON.stringify({expected:quote,quoteExpiresAt:Date.now()+60000})]);
  await denied(()=>call('bind',mismatchId),/TPV_OFFLINE_CHECKOUT_MISMATCH/);check((await call('get',mismatchId)).checkoutId,null);
  await db.exec('reset role');await db.query('delete from private.totus_tpv_offline_inbox where id=$1',[mismatchId]);await db.query('delete from private.totus_tpv_operations where id=$1',[mismatchId]);await db.exec('set role service_role');
 }
 await db.exec('reset role');await db.query('delete from private.totus_tpv_offline_inbox where id=$1',[op]);await db.query('delete from private.totus_tpv_operations where id=$1',[op]);await db.exec('set role service_role');

 const commercial={currency:'EUR',customerId:501,invoiceAddressId:601,deliveryAddressId:601,totalCents:801,totalTaxExclCents:662,discountCents:0,shippingCents:0,nativeRoundMode:2,nativeRoundType:1,lines:[{productId:101,attributeId:0,qty:1,unitTaxInclMicros:8012100,unitTaxExclMicros:6621570,lineTaxInclCents:801,lineTaxExclCents:662}]};
 for(const offset of [40,41]){const commercialId=id(8900+offset),ticket={...data.ticket,commercial};
  check((await call('receive',commercialId,{...data,ticket})).ticket.commercial,commercial);
  const quote={...expected(908900+offset),...commercial,lines:commercial.lines.map(line=>({...line,unitTaxInclMicros:line.unitTaxInclMicros+(offset===41?1:0),stockBefore:5}))};
  await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb)',['prepare',commercialId,JSON.stringify(scope),JSON.stringify({expected:quote,quoteExpiresAt:Date.now()+60000})]);
  if(offset===41)await denied(()=>call('bind',commercialId),/TPV_OFFLINE_CHECKOUT_MISMATCH/);else check((await call('bind',commercialId)).checkoutId,commercialId);
  await db.exec('reset role');await db.query('delete from private.totus_tpv_offline_inbox where id=$1',[commercialId]);await db.query('delete from private.totus_tpv_operations where id=$1',[commercialId]);await db.exec('set role service_role');
 }
 for(const mismatch of [false,true]){
  const rounded={...commercial,nativeRoundType:3,lines:[{...commercial.lines[0],lineTaxInclMicros:8012100,lineTaxExclMicros:6621570}]},roundedId=id(mismatch?8965:8964),ticket={...data.ticket,commercial:rounded};
  check((await call('receive',roundedId,{...data,ticket})).ticket.commercial,rounded);
  const prepared={...expected(mismatch?908965:908964),...rounded,lines:rounded.lines.map(line=>({...line,lineTaxInclMicros:line.lineTaxInclMicros+(mismatch?1:0),stockBefore:5}))};
  await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb)',['prepare',roundedId,JSON.stringify(scope),JSON.stringify({expected:prepared,quoteExpiresAt:Date.now()+60000})]);
  if(mismatch)await denied(()=>call('bind',roundedId),/TPV_OFFLINE_CHECKOUT_MISMATCH/);else check((await call('bind',roundedId)).checkoutId,roundedId);
  await db.exec('reset role');await db.query('delete from private.totus_tpv_offline_inbox where id=$1',[roundedId]);await db.query('delete from private.totus_tpv_operations where id=$1',[roundedId]);await db.exec('set role service_role');
 }
 const missingMicros={...commercial,nativeRoundType:3};
 await denied(()=>call('receive',id(8966),{...data,ticket:{...data.ticket,commercial:missingMicros}}),/TPV_OFFLINE_COMMERCIAL_INVALID/);
 for(const extra of [{customerId:999},{addressId:999}])await denied(()=>call('receive',id(8992),{...data,ticket:{...data.ticket,commercial,...extra}}),/TPV_OFFLINE_COMMERCIAL_INVALID/);
 for(const c of [{...commercial,totalTaxExclCents:802},{...commercial,lines:[{...commercial.lines[0],secret:'invalid'}]},{...commercial,lines:[{...commercial.lines[0],qty:2}]}])await denied(()=>call('receive',id(8950),{...data,ticket:{...data.ticket,commercial:c}}),/TPV_OFFLINE_COMMERCIAL_INVALID/);
 console.log('PASS offline inbox SQL: immutable id/device/intention, unknown read stays empty, production/browser denial and receipt alone creates no financial operation; matching prepared checkout binds once and changed totals/quantities fail. Offline checkout integration remains pending.');
}
