export class ServiceError extends Error{
 constructor(response,context){
  const source=response?.error||response||{};
  super(context+': '+(source.message||String(source)));
  this.name='ServiceError';this.code=String(source.code||'');
  this.status=Number(response?.status||source.status||source.statusCode||0);
  this.details=source.details||'';this.hint=source.hint||'';
  const sql=/^[0-9A-Z]{5}$/.test(this.code)&&!/^08|^57P|^40003$/.test(this.code);
  this.confirmedRejected=sql||/^PGRST\d+$/.test(this.code)||[400,401,403,404,405,409,422].includes(this.status);
 }
}
export class UncertainWriteError extends Error{
 constructor(error){
  super('No se ha podido confirmar el guardado. Conserva los datos y comprueba el registro antes de reenviarlo. '+(error?.message||''));
  this.name='UncertainWriteError';this.outcomeUnknown=true;this.confirmedRejected=false;this.cause=error;
 }
}
export function assertService(response,context){if(response?.error)throw new ServiceError(response,context)}
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
export function matchesSavedFields(saved,expected){
 if(!saved)return false;
 return Object.entries(expected).every(([key,value])=>{
  if(value===undefined||key==='updated_at'||key==='created_at')return true;
  const actual=saved[key];
  if(typeof value==='number'&&actual!==null&&actual!==undefined&&Number.isFinite(Number(actual)))return Number(actual)===value;
  return JSON.stringify(canonical(actual))===JSON.stringify(canonical(value));
 });
}
export async function verifiedWrite(attempt,readBack,matches){
 try{return await attempt()}
 catch(error){
  if(error?.confirmedRejected===true)throw error;
  try{const saved=await readBack();if(saved&&matches(saved))return saved}catch{}
  throw new UncertainWriteError(error);
 }
}
export function cleanupAllowed(error){return error?.confirmedRejected===true&&error?.outcomeUnknown!==true}
