// Display-only retail tax estimate for the explicitly selected country.
// Never derive a rate from a group's translated name or assume every product is 21%.
export function productCountryTaxRate(groupId,{countryCode='ES',countries=[],rules=[],taxes=[]}={}){
 if(String(groupId)==='0')return 0;
 if(!groupId)return null;
 const countriesFound=countries.filter(c=>String(c.iso_code).toUpperCase()===countryCode&&String(c.active)==='1');
 if(countriesFound.length!==1)return null;
 const country=String(countriesFound[0].id);
 const relevant=rules.filter(r=>String(r.id_tax_rules_group)===String(groupId)&&String(r.id_country)===country);
 // Postcode/state/compound cases need a full address, not a fabricated generic PVP.
 if(relevant.length!==1)return null;
 const rule=relevant[0];
 if(!['','0'].includes(String(rule.id_state??''))||![rule.zipcode_from,rule.zipcode_to].every(x=>['','0'].includes(String(x??''))))return null;
 const tax=taxes.find(t=>String(t.id)===String(rule.id_tax)&&String(t.active)==='1');
 const rate=tax?.rate===''?NaN:Number(tax?.rate);
 return Number.isFinite(rate)&&rate>=0&&rate<=100?rate:null;
}
export function productDisplayAmounts(product,rate){
 const numeric=v=>v===null||v===undefined||String(v).trim()===''?NaN:Number(v);
 const net=numeric(product?.price),cost=numeric(product?.wholesale_price);
 const noSeparateEcotax=product?.ecotax===undefined||Number(product.ecotax)===0;
 return {rate:rate!==null&&Number.isFinite(rate)?rate:null,net:Number.isFinite(net)?net:null,gross:Number.isFinite(net)&&rate!==null&&Number.isFinite(rate)&&noSeparateEcotax?net*(1+rate/100):null,
  cost:Number.isFinite(cost)?cost:null,margin:Number.isFinite(net)&&Number.isFinite(cost)?net-cost:null,
  marginPct:Number.isFinite(net)&&net>0&&Number.isFinite(cost)?(net-cost)/net*100:null};
}

// Margin on sale (not markup on cost); result remains an approximate price study.
export function productPriceForMargin(cost,percent){
 const buy=Number(cost),margin=Number(percent);
 if(String(cost??'').trim()===''||!Number.isFinite(buy)||buy<=0||String(percent??'').trim()===''||!Number.isFinite(margin)||margin>=100)throw Error('Introduce un coste mayor que cero y un margen sobre venta inferior al 100 %.');
 const price=buy/(1-margin/100);if(!Number.isFinite(price)||price<0)throw Error('El margen no permite calcular un precio válido.');return price;
}

// Purchase estimate: both surcharges apply to the same net cost, never compound.
export function productPurchaseAmounts(cost,vat,surcharge){
 const number=v=>v===null||v===undefined||String(v).trim()===''?NaN:Number(v);
 const base=number(cost),tax=number(vat),re=number(surcharge);
 if(!Number.isFinite(base)||base<0||!Number.isFinite(tax)||tax<0||tax>100)return {withVat:null,total:null};
 return {withVat:base*(1+tax/100),total:Number.isFinite(re)&&re>=0&&re<=100?base*(1+(tax+re)/100):null};
}
