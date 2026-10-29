// Shared, on-demand classic-script loaders. Both dependencies retain their pinned CDN URLs.
const SOURCES={excel:{url:'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',global:'XLSX'},zip:{url:'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',global:'JSZip'}};
const pending=new Map();
function available(name){
 if(name==='excel')return typeof window.XLSX?.read==='function'&&typeof window.XLSX?.writeFile==='function'&&typeof window.XLSX?.utils?.book_new==='function';
 return typeof window.JSZip==='function'&&typeof window.JSZip.loadAsync==='function';
}
function load(name){
 const {url,global}=SOURCES[name];
 if(available(name))return Promise.resolve(window[global]);
 if(pending.has(name))return pending.get(name);
 const promise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=url;script.async=true;
  script.onload=()=>{
   if(!available(name)){script.remove();reject(new Error('La biblioteca '+name+' se descargó, pero no está disponible.'));return;}
   resolve(window[global]);
  };
  script.onerror=()=>{script.remove();reject(new Error('No se pudo cargar '+name+'. Comprueba la conexión y vuelve a pulsar.'));};
  document.head.appendChild(script);
 });
 pending.set(name,promise);
 // Do not cache failure: the next real click must retry instead of remaining rejected.
 promise.catch(()=>{if(pending.get(name)===promise)pending.delete(name)});
 return promise;
}
export function ensureExcel(){return load('excel')}
export function ensureZip(){return load('zip')}
