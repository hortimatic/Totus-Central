import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateQuickPriceInput,quickPriceStudy} from '../src/calculations.js';

const valid=[
 [{cost:'10',pvp:'24,20',competitor:'25',discount:'10'},{cost:10,pvp:24.2,competitor:25,discount:10}],
 [{cost:'1.234,56',pvp:'2.345,67',discount:'0'},{cost:1234.56,pvp:2345.67,competitor:0,discount:0}],
 [{cost:'1,234.56',pvp:'2,345.67',competitor:'',discount:''},{cost:1234.56,pvp:2345.67,competitor:0,discount:0}],
 [{cost:'0',pvp:'1',discount:'100'},{cost:0,pvp:1,competitor:0,discount:100}],
 [{cost:5,pvp:6,discount:0},{cost:5,pvp:6,competitor:0,discount:0}]
];
for(const [args,expected] of valid)assert.deepEqual(validateQuickPriceInput(args),expected,JSON.stringify(args));
for(const args of [
 {cost:'-10',pvp:'20'}, {cost:'12abc',pvp:'20'}, {cost:'abc',pvp:'20'},
 {cost:'',pvp:'20'}, {cost:'10',pvp:''}, {cost:'10',pvp:'0'},
 {cost:'10',pvp:'-20'}, {cost:'10',pvp:'20',competitor:'x'},
 {cost:'10',pvp:'20',competitor:'-1'}, {cost:'10',pvp:'20',discount:'105'},
 {cost:'10',pvp:'20',discount:'-1'}, {cost:'10',pvp:'20',discount:'foo'},
 {cost:'10',pvp:'20',discount:'10abc'}, {cost:'1.2.3',pvp:'20'},
 {cost:'1 2',pvp:'20'}, {cost:'1 234',pvp:'20'},
 {cost:'1e4',pvp:'20'}, {cost:'NaN',pvp:'20'}, {cost:'Infinity',pvp:'20'}
]) assert.throws(()=>validateQuickPriceInput(args),Error,JSON.stringify(args));
const data=validateQuickPriceInput({cost:'10',pvp:'24,20',competitor:'25',discount:'10'});
const study=quickPriceStudy({...data,vat:21,re:5.2});
assert.ok(Math.abs(study.costReal-12.62)<1e-8);
assert.ok(Math.abs(study.finalSale-21.78)<1e-8);
assert.ok(Math.abs(study.margin-9.16)<1e-8);
assert.ok(Math.abs(study.marginPct-9.16/21.78*100)<1e-8);
const loss=quickPriceStudy({...validateQuickPriceInput({cost:10,pvp:6}),vat:21,re:5.2});
assert.ok(loss.margin<0,'Legitimate negative margins must remain visible');
const app=fs.readFileSync('src/app.js','utf8'),page=fs.readFileSync('src/pages/main.js','utf8');
for(const method of ['saveHomePrice','saveConsultation']){
 const block=app.slice(app.indexOf('async function '+method+'('),app.indexOf('async function '+method+'(')+850);
 assert.ok(block.includes('validateQuickPriceInput('),method+' must validate before storage');
}
for(const method of ['updateHomePrice','updatePricingQuick']){
 const block=app.slice(app.indexOf('function '+method+'('),app.indexOf('function '+method+'(')+850);
 assert.ok(block.includes('validateQuickPriceInput('),method+' should not preview invalid values');
}
for(const id of ['homePriceError','pqPriceError'])assert.ok(page.includes('id="'+id+'"'),'Error feedback missing: '+id);
console.log('Validación de consultas de precio (Inicio y Pricing): OK');
