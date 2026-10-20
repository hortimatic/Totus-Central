import assert from 'node:assert/strict';
import * as XLSX from 'xlsx-js-style';
import {workbookPreviewText} from '../src/workbook-preview.js';
const preview=cell=>workbookPreviewText(cell,XLSX.utils.format_cell,XLSX.SSF);
for(const [value,format,expected] of [[1053.47,'#,##0.00','1.053,47'],[-8.91,'#,##0.00','-8,91'],[0,'0.00','0,00'],[.21,'0.00%','21,00%'],[1234,'0','1234']]){
 const cell={t:'n',v:value,z:format},before=JSON.stringify(cell);
 assert.equal(preview(cell),expected);
 assert.equal(JSON.stringify(cell),before,'Preview must not mutate workbook cells');
}
const date={t:'n',v:46204,z:'dd/mm/yyyy'};
assert.equal(preview(date),XLSX.utils.format_cell(date),'Date separators must not change');
assert.equal(preview({t:'s',v:'Factura 1.234,56'}),'Factura 1.234,56');
assert.equal(preview(undefined),'');
console.log('WORKBOOK PREVIEW QA: Spanish numeric display, negatives, percentages, dates and unchanged numeric cells');
