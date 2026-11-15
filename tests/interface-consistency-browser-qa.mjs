import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {navigate} from './ui-navigation.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),errors=[],views=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/tests/app-mock.html',{waitUntil:'networkidle'});
 await page.evaluate(()=>{window.__mockDb.ops_expenses.push({id:'compact-expense',expense_date:new Date().toISOString().slice(0,10),description:'Gasto ficticio',supplier_name:'Proveedor ficticio',gross_expense:126.2,accounting_amount:126.2,amount_paid:0,paid_status:'pendiente',fiscal_reviewed:false});});
 for(const width of [1440,1017,390]){
  await page.setViewportSize({width,height:641});
  for(const route of ['inicio','pricing','ventas','prestashop','productos','clientes','proveedores','marcas','cajas','gastos','facturacion','documentos','fiscalidad','informes','tareas','equipo','administracion','configuracion','automatizaciones','apis']){
   await navigate(page,route);await page.evaluate(async()=>{const {applyInterfaceAppearance}=await import('../src/appearance-ui.js');applyInterfaceAppearance({fontSize:18,cardPadding:24,gap:28,borderWidth:3,cardGlow:20,borderColor:'#0075ff',sidebarWidth:320});});
   const geometry=await page.locator('#content').evaluate(root=>({overflow:root.scrollWidth>root.clientWidth+2,kpis:[...root.querySelectorAll('.kpi,.ps-kpi')].filter(n=>n.checkVisibility()).map(n=>({height:n.getBoundingClientRect().height,padding:parseFloat(getComputedStyle(n).paddingTop)})),padding:[...root.querySelectorAll('.card-pad')].filter(n=>n.checkVisibility()&&!n.closest('.appearance-preview')).map(n=>parseFloat(getComputedStyle(n).paddingTop))}));
   assert.equal(geometry.overflow,false,route+' page fits '+width);assert(geometry.kpis.every(n=>n.padding<=12),route+' compact KPI padding '+width);assert(geometry.padding.every(n=>n<=12),route+' card padding '+width+' '+JSON.stringify(geometry.padding));
   if(route==='productos')assert.equal(await page.locator('[data-pr-action=catalog-price-batch],[data-pr-action=catalog-offer-batch]').count(),0,'Bulk pricing belongs to Precio');
   if(route==='gastos'){
    await page.locator('section.card.table-card').first().evaluate(card=>{card.style.transform='translateY(0)';card.style.overflow='hidden';});
    const trigger=page.getByLabel('Configurar columnas',{exact:true});await trigger.waitFor();await trigger.click();
    const panel=page.locator('.tc-settings-panel:visible');await panel.waitFor();const box=await panel.boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=642,'Gastos columns within viewport '+width+' '+JSON.stringify({box,style:await panel.getAttribute('style'),trigger:await trigger.boundingBox()}));
    for(const name of ['Guardar distribución','Restablecer columnas']){const b=panel.getByRole('button',{name,exact:true});await b.scrollIntoViewIfNeeded();const rect=await b.boundingBox();assert(rect.y>=box.y&&rect.y+rect.height<=box.y+box.height+1,name+' not clipped '+width);}
    const row=panel.locator('.tc-column-row').nth(1),check=row.locator('input[type=checkbox]'),before=await check.isChecked();await check.setChecked(!before);await panel.getByRole('button',{name:'Guardar distribución',exact:true}).click();await panel.getByRole('button',{name:'Cerrar columnas',exact:true}).click();await trigger.click();assert.equal(await panel.locator('.tc-column-row').nth(1).locator('input[type=checkbox]').isChecked(),!before);await panel.getByRole('button',{name:'Restablecer columnas',exact:true}).click();await panel.getByRole('button',{name:'Cerrar columnas',exact:true}).click();
   }
   views.push({route,width,...geometry});
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/interface-consistency.json',JSON.stringify({productionWrites:false,views},null,2));console.log('INTERFACE CONSISTENCY: 20 modules, saved large personal styling, three widths, Gastos column open/edit/save/reset, no duplicated pricing actions PASS.');
}finally{await browser.close();}
