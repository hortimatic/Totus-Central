/** In-page navigation: preserve every control, its value and its form owner. */
export function mountSettingsNavigation(host) {
 const settings=host.querySelector('.tpv-settings'),form=settings?.querySelector('[data-tpv-form="preferences"]');
 if(!form||settings.querySelector('[data-tpv-settings-navigation]'))return;
 const sections=[{node:form,label:'Mostrador'}];
 for(const node of form.querySelectorAll(':scope > fieldset')){
  const label=node.querySelector(':scope > legend')?.textContent.trim();
  if(label)sections.push({node,label});
 }
 for(const selector of ['.tpv-receipt-preview','.tpv-receipt-series','.tpv-menu-links','.tpv-settings-admin','.tpv-settings:has([data-tpv-form="payment-settings"])']){
  const node=host.querySelector(selector),label=node?.querySelector('h3,h4,legend')?.textContent.trim();
  if(node&&label)sections.push({node,label});
 }
 const doc=host.ownerDocument,nav=doc.createElement('nav');
 nav.dataset.tpvSettingsNavigation='';nav.className='tpv-settings-navigation';nav.setAttribute('aria-label','Apartados de configuración');
 const label=doc.createElement('label');label.textContent='Ir a un apartado';
 const select=doc.createElement('select');
 const links=doc.createElement('div');links.className='tpv-settings-links';
 sections.forEach((section,index)=>{
  const option=doc.createElement('option');option.value=String(index);option.textContent=section.label;select.append(option);
  const button=doc.createElement('button');button.type='button';button.className='btn secondary';button.textContent=section.label;
  button.addEventListener('click',()=>jump(index));links.append(button);
 });
 function jump(index){
  const section=sections[index];if(!section)return;
  select.value=String(index);
  const heading=section.node.querySelector(':scope > legend,:scope > h4,:scope > h3')||section.node;
  heading.setAttribute('tabindex','-1');heading.style.scrollMarginTop=`${nav.getBoundingClientRect().height+24}px`;
  heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'instant'});
 }
 select.addEventListener('change',()=>jump(Number(select.value)));
 label.append(select);nav.append(label,links);form.before(nav);
}
