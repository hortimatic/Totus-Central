// Bounded read-only work. Keep order; stop scheduling after a failure or navigation.
export async function readPool(items,read,{limit=3,current=()=>true}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>4)throw Error('Límite de lectura no válido.');
 const result=new Array(items.length);let next=0,failure=null;
 const worker=async()=>{while(!failure&&current()&&next<items.length){const i=next++;try{result[i]=await read(items[i],i);}catch(error){failure=error;}}};
 await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
 if(failure)throw failure;
 if(!current())throw Error('La selección ha cambiado durante la lectura.');
 return result;
}
