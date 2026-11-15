import {concurrentRead} from './concurrent-read.js';
import {DIRECTORY_RESOURCES,joinDirectoryAddresses} from './contact-directory-core.js';
import {createDirectorySession} from './contact-directory-session.js';

// One read path for individual and combined directories; never merges native IDs.
export async function readDirectorySnapshot(session,kind,{languageTask=null,current=()=>true,onRows=()=>{}}={}){
 const ensure=()=>{if(!current())throw Error('La vista ha cambiado.');};
 const [result,inventory]=await Promise.all([session.read(DIRECTORY_RESOURCES[kind]),languageTask||session.read('languages',{}, {cached:true})]);ensure();
 const languageId=String((inventory.rows.find(l=>l.iso_code==='es'&&String(l.active)==='1')||inventory.rows.find(l=>String(l.active)==='1'))?.id||'');
 let rows=result.rows,contactsError='';const metadata={countries:[],states:[]};onRows(rows,languageId);
 try{
  const filterKey={clientes:'customer_ids',proveedores:'supplier_ids',marcas:'manufacturer_ids'}[kind];
  if(filterKey){
   const batches=[];for(let offset=0;offset<rows.length;offset+=25)batches.push(rows.slice(offset,offset+25).map(r=>String(r.id)));
   const linked=await concurrentRead(batches,batch=>{ensure();return session.read('addresses',{[filterKey]:batch});});ensure();const addresses=linked.flatMap(value=>value.rows);
   if(addresses.length){const ids=[...new Set(addresses.map(a=>String(a.id_country)).filter(id=>/^[1-9]\d*$/.test(id)))];const [countries,regions]=await Promise.all([session.read('countries',{}, {cached:true}),concurrentRead(ids,country_id=>session.read('states',{country_id},{cached:true}))]);ensure();metadata.countries=countries.rows;metadata.states=regions.flatMap(value=>value.rows);}
   rows=joinDirectoryAddresses(kind,rows,addresses,{...metadata,languageId});
  }
 }catch(error){ensure();contactsError=error.message;}
 ensure();return {rows,languageId,metadata,contactsError,checked:result.checked};
}

export async function readCombinedCustomers({actor,can,rpc,invoke,current=()=>true,onProgress=()=>{}}){
 const owner=actor(),valid=()=>!!owner&&actor()===owner&&current()&&can('view');
 if(!valid())throw Error('No tienes acceso al directorio.');
 return concurrentRead(['hortimatic','newoldsmok'],async store=>{
  const session=createDirectorySession({kind:'clientes',actor,can,rpc,invoke,onProgress:progress=>{if(valid())onProgress({...progress,store});}});
  try{await session.enter(store);if(!valid())throw Error('La cuenta ha cambiado.');const result=await readDirectorySnapshot(session,'clientes',{current:valid});return {...result,store,rows:result.rows.map(row=>({...row,_shop:store,_key:store+':'+row.id}))};}
  catch(error){if(!valid())throw error;return {store,rows:[],error:error.message};}
  finally{session.dispose();}
 },2);
}
