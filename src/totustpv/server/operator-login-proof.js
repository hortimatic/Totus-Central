// Separate from financial approvals: an incoming identity can never authorize
// an outgoing account's sale, price change or refund.
const denied=()=>Error('TPV_REAUTH_REQUIRED');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const seconds=v=>Number.isSafeInteger(v)&&v>0;
function claims(token){try{
 const parts=token.split('.');if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))throw denied();
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
}catch{throw denied();}}
export async function verifyOperatorLoginProof({authenticate,primaryToken,proofToken,actorId,targetId,authUrl,now=Math.floor(Date.now()/1000)}){
 if(typeof authenticate!=='function'||!uuid(actorId)||!uuid(targetId)||actorId===targetId||!seconds(now)||primaryToken===proofToken||[primaryToken,proofToken].some(t=>typeof t!=='string'||t.length<10||t.length>16384))throw denied();
 let issuer;try{const u=new URL(authUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw denied();issuer=u.origin+'/auth/v1';}catch{throw denied();}
 const verified=[];
 for(const [token,expected] of [[primaryToken,actorId],[proofToken,targetId]]){
  let result;try{result=await authenticate(token);}catch{throw denied();}
  if(result?.error||result?.data?.user?.id!==expected)throw denied();
  const c=claims(token);
  if(c?.sub!==expected||c.iss!==issuer||c.role!=='authenticated'||!(c.aud==='authenticated'||Array.isArray(c.aud)&&c.aud.includes('authenticated'))||!uuid(c.session_id)||!seconds(c.exp)||c.exp<=now||!seconds(c.iat)||c.iat>now+5||c.iat>=c.exp)throw denied();
  verified.push(c);
 }
 const [primary,proof]=verified;
 if(primary.session_id===proof.session_id||!Array.isArray(proof.amr))throw denied();
 const passwords=proof.amr.filter(m=>m?.method==='password');if(passwords.length!==1)throw denied();
 const passwordAt=passwords[0].timestamp;
 if(!seconds(passwordAt)||passwordAt>now+5||passwordAt>proof.iat+5||now-passwordAt>120)throw denied();
 const expiresAt=Math.min(proof.exp,passwordAt+120);if(expiresAt<=now)throw denied();
 return Object.freeze({actorId:targetId,proofSessionId:proof.session_id,passwordAt,expiresAt});
}
