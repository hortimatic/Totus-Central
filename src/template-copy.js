export function templateCopyCode(code,templates){
 const existing=new Set(templates.map(t=>String(t.code).toUpperCase()));
 const base=String(code).toUpperCase();
 for(let n=1;n<=existing.size+1;n++){
  const suffix=n===1?'-COPIA':'-COPIA-'+n;
  const candidate=base.slice(0,50-suffix.length)+suffix;
  if(!existing.has(candidate))return candidate;
 }
 throw new Error('No se pudo asignar un código a la copia.');
}
