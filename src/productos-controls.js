import {positionColumnPanel} from './column-settings.js';
import {standardizeColumnPanels} from './column-settings.js';
// Preserve the select as the form's source of truth; stage multi-selection
// inside one keyboard-accessible dialog before dispatching the form change.
const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
export function enhanceProductSelects(root){
 standardizeColumnPanels(root);
 const controller=new AbortController();
 const closeMenus=()=>root.querySelectorAll('.prd-columns[open],.prd-row-menu[open]').forEach(menu=>menu.open=false);
 const scrolling=event=>{if(!event.target?.closest?.('.prd-columns>div,.prd-row-menu>div,.prd-select-dialog'))closeMenus();};
 for(const name of ['wheel','touchmove'])document.addEventListener(name,scrolling,{capture:true,passive:true,signal:controller.signal});
 document.addEventListener('pointerdown',event=>{if(!event.target?.closest?.('.prd-columns,.prd-row-menu,.prd-select-dialog'))closeMenus();},{capture:true,signal:controller.signal});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'||['PageDown','PageUp','Home','End'].includes(event.key)&&!event.target?.matches?.('input,textarea,select'))closeMenus();},{signal:controller.signal});
 window.addEventListener('resize',closeMenus,{signal:controller.signal});
 for(const menu of root.querySelectorAll('.prd-columns,.prd-row-menu')){
  menu.addEventListener('toggle',()=>{if(!root.contains(menu))return;if(!menu.open){const panel=menu.querySelector(':scope>div');if(panel?.matches(':popover-open'))panel.hidePopover();return;}for(const other of root.querySelectorAll('.prd-columns[open],.prd-row-menu[open]'))if(other!==menu)other.open=false;const panel=menu.querySelector(':scope>div'),anchor=menu.querySelector('summary').getBoundingClientRect();if(panel&&menu.matches('.prd-columns')){positionColumnPanel(panel,anchor);}else if(panel){const width=Math.min(220,innerWidth-24);Object.assign(panel.style,{position:'fixed',width:width+'px',left:Math.max(12,Math.min(anchor.left,innerWidth-width-12))+'px',top:Math.min(anchor.bottom+6,Math.max(12,innerHeight-Math.min(panel.scrollHeight,480)-16))+'px',right:'auto',maxHeight:'min(75dvh,480px)'});}});
 }
 enhanceSearchableSelects(root);
 return ()=>controller.abort();
}

const entityNames=/(?:supplier|provider|customer|client|brand|manufacturer|category|family|product|employee|seller|channel|member|usuario|proveedor|cliente|marca|familia|categoria|producto|empleado|canal)/i;
const alphabetical=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
export function sortEntitySelect(select){
 const context=[select.name,select.id,select.getAttribute('aria-label'),...Object.entries(select.dataset).flat(),select.closest('label')?.childNodes[0]?.textContent].join(' ');
 if(!entityNames.test(context)||select.closest('.prd-columns,.tc-settings-panel'))return false;
 const groups=[select,...select.querySelectorAll('optgroup')];
 for(const group of groups){const options=[...group.children].filter(el=>el.tagName==='OPTION'),pinned=o=>!o.value||['all','both'].includes(o.value)||/^(?:Todas? |Todos? |Sin |Selecciona )/i.test(o.textContent.trim()),ordered=[...options.filter(pinned),...options.filter(o=>!pinned(o)).sort((a,b)=>alphabetical.compare(a.textContent,b.textContent))];
  if(ordered.some((o,i)=>o!==options[i])){const selected=[...select.selectedOptions];group.append(...ordered);for(const option of selected)option.selected=true;}
 }
 return true;
}
export function enhanceSearchableSelects(root){
 for(const select of root.querySelectorAll('select')){
  const entity=sortEntitySelect(select);
  if((select.options.length<12&&(!entity||select.options.length<3))||select.closest('.prd-columns,.tc-settings-panel,.prd-select-control'))continue;
  const title=select.getAttribute('aria-label')||select.closest('label')?.querySelector('b,span')?.textContent?.trim()||select.closest('label')?.childNodes[0]?.textContent?.trim()||select.name||'Opciones';
  const wrap=document.createElement('div');wrap.className='prd-select-control';select.before(wrap);wrap.append(select);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='prd-select-trigger';trigger.textContent='⌕';trigger.setAttribute('aria-label','Buscar en '+title);trigger.setAttribute('aria-haspopup','dialog');wrap.append(trigger);
  const open=(initialSearch='')=>{
   if(select.disabled)return;
   sortEntitySelect(select);const dialog=document.createElement('dialog');dialog.className='prd-select-dialog';dialog.setAttribute('aria-label',title);
   const header=document.createElement('header'),heading=document.createElement('h3'),close=document.createElement('button');heading.textContent=title;close.type='button';close.textContent='×';close.setAttribute('aria-label','Cerrar selector');header.append(heading,close);
   const search=document.createElement('input');search.type='search';search.dataset.draftIgnore='';search.dataset.prSelectSearch='';search.className='prd-select-search';search.placeholder='Buscar por nombre…';search.setAttribute('aria-label','Filtrar '+title);search.value=initialSearch;
   const list=document.createElement('div');list.className='prd-select-options';const selected=new Set([...select.selectedOptions].map(o=>o.value));
   const status=document.createElement('p');status.className='prd-picker-status';status.setAttribute('role','status');
   const entries=[];const finish=()=>{dialog.close();dialog.remove();trigger.focus();};
   close.onclick=finish;dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finish();}});
   const apply=()=>{for(const o of select.options)o.selected=selected.has(o.value);dialog.close();dialog.remove();select.focus({preventScroll:true});select.dispatchEvent(new Event('change',{bubbles:true}));};
   for(const option of select.options){
    const group=option.parentElement.tagName==='OPTGROUP'?option.parentElement.label:'';
    const name=(group?group+' · ':'')+option.textContent;
    const row=document.createElement(select.multiple?'label':'button');row.className='prd-select-option';
    if(select.multiple){const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(option.value);check.disabled=option.disabled;check.dataset.draftIgnore='';check.onchange=event=>{event.stopPropagation();check.checked?selected.add(option.value):selected.delete(option.value);status.textContent=selected.size+' seleccionadas';};row.append(check,document.createTextNode(name));}
    else{row.type='button';row.textContent=name;row.disabled=option.disabled;row.setAttribute('aria-pressed',String(selected.has(option.value)));row.onclick=()=>{selected.clear();selected.add(option.value);apply();};}
    entries.push({row,name});list.append(row);
   }
   const empty=document.createElement('p');empty.textContent='Sin coincidencias';empty.hidden=true;list.append(empty);
   search.oninput=event=>{event?.stopPropagation();const q=fold(search.value.trim());let count=0;for(const entry of entries){entry.row.hidden=!!q&&!fold(entry.name).includes(q);if(!entry.row.hidden)count++;}empty.hidden=count>0;status.textContent=count+' opciones'+(select.multiple?' · '+selected.size+' seleccionadas':'');};
   search.onchange=event=>event.stopPropagation();
   search.onkeydown=event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();if(!select.multiple)entries.find(entry=>!entry.row.hidden&&!entry.row.disabled)?.row.click();}if(event.key==='ArrowDown'){event.preventDefault();const row=entries.find(entry=>!entry.row.hidden&&!entry.row.disabled)?.row;(row?.querySelector('input')||row)?.focus();}};
   dialog.append(header,search,list,status);
   if(select.multiple){const footer=document.createElement('footer'),clear=document.createElement('button'),save=document.createElement('button');clear.type=save.type='button';clear.textContent='Limpiar selección';save.textContent='Aplicar selección';save.className='prd-primary-action';clear.onclick=()=>{selected.clear();for(const input of list.querySelectorAll('input'))input.checked=false;status.textContent='0 seleccionadas';};save.onclick=apply;footer.append(clear,save);dialog.append(footer);}
   wrap.append(dialog);dialog.showModal();search.focus();search.oninput();
  };
  trigger.onclick=()=>open();
  select.addEventListener('mousedown',e=>{if(e.button===0){e.preventDefault();open();}});
  select.addEventListener('keydown',e=>{if(e.key.length===1&&e.key!==' '&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();open(e.key);return;}if(e.key==='Enter'||e.key===' '||e.altKey&&e.key==='ArrowDown'){e.preventDefault();open();}});
 }

}
export function installSearchableSelects(root=document){let frame=0;const scan=()=>{frame=0;enhanceSearchableSelects(root);};const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(scan);});observer.observe(root,{childList:true,subtree:true});scan();return ()=>{observer.disconnect();cancelAnimationFrame(frame);};}
