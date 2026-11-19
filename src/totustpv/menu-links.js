const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const secret=/^(token|access_token|api_key|key|password|passwd|secret|authorization|ws_key)$/i;
export function menuLinks(value=[]){
 if(!Array.isArray(value)||value.length>6)throw Error('Puedes guardar hasta seis accesos del mostrador.');
 const labels=new Set(),urls=new Set();return value.map(row=>{
  if(!row||Object.keys(row).some(key=>!['label','url'].includes(key))||typeof row.label!=='string'||typeof row.url!=='string')throw Error('Revisa el nombre y la dirección de cada acceso.');
  const label=row.label.trim().normalize('NFC'),raw=row.url.trim();
  if(!label||Array.from(label).length>48||/[\x00-\x1f\x7f]/.test(label)||raw.length>500||/[\s\\]/.test(raw))throw Error('Escribe un nombre de hasta 48 caracteres y una dirección válida.');
  let parsed;try{parsed=new URL(raw,'https://totus.invalid');}catch{throw Error('Escribe una dirección HTTPS o una ruta de Central, como /clientes.');}
  const relative=raw.startsWith('/')&&!raw.startsWith('//');
  if(parsed.username||parsed.password||relative&&parsed.origin!=='https://totus.invalid'||!relative&&(parsed.protocol!=='https:'||!/^https:\/\//i.test(raw)||!/^[a-z0-9.-]+$/i.test(parsed.hostname)))throw Error('Usa una dirección HTTPS sin usuario ni contraseña, o una ruta de Central.');
  if([...parsed.searchParams.keys(),...new URLSearchParams(parsed.hash.slice(1)).keys()].some(key=>secret.test(key))||/[?#&](token|access_token|api_key|key|password|passwd|secret|authorization|ws_key)=/i.test(raw))throw Error('Quita las claves, contraseñas o tokens de la dirección del acceso.');
  if(/[?#&][^=&#]*%/.test(parsed.search+parsed.hash))throw Error('Utiliza nombres de parámetros sin codificar en la dirección.');
  const url=relative?parsed.pathname+parsed.search+parsed.hash:parsed.href;
  if(url.length>500||relative&&!/^\/[a-zA-Z0-9/_-]*(?:[?#].*)?$/.test(url))throw Error('Revisa la ruta del acceso.');
  const name=label.toLocaleLowerCase('es');if(labels.has(name)||urls.has(url))throw Error('Utiliza nombres y direcciones diferentes para los accesos.');labels.add(name);urls.add(url);
  return {label,url};
 });
}
export function menuLinksFromForm(fields){
 const rows=[];for(let i=0;i<6;i++){const label=String(fields.get('menu-label-'+i)||'').trim(),url=String(fields.get('menu-url-'+i)||'').trim();if(label||url)rows.push({label,url});}return menuLinks(rows);
}
export function menuLinksHtml(value,draft){
 const links=menuLinks(value),rowValue=(i,key)=>draft?.['menu-'+key+'-'+i]??links[i]?.[key]??'';
 const visible=Math.max(1,...Array.from({length:6},(_,i)=>rowValue(i,'label')||rowValue(i,'url')?i+1:0));
 return `<section class="tpv-menu-links"><h4>Accesos del mostrador</h4><p>Abre tus páginas habituales en otra pestaña y conserva el ticket actual.</p><form data-tpv-form="menu-links">${Array.from({length:6},(_,i)=>`<div class="tpv-menu-link-row" data-tpv-link-index="${i}" ${i>=visible?'hidden':''}><label>Nombre<input name="menu-label-${i}" maxlength="48" value="${esc(rowValue(i,'label'))}" placeholder="Por ejemplo, Clientes"></label><label>Dirección<input name="menu-url-${i}" maxlength="500" value="${esc(rowValue(i,'url'))}" placeholder="/clientes o https://…" autocomplete="off"></label><button type="button" class="btn secondary" data-tpv-action="remove-menu-link" data-tpv-link-index="${i}" aria-label="Quitar acceso ${i+1}">Quitar</button></div>`).join('')}<p class="small muted">Hasta seis accesos. Utiliza direcciones sin claves ni tokens.</p><div class="tpv-menu-link-actions"><button class="btn secondary" type="button" data-tpv-action="add-menu-link" ${visible===6?'hidden':''}>Añadir acceso</button><button class="btn primary" type="submit">Guardar accesos</button></div></form></section>`;
}
export function menuLinksActions(value){return menuLinks(value).map(row=>`<a class="btn secondary" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer" data-tpv-menu-link>${esc(row.label)} ↗</a>`).join('');}
