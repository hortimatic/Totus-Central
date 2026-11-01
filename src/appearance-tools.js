// Presets use only existing, server-validated appearance fields.
export const LOGIN_STYLE_PRESETS={
 clean:{loginBackground:'light-clean',loginCardPreset:'light',loginCardOpacity:100,loginTextColor:'#0f172a',loginButtonColor:'#006591',loginButtonMode:'solid',loginCardRadius:16,loginCardShadow:'soft',loginBorderColor:'#dfe6ef',loginBorderWidth:1,loginCardGlow:0,loginButtonGlow:0},
 night:{loginBackground:'dark-gradient',loginCardPreset:'dark',loginCardOpacity:100,loginTextColor:'#f8fafc',loginButtonColor:'#38bdf8',loginButtonMode:'solid',loginCardRadius:20,loginCardShadow:'strong',loginBorderColor:'#334155',loginBorderWidth:1,loginCardGlow:0,loginButtonGlow:0},
 glass:{loginBackground:'tech-soft',loginCardPreset:'glass',loginCardColor:'#ffffff',loginCardOpacity:94,loginTextColor:'#0f172a',loginButtonColor:'#2563eb',loginButtonMode:'gradient',loginCardRadius:24,loginCardShadow:'soft',loginBorderColor:'#ffffff',loginBorderWidth:1,loginCardGlow:0,loginButtonGlow:0}
};
export const settingsSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();

/** Search and folding never remove controls, change values or submit a form. */
export function installAppearanceTools(host,{section,editable,applyPreset,query='',current={}}){
 const form=host.querySelector('form'),groups=[...host.querySelectorAll('[data-appearance-group]')];
 const tools=document.createElement('div');tools.className='appearance-tools';
 tools.innerHTML='<label>Buscar ajustes<input type="search" data-settings-search data-draft-ignore autocomplete="off" placeholder="Color, logotipo, navegación…"></label><div class="inline-actions"><button type="button" class="btn secondary" data-appearance-navigation data-settings-expand>Expandir secciones</button><button type="button" class="btn secondary" data-appearance-navigation data-settings-fold>Contraer secciones</button></div><small data-settings-result role="status" aria-live="polite"></small>';
 form.before(tools);
 const search=tools.querySelector('input'),result=tools.querySelector('[data-settings-result]');let priorOpen=null;
 function filter(){
  const needle=settingsSearchText(search.value);
  if(needle&&!priorOpen)priorOpen=new Map(groups.map(group=>[group,group.open]));
  let visible=0;
  for(const group of groups){
   const match=!needle||settingsSearchText(group.textContent).includes(needle);group.hidden=!match;
   if(match){visible++;if(needle)group.open=true;else if(priorOpen)group.open=priorOpen.get(group);}
   const anchor=host.querySelector('[data-jump="'+group.dataset.appearanceGroup+'"]');if(anchor)anchor.hidden=!match;
  }
  if(!needle)priorOpen=null;
  result.textContent=needle?(visible?visible+' secciones con coincidencias':'No hay ajustes que coincidan. Prueba otro término.'):'Busca una opción o pliega las secciones para trabajar con más espacio.';
 }
 search.value=query;search.oninput=filter;
 tools.querySelector('[data-settings-expand]').onclick=()=>{search.value='';filter();groups.forEach(group=>group.open=true);};
 tools.querySelector('[data-settings-fold]').onclick=()=>{search.value='';filter();groups.forEach(group=>group.open=false);};
 if(section==='login'){
  const presets=document.createElement('div');presets.className='appearance-presets appearance-login-presets';
  presets.innerHTML='<label>Estilo de acceso<select data-login-preset data-draft-ignore><option value="clean">Claro corporativo</option><option value="night">Oscuro</option><option value="glass">Cristal suave</option></select></label><button type="button" class="btn secondary" data-login-style>Previsualizar estilo</button><small>Conserva el nombre, los textos y el logotipo. Solo cambia la vista previa hasta que guardes.</small>';
  const button=presets.querySelector('button'),select=presets.querySelector('select');select.value=current.loginCardPreset==='dark'?'night':current.loginCardPreset==='glass'?'glass':'clean';button.disabled=select.disabled=!editable;
  button.onclick=()=>{if(editable&&LOGIN_STYLE_PRESETS[select.value])applyPreset(LOGIN_STYLE_PRESETS[select.value]);};
  host.querySelector('.appearance-grid>section .section-head').after(presets);
 }
 filter();
}
