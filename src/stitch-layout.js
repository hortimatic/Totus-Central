import {interfaceIcon} from './interface-icons.js';
const descriptions={inicio:'Tu actividad y el trabajo de hoy, en un mismo lugar.',pricing:'Productos, variantes, costes y precios de venta.',cajas:'Supervisión y consulta de los arqueos y cierres de caja de las tiendas.',gastos:'Facturas, pagos y control interno de tus tiendas.',facturacion:'Documentos de venta, clientes y seguimiento de cobros.',cotejos:'Documentos de pedidos y comprobación de la mercancía recibida.',tareas:'Organiza el trabajo por fecha, tienda y persona.',equipo:'Conversaciones, archivos y trabajo compartido con tu equipo.',documentos:'Todos los archivos de trabajo, ordenados y vinculados.',fiscalidad:'Previsión y seguimiento fiscal a partir de tus registros.',informes:'Consulta, contrasta y prepara la documentación del periodo.',administracion:'Usuarios, permisos y funcionamiento de Totus Central.',configuracion:'Personaliza tu espacio de trabajo y la pantalla de acceso.'};
/** Presentation only. Existing nodes, event targets, forms and their state survive. */
export function applyStitchLayout(root,route,title){
 if(!root)return;
 root.dataset.module=route;
 let page=root.querySelector(':scope > .page');
 const stock=root.querySelector(':scope > .stock-page');
 if(!page&&stock){page=document.createElement('div');page.className='page';stock.before(page);page.append(stock);}
 if(page&&!page.querySelector(':scope > .module-heading')){
  const heading=document.createElement('header');heading.className='module-heading';
  const identity=document.createElement('div');identity.className='module-identity';
  const icon=document.createElement('span');icon.className='module-symbol';icon.innerHTML=interfaceIcon(route);
  const text=document.createElement('div'),name=document.createElement('h2'),description=document.createElement('p');
  name.textContent=route==='cotejos'?'Recepciones':title;description.textContent=descriptions[route]||'';text.append(name,description);identity.append(icon,text);heading.append(identity);
  // Move list actions, never clone them: IDs, draft protection and delegated handlers remain intact.
  const section=[...page.querySelectorAll(':scope > .table-card > .section-head')].find(el=>el.querySelector(':scope > .inline-actions'));
  const actions=section?.querySelector(':scope > .inline-actions');
  if(actions){actions.classList.add('module-actions');heading.append(actions);}
  page.prepend(heading);
 }
 root.querySelectorAll('.btn[data-action]').forEach(button=>{
  if(button.querySelector('.ui-icon'))return;
  const action=button.dataset.action;
  const name=/(?:-new|^new-)$/.test(action)||/-new$/.test(action)?'plus':/export|download/.test(action)?'download':/preview|^closing-edit$/.test(action)?'eye':null;
  if(name==='plus'&&button.firstChild?.nodeType===3)button.firstChild.nodeValue=button.firstChild.nodeValue.replace(/^\+\s*/,'');
  if(name)button.insertAdjacentHTML('afterbegin',interfaceIcon(name));
 });
}
