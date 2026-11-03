// Fictional inputs only. Reports defensive escaping; never opens a spreadsheet.
import {reportCsv} from '../src/agent-delivery.js';
const results=[];
for(const input of ['=1+1','  =1+1','\t=1+1','normal']){
 const file=reportCsv({from:'2026-01-01',to:'2026-01-31',store:input,income:1,recorded_expenses:0,internal_expenses:0,result_before_taxes:1,note:'Fictional audit input'});
 const line=(await file.text()).split('\r\n').find(x=>x.startsWith('"Tienda";'));
 const dangerous=/^\s*[=+@-]/.test(input);
 results.push({input,line,requiresTextEscape:dangerous,escaped:!dangerous||line.startsWith('"Tienda";"\'')});
}
console.log(JSON.stringify({executionOfSpreadsheet:false,results},null,2));
