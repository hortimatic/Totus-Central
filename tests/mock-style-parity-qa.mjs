import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('full application simulations load every production stylesheet',()=>{
 const styles=file=>[...readFileSync(file,'utf8').matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1].replace(/^\.\.\//,''));
 const production=styles('index.html'),simulation=new Set(styles('tests/app-mock.html'));
 for(const sheet of production)assert(simulation.has(sheet),'Missing production stylesheet in simulation: '+sheet);
});
