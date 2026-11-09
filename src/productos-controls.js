// Preserve the select as the form's source of truth; stage multi-selection
// inside one keyboard-accessible dialog before dispatching the form change.
const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
export function enhanceProductSelects(root){
 const controller=new AbortController();
 const closeMenus=()=>root.querySelectorAll('.prd-columns[open],.prd-row-menu[open]').forEach(menu=>menu.open=false);
 const scrolling=event=>{if(!event.target?.closest?.('.prd-columns>div,.prd-row-menu>div,.prd-select-dialog'))closeMenus();};
 for(const name of ['wheel','touchmove'])document.addEventListener(name,scrolling,{capture:true,passive:true,signal:controller.signal});
 document.addEventListener('pointerdown',event=>{if(!event.target?.closest?.('.prd-columns,.prd-row-menu,.prd-select-dialog'))closeMenus();},{capture:true,signal:controller.signal});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'||['PageDown','PageUp','Home','End'].includes(event.key)&&!event.target?.matches?.('input,textarea,select'))closeMenus();},{signal:controller.signal});
 window.addEventListener('resize',closeMenus,{signal:controller.signal});
 for(const menu of root.querySelectorAll('.prd-columns,.prd-row-menu')){
  menu.addEventListener('toggle',()=>{if(!menu.open)return;for(const other of root.querySelectorAll('.prd-columns[open],.prd-row-menu[open]'))if(other!==menu)other.open=false;const panel=menu.querySelector(':scope>div'),anchor=menu.querySelector('summary').getBoundingClientRect();if(panel){const width=Math.min(menu.matches('.prd-columns')?360:220,innerWidth-24);Object.assign(panel.style,{position:'fixed',width:width+'px',left:Math.max(12,Math.min(anchor.left,innerWidth-width-12))+'px',top:Math.min(anchor.bottom+6,Math.max(12,innerHeight-Math.min(panel.scrollHeight,360)-16))+'px',right:'auto',maxHeight:'min(60dvh,360px)'});}});
 }
 for(const select of root.querySelectorAll('select')){
  if(select.options.length<12||select.closest('.prd-columns,.prd-select-control'))continue;
  const title=select.getAttribute('aria-label')||select.closest('label')?.querySelector('b,span')?.textContent?.trim()||'Opciones';
  const wrap=document.createElement('div');wrap.className='prd-select-control';select.before(wrap);wrap.append(select);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='prd-select-trigger';trigger.textContent='⌕';trigger.setAttribute('aria-label','Buscar en '+title);trigger.setAttribute('aria-haspopup','dialog');wrap.append(trigger);
  const open=()=>{
   if(select.disabled)return;
   const dialog=document.createElement('dialog');dialog.className='prd-select-dialog';dialog.setAttribute('aria-label',title);
   const header=document.createElement('header'),heading=document.createElement('h3'),close=document.createElement('button');heading.textContent=title;close.type='button';close.textContent='×';close.setAttribute('aria-label','Cerrar selector');header.append(heading,close);
   const search=document.createElement('input');search.type='search';search.dataset.prSelectSearch='';search.className='prd-select-search';search.placeholder='Buscar por nombre…';search.setAttribute('aria-label','Filtrar '+title);
   const list=document.createElement('div');list.className='prd-select-options';const selected=new Set([...select.selectedOptions].map(o=>o.value));
   const status=document.createElement('p');status.className='prd-picker-status';status.setAttribute('role','status');
   const entries=[];const finish=()=>{dialog.close();dialog.remove();trigger.focus();};
   close.onclick=finish;dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finish();}});
   const apply=()=>{for(const o of select.options)o.selected=selected.has(o.value);dialog.close();dialog.remove();select.focus({preventScroll:true});select.dispatchEvent(new Event('change',{bubbles:true}));};
   for(const option of select.options){
    const group=option.parentElement.tagName==='OPTGROUP'?option.parentElement.label:'';
    const name=(group?group+' · ':'')+option.textContent;
    const row=document.createElement(select.multiple?'label':'button');row.className='prd-select-option';
    if(select.multiple){const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(option.value);check.disabled=option.disabled;check.onchange=()=>{check.checked?selected.add(option.value):selected.delete(option.value);status.textContent=selected.size+' seleccionadas';};row.append(check,document.createTextNode(name));}
    else{row.type='button';row.textContent=name;row.disabled=option.disabled;row.setAttribute('aria-pressed',String(selected.has(option.value)));row.onclick=()=>{selected.clear();selected.add(option.value);apply();};}
    entries.push({row,name});list.append(row);
   }
   const empty=document.createElement('p');empty.textContent='Sin coincidencias';empty.hidden=true;list.append(empty);
   search.oninput=()=>{const q=fold(search.value.trim());let count=0;for(const entry of entries){entry.row.hidden=!!q&&!fold(entry.name).includes(q);if(!entry.row.hidden)count++;}empty.hidden=count>0;status.textContent=count+' opciones'+(select.multiple?' · '+selected.size+' seleccionadas':'');};
   dialog.append(header,search,list,status);
   if(select.multiple){const footer=document.createElement('footer'),clear=document.createElement('button'),save=document.createElement('button');clear.type=save.type='button';clear.textContent='Limpiar selección';save.textContent='Aplicar selección';save.className='prd-primary-action';clear.onclick=()=>{selected.clear();for(const input of list.querySelectorAll('input'))input.checked=false;status.textContent='0 seleccionadas';};save.onclick=apply;footer.append(clear,save);dialog.append(footer);}
   wrap.append(dialog);dialog.showModal();search.focus();search.oninput();
  };
  trigger.onclick=open;
  select.addEventListener('mousedown',e=>{if(e.button===0){e.preventDefault();open();}});
  select.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '||e.altKey&&e.key==='ArrowDown'){e.preventDefault();open();}});
 }
 return ()=>controller.abort();
}
