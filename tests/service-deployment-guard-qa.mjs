import test from 'node:test';import assert from 'node:assert/strict';
import {checkServiceDeployment,sourceHash} from '../tools/check-service-deployment.mjs';
const content='export const a=1;\n',baseline={version:45,files:{'index.ts':sourceHash(content),'shared.js':sourceHash('read/write')}};
const live={version:45,files:[{name:'index.ts',content},{name:'shared.js',content:'read/write'}]},proposed={'index.ts':content,'shared.js':'read/write'};
test('exact live bundle and CRLF normalization are accepted',()=>assert.deepEqual(checkServiceDeployment({baseline,live,proposed:{...proposed,'index.ts':content.replace(/\n/g,'\r\n')}}),[]));
test('stale version, remote changes and missing dependencies refuse deployment',()=>{
 assert.throws(()=>checkServiceDeployment({baseline,live:{...live,version:46},proposed}),/versión/);
 assert.throws(()=>checkServiceDeployment({baseline,live:{...live,files:[...live.files.slice(0,1),{name:'shared.js',content:'remote change'}]},proposed}),/activo ha cambiado/);
 assert.throws(()=>checkServiceDeployment({baseline,live,proposed:{'index.ts':content},allowed:['shared.js']}),/retirar/);
});
test('an unrelated change cannot roll back working shared code',()=>{
 assert.throws(()=>checkServiceDeployment({baseline,live,proposed:{...proposed,'shared.js':'old read-only'},allowed:['index.ts']}),/no declarado/);
 assert.deepEqual(checkServiceDeployment({baseline,live,proposed:{...proposed,'index.ts':'reviewed repair'},allowed:['index.ts']}),['index.ts']);
});
