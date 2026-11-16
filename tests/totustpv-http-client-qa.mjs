import test from 'node:test';
import assert from 'node:assert/strict';
import {createTpvHttpClient} from '../src/totustpv/http-client.js';
test('normal session snapshot is bound to its account and no delayed request borrows another login',async()=>{
 let current='operator-a',release,requests=0;
 const client=createTpvHttpClient({owner:'operator-a',currentActor:()=>current,url:'https://fixture.supabase.co',key:'fixture-public',
  auth:{getSession:()=>new Promise(resolve=>release=resolve)},request:async()=>{requests++;throw Error('Must not send');}});
 const pending=client({action:'context'});current='operator-b';release({data:{session:{user:{id:'operator-b'},access_token:'opaque-fixture'}}});
 await assert.rejects(pending,/sesión ha cambiado/);assert.equal(requests,0);
});
test('request uses only captured normal JWT; account changes hide an old response and server codes become useful messages',async()=>{
 let current='operator-a',release;
 const options={owner:'operator-a',currentActor:()=>current,url:'https://fixture.supabase.co',key:'fixture-public',
  auth:{getSession:async()=>({data:{session:{user:{id:'operator-a'},access_token:'opaque-normal-session'}}})}};
 const client=createTpvHttpClient({...options,request:async(url,request)=>{
  assert.equal(url,'https://fixture.supabase.co/functions/v1/totus-tpv');assert.equal(request.headers.Authorization,'Bearer opaque-normal-session');
  assert.equal(request.headers.apikey,'fixture-public');assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');
  return new Promise(resolve=>release=resolve);}});
 const pending=client({action:'context'});while(!release)await new Promise(resolve=>setTimeout(resolve,1));
 current='operator-b';release(new Response(JSON.stringify({actorId:'operator-a'})));await assert.rejects(pending,/sesión ha cambiado/);
 current='operator-a';const denied=createTpvHttpClient({...options,request:async()=>new Response(JSON.stringify({error:'TPV_CASH_BALANCE_INVALID'}),{status:400})});
 await assert.rejects(denied({action:'cash-movement'}),error=>error.code==='TPV_CASH_BALANCE_INVALID'&&/efectivo disponible/.test(error.message));
});
