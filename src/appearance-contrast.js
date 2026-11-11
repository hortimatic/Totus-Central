// Personal interface contrast helpers. These never change stored preferences on their own.
const luminance=hex=>{
 const channels=String(hex).match(/^#([0-9a-f]{6})$/i)?.[1].match(/../g);
 if(!channels)return null;
 const [r,g,b]=channels.map(pair=>{const x=parseInt(pair,16)/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
 return .2126*r+.7152*g+.0722*b;
};
export function contrastRatio(foreground,background){
 const a=luminance(foreground),b=luminance(background);
 if(a===null||b===null)return 0;
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
const rules=[
 ['text','card','Texto principal sobre tarjetas'],
 ['text','surface','Texto principal sobre superficies'],
 ['muted','card','Texto secundario sobre tarjetas'],
 ['muted','surface','Texto secundario sobre superficies'],
 ['navigationText','navigationBackground','Texto del menú'],
 ['navigationSectionText','navigationBackground','Secciones del menú']
];
export function appearanceContrastChecks(values){
 return rules.map(([foreground,background,label])=>({
  foreground,background,label,ratio:contrastRatio(values[foreground],values[background]),ok:contrastRatio(values[foreground],values[background])>=4.5
 }));
}
export function improveAppearanceContrast(values){
 const next={...values};
 const corrections=[
  ['text',['card','surface']],
  ['muted',['card','surface']],
  ['navigationText',['navigationBackground']],
  ['navigationSectionText',['navigationBackground']]
 ];
 for(const [field,backgrounds] of corrections){
  const minimum=color=>Math.min(...backgrounds.map(key=>contrastRatio(color,next[key])));
  if(minimum(next[field])>=4.5)continue;
  const candidates=['#0f172a','#f8fafc','#000000','#ffffff'];
  next[field]=candidates.reduce((best,candidate)=>minimum(candidate)>minimum(best)?candidate:best,next[field]);
 }
 return next;
}
