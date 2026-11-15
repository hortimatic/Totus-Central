import assert from 'node:assert/strict';
import {startLocalServer} from './local-static-server.mjs';
delete process.env.TOTUS_START_SERVER;
assert.equal(await startLocalServer(),null,'Individual fixtures retain their opt-in server contract');
const server=await startLocalServer({enabled:true});
try{
 const response=await fetch('http://127.0.0.1:4173/src/read-pool.js');
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/javascript/);
 assert.match(await response.text(),/export async function readPool/);
}finally{await new Promise(resolve=>server.close(resolve));}
console.log('Stability runner starts its fixture server without an undocumented shell variable and closes it afterwards.');
