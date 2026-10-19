// Acceptance of the imported archive is separate from reconstructing a daily
// till breakdown or recording an actual tax payment. Never change fiscal sums.
export function archiveAccepted(settings,row,kind){
 const accepted=settings?.historical_acceptance;
 return !!row?.id&&accepted?.[`${kind}_ids`]?.includes(row.id)===true;
}
export function quarterPresented(settings,year,quarter){
 return settings?.historical_acceptance?.presented_periods?.includes(`${year}-T${quarter}`)===true;
}
export function sourceCashKnown(row,field){
 try{
  const source=JSON.parse(row.source_ref),drawers=source.daily_drawers??source.drawers??[];
  return drawers.length>0&&!source.missing_drawers?.length&&drawers.every(d=>d[field]!=null&&d[field]!==''&&Number.isFinite(Number(d[field])));
 }catch{return false;}
}
export function lastDrawerBalance({closings=[],closingDrawers=[],storeId,drawer,before}){
 const normalize=name=>String(name||'').toLocaleLowerCase('es').replace(/^caja\s+/,'').trim();
 const rows=closings.filter(x=>x.store_id===storeId&&x.business_date<before&&(x.status==='cerrado'||x.entry_mode==='source_snapshot')).sort((a,b)=>String(b.business_date).localeCompare(String(a.business_date)));
 // Use the latest day's balance, never silently carry an older known balance
 // across a more recent day whose retained cash is missing.
 const row=rows[0];if(!row)return null;
 let value;
 if(row.entry_mode==='source_snapshot'){
  try{const source=JSON.parse(row.source_ref);const raw=source.daily_drawers??source.drawers??[];
   const matches=raw.filter(x=>normalize(x.name)===normalize(drawer.name));
   value=matches.at(-1)?.closing;
  }catch{return {date:row.business_date,amount:null};}
 }else value=closingDrawers.find(x=>x.closing_id===row.id&&x.drawer_id===drawer.id)?.closing_cash;
 return {date:row.business_date,amount:value==null||value===''||!Number.isFinite(Number(value))?null:Number(value)};
}
