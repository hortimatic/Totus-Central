import {positionColumnPanel,standardizeColumnPanel,standardizeColumnPanels,columnSettingsRow,columnSettingsCaption} from './column-settings.js';
/** Shared presentation and personal layouts; never writes business records. */
export function installSharedTableArrows(root=document,{owner=()=>null}={}){
 const entries=new Map(),abort=new AbortController();let frame=0;
 const shift=(row,direction)=>{const select=row?.querySelector('.tc-column-move select');if(!select||select.disabled)return;const next=Math.max(0,Math.min(select.options.length-1,Number(select.value)+direction));if(next!==Number(select.value)){select.value=String(next);select.dispatchEvent(new Event('change',{bubbles:true}));}};
 root.addEventListener('click',e=>{const button=e.target.closest?.('[data-tc-column-step]');if(button&&!button.disabled)shift(button.closest('.tc-column-row'),Number(button.dataset.tcColumnStep));},{signal:abort.signal});
 root.addEventListener('keydown',e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)&&e.target.matches?.('[data-tc-column-grip]')){e.preventDefault();shift(e.target.closest('.tc-column-row'),e.key==='ArrowUp'?-1:1);}},{signal:abort.signal});
 let drag=null;
 root.addEventListener('dragstart',e=>{const grip=e.target.closest?.('[data-tc-column-grip]');if(grip){drag={row:grip.closest('.tc-column-row'),scope:grip.closest('.prd-columns,.tc-column-popover,.home-columns-inspector')};e.dataTransfer.setData('text/plain',grip.dataset.tcColumnGrip);}},{signal:abort.signal});
 root.addEventListener('dragover',e=>{if(drag&&e.target.closest?.('.tc-column-row')?.closest('.prd-columns,.tc-column-popover,.home-columns-inspector')===drag.scope)e.preventDefault();},{signal:abort.signal});
 root.addEventListener('drop',e=>{const row=e.target.closest?.('.tc-column-row'),target=row?.querySelector('select'),source=drag?.row?.querySelector('select');if(drag&&row?.closest('.prd-columns,.tc-column-popover,.home-columns-inspector')===drag.scope&&target&&source&&!source.disabled){e.preventDefault();const value=target.value;drag=null;source.value=value;source.dispatchEvent(new Event('change',{bubbles:true}));}},{signal:abort.signal});root.addEventListener('dragend',()=>drag=null,{signal:abort.signal});
 const closeMenus=except=>{for(const menu of root.querySelectorAll('details.prd-columns[open]'))if(menu!==except)menu.open=false;};
 root.addEventListener('toggle',event=>{const menu=event.target;if(!menu.matches?.('details.prd-columns'))return;if(!menu.open){const panel=menu.querySelector(':scope>div');if(panel?.matches(':popover-open'))panel.hidePopover();return;}closeMenus(menu);const panel=menu.querySelector(':scope>div'),rect=menu.querySelector('summary')?.getBoundingClientRect();if(!panel||!rect)return;positionColumnPanel(panel,rect);},{capture:true,signal:abort.signal});
 root.addEventListener('pointerdown',event=>{if(!event.target.closest?.('.prd-columns'))closeMenus();},{capture:true,signal:abort.signal});
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=event.target.closest?.('details.prd-columns');if(menu){menu.open=false;menu.querySelector('summary')?.focus();}}},{signal:abort.signal});
 const selector='.table-wrap,.directory-table-viewport,.ps-orders-table-viewport,.home-orders-table-wrap';
 const scan=()=>{
  frame=0;
  for(const [viewport,item] of entries)if(!viewport.isConnected){item.observer.disconnect();item.arrows.remove();item.columns?.remove();entries.delete(viewport);}
  for(const viewport of root.querySelectorAll(selector)){
   if(entries.has(viewport)||!viewport.querySelector('table'))continue;
   // A rendered invoice is a document, including inside a scaled preview.
   // Its layout must not acquire interactive table tools or personal columns.
   if(viewport.closest('.invoice-preview,[data-tc-static-table]'))continue;
   // Existing controllers retain their handlers, selection counts and persistence.
   if(viewport.parentElement.querySelector('.directory-table-arrows,.ps-orders-table-navigation,.prd-table-navigation,.tc-table-arrows'))continue;
   const arrows=document.createElement('div');arrows.className='tc-table-arrows';arrows.setAttribute('role','group');arrows.setAttribute('aria-label','Recorrer columnas');
   const buttons=[[-1,'izquierda','←'],[1,'derecha','→']].map(([direction,label,symbol])=>{const b=document.createElement('button');b.type='button';b.dataset.tcTableAction=direction<0?'left':'right';b.className='btn secondary';b.textContent=symbol;b.setAttribute('aria-label','Recorrer columnas hacia la '+label);b.onclick=()=>viewport.scrollBy({left:direction*Math.max(180,viewport.clientWidth*.65),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});arrows.append(b);return b;});
   const update=()=>{const max=viewport.scrollWidth-viewport.clientWidth;arrows.hidden=max<=2;buttons[0].disabled=viewport.scrollLeft<=1;buttons[1].disabled=viewport.scrollLeft>=max-1;};
   viewport.insertAdjacentElement('afterend',arrows);viewport.addEventListener('scroll',update,{passive:true});
   const table=viewport.querySelector('table'),columns=!viewport.hasAttribute('data-tc-columns-managed')&&viewport.matches('.table-wrap,.directory-table-viewport')&&table.matches('.data-table,.directory-table')&&owner()?installColumns(table,viewport,owner()):null;
   const observer=new ResizeObserver(update);observer.observe(viewport);observer.observe(table);entries.set(viewport,{arrows,observer,columns});update();
  }
 };
 const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(scan);});observer.observe(root,{childList:true,subtree:true});scan();
 return ()=>{abort.abort();observer.disconnect();cancelAnimationFrame(frame);for(const item of entries.values()){item.observer.disconnect();item.arrows.remove();item.columns?.remove();}entries.clear();};
}

function installColumns(table,viewport,owner){
 // Editable record grids own their column/cell contracts. Never move their DOM.
 if(table.closest('.record-page,[data-draft-form],form'))return null;
 const headers=[...table.tHead?.rows[0]?.cells||[]];if(headers.length<2||headers.some(h=>h.colSpan!==1))return null;
 const rawLabels=headers.map(h=>h.textContent.trim()),labels=rawLabels.map((label,i)=>label||'Acciones '+(i+1)),rows=[...table.rows].filter(r=>r.cells.length===headers.length),original=rows.map(r=>[...r.cells]);
 const url=new URL(location.href),route=url.searchParams.get('module')||url.pathname.split('/').filter(Boolean).at(-1)||'inicio',module=({precio:'pricing',chat:'equipo'})[route]||route;
 const key='totus.table-layout.v1:'+owner+':'+module+':'+JSON.stringify(rawLabels),legacyKey='totus.table-layout.v1:'+owner+':null:'+JSON.stringify(rawLabels);
 const initial=headers.map((_,i)=>i),validOrder=value=>Array.isArray(value)&&value.length===initial.length&&new Set(value).size===initial.length&&value.every(i=>initial.includes(i));
 const validVisible=value=>Array.isArray(value)?[...new Set(value.filter(i=>initial.includes(i)))]:[];
 let order=[...initial],visible=[...initial],views=[],viewName='';
 try{const saved=JSON.parse(localStorage.getItem(key)||localStorage.getItem(legacyKey));if(saved&&validOrder(saved.order)){order=saved.order;const allowed=validVisible(saved.visible);if(allowed.length)visible=allowed;views=Array.isArray(saved.views)?saved.views.filter(v=>typeof v.name==='string'&&validOrder(v.order)&&validVisible(v.visible).length).slice(0,20):[];viewName=String(saved.viewName||'');}}catch{}
 const details=document.createElement('details');details.className='prd-columns tc-columns';
 const caption=document.createElement('summary');caption.className='btn secondary';caption.setAttribute('aria-label','Configurar columnas');details.append(caption);
 const panel=document.createElement('div');details.append(panel);const tools=document.createElement('div');tools.className='tc-table-tools';tools.setAttribute('aria-label','Herramientas de tabla');tools.append(details);viewport.insertAdjacentElement('beforebegin',tools);
 const status=document.createElement('p');status.setAttribute('role','status');status.className='tc-column-status';
 const apply=()=>{rows.forEach((r,n)=>order.forEach(i=>{const cell=original[n][i];cell.hidden=!visible.includes(i);r.append(cell);}));caption.innerHTML=columnSettingsCaption(visible.length);};
 const save=()=>{apply();try{localStorage.setItem(key,JSON.stringify({order,visible,views,viewName}));status.textContent='Distribución guardada para esta cuenta en este navegador.';}catch{status.textContent='No se pudo guardar la distribución en este navegador.';}};
 const label=document.createElement('label');label.className='prd-column-search';label.textContent='Buscar columna';const search=document.createElement('input');search.type='search';search.placeholder='Nombre de columna';search.setAttribute('aria-label','Buscar columna');search.dataset.draftIgnore='';label.append(search);panel.append(label);
 const help=document.createElement('p');help.className='prd-column-instructions';help.textContent='Elige columnas y su posición. Guarda una vista para reutilizarla.';panel.append(help);
 const presets=document.createElement('div');presets.className='prd-column-presets';panel.append(presets);
 const list=document.createElement('div');list.className='tc-column-list';panel.append(list);
 const viewTools=document.createElement('div');viewTools.className='tc-column-views';viewTools.innerHTML='<label>Vista guardada<select aria-label="Vista guardada" data-tc-view data-draft-ignore></select></label><label>Nombre de vista<input aria-label="Nombre de vista" maxlength="60" data-tc-view-name data-draft-ignore></label><div class="tc-column-actions"></div>';panel.append(viewTools,status);
 const viewSelect=viewTools.querySelector('select'),nameInput=viewTools.querySelector('input');
 const draw=()=>{list.innerHTML=order.map(i=>columnSettingsRow({key:String(i),label:labels[i],selected:visible.includes(i),index:order.indexOf(i),count:order.length,check:{'data-tc-column':i},position:{'data-tc-position':i}})).join('');filter();viewSelect.replaceChildren(new Option('Personalizada',''),...views.map(v=>new Option(v.name,v.name)));viewSelect.value=viewName;nameInput.value=viewName;};
 const filter=()=>{for(const row of list.children)row.hidden=!row.textContent.toLocaleLowerCase('es').includes(search.value.toLocaleLowerCase('es'));};
 list.onchange=event=>{const el=event.target;if(el.hasAttribute('data-tc-column')){const i=Number(el.dataset.tcColumn);if(!el.checked&&visible.length===1){el.checked=true;return;}visible=el.checked?[...visible,i]:visible.filter(v=>v!==i);}if(el.hasAttribute('data-tc-position')){const i=Number(el.dataset.tcPosition);order=order.filter(v=>v!==i);order.splice(Number(el.value),0,i);}viewName='';save();draw();};
 search.oninput=filter;
 const button=(parent,text,action,handler)=>{const b=document.createElement('button');b.type='button';b.className='btn secondary';b.textContent=text;b.dataset.tcTableAction=action;b.onclick=handler;parent.append(b);};
 button(presets,'Inicial','initial',()=>{order=[...initial];visible=[...initial];viewName='';save();draw();});button(presets,'Todas','all',()=>{visible=[...initial];viewName='';save();draw();});
 const actions=viewTools.querySelector('.tc-column-actions');button(actions,'Guardar distribución','save-columns',save);
 button(actions,'Guardar vista personal','save-view',()=>{const name=nameInput.value.trim().slice(0,60);if(!name){status.textContent='Escribe un nombre para guardar la vista.';return;}if(views.length>=20&&!views.some(v=>v.name===name)){status.textContent='Puedes conservar hasta veinte vistas personales.';return;}views=views.filter(v=>v.name!==name);views.push({name,order:[...order],visible:[...visible]});viewName=name;save();draw();});
 button(actions,'Eliminar vista','delete-view',()=>{if(!viewSelect.value)return;views=views.filter(v=>v.name!==viewSelect.value);viewName='';save();draw();});
 button(actions,'Restablecer columnas','reset-columns',()=>{order=[...initial];visible=[...initial];viewName='';search.value='';save();draw();});
 viewSelect.onchange=()=>{const view=views.find(v=>v.name===viewSelect.value);if(view){order=[...view.order];visible=validVisible(view.visible);viewName=view.name;save();draw();}};
 apply();draw();standardizeColumnPanel(panel);status.textContent='Los cambios se guardan automáticamente en este navegador.';return tools;
}
