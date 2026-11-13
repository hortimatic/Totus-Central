import {websiteKey} from './website-registry.js';
import {DIRECTORY_FIELDS,DIRECTORY_WRITABLE} from './contact-directory-contract.js';
export const DIRECTORY_LABELS={id:'ID',firstname:'Nombre',lastname:'Apellidos',email:'Email',name:'Nombre',company:'Empresa',active:'Activo',is_guest:'Invitado',newsletter:'Boletín',optin:'Publicidad',birthday:'Nacimiento',website:'Web',siret:'SIRET',ape:'APE',id_default_group:'Grupo',id_lang:'Idioma',id_gender:'Tratamiento',id_risk:'Riesgo',outstanding_allow_amount:'Crédito',show_public_prices:'Precios públicos',max_payment_days:'Días de pago',description:'Descripción',short_description:'Resumen',meta_title:'Título SEO',meta_description:'Descripción SEO',meta_keywords:'Palabras clave',date_add:'Alta',date_upd:'Actualización',phone:'Teléfono',phone_mobile:'Móvil',address1:'Dirección',address2:'Complemento',postcode:'C. postal',city:'Ciudad',country:'País',province:'Provincia',dni:'NIF/DNI',vat_number:'IVA/NIF',orders:'Pedidos',spent:'Ventas €',margin:'Margen €',products:'Productos',public_name:'Nombre público',group_type:'Tipo',color:'Color',position:'Posición',values:'Valores',parent:'Grupo',custom:'Personalizado',id_country:'País',id_state:'Provincia',alias:'Alias',other:'Indicaciones',value:'Valor',id_attribute_group:'Atributo',id_feature:'Característica'};
export const DIRECTORY_RESOURCES={clientes:'customers',proveedores:'suppliers',marcas:'manufacturers',atributos:'product_options'};
export const DIRECTORY_COLUMNS={
 clientes:['id','firstname','lastname','email','company','phone','phone_mobile','address1','address2','postcode','city','country','province','dni','vat_number','birthday','website','active','is_guest','newsletter','optin','id_default_group','id_lang','siret','ape','outstanding_allow_amount','show_public_prices','id_risk','max_payment_days','orders','spent','margin','date_add','date_upd'],
 proveedores:['id','name','active','description','meta_title','meta_description','meta_keywords','phone','phone_mobile','address1','address2','postcode','city','country','province','dni','vat_number','products','date_add','date_upd'],
 marcas:['id','name','active','description','short_description','meta_title','meta_description','meta_keywords','phone','phone_mobile','address1','address2','postcode','city','country','province','products','date_add','date_upd'],
 atributos:['id','name','public_name','group_type','color','position','values','products','parent','custom']
};
const defaults={clientes:['id','firstname','lastname','email','phone','company','active','orders','spent','margin'],proveedores:['id','name','phone','city','active','products'],marcas:['id','name','active','products','date_upd'],atributos:['id','name','public_name','group_type','values','products']};
export const directoryText=(value,languageId=null)=>Array.isArray(value)?String(value.find(v=>String(v.id)===String(languageId))?.value??value[0]?.value??''):String(value??'');
export function directoryLayout(kind,input={}){
 const valid=DIRECTORY_COLUMNS[kind];if(!valid)throw Error('Directorio no válido.');
 const columns=Array.isArray(input.columns)?[...new Set(input.columns.filter(c=>valid.includes(c)))]:[...defaults[kind]];
 if(!columns.includes('id'))columns.unshift('id');
 const widths=Object.fromEntries(Object.entries(input.widths||{}).filter(([key,value])=>(valid.includes(key)||key==='actions')&&Number.isInteger(value)&&value>=80&&value<=640));
 return {columns,widths,source:(input.source==='local'||websiteKey(input.source))?input.source:'local',pageSize:[0,10,20,50,100].includes(input.pageSize)?input.pageSize:20,sort:valid.includes(input.sort)?input.sort:'id',direction:input.direction==='desc'?'desc':'asc',density:input.density==='compact'?'compact':'normal'};
}
export function directoryPage(rows,{search='',active='',page=1,layout,languageId}={}){
 const needle=String(search).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const normalize=value=>directoryText(value,languageId).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const filtered=rows.filter(row=>(!active||String(row.active)===active)&&(!needle||Object.values(row).some(v=>normalize(v).includes(needle))));
 const direction=layout.direction==='desc'?-1:1;
 filtered.sort((a,b)=>normalize(a[layout.sort]).localeCompare(normalize(b[layout.sort]),'es',{numeric:true})*direction||String(a.id).localeCompare(String(b.id),'es',{numeric:true}));
 const size=layout.pageSize||Math.max(1,filtered.length),pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.min(pages,Math.max(1,Math.trunc(Number(page)||1))),offset=(current-1)*size;
 return {filtered,rows:filtered.slice(offset,offset+size),pages,page:current,total:filtered.length,from:filtered.length?offset+1:0,to:Math.min(offset+size,filtered.length)};
}
export function directoryDiff(resource,before,after,languageId){
 const allowed=DIRECTORY_WRITABLE[resource];if(!allowed)throw Error('Recurso no editable.');
 const fields={};for(const field of allowed)if(Object.hasOwn(after,field)&&String(after[field])!==directoryText(before[field],languageId))fields[field]=String(after[field]);return fields;
}
export const directoryFields=resource=>(DIRECTORY_FIELDS[resource]||[]).filter(field=>DIRECTORY_WRITABLE[resource]?.includes(field));
export function joinDirectoryAddresses(kind,rows,addresses,{countries=[],states=[],languageId=null}={}){
 const parent={clientes:'id_customer',proveedores:'id_supplier',marcas:'id_manufacturer'}[kind];if(!parent)return rows;
 const ids=new Set(rows.map(r=>String(r.id))),seen=new Set(),byOwner=new Map();
 for(const address of addresses){const owner=String(address[parent]);if(!ids.has(owner)||seen.has(String(address.id)))throw Error('La relación de direcciones es incompleta o está duplicada.');seen.add(String(address.id));if(!byOwner.has(owner))byOwner.set(owner,[]);byOwner.get(owner).push(address);}
 return rows.map(row=>{const all=byOwner.get(String(row.id))||[],visible=all.filter(a=>String(a.deleted)!=='1').sort((a,b)=>Number(a.id)-Number(b.id)),first=visible[0];
  const contact=Object.fromEntries(['phone','phone_mobile','address1','address2','postcode','city','dni','vat_number'].map(field=>[field,String(first?.[field]||'')]));
  contact.country=first?directoryText(countries.find(c=>String(c.id)===String(first.id_country))?.name,languageId)||'País #'+first.id_country:'';
  contact.province=first&&Number(first.id_state)>0?directoryText(states.find(s=>String(s.id)===String(first.id_state))?.name,languageId)||'Provincia #'+first.id_state:'';
  return {...row,...contact,__addresses:all,__address_count:visible.length,__address_label:first?'Primera dirección activa: '+(first.alias||'#'+first.id):'Sin direcciones activas'};
 });
}
