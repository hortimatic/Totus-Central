// Server-only reauthentication proof for a single TPV operation approval.
// Auth must verify both signed tokens before any claims are trusted. This
// returns metadata only; credentials and JWTs must never enter the journal.
const denied=()=>new Error('TPV_REAUTH_REQUIRED');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const seconds=value=>Number.isSafeInteger(value)&&value>0;
function claims(token){
 try{
  const parts=token.split('.');
  if(parts.length!==3||parts.some(part=>!part||!/^[A-Za-z0-9_-]+$/.test(part)))throw denied();
  const bytes=Uint8Array.from(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value))throw denied();
  return value;
 }catch{throw denied();}
}
export async function verifyPasswordProof({authenticate,primaryToken,proofToken,actorId,authUrl,now=Math.floor(Date.now()/1000)}){
 if(typeof authenticate!=='function'||!uuid(actorId)||!seconds(now)||
  [primaryToken,proofToken].some(token=>typeof token!=='string'||token.length<10||token.length>16384)||
  primaryToken===proofToken)throw denied();
 let issuer;
 try{const url=new URL(authUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw denied();issuer=url.origin+'/auth/v1';}catch{throw denied();}
 const verified=[];
 for(const token of [primaryToken,proofToken]){
  let result;try{result=await authenticate(token);}catch{throw denied();}
  if(result?.error||result?.data?.user?.id!==actorId)throw denied();
  verified.push(claims(token));
 }
 const [primary,proof]=verified;
 for(const value of verified){
  if(value.sub!==actorId||value.iss!==issuer||value.role!=='authenticated'||
   !(value.aud==='authenticated'||Array.isArray(value.aud)&&value.aud.includes('authenticated'))||
   !uuid(value.session_id)||!seconds(value.exp)||value.exp<=now||!seconds(value.iat)||value.iat>now+5||value.iat>=value.exp)throw denied();
 }
 if(primary.session_id===proof.session_id||!Array.isArray(proof.amr))throw denied();
 const passwords=proof.amr.filter(method=>method?.method==='password');
 if(passwords.length!==1)throw denied();
 const passwordAt=passwords[0].timestamp;
 if(!seconds(passwordAt)||passwordAt>now+5||passwordAt>proof.iat+5||now-passwordAt>120)throw denied();
 const expiresAt=Math.min(proof.exp,passwordAt+120);
 if(expiresAt<=now)throw denied();
 return Object.freeze({actorId,proofSessionId:proof.session_id,passwordAt,expiresAt});
}
