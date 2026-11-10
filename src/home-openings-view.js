/* Read-only interpretation of the existing canonical drawer closing logic. */
import {lastDrawerBalance} from './historical-acceptance.js';
const isActive=row=>row?.active!==false;
const key=x=>String(x??'');
export function nextOpeningSummary(data,{today,includeInactive=false}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(today||'')))throw new Error('Fecha de negocio inválida');
 const next=new Date(`${today}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
 const before=next.toISOString().slice(0,10);
 const stores=(data?.stores||[]).filter(s=>includeInactive||isActive(s));
 const items=[];
 for(const store of stores)for(const drawer of (data?.drawers||[]).filter(d=>key(d.store_id)===key(store.id)&&(includeInactive||isActive(d)))){
   const result=lastDrawerBalance({closings:data?.closings||[],closingDrawers:data?.closingDrawers||[],storeId:store.id,drawer,before});
   const amount=Number.isFinite(result?.amount)?result.amount:null;
   const status=amount===null?'missing':result.date===today?'verified':'stale';
   items.push({storeId:store.id,storeName:store.name,drawerId:drawer.id,drawerName:drawer.name,amount,closingDate:result?.date??null,openingDate:before,status});
 }
 const missing=items.filter(x=>x.amount===null);
 const stale=items.filter(x=>x.status==='stale');
 const total=items.length>0&&missing.length===0&&stale.length===0?items.reduce((a,x)=>a+x.amount,0):null;
 return {openingDate:before,items,complete:items.length>0&&missing.length===0&&stale.length===0,total,partialKnown:items.reduce((a,x)=>a+(x.amount??0),0),missing:missing.length,stale:stale.length};
}
