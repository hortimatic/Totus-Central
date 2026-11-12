const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
export const homeToday=(date=new Date())=>date.toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'});
export const minusDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
export function homePeriodBounds(mode,anchor=homeToday()){
 const date=valid(anchor)?anchor:homeToday(),d=new Date(date+'T12:00:00Z');
 if(mode==='week'){const monday=minusDays(date,(d.getUTCDay()+6)%7);return {from:monday,to:minusDays(monday,-6)};}
 if(mode==='month')return {from:date.slice(0,7)+'-01',to:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10)};
 return {from:date,to:date};
}
export function homeDateRange(w,today=homeToday()){
 const filters=w.filters||{};
 if(['day','week','month'].includes(filters.period)&&filters.inheritPeriod!==false)return homePeriodBounds(filters.period,today);
 return {from:valid(filters.from)?filters.from:minusDays(today,6),to:valid(filters.to)?filters.to:today};
}
export function shiftedHomePeriod(w,direction,today=homeToday()){
 const mode=['day','week','month'].includes(w.filters.period)?w.filters.period:'day',date=homeDateRange(w,today).to;
 if(mode==='month'){const d=new Date(date.slice(0,7)+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+direction);return homePeriodBounds('month',d.toISOString().slice(0,10));}
 return homePeriodBounds(mode,minusDays(date,-direction*(mode==='week'?7:1)));
}
