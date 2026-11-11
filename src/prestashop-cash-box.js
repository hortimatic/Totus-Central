// This is display-only. A drawer is never inferred from payment type, employee,
// shop, amount or time. The future TPV adapter must supply explicit evidence.
export function verifiedOrderCashBoxName(order,store){
 const box=order?.cash_box;
 if(!box||box.verified!==true||box.store!==store||String(box.order_id)!==String(order?.id))return null;
 if(!/^[1-9]\\d{0,14}$/.test(String(box.drawer_id||'')))return null;
 if(typeof box.name!=='string'||box.name!==box.name.trim()||!box.name||box.name.length>100||/[\\x00-\\x1f\\x7f]/.test(box.name))return null;
 return box.name;
}
