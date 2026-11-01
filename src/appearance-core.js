// Visual preferences only. Never use these values to authorize a user or calculate tax.
const text=(label,value,max=90)=>({label,value,type:'text',max});
const color=(label,value)=>({label,value,type:'color'});
const range=(label,value,min,max)=>({label,value,type:'range',min,max});
const choice=(label,value,options)=>({label,value,type:'select',options:options.split('|').map(item=>item.split(':'))});
const image=label=>({label,value:'',type:'image',max:350000});
export const APPEARANCE_FIELDS={
 interfaz:{
  brandName:text('Nombre de la herramienta','Totus Central',32),brandSubtitle:text('Subtítulo','Gestión diaria'),
  logoMode:choice('Logotipo','tf','tf:Totus Central|hortimatic:Hortimatic|newoldsmok:NewOldSmok|uploaded:Mi logotipo'),
  customLogoData:image('Subir logotipo de la herramienta'),logoHeight:range('Tamaño del logotipo · px',38,28,64),
  backgroundMode:choice('Fondo general','color','color:Color|image:Mi imagen'),customBackgroundData:image('Subir fondo de la herramienta'),backgroundDim:range('Capa de color sobre el fondo · %',20,0,90),
  theme:choice('Tema','light','light:Claro|dark:Oscuro'),
  primary:color('Color principal','#2563eb'),secondary:color('Color secundario','#d6a447'),accent:color('Color de acento','#0ea5e9'),
  bg:color('Fondo general','#f5f7fb'),surface:color('Superficies','#ffffff'),card:color('Tarjetas','#ffffff'),text:color('Texto','#0f172a'),muted:color('Texto secundario','#64748b'),
  density:choice('Densidad','comfortable','compact:Compacta|comfortable:Cómoda|wide:Amplia'),
  shadow:choice('Sombras','soft','none:Sin sombra|soft:Suaves|strong:Intensas'),
  navigationMode:choice('Menú al iniciar','expanded','expanded:Expandido|compact:Solo iconos'),
  startModule:choice('Módulo al iniciar','inicio','inicio:Inicio|pricing:Pricing|cajas:Cajas|gastos:Gastos|facturacion:Facturación|cotejos:Recepciones|tareas:Tareas|equipo:Chat|documentos:Documentos|fiscalidad:Fiscalidad|informes:Informes|administracion:Administración|configuracion:Configuración'),
  sidebarWidth:range('Anchura del menú · px',282,240,330),topbarHeight:range('Altura de cabecera · px',68,56,88),fontSize:range('Tamaño del texto · px',14,13,16),
  pagePad:range('Margen del contenido · px',22,12,36),gap:range('Separación de bloques · px',16,8,28),radius:range('Redondeado de tarjetas · px',18,8,28),
  buttonRadius:range('Redondeado de botones · px',12,6,24),cardPadding:range('Espacio interior de tarjetas · px',18,12,24),tableRowHeight:range('Altura mínima de filas · px',42,34,52),borderStrength:range('Intensidad de bordes · %',14,6,24),
  borderColor:color('Color de bordes','#dfe4ec'),borderWidth:range('Grosor de bordes · px',1,0,3),glowColor:color('Color del brillo','#2563eb'),cardGlow:range('Brillo de tarjetas · px',0,0,24),buttonGlow:range('Brillo de botones · px',0,0,24),
  hoverEffect:choice('Efecto al pasar el ratón','none','none:Sin efecto|lift:Elevación suave|glow:Brillo'),buttonFinish:choice('Acabado de botones','flat','flat:Liso|gradient:Degradado|gloss:Reflejo suave'),
  buttonStyle:choice('Forma de botones','rounded','rounded:Redondeados|soft:Suaves')
 },
 login:{
  loginBrandName:text('Nombre al entrar','Totus Central',36),loginSubtitle:text('Subtítulo de acceso','Gestión diaria',86),
  loginFont:choice('Tipografía','system','system:Sistema|rounded:Redondeada|serif:Serif|mono:Monoespaciada'),
  loginLogoMode:choice('Tipo de logotipo','mark','mark:Logotipo de Totus|text:Solo texto|uploaded:Mi imagen'),
  loginLogoFrame:choice('Marco del logotipo','none','none:Sin marco|soft:Suave'),loginLogoWidth:range('Anchura del logotipo · %',100,48,100),loginLogoHeight:range('Altura del logotipo · px',78,42,110),
  loginAlign:choice('Alineación','center','left:Izquierda|center:Centrada'),customLogoData:image('Subir logotipo'),
  loginCardPreset:choice('Estilo de caja','glass','solid:Sólida|transparent:Transparente|glass:Cristal|dark:Oscura|light:Clara'),
  loginCardColor:color('Color de caja','#ffffff'),loginCardOpacity:range('Opacidad de caja · %',94,45,100),loginCardRadius:range('Redondeado de caja · px',24,10,34),
  loginCardShadow:choice('Sombra de caja','strong','none:Sin sombra|soft:Suave|strong:Intensa'),
  loginButtonMode:choice('Estilo del botón','gradient','gradient:Degradado|solid:Sólido|outline:Contorno'),loginButtonColor:color('Color del botón','#2563eb'),loginTextColor:color('Color del texto','#0f172a'),loginBorderColor:color('Color del borde','#ffffff'),
  loginCardWidth:range('Anchura de caja · px',430,360,520),loginCardPadding:range('Espacio interior · px',26,18,36),
  loginBackground:choice('Fondo de acceso','dark-gradient','dark-gradient:Degradado oscuro|light-clean:Claro limpio|totus-corporate:Corporativo|tech-soft:Tecnológico suave|gold-night:Noche dorada|uploaded:Mi imagen'),
  loginBorderWidth:range('Grosor del borde · px',1,0,3),loginGlowColor:color('Color del brillo','#2563eb'),loginCardGlow:range('Brillo de la caja · px',0,0,24),loginButtonGlow:range('Brillo del botón · px',0,0,24),loginBackgroundDim:range('Oscurecer fondo · %',0,0,80),
  customBackgroundData:image('Subir fondo de acceso'),loginHelpText:text('Ayuda de acceso','Entra con tu correo y contraseña.',180),loginRecoveryText:text('Texto de recuperación','He olvidado mi contraseña',80)
 }
};
export function appearanceValues(section,input={}){
 const schema=APPEARANCE_FIELDS[section];if(!schema)throw Error('Sección de apariencia no válida.');
 return Object.fromEntries(Object.entries(schema).map(([key,f])=>{
  let value=input?.[key]??f.value;
  if(f.type==='range')value=Number.isFinite(Number(value))?Math.max(f.min,Math.min(f.max,Number(value))):f.value;
  else if(f.type==='select')value=f.options.some(([v])=>v===value)?value:f.value;
  else if(f.type==='color')value=/^#[0-9a-f]{6}$/i.test(value)?value:f.value;
  else if(f.type==='image')value=typeof value==='string'&&value.length<=f.max&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)?value:'';
  else value=typeof value==='string'?value.trim().slice(0,f.max):f.value;
  return [key,value];
 }));
}
export const APPEARANCE_PRESETS={
 stitch:{primary:'#006591',secondary:'#004e70',accent:'#00aac6',bg:'#f8f9ff',surface:'#ffffff',card:'#ffffff',text:'#0b1c30',muted:'#545d70',theme:'light',borderColor:'#dfe6ef',borderWidth:1,borderStrength:20,cardGlow:0,buttonGlow:0,hoverEffect:'none',buttonFinish:'flat',shadow:'none',radius:8,buttonRadius:5,sidebarWidth:240,topbarHeight:56,fontSize:13,pagePad:24,gap:18,cardPadding:18,tableRowHeight:42,density:'compact',backgroundMode:'color',customBackgroundData:''},
 totus:{primary:'#2563eb',secondary:'#d6a447',accent:'#0ea5e9',bg:'#f5f7fb',surface:'#ffffff',card:'#ffffff',text:'#0f172a',muted:'#64748b',theme:'light',logoMode:'tf',brandName:'Totus Central',brandSubtitle:'Gestión diaria'},
 hortimatic:{primary:'#111827',secondary:'#d6a447',accent:'#f2c56b',bg:'#f5f1e8',surface:'#fffaf0',card:'#ffffff',text:'#111827',muted:'#6b5b3e',theme:'light',logoMode:'hortimatic',brandName:'Totus Central',brandSubtitle:'Hortimatic · Gestión diaria'},
 newoldsmok:{primary:'#0493ff',secondary:'#101827',accent:'#14f1ff',bg:'#061020',surface:'#0b1729',card:'#0f1d33',text:'#e8f5ff',muted:'#9bb6cf',theme:'dark',logoMode:'newoldsmok',brandName:'Totus Central',brandSubtitle:'NewOldSmok · Gestión diaria'}
};
export function contrastText(color){
 const rgb=color.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4),luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return (luminance+.05)/.05>=1.05/(luminance+.05)?'#000000':'#ffffff';
}
export function appearanceVariables(input){
 const c=appearanceValues('interfaz',input),shadow={none:'none',soft:'0 8px 30px #0f172a14',strong:'0 14px 35px #0f172a38'};
 return {'--bg':c.bg,'--panel':c.card,'--ink':c.text,'--muted':c.muted,'--accent':c.primary,'--accent2':c.secondary,'--appearance-accent':c.accent,'--appearance-surface':c.surface,'--line':c.borderColor+Math.round(c.borderStrength/24*255).toString(16).padStart(2,'0'),'--shadow':[shadow[c.shadow]==='none'?'':shadow[c.shadow],c.cardGlow?'0 0 '+c.cardGlow+'px '+c.glowColor+'70':''].filter(Boolean).join(',')||'none','--r':c.radius+'px','--sidebar':c.sidebarWidth+'px','--appearance-header':c.topbarHeight+'px','--appearance-font':c.fontSize+'px','--appearance-pad':c.pagePad+'px','--appearance-gap':c.gap+'px','--appearance-button-radius':(c.buttonStyle==='soft'?Math.min(10,c.buttonRadius):c.buttonRadius)+'px','--appearance-card-pad':c.cardPadding+'px','--appearance-row-height':c.tableRowHeight+'px','--appearance-border-width':c.borderWidth+'px','--appearance-glow':c.glowColor+'80','--appearance-button-glow':c.buttonGlow+'px','--appearance-button-ink':contrastText(c.primary),'--appearance-hover-ink':contrastText(c.secondary),'--appearance-logo-height':c.logoHeight+'px','--appearance-bg-image':c.backgroundMode==='image'&&c.customBackgroundData?'linear-gradient('+c.bg+Math.round(c.backgroundDim*2.55).toString(16).padStart(2,'0')+','+c.bg+Math.round(c.backgroundDim*2.55).toString(16).padStart(2,'0')+'),url("'+c.customBackgroundData+'")':'none','--appearance-density':({compact:'.8',comfortable:'1',wide:'1.2'})[c.density]};
}
export const LOGIN_BACKGROUNDS={
 'dark-gradient':'radial-gradient(at 15% 10%,#1959ad,transparent 55%),linear-gradient(135deg,#071122,#14233d)',
 'light-clean':'linear-gradient(135deg,#f8fafc,#e2e8f0)',
 'totus-corporate':'linear-gradient(120deg,#11284f,#2563eb 60%,#d6a447)',
 'tech-soft':'radial-gradient(at 20% 20%,#bfdbfe,transparent 60%),linear-gradient(120deg,#e0f2fe,#ede9fe)',
 'gold-night':'radial-gradient(at 80% 20%,#88703b,transparent 50%),linear-gradient(135deg,#0c1422,#292018)'
};
export function loginVariables(input){
 const c=appearanceValues('login',input),base=c.loginCardPreset==='dark'?'#111827':c.loginCardPreset==='light'?'#ffffff':c.loginCardColor;
 return {'--login-overlay':'linear-gradient(#000000'+Math.round(c.loginBackgroundDim*2.55).toString(16).padStart(2,'0')+',#000000'+Math.round(c.loginBackgroundDim*2.55).toString(16).padStart(2,'0')+')','--login-border-width':c.loginBorderWidth+'px','--login-glow':c.loginGlowColor+'80','--login-button-glow':c.loginButtonGlow+'px','--login-button-ink':contrastText(c.loginButtonColor),'--login-bg':c.loginBackground==='uploaded'&&c.customBackgroundData?'url("'+c.customBackgroundData+'")':LOGIN_BACKGROUNDS[c.loginBackground]||LOGIN_BACKGROUNDS['light-clean'],
 '--login-card-bg':c.loginCardPreset==='transparent'?'transparent':base+Math.round(c.loginCardOpacity*2.55).toString(16).padStart(2,'0'),
 '--login-width':c.loginCardWidth+'px','--login-padding':c.loginCardPadding+'px','--login-radius':c.loginCardRadius+'px','--login-text':c.loginTextColor,'--login-border':c.loginBorderColor,'--login-button':c.loginButtonColor,
 '--login-shadow':[({none:'',soft:'0 12px 35px #0002',strong:'0 25px 80px #0005'})[c.loginCardShadow],c.loginCardGlow?'0 0 '+c.loginCardGlow+'px '+c.loginGlowColor+'80':''].filter(Boolean).join(',')||'none',
 '--login-font':({system:'system-ui,sans-serif',rounded:'ui-rounded,system-ui,sans-serif',serif:'Georgia,serif',mono:'ui-monospace,monospace'})[c.loginFont],
 '--login-logo-height':c.loginLogoHeight+'px','--login-logo-width':c.loginLogoWidth+'%','--login-align':c.loginAlign};
}
