// Display-only, future adapter contract. Never infer a drawer from payment, date,
// employee, location, or a POSTPV movement's opaque BLOB bytes.
const validId=value=>/^[1-9]\d{0,14}$/.test(String(value??''));
const validStore=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(value);
const validName=value=>typeof value==='string'&&value===value.trim()&&!!value&&value.length<=255&&!/[\x00-\x1f\x7f]/.test(value);

// This matcher does not fetch or authenticate POSTPV. The future authorized
// source must verify every assignment before setting verified=true.
// Multiple payments in ONE opening are allowed. Different opening IDs for
// the same order are ambiguous, even if they share a visible name.
export function cashBoxAttributionFromCatalogue(order,store,assignments,openings){
 if(!validId(order?.id)||!validStore(store)||!Array.isArray(assignments)||!Array.isArray(openings))return null;
 const links=assignments.filter(row=>row?.store===store&&String(row.order_id)===String(order.id));
 if(!links.length||links.some(row=>row.verified!==true||!validId(row.drawer_id)))return null;
 const ids=new Set(links.map(row=>String(row.drawer_id)));
 if(ids.size!==1)return null;
 const [drawerId]=ids;
 // POSTPV posp_cajas.id_cajas identifies an opening, NOT a fixed terminal.
 const boxes=openings.filter(row=>row?.store===store&&String(row.drawer_id)===drawerId);
 if(boxes.length!==1||!validName(boxes[0].name))return null;
 return {verified:true,store,order_id:String(order.id),drawer_id:drawerId,name:boxes[0].name};
}

export function verifiedOrderCashBoxName(order,store){
 const box=order?.cash_box;
 if(!box||box.verified!==true||!validStore(store)||box.store!==store||
    !validId(order?.id)||String(box.order_id)!==String(order.id)||
    !validId(box.drawer_id)||!validName(box.name))return null;
 return box.name;
}
