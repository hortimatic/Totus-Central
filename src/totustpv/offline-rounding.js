/** Exact nonnegative price rounding. Modes match the native shop configuration.
 * This does not apply discounts, taxes or authorize a payable offline quote. */
function roundedUnits(micros,mode,precision){
 if(!Number.isSafeInteger(micros)||micros<0||!Number.isInteger(mode)||mode<0||mode>5)throw Error('Importe o redondeo no válido.');
 if(!Number.isInteger(precision)||precision<0||precision>6)throw Error('Falta la precisión de cálculo de la tienda.');
 const amount=BigInt(micros),unit=10n**BigInt(6-precision),whole=amount/unit,remainder=amount%unit;
 const up=mode===0?remainder>0n:mode===1?false:remainder*2n>unit?true:remainder*2n<unit?false:
  mode===2?true:mode===3?false:mode===4?whole%2n===1n:whole%2n===0n;
 return Number(whole+(up?1n:0n));
}
export function roundPriceMicros(micros,mode){return roundedUnits(micros,mode,2);}
export function roundPriceLineMicros(unitMicros,quantity,{mode,type,computingPrecision}){
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000||![1,2,3].includes(type))throw Error('Cantidad o redondeo de línea no válido.');
 const roundedUnit=roundedUnits(unitMicros,mode,computingPrecision)*10**(6-computingPrecision);
 const value=(type===1?roundedUnit:unitMicros)*quantity;
 if(!Number.isSafeInteger(value))throw Error('El importe supera el intervalo admitido.');
 const roundedLine=type!==2?value:roundedUnits(value,mode,computingPrecision)*10**(6-computingPrecision);
 if(!Number.isSafeInteger(roundedLine))throw Error('El importe supera el intervalo admitido.');
 return roundedLine;
}

export function roundPriceLine(unitMicros,quantity,options){return roundPriceMicros(roundPriceLineMicros(unitMicros,quantity,options),options.mode);}
/** Sum internal-precision lines before currency rounding. Displayed cents can
 * differ from the native subtotal; retain the explicit difference, never hide it.
 * No shipping, tax calculation, promotions or payment authorization here. */
export function roundPriceSubtotal(lines,options){
 if(!Array.isArray(lines)||!lines.length||lines.length>200)throw Error('Las líneas del subtotal no son válidas.');
 const lineMicros=lines.map(line=>roundPriceLineMicros(line.unitMicros,line.quantity,options));
 const sum=lineMicros.reduce((total,value)=>total+BigInt(value),0n);
 if(sum>BigInt(Number.MAX_SAFE_INTEGER))throw Error('El subtotal supera el intervalo admitido.');
 const totalCents=roundPriceMicros(Number(sum),options.mode),lineCents=lineMicros.map(value=>roundPriceMicros(value,options.mode));
 const balancedLineCents=lineMicros.map(value=>Number(BigInt(value)/10000n));
 const remaining=totalCents-balancedLineCents.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(remaining)||remaining<0||remaining>lines.length)throw Error('No se ha podido cuadrar el subtotal.');
 // Largest fractional remainders receive the indivisible cents. Equal
 // remainders keep receipt order. The authoritative total never changes.
 const order=lineMicros.map((value,index)=>({index,remainder:Number(BigInt(value)%10000n)})).sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
 for(let i=0;i<remaining;i++)balancedLineCents[order[i].index]++;
 const lineRoundingAdjustmentsCents=balancedLineCents.map((value,index)=>value-lineCents[index]);
 return {totalCents,lineMicros,lineCents,balancedLineCents,lineRoundingAdjustmentsCents,roundingDifferenceCents:totalCents-lineCents.reduce((a,b)=>a+b,0)};
}
