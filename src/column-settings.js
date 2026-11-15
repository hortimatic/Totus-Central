// Shared presentation only. Each table retains its own persistence and permissions.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attributes=value=>Object.entries(value||{}).map(([key,value])=>value===false||value==null?'':' '+key+'="'+escape(value===true?'':value)+'"').join('');
export function columnSettingsRow({key,label,selected,locked=false,fixed=false,index,count,check={},position={},grip={'data-tc-column-grip':key},up={'data-tc-column-step':-1},down={'data-tc-column-step':1},className='',row={}}){
 const control=selected?'<span class="tc-column-move">'+(grip?'<button type="button" class="prd-column-grip" draggable="true" aria-label="Mover '+escape(label)+'"'+attributes(grip)+'>⠿</button>':'')+'<select data-draft-ignore aria-label="Posición de '+escape(label)+'"'+attributes(position)+'>'+Array.from({length:count},(_,n)=>'<option value="'+n+'" '+(index===n?'selected':'')+'>'+(n+1)+'</option>').join('')+'</select>'+(up?'<button type="button" aria-label="Subir '+escape(label)+'"'+attributes({...up,disabled:fixed||index===0})+'>↑</button>':'')+(down?'<button type="button" aria-label="Bajar '+escape(label)+'"'+attributes({...down,disabled:fixed||index===count-1})+'>↓</button>':'')+'</span>':'';
 return '<div class="tc-column-row prd-column-option '+escape(className)+'" data-column-key="'+escape(key)+'"'+attributes(row)+'><label><input type="checkbox" data-draft-ignore '+(selected?'checked ':'')+(locked?'disabled ':'')+attributes(check)+'><span>'+escape(label)+'</span></label>'+control+'</div>';
}
export function columnSettingsCaption(count){return '<span aria-hidden="true">⚙</span><span>Columnas</span><small>'+Number(count)+'</small>';}

// Measure the rendered panel after constraining it. An estimated height can
// place a 480px editor using a 60vh calculation and cut its save controls off.
export function positionColumnPanel(panel,anchor){
 const rect=anchor.getBoundingClientRect?anchor.getBoundingClientRect():anchor;
 // Top layer escapes transformed/animated cards and overflow clipping, while
 // keeping the DOM inside its controller so native handlers keep working.
 if(!panel.hasAttribute('popover'))panel.popover='manual';
 if(!panel.matches(':popover-open'))panel.showPopover();
 Object.assign(panel.style,{position:'fixed',inset:'auto',margin:'0',width:Math.min(360,innerWidth-24)+'px',maxHeight:Math.min(480,innerHeight-24)+'px',right:'auto'});
 const size=panel.getBoundingClientRect();
 panel.style.left=Math.max(12,Math.min(rect.left,innerWidth-size.width-12))+'px';
 panel.style.top=Math.max(12,Math.min(rect.bottom+6,innerHeight-size.height-12))+'px';
}

// Normalize the entire editor while preserving its native event handlers and
// persistence adapter. No settings or permissions are inferred from presentation.
export function standardizeColumnPanel(panel,{onClose=()=>{}}={}){
 if(!panel||panel.querySelector(':scope>.tc-settings-header'))return;
 const rows=[...panel.querySelectorAll('.tc-column-row')],search=panel.querySelector('input[type=search]')?.closest('label');
 if(!rows.length||!search)return;
 panel.dataset.tcSettings='';panel.classList.add('tc-settings-panel');
 const original=[...panel.children],buttons=[...panel.querySelectorAll('button')];
 const save=buttons.find(b=>b.textContent.trim()==='Guardar distribución'),reset=buttons.find(b=>b.textContent.trim()==='Restablecer columnas');
 const statuses=[...panel.querySelectorAll('p[role=status]')];
 const header=document.createElement('header');header.className='tc-settings-header';header.innerHTML='<strong>Configurar columnas</strong>';
 const close=document.createElement('button');close.type='button';close.className='btn secondary';close.textContent='×';close.setAttribute('aria-label','Cerrar columnas');
 close.onclick=()=>{const details=panel.closest('details.prd-columns');if(details)details.open=false;if(panel.matches('[popover]:popover-open'))panel.hidePopover();onClose();};
 if(panel.closest('details.prd-columns')||panel.matches('[popover]'))header.append(close);
 const help=document.createElement('p');help.className='tc-column-status';help.textContent='Elige las columnas visibles y su posición.';
 const parent=rows[0].parentElement,list=parent!==panel&&rows.every(row=>row.parentElement===parent)?parent:document.createElement('div');list.classList.add('tc-settings-list','directory-column-list');list.append(...rows);
 const footer=document.createElement('footer');footer.className='tc-settings-footer';for(const button of [save,reset])if(button){button.classList.add('btn','secondary');footer.append(button);}
 const advanced=document.createElement('section');advanced.className='tc-settings-advanced';const summary=document.createElement('strong');summary.textContent='Vistas guardadas y opciones';advanced.append(summary);
 search.classList.add('prd-column-search');search.remove();for(const status of statuses)status.remove();
 for(const child of original){if(child===search||child===list||child===save||child===reset||child.matches('header,legend,p,.tc-column-row'))continue;for(const empty of [...child.querySelectorAll('div')].reverse())if(!empty.children.length&&!empty.textContent.trim())empty.remove();if(child.querySelector('input,select,button')||child.matches('label,button'))advanced.append(child);}
 panel.replaceChildren(header,search,help,list,advanced,footer,...statuses);
 if(advanced.children.length===1)advanced.hidden=true;
}
export function standardizeColumnPanels(root){for(const panel of root.querySelectorAll('.prd-columns>div,.tc-column-popover,.home-columns-inspector'))standardizeColumnPanel(panel);}
