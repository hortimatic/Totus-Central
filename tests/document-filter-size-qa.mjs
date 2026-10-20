import assert from 'node:assert/strict';
import {state,patchFilters} from '../src/state.js';
import {documentos} from '../src/pages/main.js';
state.user={role:'admin'};
state.data.documents=[
 {id:'oct',document_date:'2026-10-01',original_name:'Octubre.pdf',doc_type:'factura_recibida',status:'revisada',size_bytes:100*1024*1024},
 {id:'sep',document_date:'2026-09-01',original_name:'Septiembre.pdf',doc_type:'factura_recibida',status:'revisada',size_bytes:900*1024*1024}
];
const before=JSON.stringify(state.data.documents);
patchFilters('documentos',{from:'2026-10-01',to:'2026-10-31',store:'all',query:'',type:'all',status:'all'});
assert(documentos().includes('Tamaño de los documentos filtrados'));
assert(documentos().includes('100,0 MB'));
assert(!documentos().includes('1000,0 MB'));
patchFilters('documentos',{from:'2026-09-01',to:'2026-09-30'});
assert(documentos().includes('900,0 MB'));
assert.equal(JSON.stringify(state.data.documents),before);
console.log('DOCUMENT SIZE QA: dates select the corresponding byte total without changing documents');
