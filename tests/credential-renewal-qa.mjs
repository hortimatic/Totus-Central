import assert from 'node:assert/strict';
import {renewMicrosoftCredential} from '../supabase/functions/totus-onedrive/credential-renewal.js';
const key='synthetic-new-key-for-tests-only',expiry='2099-04-18';
function scenario(problem=''){
 const writes=[],ctx={
 config:async()=>({connected:true,client_id:'test-client'}),
 secret:async(action,value)=>{if(action==='read_tokens')return JSON.stringify({refresh_token:'synthetic-refresh'});writes.push([action,value]);},
 root:async access=>{assert.equal(access,'synthetic-access');if(problem==='account')throw Error('Wrong account');},
 saveExpiry:async date=>writes.push(['expiry',date]),
 fetchToken:async(url,options)=>{assert.equal(new URL(options.body.toString(),'https://unused.invalid').origin,'https://unused.invalid');const form=options.body;assert.equal(form.get('client_secret'),key);assert.equal(form.get('scope'),'Files.ReadWrite.AppFolder offline_access');return new Response(JSON.stringify({access_token:'synthetic-access',refresh_token:'synthetic-new-refresh',expires_in:3600,scope:problem==='scope'?'Files.Read':'Files.ReadWrite.AppFolder'}),{status:problem==='rejected'?401:200});}
 };return {ctx,writes};
}
for(const problem of ['rejected','account','scope']){const s=scenario(problem);await assert.rejects(()=>renewMicrosoftCredential(s.ctx,key,expiry));assert.equal(s.writes.length,0,'A rejected key or account must never replace working credentials');}
for(const [value,date] of [['short',expiry],[key,'2027-02-30'],[key,'2000-01-01']]){const s=scenario();await assert.rejects(()=>renewMicrosoftCredential(s.ctx,value,date));assert.equal(s.writes.length,0);}
const s=scenario(),result=await renewMicrosoftCredential(s.ctx,key,expiry);assert.equal(result.updated,true);assert.deepEqual(s.writes.map(x=>x[0]),['write_client','write_tokens','expiry']);assert.equal(s.writes[0][1],key);assert.equal(s.writes[2][1],expiry);
console.log('CREDENTIAL RENEWAL QA: new key validated against Microsoft and expected account before any private write; no permissions expanded.');
