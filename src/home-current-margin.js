import {esc,money} from './utils.js';
import {homeMarginTotal} from './home-order-enrichment.js';
import {sourceCents} from './prestashop-insights.js';
const signedCents=value=>{if(!Number.isFinite(value))return null;const cents=sourceCents(Math.abs(value).toFixed(6));return cents===null?null:(value<0?-1:1)*cents;};

export function commercialMarginSummary(data,{from,to}={}){
 let complete=true,pending=0,covered=0,count=0,cents=0;const series=new Map(),stores=[];
 for(const [shop,read] of Object.entries(data)){
  if(!read||read.error){complete=false;pending++;stores.push({shop,pending:true,error:read?.error||null});continue;}
  const margin=homeMarginTotal(read.rows),valid=read.rows.filter(r=>String(r.valid)==='1');
  const measured=valid.filter(r=>r.currency_code==='EUR'&&signedCents(r.margin_value)!==null);
  const amount=measured.reduce((n,r)=>n+signedCents(r.margin_value),0);
  const good=read.complete===true&&margin.complete&&measured.length===valid.length&&Number.isSafeInteger(cents+amount)&&!read.rows.some(r=>!['0','1'].includes(String(r.valid)));
  complete&&=good;covered+=measured.length;count+=margin.total;cents+=amount;
  stores.push({shop,covered:measured.length,count:margin.total,amount:amount/100,complete:good,checked:read.checked});
  for(const row of measured){const date=String(row.date_add||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){complete=false;continue;}series.set(date,(series.get(date)||0)+signedCents(row.margin_value));}
 }
 if(!Object.keys(data).length)complete=false;
 if(complete&&/^\d{4}-\d{2}-\d{2}$/.test(from||'')&&/^\d{4}-\d{2}-\d{2}$/.test(to||'')){
  const start=new Date(from+'T12:00:00Z'),end=new Date(to+'T12:00:00Z'),days=(end-start)/86400000;
  if(Number.isInteger(days)&&days>=0&&days<=366)for(const d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){const date=d.toISOString().slice(0,10);if(!series.has(date))series.set(date,0);}
 }
 return {complete,pending,covered,count,amount:cents/100,stores,series:[...series].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value:value/100}))};
}
export function commercialMarginChart(summary){
 if(!summary.complete||!summary.series.length)return '';
 const rows=summary.series,min=Math.min(0,...rows.map(x=>x.value)),max=Math.max(0,...rows.map(x=>x.value)),span=max-min||1;
 const x=i=>24+(rows.length===1?236:i/(rows.length-1)*472),y=n=>140-(n-min)/span*120;
 const points=rows.map((r,i)=>x(i).toFixed(2)+','+y(r.value).toFixed(2)).join(' ');
 return '<figure class="home-commercial-chart" aria-label="Margen comercial por fecha"><figcaption>Margen por fecha · '+esc(rows[0].date)+' — '+esc(rows.at(-1).date)+'</figcaption><svg viewBox="0 0 520 160" role="img" aria-label="Margen comercial, incluidos valores negativos"><line x1="24" x2="496" y1="'+y(0)+'" y2="'+y(0)+'" stroke="currentColor" opacity=".3"/><polyline fill="none" stroke="currentColor" stroke-width="2" points="'+points+'"/>'+rows.map((r,i)=>'<circle cx="'+x(i)+'" cy="'+y(r.value)+'" r="3" fill="currentColor"><title>'+esc(r.date+' · '+money(r.value))+'</title></circle>').join('')+'</svg><details><summary>Ver cifras de la gráfica</summary><dl>'+rows.map(r=>'<div><dt>'+r.date+'</dt><dd>'+esc(money(r.value))+'</dd></div>').join('')+'</dl></details></figure>';
}
export function commercialMarginWidget(data,{id,from,to}){
 const s=commercialMarginSummary(data,{from,to}),label=s.complete?money(s.amount):s.covered?money(s.amount)+' · parcial':'Pendiente de consulta o costes';
 return '<section class="home-commercial-margin" aria-label="Margen comercial"><p class="small muted">'+esc(from)+' — '+esc(to)+'</p><strong class="home-commercial-total">'+esc(label)+'</strong><p class="small">'+s.covered+'/'+s.count+' pedidos válidos con coste calculable'+(s.pending?' · '+s.pending+' tiendas pendientes':'')+'</p><p class="small muted">Ventas de producto sin impuestos menos coste de compra sin impuestos, usando el coste de producto o combinación disponible en PrestaShop. No es beneficio neto ni resta gastos generales.</p><div class="home-commercial-shops">'+s.stores.map(r=>'<div><span>'+esc(r.shop==='hortimatic'?'Hortimatic':'NewOldSmok')+'</span><b>'+esc(r.pending?r.error||'Sin consulta':r.complete?money(r.amount):r.covered?money(r.amount)+' · parcial':'Costes pendientes')+'</b></div>').join('')+'</div>'+commercialMarginChart(s)+'<button type="button" class="btn secondary" data-home-command="fetch" data-id="'+esc(id)+'">Actualizar margen</button></section>';
}
