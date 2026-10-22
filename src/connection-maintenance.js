// Dates describe the application credential, never the short-lived access token.
export function credentialLifetime(expiresAt,now=new Date()){
 const date=String(expiresAt||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return {known:false,level:'unknown'};
 const end=Date.parse(date+'T23:59:59.999Z'),start=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(end)||new Date(start).toISOString().slice(0,10)!==date)return {known:false,level:'unknown'};
 const current=now instanceof Date?now.getTime():Number(now);
 if(!Number.isFinite(current))throw new Error('Fecha de comprobación no válida.');
 const days=Math.max(0,Math.ceil((end-current)/86400000)),expired=current>end;
 return {known:true,date,days,expired,level:expired?'expired':days<=30?'urgent':days<=90?'warning':'ok',
  renewBy:new Date(start-90*86400000).toISOString().slice(0,10)};
}
