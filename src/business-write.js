import {UncertainWriteError} from './write-safety.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function formSignature(root){
 return JSON.stringify([...root.querySelectorAll('input,select,textarea')].map(el=>[
  el.id,el.type,el.value,el.checked,
  [...(el.files||[])].map(f=>[f.name,f.size,f.type,f.lastModified])
 ]));
}
export function createBusinessWriter({rpc}){
 const pending=new WeakMap();let compatible=false;
 const ensure=async()=>{
  if(compatible)return;
  const contract=await rpc('totus_business_write_contract');
  if(contract?.request_replay!==1){
   const error=new Error('Falta activar la protección de guardado en el servidor. No se han enviado los datos.');
   error.confirmedRejected=true;throw error;
  }
  compatible=true;
 };
 const run=async(root,intent)=>{
  for(let attempt=0;attempt<2;attempt++){
   try{
    const id=await rpc(intent.name,intent.args);
    if(typeof id!=='string'||!UUID.test(id))throw new Error('El servidor no devolvió la confirmación del registro.');
    pending.delete(root);return {id,args:intent.args};
   }catch(error){
    if(error?.confirmedRejected===true&&!intent.uncertain){pending.delete(root);throw error;}
    intent.uncertain=true;
    if(attempt===1)throw new UncertainWriteError(error);
   }
  }
 };
 return {
  ensure,
  async execute(root,name,args,key){
   if(!root)throw new Error('No se ha encontrado la ficha que deseas guardar.');
   if(pending.has(root))throw new Error('Comprueba primero el guardado pendiente antes de enviar otros datos.');
   await ensure();
   const prepared=structuredClone(args);
   prepared[key]={...prepared[key],request_id:crypto.randomUUID()};
   const intent={name,args:prepared,signature:formSignature(root),uncertain:false};
   pending.set(root,intent);return (await run(root,intent)).id;
  },
  async resume(root){
   const intent=root&&pending.get(root);if(!intent)return null;
   if(formSignature(root)!==intent.signature)throw new Error('Hay un guardado sin confirmar y has cambiado la ficha. Conserva esos cambios y comprueba el registro antes de enviarlos.');
   return run(root,intent);
  }
 };
}
