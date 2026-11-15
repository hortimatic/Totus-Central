import test from 'node:test';
import assert from 'node:assert/strict';
import {readNativeInventoryEvidence} from '../src/totustpv/server/inventory-evidence.js';
import {verifyRemoteSale} from '../src/totustpv/model.js';
const expected={storeId:'store-one',shopId:1,cartId:701,currency:'EUR',currencyId:1,customerId:501,
 invoiceAddressId:601,deliveryAddressId:601,paymentModule:'native_cash',totalCents:801,shippingCents:0,
 paidStateIds:[11],lines:[{productId:101,attributeId:5,qty:1,unitTaxInclCents:801,unitTaxExclCents:662,stockRecordId:301,stockBefore:5}]};
const base={...expected,orderId:901,stateId:11,statePaid:true,receivedCents:801,
 payments:[{id:701,amountCents:801,currency:'EUR',recordVerified:true}]};
const stock={id:301,id_product:101,id_product_attribute:5,id_shop:1,quantity:1,depends_on_stock:0};
const movement={id:401,id_order:901,id_stock:301,physical_quantity:1,sign:-1};
async function evidence(patch={}) {
 return readNativeInventoryEvidence({scope:{shopId:1},orderId:901,expected,
  transport:{read:async resource=>resource.startsWith('stock_availables/')?{stock_available:{...stock,...patch.stock}}:
   (patch.payload??{stock_mvts:patch.movements??[movement]})}});
}
test('order-attributed movement verifies a deduction even when concurrent web sales change the global quantity',async()=>{
 const inventory=await evidence();assert.equal(inventory[0].currentQuantity,1);
 assert.equal(verifyRemoteSale(expected,{...base,inventory}).status,'confirmed');
 // Before=5, after=1 is NOT assumed to mean this order sold four units.
 assert.equal(inventory[0].deductedQty,1);
});
test('missing, duplicated, positive, wrong-order and wrong-stock movements are rejected',async()=>{
 for(const movements of [[],[movement,movement],[{...movement,sign:1}],[{...movement,id_order:902}],
  [{...movement,id_stock:302}],[{...movement,physical_quantity:2}]])
  await assert.rejects(evidence({movements}));
 for(const changed of [{id_shop:2},{id_product:102},{id_product_attribute:6},{depends_on_stock:1}])
  await assert.rejects(evidence({stock:changed}));
 await assert.rejects(evidence({payload:{stock_mvts:[movement],stock_movements:[movement]}}));
});
test('a bare before/after difference cannot be mistaken for production movement evidence',async()=>{
 assert.equal(verifyRemoteSale(expected,{...base,inventory:[{productId:101,attributeId:5,before:5,after:4,ambiguous:false}]}).status,'uncertain');
 const inventory=await evidence();
 for(const patch of [{orderId:902},{recordVerified:false},{movementIds:[401,401]},{deductedQty:2},{stockRecordId:302}])
  assert.equal(verifyRemoteSale(expected,{...base,inventory:[{...inventory[0],...patch}]}).status,'uncertain');
});
