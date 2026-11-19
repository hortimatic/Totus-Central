/** Native preview context, not an offline permission or a complete price rule set. */
export function cataloguePricingContext(value){
 if(value===undefined)return null;
 const keys=['customerId','addressId','shopId','currency','roundMode','roundType','computingPrecision','quantity'];
 if(!value||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))||
  !['customerId','addressId','shopId'].every(key=>Number.isSafeInteger(value[key])&&value[key]>0)||value.currency!=='EUR'||
  ![0,1,2,3,4,5].includes(value.roundMode)||![1,2,3].includes(value.roundType)||
  !Number.isInteger(value.computingPrecision)||value.computingPrecision<2||value.computingPrecision>6||(!Number.isSafeInteger(value.quantity)||value.quantity<1||value.quantity>10000))
  throw Error('No se ha podido comprobar el contexto de precios del catálogo.');
 return structuredClone(value);
}
