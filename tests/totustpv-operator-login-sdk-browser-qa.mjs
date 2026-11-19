import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
const server=await startLocalServer({enabled:true,port:0}),browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/totustpv-workspace.html`);
 await page.addScriptTag({url:'/src/vendor/supabase/supabase.js'});
 const result=await page.evaluate(async()=>{
  const {createOperatorLogin}=await import('/src/totustpv/operator-login.js');
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),old=id(1),incoming=id(2),now=Math.floor(Date.now()/1000),events=[],requests=[];
  const user=who=>({id:who,email:who===old?'old@example.invalid':'new@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()});
  const token=who=>btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:who,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now,session_id:who===old?id(3):id(4)}))+'.c2lnbmVk';
  const session=who=>({access_token:token(who),refresh_token:who===old?'old-refresh':'incoming-refresh',token_type:'bearer',expires_in:3600,user:user(who)});
  const fakeFetch=async(url,init={})=>{
   const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):null;requests.push({path,method:init.method||'GET'});
   if(path==='/auth/v1/token'){
    if(body?.password!=='fixture-password')return new Response(JSON.stringify({error_code:'invalid_credentials',msg:'Invalid login credentials'}),{status:400,headers:{'Content-Type':'application/json'}});
    return Response.json(session(body.email==='old@example.invalid'?old:incoming));
   }
   if(path==='/auth/v1/user'){
    const bearer=new Headers(init.headers).get('Authorization');
    return Response.json(user(bearer==='Bearer '+token(old)?old:incoming));
   }
   if(path==='/auth/v1/logout')return new Response(null,{status:204});
   throw Error('Unexpected local Auth request '+path);
  };
  const create=(url,key,options)=>window.supabase.createClient(url,key,{...options,global:{fetch:fakeFetch}});
  const primary=create('https://fixture.invalid','public-fixture',{auth:{storageKey:'tpv-sdk-primary',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
  let owner=old;
  await primary.auth.signInWithPassword({email:'old@example.invalid',password:'fixture-password'});
  primary.auth.onAuthStateChange((event,value)=>{events.push({event,id:value?.user?.id});if(event==='SIGNED_IN')owner=value.user.id;});
  const prepare=createOperatorLogin({createClient:create,url:'https://fixture.invalid',key:'public-fixture',primaryAuth:primary.auth,currentActor:()=>owner});
  const target={operatorId:incoming,loginEmail:'new@example.invalid'},verify=async jwt=>{if(jwt!==token(incoming))throw Error('Wrong incoming identity');return {verified:true,target};};
  let wrongDenied=false;try{await prepare({target,password:'wrong',verify});}catch{wrongDenied=true;}
  const afterWrong=(await primary.auth.getUser()).data.user.id;
  const cancelled=await prepare({target,password:'fixture-password',verify});
  const beforeCancel=(await primary.auth.getUser()).data.user.id;await cancelled.cancel();
  const afterCancel=(await primary.auth.getUser()).data.user.id;
  const transfer=await prepare({target,password:'fixture-password',verify});
  const beforeAdopt=(await primary.auth.getUser()).data.user.id;
  const logoutCount=requests.filter(r=>r.path==='/auth/v1/logout').length;
  await transfer.adopt();await transfer.cancel();
  const adopted=(await primary.auth.getUser()).data.user.id;
  const adoptedSession=(await primary.auth.getSession()).data.session;
  const storageKeys=Object.keys(localStorage).filter(k=>k.startsWith('totus-tpv-incoming-'));
  return {old,incoming,wrongDenied,afterWrong,beforeCancel,afterCancel,beforeAdopt,adopted,refresh:adoptedSession.refresh_token,storageKeys,events,logoutAfterAdopt:requests.filter(r=>r.path==='/auth/v1/logout').length-logoutCount};
 });
 assert.equal(result.wrongDenied,true);
 for(const key of ['afterWrong','beforeCancel','afterCancel','beforeAdopt'])assert.equal(result[key],result.old,key);
 assert.equal(result.adopted,result.incoming);assert.equal(result.refresh,'incoming-refresh');
 assert.equal(result.logoutAfterAdopt,0,'Adopted incoming session must not be revoked by disposable cleanup');
 assert.deepEqual(result.storageKeys,[]);
 assert.ok(result.events.some(e=>e.event==='SIGNED_IN'&&e.id===result.incoming));
 assert.equal(result.events.some(e=>e.event==='SIGNED_OUT'),false);
 console.log('PASS vendored Supabase SDK handoff: wrong/cancel keep primary user, incoming session adoption emits SIGNED_IN, refresh token adopted only by main Auth storage, no temporary storage or adopted-session logout. Local fake Auth transport, no remote account.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
