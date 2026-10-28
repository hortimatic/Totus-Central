// PDF.js 6 uses the standard Map upsert method, absent in older browsers.
// Keep the vendor bundle unchanged and leave native implementations intact.
export function ensurePdfMapCompatibility(){
 if(typeof Map.prototype.getOrInsertComputed==='function')return;
 Object.defineProperty(Map.prototype,'getOrInsertComputed',{
  configurable:true,writable:true,
  value:function(key,callback){
   if(typeof callback!=='function')throw new TypeError('callback must be callable');
   if(this.has(key))return this.get(key);
   const value=callback(key);this.set(key,value);return value;
  }
 });
}
