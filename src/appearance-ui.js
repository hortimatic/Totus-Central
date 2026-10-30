import {APPEARANCE_FIELDS,APPEARANCE_PRESETS,appearanceValues,appearanceVariables,loginVariables} from './appearance-core.js';
import {prepareChatBackground} from './chat-preferences.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=(element,variables)=>{for(const [key,value] of Object.entries(variables))element.style.setProperty(key,value);};
export function applyInterfaceAppearance(input){
 const root=document.documentElement,c=appearanceValues('interfaz',input),enabled=!!input&&Object.keys(input).length>0;
 if(enabled){root.dataset.appearance=c.theme;style(root,appearanceVariables(c));}
 else{delete root.dataset.appearance;for(const key of Object.keys(appearanceVariables({})))root.style.removeProperty(key);}
 const brand=document.querySelector('#app .sidebar>.brand');if(!brand)return;
 brand.querySelector('b').textContent=enabled?c.brandName:'Totus Central';brand.querySelector('small').textContent=enabled?c.brandSubtitle:'Gestión diaria';
 const mark=brand.querySelector('.brand-mark'),image=mark?.querySelector('img');
 if(image){image.src=enabled&&c.logoMode!=='tf'?'assets/branding/'+c.logoMode+'.png':'favicon.svg';image.style.objectFit='contain';}
}
export function applyLoginAppearance(root,input){
 if(!root)return;
 const enabled=!!input&&Object.keys(input).length>0,c=appearanceValues('login',input);root.classList.toggle('custom-login',enabled);
 style(root,loginVariables(c));root.dataset.loginCard=c.loginCardPreset;root.dataset.loginButton=c.loginButtonMode;root.dataset.loginFrame=c.loginLogoFrame;root.dataset.loginAlign=c.loginAlign;
 const brand=root.querySelector('.brand');if(brand){brand.querySelector('b').textContent=enabled?c.loginBrandName:'Totus Central';brand.querySelector('small').textContent=enabled?c.loginSubtitle:'Gestión diaria';
  const mark=brand.querySelector('.brand-mark'),img=mark?.querySelector('img');if(mark)mark.hidden=enabled&&c.loginLogoMode==='text';if(img)img.src=c.loginLogoMode==='uploaded'&&c.customLogoData?c.customLogoData:'favicon.svg';}
 const help=root.querySelector('.login-card>p');if(help)help.textContent=enabled?c.loginHelpText:'Entra con tu correo y contraseña.';
 const recover=root.querySelector('#recoverBtn,[data-login-recovery]');if(recover)recover.textContent=enabled?c.loginRecoveryText:'He olvidado mi contraseña';
}
const previewLogin=()=>'<div class="login-card"><div class="brand"><span class="brand-mark"><img src="favicon.svg" alt=""></span><div><b>Totus Central</b><small>Gestión diaria</small></div></div><h2>Acceso</h2><p></p><label>Correo<input disabled placeholder="tu@correo.es"></label><label>Contraseña<input disabled type="password" placeholder="••••••••"></label><button type="button" class="btn primary" disabled>Entrar</button><button type="button" class="btn link" data-login-recovery disabled>He olvidado mi contraseña</button></div>';
export const appearancePage=()=>'<section class="page appearance-page"><div class="card card-pad"><h2>Configuración</h2><p class="muted">Apariencia de Totus Central y de su pantalla de acceso. El fondo y los avisos personales se ajustan dentro de Chat.</p></div><div id="appearanceRoot"><p role="status">Preparando configuración…</p></div></section>';
export function createAppearanceUI({settings,save,actor,canEdit,confirm}){
 let host=null,owner=null,section='interfaz',values={},baseline='',busy=false,revision=0,epoch=0;
 const active=(stamp=epoch)=>!!host&&owner===actor()&&stamp===epoch;
 const read=()=>{if(!host)return values;const form=host.querySelector('form');return appearanceValues(section,{...values,...Object.fromEntries(new FormData(form))});};
 const dirty=()=>!!host&&JSON.stringify(read())!==baseline;
 function preview(){
  values=read();host.querySelectorAll('output[data-value]').forEach(el=>el.textContent=values[el.dataset.value]);
  const pane=host.querySelector('[data-appearance-preview]');if(section==='login')applyLoginAppearance(pane,values);
  else{style(pane,appearanceVariables(values));pane.dataset.appearance=values.theme;pane.querySelector('[data-brand-name]').textContent=values.brandName;pane.querySelector('[data-brand-subtitle]').textContent=values.brandSubtitle;pane.querySelector('[data-brand-logo]').src=values.logoMode==='tf'?'favicon.svg':'assets/branding/'+values.logoMode+'.png';}
 }
 function field(key,f){
  const value=values[key],id='appearance-'+key;
  if(f.type==='image')return '<div class="field"><label for="'+id+'">'+esc(f.label)+' · JPG, PNG o WebP · hasta 5 MB</label><input id="'+id+'" type="file" data-image="'+key+'" accept="image/jpeg,image/png,image/webp"><button class="btn secondary" type="button" data-remove-image="'+key+'">Quitar imagen</button></div>';
  return '<label class="field" for="'+id+'">'+esc(f.label)+(f.type==='range'?' <output data-value="'+key+'">'+value+'</output>':'')+(f.type==='select'?'<select id="'+id+'" name="'+key+'">'+f.options.map(([v,label])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>':'<input id="'+id+'" name="'+key+'" type="'+f.type+'" value="'+esc(value)+'" '+(f.type==='range'?'min="'+f.min+'" max="'+f.max+'" step="1"':f.max?'maxlength="'+f.max+'"':'')+'>')+'</label>';
 }
 function fieldGroups(){
  const groups=section==='interfaz'?[
   ['Marca',['brandName','brandSubtitle','logoMode','theme']],
   ['Colores',['primary','secondary','accent','bg','surface','card','text','muted']],
   ['Estructura visual',Object.keys(APPEARANCE_FIELDS.interfaz).filter(key=>!['brandName','brandSubtitle','logoMode','theme','primary','secondary','accent','bg','surface','card','text','muted'].includes(key))]
  ]:[
   ['Marca',['loginBrandName','loginSubtitle','loginFont','loginLogoMode','loginLogoFrame','loginLogoWidth','loginLogoHeight','loginAlign','customLogoData']],
   ['Caja de acceso',['loginCardPreset','loginCardColor','loginCardOpacity','loginCardRadius','loginCardShadow','loginButtonMode','loginButtonColor','loginTextColor','loginBorderColor','loginCardWidth','loginCardPadding']],
   ['Fondo y ayuda',['loginBackground','customBackgroundData','loginHelpText','loginRecoveryText']]
  ];
  return groups.map(([label,keys])=>'<fieldset class="form-grid" '+(canEdit()?'':'disabled')+'><legend>'+label+'</legend>'+keys.map(key=>field(key,APPEARANCE_FIELDS[section][key])).join('')+'</fieldset>').join('');
 }
 function paint(){
  const interfacePreview='<div class="appearance-demo"><aside><img data-brand-logo alt="" width="38" height="38"><b data-brand-name></b><small data-brand-subtitle></small><span>Inicio</span><span>Cajas</span><span>Gastos</span><span>Chat</span></aside><div><header>Gestión diaria</header><section><div class="card card-pad"><h3>Vista previa</h3><p>Comprueba colores, espacios y botones antes de guardar.</p><button type="button" class="btn primary">Principal</button> <button type="button" class="btn secondary">Secundario</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Concepto</th><th>Estado</th></tr></thead><tbody><tr><td>Documento de ejemplo</td><td>Revisado</td></tr><tr><td>Otro registro</td><td>Pendiente</td></tr></tbody></table></div></section></div></div>';
  host.innerHTML='<div class="tabs" role="tablist" aria-label="Configuración visual">'+[['interfaz','Interfaz'],['login','Login · acceso']].map(([key,label])=>'<button type="button" class="tab '+(key===section?'active':'')+'" data-appearance-tab="'+key+'" role="tab" aria-selected="'+(key===section)+'">'+label+'</button>').join('')+'</div><form class="appearance-grid"><section class="card card-pad"><div class="section-head"><div><h3>'+ (section==='interfaz'?'Interfaz de la herramienta':'Pantalla de acceso')+'</h3><p>'+ (section==='login'?'Visible antes de iniciar sesión. Usa únicamente imágenes y textos de marca públicos. No cambia las contraseñas ni los permisos.':'Los cambios se aplican a la organización cuando pulses Guardar.')+'</p></div></div>'+(section==='interfaz'?'<div class="appearance-presets"><label>Estilo inicial<select data-preset><option value="totus">Totus Central</option><option value="hortimatic">Hortimatic</option><option value="newoldsmok">NewOldSmok</option></select></label><button type="button" class="btn secondary" data-apply-preset>Aplicar estilo a la vista previa</button></div>':'')+fieldGroups()+'<div class="form-actions"><button type="button" class="btn secondary" data-defaults '+(canEdit()?'':'disabled')+'>Restaurar valores iniciales</button><button type="button" class="btn secondary" data-cancel-preview>Descartar cambios</button><button type="submit" class="btn primary" '+(canEdit()?'':'disabled')+'>Guardar '+(section==='interfaz'?'interfaz':'pantalla de acceso')+'</button></div><p role="status" data-appearance-status></p></section><aside class="card card-pad appearance-preview-card"><h3>Vista previa · sin guardar</h3><div class="appearance-preview '+(section==='login'?'appearance-login-preview':'')+'" data-appearance-preview>'+ (section==='login'?previewLogin():interfacePreview)+'</div><p class="small muted">Se adapta también a móvil. Los datos contables y las funciones de los módulos se conservan.</p></aside></form>';
  if(section==='interfaz')host.querySelector('[data-preset]').value=values.logoMode==='tf'?'totus':values.logoMode;
  host.querySelector('form').oninput=preview;host.querySelector('form').onchange=event=>{if(section==='interfaz'&&event.target.name==='theme'){values=read();const palette=values.theme==='dark'?APPEARANCE_PRESETS.newoldsmok:APPEARANCE_PRESETS.totus;for(const key of ['bg','surface','card','text','muted'])values[key]=palette[key];paint();}else preview();};
  host.querySelectorAll('[data-appearance-tab]').forEach(button=>button.onclick=async()=>{const stamp=epoch;if(busy)return;if(dirty()&&!await confirm('¿Descartar los cambios de apariencia sin guardar?'))return;if(!active(stamp))return;section=button.dataset.appearanceTab;load();});
  host.querySelector('[data-defaults]').onclick=()=>{if(!canEdit()||busy)return;values=appearanceValues(section);paint();};
  host.querySelector('[data-cancel-preview]').onclick=()=>{if(!busy)load();};
  const preset=host.querySelector('[data-apply-preset]');if(preset){preset.disabled=!canEdit();preset.onclick=()=>{if(!canEdit()||busy)return;values={...read(),...APPEARANCE_PRESETS[host.querySelector('[data-preset]').value]};paint();};}
  host.querySelectorAll('[data-image]').forEach(input=>input.onchange=async()=>{const stamp=epoch,form=host.querySelector('form'),status=host.querySelector('[data-appearance-status]');if(!canEdit()||busy||!input.files[0])return;busy=true;form.querySelectorAll('button').forEach(el=>el.disabled=true);try{const image=await prepareChatBackground(input.files[0]);if(!active(stamp))return;values=read();values[input.dataset.image]=image;values[input.dataset.image==='customLogoData'?'loginLogoMode':'loginBackground']='uploaded';paint();}catch(error){if(active(stamp))status.textContent=error.message;}finally{busy=false;if(active(stamp))host.querySelectorAll('button').forEach(el=>el.disabled=!canEdit()&&!el.hasAttribute('data-appearance-tab')&&!el.hasAttribute('data-cancel-preview'));}});
  host.querySelectorAll('[data-remove-image]').forEach(button=>button.onclick=()=>{if(!canEdit()||busy)return;values=read();values[button.dataset.removeImage]='';values[button.dataset.removeImage==='customLogoData'?'loginLogoMode':'loginBackground']=button.dataset.removeImage==='customLogoData'?'mark':'light-clean';paint();});
  host.querySelector('form').onsubmit=async event=>{event.preventDefault();if(busy||!canEdit())return;const stamp=epoch,payload=read(),status=host.querySelector('[data-appearance-status]');if(section==='login'&&((payload.loginLogoMode==='uploaded'&&!payload.customLogoData)||(payload.loginBackground==='uploaded'&&!payload.customBackgroundData))){status.textContent='Selecciona la imagen para el fondo o logotipo elegido.';return;}busy=true;host.querySelectorAll('button').forEach(el=>el.disabled=true);try{await save(section,payload,revision);if(!active(stamp))return;load();host.querySelector('[data-appearance-status]').textContent='Configuración guardada y aplicada.';}catch(error){if(active(stamp))status.textContent=error.message;}finally{busy=false;if(active(stamp))host.querySelectorAll('button').forEach(el=>el.disabled=!canEdit()&&!el.hasAttribute('data-appearance-tab')&&!el.hasAttribute('data-cancel-preview'));}};
  preview();
 }
 function load(){const row=settings()||{};revision=Number(row.appearance_revision||0);values=appearanceValues(section,row[section==='interfaz'?'appearance_config':'login_appearance']);baseline=JSON.stringify(values);paint();}
 return {mount(element){host=element;owner=actor();epoch++;load();},hasDraft:dirty,dispose(){epoch++;host=null;owner=null;busy=false;}};
}
