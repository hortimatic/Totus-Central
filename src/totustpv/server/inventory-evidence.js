/** Read native order-attributed deductions instead of guessing from a global
 * before/after quantity. No stock writes or POSTPV data. Advanced/shared stock
 * requires its own verified mapping and is deliberately not inferred here.
 */
const positive=value=>Number.isSafeInteger(value)&&value>0;
const requireValue=(condition,code)=>{if(!condition)throw new Error(code);};
function movementRows(payload) {
  if(Array.isArray(payload)&&payload.length===0)return [];
  const keys=['stock_mvts','stock_movements'].filter(key=>payload && Object.hasOwn(payload,key));
  requireValue(keys.length===1 && Array.isArray(payload[keys[0]]),'TPV_STOCK_MOVEMENT_SHAPE_INVALID');
  return payload[keys[0]];
}
export async function readNativeInventoryEvidence({transport,scope,orderId,expected}) {
  requireValue(positive(orderId) && Array.isArray(expected?.lines) && expected.lines.length>0,
    'TPV_STOCK_EXPECTATION_INVALID');
  const used=new Set(),evidence=[];
  for(const line of expected.lines) {
    requireValue(positive(line.stockRecordId),'TPV_STOCK_RECORD_MAPPING_REQUIRED');
    const stock=(await transport.read('stock_availables/'+line.stockRecordId))?.stock_available;
    requireValue(stock && Number(stock.id)===line.stockRecordId && Number(stock.id_product)===line.productId &&
      Number(stock.id_product_attribute)===line.attributeId && Number(stock.id_shop)===scope.shopId &&
      !['1',1,true].includes(stock.depends_on_stock) && Number.isSafeInteger(Number(stock.quantity)),
      'TPV_STOCK_RECORD_SCOPE_MISMATCH');
    const rows=movementRows(await transport.read('stock_movements',{
      'filter[id_order]':`[${orderId}]`,'filter[id_stock]':`[${line.stockRecordId}]`,display:'full',limit:'0,201'
    }));
    requireValue(rows.length>0 && rows.length<=200,'TPV_STOCK_MOVEMENT_NOT_OBSERVED');
    let deductedQty=0;const ids=[];
    for(const row of rows) {
      const id=Number(row.id),qty=Number(row.physical_quantity);
      requireValue(positive(id) && !used.has(id) && Number(row.id_order)===orderId &&
        Number(row.id_stock)===line.stockRecordId && Number(row.sign)===-1 && positive(qty),
        'TPV_STOCK_MOVEMENT_SCOPE_MISMATCH');
      used.add(id);ids.push(id);deductedQty+=qty;
    }
    requireValue(Number.isSafeInteger(deductedQty) && deductedQty===line.qty,'TPV_STOCK_MOVEMENT_QUANTITY_MISMATCH');
    evidence.push({mode:'native-movements',productId:line.productId,attributeId:line.attributeId,
      stockRecordId:line.stockRecordId,orderId,deductedQty,movementIds:ids,currentQuantity:Number(stock.quantity),
      recordVerified:true,ambiguous:false});
  }
  return evidence;
}
