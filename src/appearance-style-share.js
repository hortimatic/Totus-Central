import {appearanceValues,APPEARANCE_FIELDS} from './appearance-core.js';

// Portable visual preset: deliberately excludes personal identity, logos, photos and route ordering.
// The receiver explicitly imports it to their own library; nothing changes in another account silently.
const PRIVATE_KEYS=new Set(['brandName','brandSubtitle','logoMode','customLogoData','customBackgroundData','logoHeight','navigationOrder','navigationCollapsed','startModule','backgroundMode']);
export const SHAREABLE_STYLE_KEYS=Object.keys(APPEARANCE_FIELDS.interfaz).filter(key=>!PRIVATE_KEYS.has(key));
export function exportSharedInterfaceStyle({name,config}){
 const clean=appearanceValues('interfaz',config);
 const shared=Object.fromEntries(SHAREABLE_STYLE_KEYS.map(key=>[key,clean[key]]));
 const title=String(name||'Estilo compartido').trim().slice(0,60)||'Estilo compartido';
 return JSON.stringify({format:'totus-interface-style',version:1,name:title,config:shared},null,2);
}
export function importSharedInterfaceStyle(code){
 if(typeof code!=='string'||!code.trim()||code.length>16000)throw Error('Código de estilo vacío o demasiado largo.');
 let parsed;try{parsed=JSON.parse(code);}catch{throw Error('El código no es un JSON válido.');}
 if(!parsed||Array.isArray(parsed)||parsed.format!=='totus-interface-style'||parsed.version!==1||typeof parsed.config!=='object'||parsed.config===null||Array.isArray(parsed.config))throw Error('El código no corresponde a un estilo de Totus Central compatible.');
 const keys=Object.keys(parsed.config);
 if(!keys.length||keys.length>SHAREABLE_STYLE_KEYS.length||keys.some(key=>!SHAREABLE_STYLE_KEYS.includes(key)))throw Error('El estilo contiene campos que no se pueden compartir.');
 for(const key of keys){
  const field=APPEARANCE_FIELDS.interfaz[key],value=parsed.config[key];
  if(field.type==='color'&& !(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)))throw Error('Color incorrecto en '+field.label+'.');
  if(field.type==='range'&& !(typeof value==='number'&&Number.isInteger(value)&&value>=field.min&&value<=field.max))throw Error('Valor incorrecto en '+field.label+'.');
  if(field.type==='select'&& !field.options.some(([allowed])=>allowed===value))throw Error('Opción incorrecta en '+field.label+'.');
  if(field.type==='text'&& !(typeof value==='string'&&value.length<=field.max))throw Error('Texto incorrecto en '+field.label+'.');
 }
 const name=typeof parsed.name==='string'&&parsed.name.trim()?parsed.name.trim().slice(0,60):'Estilo compartido';
 return {name,config:Object.fromEntries(keys.map(key=>[key,parsed.config[key]]))};
}
export function applySharedInterfaceStyle(current,shared){
 const imported=importSharedInterfaceStyle(shared);
 return {name:imported.name,config:appearanceValues('interfaz',{...current,...imported.config})};
}
