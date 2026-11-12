/** Bound independent read requests without changing their result order. */
export async function concurrentRead(items, read, limit=3){
 const result=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(next<items.length){const index=next++;result[index]=await read(items[index],index);}
 }));
 return result;
}
