import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {monthRange,yearRange,inRange,fmtDate,n,csv} from '../src/utils.js';
import {validateExpensePayment,validateExpenseLineAmounts,quickPriceStudy} from '../src/calculations.js';

for(const [input,expected] of [['1.234,56',1234.56],['1,234.56',1234.56],['12,50',12.5],['12.50',12.5],['0',0],['',0]])assert.equal(n(input),expected,'Importe mal interpretado: '+input);
assert.equal(csv([['11/10/2026','Hortimatic','Gasto',10.2,'Proveedor; "especial"']],['Fecha','Tienda','Origen','Importe','Detalle'].map((label,i)=>({label,get:r=>r[i]}))).split('\n')[1],'"11/10/2026";"Hortimatic";"Gasto";"10.2";"Proveedor; ""especial"""');
assert.deepEqual(monthRange('2024-02-12'),{from:'2024-02-01',to:'2024-02-29'});
assert.deepEqual(monthRange('2026-02-12'),{from:'2026-02-01',to:'2026-02-28'});
assert.deepEqual(monthRange('2026-12-31'),{from:'2026-12-01',to:'2026-12-31'});
assert.deepEqual(yearRange(2026),{from:'2026-01-01',to:'2026-12-31'});
assert.equal(inRange('2026-04-01','2026-01-01','2026-03-31'),false);
assert.equal(inRange('2026-03-31','2026-01-01','2026-03-31'),true);
assert.equal(fmtDate('2026-02-03'),'03/02/2026');

for(const [input,needle] of [['=1+1',"'=1+1"],['  =1+1',"'  =1+1"],['+CMD',"'+CMD"],['@SUM(A1)',"'@SUM(A1)"]]){
 const value=csv([[input]],[{label:'Dato',get:r=>r[0]}]).split('\n')[1];
 assert.ok(value.includes(needle.trim()),'CSV formula protection missing for '+input);
}
assert.equal(csv([[-44]],[{label:'Número',get:r=>r[0]}]).split('\n')[1],'"-44"');


const script="import {isoToday} from './src/utils.js'; const d=new Date(); const local=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); if(isoToday()!==local) process.exit(7)";
for(const tz of ['Europe/Madrid','America/Los_Angeles','Pacific/Auckland','UTC']){
 execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,TZ:tz}});
}
const app=fs.readFileSync('src/app.js','utf8');
assert.match(app,/import \{[^}]*\bmoney\b[^}]*\} from '\.\/utils\.js'/,'El panel necesita el formato de importes');
assert.match(app,/import \{[^}]*\btable\b[^}]*\} from '\.\/components\.js'/,'El panel necesita la tabla de informes');
const backup=fs.readFileSync('src/backup.js','utf8');
assert.match(backup,/select\('\*'\)\.order\(orderKey,\{ascending:true\}\)\.range\(from,from\+999\)/,'La copia debe paginar con orden estable por clave primaria');
const sql=fs.readFileSync('supabase/backup.sql','utf8');
for(const token of ["x.notes,state.data.stores.find","x.supplier_name,x.invoice_number,x.description,x.payment_method"]){
 assert.ok(app.includes(token),'El Excel exportado debe respetar los filtros de búsqueda: '+token);
}
for(const required of ["'ops_income_adjustments'"]){
 assert.ok(backup.includes(required),'Falta tabla en ZIP: '+required);
 assert.ok(sql.includes(required),'Falta tabla en restauración: '+required);
}
assert.ok(sql.includes('delete from public.ops_income_adjustments;'));
assert.ok(sql.includes('insert into public.ops_income_adjustments'));

for(const good of [[126.2,126.2,'pagado'],[126.2,0,'pendiente'],[126.2,30,'parcial'],[0,0,'pagado']]){
 assert.equal(validateExpensePayment(...good),true,'Valid expense payment rejected: '+good);
}
for(const bad of [[126.2,130,'pagado'],[126.2,10,'pagado'],[126.2,10,'pendiente'],[126.2,0,'parcial'],[126.2,126.2,'parcial'],[126.2,-2,'parcial'],[0,1,'parcial'],[NaN,0,'pendiente']]){
 assert.throws(()=>validateExpensePayment(...bad),Error,'Invalid expense payment accepted: '+bad);
}


const validLine={base:100,vat:21,re:5.2,withholding:0,deductiblePct:100};
assert.deepEqual(validateExpenseLineAmounts(validLine),validLine);
for(const patch of [{base:-1},{vat:-1},{vat:101},{re:110},{withholding:120},{deductiblePct:-1},{deductiblePct:101},{base:NaN}]){
 assert.throws(()=>validateExpenseLineAmounts({...validLine,...patch}),Error,'Invoice line incorrectly accepted: '+JSON.stringify(patch));
}

const margin=quickPriceStudy({cost:5,pvp:10,vat:21,re:5.2,discount:0});
assert.equal(Math.round(margin.costReal*100),631,'RE purchase cost includes IVA + recargo');
assert.equal(Math.round(margin.margin*100),369,'Cash margin must subtract entire RE purchase cost from final PVP');
assert.equal(Math.round(margin.marginPct*10),369,'Margin percent must use final PVP, not VAT-deductible base');
const negativeMargin=quickPriceStudy({cost:5,pvp:6,vat:21,re:5.2});
assert(negativeMargin.margin<0,'Pricing must alert on actual loss after RE');
const noTaxes=quickPriceStudy({cost:5,pvp:10,vat:0,re:0});
assert.equal(noTaxes.margin,5,'Zero tax rates must be respected');
console.log('Fechas, límites, exportaciones, IVA+RE y márgenes reales, líneas fiscales, pagos y backup: OK');
