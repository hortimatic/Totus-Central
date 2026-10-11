import {esc,fmtDate,money,statusClass} from './utils.js';

export function setHeader(eyebrow,title,actions=''){
 document.getElementById('pageEyebrow').textContent=eyebrow||'';
 document.getElementById('pageTitle').textContent=title||'';
 document.getElementById('topActions').innerHTML=actions||'';
}
export const btn=(label,action,kind='secondary',attrs='')=>`<button class="btn ${kind}" data-action="${esc(action)}" ${attrs}>${esc(label)}</button>`;
export const badge=(text,kind='info')=>`<span class="badge ${kind}">${esc(text)}</span>`;
export const dateFilters=({from,to,store='all',stores=[],query=''},prefix='filter')=>`
 <div class="filters">
  <div class="field"><label>Desde</label><input type="date" id="${prefix}From" value="${esc(from)}"></div>
  <div class="field"><label>Hasta</label><input type="date" id="${prefix}To" value="${esc(to)}"></div>
  <div class="field"><label>Tienda</label><select id="${prefix}Store"><option value="all">Todas</option>${stores.map(s=>`<option value="${s.id}" ${store===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
  <div class="field search"><label>Buscar</label><input id="${prefix}Query" value="${esc(query||'')}" placeholder="Buscar por texto"></div>
  ${btn('Aplicar',prefix+'-apply','primary')}
  ${btn('Este mes',prefix+'-month','secondary')}
 </div>`;
export const empty=(title='Sin datos',text='Todavía no hay registros.')=>`<div class="empty"><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
export const kpi=(label,value,sub='')=>`<div class="kpi"><span>${esc(label)}</span><strong>${value}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
export const table=(headers,rows,{emptyTitle='Sin datos',emptyText='Todavía no hay registros.'}={})=>{
 if(!rows.length)return empty(emptyTitle,emptyText);
 return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th class="${h.num?'num':''}">${esc(h.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td class="${h.num?'num':''}">${h.html?h.html(r):esc(h.get?r[h.get]:h.value?.(r)??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
};
export const formField=(label,id,value='',type='text',extra='')=>{const decimal=type==='number'&&/step=["']0\.\d+/.test(extra);return `<label>${esc(label)}<input id="${esc(id)}" type="${decimal?'text':esc(type)}" ${decimal?'inputmode="decimal" data-decimal="true"':''} value="${esc(value??'')}" ${extra}></label>`;};
export const selectField=(label,id,options,value='',extra='')=>`<label>${esc(label)}<select id="${esc(id)}" ${extra}>${options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`;
export function modal(title,body,{small=false}={}){
 const host=document.getElementById('modalHost');
 host.innerHTML=`<div class="modal-backdrop" data-action="close-modal"><section class="modal ${small?'small-modal':''}" onclick="event.stopPropagation()"><div class="modal-head"><h2>${esc(title)}</h2><button class="close-btn" data-action="close-modal">×</button></div><div class="modal-body">${body}</div></section></div>`;
}
export function closeModal(){document.getElementById('modalHost').innerHTML=''}
export function toast(message,type=''){const host=document.getElementById('toastHost'),el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;host.appendChild(el);setTimeout(()=>el.remove(),3500)}
export const moneyCell=v=>`<span class="money">${money(v)}</span>`;
export const dateCell=v=>`<span class="date-display">${fmtDate(v)}</span>`;
export const stateBadge=s=>badge(s||'—',statusClass(s));
