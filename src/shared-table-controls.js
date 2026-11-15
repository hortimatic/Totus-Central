/** Presentation only. Never reads or writes records or table preferences. */
export function installSharedTableArrows(root=document,{owner=()=>null}={}){
 const entries=new Map();let frame=0;
 const selector='.table-wrap,.directory-table-viewport,.ps-orders-table-viewport,.home-orders-table-wrap';
 const scan=()=>{
  frame=0;
  for(const [viewport,item] of entries)if(!viewport.isConnected){item.observer.disconnect();item.arrows.remove();item.columns?.remove();entries.delete(viewport);}
  for(const viewport of root.querySelectorAll(selector)){
   if(entries.has(viewport)||!viewport.querySelector('table'))continue;
   // Existing controllers retain their handlers, selection counts and persistence.
   if(viewport.parentElement.querySelector('.directory-table-arrows,.ps-orders-table-navigation,.prd-table-navigation,.tc-table-arrows'))continue;
   const arrows=document.createElement('div');arrows.className='tc-table-arrows';arrows.setAttribute('role','group');arrows.setAttribute('aria-label','Recorrer columnas');
   const buttons=[[-1,'izquierda','←'],[1,'derecha','→']].map(([direction,label,symbol])=>{const b=document.createElement('button');b.type='button';b.dataset.tcTableAction=direction<0?'left':'right';b.className='btn secondary';b.textContent=symbol;b.setAttribute('aria-label','Recorrer columnas hacia la '+label);b.onclick=()=>viewport.scrollBy({left:direction*Math.max(180,viewport.clientWidth*.65),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});arrows.append(b);return b;});
   const update=()=>{const max=viewport.scrollWidth-viewport.clientWidth;arrows.hidden=max<=2;buttons[0].disabled=viewport.scrollLeft<=1;buttons[1].disabled=viewport.scrollLeft>=max-1;};
   viewport.insertAdjacentElement('afterend',arrows);viewport.addEventListener('scroll',update,{passive:true});
   const table=viewport.querySelector('table'),columns=viewport.matches('.table-wrap')&&table.matches('.data-table')&&owner()?installColumns(table,viewport,owner()):null;
   const observer=new ResizeObserver(update);observer.observe(viewport);observer.observe(table);entries.set(viewport,{arrows,observer,columns});update();
  }
 };
 const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(scan);});observer.observe(root,{childList:true,subtree:true});scan();
 return ()=>{observer.disconnect();cancelAnimationFrame(frame);for(const item of entries.values()){item.observer.disconnect();item.arrows.remove();item.columns?.remove();}entries.clear();};
}

function installColumns(table,viewport,owner){
 // Editable record grids own their column/cell contracts. Never move their DOM.
 if(table.closest('.record-page,[data-draft-form],form'))return null;
 const headers=[...table.tHead?.rows[0]?.cells||[]];if(headers.length<2||headers.some(h=>h.colSpan!==1))return null;
 const labels=headers.map(h=>h.textContent.trim()),rows=[...table.rows].filter(r=>r.cells.length===headers.length),original=rows.map(r=>[...r.cells]);
 // Only layout is stored. The key excludes records, credentials and query text.
 const key='totus.table-layout.v1:'+owner+':'+new URL(location.href).searchParams.get('module')+':'+JSON.stringify(labels);
 let order=headers.map((_,i)=>i),visible=[...order];
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.order)&&saved.order.length===order.length&&new Set(saved.order).size===order.length&&saved.order.every(i=>order.includes(i))){order=saved.order;const allowed=Array.isArray(saved.visible)?saved.visible.filter(i=>order.includes(i)):[];if(allowed.length)visible=allowed;}}catch{}
 const details=document.createElement('details');details.className='prd-columns tc-columns';
 const caption=document.createElement('summary');caption.className='btn secondary';caption.textContent='⚙ Columnas';caption.setAttribute('aria-label','Configurar columnas');details.append(caption);
 const panel=document.createElement('div');details.append(panel);const tools=document.createElement('div');tools.className='tc-table-tools';tools.setAttribute('aria-label','Herramientas de tabla');tools.append(details);viewport.insertAdjacentElement('beforebegin',tools);
 const apply=()=>{rows.forEach((r,n)=>order.forEach(i=>{const cell=original[n][i];cell.hidden=!visible.includes(i);r.append(cell);}));};
 const save=()=>{apply();try{localStorage.setItem(key,JSON.stringify({order,visible}));}catch{status.textContent='No se pudo guardar la distribución en este navegador.';}};
 const search=document.createElement('input');search.type='search';search.placeholder='Buscar columna';search.setAttribute('aria-label','Buscar columna');search.dataset.draftIgnore='';panel.append(search);
 const help=document.createElement('p');help.className='small muted';help.textContent='Elige columnas y su posición. La distribución se guarda para esta cuenta en este navegador.';panel.append(help);
 const list=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');panel.append(list,status);
 const draw=()=>{list.replaceChildren();for(const i of order){const row=document.createElement('div');row.className='prd-column-option';row.hidden=!labels[i].toLocaleLowerCase('es').includes(search.value.toLocaleLowerCase('es'));const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=visible.includes(i);check.dataset.draftIgnore='';check.onchange=()=>{if(!check.checked&&visible.length===1){check.checked=true;return;}visible=check.checked?[...visible,i]:visible.filter(v=>v!==i);save();};label.append(check,document.createTextNode(labels[i]));row.append(label);const position=document.createElement('select');position.setAttribute('aria-label','Posición de '+labels[i]);position.dataset.draftIgnore='';order.forEach((_,n)=>position.append(new Option(String(n+1),String(n),false,order.indexOf(i)===n)));position.onchange=()=>{order=order.filter(v=>v!==i);order.splice(Number(position.value),0,i);save();draw();};row.append(position);list.append(row);}};
 search.oninput=draw;
 const reset=document.createElement('button');reset.type='button';reset.dataset.tcTableAction='reset-columns';reset.className='btn secondary';reset.textContent='Restablecer columnas';reset.onclick=()=>{order=headers.map((_,i)=>i);visible=[...order];search.value='';save();draw();};panel.append(reset);apply();draw();return tools;
}
