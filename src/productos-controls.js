// Enhance native selects without replacing their keyboard or form behaviour.
export function enhanceProductSelects(root){
 for(const select of root.querySelectorAll('select')){
  if(select.options.length<12||select.closest('.prd-columns')||select.previousElementSibling?.matches('[data-pr-select-search]'))continue;
  const input=document.createElement('input');input.type='search';input.dataset.prSelectSearch='';input.placeholder='Buscar una opción…';input.setAttribute('aria-label','Filtrar '+(select.getAttribute('aria-label')||select.closest('label')?.querySelector('b,span')?.textContent?.trim()||'opciones'));input.className='prd-select-search';
  input.addEventListener('input',()=>{const q=input.value.normalize('NFKC').toLocaleLowerCase('es').trim();for(const option of select.options)option.hidden=!!q&&!option.selected&&!!option.value&&!option.textContent.normalize('NFKC').toLocaleLowerCase('es').includes(q);});
  select.before(input);
 }
}
