import assert from 'node:assert/strict';
export async function exerciseReceiptDiscountDisplay({db,id,scope}){
 await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[scope.actorId]);
 const read=async(receipt,drawer=scope.drawerId)=>(await db.query('select public.totus_tpv_workspace_preferences($1,$2,$3,$4::jsonb) result',[scope.connectionId,scope.shopId,drawer,receipt?JSON.stringify({receipt}):null])).rows[0].result;
 const initial=await read();assert.equal(initial.receipt.showGroupDiscount,false);assert.equal(initial.receipt.showDiscountedPrices,true);
 const before=initial.receipt.showVouchers,save=await read({showGroupDiscount:true,showDiscountedPrices:false});assert.equal(save.receipt.showGroupDiscount,true);assert.equal(save.receipt.showDiscountedPrices,false);assert.equal(save.receipt.showVouchers,before);
 const reread=await read({title:'Ticket'});assert.equal(reread.receipt.showGroupDiscount,true);assert.equal(reread.receipt.showDiscountedPrices,false,'Old clients retain new presentation settings');
 for(const key of ['showGroupDiscount','showDiscountedPrices'])for(const value of [null,0,'true'])await assert.rejects(read({[key]:value}),/INVALID/);
 const rejected=await read();assert.equal(rejected.receipt.showDiscountedPrices,false);await assert.rejects(read({showGroupDiscount:true},id(99999)),/FORBIDDEN/);
 await db.exec('reset role');console.log('PASS receipt discount display SQL: defaults, typed flags, account/workstation persistence, old-client merge, other receipt options retained, invalid and foreign-scope denial. Isolated database.');
}
