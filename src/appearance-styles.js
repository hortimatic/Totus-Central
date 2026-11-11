import {appearanceValues,APPEARANCE_PRESETS} from './appearance-core.js';

// Initial styles replace the visual settings instead of inheriting a previous
// style's glow, dimensions or image background. Personal identity/order remain.
export function initialInterfaceStyle(id,current){
 if(!Object.hasOwn(APPEARANCE_PRESETS,id))throw Error('Estilo inicial no válido.');
 const keep=['brandName','brandSubtitle','logoMode','customLogoData','logoHeight','startModule','navigationOrder','navigationCollapsed'];
 const base=appearanceValues('interfaz',current),preset={...APPEARANCE_PRESETS[id]};
 for(const key of keep)delete preset[key];
 return appearanceValues('interfaz',{...Object.fromEntries(keep.map(key=>[key,base[key]])),...preset});
}
export function styleName(value){
 const name=String(value||'').trim();
 if(!name||name.length>60)throw Error('Escribe un nombre para el estilo, de 1 a 60 caracteres.');
 return name;
}
export function interfaceStylesSettings(state){
 return state.data.profiles.find(row=>row.id===state.user?.id)?.ui_preferences?.interface_styles||{revision:0,items:[]};
}
export function acceptInterfaceStyles(state,saved,owner){
 if(!owner||state.user?.id!==owner)throw Error('La sesión ha cambiado.');
 const profile=state.data.profiles.find(row=>row.id===owner);
 if(!profile)throw Error('No se encontró tu perfil. Actualiza la página.');
 profile.ui_preferences={...profile.ui_preferences,interface_styles:saved};
}

export function interfaceStyleLibrary({library,selected='',name='',esc}){
 const items=library.items||[];
 return '<section class="appearance-style-library" aria-label="Mis estilos"><div><h3>Mis estilos</h3><p class="small muted">Guarda el diseño de la vista previa con un nombre. Incluye colores, bordes, tamaños, navegación e imágenes. Solo tu cuenta puede modificarlo; guardarlo no cambia la interfaz aplicada.</p></div><div class="appearance-style-fields"><label>Estilo guardado<select data-my-style data-draft-ignore><option value="">Selecciona un estilo</option>'+items.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===selected?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label><label>Nombre del estilo<input type="text" maxlength="60" data-style-name data-draft-ignore value="'+esc(name)+'" placeholder="Por ejemplo: Mi escritorio compacto"></label></div><div class="inline-actions"><button type="button" class="btn secondary" data-style-action="create">Guardar como nuevo</button><button type="button" class="btn secondary" data-style-action="load">Cargar en vista previa</button><button type="button" class="btn secondary" data-style-action="replace">Actualizar guardado</button><button type="button" class="btn secondary" data-style-action="rename">Renombrar</button><button type="button" class="btn secondary" data-style-action="remove">Eliminar estilo</button></div><p class="small" role="status" aria-live="polite" data-style-status>'+items.length+' estilos guardados en tu cuenta.</p></section>';
}


/** Treat a server acknowledgement as incomplete unless it echoes the requested mutation. */
export function verifySavedInterfaceStyle(saved,command){
 const expected=Number(command?.revision)+1;
 if(!saved||!Number.isSafeInteger(expected)||saved.revision!==expected||!Array.isArray(saved.items))throw Error('No se pudo verificar la revisión del estilo guardado. Recarga antes de reintentar.');
 const row=saved.items.find(item=>item.id===command.id);
 if(command.action==='remove'){
  if(row||saved.changed_id!==null)throw Error('No se pudo confirmar la eliminación del estilo.');
 }else{
  if(!row||row.name!==command.name||saved.changed_id!==command.id)throw Error('No se pudo confirmar el estilo devuelto por el servidor.');
  if(['create','replace'].includes(command.action)&&JSON.stringify(appearanceValues('interfaz',row.config))!==JSON.stringify(appearanceValues('interfaz',command.config)))throw Error('Los colores recibidos no coinciden con el estilo guardado.');
 }
 return saved;
}
