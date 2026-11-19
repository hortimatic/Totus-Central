import {test} from 'node:test';import assert from 'node:assert/strict';
import {verifyOperatorLoginProof} from '../src/totustpv/server/operator-login-proof.js';
import {verifyPasswordProof} from '../src/totustpv/server/password-proof.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),now=1800000000;
const encode=c=>'eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.c2lnbmVk';
function fixture(change={}){const base={iss:'https://fixture.invalid/auth/v1',aud:'authenticated',role:'authenticated',iat:now,exp:now+300};const primaryToken=encode({...base,sub:id(1),session_id:id(3)}),proofToken=encode({...base,sub:id(2),session_id:id(4),amr:[{method:'password',timestamp:now}],...change});return {actorId:id(1),targetId:id(2),primaryToken,proofToken,authUrl:'https://fixture.invalid',now,authenticate:async token=>({data:{user:{id:token===primaryToken?id(1):id(2)}}})};}
test('only incoming account supplies recent password proof; metadata excludes credentials',async()=>{const result=await verifyOperatorLoginProof(fixture());assert.deepEqual(result,{actorId:id(2),proofSessionId:id(4),passwordAt:now,expiresAt:now+120});assert.ok(Object.isFrozen(result));});
for(const [name,change] of Object.entries({outgoing:{sub:id(1)},expired:{exp:now},stale:{amr:[{method:'password',timestamp:now-121}]},otp:{amr:[{method:'otp',timestamp:now}]},issuer:{iss:'https://wrong.invalid/auth/v1'},role:{role:'service_role'},session:{session_id:id(3)}}))test(name+' proof is denied',async()=>assert.rejects(verifyOperatorLoginProof(fixture(change)),/TPV_REAUTH_REQUIRED/));
test('verified incoming proof remains invalid for financial approvals',async()=>assert.rejects(verifyPasswordProof(fixture()),/TPV_REAUTH_REQUIRED/));
test('Auth must verify incoming identity, not only signed-looking claims',async()=>{const o=fixture();o.authenticate=async()=>({data:{user:{id:id(1)}}});await assert.rejects(verifyOperatorLoginProof(o),/TPV_REAUTH_REQUIRED/);});
