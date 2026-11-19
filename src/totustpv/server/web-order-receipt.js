/** Read-only copies of existing shop orders through the official Webservice.
 * No cart, command, payment, order-state update or Central sale is created. */
import {withHistoricalGroupRates} from './receipt-group-rates.js';
import {nativeMicros} from './native-adapter.js';
import {roundPriceMicros} from '../offline-rounding.js';
import {reconcileNativeTaxedSubtotal} from './native-subtotal.js';
const need=(ok,code='TPV_WEB_ORDER_INVALID')=>{if(!ok)throw Error(code);};
const id=value=>/^[1-9][0-9]{0,14}$/.test(String(value))&&Number.isSafeInteger(Number(value))?Number(value):null;
const text=(value,max=512)=>typeof value==='string'&&value.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const list=(value,key)=>Array.isArray(value)&&value.length===0?[]:value?.[key];
export function webOrderQuery(query={}){
 need(query&&typeof query==='object'&&!Array.isArray(query)&&Object.keys(query).every(key=>['orderId','reference'].includes(key)),'TPV_WEB_ORDER_QUERY_INVALID');
 need(query.orderId===undefined||id(query.orderId)===query.orderId,'TPV_WEB_ORDER_QUERY_INVALID');
 need(query.reference===undefined||typeof query.reference==='string'&&/^[A-Za-z0-9-]{1,10}$/.test(query.reference),'TPV_WEB_ORDER_QUERY_INVALID');
 need(query.orderId===undefined||query.reference===undefined,'TPV_WEB_ORDER_QUERY_INVALID');return query;
}
export async function listWebOrders({read,shopId,query={}}){
 webOrderQuery(query);need(id(shopId)===shopId);const exact=query.orderId!==undefined||query.reference!==undefined;
 const response=await read('orders',{display:'[id,id_shop,reference,date_add,id_currency,total_paid_tax_incl,round_mode,valid,current_state]',
  'filter[id_shop]':`[${shopId}]`,...(query.orderId?{'filter[id]':`[${query.orderId}]`}:{}),...(query.reference?{'filter[reference]':`[${query.reference.toUpperCase()}]`}:{}),sort:'[id_DESC]',limit:exact?'0,2':'0,100'});
 const rows=list(response,'orders');need(Array.isArray(rows)&&rows.length<=(exact?2:100));if(exact)need(rows.length<2,'TPV_WEB_ORDER_AMBIGUOUS');const seen=new Set();
 const currencyIds=[...new Set(rows.map(row=>id(row.id_currency)))];need(currencyIds.every(Boolean));
 const currencies=currencyIds.length?list(await read('currencies',{display:'[id,iso_code]','filter[id]':'['+currencyIds.join('|')+']',limit:'0,101'}),'currencies'):[];
 need(Array.isArray(currencies)&&currencies.length===currencyIds.length&&currencies.every(row=>currencyIds.includes(Number(row.id))&&typeof row.iso_code==='string'&&/^[A-Z]{3}$/.test(row.iso_code))&&new Set(currencies.map(row=>Number(row.id))).size===currencyIds.length,'TPV_WEB_ORDER_CURRENCY_UNSUPPORTED');
 const currencyMap=new Map(currencies.map(row=>[Number(row.id),row.iso_code]));
 return rows.map(row=>{const orderId=id(row.id),mode=Number(row.round_mode);need(orderId&&!seen.has(orderId)&&Number(row.id_shop)===shopId&&text(row.reference,32)&&row.reference.trim()&&text(row.date_add,32)&&id(row.id_currency)&&Number.isInteger(mode)&&mode>=0&&mode<=5);seen.add(orderId);
  need(!query.orderId||orderId===query.orderId);need(!query.reference||row.reference.toUpperCase()===query.reference.toUpperCase());
  return {id:`web:${orderId}`,orderId,reference:row.reference,createdAt:row.date_add,totalCents:roundPriceMicros(nativeMicros(row.total_paid_tax_incl),mode),currency:currencyMap.get(Number(row.id_currency)),external:true,status:'external',valid:row.valid===1||row.valid==='1',stateId:id(row.current_state)};});
}
const configurationNames={PS_SHOP_NAME:'name',PS_SHOP_ADDR1:'address',PS_SHOP_ADDR2:'address2',PS_SHOP_CODE:'postcode',PS_SHOP_CITY:'city',PS_SHOP_PHONE:'phone',PS_SHOP_REGISTRATION_NUMBER:'registration',PS_SHOP_LOGO:'logo_path'};
async function merchantFor({read,shopId,shopGroupId,origin}){
 let response;try{response=await read('configurations',{display:'[id,name,value,id_shop,id_shop_group]','filter[name]':'['+Object.keys(configurationNames).join('|')+']',limit:'0,1000'});}catch(error){if(!/^TPV_NATIVE_HTTP_(401|403|404)$/.test(error?.message||''))throw error;return {name:new URL(origin).hostname,details_unavailable:true};}const rows=list(response,'configurations');need(Array.isArray(rows)&&rows.length<1000,'TPV_WEB_MERCHANT_INVALID');const output={name:new URL(origin).hostname};
 for(const [name,key] of Object.entries(configurationNames)){
  const scopeId=value=>[null,'',0,'0'].includes(value)?0:id(value);
  const choices=rows.filter(row=>row.name===name&&scopeId(row.id_shop)!==null&&scopeId(row.id_shop_group)!==null&&(!scopeId(row.id_shop)||scopeId(row.id_shop)===shopId)&&(!scopeId(row.id_shop_group)||scopeId(row.id_shop_group)===shopGroupId));
  const rank=row=>Number(row.id_shop)===shopId?2:Number(row.id_shop_group)===shopGroupId?1:0;choices.sort((a,b)=>rank(b)-rank(a));
  need(choices.length<2||rank(choices[0])!==rank(choices[1]),'TPV_WEB_MERCHANT_AMBIGUOUS');const value=choices[0]?.value;if(!text(value,2048)||!value.trim())continue;
  output[key]=key==='logo_path'&&/^[A-Za-z0-9_.-]+\.(?:png|jpe?g|gif|webp)$/i.test(value)?'/img/'+value:key==='logo_path'?'':value;
 }return output;
}
async function webCustomer({read,order,options,access}){
 if(options?.showCustomer!==true)return {};
 if(access!==true)return {customer_details_unavailable:true};
 const customerId=id(order.id_customer),invoiceId=id(order.id_address_invoice),deliveryId=id(order.id_address_delivery);need(customerId&&invoiceId&&deliveryId,'TPV_WEB_ORDER_CUSTOMER_INVALID');
 const address=async addressId=>{
  const fields=['id','id_customer','firstname','lastname','address1','address2','postcode','city','id_country',...(options.showCustomerCompany?['company','vat_number','dni']:[]),...(options.showCustomerPhone?['phone','phone_mobile']:[]),...(options.showAddressComment?['other']:[])];
  const rows=list(await read('addresses',{display:'['+fields.join(',')+']','filter[id]':`[${addressId}]`,limit:'0,2'}),'addresses');need(Array.isArray(rows)&&rows.length===1&&id(rows[0].id)===addressId&&id(rows[0].id_customer)===customerId,'TPV_WEB_ORDER_CUSTOMER_INVALID');const row=rows[0];need(id(row.id_country),'TPV_WEB_ORDER_CUSTOMER_INVALID');const countries=list(await read('countries',{display:'[id,name,iso_code]','filter[id]':`[${Number(row.id_country)}]`,limit:'0,2'}),'countries');need(Array.isArray(countries)&&countries.length===1&&id(countries[0].id)===id(row.id_country),'TPV_WEB_ORDER_CUSTOMER_INVALID');const countryName=Array.isArray(countries[0].name)?countries[0].name.find(item=>Number(item.id)===Number(order.id_lang))?.value:countries[0].name,country=text(countryName,512)?countryName:text(countries[0].iso_code,3)?countries[0].iso_code:'';
  const clean=key=>text(row[key],2048)?row[key]:'';return {name:[clean('firstname'),clean('lastname')].filter(Boolean).join(' '),address1:clean('address1'),address2:clean('address2'),postcode:clean('postcode'),city:clean('city'),country,
   ...(options.showCustomerCompany?{company:clean('company'),taxId:clean('vat_number')||clean('dni')}:{}),...(options.showCustomerPhone?{phone:clean('phone')||clean('phone_mobile')}:{}),...(options.showAddressComment?{comment:clean('other')}:{})};
 };
 try{const invoice=await address(invoiceId),customer={invoice};
  if(options.showDeliveryAddress)customer.delivery=deliveryId===invoiceId?{...invoice}:await address(deliveryId);
  if(options.showCustomerEmail){const rows=list(await read('customers',{display:'[id,email]','filter[id]':`[${customerId}]`,limit:'0,2'}),'customers');need(Array.isArray(rows)&&rows.length===1&&id(rows[0].id)===customerId&&text(rows[0].email,254),'TPV_WEB_ORDER_CUSTOMER_INVALID');customer.email=rows[0].email;}
  return {customer};
 }catch(error){if(!/^TPV_NATIVE_HTTP_(401|403|404)$/.test(error?.message||''))throw error;return {customer_details_unavailable:true};}
}
export async function readWebOrderReceipt({read,shopId,orderId,origin,customerOptions={},customerAccess=false}){
 need(id(shopId)===shopId&&id(orderId)===orderId,'TPV_WEB_ORDER_QUERY_INVALID');
 const query={display:'full','filter[id]':`[${orderId}]`,'filter[id_shop]':`[${shopId}]`,limit:'0,2'};
 const response=await read('orders',query),orders=list(response,'orders');need(Array.isArray(orders)&&orders.length===1,'TPV_WEB_ORDER_NOT_FOUND');const order=orders[0];
 need(id(order.id)===orderId&&Number(order.id_shop)===shopId&&id(order.id_shop_group)&&id(order.id_currency)&&text(order.reference,32)&&order.reference.trim()&&text(order.date_add,32)&&text(order.date_upd,32));
 const mode=Number(order.round_mode),type=Number(order.round_type);need(Number.isInteger(mode)&&mode>=0&&mode<=5&&[1,2,3].includes(type));
 const currencyResponse=await read('currencies',{display:'[id,iso_code]','filter[id]':`[${Number(order.id_currency)}]`,limit:'0,2'}),currencies=list(currencyResponse,'currencies');need(Array.isArray(currencies)&&currencies.length===1&&Number(currencies[0].id)===Number(order.id_currency)&&currencies[0].iso_code==='EUR','TPV_WEB_ORDER_CURRENCY_UNSUPPORTED');
 const detailResponse=await read('order_details',{display:'[id,id_order,product_name,product_reference,product_quantity,unit_price_tax_incl,unit_price_tax_excl,total_price_tax_incl,total_price_tax_excl,group_reduction]',
  'filter[id_order]':`[${orderId}]`,sort:'[id_ASC]',limit:'0,201'}),details=list(detailResponse,'order_details');need(Array.isArray(details)&&details.length>0&&details.length<=200,'TPV_WEB_ORDER_LINES_INVALID');
 const associated=order.associations?.order_rows;need(Array.isArray(associated)&&associated.length===details.length&&new Set(associated.map(row=>id(row.id))).size===details.length&&details.every(row=>associated.some(item=>id(item.id)===id(row.id)&&Number(item.product_quantity)===Number(row.product_quantity))),'TPV_WEB_ORDER_LINES_INVALID');
 const seen=new Set(),lines=details.map(row=>{const detailId=id(row.id),quantity=Number(row.product_quantity);need(detailId&&!seen.has(detailId)&&Number(row.id_order)===orderId&&text(row.product_name)&&row.product_name.trim()&&text(row.product_reference)&&Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=10000,'TPV_WEB_ORDER_LINES_INVALID');seen.add(detailId);
  const net=nativeMicros(row.total_price_tax_excl),gross=nativeMicros(row.total_price_tax_incl),unitNet=nativeMicros(row.unit_price_tax_excl),unitGross=nativeMicros(row.unit_price_tax_incl);need(net<=gross&&unitNet<=unitGross,'TPV_WEB_ORDER_LINES_INVALID');
  return {key:detailId+':0',name:row.product_name,reference:row.product_reference,quantity,unit_tax_incl_micros:unitGross,unit_tax_excl_micros:unitNet,netMicros:net,grossMicros:gross};});
 const money=key=>roundPriceMicros(nativeMicros(order[key]),mode),products=money('total_products_wt'),netProducts=money('total_products'),total=money('total_paid_tax_incl'),netTotal=money('total_paid_tax_excl'),discount=money('total_discounts_tax_incl'),netDiscount=money('total_discounts_tax_excl'),shipping=money('total_shipping_tax_incl'),netShipping=money('total_shipping_tax_excl'),wrapping=money('total_wrapping_tax_incl'),netWrapping=money('total_wrapping_tax_excl');
 need(netProducts<=products&&netTotal<=total&&netDiscount<=discount&&netShipping<=shipping&&netWrapping<=wrapping,'TPV_WEB_ORDER_TOTALS_INVALID');
 let balanced;if(type===3)balanced=reconcileNativeTaxedSubtotal(lines,{netCents:netProducts,grossCents:products,mode});
 else{balanced=lines.map(row=>({key:row.key,grossCents:roundPriceMicros(row.grossMicros,mode),netCents:roundPriceMicros(row.netMicros,mode)}));need(balanced.reduce((sum,row)=>sum+row.grossCents,0)===products&&balanced.reduce((sum,row)=>sum+row.netCents,0)===netProducts,'TPV_WEB_ORDER_SUBTOTAL_MISMATCH');}
 need(products-discount+shipping+wrapping===total&&netProducts-netDiscount+netShipping+netWrapping===netTotal,'TPV_WEB_ORDER_TOTALS_MISMATCH');
 const allocation=new Map(balanced.map(row=>[row.key,row]));
 const merchant=await merchantFor({read,shopId,shopGroupId:Number(order.id_shop_group),origin});
 const customer=await webCustomer({read,order,options:customerOptions,access:customerAccess});
 const fresh=list(await read('orders',query),'orders');need(Array.isArray(fresh)&&fresh.length===1&&JSON.stringify(fresh[0])===JSON.stringify(order),'TPV_WEB_ORDER_CHANGED');
 const document={kind:'receipt',existing_document:true,external_order:true,order_id:orderId,reference:order.reference,currency:'EUR',created_at:order.date_add,merchant,merchant_origin:origin,merchant_logo_origin:origin,...customer,
  total_cents:total,total_tax_excl_cents:netTotal,discount_cents:discount,shipping_cents:shipping,wrapping_cents:wrapping,payments:{},line_discounts_complete:false,
  lines:lines.map(({key,netMicros,grossMicros,...row})=>{const cents=allocation.get(key);return {...row,line_cents:cents.grossCents,tax_excl_cents:cents.netCents,tax_cents:cents.grossCents-cents.netCents};})};
 return withHistoricalGroupRates(document,details,orderId);
}
