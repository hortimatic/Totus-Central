import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APPLICATION_ORIGINS,withApplicationCors} from '../src/application-cors.js';

let calls=0;
const handle=withApplicationCors(async request=>{
 calls++;
 const headers={'Access-Control-Allow-Origin':APPLICATION_ORIGINS[0],
  'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Accept-Encoding','Cache-Control':'no-store'};
 if(request.method==='OPTIONS')return new Response('ok',{headers});
 if(!request.headers.get('authorization'))return new Response('Sesión requerida',{status:401,headers});
 return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('respuesta'));controller.close();}}),{headers});
});
for(const origin of APPLICATION_ORIGINS){
 for(const method of ['OPTIONS','POST']){
  const response=await handle(new Request('https://example.invalid/functions/v1/test',{method,headers:{Origin:origin}}));
  assert.equal(response.status,method==='OPTIONS'?200:401);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal(response.headers.get('Vary'),'Accept-Encoding, Origin');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 const response=await handle(new Request('https://example.invalid',{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-fixture'}}));
 assert.equal(await response.text(),'respuesta');
}
for(const origin of ['null','http://totuscentral.totuscode.com','https://totuscentral.totuscode.com.evil.invalid','https://evil.invalid','https://hortimatic.github.io.evil.invalid']){
 const response=await handle(new Request('https://example.invalid',{headers:{Origin:origin}}));
 assert.equal(response.status,401);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
}
// OneDrive receives Microsoft's validated form_post callback. It must retain its
// own state validation and redirect; this wrapper must not intercept that flow.
const callback=withApplicationCors(async()=>new Response(null,{status:303,headers:{Location:'https://hortimatic.github.io/Totus-Central/'}}));
const redirect=await callback(new Request('https://example.invalid/callback',{method:'POST',headers:{Origin:'https://login.microsoftonline.com'}}));
assert.equal(redirect.status,303);assert.equal(redirect.headers.get('Location'),'https://hortimatic.github.io/Totus-Central/');
assert.equal(redirect.headers.get('Access-Control-Allow-Origin'),null);
const native=await handle(new Request('https://example.invalid',{method:'POST'}));
assert.equal(native.status,401,'No-Origin service calls still require authentication');
const manifest=JSON.parse(fs.readFileSync('supabase/functions/deployment-manifest.json','utf8'));
for(const name of ['totus-connections','totus-ai','totus-backup-run','totus-recovery','totus-onedrive']){
 const service=manifest.services.find(item=>item.name===name);
 assert.ok(service.files.includes('src/application-cors.js'));
 const entry=fs.readFileSync(service.entrypoint,'utf8');
 assert.match(entry,/Deno\.serve\(withApplicationCors\(/,name+' entrypoint must apply CORS to all responses');
}
console.log('application-cors: exact owned origins, preflights, auth failures, native calls, streams and complete packages verified');
