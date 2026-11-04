import {ROUTES} from './config.js';
export const NAV_GROUPS=[['general','General'],['operations','Operaciones tienda'],['contacts','Contactos'],['analysis','Análisis'],['system','Sistema']];
export function orderedRoutes(order='',routes=ROUTES){
 const requested=[...new Set(String(order).split(','))],rank=new Map(requested.map((id,i)=>[id,i]));
 return routes.slice().sort((a,b)=>NAV_GROUPS.findIndex(([,g])=>g===a.group)-NAV_GROUPS.findIndex(([,g])=>g===b.group)||(rank.get(a.id)??requested.length+ROUTES.findIndex(r=>r.id===a.id))-(rank.get(b.id)??requested.length+ROUTES.findIndex(r=>r.id===b.id)));
}
export function navigationEditor(key,value,esc){
 if(key==='navigationOrder')return '<div class="nav-order-editor"><b>Orden de módulos dentro de cada sección</b><input type="hidden" name="navigationOrder" value="'+esc(value)+'">'+orderedRoutes(value).map(r=>'<div data-nav-row="'+r.id+'" data-nav-group="'+esc(r.group)+'"><span>'+esc(r.group)+' · '+esc(r.label)+'</span><span><button type="button" class="btn secondary" data-nav-move="-1" aria-label="Subir '+esc(r.label)+'">↑</button> <button type="button" class="btn secondary" data-nav-move="1" aria-label="Bajar '+esc(r.label)+'">↓</button></span></div>').join('')+'</div>';
 if(key==='navigationCollapsed')return '<div class="nav-collapsed-editor"><b>Secciones plegadas al iniciar</b><input type="hidden" name="navigationCollapsed" value="'+esc(value)+'">'+NAV_GROUPS.map(([id,label])=>'<label><input type="checkbox" data-nav-collapsed="'+id+'" '+(String(value).split(',').includes(id)?'checked':'')+'>'+label+'</label>').join('')+'</div>';
 return null;
}
export function bindNavigationEditor(host,onChange){
 host.querySelectorAll('[data-nav-move]').forEach(button=>button.onclick=()=>{
  const row=button.closest('[data-nav-row]'),direction=Number(button.dataset.navMove),other=direction<0?row.previousElementSibling:row.nextElementSibling;
  if(!other?.hasAttribute('data-nav-row')||other.dataset.navGroup!==row.dataset.navGroup)return;
  if(direction<0)other.before(row);else other.after(row);
  host.querySelector('[name=navigationOrder]').value=[...host.querySelectorAll('[data-nav-row]')].map(el=>el.dataset.navRow).join(',');onChange();
 });
 host.querySelectorAll('[data-nav-collapsed]').forEach(input=>input.onchange=()=>{host.querySelector('[name=navigationCollapsed]').value=[...host.querySelectorAll('[data-nav-collapsed]:checked')].map(el=>el.dataset.navCollapsed).join(',');onChange();});
}
