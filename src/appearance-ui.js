import {installAppearanceTools} from './appearance-tools.js';
import {APPEARANCE_FIELDS,APPEARANCE_PRESETS,appearanceValues,appearanceVariables,loginVariables} from './appearance-core.js';
import {prepareChatBackground} from './chat-preferences.js';
import {enhancePasswordVisibility} from './login-controls.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=name=>new URL(name,new URL('../',import.meta.url)).href;
const style=(element,variables)=>{for(const [key,value] of Object.entries(variables))element.style.setProperty(key,value);};
export function applyInterfaceAppearance(input){
 const root=document.documentElement,c=appearanceValues('interfaz',input),enabled=!!input&&Object.keys(input).length>0;
 if(enabled){root.dataset.appearanceHover=c.hoverEffect;root.dataset.appearanceFinish=c.buttonFinish;root.dataset.appearance=c.theme;style(root,appearanceVariables(c));}
 else{delete root.dataset.appearanceHover;delete root.dataset.appearanceFinish;delete root.dataset.appearance;for(const key of Object.keys(appearanceVariables({})))root.style.removeProperty(key);}
 const compact=enabled&&c.navigationMode==='compact';root.classList.toggle('navigation-compact',compact);
 const toggle=document.querySelector('.desktop-nav-collapse');if(toggle){toggle.textContent=compact?'›':'‹';toggle.setAttribute('aria-expanded',String(!compact));toggle.setAttribute('aria-label',compact?'Ampliar navegación':'Minimizar navegación');}
 const brand=document.querySelector('#app .sidebar>.brand');if(!brand)return;
 brand.querySelector('b').textContent=enabled?c.brandName:'Totus Central';brand.querySelector('small').textContent=enabled?c.brandSubtitle:'Gestión diaria';
 const mark=brand.querySelector('.brand-mark'),image=mark?.querySelector('img');
 if(image){image.src=enabled&&c.logoMode==='uploaded'&&c.customLogoData?c.customLogoData:enabled&&['hortimatic','newoldsmok'].includes(c.logoMode)?asset('assets/branding/'+c.logoMode+'.png'):asset('favicon.svg');image.style.objectFit='contain';}
}
export function applyLoginAppearance(root,input){
 if(!root)return;
 const enabled=!!input&&Object.keys(input).length>0,c=appearanceValues('login',input);root.classList.toggle('custom-login',enabled);
 style(root,loginVariables(c));root.dataset.loginCard=c.loginCardPreset;root.dataset.loginButton=c.loginButtonMode;root.dataset.loginFrame=c.loginLogoFrame;root.dataset.loginAlign=c.loginAlign;
 const brand=root.querySelector('.brand');if(brand){brand.querySelector('b').textContent=enabled?c.loginBrandName:'Totus Central';brand.querySelector('small').textContent=enabled?c.loginSubtitle:'Gestión diaria';
  const mark=brand.querySelector('.brand-mark'),img=mark?.querySelector('img');if(mark)mark.hidden=enabled&&c.loginLogoMode==='text';if(img)img.src=c.loginLogoMode==='uploaded'&&c.customLogoData?c.customLogoData:asset('favicon.svg');}
 const help=root.querySelector('.login-card>p');if(help)help.textContent=enabled?c.loginHelpText:'Entra con tu correo y contraseña.';
 const recover=root.querySelector('#recoverBtn,[data-login-recovery]');if(recover)recover.textContent=enabled?c.loginRecoveryText:'He olvidado mi contraseña';
}
const previewLogin=()=>'<div class="login-card"><div class="brand"><span class="brand-mark"><img src="'+asset('favicon.svg')+'" alt=""></span><div><b>Totus Central</b><small>Gestión diaria</small></div></div><h2>Acceso</h2><p></p><label>Correo<input disabled placeholder="tu@correo.es"></label><label>Contraseña<input disabled type="password" placeholder="••••••••"></label><button type="button" class="btn primary" disabled>Entrar</button><button type="button" class="btn link" data-login-recovery disabled>He olvidado mi contraseña</button></div>';
export const appearancePage=()=>'<section class="page appearance-page"><div class="card card-pad"><h2>Configuración</h2><p class="muted">Tu Interfaz es personal y se guarda en tu cuenta. Login es la pantalla de acceso compartida. El fondo y los avisos de Chat se ajustan dentro de Chat.</p></div><div id="appearanceRoot"><p role="status">Preparando configuración…</p></div></section>';
export function createAppearanceUI({settings,save,actor,canEdit,confirm}){
 let previewSize='desktop';
 let host=null,owner=null,section='interfaz',values={},baseline='',busy=false,revision=0,epoch=0;
 const active=(stamp=epoch)=>!!host&&owner===actor()&&stamp===epoch;
 const read=()=>{if(!host)return values;const form=host.querySelector('form');return appearanceValues(section,{...values,...Object.fromEntries(new FormData(form))});};
 const dirty=()=>!!host&&JSON.stringify(read())!==baseline;
 function syncControls(){
  if(!host)return;
  const editable=canEdit(section);
  host.querySelectorAll('fieldset').forEach(el=>el.disabled=busy||!editable);
  host.querySelectorAll('button').forEach(el=>{
   const navigation=el.hasAttribute('data-appearance-tab')||el.hasAttribute('data-cancel-preview')||el.hasAttribute('data-preview-size')||el.hasAttribute('data-jump')||el.hasAttribute('data-show-preview')||el.hasAttribute('data-appearance-navigation');
   el.disabled=busy||(!editable&&!navigation)||(el.hasAttribute('data-remove-image')&&!values[el.dataset.removeImage]);
  });
  host.querySelectorAll('[data-preset],[data-login-preset]').forEach(preset=>preset.disabled=busy||!editable);
  host.querySelector('form')?.setAttribute('aria-busy',String(busy));
 }
 function preview(){
  values=read();host.querySelectorAll('output[data-value]').forEach(el=>el.textContent=values[el.dataset.value]);
  const badge=host.querySelector('[data-preview-state]');if(badge){const changed=JSON.stringify(values)!==baseline;badge.textContent=changed?'Cambios sin guardar':section==='interfaz'&&settings(section)?.personal_interface===false?'Diseño base · sin personalizar':'Configuración guardada';badge.classList.toggle('changed',changed);}
  const pane=host.querySelector('[data-appearance-preview]');pane.dataset.previewSize=previewSize;if(section==='login')applyLoginAppearance(pane,values);
  else{style(pane,appearanceVariables(values));pane.dataset.appearance=values.theme;pane.dataset.appearanceHover=values.hoverEffect;pane.dataset.appearanceFinish=values.buttonFinish;pane.querySelector('[data-brand-name]').textContent=values.brandName;pane.querySelector('[data-brand-subtitle]').textContent=values.brandSubtitle;pane.querySelector('[data-brand-logo]').src=values.logoMode==='uploaded'&&values.customLogoData?values.customLogoData:values.logoMode==='tf'||values.logoMode==='uploaded'?asset('favicon.svg'):asset('assets/branding/'+values.logoMode+'.png');}
 }
 function field(key,f){
  const value=values[key],id='appearance-'+key;
  if(f.type==='image')return '<div class="field appearance-image-field"><label for="'+id+'">'+esc(f.label)+'</label><div class="appearance-image-upload">'+(value?'<img src="'+esc(value)+'" alt="Imagen seleccionada"><span class="small muted">Imagen preparada · '+Math.ceil(value.length*.75/1024)+' KB</span>':'<span class="appearance-image-empty" aria-hidden="true">▧</span><span class="small muted">JPG, PNG o WebP · hasta 5 MB. Se reduce antes de guardar.</span>')+'<input id="'+id+'" type="file" data-image="'+key+'" accept="image/jpeg,image/png,image/webp"><button class="btn secondary" type="button" data-remove-image="'+key+'" '+(value?'':'disabled')+'>Quitar imagen</button></div></div>';
  return '<label class="field" for="'+id+'">'+esc(f.label)+(f.type==='range'?' <output data-value="'+key+'">'+value+'</output>':'')+(f.type==='select'?'<select id="'+id+'" name="'+key+'">'+f.options.map(([v,label])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>':'<input id="'+id+'" name="'+key+'" type="'+f.type+'" value="'+esc(value)+'" '+(f.type==='range'?'min="'+f.min+'" max="'+f.max+'" step="1"':f.max?'maxlength="'+f.max+'"':'')+'>')+'</label>';
 }
 function fieldGroups(){
  const interfaceGroups=[
   ['Marca e identidad',['brandName','brandSubtitle','logoMode','customLogoData','logoHeight','theme']],
   ['Colores',['primary','secondary','accent','bg','surface','card','text','muted']],
   ['Fondo de la herramienta',['backgroundMode','customBackgroundData','backgroundDim']],
   ['Barra de navegación y cabecera',['navigationMode','startModule','sidebarWidth','topbarHeight']],
   ['Bordes y efectos',['borderColor','borderStrength','borderWidth','glowColor','cardGlow','buttonGlow','buttonFinish','hoverEffect']]
  ];
  interfaceGroups.push(['Tamaños y distribución',Object.keys(APPEARANCE_FIELDS.interfaz).filter(key=>!interfaceGroups.some(([,keys])=>keys.includes(key)))]);
  const groups=section==='interfaz'?interfaceGroups:[
   ['Marca e identidad',['loginBrandName','loginSubtitle','loginFont','loginLogoMode','loginLogoFrame','loginLogoWidth','loginLogoHeight','loginAlign','customLogoData']],
   ['Caja de acceso',['loginCardPreset','loginCardColor','loginCardOpacity','loginCardRadius','loginCardShadow','loginCardWidth','loginCardPadding']],
   ['Botón, bordes y brillos',['loginButtonMode','loginButtonColor','loginTextColor','loginBorderColor','loginBorderWidth','loginGlowColor','loginCardGlow','loginButtonGlow']],
   ['Fondo y ayuda',['loginBackground','customBackgroundData','loginBackgroundDim','loginHelpText','loginRecoveryText']]
  ];
  return groups.map(([label,keys],index)=>'<details class="appearance-section" data-appearance-group="'+index+'" open><summary><span class="appearance-section-number">'+(index+1)+'</span>'+label+'</summary><fieldset class="form-grid" '+(canEdit(section)?'':'disabled')+'><legend class="sr-only">'+label+'</legend>'+keys.map(key=>field(key,APPEARANCE_FIELDS[section][key])).join('')+'</fieldset></details>').join('');
 }
 function paint(){
  const toolsQuery=host.dataset.appearanceSection===section?host.querySelector('[data-settings-search]')?.value||'':'';
  const opened=host.dataset.appearanceSection===section?new Map([...host.querySelectorAll('[data-appearance-group]')].map(el=>[el.dataset.appearanceGroup,el.open])):null;
  host.dataset.appearanceSection=section;
  const interfacePreview='<div class="appearance-demo"><aside><img data-brand-logo alt="" width="38" height="38"><b data-brand-name></b><small data-brand-subtitle></small><span>Inicio</span><span>Cajas</span><span>Gastos</span><span>Chat</span></aside><div><header>Gestión diaria</header><section><div class="card card-pad"><h3>Vista previa</h3><p>Comprueba colores, espacios y botones antes de guardar.</p><button type="button" class="btn primary">Principal</button> <button type="button" class="btn secondary">Secundario</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Concepto</th><th>Estado</th></tr></thead><tbody><tr><td>Documento de ejemplo</td><td>Revisado</td></tr><tr><td>Otro registro</td><td>Pendiente</td></tr></tbody></table></div></section></div></div>';
  host.innerHTML='<div class="tabs" role="tablist" aria-label="Configuración visual">'+[['interfaz','Mi interfaz'],['login','Login compartido']].map(([key,label])=>'<button type="button" class="tab '+(key===section?'active':'')+'" data-appearance-tab="'+key+'" role="tab" aria-selected="'+(key===section)+'">'+label+'</button>').join('')+'</div><form class="appearance-grid"><section class="card card-pad"><div class="section-head"><div><h3>'+ (section==='interfaz'?'Tu interfaz · solo tu cuenta':'Pantalla de acceso compartida')+'</h3><p>'+ (section==='login'?'Visible antes de iniciar sesión. Usa únicamente imágenes y textos de marca públicos. No cambia las contraseñas ni los permisos.':'La vista previa no cambia la herramienta. Pulsa Aplicar y guardar para conservar tu diseño al recargar y en otros ordenadores. No modifica el de los demás.')+'</p></div></div>'+(section==='interfaz'?'<div class="appearance-presets"><label>Estilo inicial<select data-preset><option value="stitch">Stitch · diseño aprobado</option><option value="totus">Totus Central</option><option value="hortimatic">Hortimatic</option><option value="newoldsmok">NewOldSmok</option></select></label><button type="button" class="btn secondary" data-apply-preset>Aplicar estilo a la vista previa</button></div>':'')+fieldGroups()+'<div class="form-actions"><button type="button" class="btn secondary" data-defaults '+(canEdit(section)?'':'disabled')+'>Restaurar valores iniciales</button><button type="button" class="btn secondary" data-cancel-preview>Descartar cambios</button><button type="submit" class="btn primary" '+(canEdit(section)?'':'disabled')+'>Aplicar y guardar '+(section==='interfaz'?'mi interfaz':'Login')+'</button></div><p role="status" data-appearance-status></p></section><aside class="card card-pad appearance-preview-card"><div class="appearance-preview-head"><h3>Vista previa</h3><span class="appearance-save-state" data-preview-state></span></div><div class="appearance-preview-tools" role="group" aria-label="Tamaño de vista previa"><button type="button" class="btn secondary" data-preview-size="desktop" aria-pressed="'+(previewSize==='desktop')+'">▣ Escritorio</button><button type="button" class="btn secondary" data-preview-size="mobile" aria-pressed="'+(previewSize==='mobile')+'">▯ Móvil</button></div><div class="appearance-preview '+(section==='login'?'appearance-login-preview':'')+'" data-appearance-preview>'+ (section==='login'?previewLogin():interfacePreview)+'</div><p class="small muted">Se adapta también a móvil. Los datos contables y las funciones de los módulos se conservan.</p></aside></form>';
  enhancePasswordVisibility(host.querySelector('[data-appearance-preview]'));
  if(section==='interfaz')host.querySelector('[data-preset]').value=values.primary==='#006591'?'stitch':['hortimatic','newoldsmok'].includes(values.logoMode)?values.logoMode:'totus';
  host.querySelectorAll('[data-preview-size]').forEach(button=>button.onclick=()=>{previewSize=button.dataset.previewSize;host.querySelectorAll('[data-preview-size]').forEach(el=>el.setAttribute('aria-pressed',el===button));preview();});
  host.querySelector('form').oninput=preview;host.querySelector('form').onchange=event=>{if(section==='interfaz'&&event.target.name==='theme'){values=read();const palette=values.theme==='dark'?APPEARANCE_PRESETS.newoldsmok:APPEARANCE_PRESETS.totus;for(const key of ['bg','surface','card','text','muted'])values[key]=palette[key];paint();}else if(section==='login'&&event.target.name==='loginCardPreset'){values=read();if(values.loginCardPreset==='dark'){values.loginTextColor='#f8fafc';values.loginBorderColor='#334155';}else if(values.loginCardPreset==='light'||values.loginCardPreset==='solid'||values.loginCardPreset==='glass'){values.loginTextColor='#0f172a';values.loginBorderColor='#ffffff';}paint();}else preview();};
  host.querySelectorAll('[data-appearance-tab]').forEach(button=>button.onclick=async()=>{const stamp=epoch;if(busy)return;if(dirty()&&!await confirm('¿Descartar los cambios de apariencia sin guardar?'))return;if(!active(stamp))return;section=button.dataset.appearanceTab;load();});
  host.querySelector('[data-defaults]').onclick=()=>{if(!canEdit(section)||busy)return;values=appearanceValues(section);paint();};
  host.querySelector('[data-cancel-preview]').onclick=()=>{if(!busy)load();};
  const preset=host.querySelector('[data-apply-preset]');if(preset){preset.disabled=!canEdit(section);preset.onclick=()=>{if(!canEdit(section)||busy)return;values={...read(),...APPEARANCE_PRESETS[host.querySelector('[data-preset]').value]};paint();};}
  host.querySelectorAll('[data-image]').forEach(input=>input.onchange=async()=>{const stamp=epoch,status=host.querySelector('[data-appearance-status]');if(!canEdit(section)||busy||!input.files[0])return;values=read();busy=true;syncControls();try{const image=await prepareChatBackground(input.files[0],{preserveAlpha:input.dataset.image==='customLogoData'});if(!active(stamp))return;values=read();values[input.dataset.image]=image;if(section==='interfaz')values[input.dataset.image==='customLogoData'?'logoMode':'backgroundMode']=input.dataset.image==='customLogoData'?'uploaded':'image';else values[input.dataset.image==='customLogoData'?'loginLogoMode':'loginBackground']='uploaded';paint();}catch(error){if(active(stamp))status.textContent=error.message;}finally{if(active(stamp)){busy=false;syncControls();}}});
  host.querySelectorAll('[data-remove-image]').forEach(button=>button.onclick=()=>{if(!canEdit(section)||busy)return;values=read();values[button.dataset.removeImage]='';if(section==='interfaz')values[button.dataset.removeImage==='customLogoData'?'logoMode':'backgroundMode']=button.dataset.removeImage==='customLogoData'?'tf':'color';else values[button.dataset.removeImage==='customLogoData'?'loginLogoMode':'loginBackground']=button.dataset.removeImage==='customLogoData'?'mark':'light-clean';paint();});
  host.querySelector('form').onsubmit=async event=>{event.preventDefault();if(busy||!canEdit(section))return;const stamp=epoch,payload=read(),status=host.querySelector('[data-appearance-status]');if(section==='interfaz'&&((payload.logoMode==='uploaded'&&!payload.customLogoData)||(payload.backgroundMode==='image'&&!payload.customBackgroundData))){status.textContent='Selecciona la imagen para el fondo o logotipo elegido.';return;}if(section==='login'&&((payload.loginLogoMode==='uploaded'&&!payload.customLogoData)||(payload.loginBackground==='uploaded'&&!payload.customBackgroundData))){status.textContent='Selecciona la imagen para el fondo o logotipo elegido.';return;}busy=true;syncControls();try{await save(section,payload,revision);if(!active(stamp))return;load();host.querySelector('[data-appearance-status]').textContent='Configuración guardada y aplicada.';}catch(error){if(active(stamp))status.textContent=error.message;}finally{if(active(stamp)){busy=false;syncControls();}}};
  const controls=host.querySelector('.appearance-grid>section'),groups=[...host.querySelectorAll('[data-appearance-group]')];
  const jump=document.createElement('nav');jump.className='appearance-anchors';jump.setAttribute('aria-label','Ir a un bloque de configuración');jump.innerHTML=groups.map((group,index)=>'<button type="button" data-jump="'+index+'">'+esc(group.querySelector('summary').textContent.replace(/^\d+\s*/,''))+'</button>').join('')+'<button type="button" data-show-preview>Ver resultado</button>';
  controls.querySelector('.section-head').after(jump);
  jump.querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>{const group=groups[Number(button.dataset.jump)];group.open=true;group.scrollIntoView({block:'start'});group.querySelector('summary').focus({preventScroll:true});});
  jump.querySelector('[data-show-preview]').onclick=()=>host.querySelector('.appearance-preview-card').scrollIntoView({block:'start'});
  if(section==='interfaz'){
   const base=document.createElement('button');base.type='button';base.className='btn secondary';base.textContent='Usar diseño base';base.dataset.useBase='';base.disabled=!canEdit(section);base.onclick=()=>{if(busy||!canEdit(section))return;values=appearanceValues('interfaz',settings('base')?.appearance_config);paint();};host.querySelector('.appearance-presets').append(base);
  }else if(!canEdit(section)){
   const note=document.createElement('p');note.className='note';note.textContent='Puedes consultar el Login. Para modificar esta pantalla compartida necesitas el permiso Editar en Configuración.';controls.querySelector('.section-head').after(note);
  }
  if(opened)host.querySelectorAll('[data-appearance-group]').forEach(el=>{if(opened.has(el.dataset.appearanceGroup))el.open=opened.get(el.dataset.appearanceGroup);});
  installAppearanceTools(host,{section,editable:canEdit(section),query:toolsQuery,current:values,applyPreset:preset=>{if(busy||!canEdit(section))return;values=appearanceValues(section,{...read(),...preset});paint();}});
  preview();syncControls();
 }
 function load(){const row=settings(section)||{};revision=Number(row.appearance_revision||0);values=appearanceValues(section,row[section==='interfaz'?'appearance_config':'login_appearance']);baseline=JSON.stringify(values);paint();}
 return {mount(element){host=element;owner=actor();epoch++;busy=false;host.dataset.appearanceSection='';load();},showSection(next){if(!['interfaz','login'].includes(next)||!host||busy)return;section=next;load();},hasDraft:dirty,dispose(){epoch++;host=null;owner=null;busy=false;}};
}
