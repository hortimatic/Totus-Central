import {tenderSummaryHtml} from './tender-summary.js';
import {returnPolicy,returnPolicyHtml} from './return-policy.js';
import {menuLinks as normalizeMenuLinks,menuLinksFromForm,menuLinksHtml,menuLinksActions} from './menu-links.js';
import {createCatalogueBackground} from './catalogue-background.js';
import {mountSettingsNavigation} from './settings-navigation.js';
import {roundPriceMicros,roundPriceSubtotal} from './offline-rounding.js';
import {createOfflineSync} from './offline-sync.js';
import {createOfflineJournal} from './offline-journal.js';
import {offlineDevice} from './offline-device.js';
import {submitWithLocalReceipt} from './local-sale-submission.js';
import {createOfflinePanel} from './offline-panel.js';
import {lineName,createLineNameEditor} from './line-name.js';
import {budgetDocumentHtml,budgetStatus} from './budget-document.js';
import {saleNote} from './sale-note.js';
import {paymentFormMethods,paymentSettingsHtml,paymentSettingsFromForm} from './payment-options.js';
import {paymentReferenceFields,referenceForTender} from './payment-reference.js';
import {parkingOptions,parkingOptionsHtml,parkingOptionsFromForm,parkingExpiry} from './parking-options.js';
import {lineOptions,lineOptionsHtml,lineOptionsFromForm,lineAdjustment} from './line-options.js';
import {stockPolicy,stockPolicyFromForm,stockPolicyHtml,canExceedStock,stockWarning} from './stock-policy.js';
import {createQuantityPicker} from './quantity-picker.js';
import {createTpvPracticeAdapter} from './practice-adapter.js';
import {cashTenderPreview} from './model.js';
import {taxSummaryHtml} from './tax-summary.js';
import {receiptHtml as nativeReceiptHtml,receiptPreviewHtml,downloadNativePdf,printReceipt,printTpvMarkup} from './documents.js';
import {receiptSeries,receiptSeriesFromForm,receiptSeriesHtml,receiptSeriesError,receiptNumber} from './receipt-series.js';
import {receiptOptions,receiptOptionsHtml,receiptOptionsFromForm} from './receipt-options.js';
import {createReceiptDelivery} from './receipt-delivery.js';
import {orderLookupInput} from './central-adapter.js';
import {createTpvCustomerPanel} from './customers.js';
import {createCashReportsPanel} from './cash-reports.js';
import {createStockIntake} from './stock-intake.js';
import {createBarcodePanel} from './barcode-panel.js';
import {createProductIntakePanel} from './product-intake.js';
import {cashOptions,cashOptionsHtml,cashOptionsFromForm,cashCountHtml,updateCashCount,clearCashCount,mountCashOptions} from './cash-counting.js';
import {createWorkstationAccessPanel} from './workstation-access.js';
import {createCustomerDisplay,customerDisplayOptions,customerDisplayOptionsHtml,customerDisplayOptionsFromForm} from './customer-display.js';
import {createCatalogueTable,priceBuildHtml} from './catalogue-table.js';
import {displayPreferences,displayPreferencesHtml,displayPreferencesFromForm,cataloguePriceCents,variantOrder,TPV_VARIANT_ORDERS} from './display-preferences.js';
import {searchPreferences,searchPreferencesFromForm,searchPreferencesHtml,TPV_SEARCH_FIELDS} from './search-preferences.js';
import {cataloguePreferences,cataloguePreferencesFromForm,cataloguePreferencesHtml,visibleCatalogueCategories,catalogueDetails,variantDetails} from './catalogue-preferences.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value/100);
export function inputCents(value) {
 const match=String(value).trim().match(/^(0|[1-9][0-9]{0,6})(?:[,.]([0-9]{1,2}))?$/);
 if(!match)throw new Error('Escribe un importe válido, con un máximo de dos decimales.');
 return Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
}
const button=(action,label,kind='secondary',disabled=false)=>`<button type="button" class="btn ${kind}" data-tpv-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
const paymentLabel=method=>({cash:'Efectivo',card:'Tarjeta',bizum:'Bizum',transfer:'Transferencia',mixed:'Efectivo y otro medio'}[method]||method);

/** Shared Central workspace. Practice is deliberately explicit and isolated.
 * No code in this browser module can import the privileged checkout adapters.
 */
export function createTpvWorkspace({actor,can,storage,confirm=async()=>false,
 onConfigure=null,canConfigure=()=>false,onBilling=null,canBilling=()=>false,onCash=null,canCentralCash=()=>false,readSetup=null,createLiveAdapter=null,
 readConfiguration=null,configureWorkstation=null,drawerManagement=()=>null,workspacePreferences=null,receiptNumbering=null,menuLinksStore=null,returnPolicyStore=null,canReturnPolicy=()=>false,canAssign=()=>false,canCustomer=()=>false,canStock=()=>false,canCreateProduct=()=>false,canReadCost=()=>false,autoOpen=false}={}) {
 let categories=[],categoryId=0,initialCategoryId=0,catalogueView='grid',incidentForm=false;
 let includeDisabledStock=false;
 let scanQueue=[],scanning=false,mobilePane='catalogue';
 let catalogueSort={field:'name',direction:'asc'},catalogueRefreshTimer=null;
 let variantGroupId=0,variantProductName='',variantView='',parentCatalogueSort=null;
 let displayOptions=displayPreferences(),audioFeedback=null,searchOptions=searchPreferences(),catalogueOptions=cataloguePreferences();
 let stockRules=stockPolicy(),priceRules=lineOptions(),parkingRules=parkingOptions();
 let budgetPage={items:[],hasMore:false},selectedBudget=null,budgetEditing=false,budgetQuery='',budgetPending=false;
 const quantityPicker=createQuantityPicker(),lineNameEditor=createLineNameEditor();
 let receiptStyle=receiptOptions(),numbering=null;
 let cashStyle=cashOptions();
 let drawerPayments=null,customMenuLinks=[],returnRules={allowPartial:true};
 let customerScreenOptions=customerDisplayOptions();
 let orderLookup='',focusOrderLookup=false;
 let host=null,adapter=null,context=null,session=null,products=[],lines=[],search='',tab='sale',notice='',failure='',
  busy=false,payment=null,receipt=null,history=[],summary=null,generation=0,searchTimer=null,abort=null,
  returnForm=null,paymentValues={},formValues={},formDirty=false,selectedStore='',selectedDrawer='',searchRevision=0,setup=null,
  productPage=0,variantProduct=0,stockProduct=null,configuration=null,configurationId=null,documentPreview=null,selectedCustomer=null,parked=[],draftInfo=null;
 const live=()=>adapter?.mode==='qa';
 let catalogueStatus={phase:'idle'};
 function catalogueStatusText(){const state=catalogueStatus;if(globalThis.navigator?.onLine===false)return 'Sin conexión · consulta el catálogo guardado.';if(state.phase==='preparing')return state.products?`Guardando catálogo · ${state.completedProducts} de ${state.products} productos`:'Preparando catálogo guardado…';if(state.phase==='updated')return 'Catálogo guardado actualizado';if(state.phase==='retry')return 'No se pudo actualizar el catálogo guardado. Volveremos a intentarlo automáticamente.';return 'Catálogo guardado pendiente de actualizar';}
 const catalogueBackground=createCatalogueBackground({onState:state=>{catalogueStatus=state;const node=host?.querySelector('[data-tpv-catalogue-status]');if(node)node.textContent=catalogueStatusText();},current:()=>host&&allowed()&&mountedActor===identity()&&live()&&session&&adapter.prepareOfflineCatalogue?{key:JSON.stringify([generation,identity(),session.id,session.storeId,session.drawerId,selectedCustomer]),prepare:options=>adapter.prepareOfflineCatalogue(options)}:null,canRun:()=>!busy&&!payment&&!returnForm&&globalThis.navigator?.onLine!==false});
 const offlinePanel=createOfflinePanel({storage,getAdapter:()=>adapter,isCurrent:()=>!!host&&allowed()&&mountedActor===identity()&&live(),getScope:()=>{const drawer=context?.drawers.find(row=>row.id===session?.drawerId);return {actorId:identity(),connectionId:drawer?.connectionId,storeId:session?.storeId,shopId:drawer?.shopId,drawerId:session?.drawerId,cashSessionId:session?.id};}});
 function stationPermission(key){if(!live())return true;const drawer=context?.drawers.find(row=>row.id===(session?.drawerId||selectedDrawer||context.drawers[0]?.id));return !!drawer&&drawer[key]===true;}
 const canSell=()=>can('create')&&stationPermission('canSell'),canManageCash=()=>can('create')&&stationPermission('canOpen'),
  canReceiveStock=()=>canStock()&&stationPermission('canSell');
 const receiptDelivery=createReceiptDelivery({getDocument:args=>adapter.document(args),print:printReceipt});
 const reports=createCashReportsPanel({adapter:()=>adapter,canOpenCentral:()=>live()&&!!onCash&&canCentralCash(),capturePrintContext:()=>{const run=generation,operator=identity();return()=>run===generation&&operator===identity()&&allowed();}});
 const stockIntake=createStockIntake({adapter:()=>adapter,canEdit:canReceiveStock});
 const barcodePanel=createBarcodePanel({adapter:()=>adapter,canRead:()=>live()&&canReadCost()&&stationPermission('canReconcile'),canEdit:()=>live()&&canStock(),onProgress:()=>render(),confirm:message=>askCurrent(message,{acceptLabel:'Cancelar trabajo'})});
 const productIntake=createProductIntakePanel({adapter:()=>adapter,canCreate:()=>live()&&!!session&&canSell()&&canCreateProduct()&&!payment&&!returnForm&&receipt?.status!=='uncertain',
  canRead:()=>live()&&(canReadCost()||canCreateProduct())&&stationPermission('canReconcile'),
  confirmDiscard:message=>askCurrent(message,{acceptLabel:'Continuar'}),onProgress:()=>render()});
 const catalogueTable=createCatalogueTable({canReadCost});
 const accessPanel=createWorkstationAccessPanel({canManage:canAssign,invoke:request=>configureWorkstation(request)});
 const customerScreen=createCustomerDisplay({getOptions:()=>customerScreenOptions,
  allowed:()=>!!host&&mountedActor===identity()&&allowed()&&!!adapter&&!!context&&!!session,
  canShowCustomer:()=>canCustomer('view')===true,getState:()=>{
   const phase=returnForm?'idle':receipt?.status==='confirmed'?'confirmed':receipt?.status==='uncertain'?'uncertain':payment?'verified':lines.length?'estimate':'idle';
   return {storeName:context?.stores.find(s=>s.id===(session?.storeId||selectedStore))?.name,environment:live()?'qa':'practice',phase,customerName:selectedCustomer?.name,discountCents:payment?.discountCents,
    totalCents:receipt?.totalCents??payment?.totalCents??previewTotal(),
    lines:shownLines().map(l=>({name:l.name,quantity:l.qty,cents:previewLine(l)}))};
  }});
 const wording=(practice,actual)=>live()?actual:practice;
 const customers=createTpvCustomerPanel({adapter:()=>adapter,can:action=>canCustomer(action)&&(action==='view'||canSell()),onSelect:async value=>{selectedCustomer=value;notice='';for(const line of lines)line.pricePending=true;await reloadProducts();void refreshBasketPrices();},
  onStatus:value=>notice=value,confirmDiscard:()=>askCurrent('¿Descartar los cambios de esta ficha?',{acceptLabel:'Descartar cambios'})});
 function allowed(){return actor()?.active!==false&&!!actor()?.id&&can('view');}
 function identity(){return `${actor()?.id||''}`;}
 let mountedActor='',onlineSyncRequested=false,onlineSyncTimer=null;
 function bindAdapter(raw){const born=generation;
  return Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,typeof value!=='function'?value:
   async(...args)=>{if(born!==generation)throw new Error('La vista ha cambiado.');guard();
    const result=await value(...args);if(born!==generation)throw new Error('La vista ha cambiado.');guard();return result;}]));}
 function bindPractice(){let practiceStorage=storage;
  try{practiceStorage??=globalThis.localStorage;}catch{throw new Error('Este navegador no permite guardar la práctica. Revisa sus permisos de almacenamiento.');}
  return bindAdapter(createTpvPracticeAdapter({actorId:identity(),storage:practiceStorage}));}
 const guard=()=>{if(!host||!allowed()||mountedActor!==identity())throw new Error('La sesión ha cambiado. Vuelve a entrar en TotusTPV.');};
 function contextBar(){const storeId=session?.storeId||selectedStore||context.stores[0]?.id;
  const drawers=context.drawers.filter(d=>d.storeId===storeId);
  return `<div class="tpv-context"><label>Tienda<select data-tpv-store ${session?'disabled':''}>
  ${context.stores.map(s=>`<option value="${esc(s.id)}" ${s.id===storeId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
  <label>Caja<select data-tpv-drawer ${session?'disabled':''}>${drawers.map(d=>`<option value="${esc(d.id)}" ${d.id===(session?.drawerId||selectedDrawer||drawers[0]?.id)?'selected':''}>${esc(d.name)}</option>`).join('')||'<option value="">Sin cajas disponibles</option>'}</select></label>
  <span><b>${esc(actor()?.full_name||'Operador')}</b><small>${session?wording('Caja de práctica abierta','Caja abierta · preproducción'):'Caja sin abrir'}</small></span>
  </div>`;}
 function render() {
  catalogueBackground.update();
  if(!host)return;
  productIntake.capture(host);
  if(!allowed()||mountedActor!==identity()){const root=host;dispose();root.innerHTML='<p role="alert">La sesión ha cambiado. Vuelve a entrar en TotusTPV.</p>';return;}
  customerScreen.sync();
  host.classList.toggle('tpv-active',!!adapter&&!!context);sizeWorkspace();
  const scanningInput=scanning?host.querySelector('[data-tpv-search]'):null,
   scanInputState=scanningInput?{value:scanningInput.value,start:scanningInput.selectionStart,end:scanningInput.selectionEnd,focused:document.activeElement===scanningInput}:null;
  if(!adapter||!context){host.innerHTML=`<section class="tpv-activation" aria-busy="${busy}">
   <header><span class="tpv-entry-eyebrow">MOSTRADOR</span><h3>${busy?'Abriendo tu caja…':'Tu tienda, lista para trabajar'}</h3>
   <p>${busy?'Estamos recuperando tus tiendas, cajas y preferencias.':'Entra con tu cuenta y continúa en la caja de tu establecimiento.'}</p></header>
   ${failure?`<p class="note bad" role="alert">${esc(failure)}</p>`:notice?`<p class="note" role="status">${esc(notice)}</p>`:''}
   ${!busy?`<div class="tpv-entry-options"><article><h4>Entrar al mostrador</h4><p>Elige tu tienda y caja. Si ya tienes una caja abierta, recuperarás la sesión.</p>${createLiveAdapter?button('live',failure?'Volver a intentar':'Entrar al mostrador','primary'):''}<small>Disponible ahora en la tienda de pruebas. Los pedidos y las existencias se registran en esa tienda.</small></article>
   <article><h4>Aprender a usarlo</h4><p>Practica una venta, un cobro o un cierre de caja con artículos ficticios.</p>${button('practice','Probar con datos ficticios')}<small>La práctica no crea pedidos ni mueve dinero o existencias.</small></article></div>`:'<p class="tpv-entry-loading" role="status">Consultando tus cajas disponibles…</p>'}
   ${!busy&&(canAssign()&&readConfiguration||readSetup||onConfigure&&canConfigure())?`<details class="tpv-entry-administration" ${configuration||setup?'open':''}><summary>Administrar tiendas y cajas</summary><p>Prepara el acceso de los empleados y comprueba la conexión del establecimiento.</p><div class="inline-actions">${canAssign()&&readConfiguration?button('assign','Asignar tienda y caja'):''}${readSetup?button('setup','Comprobar conexión'):''}${onConfigure&&canConfigure()?button('configure','Gestionar conexiones'):''}</div>${configuration?configurationHtml():''}${setup?setupHtml():''}</details>`:''}
   </section>`;host.querySelectorAll('label').forEach(el=>el.classList.add('field'));return;}
  const status=failure?`<p class="note bad" role="alert">${esc(failure)}</p>`:notice?`<p class="note" role="status">${esc(notice)}</p>`:'';
  host.innerHTML=`<header class="tpv-workspace-bar">${contextBar()}<span class="tpv-environment" title="${wording('Artículos y cobros ficticios. No se modifica la tienda.','Los cobros crean pedidos y modifican stock en la web de pruebas.')}">${wording('Práctica','Tienda de pruebas')}</span>${button('fullscreen','Pantalla completa')}</header>
   <nav class="module-tabs tpv-main-nav" aria-label="TotusTPV"><button type="button" class="tab ${tab==='sale'?'active':''}" data-tpv-action="sale">Venta</button>
   <button type="button" class="tab ${tab==='history'?'active':''}" data-tpv-action="history">${wording('Tickets de práctica','Pedidos y devoluciones')}</button>
   <button type="button" class="tab ${tab==='session'?'active':''}" data-tpv-action="session">Caja</button><details class="tpv-actions"><summary>Más acciones</summary><div>${live()?`${button('reports','Informes de caja')}${button('drafts','Tickets aparcados')}${button('budgets','Presupuestos')}${canReceiveStock()?button('stock','Entrada de stock'):''}${session&&canSell()&&canCreateProduct()?button('new-product','Nuevo producto'):''}${canReadCost()?button('product-history','Altas de productos'):''}${canReadCost()?button('barcodes','Códigos de barras'):''}${session?button('offline-pending','Ventas pendientes de sincronizar'):''}${button('settings','Configuración')}${menuLinksActions(customMenuLinks)}${customerScreenOptions.enabled&&session?button('customer-display','Pantalla para cliente'):''}`:''}${button('exit','Salir del puesto')}</div></details></nav><div class="tpv-workarea">${status}${live()&&!canSell()?'<p class="note" role="status">'+(canManageCash()?'Puedes consultar y gestionar la caja. Tu acceso no permite registrar ventas.':'Acceso de consulta. No puedes registrar ventas ni movimientos de efectivo.')+'</p>':''}
   ${live()&&session&&adapter.prepareOfflineCatalogue?`<p class="small muted" data-tpv-catalogue-status>${esc(catalogueStatusText())}</p>`:''}${documentPreview?nativeReceiptHtml(documentPreview,effectiveReceiptStyle()):''}${live()?customers.html()+reports.html():''}<div data-tpv-body>${tab==='offline-pending'?offlinePanel.html():tab==='barcodes'?barcodePanel.html():tab==='settings'?settingsHtml()+paymentSettingsHtml(drawerPayments,canAssign(),formValues['payment-settings']):tab==='configuration'&&configuration?`<section class="card card-pad"><h3>Configuración de TotusTPV</h3>${configurationHtml()}</section>`:reports.isOpen()?'':tab==='history'?historyHtml():tab==='budgets'?budgetsHtml():!session?openingHtml():tab==='session'?sessionHtml():tab==='drafts'?draftsHtml():tab==='stock'?stockHtml():receipt?receiptHtml():saleHtml()}</div></div>${live()?productIntake.html(failure):''}`;
  host.querySelectorAll('label').forEach(el=>el.classList.add('field'));
  reflectPaymentMethod();
  host.querySelectorAll('button,select,input').forEach(el=>{if(busy&&!(scanning&&el.matches('[data-tpv-search]')))el.disabled=true;});
  if(scanInputState){const next=host.querySelector('[data-tpv-search]');if(next){next.value=scanInputState.value;if(scanInputState.focused){next.focus();next.setSelectionRange(scanInputState.start,scanInputState.end);}}}
  const variantDialog=host.querySelector('.tpv-variant-dialog');if(variantDialog){variantDialog.showModal();variantDialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)variantDialog.querySelector('[data-tpv-action=back-products]').click();});}
  catalogueTable.mount(host);
  productIntake.mount(host);
  mountCashOptions(host);
  mountSettingsNavigation(host);
  host.querySelector('.tpv-actions')?.addEventListener('toggle',fitActionsMenu);
  if(!busy&&tab==='history'&&focusOrderLookup){const field=host.querySelector('[data-tpv-order-search] [name=orderId]');if(field){field.focus();field.select();focusOrderLookup=false;}}
 }
 function settingsHtml(){const draftView=formValues.preferences?.viewMode||catalogueView,draftCategory=Number(formValues.preferences?.initialCategoryId??initialCategoryId);return `<section class="card card-pad tpv-settings"><h3>Configuración de TotusTPV</h3><form data-tpv-form="preferences"><h4>Mostrador · tu cuenta y esta caja</h4><label>Vista al iniciar<select name="viewMode">${[['grid','Fotos'],['compact','Compacta'],['list','Lista'],['table','Tabla']].map(([id,label])=>`<option value="${id}" ${id===draftView?'selected':''}>${label}</option>`).join('')}</select></label><label>Categoría al iniciar<select name="initialCategoryId"><option value="0">Todas las categorías</option>${categories.map(c=>`<option value="${c.id}" ${c.id===draftCategory?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label><fieldset><legend>Artículos y ticket</legend>${displayPreferencesHtml(formValues.preferences?displayPreferencesFromForm(new Map(Object.entries(formValues.preferences))):displayOptions)}</fieldset>${searchPreferencesHtml(formValues.preferences?searchSettingsDraft():searchOptions)}${cataloguePreferencesHtml(formValues.preferences?cataloguePreferencesFromForm(new Map(Object.entries(formValues.preferences))):catalogueOptions,categories)}${lineOptionsHtml(formValues.preferences?lineOptionsFromForm(new Map(Object.entries(formValues.preferences))):priceRules,can('edit'))}${parkingOptionsHtml(formValues.preferences&&canSell()?parkingOptionsFromForm(new Map(Object.entries(formValues.preferences))):parkingRules,canSell())}${stockPolicyHtml(formValues.preferences&&canSell()?stockPolicyFromForm(new Map(Object.entries(formValues.preferences))):stockRules,canSell())}${receiptOptionsHtml(receiptSettingsDraft())}${cashOptionsHtml(cashSettingsDraft())}${customerDisplayOptionsHtml(formValues.preferences?customerDisplayOptionsFromForm(new Map(Object.entries(formValues.preferences))):customerScreenOptions)}<section class="tpv-receipt-preview" aria-label="Vista previa del justificante"><h4>Vista previa</h4><div data-tpv-receipt-preview>${receiptPreviewHtml(receiptSettingsDraft())}</div></section><p class="small muted">Se guarda en tu cuenta de Central y se recupera en otros ordenadores. Las columnas de la vista Tabla se configuran desde su propio botón Columnas.</p><button class="btn primary" type="submit">Guardar mostrador</button></form>${numbering?receiptSeriesHtml(numbering,can('edit'),formValues['receipt-series']):''}${menuLinksStore?menuLinksHtml(customMenuLinks,formValues['menu-links']):''}${returnPolicyStore?returnPolicyHtml(returnRules,canReturnPolicy(),formValues['return-policy']):''}${canAssign()&&readConfiguration?`<div class="tpv-settings-admin"><h4>Puestos y operadores</h4><p>Asigna establecimientos, cajas y medios de cobro a los usuarios de Central.</p>${button('assign','Configurar puesto y operadores')}</div>`:''}</section>`;}
 function effectiveReceiptStyle(){return {...receiptStyle,showTaxBreakdown:displayOptions.showTaxBreakdown};}
 function receiptSettingsDraft(){return {...(formValues.preferences?receiptOptionsFromForm(new Map(Object.entries(formValues.preferences))):receiptStyle),showTaxBreakdown:formValues.preferences?formValues.preferences.showTaxBreakdown==='on':displayOptions.showTaxBreakdown};}
 function cashSettingsDraft(){const selected=formValues.preferences?.cashDenominations;return selected===undefined?cashStyle:{denominations:(Array.isArray(selected)?selected:[selected]).map(Number)};}
 function updateReceiptPreview(target){if(!target.name?.startsWith('receipt-')&&target.name!=='showTaxBreakdown')return;
  const preview=host?.querySelector('[data-tpv-receipt-preview]');if(preview)preview.innerHTML=receiptPreviewHtml({...receiptOptionsFromForm(new FormData(target.form)),showTaxBreakdown:new FormData(target.form).get('showTaxBreakdown')==='on'});}
 function configurationHtml(){if(accessPanel.isEditing())return accessPanel.html();const c=configuration,store=c.stores.some(row=>row.id===formValues.configure?.store)?formValues.configure.store:c.stores[0]?.id,
  drawers=c.drawers.filter(row=>row.store_id===store);
  return `<form data-tpv-form="configure" class="tpv-configuration"><h4>Asignar un puesto de preproducción</h4><p>${esc(c.origin)} · conexión verificada, revisión ${c.revision}. Selecciona establecimientos y usuarios ya registrados en Central.</p>
   <div class="inline-actions">${drawerManagement()?`<a class="btn" href="${esc(drawerManagement())}" target="_blank" rel="noopener">Crear y gestionar cajas ↗</a>`:''}${button('refresh-configuration','Actualizar tiendas y cajas')}</div><p class="small muted">La gestión se abre en otra pestaña. Al volver, actualiza esta lista para ver las cajas guardadas. Tus selecciones y el ticket se conservan.</p>
   <label>Establecimiento<select name="store" data-tpv-config-store required>${c.stores.map(row=>`<option value="${esc(row.id)}" ${row.id===store?'selected':''}>${esc(row.name)}</option>`).join('')}</select></label>
   <label>Caja<select name="drawer" required ${drawers.length?'':'disabled'}>${drawers.length?'':'<option value="">Todavía no hay cajas en este establecimiento</option>'}${drawers.map(row=>`<option value="${esc(row.id)}" ${row.id===formValues.configure?.drawer?'selected':''}>${esc(row.name)}</option>`).join('')}</select></label>
   ${!c.stores.length?'<p class="note" role="status">Crea primero un establecimiento y su caja desde Crear y gestionar cajas. Después pulsa Actualizar tiendas y cajas.</p>':!drawers.length?'<p class="note" role="status">Este establecimiento todavía no tiene cajas. Crea una caja y actualiza esta lista para poder asignarla.</p>':''}
   <label>Operador<select name="operator" required>${c.operators.map(row=>`<option value="${esc(row.id)}" ${row.id===(formValues.configure?.operator||c.actorId)?'selected':''}>${esc(row.full_name||row.id)}</option>`).join('')}</select></label>
   <label>Tienda nativa de PrestaShop<input name="shop" type="number" min="1" step="1" required value="${esc(formValues.configure?.shop||'1')}"></label>
   <fieldset><legend>Medios de cobro · efectivo y tarjeta incluidos</legend>${['bizum','transfer'].map(method=>`<label class="tpv-check"><input name="${method}" type="checkbox" ${formValues.configure?.[method]==='on'?'checked':''}> Habilitar ${paymentLabel(method)} confirmado por el cajero</label>`).join('')}<small>Habilita sólo medios que utilice el establecimiento. Un pago pendiente de recibir no se registra como cobrado.</small></fieldset>
   <label>Uso del mostrador<select name="role"><option value="sell">Vender y consultar pedidos</option><option value="view" ${formValues.configure?.role==='view'?'selected':''}>Consultar pedidos</option></select></label>
   <label class="tpv-check"><input name="cashAccess" type="checkbox" ${!formValues.configure||formValues.configure.cashAccess==='on'?'checked':''}> Permitir abrir, gestionar efectivo y cerrar caja</label>
   <label class="tpv-check"><input name="accepted" type="checkbox" required> Preparar el perfil de pruebas y asignar los permisos seleccionados. Se crearán únicamente los datos auxiliares de mostrador que falten en preproducción.</label>
   <div class="inline-actions"><button class="btn primary" type="submit" ${busy||!drawers.length||!c.operators.length?'disabled':''}>Preparar y asignar puesto</button>${button('cancel-configuration','Cancelar')}</div>
   <small>Requiere la capacidad nativa de Totus y su permiso API en la web de pruebas. Este formulario no instala software ni modifica permisos de los demás módulos.</small></form>${accessPanel.html()}`;}
 function setupHtml(){return `<section class="tpv-setup" aria-label="Estado del puesto"><h4>Webs y cajas registradas</h4>
  ${setup.websites.map(row=>`<article><div><strong>${esc(row.websiteName)}</strong><small>${esc(row.origin||'Dirección de web no verificada')}</small></div>
   <div><span>${row.connectionVerified?'API verificada':'API pendiente de verificación'}</span><small>${esc(row.storeName||'Sin establecimiento asignado')}</small>
   <small>${row.storeId?(row.drawers.length?row.drawers.map(drawer=>esc(drawer.name)).join(' · '):'Sin cajas activas'):'Asigna primero su establecimiento en Conexiones.'}</small></div></article>`).join('')||'<p>No hay webs registradas disponibles para tu cuenta.</p>'}
  <p class="small muted">Esta consulta no habilita ventas. La asignación del operador, el circuito de pedido y la sesión de caja siguen pendientes de comprobar.</p></section>`;}
 function openingHtml(){if(live()&&!canManageCash())return `<section class="card card-pad tpv-opening"><h3>Caja sin abrir</h3><p>Tu acceso no permite abrir esta caja. Puedes revisar pedidos e informes y actualizar las cajas para comprobar si una persona autorizada ya la ha abierto.</p>${button('refresh-workstation','Actualizar cajas')}</section>`;return `<section class="card card-pad tpv-opening"><h3>${wording('Abrir caja de práctica','Abrir caja')}</h3><p>${wording('Indica el efectivo ficticio con el que empieza la sesión.','Indica el fondo inicial de efectivo de este puesto de pruebas.')}</p>
  <form data-tpv-form="open"><label>Fondo inicial · €<input name="opening" inputmode="decimal" value="${esc(formValues.open?.opening??'100,00')}" required></label>${cashCountHtml('opening',cashStyle,formValues.open)}
  <button class="btn primary" type="submit" ${canManageCash()?'':'disabled'}>${wording('Abrir caja de práctica','Abrir caja')}</button></form></section>`;}
 function previewUnit(line){const local=currentBasketPreview(),index=lines.indexOf(line);if(!payment&&local&&index>=0)return local.units[index];if(!payment&&line.discountKind==='price'){try{const cents=inputCents(line.discountValue);return cents>0?cents:null;}catch{return null;}}return line.pricePending?null:line.unitCents;}
 let basketPreview=null,basketPriceRevision=0,basketPriceTimer=null;
 const basketPriceKey=()=>JSON.stringify([generation,identity(),session?.id,selectedCustomer,lines.map(l=>[l.productId,l.qty,l.discountKind,l.discountValue])]);
 function currentBasketPreview(){return basketPreview&&basketPreview.key===basketPriceKey()&&Date.now()<basketPreview.validUntil?basketPreview:null;}
 async function refreshBasketPrices(){
  if(!live()||payment)return;
  const revision=++basketPriceRevision,key=basketPriceKey();basketPreview=null;clearTimeout(basketPriceTimer);
  for(const line of lines)line.pricePending=true;
  reflectLineTotals();
  if(!lines.length||!adapter.localBasketPrices||lines.some(l=>l.discountKind&&l.discountKind!=='none'))return;
  try{
   const result=await adapter.localBasketPrices({lines:lines.map(l=>{const [productId,attributeId=0]=String(l.productId).split(':').map(Number);return {productId,attributeId,qty:l.qty};})});
   if(!host||!allowed()||payment||revision!==basketPriceRevision||key!==basketPriceKey()||Date.now()>=result.validUntil)return;
   const c=result.pricingContext,subtotal=roundPriceSubtotal(result.lines.map(l=>({unitMicros:l.unitTaxInclMicros,quantity:l.qty})),{mode:c.roundMode,type:c.roundType,computingPrecision:c.computingPrecision});
   basketPreview={key,validUntil:result.validUntil,units:result.lines.map(l=>roundPriceMicros(l.unitTaxInclMicros,c.roundMode)),amounts:subtotal.balancedLineCents};
   reflectLineTotals();basketPriceTimer=setTimeout(()=>{basketPreview=null;if(host)reflectLineTotals();},Math.max(1,result.validUntil-Date.now()));
  }catch{/* Missing local prices remain pending until the native quote is available. */}
 }
 function previewLine(line){if(payment&&Number.isSafeInteger(line.totalCents))return line.totalCents;const local=currentBasketPreview(),index=lines.indexOf(line);if(local&&index>=0)return local.amounts[index];const unit=previewUnit(line);return unit===null?null:unit*line.qty;}
 function previewTotal(){if(live()&&!payment&&(formValues.ticket?.discountKind||formValues.ticket?.coupon?.trim()))return null;const values=lines.map(previewLine);return values.some(value=>value===null)?null:values.reduce((sum,value)=>sum+value,0);}
 function reflectLineTotals(){for(const input of host?.querySelectorAll('[data-tpv-quantity]')||[]){const line=lines.find(row=>row.productId===input.dataset.tpvQuantity);if(!line)continue;const root=input.closest('.tpv-ticket-line'),amount=root?.querySelector(':scope > b'),unit=root?.querySelector(':scope > div > small');const warning=root?.querySelector('[data-tpv-stock-warning]');if(warning){warning.textContent=stockWarning(line);warning.hidden=!warning.textContent;}if(amount)amount.textContent=previewLine(line)===null?'—':money(previewLine(line));if(unit)unit.textContent=previewUnit(line)===null?'Precio pendiente de recalcular':money(previewUnit(line))+' / ud.';}
  for(const total of host?.querySelectorAll('.tpv-ticket-total strong,.tpv-mobile-total strong')||[])total.textContent=previewTotal()===null?'Por calcular':money(previewTotal());customerScreen.sync();}
 function shownLines(){if(!live()||!payment?.lines?.length)return displayOptions.ticketNewestFirst?[...lines].reverse():lines;
  const rows=payment.lines.map(row=>{const key=row.productId+':'+row.attributeId,source=lines.find(line=>line.productId===key);
   return {...source,productId:key,name:source?.name||'Artículo #'+row.productId+(row.attributeId?' · variante #'+row.attributeId:''),qty:row.qty,
    unitCents:Math.round(row.unitTaxInclMicros/10000),totalCents:row.lineTaxInclCents,pricePending:false};});
  return displayOptions.ticketNewestFirst?rows.reverse():rows;}
 const currentCatalogueFilters=()=>({hideUnavailable:tab==='stock'?false:catalogueOptions.hideUnavailable,excludedCategories:tab==='stock'?[]:catalogueOptions.excludedCategories});
 const inventoryCatalogueQuery=()=>tab==='stock'&&includeDisabledStock?{inventoryOnly:true}:{};
 const visibleCategories=(stock=tab==='stock')=>stock?categories:visibleCatalogueCategories(categories,catalogueOptions.excludedCategories);
 function catalogueControlsHtml(){if(variantProduct)return '';return `<div class="tpv-catalogue-controls">${live()?`<label>Categoría<select data-tpv-category><option value="0">Todas las categorías</option>${visibleCategories().map(c=>`<option value="${c.id}" ${c.id===categoryId?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>`:''}<label>Vista<select data-tpv-view>${[['grid','Fotos'],['compact','Compacta'],['list','Lista'],['table','Tabla']].map(([id,label])=>`<option value="${id}" ${id===catalogueView?'selected':''}>${label}</option>`).join('')}</select></label>${catalogueView==='table'?catalogueTable.settingsHtml():''}</div>`;}
 function catalogueItemsHtml(stock=false){const view=variantProduct?variantView:catalogueView;if(products.building)return priceBuildHtml(products.building);if(view==='table')return catalogueTable.html(products,{sortField:catalogueSort.field,sortDirection:catalogueSort.direction,canSelect:stock?canReceiveStock():canSell(),stock,stockPolicy:stockRules});
  return `<div class="tpv-product-list tpv-view-${view}">${products.map(p=>`<button type="button" class="tpv-product" ${stock?'data-tpv-stock':'data-tpv-add'}="${esc(p.id)}" ${p.offlineUnavailable||!stock&&p.saleEnabled===false||!stock&&!p.chooseVariant&&p.stock<=0&&!canExceedStock(p,stockRules)||!(stock?canReceiveStock():canSell())||payment?'disabled':''}>
   ${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="" loading="lazy" decoding="async" width="88" height="88" referrerpolicy="no-referrer">`:''}<span><strong>${esc(p.name)}</strong>${p.offlineUnavailable?'<small>Faltan precio y existencias guardados</small>':p.saleEnabled===false?'<small>Solo para reposición</small>':''}${variantDetails(p)?`<small class="tpv-variant-details">${esc(variantDetails(p))}</small>`:''}<small>${[displayOptions.showReferences?p.reference:'',displayOptions.showStock?(p.stock===null?'Existencias sin comprobar':p.chooseVariant?'Existencias por variante':p.stock<=0&&canExceedStock(p,stockRules)?'Existencias: '+p.stock:p.stock+' disponibles'):'',p.chooseVariant?'Elegir variante':p.stock<=0&&canExceedStock(p,stockRules)?'Venta sin existencias permitida':''].filter(Boolean).map(esc).join(' · ')}</small>${catalogueOptions.extraDetails&&catalogueDetails(p)?`<small class="tpv-product-details">${esc(catalogueDetails(p))}</small>`:''}</span>${displayOptions.showPrices?`<b>${cataloguePriceCents(p,displayOptions.priceMode)===null?'Precio no disponible':money(cataloguePriceCents(p,displayOptions.priceMode))}<small>${displayOptions.priceMode==='net'?'sin IVA':'con IVA'}</small></b>`:''}</button>`).join('')||'<p class="tpv-empty">No hay artículos con esa búsqueda.</p>'}</div>`;
 }
 function variantDialogHtml(){return `<dialog class="tpv-variant-dialog" aria-labelledby="tpv-variant-heading"><header><div><p class="small muted">Selecciona una variante</p><h3 id="tpv-variant-heading">${esc(variantProductName)}</h3></div>${button('back-products','Volver a productos')}</header>${failure?`<p role="alert" class="note bad">${esc(failure)}</p>`:''}<div class="tpv-variant-controls"><label>Atributo para ordenar<select data-tpv-variant-group><option value="0">Todos los atributos</option>${(products.variantGroups||[]).map(row=>`<option value="${row.id}" ${row.id===variantGroupId?'selected':''}>${esc(row.name)}</option>`).join('')}</select></label><label>Orden<select data-tpv-variant-order>${Object.entries(TPV_VARIANT_ORDERS).map(([id,label])=>`<option value="${id}" ${id===catalogueSort.field+':'+catalogueSort.direction?'selected':''}>${label}</option>`).join('')}</select></label><label>Vista<select data-tpv-view>${[['table','Tabla'],['grid','Fotos'],['compact','Compacta'],['list','Lista']].map(([id,label])=>`<option value="${id}" ${id===variantView?'selected':''}>${label}</option>`).join('')}</select></label>${variantView==='table'?catalogueTable.settingsHtml():''}</div>${catalogueItemsHtml()}<footer class="inline-actions">${button('catalogue-previous','Anterior','secondary',productPage===0)}<span>Página ${productPage+1}${Number.isSafeInteger(products.totalCount)?' · '+products.totalCount+' variantes':''}</span>${button('catalogue-next','Siguiente','secondary',!products.hasMore)}</footer></dialog>`;}
 function saleHtml(){return `<div class="tpv-sale-grid tpv-layout-${displayOptions.layout} tpv-pane-${mobilePane} ${payment?'tpv-checkout-grid':''}"><div class="tpv-mobile-switch">${button('show-products','Catálogo')}${button('show-ticket','Ticket · '+lines.reduce((n,l)=>n+l.qty,0))}</div><section class="tpv-panel tpv-catalogue" aria-label="Artículos" ${payment?'hidden':''}>
  <label>Buscar artículo<input type="search" inputmode="${searchOptions.numericKeyboard?'numeric':'search'}" data-tpv-search placeholder="${esc(searchOptions.fields.map(key=>TPV_SEARCH_FIELDS[key]).join(', '))}" value="${esc(search)}" autocomplete="off"></label>
  ${products.offlineCached?'<p role="status" class="note">Sin conexión · catálogo guardado. Los precios y existencias pueden haber cambiado.</p>'+ (products.offlineCoveragePartial?'<p class="small muted">La búsqueda incluye Productos. Las variantes sólo incluyen las consultadas anteriormente; los artículos sin datos de venta guardados no se pueden añadir todavía.</p>':''):''}${products.cacheUnavailable?'<p role="status" class="note">No se pudo guardar este catálogo para consultarlo sin conexión.</p>':''}${catalogueControlsHtml()}${variantProduct?variantDialogHtml():catalogueItemsHtml()}
  ${live()&&!variantProduct?`<div class="inline-actions">${variantProduct?button('back-products','Volver a productos'):''}${button('catalogue-previous','Anterior','secondary',productPage===0)}<span>Página ${productPage+1}${Number.isSafeInteger(products.totalCount)?' · '+products.totalCount+' artículos':''}</span>${button('catalogue-next','Siguiente','secondary',!products.hasMore)}</div>`:''}</section>
  <section class="tpv-panel tpv-ticket" aria-label="Ticket actual"><header><h3>${wording('Ticket de práctica','Venta actual')}</h3>${draftInfo?`<small>Ticket recuperado · ${esc(draftInfo.label)}</small>`:''}<span>${esc(wording('Cliente de mostrador ficticio',selectedCustomer?selectedCustomer.name+' · '+selectedCustomer.addressLabel:'Cliente de mostrador'))}</span>${live()&&!payment&&canCustomer('view')?button('customers','Elegir cliente'):''}</header>
  <div class="tpv-ticket-lines">${shownLines().map(l=>`<div class="tpv-ticket-line"><div><strong>${esc(l.name)}</strong>${live()&&!payment&&canSell()&&(l.customName||can('edit')&&priceRules.allowNameChanges&&l.temporaryLineNames)?`<button type="button" class="tpv-line-name-button" data-tpv-line-name="${esc(l.productId)}" aria-label="Cambiar nombre de ${esc(l.name)}">Cambiar nombre</button>`:''}<small>${previewUnit(l)===null?'Precio pendiente de recalcular':money(previewUnit(l))+' / ud.'}</small><small class="tpv-stock-warning" data-tpv-stock-warning ${stockWarning(l)?'':'hidden'}>${esc(stockWarning(l))}</small></div>
   <label class="tpv-quantity">Unidades<input type="number" min="${l.minimumQty||1}" max="10000" step="1" data-tpv-quantity="${esc(l.productId)}" value="${l.qty}" ${payment||!canSell()?'disabled':''}></label>
   <b>${previewLine(l)===null?'—':money(previewLine(l))}</b><button type="button" class="btn secondary" aria-label="Quitar ${esc(l.name)}" data-tpv-remove="${esc(l.productId)}" ${payment||!canSell()?'disabled':''}>×</button>
   ${live()&&!payment&&can('edit')?`<div class="tpv-line-discount"><label>Precio y descuento por unidad<select data-tpv-line-kind="${esc(l.productId)}"><option value="">Precio original</option><option value="percent" ${l.discountKind==='percent'?'selected':''}>Porcentaje · %</option><option value="amount" ${l.discountKind==='amount'?'selected':''}>Importe · €</option>${priceRules.allowPriceChanges&&l.unitPriceOverride||l.discountKind==='price'?`<option value="price" ${l.discountKind==='price'?'selected':''} ${!priceRules.allowPriceChanges?'disabled':''}>Fijar precio final · €</option>`:''}</select></label>${l.discountKind?`<label>${l.discountKind==='price'?'Precio final por unidad · €':'Valor'}<input data-tpv-line-value="${esc(l.productId)}" inputmode="decimal" value="${esc(l.discountValue??'')}"></label>`:''}</div>`:''}</div>`).join('')||'<p class="tpv-empty">Selecciona un artículo para empezar.</p>'}</div>
  ${!payment?`<footer class="tpv-ticket-footer"><div class="tpv-ticket-total"><span>Estimación antes de descuentos</span><strong>${previewTotal()===null?'Por calcular':money(previewTotal())}</strong></div>`:''}
  ${live()&&!payment?`<details class="tpv-ticket-options" ${priceRules.requireSaleNote||formValues.ticket?.note||formValues.ticket?.discountKind||formValues.ticket?.coupon?'open':''}><summary>Opciones del ticket</summary><form data-tpv-form="ticket" class="tpv-ticket-adjustments"><label class="tpv-sale-note">Nota interna${priceRules.requireSaleNote?' · obligatoria para cobrar':' · opcional'}<textarea name="note" rows="2" placeholder="Solo visible para el equipo">${esc(formValues.ticket?.note??'')}</textarea><small>Solo para el equipo · Hasta 500 caracteres.</small></label><label>Descuento del ticket<select name="discountKind" ${!can('edit')?'disabled':''}><option value="">Sin descuento manual</option><option value="percent" ${formValues.ticket?.discountKind==='percent'?'selected':''}>Porcentaje · %</option><option value="amount" ${formValues.ticket?.discountKind==='amount'?'selected':''}>Importe · €</option></select></label><label>Valor del descuento<input name="discountValue" inputmode="decimal" value="${esc(formValues.ticket?.discountValue??'')}" ${!can('edit')?'disabled':''}></label><label>Cupón de la tienda<input name="coupon" maxlength="100" value="${esc(formValues.ticket?.coupon??'')}" ${!can('edit')?'disabled':''}></label><label>Nombre para aparcar<input name="draftLabel" maxlength="120" placeholder="Opcional" value="${esc(formValues.ticket?.draftLabel??draftInfo?.label??'')}"></label></form></details>`:''}
  ${!payment?`<div class="inline-actions">${button('clear','Vaciar ticket','secondary',!lines.length&&!draftInfo||!canSell())}${live()?button('park','Aparcar ticket','secondary',!lines.length||!canSell()||!parkingRules.enabled):''}${live()?button('save-budget','Guardar presupuesto','secondary',!lines.length||!canSell()):''}${button('payment',wording('Preparar cobro de práctica','Calcular y cobrar'),'primary',!lines.length||!canSell())}</div>${live()&&!parkingRules.enabled?'<p class="small muted" role="status">El aparcado está desactivado para tu cuenta y esta caja. Los tickets anteriores siguen en Más acciones · Tickets aparcados.</p>':''}`:''}
  ${!payment?'</footer>':''}${payment?paymentHtml():''}</section><div class="tpv-mobile-total"><strong>${previewTotal()===null?'Por calcular':money(previewTotal())}</strong>${button('show-ticket','Ver ticket','primary',!lines.length)}</div></div>`;}
 function paymentHtml(){return `<form data-tpv-form="pay" class="tpv-payment"><h4>${payment.localEstimate?'Cobro sin conexión':wording('Cobro de práctica','Cobro · cálculo verificado en la tienda')}</h4>${payment.localEstimate?'<p>Importe calculado con el catálogo guardado. La venta quedará pendiente de comprobar y registrar cuando vuelva la conexión.</p>':''}${payment.discountCents?`<p>Descuento del ticket: −${money(payment.discountCents)}</p>`:''}${taxSummaryHtml(payment,displayOptions.showTaxBreakdown)}<p class="tpv-payment-amount">Total <strong>${money(payment.totalCents)}</strong></p>
  <label>Forma de pago<select name="method" data-tpv-method>${paymentFormMethods(payment.paymentMethods).map(key=>`<option value="${key}" ${paymentValues.method===key?'selected':''}>${esc(payment.paymentLabels?.[key]||paymentLabel(key))}${!live()?' · práctica':''}</option>`).join('')}</select></label>
  <label data-tpv-external-method hidden>Segundo medio de pago<select name="externalMethod">${(payment.paymentMethods||['cash','card']).filter(method=>method!=='cash').map(method=>`<option value="${method}" ${paymentValues.externalMethod===method?'selected':''}>${esc(payment.paymentLabels?.[method]||paymentLabel(method))}</option>`).join('')}</select></label>
  <label data-tpv-cash-part hidden>Parte en efectivo · €<input name="cashPart" inputmode="decimal" value="${esc(paymentValues.cashPart??'0,00')}"></label>
  <label data-tpv-received>Efectivo recibido · €<input name="received" inputmode="decimal" placeholder="0,00" value="${esc(paymentValues.received??'')}" autocomplete="off"></label>${cashCountHtml('received',cashStyle,paymentValues)}
  <div class="tpv-denominations" data-tpv-denominations role="group" aria-label="Efectivo entregado">
   <button type="button" class="btn secondary" data-tpv-tender-exact>Importe exacto</button>
   ${cashStyle.denominations.filter(face=>face>=500).map(face=>`<button type="button" class="btn secondary" data-tpv-tender="${face}" aria-label="Entregado ${face/100} euros">${face/100} €</button>`).join('')}
  </div>
  ${paymentReferenceFields(payment,paymentValues)}<output class="tpv-tender-preview" data-tpv-tender-preview role="status" aria-label="Resumen del cobro" aria-live="polite"></output>
  <label class="tpv-check" data-tpv-card-accept hidden><input type="checkbox" name="cardAccepted" ${paymentValues.cardAccepted==='on'?'checked':''}> ${wording('Acepto el pago externo ficticio','He comprobado que el cobro externo está recibido. TotusTPV registra el cobro; no opera el datáfono ni el banco.')}</label>
  ${!live()?`<label>Simular resultado<select name="scenario">${[['normal','Venta correcta'],['lost-response','Respuesta perdida: recuperar sin repetir'],['rejected','Pago rechazado']].map(([key,label])=>`<option value="${key}" ${paymentValues.scenario===key?'selected':''}>${label}</option>`).join('')}</select></label>`:''}
  <div class="inline-actions">${button('cancel-payment','Volver al ticket')}<button class="btn primary" type="submit">${payment.localEstimate?'Guardar venta en este dispositivo':wording('Confirmar venta de práctica','Confirmar cobro y crear pedido')}</button></div></form>`;}
 function receiptHtml(){if(receipt.localQueued)return `<section class="card card-pad tpv-receipt" aria-label="Resultado de venta"><h3>Venta guardada en este dispositivo</h3><p><b>${esc(receipt.reference)}</b> · ${money(receipt.totalCents)}</p><p>Cambio: ${money(receipt.changeCents||0)}</p><p>Se enviará automáticamente cuando vuelva la conexión. No vuelvas a cobrar esta venta.</p><small>Pendiente de registrar en la tienda.</small><div class="inline-actions">${button('recover','Sincronizar ahora','primary')}${button('next','Nuevo ticket')}</div></section>`;if(receipt.status==='cancelled')return `<section class="card card-pad tpv-receipt"><h3>Intento cerrado sin pedido</h3><p>Se conserva la incidencia y su revisión. No se ha vuelto a enviar la venta.</p>${button('next','Nuevo ticket','primary')}</section>`;const uncertain=receipt.status!=='confirmed';return `<section class="card card-pad tpv-receipt" aria-label="Resultado de venta"><h3>${receipt.needsReview?'Venta pendiente de revisión':uncertain?'Respuesta pendiente de recuperar':wording('Venta de práctica registrada','Pedido verificado en PrestaShop')}</h3>
  <p><b>${esc(receipt.reference)}</b> · ${money(receipt.totalCents)}</p>${uncertain?'':taxSummaryHtml(receipt,displayOptions.showTaxBreakdown)}<p>${receipt.needsReview?'El cálculo o los datos de la venta necesitan revisión. No se enviará automáticamente ni debes volver a cobrar al cliente.':uncertain?'No confirmes otro ticket para repetir esta venta. Recupera el resultado de la misma operación.':wording('Cambio de práctica: ','Cambio devuelto: ')+money(receipt.changeCents||0)}</p>
  <small>${wording('Simulación: no existe pedido ni pago real en PrestaShop.',uncertain?'No se ha confirmado el resultado; consulta la misma operación.':'Pedido y pago registrados en preproducción.')}</small><div class="inline-actions">${uncertain?button('recover','Recuperar resultado','primary'):button('next','Nuevo ticket','primary')}${live()&&!uncertain?documentButtons(receipt.id):''}${live()&&uncertain&&canAssign()?button('review-incident','Revisar incidencia'):''}</div>${incidentForm?`<form data-tpv-form="incident" class="tpv-payment"><h4>Cerrar intento sin pedido</h4><p>El servidor comprobará que la ejecución terminó sin pedido. Revisa también que no quede ningún cobro externo pendiente.</p><label>Resultado de la revisión<select name="settlementReview"><option value="not-collected">No se recibió ningún cobro</option><option value="returned-externally">Cobro externo devuelto y comprobado</option></select></label><label>Motivo y comprobación<input name="reason" minlength="10" maxlength="500" required></label><label class="tpv-check"><input name="accepted" type="checkbox" required> He revisado el cobro y confirmo este resultado.</label><button class="btn primary" type="submit">Verificar y cerrar incidencia</button></form>`:''}</section>`;}
 function documentButtons(id){return `<details class="tpv-document-actions" ${busy?'inert':''}><summary class="btn secondary">Documentos</summary><div class="inline-actions">${[['receipt','Ticket'],['gift','Ticket regalo'],['invoice','Factura PDF'],['delivery','Albarán PDF']].map(([kind,label])=>`<button type="button" class="btn secondary" data-tpv-document="${kind}" data-sale-id="${esc(id)}">${label}</button>`).join('')}${live()&&onBilling&&canBilling()?`<button type="button" class="btn secondary" data-tpv-billing="${esc(id)}">Ver en Facturación</button>`:''}</div></details>`;}
 function draftsHtml(){return `<section class="card card-pad"><header class="inline-actions"><h3>Tickets aparcados · esta caja</h3>${button('refresh-drafts','Actualizar tickets')}</header><p class="small muted">Se muestran los últimos 100. Al recuperar se recalculan precios, impuestos y disponibilidad.</p>
  <div class="tpv-history">${parked.map(row=>{const expiry=parkingExpiry(row),current=row.status==='checkout'&&row.mine&&row.sessionId===session.id,
   available=row.status==='parked'||row.mine||row.sessionId!==session.id;
   return `<article><div><strong>${esc(row.label)}</strong><small>${row.lineCount} líneas · ${expiry.expired?'Caducado':row.status==='parked'?'Aparcado':row.mine?'En uso por ti':'En uso por otro operador'}</small><small>${expiry.expiresAt?'Validez hasta '+esc(new Date(expiry.expiresAt).toLocaleString('es-ES')):'Sin caducidad'}${expiry.expired?' · Se conserva para consulta y archivo.':''}</small></div>
    ${current?`<button type="button" class="btn secondary" data-tpv-recover="${esc(row.checkoutId)}">${expiry.expired?'Consultar cobro pendiente':'Continuar cobro'}</button>`:`<button type="button" class="btn secondary" data-tpv-draft-id="${esc(row.id)}" ${!available||expiry.expired||!canSell()?'disabled':''}>Recuperar ticket</button>`}
    ${canSell()&&can('edit')&&(row.status==='parked'||row.status==='claimed'&&row.mine)?`<button type="button" class="btn secondary" data-tpv-archive-draft="${esc(row.id)}">Archivar</button>`:''}</article>`;}).join('')||'<p>No hay tickets aparcados en esta caja.</p>'}</div></section>`;}
 function historyHtml(){return `<section class="card card-pad"><h3>${wording('Tickets de esta sesión de práctica','Pedidos y devoluciones · esta tienda')}</h3>${live()?`<form data-tpv-order-search class="inline-actions"><label>Número o referencia<input name="orderId" value="${esc(orderLookup)}" inputmode="text" maxlength="15" placeholder="Escanea o escribe el pedido"></label><button class="btn secondary" type="submit">Buscar pedido</button>${button('history',session?'Sesión actual':'Pedidos de esta tienda')}</form><p class="small muted">${esc(notice.startsWith('Historial:')?notice:'Sesión actual · últimos 100 registros. Busca un pedido de sesiones anteriores para reimprimir o devolver.')}</p>`:''}<div class="tpv-history">${history.map(op=>`<article><div><b>${esc(op.reference)}</b><small>${op.status==='confirmed'?wording('Registrado en práctica','Pedido registrado'):op.status==='ready'?'Cobro preparado; sin confirmar':op.status==='cancelled'?'Incidencia revisada · sin pedido':'Pendiente de recuperar'}${op.createdAt?' · '+esc(new Date(op.createdAt).toLocaleString('es-ES')):''}</small></div><strong>${money(op.totalCents)}</strong>
   ${op.status!=='confirmed'?`<button type="button" class="btn secondary" data-tpv-recover="${esc(op.id)}">${op.status==='ready'?'Continuar cobro':op.status==='cancelled'?'Ver incidencia':'Recuperar'}</button>`:`<button type="button" class="btn secondary" data-tpv-return="${esc(op.id)}" ${!session||!canSell()?'disabled':''}>Devolver</button>`}
   ${live()&&op.status==='confirmed'?documentButtons(op.id):''}${(op.refunds||[]).map(r=>r.status==='confirmed'?`<button type="button" class="btn secondary" data-tpv-document="credit-note" data-sale-id="${esc(op.id)}" data-refund-id="${esc(r.id)}">Abono PDF · ${money(r.totalCents)}</button>`:['ready','dispatched','uncertain'].includes(r.status)?`<button type="button" class="btn secondary" data-tpv-refund-recover="${esc(r.id)}">Devolución pendiente · ${money(r.totalCents)}</button>`:'').join('')}</article>`).join('')||'<p class="tpv-empty">No hay pedidos para esta consulta.</p>'}</div>${returnForm?returnHtml():''}</section>`;}
 function originalReturnReferences(){return `${live()&&Object.keys(returnForm.originalPaymentReferences||{}).length?`<section aria-label="Referencias del cobro original"><h4>Referencias del cobro original</h4>${Object.entries(returnForm.originalPaymentReferences).map(([method,reference])=>`<p>${esc(paymentLabel(method))} · ${esc(reference)}</p>`).join('')}<small>Úsalas para localizar el cobro. Comprueba el reintegro en el terminal antes de confirmarlo aquí.</small></section>`:''}`;}
 function returnHtml(){if(live()&&returnForm.prepared){const r=returnForm.prepared;return `<section class="tpv-payment"><h4>Confirmar devolución · ${esc(returnForm.reference)}</h4>${originalReturnReferences()}<strong>${money(r.totalCents)}</strong>
  ${r.payments?`<p>${r.payments.map(p=>`${paymentLabel(p.method)}: ${money(p.amountCents)}`).join(' · ')}</p>`:''}
  ${r.reason?`<p>Motivo: ${esc(r.reason)}</p>`:''}<p>${r.status==='ready'?'Revisa el importe. Devuelve el efectivo o comprueba el reintegro en el datáfono antes de confirmar.':'Resultado pendiente. No repitas el reintegro; recupera esta misma devolución.'}</p>
  <div class="inline-actions">${r.status==='ready'?button('cancel-return','Cancelar preparación')+button('confirm-refund','Confirmo el reintegro al cliente','primary'):button('recover-refund','Recuperar devolución','primary')}</div></section>`;}
  return `<form data-tpv-form="refund" class="tpv-payment"><h4>${wording('Devolución de práctica','Preparar devolución')} · ${esc(returnForm.reference)}</h4><p>${wording('El reintegro ficticio usa los medios de pago de la venta original.','Selecciona unidades y reposición. El siguiente paso mostrará los importes nativos antes de confirmar el reintegro.')}</p>
  ${originalReturnReferences()}
  <div class="inline-actions">${button('return-all','Seleccionar todas las unidades pendientes')}${button('return-clear','Quitar selección de unidades')}</div>
  ${returnForm.lines.map(line=>`<div class="tpv-return-line"><strong>${esc(line.name)}</strong><label>Cantidad a devolver (máx. ${line.remainingQty})<input name="qty-${esc(line.productId)}" type="number" min="0" max="${line.remainingQty}" step="1" value="${esc(formValues.refund?.['qty-'+line.productId]??'0')}"></label>
   <label class="tpv-check"><input name="restock-${esc(line.productId)}" type="checkbox" ${!formValues.refund||formValues.refund['restock-'+line.productId]==='on'?'checked':''}> ${wording('Reponer existencias de práctica','Reponer estas unidades en la tienda')}</label></div>`).join('')}
  ${live()?`<label>Reintegro<select name="refundMethod"><option value="original">Repartir entre los medios originales</option>${Object.entries(returnForm.availablePayments||{}).filter(([,amount])=>amount>0).map(([method,amount])=>`<option value="${esc(method)}" ${formValues.refund?.refundMethod===method?'selected':''}>${esc(paymentLabel(method))} · hasta ${money(amount)}</option>`).join('')}</select></label><label>Motivo de la devolución<input name="reason" maxlength="500" required value="${esc(formValues.refund?.reason||'')}"></label>`:''}
  ${!live()?`<label class="tpv-check"><input type="checkbox" name="refundAccepted" required ${formValues.refund?.refundAccepted==='on'?'checked':''}> Confirmo el reintegro ficticio; no se devuelve dinero real</label>`:''}
  <div class="inline-actions">${button('cancel-return','Cancelar devolución')}<button type="submit" class="btn primary">${wording('Registrar devolución de práctica','Calcular devolución')}</button></div></form>`;}
 function sessionHtml(){return `<section class="card card-pad tpv-session"><h3>${wording('Caja de práctica','Caja y arqueo')}</h3>${summary?`<dl><div><dt>Fondo inicial</dt><dd>${money(summary.openingCents)}</dd></div><div><dt>${wording('Ventas de práctica','Ventas registradas')}</dt><dd>${money(summary.salesCents)}</dd></div>
  <div><dt>Ventas en efectivo</dt><dd>${money(summary.cashCents)}</dd></div><div><dt>Reintegros en efectivo</dt><dd>${money(summary.refundCashCents||0)}</dd></div><div><dt>Efectivo esperado</dt><dd>${money(summary.expectedCashCents)}</dd></div>${['card','bizum','transfer'].filter(method=>summary.payments?.[method]||summary.refunds?.[method]).map(method=>`<div><dt>${esc(paymentLabel(method))} · cobros / reintegros</dt><dd>${money(summary.payments?.[method]||0)} / ${money(summary.refunds?.[method]||0)}</dd></div>`).join('')}</dl>
  ${live()&&canManageCash()?`<form data-tpv-form="movement"><h4>Movimiento de efectivo</h4><label>Tipo<select name="kind"><option value="cash-in">Entrada de efectivo</option><option value="cash-out" ${formValues.movement?.kind==='cash-out'?'selected':''}>Retirada de efectivo</option></select></label><label>Importe · €<input name="amount" inputmode="decimal" required value="${esc(formValues.movement?.amount??'')}"></label><label>Motivo<input name="reason" required maxlength="500" value="${esc(formValues.movement?.reason??'')}"></label><button class="btn secondary" type="submit">Registrar movimiento</button></form>`:''}
  ${summary.unresolved?'<p role="status">Recupera las ventas o devoluciones pendientes en el historial antes de cerrar.</p>':''}<form data-tpv-form="close"><fieldset class="tpv-cash-fields" ${canManageCash()?'':'disabled'}><label>Efectivo contado · €<input name="counted" inputmode="decimal" required value="${esc(formValues.close?.counted??(summary.expectedCashCents/100).toFixed(2).replace('.',','))}"></label>${cashCountHtml('counted',cashStyle,formValues.close)}${live()?`<label>Observaciones del arqueo<input name="note" maxlength="500" value="${esc(formValues.close?.note??'')}"></label>`:''}<button class="btn primary" type="submit" ${summary.unresolved||!canManageCash()?'disabled':''}>${wording('Cerrar caja de práctica','Cerrar caja')}</button></fieldset>${canManageCash()?'':'<p class="small muted">Tu acceso permite consultar esta caja. Los movimientos y el cierre corresponden a una persona autorizada para gestionar efectivo.</p>'}</form>`:''}</section>`;}
 function stockHtml(){return `<section class="card card-pad tpv-stock"><h3>Entrada de mercancía</h3><p>Registra unidades recibidas. La entrada se suma al stock nativo de la tienda seleccionada.</p>
  <label>Buscar producto<input type="search" inputmode="${searchOptions.numericKeyboard?'numeric':'search'}" data-tpv-search placeholder="${esc(searchOptions.fields.map(key=>TPV_SEARCH_FIELDS[key]).join(', '))}" value="${esc(search)}"></label>
  <label class="tpv-check"><input type="checkbox" data-tpv-disabled-stock data-draft-ignore ${includeDisabledStock?'checked':''} ${busy?'disabled':''}> Incluir artículos deshabilitados para reponer</label><p class="small muted">Reponer mercancía no activa estos artículos ni permite venderlos.</p>
  ${catalogueControlsHtml()}${catalogueItemsHtml(true)}
  <div class="inline-actions">${variantProduct?button('back-products','Volver a productos'):''}${button('catalogue-previous','Anterior','secondary',productPage===0)}${button('catalogue-next','Siguiente','secondary',!products.hasMore)}</div>
  ${stockIntake.html()}</section>`;}
 function searchSettingsDraft(){const values=formValues.preferences;if(!values)return searchOptions;
  // Preserve an empty selection so validation does not silently re-enable criteria.
  const fields=values.searchFields;return {fields:Array.isArray(fields)?fields:[],numericKeyboard:values.numericKeyboard==='on',includeDisabledStock:values.includeDisabledStock==='on'};}
 function rememberForm(target){const form=target.closest('[data-tpv-form]');if(!form||!host?.contains(form))return;
  const values=Object.fromEntries(new FormData(form));formValues[form.dataset.tpvForm]=values;
  if(form.dataset.tpvForm==='preferences'){values.cashDenominations=new FormData(form).getAll('cashDenominations');values.searchFields=new FormData(form).getAll('searchFields');values.excludedCategories=new FormData(form).getAll('excludedCategories');}
  if(form.dataset.tpvForm==='pay')paymentValues=values;formDirty=true;}
 const hasDraft=()=>!!host&&(lines.length>0||!!draftInfo||!!payment||!!returnForm||formDirty||receipt?.status==='uncertain'||customers.hasDraft()||stockIntake.hasDraft()||productIntake.hasDraft()||accessPanel.hasDraft());
 async function askCurrent(message,options){const run=generation,owner=identity();const accepted=await confirm(message,options);
  return accepted===true&&run===generation&&owner===identity()&&!!host;}
 async function requestLeave(){if(busy)return false;if(!hasDraft())return true;
  return askCurrent(wording('¿Salir de TotusTPV? Los cambios sin confirmar se perderán. Los tickets de práctica pendientes seguirán en su historial.',
   '¿Salir y descartar los cambios sin aparcar? Los tickets aparcados y las operaciones registradas seguirán en el servidor.'));}
 function scheduleCatalogueRefresh(){clearTimeout(catalogueRefreshTimer);if(!products.building)return;
  const run=generation,query=search,category=categoryId,variant=variantProduct,owner=session?.id,currentTab=tab;
  catalogueRefreshTimer=setTimeout(()=>{if(!host||run!==generation||session?.id!==owner||tab!==currentTab||search!==query||categoryId!==category||variantProduct!==variant||catalogueSort.field!=='price')return;
   if(busy){scheduleCatalogueRefresh();return;}void work(reloadProducts);},1000);
 }
 async function reloadProducts(overrides={}){clearTimeout(catalogueRefreshTimer);products=await adapter.searchProducts({sessionId:session.id,search:variantProduct?'':search,page:productPage,productId:variantProduct,categoryId:variantProduct?0:categoryId,variantGroupId:variantProduct?variantGroupId:0,sortField:catalogueSort.field,sortDirection:catalogueSort.direction,searchFields:searchOptions.fields,catalogueFilters:currentCatalogueFilters(),...inventoryCatalogueQuery(),...overrides});scheduleCatalogueRefresh();}
 async function work(fn){if(busy)return;guard();busy=true;failure='';const run=generation;render();try{await fn();}catch(error){if(run===generation)failure=error.message||'No se pudo completar la operación.';}finally{if(run===generation){busy=false;render();if(onlineSyncRequested&&canSyncAfterReconnect())queueMicrotask(syncAfterReconnect);}}}
 async function changeTab(next){barcodePanel.reset();searchRevision++;clearTimeout(searchTimer);if((tab==='stock')!==(next==='stock')){variantProduct=0;variantGroupId=0;productPage=0;catalogueSort=parentCatalogueSort||catalogueSort;parentCatalogueSort=null;}reports.reset();tab=next;if(session&&next==='sale'){if(categoryId&&!visibleCategories(false).some(row=>row.id===categoryId))categoryId=0;products=[];await reloadProducts();}if(!session&&live()&&next==='history'){history=await adapter.orders();orderLookup='';notice='Historial: últimos 100 pedidos confirmados de esta tienda.';focusOrderLookup=true;}if(session&&next==='history'){orderLookup='';if(notice.startsWith('Historial:'))notice='';history=await adapter.history({sessionId:session.id});focusOrderLookup=true;}if(session&&next==='session')summary=await adapter.sessionSummary({sessionId:session.id});if(session&&next==='drafts')parked=await adapter.drafts();if(session&&next==='stock'){await reloadProducts();await stockIntake.load();}}
 function canSyncAfterReconnect(){return globalThis.navigator?.onLine!==false&&!!host&&allowed()&&mountedActor===identity()&&live()&&!!session&&!!adapter.offlineDelivery&&!returnForm&&(!payment||receipt?.status==='uncertain');}
 function queueSyncRetry(){clearTimeout(onlineSyncTimer);onlineSyncTimer=setTimeout(()=>{onlineSyncTimer=null;onlineSyncRequested=true;syncAfterReconnect();},30000);}
 function syncAfterReconnect(){
  if(!onlineSyncRequested||busy||!canSyncAfterReconnect())return;
  onlineSyncRequested=false;clearTimeout(onlineSyncTimer);onlineSyncTimer=null;void work(async()=>{
   const run=generation,owner=identity(),cashSession=session.id,deviceId=offlineDevice(storage),journal=localJournal(deviceId),delivery=await adapter.offlineDelivery({deviceId});
   const sync=createOfflineSync({journal,adapter:delivery,isCurrent:()=>run===generation&&owner===identity()&&allowed()&&!!host&&session?.id===cashSession,shouldSynchronize:row=>row.ticket.cashSessionId===cashSession});
   const result=await sync.synchronizePending();
   if(receipt?.status==='uncertain'){const saved=await journal.get(receipt.id);if(saved?.status==='synced'){
    try{await recover(receipt.id);}catch(error){
     if(error?.code==='TPV_CONNECTION_UNAVAILABLE'&&run===generation&&owner===identity()&&allowed()&&host&&session?.id===cashSession){
      notice='La venta está sincronizada. Se recuperará su resultado automáticamente cuando vuelva la conexión.';queueSyncRetry();return;
     }
     throw error;
    }
   }else if(saved?.status==='conflict')receipt={...receipt,localQueued:false,needsReview:true};}
   if(result.pending){notice='Hay ventas guardadas pendientes de comprobar. Se volverá a intentar automáticamente; también puedes usar Sincronizar ahora.';queueSyncRetry();}
   else if(result.conflict)notice='Hay ventas guardadas que necesitan revisión. Consulta Ventas pendientes de sincronizar.';
   else if(result.synced)notice=result.synced===1?'Venta guardada sincronizada.':result.synced+' ventas guardadas sincronizadas.';
  });
 }
 function localJournal(deviceId){const drawer=context.drawers.find(row=>row.id===session.drawerId);return createOfflineJournal({scope:{actorId:identity(),connectionId:drawer.connectionId,storeId:session.storeId,shopId:drawer.shopId,drawerId:session.drawerId,deviceId}});}
 async function recover(operationId){incidentForm=false;
  const resultGeneration=generation,resultActor=identity(),resultSession=session?.id;
  if(live()&&session&&adapter.offlineDelivery){
   const recoveryGeneration=generation,recoveryActor=identity(),recoverySession=session.id;
   const deviceId=offlineDevice(storage),journal=localJournal(deviceId),saved=await journal.get(operationId);
   if(recoveryGeneration!==generation||recoveryActor!==identity()||recoverySession!==session?.id||!host)throw Error('La sesión ha cambiado. Vuelve a abrir sus ventas pendientes.');
   guard();
   if(saved&&saved.status!=='synced'){
    if(saved.ticket.cashSessionId!==session.id)throw Error('Esta venta pertenece a otra sesión de caja. Abre su caja original para recuperarla.');
    if(globalThis.navigator?.onLine===false){
     lines=[];payment=null;tab='sale';
     receipt={id:operationId,status:'uncertain',reference:'Ticket '+operationId.slice(0,8),totalCents:saved.ticket.totalCents,
      localQueued:saved.status==='queued',needsReview:saved.status==='conflict',
      changeCents:saved.ticket.payments.filter(row=>row.method==='cash').reduce((sum,row)=>sum+(row.receivedCents??row.amountCents)-row.amountCents,0)};
     notice=saved.status==='conflict'?'La venta necesita revisión. Conecta para comprobar su resultado.':'La venta está guardada. La sincronización continuará cuando vuelva la conexión.';
     return;
    }
    const run=generation,owner=identity(),cashSession=session.id,delivery=await adapter.offlineDelivery({deviceId});
    const sync=createOfflineSync({journal,adapter:delivery,isCurrent:()=>run===generation&&owner===identity()&&allowed()&&!!host&&session?.id===cashSession});
    const checked=await sync.synchronize(operationId);
    if(checked.status==='conflict'){receipt={...receipt,id:operationId,status:'uncertain',localQueued:false,needsReview:true,totalCents:saved.ticket.totalCents};throw Error('El cálculo o los datos de esta venta necesitan revisión. Conserva el ticket y no vuelvas a cobrarlo.');}
    if(checked.status!=='synced'){lines=[];payment=null;tab='sale';receipt={id:operationId,status:'uncertain',totalCents:saved.ticket.totalCents};notice='La venta sigue guardada en este dispositivo. Recupera su resultado cuando vuelva la conexión.';return;}
   }
  }
  const observed=await adapter.recover({operationId});
  if(resultGeneration!==generation||resultActor!==identity()||resultSession!==session?.id||!host)throw Error('La sesión ha cambiado. Vuelve a abrir sus ventas pendientes.');
  guard();lines=[];payment=null;tab='sale';
  if(observed.status==='ready'&&observed.payment){if(observed.payment.quoteExpiresAt<=Date.now()){
    await adapter.discardQuote(operationId);receipt=null;notice='El cálculo anterior ha caducado sin crear un pedido. Ya puedes preparar otra venta.';await reloadProducts();return;}
   payment=observed.payment;receipt=null;paymentValues={};draftInfo=observed.draft||null;}else{receipt=observed;if(observed.status==='confirmed'){
    draftInfo=null;delete formValues.ticket;delete formValues.pay;paymentValues={};formDirty=Object.keys(formValues).length>0;notice='';return;
   }}await reloadProducts();}
 async function addProduct(p){if(p.offlineUnavailable)throw Error('Este artículo aún no tiene precio y existencias guardados para trabajar sin conexión.');if(p.saleEnabled===false)throw Error('Este artículo no está habilitado para vender. Puedes reponerlo desde Entrada de mercancía.');const existing=lines.find(l=>l.productId===p.id),run=generation,owner=identity();let increment=existing?1:(p.minimumQty||1);
  if(displayOptions.requireQuantity){const min=existing?1:(p.minimumQty||1),max=Math.min(10000,canExceedStock(p,stockRules)?10000:p.stock)-(existing?.qty||0);if(max<min)throw Error('No hay unidades suficientes para añadir este artículo.');increment=await quantityPicker.choose({name:p.name,min,max});if(increment===null)return false;
   if(run!==generation||owner!==identity()||!host)return false;guard();if(!canSell()||payment||receipt)throw Error('La venta ya no está disponible.');}
  const quantity=(existing?.qty||0)+increment;
  if(quantity>p.stock&&!canExceedStock(p,stockRules)||quantity>10000)throw new Error('No hay unidades suficientes para añadir este artículo.');
  if(existing){existing.temporaryLineNames=p.temporaryLineNames===true;existing.unitPriceOverride=p.unitPriceOverride===true;existing.allowOutOfStock=p.allowOutOfStock===true;existing.stock=p.stock;existing.qty=quantity;if(displayOptions.ticketNewestFirst){lines.splice(lines.indexOf(existing),1);lines.push(existing);}}
  else lines.push({productId:p.id,name:p.name,originalName:p.name,temporaryLineNames:p.temporaryLineNames===true,qty:quantity,unitCents:p.priceCents,stock:p.stock,allowOutOfStock:p.allowOutOfStock===true,minimumQty:p.minimumQty||1,unitPriceOverride:p.unitPriceOverride===true});
  if(displayOptions.beepOnAdd)playAddFeedback();
  if(live())void refreshBasketPrices();
  if(live()&&displayOptions.returnToStart){const run=generation,operator=identity();searchRevision++;clearTimeout(searchTimer);search='';if(initialCategoryId&&!visibleCategories(false).some(c=>c.id===initialCategoryId))initialCategoryId=0;categoryId=initialCategoryId;productPage=0;variantProduct=0;variantGroupId=0;catalogueSort=parentCatalogueSort||catalogueSort;parentCatalogueSort=null;
   try{await reloadProducts();}catch(error){if(run!==generation||operator!==identity()||!allowed())throw error;
    products=[];notice='Artículo añadido. No se ha podido cargar la categoría inicial. Vuelve a seleccionarla para reintentar.';}}return true;}
 function playAddFeedback(){try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
  audioFeedback??=new Audio();const context=audioFeedback;
  void context.resume().then(()=>{if(context!==audioFeedback||context.state!=='running')return;
   const tone=context.createOscillator(),gain=context.createGain();tone.frequency.value=880;gain.gain.setValueAtTime(.035,context.currentTime);
   gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.07);tone.connect(gain);gain.connect(context.destination);
   tone.start();tone.stop(context.currentTime+.08);tone.onended=()=>{tone.disconnect();gain.disconnect();};}).catch(()=>{});
 }catch{/* A denied audio device never blocks an added article or a sale. */}}
 async function keydown(event){if(event.key!=='Enter'||!event.target.matches('[data-tpv-search]')||!host||!allowed()||mountedActor!==identity()||
  !['sale','stock'].includes(tab)||tab==='sale'&&(payment||receipt||!canSell())||tab==='stock'&&!canReceiveStock())return;
  event.preventDefault();clearTimeout(searchTimer);searchRevision++;const value=event.target.value.trim();if(!value)return;
  scanQueue.push({value,tab,generation});event.target.value='';if(!busy&&!scanning)await drainScans();
 }
 async function drainScans(){if(scanning||busy)return;scanning=true;const run=generation;
  try{while(scanQueue.length&&run===generation){const scan=scanQueue.shift();if(scan.generation!==generation||scan.tab!==tab)continue;
  search=scan.value;
  await work(async()=>{products=await adapter.searchProducts({sessionId:session.id,search:scan.value,searchFields:searchOptions.fields,catalogueFilters:currentCatalogueFilters(),...inventoryCatalogueQuery()});const p=products[0],query=scan.value.toLocaleLowerCase('es');
   if(products.length===1&&!products.hasMore&&!p.chooseVariant&&searchOptions.fields.filter(key=>key!=='name').some(key=>{const value=({reference:p.reference,ean13:p.barcode,upc:p.upc,isbn:p.isbn})[key];return value&&String(value).toLocaleLowerCase('es')===query;})){
    if(tab==='stock'){stockIntake.add(p);notice='Unidad añadida a la entrada de mercancía.';}else notice=await addProduct(p)?'Artículo añadido al ticket.':'Selección de cantidad cancelada.';
   }else notice=products.length?'Selecciona el artículo y su variante entre las coincidencias.':'No hay artículos con ese código.';
  });
  }
  }finally{if(run===generation)scanning=false;}
  if(run===generation){const next=host?.querySelector('[data-tpv-search]');next?.focus();}
 }
 async function click(event){
  if(!event.target.closest('.tpv-actions'))host?.querySelector('.tpv-actions[open]')?.removeAttribute('open');
  const target=event.target.closest('button');if(!target||!host?.contains(target)||busy)return;
  if(!allowed()||mountedActor!==identity()){const root=host;dispose();root.innerHTML='<p role="alert">La sesión ha cambiado. Vuelve a entrar en TotusTPV.</p>';return;}
  const action=target.dataset.tpvAction;
  if(action==='offline-recheck'&&live())return work(()=>offlinePanel.recheck(target.dataset.tpvOfflineId));
  if(action==='offline-pending'&&live())return work(async()=>{if(payment&&receipt?.status!=='uncertain'||returnForm)throw Error('Termina la operación actual antes de consultar las ventas pendientes.');reports.reset();await offlinePanel.open();tab='offline-pending';});
  if(action==='offline-sync'&&live())return work(()=>offlinePanel.synchronize());
  if(target.dataset.tpvBarcode)return barcodePanel.click(target);
  if(action==='barcodes'&&live())return work(async()=>{if(payment||returnForm)throw Error('Termina el cobro o la devolución antes de abrir los códigos.');barcodePanel.reset();await barcodePanel.load();tab='barcodes';});
  if(target.dataset.tpvLineName)return work(async()=>{const line=lines.find(line=>line.productId===target.dataset.tpvLineName),run=generation,owner=identity();if(!line||payment||!canSell())return;
   const answer=await lineNameEditor.choose({name:line.name,originalName:line.originalName||line.name,canRename:can('edit')&&priceRules.allowNameChanges&&line.temporaryLineNames===true});
   if(answer===null||run!==generation||owner!==identity()||!host)return;guard();if(!canSell()||payment||!lines.includes(line))throw Error('El ticket ya no está disponible.');
   if(answer!==''&&(!can('edit')||!priceRules.allowNameChanges||!line.temporaryLineNames))throw Error('La edición del nombre no está disponible. Puedes restaurar el nombre del catálogo.');
   line.customName=lineName(answer);line.name=line.customName??line.originalName??line.name;});
  if(action==='new-product'||action==='product-history')return work(async()=>{
   if(action==='new-product'&&(!session||payment||returnForm||receipt?.status==='uncertain'))throw Error('Termina o recupera el cobro o la devolución antes de crear un producto.');
   if(!session){const storeId=host.querySelector('[data-tpv-store]').value,drawerId=host.querySelector('[data-tpv-drawer]').value;await adapter.selectWorkstation({storeId,drawerId});}
   await productIntake.open();
  });
  if(Object.keys(target.dataset).some(key=>key.startsWith('tpvProduct')||key==='tpvCategoryId'))return work(async()=>{
   await productIntake.click(target);if(!productIntake.isOpen()&&session)await reloadProducts();
  });
  if(action==='customer-display'){try{customerScreen.open();failure='';}catch(error){failure=error.message;}render();return;}
  if(target.hasAttribute('data-tpv-access-edit')||target.hasAttribute('data-tpv-access-cancel')||target.hasAttribute('data-tpv-access-refresh'))return work(async()=>{
   if(!canAssign())throw Error('No tienes permiso para gestionar los accesos.');
   if((accessPanel.hasDraft()||formValues.configure)&&!await askCurrent('¿Descartar los cambios sin guardar?',{acceptLabel:'Descartar cambios'}))return;
   if(target.hasAttribute('data-tpv-access-refresh')){configuration=await readConfiguration();accessPanel.load(configuration);}
   else if(target.hasAttribute('data-tpv-access-edit'))accessPanel.edit(Number(target.dataset.tpvAccessEdit));
   else accessPanel.cancel();
   delete formValues.configure;formDirty=Object.keys(formValues).length>0;
  });
  if(catalogueTable.click(target))return;
  if(target.hasAttribute('data-tpv-columns-save'))return work(async()=>{
   const columns=catalogueTable.draft();if(live()){if(!workspacePreferences)throw Error('No se puede guardar la distribución.');
    const drawer=context.drawers.find(d=>d.id===(session?.drawerId||selectedDrawer));const saved=await workspacePreferences(drawer,{columns});
    if(JSON.stringify(saved.columns)!==JSON.stringify(columns))throw Error('No se ha confirmado la distribución guardada.');}
   catalogueTable.setColumns(columns);notice=live()?'Columnas guardadas en tu cuenta.':'Columnas de práctica aplicadas.';});
  if(target.dataset.tpvSort)return work(async()=>{
   const next={field:target.dataset.tpvSort,direction:catalogueSort.field===target.dataset.tpvSort&&catalogueSort.direction==='asc'?'desc':'asc'};
   await reloadProducts({sortField:next.field,sortDirection:next.direction,page:0});catalogueSort=next;productPage=0;scheduleCatalogueRefresh();
   if(!variantProduct&&live()&&workspacePreferences){const drawer=context.drawers.find(d=>d.id===(session?.drawerId||selectedDrawer));await workspacePreferences(drawer,{sortField:next.field,sortDirection:next.direction});}
  });
  if(action==='show-products'||action==='show-ticket'){mobilePane=action==='show-products'?'catalogue':'ticket';render();return;}
  if(action==='fullscreen'){if(document.fullscreenElement===host)void document.exitFullscreen();else void host.requestFullscreen?.().catch(()=>{failure='No se pudo abrir la pantalla completa. Puedes seguir trabajando en esta ventana.';render();});return;}
  if(target.hasAttribute('data-tpv-stock-refresh'))return work(()=>stockIntake.load());
  if(target.dataset.tpvStockReceipt)return work(()=>stockIntake.select(target.dataset.tpvStockReceipt));
  if(target.dataset.tpvStockRun)return work(async()=>{await stockIntake.run(target.dataset.tpvStockRun);await reloadProducts();notice='Entrada de mercancía verificada.';});
  if(target.dataset.tpvStockCancel)return work(()=>stockIntake.cancel(target.dataset.tpvStockCancel));
  if(target.dataset.tpvStockRemove){if(canReceiveStock()){stockIntake.remove(target.dataset.tpvStockRemove);render();}return;}
  if(target.dataset.tpvReportAction==='central'&&live()&&onCash&&canCentralCash())return work(async()=>{
   if(hasDraft())throw Error('Aparca o termina el ticket y los cambios pendientes antes de abrir Cajas.');
   const drawer=context?.drawers.find(row=>row.id===(session?.drawerId||selectedDrawer)),sessionId=reports.selectedSession();
   if(!drawer?.connectionId||!drawer.shopId||!sessionId)throw Error('Selecciona el informe de caja antes de abrirlo en Central.');
   await onCash({connectionId:drawer.connectionId,shopId:drawer.shopId,sessionId});
  });
  if(target.dataset.tpvReportAction)return work(()=>{reports.click(target);if(target.dataset.tpvReportAction==='close')tab='sale';});
  if(action==='reports'&&live())return work(async()=>{if(customers.hasDraft())throw Error('Termina o descarta la edición del cliente antes de consultar informes.');
   customers.reset();tab='reports';if(!session){const storeId=host.querySelector('[data-tpv-store]').value,
   drawerId=host.querySelector('[data-tpv-drawer]').value;await adapter.selectWorkstation({storeId,drawerId});}await reports.open();});
  if(action==='budgets'&&live())return work(async()=>{
   if(customers.hasDraft())throw Error('Termina o descarta la edición del cliente antes de consultar presupuestos.');
   customers.reset();if(!session){const storeId=host.querySelector('[data-tpv-store]')?.value,drawerId=host.querySelector('[data-tpv-drawer]')?.value;await adapter.selectWorkstation({storeId,drawerId});}
   budgetEditing=false;selectedBudget=null;tab='budgets';await loadBudgets();
  });
  if(action==='save-budget'&&live()&&canSell()&&lines.length&&!payment)return work(async()=>{budgetPending=await adapter.pendingBudget?.()===true;budgetEditing=true;selectedBudget=null;tab='budgets';});
  if(action==='budget-back'){budgetEditing=false;delete formValues.budget;tab='sale';render();return;}
  if(action==='budget-refresh'){budgetQuery=host.querySelector('[data-tpv-budget-query]')?.value.trim()||'';return work(async()=>{selectedBudget=null;await loadBudgets();});}
  if(action==='budget-more')return work(()=>loadBudgets(true));
  if(action==='budget-recover')return work(async()=>{selectedBudget=await adapter.recoverBudgetPreparation();budgetEditing=false;delete formValues.budget;formDirty=Object.keys(formValues).length>0;await loadBudgets();notice='Presupuesto recuperado. El ticket que tengas abierto se conserva.';});
  if(target.dataset.tpvBudgetId)return work(async()=>{selectedBudget=await adapter.getBudget(target.dataset.tpvBudgetId);budgetEditing=false;});
  if(action==='budget-print'&&selectedBudget){const run=generation,owner=identity();printTpvMarkup(budgetDocumentHtml(selectedBudget),'TotusTPV · '+selectedBudget.reference,{current:()=>run===generation&&owner===identity()&&!!host&&allowed()});return;}
  if(action==='budget-convert'&&selectedBudget)return work(async()=>{
   if(!session||!canSell())throw Error('Abre una caja con permiso de venta antes de convertir el presupuesto.');
   if(lines.length||draftInfo||payment||returnForm||receipt?.status==='uncertain')throw Error('Aparca o descarta el ticket actual antes de abrir el presupuesto.');
   if(!await askCurrent('¿Abrir este presupuesto como ticket? Antes del cobro se comprobarán los precios, descuentos y existencias actuales.',{acceptLabel:'Abrir ticket'}))return;
   const restored=await adapter.openBudget({id:selectedBudget.id,version:selectedBudget.version});
   if(restored.checkoutId){await recover(restored.checkoutId);return;}
   lines=restored.lines;draftInfo=restored.draft;selectedCustomer=restored.customer;customers.reset();
   formValues.ticket={draftLabel:restored.draft.label,discountKind:restored.adjustment?.kind||'',discountValue:restored.adjustment?(restored.adjustment.value/100).toFixed(2).replace('.',','):'',coupon:restored.coupon||'',note:restored.note||''};
   receipt=null;tab='sale';notice='Presupuesto '+restored.budget.reference+' abierto. Revisa el cálculo antes de cobrar.';await reloadProducts();
  });
  if(action==='budget-cancel'&&selectedBudget&&can('edit'))return work(async()=>{
   if(!await askCurrent('¿Anular este presupuesto? Su documento se conservará para consulta.',{acceptLabel:'Anular presupuesto'}))return;
   selectedBudget=await adapter.cancelBudget({id:selectedBudget.id,version:selectedBudget.version});await loadBudgets();notice='Presupuesto anulado. Su documento se conserva.';
  });
  if(action==='refresh-drafts')return work(async()=>{parked=await adapter.drafts();});
  if(target.dataset.tpvDraftId)return work(async()=>{const row=parked.find(row=>row.id===target.dataset.tpvDraftId);if(!canSell()||!row)throw Error('Necesitas permiso de venta para recuperar este ticket.');if(parkingExpiry(row).expired)throw Error('Este ticket ha caducado. Se conserva para consulta y archivo.');if(lines.length||payment||returnForm||customers.hasDraft())throw new Error('Aparca o descarta el ticket actual antes de recuperar otro.');
   const restored=await adapter.claimDraft({draftId:target.dataset.tpvDraftId});lines=restored.lines;draftInfo=restored.draft;selectedCustomer=restored.customer;customers.reset();
   formValues.ticket={draftLabel:restored.draft.label,discountKind:restored.adjustment?.kind||'',
    discountValue:restored.adjustment?(restored.adjustment.value/100).toFixed(2).replace('.',','):'',coupon:restored.coupon||'',note:restored.note||''};
   receipt=null;tab='sale';notice='Ticket recuperado. Revisa el cálculo nativo antes de cobrar.';await reloadProducts();});
  if(target.dataset.tpvArchiveDraft)return work(async()=>{const row=parked.find(row=>row.id===target.dataset.tpvArchiveDraft);if(!row||!await askCurrent('¿Archivar este ticket sin vender? Su historial se conserva.',{acceptLabel:'Archivar ticket'}))return;
   await adapter.archiveDraft({draftId:row.id,version:row.version});parked=await adapter.drafts();});
  if(Object.keys(target.dataset).some(key=>key.startsWith('tpvClient')))return work(()=>customers.click(target));
  if(action==='customers'&&live()&&!payment&&canCustomer('view'))return work(()=>customers.open());
  if(target.dataset.tpvBilling&&live()&&onBilling&&canBilling())return work(async()=>{
   if(hasDraft())throw Error('Aparca o termina el ticket y los cambios pendientes antes de abrir Facturación.');
   const drawer=context?.drawers.find(row=>row.id===(session?.drawerId||selectedDrawer));
   if(!drawer?.connectionId||!drawer.shopId)throw Error('Selecciona el establecimiento de esta venta antes de abrir su factura.');
   await onBilling({saleId:target.dataset.tpvBilling,connectionId:drawer.connectionId,shopId:drawer.shopId});
  });
  if(target.dataset.tpvDocument&&live())return work(async()=>{const doc=await adapter.document({saleId:target.dataset.saleId,kind:target.dataset.tpvDocument,refundId:target.dataset.refundId});
   if(doc.mime==='application/pdf'){await downloadNativePdf(doc);const number=receiptNumber(doc.ticket_number);notice=number?.kind==='return'?'Devolución '+number.label+' · abono nativo descargado.':'Documento nativo descargado.';}else documentPreview=doc;});
  if(action==='close-document'){documentPreview=null;render();return;}
  if(action==='print-document'&&documentPreview){const run=generation,operator=identity();printReceipt(documentPreview,effectiveReceiptStyle(),{current:()=>run===generation&&operator===identity()&&allowed()});return;}
  if(['return-all','return-clear'].includes(action)&&returnForm&&!returnForm.prepared){
   if(!canSell()||busy)return;
   const form=host.querySelector('[data-tpv-form="refund"]');if(!form)return;
   for(const line of returnForm.lines){const field=form.elements.namedItem('qty-'+line.productId);if(field)field.value=String(action==='return-all'?line.remainingQty:0);}
   rememberForm(form);return;
  }
  if(action==='assign'&&canAssign()&&readConfiguration)return work(async()=>{
   if(lines.length||payment||returnForm||customers.hasDraft()||stockIntake.hasDraft()||productIntake.hasDraft()||accessPanel.hasDraft())throw Error('Aparca o termina el ticket y la edición actual antes de configurar el puesto.');
   configuration=await readConfiguration();accessPanel.load(configuration);configurationId=crypto.randomUUID();if(adapter&&context)tab='configuration';});
  if(action==='refresh-configuration'&&canAssign()&&readConfiguration)return work(async()=>{
   const form=host.querySelector('[data-tpv-form="configure"]');if(form)rememberForm(form);
   const updated=await readConfiguration();
   if(updated.connectionId!==configuration.connectionId||updated.revision!==configuration.revision)throw Error('La conexión ha cambiado. Cancela esta preparación y vuelve a seleccionar el puesto.');
   if(formValues.configure){
    const selected=formValues.configure;
    if(!updated.stores.some(row=>row.id===selected.store)){selected.store=updated.stores[0]?.id||'';delete selected.drawer;}
    if(!updated.drawers.some(row=>row.id===selected.drawer&&row.store_id===selected.store))delete selected.drawer;
    if(!updated.operators.some(row=>row.id===selected.operator))delete selected.operator;
   }
   configuration=updated;accessPanel.load(configuration);notice='Tiendas y cajas actualizadas. Revisa la selección antes de asignar el puesto.';
  });
  if(action==='cancel-configuration'){configuration=null;configurationId=null;delete formValues.configure;tab='sale';render();return;}
  if(target.dataset.tpvStock)return work(async()=>{const p=products.find(p=>p.id===target.dataset.tpvStock);if(!p)return;
   if(p.chooseVariant){parentCatalogueSort={...catalogueSort};catalogueSort=variantOrder(displayOptions.variantOrder);variantProductName=p.name;variantGroupId=0;if(!variantView)variantView=window.matchMedia('(max-width:600px)').matches?'grid':'table';variantProduct=p.nativeProductId;productPage=0;products=[];await reloadProducts();}else stockIntake.add(p);});
  if(target.hasAttribute('data-tpv-tender')||target.hasAttribute('data-tpv-tender-exact')){
   if(!payment||!canSell())return;const form=host.querySelector('[data-tpv-form="pay"]');if(!form||!['cash','mixed'].includes(form.elements.method.value))return;
   try{const value=target.hasAttribute('data-tpv-tender')?Number(target.dataset.tpvTender):form.elements.method.value==='mixed'?inputCents(form.elements.cashPart.value):payment.totalCents;
    if(!Number.isSafeInteger(value)||value<0)throw new Error('Importe no válido.');
    clearCashCount(form,'received');form.elements.received.value=(value/100).toFixed(2).replace('.',',');rememberForm(form);reflectTender();
   }catch{reflectTender();}return;
  }
  if(target.dataset.tpvAdd){if(!canSell()||payment||receipt)return;const p=products.find(p=>p.id===target.dataset.tpvAdd);
   if(!p)return;if(p.chooseVariant)return work(async()=>{parentCatalogueSort={...catalogueSort};catalogueSort=variantOrder(displayOptions.variantOrder);variantProductName=p.name;variantGroupId=0;if(!variantView)variantView=window.matchMedia('(max-width:600px)').matches?'grid':'table';variantProduct=p.nativeProductId;productPage=0;products=[];await reloadProducts();});
   return work(async()=>{if(!await addProduct(p))return;if(variantProduct){variantProduct=0;variantGroupId=0;catalogueSort=parentCatalogueSort||catalogueSort;parentCatalogueSort=null;productPage=0;try{await reloadProducts();}catch{products=[];notice='Variante añadida. Actualiza el catálogo para continuar.';}}});}
  if(target.dataset.tpvRemove){if(payment||!canSell())return;lines=lines.filter(l=>l.productId!==target.dataset.tpvRemove);render();if(live())void refreshBasketPrices();return;}
  if(target.dataset.tpvRecover)return work(()=>recover(target.dataset.tpvRecover));
  if(target.dataset.tpvReturn)return work(async()=>{if(!session||!canSell())throw new Error('Necesitas una caja abierta y permiso de venta para devolver.');
   returnForm={...await adapter.returnable({sessionId:session.id,saleId:target.dataset.tpvReturn}),operationId:crypto.randomUUID()};delete formValues.refund;});
  if(target.dataset.tpvRefundRecover)return work(async()=>{const result=await adapter.recoverRefund(target.dataset.tpvRefundRecover);
   if(result.status==='confirmed'){notice='Devolución verificada: '+money(result.totalCents);history=await adapter.history();return;}
   returnForm={reference:'Devolución pendiente',operationId:result.id,prepared:result};});
  if(action==='cancel-return')return work(async()=>{if(live()&&returnForm?.prepared){if(returnForm.prepared.status!=='ready')throw new Error('Recupera la devolución pendiente antes de continuar.');await adapter.cancelRefund(returnForm.operationId);}
   returnForm=null;delete formValues.refund;formDirty=Object.keys(formValues).length>0;});
  if(action==='confirm-refund'||action==='recover-refund')return work(async()=>{if(action==='confirm-refund'&&!canSell())throw Error('No tienes permiso para confirmar devoluciones.');
   const result=action==='confirm-refund'?await adapter.submitRefund({operationId:returnForm.operationId,totalCents:returnForm.prepared.totalCents,refundConfirmed:true}):await adapter.recoverRefund(returnForm.operationId);
   if(result.status!=='confirmed'){returnForm.prepared={...returnForm.prepared,...result};return;}
   notice='Devolución verificada: '+money(result.totalCents);returnForm=null;history=await adapter.history();await reloadProducts();});
  if(['catalogue-previous','catalogue-next','back-products'].includes(action))return work(async()=>{
   if(action==='back-products'){variantProduct=0;variantGroupId=0;catalogueSort=parentCatalogueSort||catalogueSort;parentCatalogueSort=null;productPage=0;}else productPage=Math.max(0,productPage+(action==='catalogue-next'?1:-1));await reloadProducts();});
  if(action==='configure'&&onConfigure&&canConfigure())return work(()=>onConfigure());
  if(action==='refresh-workstation'&&live())return work(()=>openLive(true));
  if(action==='setup'&&readSetup)return work(async()=>{const run=generation;setup=null;render();let observed;
   try{observed=await readSetup();}catch(error){if(/^TPV_SETUP_/.test(error?.message||''))throw new Error('No se ha podido comprobar el puesto con la sesión y configuración actuales. Vuelve a intentarlo.');throw error;}
   if(run!==generation||!host)return;guard();
   if(observed?.mode!=='setup-read-only'||observed.checkoutEnabled!==false||!Array.isArray(observed.websites))throw new Error('No se ha podido comprobar la configuración del puesto.');
   setup=observed;});
  if(action==='practice')return work(async()=>{
   setup=null;
   adapter=bindPractice();context=await adapter.context();context.stores.sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));context.drawers.sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));
   session=context.sessions.find(s=>s.status==='open')||null;if(session)await reloadProducts();
  });
  if(action==='settings'&&live())return work(async()=>{if(customers.hasDraft()||returnForm||payment)throw Error('Termina la operación actual antes de configurar el mostrador.');barcodePanel.reset();tab='settings';});
  if(action==='live'&&createLiveAdapter)return work(()=>openLive(true));
  if(action==='add-menu-link'){
   const row=host.querySelector('.tpv-menu-link-row[hidden]');if(row){row.hidden=false;row.querySelector('input')?.focus();}
   target.hidden=!host.querySelector('.tpv-menu-link-row[hidden]');return;
  }
  if(action==='remove-menu-link'){
   const row=target.closest('.tpv-menu-link-row'),form=row?.closest('form');if(!row||!form)return;
   const inputs=[...row.querySelectorAll('input')],changed=inputs.some(input=>input.value);for(const input of inputs)input.value='';row.hidden=true;
   if(!form.querySelector('.tpv-menu-link-row:not([hidden])'))form.querySelector('.tpv-menu-link-row').hidden=false;
   form.querySelector('[data-tpv-action="add-menu-link"]').hidden=false;if(changed)rememberForm(form);return;
  }
  if(action==='exit'){if(!await requestLeave())return;barcodePanel.reset();adapter=null;context=null;session=null;lines=[];payment=null;receipt=null;returnForm=null;formValues={};formDirty=false;selectedCustomer=null;customers.reset();reports.reset();stockIntake.reset();productIntake.reset();draftInfo=null;parked=[];render();return;}
  if(['sale','history','session','stock','drafts'].includes(action))return work(()=>changeTab(action));
  if(action==='park')return work(async()=>{if(!parkingRules.enabled)throw Error('El aparcado está desactivado para tu cuenta y esta caja. Puedes consultar los tickets anteriores desde Más acciones.');if(!live()||!canSell()||!lines.length||payment||returnForm)throw new Error('Termina el cobro o la devolución antes de aparcar otro ticket.');
   const {adjustment,coupon,note}=ticketAdjustments(),label=formValues.ticket?.draftLabel?.trim()||draftInfo?.label||'Ticket '+new Date().toLocaleString('es-ES');
   await adapter.park({label,lines:copyLines().map(line=>({...line,name:lines.find(l=>l.productId===line.productId).name,originalName:lines.find(l=>l.productId===line.productId).originalName})),adjustment,coupon,note});
   lines=[];draftInfo=null;selectedCustomer=null;customers.reset();await adapter.setCustomer(null);delete formValues.ticket;formDirty=Object.keys(formValues).length>0;
   tab='drafts';parked=await adapter.drafts();notice='Ticket aparcado. No se ha creado una venta ni reservado existencias.';});
  if(action==='payment'){
   const invalid=host.querySelector('[data-tpv-quantity]:invalid');if(invalid){invalid.reportValidity();return;}
   return work(async()=>{if(!canSell())throw new Error('No tienes permiso para crear ventas.');
   const {adjustment,coupon,note}=ticketAdjustments();
   if(live()&&priceRules.requireSaleNote&&!note)throw Error('Añade la nota interna antes de calcular el cobro.');
   const run=generation,operator=identity(),calculated=await adapter.quote({sessionId:session.id,lines:copyLines(),...(live()?{adjustment,coupon,note}:{})});
   if(run!==generation||operator!==identity()||!host)return;guard();if(!canSell())throw Error('Necesitas permiso de venta para continuar.');payment=calculated;
   if(live())for(const verified of payment.lines||[]){const line=lines.find(line=>line.productId===verified.productId+':'+verified.attributeId);if(line&&typeof verified.name==='string'){line.name=verified.name;if(typeof verified.catalogueName==='string')line.originalName=verified.catalogueName;}}
   paymentValues={};});}
  if(action==='cancel-payment')return work(async()=>{if(live())await adapter.discardQuote(payment.id);payment=null;paymentValues={};delete formValues.pay;formDirty=Object.keys(formValues).length>0;});
  if(action==='clear')return work(async()=>{if(!canSell()||payment)return;if((lines.length||draftInfo)&&!await askCurrent(wording('¿Vaciar el ticket de práctica?',
   '¿Descartar el ticket actual? Si procede de un aparcado, quedará archivado sin borrar su historial.'),{acceptLabel:'Descartar ticket'}))return;
   if(live()){await adapter.abandonDraft();await adapter.setCustomer(null);}lines=[];draftInfo=null;selectedCustomer=null;customers.reset();delete formValues.ticket;formDirty=Object.keys(formValues).length>0;await reloadProducts();});
  if(action==='review-incident'&&canAssign()){incidentForm=true;render();return;}
  if(action==='recover')return work(()=>recover(receipt.id));
  if(action==='next')return work(async()=>{if(live()&&receipt?.localQueued&&adapter.leaveLocalTicket)await adapter.leaveLocalTicket(receipt.id);mobilePane='catalogue';receipt=null;lines=[];payment=null;documentPreview=null;selectedCustomer=null;customers.reset();if(live()){await adapter.setCustomer(null);await reloadProducts();}delete formValues.ticket;formDirty=Object.keys(formValues).length>0;});
 }
 async function openLive(required){
  const candidate=bindAdapter(createLiveAdapter()),observed=await candidate.context();
  if(!observed.drawers?.length){if(required)throw Error('Todavía no tienes una caja asignada. Pide al responsable de tu tienda que te dé acceso desde Administrar tiendas y cajas.');notice='Todavía no tienes una caja asignada. Puedes practicar mientras el responsable de tu tienda prepara tu acceso.';return false;}
  adapter=candidate;context=observed;session=context.sessions.find(s=>s.status==='open')||null;
  if(session)await adapter.selectSession(session);
  else {const drawer=context.drawers[0];selectedStore=drawer.storeId;selectedDrawer=drawer.id;await adapter.selectWorkstation({storeId:selectedStore,drawerId:selectedDrawer});}
  await loadWorkspacePreferences();if(session){const pending=adapter.pendingSale?await adapter.pendingSale():null;
   if(pending)await recover(pending);else await reloadProducts();}setup=null;if(session)onlineSyncRequested=true;return true;
 }
 async function loadWorkspacePreferences(){
  const run=generation,actor=identity(),source=adapter,sourceContext=context,sourceDrawer=session?.drawerId||selectedDrawer;
  const current=()=>run===generation&&actor===identity()&&source===adapter&&sourceContext===context&&(session?.drawerId||selectedDrawer)===sourceDrawer;
  const ensureCurrent=()=>{if(!current())throw Error('El puesto ha cambiado. Vuelve a abrir la caja para consultar su configuración.');};
  const payments=source.paymentOptions?await source.paymentOptions():null;ensureCurrent();
  const loadedCategories=source.categories?await source.categories():[];ensureCurrent();
  const drawer=sourceContext.drawers.find(d=>d.id===sourceDrawer);
  const saved=workspacePreferences&&drawer?await workspacePreferences(drawer):null;ensureCurrent();
  const loadedNumbering=receiptNumbering&&drawer?receiptSeries(await receiptNumbering(drawer)):null;ensureCurrent();
  const loadedLinks=menuLinksStore&&drawer?normalizeMenuLinks(await menuLinksStore(drawer)):[];ensureCurrent();
  const loadedReturns=returnPolicyStore&&drawer?returnPolicy(await returnPolicyStore(drawer)):{allowPartial:true};ensureCurrent();
  returnRules=loadedReturns;drawerPayments=payments;categories=loadedCategories;numbering=loadedNumbering;customMenuLinks=loadedLinks;
  displayOptions=displayPreferences(saved?.display);searchOptions=searchPreferences(saved?.search);includeDisabledStock=searchOptions.includeDisabledStock;catalogueOptions=cataloguePreferences(saved?.catalogue);stockRules=stockPolicy(saved?.stockPolicy);priceRules=lineOptions(saved?.lineOptions);parkingRules=parkingOptions(saved?.parking);
  receiptStyle=receiptOptions(saved?.receipt);
  cashStyle=cashOptions(saved?.cash);
  customerScreenOptions=customerDisplayOptions(saved?.customerDisplay);
  catalogueView=['grid','compact','list','table'].includes(saved?.viewMode)?saved.viewMode:'grid';
  catalogueTable.setColumns(saved?.columns);
  catalogueSort={field:['name','reference','stock','id','cost','manufacturer','supplier','price'].includes(saved?.sortField)?saved.sortField:'name',direction:saved?.sortDirection==='desc'?'desc':'asc'};
  if(catalogueSort.field==='cost'&&!canReadCost())catalogueSort.field='name';
  initialCategoryId=categories.some(c=>c.id===saved?.initialCategoryId)?saved.initialCategoryId:0;
  if(initialCategoryId&&!visibleCategories(false).some(row=>row.id===initialCategoryId))initialCategoryId=0;
  categoryId=initialCategoryId;productPage=0;variantProduct=0;
 }
 const copyLines=()=>{if(lines.some(line=>line.customName)&&(!priceRules.allowNameChanges||!can('edit')))throw Error('Restaura el nombre del catálogo o activa la edición de nombres y comprueba tu permiso para editar ventas.');if(lines.some(line=>line.discountKind==='price')&&(!priceRules.allowPriceChanges||!can('edit')))throw Error('Activa el cambio de precio en Configuración y comprueba tu permiso para editar ventas.');
  return lines.map(({productId,qty,discountKind,discountValue,customName})=>{const adjustment=live()&&discountKind?{kind:discountKind,value:inputCents(discountValue)}:undefined;try{lineAdjustment(adjustment);}catch{throw Error('Escribe un precio o descuento positivo válido. El porcentaje debe ser menor del 100 %.');}return {productId,qty,...(adjustment?{discount:adjustment}:{}),...(customName?{displayName:lineName(customName)}:{})};});};
 const ticketAdjustments=()=>({adjustment:formValues.ticket?.discountKind?{kind:formValues.ticket.discountKind,value:inputCents(formValues.ticket.discountValue)}:undefined,
  coupon:formValues.ticket?.coupon?.trim()||undefined,note:saleNote(formValues.ticket?.note)});
 async function loadBudgets(more=false){
  const last=more?budgetPage.items.at(-1):null,page=await adapter.budgets({search:budgetQuery,...(last?{cursor:{createdAt:last.createdAt,id:last.id}}:{})});
  if(!Array.isArray(page?.items)||typeof page.hasMore!=='boolean')throw Error('No se ha podido consultar la lista de presupuestos.');
  budgetPage={items:more?[...new Map([...budgetPage.items,...page.items].map(row=>[row.id,row])).values()]:page.items,hasMore:page.hasMore};
  budgetPending=await adapter.pendingBudget?.()===true;
 }
 function budgetsHtml(){
  const draft=formValues.budget||{},pending=budgetPending;
  return `<section class="card card-pad tpv-budgets" aria-label="Presupuestos"><header class="inline-actions"><div><h3>Presupuestos</h3><p class="small muted">Prepara una oferta, compártela con el cliente y conviértela en venta cuando corresponda.</p></div>${button('sale','Volver al mostrador')}</header>
   ${pending?`<p class="note" role="status">Hay un guardado pendiente de confirmar. Recupera su resultado antes de preparar otro presupuesto.</p>${button('budget-recover','Recuperar presupuesto pendiente','primary')}`:''}
   ${budgetEditing?`<form data-tpv-form="budget" class="tpv-budget-editor"><h4>Guardar el ticket como presupuesto</h4><p>${lines.length} artículos · Cliente: ${esc(selectedCustomer?.name||'Cliente de mostrador')} · Estimación ${money(previewTotal())}</p><p class="small muted">El importe final del presupuesto se calculará en la tienda al guardar. Las existencias se comprobarán cuando lo conviertas en venta.</p><label>Título<input name="title" required maxlength="120" value="${esc(draft.title??'Presupuesto')}"></label><label>Vigencia en días<input name="validDays" type="number" required min="1" max="365" step="1" value="${esc(draft.validDays??30)}"></label><label>Texto para el cliente<textarea name="publicNote" maxlength="1000" rows="3" ${busy?'disabled':''}>${esc(draft.publicNote??'')}</textarea><small>Se incluirá en el documento. La nota interna del ticket se mantiene privada.</small></label><div class="inline-actions"><button type="submit" class="btn primary" ${pending?'disabled':''}>Calcular y guardar presupuesto</button>${button('budget-back','Volver al ticket')}</div></form>`:''}
   ${selectedBudget?`<section class="tpv-budget-detail"><div class="inline-actions">${button('budget-print','Imprimir presupuesto')}${['saved','checkout'].includes(selectedBudget.status)&&!selectedBudget.expired?button('budget-convert',selectedBudget.status==='checkout'?'Continuar ticket':'Abrir como ticket','primary',!session||!canSell()||!!lines.length||!!draftInfo||!!payment||!!returnForm):''}${can('edit')&&['saved','checkout'].includes(selectedBudget.status)?button('budget-cancel','Anular presupuesto'):''}</div>${!session&&['saved','checkout'].includes(selectedBudget.status)?'<p class="small muted">Para vender este presupuesto, vuelve al mostrador y abre una caja.</p>':''}${budgetDocumentHtml(selectedBudget)}</section>`:''}
   <div class="inline-actions"><label>Buscar presupuesto<input data-tpv-budget-query maxlength="120" value="${esc(budgetQuery)}" placeholder="Número o título"></label>${button('budget-refresh','Buscar y actualizar')}</div>
   <div class="tpv-history">${budgetPage.items.map(row=>`<article><div><b>${esc(row.reference)} · ${esc(row.title)}</b><small>${esc(budgetStatus(row.status))}${row.expired?' · Caducado':''} · ${esc(new Date(row.createdAt).toLocaleDateString('es-ES'))}</small></div><strong>${money(row.totalCents)}</strong><button type="button" class="btn secondary" data-tpv-budget-id="${esc(row.id)}">Ver presupuesto</button></article>`).join('')||'<p>No hay presupuestos que coincidan con esta búsqueda. Para preparar uno nuevo, añade los artículos al ticket y pulsa Guardar presupuesto.</p>'}</div>${budgetPage.hasMore?button('budget-more','Ver más presupuestos'):''}</section>`;
 }
 async function submit(event){
  const barcodeForm=event.target.closest('[data-tpv-barcode-form]');if(barcodeForm&&host?.contains(barcodeForm)){event.preventDefault();if(!busy){guard();return barcodePanel.submit(barcodeForm);}return;}
  const accessForm=event.target.closest('[data-tpv-access-form]');if(accessForm&&host?.contains(accessForm)){
   event.preventDefault();if(busy)return;accessPanel.capture(accessForm);
   return work(async()=>{const changed=await accessPanel.save();
    if(changed.operatorId===identity()&&live()){adapter=null;context=null;session=null;products=[];tab='sale';reports.reset();customers.reset();}
    notice='Acceso guardado. El historial y las cajas abiertas se conservan.';
    configuration=await readConfiguration();accessPanel.load(configuration);
   });
  }
  const lookup=event.target.closest('[data-tpv-order-search]');if(lookup&&host?.contains(lookup)){
   event.preventDefault();if(busy||!live())return;const value=new FormData(lookup).get('orderId').trim();orderLookup=value;focusOrderLookup=true;
   return work(async()=>{if(returnForm)throw Error('Termina o cancela la devolución actual antes de buscar otro pedido.');
    const query=orderLookupInput(value);history=await adapter.orders(query);
    notice='Historial: '+(query.reference?'referencia '+query.reference:query.orderId?'pedido #'+query.orderId:'últimos 100 pedidos confirmados de todas las cajas de esta tienda')+'.';});
  }
  const customerForm=event.target.closest('[data-tpv-client-form]');if(customerForm&&host?.contains(customerForm)){
   event.preventDefault();if(!busy)return work(()=>customers.submit(customerForm));return;}
  const categoryForm=event.target.closest('[data-tpv-category-form]');if(categoryForm&&host?.contains(categoryForm)){
   event.preventDefault();if(!busy)return work(()=>productIntake.prepareCategory());return;}
  const productForm=event.target.closest('[data-tpv-product-form]');if(productForm&&host?.contains(productForm)){
   event.preventDefault();if(!busy)return work(()=>productIntake.prepare());return;}
  const form=event.target.closest('[data-tpv-form]');if(!form||!host.contains(form))return;event.preventDefault();
  if(busy)return;const formKind=form.dataset.tpvForm;
  if(!['preferences','configure','receipt-series','menu-links','return-policy'].includes(formKind)&&!(['open','movement','close'].includes(formKind)?canManageCash():canSell()))return;
  // Capture form values before work() redraws and disables controls.
  const fields=new FormData(form),kind=form.dataset.tpvForm,storeId=host.querySelector('[data-tpv-store]')?.value,
   drawerId=host.querySelector('[data-tpv-drawer]')?.value;
  if(kind==='stock-batch')return work(async()=>{await stockIntake.save();notice='Entrada guardada. Revisa las unidades antes de registrarlas en la tienda.';});
  rememberForm(form);
  if(kind==='ticket')return;
  return work(async()=>{
   if(kind==='budget'){
    if(!live()||!lines.length||payment)throw Error('Prepara los artículos del ticket antes de guardar el presupuesto.');
    const {adjustment,coupon,note}=ticketAdjustments();
    try{selectedBudget=await adapter.saveBudget({lines:copyLines(),adjustment,coupon,note,title:String(fields.get('title')||''),publicNote:String(fields.get('publicNote')||''),validDays:Number(fields.get('validDays'))});}
    catch(error){budgetPending=await adapter.pendingBudget?.()===true;throw error;}
    budgetEditing=false;delete formValues.budget;
    await adapter.abandonDraft();await adapter.setCustomer(null);lines=[];draftInfo=null;selectedCustomer=null;customers.reset();delete formValues.ticket;formDirty=Object.keys(formValues).length>0;
    tab='budgets';await loadBudgets();notice='Presupuesto '+selectedBudget.reference+' guardado. Puedes imprimirlo o abrirlo como ticket cuando corresponda.';return;
   }
   if(kind==='incident'){
    if(!live()||!canAssign()||fields.get('accepted')!=='on')throw Error('Revisa la incidencia antes de continuar.');
    receipt=await adapter.resolveIncident({operationId:receipt.id,reason:String(fields.get('reason')||'').trim(),settlementReview:fields.get('settlementReview')});
    incidentForm=false;payment=null;lines=[];
   }else if(kind==='receipt-series'){
    if(!live()||!receiptNumbering||!can('edit'))throw Error('No tienes permiso para cambiar la numeración.');
    const drawer=context.drawers.find(d=>d.id===(session?.drawerId||selectedDrawer));
    try{numbering=receiptSeries(await receiptNumbering(drawer,receiptSeriesFromForm(fields)));}catch(error){throw receiptSeriesError(error);}notice='Numeración guardada para este establecimiento.';
   }else if(kind==='return-policy'){
    if(!live()||!returnPolicyStore||!canReturnPolicy())throw Error('No tienes permiso para cambiar las devoluciones.');
    const run=generation,owner=identity(),drawer=context.drawers.find(d=>d.id===(session?.drawerId||selectedDrawer)),settings={allowPartial:fields.get('allowPartial')==='on'};
    const observed=returnPolicy(await returnPolicyStore(drawer,settings));
    if(run!==generation||owner!==identity()||!host)throw Error('La sesión ha cambiado. Vuelve a consultar la configuración.');
    if(observed.allowPartial!==settings.allowPartial)throw Error('No se ha confirmado la regla de devoluciones. Conserva el formulario y vuelve a consultarla.');
    returnRules=observed;notice='Configuración de devoluciones guardada para esta caja.';
   }else if(kind==='menu-links'){
    if(!live()||!menuLinksStore)throw Error('No se pueden guardar los accesos de este puesto.');
    const run=generation,owner=identity(),drawer=context.drawers.find(d=>d.id===(session?.drawerId||selectedDrawer)),links=menuLinksFromForm(fields);
    const observed=normalizeMenuLinks(await menuLinksStore(drawer,links));
    if(run!==generation||owner!==identity()||!host)throw Error('La sesión ha cambiado. Vuelve a consultar los accesos del puesto.');
    if(JSON.stringify(observed)!==JSON.stringify(links))throw Error('No se han confirmado los accesos guardados. Conserva el formulario y vuelve a consultarlos.');
    customMenuLinks=observed;notice='Accesos guardados para tu cuenta y esta caja.';
   }else if(kind==='preferences'){
    if(!workspacePreferences)throw Error('No se puede guardar la configuración del mostrador.');
    const viewMode=fields.get('viewMode'),initial=Number(fields.get('initialCategoryId'));
    if(!['grid','compact','list','table'].includes(viewMode)||initial!==0&&!categories.some(c=>c.id===initial))throw Error('Selecciona una categoría disponible.');
    const drawer=context.drawers.find(d=>d.id===(session?.drawerId||selectedDrawer));
    const display=displayPreferencesFromForm(fields);
    const receipt=receiptOptionsFromForm(fields);
    const customerDisplay=customerDisplayOptionsFromForm(fields);
    const searchChoice=searchPreferencesFromForm(fields),catalogueChoice=cataloguePreferencesFromForm(fields);
    if(catalogueChoice.excludedCategories.some(id=>!categories.some(row=>row.id===id)))throw Error('Elige categorías disponibles en esta tienda.');
    if(initial&&!visibleCatalogueCategories(categories,catalogueChoice.excludedCategories).some(row=>row.id===initial))throw Error('La categoría inicial está oculta. Elige otra o Todas las categorías.');
    const rules=canSell()?stockPolicyFromForm(fields):stockRules,prices=can('edit')?lineOptionsFromForm(fields):priceRules,parking=canSell()?parkingOptionsFromForm(fields):parkingRules;
    if(rules.allowOutOfStock&&catalogueChoice.hideUnavailable)throw Error('Para seleccionar artículos sin existencias, desactiva Ocultar artículos y variantes agotados.');
    const cash=cashOptionsFromForm(fields),persisted=await workspacePreferences(drawer,{viewMode,initialCategoryId:initial,display,receipt,customerDisplay,cash,search:searchChoice,catalogue:catalogueChoice,...(canSell()?{stockPolicy:rules,parking}:{}),...(can('edit')?{lineOptions:prices}:{})});
    if(JSON.stringify(stockPolicy(persisted.stockPolicy))!==JSON.stringify(rules))throw Error('No se ha confirmado la regla de existencias. Vuelve a consultar la configuración.');
    if(JSON.stringify(lineOptions(persisted.lineOptions))!==JSON.stringify(prices))throw Error('No se ha confirmado la regla de precios. Vuelve a consultar la configuración.');
    if(JSON.stringify(parkingOptions(persisted.parking))!==JSON.stringify(parking))throw Error('No se ha confirmado la configuración de tickets aparcados. Vuelve a consultarla.');
    stockRules=rules;priceRules=prices;parkingRules=parking;
    if(!persisted?.cash||JSON.stringify(cashOptions(persisted.cash))!==JSON.stringify(cash))throw Error('No se han confirmado los billetes y monedas guardados. Vuelve a consultar la configuración.');
    if(JSON.stringify(searchPreferences(persisted.search))!==JSON.stringify(searchChoice))throw Error('No se ha confirmado la configuración del buscador. Vuelve a consultarla.');
    if(JSON.stringify(cataloguePreferences(persisted.catalogue))!==JSON.stringify(catalogueChoice))throw Error('No se ha confirmado la visibilidad guardada. Vuelve a consultarla.');
    const searchChanged=JSON.stringify(searchOptions.fields)!==JSON.stringify(searchChoice.fields)||catalogueOptions.hideUnavailable!==catalogueChoice.hideUnavailable||JSON.stringify(catalogueOptions.excludedCategories)!==JSON.stringify(catalogueChoice.excludedCategories);
    catalogueOptions=catalogueChoice;if(categoryId&&!visibleCategories(false).some(row=>row.id===categoryId))categoryId=0;
    searchRevision++;clearTimeout(searchTimer);searchOptions=searchChoice;includeDisabledStock=searchChoice.includeDisabledStock;receiptStyle=receipt;displayOptions=display;customerScreenOptions=customerDisplay;cashStyle=cash;catalogueView=viewMode;initialCategoryId=initial;notice='Mostrador guardado en tu cuenta.';
    if(session&&searchChanged){productPage=0;variantProduct=0;products=[];
     try{await reloadProducts();}catch(error){failure='El mostrador se ha guardado. No se pudo actualizar el catálogo: '+error.message;}}
   }else if(kind==='configure'){
    if(!canAssign()||!configureWorkstation||!configuration||fields.get('accepted')!=='on')throw new Error('Revisa la configuración del puesto.');
    const result=await configureWorkstation({action:'configure',operationId:configurationId,revision:configuration.revision,
     selection:{connectionId:configuration.connectionId,shopId:Number(fields.get('shop')),drawerId:fields.get('drawer')},
     storeId:fields.get('store'),operatorId:fields.get('operator'),paymentMethods:['cash','card',...['bizum','transfer'].filter(method=>fields.get(method)==='on')],permissions:{sell:fields.get('role')==='sell',open:fields.get('cashAccess')==='on',reconcile:true},confirmQaSetup:true});
    if(result.configured!==true)throw new Error('El puesto sigue pendiente de verificación. Conserva esta solicitud para consultar su resultado.');
    configuration=null;configurationId=null;delete formValues.configure;notice='Puesto de pruebas configurado.';tab='sale';
    if(autoOpen||adapter&&context)await openLive(false);
   }else if(kind==='open'){
    const drawer=context.drawers.find(d=>d.storeId===storeId&&d.id===drawerId);if(!drawer)throw new Error('Selecciona una caja de esta tienda.');
    session=await adapter.openSession({storeId,drawerId:drawer.id,openingCents:inputCents(fields.get('opening'))});
    tab='sale';receipt=null;lines=[];selectedCustomer=null;customers.reset();if(live())await loadWorkspacePreferences();await reloadProducts();notice='';
   } else if(kind==='payment-settings'){
    if(!live()||!canAssign()||!adapter.paymentOptions||!drawerPayments)throw Error('No tienes permiso para configurar los cobros de esta caja.');
    if(payment)throw Error('Cancela el cálculo de cobro antes de cambiar los medios de pago.');
    const settings=paymentSettingsFromForm(fields,Object.keys(drawerPayments.options.labels));
    drawerPayments=await adapter.paymentOptions(settings);delete formValues['payment-settings'];formDirty=Object.keys(formValues).length>0;notice='Medios de cobro guardados para esta caja.';
   } else if(kind==='pay'){
    if(!paymentFormMethods(payment.paymentMethods).includes(fields.get('method'))||fields.get('method')==='mixed'&&!(payment.paymentMethods||['cash','card']).filter(id=>id!=='cash').includes(fields.get('externalMethod')))throw new Error('Este medio de cobro no está habilitado para esta venta.');
    const method=fields.get('method'),cash=method==='cash'?payment.totalCents:method==='mixed'?inputCents(fields.get('cashPart')):0;
    if(cash>payment.totalCents||method==='mixed'&&(cash===0||cash===payment.totalCents))throw new Error('El pago mixto necesita una parte de efectivo y otra en el segundo medio.');
    const payments=[];if(cash>0)payments.push({method:'cash',amountCents:cash,receivedCents:inputCents(fields.get('received'))});
    if(method!=='cash'){const external=method==='mixed'?fields.get('externalMethod'):method,reference=referenceForTender(payment.referencePolicy,external,fields.get('reference:'+external)??undefined);
     payments.push({method:external,amountCents:payment.totalCents-cash,simulatedAccepted:fields.get('cardAccepted')==='on',...(reference===undefined?{}:{reference})});}
    const submissionGeneration=generation,operator=identity(),operationId=payment.id,submit=()=>adapter.submit({operationId,payments,scenario:fields.get('scenario')});
    const ticket=live()&&adapter.localSaleTicket?await adapter.localSaleTicket({operationId,payments}):null;
    let submitted;
    if(ticket){const deviceId=offlineDevice(storage),journal=localJournal(deviceId);
     submitted=await submitWithLocalReceipt({journal,operationId,ticket,submit,isOnline:()=>payment?.localEstimate!==true&&globalThis.navigator?.onLine!==false,isCurrent:()=>submissionGeneration===generation&&operator===identity()&&allowed()&&!!host&&session?.id===ticket.cashSessionId});
    }else submitted=await submit();
    if(submissionGeneration!==generation||operator!==identity()||!allowed())return;
    receipt=submitted;if(live()&&receipt.status==='uncertain')queueSyncRetry();
    if(receipt.status==='confirmed'){payment=null;lines=[];draftInfo=null;delete formValues.ticket;
     if(live()){notice=receiptStyle.showAfterSale||receiptStyle.printAfterSale?'Pedido confirmado. Preparando justificante…':'';if(notice)render();
      const delivery=await receiptDelivery.afterConfirmation({sale:receipt,options:effectiveReceiptStyle(),current:()=>submissionGeneration===generation&&operator===identity()&&allowed()});
      if(submissionGeneration!==generation||operator!==identity())return;
      if(delivery?.document)documentPreview=delivery.document;notice=delivery?.warning||'';
     }
     if(!live())await reloadProducts();}
   } else if(kind==='refund'){
    const items=returnForm.lines.map(line=>({productId:line.productId,qty:Number(fields.get('qty-'+line.productId)),
     restock:fields.get('restock-'+line.productId)==='on'})).filter(line=>line.qty>0);
    if(live()){returnForm.prepared=await adapter.prepareRefund({operationId:returnForm.operationId,saleId:returnForm.saleId,items,reason:String(fields.get('reason')||'').trim(),refundMethod:fields.get('refundMethod')||'original'});delete formValues.refund;return;}
    const result=await adapter.refund({operationId:returnForm.operationId,sessionId:session.id,saleId:returnForm.saleId,items,
     refundConfirmed:fields.get('refundAccepted')==='on'});
    notice=`Devolución de práctica registrada: ${result.reference} · ${money(result.totalCents)}. Sin reintegro real.`;
    returnForm=null;history=await adapter.history({sessionId:session.id});await reloadProducts();
   } else if(kind==='movement'){
    summary=await adapter.cashMovement({kind:fields.get('kind'),amountCents:inputCents(fields.get('amount')),reason:fields.get('reason')});notice='Movimiento de caja registrado.';
   } else if(kind==='close'){
    if(stockIntake.hasDraft()||stockIntake.pending())throw Error('Termina, guarda o cancela la entrada de mercancía antes de cerrar la caja.');
    if(lines.length||draftInfo||payment||returnForm||customers.hasDraft()||productIntake.hasDraft())throw new Error('Termina, aparca o descarta el ticket o la devolución pendientes antes de cerrar la caja.');
    const closed=await adapter.closeSession({sessionId:session.id,countedCents:inputCents(fields.get('counted')),note:fields.get('note')||''});
    notice=wording('Caja de práctica cerrada. Diferencia: ','Caja cerrada. Diferencia: ')+money(closed.differenceCents);selectedStore=session.storeId;selectedDrawer=session.drawerId;session=null;receipt=null;payment=null;lines=[];tab='sale';formValues={};
   }
   delete formValues[kind];formDirty=Object.keys(formValues).length>0;
  });
 }
 function reflectPaymentMethod(){const form=host?.querySelector('[data-tpv-form="pay"]');if(!form)return;
  const method=form.querySelector('[data-tpv-method]').value;
  form.querySelector('[data-tpv-cash-part]').hidden=method!=='mixed';for(const element of form.querySelectorAll('[data-tpv-received]'))element.hidden=!['cash','mixed'].includes(method);
  for(const input of form.querySelectorAll('[data-tpv-count="received"] input'))input.disabled=!['cash','mixed'].includes(method);
  form.querySelector('[data-tpv-external-method]').hidden=method!=='mixed';
  form.querySelector('[data-tpv-denominations]').hidden=!['cash','mixed'].includes(method);
  const external=method==='mixed'?form.elements.externalMethod.value:method;
  for(const field of form.querySelectorAll('[data-tpv-reference]')){const active=field.dataset.tpvReference===external;field.hidden=!active;field.querySelector('input').required=active&&payment.referencePolicy?.[external]==='required';}
  form.querySelector('[data-tpv-card-accept]').hidden=method==='cash';reflectTender();}
 function reflectTender(){const form=host?.querySelector('[data-tpv-form="pay"]');if(!form||!payment)return;
  const output=form.querySelector('[data-tpv-tender-preview]'),confirm=form.querySelector('button[type="submit"]');
  try{const method=form.elements.method.value,cash=method==='cash'?payment.totalCents:method==='mixed'?inputCents(form.elements.cashPart.value):0;
   if(method==='mixed'&&(cash===0||cash>=payment.totalCents))throw new Error('Indica la parte en efectivo; el resto se registra en el segundo medio.');
   const tender=cashTenderPreview({totalCents:payment.totalCents,cashPartCents:cash,receivedCents:cash===0?0:form.elements.received.value.trim()===''?0:inputCents(form.elements.received.value)});
   const external=method==='mixed'?form.elements.externalMethod.value:method;
   referenceForTender(payment.referencePolicy,external,form.elements.namedItem('reference:'+external)?.value);
   output.innerHTML=tenderSummaryHtml({totalCents:payment.totalCents,cashPartCents:cash,receivedCents:tender.receivedCents,discountCents:payment.discountCents||0,externalLabel:payment.paymentLabels?.[external]||paymentLabel(external)});
   output.dataset.state=tender.cashCovered?'ready':'pending';confirm.disabled=busy||!tender.cashCovered||method!=='cash'&&!form.elements.cardAccepted.checked;
  }catch(error){output.textContent=error.message||'Revisa los importes del cobro.';output.dataset.state='invalid';confirm.disabled=true;}}
 function change(event){
  if(!host||busy||!allowed()||mountedActor!==identity())return;
  if(updateCashCount(event.target)){rememberForm(event.target);reflectTender();return;}
  if(['opening','received','counted'].includes(event.target.name))clearCashCount(event.target.form,event.target.name);
  if(event.target.hasAttribute('data-tpv-product-images')){const files=[...event.target.files];return work(()=>productIntake.images(files));}
  if(productIntake.input(event.target))return;
  if(event.target.matches('[data-tpv-order-search] [name=orderId]')){orderLookup=event.target.value;return;}
  updateReceiptPreview(event.target);
  if(catalogueTable.change(event.target))return;
  if(barcodePanel.input(event.target))return;
  if(event.target.closest('[data-tpv-barcode-form]'))return;
  if(stockIntake.input(event.target))return;
  if(event.target.hasAttribute('data-tpv-report-id'))return work(()=>reports.change(event.target));
  if(event.target.matches('[data-tpv-variant-group]')){const next=Number(event.target.value);if(!products.variantGroups?.some(row=>row.id===next)&&next!==0)return;return work(async()=>{await reloadProducts({variantGroupId:next,sortField:'name',sortDirection:'asc',page:0});variantGroupId=next;catalogueSort={field:'name',direction:'asc'};productPage=0;});}
  if(event.target.matches('[data-tpv-variant-order]')){const [field,direction]=event.target.value.split(':');if(!['name','stock','price','reference'].includes(field)||!['asc','desc'].includes(direction))return;return work(async()=>{await reloadProducts({sortField:field,sortDirection:direction,page:0});catalogueSort={field,direction};productPage=0;scheduleCatalogueRefresh();});}
  if(event.target.matches('[data-tpv-view]')){if(variantProduct)variantView=event.target.value;else catalogueView=event.target.value;render();return;}
  if(event.target.matches('[data-tpv-disabled-stock]')){if(tab!=='stock'||!canReceiveStock())return;const value=event.target.checked;searchRevision++;clearTimeout(searchTimer);return work(async()=>{includeDisabledStock=value;products=[];variantProduct=0;variantGroupId=0;productPage=0;await reloadProducts();});}
  if(event.target.matches('[data-tpv-category]')){categoryId=Number(event.target.value);productPage=0;variantProduct=0;return work(reloadProducts);}
  if(accessPanel.input(event.target))return;
  rememberForm(event.target);
  if(event.target.closest('[data-tpv-form="ticket"]'))reflectLineTotals();
  if(event.target.hasAttribute('data-tpv-client-country'))return work(()=>customers.change(event.target));
  if(event.target.matches('[data-tpv-config-store]')){if(formValues.configure)delete formValues.configure.drawer;render();return;}
  if(event.target.dataset.tpvLineKind&&!payment&&can('edit')){const line=lines.find(l=>l.productId===event.target.dataset.tpvLineKind);
   if(line){line.discountKind=event.target.value;line.discountValue='';render();if(live())void refreshBasketPrices();}return;}
  if(event.target.matches('[data-tpv-store]')&&!session){const store=event.target.value,drawer=context.drawers.find(d=>d.storeId===store)?.id||'';return changeWorkstation(store,drawer);}
  if(event.target.matches('[data-tpv-drawer]')&&!session)return changeWorkstation(selectedStore||context.stores[0]?.id,event.target.value);
  if(event.target.matches('[data-tpv-method]')){
   reflectPaymentMethod();return;
  }
  if(event.target.name==='externalMethod'&&event.target.closest('[data-tpv-form="pay"]')){reflectPaymentMethod();return;}
  if(event.target.dataset.tpvQuantity&&!payment&&canSell()){const line=lines.find(l=>l.productId===event.target.dataset.tpvQuantity),value=Number(event.target.value),
   available=products.find(p=>p.id===line?.productId)?.stock??line?.stock;
   if(line&&event.target.value!==''&&Number.isSafeInteger(value)&&value>=(line.minimumQty||1)&&value<=10000&&(value<=available||canExceedStock(line,stockRules))){const changed=line.qty!==value;line.qty=value;failure='';if(live()&&changed)void refreshBasketPrices();}
   else {failure='La cantidad debe ser entera y no superar las existencias disponibles.';event.target.reportValidity();}}
 }
 function input(event){if(!host||busy||!allowed()||mountedActor!==identity())return;
  if(barcodePanel.input(event.target))return;
  if(event.target.closest('[data-tpv-barcode-form]'))return;
  if(event.target.name==='note'&&event.target.closest('[data-tpv-form="ticket"]')){try{if(saleNote(event.target.value)&&failure==='Añade la nota interna antes de calcular el cobro.'){failure='';host.querySelector('.tpv-workarea>.note.bad')?.remove();}}catch{}}
  if(updateCashCount(event.target)){rememberForm(event.target);reflectTender();return;}
  if(['opening','received','counted'].includes(event.target.name))clearCashCount(event.target.form,event.target.name);
  if(productIntake.input(event.target))return;
  updateReceiptPreview(event.target);
  if(catalogueTable.input(event.target))return;
  if(stockIntake.input(event.target))return;
  if(event.target.dataset.tpvQuantity&&!payment&&canSell()){
   const target=event.target,line=lines.find(l=>l.productId===target.dataset.tpvQuantity),qty=Number(target.value),
    available=products.find(p=>p.id===line?.productId)?.stock??line?.stock,
    valid=line&&target.value!==''&&Number.isSafeInteger(qty)&&qty>=(line.minimumQty||1)&&qty<=10000&&(qty<=available||canExceedStock(line,stockRules));
   target.setCustomValidity(valid?'':'Indica unidades enteras dentro del stock disponible.');
   if(valid){line.qty=qty;if(live())void refreshBasketPrices();else reflectLineTotals();}
   return;
  }
  if(event.target.closest('[data-tpv-client-form]')){customers.input(event.target.form);return;}
  if(event.target.dataset.tpvLineValue&&!payment&&can('edit')){const line=lines.find(l=>l.productId===event.target.dataset.tpvLineValue);if(line){line.discountValue=event.target.value;reflectLineTotals();}return;}
  if(accessPanel.input(event.target))return;
  if(!event.target.matches('[data-tpv-search]')){rememberForm(event.target);if(event.target.closest('[data-tpv-form="ticket"]'))reflectLineTotals();if(event.target.closest('[data-tpv-form="pay"]'))reflectTender();return;}search=event.target.value;productPage=0;variantProduct=0;clearTimeout(searchTimer);
  const run=generation,request=++searchRevision,query=search,currentTab=tab,inventoryQuery=inventoryCatalogueQuery();searchTimer=setTimeout(async()=>{try{const found=await adapter.searchProducts({sessionId:session.id,search:query,categoryId,sortField:catalogueSort.field,sortDirection:catalogueSort.direction,searchFields:searchOptions.fields,catalogueFilters:currentCatalogueFilters(),...inventoryQuery});
   if(run!==generation||request!==searchRevision||busy||tab!==currentTab||!['sale','stock'].includes(tab))return;
   products=found;scheduleCatalogueRefresh();const focus=host.querySelector('[data-tpv-search]');if(!focus)return;const start=focus.selectionStart;
   const wasFocused=document.activeElement===focus;render();const next=host.querySelector('[data-tpv-search]');
   if(next&&wasFocused){next.focus();next.setSelectionRange(start,start);}
  }catch(error){if(run===generation&&request===searchRevision){failure=error.message;render();}}},150);}
 function changeWorkstation(store,drawer){
  if(live())return work(async()=>{
   if(formValues['payment-settings']&&!await askCurrent('¿Cambiar de caja y descartar los cambios de medios de cobro sin guardar?'))return;
   await adapter.selectWorkstation({storeId:store,drawerId:drawer});
   selectedStore=store;selectedDrawer=drawer;reports.reset();
   delete formValues['payment-settings'];formDirty=Object.keys(formValues).length>0;
   await loadWorkspacePreferences();
  });
  selectedStore=store;selectedDrawer=drawer;reports.reset();render();
 }
 function fitActionsMenu(){
  const details=host?.querySelector('.tpv-actions');if(!details?.open)return;
  const panel=details.querySelector(':scope > div'),anchor=details.querySelector('summary').getBoundingClientRect(),bounds=host.getBoundingClientRect();
  const below=Math.min(window.innerHeight,bounds.bottom)-anchor.bottom,above=anchor.top-Math.max(0,bounds.top),up=below<160&&above>below;
  panel.style.top=up?'auto':'100%';panel.style.bottom=up?'100%':'auto';panel.style.maxHeight=Math.max(44,Math.min(480,(up?above:below)-12))+'px';
 }
 function sizeWorkspace(){if(host){host.style.setProperty('--tpv-height',Math.max(360,window.innerHeight-Math.max(0,host.getBoundingClientRect().top)-12)+'px');fitActionsMenu();}}
 function dispose(){basketPriceRevision++;basketPreview=null;clearTimeout(basketPriceTimer);catalogueBackground.stop();clearTimeout(onlineSyncTimer);onlineSyncTimer=null;onlineSyncRequested=false;offlinePanel.reset();barcodePanel.reset();quantityPicker.cancel();lineNameEditor.cancel();customerScreen.close();accessPanel.reset();productIntake.reset();if(audioFeedback){void audioFeedback.close().catch(()=>{});audioFeedback=null;}generation++;searchRevision++;clearTimeout(searchTimer);clearTimeout(catalogueRefreshTimer);abort?.abort();catalogueTable.dispose();host=null;busy=false;scanQueue=[];scanning=false;mobilePane='catalogue';}
 return {mount(root){dispose();host=root;mountedActor=identity();
   budgetPending=false;
   includeDisabledStock=false;
   stockIntake.reset();
   catalogueTable.setColumns();catalogueSort={field:'name',direction:'asc'};variantGroupId=0;variantProductName='';variantView='';parentCatalogueSort=null;
   drawerPayments=null;customMenuLinks=[];returnRules={allowPartial:true};orderLookup='';focusOrderLookup=false;stockRules=stockPolicy();priceRules=lineOptions();parkingRules=parkingOptions();displayOptions=displayPreferences();searchOptions=searchPreferences();catalogueOptions=cataloguePreferences();receiptStyle=receiptOptions();cashStyle=cashOptions();customerScreenOptions=customerDisplayOptions();incidentForm=false;categories=[];categoryId=0;initialCategoryId=0;catalogueView='grid';adapter=null;context=null;session=null;lines=[];receipt=null;payment=null;notice='';failure='';tab='sale';returnForm=null;paymentValues={};
   formValues={};formDirty=false;selectedStore='';selectedDrawer='';search='';products=[];history=[];summary=null;setup=null;productPage=0;variantProduct=0;stockProduct=null;configuration=null;configurationId=null;documentPreview=null;selectedCustomer=null;customers.reset();reports.reset();parked=[];draftInfo=null;budgetPage={items:[],hasMore:false};selectedBudget=null;budgetEditing=false;budgetQuery='';
   if(!allowed()){host.innerHTML='<p role="alert">Necesitas acceso a Ventas y Cajas para usar TotusTPV.</p>';return;}
   abort=new AbortController();for(const [type,handler] of [['click',click],['submit',submit],['change',change],['input',input],['keydown',keydown]])
   host.addEventListener(type,handler,{signal:abort.signal});window.addEventListener('online',()=>{onlineSyncRequested=true;syncAfterReconnect();},{signal:abort.signal});window.addEventListener('pagehide',()=>customerScreen.close(),{signal:abort.signal});window.addEventListener('resize',sizeWorkspace,{signal:abort.signal});document.addEventListener('fullscreenchange',sizeWorkspace,{signal:abort.signal});render();if(autoOpen&&createLiveAdapter)void work(()=>openLive(false));},dispose,
   hasDraft,requestLeave};
}
