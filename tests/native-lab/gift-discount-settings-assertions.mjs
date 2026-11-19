import assert from 'node:assert/strict';
export async function exerciseGiftDiscountSettings({db,id,scope}){
 await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[scope.actorId]);
 const prefs=async(receipt,drawer=scope.drawerId)=>(await db.query('select public.totus_tpv_workspace_preferences($1,$2,$3,$4::jsonb) result',[scope.connectionId,scope.shopId,drawer,receipt?JSON.stringify({receipt}):null])).rows[0].result;
 const initial=await prefs();assert.equal(initial.receipt.showGiftDiscounts,false);const saved=await prefs({showGiftDiscounts:true});assert.equal(saved.receipt.showGiftDiscounts,true);assert.equal(saved.receipt.showGroupDiscount,initial.receipt.showGroupDiscount);assert.equal(saved.receipt.showDiscountedPrices,initial.receipt.showDiscountedPrices);
 assert.equal((await prefs({title:'Ticket de prueba'})).receipt.showGiftDiscounts,true,'Older clients merge without deleting the new explicit choice');
 for(const value of [null,0,'true',{}])await assert.rejects(prefs({showGiftDiscounts:value}),/INVALID/);
 assert.equal((await prefs()).receipt.showGiftDiscounts,true);assert.equal((await prefs({showGiftDiscounts:false})).receipt.showGiftDiscounts,false);await assert.rejects(prefs({showGiftDiscounts:true},id(99999)),/FORBIDDEN/);
 await db.exec('reset role');console.log('PASS gift discount preference SQL: off by default, explicit boolean enable/disable, preserved receipt options, old-client merge and invalid/foreign-scope denial. Isolated database.');
}
