import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogQualityReport,qualityReadLabel} from '../src/catalog-quality.js';
import {catalogQualityPanel} from '../src/catalog-quality-ui.js';
import {recipeProducts} from '../src/prestashop-queries.js';
const clean={id:'1',reference:'A',ean13:'1234567890123',weight:'1',id_default_image:'99'};
test('quality counts unique affected products while preserving separate reasons and input data',()=>{
 const input=[clean,{...clean,id:'2',reference:' ',weight:'0',id_default_image:'0',ean13:' 1234567890123 '},{id:'3',name:'<img onerror=alert(1)>',ean13:'bad',weight:null,id_default_image:null}],before=structuredClone(input),r=catalogQualityReport(input,{complete:false,readAt:'2026-11-12T11:00:00Z'});
 assert.equal(r.affected,3);assert.equal(r.count,3);assert.equal(r.checks.find(c=>c.id==='duplicate_ean').count,2);assert.equal(r.checks.find(c=>c.id==='missing_image').count,2);assert.match(qualityReadLabel(r),/Lectura parcial.*3 fichas/);assert.deepEqual(input,before);
 for(const check of r.checks)assert.deepEqual(recipeProducts(input,check.id).map(p=>p.id),r.rows.filter(p=>p.qualityChecks.includes(check.id)).map(p=>p.id));
});
test('empty complete catalog differs from an unrequested or partial diagnosis',()=>{
 assert.equal(catalogQualityReport([],{complete:true}).affected,0);assert.match(qualityReadLabel(catalogQualityReport([],{complete:true})),/Catálogo completo/);
 const html=catalogQualityPanel(null,{ready:true});assert.match(html,/Sin consulta de esta tienda/);assert(!html.includes('0 fichas con avisos'));
 assert.match(catalogQualityPanel({rows:[],possibly_more:false,readAt:'bad'},{ready:true}),/0<\/b> fichas con avisos/);
});
test('diagnostic controls are read-only, clearly scoped and disabled without a connection',()=>{
 const html=catalogQualityPanel({rows:[clean],possibly_more:true,readAt:'2026-11-12T11:00:00Z'},{ready:false});
 assert.match(html,/no es el total del catálogo/);assert.match(html,/data-recipe="missing_image" disabled/);assert(!html.includes('_commit'));assert.equal(catalogQualityReport([{...clean,weight:'  '}]).checks.find(c=>c.id==='missing_weight').count,1);
});
