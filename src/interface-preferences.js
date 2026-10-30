// Appearance belongs to the signed-in profile. The legacy organization style is
// an initial fallback only; saving a personal style never changes other users.
export function personalInterfaceSettings(state){
 const shared=state.data.settings||{},profile=state.data.profiles.find(row=>row.id===state.user?.id);
 const stored=profile?.ui_preferences?.interface;
 return {...shared,personal_interface:!!stored&&Object.hasOwn(stored,'config'),appearance_config:stored&&Object.hasOwn(stored,'config')?stored.config:shared.appearance_config,
  appearance_revision:Number(stored?.revision||0)};
}
export function acceptPersonalInterface(state,saved,owner){
 if(!owner||state.user?.id!==owner)throw Error('La sesión ha cambiado.');
 const profile=state.data.profiles.find(row=>row.id===owner);
 if(!profile)throw Error('No se encontró tu perfil. Actualiza la página.');
 profile.ui_preferences={...profile.ui_preferences,interface:{config:saved.config,revision:saved.revision}};
}
