import {quickPriceStudy} from './calculations.js';
import {esc,money} from './utils.js';
export function profitability(study,target=35){
 if(!study)return 'Sin coste o precio';
 return study.margin<0?'Pérdida':study.marginPct<18?'Crítico':study.marginPct<25?'Ajustado':study.marginPct<target?'Sano':'Muy sano';
}
export function discountScenarios(items,settings={},target=35,selected=''){
 const available=items.filter(x=>x.cost_net!=null&&x.pvp!=null&&Number(x.pvp)>0);
 if(!available.length)return '<p class="note">Indica el coste de compra y el PVP para comparar descuentos.</p>';
 const index=Math.max(0,available.findIndex(x=>String(x.id||x.sku||x.name)===String(selected)));
 const selector=available.length>1?'<label>Variante para comparar descuentos<select id="prDiscountVariant">'+available.map((x,i)=>'<option value="'+esc(String(x.id||x.sku||x.name))+'" '+(i===index?'selected':'')+'>'+esc(x.name||x.sku||'Variante')+'</option>').join('')+'</select></label>':'';
 return selector+[available[index]].map(item=>'<section><h4>'+esc(item.name||'Producto')+'</h4><div class="table-wrap"><table class="data-table"><thead><tr><th>Descuento</th><th class="num">Precio final</th><th class="num">Beneficio / unidad</th><th class="num">Margen</th><th>Rentabilidad</th></tr></thead><tbody>'+Array.from({length:11},(_,i)=>{
 const discount=i*5,r=quickPriceStudy({cost:item.cost_net,pvp:item.pvp,discount,vat:settings.default_sales_vat_rate??21,re:settings.purchase_re_rate??5.2});
 return '<tr><td>'+discount+' %</td><td class="num">'+money(r.finalSale)+'</td><td class="num">'+money(r.margin)+'</td><td class="num">'+r.marginPct.toFixed(1).replace('.',',')+' %</td><td><span class="badge '+(r.margin<0?'bad':r.marginPct<18?'warn':'ok')+'">'+profitability(r,target)+'</span>'+(r.marginPct<18?' · Descuento no recomendado':'')+'</td></tr>';
 }).join('')+'</tbody></table></div></section>').join('');
}
