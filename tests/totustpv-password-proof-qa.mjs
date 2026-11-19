import assert from 'node:assert/strict';
import {test} from 'node:test';
import {verifyPasswordProof} from '../src/totustpv/server/password-proof.js';
const actorId='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',now=1800000000;
const primary={sub:actorId,iss:'https://fixture.supabase.co/auth/v1',role:'authenticated',aud:'authenticated',session_id:actorId,iat:now-600,exp:now+300};
const proof={...primary,session_id:other,iat:now,amr:[{method:'password',timestamp:now}]};
const encode=value=>'eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify(value)).toString('base64url')+'.c2lnbmVk';
const options=(changes={})=>({actorId,now,authUrl:'https://fixture.supabase.co',primaryToken:encode(primary),proofToken:encode({...proof,...changes}),authenticate:async()=>({data:{user:{id:actorId}}})});
test('verified recent independent password session yields only minimal metadata',async()=>{
 const result=await verifyPasswordProof(options());assert.deepEqual(result,{actorId,proofSessionId:other,passwordAt:now,expiresAt:now+120});assert.equal(Object.isFrozen(result),true);assert.doesNotMatch(JSON.stringify(result),/access_token|refresh_token|eyJ/);
});
for(const [name,change] of Object.entries({oldPassword:{iat:now,amr:[{method:'password',timestamp:now-121}]},noPassword:{amr:[{method:'otp',timestamp:now}]},duplicate:{amr:[{method:'password',timestamp:now},{method:'password',timestamp:now}]},expired:{exp:now},futureIssue:{iat:now+6},futurePassword:{amr:[{method:'password',timestamp:now+6}]},wrongIssuer:{iss:'https://other.supabase.co/auth/v1'},wrongSubject:{sub:other},wrongRole:{role:'service_role'},wrongAudience:{aud:'anon'},sameSession:{session_id:actorId},missingSession:{session_id:undefined},wrongTimestamp:{amr:[{method:'password',timestamp:String(now)}]}}))test(name+' rejected',async()=>{await assert.rejects(verifyPasswordProof(options(change)),/^Error: TPV_REAUTH_REQUIRED$/);});
test('Auth denial and errors are sanitized; unverified claims never suffice',async()=>{
 for(const authenticate of [async()=>({error:{message:'secret diagnostic'}}),async()=>({data:{user:{id:other}}}),async()=>{throw Error('secret diagnostic');}])await assert.rejects(verifyPasswordProof({...options(),authenticate}),/^Error: TPV_REAUTH_REQUIRED$/);
});
test('main JWT itself, malformed tokens and invalid project URLs rejected',async()=>{
 const o=options();for(const extra of [{proofToken:o.primaryToken},{proofToken:'unverified.invalid.token'},{authUrl:'https://fixture.supabase.co/path'},{authUrl:'http://fixture.supabase.co'},{authUrl:'https://name:password@fixture.supabase.co'}])await assert.rejects(verifyPasswordProof({...o,...extra}),/^Error: TPV_REAUTH_REQUIRED$/);
});
test('both verified identities required and original session retained',async()=>{
 const seen=[],o=options();o.authenticate=async token=>{seen.push(token);return {data:{user:{id:actorId}}};};await verifyPasswordProof(o);assert.deepEqual(seen,[o.primaryToken,o.proofToken]);
 const primaryToken=encode({...primary,sub:other});await assert.rejects(verifyPasswordProof({...options(),primaryToken}),/TPV_REAUTH_REQUIRED/);
});
