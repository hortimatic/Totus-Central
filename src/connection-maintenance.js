export function credentialAlertSettings(value={}){
 const warningDays=Number(value.warning_days??90),urgentDays=Number(value.urgent_days??30);
 if(!Number.isInteger(warningDays)||!Number.isInteger(urgentDays)||urgentDays<1||warningDays>365||warningDays<=urgentDays)throw new Error('El primer aviso debe estar entre 2 y 365 días y ser anterior al aviso urgente, que debe ser de al menos 1 día.');
 return {warningDays,urgentDays};
}
// Dates describe the application credential, never the short-lived access token.
export function credentialLifetime(expiresAt,now=new Date(),settings={}){
 const {warningDays,urgentDays}=credentialAlertSettings(settings);
 const date=String(expiresAt||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return {known:false,level:'unknown'};
 const end=Date.parse(date+'T23:59:59.999Z'),start=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(end)||new Date(start).toISOString().slice(0,10)!==date)return {known:false,level:'unknown'};
 const current=now instanceof Date?now.getTime():Number(now);
 if(!Number.isFinite(current))throw new Error('Fecha de comprobación no válida.');
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(current));
 const todayStart=Date.parse(today+'T00:00:00Z'),days=Math.max(0,Math.round((start-todayStart)/86400000)),expired=todayStart>start;
 return {known:true,date,days,expired,level:expired?'expired':days<=urgentDays?'urgent':days<=warningDays?'warning':'ok',
  warningDays,urgentDays,renewBy:new Date(start-warningDays*86400000).toISOString().slice(0,10),urgentBy:new Date(start-urgentDays*86400000).toISOString().slice(0,10)};
}
