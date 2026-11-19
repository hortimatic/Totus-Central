import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorLogin} from '../src/totustpv/operator-login.js';
function fixture({wrong=false,revoked=false}={}){
 let owner='old',closed=0,adopted=0,options;
 const target={operatorId:'new',loginEmail:'new@example.invalid'};
 const prepare=createOperatorLogin({url:'https://example.invalid',key:'public',uuid:()=> 'fixture',currentActor:()=>owner,
  primaryAuth:{getUser:async()=>({data:{user:{id:owner}}}),setSession:async tokens=>{assert.deepEqual(tokens,{access_token:'access',refresh_token:'refresh'});adopted++;owner='new';return {data:{session:{user:{id:'new'}}}};}},
  createClient:(_url,_key,value)=>{options=value;return {auth:{signInWithPassword:async credentials=>{assert.equal(credentials.email,target.loginEmail);return wrong?{error:Error('wrong')}:{data:{session:{user:{id:'new'},access_token:'access',refresh_token:'refresh'}}};},signOut:async value=>{assert.deepEqual(value,{scope:'local'});closed++;}}};}});
 return {run:()=>prepare({target,password:'secret',verify:async token=>{assert.equal(token,'access');if(revoked)throw Error('revoked');return {verified:true,target};}}),snapshot:()=>({owner,closed,adopted,options}),change:()=>{owner='another';}};
}
test('incoming account is prepared without replacing current account; adoption uses real session',async()=>{const f=fixture(),transfer=await f.run();assert.equal(f.snapshot().owner,'old');assert.equal(f.snapshot().adopted,0);assert.deepEqual(f.snapshot().options.auth,{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'totus-tpv-incoming-fixture'});assert.equal(JSON.stringify(transfer).includes('refresh'),false);await transfer.adopt();assert.equal(f.snapshot().owner,'new');assert.equal(f.snapshot().closed,0);await transfer.cancel();assert.equal(f.snapshot().closed,0);await assert.rejects(transfer.adopt());});
test('cancel disposes only incoming session and prevents adoption',async()=>{const f=fixture(),transfer=await f.run();await transfer.cancel();await transfer.cancel();assert.deepEqual({...f.snapshot(),options:undefined},{owner:'old',closed:1,adopted:0,options:undefined});await assert.rejects(transfer.adopt());});
for(const mode of ['wrong','revoked'])test(mode+' preserves outgoing account and closes disposable client',async()=>{const f=fixture({[mode]:true});await assert.rejects(f.run());assert.equal(f.snapshot().owner,'old');assert.equal(f.snapshot().adopted,0);assert.equal(f.snapshot().closed,1);});
test('changed outgoing identity prevents adoption',async()=>{const f=fixture(),transfer=await f.run();f.change();await assert.rejects(transfer.adopt());assert.equal(f.snapshot().adopted,0);await transfer.cancel();assert.equal(f.snapshot().closed,1);});
