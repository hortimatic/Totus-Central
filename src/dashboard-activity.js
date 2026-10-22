import {selectReportData} from './report-period.js';
import {informationalTaxPayments} from './payment-information.js';
import {closingIncomeAmount,expenseCostAmount} from './calculations.js';
import {esc,money,fmtDate} from './utils.js';
const dateOk=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
export function activitySeries(data,filters){
 const {from,to}=filters;
 if(!dateOk(from)||!dateOk(to)||from>to)throw new Error('Selecciona un periodo de fechas válido.');
 const days=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;
 if(days>36600)throw new Error('Selecciona un periodo de hasta cien años.');
 const monthly=days>93,selected=selectReportData(data,filters),map=new Map();
 if(monthly){for(let y=Number(from.slice(0,4)),m=Number(from.slice(5,7));y*12+m<=Number(to.slice(0,4))*12+Number(to.slice(5,7));){const key=y+'-'+String(m).padStart(2,'0');map.set(key,{key,sales:0,fiscal:0,internal:0});if(++m>12){m=1;y++}}}
 else for(let time=Date.parse(from+'T12:00:00Z');time<=Date.parse(to+'T12:00:00Z');time+=86400000){const key=new Date(time).toISOString().slice(0,10);map.set(key,{key,sales:0,fiscal:0,internal:0})}
 const add=(date,field,value)=>{const point=map.get(String(date).slice(0,monthly?7:10));if(point)point[field]+=Number(value||0)};
 for(const row of selected.closings)if(row.include_in_income!==false)add(row.business_date,'sales',closingIncomeAmount(row));
 for(const row of selected.invoices)if(row.document_type==='factura'&&row.status==='emitida'&&row.include_in_income===true)add(row.issue_date,'sales',row.total_amount);
 for(const row of selected.fiscalAdjustments)if(row.kind==='ingreso_extra')add(row.adjustment_date,'sales',row.amount);
 for(const row of selected.incomeAdjustments)add(row.income_date,'sales',row.amount);
 for(const row of selected.expenses)add(row.expense_date,row.management_only?'internal':'fiscal',expenseCostAmount(row));
 for(const row of informationalTaxPayments(data.taxPayments,filters))add(row.payment_date,'internal',row.amount);
 const points=[...map.values()].map(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,k==='key'?v:Math.round((v+Number.EPSILON)*100)/100])));
 const totals={sales:0,fiscal:0,internal:0};for(const p of points)for(const k of Object.keys(totals))totals[k]+=p[k];
 for(const k of Object.keys(totals))totals[k]=Math.round((totals[k]+Number.EPSILON)*100)/100;
 return {points,totals,monthly};
}
export function activityChartHtml(series){
 const {points,monthly}=series,keys=[['sales','Ventas e ingresos','#2367d1'],['fiscal','Gastos fiscalizables','#14815b'],['internal','Gastos internos','#c66b08']];
 const values=points.flatMap(p=>keys.map(([key])=>p[key])),min=Math.min(0,...values),max=Math.max(1,...values),span=max-min;
 const left=92,right=876,top=28,bottom=245,x=i=>left+(points.length===1?.5:i/(points.length-1))*(right-left),y=v=>bottom-(v-min)/span*(bottom-top);
 const grid=Array.from({length:5},(_,i)=>{const value=min+span*i/4,py=y(value);return '<line x1="'+left+'" x2="'+right+'" y1="'+py+'" y2="'+py+'" stroke="#e3e8ef"/><text x="'+(left-10)+'" y="'+(py+4)+'" text-anchor="end">'+esc(money(value))+'</text>'}).join('');
 const lines=keys.map(([key,label,color])=>'<polyline fill="none" stroke="'+color+'" stroke-width="2.5" vector-effect="non-scaling-stroke" points="'+points.map((p,i)=>x(i)+','+y(p[key])).join(' ')+'"/>'+points.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p[key])+'" r="'+(points.length>100?1.4:3)+'" fill="'+color+'"><title>'+esc(p.key+' · '+label+': '+money(p[key]))+'</title></circle>').join('')).join('');
 const indexes=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])];
 const labels=indexes.map(i=>'<text x="'+x(i)+'" y="274" text-anchor="middle">'+esc(monthly?points[i].key:fmtDate(points[i].key))+'</text>').join('');
 return '<div class="activity-legend">'+keys.map(([,label,color])=>'<span><i style="background:'+color+'"></i>'+label+'</span>').join('')+'</div><div class="activity-chart"><svg viewBox="0 0 900 290" role="img" aria-label="Evolución de ventas, gastos fiscalizables y gastos internos. Consulta los valores en la tabla de detalle.">'+grid+lines+labels+'</svg></div><p class="small muted">'+(monthly?'Agrupado por meses.':'Agrupado por días.')+' Los gastos internos incluyen los impuestos pagados y se muestran aparte. No reducen el beneficio fiscal. Las referencias históricas mensuales aparecen en su fecha registrada.</p><details class="activity-data"><summary>Ver cifras de la gráfica</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>Periodo</th>'+keys.map(([,label])=>'<th class="num">'+label+'</th>').join('')+'</tr></thead><tbody>'+points.map(p=>'<tr><td>'+esc(monthly?p.key:fmtDate(p.key))+'</td>'+keys.map(([key])=>'<td class="num">'+money(p[key])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details>';
}
